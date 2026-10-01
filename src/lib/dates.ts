// Dates come from the CMS as YYYY-MM-DD, parsed as UTC midnight: format in UTC
// so the build machine's timezone never shifts a day.
const TZ = 'UTC';

const dayMonthYear = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: TZ,
});
const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: TZ });
const day = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', timeZone: TZ });

const sameMonth = (a: Date, b: Date) =>
  a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();

// "6 juil. 2026", "2 — 3 oct. 2025", "30 sept. — 2 oct. 2025", or across years.
export function formatDateRange(start: Date, end?: Date): string {
  if (!end || end.getTime() === start.getTime()) return dayMonthYear.format(start);
  if (sameMonth(start, end)) return `${day.format(start)} — ${dayMonthYear.format(end)}`;
  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${dayMonth.format(start)} — ${dayMonthYear.format(end)}`;
  }
  return `${dayMonthYear.format(start)} — ${dayMonthYear.format(end)}`;
}

// ISO day used in data attributes and <time datetime>.
export const isoDay = (date: Date) => date.toISOString().slice(0, 10);
