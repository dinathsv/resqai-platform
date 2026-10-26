"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import useSWR from "swr";
import api from "@/lib/api";
import styles from "./users.module.css";

// ---------------------------------------------
// Types
// ---------------------------------------------

interface User {
  user_id: string;
  full_name: string;
  email: string;
  phone_number: string;
  user_type: string;
  nic_number?: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
}

interface RawUser {
  user_id?: unknown;
  id?: unknown;
  full_name?: unknown;
  name?: unknown;
  email?: unknown;
  phone_number?: unknown;
  phone?: unknown;
  user_type?: unknown;
  type?: unknown;
  role?: unknown;
  nic_number?: unknown;
  nic?: unknown;
  is_verified?: unknown;
  verified?: unknown;
  is_active?: unknown;
  created_at?: unknown;
  joined?: unknown;
}

interface UsersResponse {
  users?: unknown;
  data?: unknown;
  pages?: unknown;
  totalPages?: unknown;
  total_pages?: unknown;
}

interface ApiErrorShape {
  message?: string;
  response?: {
    data?: {
      error?: string;
      message?: string;
    };
  };
}

// ---------------------------------------------
// Helpers
// ---------------------------------------------

const fetcher = async (url: string): Promise<unknown> => {
  const response = await api.get(url);
  return response.data;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toText(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return fallback;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (!isRecord(error)) {
    return fallback;
  }

  const typedError = error as ApiErrorShape;

  return (
    typedError.response?.data?.error ||
    typedError.response?.data?.message ||
    typedError.message ||
    fallback
  );
}

function getUsersPayload(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (!isRecord(data)) {
    return [];
  }

  const payload = data as UsersResponse;

  if (Array.isArray(payload.users)) {
    return payload.users;
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  // Also handle nested response.data.users
  if (isRecord(payload.data)) {
    if (Array.isArray(payload.data.users)) {
      return payload.data.users;
    }

    if (Array.isArray(payload.data.data)) {
      return payload.data.data;
    }
  }

  return [];
}

function normalizeUser(value: unknown): User | null {
  if (!isRecord(value)) {
    return null;
  }

  const raw: RawUser = value;

  const id = toText(raw.user_id ?? raw.id);

  if (!id) {
    return null;
  }

  const createdAt = toText(raw.created_at ?? raw.joined);

  return {
    user_id: id,

    full_name: toText(raw.full_name ?? raw.name, "Unnamed User"),

    email: toText(raw.email, "—"),

    phone_number: toText(raw.phone_number ?? raw.phone, "—"),

    user_type: toText(raw.user_type ?? raw.type ?? raw.role, "Citizen"),

    nic_number: toText(raw.nic_number ?? raw.nic),

    is_verified: raw.is_verified === true || raw.verified === true,

    is_active: raw.is_active !== false,

    created_at: createdAt,
  };
}

function getTotalPages(data: unknown): number {
  if (!isRecord(data)) {
    return 1;
  }

  let candidate: unknown = data.pages ?? data.totalPages ?? data.total_pages;

  if (candidate == null && isRecord(data.data)) {
    candidate =
      data.data.pages ?? data.data.totalPages ?? data.data.total_pages;
  }

  const parsed = Number(candidate);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return Math.min(Math.floor(parsed), 100000);
}

function formatDate(value: string): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString();
}

// ---------------------------------------------
// Users Page
// ---------------------------------------------

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pendingId, setPendingId] = useState<string | null>(null);

  // -------------------------------------------
  // Query parameters
  // -------------------------------------------

  const params = new URLSearchParams();

  params.set("page", String(page));
  params.set("limit", "20");

  if (search.trim()) {
    params.set("search", search.trim());
  }

  const apiUrl = `/api/admin/users?${params.toString()}`;

  // -------------------------------------------
  // Fetch users
  // -------------------------------------------

  const { data, error, isLoading, mutate } = useSWR<unknown, Error>(
    apiUrl,
    fetcher,
  );

  // Preserve raw API response logging.
  useEffect(() => {
    if (data !== undefined) {
      console.log("Fetched users payload:", data);
    }
  }, [data]);

  // -------------------------------------------
  // Normalize users
  // -------------------------------------------

  const rawUsers = getUsersPayload(data);

  const usersList: User[] = rawUsers
    .map(normalizeUser)
    .filter((user): user is User => user !== null);

  // -------------------------------------------
  // Search
  // -------------------------------------------

  const filteredUsers = usersList.filter((user) => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return (
      user.full_name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.phone_number.toLowerCase().includes(query)
    );
  });

  // -------------------------------------------
  // Pagination
  // -------------------------------------------

  const totalPages = getTotalPages(data);

  const visiblePage = Math.min(page, totalPages);

  // -------------------------------------------
  // Suspend user
  // -------------------------------------------

  async function suspendUser(id: string) {
    if (!window.confirm("Suspend this account?")) {
      return;
    }

    try {
      setPendingId(id);

      await api.patch(`/api/admin/users/${encodeURIComponent(id)}`, {
        is_active: false,
      });

      await mutate();
    } catch (err: unknown) {
      console.error("Failed to suspend user:", err);

      window.alert(getErrorMessage(err, "Failed to suspend user"));
    } finally {
      setPendingId(null);
    }
  }

  // -------------------------------------------
  // Resend OTP
  // -------------------------------------------

  async function resendOtp(id: string) {
    try {
      setPendingId(id);

      await api.post(`/api/admin/users/${encodeURIComponent(id)}/resend-otp`);

      window.alert("OTP resent successfully");

      await mutate();
    } catch (err: unknown) {
      console.error("Failed to resend OTP:", err);

      window.alert(getErrorMessage(err, "Failed to resend OTP"));
    } finally {
      setPendingId(null);
    }
  }

  // -------------------------------------------
  // Render
  // -------------------------------------------

  return (
    <div className="page">
      <h1>User Management</h1>

      <div className={styles.searchRow}>
        <input
          type="text"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search by name, email, or phone..."
          id="user-search"
          aria-label="Search users"
        />
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Type</th>
            <th>Verified</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {isLoading || (!data && !error) ? (
            <tr>
              <td colSpan={8}>
                <div className={styles.loadingContainer}>
                  <div
                    className={styles.spinner}
                    id="users-loading-spinner"
                    role="status"
                    aria-label="Loading users"
                  />

                  <span>Loading registered users...</span>
                </div>
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={8}>
                <div className={styles.errorCell}>
                  <strong>API Error:</strong>{" "}
                  {getErrorMessage(error, "Failed to fetch users")}
                </div>
              </td>
            </tr>
          ) : filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <tr key={user.user_id}>
                <td>{user.user_id.slice(0, 8)}</td>

                <td>{user.full_name}</td>

                <td>{user.email}</td>

                <td>{user.phone_number}</td>

                <td>
                  {user.user_type.toLowerCase() === "guest"
                    ? `Guest (NIC: ${user.nic_number || "—"})`
                    : user.user_type}
                </td>

                <td>
                  {user.is_verified ? (
                    "Yes"
                  ) : (
                    <button
                      type="button"
                      className={`outline ${styles.resendBtn}`}
                      onClick={() => resendOtp(user.user_id)}
                      disabled={pendingId !== null}
                    >
                      {pendingId === user.user_id
                        ? "Processing..."
                        : "Resend OTP"}
                    </button>
                  )}
                </td>

                <td>{formatDate(user.created_at)}</td>

                <td>
                  <div className={styles.actions}>
                    <Link
                      href={`/users/${encodeURIComponent(user.user_id)}`}
                      className={styles.viewLink}
                    >
                      View
                    </Link>

                    <button
                      type="button"
                      className={`danger ${styles.suspendBtn}`}
                      onClick={() => suspendUser(user.user_id)}
                      disabled={pendingId !== null || !user.is_active}
                    >
                      {!user.is_active
                        ? "Suspended"
                        : pendingId === user.user_id
                          ? "Processing..."
                          : "Suspend"}
                    </button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={8} style={{ textAlign: "center" }}>
                No users found
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className={styles.pagination}>
        <button
          type="button"
          className="outline"
          disabled={page <= 1 || isLoading}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
        >
          Previous
        </button>

        {Array.from({ length: totalPages }, (_, index) => index + 1).map(
          (pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              className={
                pageNumber === visiblePage
                  ? styles.pageNumActive
                  : styles.pageNum
              }
              onClick={() => setPage(pageNumber)}
              aria-current={pageNumber === visiblePage ? "page" : undefined}
            >
              {pageNumber}
            </button>
          ),
        )}

        <button
          type="button"
          className="outline"
          disabled={page >= totalPages || isLoading}
          onClick={() =>
            setPage((current) => Math.min(totalPages, current + 1))
          }
        >
          Next
        </button>
      </div>
    </div>
  );
}
