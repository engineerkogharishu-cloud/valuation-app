import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { api } from "../services/api";

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

// ── Screenshot preview lightbox ───────────────────────────────
function Lightbox({ src, onClose }) {
  if (!src) return null;
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
        <button onClick={onClose} style={{ position: "absolute", top: -16, right: -16, background: "#fff", border: "none", borderRadius: "50%", width: 32, height: 32, fontSize: 16, fontWeight: 700, cursor: "pointer", zIndex: 1 }}>✕</button>
        <img src={src} alt="Screenshot" style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 12, boxShadow: "0 24px 64px rgba(0,0,0,0.5)", display: "block" }} />
      </div>
    </div>,
    document.body
  );
}

export default function FeedbackSection({ user }) {
  const [feedback, setFeedback]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [message, setMessage]     = useState("");
  const [screenshot, setScreenshot] = useState(null); // base64 data URL
  const [lightbox, setLightbox]   = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg]   = useState("");
  const fileRef = useRef(null);
  const isAdmin = user?.role === "admin";
  const C = { navy: "#0f1f3d", border: "#dde1e7", muted: "#7f8c8d", bg: "#f4f6fa" };

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await api.getMyFeedback(); setFeedback(d.feedback || []); }
    catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Only image files are supported."); return; }
    if (file.size > 5 * 1024 * 1024) { alert("Screenshot must be under 5 MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setScreenshot(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        const reader = new FileReader();
        reader.onload = (ev) => setScreenshot(ev.target.result);
        reader.readAsDataURL(file);
        break;
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true); setSubmitMsg("");
    try {
      await api.submitFeedback(message.trim(), screenshot || "");
      setMessage("");
      setScreenshot(null);
      if (fileRef.current) fileRef.current.value = "";
      setSubmitMsg("✓ Feedback submitted! You will earn 1 credit once approved by Super Admin.");
      load();
    } catch (e) { setSubmitMsg("⚠ " + e.message); }
    finally { setSubmitting(false); setTimeout(() => setSubmitMsg(""), 6000); }
  };

  const approved = feedback.filter(f => f.status === "approved").length;
  const credited = feedback.filter(f => f.credit_awarded).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.navy }}>💬 Feedback</h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: C.muted }}>
          Submit feedback to earn credits. Each approved feedback awards <strong>1 credit</strong> to your company.
        </p>
      </div>

      {/* Stats */}
      {feedback.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          {[
            { label: "Submitted",     value: feedback.length, color: "#1a73e8", bg: "#e8f0fe" },
            { label: "Approved",      value: approved,        color: "#1a5c3a", bg: "#e8f5e9" },
            { label: "Credits Earned",value: credited + " 🪙",color: "#7a5c00", bg: "#fff8e1" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} style={{ background: bg, borderRadius: 12, padding: "14px 18px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Submit form */}
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", padding: "22px 26px" }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: C.navy }}>✍️ Submit New Feedback</h3>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            onPaste={handlePaste}
            placeholder="Share your thoughts, suggestions, or report an issue… You can also paste a screenshot directly (Ctrl+V)."
            rows={5}
            maxLength={2000}
            style={{ padding: "12px 14px", border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 14, resize: "vertical", fontFamily: "'Segoe UI', sans-serif", lineHeight: 1.6 }}
          />

          {/* Screenshot upload */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 8 }}>
              📎 Attach Screenshot <span style={{ fontWeight: 400, textTransform: "none" }}>(optional · max 5 MB · or paste with Ctrl+V)</span>
            </div>
            {screenshot ? (
              <div style={{ position: "relative", display: "inline-block" }}>
                <img
                  src={screenshot}
                  alt="Preview"
                  onClick={() => setLightbox(screenshot)}
                  style={{ maxWidth: 320, maxHeight: 180, borderRadius: 9, border: `2px solid ${C.border}`, cursor: "zoom-in", display: "block" }}
                />
                <button type="button" onClick={() => { setScreenshot(null); if (fileRef.current) fileRef.current.value = ""; }}
                  style={{ position: "absolute", top: -8, right: -8, background: "#e74c3c", color: "#fff", border: "none", borderRadius: "50%", width: 24, height: 24, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                  ✕
                </button>
                <div style={{ marginTop: 5, fontSize: 11, color: C.muted }}>Click image to enlarge</div>
              </div>
            ) : (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 18px", border: `1.5px dashed ${C.border}`, borderRadius: 9, cursor: "pointer", fontSize: 13, color: C.muted, background: C.bg, transition: "border-color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#1a73e8"}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                🖼️ Choose image or paste screenshot
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
              </label>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: C.muted }}>{message.length}/2000 characters</span>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {submitMsg && <span style={{ fontSize: 13, color: submitMsg.startsWith("✓") ? "#1a5c3a" : "#c0392b", fontWeight: 600 }}>{submitMsg}</span>}
              <button type="submit" disabled={submitting || !message.trim()}
                style={{ padding: "10px 24px", background: message.trim() ? "linear-gradient(135deg,#0f1f3d,#1a3a6b)" : "#ccc", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: message.trim() && !submitting ? "pointer" : "not-allowed", opacity: submitting ? 0.7 : 1 }}>
                {submitting ? "Submitting…" : "📤 Submit Feedback"}
              </button>
            </div>
          </div>
        </form>
        <div style={{ marginTop: 14, background: "#f0fdf4", border: "1px solid #27ae60", borderRadius: 9, padding: "10px 14px", fontSize: 13, color: "#1a5c3a", display: "flex", alignItems: "center", gap: 10 }}>
          🪙 <span><strong>Earn 1 Credit</strong> for each feedback approved by the Super Admin. Credits are added to your company balance.</span>
        </div>
      </div>

      {/* Feedback list */}
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: `2px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.navy }}>
            {isAdmin ? "Company Feedback" : "My Feedback"} ({feedback.length})
          </h3>
          <button onClick={load} disabled={loading} style={{ padding: "5px 12px", background: C.bg, border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>↺ Refresh</button>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Loading…</div>
        ) : feedback.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: C.muted }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
            <div style={{ fontWeight: 600, color: C.navy, marginBottom: 4 }}>No feedback yet</div>
            <div style={{ fontSize: 13 }}>Submit your first feedback above to earn a credit.</div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>{(isAdmin ? ["#", "By", "Feedback", "📎", "Status", "Credit", "Approved By", "Date"] : ["#", "Feedback", "📎", "Status", "Credit", "Approved By", "Date"]).map(h => (
                <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", background: "#fafbfd", borderBottom: `2px solid ${C.border}` }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {feedback.map((f, i) => (
                <tr key={f.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfd", verticalAlign: "top" }}>
                  <td style={{ padding: "10px 14px", color: C.muted, fontWeight: 600 }}>#{f.id}</td>
                  {isAdmin && <td style={{ padding: "10px 14px", fontWeight: 600, color: C.navy, whiteSpace: "nowrap" }}>{f.username}</td>}
                  <td style={{ padding: "10px 14px", maxWidth: 340 }}>
                    <div style={{ color: "#2c3e50", lineHeight: 1.6, wordBreak: "break-word" }}>{f.message}</div>
                    {f.status === "rejected" && f.rejection_note && (
                      <div style={{ marginTop: 5, fontSize: 12, color: "#c0392b", background: "#fff5f5", borderRadius: 6, padding: "4px 10px" }}>✕ {f.rejection_note}</div>
                    )}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    {f.has_screenshot
                      ? <button onClick={async () => { const d = await api.getFeedbackDetail(f.id); setLightbox(d.screenshot); }}
                          style={{ padding: "4px 10px", background: "#e8f0fe", color: "#1a73e8", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>🖼 View</button>
                      : <span style={{ color: C.muted }}>—</span>}
                  </td>
                  <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}><StatusBadge status={f.status} /></td>
                  <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                    {f.credit_awarded
                      ? <span style={{ background: "#e8f5e9", color: "#1a5c3a", borderRadius: 6, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>✅ +1 🪙</span>
                      : <span style={{ color: C.muted }}>—</span>}
                  </td>
                  <td style={{ padding: "10px 14px", color: C.muted, whiteSpace: "nowrap" }}>{f.approved_by || "—"}</td>
                  <td style={{ padding: "10px 14px", color: C.muted, whiteSpace: "nowrap" }}>{fmtLocal(f.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
