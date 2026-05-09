import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  signToken,
  makeSessionCookie,
  withSecurityHeaders,
  checkRateLimit,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // ── Rate limiting by IP ──────────────────────────────────────────────
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const { allowed, retryAfterSeconds } = checkRateLimit(
      `login:${ip}`,
      5, // max 5 attempts
      15 * 60 * 1000 // per 15-minute window
    );

    if (!allowed) {
      return withSecurityHeaders(
        Response.json(
          { error: `Too many login attempts. Try again in ${retryAfterSeconds} seconds.` },
          { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
        )
      );
    }

    // ── Parse & validate input ───────────────────────────────────────────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return withSecurityHeaders(
        Response.json({ error: "Invalid request body" }, { status: 400 })
      );
    }

    const { username, password } = body as Record<string, unknown>;

    if (
      !username ||
      !password ||
      typeof username !== "string" ||
      typeof password !== "string"
    ) {
      return withSecurityHeaders(
        Response.json(
          { error: "Username and password are required" },
          { status: 400 }
        )
      );
    }

    // Sanitize: limit length, strip anything dangerous
    const cleanUsername = username.trim().toLowerCase().slice(0, 50);
    if (cleanUsername.length < 2 || !/^[a-z0-9_.-]+$/.test(cleanUsername)) {
      return withSecurityHeaders(
        Response.json({ error: "Invalid credentials" }, { status: 401 })
      );
    }

    if (password.length > 128) {
      return withSecurityHeaders(
        Response.json({ error: "Invalid credentials" }, { status: 401 })
      );
    }

    // ── Look up admin user in Firestore ──────────────────────────────────
    const userDoc = await getAdminDb()
      .collection("admin_users")
      .doc(cleanUsername)
      .get();

    if (!userDoc.exists) {
      // Constant-time: still hash something to prevent timing attacks
      await bcrypt.hash("dummy-password-timing-defense", 12);
      return withSecurityHeaders(
        Response.json({ error: "Invalid credentials" }, { status: 401 })
      );
    }

    const userData = userDoc.data()!;
    const passwordHash = userData.passwordHash as string | undefined;

    if (!passwordHash) {
      return withSecurityHeaders(
        Response.json({ error: "Invalid credentials" }, { status: 401 })
      );
    }

    const passwordMatch = await bcrypt.compare(password, passwordHash);

    if (!passwordMatch) {
      return withSecurityHeaders(
        Response.json({ error: "Invalid credentials" }, { status: 401 })
      );
    }

    // ── Success: generate JWT & set cookie ───────────────────────────────
    const role = (userData.role as "admin" | "viewer") || "admin";
    const token = signToken({ username: cleanUsername, role });

    // Update last login (fire-and-forget, don't block response)
    getAdminDb()
      .collection("admin_users")
      .doc(cleanUsername)
      .update({ lastLogin: new Date().toISOString() })
      .catch(() => {});

    const response = Response.json({ success: true });
    response.headers.set("Set-Cookie", makeSessionCookie(token));
    return withSecurityHeaders(response);
  } catch (error) {
    console.error("Login error:", error);
    return withSecurityHeaders(
      Response.json({ error: "Internal server error" }, { status: 500 })
    );
  }
}
