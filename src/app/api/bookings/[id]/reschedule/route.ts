import { NextRequest } from "next/server";
import { requireAuth, sanitizeId, withSecurityHeaders } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { createEvent, updateEventTime } from "@/lib/google-calendar";
import { sendRescheduleEmails } from "@/lib/email";
import { sendTelegramAlert } from "@/lib/telegram";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

class SlotTakenError extends Error {}

const TZ_DEFAULT = "Asia/Kolkata";

interface BookingSlot {
  startMs?: number;
  endMs?: number;
  startISO?: string;
  endISO?: string;
  durationMin?: number;
  timezone?: string;
  sessionTypeId?: string;
}

function whenLabel(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  }).format(new Date(iso));
}

/**
 * Move a scheduled booking to a new time.
 *
 * Like manual booking, this is free of the public availability rules — the
 * practice picks the new time. It swaps the slot lock (so the old time frees
 * up and the new one can't be double-booked), moves the Google Calendar event
 * (a PATCH, which keeps the same Meet link and notifies the client's calendar),
 * and emails both sides with the new details plus a fresh .ics. Cancelled or
 * unscheduled bookings can't be rescheduled.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request, "admin");
  if ("error" in auth) return auth.error;

  try {
    const { id: rawId } = await params;
    const id = sanitizeId(rawId);
    if (!id) {
      return withSecurityHeaders(
        Response.json({ error: "Invalid booking ID" }, { status: 400 })
      );
    }

    const body = (await request.json()) as { startMs?: unknown };
    const startMs = Number(body.startMs);
    if (!Number.isFinite(startMs)) {
      return withSecurityHeaders(
        Response.json({ error: "A new time is required." }, { status: 400 })
      );
    }
    if (startMs <= Date.now()) {
      return withSecurityHeaders(
        Response.json(
          { error: "The new time has already passed. Pick a future time." },
          { status: 400 }
        )
      );
    }

    const db = getAdminDb();
    const bookingRef = db.collection("bookings").doc(id);
    const snap = await bookingRef.get();
    if (!snap.exists) {
      return withSecurityHeaders(
        Response.json({ error: "Booking not found" }, { status: 404 })
      );
    }

    const data = snap.data() as {
      status?: string;
      name?: string;
      email?: string;
      sessionType?: string;
      category?: string;
      slot?: BookingSlot;
      googleEvent?: { eventId?: string } | null;
    };

    if (data.status === "cancelled") {
      return withSecurityHeaders(
        Response.json(
          { error: "This booking is cancelled. Reinstate it before rescheduling." },
          { status: 400 }
        )
      );
    }

    const oldSlot = data.slot;
    if (!oldSlot?.startMs || !oldSlot.startISO) {
      return withSecurityHeaders(
        Response.json(
          { error: "This booking has no scheduled time to move." },
          { status: 400 }
        )
      );
    }

    const tz = oldSlot.timezone || TZ_DEFAULT;
    const durationMin = oldSlot.durationMin ?? 60;
    const endMs = startMs + durationMin * 60_000;

    if (startMs === oldSlot.startMs) {
      return withSecurityHeaders(
        Response.json(
          { error: "That's the same time it's already booked for." },
          { status: 400 }
        )
      );
    }

    const newSlot: BookingSlot = {
      startMs,
      endMs,
      startISO: new Date(startMs).toISOString(),
      endISO: new Date(endMs).toISOString(),
      durationMin,
      timezone: tz,
      sessionTypeId: oldSlot.sessionTypeId,
    };
    const nowIso = new Date().toISOString();

    // Swap the slot locks atomically: the old time is released and the new one
    // reserved. The exact-slot lock is the one guard kept — you can't move a
    // session onto a time already taken by another booking.
    const oldLockRef = db.collection("slot_locks").doc(String(oldSlot.startMs));
    const newLockRef = db.collection("slot_locks").doc(String(startMs));

    await db.runTransaction(async (t) => {
      const newLockSnap = await t.get(newLockRef);
      if (newLockSnap.exists && newLockSnap.data()?.bookingId !== id) {
        throw new SlotTakenError();
      }
      t.delete(oldLockRef);
      t.set(newLockRef, {
        bookingId: id,
        startMs,
        endMs,
        createdAt: nowIso,
        createdBy: auth.payload.username,
      });
      t.update(bookingRef, { slot: newSlot, updatedAt: nowIso });
    });

    // Move the calendar event. A PATCH keeps the same event and Meet link; if
    // the booking never had an event (calendar was offline when booked), make
    // a fresh one now. Never fatal — the booking is already moved.
    let meetLink: string | null = null;
    try {
      const existingEventId = data.googleEvent?.eventId;
      const moved = existingEventId
        ? await updateEventTime(existingEventId, {
            startISO: newSlot.startISO!,
            endISO: newSlot.endISO!,
            timezone: tz,
          })
        : await createEvent({
            summary: `${data.sessionType ?? "Session"} — ${data.name ?? ""}`,
            description: [
              `Client: ${data.name ?? ""}`,
              `Email: ${data.email ?? ""}`,
              data.category ? `Focus: ${data.category}` : "",
              "",
              "Rescheduled from the admin dashboard",
            ]
              .filter(Boolean)
              .join("\n"),
            startISO: newSlot.startISO!,
            endISO: newSlot.endISO!,
            timezone: tz,
            attendeeEmail: data.email,
            attendeeName: data.name,
          });
      if (moved) {
        meetLink = moved.meetLink ?? null;
        await bookingRef.update({
          googleEvent: { ...moved, updatedAt: nowIso },
        });
      }
    } catch (e) {
      console.error("reschedule: calendar update failed", e);
    }

    // Email both sides — never fatal.
    if (data.email) {
      await sendRescheduleEmails({
        bookingId: id,
        name: data.name ?? "",
        email: data.email,
        sessionLabel: data.sessionType ?? "Session",
        fromISO: oldSlot.startISO,
        toISO: newSlot.startISO!,
        toEndISO: newSlot.endISO!,
        timezone: tz,
        meetLink,
      }).catch((e) => console.error("reschedule: emails failed", e));
    }

    await sendTelegramAlert({
      event: "booking_status",
      client: data.name ?? "A client",
      session: data.sessionType ?? "Session",
      when: whenLabel(newSlot.startISO!, tz),
      note: `Rescheduled from ${whenLabel(oldSlot.startISO, tz)} by ${auth.payload.username}.`,
      source: "dashboard",
    }).catch((e) => console.error("reschedule: telegram failed", e));

    await logActivity({
      type: "booking_status_changed",
      message: `Session moved — ${data.name ?? "client"}, ${whenLabel(
        oldSlot.startISO,
        tz
      )} → ${whenLabel(newSlot.startISO!, tz)}`,
      actor: auth.payload.username,
      source: "dashboard",
      bookingId: id,
    });

    return withSecurityHeaders(
      Response.json({ success: true, slot: newSlot, meetLink })
    );
  } catch (error) {
    if (error instanceof SlotTakenError) {
      return withSecurityHeaders(
        Response.json(
          { error: "Another booking already holds that exact time." },
          { status: 409 }
        )
      );
    }
    console.error("Error rescheduling booking:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to reschedule" }, { status: 500 })
    );
  }
}
