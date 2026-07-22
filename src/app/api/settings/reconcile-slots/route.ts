import { NextRequest } from "next/server";
import { requireAuth, withSecurityHeaders } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const RELEASED = new Set(["cancelled"]);

/**
 * Free any calendar slot whose booking no longer holds it.
 *
 * A slot lock can outlive its booking if the booking was cancelled or deleted
 * before the release logic existed, or if a release failed midway. The lock
 * then blocks that time forever — availability shows it as free, but booking
 * it fails with "that time was just taken". This sweeps those up.
 *
 * Safe to run repeatedly; it only deletes locks with no live booking.
 */
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, "admin");
  if ("error" in auth) return auth.error;

  try {
    const db = getAdminDb();
    const locks = await db.collection("slot_locks").get();

    const released: string[] = [];
    let checked = 0;

    for (const lock of locks.docs) {
      checked++;
      const { bookingId } = lock.data() as { bookingId?: string };

      // A lock with no booking id is orphaned by definition.
      if (!bookingId) {
        await lock.ref.delete();
        released.push(lock.id);
        continue;
      }

      const booking = await db.collection("bookings").doc(bookingId).get();

      if (!booking.exists) {
        await lock.ref.delete();
        released.push(lock.id);
        continue;
      }

      const status = String(
        (booking.data() as { status?: string }).status ?? ""
      );
      if (RELEASED.has(status)) {
        await lock.ref.delete();
        released.push(lock.id);
      }
    }

    return withSecurityHeaders(
      Response.json({
        success: true,
        checked,
        released: released.length,
        releasedSlots: released.map((ms) =>
          new Date(Number(ms)).toISOString()
        ),
      })
    );
  } catch (error) {
    console.error("Error reconciling slots:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to reconcile slots" }, { status: 500 })
    );
  }
}
