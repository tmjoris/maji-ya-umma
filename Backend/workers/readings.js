import { K, get, query, tx, transact, retryOnConflict, now } from "../data/db.js";
import { EVENTS } from "../mq/config.js";
import { PermanentError } from "../mq/errors.js";
import { publishEvent } from "../mq/publisher.js";
import { periodOf } from "../lib/util.js";

// Above this average daily consumption between two readings, the customer is
// warned about a possible leak (one alert per meter per day at most).
const HIGH_USAGE_LITRES_PER_DAY = Number(process.env.HIGH_USAGE_LITRES_PER_DAY || 2000);

// Readings are cumulative meter values in m³. The water used between two
// consecutive readings (stored in whole litres, so sums are exact) belongs to
// the month of the later reading.
//
// Messages are processed in parallel and retries reorder them, so readings
// can arrive out of order. The result must not depend on arrival order:
//   - a reading newer than the meter's latest extends the series;
//   - an older ("late") one is slotted between its neighbours p < r < n:
//     the interval p→n that was credited to month(n) splits into p→r
//     (credited to month(r)) and r→n (still month(n)).
// Readings live in the meter's partition sorted by time (sk R#<epoch>), so
// neighbours come from one consistent query. Each write is conditional on
// what was read; a concurrent change makes it retry.
export async function processReading(event) {
  const { meterNumber, reading, readAt: readAtIso, source } = event.data;
  const readAt = new Date(readAtIso);

  const stored = await retryOnConflict(() => storeReading({ id: event.id, meterNumber, reading, readAt, source }));

  // Also runs on redelivery (from the stored reading), so a crash between
  // the write and the publish can't lose the alert.
  if (stored.anomaly) {
    const day = stored.readAt.slice(0, 10);
    const id =
      stored.anomaly.kind === "high_usage" ? `${meterNumber}:high_usage:${day}` : `${event.id}:anomaly`;
    await publishEvent(
      EVENTS.METER_ANOMALY_DETECTED,
      { meterNumber, uid: stored.uid, readingId: event.id, ...stored.anomaly },
      { id }
    );
  }
}

async function storeReading({ id, meterNumber, reading, readAt, source }) {
  const epoch = readAt.getTime();
  const existing = await get(K.reading(meterNumber, epoch));
  if (existing) return existing; // device resent it

  const meter = await get(K.meter(meterNumber));
  if (!meter) throw new PermanentError(`unknown meter ${meterNumber}`);
  if (meter.status !== "active") throw new PermanentError(`meter ${meterNumber} is ${meter.status}`);
  if (meter.installedAt && epoch < Date.parse(meter.installedAt)) {
    throw new PermanentError(`reading at ${readAt.toISOString()} predates installation of ${meterNumber}`);
  }

  const base = {
    ...K.reading(meterNumber, epoch),
    entity: "reading",
    id,
    meterNumber,
    uid: meter.uid,
    reading,
    readAt: readAt.toISOString(),
    period: periodOf(readAt),
    source,
    receivedAt: now(),
  };
  const lastAt = meter.lastReadAt ? Date.parse(meter.lastReadAt) : null;
  return lastAt === null || epoch > lastAt ? appendReading(meter, base, lastAt) : insertLateReading(meter, base);
}

// Usage for one meter-month, plus the system-wide monthly total the admin
// dashboard reads (kept in step so it never scans every usage item).
function usageWrites(meter, period, litres, readings) {
  const writes = [
    tx.update(K.usage(meter.meterNumber, period), {
      add: { consumptionLitres: litres, readings },
      set: { updatedAt: now() },
      setIfAbsent: {
        entity: "usage",
        uid: meter.uid,
        meterNumber: meter.meterNumber,
        period,
        gsi1pk: `USER#${meter.uid}`,
        gsi1sk: `USAGE#${period}#${meter.meterNumber}`,
      },
    }),
  ];
  if (litres) {
    writes.push(tx.update(K.usageTotal(period), { add: { consumptionLitres: litres }, setIfAbsent: { entity: "usageTotal", period } }));
  }
  return writes;
}

async function appendReading(meter, base, lastAt) {
  const { reading } = base;
  let status = "ok";
  let litres = 0;
  let anomaly = null;

  if (reading < meter.lastReading) {
    // Meter replaced, reset, or tampered with: re-baseline, flag for staff.
    status = "rollback";
    anomaly = { kind: "meter_rollback", previousReading: meter.lastReading, reading };
  } else {
    litres = Math.round((reading - meter.lastReading) * 1000);
    const days = lastAt ? (Date.parse(base.readAt) - lastAt) / 86_400_000 : 0;
    if (days > 0 && litres / days > HIGH_USAGE_LITRES_PER_DAY) {
      anomaly = { kind: "high_usage", litresPerDay: Math.round(litres / days) };
    }
  }

  const doc = { ...base, status, counted: true, consumptionLitres: litres, anomaly };
  const items = [
    tx.put(doc),
    tx.update(K.meter(meter.meterNumber), {
      set: { lastReading: reading, lastReadAt: base.readAt },
      // Only if no newer reading was appended since we read the meter.
      ...(meter.lastReadAt
        ? { condition: "#last = :last", names: { "#last": "lastReadAt" }, values: { ":last": meter.lastReadAt } }
        : { condition: "attribute_not_exists(#last)", names: { "#last": "lastReadAt" } }),
    }),
  ];
  if (litres > 0) items.push(...usageWrites(meter, base.period, litres, 1));
  await transact(items);
  return doc;
}

async function insertLateReading(meter, base) {
  const partition = `METER#${meter.meterNumber}`;
  const isCounted = (i) => i.sk.startsWith("R#") && i.counted;
  const [prev] = await query({ pk: partition, before: base.sk, desc: true, limit: 10, consistent: true, filter: isCounted });
  const [next] = await query({ pk: partition, after: base.sk, limit: 10, consistent: true, filter: isCounted });
  const prevReading = prev ? prev.reading : meter.initialReading ?? 0;

  // Must fit between its neighbours; otherwise keep it for the record but
  // don't let it move any consumption.
  if (!next || base.reading < prevReading || base.reading > next.reading) {
    const doc = { ...base, status: "inconsistent", counted: false, consumptionLitres: 0, anomaly: null };
    await transact([tx.put(doc)]);
    return doc;
  }

  const before = Math.round((base.reading - prevReading) * 1000);
  const after = Math.round((next.reading - base.reading) * 1000);
  const doc = { ...base, status: "late", counted: true, consumptionLitres: before, anomaly: null };
  const items = [
    tx.put(doc),
    // Unchanged since we read it, i.e. no other reading was slotted in meanwhile.
    tx.update({ pk: next.pk, sk: next.sk }, {
      set: { consumptionLitres: after },
      condition: "#c = :c",
      names: { "#c": "consumptionLitres" },
      values: { ":c": next.consumptionLitres },
    }),
  ];
  if (base.period !== next.period) {
    items.push(...usageWrites(meter, base.period, before, 1), ...usageWrites(meter, next.period, -before, 0));
  } else {
    items.push(...usageWrites(meter, base.period, 0, 1));
  }
  await transact(items);
  return doc;
}
