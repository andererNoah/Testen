import { ValidationError } from "@hv/core";

/** Allowed types (extension → MIME). Magic bytes are checked where they are reliable. */
const TYPES: Record<string, { mime: string; magic?: (b: Buffer) => boolean }> = {
  pdf: { mime: "application/pdf", magic: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  png: { mime: "image/png", magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  jpg: { mime: "image/jpeg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
  jpeg: { mime: "image/jpeg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
  heic: { mime: "image/heic" },
  webp: { mime: "image/webp", magic: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", magic: (b) => b[0] === 0x50 && b[1] === 0x4b },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", magic: (b) => b[0] === 0x50 && b[1] === 0x4b },
  xml: { mime: "application/xml", magic: (b) => /^\s*(\uFEFF)?</.test(b.subarray(0, 200).toString("utf8")) },
  txt: { mime: "text/plain" },
  csv: { mime: "text/csv" },
  eml: { mime: "message/rfc822" },
};

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export function checkFile(filename: string, data: Buffer): { mimeType: string; filename: string } {
  const clean =
    filename
      .replace(/[/\\]/g, "_")
      .split("")
      .filter((c) => c.charCodeAt(0) >= 0x20)
      .join("")
      .trim()
      .slice(0, 200) || "datei";
  const ext = clean.includes(".") ? clean.split(".").pop()!.toLowerCase() : "";
  const type = TYPES[ext];
  if (!type) throw new ValidationError(`Dateityp „.${ext || "?"}“ wird nicht unterstützt. Erlaubt: ${Object.keys(TYPES).join(", ")}.`);
  if (data.length === 0) throw new ValidationError("Die Datei ist leer.");
  if (data.length > MAX_FILE_BYTES) throw new ValidationError("Die Datei ist größer als 50 MB.");
  if (type.magic && !type.magic(data)) throw new ValidationError(`Der Inhalt passt nicht zur Endung „.${ext}“.`);
  return { mimeType: type.mime, filename: clean };
}
