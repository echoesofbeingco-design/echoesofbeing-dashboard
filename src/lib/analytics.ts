import { getAdminDb } from "@/lib/firebase-admin";

/**
 * Reads the first-party analytics the website writes.
 *
 * Events are stored raw (one document per pageview or action) and aggregated
 * here on read. At a practice's traffic level that is a few thousand documents
 * a month, which Firestore handles trivially, and keeping the raw rows means
 * new questions can be answered later without having decided the shape up
 * front. If volume ever makes this expensive, roll days up into summary docs.
 */

export interface AnalyticsEvent {
  day: string;
  ts: number;
  type: "pageview" | "event";
  name: string | null;
  path: string;
  referrer: string;
  device: "mobile" | "tablet" | "desktop";
  visitor: string;
}

export interface Counted {
  key: string;
  count: number;
}

export interface AnalyticsSummary {
  from: string;
  to: string;
  pageviews: number;
  visitors: number;
  /** Visitors who looked at exactly one page and left. */
  bounceRate: number;
  topPages: Counted[];
  blogPosts: Counted[];
  servicePages: Counted[];
  referrers: Counted[];
  devices: Counted[];
  daily: Array<{ day: string; pageviews: number; visitors: number }>;
  funnel: {
    visitors: number;
    reachedBooking: number;
    pickedType: number;
    pickedSlot: number;
    completed: number;
  };
}

function tally(values: string[]): Counted[] {
  const m = new Map<string, number>();
  values.forEach((v) => m.set(v, (m.get(v) ?? 0) + 1));
  return [...m.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

/** "YYYY-MM-DD" in the practice's timezone. */
export function dayKey(ms: number = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

export function daysAgo(n: number): string {
  return dayKey(Date.now() - n * 24 * 60 * 60 * 1000);
}

export async function getAnalytics(
  from: string,
  to: string
): Promise<AnalyticsSummary> {
  const snap = await getAdminDb()
    .collection("analytics_events")
    .where("day", ">=", from)
    .where("day", "<=", to)
    .get();

  const events = snap.docs.map((d) => d.data() as AnalyticsEvent);
  const pageviews = events.filter((e) => e.type === "pageview");
  const actions = events.filter((e) => e.type === "event");

  const uniqueVisitors = new Set(events.map((e) => e.visitor));

  // Bounce: visitors whose entire day was a single pageview.
  const viewsPerVisitor = new Map<string, number>();
  pageviews.forEach((e) =>
    viewsPerVisitor.set(e.visitor, (viewsPerVisitor.get(e.visitor) ?? 0) + 1)
  );
  const singles = [...viewsPerVisitor.values()].filter((n) => n === 1).length;
  const bounceRate =
    viewsPerVisitor.size === 0
      ? 0
      : Math.round((singles / viewsPerVisitor.size) * 100);

  // Per-day series, with every day in range present so charts don't skip gaps.
  const byDay = new Map<string, { views: number; visitors: Set<string> }>();
  for (
    let t = new Date(`${from}T00:00:00Z`).getTime();
    t <= new Date(`${to}T00:00:00Z`).getTime();
    t += 86_400_000
  ) {
    byDay.set(new Date(t).toISOString().slice(0, 10), {
      views: 0,
      visitors: new Set(),
    });
  }
  pageviews.forEach((e) => {
    const slot = byDay.get(e.day);
    if (slot) {
      slot.views++;
      slot.visitors.add(e.visitor);
    }
  });

  const uniqueBy = (name: string) =>
    new Set(actions.filter((e) => e.name === name).map((e) => e.visitor)).size;

  return {
    from,
    to,
    pageviews: pageviews.length,
    visitors: uniqueVisitors.size,
    bounceRate,
    topPages: tally(pageviews.map((e) => e.path)).slice(0, 15),
    blogPosts: tally(
      pageviews
        .filter((e) => e.path.startsWith("/echoes/"))
        .map((e) => e.path.replace("/echoes/", ""))
    ).slice(0, 15),
    servicePages: tally(
      pageviews
        .filter((e) => e.path.startsWith("/services/"))
        .map((e) => e.path.replace("/services/", ""))
    ).slice(0, 15),
    referrers: tally(pageviews.map((e) => e.referrer)).slice(0, 12),
    devices: tally(pageviews.map((e) => e.device)),
    daily: [...byDay.entries()].map(([day, v]) => ({
      day,
      pageviews: v.views,
      visitors: v.visitors.size,
    })),
    funnel: {
      visitors: uniqueVisitors.size,
      reachedBooking: uniqueBy("book_viewed"),
      pickedType: uniqueBy("book_type_selected"),
      pickedSlot: uniqueBy("book_slot_selected"),
      completed: uniqueBy("book_completed"),
    },
  };
}
