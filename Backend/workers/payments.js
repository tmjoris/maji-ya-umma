import { K, get, getMany, update, put, tx, transact, retryOnConflict, versionCondition, now } from "../data/db.js";
import { EVENTS } from "../mq/config.js";
import { PermanentError } from "../mq/errors.js";
import { isLastAttempt } from "../mq/consumer.js";
import { publishEvent, publishDelayed } from "../mq/publisher.js";
import { MPESA_MODE, stkPush, queryStatus, simulatedCallback, callbackMetadata } from "../services/mpesa.js";
import { stripe, cardDetails, fromStripeAmount, STRIPE_CURRENCY } from "../services/stripe.js";

// Payment lifecycle:
//   M-Pesa: queued ─(payments.initiate: STK push)─▶ pending ─┬─(callback)─────────▶ completed / failed
//                                                            └─(status_check poll)─▶ completed / failed
//   Card:   queued ─(API creates PaymentIntent)─▶ pending ─┬─(Stripe webhook)────▶ completed / failed
//                                                          └─(status_check poll)─▶ completed / failed
const FINAL = new Set(["completed", "failed"]);
const MAX_STATUS_CHECKS = Number(process.env.MPESA_MAX_STATUS_CHECKS || 5);
// Typing card details and passing 3-D Secure takes longer than an M-Pesa PIN.
const MAX_CARD_STATUS_CHECKS = Number(process.env.STRIPE_MAX_STATUS_CHECKS || 30);

// A payment that isn't final yet; used as a write condition so a settled
// payment can never be changed again.
const NOT_FINAL = {
  condition: "#st IN (:queued, :initiating, :pending)",
  names: { "#st": "status" },
  values: { ":queued": "queued", ":initiating": "initiating", ":pending": "pending" },
};
const isConditionFailure = (err) => err?.name === "ConditionalCheckFailedException";

async function getPayment(paymentId) {
  return get(K.payment(paymentId));
}

async function scheduleFollowUps(paymentId, p) {
  await publishDelayed(
    "paymentStatusCheck",
    EVENTS.PAYMENT_STATUS_CHECK,
    { paymentId, check: 1 },
    { id: `${paymentId}:status-check:1` }
  );
  if (MPESA_MODE === "simulate") {
    await publishDelayed(
      "mpesaSimulator",
      EVENTS.MPESA_CALLBACK_RECEIVED,
      {
        source: "simulator",
        callback: simulatedCallback({
          checkoutRequestId: p.checkoutRequestId,
          merchantRequestId: p.merchantRequestId,
          amount: p.amount,
          phone: p.phone,
        }),
      },
      { id: `mpesa-cb:${p.checkoutRequestId}` }
    );
  }
}

// payments.initiate — sends the STK push. A payment is claimed (queued →
// initiating) in a transaction first, so redeliveries can never push twice.
export async function initiatePayment(event) {
  const { paymentId } = event.data;
  let p = await getPayment(paymentId);
  if (!p) throw new PermanentError(`payment ${paymentId} not found`);

  let claimed = false;
  if (p.status === "queued") {
    try {
      p = await update(K.payment(paymentId), {
        set: { status: "initiating", updatedAt: now() },
        condition: "#st = :queued",
        names: { "#st": "status" },
        values: { ":queued": "queued" },
      });
      claimed = true;
    } catch (err) {
      if (!isConditionFailure(err)) throw err;
      p = await getPayment(paymentId); // someone else claimed it first
    }
  }

  if (!claimed) {
    // A previous attempt crashed mid-push: we can't know whether the prompt
    // went out, so fail it rather than risk charging twice. If the customer
    // does pay, the callback is parked as unmatched for staff.
    if (p.status === "initiating") {
      return settlePayment(paymentId, {
        success: false,
        reason: "The payment request was interrupted. Please try again.",
        source: "initiate",
      });
    }
    // Already pushed: just make sure the follow-ups exist (ids dedupe them).
    if (p.status === "pending") return scheduleFollowUps(paymentId, p);
    return;
  }

  let push;
  try {
    push = await stkPush({ paymentId, amount: p.amount, phone: p.phone, accountReference: p.accountNumber });
  } catch (err) {
    if (err.permanent) {
      return settlePayment(paymentId, { success: false, reason: err.message, source: "stk_push" });
    }
    // Let the retry push again.
    await update(K.payment(paymentId), {
      set: { status: "queued", updatedAt: now() },
      condition: "#st = :initiating",
      names: { "#st": "status" },
      values: { ":initiating": "initiating" },
    });
    throw err;
  }

  const pending = {
    status: "pending",
    checkoutRequestId: push.checkoutRequestId,
    merchantRequestId: push.merchantRequestId,
    customerMessage: push.customerMessage ?? null,
    initiatedAt: now(),
    updatedAt: now(),
  };
  // The checkout → payment lookup item lets callbacks find the payment.
  await transact([
    tx.update(K.payment(paymentId), {
      set: pending,
      condition: "#st = :initiating",
      names: { "#st": "status" },
      values: { ":initiating": "initiating" },
    }),
    tx.put({ ...K.checkout(push.checkoutRequestId), entity: "checkout", paymentId }, null),
  ]);
  await scheduleFollowUps(paymentId, { ...p, ...pending });
}

