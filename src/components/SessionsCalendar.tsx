"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface CalendarSession {
  id: string;
  name: string;
  sessionType: string;
  status: string;
  date: string;
  time: string;
  startMs: number;
  meetLink: string | null;
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MAX_LISTED = 5;

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function dayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/**
 * Month calendar of scheduled sessions. Today is highlighted, days with
 * sessions carry a count, and selecting a day lists its sessions beneath.
 */
export default function SessionsCalendar() {
  const [month, setMonth] = useState(() => {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    return today.slice(0, 7);
  });
  const [today, setToday] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [sessions, setSessions] = useState<CalendarSession[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/calendar?month=${m}`);
      const data = await res.json();
      setCounts(data.counts ?? {});
      setSessions(data.sessions ?? []);
      setToday(data.today ?? "");
      // Default to today when viewing the current month.
      setSelected((prev) =>
        prev && prev.startsWith(m) ? prev : data.today?.startsWith(m) ? data.today : ""
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(month);
  }, [month, load]);

  // Grid starting on Monday.
  const cells = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const leading = (first.getUTCDay() + 6) % 7; // Sunday=0 -> Monday-first
    const out: (string | null)[] = Array(leading).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      out.push(`${month}-${String(d).padStart(2, "0")}`);
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [month]);

  const daySessions = useMemo(
    () => sessions.filter((s) => s.date === selected),
    [sessions, selected]
  );

  const upcomingToday = counts[today] ?? 0;

  return (
    <section className="bg-white rounded-2xl border border-border p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-serif text-base font-medium">Sessions</h2>
          <p className="text-xs text-muted mt-0.5">
            {upcomingToday === 0
              ? "Nothing scheduled today"
              : `${upcomingToday} session${upcomingToday === 1 ? "" : "s"} today`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="p-2 rounded-lg hover:bg-accent-bg transition-colors"
            aria-label="Previous month"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <span className="text-xs font-medium min-w-[7.5rem] text-center">
            {monthLabel(month)}
          </span>
          <button
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            className="p-2 rounded-lg hover:bg-accent-bg transition-colors"
            aria-label="Next month"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-[10px] text-muted text-center py-0.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />;
          const count = counts[date] ?? 0;
          const isToday = date === today;
          const isSelected = date === selected;
          return (
            <button
              key={date}
              onClick={() => setSelected(date)}
              className={`relative h-9 rounded-md text-xs transition-colors flex items-center justify-center ${
                isSelected
                  ? "bg-forest text-cream"
                  : isToday
                  ? "bg-sage-600/15 text-forest font-semibold ring-1 ring-sage-600/40"
                  : count > 0
                  ? "hover:bg-accent-bg text-forest"
                  : "hover:bg-accent-bg text-muted"
              }`}
            >
              {Number(date.slice(-2))}
              {count > 0 && (
                <span
                  className={`absolute bottom-0.5 w-1 h-1 rounded-full ${
                    isSelected ? "bg-cream" : "bg-sage-600"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day */}
      <div className="mt-4 pt-4 border-t border-border">
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : !selected ? (
          <p className="text-sm text-muted">Select a day to see its sessions.</p>
        ) : daySessions.length === 0 ? (
          <p className="text-sm text-muted">
            No sessions on {dayLabel(selected)}.
          </p>
        ) : (
          <>
            <p className="text-xs font-semibold tracking-wider uppercase text-muted mb-3">
              {selected === today ? "Today" : dayLabel(selected)}
            </p>
            <div className="space-y-2">
              {daySessions.slice(0, MAX_LISTED).map((s) => (
                <Link
                  key={s.id}
                  href={`/bookings/${s.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border hover:border-sage-400 hover:bg-accent-bg/50 transition-colors"
                >
                  <span className="text-sm font-medium tabular-nums w-12">
                    {s.time}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm truncate">{s.name}</span>
                    <span className="block text-xs text-muted truncate">
                      {s.sessionType}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
            {daySessions.length > MAX_LISTED && (
              <Link
                href="/bookings"
                className="inline-block mt-3 text-sm text-sage-600 hover:underline"
              >
                View all {daySessions.length} sessions →
              </Link>
            )}
          </>
        )}
      </div>
    </section>
  );
}
