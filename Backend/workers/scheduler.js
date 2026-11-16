import "../env.js";
import { K, get } from "../data/db.js";
import { EVENTS } from "../mq/config.js";
import { publishEvent } from "../mq/publisher.js";
import { periodOf, periodStart, shiftPeriod } from "../lib/util.js";

// Hours into the new month before last month is billed, so readings sent
// around midnight on the 1st still make it onto the bill.
const GRACE_HOURS = Number(process.env.BILLING_GRACE_HOURS || 6);

// Hourly check: once last month has ended (plus the grace period) and has no
// billing run yet, request one. Safe with several worker processes running
// it: the run and every bill are idempotent.
export function startBillingScheduler() {
  if (process.env.BILLING_SCHEDULER === "off") {
    console.log("[scheduler] billing scheduler disabled (BILLING_SCHEDULER=off)");
    return;
  }

  const tick = async () => {
    try {
      const current = periodOf(new Date());
      const previous = shiftPeriod(current, -1);
      if (Date.now() - periodStart(current).getTime() < GRACE_HOURS * 3_600_000) return;
      if (await get(K.billingRun(previous))) return;

      await publishEvent(
        EVENTS.BILLING_RUN_REQUESTED,
        { period: previous, requestedBy: "scheduler" },
        { id: `billing-run:${previous}:scheduler` }
      );
      console.log(`[scheduler] requested billing run for ${previous}`);
    } catch (err) {
      console.error(`[scheduler] ${err.message}; retrying in 1 minute`);
      setTimeout(tick, 60_000).unref();
    }
  };

  tick();
  setInterval(tick, 3_600_000).unref();
  console.log("[scheduler] billing scheduler running (hourly)");
}
