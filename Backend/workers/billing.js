import { K, get, getMany, query, update, tx, transact, retryOnConflict, versionCondition, now } from "../data/db.js";
import { EVENTS } from "../mq/config.js";
import { PermanentError } from "../mq/errors.js";
import { publishEvent } from "../mq/publisher.js";
import { computeCharges } from "../services/tariff.js";
import { fullName } from "../services/profiles.js";
import { isValidPeriod, periodOf, periodStart, shiftPeriod, toMillis } from "../lib/util.js";

const BILL_DUE_DAYS = Number(process.env.BILL_DUE_DAYS || 14);

// billing.runs — one message per billing period. Fans out one
// bill.generate_requested per active meter, so bills are generated in
// parallel by billing.generate consumers and a failure only retries one bill.
// Safe to re-run: bills already issued are skipped, new meters get billed.
export async function startBillingRun(event) {
  const { period, requestedBy } = event.data;
  if (!isValidPeriod(period)) throw new PermanentError(`invalid period ${period}`);
  if (period >= periodOf(new Date())) throw new PermanentError(`period ${period} has not ended yet`);

  const periodEnd = periodStart(shiftPeriod(period, 1)).getTime();
  const eligible = await query({
    index: "gsi2",
    pk: "METERS",
    filter: (m) => m.status === "active" && toMillis(m.installedAt) < periodEnd,
  });

  await update(K.billingRun(period), {
    set: { entity: "billingRun", period, metersQueued: eligible.length, lastRequestedBy: requestedBy ?? null, lastRequestedAt: now() },
  });

  for (let i = 0; i < eligible.length; i += 100) {
    await Promise.all(
      eligible.slice(i, i + 100).map((m) =>
        publishEvent(
          EVENTS.BILL_GENERATE_REQUESTED,
          { period, meterNumber: m.meterNumber, uid: m.uid },
          { id: `bill:${period}:${m.meterNumber}` }
        )
      )
    );
  }
  console.log(`[billing] run ${period}: queued ${eligible.length} bill(s)`);
}

// billing.generate — one bill per meter per period, id <period>_<meter>.
// The bill and the customer's balance change are written together, on
// condition that the customer hasn't changed since read (a payment may be
// settling at the same moment); otherwise it retries.
export async function generateBill(event) {
  const { period, meterNumber, uid } = event.data;
  const billId = `${period}_${meterNumber}`;

  const bill = await retryOnConflict(async () => {
    const existing = await get(K.bill(billId));
    if (existing) return existing;

    const [usage, user] = await getMany([K.usage(meterNumber, period), K.user(uid)]);
    if (!user) throw new PermanentError(`meter ${meterNumber} belongs to missing user ${uid}`);

    const litres = usage?.consumptionLitres ?? 0;
    const charges = computeCharges(litres);

    // Existing credit (negative balance) is applied to the new bill.
    const credit = Math.max(0, -(user.balance ?? 0));
    const applied = Math.min(credit, charges.total);
    const dueDate = new Date(periodStart(shiftPeriod(period, 1)).getTime() + BILL_DUE_DAYS * 86_400_000);
    const status = applied >= charges.total ? "paid" : applied > 0 ? "partially_paid" : "unpaid";

    const data = {
      ...K.bill(billId),
      entity: "bill",
      gsi1pk: `USER#${uid}`,
      gsi1sk: `BILL#${period}#${meterNumber}`,
      gsi2pk: `BILLS#${period}`,
      gsi2sk: meterNumber,
      id: billId,
      uid,
      meterNumber,
      accountNumber: user.accountNumber ?? null,
      customerName: fullName(user),
      period,
      consumptionLitres: litres,
      tariff: charges.tariff,
      lines: charges.lines,
      amountDue: charges.total,
      amountPaid: applied,
      status,
      issuedAt: now(),
      dueDate: dueDate.toISOString(),
    };
    await transact([
      tx.put(data),
      tx.update(K.user(uid), {
        add: { balance: charges.total, version: 1 },
        ...(status !== "paid" ? { append: { openBills: [billId] } } : {}),
        ...versionCondition(user),
      }),
    ]);
    return data;
  });

  await publishEvent(
    EVENTS.BILL_ISSUED,
    {
      billId,
      uid,
      period,
      meterNumber,
      consumptionLitres: bill.consumptionLitres,
      amountDue: bill.amountDue,
      amountOutstanding: bill.amountDue - bill.amountPaid,
      dueDate: bill.dueDate,
    },
    { id: `${billId}:issued` }
  );
}
