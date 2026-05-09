import { NextRequest } from "next/server";
import { requireAuth, sanitizeId, withSecurityHeaders } from "@/lib/auth";
import { updateBookingStatus } from "@/lib/bookings";

export const dynamic = "force-dynamic";

const VALID_STATUSES = [
  "intake_submitted",
  "slot_reserved",
  "pending_payment",
  "payment_received",
  "session_completed",
  "cancelled",
  "no_show",
] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require admin role for status changes
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return withSecurityHeaders(
        Response.json({ error: "Invalid request body" }, { status: 400 })
      );
    }

    const { status } = body as Record<string, unknown>;

    if (
      !status ||
      typeof status !== "string" ||
      !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])
    ) {
      return withSecurityHeaders(
        Response.json({ error: "Invalid status" }, { status: 400 })
      );
    }

    await updateBookingStatus(id, status);
    return withSecurityHeaders(Response.json({ success: true }));
  } catch (error) {
    console.error("Error updating status:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to update status" }, { status: 500 })
    );
  }
}
