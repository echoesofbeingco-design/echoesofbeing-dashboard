import { NextRequest } from "next/server";
import { requireAuth, sanitizeId, withSecurityHeaders } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

/**
 * Every booking belonging to one client, newest session first.
 *
 * Indexed on clientId alone with in-memory sorting, so no composite index is
 * needed — a client has a handful of bookings, not thousands.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;

  try {
    const { id: rawId } = await params;
    const id = sanitizeId(rawId);
    if (!id) {
      return withSecurityHeaders(
        Response.json({ error: "Invalid client ID" }, { status: 400 })
      );
    }

    const snap = await getAdminDb()
      .collection("bookings")
      .where("clientId", "==", id)
      .select("sessionType", "status", "slot", "category", "createdAt", "googleEvent")
      .get();

    const bookings = snap.docs
      .map((doc) => {
        const d = doc.data() as {
          sessionType?: string;
          status?: string;
          category?: string;
          createdAt?: string;
          slot?: { startISO?: string; startMs?: number; timezone?: string };
          googleEvent?: { meetLink?: string };
        };
        return {
          id: doc.id,
          sessionType: d.sessionType ?? "Session",
          status: d.status ?? "",
          category: d.category ?? "",
          startISO: d.slot?.startISO ?? null,
          startMs: d.slot?.startMs ?? null,
          timezone: d.slot?.timezone ?? "Asia/Kolkata",
          meetLink: d.googleEvent?.meetLink ?? null,
          createdAt: d.createdAt ?? "",
        };
      })
      // Scheduled ones first (soonest-to-latest by recency), unscheduled last.
      .sort((a, b) => (b.startMs ?? 0) - (a.startMs ?? 0));

    return withSecurityHeaders(Response.json({ bookings }));
  } catch (error) {
    console.error("Error fetching client bookings:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to fetch bookings" }, { status: 500 })
    );
  }
}
