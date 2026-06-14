"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { STATUS_LABELS, type Booking } from "@/lib/booking-types";
import { useToast } from "@/components/Toast";

export default function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { showToast } = useToast();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  useEffect(() => {
    fetch(`/api/bookings/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.booking) {
          setBooking(data.booking);
        }
        setLoading(false);
      });
  }, [id]);

  async function handleStatusChange(newStatus: string) {
    setUpdatingStatus(true);

    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
      }

      const statusLabel =
        STATUS_LABELS[newStatus]?.label || newStatus;

      setBooking((prev) =>
        prev ? { ...prev, status: newStatus, updatedAt: new Date().toISOString() } : prev
      );
      showToast(`Status updated to "${statusLabel}"`, "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to update status",
        "error"
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;
    setAddingNote(true);

    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(id)}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: newNote }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add note");
      }

      // Re-fetch booking to get updated notes
      const updated = await fetch(`/api/bookings/${encodeURIComponent(id)}`).then((r) => r.json());
      setBooking(updated.booking);
      setNewNote("");
      showToast("Note added successfully", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to add note",
        "error"
      );
    } finally {
      setAddingNote(false);
    }
  }

  const handleDelete = useCallback(async () => {
    setDeleting(true);

    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(id)}/delete`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete booking");
      }

      router.push("/bookings");
      router.refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to delete booking",
        "error"
      );
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }, [id, router, showToast]);

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

  if (!booking) {
    return (
      <div className="p-4 sm:p-6 lg:p-10 text-center py-20">
        <p className="text-muted mb-4">Booking not found.</p>
        <Link href="/bookings" className="text-sage-600 hover:text-forest text-sm font-medium">
          Back to bookings
        </Link>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[booking.status] || {
    label: booking.status,
    color: "bg-gray-100 text-gray-800",
  };

  const adminNotes = (booking as unknown as Record<string, unknown>).adminNotes as
    | Array<{ text: string; author: string; createdAt: string }>
    | undefined;

  return (
    <div className="p-4 sm:p-6 lg:p-10 animate-fade-in">
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              if (!deleting) {
                setShowDeleteModal(false);
                setDeleteConfirmText("");
              }
            }}
          />

          {/* Modal */}
          <div className="relative bg-cream-light border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 animate-fade-in">
            {/* Warning icon */}
            <div className="flex items-center justify-center w-14 h-14 mx-auto mb-5 rounded-full bg-red-100">
              <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>

            <h3 className="font-serif text-xl font-medium text-center mb-2">
              Delete this booking?
            </h3>
            <p className="text-sm text-muted text-center mb-1">
              This action is <span className="font-semibold text-red-700">permanent and cannot be undone</span>.
            </p>
            <p className="text-sm text-muted text-center mb-5">
              All data for <span className="font-semibold text-forest">{booking.name}</span> will be permanently removed.
            </p>

            {/* Confirmation input */}
            <div className="mb-5">
              <label className="text-xs font-semibold tracking-wider uppercase block mb-1.5 text-muted">
                Type &quot;DELETE&quot; to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                autoFocus
                disabled={deleting}
                className="w-full px-4 py-3 rounded-lg border border-red-200 bg-cream focus:outline-none focus:ring-2 focus:ring-red-400/40 text-sm font-mono"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText("");
                }}
                disabled={deleting}
                className="flex-1 px-4 py-3 rounded-lg border border-border text-sm font-medium hover:bg-accent-bg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || deleteConfirmText !== "DELETE"}
                className="flex-1 px-4 py-3 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? "Deleting..." : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back link */}
      <Link
        href="/bookings"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-forest mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to bookings
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl md:text-3xl font-medium truncate">
            {booking.name}
          </h1>
          <p className="text-muted text-sm mt-1">
            Booking ID: <span className="font-mono text-xs">{booking.id}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 self-start flex-shrink-0 flex-wrap">
          <span
            className={`inline-flex px-3 py-1.5 rounded-full text-xs font-semibold ${statusInfo.color}`}
          >
            {statusInfo.label}
          </span>
          {booking.emailVerified && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Email verified
            </span>
          )}
          {booking.clientId && (
            <Link
              href={`/clients/${booking.clientId}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sage-300 text-sage-700 text-xs font-medium hover:bg-sage-50 hover:border-sage-400 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              Go to Client
            </Link>
          )}
          <button
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 hover:border-red-300 transition-all"
            title="Delete booking"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client details */}
          <div className="border border-border rounded-xl bg-cream-light">
            <div className="px-4 sm:px-6 py-4 border-b border-border">
              <h2 className="font-serif text-lg font-medium">Client Details</h2>
            </div>
            <div className="px-4 sm:px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <InfoField label="Full Name" value={booking.name} />
              <InfoField label="Email" value={booking.email} />
              <InfoField label="WhatsApp" value={`+91 ${booking.whatsapp}`} />
              <InfoField label="Age" value={booking.age} />
              <InfoField label="Gender" value={booking.gender} />
              <InfoField label="Pronouns" value={booking.pronouns || "Not specified"} />
            </div>
          </div>

          {/* Session details */}
          <div className="border border-border rounded-xl bg-cream-light">
            <div className="px-4 sm:px-6 py-4 border-b border-border">
              <h2 className="font-serif text-lg font-medium">Session Details</h2>
            </div>
            <div className="px-4 sm:px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <InfoField label="Session Type" value={booking.sessionType} />
              <InfoField label="Category" value={booking.category} />
              <div className="sm:col-span-2">
                <InfoField label="Primary Concern" value={booking.concern} />
              </div>
            </div>
          </div>

          {/* Calendly details */}
          {booking.calendly && (
            <div className="border border-border rounded-xl bg-cream-light">
              <div className="px-4 sm:px-6 py-4 border-b border-border">
                <h2 className="font-serif text-lg font-medium">
                  Scheduled Session
                </h2>
              </div>
              <div className="px-4 sm:px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                <InfoField
                  label="Event"
                  value={booking.calendly.eventName || "N/A"}
                />
                <InfoField
                  label="Date"
                  value={
                    booking.calendly.eventDate
                      ? new Date(booking.calendly.eventDate).toLocaleDateString(
                          "en-IN",
                          {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          }
                        )
                      : "N/A"
                  }
                />
                <InfoField
                  label="Time"
                  value={booking.calendly.eventTime || "N/A"}
                />
              </div>
            </div>
          )}

          {/* Consent */}
          {booking.consent && (
            <div className="border border-border rounded-xl bg-cream-light">
              <div className="px-4 sm:px-6 py-4 border-b border-border">
                <h2 className="font-serif text-lg font-medium">Consent</h2>
              </div>
              <div className="px-4 sm:px-6 py-5 space-y-3">
                <ConsentItem
                  label="Paid session acknowledgment"
                  checked={booking.consent.paidSession}
                />
                <ConsentItem
                  label="Payment-first policy"
                  checked={booking.consent.paymentFirst}
                />
                <ConsentItem
                  label="Communication consent"
                  checked={booking.consent.communicationConsent}
                />
                {booking.consent.notes && (
                  <div className="pt-2">
                    <p className="text-xs font-semibold tracking-wider uppercase mb-1">
                      Client Notes
                    </p>
                    <p className="text-sm text-muted bg-accent-bg/50 rounded-lg px-4 py-3">
                      {booking.consent.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Status management */}
          <div className="border border-border rounded-xl bg-cream-light">
            <div className="px-4 sm:px-6 py-4 border-b border-border">
              <h2 className="font-serif text-lg font-medium">Update Status</h2>
            </div>
            <div className="px-4 sm:px-6 py-4 space-y-2">
              {Object.entries(STATUS_LABELS).map(([key, { label, color }]) => (
                <button
                  key={key}
                  onClick={() => handleStatusChange(key)}
                  disabled={updatingStatus || booking.status === key}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                    booking.status === key
                      ? `${color} font-semibold cursor-default`
                      : "hover:bg-accent-bg/50 text-muted hover:text-forest"
                  } disabled:opacity-50`}
                >
                  <span className="flex items-center gap-2">
                    {booking.status === key && (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="border border-border rounded-xl bg-cream-light">
            <div className="px-4 sm:px-6 py-4 border-b border-border">
              <h2 className="font-serif text-lg font-medium">Timeline</h2>
            </div>
            <div className="px-4 sm:px-6 py-4 space-y-4">
              <TimelineItem
                label="Booking Created"
                date={booking.createdAt}
              />
              {booking.calendly?.eventDate && (
                <TimelineItem
                  label="Session Scheduled"
                  date={booking.calendly.eventDate}
                />
              )}
              {booking.updatedAt && (
                <TimelineItem
                  label="Last Updated"
                  date={booking.updatedAt}
                />
              )}
            </div>
          </div>

          {/* Admin notes */}
          <div className="border border-border rounded-xl bg-cream-light">
            <div className="px-4 sm:px-6 py-4 border-b border-border">
              <h2 className="font-serif text-lg font-medium">Admin Notes</h2>
            </div>
            <div className="px-4 sm:px-6 py-4 space-y-4">
              {/* Existing notes */}
              {adminNotes && adminNotes.length > 0 ? (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {adminNotes.map((note, i) => (
                    <div
                      key={i}
                      className="bg-accent-bg/50 rounded-lg px-4 py-3"
                    >
                      <p className="text-sm">{note.text}</p>
                      <p className="text-xs text-muted mt-1.5">
                        {note.author} &middot;{" "}
                        {new Date(note.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">No notes yet.</p>
              )}

              {/* Add note */}
              <div className="pt-2 border-t border-border">
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a private note..."
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-cream focus:outline-none focus:ring-2 focus:ring-sage-400/40 text-sm resize-y"
                />
                {newNote.length > 0 && (
                  <p className="text-xs text-muted text-right mb-1">
                    {newNote.length}/2000
                  </p>
                )}
                <button
                  onClick={handleAddNote}
                  disabled={addingNote || !newNote.trim()}
                  className="mt-1 w-full bg-forest text-cream py-2 rounded-lg text-sm font-medium hover:bg-sage-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingNote ? "Adding..." : "Add Note"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wider uppercase text-muted mb-1">
        {label}
      </p>
      <p className="text-sm break-words">{value || "N/A"}</p>
    </div>
  );
}

function ConsentItem({
  label,
  checked,
}: {
  label: string;
  checked?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {checked ? (
        <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
      <span className="text-sm">{label}</span>
    </div>
  );
}

function TimelineItem({ label, date }: { label: string; date: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-2 h-2 rounded-full bg-sage-400 mt-1.5 flex-shrink-0" />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted">
          {new Date(date).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
