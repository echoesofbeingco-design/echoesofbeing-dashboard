import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAuth, withSecurityHeaders, sanitizeId } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/users/[id]/password — Reset a user's password (admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request, "admin");
  if ("error" in auth) return auth.error;

  try {
    const { id: rawId } = await params;
    const username = sanitizeId(rawId);

    if (!username) {
      return withSecurityHeaders(
        Response.json({ error: "Invalid username" }, { status: 400 })
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

    const { password } = body as Record<string, unknown>;

    if (!password || typeof password !== "string") {
      return withSecurityHeaders(
        Response.json({ error: "New password is required" }, { status: 400 })
      );
    }

    if (password.length < 8) {
      return withSecurityHeaders(
        Response.json(
          { error: "Password must be at least 8 characters" },
          { status: 400 }
        )
      );
    }

    if (password.length > 128) {
      return withSecurityHeaders(
        Response.json({ error: "Password is too long" }, { status: 400 })
      );
    }

    // Check user exists
    const doc = await getAdminDb()
      .collection("admin_users")
      .doc(username)
      .get();

    if (!doc.exists) {
      return withSecurityHeaders(
        Response.json({ error: "User not found" }, { status: 404 })
      );
    }

    // Hash and update
    const passwordHash = await bcrypt.hash(password, 12);

    await getAdminDb()
      .collection("admin_users")
      .doc(username)
      .update({
        passwordHash,
        passwordResetAt: new Date().toISOString(),
        passwordResetBy: auth.payload.username,
      });

    return withSecurityHeaders(Response.json({ success: true }));
  } catch (error) {
    console.error("Reset password error:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to reset password" }, { status: 500 })
    );
  }
}
