export function readable(value: string): string {
  return value.replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase());
}

export function apiError(error: unknown, fallback: string): string {
  const response = error as { response?: { data?: { error?: string; detail?: string } } };
  return response.response?.data?.error || response.response?.data?.detail || fallback;
}

export function downloadCsv(filename: string, rows: Array<Array<string | number | null>>) {
  const escape = (value: string | number | null) => {
    let text = value == null ? '' : String(value);
    // Prevent spreadsheet formula evaluation when exporting user-supplied item names.
    if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const blob = new Blob(['\uFEFF', rows.map(row => row.map(escape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
