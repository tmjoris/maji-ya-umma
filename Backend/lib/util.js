import { randomInt, timingSafeEqual, createHash } from "node:crypto";

// ---------- HTTP helpers ----------

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Lets async route handlers throw; errors land in the error middleware.
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Constant-time string comparison for shared secrets (API keys, callback tokens).
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

// Dates -> ISO strings, recursively, for JSON responses.
export function serialize(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]));
  }
  return value;
}

export const toMillis = (v) => (v instanceof Date ? v.getTime() : typeof v === "number" ? v : v ? Date.parse(v) : 0);

// ---------- Kenya-specific ----------

// Accepts 07XXXXXXXX / 01XXXXXXXX / 7XXXXXXXX / 2547XXXXXXXX / +2547XXXXXXXX
// and returns 2547XXXXXXXX (the format M-Pesa expects), or null if invalid.
export function normalizeKenyanPhone(input) {
  const digits = String(input ?? "").replace(/[\s\-()]/g, "").replace(/^\+/, "");
  const match =
    digits.match(/^0([17]\d{8})$/) || digits.match(/^254([17]\d{8})$/) || digits.match(/^([17]\d{8})$/);
  return match ? `254${match[1]}` : null;
}

export const generateAccountNumber = () => `MYU-${String(randomInt(0, 100_000_000)).padStart(8, "0")}`;
export const generateMeterNumber = () => `MTR-${String(randomInt(0, 100_000_000)).padStart(8, "0")}`;

// ---------- Billing periods ("YYYY-MM", Africa/Nairobi time, UTC+3, no DST) ----------

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
const PERIOD_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const isValidPeriod = (p) => typeof p === "string" && PERIOD_RE.test(p);

export function periodOf(date = new Date()) {
  const d = new Date(new Date(date).getTime() + EAT_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function shiftPeriod(period, delta) {
  const [, y, m] = period.match(PERIOD_RE);
  const idx = Number(y) * 12 + (Number(m) - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

// Midnight EAT on the 1st of the period, as a Date.
export function periodStart(period) {
  const [, y, m] = period.match(PERIOD_RE);
  return new Date(Date.UTC(Number(y), Number(m) - 1, 1) - EAT_OFFSET_MS);
}

export function periodLabel(period) {
  const [, y, m] = period.match(PERIOD_RE);
  return new Date(Date.UTC(Number(y), Number(m) - 1, 15)).toLocaleString("en-KE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// The last `count` periods ending with the current one, oldest first.
export function recentPeriods(count, now = new Date()) {
  const current = periodOf(now);
  return Array.from({ length: count }, (_, i) => shiftPeriod(current, i - count + 1));
}
