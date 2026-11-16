import express from "express";
import { K, get, getMany, update, query, tx, transact, cancellationCodes, clean, now } from "../data/db.js";
import { EVENTS } from "../mq/config.js";
import { publishEvent, queueStats } from "../mq/publisher.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { publicProfile, fullName, ROLES } from "../services/profiles.js";
import { TARIFF } from "../services/tariff.js";
import { sendAttachment } from "../lib/filetype.js";
import {
  asyncHandler,
  HttpError,
  toMillis,
  isValidPeriod,
  periodOf,
  periodStart,
  periodLabel,
  recentPeriods,
  shiftPeriod,
  generateMeterNumber,
} from "../lib/util.js";

const router = express.Router();
router.use(requireAuth, requireAdmin);

const LIST_LIMIT = 500;

// System-wide lists come from the gsi2 index (see data/schema.js).
const all = async (pk, opts = {}) => (await query({ index: "gsi2", pk, ...opts })).map(clean);
const billsFor = (period) => all(`BILLS#${period}`);
const isConditionFailure = (err) => err?.name === "ConditionalCheckFailedException";

const withBillState = (b, nowMs = Date.now()) => ({
  ...b,
  label: periodLabel(b.period),
  outstanding: b.amountDue - b.amountPaid,
  overdue: b.status !== "paid" && toMillis(b.dueDate) < nowMs,
});

// Admin actions below are synchronous (they validate against current state and
// the admin wants the answer now); the resulting domain event is published
// afterwards for notifications. A broker hiccup must not undo the action.
function publishAfterCommit(type, data, id) {
  publishEvent(type, data, { id }).catch((err) => console.error(`${type} not published: ${err.message}`));
}

// ---------- dashboard ----------

router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const current = periodOf();
    const lastPeriod = shiftPeriod(current, -1);
    const chartPeriods = recentPeriods(6);
    const billPeriods = recentPeriods(13).slice(0, -1); // the last 12 ended months

    const [users, meters, tickets, requests, monthPayments, totals, lastBills, recentBills] = await Promise.all([
      all("USERS"),
      all("METERS"),
      all("TICKETS"),
      all("CONNREQS"),
      all("PAYMENTS", { from: periodStart(current).toISOString() }),
      getMany(chartPeriods.map((p) => K.usageTotal(p))),
      billsFor(lastPeriod),
      Promise.all(billPeriods.map(billsFor)).then((lists) => lists.flat()),
    ]);

    const completed = monthPayments.filter((p) => p.status === "completed");
    const settled = monthPayments.filter((p) => p.status === "completed" || p.status === "failed");
    const nowMs = Date.now();
    const open = recentBills.filter((b) => b.status !== "paid");
    const overdue = open.filter((b) => toMillis(b.dueDate) < nowMs);

    res.json({
      period: current,
      customers: users.filter((u) => u.userRole === ROLES.CUSTOMER).length,
      activeMeters: meters.filter((m) => m.status === "active").length,
      openTickets: tickets.filter((t) => t.status === "open" || t.status === "in_progress").length,
      pendingConnections: requests.filter((r) => r.status === "pending").length,
      revenueThisMonth: completed.reduce((s, p) => s + (p.amountPaid ?? 0), 0),
      paymentsThisMonth: completed.length,
      paymentSuccessRate: settled.length ? completed.length / settled.length : null,
      usage: totals.map((t, i) => ({
        period: chartPeriods[i],
        label: periodLabel(chartPeriods[i]),
        consumptionLitres: t?.consumptionLitres ?? 0,
      })),
      lastPeriodBills: {
        period: lastPeriod,
        label: periodLabel(lastPeriod),
        count: lastBills.length,
        billed: lastBills.reduce((s, b) => s + b.amountDue, 0),
        collected: lastBills.reduce((s, b) => s + b.amountPaid, 0),
      },
      openBills: open.length,
      overdueBills: overdue.length,
      overdueAmount: overdue.reduce((s, b) => s + b.amountDue - b.amountPaid, 0),
    });
  })
);

router.get(
  "/queues",
  asyncHandler(async (req, res) => {
    res.json({ queues: await queueStats() });
  })
);

// ---------- people ----------

const byName = (a, b) => fullName(a).localeCompare(fullName(b));

router.get(
  "/customers",
  asyncHandler(async (req, res) => {
    const users = await all("USERS");
    res.json({ customers: users.filter((u) => u.userRole === ROLES.CUSTOMER).map(publicProfile).sort(byName) });
  })
);

router.get(
  "/users",
  asyncHandler(async (req, res) => {
    res.json({ users: (await all("USERS")).map(publicProfile).sort(byName) });
  })
);