// Marks a payment completed or failed exactly once. On success the amount is
// allocated to the customer's open bills, oldest first; anything left over
// becomes account credit (negative balance) that the next bill consumes.
export async function settlePayment(paymentId, outcome) {
  const payment = await retryOnConflict(() => settleOnce(paymentId, outcome));
  // Published on every call, including repeats; the deterministic id lets the
  // notification senders drop duplicates.
  await publishEvent(
    payment.status === "completed" ? EVENTS.PAYMENT_COMPLETED : EVENTS.PAYMENT_FAILED,
    {
      paymentId,
      uid: payment.uid,
      amount: payment.amountPaid ?? payment.amount,
      method: payment.method ?? "mpesa",
      receipt: payment.mpesaReceipt ?? null,
      cardBrand: payment.cardBrand ?? null,
      cardLast4: payment.cardLast4 ?? null,
      reason: payment.failureReason ?? null,
    },
    { id: `${paymentId}:${payment.status}` }
  );
}

// One attempt at settling. Everything is written in a single transaction
// that only succeeds if the payment, the bills and the customer are still
// as they were read; otherwise retryOnConflict runs it again.
async function settleOnce(paymentId, { success, receipt, amountPaid, reason, resultCode, source, details = {} }) {
  const p = await getPayment(paymentId);
  if (!p) throw new PermanentError(`payment ${paymentId} not found`);
  if (FINAL.has(p.status)) return p;

  if (!success) {
    const failed = {
      status: "failed",
      failureReason: reason ?? "Payment was not completed",
      resultCode: resultCode ?? null,
      settledBy: source,
      failedAt: now(),
      updatedAt: now(),
      ...details,
    };
    await update(K.payment(paymentId), { set: failed, ...NOT_FINAL });
    return { ...p, ...failed };
  }

  const amount = Number.isFinite(amountPaid) ? amountPaid : p.amount;
  const user = await get(K.user(p.uid));
  if (!user) throw new PermanentError(`payment ${paymentId} belongs to missing user ${p.uid}`);
  const open = (await getMany((user.openBills ?? []).map((id) => K.bill(id))))
    .filter((b) => b && b.status !== "paid")
    .sort((a, b) => a.period.localeCompare(b.period));

  const items = [];
  const allocations = [];
  const stillOpen = [];
  let remaining = amount;
  for (const bill of open) {
    if (remaining <= 0) {
      stillOpen.push(bill.id);
      continue;
    }
    const owed = bill.amountDue - bill.amountPaid;
    const applied = Math.min(owed, remaining);
    const paidInFull = applied >= owed;
    items.push(
      tx.update(K.bill(bill.id), {
        set: { amountPaid: bill.amountPaid + applied, status: paidInFull ? "paid" : "partially_paid", ...(paidInFull ? { paidAt: now() } : {}) },
        condition: "#paid = :paidBefore",
        names: { "#paid": "amountPaid" },
        values: { ":paidBefore": bill.amountPaid },
      })
    );
    allocations.push({ billId: bill.id, period: bill.period, amount: applied });
    remaining -= applied;
    if (!paidInFull) stillOpen.push(bill.id);
  }

  items.push(
    tx.update(K.user(p.uid), {
      set: { openBills: stillOpen, lastPaymentAt: now(), lastPaymentAmount: amount },
      add: { balance: -amount, version: 1 },
      ...versionCondition(user),
    })
  );
  const completed = {
    status: "completed",
    amountPaid: amount,
    ...(p.method === "card" ? {} : { mpesaReceipt: receipt ?? null }),
    ...details,
    allocations,
    creditAdded: remaining,
    settledBy: source,
    completedAt: now(),
    updatedAt: now(),
  };
  items.push(tx.update(K.payment(paymentId), { set: completed, ...NOT_FINAL }));
  await transact(items);
  return { ...p, ...completed };
}

