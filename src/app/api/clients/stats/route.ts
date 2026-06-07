import { NextRequest } from "next/server";
import { requireAuth, withSecurityHeaders } from "@/lib/auth";
import { getClientStats } from "@/lib/clients";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;

  try {
    const stats = await getClientStats();
    return withSecurityHeaders(Response.json({ stats }));
  } catch (error) {
    console.error("Error fetching client stats:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to fetch client stats" }, { status: 500 })
    );
  }
}
