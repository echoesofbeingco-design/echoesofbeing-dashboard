"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

interface Client {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  age: string;
  gender: string;
  pronouns: string;
  occupation: string;
  status: "active" | "inactive" | "discharged";
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  inactive: "bg-amber-100 text-amber-800",
  discharged: "bg-gray-100 text-gray-800",
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data) => {
        setClients(data.clients || []);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    let result = [...clients];

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.whatsapp?.includes(q) ||
          c.occupation?.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((c) => c.status === statusFilter);
    }

    return result;
  }, [clients, search, statusFilter]);

  if (loading) {
    return (
      <div className="p-6 lg:p-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-accent-bg rounded w-40" />
          <div className="h-12 bg-accent-bg rounded" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-accent-bg rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-medium">
            Clients
          </h1>
          <p className="text-muted text-sm mt-1">
            {filtered.length} of {clients.length} clients shown
          </p>
        </div>
        <Link
          href="/clients/new"
          className="inline-flex items-center gap-2 bg-forest text-cream px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-sage-700 transition-colors self-start"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Client
        </Link>
      </div>

      {/* Search & Filters */}
      <div className="border border-border rounded-xl bg-cream-light p-4 mb-6 space-y-4">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, or occupation..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-cream focus:outline-none focus:ring-2 focus:ring-sage-400/40 text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-sage-400/40"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="discharged">Discharged</option>
          </select>

          {(search || statusFilter !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
              }}
              className="px-3 py-2 rounded-lg border border-border bg-cream text-sm text-muted hover:text-forest hover:border-sage-400 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl bg-cream-light overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-accent-bg/50">
                <th className="px-6 py-3 text-left text-xs font-semibold tracking-wider uppercase">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase">
                  Contact
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase">
                  Occupation
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase">
                  Added
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted text-sm">
                    {clients.length === 0
                      ? "No clients yet. Add your first client to get started."
                      : "No clients match your filters."}
                  </td>
                </tr>
              ) : (
                filtered.map((client) => (
                  <tr
                    key={client.id}
                    className="hover:bg-accent-bg/30 transition-colors cursor-pointer group"
                    onClick={() => window.location.href = `/clients/${client.id}`}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium group-hover:text-sage-600 transition-colors">{client.name}</p>
                        <p className="text-xs text-muted">
                          {client.age}y &middot; {client.gender}
                          {client.pronouns ? ` (${client.pronouns})` : ""}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm">{client.email}</p>
                      <p className="text-xs text-muted">+91 {client.whatsapp}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm">{client.occupation || "N/A"}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize ${STATUS_COLORS[client.status] || "bg-gray-100 text-gray-800"}`}>
                        {client.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted">
                      {new Date(client.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-sage-600 group-hover:text-forest font-medium transition-colors inline-flex items-center gap-1">
                        View
                        <svg className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-border">
          {filtered.length === 0 ? (
            <p className="px-6 py-12 text-center text-muted text-sm">
              {clients.length === 0
                ? "No clients yet. Add your first client."
                : "No clients match your filters."}
            </p>
          ) : (
            filtered.map((client) => (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="block px-5 py-4 hover:bg-accent-bg/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium">{client.name}</p>
                    <p className="text-xs text-muted">{client.email}</p>
                  </div>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${STATUS_COLORS[client.status] || "bg-gray-100 text-gray-800"}`}>
                    {client.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span>{client.occupation || "N/A"}</span>
                  <span>&middot;</span>
                  <span>{client.age}y</span>
                  <span>&middot;</span>
                  <span>
                    {new Date(client.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