// payments.reconcile — M-Pesa callbacks (real or simulated).
export async function reconcileCallback(event, msg) {
  const { callback, source } = event.data;
  const checkoutRequestId = callback?.CheckoutRequestID;
  if (!checkoutRequestId) throw new PermanentError("callback without CheckoutRequestID");

  const match = await get(K.checkout(checkoutRequestId));
  if (!match) {
    // A fast failure callback can beat the worker's own write of the
    // checkoutRequestId; give it a few retries before parking it for staff.
    if (!isLastAttempt(msg)) throw new Error(`no payment for checkout ${checkoutRequestId} yet`);
    await put({ ...K.unmatched(checkoutRequestId), entity: "unmatched", id: checkoutRequestId, callback, source, receivedAt: now(), resolved: false });
    console.warn(`[payments] unmatched M-Pesa callback ${checkoutRequestId} stored for review`);
    return;
  }

  const meta = callbackMetadata(callback);
  const resultCode = Number(callback.ResultCode);
  const paymentId = match.paymentId;
  const p = await getPayment(paymentId);

  // Our own simulator (no Daraja to ask), or already settled (republish only).
  if (MPESA_MODE === "simulate" || FINAL.has(p.status)) {
    return settlePayment(paymentId, {
      success: resultCode === 0,
      receipt: meta.MpesaReceiptNumber ?? null,
      amountPaid: p.amount,
      reason: callback.ResultDesc,
      resultCode,
      source: source === "simulator" ? "simulator" : "callback",
    });
  }

  // Daraja doesn't sign callbacks, so the callback is only a hint: the outcome
  // is confirmed with Daraja's own status query, and the amount credited is
  // the amount we asked M-Pesa to charge, never the callback's Amount field.
  const verified = await queryStatus(checkoutRequestId);
  if (verified.state === "processing") {
    if (!isLastAttempt(msg)) throw new Error(`Daraja still processing ${checkoutRequestId}`);
    return; // the status-check poller settles it later
  }
  const success = verified.state === "success";
  if (success !== (resultCode === 0)) {
    console.warn(`[payments] callback for ${checkoutRequestId} says ${resultCode}, Daraja says ${verified.resultCode}; trusting Daraja`);
  }
  await settlePayment(paymentId, {
    success,
    receipt: success ? meta.MpesaReceiptNumber ?? null : null,
    amountPaid: p.amount,
    reason: success ? null : verified.resultDesc,
    resultCode: verified.resultCode,
    source: "callback",
  });
}

// payments.status_check — fed by the delay queue. Polls Daraja for payments
// whose callback never arrived, then gives up after MAX_STATUS_CHECKS.
function scheduleStatusCheck(paymentId, check) {
  return publishDelayed(
    "paymentStatusCheck",
    EVENTS.PAYMENT_STATUS_CHECK,
    { paymentId, check },
    { id: `${paymentId}:status-check:${check}` }
  );
}

export async function checkPaymentStatus(event) {
  const { paymentId, check } = event.data;
  const p = await getPayment(paymentId);
  if (!p || FINAL.has(p.status)) return;
  if (p.method === "card") return checkCardPayment(paymentId, p, check);
  if (p.status !== "pending") return;

  const result = await queryStatus(p.checkoutRequestId);
  if (result.state === "processing") {
    if (check >= MAX_STATUS_CHECKS) {
      return settlePayment(paymentId, {
        success: false,
        reason: "No confirmation from M-Pesa (timed out)",
        source: "status_check",
      });
    }
    return scheduleStatusCheck(paymentId, check + 1);
  }

  await settlePayment(paymentId, {
    success: result.state === "success",
    reason: result.resultDesc,
    resultCode: result.resultCode,
    source: "status_query",
  });
}

