/**
 * Age display.
 *
 * Records can carry age in three shapes: a proper `dateOfBirth`, a numeric
 * `age`, or — from an earlier bug — a date string sitting in the `age` field
 * (which rendered as "1999-11-09y"). This reads all three so old records
 * display correctly without needing a migration.
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whole years old today, or null if the input isn't a usable birth date. */
export function ageFromDateOfBirth(
  value: string | undefined | null,
  nowMs: number = Date.now()
): number | null {
  const m = DATE_RE.exec(String(value ?? "").trim());
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  const now = new Date(nowMs);
  const born = Date.UTC(year, month - 1, day);
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  if (Number.isNaN(born) || born > today) return null;

  let age = now.getUTCFullYear() - year;
  const hadBirthday =
    now.getUTCMonth() + 1 > month ||
    (now.getUTCMonth() + 1 === month && now.getUTCDate() >= day);
  if (!hadBirthday) age -= 1;

  return age >= 0 && age < 130 ? age : null;
}

export interface AgeBearing {
  age?: string;
  dateOfBirth?: string;
}

/** The age in years as a number, from whichever field actually holds it. */
export function resolveAge(record: AgeBearing): number | null {
  const fromDob = ageFromDateOfBirth(record.dateOfBirth);
  if (fromDob !== null) return fromDob;

  // Legacy records stored the birth date in `age`.
  const fromAgeField = ageFromDateOfBirth(record.age);
  if (fromAgeField !== null) return fromAgeField;

  const n = Number(String(record.age ?? "").trim());
  if (Number.isFinite(n) && n > 0 && n < 130) return Math.floor(n);

  return null;
}

/** "26y", or "" when we genuinely don't know. */
export function displayAge(record: AgeBearing): string {
  const age = resolveAge(record);
  return age === null ? "" : `${age}y`;
}
