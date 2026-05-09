import { NextRequest } from "next/server";
import { requireAuth, sanitizeId, withSecurityHeaders } from "@/lib/auth";
import { getBookingById } from "@/lib/bookings";

export const dynamic = "force-dynamic";

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
        Response.json({ error: "Invalid booking ID" }, { status: 400 })
      );
    }

    const booking = await getBookingById(id);
    if (!booking) {
      return withSecurityHeaders(
        Response.json({ error: "Booking not found" }, { status: 404 })
      );
    }

    return withSecurityHeaders(Response.json({ booking }));
  } catch (error) {
    console.error("Error fetching booking:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to fetch booking" }, { status: 500 })
    );
  }
}
