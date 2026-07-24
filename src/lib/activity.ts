import { getAdminDb } from "@/lib/firebase-admin";

/**
 * Activity feed shared with the public website.
 *
 * Both apps append to the same `activity` collection, so the dashboard shows a
 * single timeline of everything — client bookings and cancellations made on
 * the website as well as admin actions taken here.
 *
 * Never throws: logging must not be able to fail a real operation.
 */

export type ActivityType =
  | "booking_created"
  | "booking_cancelled"
  | "booking_status_changed"
  | "booking_deleted"
  | "client_created"
  | "client_deleted"
  | "account_deleted"
  | "settings_updated"
  | "google_connected"
  | "google_disconnected";

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  message: string;
  actor: string;
  source: "website" | "dashboard";
  bookingId: string | null;
  clientId: string | null;
  read: boolean;
  createdAt: string;
}

export interface ActivityInput {
  type: ActivityType;
  message: string;
  actor: string;
  source: "website" | "dashboard";
  bookingId?: string;
  clientId?: string;
}

export async function logActivity(input: ActivityInput): Promise<void> {
  try {
    await getAdminDb()
      .collection("activity")
      .add({
        ...input,
        bookingId: input.bookingId ?? null,
        clientId: input.clientId ?? null,
        read: false,
        createdAt: new Date().toISOString(),
      });
  } catch (error) {
    console.error("activity: failed to log", input.type, error);
  }
}

/** Most recent activity first. */
export async function getRecentActivity(limit = 50): Promise<ActivityEntry[]> {
  const snap = await getAdminDb()
    .collection("activity")
    .orderBy("createdAt", "desc")
    .limit(Math.min(limit, 200))
    .get();

  return snap.docs.map((doc) => {
    const d = doc.data() as Omit<ActivityEntry, "id">;
    return { id: doc.id, ...d };
  });
}

/** A page of activity, newest first, for the notifications screen. */
export async function getActivityPage(
  page: number,
  pageSize: number
): Promise<{ entries: ActivityEntry[]; total: number; totalPages: number }> {
  const db = getAdminDb();

  const countSnap = await db.collection("activity").count().get();
  const total = countSnap.data().count;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);

  const snap = await db
    .collection("activity")
    .orderBy("createdAt", "desc")
    .offset((safePage - 1) * pageSize)
    .limit(pageSize)
    .get();

  const entries = snap.docs.map((doc) => {
    const d = doc.data() as Omit<ActivityEntry, "id">;
    return { id: doc.id, ...d };
  });

  return { entries, total, totalPages };
}

export async function getUnreadCount(): Promise<number> {
  const snap = await getAdminDb()
    .collection("activity")
    .where("read", "==", false)
    .count()
    .get();
  return snap.data().count;
}

export async function markAllRead(): Promise<number> {
  const db = getAdminDb();
  const snap = await db
    .collection("activity")
    .where("read", "==", false)
    .limit(400)
    .get();

  if (snap.empty) return 0;

  const batch = db.batch();
  for (const doc of snap.docs) batch.update(doc.ref, { read: true });
  await batch.commit();
  return snap.size;
}
