"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";
import type {
  AvailabilityConfig,
  SessionTypeConfig,
  TimeWindow,
} from "@/lib/availability";

/* ─────────────────────────  Google Calendar  ───────────────────────── */

interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
  connectedBy: string | null;
}

function GoogleCalendarCard() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const banner = searchParams.get("google");
  const bannerMessage = searchParams.get("message");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/google/status");
      if (res.ok) setStatus(await res.json());
    } catch {
      /* card renders an unavailable state */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/google/status", { method: "DELETE" });
      setConfirmDisconnect(false);
      await load();
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-border p-6 md:p-8">
      <h2 className="font-serif text-xl font-medium">Google Calendar</h2>
      <p className="text-sm text-muted mt-1 max-w-xl leading-relaxed">
        Connect Nidhi&apos;s Google account so every confirmed session is added
        to her calendar with a Google Meet link, and the client is invited
        automatically.
      </p>

      {banner === "connected" && (
        <div className="mt-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          Google Calendar connected successfully.
        </div>
      )}
      {banner === "error" && (
        <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {bannerMessage || "Could not connect to Google."}
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-muted">Checking connection…</p>
        ) : !status?.configured ? (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium mb-1">Not configured</p>
            <p>
              Add <code>GOOGLE_CLIENT_ID</code> and{" "}
              <code>GOOGLE_CLIENT_SECRET</code> to this app&apos;s environment,
              then restart it.
            </p>
          </div>
        ) : status.connected ? (
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-green-700">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Connected{status.email ? ` as ${status.email}` : ""}
            </span>
            {status.connectedAt && (
              <span className="text-xs text-muted">
                since {new Date(status.connectedAt).toLocaleDateString("en-IN")}
              </span>
            )}
            <div className="flex gap-3 ml-auto">
              <a
                href="/api/google/start"
                className="text-sm px-4 py-2 rounded-full border border-border hover:bg-accent-bg transition-colors"
              >
                Reconnect
              </a>
              <button
                onClick={() => setConfirmDisconnect(true)}
                disabled={disconnecting}
                className="text-sm px-4 py-2 rounded-full border border-red-200 text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <span className="inline-flex items-center gap-2 text-sm text-muted mb-4">
              <span className="w-2 h-2 rounded-full bg-gray-300" />
              Not connected
            </span>
            <div>
              <a
                href="/api/google/start"
                className="inline-flex items-center gap-2 bg-forest text-cream px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Connect Google Calendar
              </a>
            </div>
            <p className="text-xs text-muted mt-4 leading-relaxed max-w-xl">
              Google will show an &ldquo;unverified app&rdquo; warning because
              this integration is private to the practice. Choose{" "}
              <strong>Advanced → Go to Echoes of Being</strong>, and make sure
              the <strong>calendar permission checkbox is ticked</strong>.
            </p>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDisconnect}
        title="Disconnect Google Calendar?"
        message="New bookings will stop creating calendar events and Meet links until you reconnect. Existing events stay on the calendar."
        confirmLabel="Disconnect"
        cancelLabel="Keep connected"
        danger
        busy={disconnecting}
        onConfirm={handleDisconnect}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </section>
  );
}

