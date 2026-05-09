import { NextRequest } from "next/server";
import { requireAuth, withSecurityHeaders } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;

  return withSecurityHeaders(
    Response.json({
      username: auth.payload.username,
      role: auth.payload.role,
    })
  );
}
