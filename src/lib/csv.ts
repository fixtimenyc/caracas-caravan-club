/**
 * Escape a CSV cell value, including a guard against formula injection
 * in spreadsheet applications (Excel, Google Sheets, LibreOffice).
 * Any value beginning with =, +, -, @, tab or CR is prefixed with a
 * single quote so it is treated as text, not a formula.
 */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function toCSV(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}
