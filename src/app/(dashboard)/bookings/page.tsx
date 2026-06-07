"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { STATUS_LABELS, type Booking } from "@/lib/booking-types";

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sessionTypeFilter, setSessionTypeFilter] = useState("all");
  const [sortField, setSortField] = useState<"createdAt" | "name" | "status">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((data) => {
        setBookings(data.bookings || []);
        setLoading(false);
      });
  }, []);

  // Extract unique values for filters
  const categories = useMemo(
    () => [...new Set(bookings.map((b) => b.category).filter(Boolean))],
    [bookings]
  );
  const sessionTypes = useMemo(
    () => [...new Set(bookings.map((b) => b.sessionType).filter(Boolean))],
    [bookings]
  );

  // Filter and search
  const filtered = useMemo(() => {
    let result = [...bookings];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (b) =>
          b.name?.toLowerCase().includes(q) ||
          b.email?.toLowerCase().includes(q) ||
          b.whatsapp?.includes(q) ||
          b.concern?.toLowerCase().includes(q) ||
          b.id?.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((b) => b.status === statusFilter);
    }

    // Category filter
    if (categoryFilter !== "all") {
      result = result.filter((b) => b.category === categoryFilter);
    }

    // Session type filter
    if (sessionTypeFilter !== "all") {
      result = result.filter((b) => b.sessionType === sessionTypeFilter);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === "createdAt") {
        cmp =
          new Date(a.createdAt || 0).getTime() -
          new Date(b.createdAt || 0).getTime();
      } else if (sortField === "name") {
        cmp = (a.name || "").localeCompare(b.name || "");
      } else if (sortField === "status") {
        cmp = (a.status || "").localeCompare(b.status || "");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [bookings, search, statusFilter, categoryFilter, sessionTypeFilter, sortField, sortDir]);

  function toggleSort(field: "createdAt" | "name" | "status") {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

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
            Bookings
          </h1>
          <p className="text-muted text-sm mt-1">
            {filtered.length} of {bookings.length} bookings shown
          </p>
        </div>
        <Link
          href="/bookings/new"
          className="inline-flex items-center gap-2 bg-forest text-cream px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-sage-700 transition-colors self-start"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Booking
        </Link>
      </div>

      {/* Search & Filters */}
      <div className="border border-border rounded-xl bg-cream-light p-4 mb-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, concern, or booking ID..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-cream focus:outline-none focus:ring-2 focus:ring-sage-400/40 text-sm"
          />
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-sage-400/40"
          >
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-sage-400/40"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={sessionTypeFilter}
            onChange={(e) => setSessionTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-sage-400/40"
          >
            <option value="all">All Session Types</option>
            {sessionTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          {(search || statusFilter !== "all" || categoryFilter !== "all" || sessionTypeFilter !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setCategoryFilter("all");
                setSessionTypeFilter("all");
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
                <th
                  className="px-6 py-3 text-left text-xs font-semibold tracking-wider uppercase cursor-pointer hover:text-sage-600 transition-colors"
                  onClick={() => toggleSort("name")}
                >
                  <span className="flex items-center gap-1">
                    Client
                    <SortIcon active={sortField === "name"} dir={sortDir} />
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase">
                  Contact
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase">
                  Type
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase cursor-pointer hover:text-sage-600 transition-colors"
                  onClick={() => toggleSort("status")}
                >
                  <span className="flex items-center gap-1">
                    Status
                    <SortIcon active={sortField === "status"} dir={sortDir} />
                  </span>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase cursor-pointer hover:text-sage-600 transition-colors"
                  onClick={() => toggleSort("createdAt")}
                >
                  <span className="flex items-center gap-1">
                    Date
                    <SortIcon active={sortField === "createdAt"} dir={sortDir} />
                  </span>
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-muted text-sm"
                  >
                    No bookings match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((booking) => {
                  const statusInfo = STATUS_LABELS[booking.status] || {
                    label: booking.status,
                    color: "bg-gray-100 text-gray-800",
                  };
                  return (
                    <tr
                      key={booking.id}
                      className="hover:bg-accent-bg/30 transition-colors cursor-pointer group"
                      onClick={() => window.location.href = `/bookings/${booking.id}`}
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium group-hover:text-sage-600 transition-colors">{booking.name}</p>
                          <p className="text-xs text-muted">
                            {booking.age}y &middot; {booking.gender}
                            {booking.pronouns ? ` (${booking.pronouns})` : ""}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm">{booking.email}</p>
                        <p className="text-xs text-muted">
                          +91 {booking.whatsapp}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm">{booking.sessionType}</p>
                        <p className="text-xs text-muted">{booking.category}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-muted">
                        {new Date(booking.createdAt).toLocaleDateString(
                          "en-IN",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }
                        )}
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-border">
          {filtered.length === 0 ? (
            <p className="px-6 py-12 text-center text-muted text-sm">
              No bookings match your filters.
            </p>
          ) : (
            filtered.map((booking) => {
              const statusInfo = STATUS_LABELS[booking.status] || {
                label: booking.status,
                color: "bg-gray-100 text-gray-800",
              };
              return (
                <Link
                  key={booking.id}
                  href={`/bookings/${booking.id}`}
                  className="block px-5 py-4 hover:bg-accent-bg/30 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium">{booking.name}</p>
                      <p className="text-xs text-muted">{booking.email}</p>
                    </div>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusInfo.color}`}
                    >
                      {statusInfo.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span>{booking.sessionType}</span>
                    <span>&middot;</span>
                    <span>{booking.category}</span>
                    <span>&middot;</span>
                    <span>
                      {new Date(booking.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  return (
    <svg
      className={`w-3 h-3 transition-colors ${active ? "text-forest" : "text-muted/30"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      {active && dir === "asc" ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
      )}
    </svg>
  );
}
