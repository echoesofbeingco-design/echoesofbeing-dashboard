import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withSecurityHeaders } from "@/lib/auth";
import {
  getActivityPage,
  getRecentActivity,
  getUnreadCount,
  markAllRead,
} from "@/lib/activity";

export const dynamic = "force-dynamic";

/** GET /api/activity?limit=8 — recent activity plus the unread count. */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get("page");

    // Paged mode for the notifications screen.
    if (pageParam) {
      const page = Math.max(Number(pageParam) || 1, 1);
      const pageSize = Math.min(
        Math.max(Number(searchParams.get("pageSize") ?? 25) || 25, 1),
        100
      );
      const [result, unread] = await Promise.all([
        getActivityPage(page, pageSize),
        getUnreadCount(),
      ]);
      return withSecurityHeaders(
        NextResponse.json({ ...result, page, pageSize, unread })
      );
    }

    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") ?? 20) || 20, 1),
      200
    );

    const [entries, unread] = await Promise.all([
      getRecentActivity(limit),
      getUnreadCount(),
    ]);

    return withSecurityHeaders(NextResponse.json({ entries, unread }));
  } catch (error) {
    console.error("Error loading activity:", error);
    return withSecurityHeaders(
      NextResponse.json({ error: "Failed to load activity" }, { status: 500 })
    );
  }
}

/** POST — mark everything as read. */
export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;

  try {
    const marked = await markAllRead();
    return withSecurityHeaders(NextResponse.json({ success: true, marked }));
  } catch (error) {
    console.error("Error marking activity read:", error);
    return withSecurityHeaders(
      NextResponse.json({ error: "Failed to update" }, { status: 500 })
    );
  }
}
