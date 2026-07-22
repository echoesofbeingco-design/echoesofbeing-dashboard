import { NextRequest } from "next/server";
import { requireAuth, sanitizeId, withSecurityHeaders } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { createEvent, deleteEvent } from "@/lib/google-calendar";
import { sendCancellationEmails } from "@/lib/email";
import { sendTelegramAlert } from "@/lib/telegram";
import { logActivity } from "@/lib/activity";
import {
  normalizeConfig,
  respectsBuffer,
  type AvailabilityConfig,
  type BusyInterval,
} from "@/lib/availability";

export const dynamic = "force-dynamic";

const VALID_STATUSES = [
  "intake_submitted",
  "slot_reserved",
  "pending_payment",
  "payment_received",
  "session_completed",
  "cancelled",
  "no_show",
] as const;

/** Statuses that free the calendar slot. Mirrors the website's booking-types. */
const RELEASED = new Set(["cancelled"]);

class SlotTakenError extends Error {}

/** "Fri 24 Jul, 10:00" in the booking's own timezone, for alerts. */
function whenLabel(slot?: { startISO?: string; timezone?: string }): string {
  if (!slot?.startISO) return "unscheduled";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: slot.timezone ?? "Asia/Kolkata",
  }).format(new Date(slot.startISO));
}

