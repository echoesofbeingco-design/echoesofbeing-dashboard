import { NextRequest } from "next/server";
import { requireAuth, sanitizeId, withSecurityHeaders } from "@/lib/auth";
import { getClientById } from "@/lib/clients";
import { inviteClientToPortal } from "@/lib/client-invite";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

/** Create (or re-send) a website login invite for this client. */
export async function POST(
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

    const client = await getClientById(id);
    if (!client) {
      return withSecurityHeaders(
        Response.json({ error: "Client not found" }, { status: 404 })
      );
    }

    const result = await inviteClientToPortal(id, {
      name: client.name,
      email: client.email,
      phone: client.whatsapp,
      dateOfBirth: client.dateOfBirth,
    });

    if (!result.ok) {
      return withSecurityHeaders(
        Response.json({ error: result.error }, { status: 400 })
      );
    }

    await logActivity({
      type: "client_created",
      message: `Login invite sent to ${client.name}${
        result.accountCreated ? " (new account)" : ""
      }`,
      actor: auth.payload.username,
      source: "dashboard",
      clientId: id,
    });

    return withSecurityHeaders(Response.json({ success: true, ...result }));
  } catch (error) {
    console.error("Error inviting client:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to send the invite" }, { status: 500 })
    );
  }
}
