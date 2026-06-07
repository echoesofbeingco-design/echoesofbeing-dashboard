"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";

type Tab = "overview" | "session-info" | "interpersonal" | "themes" | "theoretical" | "treatment";

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
  symptoms: string;
  concerns: string;
  stressors: string;
  interpersonalHistory: {
    strengths: string;
    challenges: string;
    significantChanges: string;
    romanticPatterns: string;
    familyPatterns: string;
    friendsPatterns: string;
    workplacePatterns: string;
  };
  keyThemes: {
    thoughts: string;
    emotions: string;
    behaviors: string;
    environmental: string;
  };
  theoreticalLens: {
    origin: string;
    maintainingProcesses: string;
    focusOfIntervention: string;
  };
  treatmentFocus: string;
}

interface ClientInfo {
  id: string;
  name: string;
}

const TABS: { key: Tab; label: string; shortLabel: string }[] = [
  { key: "overview", label: "Session Overview", shortLabel: "Overview" },
  { key: "session-info", label: "Session Information", shortLabel: "Info" },
  { key: "interpersonal", label: "Interpersonal History", shortLabel: "Interpersonal" },
  { key: "themes", label: "Key Themes & Maintaining Factors", shortLabel: "Themes" },
  { key: "theoretical", label: "Theoretical Lens", shortLabel: "Lens" },
  { key: "treatment", label: "Treatment Focus", shortLabel: "Treatment" },
];

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
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Editable fields — we keep a local copy
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

  function updateNested(parent: string, field: string, value: string) {
    if (!form) return;
    setForm((prev) => {
      if (!prev) return prev;
      const parentObj = prev[parent as keyof SessionData];
      if (typeof parentObj !== "object" || parentObj === null) return prev;
      return {
        ...prev,
        [parent]: { ...parentObj, [field]: value },
      };
    });
    setHasChanges(true);
  }

  async function handleSave() {
    if (!form || !hasChanges) return;
    setSaving(true);

    try {
      const updates: Record<string, unknown> = {};

      // Collect all changed fields
      if (form.summary !== session?.summary) updates.summary = form.summary;
      if (form.presentingProblem !== session?.presentingProblem) updates.presentingProblem = form.presentingProblem;
      if (form.nextSession !== session?.nextSession) updates.nextSession = form.nextSession;
      if (form.clientHomework !== session?.clientHomework) updates.clientHomework = form.clientHomework;
      if (form.therapistHomework !== session?.therapistHomework) updates.therapistHomework = form.therapistHomework;
      if (form.symptoms !== session?.symptoms) updates.symptoms = form.symptoms;
      if (form.concerns !== session?.concerns) updates.concerns = form.concerns;
      if (form.stressors !== session?.stressors) updates.stressors = form.stressors;
      if (form.treatmentFocus !== session?.treatmentFocus) updates.treatmentFocus = form.treatmentFocus;

      // Nested objects — always send the full object if any field changed
      if (JSON.stringify(form.interpersonalHistory) !== JSON.stringify(session?.interpersonalHistory)) {
        updates.interpersonalHistory = form.interpersonalHistory;
      }
      if (JSON.stringify(form.keyThemes) !== JSON.stringify(session?.keyThemes)) {
        updates.keyThemes = form.keyThemes;
      }
      if (JSON.stringify(form.theoreticalLens) !== JSON.stringify(session?.theoreticalLens)) {
        updates.theoreticalLens = form.theoreticalLens;
      }

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

      {/* Tabs */}
      <div className="border-b border-border mb-6 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "border-sage-600 text-forest"
                  : "border-transparent text-muted hover:text-forest hover:border-border"
              }`}
            >
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="max-w-4xl">
        {activeTab === "overview" && (
          <div className="space-y-6">
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
        )}

        {activeTab === "session-info" && (
          <div className="space-y-6">
            <FormSection title="Symptoms">
              <TextArea field="symptoms" value={form.symptoms} onChange={updateField} placeholder="Document observed or reported symptoms..." />
            </FormSection>
            <FormSection title="Concerns">
              <TextArea field="concerns" value={form.concerns} onChange={updateField} placeholder="Client's primary concerns discussed in this session..." />
            </FormSection>
            <FormSection title="Stressors">
              <TextArea field="stressors" value={form.stressors} onChange={updateField} placeholder="Current stressors impacting the client..." />
            </FormSection>
          </div>
        )}

        {activeTab === "interpersonal" && (
          <div className="space-y-6">
            <FormSection title="Strengths">
              <TextArea field="strengths" value={form.interpersonalHistory.strengths} onChange={(_, v) => updateNested("interpersonalHistory", "strengths", v)} placeholder="Client's interpersonal strengths..." />
            </FormSection>
            <FormSection title="Challenges">
              <TextArea field="challenges" value={form.interpersonalHistory.challenges} onChange={(_, v) => updateNested("interpersonalHistory", "challenges", v)} placeholder="Interpersonal challenges the client faces..." />
            </FormSection>
            <FormSection title="Significant Changes & Events">
              <TextArea field="significantChanges" value={form.interpersonalHistory.significantChanges} onChange={(_, v) => updateNested("interpersonalHistory", "significantChanges", v)} placeholder="Important changes or events in the client's life..." />
            </FormSection>
            <div className="border border-border rounded-xl bg-cream-light p-4 sm:p-6">
              <h3 className="font-serif text-base font-medium mb-4">Patterns & Themes Across Relationships</h3>
              <div className="space-y-5">
                <div>
                  <label className="text-xs font-semibold tracking-wider uppercase block mb-2 text-muted">
                    Romantic Relationships
                  </label>
                  <textarea
                    rows={3}
                    value={form.interpersonalHistory.romanticPatterns}
                    onChange={(e) => updateNested("interpersonalHistory", "romanticPatterns", e.target.value)}
                    placeholder="Patterns and themes in romantic relationships..."
                    className="w-full px-4 py-3 rounded-lg border border-border bg-cream focus:outline-none focus:ring-2 focus:ring-sage-400/40 text-sm resize-y"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold tracking-wider uppercase block mb-2 text-muted">
                    Family Relationships
                  </label>
                  <textarea
                    rows={3}
                    value={form.interpersonalHistory.familyPatterns}
                    onChange={(e) => updateNested("interpersonalHistory", "familyPatterns", e.target.value)}
                    placeholder="Patterns and themes in family relationships..."
                    className="w-full px-4 py-3 rounded-lg border border-border bg-cream focus:outline-none focus:ring-2 focus:ring-sage-400/40 text-sm resize-y"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold tracking-wider uppercase block mb-2 text-muted">
                    Friends & Social Connections
                  </label>
                  <textarea
                    rows={3}
                    value={form.interpersonalHistory.friendsPatterns}
                    onChange={(e) => updateNested("interpersonalHistory", "friendsPatterns", e.target.value)}
                    placeholder="Patterns and themes in friendships and social connections..."
                    className="w-full px-4 py-3 rounded-lg border border-border bg-cream focus:outline-none focus:ring-2 focus:ring-sage-400/40 text-sm resize-y"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold tracking-wider uppercase block mb-2 text-muted">
                    Workplace & Professional Relationships
                  </label>
                  <textarea
                    rows={3}
                    value={form.interpersonalHistory.workplacePatterns}
                    onChange={(e) => updateNested("interpersonalHistory", "workplacePatterns", e.target.value)}
                    placeholder="Patterns and themes in workplace and professional relationships..."
                    className="w-full px-4 py-3 rounded-lg border border-border bg-cream focus:outline-none focus:ring-2 focus:ring-sage-400/40 text-sm resize-y"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "themes" && (
          <div className="space-y-6">
            <p className="text-sm text-muted">
              What thoughts, emotions, behaviors, or environmental factors keep the problem going?
            </p>
            <FormSection title="Thoughts">
              <TextArea field="thoughts" value={form.keyThemes.thoughts} onChange={(_, v) => updateNested("keyThemes", "thoughts", v)} placeholder="Recurring thought patterns that maintain the problem..." />
            </FormSection>
            <FormSection title="Emotions">
              <TextArea field="emotions" value={form.keyThemes.emotions} onChange={(_, v) => updateNested("keyThemes", "emotions", v)} placeholder="Emotional patterns that maintain the problem..." />
            </FormSection>
            <FormSection title="Behaviors">
              <TextArea field="behaviors" value={form.keyThemes.behaviors} onChange={(_, v) => updateNested("keyThemes", "behaviors", v)} placeholder="Behavioral patterns that maintain the problem..." />
            </FormSection>
            <FormSection title="Environmental Factors">
              <TextArea field="environmental" value={form.keyThemes.environmental} onChange={(_, v) => updateNested("keyThemes", "environmental", v)} placeholder="Environmental factors that maintain the problem..." />
            </FormSection>
          </div>
        )}

        {activeTab === "theoretical" && (
          <div className="space-y-6">
            <FormSection title="Origin of the Problem">
              <TextArea field="origin" value={form.theoreticalLens.origin} onChange={(_, v) => updateNested("theoreticalLens", "origin", v)} placeholder="What is the origin of the client's presenting problem?" />
            </FormSection>
            <FormSection title="Maintaining Processes">
              <TextArea field="maintainingProcesses" value={form.theoreticalLens.maintainingProcesses} onChange={(_, v) => updateNested("theoreticalLens", "maintainingProcesses", v)} placeholder="What processes keep the problem active?" />
            </FormSection>
            <FormSection title="Focus of Intervention">
              <TextArea field="focusOfIntervention" value={form.theoreticalLens.focusOfIntervention} onChange={(_, v) => updateNested("theoreticalLens", "focusOfIntervention", v)} placeholder="Where should the therapeutic intervention focus?" />
            </FormSection>
          </div>
        )}

        {activeTab === "treatment" && (
          <div className="space-y-6">
            <FormSection title="Treatment Focus / Working Hypothesis">
              <TextArea
                field="treatmentFocus"
                value={form.treatmentFocus}
                onChange={updateField}
                placeholder="Document the working hypothesis and treatment focus..."
                rows={8}
              />
            </FormSection>
          </div>
        )}
      </div>

      {/* Sticky save bar when there are changes */}
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
