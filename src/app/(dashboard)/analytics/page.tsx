"use client";

import { useCallback, useEffect, useState } from "react";

interface Counted {
  key: string;
  count: number;
}

interface Summary {
  from: string;
  to: string;
  pageviews: number;
  visitors: number;
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

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

function shortDay(day: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

/** Simple bar list — clearer than a pie for "which of these is biggest". */
function BarList({
  title,
  rows,
  empty,
  hrefBase,
}: {
  title: string;
  rows: Counted[];
  empty: string;
  hrefBase?: string;
}) {
  const max = rows.length > 0 ? rows[0].count : 0;
  return (
    <section className="bg-white rounded-2xl border border-border p-5 md:p-6">
      <h2 className="font-serif text-lg font-medium mb-4">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.key} className="relative">
              <div className="flex items-center justify-between gap-3 text-sm relative z-10 px-2 py-1.5">
                <span className="truncate">
                  {hrefBase ? (
                    <a
                      href={`${hrefBase}${r.key}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-sage-600 transition-colors"
                    >
                      {r.key}
                    </a>
                  ) : (
                    r.key
                  )}
                </span>
                <span className="tabular-nums text-muted flex-shrink-0">
                  {r.count}
                </span>
              </div>
              <div
                className="absolute inset-y-0 left-0 bg-sage-300/25 rounded"
                style={{ width: `${max ? (r.count / max) * 100 : 0}%` }}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (range: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?days=${range}`);
      if (!res.ok) return;
      const data = await res.json();
      setSummary(data.summary);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(days);
  }, [days, load]);

  const peak =
    summary && summary.daily.length > 0
      ? Math.max(...summary.daily.map((d) => d.pageviews), 1)
      : 1;

  return (
    <div className="p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-medium">
            Website
          </h1>
          <p className="text-muted text-sm mt-1">
            How people are finding and using the site. No cookies, no third
            parties — this is measured on our own servers.
          </p>
        </div>
        <div className="flex items-center gap-1 bg-accent-bg/60 rounded-lg p-1 self-start">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                days === r.days
                  ? "bg-white shadow-sm font-medium"
                  : "text-muted hover:text-forest"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-accent-bg rounded-xl" />
          ))}
        </div>
      ) : !summary || summary.pageviews === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center">
          <p className="text-muted mb-2">Nothing recorded yet.</p>
          <p className="text-sm text-muted/80">
            Visits will start appearing here once the website is deployed with
            analytics enabled. Data is collected from the moment it goes live —
            there is no history before that.
          </p>
        </div>
      ) : (
        <>
          {/* Headline numbers */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Stat label="Visitors" value={summary.visitors} />
            <Stat label="Pageviews" value={summary.pageviews} />
            <Stat
              label="Pages per visit"
              value={
                summary.visitors
                  ? (summary.pageviews / summary.visitors).toFixed(1)
                  : "0"
              }
            />
            <Stat label="Bounced" value={`${summary.bounceRate}%`} />
          </div>

          {/* Traffic over time */}
          <section className="bg-white rounded-2xl border border-border p-5 md:p-6 mb-6">
            <h2 className="font-serif text-lg font-medium mb-4">Over time</h2>
            <div className="flex items-end gap-1 h-40">
              {summary.daily.map((d) => (
                <div
                  key={d.day}
                  className="flex-1 flex flex-col justify-end group relative min-w-0"
                  title={`${shortDay(d.day)}: ${d.pageviews} views, ${d.visitors} visitors`}
                >
                  <div
                    className="bg-sage-600/70 hover:bg-sage-600 rounded-t transition-colors"
                    style={{
                      height: `${(d.pageviews / peak) * 100}%`,
                      minHeight: d.pageviews > 0 ? "2px" : "0",
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted mt-2">
              <span>{shortDay(summary.from)}</span>
              <span>{shortDay(summary.to)}</span>
            </div>
          </section>

          {/* Booking funnel */}
          <section className="bg-white rounded-2xl border border-border p-5 md:p-6 mb-6">
            <h2 className="font-serif text-lg font-medium">Booking funnel</h2>
            <p className="text-sm text-muted mt-0.5 mb-5">
              Counted as people, not clicks — someone who books twice still
              counts once.
            </p>
            <div className="space-y-3">
              <FunnelRow
                label="Visited the site"
                value={summary.funnel.visitors}
                of={summary.funnel.visitors}
              />
              <FunnelRow
                label="Opened the booking page"
                value={summary.funnel.reachedBooking}
                of={summary.funnel.visitors}
              />
              <FunnelRow
                label="Chose a session type"
                value={summary.funnel.pickedType}
                of={summary.funnel.visitors}
              />
              <FunnelRow
                label="Chose a time"
                value={summary.funnel.pickedSlot}
                of={summary.funnel.visitors}
              />
              <FunnelRow
                label="Completed a booking"
                value={summary.funnel.completed}
                of={summary.funnel.visitors}
                highlight
              />
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BarList
              title="Echoes posts"
              rows={summary.blogPosts}
              empty="No blog posts read in this period."
              hrefBase="https://www.echoesofbeing.co.in/echoes/"
            />
            <BarList
              title="Services people look at"
              rows={summary.servicePages}
              empty="No service pages viewed in this period."
              hrefBase="https://www.echoesofbeing.co.in/services/"
            />
            <BarList
              title="Where visitors come from"
              rows={summary.referrers}
              empty="No referrer data yet."
            />
            <BarList
              title="Most visited pages"
              rows={summary.topPages}
              empty="No pages viewed yet."
            />
            <BarList
              title="Devices"
              rows={summary.devices}
              empty="No device data yet."
            />
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-5">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-sm text-muted mt-1">{label}</p>
    </div>
  );
}

function FunnelRow({
  label,
  value,
  of,
  highlight,
}: {
  label: string;
  value: number;
  of: number;
  highlight?: boolean;
}) {
  const pct = of > 0 ? Math.round((value / of) * 100) : 0;
  return (
    <div className="relative">
      <div className="flex items-center justify-between gap-3 text-sm relative z-10 px-3 py-2.5">
        <span className={highlight ? "font-medium" : ""}>{label}</span>
        <span className="tabular-nums flex-shrink-0">
          {value}
          <span className="text-muted ml-2">{pct}%</span>
        </span>
      </div>
      <div
        className={`absolute inset-y-0 left-0 rounded ${
          highlight ? "bg-sage-600/30" : "bg-sage-300/25"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
