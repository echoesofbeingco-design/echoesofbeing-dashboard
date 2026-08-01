/**
 * Transactional email via Resend's REST API.
 *
 * Uses fetch rather than the `resend` SDK so the dashboard gains no new
 * dependency. Never throws: a mail failure must not fail a booking.
 */

import { buildIcs } from "@/lib/ics";

const RESEND_URL = "https://api.resend.com/emails";

export const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || "echoesofbeing.co@gmail.com";

const FROM_ADDRESS = process.env.EMAIL_FROM || "noreply@echoesofbeing.co.in";
export const FROM_EMAIL = `Echoes of Being <${FROM_ADDRESS}>`;

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: string }[];
}

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      "email: RESEND_API_KEY is not set — skipping notification to",
      input.to
    );
    return false;
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: input.to,
        subject: input.subject,
        html: input.html,
        ...(input.attachments ? { attachments: input.attachments } : {}),
      }),
    });

    if (!res.ok) {
      console.error("email: send failed", res.status, await res.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("email: send threw", error);
    return false;
  }
}

/** Escape user-supplied text before putting it in an HTML email. */
export function esc(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface CancellationEmailInput {
  name: string;
  email: string;
  sessionLabel: string;
  startISO: string;
  timezone: string;
  /** Blank when the practice cancelled, which is the usual case here. */
  reason?: string;
}

/**
 * Tell the client and the practice that a session was cancelled. Google sends
 * its own cancellation when the event is deleted, but that only reaches Google
 * Calendar users — this is the reliable one.
 */
export async function sendCancellationEmails(
  input: CancellationEmailInput
): Promise<void> {
  const when = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: input.timezone,
  }).format(new Date(input.startISO));

  const clientHtml = emailShell(`
    <h1 style="font-family:Georgia,serif;font-size:22px;color:#2d352d;margin:0 0 16px;">
      Your session has been cancelled
    </h1>
    <p style="color:#5a615a;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Hi ${esc(input.name.split(" ")[0] || input.name)}, we&rsquo;ve had to cancel
      the session below. We&rsquo;re sorry for the disruption.
    </p>
    <div style="background:#f2efe6;border-radius:14px;padding:18px;margin-bottom:20px;">
      <p style="margin:0 0 6px;color:#2d352d;font-size:15px;font-weight:600;">${esc(input.sessionLabel)}</p>
      <p style="margin:0;color:#5a615a;font-size:14px;text-decoration:line-through;">${esc(when)} (IST)</p>
    </div>
    ${
      input.reason
        ? `<p style="color:#5a615a;font-size:14px;line-height:1.7;margin:0 0 16px;">${esc(input.reason)}</p>`
        : ""
    }
    <p style="color:#5a615a;font-size:14px;line-height:1.7;margin:0;">
      The time has been released. Whenever you&rsquo;re ready, you can book
      another session from your account.
    </p>
  `);

  const adminHtml = emailShell(`
    <h1 style="font-family:Georgia,serif;font-size:20px;color:#2d352d;margin:0 0 16px;">
      Session cancelled — ${esc(input.name)}
    </h1>
    <table style="width:100%;font-size:14px;color:#5a615a;border-collapse:collapse;">
      <tr><td style="padding:6px 0;">When</td><td style="padding:6px 0;color:#2d352d;">${esc(when)} IST</td></tr>
      <tr><td style="padding:6px 0;">Session</td><td style="padding:6px 0;color:#2d352d;">${esc(input.sessionLabel)}</td></tr>
      <tr><td style="padding:6px 0;">Email</td><td style="padding:6px 0;color:#2d352d;">${esc(input.email)}</td></tr>
    </table>
    <p style="color:#5a615a;font-size:14px;line-height:1.7;margin:16px 0 0;">
      The slot has been released and the calendar event removed.
    </p>
  `);

  await Promise.allSettled([
    sendEmail({
      to: input.email,
      subject: "Your session has been cancelled | Echoes of Being",
      html: clientHtml,
    }),
    sendEmail({
      to: ADMIN_EMAIL,
      subject: `Cancelled: ${input.name}`,
      html: adminHtml,
    }),
  ]);
}

export interface RescheduleEmailInput {
  bookingId: string;
  name: string;
  email: string;
  sessionLabel: string;
  fromISO: string;
  toISO: string;
  toEndISO: string;
  timezone: string;
  meetLink?: string | null;
}

