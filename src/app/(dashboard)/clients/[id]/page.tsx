"use client";

import { useEffect, useState, use, useCallback } from "react";
import { displayAge } from "@/lib/age";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import MindMap from "@/components/MindMap";

type ClientTab = "overview" | "client-overview" | "interpersonal" | "themes" | "theoretical" | "treatment" | "sessions" | "mindmap";

interface InterpersonalHistory {
  strengths: string;
  challenges: string;
  significantChanges: string;
  romanticPatterns: string;
  familyPatterns: string;
  friendsPatterns: string;
  workplacePatterns: string;
}

interface KeyThemes {
  thoughts: string;
  emotions: string;
  behaviors: string;
  environmental: string;
}

interface TheoreticalLens {
  origin: string;
  maintainingProcesses: string;
  focusOfIntervention: string;
}

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
  symptoms: string;
  concerns: string;
  stressors: string;
  interpersonalHistory: InterpersonalHistory;
  keyThemes: KeyThemes;
  theoreticalLens: TheoreticalLens;
  treatmentFocus: string;
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
}

const STATUS_OPTIONS = [
  { value: "active", label: "Active", color: "bg-emerald-100 text-emerald-800" },
  { value: "inactive", label: "Inactive", color: "bg-amber-100 text-amber-800" },
  { value: "discharged", label: "Discharged", color: "bg-gray-100 text-gray-800" },
];

const CLIENT_TABS: { key: ClientTab; label: string; shortLabel: string }[] = [
  { key: "overview", label: "Client", shortLabel: "Client" },
  { key: "client-overview", label: "Client Overview", shortLabel: "Overview" },
  { key: "interpersonal", label: "Interpersonal History", shortLabel: "Interpersonal" },
  { key: "themes", label: "Key Themes", shortLabel: "Themes" },
  { key: "theoretical", label: "Theoretical Lens", shortLabel: "Lens" },
  { key: "treatment", label: "Treatment Focus", shortLabel: "Treatment" },
  { key: "sessions", label: "Sessions", shortLabel: "Sessions" },
  { key: "mindmap", label: "Mind Map", shortLabel: "Map" },
];

