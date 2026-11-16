// Checks that M-Pesa callbacks are only hints: the payments worker confirms
// every outcome with Daraja's STK query before settling, and credits the
// amount we requested, not the callback's. Runs the worker's handler directly
// against DynamoDB Local and a fake Daraja (test/fake-daraja.js).
//
// Needs the same emulators/RabbitMQ setup as test/e2e.js (see README).
//   npm run test:mpesa
import { randomUUID } from "node:crypto";

if (!process.env.DYNAMODB_ENDPOINT) {
  console.error("Refusing to run: DYNAMODB_ENDPOINT must point at DynamoDB Local.");
  process.exit(1);
}

// Must be set before the M-Pesa service module is loaded.
const PORT = Number(process.env.E2E_FAKE_DARAJA_PORT || 12112);
Object.assign(process.env, {
  MPESA_MODE: "sandbox",
  MPESA_API_BASE_URL: `http://localhost:${PORT}`,
  MPESA_CONSUMER_KEY: "test",
  MPESA_CONSUMER_SECRET: "test",
  MPESA_SHORTCODE: "174379",
  MPESA_PASSKEY: "test",
});

const { startFakeDaraja } = await import("./fake-daraja.js");
const { K, get, put, now } = await import("../data/db.js");
const { newUserItem } = await import("../services/profiles.js");
const { reconcileCallback } = await import("../workers/payments.js");
const { MAX_ATTEMPTS } = await import("../mq/config.js");
const { broker } = await import("../mq/publisher.js");

const daraja = await startFakeDaraja(PORT);
let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
  if (!ok) failures++;
};

const uid = `mpesa-test-${randomUUID()}`;
await put(newUserItem({ uid, email: `${uid}@test.local`, firstName: "Test", userRole: "user", balance: 1000 }));

async function pendingPayment(amount) {
  const id = randomUUID();
  const checkoutRequestId = `ws_CO_${id}`;
  await put({ ...K.payment(id), entity: "payment", id, uid, amount, phone: "254712345678", method: "mpesa", status: "pending", checkoutRequestId, createdAt: now() });
  await put({ ...K.checkout(checkoutRequestId), entity: "checkout", paymentId: id });
  return { id, checkoutRequestId };
}
const callback = (checkoutRequestId, ResultCode, amount) => ({
  id: `cb-${randomUUID()}`,
  data: {
    source: "daraja",
    callback: {
      CheckoutRequestID: checkoutRequestId,
      ResultCode,
      ResultDesc: ResultCode === 0 ? "The service request is processed successfully." : "Request cancelled by user",
      ...(ResultCode === 0
        ? { CallbackMetadata: { Item: [{ Name: "Amount", Value: amount }, { Name: "MpesaReceiptNumber", Value: "RCPT1" }] } }
        : {}),
    },
  },
});
const msg = (attempt) => ({ properties: { headers: { "x-attempts": attempt - 1 } } });
const payment = (id) => get(K.payment(id));

// 1. Forged "paid" callback: Daraja says the customer cancelled.
let p = await pendingPayment(300);
daraja.set(p.checkoutRequestId, { ResultCode: 1032, ResultDesc: "Request cancelled by user" });
await reconcileCallback(callback(p.checkoutRequestId, 0, 300), msg(1));
let after = await payment(p.id);
check("forged success callback → payment failed, nothing credited", after.status === "failed" && after.resultCode === 1032);

// 2. Genuine success, but the callback claims a bigger amount.
p = await pendingPayment(300);
daraja.set(p.checkoutRequestId, { ResultCode: 0, ResultDesc: "ok" });
const balanceBefore = (await get(K.user(uid))).balance;
await reconcileCallback(callback(p.checkoutRequestId, 0, 999999), msg(1));
after = await payment(p.id);
const balanceAfter = (await get(K.user(uid))).balance;
check("genuine success credits the requested amount, not the callback's", after.status === "completed" && after.amountPaid === 300 && after.mpesaReceipt === "RCPT1" && balanceAfter === balanceBefore - 300, `${balanceBefore} → ${balanceAfter}`);

// 3. Forged "failed" callback for a payment Daraja says went through.
p = await pendingPayment(150);
daraja.set(p.checkoutRequestId, { ResultCode: 0, ResultDesc: "ok" });
await reconcileCallback(callback(p.checkoutRequestId, 1032), msg(1));
check("forged failure callback can't fail a real payment", (await payment(p.id)).status === "completed");

// 4. Daraja still processing: retry, and on the last attempt leave it to the poller.
p = await pendingPayment(100);
daraja.set(p.checkoutRequestId, "processing");
let threw = false;
try {
  await reconcileCallback(callback(p.checkoutRequestId, 0, 100), msg(1));
} catch {
  threw = true;
}
await reconcileCallback(callback(p.checkoutRequestId, 0, 100), msg(MAX_ATTEMPTS));
check("still processing → retried, then left pending for the status-check poller", threw && (await payment(p.id)).status === "pending");

daraja.close();
await broker.close();
console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
