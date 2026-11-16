// Re-detects every ticket attachment's real file type from its contents and
// fixes its name and type (e.g. "attachment" → "attachment.png", image/png).
// Safe to run again; only changes what's wrong.
//
//   npm run fix-attachments            # dry run
//   npm run fix-attachments -- --apply
import { K, get, query, tx, transact } from "../data/db.js";
import { detectFileType, safeFileName } from "../lib/filetype.js";

const apply = process.argv.includes("--apply");
let changed = 0;

for (const ticket of await query({ index: "gsi2", pk: "TICKETS" })) {
  const att = await get(K.ticketAttachment(ticket.id));
  if (!att) continue;
  const type = detectFileType(att.data);
  const name = safeFileName(att.name, type);
  const correct =
    att.name === name && att.type === type.mime &&
    ticket.attachmentName === name && ticket.attachmentType === type.mime && ticket.attachmentIsImage === type.image;
  if (correct) continue;

  changed++;
  console.log(`"${ticket.subject}": ${att.name} (${att.type}) → ${name} (${type.mime}${type.image ? ", previewable" : ""})`);
  if (apply) {
    await transact([
      tx.update(K.ticket(ticket.id), { set: { attachmentName: name, attachmentType: type.mime, attachmentIsImage: type.image } }),
      tx.update(K.ticketAttachment(ticket.id), { set: { name, type: type.mime } }),
    ]);
  }
}

console.log(changed ? `${apply ? "Fixed" : "Would fix"} ${changed} attachment(s).${apply ? "" : " Re-run with --apply."}` : "All attachments already correct.");
process.exit(0);
