export function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map((value) => {
    let cell = String(value ?? "");
    // Prevent user-entered names from becoming spreadsheet formulas.
    if (/^[\s]*[=+@-]/.test(cell)) cell = `'${cell}`;
    return `"${cell.replace(/"/g, '""')}"`;
  }).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, rows: unknown[][]) {
  const url = URL.createObjectURL(new Blob(["\uFEFF", toCsv(rows)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