/**
 * Tell the client and the practice a session has moved. Google also emails the
 * guest when the calendar event is patched, but only if they use Google
 * Calendar — this is the reliable notice, and it carries a fresh .ics so other
 * calendar apps pick up the new time too.
 */
export async function sendRescheduleEmails(
  input: RescheduleEmailInput
): Promise<void> {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: input.timezone,
    }).format(new Date(iso));

  const wasWhen = fmt(input.fromISO);
  const nowWhen = fmt(input.toISO);

  const ics = buildIcs({
    uid: `booking-${input.bookingId}@echoesofbeing.co.in`,
    startISO: input.toISO,
    endISO: input.toEndISO,
    summary: `${input.sessionLabel} — Echoes of Being`,
    description: input.meetLink
      ? `Your rescheduled session.\nJoin: ${input.meetLink}`
      : "Your rescheduled session.",
    location: input.meetLink ?? "Online",
    organizerEmail: ADMIN_EMAIL,
    organizerName: "Echoes of Being",
    attendeeEmail: input.email,
    attendeeName: input.name,
  });

  const clientHtml = emailShell(`
    <h1 style="font-family:Georgia,serif;font-size:22px;color:#2d352d;margin:0 0 16px;">
      Your session has been moved
    </h1>
    <p style="color:#5a615a;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Hi ${esc(input.name.split(" ")[0] || input.name)}, your session has been
      rescheduled. Here are the new details.
    </p>
    <div style="background:#f2efe6;border-radius:14px;padding:18px;margin-bottom:20px;">
      <p style="margin:0 0 6px;color:#2d352d;font-size:15px;font-weight:600;">${esc(input.sessionLabel)}</p>
      <p style="margin:0 0 4px;color:#8a8f88;font-size:13px;text-decoration:line-through;">${esc(wasWhen)} (IST)</p>
      <p style="margin:0;color:#2d352d;font-size:15px;font-weight:600;">${esc(nowWhen)} (IST)</p>
      ${
        input.meetLink
          ? `<p style="margin:12px 0 0;font-size:14px;"><a href="${esc(input.meetLink)}" style="color:#5c7a5c;">Join the session</a></p>`
          : ""
      }
    </div>
    <p style="color:#5a615a;font-size:14px;line-height:1.7;margin:0;">
      The attached calendar file will update this in any calendar app. If the
      new time doesn&rsquo;t work for you, just let us know.
    </p>
  `);

  const adminHtml = emailShell(`
    <h1 style="font-family:Georgia,serif;font-size:20px;color:#2d352d;margin:0 0 16px;">
      Session rescheduled — ${esc(input.name)}
    </h1>
    <table style="width:100%;font-size:14px;color:#5a615a;border-collapse:collapse;">
      <tr><td style="padding:6px 0;">Was</td><td style="padding:6px 0;color:#2d352d;text-decoration:line-through;">${esc(wasWhen)} IST</td></tr>
      <tr><td style="padding:6px 0;">Now</td><td style="padding:6px 0;color:#2d352d;font-weight:600;">${esc(nowWhen)} IST</td></tr>
      <tr><td style="padding:6px 0;">Session</td><td style="padding:6px 0;color:#2d352d;">${esc(input.sessionLabel)}</td></tr>
      <tr><td style="padding:6px 0;">Email</td><td style="padding:6px 0;color:#2d352d;">${esc(input.email)}</td></tr>
    </table>
    <p style="color:#5a615a;font-size:14px;line-height:1.7;margin:16px 0 0;">
      The calendar event has been moved to the new time.
    </p>
  `);

  const attachments = [
    {
      filename: "session.ics",
      content: Buffer.from(ics, "utf-8").toString("base64"),
    },
  ];

  await Promise.allSettled([
    sendEmail({
      to: input.email,
      subject: "Your session has been moved | Echoes of Being",
      html: clientHtml,
      attachments,
    }),
    sendEmail({
      to: ADMIN_EMAIL,
      subject: `Rescheduled: ${input.name}`,
      html: adminHtml,
    }),
  ]);
}

export const emailShell = (body: string) => `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#faf8f3;padding:32px 16px;">
  <div style="max-width:520px;margin:0 auto;background:#fffdf8;border-radius:20px;padding:32px;">
    ${body}
    <p style="color:#8a8f88;font-size:12px;line-height:1.6;margin-top:28px;">
      Echoes of Being &middot; A counselling psychology practice
    </p>
  </div>
</div>`;
