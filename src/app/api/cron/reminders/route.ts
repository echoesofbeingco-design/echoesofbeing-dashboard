import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { withSecurityHeaders } from "@/lib/auth";
import { sendTelegramMessage, isTelegramConfigured } from "@/lib/telegram";
import {
  addDays,
  formatDateInZone,
  formatTimeInZone,
  zonedToUtcMs,
} from "@/lib/availability";

export const dynamic = "force-dynamic";

const TZ = "Asia/Kolkata";
const RELEASED = new Set(["cancelled", "no_show"]);

/** Telegram HTML parse mode only needs these three escaped. */
function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Daily digest of tomorrow's sessions, sent to the practice.
 *
 * Runs once a day rather than exactly 24h before each session because Vercel's
 * Hobby plan only permits daily cron jobs — and a single morning digest reads
 * better than a trickle of individual pings anyway.
 *
 * Protected by CRON_SECRET. Vercel sends it as `Authorization: Bearer <secret>`;
 * the query-string form is there so you can trigger a run by hand while testing.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return withSecurityHeaders(
      Response.json({ error: "CRON_SECRET is not set" }, { status: 500 })
    );
  }

  const auth = request.headers.get("authorization");
  const fromQuery = new URL(request.url).searchParams.get("secret");
  if (auth !== `Bearer ${secret}` && fromQuery !== secret) {
    return withSecurityHeaders(
      Response.json({ error: "Unauthorized" }, { status: 401 })
    );
  }

  if (!isTelegramConfigured()) {
    return withSecurityHeaders(
      Response.json({ skipped: "Telegram is not configured" })
    );
  }

  try {
    // "Tomorrow" in the practice's timezone, as a UTC millisecond window.
    // addDays/zonedToUtcMs are the same helpers the slot engine uses, so this
    // handles month and year rollovers rather than assuming a fixed offset.
    const tomorrowStr = addDays(formatDateInZone(Date.now(), TZ), 1);
    const [y, m, d] = tomorrowStr.split("-").map(Number);
    const startOfTomorrow = zonedToUtcMs(y, m, d, 0, 0, TZ);
    const endOfTomorrow = startOfTomorrow + 24 * 3600 * 1000;

    const snap = await getAdminDb()
      .collection("bookings")
      .where("slot.startMs", ">=", startOfTomorrow)
      .where("slot.startMs", "<", endOfTomorrow)
      .select("name", "sessionType", "status", "slot")
      .get();

    const sessions = snap.docs
      .map((doc) => doc.data() as {
        name?: string;
        sessionType?: string;
        status?: string;
        slot?: { startMs?: number; timezone?: string };
      })
      .filter((b) => !RELEASED.has(b.status ?? ""))
      .filter((b) => typeof b.slot?.startMs === "number")
      .sort((a, b) => (a.slot!.startMs as number) - (b.slot!.startMs as number));

    if (sessions.length === 0) {
      return withSecurityHeaders(Response.json({ sent: false, sessions: 0 }));
    }

    const dayLabel = tomorrowStr;
    const lines = [
      `<b>⏰ Tomorrow's sessions</b>`,
      `${esc(dayLabel)} — ${sessions.length} session${
        sessions.length === 1 ? "" : "s"
      }`,
      "",
      ...sessions.map((s) => {
        const time = formatTimeInZone(s.slot!.startMs as number, s.slot?.timezone ?? TZ);
        return `<b>${esc(time)}</b> — ${esc(s.name ?? "Unknown")} (${esc(
          s.sessionType ?? "Session"
        )})`;
      }),
    ];

    const { ok, errors } = await sendTelegramMessage(lines.join("\n"));
    if (!ok) console.error("cron/reminders: telegram failed", errors.join("; "));

    return withSecurityHeaders(
      Response.json({ sent: ok, sessions: sessions.length, errors })
    );
  } catch (error) {
    console.error("cron/reminders failed:", error);
    return withSecurityHeaders(
      Response.json({ error: "Reminder job failed" }, { status: 500 })
    );
  }
}
