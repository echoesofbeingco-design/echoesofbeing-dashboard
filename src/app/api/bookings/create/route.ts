import { NextRequest } from "next/server";
import { requireAuth, withSecurityHeaders } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { createEvent } from "@/lib/google-calendar";
import { logActivity } from "@/lib/activity";
import { sendTelegramAlert } from "@/lib/telegram";
import {
  ADMIN_EMAIL,
  emailShell,
  esc,
  sendEmail,
} from "@/lib/email";
import { buildIcs } from "@/lib/ics";
import {
  getSessionType,
  normalizeConfig,
  type AvailabilityConfig,
} from "@/lib/availability";

export const dynamic = "force-dynamic";

class SlotTakenError extends Error {}

function whenLabel(startISO: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(new Date(startISO));
}

interface NotificationInput {
  bookingId: string;
  name: string;
  email: string;
  whatsapp: string;
  sessionType: string;
  category: string;
  concern: string;
  createdBy: string;
  slot: { startISO: string; endISO: string; timezone: string } | null;
  meetLink: string | null;
}

/**
 * Email the practice about every new booking, and the client too when an
 * actual time was reserved. Never throws.
 */
async function sendBookingNotifications(input: NotificationInput) {
  const when = input.slot
    ? whenLabel(input.slot.startISO, input.slot.timezone)
    : "Not scheduled yet";

  const adminHtml = emailShell(`
    <h1 style="font-family:Georgia,serif;font-size:20px;color:#2d352d;margin:0 0 16px;">
      New booking — ${esc(input.name)}
    </h1>
    <table style="width:100%;font-size:14px;color:#5a615a;border-collapse:collapse;">
      <tr><td style="padding:6px 0;">When</td><td style="padding:6px 0;color:#2d352d;">${esc(when)}${input.slot ? " IST" : ""}</td></tr>
      <tr><td style="padding:6px 0;">Session</td><td style="padding:6px 0;color:#2d352d;">${esc(input.sessionType)}</td></tr>
      <tr><td style="padding:6px 0;">Email</td><td style="padding:6px 0;color:#2d352d;">${esc(input.email)}</td></tr>
      <tr><td style="padding:6px 0;">WhatsApp</td><td style="padding:6px 0;color:#2d352d;">${esc(input.whatsapp)}</td></tr>
      <tr><td style="padding:6px 0;">Focus</td><td style="padding:6px 0;color:#2d352d;">${esc(input.category)}</td></tr>
      <tr><td style="padding:6px 0;">Added by</td><td style="padding:6px 0;color:#2d352d;">${esc(input.createdBy)} (dashboard)</td></tr>
    </table>
    ${
      input.concern
        ? `<div style="background:#f2efe6;border-radius:14px;padding:16px;margin-top:16px;">
             <p style="margin:0;color:#5a615a;font-size:14px;line-height:1.7;white-space:pre-wrap;">${esc(input.concern)}</p>
           </div>`
        : ""
    }
  `);

  const jobs: Promise<boolean>[] = [
    sendEmail({
      to: ADMIN_EMAIL,
      subject: `New booking: ${input.name}`,
      html: adminHtml,
    }),
  ];

  if (input.slot) {
    const ics = buildIcs({
      uid: `booking-${input.bookingId}@echoesofbeing.co.in`,
      startISO: input.slot.startISO,
      endISO: input.slot.endISO,
      summary: `${input.sessionType} — Echoes of Being`,
      description: input.meetLink
        ? `Your session with Echoes of Being.\nJoin: ${input.meetLink}`
        : "Your session with Echoes of Being.",
      location: input.meetLink ?? "Online",
      organizerEmail: ADMIN_EMAIL,
      organizerName: "Echoes of Being",
      attendeeEmail: input.email,
      attendeeName: input.name,
    });

    const clientHtml = emailShell(`
      <h1 style="font-family:Georgia,serif;font-size:22px;color:#2d352d;margin:0 0 16px;">
        Your session is booked
      </h1>
      <p style="color:#5a615a;font-size:15px;line-height:1.7;margin:0 0 20px;">
        Hi ${esc(input.name.split(" ")[0] || input.name)}, here are your session details.
      </p>
      <div style="background:#f2efe6;border-radius:14px;padding:18px;margin-bottom:20px;">
        <p style="margin:0 0 6px;color:#2d352d;font-size:15px;font-weight:600;">${esc(input.sessionType)}</p>
        <p style="margin:0;color:#5a615a;font-size:14px;">${esc(when)} (IST)</p>
        ${
          input.meetLink
            ? `<p style="margin:12px 0 0;font-size:14px;"><a href="${esc(input.meetLink)}" style="color:#5c7a5c;">Join the session</a></p>`
            : ""
        }
      </div>
      <p style="color:#5a615a;font-size:14px;line-height:1.7;margin:0;">
        The attached calendar file will add this to any calendar app.
      </p>
    `);

    jobs.push(
      sendEmail({
        to: input.email,
        subject: "Your session is booked | Echoes of Being",
        html: clientHtml,
        attachments: [
          {
            filename: "session.ics",
            content: Buffer.from(ics, "utf-8").toString("base64"),
          },
        ],
      })
    );
  }

  await Promise.allSettled(jobs);
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();

    const {
      name,
      email,
      whatsapp,
      age,
      gender,
      pronouns,
      sessionType,
      category,
      concern,
      // Optional scheduling — when present the booking is actually placed on
      // the calendar, exactly like a website booking.
      sessionTypeId,
      startMs,
      // Every booking belongs to a client. Create the client first, then book.
      clientId: providedClientId,
    } = body;

    const errors: string[] = [];
    if (!providedClientId?.trim()) {
      errors.push(
        "A booking must belong to a client. Create or pick the client first."
      );
    }
    if (!name?.trim()) errors.push("Name is required");
    if (!email?.trim()) errors.push("Email is required");
    if (!whatsapp?.trim()) errors.push("WhatsApp number is required");
    if (!age) errors.push("Age is required");
    if (!gender) errors.push("Gender is required");
    if (!pronouns) errors.push("Pronouns are required");
    if (!sessionType) errors.push("Session type is required");
    if (!category) errors.push("Category is required");
    if (!concern?.trim()) errors.push("Concern is required");

    if (errors.length > 0) {
      return withSecurityHeaders(
        Response.json({ error: errors.join(", ") }, { status: 400 })
      );
    }

    const db = getAdminDb();
    const now = new Date().toISOString();
    const cleanEmail = email.trim().toLowerCase();

    // Confirm the client is real before anything else — a booking that points
    // at a non-existent client would be worse than no booking at all.
    const clientSnap = await db
      .collection("clients")
      .doc(providedClientId.trim())
      .get();
    if (!clientSnap.exists) {
      return withSecurityHeaders(
        Response.json(
          { error: "That client no longer exists. Pick or create one first." },
          { status: 404 }
        )
      );
    }

    const scheduling =
      typeof startMs === "number" && Number.isFinite(startMs) && sessionTypeId;

    const bookingRef = db.collection("bookings").doc();
    let slotPayload: Record<string, unknown> | null = null;
    let config: AvailabilityConfig | null = null;
    let endMs = 0;

    if (scheduling) {
      const snap = await db.collection("config").doc("availability").get();
      config = normalizeConfig(
        snap.exists ? (snap.data() as Partial<AvailabilityConfig>) : null
      );
      const type = getSessionType(config, sessionTypeId);
      if (!type) {
        return withSecurityHeaders(
          Response.json({ error: "Unknown session type." }, { status: 400 })
        );
      }

      // The availability policy — working-hours window, no-Saturday, 24-hour
      // notice, inter-session buffer — exists to shape what the PUBLIC may
      // self-book on the website. When the practice books from the dashboard,
      // they choose the time, so those checks are deliberately skipped here.
      //
      // The one guard kept is the exact-slot lock: the same start time cannot
      // be booked twice, because a therapist can't run two sessions at the
      // same instant and this is also what stops a manual booking from
      // colliding with one a client just made on the website.
      const lockRef = db.collection("slot_locks").doc(String(startMs));
      endMs = startMs + type.durationMin * 60_000;

      await db.runTransaction(async (t) => {
        const lockSnap = await t.get(lockRef);
        if (lockSnap.exists) throw new SlotTakenError();

        slotPayload = {
          startMs,
          endMs,
          startISO: new Date(startMs).toISOString(),
          endISO: new Date(endMs).toISOString(),
          durationMin: type.durationMin,
          timezone: config!.timezone,
          sessionTypeId,
        };

        t.create(lockRef, {
          bookingId: bookingRef.id,
          startMs,
          endMs,
          createdAt: now,
          createdBy: auth.payload.username,
        });

        t.create(bookingRef, {
          name: name.trim(),
          email: cleanEmail,
          whatsapp: whatsapp.trim(),
          age: String(age),
          gender,
          pronouns,
          sessionType,
          sessionTypeId,
          category,
          concern: concern.trim(),
          slot: slotPayload,
          status: "slot_reserved",
          createdAt: now,
          updatedAt: now,
          source: "admin_dashboard",
          createdBy: auth.payload.username,
        });
      });
    } else {
      await bookingRef.set({
        name: name.trim(),
        email: cleanEmail,
        whatsapp: whatsapp.trim(),
        age: String(age),
        gender,
        pronouns,
        sessionType,
        category,
        concern: concern.trim(),
        status: "intake_submitted",
        createdAt: now,
        updatedAt: now,
        source: "admin_dashboard",
        createdBy: auth.payload.username,
      });
    }

    // The client was resolved before the booking document was written.
    const clientId = providedClientId.trim();
    await bookingRef.update({ clientId });

    // Put it on the calendar with a Meet link and invite the client.
    let meetLink: string | null = null;
    if (scheduling && slotPayload && config) {
      const slot = slotPayload as { startISO: string; endISO: string };
      const event = await createEvent({
        summary: `${sessionType} — ${name.trim()}`,
        description: [
          `Client: ${name.trim()}`,
          `Email: ${cleanEmail}`,
          category ? `Focus: ${category}` : "",
          "",
          "Booked from the admin dashboard",
        ]
          .filter(Boolean)
          .join("\n"),
        startISO: slot.startISO,
        endISO: slot.endISO,
        timezone: config.timezone,
        attendeeEmail: cleanEmail,
        attendeeName: name.trim(),
      });
      if (event) {
        meetLink = event.meetLink ?? null;
        await bookingRef.update({
          googleEvent: { ...event, createdAt: new Date().toISOString() },
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // Narrowed once so both the email and the Telegram alert can read it.
    const scheduledSlot =
      scheduling && slotPayload
        ? (slotPayload as {
            startISO: string;
            endISO: string;
            timezone: string;
          })
        : null;

    // Notify the practice (and the client, when an actual time was booked).
    await sendBookingNotifications({
      bookingId: bookingRef.id,
      name: name.trim(),
      email: cleanEmail,
      whatsapp: whatsapp.trim(),
      sessionType,
      category,
      concern: concern.trim(),
      createdBy: auth.payload.username,
      slot:
        scheduling && slotPayload
          ? (slotPayload as {
              startISO: string;
              endISO: string;
              timezone: string;
            })
          : null,
      meetLink,
    }).catch((e) => console.error("Booking notifications failed:", e));

    await sendTelegramAlert({
      event: "booking_created",
      client: name.trim(),
      session: sessionType,
      when: scheduledSlot
        ? new Intl.DateTimeFormat("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: scheduledSlot.timezone ?? "Asia/Kolkata",
          }).format(new Date(scheduledSlot.startISO))
        : "not scheduled yet",
      note: `Added from the dashboard by ${auth.payload.username}.`,
      source: "dashboard",
    }).catch((e) => console.error("Telegram alert failed:", e));

    await logActivity({
      type: "booking_created",
      message: `Booking added for ${name.trim()}${
        scheduling && slotPayload
          ? ` — ${new Intl.DateTimeFormat("en-GB", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
              timeZone:
                (slotPayload as { timezone?: string }).timezone ??
                "Asia/Kolkata",
            }).format(
              new Date((slotPayload as { startISO: string }).startISO)
            )}`
          : " (intake only)"
      }`,
      actor: auth.payload.username,
      source: "dashboard",
      bookingId: bookingRef.id,
      clientId,
    });

    return withSecurityHeaders(
      Response.json(
        {
          id: bookingRef.id,
          clientId,
          scheduled: Boolean(scheduling),
          meetLink,
          message: "Booking created",
        },
        { status: 201 }
      )
    );
  } catch (error) {
    if (error instanceof SlotTakenError) {
      return withSecurityHeaders(
        Response.json(
          {
            error:
              error.message ||
              "That time is no longer available. Please pick another slot.",
          },
          { status: 409 }
        )
      );
    }
    console.error("Error creating booking:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to create booking" }, { status: 500 })
    );
  }
}
