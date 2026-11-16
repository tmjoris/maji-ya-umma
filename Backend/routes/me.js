import express from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { K, get, put, update, query, clean, now } from "../data/db.js";
import { EVENTS } from "../mq/config.js";
import { publishEvent, publishDelayed, BrokerUnavailableError } from "../mq/publisher.js";
import { sendAttachment } from "../lib/filetype.js";
import { STRIPE_ENABLED, STRIPE_PUBLISHABLE_KEY, STRIPE_CURRENCY, stripe, toStripeAmount } from "../services/stripe.js";
import { requireAuth } from "../middleware/auth.js";
import { loadProfile, publicProfile, fullName } from "../services/profiles.js";
import {
  asyncHandler,
  HttpError,
  toMillis,
  normalizeKenyanPhone,
  recentPeriods,
  periodLabel,
} from "../lib/util.js";

// Everything under /api/me acts on the signed-in user only: the uid comes from
// the verified ID token, never from the request.
const router = express.Router();
router.use(requireAuth);

async function profileOf(req) {
  const profile = await loadProfile(req.user);
  if (!profile) throw new HttpError(404, "Profile not found");
  return profile;
}

const byNewest = (field) => (a, b) => toMillis(b[field]) - toMillis(a[field]);

// The signed-in customer's own items of one kind (BILL#, PAYMENT#, ...),
// newest first, from the per-customer index.
const mine = async (uid, prefix) => (await query({ index: "gsi1", pk: `USER#${uid}`, prefix, desc: true })).map(clean);

async function myPayment(req) {
  const p = await get(K.payment(req.params.id));
  if (!p || p.uid !== req.user.uid) throw new HttpError(404, "Payment not found");
  return clean(p);
}
const setPayment = (id, fields) => update(K.payment(id), { set: { ...fields, updatedAt: now() } });

// ---------- profile ----------

router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ user: publicProfile(await profileOf(req)) });
  })
);

const EDITABLE_FIELDS = ["firstName", "lastName", "phoneNumber", "address", "city", "state", "zipCode"];

router.put(
  "/",
  asyncHandler(async (req, res) => {
    await profileOf(req);
    const updates = {};
    for (const field of EDITABLE_FIELDS) {
      if (req.body?.[field] === undefined) continue;
      const value = String(req.body[field]).trim();
      if (value.length > 200) throw new HttpError(400, `${field} is too long`);
      updates[field] = value;
    }
    if ("phoneNumber" in updates) {
      updates.phoneNumber = normalizeKenyanPhone(updates.phoneNumber);
      if (!updates.phoneNumber) throw new HttpError(400, "Enter a valid Kenyan phone number, e.g. 0712345678");
    }
    if (!updates.firstName && "firstName" in updates) throw new HttpError(400, "First name can't be empty");
    if (Object.keys(updates).length === 0) throw new HttpError(400, "No profile fields to update");

    await publishEvent(EVENTS.PROFILE_UPDATE_REQUESTED, { uid: req.user.uid, updates });
    res.status(202).json({ message: "Profile updated successfully" });
  })
);

// ---------- usage ----------

router.get(
  "/usage",
  asyncHandler(async (req, res) => {
    const months = Math.min(Math.max(Number(req.query.months) || 6, 1), 24);
    const periods = recentPeriods(months);
    const [usage, meters] = await Promise.all([mine(req.user.uid, "USAGE#"), mine(req.user.uid, "METER#")]);

    const totals = Object.fromEntries(periods.map((p) => [p, 0]));
    for (const u of usage) {
      if (u.period in totals) totals[u.period] += u.consumptionLitres ?? 0;
    }

    res.json({
      meters,
      months: periods.map((p) => ({ period: p, label: periodLabel(p), consumptionLitres: totals[p] })),
    });
  })
);

// ---------- bills ----------