/* ─────────────────────────────  Availability  ───────────────────────── */

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function AvailabilityCard() {
  const [config, setConfig] = useState<AvailabilityConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [blackoutInput, setBlackoutInput] = useState("");

  useEffect(() => {
    fetch("/api/settings/availability")
      .then((r) => r.json())
      .then((data) => setConfig(data.config))
      .catch(() => setMessage({ ok: false, text: "Could not load settings." }))
      .finally(() => setLoading(false));
  }, []);

  function update(patch: Partial<AvailabilityConfig>) {
    setConfig((c) => (c ? { ...c, ...patch } : c));
  }

  function setDayWindow(day: number, patch: Partial<TimeWindow>) {
    if (!config) return;
    const windows = config.weeklyHours[String(day)] ?? [];
    const current = windows[0] ?? { start: "10:00", end: "14:00" };
    update({
      weeklyHours: {
        ...config.weeklyHours,
        [String(day)]: [{ ...current, ...patch }],
      },
    });
  }

  function toggleDay(day: number, open: boolean) {
    if (!config) return;
    update({
      weeklyHours: {
        ...config.weeklyHours,
        [String(day)]: open ? [{ start: "10:00", end: "14:00" }] : [],
      },
    });
  }

  function setSessionType(index: number, patch: Partial<SessionTypeConfig>) {
    if (!config) return;
    const next = config.sessionTypes.map((s, i) =>
      i === index ? { ...s, ...patch } : s
    );
    update({ sessionTypes: next });
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ ok: false, text: data.error || "Could not save." });
        return;
      }
      setConfig(data.config);
      setMessage({ ok: true, text: "Availability saved." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="bg-white rounded-2xl border border-border p-6 md:p-8">
        <p className="text-sm text-muted">Loading availability…</p>
      </section>
    );
  }
  if (!config) return null;

  return (
    <section className="bg-white rounded-2xl border border-border p-6 md:p-8">
      <h2 className="font-serif text-xl font-medium">Availability</h2>
      <p className="text-sm text-muted mt-1 max-w-xl leading-relaxed">
        Controls exactly which times clients can book on the website. All times
        are in {config.timezone}.
      </p>

      {message && (
        <div
          className={`mt-4 rounded-xl px-4 py-3 text-sm border ${
            message.ok
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Weekly hours */}
      <h3 className="text-xs font-semibold tracking-wider uppercase text-muted mt-8 mb-3">
        Weekly hours
      </h3>
      <div className="space-y-2">
        {DAY_NAMES.map((name, day) => {
          const windows = config.weeklyHours[String(day)] ?? [];
          const open = windows.length > 0;
          const w = windows[0];
          return (
            <div
              key={day}
              className="flex flex-wrap items-center gap-3 py-2 border-b border-border/60 last:border-0"
            >
              <label className="flex items-center gap-2 w-36">
                <input
                  type="checkbox"
                  checked={open}
                  onChange={(e) => toggleDay(day, e.target.checked)}
                  className="w-4 h-4 rounded border-border"
                />
                <span className="text-sm">{name}</span>
              </label>
              {open && w ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={w.start}
                    onChange={(e) =>
                      setDayWindow(day, { start: e.target.value })
                    }
                    className="px-3 py-1.5 rounded-lg border border-border text-sm"
                  />
                  <span className="text-muted text-sm">to</span>
                  <input
                    type="time"
                    value={w.end}
                    onChange={(e) => setDayWindow(day, { end: e.target.value })}
                    className="px-3 py-1.5 rounded-lg border border-border text-sm"
                  />
                </div>
              ) : (
                <span className="text-sm text-muted">Closed</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Rules */}
      <h3 className="text-xs font-semibold tracking-wider uppercase text-muted mt-8 mb-3">
        Booking rules
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm text-muted">Gap between sessions (min)</span>
          <input
            type="number"
            min={0}
            max={480}
            value={config.bufferMin}
            onChange={(e) => update({ bufferMin: Number(e.target.value) })}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-border text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-muted">Advance notice (hours)</span>
          <input
            type="number"
            min={0}
            max={720}
            value={config.minNoticeHours}
            onChange={(e) => update({ minNoticeHours: Number(e.target.value) })}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-border text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-muted">Book up to (days ahead)</span>
          <input
            type="number"
            min={1}
            max={365}
            value={config.maxAdvanceDays}
            onChange={(e) => update({ maxAdvanceDays: Number(e.target.value) })}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-border text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-muted">Slot interval (min)</span>
          <input
            type="number"
            min={5}
            max={120}
            value={config.slotGranularityMin}
            onChange={(e) =>
              update({ slotGranularityMin: Number(e.target.value) })
            }
            className="mt-1 w-full px-3 py-2 rounded-lg border border-border text-sm"
          />
        </label>
      </div>

      {/* Session types */}
      <h3 className="text-xs font-semibold tracking-wider uppercase text-muted mt-8 mb-3">
        Session types
      </h3>
      <div className="space-y-3">
        {config.sessionTypes.map((type, i) => (
          <div
            key={type.id}
            className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center p-3 rounded-xl border border-border"
          >
            <input
              value={type.label}
              onChange={(e) => setSessionType(i, { label: e.target.value })}
              className="sm:col-span-5 px-3 py-2 rounded-lg border border-border text-sm"
            />
            <label className="sm:col-span-3 text-sm">
              <span className="text-muted text-xs block">Minutes</span>
              <input
                type="number"
                min={5}
                max={480}
                value={type.durationMin}
                onChange={(e) =>
                  setSessionType(i, { durationMin: Number(e.target.value) })
                }
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border text-sm"
              />
            </label>
            <label className="sm:col-span-2 text-sm">
              <span className="text-muted text-xs block">Price (₹)</span>
              <input
                type="number"
                min={0}
                value={type.price}
                onChange={(e) =>
                  setSessionType(i, { price: Number(e.target.value) })
                }
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border text-sm"
              />
            </label>
            <label className="sm:col-span-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={type.enabled}
                onChange={(e) =>
                  setSessionType(i, { enabled: e.target.checked })
                }
                className="w-4 h-4 rounded border-border"
              />
              Bookable
            </label>
          </div>
        ))}
      </div>

      {/* Blackout dates */}
      <h3 className="text-xs font-semibold tracking-wider uppercase text-muted mt-8 mb-3">
        Days off
      </h3>
      <div className="flex flex-wrap gap-2 mb-3">
        {config.blackoutDates.length === 0 && (
          <span className="text-sm text-muted">No days blocked.</span>
        )}
        {config.blackoutDates.map((d) => (
          <span
            key={d}
            className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full bg-accent-bg"
          >
            {d}
            <button
              onClick={() =>
                update({
                  blackoutDates: config.blackoutDates.filter((x) => x !== d),
                })
              }
              className="text-muted hover:text-red-600"
              aria-label={`Remove ${d}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="date"
          value={blackoutInput}
          onChange={(e) => setBlackoutInput(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border text-sm"
        />
        <button
          onClick={() => {
            if (!blackoutInput) return;
            if (!config.blackoutDates.includes(blackoutInput)) {
              update({
                blackoutDates: [...config.blackoutDates, blackoutInput].sort(),
              });
            }
            setBlackoutInput("");
          }}
          className="text-sm px-4 py-2 rounded-full border border-border hover:bg-accent-bg transition-colors"
        >
          Block this day
        </button>
      </div>

      <div className="mt-8 pt-6 border-t border-border">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-forest text-cream px-6 py-2.5 rounded-full text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save availability"}
        </button>
      </div>
    </section>
  );
}

/* ─────────────────────────────  Maintenance  ────────────────────────── */

function SlotMaintenanceCard() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleReconcile() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/settings/reconcile-slots", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(data.error || "Could not reconcile slots.");
        return;
      }
      setResult(
        data.released === 0
          ? `Checked ${data.checked} held slot${data.checked === 1 ? "" : "s"} — nothing needed freeing.`
          : `Freed ${data.released} slot${data.released === 1 ? "" : "s"} that were still held by cancelled or deleted bookings.`
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-border p-6 md:p-8">
      <h2 className="font-serif text-xl font-medium">Free stuck time slots</h2>
      <p className="text-sm text-muted mt-1 max-w-xl leading-relaxed">
        Cancelling or deleting a booking releases its time automatically. This
        is a safety net for older bookings cancelled before that was the case —
        it finds times still marked as taken by a booking that no longer exists
        or was cancelled, and frees them. Safe to run any time.
      </p>

      {result && (
        <div className="mt-4 rounded-xl bg-accent-bg px-4 py-3 text-sm">
          {result}
        </div>
      )}

      <button
        onClick={handleReconcile}
        disabled={running}
        className="mt-6 text-sm px-5 py-2.5 rounded-full border border-border hover:bg-accent-bg transition-colors disabled:opacity-50"
      >
        {running ? "Checking…" : "Check for stuck slots"}
      </button>
    </section>
  );
}

export default function SettingsPage() {
  return (
    <div className="p-6 lg:p-8 xl:p-10 max-w-5xl">
      <header className="mb-8">
        <h1 className="font-serif text-2xl md:text-3xl font-medium">Settings</h1>
        <p className="text-sm text-muted mt-1">
          Practice configuration for bookings and integrations.
        </p>
      </header>

      <div className="space-y-6">
        <Suspense
          fallback={
            <div className="bg-white rounded-2xl border border-border p-6">
              <p className="text-sm text-muted">Loading…</p>
            </div>
          }
        >
          <GoogleCalendarCard />
        </Suspense>
        <AvailabilityCard />
        <SlotMaintenanceCard />
      </div>
    </div>
  );
}
