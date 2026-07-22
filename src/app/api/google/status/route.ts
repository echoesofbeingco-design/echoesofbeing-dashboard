import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withSecurityHeaders } from "@/lib/auth";
import {
  disconnect,
  getConnection,
  isGoogleConfigured,
} from "@/lib/google-calendar";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

/** GET — is Google Calendar connected? Never exposes the refresh token. */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;

  const connection = await getConnection();

  return withSecurityHeaders(
    NextResponse.json({
      configured: isGoogleConfigured(),
      connected: Boolean(connection.connected && connection.refreshToken),
      email: connection.email ?? null,
      connectedAt: connection.connectedAt ?? null,
      connectedBy: connection.connectedBy ?? null,
    })
  );
}

/** DELETE — revoke the stored connection. Admin only. */
export async function DELETE(request: NextRequest) {
  const auth = requireAuth(request, "admin");
  if ("error" in auth) return auth.error;

  await disconnect();

  await logActivity({
    type: "google_disconnected",
    message: "Google Calendar disconnected",
    actor: auth.payload.username,
    source: "dashboard",
  });

  return withSecurityHeaders(NextResponse.json({ success: true }));
}
