// Stands in for meter gateways until real meters report in: generates daily
// cumulative readings for active meters and POSTs them to /api/readings with
// the device API key, so they travel the same path as real readings
// (API → RabbitMQ → readings worker).
//
//   npm run simulate-readings -- [--days 90] [--meter MTR-12345678]
//                                [--leak MTR-12345678] [--backdate-install]
//
// --leak             adds ~4 m³/day to that meter to trigger a leak alert
// --backdate-install moves installedAt back to the first simulated day, so
//                    past months can be billed (demo data only)
import { K, get, query, update } from "../data/db.js";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const days = Number(arg("days", 30));
const onlyMeter = arg("meter");
const leakMeter = arg("leak");
const backdate = process.argv.includes("--backdate-install");
const api = process.env.SIMULATOR_API_URL || `http://localhost:${process.env.PORT || 5000}`;
const apiKey = process.env.METER_INGEST_API_KEY;

if (!apiKey) {
  console.error("Set METER_INGEST_API_KEY in Backend/.env first");
  process.exit(1);
}

const DAY = 86_400_000;
const meters = onlyMeter
  ? [await get(K.meter(onlyMeter.toUpperCase()))].filter(Boolean)
  : await query({ index: "gsi2", pk: "METERS", filter: (m) => m.status === "active" });
if (meters.length === 0) {
  console.log(onlyMeter ? `Meter ${onlyMeter} not found.` : "No active meters. Approve a connection request first.");
  process.exit(0);
}

for (const meter of meters) {
  const id = meter.meterNumber;
  const now = Date.now();
  const start = Math.max(meter.lastReadAt ? Date.parse(meter.lastReadAt) : 0, now - days * DAY);
  let reading = meter.lastReading ?? 0;
  const readings = [];

  for (let t = start + DAY; t <= now; t += DAY) {
    const weekend = [0, 6].includes(new Date(t).getDay());
    let litres = 150 + Math.random() * 350 + (weekend ? 120 : 0); // a household: ~10 m³/month
    if (id === leakMeter) litres += 4000;
    reading += litres / 1000;
    readings.push({ meterNumber: id, reading: Math.round(reading * 1000) / 1000, readAt: new Date(t).toISOString() });
  }

  if (backdate && readings.length) {
    await update(K.meter(id), { set: { installedAt: new Date(start).toISOString() } });
  }

  for (let i = 0; i < readings.length; i += 500) {
    const res = await fetch(`${api}/api/readings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify({ readings: readings.slice(i, i + 500) }),
    });
    if (!res.ok) {
      console.error(`${id}: HTTP ${res.status} ${await res.text()}`);
      process.exit(1);
    }
  }
  console.log(`${id}: sent ${readings.length} reading(s), now at ${reading.toFixed(3)} m³`);
}
process.exit(0);
