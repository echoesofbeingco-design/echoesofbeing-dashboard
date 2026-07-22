import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withSecurityHeaders } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  addDays,
  formatDateInZone,
  generateSlots,
  normalizeConfig,
  parseDateStr,
  zonedToUtcMs,
  type AvailabilityConfig,
  type BusyInterval,
} from "@/lib/availability";

export const dynamic = "force-dynamic";

const RELEASED = new Set(["cancelled"]);
const EDGE_PAD_MS = 6 * 60 * 60 * 1000;

/**
 * GET /api/bookings/availability?type=individual
 * Open slots for the admin's "book for a client" flow — same engine the public
 * site uses, so the dashboard can never offer a time the website would refuse.
 */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;

  const db = getAdminDb();
  const snap = await db.collection("config").doc("availability").get();
  const config: AvailabilityConfig = normalizeConfig(
    snap.exists ? (snap.data() as Partial<AvailabilityConfig>) : null
  );

  const { searchParams } = new URL(request.url);
  const sessionTypeId = searchParams.get("type") ?? "";
  const tz = config.timezone;
  const nowMs = Date.now();
  const today = formatDateInZone(nowMs, tz);

  const sessionTypes = config.sessionTypes.filter((s) => s.enabled);
  if (!sessionTypeId) {
    return withSecurityHeaders(
      NextResponse.json({ timezone: tz, sessionTypes, days: [] })
    );
  }

  const from = today;
  const to = addDays(from, Math.min(config.maxAdvanceDays, 62));

  const f = parseDateStr(from);
  const t = parseDateStr(to);
  const fromMs = zonedToUtcMs(f.year, f.month, f.day, 0, 0, tz);
  const toMs = zonedToUtcMs(t.year, t.month, t.day, 23, 59, tz);

  const bookings = await db
    .collection("bookings")
    .where("slot.startMs", ">=", fromMs - EDGE_PAD_MS)
    .where("slot.startMs", "<=", toMs + EDGE_PAD_MS)
    .select("status", "slot")
    .get();

  const busy: BusyInterval[] = [];
  for (const doc of bookings.docs) {
    const d = doc.data() as {
      status?: string;
      slot?: { startMs?: number; endMs?: number };
    };
    if (RELEASED.has(d.status ?? "")) continue;
    if (
      typeof d.slot?.startMs === "number" &&
      typeof d.slot?.endMs === "number"
    ) {
      busy.push({ startMs: d.slot.startMs, endMs: d.slot.endMs });
    }
  }

  const days = generateSlots({
    config,
    sessionTypeId,
    fromDate: from,
    toDate: to,
    busy,
    nowMs,
  });

  return withSecurityHeaders(
    NextResponse.json({ timezone: tz, sessionTypes, days })
  );
}
