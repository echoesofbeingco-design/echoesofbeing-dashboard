import { makeClearCookie, withSecurityHeaders } from "@/lib/auth";

export async function POST() {
  const response = Response.json({ success: true });
  response.headers.set("Set-Cookie", makeClearCookie());
  return withSecurityHeaders(response);
}
