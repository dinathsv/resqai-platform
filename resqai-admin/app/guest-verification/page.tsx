"use client";

import { useState } from "react";
import useSWR from "swr";
import api from "@/lib/api";
import styles from "./guest-verification.module.css";

interface GuestSession {
  session_id: string;
  nic_number: string | null;
  nic_photo: string | null;
  nic_verified: boolean;
  nic_format_valid: boolean;
  phone_number: string | null;
  phone_verified: boolean;
  admin_status: "pending" | "approved" | "rejected";
  admin_reviewed_at: string | null;
  admin_notes: string | null;
  created_at: string;
  expires_at: string;
}

interface GuestsApiResponse {
  guests: GuestSession[];
  totalCount: number;
  totalPages: number;
  page: number;
  limit: number;
  stats: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
}

const fetcher = async (url: string): Promise<GuestsApiResponse> => {
  const res = await api.get(url);
  return res.data;
};

export default function GuestVerificationPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [selectedGuest, setSelectedGuest] = useState<GuestSession | null>(null);
  const [actionNotes, setActionNotes] = useState<string>("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const queryUrl = `/api/admin/guests?page=${page}&limit=20${
    statusFilter !== "all" ? `&status=${statusFilter}` : ""
  }${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ""}`;

  const { data, error, isLoading, mutate } = useSWR<GuestsApiResponse>(queryUrl, fetcher, {
    refreshInterval: 10000,
  });

  const handleStatusUpdate = async (sessionId: string, newStatus: "approved" | "rejected") => {
    try {
      setUpdatingId(sessionId);
      await api.patch(`/api/admin/guests/${sessionId}/status`, {
        status: newStatus,
        notes: actionNotes.trim() || undefined,
      });

      await mutate();
      if (selectedGuest && selectedGuest.session_id === sessionId) {
        setSelectedGuest(null);
      }
      setActionNotes("");
    } catch (err: any) {
      console.error("Failed to update guest verification status:", err);
      alert(err.response?.data?.error || "Failed to update verification status");
    } finally {
      setUpdatingId(null);
    }
  };

  const getNicType = (nic: string | null) => {
    if (!nic) return "Unknown";
    const cleaned = nic.trim().toUpperCase();
    if (cleaned.length === 10 && (cleaned.endsWith("V") || cleaned.endsWith("X"))) {
      return "Old Format (10-char)";
    }
    if (cleaned.length === 12 && /^\d+$/.test(cleaned)) {
      return "New Format (12-digit)";
    }
    return "Custom NIC";
  };

  const stats = data?.stats || { total: 0, pending: 0, approved: 0, rejected: 0 };

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Guest NIC & Identity Verification</h1>
          <p className="page-description">
            Review submitted NIC photos and record your findings. Format checks and phone OTP do not prove identity ownership or confirm a reported emergency.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Guest Sessions</span>
          <span className={styles.statValue}>{stats.total}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Pending Verification</span>
          <span className={`${styles.statValue}`} style={{ color: "var(--status-warning)" }}>
            {stats.pending}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Approved Guests</span>
          <span className={`${styles.statValue}`} style={{ color: "var(--status-success)" }}>
            {stats.approved}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Rejected Documents</span>
          <span className={`${styles.statValue}`} style={{ color: "var(--status-critical)" }}>
            {stats.rejected}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className={styles.filterBar}>
        <div className={styles.statusTabs}>
          <button
            className={`${styles.tabBtn} ${statusFilter === "all" ? styles.tabBtnActive : ""}`}
            onClick={() => {
              setStatusFilter("all");
              setPage(1);
            }}
          >
            All <span className={styles.tabCount}>{stats.total}</span>
          </button>
          <button
            className={`${styles.tabBtn} ${statusFilter === "pending" ? styles.tabBtnActive : ""}`}
            onClick={() => {
              setStatusFilter("pending");
              setPage(1);
            }}
          >
            Pending <span className={styles.tabCount}>{stats.pending}</span>
          </button>
          <button
            className={`${styles.tabBtn} ${statusFilter === "approved" ? styles.tabBtnActive : ""}`}
            onClick={() => {
              setStatusFilter("approved");
              setPage(1);
            }}
          >
            Approved <span className={styles.tabCount}>{stats.approved}</span>
          </button>
          <button
            className={`${styles.tabBtn} ${statusFilter === "rejected" ? styles.tabBtnActive : ""}`}
            onClick={() => {
              setStatusFilter("rejected");
              setPage(1);
            }}
          >
            Rejected <span className={styles.tabCount}>{stats.rejected}</span>
          </button>
        </div>

        <div className={styles.searchBox}>
          <input
            type="text"
            className="input"
            placeholder="Search by NIC number or phone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Guests Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>NIC Photo</th>
                <th>NIC Number</th>
                <th>Format</th>
                <th>Phone Number</th>
                <th>Registered Date</th>
                <th>Admin Status</th>
                <th>Admin Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8}>
                    <div className={styles.loadingWrapper}>
                      <div className="spinner" />
                      <span>Loading guest records...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8}>
                    <div className={styles.emptyState} style={{ color: "var(--status-critical)" }}>
                      Failed to load guest sessions. Please ensure server is running.
                    </div>
                  </td>
                </tr>
              ) : !data?.guests || data.guests.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className={styles.emptyState}>
                      No guest sessions found matching your filters.
                    </div>
                  </td>
                </tr>
              ) : (
                data.guests.map((guest) => {
                  const nicType = getNicType(guest.nic_number);
                  const isPending = guest.admin_status === "pending" || !guest.admin_status;
                  const isApproved = guest.admin_status === "approved";
                  const isRejected = guest.admin_status === "rejected";
                  const isCurrentUpdating = updatingId === guest.session_id;

                  return (
                    <tr key={guest.session_id}>
                      {/* Photo Thumbnail */}
                      <td>
                        {guest.nic_photo ? (
                          <div
                            className={styles.thumbnailContainer}
                            onClick={() => setSelectedGuest(guest)}
                            title="Click to zoom and inspect NIC photo"
                          >
                            <img
                              src={guest.nic_photo}
                              alt={`NIC ${guest.nic_number || "photo"}`}
                              className={styles.thumbnailImg}
                            />
                            <span className={styles.zoomHint}>🔍 Zoom</span>
                          </div>
                        ) : (
                          <div className={styles.thumbnailContainer} style={{ cursor: "default" }}>
                            <span className={styles.thumbnailPlaceholder}>No Photo</span>
                          </div>
                        )}
                      </td>

                      {/* NIC Number */}
                      <td>
                        <div className={styles.nicBadge}>
                          <span>{guest.nic_number || "N/A"}</span>
                          {guest.nic_verified && (
                            <span title="Format Verified" style={{ color: "var(--status-success)" }}>
                              ✓
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Format */}
                      <td>
                        <span className={styles.nicTypeBadge}>{nicType}</span>
                      </td>

                      {/* Phone */}
                      <td>
                        <div>
                          <span>{guest.phone_number || "N/A"}</span>
                          {guest.phone_verified && (
                            <span
                              className="badge badge-success"
                              style={{ marginLeft: 6, fontSize: 10, padding: "2px 6px" }}
                            >
                              SMS Verified
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {new Date(guest.created_at).toLocaleString("en-GB", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>

                      {/* Status */}
                      <td>
                        {isPending && <span className="badge badge-warning">Pending Review</span>}
                        {isApproved && <span className="badge badge-success">Approved</span>}
                        {isRejected && <span className="badge badge-danger">Rejected</span>}
                      </td>

                      {/* Admin Notes */}
                      <td style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 180 }}>
                        {guest.admin_notes || "—"}
                      </td>

                      {/* Actions */}
                      <td>
                        <div className={styles.actionCell}>
                          <button
                            className={`${styles.approveBtn} ${
                              isCurrentUpdating ? styles.actionBtnDisabled : ""
                            }`}
                            onClick={() => handleStatusUpdate(guest.session_id, "approved")}
                            disabled={isCurrentUpdating || isApproved}
                            title="Approve this guest identity"
                          >
                            ✓ Approve
                          </button>
                          <button
                            className={`${styles.rejectBtn} ${
                              isCurrentUpdating ? styles.actionBtnDisabled : ""
                            }`}
                            onClick={() => handleStatusUpdate(guest.session_id, "rejected")}
                            disabled={isCurrentUpdating || isRejected}
                            title="Reject this guest identity"
                          >
                            ✕ Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Previous
          </button>
          <span style={{ alignSelf: "center", fontSize: 13, color: "var(--text-secondary)" }}>
            Page {page} of {data.totalPages}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page >= data.totalPages}
          >
            Next
          </button>
        </div>
      )}

      {/* High-Resolution Photo Zoom Modal */}
      {selectedGuest && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedGuest(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>NIC Photo Inspection & Verification</h3>
              <button className={styles.closeBtn} onClick={() => setSelectedGuest(null)}>
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.modalImageWrapper}>
                {selectedGuest.nic_photo ? (
                  <img
                    src={selectedGuest.nic_photo}
                    alt={`NIC ${selectedGuest.nic_number}`}
                    className={styles.modalImage}
                  />
                ) : (
                  <div style={{ color: "#fff", padding: 40 }}>No Photo Uploaded</div>
                )}
              </div>

              <div className={styles.modalDetails}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>NIC Number</span>
                  <span className={styles.detailValue}>{selectedGuest.nic_number || "N/A"}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Format Type</span>
                  <span className={styles.detailValue}>{getNicType(selectedGuest.nic_number)}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Phone Number</span>
                  <span className={styles.detailValue}>
                    {selectedGuest.phone_number || "N/A"} {selectedGuest.phone_verified ? "✓" : ""}
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Current Status</span>
                  <span className={styles.detailValue} style={{ textTransform: "capitalize" }}>
                    {selectedGuest.admin_status || "Pending"}
                  </span>
                </div>
              </div>

              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                  Admin Verification Notes (Optional):
                </label>
                <input
                  type="text"
                  className={styles.notesInput}
                  placeholder="Record what you checked, any callback or agency confirmation, and remaining uncertainty…"
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedGuest(null)}
              >
                Cancel
              </button>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className={styles.rejectBtn}
                  onClick={() => handleStatusUpdate(selectedGuest.session_id, "rejected")}
                  disabled={updatingId === selectedGuest.session_id}
                >
                  ✕ Reject Identity
                </button>
                <button
                  className={styles.approveBtn}
                  onClick={() => handleStatusUpdate(selectedGuest.session_id, "approved")}
                  disabled={updatingId === selectedGuest.session_id}
                >
                  ✓ Approve Identity
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
