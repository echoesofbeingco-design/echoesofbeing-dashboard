/**
 * Pure availability / slot-generation logic for the booking system.
 *
 * Deliberately framework-free and side-effect-free: both the website and the
 * admin dashboard need to compute the exact same slots, so this module is
 * duplicated verbatim between the two apps. Keep them in sync.
 *
 * All times are stored as UTC instants; the config carries a timezone that is
 * used only to interpret wall-clock windows ("10:00"-"14:00") and to label
 * slots for display.
 */

/** 0 = Sunday … 6 = Saturday (matches Date#getUTCDay). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface TimeWindow {
  /** Local wall-clock "HH:mm" in the config timezone. */
  start: string;
  end: string;
}

export interface SessionTypeConfig {
  id: string;
  label: string;
  durationMin: number;
  /** Rupees. 0 means complimentary. */
  price: number;
  enabled: boolean;
}

export interface AvailabilityConfig {
  timezone: string;
  /** Bookable windows per weekday, keyed "0".."6". Empty array = closed. */
  weeklyHours: Record<string, TimeWindow[]>;
  /** Minimum free gap required between two sessions, in minutes. */
  bufferMin: number;
  /** How far ahead of now a client must book, in hours. */
  minNoticeHours: number;
  /** How far into the future booking is allowed, in days. */
  maxAdvanceDays: number;
  /** Candidate start times are generated on this grid, in minutes. */
  slotGranularityMin: number;
  /** Whole days that are unavailable, "YYYY-MM-DD" in the config timezone. */
  blackoutDates: string[];
  sessionTypes: SessionTypeConfig[];
  updatedAt?: string;
  updatedBy?: string;
}

/** A block of time that cannot be booked over (an existing session, etc). */
export interface BusyInterval {
  startMs: number;
  endMs: number;
}

export interface Slot {
  /** UTC instant as an ISO string. */
  startISO: string;
  endISO: string;
  startMs: number;
  endMs: number;
  /** "HH:mm" wall clock in the config timezone, for display. */
  label: string;
}

export interface DaySlots {
  /** "YYYY-MM-DD" in the config timezone. */
  date: string;
  slots: Slot[];
}

export const IST = "Asia/Kolkata";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function defaultWindow(): TimeWindow[] {
  return [{ start: "10:00", end: "14:00" }];
}

/**
 * Practice defaults: Sunday–Friday 10:00–14:00 IST, Saturday closed,
 * a 1 hour gap between sessions and 24 hours advance notice.
 */
export const DEFAULT_AVAILABILITY_CONFIG: AvailabilityConfig = {
  timezone: IST,
  weeklyHours: {
    "0": defaultWindow(), // Sunday
    "1": defaultWindow(),
    "2": defaultWindow(),
    "3": defaultWindow(),
    "4": defaultWindow(),
    "5": defaultWindow(),
    "6": [], // Saturday — closed
  },
  bufferMin: 60,
  minNoticeHours: 24,
  maxAdvanceDays: 60,
  slotGranularityMin: 30,
  blackoutDates: [],
  sessionTypes: [
    {
      id: "intro",
      label: "Introductory consultation",
      durationMin: 30,
      price: 0,
      enabled: true,
    },
    {
      id: "individual",
      label: "Individual therapy",
      durationMin: 60,
      price: 2000,
      enabled: true,
    },
  ],
};

/* ──────────────────────────  timezone helpers  ────────────────────────── */

/**
 * How far the given timezone is ahead of UTC at that instant, in ms.
 * Uses Intl so it stays correct for zones with DST (IST has none).
 */
function tzOffsetMs(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  // Intl renders midnight as "24" in some engines; normalise it.
  const hour = map.hour === "24" ? "0" : map.hour;
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(hour),
    Number(map.minute),
    Number(map.second)
  );
  return asUTC - date.getTime();
}

/**
 * Convert a wall-clock date/time in `timeZone` to a UTC instant (ms).
 * Refines once so DST transitions resolve correctly.
 */
export function zonedToUtcMs(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offset1 = tzOffsetMs(timeZone, new Date(guess));
  let ms = guess - offset1;
  const offset2 = tzOffsetMs(timeZone, new Date(ms));
  if (offset2 !== offset1) ms = guess - offset2;
  return ms;
}

