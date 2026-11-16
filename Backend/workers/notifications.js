import "../env.js";
import { K, get, put, now } from "../data/db.js";
import { EVENTS } from "../mq/config.js";
import { publishEvent } from "../mq/publisher.js";
import { sendSms, sendEmail } from "../services/notify.js";
import { normalizeKenyanPhone, periodLabel } from "../lib/util.js";

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@example.com";
const PORTAL_URL = process.env.CLIENT_ORIGIN?.split(",")[0] || "http://localhost:5173";

const ksh = (n) => `Ksh ${Number(n || 0).toLocaleString("en-KE")}`;
const m3 = (litres) => `${(Number(litres || 0) / 1000).toLocaleString("en-KE", { maximumFractionDigits: 2 })} m³`;
const date = (iso) => new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Nairobi" });
const paidWith = (d) =>
  d.method === "card"
    ? `card${d.cardBrand ? ` ${d.cardBrand.toUpperCase()}` : ""} ending ${d.cardLast4 ?? "****"}`
    : d.receipt ? `M-Pesa ref ${d.receipt}` : "M-Pesa";
const balanceText = (b) => (b < 0 ? `credit of ${ksh(-b)}` : `balance ${ksh(b)}`);

const sms = (user, text) => {
  const to = normalizeKenyanPhone(user?.phoneNumber);
  return to ? { channel: "sms", to, text } : null;
};
const email = (to, subject, text) => (to ? { channel: "email", to, subject, text } : null);
const hi = (user) => `Hi ${user?.firstName || "there"},`;

// One entry per event type: (event data, customer profile) → messages.
const TEMPLATES = {
  [EVENTS.USER_REGISTERED]: (d, u) => [
    email(u?.email, "Welcome to Maji ya Umma",
      `${hi(u)}\n\nYour account ${u?.accountNumber} is ready. To get water, request a connection from your dashboard: ${PORTAL_URL}/request-connection`),
  ],

  [EVENTS.PAYMENT_COMPLETED]: (d, u) => [
    sms(u, `Maji ya Umma: payment of ${ksh(d.amount)} received (${paidWith(d)}). Account ${u?.accountNumber}, ${balanceText(u?.balance ?? 0)}.`),
    email(u?.email, "Payment received",
      `${hi(u)}\n\nWe received your payment of ${ksh(d.amount)} (${paidWith(d)}).\nYour account now has a ${balanceText(u?.balance ?? 0)}.\n\nReceipt: ${PORTAL_URL}/payments`),
  ],

  // Card failures are shown in the browser while the customer is paying, so
  // only M-Pesa failures (which happen on the phone) get an SMS.
  [EVENTS.PAYMENT_FAILED]: (d, u) =>
    d.method === "card"
      ? []
      : [sms(u, `Maji ya Umma: your payment of ${ksh(d.amount)} was not completed (${d.reason || "cancelled"}). You can try again at ${PORTAL_URL}/bills`)],

  [EVENTS.BILL_ISSUED]: (d, u) => [
    sms(u, `Maji ya Umma: ${periodLabel(d.period)} bill ${ksh(d.amountDue)} for ${m3(d.consumptionLitres)}. ${d.amountOutstanding > 0 ? `Pay ${ksh(d.amountOutstanding)} by ${date(d.dueDate)}.` : "Covered by your credit."}`),
    email(u?.email, `Your ${periodLabel(d.period)} water bill`,
      `${hi(u)}\n\nMeter ${d.meterNumber}: ${m3(d.consumptionLitres)} used in ${periodLabel(d.period)}.\nAmount: ${ksh(d.amountDue)}\nOutstanding: ${ksh(d.amountOutstanding)}\nDue: ${date(d.dueDate)}\n\nView and pay: ${PORTAL_URL}/bills`),
  ],

  [EVENTS.CONNECTION_REQUESTED]: (d, u) => [
    email(u?.email, "We received your connection request",
      `${hi(u)}\n\nYour request for a water connection at ${[d.address, d.city].filter(Boolean).join(", ")} has been received and assigned to our Plumbing & Installation Unit. We'll let you know once it is reviewed.`),
  ],

  [EVENTS.CONNECTION_APPROVED]: (d, u) => [
    sms(u, `Maji ya Umma: your water connection is approved. Meter number ${d.meterNumber}.`),
    email(u?.email, "Your water connection is approved",
      `${hi(u)}\n\nYour connection at ${d.address ?? "your address"} is approved. Your meter number is ${d.meterNumber}.${d.note ? `\n\nNote from our team: ${d.note}` : ""}`),
  ],

  [EVENTS.CONNECTION_REJECTED]: (d, u) => [
    email(u?.email, "Update on your connection request",
      `${hi(u)}\n\nUnfortunately we can't approve your connection request at this time.${d.note ? `\n\nReason: ${d.note}` : ""}\n\nReply to this email or open a ticket if you have questions.`),
  ],

  [EVENTS.TICKET_SUBMITTED]: (d, u) => [
    email(u?.email, `Ticket received: ${d.subject}`,
      `${hi(u)}\n\nWe received your ${d.priority}-priority ticket "${d.subject}" and will respond within 24 hours.`),
    email(SUPPORT_EMAIL, `[${d.priority}] New ${d.category} ticket: ${d.subject}`,
      `From ${d.customerName} <${d.email}> (account ${d.accountNumber ?? "n/a"})\n\n${d.message}`),
  ],

  [EVENTS.TICKET_UPDATED]: (d, u) => [
    email(u?.email, `Ticket update: ${d.subject}`,
      `${hi(u)}\n\nYour ticket "${d.subject}" is now ${d.status.replace("_", " ")}.${d.response ? `\n\nOur response:\n${d.response}` : ""}`),
  ],

  [EVENTS.METER_ANOMALY_DETECTED]: (d, u) =>
    d.kind === "high_usage"
      ? [sms(u, `Maji ya Umma: unusually high water use on meter ${d.meterNumber} (about ${Math.round(d.litresPerDay / 1000 * 10) / 10} m³/day). Please check for leaks.`)]
      : [email(SUPPORT_EMAIL, `Meter ${d.meterNumber}: reading went backwards`,
          `Reading ${d.reading} is lower than the previous ${d.previousReading}. The meter was re-baselined; please check whether it was replaced or tampered with. Reading id: ${d.readingId}`)],
};

