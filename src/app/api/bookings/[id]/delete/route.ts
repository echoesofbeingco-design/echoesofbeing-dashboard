import { NextRequest } from "next/server";
import { requireAuth, sanitizeId, withSecurityHeaders } from "@/lib/auth";
import { deleteBooking } from "@/lib/bookings";
import { getAdminDb } from "@/lib/firebase-admin";
import { deleteEvent } from "@/lib/google-calendar";
import { sendCancellationEmails } from "@/lib/email";
import { logActivity } from "@/lib/activity";
import { sendTelegramAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Only admin can delete bookings
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

    // Read the booking first so we can free its calendar slot. Deleting the
    // booking alone would leave the slot lock behind and that time would stay
    // permanently unbookable.
    const db = getAdminDb();
    const snap = await db.collection("bookings").doc(id).get();
    const data = snap.exists
      ? (snap.data() as {
          name?: string;
          email?: string;
          sessionType?: string;
          slot?: { startMs?: number; startISO?: string; timezone?: string };
          googleEvent?: { eventId?: string };
        })
      : null;

    const deleted = await deleteBooking(id);
    if (!deleted) {
      return withSecurityHeaders(
        Response.json({ error: "Booking not found" }, { status: 404 })
      );
    }

    if (typeof data?.slot?.startMs === "number") {
      await db
        .collection("slot_locks")
        .doc(String(data.slot.startMs))
        .delete()
        .catch((e) => console.error("Failed to release slot lock:", e));
    }
    if (data?.googleEvent?.eventId) {
      await deleteEvent(data.googleEvent.eventId);
    }

    if (data?.slot?.startISO && data?.email) {
      await sendCancellationEmails({
        name: data.name ?? "",
        email: data.email,
        sessionLabel: data.sessionType ?? "Session",
        startISO: data.slot.startISO,
        timezone: data.slot.timezone ?? "Asia/Kolkata",
      }).catch((e) => console.error("Cancellation emails failed:", e));
    }

    await sendTelegramAlert({
      event: "booking_cancelled",
      client: data?.name ?? "A client",
      session: data?.sessionType ?? "Session",
      when: data?.slot?.startISO
        ? new Intl.DateTimeFormat("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: data.slot.timezone ?? "Asia/Kolkata",
          }).format(new Date(data.slot.startISO))
        : "unscheduled",
      note: `Booking deleted from the dashboard by ${auth.payload.username}. The slot is free again.`,
      source: "dashboard",
    }).catch((e) => console.error("Telegram alert failed:", e));

    await logActivity({
      type: "booking_deleted",
      message: `Booking deleted — ${data?.name ?? "unknown client"}`,
      actor: auth.payload.username,
      source: "dashboard",
    });

    return withSecurityHeaders(Response.json({ success: true }));
  } catch (error) {
    console.error("Error deleting booking:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to delete booking" }, { status: 500 })
    );
  }
}
