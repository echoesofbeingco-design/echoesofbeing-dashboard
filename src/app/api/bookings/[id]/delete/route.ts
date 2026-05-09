import { NextRequest } from "next/server";
import { requireAuth, sanitizeId, withSecurityHeaders } from "@/lib/auth";
import { deleteBooking } from "@/lib/bookings";

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

    const deleted = await deleteBooking(id);
    if (!deleted) {
      return withSecurityHeaders(
        Response.json({ error: "Booking not found" }, { status: 404 })
      );
    }

    return withSecurityHeaders(Response.json({ success: true }));
  } catch (error) {
    console.error("Error deleting booking:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to delete booking" }, { status: 500 })
    );
  }
}
