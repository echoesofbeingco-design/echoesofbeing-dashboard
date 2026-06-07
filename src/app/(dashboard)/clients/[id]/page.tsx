"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import MindMap from "@/components/MindMap";

type ClientTab = "overview" | "sessions" | "mindmap";

interface Client {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  age: string;
  gender: string;
  pronouns: string;
  occupation: string;
  desiredOutcomes: string;
  status: "active" | "inactive" | "discharged";
  bookingId?: string;
  createdAt: string;
  updatedAt: string;
}

interface SessionSummary {
  id: string;
  date: string;
  sessionNumber: number;
  summary: string;
  presentingProblem: string;
  therapistHomework: string;
  clientHomework: string;
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

const STATUS_OPTIONS = [
  { value: "active", label: "Active", color: "bg-emerald-100 text-emerald-800" },
  { value: "inactive", label: "Inactive", color: "bg-amber-100 text-amber-800" },
  { value: "discharged", label: "Discharged", color: "bg-gray-100 text-gray-800" },
];

const CLIENT_TABS: { key: ClientTab; label: string; icon: React.ReactNode }[] = [
  {
    key: "overview",
    label: "Client",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
  {
    key: "sessions",
    label: "Sessions",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    key: "mindmap",
    label: "Mind Map",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
];

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { showToast } = useToast();
  const [client, setClient] = useState<Client | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ClientTab>("overview");

  // Editable fields
  const [editingOutcomes, setEditingOutcomes] = useState(false);
  const [outcomes, setOutcomes] = useState("");
  const [savingOutcomes, setSavingOutcomes] = useState(false);
  const [editingOccupation, setEditingOccupation] = useState(false);
  const [occupation, setOccupation] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // New session modal
  const [showNewSession, setShowNewSession] = useState(false);
  const [newSessionDate, setNewSessionDate] = useState("");
  const [newSessionSummary, setNewSessionSummary] = useState("");
  const [creatingSess, setCreatingSess] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [clientRes, sessionsRes] = await Promise.all([
        fetch(`/api/clients/${encodeURIComponent(id)}`).then((r) => r.json()),
        fetch(`/api/clients/${encodeURIComponent(id)}/sessions`).then((r) => r.json()),
      ]);
      if (clientRes.client) {
        setClient(clientRes.client);
        setOutcomes(clientRes.client.desiredOutcomes || "");
        setOccupation(clientRes.client.occupation || "");
      }
      setSessions(sessionsRes.sessions || []);
    } catch {
      showToast("Failed to load client data", "error");
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleStatusChange(newStatus: string) {
    if (!client || client.status === newStatus) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      setClient((prev) => prev ? { ...prev, status: newStatus as Client["status"] } : prev);
      showToast("Status updated", "success");
    } catch {
      showToast("Failed to update status", "error");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleSaveOutcomes() {
    setSavingOutcomes(true);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ desiredOutcomes: outcomes }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setClient((prev) => prev ? { ...prev, desiredOutcomes: outcomes } : prev);
      setEditingOutcomes(false);
      showToast("Goals saved", "success");
    } catch {
      showToast("Failed to save goals", "error");
    } finally {
      setSavingOutcomes(false);
    }
  }

  async function handleSaveOccupation() {
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occupation }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setClient((prev) => prev ? { ...prev, occupation } : prev);
      setEditingOccupation(false);
      showToast("Occupation saved", "success");
    } catch {
      showToast("Failed to save occupation", "error");
    }
  }

  async function handleCreateSession() {
    if (!newSessionDate) {
      showToast("Please select a date", "error");
      return;
    }
    setCreatingSess(true);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(id)}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newSessionDate, summary: newSessionSummary }),
      });
      if (!res.ok) throw new Error("Failed to create session");
      const data = await res.json();
      showToast("Session created", "success");
      setShowNewSession(false);
      setNewSessionDate("");
      setNewSessionSummary("");
      router.push(`/clients/${id}/sessions/${data.id}`);
    } catch {
      showToast("Failed to create session", "error");
    } finally {
      setCreatingSess(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-10">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-accent-bg rounded w-32" />
          <div className="h-8 bg-accent-bg rounded w-64" />
          <div className="h-64 bg-accent-bg rounded-xl" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-4 sm:p-6 lg:p-10 text-center py-20">
        <p className="text-muted mb-4">Client not found.</p>
        <Link href="/clients" className="text-sage-600 hover:text-forest text-sm font-medium">
          Back to clients
        </Link>
      </div>
    );
  }

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === client.status);

  return (
    <div className="p-4 sm:p-6 lg:p-10 animate-fade-in">
      {/* New Session Modal */}
      {showNewSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !creatingSess && setShowNewSession(false)} />
          <div className="relative bg-cream-light border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 animate-fade-in">
            <h3 className="font-serif text-xl font-medium mb-4">New Session</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold tracking-wider uppercase block mb-2">
                  Session Date <span className="text-sage-500">*</span>
                </label>
                <input
                  type="date"
                  value={newSessionDate}
                  onChange={(e) => setNewSessionDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-cream focus:outline-none focus:ring-2 focus:ring-sage-400/40 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold tracking-wider uppercase block mb-2">
                  Initial Notes
                </label>
                <textarea
                  rows={3}
                  value={newSessionSummary}
                  onChange={(e) => setNewSessionSummary(e.target.value)}
                  placeholder="Brief notes about this session..."
                  className="w-full px-4 py-3 rounded-lg border border-border bg-cream focus:outline-none focus:ring-2 focus:ring-sage-400/40 text-sm resize-y"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowNewSession(false); setNewSessionDate(""); setNewSessionSummary(""); }}
                disabled={creatingSess}
                className="flex-1 px-4 py-3 rounded-lg border border-border text-sm font-medium hover:bg-accent-bg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSession}
                disabled={creatingSess || !newSessionDate}
                className="flex-1 px-4 py-3 rounded-lg bg-forest text-cream text-sm font-medium hover:bg-sage-700 transition-colors disabled:opacity-50"
              >
                {creatingSess ? "Creating..." : "Create Session"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back link */}
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-forest mb-4 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl md:text-3xl font-medium truncate">
            {client.name}
          </h1>
          <p className="text-muted text-sm mt-1">
            {client.age}y &middot; {client.gender} &middot; {client.pronouns}
          </p>
        </div>
        <div className="flex items-center gap-3 self-start flex-shrink-0">
          <span className={`inline-flex px-3 py-1.5 rounded-full text-xs font-semibold ${currentStatus?.color || "bg-gray-100 text-gray-800"}`}>
            {currentStatus?.label || client.status}
          </span>
        </div>
      </div>

      {/* ── Top Tab Navigation (like reference) ── */}
      <div className="border-b border-border mb-6 mt-4">
        <nav className="flex gap-0">
          {CLIENT_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.key
                  ? "border-sage-600 text-forest bg-accent-bg/40"
                  : "border-transparent text-muted hover:text-forest hover:bg-accent-bg/20"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── TAB: Overview ── */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Client details */}
            <div className="border border-border rounded-xl bg-cream-light">
              <div className="px-4 sm:px-6 py-4 border-b border-border">
                <h2 className="font-serif text-lg font-medium">Client Details</h2>
              </div>
              <div className="px-4 sm:px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                <InfoField label="Full Name" value={client.name} />
                <InfoField label="Email" value={client.email} />
                <InfoField label="WhatsApp" value={`+91 ${client.whatsapp}`} />
                <InfoField label="Age" value={client.age} />
                <InfoField label="Gender" value={client.gender} />
                <InfoField label="Pronouns" value={client.pronouns || "Not specified"} />
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold tracking-wider uppercase text-muted">Occupation</p>
                    {!editingOccupation && (
                      <button onClick={() => setEditingOccupation(true)} className="text-xs text-sage-600 hover:text-forest transition-colors">Edit</button>
                    )}
                  </div>
                  {editingOccupation ? (
                    <div className="flex gap-2">
                      <input type="text" value={occupation} onChange={(e) => setOccupation(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-border bg-cream focus:outline-none focus:ring-2 focus:ring-sage-400/40 text-sm" />
                      <button onClick={handleSaveOccupation} className="px-3 py-2 rounded-lg bg-forest text-cream text-xs font-medium hover:bg-sage-700 transition-colors">Save</button>
                      <button onClick={() => { setOccupation(client.occupation || ""); setEditingOccupation(false); }} className="px-3 py-2 rounded-lg border border-border text-xs hover:bg-accent-bg transition-colors">Cancel</button>
                    </div>
                  ) : (
                    <p className="text-sm">{client.occupation || "Not specified"}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Desired Outcomes / Goals */}
            <div className="border border-border rounded-xl bg-cream-light">
              <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-serif text-lg font-medium">Desired Outcomes / Goals</h2>
                {!editingOutcomes && (
                  <button onClick={() => setEditingOutcomes(true)} className="text-sm text-sage-600 hover:text-forest transition-colors">
                    {client.desiredOutcomes ? "Edit" : "Add Goals"}
                  </button>
                )}
              </div>
              <div className="px-4 sm:px-6 py-5">
                {editingOutcomes ? (
                  <div className="space-y-3">
                    <textarea rows={5} maxLength={3000} value={outcomes} onChange={(e) => setOutcomes(e.target.value)} placeholder="What does the client hope to achieve through therapy?" className="w-full px-4 py-3 rounded-lg border border-border bg-cream focus:outline-none focus:ring-2 focus:ring-sage-400/40 text-sm resize-y" />
                    <div className="flex items-center gap-2">
                      <button onClick={handleSaveOutcomes} disabled={savingOutcomes} className="px-4 py-2 rounded-lg bg-forest text-cream text-sm font-medium hover:bg-sage-700 transition-colors disabled:opacity-50">
                        {savingOutcomes ? "Saving..." : "Save"}
                      </button>
                      <button onClick={() => { setOutcomes(client.desiredOutcomes || ""); setEditingOutcomes(false); }} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent-bg transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : client.desiredOutcomes ? (
                  <p className="text-sm whitespace-pre-wrap">{client.desiredOutcomes}</p>
                ) : (
                  <p className="text-sm text-muted italic">No goals documented yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Status management */}
            <div className="border border-border rounded-xl bg-cream-light">
              <div className="px-4 sm:px-6 py-4 border-b border-border">
                <h2 className="font-serif text-lg font-medium">Client Status</h2>
              </div>
              <div className="px-4 sm:px-6 py-4 space-y-2">
                {STATUS_OPTIONS.map(({ value, label, color }) => (
                  <button key={value} onClick={() => handleStatusChange(value)} disabled={updatingStatus || client.status === value}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${client.status === value ? `${color} font-semibold cursor-default` : "hover:bg-accent-bg/50 text-muted hover:text-forest"} disabled:opacity-50`}>
                    <span className="flex items-center gap-2">
                      {client.status === value && (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                      )}
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick summary */}
            <div className="border border-border rounded-xl bg-cream-light">
              <div className="px-4 sm:px-6 py-4 border-b border-border">
                <h2 className="font-serif text-lg font-medium">Summary</h2>
              </div>
              <div className="px-4 sm:px-6 py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Total Sessions</span>
                  <span className="text-sm font-semibold">{sessions.length}</span>
                </div>
                {sessions.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted">Last Session</span>
                    <span className="text-sm font-medium">
                      {new Date(sessions[0].date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Client Since</span>
                  <span className="text-sm font-medium">
                    {new Date(client.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
                {client.bookingId && (
                  <div className="pt-2 border-t border-border">
                    <Link href={`/bookings/${client.bookingId}`} className="text-sm text-sage-600 hover:text-forest font-medium transition-colors">
                      View linked booking &rarr;
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Sessions ── */}
      {activeTab === "sessions" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted">{sessions.length} session{sessions.length !== 1 ? "s" : ""} documented</p>
            <button
              onClick={() => setShowNewSession(true)}
              className="inline-flex items-center gap-2 bg-forest text-cream px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-sage-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Session
            </button>
          </div>

          {sessions.length === 0 ? (
            <div className="border border-border rounded-xl bg-cream-light px-6 py-16 text-center">
              <svg className="w-12 h-12 mx-auto text-muted/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <p className="text-muted text-sm mb-2">No sessions documented yet.</p>
              <p className="text-xs text-muted/70">Add a session to start documenting.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/clients/${id}/sessions/${session.id}`}
                  className="flex items-start gap-4 border border-border rounded-xl bg-cream-light px-5 py-4 hover:border-sage-400/60 hover:shadow-sm transition-all group"
                >
                  {/* Date badge */}
                  <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-accent-bg flex flex-col items-center justify-center text-center">
                    <span className="text-lg font-semibold leading-none">
                      {new Date(session.date).getDate()}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-muted mt-0.5">
                      {new Date(session.date).toLocaleDateString("en-IN", { month: "short" })}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sage-300/40 text-[10px] font-bold text-forest">
                        {session.sessionNumber}
                      </span>
                      <p className="text-sm font-medium group-hover:text-sage-600 transition-colors">
                        Session {session.sessionNumber}
                      </p>
                      <span className="text-xs text-muted">
                        {new Date(session.date).toLocaleDateString("en-IN", { year: "numeric" })}
                      </span>
                    </div>
                    {session.summary && (
                      <p className="text-xs text-muted line-clamp-2 mt-1">{session.summary}</p>
                    )}
                    {session.presentingProblem && !session.summary && (
                      <p className="text-xs text-muted line-clamp-2 mt-1">{session.presentingProblem}</p>
                    )}

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {session.therapistHomework && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-[10px] font-semibold text-amber-800">
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          Therapist HW
                        </span>
                      )}
                      {session.clientHomework && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-[10px] font-semibold text-blue-800">
                          Client HW
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <svg className="w-4 h-4 text-muted/40 group-hover:text-sage-600 transition-colors flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Mind Map ── */}
      {activeTab === "mindmap" && (
        <MindMap client={client} sessions={sessions} />
      )}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wider uppercase text-muted mb-1">{label}</p>
      <p className="text-sm break-words">{value || "N/A"}</p>
    </div>
  );
}
