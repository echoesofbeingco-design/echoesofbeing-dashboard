import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAuth, withSecurityHeaders, sanitizeId } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users — List all admin users (admin only)
 */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, "admin");
  if ("error" in auth) return auth.error;

  try {
    const snapshot = await getAdminDb().collection("admin_users").get();

    const users = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        username: doc.id,
        role: data.role || "viewer",
        createdAt: data.createdAt || null,
        lastLogin: data.lastLogin || null,
      };
    });

    return withSecurityHeaders(Response.json({ users }));
  } catch (error) {
    console.error("List users error:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to fetch users" }, { status: 500 })
    );
  }
}

/**
 * POST /api/admin/users — Create a new admin user (admin only)
 */
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, "admin");
  if ("error" in auth) return auth.error;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return withSecurityHeaders(
        Response.json({ error: "Invalid request body" }, { status: 400 })
      );
    }

    const { username, password, role } = body as Record<string, unknown>;

    // ── Validate username ────────────────────────────────────────────────
    if (!username || typeof username !== "string") {
      return withSecurityHeaders(
        Response.json({ error: "Username is required" }, { status: 400 })
      );
    }

    const cleanUsername = username.trim().toLowerCase().slice(0, 50);
    if (cleanUsername.length < 2 || !/^[a-z0-9_.-]+$/.test(cleanUsername)) {
      return withSecurityHeaders(
        Response.json(
          { error: "Username must be 2-50 characters (letters, numbers, _ . -)" },
          { status: 400 }
        )
      );
    }

    // Ensure sanitizeId also passes
    if (!sanitizeId(cleanUsername)) {
      return withSecurityHeaders(
        Response.json({ error: "Invalid username format" }, { status: 400 })
      );
    }

    // ── Validate password ────────────────────────────────────────────────
    if (!password || typeof password !== "string") {
      return withSecurityHeaders(
        Response.json({ error: "Password is required" }, { status: 400 })
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

    // ── Validate role ────────────────────────────────────────────────────
    if (role && typeof role === "string" && !["admin", "viewer"].includes(role)) {
      return withSecurityHeaders(
        Response.json(
          { error: "Role must be 'admin' or 'viewer'" },
          { status: 400 }
        )
      );
    }

    const userRole = (role as "admin" | "viewer") || "viewer";

    // ── Check if user already exists ─────────────────────────────────────
    const existingDoc = await getAdminDb()
      .collection("admin_users")
      .doc(cleanUsername)
      .get();

    if (existingDoc.exists) {
      return withSecurityHeaders(
        Response.json({ error: "Username already exists" }, { status: 409 })
      );
    }

    // ── Create user ──────────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash(password, 12);

    await getAdminDb()
      .collection("admin_users")
      .doc(cleanUsername)
      .set({
        passwordHash,
        role: userRole,
        createdAt: new Date().toISOString(),
        createdBy: auth.payload.username,
      });

    return withSecurityHeaders(
      Response.json({
        success: true,
        user: {
          username: cleanUsername,
          role: userRole,
        },
      })
    );
  } catch (error) {
    console.error("Create user error:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to create user" }, { status: 500 })
    );
  }
}

/**
 * DELETE /api/admin/users — Delete an admin user (admin only)
 * Body: { username: string }
 */
export async function DELETE(request: NextRequest) {
  const auth = requireAuth(request, "admin");
  if ("error" in auth) return auth.error;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return withSecurityHeaders(
        Response.json({ error: "Invalid request body" }, { status: 400 })
      );
    }

    const { username } = body as Record<string, unknown>;

    if (!username || typeof username !== "string") {
      return withSecurityHeaders(
        Response.json({ error: "Username is required" }, { status: 400 })
      );
    }

    const cleanUsername = username.trim().toLowerCase();

    if (!sanitizeId(cleanUsername)) {
      return withSecurityHeaders(
        Response.json({ error: "Invalid username" }, { status: 400 })
      );
    }

    // Prevent self-deletion
    if (cleanUsername === auth.payload.username) {
      return withSecurityHeaders(
        Response.json({ error: "You cannot delete your own account" }, { status: 400 })
      );
    }

    const doc = await getAdminDb()
      .collection("admin_users")
      .doc(cleanUsername)
      .get();

    if (!doc.exists) {
      return withSecurityHeaders(
        Response.json({ error: "User not found" }, { status: 404 })
      );
    }

    await getAdminDb().collection("admin_users").doc(cleanUsername).delete();

    return withSecurityHeaders(Response.json({ success: true }));
  } catch (error) {
    console.error("Delete user error:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to delete user" }, { status: 500 })
    );
  }
}
