import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import {
  exchangeCodeForTokens,
  fetchAccountEmail,
  saveConnection,
} from "@/lib/google-calendar";
import { STATE_COOKIE } from "../start/route";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Small self-redirecting page. We can't just 302 to /settings: this request
 * arrives via a cross-site redirect from Google, and the SameSite=Strict admin
 * session cookie isn't sent on it (nor on a server redirect that follows it).
 * A client-initiated navigation from this page is same-site, so the session
 * cookie is sent and the settings page loads authenticated.
 */
function resultPage(ok: boolean, message: string): NextResponse {
  const target = ok
    ? "/settings?google=connected"
    : `/settings?google=error&message=${encodeURIComponent(message)}`;

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${ok ? "Connected" : "Connection failed"}</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #faf8f3; color: #2d352d;
             display: flex; align-items: center; justify-content: center;
             height: 100vh; margin: 0; }
      .card { text-align: center; max-width: 30rem; padding: 2rem; }
      a { color: #5c7a5c; }
    </style>
  </head>
  <body>
    <div class="card">
      <p>${ok ? "Google Calendar connected. Returning to settings…" : escapeHtml(message)}</p>
      <p><a href="${target}">Continue</a></p>
    </div>
    <script>window.location.replace(${JSON.stringify(target)});</script>
  </body>
</html>`;

  const response = new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
  // The state cookie is single-use.
  response.cookies.set(STATE_COOKIE, "", { maxAge: 0, path: "/" });
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return resultPage(
      false,
      oauthError === "access_denied"
        ? "Connection cancelled — Google access was not granted."
        : `Google returned an error: ${oauthError}`
    );
  }

  const cookieState = request.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return resultPage(
      false,
      "This connection link is invalid or has expired. Please start again from Settings."
    );
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) return resultPage(false, "JWT_SECRET is not configured.");

  let username = "unknown";
  try {
    const payload = jwt.verify(state, secret, {
      algorithms: ["HS256"],
    }) as { username?: string };
    username = payload.username ?? "unknown";
  } catch {
    return resultPage(
      false,
      "This connection link is invalid or has expired. Please start again from Settings."
    );
  }

  const result = await exchangeCodeForTokens(code);
  if (!result.ok || !result.refreshToken) {
    return resultPage(false, result.error ?? "Could not connect to Google.");
  }

  const email = result.accessToken
    ? await fetchAccountEmail(result.accessToken)
    : undefined;

  await saveConnection({
    connected: true,
    refreshToken: result.refreshToken,
    scope: result.scope,
    email,
    connectedAt: new Date().toISOString(),
    connectedBy: username,
  });

  await logActivity({
    type: "google_connected",
    message: `Google Calendar connected${email ? ` as ${email}` : ""}`,
    actor: username,
    source: "dashboard",
  });

  return resultPage(true, "Connected.");
}
