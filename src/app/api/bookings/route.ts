import { NextRequest } from "next/server";
import { requireAuth, withSecurityHeaders } from "@/lib/auth";
import { getAllBookings } from "@/lib/bookings";
import type { Booking } from "@/lib/booking-types";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function matchesQuery(booking: Booking, q: string): boolean {
  if (!q) return true;
  const haystack = [
    booking.name,
    booking.email,
    booking.whatsapp,
    booking.concern,
    booking.category,
    booking.sessionType,
    booking.id,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

/**
 * GET /api/bookings
 *   ?page=1&pageSize=20     paginated (default)
 *   &status=&category=&sessionType=&q=
 *   &scope=today            only sessions scheduled today
 *   &all=true               legacy: return everything, unpaginated
 *
 * Previously this returned every booking — including clinical notes — to the
 * browser in one payload. It now pages by default.
 */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all") === "true";
    const scope = searchParams.get("scope") ?? "";
    const status = searchParams.get("status") ?? "";
    const category = searchParams.get("category") ?? "";
    const sessionType = searchParams.get("sessionType") ?? "";
    const q = (searchParams.get("q") ?? "").trim().toLowerCase();

    const page = Math.max(Number(searchParams.get("page") ?? 1) || 1, 1);
    const pageSize = Math.min(
      Math.max(Number(searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE
    );

    let bookings = await getAllBookings();

    // "Today" is judged in the practice's timezone, not the server's.
    if (scope === "today") {
      const todayIST = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      bookings = bookings.filter((b) => {
        const startISO = b.slot?.startISO;
        if (!startISO) return false;
        const day = new Intl.DateTimeFormat("en-CA", {
          timeZone: b.slot?.timezone || "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(startISO));
        return day === todayIST && b.status !== "cancelled";
      });

      // Chronological for a schedule view, rather than newest-created first.
      bookings.sort(
        (a, b) => (a.slot?.startMs ?? 0) - (b.slot?.startMs ?? 0)
      );
    }

    if (status) bookings = bookings.filter((b) => b.status === status);
    if (category) bookings = bookings.filter((b) => b.category === category);
    if (sessionType)
      bookings = bookings.filter((b) => b.sessionType === sessionType);
    if (q) bookings = bookings.filter((b) => matchesQuery(b, q));

    const total = bookings.length;

    if (all) {
      return withSecurityHeaders(Response.json({ bookings, total }));
    }

    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;

    return withSecurityHeaders(
      Response.json({
        bookings: bookings.slice(start, start + pageSize),
        total,
        page: safePage,
        pageSize,
        totalPages,
      })
    );
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to fetch bookings" }, { status: 500 })
    );
  }
}
