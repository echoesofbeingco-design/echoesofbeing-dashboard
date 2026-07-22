"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/Toast";

export default function NewBookingPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [genderOther, setGenderOther] = useState("");
  const [pronounsOther, setPronounsOther] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    whatsapp: "",
    age: "",
    gender: "",
    pronouns: "",
    sessionType: "",
    category: "",
    concern: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Optional scheduling: pick a real slot and put it on the calendar ──
  const [scheduleNow, setScheduleNow] = useState(false);
  const [sessionTypes, setSessionTypes] = useState<
    { id: string; label: string; durationMin: number }[]
  >([]);
  const [sessionTypeId, setSessionTypeId] = useState("");
  const [slotDays, setSlotDays] = useState<
    { date: string; slots: { startMs: number; label: string }[] }[]
  >([]);
  const [slotDate, setSlotDate] = useState("");
  const [selectedStartMs, setSelectedStartMs] = useState<number | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    if (!scheduleNow) return;
    fetch("/api/bookings/availability")
      .then((r) => r.json())
      .then((d) => setSessionTypes(d.sessionTypes ?? []))
      .catch(() => {});
  }, [scheduleNow]);

  useEffect(() => {
    if (!scheduleNow || !sessionTypeId) return;
    setLoadingSlots(true);
    setSelectedStartMs(null);
    fetch(`/api/bookings/availability?type=${encodeURIComponent(sessionTypeId)}`)
      .then((r) => r.json())
      .then((d) => {
        setSlotDays(d.days ?? []);
        setSlotDate(d.days?.[0]?.date ?? "");
      })
      .catch(() => showToast("Could not load available times", "error"))
      .finally(() => setLoadingSlots(false));
  }, [scheduleNow, sessionTypeId]);

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.email.trim()) errs.email = "Email is required";
    if (!form.whatsapp.trim()) errs.whatsapp = "WhatsApp number is required";
    if (!form.age) errs.age = "Age is required";
    if (!form.gender) errs.gender = "Gender is required";
    else if (form.gender === "Other" && !genderOther.trim())
      errs.gender = "Please specify";
    if (!form.pronouns) errs.pronouns = "Pronouns are required";
    else if (form.pronouns === "Other" && !pronounsOther.trim())
      errs.pronouns = "Please specify";
    if (!form.sessionType) errs.sessionType = "Session type is required";
    if (!form.category) errs.category = "Category is required";
    if (!form.concern.trim()) errs.concern = "Concern is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const res = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          whatsapp: form.whatsapp.replace(/[\s\-().]/g, "").replace(/^(\+91|91|0)/, ""),
          gender:
            form.gender === "Other"
              ? `Other: ${genderOther.trim()}`
              : form.gender,
          pronouns:
            form.pronouns === "Other"
              ? `Other: ${pronounsOther.trim()}`
              : form.pronouns,
          ...(scheduleNow && sessionTypeId && selectedStartMs
            ? { sessionTypeId, startMs: selectedStartMs }
            : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create booking");
      }

      const data = await res.json();
      showToast("Booking created successfully", "success");
      router.push(`/bookings/${data.id}`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Something went wrong",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  const inputClass = (field: string) =>
    `w-full px-4 py-3 rounded-lg border bg-cream focus:outline-none focus:ring-2 transition-shadow text-sm ${
      errors[field]
        ? "border-red-400 focus:ring-red-300/40"
        : "border-border focus:ring-sage-400/40"
    }`;

  return (
    <div className="p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto animate-fade-in">
      <Link
        href="/bookings"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-forest mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to bookings
      </Link>

      <div className="mb-8">
        <h1 className="font-serif text-2xl md:text-3xl font-medium">
          New Booking
        </h1>
        <p className="text-muted text-sm mt-1">
          Create a new booking on behalf of a client from the admin dashboard.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        {/* Personal Info */}
        <div className="border border-border rounded-xl bg-cream-light p-6 md:p-8 space-y-6">
          <h2 className="font-serif text-lg font-medium">Client Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-xs font-semibold tracking-wider uppercase block mb-2">
                Full Name <span className="text-sage-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Client's full name"
                className={inputClass("name")}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="text-xs font-semibold tracking-wider uppercase block mb-2">
                Email <span className="text-sage-500">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="client@example.com"
                className={inputClass("email")}
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-xs font-semibold tracking-wider uppercase block mb-2">
                WhatsApp Number <span className="text-sage-500">*</span>
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3.5 rounded-l-lg border border-r-0 border-border bg-accent-bg/60 text-sm text-muted">
                  +91
                </span>
                <input
                  type="tel"
                  maxLength={14}
                  value={form.whatsapp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^\d\s\-]/g, "");
                    updateField("whatsapp", val);
                  }}
                  placeholder="98765 43210"
                  className={`flex-1 px-4 py-3 rounded-r-lg border bg-cream focus:outline-none focus:ring-2 transition-shadow text-sm ${
                    errors.whatsapp
                      ? "border-red-400 focus:ring-red-300/40"
                      : "border-border focus:ring-sage-400/40"
                  }`}
                />
              </div>
              {errors.whatsapp && <p className="text-xs text-red-500 mt-1">{errors.whatsapp}</p>}
            </div>

            <div>
              <label className="text-xs font-semibold tracking-wider uppercase block mb-2">
                Age <span className="text-sage-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="120"
                value={form.age}
                onChange={(e) => updateField("age", e.target.value)}
                placeholder="Age"
                className={inputClass("age")}
              />
              {errors.age && <p className="text-xs text-red-500 mt-1">{errors.age}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-xs font-semibold tracking-wider uppercase block mb-2">
                Gender <span className="text-sage-500">*</span>
              </label>
              <select
                value={form.gender}
                onChange={(e) => {
                  updateField("gender", e.target.value);
                  if (e.target.value !== "Other") setGenderOther("");
                }}
                className={inputClass("gender")}
              >
                <option value="" disabled>Select</option>
                <option>Female</option>
                <option>Male</option>
                <option>Transgender</option>
                <option>Non-binary</option>
                <option>Genderqueer</option>
                <option>Genderfluid</option>
                <option>Agender</option>
                <option>Other</option>
                <option>Rather not say</option>
              </select>
              {form.gender === "Other" && (
                <input
                  type="text"
                  value={genderOther}
                  onChange={(e) => setGenderOther(e.target.value)}
                  placeholder="Please specify"
                  className="mt-2 w-full px-4 py-2.5 rounded-lg border border-border bg-cream focus:outline-none focus:ring-2 focus:ring-sage-400/40 text-sm"
                />
              )}
              {errors.gender && <p className="text-xs text-red-500 mt-1">{errors.gender}</p>}
            </div>

            <div>
              <label className="text-xs font-semibold tracking-wider uppercase block mb-2">
                Pronouns <span className="text-sage-500">*</span>
              </label>
              <select
                value={form.pronouns}
                onChange={(e) => {
                  updateField("pronouns", e.target.value);
                  if (e.target.value !== "Other") setPronounsOther("");
                }}
                className={inputClass("pronouns")}
              >
                <option value="" disabled>Select</option>
                <option>She/Her</option>
                <option>He/Him</option>
                <option>They/Them</option>
                <option>She/They</option>
                <option>He/They</option>
                <option>Ze/Zir</option>
                <option>Any pronouns</option>
                <option>Other</option>
                <option>Rather not say</option>
              </select>
              {form.pronouns === "Other" && (
                <input
                  type="text"
                  value={pronounsOther}
                  onChange={(e) => setPronounsOther(e.target.value)}
                  placeholder="Please specify"
                  className="mt-2 w-full px-4 py-2.5 rounded-lg border border-border bg-cream focus:outline-none focus:ring-2 focus:ring-sage-400/40 text-sm"
                />
              )}
              {errors.pronouns && <p className="text-xs text-red-500 mt-1">{errors.pronouns}</p>}
            </div>
          </div>
        </div>

        {/* Session Details */}
        <div className="border border-border rounded-xl bg-cream-light p-6 md:p-8 space-y-6">
          <h2 className="font-serif text-lg font-medium">Session Details</h2>

          <div>
            <label className="text-xs font-semibold tracking-wider uppercase block mb-2">
              What brings them here? <span className="text-sage-500">*</span>
            </label>
            <textarea
              rows={4}
              maxLength={2000}
              value={form.concern}
              onChange={(e) => updateField("concern", e.target.value)}
              placeholder="A few words about the client's primary concern..."
              className={`w-full px-4 py-3 rounded-lg border bg-cream focus:outline-none focus:ring-2 focus:ring-sage-400/40 text-sm resize-y ${
                errors.concern ? "border-red-400" : "border-border"
              }`}
            />
            <div className="flex items-center justify-between mt-1">
              {errors.concern && <p className="text-xs text-red-500">{errors.concern}</p>}
              <p className="text-[11px] text-muted ml-auto">{form.concern.length}/2000</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-xs font-semibold tracking-wider uppercase block mb-2">
                Type of Session <span className="text-sage-500">*</span>
              </label>
              <select
                value={form.sessionType}
                onChange={(e) => updateField("sessionType", e.target.value)}
                className={inputClass("sessionType")}
              >
                <option value="" disabled>Select session type</option>
                <option value="Introductory consultation">
                  Introductory consultation (Free)
                </option>
                <option value="Individual therapy">
                  Individual therapy
                </option>
              </select>
              {errors.sessionType && <p className="text-xs text-red-500 mt-1">{errors.sessionType}</p>}
            </div>

            <div>
              <label className="text-xs font-semibold tracking-wider uppercase block mb-2">
                Category <span className="text-sage-500">*</span>
              </label>
              <select
                value={form.category}
                onChange={(e) => updateField("category", e.target.value)}
                className={inputClass("category")}
              >
                <option value="" disabled>Select a category</option>
                <option>Relationships</option>
                <option>Loneliness</option>
                <option>Anxiety</option>
                <option>Depression</option>
                <option>Trauma</option>
                <option>Self-Esteem</option>
                <option>Women&apos;s Issues</option>
                <option>Other / Not sure</option>
              </select>
              {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category}</p>}
            </div>
          </div>
        </div>

        {/* ── Schedule a slot (optional) ── */}
        <div className="border border-border rounded-xl bg-cream-light">
          <div className="px-4 sm:px-6 py-4 border-b border-border">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={scheduleNow}
                onChange={(e) => setScheduleNow(e.target.checked)}
                className="w-4 h-4 rounded border-border"
              />
              <span className="font-serif text-lg font-medium">
                Schedule a session now
              </span>
            </label>
            <p className="text-xs text-muted mt-1 ml-7">
              Reserves the slot, adds it to the calendar with a Meet link and
              invites the client. Leave unticked to just record the intake.
            </p>
          </div>

          {scheduleNow && (
            <div className="px-4 sm:px-6 py-5 space-y-5">
              <div>
                <label className="text-xs font-semibold tracking-wider uppercase block mb-2">
                  Session length
                </label>
                <select
                  value={sessionTypeId}
                  onChange={(e) => setSessionTypeId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-sm"
                >
                  <option value="">Select…</option>
                  {sessionTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} ({t.durationMin} min)
                    </option>
                  ))}
                </select>
              </div>

              {loadingSlots && (
                <p className="text-sm text-muted">Loading available times…</p>
              )}

              {!loadingSlots && sessionTypeId && slotDays.length === 0 && (
                <p className="text-sm text-muted">
                  No open times in the booking window.
                </p>
              )}

              {!loadingSlots && slotDays.length > 0 && (
                <>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {slotDays.map((d) => (
                      <button
                        key={d.date}
                        type="button"
                        onClick={() => {
                          setSlotDate(d.date);
                          setSelectedStartMs(null);
                        }}
                        className={`flex-shrink-0 px-3 py-2 rounded-lg border text-xs ${
                          d.date === slotDate
                            ? "border-sage-500 bg-white"
                            : "border-border hover:border-sage-400"
                        }`}
                      >
                        {new Intl.DateTimeFormat("en-GB", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          timeZone: "UTC",
                        }).format(new Date(`${d.date}T00:00:00Z`))}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {(slotDays.find((d) => d.date === slotDate)?.slots ?? []).map(
                      (s) => (
                        <button
                          key={s.startMs}
                          type="button"
                          onClick={() => setSelectedStartMs(s.startMs)}
                          className={`py-2 rounded-lg border text-sm ${
                            selectedStartMs === s.startMs
                              ? "border-sage-500 bg-forest text-cream"
                              : "border-border hover:border-sage-400 bg-white"
                          }`}
                        >
                          {s.label}
                        </button>
                      )
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={
              saving ||
              (scheduleNow && (!sessionTypeId || selectedStartMs === null))
            }
            className="bg-forest text-cream px-6 py-3 rounded-lg text-sm font-medium hover:bg-sage-700 transition-colors disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Booking"}
          </button>
          <Link
            href="/bookings"
            className="px-6 py-3 rounded-lg border border-border text-sm font-medium hover:bg-accent-bg transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
