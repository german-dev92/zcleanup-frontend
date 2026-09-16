export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function toIsoDateLocal(date: Date): string {
  const d = startOfLocalDay(date);
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getRollingBookingWindow(daysForward: number): { min: string; max: string } {
  const today = startOfLocalDay(new Date());
  const max = addDays(today, daysForward);
  return { min: toIsoDateLocal(today), max: toIsoDateLocal(max) };
}

export function generateTimeSlots(
  startTime: string,
  endTime: string,
  intervalMinutes: number,
): string[] {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (intervalMinutes <= 0 || start === null || end === null || start > end) return [];

  const out: string[] = [];
  for (let m = start; m <= end; m += intervalMinutes) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    out.push(`${hh}:${mm}`);
  }
  return out;
}

export function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value ?? ''));
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isInteger(hh) || !Number.isInteger(mm)) return null;
  if (hh < 0 || hh > 23) return null;
  if (mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