// notifications.dispatch — turns a domain event into SMS/email commands.
export async function dispatchNotification(event) {
  const template = TEMPLATES[event.type];
  if (!template) return;

  const uid = event.data.uid;
  const user = uid ? await get(K.user(uid)) : null;

  const messages = template(event.data, user).filter(Boolean);
  await Promise.all(
    messages.map((m, i) =>
      publishEvent(
        m.channel === "sms" ? EVENTS.NOTIFICATION_SMS : EVENTS.NOTIFICATION_EMAIL,
        { ...m, uid: uid ?? null, sourceEvent: event.type },
        { id: `${event.id}:${m.channel}:${i}` }
      )
    )
  );
}

// Each send is recorded under the notification's id; a redelivered message
// whose notification was already sent is skipped instead of sent twice.
async function deliverOnce(event, send) {
  const existing = await get(K.notification(event.id));
  if (existing?.status === "sent") return;

  const result = await send();
  const sentAt = now();
  await put({
    ...K.notification(event.id),
    entity: "notification",
    // Listed per customer (gsi1) when the notification belongs to one.
    ...(event.data.uid ? { gsi1pk: `USER#${event.data.uid}`, gsi1sk: `NOTIFICATION#${sentAt}` } : {}),
    id: event.id,
    channel: event.data.channel,
    to: event.data.to,
    subject: event.data.subject ?? null,
    text: event.data.text,
    uid: event.data.uid,
    sourceEvent: event.data.sourceEvent,
    status: "sent",
    provider: result.provider,
    providerMessageId: result.messageId ?? null,
    sentAt,
  });
}

export const deliverSms = (event) => deliverOnce(event, () => sendSms(event.data.to, event.data.text));
export const deliverEmail = (event) =>
  deliverOnce(event, () => sendEmail({ to: event.data.to, subject: event.data.subject, text: event.data.text }));