/** "HH:mm" wall clock for a UTC instant in the given timezone. */
export function formatTimeInZone(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

/** "YYYY-MM-DD" calendar date for a UTC instant in the given timezone. */
export function formatDateInZone(ms: number, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dtf.format(new Date(ms)); // en-CA yields YYYY-MM-DD
}

/** Parse "YYYY-MM-DD" into its parts. Throws on malformed input. */
export function parseDateStr(date: string): {
  year: number;
  month: number;
  day: number;
} {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Invalid date "${date}", expected YYYY-MM-DD`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/** Weekday of a calendar date (timezone independent once the date is fixed). */
export function weekdayOf(date: string): Weekday {
  const { year, month, day } = parseDateStr(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() as Weekday;
}

/** Add `n` whole days to a "YYYY-MM-DD" string. */
export function addDays(date: string, n: number): string {
  const { year, month, day } = parseDateStr(date);
  const d = new Date(Date.UTC(year, month - 1, day) + n * DAY);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseHHmm(value: string): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) throw new Error(`Invalid time "${value}", expected HH:mm`);
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

/* ──────────────────────────  slot generation  ─────────────────────────── */

export function getSessionType(
  config: AvailabilityConfig,
  sessionTypeId: string
): SessionTypeConfig | null {
  return config.sessionTypes.find((s) => s.id === sessionTypeId) ?? null;
}

/**
 * True when [startMs, endMs) keeps at least `bufferMin` free on both sides of
 * every busy interval. This is what enforces "at least 1 hour between
 * sessions" — it is symmetric, so a session can be booked neither immediately
 * before nor immediately after an existing one.
 */
export function respectsBuffer(
  startMs: number,
  endMs: number,
  busy: BusyInterval[],
  bufferMin: number
): boolean {
  const buffer = bufferMin * MINUTE;
  for (const b of busy) {
    const clearBefore = endMs + buffer <= b.startMs;
    const clearAfter = startMs >= b.endMs + buffer;
    if (!clearBefore && !clearAfter) return false;
  }
  return true;
}

export interface GenerateSlotsOptions {
  config: AvailabilityConfig;
  sessionTypeId: string;
  /** Inclusive "YYYY-MM-DD" range in the config timezone. */
  fromDate: string;
  toDate: string;
  busy: BusyInterval[];
  /** Current time as ms since epoch. Injected so this stays pure/testable. */
  nowMs: number;
}

/**
 * Generate every bookable slot in the range, honouring weekly hours,
 * blackout dates, the inter-session buffer, minimum notice and max advance.
 * Days with no availability are omitted entirely.
 */
export function generateSlots(options: GenerateSlotsOptions): DaySlots[] {
  const { config, sessionTypeId, fromDate, toDate, busy, nowMs } = options;

  const sessionType = getSessionType(config, sessionTypeId);
  if (!sessionType || !sessionType.enabled) return [];

  const tz = config.timezone || IST;
  const durationMs = sessionType.durationMin * MINUTE;
  const stepMs = Math.max(5, config.slotGranularityMin) * MINUTE;
  const earliestMs = nowMs + config.minNoticeHours * HOUR;
  const latestMs = nowMs + config.maxAdvanceDays * DAY;
  const blackout = new Set(config.blackoutDates ?? []);

  const days: DaySlots[] = [];

  for (
    let date = fromDate;
    date <= toDate;
    date = addDays(date, 1)
  ) {
    if (blackout.has(date)) continue;

    const windows = config.weeklyHours?.[String(weekdayOf(date))] ?? [];
    if (windows.length === 0) continue;

    const { year, month, day } = parseDateStr(date);
    const slots: Slot[] = [];

    for (const window of windows) {
      const from = parseHHmm(window.start);
      const to = parseHHmm(window.end);
      const windowStart = zonedToUtcMs(
        year,
        month,
        day,
        from.hour,
        from.minute,
        tz
      );
      const windowEnd = zonedToUtcMs(year, month, day, to.hour, to.minute, tz);

      for (
        let start = windowStart;
        start + durationMs <= windowEnd;
        start += stepMs
      ) {
        const end = start + durationMs;
        if (start < earliestMs) continue; // 24h notice
        if (start > latestMs) continue; // too far out
        if (!respectsBuffer(start, end, busy, config.bufferMin)) continue;

        slots.push({
          startISO: new Date(start).toISOString(),
          endISO: new Date(end).toISOString(),
          startMs: start,
          endMs: end,
          label: formatTimeInZone(start, tz),
        });
      }
    }

    if (slots.length > 0) {
      slots.sort((a, b) => a.startMs - b.startMs);
      days.push({ date, slots });
    }
  }

  return days;
}

/**
 * Final server-side validation before writing a booking. Re-checks everything
 * generateSlots checks, for one specific instant, so a stale or hand-crafted
 * slot can never be booked.
 */
export function validateSlot(options: {
  config: AvailabilityConfig;
  sessionTypeId: string;
  startMs: number;
  busy: BusyInterval[];
  nowMs: number;
}): { ok: true; endMs: number } | { ok: false; reason: string } {
  const { config, sessionTypeId, startMs, busy, nowMs } = options;

  const sessionType = getSessionType(config, sessionTypeId);
  if (!sessionType) return { ok: false, reason: "Unknown session type." };
  if (!sessionType.enabled)
    return { ok: false, reason: "That session type is not available." };

  const tz = config.timezone || IST;
  const endMs = startMs + sessionType.durationMin * MINUTE;

  if (startMs < nowMs + config.minNoticeHours * HOUR) {
    return {
      ok: false,
      reason: `Sessions must be booked at least ${config.minNoticeHours} hours in advance.`,
    };
  }
  if (startMs > nowMs + config.maxAdvanceDays * DAY) {
    return { ok: false, reason: "That date is too far in the future." };
  }

  const date = formatDateInZone(startMs, tz);
  if ((config.blackoutDates ?? []).includes(date)) {
    return { ok: false, reason: "That date is unavailable." };
  }

  const windows = config.weeklyHours?.[String(weekdayOf(date))] ?? [];
  if (windows.length === 0) {
    return { ok: false, reason: "There are no sessions on that day." };
  }

  const { year, month, day } = parseDateStr(date);
  const fitsWindow = windows.some((w) => {
    const from = parseHHmm(w.start);
    const to = parseHHmm(w.end);
    const windowStart = zonedToUtcMs(year, month, day, from.hour, from.minute, tz);
    const windowEnd = zonedToUtcMs(year, month, day, to.hour, to.minute, tz);
    return startMs >= windowStart && endMs <= windowEnd;
  });
  if (!fitsWindow) {
    return { ok: false, reason: "That time is outside booking hours." };
  }

  if (!respectsBuffer(startMs, endMs, busy, config.bufferMin)) {
    return { ok: false, reason: "That time is no longer available." };
  }

  return { ok: true, endMs };
}

/** Merge a stored (possibly partial) config over the defaults. */
export function normalizeConfig(
  raw: Partial<AvailabilityConfig> | null | undefined
): AvailabilityConfig {
  const d = DEFAULT_AVAILABILITY_CONFIG;
  if (!raw) return { ...d, weeklyHours: { ...d.weeklyHours } };

  return {
    timezone: raw.timezone || d.timezone,
    weeklyHours: raw.weeklyHours ?? { ...d.weeklyHours },
    bufferMin: numberOr(raw.bufferMin, d.bufferMin),
    minNoticeHours: numberOr(raw.minNoticeHours, d.minNoticeHours),
    maxAdvanceDays: numberOr(raw.maxAdvanceDays, d.maxAdvanceDays),
    slotGranularityMin: numberOr(raw.slotGranularityMin, d.slotGranularityMin),
    blackoutDates: Array.isArray(raw.blackoutDates) ? raw.blackoutDates : [],
    sessionTypes:
      Array.isArray(raw.sessionTypes) && raw.sessionTypes.length > 0
        ? raw.sessionTypes
        : d.sessionTypes,
    updatedAt: raw.updatedAt,
    updatedBy: raw.updatedBy,
  };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
