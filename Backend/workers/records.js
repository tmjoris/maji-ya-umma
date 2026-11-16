import { K, tx, transact, putIfAbsent, update, cancellationCodes, now } from "../data/db.js";
import { detectFileType, safeFileName } from "../lib/filetype.js";

// Writes are create-if-absent: if a message is redelivered after an admin has
// already changed the record (e.g. resolved the ticket), it must not reset it.

export async function recordTicket(event) {
  const d = event.data;
  const createdAt = event.occurredAt;
  // Type comes from the file's bytes, not the uploader's label.
  const file = d.attachment ? Buffer.from(d.attachment.data, "base64") : null;
  const fileType = file ? detectFileType(file) : null;
  const fileName = file ? safeFileName(d.attachment.name, fileType) : null;
  const items = [
    tx.put({
      ...K.ticket(event.id),
      entity: "ticket",
      gsi1pk: `USER#${d.uid}`,
      gsi1sk: `TICKET#${createdAt}`,
      gsi2pk: "TICKETS",
      gsi2sk: createdAt,
      id: event.id,
      uid: d.uid,
      email: d.email,
      customerName: d.customerName,
      accountNumber: d.accountNumber ?? null,
      subject: d.subject,
      category: d.category,
      priority: d.priority,
      message: d.message,
      attachmentName: fileName,
      attachmentType: fileType?.mime ?? null,
      attachmentIsImage: fileType?.image ?? false,
      status: "open",
      response: null,
      createdAt,
      updatedAt: createdAt,
    }),
  ];
  // Stored separately so ticket lists never load file contents.
  if (file) {
    items.push(tx.put({ ...K.ticketAttachment(event.id), entity: "attachment", name: fileName, type: fileType.mime, data: file }));
  }
  try {
    await transact(items);
  } catch (err) {
    if (cancellationCodes(err)[0] === "ConditionalCheckFailed") return; // already recorded
    throw err;
  }
}

export async function recordConnectionRequest(event) {
  const d = event.data;
  const createdAt = event.occurredAt;
  await putIfAbsent({
    ...K.connectionRequest(event.id),
    entity: "connectionRequest",
    gsi1pk: `USER#${d.uid}`,
    gsi1sk: `CONNREQ#${createdAt}`,
    gsi2pk: "CONNREQS",
    gsi2sk: createdAt,
    id: event.id,
    uid: d.uid,
    firstName: d.firstName ?? null,
    lastName: d.lastName ?? null,
    email: d.email,
    phoneNumber: d.phoneNumber ?? null,
    accountNumber: d.accountNumber ?? null,
    address: d.address ?? null,
    city: d.city ?? "",
    zipCode: d.zipCode ?? "",
    status: "pending",
    assignedTo: "Plumbing & Installation Unit",
    meterNumber: null,
    reviewNote: null,
    createdAt,
  });
}

export async function applyProfileUpdate(event) {
  const { uid, updates } = event.data;
  await update(K.user(uid), { set: { ...updates, updatedAt: now() }, condition: "attribute_exists(pk)" });
}
