import { NextRequest } from "next/server";
import { requireAuth, sanitizeId, withSecurityHeaders } from "@/lib/auth";
import { getSessionById, updateSession, deleteSession } from "@/lib/clients";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;

  try {
    const { id: rawId, sessionId: rawSessionId } = await params;
    const id = sanitizeId(rawId);
    const sessionId = sanitizeId(rawSessionId);
    if (!id || !sessionId) {
      return withSecurityHeaders(
        Response.json({ error: "Invalid IDs" }, { status: 400 })
      );
    }

    const session = await getSessionById(id, sessionId);
    if (!session) {
      return withSecurityHeaders(
        Response.json({ error: "Session not found" }, { status: 404 })
      );
    }

    return withSecurityHeaders(Response.json({ session }));
  } catch (error) {
    console.error("Error fetching session:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to fetch session" }, { status: 500 })
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;

  try {
    const { id: rawId, sessionId: rawSessionId } = await params;
    const id = sanitizeId(rawId);
    const sessionId = sanitizeId(rawSessionId);
    if (!id || !sessionId) {
      return withSecurityHeaders(
        Response.json({ error: "Invalid IDs" }, { status: 400 })
      );
    }

    const session = await getSessionById(id, sessionId);
    if (!session) {
      return withSecurityHeaders(
        Response.json({ error: "Session not found" }, { status: 404 })
      );
    }

    const body = await request.json();

    // Allow all session fields to be updated
    const allowedFields = [
      "date", "sessionNumber", "summary", "presentingProblem",
      "nextSession", "clientHomework", "therapistHomework",
      "symptoms", "concerns", "stressors",
      "interpersonalHistory", "keyThemes", "theoreticalLens",
      "treatmentFocus",
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

    await updateSession(id, sessionId, updates);
    return withSecurityHeaders(
      Response.json({ message: "Session updated successfully" })
    );
  } catch (error) {
    console.error("Error updating session:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to update session" }, { status: 500 })
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;

  try {
    const { id: rawId, sessionId: rawSessionId } = await params;
    const id = sanitizeId(rawId);
    const sessionId = sanitizeId(rawSessionId);
    if (!id || !sessionId) {
      return withSecurityHeaders(
        Response.json({ error: "Invalid IDs" }, { status: 400 })
      );
    }

    await deleteSession(id, sessionId);
    return withSecurityHeaders(
      Response.json({ message: "Session deleted successfully" })
    );
  } catch (error) {
    console.error("Error deleting session:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to delete session" }, { status: 500 })
    );
  }
}
