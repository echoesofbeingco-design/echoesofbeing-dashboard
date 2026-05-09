import { NextRequest } from "next/server";
import { requireAuth, withSecurityHeaders } from "@/lib/auth";
import { getBookingStats } from "@/lib/bookings";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;

  try {
    const stats = await getBookingStats();
    return withSecurityHeaders(Response.json({ stats }));
  } catch (error) {
    console.error("Error fetching stats:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to fetch stats" }, { status: 500 })
    );
  }
}
