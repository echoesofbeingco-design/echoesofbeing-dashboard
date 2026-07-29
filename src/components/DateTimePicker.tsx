"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * On-brand date + time picker for manual booking.
 *
 * Replaces the browser's native date/time controls, which look out of place in
 * the dashboard. Dates before today (in the practice's timezone) are disabled
 * so a session can't accidentally be booked in the past; every other time —
 * evenings, weekends, short notice — stays available, because manual booking
 * is deliberately free of the public availability rules.
 */

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "YYYY-MM-DD" for `ms` in the given timezone. */
function dayKeyIn(ms: number, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

function prettyDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export default function DateTimePicker({
  date,
  time,
  onDate,
  onTime,
  timezone = "Asia/Kolkata",
}: {
  date: string;
  time: string;
  onDate: (d: string) => void;
  onTime: (t: string) => void;
  timezone?: string;
}) {
  const today = useMemo(() => dayKeyIn(Date.now(), timezone), [timezone]);

  const [open, setOpen] = useState<"date" | "time" | null>(null);
  const [viewMonth, setViewMonth] = useState(() => (date || today).slice(0, 7));
  const rootRef = useRef<HTMLDivElement>(null);
  const timeListRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // When the date popover opens, jump the calendar to the chosen month.
  useEffect(() => {
    if (open === "date") setViewMonth((date || today).slice(0, 7));
  }, [open, date, today]);

  // Times at 15-minute granularity — enough for real bookings, one tap each.
  const times = useMemo(() => {
    const out: string[] = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
    }
    return out;
  }, []);

  // Scroll the chosen (or a sensible default) time into view when opening.
  useEffect(() => {
    if (open !== "time" || !timeListRef.current) return;
    const target = time || "10:00";
    const el = timeListRef.current.querySelector<HTMLElement>(
      `[data-time="${target}"]`
    );
    if (el) el.scrollIntoView({ block: "center" });
  }, [open, time]);

  const cells = useMemo(() => {
    const [y, m] = viewMonth.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const leading = (first.getUTCDay() + 6) % 7; // Monday-first
    const out: (string | null)[] = Array(leading).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      out.push(`${viewMonth}-${String(d).padStart(2, "0")}`);
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [viewMonth]);

  const monthLabel = useMemo(() => {
    const [y, m] = viewMonth.split("-").map(Number);
    return `${MONTHS[m - 1]} ${y}`;
  }, [viewMonth]);

  function shiftMonth(delta: number) {
    const [y, m] = viewMonth.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setViewMonth(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
    );
  }

  const triggerCls =
    "flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-cream text-sm text-left transition-colors hover:border-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-400/40";

  return (
    <div ref={rootRef} className="relative flex flex-col sm:flex-row gap-3">
      {/* Date trigger */}
      <div className="relative flex-1">
        <button
          type="button"
          onClick={() => setOpen(open === "date" ? null : "date")}
          className={`${triggerCls} w-full`}
        >
          <svg className="w-4 h-4 text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <span className={date ? "" : "text-muted"}>
            {date ? prettyDate(date) : "Pick a date"}
          </span>
        </button>

        {open === "date" && (
          <div className="absolute z-30 mt-2 w-72 rounded-xl border border-border bg-white shadow-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="p-1.5 rounded-lg hover:bg-accent-bg transition-colors"
                aria-label="Previous month"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <span className="text-sm font-medium">{monthLabel}</span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="p-1.5 rounded-lg hover:bg-accent-bg transition-colors"
                aria-label="Next month"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-[10px] text-muted text-center py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((cell, i) => {
                if (!cell) return <div key={`e-${i}`} />;
                const isPast = cell < today;
                const isToday = cell === today;
                const isSelected = cell === date;
                return (
                  <button
                    key={cell}
                    type="button"
                    disabled={isPast}
                    onClick={() => {
                      onDate(cell);
                      setOpen(null);
                    }}
                    className={`h-9 rounded-md text-sm transition-colors ${
                      isSelected
                        ? "bg-forest text-cream font-medium"
                        : isPast
                        ? "text-muted/30 cursor-not-allowed"
                        : isToday
                        ? "bg-sage-600/15 text-forest font-semibold ring-1 ring-sage-600/40 hover:bg-sage-600/25"
                        : "text-forest hover:bg-accent-bg"
                    }`}
                  >
                    {Number(cell.slice(-2))}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  onDate("");
                  setOpen(null);
                }}
                className="text-xs text-muted hover:text-forest transition-colors"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  onDate(today);
                  setOpen(null);
                }}
                className="text-xs text-sage-600 hover:text-forest font-medium transition-colors"
              >
                Today
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Time trigger */}
      <div className="relative sm:w-40">
        <button
          type="button"
          onClick={() => setOpen(open === "time" ? null : "time")}
          className={`${triggerCls} w-full`}
        >
          <svg className="w-4 h-4 text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className={time ? "tabular-nums" : "text-muted"}>
            {time || "Time"}
          </span>
        </button>

        {open === "time" && (
          <div
            ref={timeListRef}
            className="absolute z-30 mt-2 w-full min-w-[7rem] max-h-64 overflow-y-auto rounded-xl border border-border bg-white shadow-lg p-1"
          >
            {times.map((t) => (
              <button
                key={t}
                type="button"
                data-time={t}
                onClick={() => {
                  onTime(t);
                  setOpen(null);
                }}
                className={`block w-full text-center px-3 py-1.5 rounded-md text-sm tabular-nums transition-colors ${
                  t === time
                    ? "bg-forest text-cream font-medium"
                    : "hover:bg-accent-bg text-forest"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
