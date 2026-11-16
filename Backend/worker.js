import "./env.js";
import { QUEUES } from "./mq/config.js";
import { createBroker } from "./mq/connection.js";
import { consume } from "./mq/consumer.js";
import { broker as publisher } from "./mq/publisher.js";
import { assertMpesaConfig } from "./services/mpesa.js";
import { assertStripeConfig } from "./services/stripe.js";
import { recordTicket, recordConnectionRequest, applyProfileUpdate } from "./workers/records.js";
import { initiatePayment, reconcileCallback, checkPaymentStatus, handleStripeEvent } from "./workers/payments.js";
import { processReading } from "./workers/readings.js";
import { startBillingRun, generateBill } from "./workers/billing.js";
import { dispatchNotification, deliverSms, deliverEmail } from "./workers/notifications.js";
import { startBillingScheduler } from "./workers/scheduler.js";

const HANDLERS = {
  profiles: applyProfileUpdate,
  tickets: recordTicket,
  connections: recordConnectionRequest,
  paymentsInitiate: initiatePayment,
  paymentsReconcile: reconcileCallback,
  paymentsStatusCheck: checkPaymentStatus,
  paymentsStripe: handleStripeEvent,
  readings: processReading,
  billingRuns: startBillingRun,
  billingGenerate: generateBill,
  notifications: dispatchNotification,
  sms: deliverSms,
  email: deliverEmail,
};

// WORKER_QUEUES=paymentsInitiate,paymentsReconcile runs a subset, so each
// consumer can be scaled on its own. Default: everything in one process.
const selected = process.env.WORKER_QUEUES
  ? process.env.WORKER_QUEUES.split(",").map((s) => s.trim()).filter(Boolean)
  : Object.keys(HANDLERS);

const unknown = selected.filter((key) => !HANDLERS[key]);
if (unknown.length) {
  console.error(`Unknown WORKER_QUEUES entries: ${unknown.join(", ")}. Valid: ${Object.keys(HANDLERS).join(", ")}`);
  process.exit(1);
}

if (selected.includes("paymentsInitiate") || selected.includes("paymentsStatusCheck")) {
  assertMpesaConfig();
}
assertStripeConfig();

// One channel per consumer: Amazon MQ allows at most 10 consumers per
// channel, and a channel error then only affects its own queue. If any
// consumer channel closes, the whole connection is rebuilt so it comes back.
let stopping = false;
const broker = createBroker({
  name: `maji-worker[${selected.join(",")}]`,
  onReady: async (_channel, connection) => {
    for (const key of selected) {
      const { name, prefetch } = QUEUES[key];
      const ch = await connection.createConfirmChannel();
      ch.on("error", (err) => console.error(`[worker:${name}] channel error: ${err.message}`));
      ch.on("close", () => {
        if (!stopping) connection.close().catch(() => {});
      });
      await consume(ch, name, HANDLERS[key], { prefetch });
    }
  },
});

await Promise.all([broker.start(), publisher.start()]);

if (selected.includes("billingRuns")) startBillingScheduler();

const shutdown = async (signal) => {
  stopping = true;
  console.log(`[worker] ${signal} received, closing broker connections`);
  await Promise.all([broker.close(), publisher.close()]);
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
