// The calendar day in Slovak time (Europe/Bratislava, summer time included), 'YYYY-MM-DD'.
// The server decides the streak day with it (SCRUM-118); the app uses the same rule for its
// own play counts when the server's day is unknown (SCRUM-202).

const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Bratislava',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const DAY_MS = 86_400_000;

/** Calendar date in Slovakia for a moment in time. */
export function slovakDay(ms: number): string {
  return DAY_FORMAT.format(new Date(ms));
}

/** Midnight UTC of a day 'YYYY-MM-DD', in milliseconds. */
export const dayStartUtc = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Whole calendar days from day a to day b ('YYYY-MM-DD'). */
export function daysBetween(a: string, b: string): number {
  return Math.round((dayStartUtc(b) - dayStartUtc(a)) / DAY_MS);
}
