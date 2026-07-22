"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/components/Toast";

interface AdminUser {
  username: string;
  role: "admin" | "viewer";
  createdAt: string | null;
  lastLogin: string | null;
}

export default function UsersPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string } | null>(null);

  // Create user form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "viewer">("viewer");
  const [creating, setCreating] = useState(false);

  // Reset password modal
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const [usersRes, meRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/auth/me"),
      ]);

      if (!usersRes.ok) {
        if (usersRes.status === 403) {
          showToast("Only admins can manage users", "error");
        }
        setLoading(false);
        return;
      }

      const usersData = await usersRes.json();
      const meData = await meRes.json();
      setUsers(usersData.users || []);
      setCurrentUser(meData);
      setLoading(false);
    } catch {
      showToast("Failed to load users", "error");
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleCreate() {
    if (!newUsername.trim() || !newPassword) return;
    setCreating(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          role: newRole,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create user");
      }

      showToast(`User "${newUsername.trim()}" created successfully`, "success");
      setShowCreateForm(false);
      setNewUsername("");
      setNewPassword("");
      setNewRole("viewer");
      fetchUsers();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to create user",
        "error"
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleResetPassword() {
    if (!resetTarget || !resetPassword) return;
    setResetting(true);

    try {
      const res = await fetch(
        `/api/admin/users/${encodeURIComponent(resetTarget)}/password`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: resetPassword }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to reset password");
      }

      showToast(`Password reset for "${resetTarget}"`, "success");
      setResetTarget(null);
      setResetPassword("");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to reset password",
        "error"
      );
    } finally {
      setResetting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: deleteTarget }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete user");
      }

      showToast(`User "${deleteTarget}" deleted`, "success");
      setDeleteTarget(null);
      fetchUsers();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to delete user",
        "error"
      );
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-accent-bg rounded w-40" />
          <div className="h-64 bg-accent-bg rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto animate-fade-in">
      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              if (!resetting) {
                setResetTarget(null);
                setResetPassword("");
              }
            }}
          />
          <div className="relative bg-cream-light border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 animate-fade-in">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-sage-300/30">
              <svg className="w-6 h-6 text-sage-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              </svg>
            </div>

            <h3 className="font-serif text-xl font-medium text-center mb-2">
              Reset Password
            </h3>
            <p className="text-sm text-muted text-center mb-5">
              Set a new password for <span className="font-semibold text-forest">{resetTarget}</span>
            </p>

            <div className="mb-5">
              <label className="text-xs font-semibold tracking-wider uppercase block mb-1.5 text-muted">
                New Password
              </label>
              <input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                autoFocus
                disabled={resetting}
                className="w-full px-4 py-3 rounded-lg border border-border bg-cream focus:outline-none focus:ring-2 focus:ring-sage-400/40 text-sm"
              />
              {resetPassword.length > 0 && resetPassword.length < 8 && (
                <p className="text-xs text-red-500 mt-1">
                  Must be at least 8 characters
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setResetTarget(null);
                  setResetPassword("");
                }}
                disabled={resetting}
                className="flex-1 px-4 py-3 rounded-lg border border-border text-sm font-medium hover:bg-accent-bg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resetting || resetPassword.length < 8}
                className="flex-1 px-4 py-3 rounded-lg bg-forest text-cream text-sm font-medium hover:bg-sage-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetting ? "Resetting..." : "Reset Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              if (!deleting) setDeleteTarget(null);
            }}
          />
          <div className="relative bg-cream-light border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 animate-fade-in">
            <div className="flex items-center justify-center w-14 h-14 mx-auto mb-5 rounded-full bg-red-100">
              <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>

            <h3 className="font-serif text-xl font-medium text-center mb-2">
              Delete User
            </h3>
            <p className="text-sm text-muted text-center mb-5">
              Are you sure you want to permanently delete <span className="font-semibold text-red-700">{deleteTarget}</span>?
              They will no longer be able to log in.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 px-4 py-3 rounded-lg border border-border text-sm font-medium hover:bg-accent-bg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-3 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-medium">
            User Management
          </h1>
          <p className="text-muted text-sm mt-1">
            {users.length} admin {users.length === 1 ? "user" : "users"}
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-forest text-cream text-sm font-medium hover:bg-sage-700 transition-colors self-start"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
          </svg>
          New User
        </button>
      </div>

      {/* Create User Form */}
      {showCreateForm && (
        <div className="border border-sage-300 rounded-xl bg-secondary-bg/30 p-5 sm:p-6 mb-6 animate-fade-in">
          <h2 className="font-serif text-lg font-medium mb-4">Create New User</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-semibold tracking-wider uppercase block mb-1.5 text-muted">
                Username
              </label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="e.g. aman"
                maxLength={50}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-cream focus:outline-none focus:ring-2 focus:ring-sage-400/40 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold tracking-wider uppercase block mb-1.5 text-muted">
                Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                maxLength={128}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-cream focus:outline-none focus:ring-2 focus:ring-sage-400/40 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold tracking-wider uppercase block mb-1.5 text-muted">
                Role
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as "admin" | "viewer")}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-cream focus:outline-none focus:ring-2 focus:ring-sage-400/40 text-sm"
              >
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleCreate}
                disabled={creating || !newUsername.trim() || newPassword.length < 8}
                className="flex-1 px-4 py-2.5 rounded-lg bg-forest text-cream text-sm font-medium hover:bg-sage-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? "Creating..." : "Create"}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setNewUsername("");
                  setNewPassword("");
                  setNewRole("viewer");
                }}
                className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-accent-bg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
          {newPassword.length > 0 && newPassword.length < 8 && (
            <p className="text-xs text-red-500 mt-2">Password must be at least 8 characters</p>
          )}
        </div>
      )}

      {/* Users list */}
      <div className="border border-border rounded-xl bg-cream-light overflow-hidden">
        {/* Desktop table */}
        <div className="hidden sm:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-accent-bg/50">
                <th className="px-6 py-3 text-left text-xs font-semibold tracking-wider uppercase">
                  Username
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase">
                  Created
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase">
                  Last Login
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold tracking-wider uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted text-sm">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.username} className="hover:bg-accent-bg/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-sage-300/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-semibold text-sage-600 uppercase">
                            {user.username.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{user.username}</p>
                          {currentUser?.username === user.username && (
                            <span className="text-[10px] text-sage-600 font-medium">(you)</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                          user.role === "admin"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {user.role === "admin" ? "Admin" : "Viewer"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted">
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-4 text-sm text-muted">
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Never"}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setResetTarget(user.username)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-sage-600 hover:bg-accent-bg transition-colors"
                          title="Reset password"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                          </svg>
                          Reset
                        </button>
                        {currentUser?.username !== user.username && (
                          <button
                            onClick={() => setDeleteTarget(user.username)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete user"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden divide-y divide-border">
          {users.length === 0 ? (
            <p className="px-5 py-12 text-center text-muted text-sm">
              No users found.
            </p>
          ) : (
            users.map((user) => (
              <div key={user.username} className="px-5 py-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-sage-300/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-sage-600 uppercase">
                        {user.username.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {user.username}
                        {currentUser?.username === user.username && (
                          <span className="text-[10px] text-sage-600 ml-1">(you)</span>
                        )}
                      </p>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold mt-0.5 ${
                          user.role === "admin"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {user.role === "admin" ? "Admin" : "Viewer"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted mb-3">
                  <span>
                    Last login:{" "}
                    {user.lastLogin
                      ? new Date(user.lastLogin).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Never"}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setResetTarget(user.username)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium text-sage-600 hover:bg-accent-bg transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                    </svg>
                    Reset Password
                  </button>
                  {currentUser?.username !== user.username && (
                    <button
                      onClick={() => setDeleteTarget(user.username)}
                      className="px-3 py-2 rounded-lg border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Role descriptions */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border border-border rounded-xl bg-cream-light p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-700">
              Admin
            </span>
          </div>
          <p className="text-sm text-muted">
            Full access. Can view bookings, update statuses, add notes, delete bookings, and manage users (create, reset passwords, delete).
          </p>
        </div>
        <div className="border border-border rounded-xl bg-cream-light p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700">
              Viewer
            </span>
          </div>
          <p className="text-sm text-muted">
            Read-only access. Can view bookings and dashboard stats, but cannot update statuses, add notes, delete bookings, or manage users.
          </p>
        </div>
      </div>
    </div>
  );
}
