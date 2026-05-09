import { NextRequest } from "next/server";
import { requireAuth, sanitizeId, withSecurityHeaders } from "@/lib/auth";
import { addBookingNote } from "@/lib/bookings";

export const dynamic = "force-dynamic";

const MAX_NOTE_LENGTH = 2000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require admin role for adding notes
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

    const { note } = body as Record<string, unknown>;

    if (!note || typeof note !== "string") {
      return withSecurityHeaders(
        Response.json({ error: "Note is required" }, { status: 400 })
      );
    }

    const trimmedNote = note.trim();
    if (trimmedNote.length === 0) {
      return withSecurityHeaders(
        Response.json({ error: "Note cannot be empty" }, { status: 400 })
      );
    }

    if (trimmedNote.length > MAX_NOTE_LENGTH) {
      return withSecurityHeaders(
        Response.json(
          { error: `Note must be under ${MAX_NOTE_LENGTH} characters` },
          { status: 400 }
        )
      );
    }

    await addBookingNote(id, trimmedNote, auth.payload.username);
    return withSecurityHeaders(Response.json({ success: true }));
  } catch (error) {
    console.error("Error adding note:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to add note" }, { status: 500 })
    );
  }
}
