"use client";

import { useCallback, useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

interface Slot {
  startISO: string;
  endISO: string;
  startMs: number;
  endMs: number;
  label: string;
}

interface DaySlots {
  date: string;
  slots: Slot[];
}

interface SessionTypeOption {
  id: string;
  label: string;
  durationMin: number;
  price: number;
}

interface ClientRecord {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  age: string;
  dateOfBirth?: string;
  gender: string;
  pronouns: string;
  concerns: string;
  symptoms: string;
}

/** Outcome of one attempted booking, so partial success reads honestly. */
interface Result {
  startMs: number;
  when: string;
  ok: boolean;
  error?: string;
}

const CATEGORIES = [
  "Relationships",
  "Loneliness",
  "Anxiety",
  "Depression",
  "Trauma",
  "Self-Esteem",
  "Women's Issues",
  "Other / Not sure",
];

function dayLabel(date: string): { weekday: string; day: string } {
  const d = new Date(`${date}T00:00:00Z`);
  return {
    weekday: new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      timeZone: "UTC",
    }).format(d),
    day: new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(d),
  };
}

function fullWhen(startMs: number, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  }).format(new Date(startMs));
}

export default function BookForClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { showToast } = useToast();

  const [client, setClient] = useState<ClientRecord | null>(null);
  const [sessionTypes, setSessionTypes] = useState<SessionTypeOption[]>([]);
  const [sessionTypeId, setSessionTypeId] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [days, setDays] = useState<DaySlots[]>([]);
  const [selected, setSelected] = useState<Map<number, Slot>>(new Map());
  const [category, setCategory] = useState("");
  const [concern, setConcern] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [showAllDays, setShowAllDays] = useState(false);

  // Client record — everything below is pre-filled from it.
  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.client) {
          setClient(d.client);
          setConcern(d.client.concerns || d.client.symptoms || "");
        }
      })
      .catch(() => showToast("Could not load this client", "error"))
      .finally(() => setLoading(false));
  }, [id, showToast]);

  const loadSlots = useCallback(async (typeId: string) => {
    setLoadingSlots(true);
    try {
      const res = await fetch(
        `/api/bookings/availability${typeId ? `?type=${typeId}` : ""}`
      );
      const data = await res.json();
      setSessionTypes(data.sessionTypes ?? []);
      setTimezone(data.timezone ?? "Asia/Kolkata");
      setDays(data.days ?? []);
      if (!typeId && data.sessionTypes?.length) {
        setSessionTypeId(data.sessionTypes[0].id);
      }
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    loadSlots(sessionTypeId);
  }, [sessionTypeId, loadSlots]);

  const visibleDays = useMemo(
    () => (showAllDays ? days : days.slice(0, 14)),
    [days, showAllDays]
  );

  const chosen = useMemo(
    () => [...selected.values()].sort((a, b) => a.startMs - b.startMs),
    [selected]
  );

  function toggle(slot: Slot) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(slot.startMs)) next.delete(slot.startMs);
      else next.set(slot.startMs, slot);
      return next;
    });
  }

  /**
   * Select the same weekday and time for the next `weeks` occurrences, skipping
   * any that aren't actually free. Only offers slots the availability engine
   * returned, so buffers, Saturdays and notice periods are all still honoured.
   */
  function repeatWeekly(from: Slot, weeks: number) {
    const wanted: number[] = [];
    for (let w = 1; w <= weeks; w++) {
      wanted.push(from.startMs + w * 7 * 24 * 3600 * 1000);
    }
    const byMs = new Map<number, Slot>();
    days.forEach((d) => d.slots.forEach((s) => byMs.set(s.startMs, s)));

    const found: Slot[] = [];
    const missing: number[] = [];
    wanted.forEach((ms) => {
      const hit = byMs.get(ms);
      if (hit) found.push(hit);
      else missing.push(ms);
    });

    setSelected((prev) => {
      const next = new Map(prev);
      found.forEach((s) => next.set(s.startMs, s));
      return next;
    });

    if (missing.length > 0) {
      showToast(
        `Added ${found.length}. ${missing.length} week${
          missing.length === 1 ? " was" : "s were"
        } unavailable at that time and got skipped.`,
        "info"
      );
    } else {
      showToast(`Added ${found.length} weekly sessions.`, "success");
    }
  }

  async function submit() {
    if (!client || chosen.length === 0) return;
    setSubmitting(true);
    setResults(null);

    const out: Result[] = [];
    // Sequential on purpose: each booking changes what's available for the
    // next one (the inter-session buffer), and booking in parallel would race
    // against the slot locks.
    for (const slot of chosen) {
      try {
        const res = await fetch("/api/bookings/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: client.id,
            name: client.name,
            email: client.email,
            whatsapp: client.whatsapp,
            age: client.age || "n/a",
            gender: client.gender || "Rather not say",
            pronouns: client.pronouns || "Rather not say",
            sessionType:
              sessionTypes.find((t) => t.id === sessionTypeId)?.label ??
              "Session",
            category: category || "Other / Not sure",
            concern: concern.trim() || "Ongoing therapy",
            sessionTypeId,
            startMs: slot.startMs,
          }),
        });
        const data = await res.json();
        out.push({
          startMs: slot.startMs,
          when: fullWhen(slot.startMs, timezone),
          ok: res.ok,
          error: res.ok ? undefined : data.error,
        });
      } catch {
        out.push({
          startMs: slot.startMs,
          when: fullWhen(slot.startMs, timezone),
          ok: false,
          error: "Network error",
        });
      }
    }

    setResults(out);
    setSubmitting(false);

    const booked = out.filter((r) => r.ok).length;
    if (booked === out.length) {
      showToast(
        `Booked ${booked} session${booked === 1 ? "" : "s"}. Confirmation emails sent.`,
        "success"
      );
      setSelected(new Map());
      loadSlots(sessionTypeId);
    } else {
      showToast(
        `Booked ${booked} of ${out.length}. See the details below.`,
        booked === 0 ? "error" : "info"
      );
      // Keep only the ones that failed, so a retry doesn't double-book.
      setSelected((prev) => {
        const next = new Map<number, Slot>();
        out.filter((r) => !r.ok).forEach((r) => {
          const s = prev.get(r.startMs);
          if (s) next.set(r.startMs, s);
        });
        return next;
      });
      loadSlots(sessionTypeId);
    }
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-accent-bg rounded w-64" />
          <div className="h-40 bg-accent-bg rounded-xl" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto">
        <p className="text-muted">Client not found.</p>
        <Link href="/clients" className="text-sage-600 text-sm hover:underline">
          Back to clients
        </Link>
      </div>
    );
  }

  const missingContact = !client.email?.trim() || !client.whatsapp?.trim();

  return (
    <div className="p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto animate-fade-in">
      <Link
        href={`/clients/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-forest mb-4 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to {client.name}
      </Link>

      <header className="mb-6">
        <h1 className="font-serif text-2xl md:text-3xl font-medium">
          Book sessions for {client.name}
        </h1>
        <p className="text-sm text-muted mt-1">
          Their details are already on file. Pick as many times as you like and
          book them all at once — {client.name.split(" ")[0]} gets a
          confirmation email with a calendar invite for each one.
        </p>
      </header>

      {missingContact && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-6 text-sm">
          This client is missing{" "}
          {!client.email?.trim() ? "an email address" : ""}
          {!client.email?.trim() && !client.whatsapp?.trim() ? " and " : ""}
          {!client.whatsapp?.trim() ? "a WhatsApp number" : ""}. Add it on their{" "}
          <Link href={`/clients/${id}`} className="underline">
            profile
          </Link>{" "}
          first — bookings need both.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Session type */}
          <section className="bg-white rounded-2xl border border-border p-5 md:p-6">
            <h2 className="font-serif text-lg font-medium mb-4">Session type</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sessionTypes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSessionTypeId(t.id);
                    setSelected(new Map());
                  }}
                  className={`text-left px-4 py-3 rounded-xl border transition-all ${
                    sessionTypeId === t.id
                      ? "border-sage-500 bg-secondary-bg/60"
                      : "border-border hover:border-sage-400/60"
                  }`}
                >
                  <span className="block text-sm font-medium">{t.label}</span>
                  <span className="block text-xs text-muted mt-0.5">
                    {t.durationMin} min ·{" "}
                    {t.price === 0
                      ? "Complimentary"
                      : `₹${t.price.toLocaleString("en-IN")}`}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Slots */}
          <section className="bg-white rounded-2xl border border-border p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg font-medium">Pick times</h2>
              {chosen.length > 0 && (
                <button
                  onClick={() => setSelected(new Map())}
                  className="text-xs text-muted hover:text-forest transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            {loadingSlots ? (
              <p className="text-sm text-muted">Loading available times…</p>
            ) : days.length === 0 ? (
              <p className="text-sm text-muted">
                No open times. Check your availability in Settings.
              </p>
            ) : (
              <>
                <div className="space-y-4">
                  {visibleDays.map((day) => {
                    if (day.slots.length === 0) return null;
                    const l = dayLabel(day.date);
                    return (
                      <div key={day.date}>
                        <p className="text-xs uppercase tracking-wider text-muted mb-2">
                          {l.weekday} · {l.day}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {day.slots.map((slot) => {
                            const on = selected.has(slot.startMs);
                            return (
                              <button
                                key={slot.startMs}
                                onClick={() => toggle(slot)}
                                className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                                  on
                                    ? "border-sage-500 bg-forest text-cream"
                                    : "border-border hover:border-sage-400"
                                }`}
                              >
                                {slot.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {days.length > 14 && (
                  <button
                    onClick={() => setShowAllDays((v) => !v)}
                    className="mt-4 text-sm text-sage-600 hover:text-forest transition-colors"
                  >
                    {showAllDays
                      ? "Show fewer dates"
                      : `Show all ${days.length} available dates`}
                  </button>
                )}
              </>
            )}
          </section>
        </div>

        {/* Summary rail */}
        <div className="space-y-6">
          <section className="bg-white rounded-2xl border border-border p-5 md:p-6">
            <h2 className="font-serif text-lg font-medium mb-3">
              Selected ({chosen.length})
            </h2>

            {chosen.length === 0 ? (
              <p className="text-sm text-muted">
                Nothing picked yet. Choose one or more times on the left.
              </p>
            ) : (
              <>
                <ul className="space-y-1.5 mb-4 max-h-56 overflow-y-auto">
                  {chosen.map((s) => (
                    <li
                      key={s.startMs}
                      className="flex items-center justify-between text-sm gap-2"
                    >
                      <span>{fullWhen(s.startMs, timezone)}</span>
                      <button
                        onClick={() => toggle(s)}
                        className="text-xs text-muted hover:text-red-600 transition-colors flex-shrink-0"
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>

                {chosen.length === 1 && (
                  <div className="border-t border-border pt-3 mb-3">
                    <p className="text-xs text-muted mb-2">
                      Repeat this time weekly:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[3, 4, 7].map((w) => (
                        <button
                          key={w}
                          onClick={() => repeatWeekly(chosen[0], w)}
                          className="px-3 py-1.5 rounded-lg border border-border text-xs hover:border-sage-400 hover:bg-accent-bg transition-colors"
                        >
                          +{w} weeks
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="border-t border-border pt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold tracking-wider uppercase text-muted mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-sage-400/40"
                >
                  <option value="">Other / Not sure</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold tracking-wider uppercase text-muted mb-1.5">
                  Note
                </label>
                <textarea
                  rows={3}
                  value={concern}
                  onChange={(e) => setConcern(e.target.value)}
                  placeholder="Carried over from their file"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-cream text-sm resize-y focus:outline-none focus:ring-2 focus:ring-sage-400/40"
                />
              </div>
            </div>

            <button
              onClick={submit}
              disabled={submitting || chosen.length === 0 || missingContact}
              className="w-full mt-4 bg-forest text-cream py-3 rounded-lg text-sm font-medium hover:bg-sage-700 transition-colors disabled:opacity-40"
            >
              {submitting
                ? "Booking…"
                : chosen.length === 0
                ? "Pick a time first"
                : `Book ${chosen.length} session${chosen.length === 1 ? "" : "s"}`}
            </button>
            {chosen.length > 1 && !submitting && (
              <p className="text-xs text-muted mt-2 leading-relaxed">
                {client.name.split(" ")[0]} receives {chosen.length} separate
                confirmation emails, one per session, each with its own calendar
                invite.
              </p>
            )}
          </section>

          {results && (
            <section className="bg-white rounded-2xl border border-border p-5 md:p-6">
              <h2 className="font-serif text-lg font-medium mb-3">Result</h2>
              <ul className="space-y-2">
                {results.map((r) => (
                  <li key={r.startMs} className="text-sm flex items-start gap-2">
                    <span
                      className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        r.ok ? "bg-green-500" : "bg-red-500"
                      }`}
                    />
                    <span className="min-w-0">
                      <span className="block">{r.when}</span>
                      {!r.ok && (
                        <span className="block text-xs text-red-600">
                          {r.error}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {results.every((r) => r.ok) && (
                <button
                  onClick={() => router.push(`/clients/${id}`)}
                  className="mt-4 text-sm text-sage-600 hover:underline"
                >
                  Back to {client.name} →
                </button>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
