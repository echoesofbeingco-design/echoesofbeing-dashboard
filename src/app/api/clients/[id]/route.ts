import { NextRequest } from "next/server";
import { requireAuth, sanitizeId, withSecurityHeaders } from "@/lib/auth";
import { getClientById, updateClient } from "@/lib/clients";

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
        Response.json({ error: "Invalid client ID" }, { status: 400 })
      );
    }

    const client = await getClientById(id);
    if (!client) {
      return withSecurityHeaders(
        Response.json({ error: "Client not found" }, { status: 404 })
      );
    }

    return withSecurityHeaders(Response.json({ client }));
  } catch (error) {
    console.error("Error fetching client:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to fetch client" }, { status: 500 })
    );
  }
}

export async function PATCH(
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

    const body = await request.json();

    // Only allow specific fields to be updated
    const allowedFields = [
      "name", "email", "whatsapp", "age", "gender", "pronouns",
      "occupation", "desiredOutcomes", "status",
      "symptoms", "concerns", "stressors",
      "interpersonalHistory", "keyThemes", "theoreticalLens", "treatmentFocus",
    ];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return withSecurityHeaders(
        Response.json({ error: "No valid fields to update" }, { status: 400 })
      );
    }

    await updateClient(id, updates);
    return withSecurityHeaders(
      Response.json({ message: "Client updated successfully" })
    );
  } catch (error) {
    console.error("Error updating client:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to update client" }, { status: 500 })
    );
  }
}