router.get(
  "/bills",
  asyncHandler(async (req, res) => {
    const nowMs = Date.now();
    const bills = (await mine(req.user.uid, "BILL#"))
      .map((b) => ({
        ...b,
        label: periodLabel(b.period),
        outstanding: b.amountDue - b.amountPaid,
        overdue: b.status !== "paid" && toMillis(b.dueDate) < nowMs,
      }))
      .sort((a, b) => b.period.localeCompare(a.period));
    res.json({ bills });
  })
);

// ---------- payments (M-Pesa STK push, card via Stripe) ----------

const MAX_AMOUNT = Number(process.env.MPESA_MAX_AMOUNT || 250000);

// Each STK push buzzes someone's phone; cap how often one account can do it.
const paymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: Number(process.env.PAYMENT_RATE_LIMIT_PER_10_MIN || 5),
  keyGenerator: (req) => req.user.uid,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many payment attempts. Please wait a few minutes and try again." },
});

router.get(
  "/payment-options",
  asyncHandler(async (req, res) => {
    res.json({
      currency: "KES",
      mpesa: true,
      card: STRIPE_ENABLED && Boolean(STRIPE_PUBLISHABLE_KEY),
      stripePublishableKey: STRIPE_ENABLED ? STRIPE_PUBLISHABLE_KEY : null,
    });
  })
);

router.get(
  "/payments",
  asyncHandler(async (req, res) => {
    res.json({ payments: (await mine(req.user.uid, "PAYMENT#")).sort(byNewest("createdAt")) });
  })
);

router.get(
  "/payments/:id",
  asyncHandler(async (req, res) => {
    res.json({ payment: await myPayment(req) });
  })
);

// The payment record is created here (status "queued") so the client can poll
// it right away.
//   M-Pesa: payments.initiate sends the STK push; the M-Pesa callback (or the
//           status-check poller) settles it.
//   Card:   a Stripe PaymentIntent is created now, because the browser needs
//           its client secret to show the card form; the Stripe webhook (or
//           the status-check poller) settles it.
router.post(
  "/payments",
  paymentLimiter,
  asyncHandler(async (req, res) => {
    const method = req.body?.method ?? "mpesa";
    if (!["mpesa", "card"].includes(method)) throw new HttpError(400, "method must be mpesa or card");
    if (method === "card" && !STRIPE_ENABLED) throw new HttpError(400, "Card payments are not available");

    const amount = Number(req.body?.amount);
    if (!Number.isInteger(amount) || amount < 1 || amount > MAX_AMOUNT) {
      throw new HttpError(400, `Amount must be a whole number of shillings between 1 and ${MAX_AMOUNT}`);
    }
    const phone = method === "mpesa" ? normalizeKenyanPhone(req.body?.phoneNumber) : null;
    if (method === "mpesa" && !phone) throw new HttpError(400, "Enter a valid M-Pesa phone number, e.g. 0712345678");

    const profile = await profileOf(req);
    const paymentId = randomUUID();
    const createdAt = now();
    await put({
      ...K.payment(paymentId),
      entity: "payment",
      gsi1pk: `USER#${req.user.uid}`,
      gsi1sk: `PAYMENT#${createdAt}`,
      gsi2pk: "PAYMENTS",
      gsi2sk: createdAt,
      id: paymentId,
      uid: req.user.uid,
      email: profile.email,
      accountNumber: profile.accountNumber,
      customerName: fullName(profile),
      amount,
      ...(phone ? { phone } : {}),
      method,
      status: "queued",
      createdAt,
      updatedAt: createdAt,
    });

    if (method === "card") return startCardPayment({ req, res, paymentId, amount, profile });

    try {
      await publishEvent(EVENTS.PAYMENT_REQUESTED, { paymentId }, { id: `payment-request:${paymentId}` });
    } catch (err) {
      if (err instanceof BrokerUnavailableError) {
        await setPayment(paymentId, { status: "failed", failureReason: "Payment service unavailable" });
      }
      throw err;
    }

    res.status(202).json({ paymentId, status: "queued", message: "Check your phone and enter your M-Pesa PIN" });
  })
);

