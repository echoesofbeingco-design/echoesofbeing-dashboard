/**
 * Minimal iCalendar (.ics) builder.
 *
 * Google invites only reliably land in a client's calendar if they use Google
 * Calendar, so we attach an .ics to our own confirmation email too — that works
 * with Apple Calendar, Outlook and everything else.
 */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format a UTC instant as an iCalendar UTC timestamp: 20260723T043000Z */
export function toIcsUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/** Escape per RFC 5545: backslash, semicolon, comma and newlines. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold long lines to 75 octets as the spec requires. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let remaining = line;
  parts.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);
  while (remaining.length > 74) {
    parts.push(` ${remaining.slice(0, 74)}`);
    remaining = remaining.slice(74);
  }
  if (remaining.length) parts.push(` ${remaining}`);
  return parts.join("\r\n");
}

export interface IcsEvent {
  uid: string;
  startISO: string;
  endISO: string;
  summary: string;
  description?: string;
  location?: string;
  organizerEmail?: string;
  organizerName?: string;
  attendeeEmail?: string;
  attendeeName?: string;
}

export function buildIcs(event: IcsEvent): string {
  const now = toIcsUtc(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Echoes of Being//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toIcsUtc(new Date(event.startISO))}`,
    `DTEND:${toIcsUtc(new Date(event.endISO))}`,
    `SUMMARY:${escapeText(event.summary)}`,
  ];

  if (event.description)
    lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.organizerEmail) {
    lines.push(
      `ORGANIZER;CN=${escapeText(event.organizerName ?? "Echoes of Being")}:mailto:${event.organizerEmail}`
    );
  }
  if (event.attendeeEmail) {
    lines.push(
      `ATTENDEE;CN=${escapeText(event.attendeeName ?? "")};RSVP=FALSE:mailto:${event.attendeeEmail}`
    );
  }

  lines.push("STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR");

  return lines.map(fold).join("\r\n");
}
