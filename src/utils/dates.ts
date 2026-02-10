export function dateISOInTimeZone(date: Date, timeZone: string): string {
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parts = s.split(/\D+/).filter(Boolean);
  if (parts.length >= 3 && parts[0] && parts[1] && parts[2]) {
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }
  return date.toISOString().slice(0, 10);
}

export function addDaysISO(dateISO: string, days: number): string {
  const [y = NaN, m = NaN, d = NaN] = dateISO.split('-').map((x) => Number(x));
  const yy = Number.isFinite(y) ? y : new Date().getUTCFullYear();
  const mm = Number.isFinite(m) ? m : new Date().getUTCMonth() + 1;
  const dd = Number.isFinite(d) ? d : new Date().getUTCDate();
  const base = new Date(Date.UTC(yy, mm - 1, dd));
  base.setUTCDate(base.getUTCDate() + days);
  const outY = base.getUTCFullYear();
  const outM = String(base.getUTCMonth() + 1).padStart(2, '0');
  const outD = String(base.getUTCDate()).padStart(2, '0');
  return `${outY}-${outM}-${outD}`;
}
