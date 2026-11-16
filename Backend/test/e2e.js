// End-to-end test of the whole backend: API → RabbitMQ → workers → DynamoDB.
//
// Runs ONLY against DynamoDB Local and the Firebase Auth emulator (it wipes
// both first). Setup is in Backend/README.md under "Testing".
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import "../env.js";

if (!process.env.DYNAMODB_ENDPOINT || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Refusing to run: DYNAMODB_ENDPOINT (DynamoDB Local) and FIREBASE_AUTH_EMULATOR_HOST must be set.");
  process.exit(1);
}

const API = process.env.E2E_API_URL || `http://localhost:${process.env.PORT || 5000}`;
const PROJECT = process.env.FIREBASE_PROJECT_ID;
const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1`;
const BACKEND = fileURLToPath(new URL("..", import.meta.url));
const METER_KEY = process.env.METER_INGEST_API_KEY;
const CALLBACK_TOKEN = process.env.MPESA_CALLBACK_TOKEN;
const { auth: adminAuth } = await import("../firebase.js");
const { K, get, update, query } = await import("../data/db.js");
const { periodOf, periodStart, shiftPeriod } = await import("../lib/util.js");

// Start from an empty local table and no emulator accounts.
execSync("npm run -s db:create -- --reset", { cwd: BACKEND, env: process.env, stdio: "pipe" });
await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });

// Dates relative to today: last month gets 4.5 m³, this month 5.5 m³.
const CUR = periodOf();
const PREV = shiftPeriod(CUR, -1);
const HOUR = 3_600_000;
if (Date.now() - periodStart(CUR).getTime() < 8 * HOUR) {
  console.error("Run this test more than 8 hours after the start of the month (it needs readings in the current month).");
  process.exit(1);
}
const ago = (h) => new Date(Date.now() - h * HOUR).toISOString();
const T = { prev1: `${PREV}-01T08:00:00+03:00`, prev15: `${PREV}-15T08:00:00+03:00`, prev28: `${PREV}-28T08:00:00+03:00`, cur: ago(4), leak: ago(1) };

let failures = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
  if (!cond) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, timeoutMs = 20000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await sleep(500);
  }
  return null;
}
async function call(method, path, { token, body, headers = {}, form } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}
async function signIn(email, password) {
  const res = await fetch(`${AUTH}/accounts:signInWithPassword?key=fake`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  return (await res.json()).idToken;
}

const suffix = Date.now();
const cust = { firstName: "Amina", lastName: "Wanjiru", email: `amina${suffix}@test.local`, phoneNumber: "0712 345 678", idNumber: "12345678", address: "12 Moi Ave", city: "Nairobi", state: "Nairobi", zipCode: "00100", password: "correct-horse-1" };
const adm = { ...cust, firstName: "Otieno", lastName: "Admin", email: `admin${suffix}@test.local`, phoneNumber: "0722000111" };

// ---------- accounts & access ----------
let r = await call("POST", "/api/signup", { body: cust });
const created = r.status === 201;
r = await call("POST", "/api/signup", { body: cust });
check("signup works; duplicate email rejected", created && r.status === 409);
await call("POST", "/api/signup", { body: adm });
execSync(`npm run -s set-role -- ${adm.email} admin`, { cwd: BACKEND, env: process.env, stdio: "pipe" });
const ct = await signIn(cust.email, cust.password);
const at = await signIn(adm.email, adm.password);
const customerUid = (await adminAuth.getUserByEmail(cust.email)).uid;

const noToken = (await call("GET", "/api/me")).status;
const customerAsAdmin = (await call("GET", "/api/admin/stats", { token: ct })).status;
r = await call("GET", "/api/me", { token: ct });
check("auth: no token 401, customer on admin API 403, own profile without ID number",
  noToken === 401 && customerAsAdmin === 403 && r.data.user.email === cust.email && r.data.user.idNumber === undefined);

await call("PUT", "/api/me", { token: ct, body: { city: "Mombasa" } });
check("profile update applied by the worker", Boolean(await until(async () => (await call("GET", "/api/me", { token: ct })).data.user.city === "Mombasa")));

// ---------- connection → meter ----------
await call("POST", "/api/me/connection-requests", { token: ct, body: { useProfileAddress: true } });
const reqDoc = await until(async () => (await call("GET", "/api/me/connection-requests", { token: ct })).data.requests?.[0]);
const meterNumber = `MTR-T${String(suffix).slice(-6)}`;
await call("PATCH", `/api/admin/connection-requests/${reqDoc.id}`, { token: at, body: { decision: "approve", meterNumber, initialReading: 100 } });
r = await call("GET", "/api/me", { token: ct });
check("connection request approved → meter linked to customer", r.data.user.meterNumbers.includes(meterNumber));

// ---------- meter readings ----------
r = await call("POST", "/api/readings", { headers: { "X-Api-Key": "wrong" }, body: { meterNumber, reading: 101 } });
check("meter API rejects a wrong key", r.status === 401);

// Install backdated so last month can be billed. 100 → 104.5 m³ last month,
// → 110 this month; sent newest first, one by one, then resent as a batch.
await update(K.meter(meterNumber), { set: { installedAt: new Date(periodStart(PREV).getTime() - 24 * HOUR).toISOString() } });
const series = [[T.prev1, 100.0], [T.prev15, 102.0], [T.prev28, 104.5], [T.cur, 110.0]].map(([readAt, reading]) => ({ meterNumber, reading, readAt }));
for (const one of [...series].reverse()) {
  await call("POST", "/api/readings", { headers: { "X-Api-Key": METER_KEY }, body: one });
  await sleep(700);
}
await call("POST", "/api/readings", { headers: { "X-Api-Key": METER_KEY }, body: { readings: series } });
await call("POST", "/api/readings", { headers: { "X-Api-Key": METER_KEY }, body: { meterNumber: "MTR-NOPE", reading: 5 } }); // → DLQ
await sleep(3000);
r = await call("GET", "/api/me/usage?months=3", { token: ct });
const usageOf = (period) => r.data.months?.find((m) => m.period === period)?.consumptionLitres;
check("usage split correctly by month despite out-of-order delivery and resends", usageOf(PREV) === 4500 && usageOf(CUR) === 5500, JSON.stringify(r.data.months));

// ---------- billing ----------
await call("POST", "/api/admin/billing/run", { token: at, body: { period: PREV } });
const bill = await until(async () => (await call("GET", "/api/me/bills", { token: ct })).data.bills?.[0]);
await call("POST", "/api/admin/billing/run", { token: at, body: { period: PREV } });
await sleep(3000);
const bills = (await call("GET", "/api/me/bills", { token: ct })).data.bills;
const balance = async () => (await call("GET", "/api/me", { token: ct })).data.user.balance;
check("bill from usage (4.5 m³ → Ksh 370); re-run doesn't duplicate or double charge",
  bill?.amountDue === 370 && bills.length === 1 && (await balance()) === 370, JSON.stringify(bill?.lines));

// ---------- M-Pesa ----------
const pay = async (amount, phoneNumber) => {
  const res = await call("POST", "/api/me/payments", { token: ct, body: { amount, phoneNumber } });
  return until(async () => {
    const x = (await call("GET", `/api/me/payments/${res.data.paymentId}`, { token: ct })).data.payment;
    return ["completed", "failed"].includes(x?.status) && x;
  });
};
const m1 = await pay(200, "0712345678");
check("M-Pesa payment completes (simulator)", m1?.status === "completed" && /^SIM/.test(m1.mpesaReceipt ?? ""));
const m2 = await pay(300, "0712340000");
check("M-Pesa payment cancelled on the phone → failed", m2?.status === "failed");
const m3 = await pay(300, "0712345678");
r = await call("GET", "/api/me/bills", { token: ct });
check("payments fill the oldest bill first; the rest becomes credit",
  m3?.allocations?.[0]?.amount === 170 && m3.creditAdded === 130 && r.data.bills[0].status === "paid" && (await balance()) === -130);

r = await call("POST", "/api/mpesa/callback/wrong-token", { body: { Body: { stkCallback: { CheckoutRequestID: "x" } } } });
const wrongToken = r.status;
await call("POST", `/api/mpesa/callback/${CALLBACK_TOKEN}`, { body: { Body: { stkCallback: { MerchantRequestID: "m", CheckoutRequestID: `ws_CO_unknown_${suffix}`, ResultCode: 0, ResultDesc: "ok" } } } });

// ---------- tickets ----------
const form = new FormData();
form.set("subject", "Low pressure"); form.set("category", "technical"); form.set("priority", "high"); form.set("message", "Water pressure is low.");
form.set("attachment", new Blob(["<script>alert(1)</script>"], { type: "text/html" }), "evil.html");
await call("POST", "/api/me/tickets", { token: ct, form });
const ticket = await until(async () => (await call("GET", "/api/me/tickets", { token: ct })).data.tickets?.[0]);
const download = await call("GET", `/api/admin/tickets/${ticket.id}/attachment`, { token: at });
await call("PATCH", `/api/admin/tickets/${ticket.id}`, { token: at, body: { status: "resolved", response: "Valve adjusted." } });
r = await call("GET", "/api/me/tickets", { token: ct });
check("ticket answered by admin; uploaded HTML only ever served as a sandboxed download",
  r.data.tickets[0].response === "Valve adjusted." && download.headers.get("content-type") === "application/octet-stream" &&
  /sandbox/.test(download.headers.get("content-security-policy") ?? ""));

// A 1x1 PNG uploaded with no extension and a generic type: detected from its bytes.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const photoForm = new FormData();
photoForm.set("subject", "Broken pipe photo"); photoForm.set("category", "technical"); photoForm.set("priority", "medium"); photoForm.set("message", "See photo.");
photoForm.set("attachment", new Blob([png], { type: "application/octet-stream" }), "photo");
await call("POST", "/api/me/tickets", { token: ct, form: photoForm });
const photoTicket = await until(async () => (await call("GET", "/api/me/tickets", { token: ct })).data.tickets?.find((t) => t.subject === "Broken pipe photo"));
const ownCopy = await call("GET", `/api/me/tickets/${photoTicket?.id}/attachment`, { token: ct });
const someoneElse = await call("GET", `/api/me/tickets/${photoTicket?.id}/attachment`, { token: at });
check("image detected from its bytes: previewable by its owner, 404 for anyone else",
  photoTicket?.attachmentIsImage === true && photoTicket.attachmentName === "photo.png" &&
  ownCopy.headers.get("content-type") === "image/png" && someoneElse.status === 404);

// ---------- leak alert, legacy users, queues ----------
await call("POST", "/api/readings", { headers: { "X-Api-Key": METER_KEY }, body: { meterNumber, reading: 130, readAt: T.leak } });

r = await call("GET", "/api/admin/queues", { token: at });
check("admin queue stats show the dead-lettered reading", r.data.queues?.find((q) => q.key === "readings")?.deadLettered >= 1);

const parked = await until(async () => Boolean(await get(K.unmatched(`ws_CO_unknown_${suffix}`))), 90000);
check("M-Pesa callback: wrong token 404, unknown checkout parked for review", wrongToken === 404 && Boolean(parked));

const notes = () => query({ index: "gsi1", pk: `USER#${customerUid}`, prefix: "NOTIFICATION#" });
const kinds = (await notes()).map((n) => `${n.channel}:${n.sourceEvent}`);
const count = (k) => kinds.filter((x) => x === k).length;
check("notifications sent once each (bill SMS once despite re-run, leak alert sent)",
  count("sms:payment.completed") === 2 && count("sms:bill.issued") === 1 && count("sms:meter.anomaly_detected") === 1, kinds.sort().join(", "));

