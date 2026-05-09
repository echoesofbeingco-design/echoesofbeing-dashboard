import { getAdminDb } from "./firebase-admin";
import type { Booking } from "./booking-types";

// Re-export types and constants for server-side imports
export type { Booking, BookingStatus } from "./booking-types";
export { STATUS_LABELS } from "./booking-types";

/**
 * Firestore Timestamps come as { _seconds, _nanoseconds } objects.
 * This helper converts any Timestamp-like value to an ISO string.
 */
function normalizeTimestamp(val: unknown): string | undefined {
  if (!val) return undefined;

  // Already a string (ISO format)
  if (typeof val === "string") return val;

  // Firestore Admin Timestamp (has toDate())
  if (typeof val === "object" && val !== null && "toDate" in val && typeof (val as Record<string, unknown>).toDate === "function") {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }

  // Serialized Firestore Timestamp { _seconds, _nanoseconds }
  if (typeof val === "object" && val !== null && "_seconds" in val) {
    const secs = (val as { _seconds: number })._seconds;
    return new Date(secs * 1000).toISOString();
  }

  return undefined;
}

/**
 * Normalize all timestamp fields in a booking document so the client
 * always receives ISO strings instead of Firestore Timestamp objects.
 */
function normalizeBooking(id: string, data: Record<string, unknown>): Booking {
  return {
    ...data,
    id,
    createdAt: normalizeTimestamp(data.createdAt) || "",
    updatedAt: normalizeTimestamp(data.updatedAt) || undefined,
    aadharDeletedAt: normalizeTimestamp(data.aadharDeletedAt) || undefined,
  } as Booking;
}

export async function getAllBookings(): Promise<Booking[]> {
  const db = getAdminDb();
  const snapshot = await db
    .collection("bookings")
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) =>
    normalizeBooking(doc.id, doc.data() as Record<string, unknown>)
  );
}

export async function getBookingById(id: string): Promise<Booking | null> {
  const db = getAdminDb();
  const doc = await db.collection("bookings").doc(id).get();
  if (!doc.exists) return null;
  return normalizeBooking(doc.id, doc.data()! as Record<string, unknown>);
}

export async function updateBookingStatus(
  id: string,
  status: string
): Promise<void> {
  const db = getAdminDb();
  await db.collection("bookings").doc(id).update({
    status,
    updatedAt: new Date().toISOString(),
  });
}

export async function addBookingNote(
  id: string,
  note: string,
  author: string
): Promise<void> {
  const db = getAdminDb();
  const doc = await db.collection("bookings").doc(id).get();
  const data = doc.data();
  const existingNotes = (data?.adminNotes as Array<Record<string, string>>) || [];

  await db
    .collection("bookings")
    .doc(id)
    .update({
      adminNotes: [
        ...existingNotes,
        {
          text: note,
          author,
          createdAt: new Date().toISOString(),
        },
      ],
      updatedAt: new Date().toISOString(),
    });
}

export async function getBookingStats() {
  const db = getAdminDb();
  const snapshot = await db.collection("bookings").get();
  const bookings = snapshot.docs.map((doc) => doc.data());

  const total = bookings.length;
  const byStatus: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const bySessionType: Record<string, number> = {};

  let thisWeek = 0;
  let thisMonth = 0;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  for (const b of bookings) {
    const status = (b.status as string) || "unknown";
    byStatus[status] = (byStatus[status] || 0) + 1;

    const category = (b.category as string) || "Unknown";
    byCategory[category] = (byCategory[category] || 0) + 1;

    const sessionType = (b.sessionType as string) || "Unknown";
    bySessionType[sessionType] = (bySessionType[sessionType] || 0) + 1;

    if (b.createdAt) {
      const iso = normalizeTimestamp(b.createdAt);
      if (iso) {
        const created = new Date(iso);
        if (created >= weekAgo) thisWeek++;
        if (created >= monthStart) thisMonth++;
      }
    }
  }

  return { total, byStatus, byCategory, bySessionType, thisWeek, thisMonth };
}

export async function deleteBooking(id: string): Promise<boolean> {
  const db = getAdminDb();
  const doc = await db.collection("bookings").doc(id).get();

  if (!doc.exists) return false;

  await db.collection("bookings").doc(id).delete();
  return true;
}
