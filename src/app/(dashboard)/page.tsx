"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { STATUS_LABELS } from "@/lib/booking-types";
import SessionsCalendar from "@/components/SessionsCalendar";
import ActivityFeed from "@/components/ActivityFeed";

interface Stats {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  bySessionType: Record<string, number>;
  thisWeek: number;
  thisMonth: number;
}

interface ClientStats {
  total: number;
  active: number;
  inactive: number;
  discharged: number;
}

interface RecentBooking {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
  sessionType: string;
  category: string;
}

interface HomeworkTask {
  clientId: string;
  clientName: string;
  sessionId: string;
  sessionDate: string;
  therapistHomework: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [clientStats, setClientStats] = useState<ClientStats | null>(null);
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [homeworkTasks, setHomeworkTasks] = useState<HomeworkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);

  // One request, not five — see the note in /api/dashboard/summary.
  useEffect(() => {
    fetch("/api/dashboard/summary")
      .then((r) => r.json())
      .then((data) => {
        setStats(data.stats ?? null);
        setRecentBookings(data.recentBookings ?? []);
        setUser(data.user ?? null);
        setClientStats(data.clientStats ?? null);
        setHomeworkTasks(data.homeworkTasks ?? []);
      })
      .catch(() => {
        /* leave the empty state in place */
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-accent-bg rounded w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-accent-bg rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const pendingCount =
    (stats?.byStatus?.pending_payment || 0) +
    (stats?.byStatus?.slot_reserved || 0);

  return (
    <div className="p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl md:text-3xl font-medium">
          Welcome back{user ? `, ${user.username}` : ""}.
        </h1>
        <p className="text-muted text-sm mt-1">
          Here&apos;s what&apos;s happening with your practice.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard
          label="Total Bookings"
          value={stats?.total || 0}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          }
        />
        <StatCard
          label="This Week"
          value={stats?.thisWeek || 0}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
          }
          accent
        />
        <StatCard
          label="This Month"
          value={stats?.thisMonth || 0}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          }
        />
        <StatCard
          label="Pending Action"
          value={pendingCount}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          warning={pendingCount > 0}
        />
        <StatCard
          label="Active Clients"
          value={clientStats?.active || 0}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          }
          href="/clients"
        />
      </div>

      {/* Calendar + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SessionsCalendar />
        <ActivityFeed limit={5} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent bookings */}
        <div className="lg:col-span-2 border border-border rounded-xl bg-cream-light">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-serif text-lg font-medium">Recent Bookings</h2>
            <Link
              href="/bookings"
              className="text-sm text-sage-600 hover:text-forest transition-colors"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentBookings.length === 0 ? (
              <p className="px-6 py-8 text-muted text-sm text-center">
                No bookings yet.
              </p>
            ) : (
              recentBookings.map((booking) => {
                const statusInfo = STATUS_LABELS[booking.status] || {
                  label: booking.status,
                  color: "bg-gray-100 text-gray-800",
                };
                return (
                  <Link
                    key={booking.id}
                    href={`/bookings/${booking.id}`}
                    className="flex items-center justify-between px-6 py-4 hover:bg-accent-bg/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {booking.name}
                      </p>
                      <p className="text-xs text-muted truncate">
                        {booking.sessionType} &middot; {booking.category}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusInfo.color}`}
                      >
                        {statusInfo.label}
                      </span>
                      <span className="text-xs text-muted hidden sm:block">
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

        {/* Status breakdown */}
        <div className="border border-border rounded-xl bg-cream-light">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-serif text-lg font-medium">By Status</h2>
          </div>
          <div className="px-6 py-4 space-y-3">
            {stats &&
              Object.entries(stats.byStatus).map(([status, count]) => {
                const info = STATUS_LABELS[status] || {
                  label: status,
                  color: "bg-gray-100 text-gray-800",
                };
                const percentage = stats.total
                  ? Math.round((count / stats.total) * 100)
                  : 0;
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{info.label}</span>
                      <span className="text-xs text-muted">{count}</span>
                    </div>
                    <div className="w-full h-2 bg-accent-bg rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sage-500 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            {stats && Object.keys(stats.byStatus).length === 0 && (
              <p className="text-muted text-sm text-center py-4">No data yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Therapist Homework Tasks */}
      {homeworkTasks.length > 0 && (
        <div className="border border-amber-200 rounded-xl bg-amber-50/50 mt-6">
          <div className="px-6 py-4 border-b border-amber-200 flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="font-serif text-lg font-medium">Your Tasks</h2>
            <span className="text-xs bg-amber-200 text-amber-800 rounded-full px-2 py-0.5 font-semibold ml-1">
              {homeworkTasks.length}
            </span>
          </div>
          <div className="divide-y divide-amber-200/60">
            {homeworkTasks.map((task) => (
              <Link
                key={`${task.clientId}-${task.sessionId}`}
                href={`/clients/${task.clientId}/sessions/${task.sessionId}`}
                className="flex items-start justify-between px-6 py-4 hover:bg-amber-100/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{task.clientName}</p>
                  <p className="text-xs text-muted mt-1 line-clamp-2">{task.therapistHomework}</p>
                </div>
                <span className="text-xs text-muted ml-4 flex-shrink-0">
                  {new Date(task.sessionDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Category & Session Type breakdown */}
      {stats && (stats.total > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="border border-border rounded-xl bg-cream-light">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="font-serif text-lg font-medium">By Category</h2>
            </div>
            <div className="px-6 py-4 space-y-2">
              {Object.entries(stats.byCategory).map(([cat, count]) => (
                <div key={cat} className="flex items-center justify-between py-1.5">
                  <span className="text-sm">{cat}</span>
                  <span className="text-sm font-medium text-sage-600">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border rounded-xl bg-cream-light">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="font-serif text-lg font-medium">By Session Type</h2>
            </div>
            <div className="px-6 py-4 space-y-2">
              {Object.entries(stats.bySessionType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between py-1.5">
                  <span className="text-sm">{type}</span>
                  <span className="text-sm font-medium text-sage-600">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
  warning,
  href,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: boolean;
  warning?: boolean;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between mb-3">
        <span
          className={`${
            warning ? "text-orange-600" : accent ? "text-sage-600" : "text-muted"
          }`}
        >
          {icon}
        </span>
      </div>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted mt-1">{label}</p>
    </>
  );

  const className = `rounded-xl border p-5 transition-shadow hover:shadow-md ${
    warning
      ? "border-orange-200 bg-orange-50/80"
      : accent
        ? "border-sage-300 bg-secondary-bg/60"
        : "border-border bg-cream-light"
  }`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