async function startCardPayment({ req, res, paymentId, amount, profile }) {
  let intent;
  try {
    intent = await stripe().paymentIntents.create(
      {
        amount: toStripeAmount(amount),
        currency: STRIPE_CURRENCY,
        payment_method_types: ["card"],
        description: `Maji ya Umma water bill, account ${profile.accountNumber}`,
        receipt_email: profile.email,
        metadata: { paymentId, uid: req.user.uid, accountNumber: profile.accountNumber ?? "" },
      },
      { idempotencyKey: `payment-${paymentId}` }
    );
  } catch (err) {
    await setPayment(paymentId, { status: "failed", failureReason: err.message });
    // e.g. amount below Stripe's minimum: tell the customer why.
    if (err.type === "StripeInvalidRequestError") throw new HttpError(400, err.message);
    throw err;
  }

  await setPayment(paymentId, { status: "pending", stripePaymentIntentId: intent.id });

  // Safety net if the webhook never arrives. Not fatal if the broker is down:
  // the webhook alone settles the payment.
  publishDelayed("paymentStatusCheck", EVENTS.PAYMENT_STATUS_CHECK, { paymentId, check: 1 }, { id: `${paymentId}:status-check:1` })
    .catch((err) => console.error(`status check for ${paymentId} not scheduled: ${err.message}`));

  res.status(201).json({ paymentId, status: "pending", clientSecret: intent.client_secret });
}

// Called by the browser when the card form finishes (or after a 3-D Secure
// redirect). The browser's word isn't trusted: the server asks Stripe, and the
// worker checks with Stripe again before settling. Makes confirmation instant
// without depending on the webhook, which remains as backup (with the poller).
const confirmLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  keyGenerator: (req) => req.user.uid,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many requests, please wait a moment" },
});

router.post(
  "/payments/:id/confirm",
  confirmLimiter,
  asyncHandler(async (req, res) => {
    const p = await myPayment(req);
    if (p.method !== "card") throw new HttpError(400, "Only card payments are confirmed this way");
    if (["completed", "failed"].includes(p.status) || !p.stripePaymentIntentId) return res.json({ status: p.status });

    const intent = await stripe().paymentIntents.retrieve(p.stripePaymentIntentId);
    if (intent.status === "succeeded" || intent.status === "canceled") {
      await publishEvent(
        EVENTS.STRIPE_EVENT_RECEIVED,
        {
          type: intent.status === "succeeded" ? "payment_intent.succeeded" : "payment_intent.canceled",
          paymentIntentId: intent.id,
          paymentId: p.id,
          source: "client_return",
        },
        { id: `stripe:confirm:${p.id}:${intent.status}` }
      );
    }
    res.json({ status: p.status, stripeStatus: intent.status });
  })
);

// The customer closed the card form. Cancelling the PaymentIntent guarantees
// it can't be charged later; the payments worker then marks it failed.
router.post(
  "/payments/:id/cancel",
  asyncHandler(async (req, res) => {
    const p = await myPayment(req);
    if (p.method !== "card") throw new HttpError(400, "Only card payments can be cancelled");
    if (["completed", "failed"].includes(p.status)) throw new HttpError(409, `Payment is already ${p.status}`);

    try {
      await stripe().paymentIntents.cancel(p.stripePaymentIntentId, { cancellation_reason: "requested_by_customer" });
    } catch (err) {
      // Most likely it has just been paid; the webhook will settle it.
      throw new HttpError(409, "This payment can no longer be cancelled");
    }
    await publishEvent(
      EVENTS.STRIPE_EVENT_RECEIVED,
      { type: "payment_intent.canceled", paymentIntentId: p.stripePaymentIntentId, paymentId: p.id, source: "customer" },
      { id: `stripe:cancel:${p.id}` }
    );
    res.json({ message: "Payment cancelled" });
  })
);

