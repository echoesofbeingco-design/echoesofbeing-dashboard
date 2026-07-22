"use client";

import { useEffect } from "react";

/**
 * In-house confirmation dialog, replacing window.confirm() so destructive
 * actions match the rest of the dashboard rather than browser chrome.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dash-confirm-title"
    >
      <div
        className="absolute inset-0 bg-forest/40 backdrop-blur-sm"
        onClick={() => !busy && onCancel()}
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white border border-border shadow-xl p-7">
        <h2
          id="dash-confirm-title"
          className="font-serif text-xl font-medium mb-3"
        >
          {title}
        </h2>
        <p className="text-sm text-muted leading-relaxed mb-7">{message}</p>
        <div className="flex flex-wrap gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-5 py-2.5 rounded-full border border-border text-sm hover:bg-accent-bg transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`px-5 py-2.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 ${
              danger
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-forest text-cream hover:opacity-90"
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
