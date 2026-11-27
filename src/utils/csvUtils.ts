export function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  return `"${str.replace(/"/g, '""')}"`;
}

export function downloadCsv(
  fileName: string,
  headers: string[],
  rows: unknown[][],
): void {
  const csvLines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  const csvContent = `\uFEFF${csvLines.join('\r\n')}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
