/**
 * Default weekly publishing calendar, one slot per platform.
 * Used by the UI to propose a schedule and as the "best time" baseline
 * until the Marketing Brain learns from real engagement.
 * JS weekday: 0 = Sunday ... 6 = Saturday (matches Date.getDay()).
 */
export interface TimeSlot {
  platform: string;
  day: number;
  hour: number;
}

export const SUGGESTED_SLOTS: TimeSlot[] = [
  { platform: "facebook", day: 1, hour: 9 },
  { platform: "instagram", day: 1, hour: 12 },
  { platform: "linkedin", day: 1, hour: 14 },
  { platform: "tiktok", day: 1, hour: 17 },
  { platform: "youtube", day: 1, hour: 19 },
  { platform: "facebook", day: 2, hour: 10 },
  { platform: "instagram", day: 2, hour: 15 },
  { platform: "linkedin", day: 3, hour: 11 },
  { platform: "x", day: 3, hour: 13 },
  { platform: "facebook", day: 4, hour: 12 },
  { platform: "instagram", day: 4, hour: 18 },
  { platform: "google", day: 5, hour: 9 },
  { platform: "tiktok", day: 5, hour: 16 },
  { platform: "linkedin", day: 6, hour: 10 },
];

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatDayLabel(day: number): string {
  return DAY_LABELS[((day % 7) + 7) % 7];
}

/**
 * Next future occurrence of a platform's suggested slot.
 */
export function nextTimeFor(platform: string, from: Date): Date {
  const slot =
    SUGGESTED_SLOTS.find((s) => s.platform === platform) ??
    ({ platform, day: from.getDay(), hour: 9 } as TimeSlot);
  const candidate = new Date(from);
  candidate.setHours(slot.hour, 0, 0, 0);
  for (let i = 0; i < 8; i++) {
    if (candidate.getDay() === slot.day && candidate > from) return candidate;
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

/** "yyyy-MM-ddTHH:mm" in local time for <input type="datetime-local">. */
export function toLocalInputValue(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

/**
 * Marketing Brain: learn the top (day, hour) slots from engagement history.
 * Pass daily rows of { weekday, hour, reach } to get an ordered ranking.
 */
export function computeBestTimeSlots(
  rows: { weekday: number; hour: number; reach: number }[],
): TimeSlot[] {
  const groups = new Map<string, { day: number; hour: number; reach: number }>();
  for (const r of rows) {
    const key = `${r.weekday}:${r.hour}`;
    const existing = groups.get(key);
    if (existing) existing.reach += r.reach;
    else groups.set(key, { day: r.weekday, hour: r.hour, reach: r.reach });
  }
  return [...groups.values()]
    .sort((a, b) => b.reach - a.reach)
    .slice(0, 5)
    .map((g) => ({ platform: "*", day: g.day, hour: g.hour }));
}
