// One-off copy of the live Firestore data into DynamoDB. Firestore is only
// read; nothing is deleted there.
//
//   npm run migrate-firestore            # dry run: shows what would be copied
//   npm run migrate-firestore -- --apply # writes to DynamoDB (existing items are left alone)
//
// Copies: user profiles (re-keyed by their Firebase Auth uid), connection
// requests and feedback tickets (with attachments up to 350 KB).
// Skips: the old "payments" records. The old payment form saved them without
// any money moving, so importing them would credit customers for payments
// that never happened.
import { getFirestore } from "firebase-admin/firestore";
import { auth, firebaseApp } from "../firebase.js";
import { K, putIfAbsent, now } from "../data/db.js";
import { newUserItem, ROLES } from "../services/profiles.js";
import { generateAccountNumber, normalizeKenyanPhone } from "../lib/util.js";
import { detectFileType, safeFileName } from "../lib/filetype.js";

const apply = process.argv.includes("--apply");
const firestore = getFirestore(firebaseApp);
const iso = (v) => (v?.toDate ? v.toDate().toISOString() : typeof v === "string" ? v : now());
const MAX_ATTACHMENT = 350 * 1024;
// Firestore timestamps → ISO strings (DynamoDB can't store the objects).
const plain = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v?.toDate ? v.toDate().toISOString() : v]));

const uidByEmail = new Map();
async function uidFor(email) {
  if (!email) return null;
  const key = email.toLowerCase();
  if (!uidByEmail.has(key)) {
    uidByEmail.set(key, await auth.getUserByEmail(key).then((u) => u.uid, () => null));
  }
  return uidByEmail.get(key);
}

const report = { users: 0, connectionRequests: 0, tickets: 0, attachments: 0, skipped: [] };
async function write(kind, item) {
  if (!apply) return true;
  const created = await putIfAbsent(item);
  if (!created) report.skipped.push(`${kind} ${item.pk} already in DynamoDB`);
  return created;
}

// ---------- users ----------
for (const doc of (await firestore.collection("user").get()).docs) {
  const d = doc.data();
  const uid = (await uidFor(d.email)) ?? (await auth.getUser(doc.id).then((u) => u.uid, () => null));
  if (!uid) {
    report.skipped.push(`user ${doc.id} (${d.email ?? "no email"}): no matching sign-in account`);
    continue;
  }
  const { createdOn, ...rest } = plain(d);
  const item = newUserItem({
    ...rest,
    uid,
    email: (d.email ?? "").toLowerCase(),
    phoneNumber: normalizeKenyanPhone(d.phoneNumber) ?? d.phoneNumber ?? "",
    userRole: d.userRole === ROLES.ADMIN ? ROLES.ADMIN : ROLES.CUSTOMER,
    accountNumber: d.accountNumber || generateAccountNumber(),
    balance: 0,
    meterNumbers: [],
    createdOn: iso(createdOn),
  });
  if (await write("user", item)) report.users++;
}

// ---------- connection requests ----------
for (const doc of (await firestore.collection("connectionRequests").get()).docs) {
  const d = doc.data();
  const uid = d.uid ?? (await uidFor(d.email));
  const createdAt = iso(d.createdAt);
  const item = {
    ...K.connectionRequest(doc.id),
    entity: "connectionRequest",
    ...(uid ? { gsi1pk: `USER#${uid}`, gsi1sk: `CONNREQ#${createdAt}` } : {}),
    gsi2pk: "CONNREQS",
    gsi2sk: createdAt,
    id: doc.id,
    uid: uid ?? null,
    firstName: d.firstName ?? null,
    lastName: d.lastName ?? null,
    email: d.email ?? null,
    phoneNumber: d.phoneNumber ?? null,
    address: d.address ?? null,
    city: d.city ?? "",
    zipCode: d.zipCode ?? "",
    status: String(d.status ?? "pending").toLowerCase(),
    assignedTo: d.assignedTo ?? "Plumbing & Installation Unit",
    meterNumber: null,
    reviewNote: null,
    createdAt,
  };
  if (await write("connection request", item)) report.connectionRequests++;
}

// ---------- feedback → tickets ----------
for (const doc of (await firestore.collection("feedback").get()).docs) {
  const d = doc.data();
  const uid = d.uid ?? (await uidFor(d.email));
  const createdAt = iso(d.createdAt);
  const raw = typeof d.attachment === "string" ? d.attachment : d.attachment?.data;
  const file = raw ? Buffer.from(raw, "base64") : null;
  const keepFile = file && file.length <= MAX_ATTACHMENT;
  const fileType = keepFile ? detectFileType(file) : null;
  const fileName = keepFile ? safeFileName(typeof d.attachment === "object" ? d.attachment.name : "attachment", fileType) : null;
  if (file && !keepFile) report.skipped.push(`ticket ${doc.id}: attachment is ${Math.round(file.length / 1024)} KB, over the 350 KB limit`);

  const ticket = {
    ...K.ticket(doc.id),
    entity: "ticket",
    ...(uid ? { gsi1pk: `USER#${uid}`, gsi1sk: `TICKET#${createdAt}` } : {}),
    gsi2pk: "TICKETS",
    gsi2sk: createdAt,
    id: doc.id,
    uid: uid ?? null,
    email: d.email ?? null,
    customerName: d.customerName ?? null,
    accountNumber: d.accountNumber ?? null,
    subject: d.subject ?? "(no subject)",
    category: d.category ?? "other",
    priority: d.priority ?? "low",
    message: d.message ?? "",
    attachmentName: fileName,
    attachmentType: fileType?.mime ?? null,
    attachmentIsImage: fileType?.image ?? false,
    status: d.status ?? "open",
    response: d.response ?? null,
    createdAt,
    updatedAt: iso(d.updatedAt ?? d.createdAt),
  };
  if (await write("ticket", ticket)) {
    report.tickets++;
    if (keepFile) {
      if (await write("attachment", { ...K.ticketAttachment(doc.id), entity: "attachment", name: fileName, type: fileType.mime, data: file })) report.attachments++;
    }
  }
}

const skippedPayments = (await firestore.collection("payments").count().get()).data().count;
console.log(`${apply ? "Copied" : "Would copy"}: ${report.users} users, ${report.connectionRequests} connection requests, ${report.tickets} tickets (${report.attachments} attachments).`);
console.log(`Not copied: ${skippedPayments} old payment records (no money moved through the old form).`);
for (const s of report.skipped) console.log(`  skipped: ${s}`);
if (!apply) console.log("Dry run. Re-run with --apply to write to DynamoDB.");
process.exit(0);
