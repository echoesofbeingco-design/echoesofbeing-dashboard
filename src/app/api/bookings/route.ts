import { NextRequest } from "next/server";
import { requireAuth, withSecurityHeaders } from "@/lib/auth";
import { getAllBookings } from "@/lib/bookings";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;

  try {
    const bookings = await getAllBookings();
    return withSecurityHeaders(Response.json({ bookings }));
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to fetch bookings" }, { status: 500 })
    );
  }
}
