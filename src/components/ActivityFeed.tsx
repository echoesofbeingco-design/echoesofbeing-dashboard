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

const ICONS: Record<string, string> = {
  booking_created: "M12 4.5v15m7.5-7.5h-15",
  booking_cancelled: "M6 18L18 6M6 6l12 12",
  booking_status_changed: "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99",
  booking_deleted: "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0",
  client_created: "M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z",
  settings_updated: "M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

export default function ActivityFeed({ limit = 5 }: { limit?: number }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (take: number) => {
      try {
        const res = await fetch(`/api/activity?limit=${take}`);
        if (!res.ok) return;
        const data = await res.json();
        setEntries(data.entries ?? []);
        setUnread(data.unread ?? 0);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load(limit);
  }, [load, limit]);

  async function markRead() {
    await fetch("/api/activity", { method: "POST" });
    await load(limit);
  }

  return (
    <section className="bg-white rounded-2xl border border-border p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-serif text-lg font-medium">Recent activity</h2>
          {unread > 0 && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sage-600 text-cream">
              {unread} new
            </span>
          )}
        </div>
        {unread > 0 && (
          <button
            onClick={markRead}
            className="text-xs text-sage-600 hover:underline"
          >
            Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted">
          Nothing yet. Bookings, cancellations and changes will appear here.
        </p>
      ) : (
        <>
          <ul className="space-y-1">
            {entries.map((e) => {
              const body = (
                <div
                  className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    e.bookingId ? "hover:bg-accent-bg/60" : ""
                  } ${!e.read ? "bg-secondary-bg/40" : ""}`}
                >
                  <span className="mt-0.5 text-sage-600 flex-shrink-0">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.8}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d={ICONS[e.type] ?? ICONS.settings_updated}
                      />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-snug">
                      {e.message}
                    </span>
                    <span className="block text-xs text-muted mt-0.5">
                      {relativeTime(e.createdAt)} · {e.actor} ·{" "}
                      {e.source === "website" ? "website" : "dashboard"}
                    </span>
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

        </>
      )}

      {/* Always offered, so the full history is one click away. */}
      <Link
        href="/notifications"
        className="inline-block mt-4 text-sm text-sage-600 hover:underline"
      >
        View all notifications →
      </Link>
    </section>
  );
}