// ---------- card (Stripe) ----------

async function settleCardSuccess(paymentId, paymentIntentId, source) {
  const card = await cardDetails(paymentIntentId);
  const pi = card.paymentIntent;
  if (pi.status !== "succeeded") throw new Error(`PaymentIntent ${pi.id} is ${pi.status}, not succeeded`);
  if (pi.currency !== STRIPE_CURRENCY) throw new PermanentError(`PaymentIntent ${pi.id} is in ${pi.currency}`);
  await settlePayment(paymentId, {
    success: true,
    receipt: card.chargeId,
    amountPaid: fromStripeAmount(pi.amount_received),
    source,
    details: {
      stripeChargeId: card.chargeId,
      cardBrand: card.cardBrand,
      cardLast4: card.cardLast4,
      receiptUrl: card.receiptUrl,
    },
  });
}

// A card payment is only ever failed after its PaymentIntent is cancelled:
// until then the customer may still complete it (e.g. with another card after
// a decline), and Stripe guarantees a cancelled intent can't succeed later.
async function checkCardPayment(paymentId, p, check) {
  if (!p.stripePaymentIntentId) return;
  const pi = await stripe().paymentIntents.retrieve(p.stripePaymentIntentId);

  if (pi.status === "succeeded") return settleCardSuccess(paymentId, pi.id, "status_query");
  if (pi.status === "canceled") {
    return settlePayment(paymentId, { success: false, reason: "Card payment was cancelled", source: "status_query" });
  }
  if (pi.status === "processing" || check < MAX_CARD_STATUS_CHECKS) return scheduleStatusCheck(paymentId, check + 1);

  try {
    await stripe().paymentIntents.cancel(pi.id, { cancellation_reason: "abandoned" });
  } catch (err) {
    // Its state changed under us (e.g. it just succeeded): look again shortly.
    console.warn(`[payments] couldn't cancel ${pi.id}: ${err.message}`);
    return scheduleStatusCheck(paymentId, check + 1);
  }
  return settlePayment(paymentId, {
    success: false,
    reason: "Card payment was not completed in time",
    source: "status_check",
  });
}

// payments.stripe — verified Stripe webhook events (see routes/stripe.js).
export async function handleStripeEvent(event) {
  const { type, paymentIntentId, paymentId, lastError, source } = event.data;
  // stripe = verified webhook, client_return = /confirm endpoint, customer = cancel button
  const via = !source || source === "stripe" ? "stripe_webhook" : source;
  if (!paymentId) return; // a PaymentIntent this app didn't create

  const p = await getPayment(paymentId);
  if (!p) throw new PermanentError(`webhook for unknown payment ${paymentId}`);
  if (p.stripePaymentIntentId !== paymentIntentId) {
    throw new PermanentError(`payment ${paymentId} is linked to ${p.stripePaymentIntentId}, not ${paymentIntentId}`);
  }

  // Queue messages are only hints: every outcome is confirmed with Stripe's
  // API (settleCardSuccess re-fetches the intent too), so a forged or replayed
  // message can neither mark a payment paid nor wrongly fail a real one.
  if (type === "payment_intent.succeeded") return settleCardSuccess(paymentId, paymentIntentId, via);
  if (type === "payment_intent.canceled") {
    const pi = await stripe().paymentIntents.retrieve(paymentIntentId);
    if (pi.status === "succeeded") return settleCardSuccess(paymentId, paymentIntentId, via);
    if (pi.status !== "canceled") throw new PermanentError(`cancel event for ${paymentIntentId}, but Stripe says ${pi.status}`);
    return settlePayment(paymentId, { success: false, reason: "Card payment was cancelled", source: via });
  }
  if (type === "payment_intent.payment_failed" && !FINAL.has(p.status)) {
    // Not final: the customer can retry with another card.
    try {
      await update(K.payment(paymentId), { set: { lastCardError: lastError ?? "Card was declined", updatedAt: now() }, ...NOT_FINAL });
    } catch (err) {
      if (!isConditionFailure(err)) throw err; // settled meanwhile: nothing to record
    }
  }
}
