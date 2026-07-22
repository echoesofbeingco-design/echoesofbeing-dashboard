"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/Toast";

export default function NewClientPage() {
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
    occupation: "",
    desiredOutcomes: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

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
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          gender:
            form.gender === "Other"
              ? `Other: ${genderOther.trim()}`
              : form.gender,
          pronouns:
            form.pronouns === "Other"
              ? `Other: ${pronounsOther.trim()}`
              : form.pronouns,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create client");
      }

      const data = await res.json();
      showToast("Client created successfully", "success");
      router.push(`/clients/${data.id}`);
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
        href="/clients"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-forest mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to clients
      </Link>

      <div className="mb-8">
        <h1 className="font-serif text-2xl md:text-3xl font-medium">
          Add New Client
        </h1>
        <p className="text-muted text-sm mt-1">
          Create a new client record for your practice.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        <div className="border border-border rounded-xl bg-cream-light p-6 md:p-8 space-y-6">
          <h2 className="font-serif text-lg font-medium">Personal Details</h2>

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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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

            <div>
              <label className="text-xs font-semibold tracking-wider uppercase block mb-2">
                Occupation
              </label>
              <input
                type="text"
                value={form.occupation}
                onChange={(e) => updateField("occupation", e.target.value)}
                placeholder="e.g. Software Engineer"
                className={inputClass("occupation")}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold tracking-wider uppercase block mb-2">
              Desired Outcomes / Goals
            </label>
            <textarea
              rows={4}
              maxLength={3000}
              value={form.desiredOutcomes}
              onChange={(e) => updateField("desiredOutcomes", e.target.value)}
              placeholder="What does the client hope to achieve through therapy?"
              className="w-full px-4 py-3 rounded-lg border border-border bg-cream focus:outline-none focus:ring-2 focus:ring-sage-400/40 text-sm resize-y"
            />
            <p className="text-[11px] text-muted text-right mt-1">
              {form.desiredOutcomes.length}/3000
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-forest text-cream px-6 py-3 rounded-lg text-sm font-medium hover:bg-sage-700 transition-colors disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Client"}
          </button>
          <Link
            href="/clients"
            className="px-6 py-3 rounded-lg border border-border text-sm font-medium hover:bg-accent-bg transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
