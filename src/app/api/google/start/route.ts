import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { requireAuth } from "@/lib/auth";
import { buildConsentUrl, isGoogleConfigured } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

export const STATE_COOKIE = "google_oauth_state";

/**
 * GET /api/google/start — begin the one-time Google Calendar connection.
 * Admin only. Issues a signed, short-lived state that the callback verifies.
 */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, "admin");
  if ("error" in auth) return auth.error;

  if (!isGoogleConfigured()) {
    return NextResponse.json(
      {
        error:
          "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set in this environment.",
      },
      { status: 500 }
    );
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "JWT_SECRET is not configured." },
      { status: 500 }
    );
  }

  const state = jwt.sign(
    { username: auth.payload.username, nonce: randomUUID() },
    secret,
    { algorithm: "HS256", expiresIn: "10m" }
  );

  const consentUrl = buildConsentUrl(state);
  if (!consentUrl) {
    return NextResponse.json(
      { error: "Could not build the Google consent URL." },
      { status: 500 }
    );
  }

  const response = NextResponse.redirect(consentUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    // Lax (not Strict) so the cookie survives Google's cross-site redirect back.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return response;
}