router.patch(
  "/users/:uid/role",
  asyncHandler(async (req, res) => {
    const role = req.body?.role;
    if (![ROLES.ADMIN, ROLES.CUSTOMER].includes(role)) throw new HttpError(400, "role must be admin or user");
    if (req.params.uid === req.user.uid) throw new HttpError(400, "You can't change your own role");
    try {
      await update(K.user(req.params.uid), {
        set: { userRole: role, roleChangedBy: req.user.uid, roleChangedAt: now() },
        condition: "attribute_exists(pk)",
      });
    } catch (err) {
      if (isConditionFailure(err)) throw new HttpError(404, "User not found");
      throw err;
    }
    res.json({ message: `Role updated to ${role}` });
  })
);

router.get(
  "/meters",
  asyncHandler(async (req, res) => {
    const meters = req.query.uid
      ? (await query({ index: "gsi1", pk: `USER#${req.query.uid}`, prefix: "METER#" })).map(clean)
      : await all("METERS", { limit: LIST_LIMIT });
    res.json({ meters });
  })
);

// ---------- billing ----------

router.get(
  "/tariff",
  asyncHandler(async (req, res) => {
    res.json({ tariff: TARIFF });
  })
);

router.get(
  "/bills",
  asyncHandler(async (req, res) => {
    const period = req.query.period;
    if (period && !isValidPeriod(period)) throw new HttpError(400, "period must be YYYY-MM");
    // Without a period: the latest three billing months.
    const periods = period ? [period] : recentPeriods(4).slice(0, -1).reverse();
    const nowMs = Date.now();
    let bills = (await Promise.all(periods.map(billsFor)))
      .flat()
      .sort((a, b) => toMillis(b.issuedAt) - toMillis(a.issuedAt))
      .slice(0, LIST_LIMIT)
      .map((b) => withBillState(b, nowMs));
    if (req.query.status === "overdue") bills = bills.filter((b) => b.overdue);
    else if (req.query.status) bills = bills.filter((b) => b.status === req.query.status);
    res.json({ bills });
  })
);

router.get(
  "/billing-runs",
  asyncHandler(async (req, res) => {
    const runs = (await query({ pk: "BILLINGRUN", desc: true, limit: 24 })).map(clean);
    res.json({
      runs: await Promise.all(
        runs.map(async (run) => {
          const bills = await billsFor(run.period);
          return {
            ...run,
            id: run.period,
            label: periodLabel(run.period),
            billsGenerated: bills.length,
            totalBilled: bills.reduce((s, b) => s + b.amountDue, 0),
            totalCollected: bills.reduce((s, b) => s + b.amountPaid, 0),
            status: bills.length >= (run.metersQueued ?? 0) ? "completed" : "in_progress",
          };
        })
      ),
    });
  })
);

router.post(
  "/billing/run",
  asyncHandler(async (req, res) => {
    const period = req.body?.period;
    if (!isValidPeriod(period)) throw new HttpError(400, "period must be YYYY-MM");
    if (period >= periodOf()) throw new HttpError(400, "You can only bill a month that has ended");
    await publishEvent(EVENTS.BILLING_RUN_REQUESTED, { period, requestedBy: req.user.uid });
    res.status(202).json({ message: `Billing run for ${periodLabel(period)} queued` });
  })
);

// ---------- payments ----------

router.get(
  "/payments",
  asyncHandler(async (req, res) => {
    let payments = await all("PAYMENTS", { desc: true, limit: LIST_LIMIT });
    if (req.query.status === "pending") payments = payments.filter((p) => !["completed", "failed"].includes(p.status));
    else if (req.query.status) payments = payments.filter((p) => p.status === req.query.status);
    res.json({ payments });
  })
);

router.get(
  "/unmatched-payments",
  asyncHandler(async (req, res) => {
    const callbacks = await query({ pk: "UNMATCHED", filter: (c) => !c.resolved });
    res.json({ callbacks: callbacks.map(clean) });
  })
);

// ---------- tickets ----------

const TICKET_STATUSES = ["open", "in_progress", "resolved"];

router.get(
  "/tickets",
  asyncHandler(async (req, res) => {
    let tickets = await all("TICKETS", { desc: true, limit: LIST_LIMIT });
    if (req.query.status) tickets = tickets.filter((t) => t.status === req.query.status);
    res.json({ tickets });
  })
);

// Verified images (PNG/JPEG/GIF/WebP, checked from the bytes) can be
// previewed; anything else is only ever a download (see lib/filetype.js).
router.get(
  "/tickets/:id/attachment",
  asyncHandler(async (req, res) => {
    const att = await get(K.ticketAttachment(req.params.id));
    if (!att) throw new HttpError(404, "No attachment");
    sendAttachment(res, att);
  })
);

