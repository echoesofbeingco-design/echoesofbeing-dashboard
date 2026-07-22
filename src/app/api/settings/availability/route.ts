import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withSecurityHeaders } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { logActivity } from "@/lib/activity";
import {
  normalizeConfig,
  type AvailabilityConfig,
} from "@/lib/availability";

export const dynamic = "force-dynamic";

const CONFIG_COLLECTION = "config";
const AVAILABILITY_DOC = "availability";

/** GET — current availability config (falls back to documented defaults). */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;

  const snap = await getAdminDb()
    .collection(CONFIG_COLLECTION)
    .doc(AVAILABILITY_DOC)
    .get();

  const config = normalizeConfig(
    snap.exists ? (snap.data() as Partial<AvailabilityConfig>) : null
  );

  return withSecurityHeaders(NextResponse.json({ config }));
}

const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** PUT — replace the availability config. Admin only. */
export async function PUT(request: NextRequest) {
  const auth = requireAuth(request, "admin");
  if ("error" in auth) return auth.error;

  let body: Partial<AvailabilityConfig>;
  try {
    body = (await request.json()) as Partial<AvailabilityConfig>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const config = normalizeConfig(body);

  // ---- validation: bad config here would break booking for everyone ----
  for (const [day, windows] of Object.entries(config.weeklyHours)) {
    if (!/^[0-6]$/.test(day) || !Array.isArray(windows)) {
      return NextResponse.json(
        { error: "Invalid weekly hours." },
        { status: 400 }
      );
    }
    for (const w of windows) {
      if (!HHMM.test(w.start) || !HHMM.test(w.end)) {
        return NextResponse.json(
          { error: `Invalid time in day ${day}. Use HH:mm.` },
          { status: 400 }
        );
      }
      if (w.start >= w.end) {
        return NextResponse.json(
          { error: `A day's start time must be before its end time.` },
          { status: 400 }
        );
      }
    }
  }

  if (config.bufferMin < 0 || config.bufferMin > 480) {
    return NextResponse.json(
      { error: "Gap between sessions must be between 0 and 480 minutes." },
      { status: 400 }
    );
  }
  if (config.minNoticeHours < 0 || config.minNoticeHours > 720) {
    return NextResponse.json(
      { error: "Advance notice must be between 0 and 720 hours." },
      { status: 400 }
    );
  }
  if (config.maxAdvanceDays < 1 || config.maxAdvanceDays > 365) {
    return NextResponse.json(
      { error: "Booking window must be between 1 and 365 days." },
      { status: 400 }
    );
  }
  if (config.slotGranularityMin < 5 || config.slotGranularityMin > 120) {
    return NextResponse.json(
      { error: "Slot interval must be between 5 and 120 minutes." },
      { status: 400 }
    );
  }
  for (const d of config.blackoutDates) {
    if (!DATE.test(d)) {
      return NextResponse.json(
        { error: `Invalid blackout date "${d}". Use YYYY-MM-DD.` },
        { status: 400 }
      );
    }
  }
  for (const s of config.sessionTypes) {
    if (!s.id || !s.label) {
      return NextResponse.json(
        { error: "Every session type needs an id and a label." },
        { status: 400 }
      );
    }
    if (s.durationMin < 5 || s.durationMin > 480) {
      return NextResponse.json(
        { error: `"${s.label}" must be between 5 and 480 minutes.` },
        { status: 400 }
      );
    }
    if (s.price < 0) {
      return NextResponse.json(
        { error: `"${s.label}" cannot have a negative price.` },
        { status: 400 }
      );
    }
  }
  if (!config.sessionTypes.some((s) => s.enabled)) {
    return NextResponse.json(
      { error: "At least one session type must stay enabled." },
      { status: 400 }
    );
  }

  await getAdminDb()
    .collection(CONFIG_COLLECTION)
    .doc(AVAILABILITY_DOC)
    .set(
      {
        ...config,
        updatedAt: new Date().toISOString(),
        updatedBy: auth.payload.username,
      },
      { merge: true }
    );

  await logActivity({
    type: "settings_updated",
    message: "Availability settings updated",
    actor: auth.payload.username,
    source: "dashboard",
  });

  return withSecurityHeaders(NextResponse.json({ success: true, config }));
}
