import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withSecurityHeaders } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { zonedToUtcMs, formatDateInZone, formatTimeInZone } from "@/lib/availability";

export const dynamic = "force-dynamic";

const TZ = "Asia/Kolkata";

export interface CalendarSession {
  id: string;
  name: string;
  sessionType: string;
  status: string;
  date: string; // YYYY-MM-DD in practice timezone
  time: string; // HH:mm
  startMs: number;
  meetLink: string | null;
}

/**
 * GET /api/bookings/calendar?month=2026-07
 *
 * Scheduled sessions for one month, keyed by day, for the dashboard calendar.
 * Deliberately lean — no clinical notes, just what the calendar needs to draw.
 */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") ?? "";
    const m = /^(\d{4})-(\d{2})$/.exec(month);

    const now = new Date();
    const year = m ? Number(m[1]) : now.getUTCFullYear();
    const monthNum = m ? Number(m[2]) : now.getUTCMonth() + 1;

    // Whole month in the practice timezone.
    const startMs = zonedToUtcMs(year, monthNum, 1, 0, 0, TZ);
    const nextMonth = monthNum === 12 ? 1 : monthNum + 1;
    const nextYear = monthNum === 12 ? year + 1 : year;
    const endMs = zonedToUtcMs(nextYear, nextMonth, 1, 0, 0, TZ);

    const snap = await getAdminDb()
      .collection("bookings")
      .where("slot.startMs", ">=", startMs)
      .where("slot.startMs", "<", endMs)
      .get();

    const sessions: CalendarSession[] = [];
    for (const doc of snap.docs) {
      const b = doc.data() as {
        name?: string;
        sessionType?: string;
        status?: string;
        slot?: { startMs?: number; startISO?: string; timezone?: string };
        googleEvent?: { meetLink?: string };
      };
      if (b.status === "cancelled") continue;
      const ms = b.slot?.startMs;
      if (typeof ms !== "number") continue;

      const tz = b.slot?.timezone || TZ;
      sessions.push({
        id: doc.id,
        name: b.name ?? "",
        sessionType: b.sessionType ?? "",
        status: b.status ?? "",
        date: formatDateInZone(ms, tz),
        time: formatTimeInZone(ms, tz),
        startMs: ms,
        meetLink: b.googleEvent?.meetLink ?? null,
      });
    }

    sessions.sort((a, b) => a.startMs - b.startMs);

    const counts: Record<string, number> = {};
    for (const s of sessions) counts[s.date] = (counts[s.date] ?? 0) + 1;

    return withSecurityHeaders(
      NextResponse.json({
        month: `${year}-${String(monthNum).padStart(2, "0")}`,
        today: formatDateInZone(Date.now(), TZ),
        timezone: TZ,
        counts,
        sessions,
      })
    );
  } catch (error) {
    console.error("Error loading calendar:", error);
    return withSecurityHeaders(
      NextResponse.json({ error: "Failed to load calendar" }, { status: 500 })
    );
  }
}