const EMPTY_INTERPERSONAL: InterpersonalHistory = {
  strengths: "", challenges: "", significantChanges: "",
  romanticPatterns: "", familyPatterns: "", friendsPatterns: "", workplacePatterns: "",
};
const EMPTY_KEY_THEMES: KeyThemes = { thoughts: "", emotions: "", behaviors: "", environmental: "" };
const EMPTY_THEORETICAL_LENS: TheoreticalLens = { origin: "", maintainingProcesses: "", focusOfIntervention: "" };

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

  // Editable fields for overview tab
  const [editingOutcomes, setEditingOutcomes] = useState(false);
  const [outcomes, setOutcomes] = useState("");
  const [savingOutcomes, setSavingOutcomes] = useState(false);
  const [editingOccupation, setEditingOccupation] = useState(false);
  const [occupation, setOccupation] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Clinical fields form
  const [clinicalForm, setClinicalForm] = useState<{
    symptoms: string;
    concerns: string;
    stressors: string;
    interpersonalHistory: InterpersonalHistory;
    keyThemes: KeyThemes;
    theoreticalLens: TheoreticalLens;
    treatmentFocus: string;
  } | null>(null);
  const [clinicalChanges, setClinicalChanges] = useState(false);
  const [savingClinical, setSavingClinical] = useState(false);

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
        const c = clientRes.client;
        setClient(c);
        setOutcomes(c.desiredOutcomes || "");
        setOccupation(c.occupation || "");
        setClinicalForm({
          symptoms: c.symptoms || "",
          concerns: c.concerns || "",
          stressors: c.stressors || "",
          interpersonalHistory: { ...EMPTY_INTERPERSONAL, ...(c.interpersonalHistory || {}) },
          keyThemes: { ...EMPTY_KEY_THEMES, ...(c.keyThemes || {}) },
          theoreticalLens: { ...EMPTY_THEORETICAL_LENS, ...(c.theoreticalLens || {}) },
          treatmentFocus: c.treatmentFocus || "",
        });
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

  // ── Clinical field update helpers ──
  function updateClinicalField(field: string, value: string) {
    if (!clinicalForm) return;
    setClinicalForm((prev) => prev ? { ...prev, [field]: value } : prev);
    setClinicalChanges(true);
  }

  function updateClinicalNested(parent: string, field: string, value: string) {
    if (!clinicalForm) return;
    setClinicalForm((prev) => {
      if (!prev) return prev;
      const parentObj = prev[parent as keyof typeof prev];
      if (typeof parentObj !== "object" || parentObj === null) return prev;
      return { ...prev, [parent]: { ...parentObj, [field]: value } };
    });
    setClinicalChanges(true);
  }

  async function handleSaveClinical() {
    if (!clinicalForm || !clinicalChanges || !client) return;
    setSavingClinical(true);
    try {
      const updates: Record<string, unknown> = {};
      if (clinicalForm.symptoms !== client.symptoms) updates.symptoms = clinicalForm.symptoms;
      if (clinicalForm.concerns !== client.concerns) updates.concerns = clinicalForm.concerns;
      if (clinicalForm.stressors !== client.stressors) updates.stressors = clinicalForm.stressors;
      if (clinicalForm.treatmentFocus !== client.treatmentFocus) updates.treatmentFocus = clinicalForm.treatmentFocus;
      if (JSON.stringify(clinicalForm.interpersonalHistory) !== JSON.stringify(client.interpersonalHistory)) {
        updates.interpersonalHistory = clinicalForm.interpersonalHistory;
      }
      if (JSON.stringify(clinicalForm.keyThemes) !== JSON.stringify(client.keyThemes)) {
        updates.keyThemes = clinicalForm.keyThemes;
      }
      if (JSON.stringify(clinicalForm.theoreticalLens) !== JSON.stringify(client.theoreticalLens)) {
        updates.theoreticalLens = clinicalForm.theoreticalLens;
      }

      if (Object.keys(updates).length === 0) {
        setClinicalChanges(false);
        showToast("No changes to save", "info");
        setSavingClinical(false);
        return;
      }

      const res = await fetch(`/api/clients/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to save");
      setClient((prev) => prev ? { ...prev, ...updates } as Client : prev);
      setClinicalChanges(false);
      showToast("Saved successfully", "success");
    } catch {
      showToast("Failed to save", "error");
    } finally {
      setSavingClinical(false);
    }
  }

  // ── Other handlers ──
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

  // ── PDF Download ──
  async function handleDownloadPDF() {
    if (!client) return;
    showToast("Generating PDF...", "info");

    const { default: jsPDF } = await import("jspdf");
    const pdf = new jsPDF("p", "mm", "a4");
    const W = 210;
    const margin = 20;
    const contentW = W - margin * 2;
    let y = 0;

    const forest: [number, number, number] = [45, 53, 45];
    const sage: [number, number, number] = [97, 121, 98];
    const cream: [number, number, number] = [247, 245, 236];
    const muted: [number, number, number] = [90, 96, 85];

    function checkPage(needed: number) {
      if (y + needed > 277) {
        pdf.addPage();
        y = 20;
      }
    }

    function drawHeader(text: string) {
      checkPage(16);
      pdf.setFillColor(...sage);
      pdf.roundedRect(margin, y, contentW, 10, 2, 2, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(255, 255, 255);
      pdf.text(text, margin + 4, y + 7);
      y += 14;
    }

    function drawField(label: string, value: string) {
      if (!value || !value.trim()) return;
      checkPage(12);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(...muted);
      pdf.text(label.toUpperCase(), margin + 2, y + 4);
      y += 6;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(...forest);
      const lines = pdf.splitTextToSize(value, contentW - 4);
      for (const line of lines) {
        checkPage(5);
        pdf.text(line, margin + 2, y + 4);
        y += 5;
      }
      y += 3;
    }

    // ── Page 1: Title ──
    pdf.setFillColor(...cream);
    pdf.rect(0, 0, W, 297, "F");

    // Top accent bar
    pdf.setFillColor(...forest);
    pdf.rect(0, 0, W, 3, "F");

    // Title block
    y = 25;
    pdf.setFillColor(...forest);
    pdf.roundedRect(margin, y, contentW, 35, 3, 3, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(22);
    pdf.setTextColor(255, 255, 255);
    pdf.text(client.name, margin + 8, y + 16);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(200, 220, 200);
    const subtitle = [displayAge(client), client.gender, client.pronouns].filter(Boolean).join(" · ");
    pdf.text(subtitle, margin + 8, y + 26);
    y += 45;

    // Client info grid
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(margin, y, contentW, 42, 2, 2, "F");
    pdf.setDrawColor(210, 210, 200);
    pdf.roundedRect(margin, y, contentW, 42, 2, 2, "S");

    const infoFields = [
      ["Email", client.email], ["WhatsApp", `+91 ${client.whatsapp}`],
      ["Occupation", client.occupation || "N/A"], ["Status", client.status],
      ["Client Since", client.createdAt ? new Date(client.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "N/A"],
      ["Sessions", `${sessions.length}`],
    ];

    const colW = contentW / 2;
    let infoY = y + 6;
    for (let i = 0; i < infoFields.length; i++) {
      const col = i % 2;
      if (i > 0 && col === 0) infoY += 12;
      const x = margin + col * colW + 6;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(...muted);
      pdf.text(infoFields[i][0].toUpperCase(), x, infoY);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(...forest);
      pdf.text(infoFields[i][1], x, infoY + 5);
    }
    y += 50;

    // Goals
    if (client.desiredOutcomes) {
      drawHeader("Desired Outcomes / Goals");
      drawField("", client.desiredOutcomes);
    }

    // Client Overview
    if (client.symptoms || client.concerns || client.stressors) {
      drawHeader("Client Overview");
      drawField("Symptoms", client.symptoms);
      drawField("Concerns", client.concerns);
      drawField("Stressors", client.stressors);
    }

    // Interpersonal History
    const ih = client.interpersonalHistory;
    const hasIH = ih && Object.values(ih).some((v) => v && v.trim());
    if (hasIH) {
      drawHeader("Interpersonal History");
      drawField("Strengths", ih.strengths);
      drawField("Challenges", ih.challenges);
      drawField("Significant Changes", ih.significantChanges);
      drawField("Romantic Relationships", ih.romanticPatterns);
      drawField("Family Relationships", ih.familyPatterns);
      drawField("Friends & Social", ih.friendsPatterns);
      drawField("Workplace & Professional", ih.workplacePatterns);
    }

    // Key Themes
    const kt = client.keyThemes;
    const hasKT = kt && Object.values(kt).some((v) => v && v.trim());
    if (hasKT) {
      drawHeader("Key Themes & Maintaining Factors");
      drawField("Thoughts", kt.thoughts);
      drawField("Emotions", kt.emotions);
      drawField("Behaviors", kt.behaviors);
      drawField("Environmental", kt.environmental);
    }

    // Theoretical Lens
    const tl = client.theoreticalLens;
    const hasTL = tl && Object.values(tl).some((v) => v && v.trim());
    if (hasTL) {
      drawHeader("Theoretical Lens");
      drawField("Origin of the Problem", tl.origin);
      drawField("Maintaining Processes", tl.maintainingProcesses);
      drawField("Focus of Intervention", tl.focusOfIntervention);
    }

    // Treatment Focus
    if (client.treatmentFocus) {
      drawHeader("Treatment Focus");
      drawField("", client.treatmentFocus);
    }

    // Sessions summary
    if (sessions.length > 0) {
      drawHeader("Session History");
      for (const s of sessions) {
        checkPage(18);
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(margin + 2, y, contentW - 4, 14, 1.5, 1.5, "F");
        pdf.setDrawColor(210, 210, 200);
        pdf.roundedRect(margin + 2, y, contentW - 4, 14, 1.5, 1.5, "S");

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(...forest);
        pdf.text(`Session ${s.sessionNumber}`, margin + 6, y + 6);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(...muted);
        const dateStr = new Date(s.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        pdf.text(dateStr, margin + 6, y + 11);

        if (s.summary) {
          const summaryText = s.summary.length > 80 ? s.summary.slice(0, 77) + "..." : s.summary;
          pdf.setTextColor(...sage);
          pdf.text(summaryText, margin + 50, y + 6, { maxWidth: contentW - 56 });
        }
        y += 17;
      }
    }

    // Mind Map page
    const canvas = document.querySelector("canvas");
    if (canvas) {
      pdf.addPage();
      y = 20;
      pdf.setFillColor(...cream);
      pdf.rect(0, 0, W, 297, "F");
      pdf.setFillColor(...forest);
      pdf.rect(0, 0, W, 3, "F");

      drawHeader("Mind Map");
      try {
        const imgData = canvas.toDataURL("image/png");
        const imgW = contentW;
        const imgH = (canvas.height / canvas.width) * imgW;
        const maxH = 230;
        const finalH = Math.min(imgH, maxH);
        const finalW = (finalH / imgH) * imgW;
        const xOffset = margin + (contentW - finalW) / 2;
        pdf.addImage(imgData, "PNG", xOffset, y, finalW, finalH);
      } catch {
        pdf.setFontSize(10);
        pdf.setTextColor(...muted);
        pdf.text("Mind map could not be captured.", margin, y + 10);
      }
    }

    // Footer on every page
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFillColor(...forest);
      pdf.rect(0, 294, W, 3, "F");
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(...muted);
      pdf.text("Echos of Being — Confidential Client Report", margin, 291);
      pdf.text(`Page ${i} of ${pageCount}`, W - margin, 291, { align: "right" });
    }

    const slug = client.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    pdf.save(`${slug}-report.pdf`);
    showToast("PDF downloaded", "success");
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-accent-bg rounded w-32" />
          <div className="h-8 bg-accent-bg rounded w-64" />
          <div className="h-64 bg-accent-bg rounded-xl" />
        </div>
      </div>
    );
  }

  if (!client || !clinicalForm) {
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
  const isClinicalTab = ["client-overview", "interpersonal", "themes", "theoretical", "treatment"].includes(activeTab);

  return (
    <div className="p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto animate-fade-in">
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
                <input type="date" value={newSessionDate} onChange={(e) => setNewSessionDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-cream focus:outline-none focus:ring-2 focus:ring-sage-400/40 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold tracking-wider uppercase block mb-2">Initial Notes</label>
                <textarea rows={3} value={newSessionSummary} onChange={(e) => setNewSessionSummary(e.target.value)}
                  placeholder="Brief notes about this session..."
                  className="w-full px-4 py-3 rounded-lg border border-border bg-cream focus:outline-none focus:ring-2 focus:ring-sage-400/40 text-sm resize-y" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowNewSession(false); setNewSessionDate(""); setNewSessionSummary(""); }} disabled={creatingSess}
                className="flex-1 px-4 py-3 rounded-lg border border-border text-sm font-medium hover:bg-accent-bg transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={handleCreateSession} disabled={creatingSess || !newSessionDate}
                className="flex-1 px-4 py-3 rounded-lg bg-forest text-cream text-sm font-medium hover:bg-sage-700 transition-colors disabled:opacity-50">
                {creatingSess ? "Creating..." : "Create Session"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back link */}
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-forest mb-4 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl md:text-3xl font-medium truncate">{client.name}</h1>
          <p className="text-muted text-sm mt-1">
            {displayAge(client)} &middot; {client.gender} &middot; {client.pronouns}
          </p>
        </div>
        <div className="flex items-center gap-3 self-start flex-shrink-0">
          {/* Download PDF */}
          <button onClick={handleDownloadPDF}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted hover:text-forest hover:border-sage-400 hover:bg-accent-bg/50 transition-all"
            title="Download client report as PDF">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download PDF
          </button>
          <span className={`inline-flex px-3 py-1.5 rounded-full text-xs font-semibold ${currentStatus?.color || "bg-gray-100 text-gray-800"}`}>
            {currentStatus?.label || client.status}
          </span>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="border-b border-border mb-6 mt-4 overflow-x-auto">
        <nav className="flex gap-0 min-w-max">
          {CLIENT_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? "border-sage-600 text-forest bg-accent-bg/40"
                  : "border-transparent text-muted hover:text-forest hover:bg-accent-bg/20"
              }`}
            >
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* ── Save button for clinical tabs ── */}
      {isClinicalTab && (
        <div className="flex justify-end mb-4">
          <button
            onClick={handleSaveClinical}
            disabled={savingClinical || !clinicalChanges}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              clinicalChanges ? "bg-forest text-cream hover:bg-sage-700" : "bg-accent-bg text-muted cursor-default"
            } disabled:opacity-50`}
          >
            {savingClinical ? "Saving..." : clinicalChanges ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Save Changes
              </>
            ) : "All saved"}
          </button>
        </div>
      )}

      {/* ── TAB: Client (Overview) ── */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="border border-border rounded-xl bg-cream-light">
              <div className="px-4 sm:px-6 py-4 border-b border-border">
                <h2 className="font-serif text-lg font-medium">Client Details</h2>
              </div>
              <div className="px-4 sm:px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                <InfoField label="Full Name" value={client.name} />
                <InfoField label="Email" value={client.email} />
                <InfoField label="WhatsApp" value={`+91 ${client.whatsapp}`} />
                <InfoField label="Age" value={displayAge(client)} />
                <InfoField label="Gender" value={client.gender} />
                <InfoField label="Pronouns" value={client.pronouns || "Not specified"} />
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold tracking-wider uppercase text-muted">Occupation</p>
                    {!editingOccupation && <button onClick={() => setEditingOccupation(true)} className="text-xs text-sage-600 hover:text-forest transition-colors">Edit</button>}
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
                      <button onClick={handleSaveOutcomes} disabled={savingOutcomes} className="px-4 py-2 rounded-lg bg-forest text-cream text-sm font-medium hover:bg-sage-700 transition-colors disabled:opacity-50">{savingOutcomes ? "Saving..." : "Save"}</button>
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

          <div className="space-y-6">
            <div className="border border-border rounded-xl bg-cream-light">
              <div className="px-4 sm:px-6 py-4 border-b border-border"><h2 className="font-serif text-lg font-medium">Client Status</h2></div>
              <div className="px-4 sm:px-6 py-4 space-y-2">
                {STATUS_OPTIONS.map(({ value, label, color }) => (
                  <button key={value} onClick={() => handleStatusChange(value)} disabled={updatingStatus || client.status === value}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${client.status === value ? `${color} font-semibold cursor-default` : "hover:bg-accent-bg/50 text-muted hover:text-forest"} disabled:opacity-50`}>
                    <span className="flex items-center gap-2">
                      {client.status === value && <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="border border-border rounded-xl bg-cream-light">
              <div className="px-4 sm:px-6 py-4 border-b border-border"><h2 className="font-serif text-lg font-medium">Summary</h2></div>
              <div className="px-4 sm:px-6 py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Total Sessions</span>
                  <span className="text-sm font-semibold">{sessions.length}</span>
                </div>
                {sessions.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted">Last Session</span>
                    <span className="text-sm font-medium">{new Date(sessions[0].date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Client Since</span>
                  <span className="text-sm font-medium">{new Date(client.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
                {client.bookingId && (
                  <div className="pt-2 border-t border-border">
                    <Link href={`/bookings/${client.bookingId}`} className="text-sm text-sage-600 hover:text-forest font-medium transition-colors">View linked booking &rarr;</Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Client Overview (symptoms, concerns, stressors) ── */}
      {activeTab === "client-overview" && (
        <div className="max-w-4xl space-y-6">
          <FormSection title="Symptoms">
            <TextArea field="symptoms" value={clinicalForm.symptoms} onChange={(_, v) => updateClinicalField("symptoms", v)} placeholder="Document observed or reported symptoms..." />
          </FormSection>
          <FormSection title="Concerns">
            <TextArea field="concerns" value={clinicalForm.concerns} onChange={(_, v) => updateClinicalField("concerns", v)} placeholder="Client's primary concerns..." />
          </FormSection>
          <FormSection title="Stressors">
            <TextArea field="stressors" value={clinicalForm.stressors} onChange={(_, v) => updateClinicalField("stressors", v)} placeholder="Current stressors impacting the client..." />
          </FormSection>
        </div>
      )}

      {/* ── TAB: Interpersonal History ── */}
      {activeTab === "interpersonal" && (
        <div className="max-w-4xl space-y-6">
          <FormSection title="Strengths">
            <TextArea field="strengths" value={clinicalForm.interpersonalHistory.strengths} onChange={(_, v) => updateClinicalNested("interpersonalHistory", "strengths", v)} placeholder="Client's interpersonal strengths..." />
          </FormSection>
          <FormSection title="Challenges">
            <TextArea field="challenges" value={clinicalForm.interpersonalHistory.challenges} onChange={(_, v) => updateClinicalNested("interpersonalHistory", "challenges", v)} placeholder="Interpersonal challenges the client faces..." />
          </FormSection>
          <FormSection title="Significant Changes & Events">
            <TextArea field="significantChanges" value={clinicalForm.interpersonalHistory.significantChanges} onChange={(_, v) => updateClinicalNested("interpersonalHistory", "significantChanges", v)} placeholder="Important changes or events in the client's life..." />
          </FormSection>
          <div className="border border-border rounded-xl bg-cream-light p-4 sm:p-6">
            <h3 className="font-serif text-base font-medium mb-4">Patterns & Themes Across Relationships</h3>
            <div className="space-y-5">
              {([
                ["romanticPatterns", "Romantic Relationships", "Patterns and themes in romantic relationships..."],
                ["familyPatterns", "Family Relationships", "Patterns and themes in family relationships..."],
                ["friendsPatterns", "Friends & Social Connections", "Patterns and themes in friendships and social connections..."],
                ["workplacePatterns", "Workplace & Professional Relationships", "Patterns and themes in workplace and professional relationships..."],
              ] as const).map(([field, label, placeholder]) => (
                <div key={field}>
                  <label className="text-xs font-semibold tracking-wider uppercase block mb-2 text-muted">{label}</label>
                  <textarea
                    rows={3}
                    value={clinicalForm.interpersonalHistory[field]}
                    onChange={(e) => updateClinicalNested("interpersonalHistory", field, e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-cream focus:outline-none focus:ring-2 focus:ring-sage-400/40 text-sm resize-y"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Key Themes ── */}
      {activeTab === "themes" && (
        <div className="max-w-4xl space-y-6">
          <p className="text-sm text-muted">What thoughts, emotions, behaviors, or environmental factors keep the problem going?</p>
          <FormSection title="Thoughts">
            <TextArea field="thoughts" value={clinicalForm.keyThemes.thoughts} onChange={(_, v) => updateClinicalNested("keyThemes", "thoughts", v)} placeholder="Recurring thought patterns that maintain the problem..." />
          </FormSection>
          <FormSection title="Emotions">
            <TextArea field="emotions" value={clinicalForm.keyThemes.emotions} onChange={(_, v) => updateClinicalNested("keyThemes", "emotions", v)} placeholder="Emotional patterns that maintain the problem..." />
          </FormSection>
          <FormSection title="Behaviors">
            <TextArea field="behaviors" value={clinicalForm.keyThemes.behaviors} onChange={(_, v) => updateClinicalNested("keyThemes", "behaviors", v)} placeholder="Behavioral patterns that maintain the problem..." />
          </FormSection>
          <FormSection title="Environmental Factors">
            <TextArea field="environmental" value={clinicalForm.keyThemes.environmental} onChange={(_, v) => updateClinicalNested("keyThemes", "environmental", v)} placeholder="Environmental factors that maintain the problem..." />
          </FormSection>
        </div>
      )}

      {/* ── TAB: Theoretical Lens ── */}
      {activeTab === "theoretical" && (
        <div className="max-w-4xl space-y-6">
          <FormSection title="Origin of the Problem">
            <TextArea field="origin" value={clinicalForm.theoreticalLens.origin} onChange={(_, v) => updateClinicalNested("theoreticalLens", "origin", v)} placeholder="What is the origin of the client's presenting problem?" />
          </FormSection>
          <FormSection title="Maintaining Processes">
            <TextArea field="maintainingProcesses" value={clinicalForm.theoreticalLens.maintainingProcesses} onChange={(_, v) => updateClinicalNested("theoreticalLens", "maintainingProcesses", v)} placeholder="What processes keep the problem active?" />
          </FormSection>
          <FormSection title="Focus of Intervention">
            <TextArea field="focusOfIntervention" value={clinicalForm.theoreticalLens.focusOfIntervention} onChange={(_, v) => updateClinicalNested("theoreticalLens", "focusOfIntervention", v)} placeholder="Where should the therapeutic intervention focus?" />
          </FormSection>
        </div>
      )}

      {/* ── TAB: Treatment Focus ── */}
      {activeTab === "treatment" && (
        <div className="max-w-4xl space-y-6">
          <FormSection title="Treatment Focus / Working Hypothesis">
            <TextArea field="treatmentFocus" value={clinicalForm.treatmentFocus} onChange={(_, v) => updateClinicalField("treatmentFocus", v)}
              placeholder="Document the working hypothesis and treatment focus..." rows={8} />
          </FormSection>
        </div>
      )}

      {/* ── TAB: Sessions ── */}
      {activeTab === "sessions" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted">{sessions.length} session{sessions.length !== 1 ? "s" : ""} documented</p>
            <button onClick={() => setShowNewSession(true)}
              className="inline-flex items-center gap-2 bg-forest text-cream px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-sage-700 transition-colors">
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
                <Link key={session.id} href={`/clients/${id}/sessions/${session.id}`}
                  className="flex items-start gap-4 border border-border rounded-xl bg-cream-light px-5 py-4 hover:border-sage-400/60 hover:shadow-sm transition-all group">
                  <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-accent-bg flex flex-col items-center justify-center text-center">
                    <span className="text-lg font-semibold leading-none">{new Date(session.date).getDate()}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted mt-0.5">{new Date(session.date).toLocaleDateString("en-IN", { month: "short" })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sage-300/40 text-[10px] font-bold text-forest">{session.sessionNumber}</span>
                      <p className="text-sm font-medium group-hover:text-sage-600 transition-colors">Session {session.sessionNumber}</p>
                      <span className="text-xs text-muted">{new Date(session.date).toLocaleDateString("en-IN", { year: "numeric" })}</span>
                    </div>
                    {session.summary && <p className="text-xs text-muted line-clamp-2 mt-1">{session.summary}</p>}
                    {session.presentingProblem && !session.summary && <p className="text-xs text-muted line-clamp-2 mt-1">{session.presentingProblem}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {session.therapistHomework && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-[10px] font-semibold text-amber-800">
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          Therapist HW
                        </span>
                      )}
                      {session.clientHomework && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-[10px] font-semibold text-blue-800">Client HW</span>}
                    </div>
                  </div>
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

      {/* Sticky save bar for clinical tabs */}
      {isClinicalTab && clinicalChanges && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-cream/95 backdrop-blur-md border-t border-border px-6 py-3 flex items-center justify-between z-30">
          <p className="text-sm text-muted">You have unsaved changes</p>
          <button onClick={handleSaveClinical} disabled={savingClinical}
            className="bg-forest text-cream px-5 py-2 rounded-lg text-sm font-medium hover:bg-sage-700 transition-colors disabled:opacity-50">
            {savingClinical ? "Saving..." : "Save Changes"}
          </button>
        </div>
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

function FormSection({ title, children, highlight }: { title: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`border rounded-xl p-4 sm:p-6 ${highlight ? "border-amber-200 bg-amber-50/30" : "border-border bg-cream-light"}`}>
      <h3 className="font-serif text-base font-medium mb-3">{title}</h3>
      {children}
    </div>
  );
}

function TextArea({ field, value, onChange, placeholder, rows = 4 }: { field: string; value: string; onChange: (field: string, value: string) => void; placeholder: string; rows?: number }) {
  return (
    <textarea rows={rows} value={value} onChange={(e) => onChange(field, e.target.value)} placeholder={placeholder}
      className="w-full px-4 py-3 rounded-lg border border-border bg-cream focus:outline-none focus:ring-2 focus:ring-sage-400/40 text-sm resize-y" />
  );
}
