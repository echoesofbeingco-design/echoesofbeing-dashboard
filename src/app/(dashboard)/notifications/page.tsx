"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface ActivityEntry {
  id: string;
  type: string;
  message: string;
  actor: string;
  source: "website" | "dashboard";
  bookingId: string | null;
  read: boolean;
  createdAt: string;
}

const PAGE_SIZE = 25;

const TYPE_LABELS: Record<string, string> = {
  booking_created: "Booking",
  booking_cancelled: "Cancellation",
  booking_status_changed: "Status",
  booking_deleted: "Deleted",
  client_created: "Client",
  client_deleted: "Client",
  account_deleted: "Account",
  settings_updated: "Settings",
  google_connected: "Google",
  google_disconnected: "Google",
};

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export default function NotificationsPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/activity?page=${p}&pageSize=${PAGE_SIZE}`);
      if (!res.ok) return;
      const data = await res.json();
      setEntries(data.entries ?? []);
      setUnread(data.unread ?? 0);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page);
  }, [load, page]);

  async function markRead() {
    setMarking(true);
    try {
      await fetch("/api/activity", { method: "POST" });
      await load(page);
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-medium">
            Notifications
          </h1>
          <p className="text-muted text-sm mt-1">
            {total} event{total === 1 ? "" : "s"}
            {unread > 0 ? ` · ${unread} unread` : ""}
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={markRead}
            disabled={marking}
            className="inline-flex items-center gap-2 bg-forest text-cream px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-sage-700 transition-colors self-start disabled:opacity-50"
          >
            {marking ? "Marking…" : "Mark all read"}
          </button>
        )}
      </div>

      <div className="border border-border rounded-xl bg-cream-light overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3 animate-pulse">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-accent-bg rounded" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-muted">
              Nothing yet. Bookings, cancellations and changes will appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((e) => {
              const body = (
                <div
                  className={`flex flex-wrap items-start gap-x-4 gap-y-1 px-5 py-4 transition-colors ${
                    e.bookingId ? "hover:bg-accent-bg/50" : ""
                  } ${!e.read ? "bg-secondary-bg/40" : ""}`}
                >
                  <span className="flex items-center gap-2 min-w-0 flex-1">
                    {!e.read && (
                      <span
                        className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"
                        aria-label="Unread"
                      />
                    )}
                    <span className="text-sm">{e.message}</span>
                  </span>
                  <span className="text-xs text-muted whitespace-nowrap">
                    {TYPE_LABELS[e.type] ?? "Event"} · {e.actor} ·{" "}
                    {e.source} · {formatWhen(e.createdAt)}
                  </span>
                </div>
              );
              return (
                <li key={e.id}>
                  {e.bookingId ? (
                    <Link href={`/bookings/${e.bookingId}`}>{body}</Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-4 mt-6">
          <p className="text-sm text-muted">
            Showing {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent-bg transition-colors disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-muted px-2">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent-bg transition-colors disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