interface BookingSlot {
  startMs?: number;
  endMs?: number;
  startISO?: string;
  endISO?: string;
  durationMin?: number;
  timezone?: string;
  sessionTypeId?: string;
}

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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return withSecurityHeaders(
        Response.json({ error: "Invalid request body" }, { status: 400 })
      );
    }

    const { status } = body as Record<string, unknown>;
    if (
      !status ||
      typeof status !== "string" ||
      !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])
    ) {
      return withSecurityHeaders(
        Response.json({ error: "Invalid status" }, { status: 400 })
      );
    }

    const db = getAdminDb();
    const ref = db.collection("bookings").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return withSecurityHeaders(
        Response.json({ error: "Booking not found" }, { status: 404 })
      );
    }

    const booking = snap.data() as {
      status?: string;
      name?: string;
      email?: string;
      category?: string;
      sessionType?: string;
      slot?: BookingSlot;
      googleEvent?: { eventId?: string };
    };

    const oldStatus = String(booking.status ?? "");
    const slot = booking.slot;
    const nowIso = new Date().toISOString();

    const becomingCancelled = RELEASED.has(status) && !RELEASED.has(oldStatus);
    const beingRestored = !RELEASED.has(status) && RELEASED.has(oldStatus);

    /* ── Cancelling: free the slot and clear the calendar ── */
    if (becomingCancelled) {
      if (typeof slot?.startMs === "number") {
        await db
          .collection("slot_locks")
          .doc(String(slot.startMs))
          .delete()
          .catch((e) => console.error("Failed to release slot lock:", e));
      }
      if (booking.googleEvent?.eventId) {
        await deleteEvent(booking.googleEvent.eventId);
      }

      await ref.update({
        status,
        googleEvent: null,
        cancelledAt: nowIso,
        cancelledBy: auth.payload.username,
        updatedAt: nowIso,
      });

      if (slot?.startISO && booking.email) {
        await sendCancellationEmails({
          name: booking.name ?? "",
          email: booking.email,
          sessionLabel: booking.sessionType ?? "Session",
          startISO: slot.startISO,
          timezone: slot.timezone ?? "Asia/Kolkata",
        }).catch((e) => console.error("Cancellation emails failed:", e));
      }

      await sendTelegramAlert({
        event: "booking_cancelled",
        client: booking.name ?? "A client",
        session: booking.sessionType ?? "Session",
        when: whenLabel(slot),
        note: `Cancelled from the dashboard by ${auth.payload.username}. The slot is free again.`,
        source: "dashboard",
      }).catch((e) => console.error("Telegram alert failed:", e));

      await logActivity({
        type: "booking_cancelled",
        message: `Session cancelled — ${booking.name ?? "client"}${
          slot?.startISO
            ? `, ${new Intl.DateTimeFormat("en-GB", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
                timeZone: slot.timezone ?? "Asia/Kolkata",
              }).format(new Date(slot.startISO))}`
            : ""
        }`,
        actor: auth.payload.username,
        source: "dashboard",
        bookingId: id,
      });

      return withSecurityHeaders(
        Response.json({ success: true, slotReleased: true })
      );
    }

    /* ── Un-cancelling: the slot must still be free ── */
    if (beingRestored && typeof slot?.startMs === "number") {
      const configSnap = await db.collection("config").doc("availability").get();
      const config: AvailabilityConfig = normalizeConfig(
        configSnap.exists
          ? (configSnap.data() as Partial<AvailabilityConfig>)
          : null
      );

      const startMs = slot.startMs;
      const endMs =
        typeof slot.endMs === "number"
          ? slot.endMs
          : startMs + (slot.durationMin ?? 60) * 60_000;

      const maxDurationMin = Math.max(
        ...config.sessionTypes.map((s) => s.durationMin)
      );
      const windowMs = (config.bufferMin + maxDurationMin) * 60_000;
      const lockRef = db.collection("slot_locks").doc(String(startMs));

      try {
        await db.runTransaction(async (t) => {
          const lockSnap = await t.get(lockRef);
          const neighbours = await t.get(
            db
              .collection("bookings")
              .where("slot.startMs", ">=", startMs - windowMs)
              .where("slot.startMs", "<=", startMs + windowMs)
              .select("status", "slot")
          );

          if (lockSnap.exists) throw new SlotTakenError();

          const busy: BusyInterval[] = [];
          for (const doc of neighbours.docs) {
            if (doc.id === id) continue; // don't block on itself
            const d = doc.data() as {
              status?: string;
              slot?: { startMs?: number; endMs?: number };
            };
            if (RELEASED.has(d.status ?? "")) continue;
            if (
              typeof d.slot?.startMs === "number" &&
              typeof d.slot?.endMs === "number"
            ) {
              busy.push({ startMs: d.slot.startMs, endMs: d.slot.endMs });
            }
          }

          if (!respectsBuffer(startMs, endMs, busy, config.bufferMin)) {
            throw new SlotTakenError();
          }

          t.create(lockRef, {
            bookingId: id,
            startMs,
            endMs,
            createdAt: nowIso,
            createdBy: auth.payload.username,
          });
        });
      } catch (error) {
        if (error instanceof SlotTakenError) {
          return withSecurityHeaders(
            Response.json(
              {
                error:
                  "That time has since been taken by another booking, so this one can't be reinstated. Create a new booking at a free time instead.",
              },
              { status: 409 }
            )
          );
        }
        throw error;
      }

      // Put it back on the calendar.
      let googleEvent: Record<string, unknown> | null = null;
      if (slot.startISO && slot.endISO) {
        const event = await createEvent({
          summary: `${booking.sessionType ?? "Session"} — ${booking.name ?? ""}`,
          description: [
            `Client: ${booking.name ?? ""}`,
            `Email: ${booking.email ?? ""}`,
            booking.category ? `Focus: ${booking.category}` : "",
            "",
            "Reinstated from the admin dashboard",
          ]
            .filter(Boolean)
            .join("\n"),
          startISO: slot.startISO,
          endISO: slot.endISO,
          timezone: slot.timezone ?? "Asia/Kolkata",
          attendeeEmail: booking.email,
          attendeeName: booking.name,
        });
        if (event) {
          googleEvent = { ...event, createdAt: nowIso };
        }
      }

      await ref.update({
        status,
        ...(googleEvent ? { googleEvent } : {}),
        cancelledAt: null,
        cancelledBy: null,
        updatedAt: nowIso,
      });

      return withSecurityHeaders(
        Response.json({ success: true, slotReacquired: true })
      );
    }

    /* ── Ordinary status change ── */
    await ref.update({ status, updatedAt: nowIso });

    await sendTelegramAlert({
      event: "booking_status",
      client: booking.name ?? "A client",
      session: booking.sessionType ?? "Session",
      when: whenLabel(slot),
      note: `Status is now "${status.replace(/_/g, " ")}" (changed by ${
        auth.payload.username
      }).`,
      source: "dashboard",
    }).catch((e) => console.error("Telegram alert failed:", e));

    await logActivity({
      type: "booking_status_changed",
      message: `${booking.name ?? "Booking"} moved to "${status.replace(/_/g, " ")}"`,
      actor: auth.payload.username,
      source: "dashboard",
      bookingId: id,
    });

    return withSecurityHeaders(Response.json({ success: true }));
  } catch (error) {
    console.error("Error updating status:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to update status" }, { status: 500 })
    );
  }
}