// ---------- tickets (feedback / complaints) ----------

const CATEGORIES = ["billing", "technical", "account", "service", "other"];
const PRIORITIES = ["low", "medium", "high"];

// Attachments are stored in DynamoDB, whose items are capped at 400 KB.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 350 * 1024, files: 1 } }).single("attachment");
const parseUpload = (req, res, next) =>
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ message: "Attachment must be 350 KB or smaller" });
    }
    if (err) return res.status(400).json({ message: "Invalid upload" });
    next();
  });

// The file itself is a separate item (see workers/records.js); lists only show its name.
const ticketSummary = (t) => ({ ...t, attachmentName: t.attachmentName ?? null });

router.get(
  "/tickets",
  asyncHandler(async (req, res) => {
    res.json({ tickets: (await mine(req.user.uid, "TICKET#")).map(ticketSummary) });
  })
);

// A customer can fetch the attachment on their own tickets only.
router.get(
  "/tickets/:id/attachment",
  asyncHandler(async (req, res) => {
    const ticket = await get(K.ticket(req.params.id));
    if (!ticket || ticket.uid !== req.user.uid) throw new HttpError(404, "Ticket not found");
    const att = await get(K.ticketAttachment(req.params.id));
    if (!att) throw new HttpError(404, "No attachment");
    sendAttachment(res, att);
  })
);

router.post(
  "/tickets",
  parseUpload,
  asyncHandler(async (req, res) => {
    const { subject, category, priority, message } = req.body ?? {};
    if (!subject?.trim() || !message?.trim()) throw new HttpError(400, "Subject and message are required");
    if (!CATEGORIES.includes(category)) throw new HttpError(400, "Choose a category");
    if (!PRIORITIES.includes(priority)) throw new HttpError(400, "Choose a priority");
    if (subject.length > 200 || message.length > 5000) throw new HttpError(400, "Subject or message is too long");

    const profile = await profileOf(req);
    const ticketId = await publishEvent(EVENTS.TICKET_SUBMITTED, {
      uid: req.user.uid,
      email: profile.email,
      customerName: fullName(profile),
      accountNumber: profile.accountNumber ?? null,
      subject: subject.trim(),
      category,
      priority,
      message: message.trim(),
      attachment: req.file
        ? { name: req.file.originalname.slice(0, 200), type: req.file.mimetype, data: req.file.buffer.toString("base64") }
        : null,
    });
    res.status(202).json({ message: "Ticket submitted. We'll respond within 24 hours.", id: ticketId });
  })
);

// ---------- connection requests ----------

router.get(
  "/connection-requests",
  asyncHandler(async (req, res) => {
    res.json({ requests: await mine(req.user.uid, "CONNREQ#") });
  })
);

router.post(
  "/connection-requests",
  asyncHandler(async (req, res) => {
    const profile = await profileOf(req);
    const existing = await mine(req.user.uid, "CONNREQ#");
    if (existing.some((r) => r.status === "pending")) {
      throw new HttpError(409, "You already have a connection request waiting for review");
    }

    const useProfile = req.body?.useProfileAddress !== false;
    const address = useProfile ? profile.address : String(req.body?.address ?? "").trim();
    const city = useProfile ? profile.city : String(req.body?.city ?? "").trim();
    const zipCode = useProfile ? profile.zipCode : String(req.body?.zipCode ?? "").trim();
    if (!address || !city) throw new HttpError(400, "Address and city are required");

    const requestId = await publishEvent(EVENTS.CONNECTION_REQUESTED, {
      uid: req.user.uid,
      firstName: profile.firstName ?? null,
      lastName: profile.lastName ?? null,
      email: profile.email,
      phoneNumber: profile.phoneNumber ?? null,
      accountNumber: profile.accountNumber ?? null,
      address,
      city,
      zipCode: zipCode ?? "",
    });
    res.status(202).json({ message: "Request submitted successfully", requestId });
  })
);

export default router;
