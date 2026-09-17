"use strict";
/* Royalty statement files (§2.98): what a deposit's statementRef points to.

   The statementRef written on chain is the SHA-256 of the statement file's
   exact bytes, so anyone holding the file can check it with a stock tool
   (`shasum -a 256`, `certutil -hashfile … SHA256`) against Etherscan.

   Distributors hand out statements as PDF, CSV or XLSX; nothing else is
   accepted. The type is read from the bytes, as for track media (§2.93). */

const crypto = require("crypto");

const MAX_STATEMENT_BYTES = 10 * 1024 * 1024;

const MIME_EXTENSION = {
  "application/pdf": "pdf",
  "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx"
};

/** The bytes32 statementRef of a file: 0x + its SHA-256. The frontend
 * computes the same value before depositing. */
function statementRefOf(buffer) {
  return "0x" + crypto.createHash("sha256").update(buffer).digest("hex");
}

/** 'application/pdf' | 'text/csv' | xlsx mime | null */
function sniffStatementMime(buf) {
  if (buf.length < 8) return null;
  if (buf.toString("ascii", 0, 5) === "%PDF-") return "application/pdf";
  // XLSX is a ZIP whose entries live under xl/; entry names are stored
  // uncompressed in the local headers, so a byte search finds them.
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    return buf.includes("xl/workbook") ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : null;
  }
  // CSV: valid UTF-8 text with no NUL byte.
  if (buf.includes(0)) return null;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buf);
    return "text/csv";
  } catch {
    return null;
  }
}

/** Throws a coded "invalid" error unless `buf` is an accepted statement. */
function checkStatementFile(buf) {
  if (!buf.length) throw Object.assign(new Error("the statement file is empty"), { code: "invalid" });
  const mime = sniffStatementMime(buf);
  if (!mime) throw Object.assign(new Error("the statement must be a PDF, CSV or XLSX file"), { code: "invalid" });
  return { mime, extension: MIME_EXTENSION[mime] };
}

module.exports = { MAX_STATEMENT_BYTES, statementRefOf, sniffStatementMime, checkStatementFile };
