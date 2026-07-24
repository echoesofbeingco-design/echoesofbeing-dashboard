import { NextRequest } from "next/server";
import { requireAuth, withSecurityHeaders } from "@/lib/auth";
import { dayKey, daysAgo, getAnalytics } from "@/lib/analytics";

export const dynamic = "force-dynamic";

const ALLOWED_RANGES = [7, 30, 90] as const;

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const requested = Number(searchParams.get("days") ?? 30);
    const days = (ALLOWED_RANGES as readonly number[]).includes(requested)
      ? requested
      : 30;

    const summary = await getAnalytics(daysAgo(days - 1), dayKey());
    return withSecurityHeaders(Response.json({ summary, days }));
  } catch (error) {
    console.error("Error building analytics:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to load analytics" }, { status: 500 })
    );
  }
}
