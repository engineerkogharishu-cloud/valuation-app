import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { api } from "../services/api";

// ── Full feedback detail modal (with screenshot) ───────────────
function FeedbackDetailModal({ feedbackId, onClose, onApprove, onReject }) {
  const [fb, setFb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(false);
  const [actioning, setActioning] = useState(null);
  const [rejectNote, setRejectNote] = useState("");
  const [showReject, setShowReject] = useState(false);
  const C = { navy: "#0f1f3d", border: "#dde1e7", muted: "#7f8c8d" };
  const STATUS_META = {
    pending:  { label: "Pending",  bg: "#fff8e1", color: "#7a5c00" },
    approved: { label: "Approved", bg: "#e8f5e9", color: "#1a5c3a" },
    rejected: { label: "Rejected", bg: "#fff5f5", color: "#c0392b" },
  };

  useEffect(() => {
    api.getAdminFeedbackDetail(feedbackId)
      .then(setFb)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [feedbackId]);

  const handleApprove = async () => {
    setActioning("approve");
    try { await onApprove(feedbackId); setFb(f => ({ ...f, status: "approved", credit_awarded: 1 })); }
    catch (_) {}
    finally { setActioning(null); }
  };
  const handleReject = async () => {
    setActioning("reject");
    try { await onReject(feedbackId, rejectNote); setFb(f => ({ ...f, status: "rejected", rejection_note: rejectNote })); setShowReject(false); }
    catch (_) {}
    finally { setActioning(null); }
  };

  const sm = fb ? (STATUS_META[fb.status] || STATUS_META.pending) : null;

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,31,61,0.6)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 640, maxHeight: "90vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.35)", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,#0f1f3d,#1a3a6b)", padding: "20px 26px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "sticky", top: 0, zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 22, marginBottom: 4 }}>💬</div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>Feedback Detail</div>
            {!loading && fb && <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>#{fb.id} · {fb.username} · {fb.company_name || fb.company_code}</div>}
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, color: "#fff", width: 34, height: 34, fontSize: 18, fontWeight: 700, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ padding: "22px 26px" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Loading…</div>
          ) : !fb ? (
            <div style={{ padding: 40, textAlign: "center", color: "#e74c3c" }}>Failed to load feedback.</div>
          ) : (
            <>
              {/* Meta grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
                {[
                  ["Status", <span style={{ background: sm.bg, color: sm.color, borderRadius: 6, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{sm.label}</span>],
                  ["Submitted By", fb.username],
                  ["Company", fb.company_name || fb.company_code],
                  ["Email", fb.user_email || "—"],
                  ["Date", new Date(fb.created_at.endsWith("Z") ? fb.created_at : fb.created_at + "Z").toLocaleString()],
                  ["Credit Awarded", fb.credit_awarded ? <span style={{ color: "#1a5c3a", fontWeight: 700 }}>✅ +1 🪙</span> : "—"],
                  ...(fb.approved_by ? [["Reviewed By", fb.approved_by], ["Reviewed At", new Date(fb.approved_at.endsWith("Z") ? fb.approved_at : fb.approved_at + "Z").toLocaleString()]] : []),
                  ...(fb.email_sent ? [["Email Sent", "✉ Yes"]] : []),
                ].map(([label, value]) => (
                  <div key={label} style={{ background: "#f4f6fa", borderRadius: 8, padding: "10px 14px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Message */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 8 }}>Feedback Message</div>
                <div style={{ background: "#f4f6fa", borderRadius: 10, padding: "14px 16px", fontSize: 14, color: "#2c3e50", lineHeight: 1.8, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{fb.message}</div>
              </div>

              {/* Rejection note */}
              {fb.rejection_note && (
                <div style={{ marginBottom: 18, background: "#fff5f5", border: "1.5px solid #e74c3c", borderRadius: 9, padding: "12px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#e74c3c", textTransform: "uppercase", marginBottom: 4 }}>Rejection Note</div>
                  <div style={{ fontSize: 13, color: "#c0392b" }}>{fb.rejection_note}</div>
                </div>
              )}

              {/* Screenshot */}
              {fb.screenshot ? (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 10 }}>📎 Attached Screenshot</div>
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <img
                      src={fb.screenshot}
                      alt="Screenshot"
                      onClick={() => setLightbox(true)}
                      style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 10, border: `2px solid ${C.border}`, cursor: "zoom-in", display: "block" }}
                    />
                    <div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.6)", color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, pointerEvents: "none" }}>
                      Click to enlarge
                    </div>
                  </div>
                  {/* Full-screen lightbox */}
                  {lightbox && createPortal(
                    <div onClick={() => setLightbox(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999999, padding: 20 }}>
                      <div onClick={e => e.stopPropagation()} style={{ position: "relative" }}>
                        <button onClick={() => setLightbox(false)} style={{ position: "absolute", top: -14, right: -14, background: "#fff", border: "none", borderRadius: "50%", width: 32, height: 32, fontSize: 16, fontWeight: 700, cursor: "pointer" }}>✕</button>
                        <img src={fb.screenshot} alt="Screenshot" style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 10, boxShadow: "0 24px 64px rgba(0,0,0,0.6)", display: "block" }} />
                      </div>
                    </div>,
                    document.body
                  )}
                </div>
              ) : (
                <div style={{ marginBottom: 18, padding: "12px 16px", background: "#f4f6fa", borderRadius: 9, fontSize: 13, color: C.muted }}>
                  📎 No screenshot attached
                </div>
              )}

              {/* Actions */}
              {fb.status === "pending" && (
                <div style={{ borderTop: `2px solid ${C.border}`, paddingTop: 18 }}>
                  {!showReject ? (
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={handleApprove} disabled={actioning === "approve"}
                        style={{ flex: 2, padding: "11px", border: "none", borderRadius: 9, background: "linear-gradient(135deg,#27ae60,#1a7a3f)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: actioning ? 0.7 : 1 }}>
                        {actioning === "approve" ? "Approving…" : "✓ Approve — Award 1 Credit"}
                      </button>
                      <button onClick={() => setShowReject(true)} disabled={!!actioning}
                        style={{ flex: 1, padding: "11px", border: "1.5px solid #e74c3c", borderRadius: 9, background: "#fff5f5", color: "#e74c3c", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                        ✕ Reject
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={3} placeholder="Reason for rejection (optional)…"
                        style={{ padding: "10px 12px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, resize: "vertical", fontFamily: "inherit" }} />
                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={() => setShowReject(false)} style={{ flex: 1, padding: "10px", border: `1.5px solid ${C.border}`, borderRadius: 8, background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
                        <button onClick={handleReject} disabled={actioning === "reject"}
                          style={{ flex: 2, padding: "10px", border: "none", borderRadius: 8, background: "linear-gradient(135deg,#e74c3c,#c0392b)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: actioning ? 0.7 : 1 }}>
                          {actioning === "reject" ? "Rejecting…" : "✕ Confirm Reject"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

const STATUS_META = {
  pending:  { label: "Pending",  bg: "#fff8e1", color: "#7a5c00", border: "#f39c12" },
  approved: { label: "Approved", bg: "#e8f5e9", color: "#1a5c3a", border: "#27ae60" },
  rejected: { label: "Rejected", bg: "#fff5f5", color: "#c0392b", border: "#e74c3c" },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  return (
    <span style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}`, borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
      {m.label}
    </span>
  );
}

const fmtLocal = (iso) => {
  if (!iso) return "—";
  return new Date(iso.endsWith("Z") ? iso : iso + "Z")
    .toLocaleString(undefined, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
};

// ── Reject modal ──────────────────────────────────────────────
function RejectModal({ feedback, onConfirm, onClose }) {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const handleConfirm = async () => {
    setLoading(true);
    try { await onConfirm(feedback.id, note); onClose(); }
    catch (_) { setLoading(false); }
  };
  if (!feedback) return null;
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,31,61,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 440, boxShadow: "0 24px 64px rgba(0,0,0,0.3)", overflow: "hidden", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        <div style={{ background: "linear-gradient(135deg,#e74c3c,#c0392b)", padding: "20px 24px", color: "#fff" }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>✕</div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>Reject Feedback</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>from {feedback.username} · #{feedback.id}</div>
        </div>
        <div style={{ padding: "20px 24px" }}>
          <div style={{ background: "#f4f6fa", borderRadius: 9, padding: "10px 14px", fontSize: 13, color: "#2c3e50", lineHeight: 1.6, marginBottom: 16, fontStyle: "italic" }}>
            "{feedback.message}"
          </div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#7f8c8d", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Rejection Note (optional)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Reason for rejection…"
            style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #dde1e7", borderRadius: 8, fontSize: 13, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 16 }} />
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} disabled={loading} style={{ flex: 1, padding: "10px", border: "1.5px solid #dde1e7", borderRadius: 8, background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleConfirm} disabled={loading}
              style={{ flex: 2, padding: "10px", border: "none", borderRadius: 8, background: "linear-gradient(135deg,#e74c3c,#c0392b)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
              {loading ? "Rejecting…" : "✕ Reject"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Main component ────────────────────────────────────────────
export default function FeedbackAdmin({ companies = [] }) {
  const [feedback, setFeedback] = useState([]);
  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(false);
  const [filterCompany, setFilterCompany] = useState("");
  const [filterStatus, setFilterStatus]   = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [companyOpen, setCompanyOpen]     = useState(false);
  const [actionMsg, setActionMsg]         = useState("");
  const [rejectTarget, setRejectTarget]   = useState(null);
  const [viewTarget, setViewTarget]       = useState(null); // feedback id for detail modal
  const [actioning, setActioning]         = useState({});
  const C = { navy: "#0f1f3d", border: "#dde1e7", muted: "#7f8c8d" };
  const GRAD = {
    navy:  "linear-gradient(135deg,#0f1f3d,#1a3a6b)",
    green: "linear-gradient(135deg,#27ae60,#1a7a3f)",
    warn:  "linear-gradient(135deg,#f39c12,#e67e22)",
    red:   "linear-gradient(135deg,#e74c3c,#c0392b)",
  };

  const showMsg = (m) => { setActionMsg(m); setTimeout(() => setActionMsg(""), 4000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterCompany) params.company_code = filterCompany;
      if (filterStatus)  params.status = filterStatus;
      const d = await api.getAdminFeedback(params);
      setFeedback(d.feedback || []);
      setStats(d.stats);
    } catch (_) {}
    finally { setLoading(false); }
  }, [filterCompany, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id) => {
    setActioning(a => ({ ...a, [id]: "approving" }));
    try {
      const r = await api.approveFeedback(id);
      setFeedback(f => f.map(fb => fb.id === id ? { ...fb, status: "approved", credit_awarded: 1, approved_by: "you", approved_at: new Date().toISOString() } : fb));
      showMsg(`✓ Feedback #${id} approved — 1 credit awarded${r.email_sent ? " · thank-you email sent" : ""}`);
    } catch (e) { showMsg("⚠ " + e.message); }
    finally { setActioning(a => ({ ...a, [id]: null })); }
  };

  const handleReject = async (id, note) => {
    setActioning(a => ({ ...a, [id]: "rejecting" }));
    try {
      await api.rejectFeedback(id, note);
      setFeedback(f => f.map(fb => fb.id === id ? { ...fb, status: "rejected", rejection_note: note } : fb));
      showMsg(`Feedback #${id} rejected.`);
    } catch (e) {
      showMsg("⚠ " + e.message);
      throw e;
    } finally { setActioning(a => ({ ...a, [id]: null })); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.navy }}>💬 Feedback Management</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.muted }}>Review, approve, or reject feedback from all companies. Approving awards 1 credit and sends an email.</p>
        </div>
        <button onClick={load} disabled={loading} style={{ padding: "8px 16px", background: "#f0f2f5", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>↺ Refresh</button>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
          {[
            { label: "Total",    value: stats.total,    grad: GRAD.navy  },
            { label: "Pending",  value: stats.pending,  grad: GRAD.warn  },
            { label: "Approved", value: stats.approved, grad: GRAD.green },
            { label: "Rejected", value: stats.rejected, grad: GRAD.red   },
            { label: "Credited 🪙", value: stats.credited, grad: "linear-gradient(135deg,#1a73e8,#0d47a1)" },
          ].map(({ label, value, grad }) => (
            <div key={label} style={{ background: grad, borderRadius: 12, padding: "16px 18px", color: "#fff", textAlign: "center" }}>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{value}</div>
              <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.06)", padding: "16px 20px", display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 5 }}>Company</div>
          <input
            type="text"
            value={companySearch}
            onChange={e => { setCompanySearch(e.target.value); setCompanyOpen(true); }}
            onFocus={() => setCompanyOpen(true)}
            onBlur={() => setTimeout(() => setCompanyOpen(false), 150)}
            placeholder={filterCompany ? (companies.find(c => c.company_code === filterCompany)?.company_name || filterCompany) : "All Companies"}
            style={{ padding: "8px 12px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, minWidth: 200, outline: "none", boxSizing: "border-box" }}
          />
          {companyOpen && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 200, maxHeight: 220, overflowY: "auto", marginTop: 2 }}>
              {[{ company_code: "", company_name: "All Companies" }, ...companies]
                .filter(c => !companySearch || c.company_name.toLowerCase().includes(companySearch.toLowerCase()) || c.company_code?.toLowerCase().includes(companySearch.toLowerCase()))
                .map(c => (
                  <div key={c.company_code}
                    onMouseDown={() => { setFilterCompany(c.company_code); setCompanySearch(""); setCompanyOpen(false); }}
                    style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13, background: filterCompany === c.company_code ? "#e8f0fe" : "transparent", color: filterCompany === c.company_code ? "#1a73e8" : "#2c3e50", fontWeight: filterCompany === c.company_code ? 700 : 400 }}
                    onMouseEnter={e => e.currentTarget.style.background = filterCompany === c.company_code ? "#e8f0fe" : "#f4f6fa"}
                    onMouseLeave={e => e.currentTarget.style.background = filterCompany === c.company_code ? "#e8f0fe" : "transparent"}
                  >
                    {c.company_name}{c.company_code ? <span style={{ fontSize: 11, color: "#7f8c8d", marginLeft: 6 }}>({c.company_code})</span> : null}
                  </div>
                ))}
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 5 }}>Status</div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ padding: "8px 12px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13 }}>
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {actionMsg && (
        <div style={{ padding: "11px 16px", background: actionMsg.startsWith("✓") ? "#e8f5e9" : actionMsg.startsWith("⚠") ? "#fff5f5" : "#f4f6fa", border: `1px solid ${actionMsg.startsWith("✓") ? "#27ae60" : actionMsg.startsWith("⚠") ? "#e74c3c" : "#dde1e7"}`, borderRadius: 9, fontSize: 13, color: actionMsg.startsWith("✓") ? "#1a5c3a" : actionMsg.startsWith("⚠") ? "#c0392b" : "#2c3e50", fontWeight: 600 }}>
          {actionMsg}
        </div>
      )}

      {/* Feedback table */}
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ padding: "13px 20px", borderBottom: `2px solid ${C.border}`, fontSize: 13, fontWeight: 700, color: C.navy }}>
          {feedback.length} feedback record{feedback.length !== 1 ? "s" : ""}
          {filterStatus === "pending" && feedback.length > 0 && <span style={{ marginLeft: 10, fontSize: 12, color: "#f39c12", fontWeight: 600 }}>⚠ {feedback.length} awaiting review</span>}
        </div>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: C.muted }}>Loading…</div>
        ) : feedback.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: C.muted }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
            <div style={{ fontWeight: 600, color: C.navy, marginBottom: 4 }}>No feedback found</div>
            <div style={{ fontSize: 13 }}>Try adjusting the filters above.</div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>{["#", "User", "Company", "Feedback", "📎", "Status", "Credit", "Email", "Approved By", "Date", "Actions"].map(h => (
                <th key={h} style={{ padding: "9px 13px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", background: "#fafbfd", borderBottom: `2px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {feedback.map((f, i) => (
                <tr key={f.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfd", verticalAlign: "top" }}>
                  <td style={{ padding: "10px 13px", color: C.muted, fontWeight: 600 }}>#{f.id}</td>
                  <td style={{ padding: "10px 13px", fontWeight: 600, color: C.navy, whiteSpace: "nowrap" }}>{f.username}</td>
                  <td style={{ padding: "10px 13px", color: C.muted, whiteSpace: "nowrap" }}>{f.company_name || f.company_code}</td>
                  <td style={{ padding: "10px 13px", maxWidth: 240 }}>
                    <div style={{ color: "#2c3e50", lineHeight: 1.6, wordBreak: "break-word", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{f.message}</div>
                    {f.rejection_note && (
                      <div style={{ marginTop: 5, fontSize: 11, color: "#c0392b", background: "#fff5f5", borderRadius: 5, padding: "3px 8px" }}>✕ {f.rejection_note}</div>
                    )}
                  </td>
                  <td style={{ padding: "10px 13px" }}>
                    {f.has_screenshot
                      ? <span title="Has screenshot" style={{ fontSize: 16 }}>🖼️</span>
                      : <span style={{ color: C.muted }}>—</span>}
                  </td>
                  <td style={{ padding: "10px 13px", whiteSpace: "nowrap" }}><StatusBadge status={f.status} /></td>
                  <td style={{ padding: "10px 13px", whiteSpace: "nowrap" }}>
                    {f.credit_awarded
                      ? <span style={{ background: "#e8f5e9", color: "#1a5c3a", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>✅ +1</span>
                      : <span style={{ color: C.muted }}>—</span>}
                  </td>
                  <td style={{ padding: "10px 13px" }}>
                    {f.email_sent
                      ? <span title="Thank-you email sent" style={{ color: "#1a73e8", fontSize: 15 }}>✉✓</span>
                      : <span style={{ color: C.muted }}>—</span>}
                  </td>
                  <td style={{ padding: "10px 13px", color: C.muted, whiteSpace: "nowrap" }}>{f.approved_by || "—"}</td>
                  <td style={{ padding: "10px 13px", color: C.muted, whiteSpace: "nowrap", fontSize: 12 }}>{fmtLocal(f.created_at)}</td>
                  <td style={{ padding: "10px 13px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <button onClick={() => setViewTarget(f.id)}
                        style={{ padding: "5px 13px", background: "linear-gradient(135deg,#1a73e8,#0d47a1)", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>
                        👁 View
                      </button>
                      {f.status === "pending" && (
                        <>
                          <button onClick={() => handleApprove(f.id)} disabled={actioning[f.id]}
                            style={{ padding: "5px 13px", background: GRAD.green, color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap", opacity: actioning[f.id] ? 0.6 : 1 }}>
                            {actioning[f.id] === "approving" ? "…" : "✓ Approve"}
                          </button>
                          <button onClick={() => setRejectTarget(f)} disabled={actioning[f.id]}
                            style={{ padding: "5px 12px", background: "#fff5f5", color: "#e74c3c", border: "1px solid #e74c3c", borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>
                            ✕ Reject
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {rejectTarget && (
        <RejectModal
          feedback={rejectTarget}
          onConfirm={handleReject}
          onClose={() => setRejectTarget(null)}
        />
      )}
      {viewTarget && (
        <FeedbackDetailModal
          feedbackId={viewTarget}
          onClose={() => setViewTarget(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  );
}
