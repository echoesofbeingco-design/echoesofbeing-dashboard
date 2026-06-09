"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";

interface SessionData {
  id: string;
  clientId: string;
  date: string;
  sessionNumber: number;
  summary: string;
  presentingProblem: string;
  nextSession: string;
  clientHomework: string;
  therapistHomework: string;
}

interface ClientInfo {
  id: string;
  name: string;
}

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id: clientId, sessionId } = use(params);
  const { showToast } = useToast();
  const [session, setSession] = useState<SessionData | null>(null);
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [form, setForm] = useState<SessionData | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [sessRes, clientRes] = await Promise.all([
        fetch(`/api/clients/${encodeURIComponent(clientId)}/sessions/${encodeURIComponent(sessionId)}`).then((r) => r.json()),
        fetch(`/api/clients/${encodeURIComponent(clientId)}`).then((r) => r.json()),
      ]);
      if (sessRes.session) {
        setSession(sessRes.session);
        setForm(sessRes.session);
      }
      if (clientRes.client) {
        setClient({ id: clientRes.client.id, name: clientRes.client.name });
      }
    } catch {
      showToast("Failed to load session data", "error");
    } finally {
      setLoading(false);
    }
  }, [clientId, sessionId, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function updateField(field: string, value: string) {
    if (!form) return;
    setForm((prev) => prev ? { ...prev, [field]: value } : prev);
    setHasChanges(true);
  }

  async function handleSave() {
    if (!form || !hasChanges) return;
    setSaving(true);

    try {
      const updates: Record<string, unknown> = {};

      if (form.summary !== session?.summary) updates.summary = form.summary;
      if (form.presentingProblem !== session?.presentingProblem) updates.presentingProblem = form.presentingProblem;
      if (form.nextSession !== session?.nextSession) updates.nextSession = form.nextSession;
      if (form.clientHomework !== session?.clientHomework) updates.clientHomework = form.clientHomework;
      if (form.therapistHomework !== session?.therapistHomework) updates.therapistHomework = form.therapistHomework;

      if (Object.keys(updates).length === 0) {
        setHasChanges(false);
        showToast("No changes to save", "info");
        setSaving(false);
        return;
      }

      const res = await fetch(
        `/api/clients/${encodeURIComponent(clientId)}/sessions/${encodeURIComponent(sessionId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        }
      );

      if (!res.ok) throw new Error("Failed to save");
      setSession(form);
      setHasChanges(false);
      showToast("Session saved successfully", "success");
    } catch {
      showToast("Failed to save session", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) {
    return (
      <div className="p-4 sm:p-6 lg:p-10">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-accent-bg rounded w-32" />
          <div className="h-8 bg-accent-bg rounded w-64" />
          <div className="h-96 bg-accent-bg rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 animate-fade-in">
      {/* Back link */}
      <Link
        href={`/clients/${clientId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-forest mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to {client?.name || "client"}
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-medium">
            Session {form.sessionNumber}
          </h1>
          <p className="text-muted text-sm mt-1">
            {client?.name} &middot;{" "}
            {new Date(form.date).toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all self-start ${
            hasChanges
              ? "bg-forest text-cream hover:bg-sage-700"
              : "bg-accent-bg text-muted cursor-default"
          } disabled:opacity-50`}
        >
          {saving ? (
            "Saving..."
          ) : hasChanges ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Save Changes
            </>
          ) : (
            "All saved"
          )}
        </button>
      </div>

      {/* Tab header — single tab */}
      <div className="border-b border-border mb-6">
        <nav className="flex gap-1">
          <button className="px-4 py-2.5 text-sm font-medium border-b-2 border-sage-600 text-forest whitespace-nowrap">
            Session Notes
          </button>
        </nav>
      </div>

      {/* Session Notes content */}
      <div className="max-w-4xl space-y-6">
        <FormSection title="Session Summary">
          <TextArea field="summary" value={form.summary} onChange={updateField} placeholder="Summarize what was covered in this session..." />
        </FormSection>
        <FormSection title="Presenting Problem">
          <TextArea field="presentingProblem" value={form.presentingProblem} onChange={updateField} placeholder="What problem(s) did the client present with?" />
        </FormSection>
        <FormSection title="Next Session Plan">
          <TextArea field="nextSession" value={form.nextSession} onChange={updateField} placeholder="What should the next session focus on?" rows={3} />
        </FormSection>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormSection title="Client Homework">
            <TextArea field="clientHomework" value={form.clientHomework} onChange={updateField} placeholder="Tasks assigned to the client..." rows={4} />
          </FormSection>
          <FormSection title="Therapist Homework" highlight>
            <TextArea field="therapistHomework" value={form.therapistHomework} onChange={updateField} placeholder="Tasks for the therapist before next session..." rows={4} />
          </FormSection>
        </div>
      </div>

      {/* Sticky save bar */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-cream/95 backdrop-blur-md border-t border-border px-6 py-3 flex items-center justify-between z-30">
          <p className="text-sm text-muted">You have unsaved changes</p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-forest text-cream px-5 py-2 rounded-lg text-sm font-medium hover:bg-sage-700 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}

function FormSection({
  title,
  children,
  highlight,
}: {
  title: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`border rounded-xl p-4 sm:p-6 ${highlight ? "border-amber-200 bg-amber-50/30" : "border-border bg-cream-light"}`}>
      <h3 className="font-serif text-base font-medium mb-3">{title}</h3>
      {children}
    </div>
  );
}

function TextArea({
  field,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  field: string;
  value: string;
  onChange: (field: string, value: string) => void;
  placeholder: string;
  rows?: number;
}) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={(e) => onChange(field, e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-3 rounded-lg border border-border bg-cream focus:outline-none focus:ring-2 focus:ring-sage-400/40 text-sm resize-y"
    />
  );
}