// ---------- card payments (Stripe, against test/fake-stripe.js) ----------
if (process.env.E2E_FAKE_STRIPE_PORT) {
  const { startFakeStripe } = await import("./fake-stripe.js");
  const { default: Stripe } = await import("stripe");
  const { publishEvent, broker: testPublisher } = await import("../mq/publisher.js");
  const fake = await startFakeStripe(Number(process.env.E2E_FAKE_STRIPE_PORT));
  const signer = new Stripe("sk_test_signing_only");
  const webhook = async (type, pi, { eventId = `evt_${Math.random().toString(16).slice(2)}`, secret = process.env.STRIPE_WEBHOOK_SECRET } = {}) => {
    const payload = JSON.stringify({ id: eventId, object: "event", type, livemode: false, data: { object: pi } });
    const header = signer.webhooks.generateTestHeaderString({ payload, secret });
    return (await fetch(`${API}/api/stripe/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "Stripe-Signature": header }, body: payload })).status;
  };
  const paymentOf = async (id) => (await call("GET", `/api/me/payments/${id}`, { token: ct })).data.payment;
  const cardPayment = async (amount) => (await call("POST", "/api/me/payments", { token: ct, body: { method: "card", amount } })).data;
  const settled = (id, status, ms) => until(async () => { const x = await paymentOf(id); return x.status === status && x; }, ms);

  const before = await balance();
  const c1 = await cardPayment(250);
  const pi1 = fake.intents.get((await paymentOf(c1.paymentId)).stripePaymentIntentId);
  check("card: PaymentIntent in KES cents, card only, client secret returned",
    pi1?.amount === 25000 && pi1.currency === "kes" && pi1.payment_method_types.join() === "card" && /_secret_/.test(c1.clientSecret ?? ""));
  check("card: webhook with a bad signature rejected", (await webhook("payment_intent.succeeded", pi1, { secret: "whsec_wrong" })) === 400);

  await webhook("payment_intent.payment_failed", fake.decline(pi1.id));
  const declined = await until(async () => { const x = await paymentOf(c1.paymentId); return x.lastCardError && x; });
  const paid = fake.succeed(pi1.id, { brand: "visa", last4: "4242" });
  await webhook("payment_intent.succeeded", paid, { eventId: `evt_dup_${suffix}` });
  await webhook("payment_intent.succeeded", paid, { eventId: `evt_dup_${suffix}` }); // Stripe retry
  await webhook("payment_intent.succeeded", paid); // second event, same intent
  const done = await settled(c1.paymentId, "completed");
  await sleep(2500);
  check("card: decline keeps it open; success credits once despite duplicate webhooks",
    declined?.status === "pending" && done?.cardLast4 === "4242" && (await balance()) === before - 250);

  const c2 = await cardPayment(100);
  await call("POST", `/api/me/payments/${c2.paymentId}/cancel`, { token: ct });
  const cancelled = await settled(c2.paymentId, "failed");
  check("card: customer cancel cancels at Stripe and fails the payment", fake.intents.get(cancelled?.stripePaymentIntentId)?.status === "canceled");

  const c3 = await cardPayment(80);
  fake.succeed((await paymentOf(c3.paymentId)).stripePaymentIntentId, { brand: "visa", last4: "1881" });
  await call("POST", `/api/me/payments/${c3.paymentId}/confirm`, { token: ct });
  check("card: server-side confirm settles without a webhook", (await settled(c3.paymentId, "completed", 5000))?.settledBy === "client_return");

  const c4 = await cardPayment(90);
  await publishEvent("stripe.event_received", { type: "payment_intent.canceled", paymentId: c4.paymentId, paymentIntentId: (await paymentOf(c4.paymentId)).stripePaymentIntentId, source: "forged" });
  await sleep(3000);
  check("card: forged cancel message on the queue rejected", (await paymentOf(c4.paymentId)).status === "pending");
  await call("POST", `/api/me/payments/${c4.paymentId}/cancel`, { token: ct });
  await testPublisher.close();

  const c5 = await cardPayment(120);
  fake.succeed((await paymentOf(c5.paymentId)).stripePaymentIntentId, { brand: "mastercard", last4: "4444" });
  check("card: lost webhook settled by the status poller", (await settled(c5.paymentId, "completed", 45000))?.settledBy === "status_query");

  await sleep(3000);
  const all = await notes();
  const cardReceipts = all.filter((n) => n.channel === "sms" && n.sourceEvent === "payment.completed" && /card/.test(n.text));
  check("card: one SMS receipt per paid card payment, none for cancelled ones",
    cardReceipts.length === 3 && all.filter((n) => n.sourceEvent === "payment.failed").length === 1, cardReceipts.map((n) => n.text).join(" | "));
  fake.close();
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
