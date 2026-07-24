"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { displayAge } from "@/lib/age";

interface ClientLite {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  age: string;
  dateOfBirth?: string;
  gender: string;
  pronouns: string;
  status: string;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-700",
  discharged: "bg-blue-100 text-blue-800",
};

/**
 * Booking starts with a client, always.
 *
 * Every booking belongs to a clinical file, so this page picks the client
 * first and hands off to /clients/[id]/book, where their details are already
 * on file. That also means there is only one booking form to maintain.
 */
export default function NewBookingPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((d) => setClients(d.clients ?? []))
      .catch(() => setClients([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.name, c.email, c.whatsapp].some((f) =>
        (f ?? "").toLowerCase().includes(q)
      )
    );
  }, [clients, query]);

  return (
    <div className="p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto animate-fade-in">
      <Link
        href="/bookings"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-forest mb-4 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to bookings
      </Link>

      <header className="mb-6">
        <h1 className="font-serif text-2xl md:text-3xl font-medium">
          Who is this booking for?
        </h1>
        <p className="text-sm text-muted mt-1">
          Every session belongs to a client file. Pick someone below, or create
          their file first if they&apos;re new.
        </p>
      </header>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email or number…"
          className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-sage-400/40"
        />
        <Link
          href="/clients/new?next=book"
          className="inline-flex items-center justify-center gap-2 bg-forest text-cream px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-sage-700 transition-colors whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New client
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-accent-bg rounded-xl" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="border border-border rounded-xl bg-cream-light px-6 py-16 text-center">
          <p className="text-muted text-sm mb-4">
            There are no clients yet. Create the first client file to book a
            session.
          </p>
          <Link
            href="/clients/new?next=book"
            className="inline-flex items-center gap-2 bg-forest text-cream px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-sage-700 transition-colors"
          >
            Create a client
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-border rounded-xl bg-cream-light px-6 py-12 text-center">
          <p className="text-muted text-sm mb-4">
            No client matches &ldquo;{query}&rdquo;.
          </p>
          <Link
            href="/clients/new?next=book"
            className="text-sage-600 text-sm hover:underline"
          >
            Create a new client instead →
          </Link>
        </div>
      ) : (
        <ul className="border border-border rounded-xl bg-cream-light divide-y divide-border overflow-hidden">
          {filtered.map((c) => {
            const age = displayAge(c);
            return (
              <li key={c.id}>
                <button
                  onClick={() => router.push(`/clients/${c.id}/book`)}
                  className="w-full text-left flex items-center justify-between gap-4 px-5 py-4 hover:bg-accent-bg/50 transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium truncate">
                      {c.name}
                    </span>
                    <span className="block text-xs text-muted truncate">
                      {c.email || "no email"}
                      {c.whatsapp ? ` · ${c.whatsapp}` : ""}
                      {age ? ` · ${age}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-3 flex-shrink-0">
                    <span
                      className={`hidden sm:inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        STATUS_STYLES[c.status] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {c.status}
                    </span>
                    <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