router.patch(
  "/tickets/:id",
  asyncHandler(async (req, res) => {
    const { status, response } = req.body ?? {};
    if (!TICKET_STATUSES.includes(status)) throw new HttpError(400, `status must be one of ${TICKET_STATUSES.join(", ")}`);
    if (response !== undefined && String(response).length > 5000) throw new HttpError(400, "Response is too long");

    const ticket = await get(K.ticket(req.params.id));
    if (!ticket) throw new HttpError(404, "Ticket not found");
    const changes = {
      status,
      ...(response !== undefined ? { response: String(response).trim() || null } : {}),
      handledBy: req.user.uid,
      updatedAt: now(),
    };
    await update(K.ticket(req.params.id), { set: changes });

    const t = { ...ticket, ...changes };
    if (t.uid) {
      publishAfterCommit(
        EVENTS.TICKET_UPDATED,
        { ticketId: req.params.id, uid: t.uid, subject: t.subject, status, response: t.response ?? null },
        `ticket-updated:${req.params.id}:${Date.now()}`
      );
    }
    res.json({ message: "Ticket updated" });
  })
);

// ---------- connection requests ----------

router.get(
  "/connection-requests",
  asyncHandler(async (req, res) => {
    let requests = await all("CONNREQS", { desc: true, limit: LIST_LIMIT });
    if (req.query.status) requests = requests.filter((r) => r.status === req.query.status);
    res.json({ requests });
  })
);

// Approving installs a meter in one transaction: the request is marked
// approved (only if still pending), the meter is created (only if that number
// is free) and linked to the customer.
router.patch(
  "/connection-requests/:id",
  asyncHandler(async (req, res) => {
    const { decision, note } = req.body ?? {};
    if (!["approve", "reject"].includes(decision)) throw new HttpError(400, "decision must be approve or reject");
    const meterNumber = req.body?.meterNumber ? String(req.body.meterNumber).trim().toUpperCase() : generateMeterNumber();
    if (!/^[A-Z0-9-]{3,32}$/.test(meterNumber)) throw new HttpError(400, "Meter number must be 3–32 letters, digits or dashes");
    const initialReading = Number(req.body?.initialReading ?? 0);
    if (!Number.isFinite(initialReading) || initialReading < 0) throw new HttpError(400, "Initial reading must be a non-negative number");

    const id = req.params.id;
    const request = await get(K.connectionRequest(id));
    if (!request) throw new HttpError(404, "Request not found");
    if (request.status !== "pending") throw new HttpError(409, `Request is already ${request.status}`);
    if (!request.uid) throw new HttpError(409, "This request predates account linking; ask the customer to submit it again");

    const review = { reviewedBy: req.user.uid, reviewedAt: now(), reviewNote: note?.trim() || null };
    const stillPending = { condition: "#st = :pending", names: { "#st": "status" }, values: { ":pending": "pending" } };

    try {
      if (decision === "reject") {
        await transact([tx.update(K.connectionRequest(id), { set: { status: "rejected", ...review }, ...stillPending })]);
      } else {
        await transact([
          tx.update(K.connectionRequest(id), { set: { status: "approved", meterNumber, ...review }, ...stillPending }),
          tx.put({
            ...K.meter(meterNumber),
            entity: "meter",
            gsi1pk: `USER#${request.uid}`,
            gsi1sk: `METER#${meterNumber}`,
            gsi2pk: "METERS",
            gsi2sk: meterNumber,
            id: meterNumber,
            meterNumber,
            uid: request.uid,
            address: request.address ?? null,
            city: request.city ?? null,
            status: "active",
            initialReading,
            lastReading: initialReading,
            installedAt: now(),
            connectionRequestId: id,
          }),
          tx.update(K.user(request.uid), { append: { meterNumbers: [meterNumber] } }),
        ]);
      }
    } catch (err) {
      const [requestCheck, meterCheck] = cancellationCodes(err);
      if (requestCheck === "ConditionalCheckFailed") throw new HttpError(409, "Request was already reviewed");
      if (meterCheck === "ConditionalCheckFailed") throw new HttpError(409, `Meter ${meterNumber} is already in use`);
      throw err;
    }

    publishAfterCommit(
      decision === "approve" ? EVENTS.CONNECTION_APPROVED : EVENTS.CONNECTION_REJECTED,
      { requestId: id, uid: request.uid, address: request.address, meterNumber: decision === "approve" ? meterNumber : null, note: note?.trim() || null },
      `connection-${decision}:${id}`
    );
    res.json({ message: decision === "approve" ? `Approved, meter ${meterNumber} installed` : "Request rejected", meterNumber: decision === "approve" ? meterNumber : null });
  })
);

export default router;
