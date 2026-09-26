// CSV reading for POS exports: UTF-8 (with or without BOM) or Thai Windows
// encoding (TIS-620 / windows-874), comma, semicolon or tab separated,
// RFC 4180 quoting. Pure — no Node APIs beyond TextDecoder.

export type Encoding = "utf-8" | "windows-874";

export function decodeFile(bytes: Uint8Array): { text: string; encoding: Encoding } {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { text: text.replace(/^﻿/, ""), encoding: "utf-8" };
  } catch {
    return { text: new TextDecoder("windows-874").decode(bytes), encoding: "windows-874" };
  }
}

export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 5).join("\n");
  const counts = [",", ";", "\t", "|"].map((d) => ({ d, n: countOutsideQuotes(sample, d) }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0] && counts[0].n > 0 ? counts[0].d : ",";
}

function countOutsideQuotes(s: string, d: string): number {
  let n = 0;
  let q = false;
  for (const ch of s) {
    if (ch === '"') q = !q;
    else if (!q && ch === d) n++;
  }
  return n;
}

/** Parses CSV into rows of trimmed cells. Blank lines are dropped. */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
    } else if (ch === delimiter) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}
