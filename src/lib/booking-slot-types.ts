/**
 * Shared booking vocabulary. This deliberately matches the admin dashboard's
 * `src/lib/booking-types.ts` — the two apps previously disagreed on the status
 * enum, which made statuses written by one app unreadable by the other.
 */

export type BookingStatus =
  | "intake_submitted"
  | "slot_reserved"
  | "pending_payment"
  | "payment_received"
  | "session_completed"
  | "cancelled"
  | "no_show";

export const BOOKING_STATUSES: BookingStatus[] = [
  "intake_submitted",
  "slot_reserved",
  "pending_payment",
  "payment_received",
  "session_completed",
  "cancelled",
  "no_show",
];

/** Statuses that release the calendar slot back to the pool. */
export const RELEASED_STATUSES: ReadonlySet<string> = new Set<string>([
  "cancelled",
]);

/** The booked time, replacing the old Calendly block. */
export interface BookingSlot {
  /** UTC instants. `startMs`/`endMs` are what availability queries use. */
  startMs: number;
  endMs: number;
  startISO: string;
  endISO: string;
  durationMin: number;
  /** IANA zone the session was booked in, for display. */
  timezone: string;
  /** Session type id from the availability config, e.g. "intro". */
  sessionTypeId: string;
}

/** Google Calendar event created for a booking. */
export interface BookingCalendarEvent {
  eventId: string;
  htmlLink?: string;
  meetLink?: string;
  createdAt: string;
}
