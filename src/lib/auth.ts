import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

// ── JWT Secret ──────────────────────────────────────────────────────────────
// MUST be set via env var. If missing, every auth call will fail.
const JWT_SECRET = process.env.JWT_SECRET;

function getSecret(): string {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is not set. Cannot sign or verify tokens.");
  }
  return JWT_SECRET;
}

// ── Types ───────────────────────────────────────────────────────────────────
export interface AdminUser {
  username: string;
  role: "admin" | "viewer";
}

export interface TokenPayload {
  username: string;
  role: "admin" | "viewer";
  iat: number;
  exp: number;
}

// ── Token operations ────────────────────────────────────────────────────────
export function signToken(user: AdminUser): string {
  return jwt.sign(
    { username: user.username, role: user.role },
    getSecret(),
    { algorithm: "HS256", expiresIn: "8h" }
  );
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, getSecret(), {
      algorithms: ["HS256"],
    }) as TokenPayload;
  } catch {
    return null;
  }
}

export const COOKIE_NAME = "admin_session";

// ── Cookie helpers ──────────────────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === "production";

export function makeSessionCookie(token: string): string {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${60 * 60 * 8}`, // 8 hours
  ];
  if (isProduction) parts.push("Secure");
  return parts.join("; ");
}

export function makeClearCookie(): string {
  const parts = [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
  ];
  if (isProduction) parts.push("Secure");
  return parts.join("; ");
}

// ── Security headers ────────────────────────────────────────────────────────
export function withSecurityHeaders(response: Response): Response {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' https://res.cloudinary.com data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self'"
  );
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  return response;
}

// ── Auth guard for API routes ───────────────────────────────────────────────
export function requireAuth(
  request: NextRequest,
  requiredRole?: "admin"
): { payload: TokenPayload } | { error: Response } {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return {
      error: withSecurityHeaders(
        Response.json({ error: "Unauthorized" }, { status: 401 })
      ),
    };
  }

  const payload = verifyToken(token);
  if (!payload) {
    return {
      error: withSecurityHeaders(
        Response.json({ error: "Invalid or expired token" }, { status: 401 })
      ),
    };
  }

  if (requiredRole && payload.role !== requiredRole) {
    return {
      error: withSecurityHeaders(
        Response.json({ error: "Insufficient permissions" }, { status: 403 })
      ),
    };
  }

  return { payload };
}

// ── Rate limiter (in-memory, per-instance) ──────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60 * 1000);

export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= maxAttempts) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  entry.count++;
  return { allowed: true, retryAfterSeconds: 0 };
}

// ── Input validation helpers ────────────────────────────────────────────────
export function sanitizeId(id: string): string | null {
  // Firestore doc IDs: alphanumeric + a few safe chars, max 1500 bytes
  if (!id || typeof id !== "string") return null;
  const trimmed = id.trim();
  if (trimmed.length === 0 || trimmed.length > 200) return null;
  // Allow alphanumeric, hyphens, underscores only
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return null;
  return trimmed;
}
