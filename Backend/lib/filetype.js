// Identifies a file from its first bytes ("magic numbers"), never from the
// name or the browser-supplied type, which the uploader controls.
//
// Only these image formats are ever shown inline. SVG is deliberately not
// one of them: it can carry scripts.
const SIGNATURES = [
  { mime: "image/png", ext: "png", image: true, test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/jpeg", ext: "jpg", image: true, test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/gif", ext: "gif", image: true, test: (b) => ["GIF87a", "GIF89a"].includes(b.subarray(0, 6).toString("latin1")) },
  { mime: "image/webp", ext: "webp", image: true, test: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
  { mime: "application/pdf", ext: "pdf", image: false, test: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
];

const UNKNOWN = { mime: "application/octet-stream", ext: "", image: false };

export function detectFileType(buffer) {
  const b = Buffer.from(buffer);
  const hit = SIGNATURES.find((s) => b.length >= 12 && s.test(b));
  return hit ? { mime: hit.mime, ext: hit.ext, image: hit.image } : UNKNOWN;
}

// A safe download name that ends in the detected extension.
export function safeFileName(name, type) {
  let base = String(name || "attachment").replace(/[^\w.\- ]/g, "_").slice(0, 120) || "attachment";
  if (type.ext && !base.toLowerCase().endsWith(`.${type.ext}`)) base = `${base.replace(/\.[^.]*$/, "")}.${type.ext}`;
  return base;
}

// Sends a stored ticket attachment. Verified images get their real type so
// they can be previewed; everything else is a plain download. The CSP and
// nosniff headers stop the browser from ever executing the file.
export function sendAttachment(res, attachment) {
  const data = Buffer.from(attachment.data);
  const type = detectFileType(data);
  res.set({
    "Content-Type": type.image ? type.mime : "application/octet-stream",
    "Content-Disposition": `${type.image ? "inline" : "attachment"}; filename="${safeFileName(attachment.name, type)}"`,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  });
  res.send(data);
}
