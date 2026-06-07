import { NextRequest } from "next/server";
import { requireAuth, sanitizeId, withSecurityHeaders } from "@/lib/auth";
import { getClientById, getClientSessions, createSession } from "@/lib/clients";

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

    const sessions = await getClientSessions(id);
    return withSecurityHeaders(Response.json({ sessions }));
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to fetch sessions" }, { status: 500 })
    );
  }
}

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

    const body = await request.json();

    if (!body.date) {
      return withSecurityHeaders(
        Response.json({ error: "Session date is required" }, { status: 400 })
      );
    }

    // Auto-determine session number
    const existingSessions = await getClientSessions(id);
    const sessionNumber = body.sessionNumber || existingSessions.length + 1;

    const sessionId = await createSession(id, {
      date: body.date,
      sessionNumber,
      summary: body.summary || "",
      presentingProblem: body.presentingProblem || "",
    });

    return withSecurityHeaders(
      Response.json(
        { id: sessionId, message: "Session created successfully" },
        { status: 201 }
      )
    );
  } catch (error) {
    console.error("Error creating session:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to create session" }, { status: 500 })
    );
  }
}
