import { NextRequest } from "next/server";
import { requireAuth, withSecurityHeaders } from "@/lib/auth";
import { getBookingStats, getRecentBookings } from "@/lib/bookings";
import { getClientStats, getPendingTherapistHomework } from "@/lib/clients";

export const dynamic = "force-dynamic";

/**
 * Everything the dashboard home page needs, in a single request.
 *
 * The page used to fan out to five separate routes. Firestore itself is fast
 * here (queries measure 15–70ms warm), but on Vercel each route is its own
 * serverless function, so an idle dashboard paid up to five independent cold
 * starts — each re-initialising Node, Next, firebase-admin and a fresh gRPC
 * connection to Firestore. Collapsing them into one invocation means one cold
 * start, and the four queries below then share that warmed connection.
 */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;

  try {
    const [stats, recentBookings, clientStats, homeworkTasks] =
      await Promise.all([
        getBookingStats(),
        getRecentBookings(5),
        getClientStats(),
        getPendingTherapistHomework(),
      ]);

    return withSecurityHeaders(
      Response.json({
        stats,
        recentBookings,
        clientStats,
        homeworkTasks,
        user: { username: auth.payload.username, role: auth.payload.role },
      })
    );
  } catch (error) {
    console.error("Error building dashboard summary:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to load dashboard" }, { status: 500 })
    );
  }
}
