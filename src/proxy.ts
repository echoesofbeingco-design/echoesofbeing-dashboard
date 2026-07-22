import { NextRequest, NextResponse } from "next/server";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Public paths that don't need auth.
  // The Google OAuth callback is reached via a cross-site redirect from
  // Google, so the SameSite=Strict session cookie is NOT sent with it. It
  // authenticates itself with a signed, single-use state cookie instead.
  // Cron jobs are invoked by Vercel with no session cookie, so they cannot pass
  // the check below. They authenticate themselves against CRON_SECRET instead —
  // see /api/cron/reminders, which rejects anything without the right Bearer.
  if (
    pathname === "/login" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/google/callback" ||
    pathname.startsWith("/api/cron/")
  ) {
    // Add security headers to public pages too
    const response = NextResponse.next();
    addSecurityHeaders(response);
    return response;
  }

  // Everything else requires a valid token
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    // API routes get 401; pages get redirected
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Actually verify the JWT (not just check presence)
  const payload = verifyToken(token);
  if (!payload) {
    // Token is invalid or expired — clear the bad cookie
    if (pathname.startsWith("/api/")) {
      const res = NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
      res.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
      addSecurityHeaders(res);
      return res;
    }
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
    return res;
  }

  // Token is valid — pass user info in request headers for API routes
  const response = NextResponse.next();
  response.headers.set("x-admin-user", payload.username);
  response.headers.set("x-admin-role", payload.role);
  addSecurityHeaders(response);
  return response;
}

function addSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
