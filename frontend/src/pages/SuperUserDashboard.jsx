import React, { useState, useEffect, useCallback } from "react";
import { api } from "../services/api";
import PasswordInput from "../components/ui/PasswordInput";
import ContourMap from "../components/common/ContourMap";
import { DevCredit } from "../components/ui/DeveloperCard";
import FeedbackAdmin from "../components/FeedbackAdmin";

const fmtLocal = (iso) => {
  if (!iso) return "—";
  return new Date(iso.endsWith("Z") ? iso : iso + "Z")
    .toLocaleString(undefined, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
};

// ── Design tokens ─────────────────────────────────────────────
const C = {
  navy: "#0f1f3d", blue: "#1a73e8", danger: "#e74c3c",
  success: "#27ae60", warn: "#f39c12", purple: "#8e44ad",
  bg: "#eef1f8", border: "#dde1e7", text: "#2c3e50", muted: "#8a97aa",
};

const GRAD = {
  navy:    "linear-gradient(135deg, #0f1f3d 0%, #1a3a6b 100%)",
  blue:    "linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%)",
  orange:  "linear-gradient(135deg, #f39c12 0%, #e67e22 100%)",
  green:   "linear-gradient(135deg, #27ae60 0%, #1a7a3f 100%)",
  purple:  "linear-gradient(135deg, #8e44ad 0%, #6c3483 100%)",
  danger:  "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)",
};

const S = {
  page: { minHeight: "100vh", background: C.bg, fontFamily: "'Segoe UI', system-ui, sans-serif" },

  // Header
  header: {
    background: GRAD.navy,
    color: "#fff", padding: "0 32px",
    display: "grid", gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    height: 72, boxShadow: "0 4px 24px rgba(15,31,61,0.45)",
    position: "sticky", top: 0, zIndex: 100,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 14 },
  headerCenter: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" },
  headerLogo: {
    width: 36, height: 36, borderRadius: 8,
    background: "rgba(255,255,255,0.15)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 18,
  },
  headerTitle: { margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: "-0.3px" },
  headerSub: { fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: "0.4px" },
  headerRight: { display: "flex", alignItems: "center", gap: 12, justifyContent: "flex-end" },
  badge: {
    background: "rgba(231,76,60,0.9)", color: "#fff",
    borderRadius: 5, padding: "3px 9px", fontSize: 10, fontWeight: 800, letterSpacing: "0.5px",
  },
  userPill: {
    background: "rgba(255,255,255,0.12)", borderRadius: 20,
    padding: "5px 12px 5px 8px", display: "flex", alignItems: "center", gap: 7, fontSize: 13,
  },
  avatar: {
    width: 26, height: 26, borderRadius: "50%",
    background: "rgba(255,255,255,0.25)",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
  },
  logoutBtn: {
    background: "rgba(255,255,255,0.12)", color: "#fff",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: 7, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600,
  },

  // Body
  body: { padding: "28px 32px", maxWidth: 1360, margin: "0 auto" },

  // Stat cards
  statCard: (grad) => ({
    background: grad, borderRadius: 14, padding: "22px 24px",
    boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
    position: "relative", overflow: "hidden", cursor: "default",
  }),
  statLabel: { margin: 0, fontSize: 11, color: "rgba(255,255,255,0.75)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.7px" },
  statValue: { margin: "8px 0 0", fontSize: 38, fontWeight: 800, color: "#fff", lineHeight: 1 },
  statIcon: { position: "absolute", right: 18, bottom: 14, fontSize: 42, opacity: 0.18 },
  statGlow: {
    position: "absolute", top: -30, right: -30, width: 100, height: 100,
    borderRadius: "50%", background: "rgba(255,255,255,0.08)",
  },

  // Tab nav
  tabBar: {
    background: "#fff", borderRadius: 12, padding: "5px",
    display: "flex", gap: 3, marginBottom: 24,
    boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
  },
  tab: (active) => ({
    flex: 1, padding: "10px 16px", border: "none", cursor: "pointer",
    borderRadius: 9, fontSize: 13, fontWeight: active ? 700 : 500,
    background: active ? GRAD.blue : "transparent",
    color: active ? "#fff" : C.muted,
    boxShadow: active ? "0 4px 14px rgba(26,115,232,0.35)" : "none",
    transition: "all 0.18s",
  }),

  // Section cards
  section: {
    background: "#fff", borderRadius: 14,
    boxShadow: "0 2px 12px rgba(0,0,0,0.07)", marginBottom: 24, overflow: "hidden",
  },
  sectionHead: {
    padding: "16px 24px", borderBottom: `1px solid ${C.border}`,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: "#fdfdfe",
  },
  sectionTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: C.navy },

  // Table
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700,
    color: C.muted, textTransform: "uppercase", letterSpacing: "0.4px",
    borderBottom: `2px solid ${C.border}`, background: "#f8f9fc",
  },
  td: { padding: "12px 16px", fontSize: 13.5, color: C.text, borderBottom: `1px solid #f0f2f6` },

  // Buttons
  btn: (grad = GRAD.blue) => ({
    background: grad, color: "#fff", border: "none", borderRadius: 8,
    padding: "8px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600,
    boxShadow: "0 3px 10px rgba(0,0,0,0.2)",
  }),
  outlineBtn: {
    background: "#fff", color: C.text, border: `1px solid ${C.border}`,
    borderRadius: 7, padding: "6px 13px", cursor: "pointer", fontSize: 13,
  },
  dangerOutlineBtn: {
    background: "#fff", color: C.danger, border: `1px solid ${C.danger}44`,
    borderRadius: 7, padding: "6px 13px", cursor: "pointer", fontSize: 13,
  },

  // Tags
  tag: (color) => ({
    background: color + "18", color, borderRadius: 5,
    padding: "2px 9px", fontSize: 11, fontWeight: 700, letterSpacing: "0.3px",
  }),
};

// ── Modal ─────────────────────────────────────────────────────
function Modal({ title, onClose, children, maxWidth = 520 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,31,61,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000, padding: 16, backdropFilter: "blur(2px)" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", width: "100%", maxWidth, boxShadow: "0 32px 80px rgba(0,0,0,0.3)", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <h3 style={{ margin: 0, color: C.navy, fontSize: 18, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "#f0f2f6", border: "none", borderRadius: 7, width: 30, height: 30, cursor: "pointer", color: C.muted, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Form helpers ──────────────────────────────────────────────
const FL = ({ label, col, children }) => (
  <div style={{ marginBottom: 14, gridColumn: col === 2 ? "1 / -1" : undefined }}>
    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#666", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</label>
    {children}
  </div>
);

const Input = (props) => (
  <input {...props} style={{ width: "100%", padding: "10px 14px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 14, boxSizing: "border-box", outline: "none", background: "#fafbfd" }} />
);

const Select = ({ children, ...props }) => (
  <select {...props} style={{ width: "100%", padding: "10px 14px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 14, background: "#fafbfd" }}>
    {children}
  </select>
);

// ── System section header ─────────────────────────────────────
function SystemSectionHead({ title, sub }) {
  return (
    <div style={{ padding: "14px 22px", background: "linear-gradient(90deg, #0f1f3d08, transparent)", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: GRAD.navy, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>⚙</div>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.navy }}>{title}</p>
          {sub && <p style={{ margin: 0, fontSize: 11, color: C.muted }}>{sub}</p>}
        </div>
      </div>
      <span style={{ background: C.navy + "14", color: C.navy, borderRadius: 5, padding: "2px 9px", fontSize: 10, fontWeight: 800, letterSpacing: "0.5px" }}>INTERNAL</span>
    </div>
  );
}

// ── LetterheadBoxDefiner ──────────────────────────────────────
// Shows the letterhead PNG at A4 proportions. Admin drags to draw
// the text-area box. Box coords stored as % of the preview container.
function LetterheadBoxDefiner({ png, box, onChange }) {
  const containerRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  const [start, setStart] = React.useState(null);
  const [current, setCurrent] = React.useState(null);

  // A4 ratio: 210 × 297 mm → height = width × (297/210)
  const A4_RATIO = 297 / 210;

  const getRelPos = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top)  / rect.height)),
    };
  };

  const onMouseDown = (e) => {
    e.preventDefault();
    const pos = getRelPos(e);
    setStart(pos); setCurrent(pos); setDragging(true);
  };

  const onMouseMove = (e) => {
    if (!dragging) return;
    setCurrent(getRelPos(e));
  };

  const onMouseUp = (e) => {
    if (!dragging || !start) return;
    setDragging(false);
    const end = getRelPos(e);
    const left   = Math.min(start.x, end.x);
    const top    = Math.min(start.y, end.y);
    const width  = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    if (width > 0.02 && height > 0.02) {
      onChange({ top: +(top*100).toFixed(2), left: +(left*100).toFixed(2), width: +(width*100).toFixed(2), height: +(height*100).toFixed(2) });
    }
    setStart(null); setCurrent(null);
  };

  // Compute live drag rect
  const dragRect = dragging && start && current ? {
    left:   `${Math.min(start.x, current.x) * 100}%`,
    top:    `${Math.min(start.y, current.y) * 100}%`,
    width:  `${Math.abs(current.x - start.x) * 100}%`,
    height: `${Math.abs(current.y - start.y) * 100}%`,
  } : null;

  return (
    <div>
      <div style={{ fontSize: 11, color: "#555", marginBottom: 8, padding: "6px 10px", background: "#fffbe6", border: "1px solid #f0d060", borderRadius: 6 }}>
        💡 <strong>Drag on the preview</strong> to draw the text area box. The cover letter text will be placed exactly within that box.
        {box && <span style={{ marginLeft: 8, color: "#27ae60", fontWeight: 600 }}>✓ Box defined: top {box.top}%, left {box.left}%, {box.width}% × {box.height}%</span>}
      </div>

      {/* A4-proportioned preview container */}
      <div
        ref={containerRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{
          position: "relative", width: "100%",
          paddingBottom: `${A4_RATIO * 100}%`,
          background: "#fff", border: "2px solid #1a73e8",
          borderRadius: 6, overflow: "hidden", cursor: "crosshair",
          userSelect: "none",
        }}
      >
        {/* Letterhead image — contain preserves aspect ratio exactly as uploaded */}
        <img src={png} alt="Letterhead"
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "contain", objectPosition: "top center", display: "block", pointerEvents: "none" }}
        />

        {/* Saved box */}
        {box && !dragging && (
          <div style={{
            position: "absolute",
            top: `${box.top}%`, left: `${box.left}%`,
            width: `${box.width}%`, height: `${box.height}%`,
            border: "2.5px solid #1a73e8",
            background: "rgba(26,115,232,0.10)",
            boxSizing: "border-box", pointerEvents: "none",
          }}>
            <div style={{ position: "absolute", top: 2, left: 4, fontSize: 9, fontWeight: 700, color: "#1a73e8", background: "rgba(255,255,255,0.85)", padding: "1px 4px", borderRadius: 3, whiteSpace: "nowrap" }}>
              TEXT AREA
            </div>
          </div>
        )}

        {/* Live drag rect */}
        {dragRect && (
          <div style={{
            position: "absolute", ...dragRect,
            border: "2px dashed #e74c3c",
            background: "rgba(231,76,60,0.08)",
            boxSizing: "border-box", pointerEvents: "none",
          }} />
        )}

        {/* Corner labels */}
        <div style={{ position: "absolute", top: 4, left: 6, fontSize: 9, color: "rgba(0,0,0,0.3)", pointerEvents: "none" }}>A4 Top-Left</div>
        <div style={{ position: "absolute", bottom: 4, right: 6, fontSize: 9, color: "rgba(0,0,0,0.3)", pointerEvents: "none" }}>A4 Bottom-Right</div>
      </div>
    </div>
  );
}


// ── Main Dashboard ────────────────────────────────────────────
// ── Credit Management Panel ────────────────────────────────────
function CreditManagement({ companies }) {
  const [creditList, setCreditList] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [selected, setSelected]     = useState(null); // company_code for history
  const [history, setHistory]       = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [assignForm, setAssignForm] = useState({ company_code: "", amount: "", expiry: "", low_threshold: "", note: "" });
  const [assignMsg, setAssignMsg]   = useState("");
  const [assigning, setAssigning]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await api.getAdminCredits(); setCreditList(d.companies); }
    catch (e) { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadHistory = async (code) => {
    setSelected(code);
    setHistLoading(true);
    try { const d = await api.getCreditHistory(code); setHistory(d.transactions); }
    catch (_) { setHistory([]); }
    finally { setHistLoading(false); }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    setAssigning(true); setAssignMsg("");
    try {
      const amt = parseInt(assignForm.amount, 10);
      if (!assignForm.company_code || isNaN(amt) || amt <= 0) { setAssignMsg("⚠ Select a company and enter a valid amount."); return; }
      const payload = { company_code: assignForm.company_code, amount: amt, note: assignForm.note };
      if (assignForm.expiry) payload.expiry = assignForm.expiry;
      if (assignForm.low_threshold) payload.low_threshold = parseInt(assignForm.low_threshold, 10);
      await api.assignCredits(payload);
      setAssignMsg(`✓ ${amt} credits assigned to ${assignForm.company_code}`);
      setAssignForm(f => ({ ...f, amount: "", note: "" }));
      load();
      if (selected === assignForm.company_code) loadHistory(assignForm.company_code);
    } catch (e) { setAssignMsg("⚠ " + e.message); }
    finally { setAssigning(false); setTimeout(() => setAssignMsg(""), 4000); }
  };

  const GRAD = {
    navy:  "linear-gradient(135deg,#0f1f3d,#1a3a6b)",
    green: "linear-gradient(135deg,#27ae60,#1a7a3f)",
    warn:  "linear-gradient(135deg,#f39c12,#e67e22)",
    danger:"linear-gradient(135deg,#e74c3c,#c0392b)",
  };
  const C2 = { border: "#dde1e7", muted: "#7f8c8d", navy: "#0f1f3d", text: "#2c3e50" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C2.navy }}>🪙 Credit Management</h2>

      {/* Assign credits form */}
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", padding: "22px 24px" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: C2.navy }}>Assign / Top-up Credits</h3>
        <form onSubmit={handleAssign} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 2fr auto", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C2.muted, marginBottom: 5, textTransform: "uppercase" }}>Company</div>
            <select value={assignForm.company_code} onChange={e => setAssignForm(f => ({ ...f, company_code: e.target.value }))}
              style={{ width: "100%", padding: "9px 10px", border: `1.5px solid ${C2.border}`, borderRadius: 8, fontSize: 13 }}>
              <option value="">— Select —</option>
              {companies.map(c => <option key={c.company_code} value={c.company_code}>{c.company_name} ({c.company_code})</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C2.muted, marginBottom: 5, textTransform: "uppercase" }}>Credits</div>
            <input type="number" min={1} value={assignForm.amount} onChange={e => setAssignForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="e.g. 50" style={{ width: "100%", padding: "9px 10px", border: `1.5px solid ${C2.border}`, borderRadius: 8, fontSize: 13, boxSizing: "border-box" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C2.muted, marginBottom: 5, textTransform: "uppercase" }}>Expiry</div>
            <input type="date" value={assignForm.expiry} onChange={e => setAssignForm(f => ({ ...f, expiry: e.target.value }))}
              style={{ width: "100%", padding: "9px 10px", border: `1.5px solid ${C2.border}`, borderRadius: 8, fontSize: 13, boxSizing: "border-box" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C2.muted, marginBottom: 5, textTransform: "uppercase" }}>Low Alert At</div>
            <input type="number" min={1} value={assignForm.low_threshold} onChange={e => setAssignForm(f => ({ ...f, low_threshold: e.target.value }))}
              placeholder="5" style={{ width: "100%", padding: "9px 10px", border: `1.5px solid ${C2.border}`, borderRadius: 8, fontSize: 13, boxSizing: "border-box" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C2.muted, marginBottom: 5, textTransform: "uppercase" }}>Note</div>
            <input value={assignForm.note} onChange={e => setAssignForm(f => ({ ...f, note: e.target.value }))}
              placeholder="Optional note" style={{ width: "100%", padding: "9px 10px", border: `1.5px solid ${C2.border}`, borderRadius: 8, fontSize: 13, boxSizing: "border-box" }} />
          </div>
          <button type="submit" disabled={assigning} style={{ padding: "9px 20px", background: GRAD.green, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
            {assigning ? "Assigning…" : "＋ Assign"}
          </button>
        </form>
        {assignMsg && <div style={{ marginTop: 10, fontSize: 13, color: assignMsg.startsWith("✓") ? "#27ae60" : "#e74c3c" }}>{assignMsg}</div>}
      </div>

      {/* Company credit overview table */}
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `2px solid ${C2.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C2.navy }}>Company Credit Overview</h3>
          <button onClick={load} style={{ padding: "6px 14px", background: "#f0f2f5", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>↺ Refresh</button>
        </div>
        {loading ? <div style={{ padding: 32, textAlign: "center", color: C2.muted }}>Loading…</div> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>{["Company", "Code", "Balance", "Low Alert", "Expiry", "Status", ""].map(h => (
                <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C2.muted, textTransform: "uppercase", background: "#fafbfd", borderBottom: `2px solid ${C2.border}` }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {creditList.map((c, i) => {
                const bal = c.credit_balance || 0;
                const low = bal <= (c.credit_low_threshold || 5);
                const critical = bal <= 2;
                const expired = c.credit_expiry && new Date(c.credit_expiry) < new Date();
                return (
                  <tr key={c.company_code} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfd" }}>
                    <td style={{ padding: "9px 14px", fontWeight: 600, color: C2.navy }}>{c.company_name}</td>
                    <td style={{ padding: "9px 14px", color: C2.muted }}>{c.company_code}</td>
                    <td style={{ padding: "9px 14px" }}>
                      <span style={{ background: critical ? "#fff5f5" : low ? "#fffbea" : "#f0fdf4", color: critical ? "#e74c3c" : low ? "#7a5c00" : "#1a5c3a", borderRadius: 6, padding: "3px 10px", fontWeight: 700, fontSize: 12 }}>
                        🪙 {bal}
                      </span>
                    </td>
                    <td style={{ padding: "9px 14px", color: C2.muted }}>{c.credit_low_threshold || 5}</td>
                    <td style={{ padding: "9px 14px", fontSize: 12, color: expired ? "#e74c3c" : C2.muted }}>{c.credit_expiry ? c.credit_expiry.slice(0, 10) : "—"}</td>
                    <td style={{ padding: "9px 14px" }}>
                      {expired ? <span style={{ background: "#fff5f5", color: "#e74c3c", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>Expired</span>
                        : critical ? <span style={{ background: "#fff5f5", color: "#e74c3c", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>Critical</span>
                        : low ? <span style={{ background: "#fffbea", color: "#7a5c00", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>Low</span>
                        : <span style={{ background: "#f0fdf4", color: "#1a5c3a", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>OK</span>}
                    </td>
                    <td style={{ padding: "9px 14px" }}>
                      <button onClick={() => loadHistory(c.company_code)}
                        style={{ padding: "4px 12px", background: selected === c.company_code ? GRAD.navy : "#f0f2f5", color: selected === c.company_code ? "#fff" : C2.text, border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        History
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Transaction history for selected company */}
      {selected && (
        <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `2px solid ${C2.border}` }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C2.navy }}>📋 Transaction Ledger — {selected}</h3>
          </div>
          {histLoading ? <div style={{ padding: 24, textAlign: "center", color: C2.muted }}>Loading…</div> : history.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: C2.muted }}>No transactions yet.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>{["Date & Time", "Actor", "Action", "Amount", "Before", "After", "Report", "Note"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C2.muted, textTransform: "uppercase", background: "#fafbfd", borderBottom: `2px solid ${C2.border}` }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {history.map((tx, i) => (
                  <tr key={tx.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfd" }}>
                    <td style={{ padding: "7px 12px", color: C2.muted, whiteSpace: "nowrap" }}>{fmtLocal(tx.created_at)}</td>
                    <td style={{ padding: "7px 12px", fontWeight: 600, color: C2.navy }}>{tx.actor_username}</td>
                    <td style={{ padding: "7px 12px" }}>
                      <span style={{ background: tx.action === "assign" ? "#e8f5e9" : "#fff5f5", color: tx.action === "assign" ? "#1a5c3a" : "#e74c3c", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                        {tx.action === "assign" ? "＋ Assign" : "− Deduct"}
                      </span>
                    </td>
                    <td style={{ padding: "7px 12px", fontWeight: 700, color: tx.action === "assign" ? "#1a5c3a" : "#e74c3c" }}>
                      {tx.action === "assign" ? "+" : "-"}{tx.amount}
                    </td>
                    <td style={{ padding: "7px 12px", color: C2.muted }}>{tx.balance_before}</td>
                    <td style={{ padding: "7px 12px", fontWeight: 600, color: C2.navy }}>{tx.balance_after}</td>
                    <td style={{ padding: "7px 12px", color: C2.muted }}>{tx.report_type ? `#${tx.report_id} (${tx.report_type === "preliminary" ? "P" : "F"})` : "—"}</td>
                    <td style={{ padding: "7px 12px", color: C2.muted, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ── Company Credit Dashboard (for AdminDashboard) ──────────────
export function CompanyCreditPanel() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.getCredits().then(setData).catch(() => {});
  }, []);
  if (!data) return null;
  const { balance, expiry, low_threshold, history } = data;
  const low = balance <= low_threshold;
  const critical = balance <= 2;
  const expired = expiry && new Date(expiry) < new Date();
  const C2 = { border: "#dde1e7", muted: "#7f8c8d", navy: "#0f1f3d", text: "#2c3e50" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        {[
          { label: "Credit Balance", value: `🪙 ${balance}`, grad: critical ? "linear-gradient(135deg,#e74c3c,#c0392b)" : low ? "linear-gradient(135deg,#f39c12,#e67e22)" : "linear-gradient(135deg,#27ae60,#1a7a3f)" },
          { label: "Expiry", value: expiry ? expiry.slice(0,10) : "No expiry", grad: expired ? "linear-gradient(135deg,#e74c3c,#c0392b)" : "linear-gradient(135deg,#1a73e8,#0d47a1)" },
          { label: "Status", value: expired ? "⚠ Expired" : critical ? "⚠ Critical" : low ? "⚠ Low" : "✓ Active", grad: "linear-gradient(135deg,#0f1f3d,#1a3a6b)" },
        ].map(({ label, value, grad }) => (
          <div key={label} style={{ background: grad, borderRadius: 12, padding: "18px 20px", color: "#fff", boxShadow: "0 4px 16px rgba(0,0,0,0.14)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.75, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{value}</div>
          </div>
        ))}
      </div>
      {(low || expired) && (
        <div style={{ padding: "12px 16px", background: critical || expired ? "#fff5f5" : "#fffbea", border: `1.5px solid ${critical || expired ? "#e74c3c" : "#f39c12"}`, borderRadius: 10, fontSize: 13, color: critical || expired ? "#c0392b" : "#7a5c00", fontWeight: 600 }}>
          {expired ? "⚠ Your credit package has expired. Please contact the Super Admin to renew." : `⚠ Low balance (${balance} credits remaining). Contact the Super Admin to top up.`}
        </div>
      )}
      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: `2px solid ${C2.border}`, fontWeight: 700, fontSize: 14, color: C2.navy }}>📋 Recent Credit Activity</div>
        {history.length === 0 ? <div style={{ padding: 24, textAlign: "center", color: C2.muted }}>No transactions yet.</div> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr>{["Date", "User", "Action", "Credits", "Balance", "Report", "Note"].map(h => (
              <th key={h} style={{ padding: "7px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C2.muted, textTransform: "uppercase", background: "#fafbfd", borderBottom: `2px solid ${C2.border}` }}>{h}</th>
            ))}</tr></thead>
            <tbody>{history.map((tx, i) => (
              <tr key={tx.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfd" }}>
                <td style={{ padding: "6px 12px", color: C2.muted, whiteSpace: "nowrap" }}>{fmtLocal(tx.created_at)}</td>
                <td style={{ padding: "6px 12px", fontWeight: 600 }}>{tx.actor_username}</td>
                <td style={{ padding: "6px 12px" }}>
                  <span style={{ background: tx.action === "assign" ? "#e8f5e9" : "#fff5f5", color: tx.action === "assign" ? "#1a5c3a" : "#e74c3c", borderRadius: 5, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>
                    {tx.action === "assign" ? "＋ Top-up" : "− Print"}
                  </span>
                </td>
                <td style={{ padding: "6px 12px", fontWeight: 700, color: tx.action === "assign" ? "#1a5c3a" : "#e74c3c" }}>{tx.action === "assign" ? "+" : "-"}{tx.amount}</td>
                <td style={{ padding: "6px 12px" }}>{tx.balance_after}</td>
                <td style={{ padding: "6px 12px", color: C2.muted }}>{tx.report_type ? `${tx.report_type === "preliminary" ? "P" : "F"}` : "—"}</td>
                <td style={{ padding: "6px 12px", color: C2.muted }}>{tx.note || "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Rate Map Access Management (Super Admin) ───────────────────
function RateMapAccessAdmin({ companies }) {
  const [list, setList]         = useState([]);
  const [saving, setSaving]     = useState({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [msg, setMsg]           = useState("");
  const [settings, setSettings] = useState(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState("");
  // Local editable settings state
  const [trialSecs, setTrialSecs]   = useState(30);
  const [durations, setDurations]   = useState([{ minutes: 10, credits: 3 }, { minutes: 15, credits: 5 }]);
  const C2 = { border: "#dde1e7", muted: "#7f8c8d", navy: "#0f1f3d" };

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3500); };

  const load = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([api.getAdminRateMapFreeAccess(), api.getAdminRateMapSettings()]);
      setList(d.companies);
      setSettings(s);
      setTrialSecs(s.free_trial_seconds ?? 30);
      setDurations(s.durations || [{ minutes: 10, credits: 3 }, { minutes: 15, credits: 5 }]);
    } catch (_) {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (company_code, currentFree) => {
    setSaving(s => ({ ...s, [company_code]: true }));
    try {
      await api.setRateMapFreeAccess(company_code, !currentFree);
      setList(l => l.map(c => c.company_code === company_code ? { ...c, rate_map_free: currentFree ? 0 : 1 } : c));
      showMsg(`✓ ${company_code}: ${!currentFree ? "Free access enabled" : "Reverted to credit-based"}`);
    } catch (e) { showMsg("⚠ " + e.message); }
    finally { setSaving(s => ({ ...s, [company_code]: false })); }
  };

  const bulkToggle = async (free) => {
    if (!window.confirm(`${free ? "Enable" : "Revoke"} free Rate Map access for ALL companies?`)) return;
    setBulkSaving(true);
    try {
      await api.setRateMapFreeAccessAll(free);
      setList(l => l.map(c => ({ ...c, rate_map_free: free ? 1 : 0 })));
      showMsg(`✓ Free access ${free ? "enabled" : "revoked"} for all ${list.length} companies.`);
    } catch (e) { showMsg("⚠ " + e.message); }
    finally { setBulkSaving(false); }
  };

  const saveSettings = async () => {
    setSettingsSaving(true); setSettingsMsg("");
    try {
      await api.updateAdminRateMapSettings({ free_trial_seconds: Number(trialSecs), durations });
      setSettingsMsg("✓ Settings saved");
      setTimeout(() => setSettingsMsg(""), 3000);
    } catch (e) { setSettingsMsg("⚠ " + e.message); }
    finally { setSettingsSaving(false); }
  };

  const updateDuration = (i, field, val) => {
    setDurations(d => d.map((r, idx) => idx === i ? { ...r, [field]: Number(val) } : r));
  };
  const addDuration = () => setDurations(d => [...d, { minutes: 20, credits: 7 }]);
  const removeDuration = (i) => setDurations(d => d.filter((_, idx) => idx !== i));

  const freeCount = list.filter(c => c.rate_map_free).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C2.navy }}>🗺️ Rate Map Access Control</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C2.muted }}>Configure pricing, free trial, and per-company access for the Rate Map feature.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ background: "#e8f5e9", color: "#1a5c3a", border: "1.5px solid #27ae60", borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 700 }}>
            {freeCount} / {list.length} companies free
          </span>
          <button onClick={() => bulkToggle(true)} disabled={bulkSaving}
            style={{ padding: "8px 16px", background: "linear-gradient(135deg,#27ae60,#1a7a3f)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
            ✅ Enable Free for All
          </button>
          <button onClick={() => bulkToggle(false)} disabled={bulkSaving}
            style={{ padding: "8px 16px", background: "linear-gradient(135deg,#e74c3c,#c0392b)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
            🚫 Revoke All
          </button>
          <button onClick={load} style={{ padding: "8px 14px", background: "#f0f2f5", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>↺</button>
        </div>
      </div>

      {msg && <div style={{ padding: "10px 14px", background: msg.startsWith("✓") ? "#e8f5e9" : "#fff5f5", border: `1px solid ${msg.startsWith("✓") ? "#27ae60" : "#e74c3c"}`, borderRadius: 9, fontSize: 13, color: msg.startsWith("✓") ? "#1a5c3a" : "#c0392b", fontWeight: 600 }}>{msg}</div>}

      {/* Settings panel */}
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", padding: "22px 26px" }}>
        <h3 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 700, color: C2.navy }}>⚙️ Pricing & Free Trial Settings</h3>
        {/* Free trial seconds */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: C2.muted, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Free Trial Duration (seconds)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input type="number" min={0} max={300} value={trialSecs} onChange={e => setTrialSecs(e.target.value)}
              style={{ width: 100, padding: "9px 12px", border: `1.5px solid ${C2.border}`, borderRadius: 8, fontSize: 14, fontWeight: 700 }} />
            <span style={{ fontSize: 13, color: C2.muted }}>seconds of free preview auto-started on load (set 0 to disable)</span>
          </div>
        </div>
        {/* Duration tiers */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: C2.muted, textTransform: "uppercase", display: "block", marginBottom: 10 }}>Paid Duration Tiers</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {durations.map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f4f6fa", borderRadius: 9, padding: "10px 14px", flex: 1 }}>
                  <span style={{ fontSize: 13, color: C2.muted, whiteSpace: "nowrap" }}>⏱ Duration</span>
                  <input type="number" min={1} max={120} value={d.minutes} onChange={e => updateDuration(i, "minutes", e.target.value)}
                    style={{ width: 60, padding: "6px 10px", border: `1.5px solid ${C2.border}`, borderRadius: 7, fontSize: 14, fontWeight: 700, textAlign: "center" }} />
                  <span style={{ fontSize: 13, color: C2.muted }}>min</span>
                  <span style={{ fontSize: 13, color: C2.muted, marginLeft: 16, whiteSpace: "nowrap" }}>🪙 Credits</span>
                  <input type="number" min={1} max={100} value={d.credits} onChange={e => updateDuration(i, "credits", e.target.value)}
                    style={{ width: 60, padding: "6px 10px", border: `1.5px solid ${C2.border}`, borderRadius: 7, fontSize: 14, fontWeight: 700, textAlign: "center" }} />
                </div>
                {durations.length > 1 && (
                  <button onClick={() => removeDuration(i)} style={{ padding: "8px 12px", background: "#fff5f5", border: "1px solid #e74c3c", borderRadius: 7, color: "#e74c3c", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>✕</button>
                )}
              </div>
            ))}
          </div>
          <button onClick={addDuration} style={{ marginTop: 10, padding: "7px 16px", background: "#f0f2f5", border: `1.5px solid ${C2.border}`, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", color: C2.navy }}>＋ Add Tier</button>
        </div>
        {settingsMsg && <div style={{ fontSize: 13, color: settingsMsg.startsWith("✓") ? "#1a5c3a" : "#c0392b", fontWeight: 600, marginBottom: 10 }}>{settingsMsg}</div>}
        <button onClick={saveSettings} disabled={settingsSaving}
          style={{ padding: "10px 24px", background: "linear-gradient(135deg,#0f1f3d,#1a3a6b)", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: settingsSaving ? 0.7 : 1 }}>
          {settingsSaving ? "Saving…" : "💾 Save Settings"}
        </button>
      </div>

      {/* Company table */}
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: `2px solid ${C2.border}`, fontWeight: 700, fontSize: 14, color: C2.navy }}>Per-Company Access Settings</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>{["Company", "Code", "Access Type", "Action"].map(h => (
              <th key={h} style={{ padding: "9px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C2.muted, textTransform: "uppercase", background: "#fafbfd", borderBottom: `2px solid ${C2.border}` }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {list.map((c, i) => (
              <tr key={c.company_code} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfd" }}>
                <td style={{ padding: "10px 16px", fontWeight: 600, color: C2.navy }}>{c.company_name}</td>
                <td style={{ padding: "10px 16px", color: C2.muted }}>{c.company_code}</td>
                <td style={{ padding: "10px 16px" }}>
                  {c.rate_map_free
                    ? <span style={{ background: "#e8f5e9", color: "#1a5c3a", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>✅ Free Access</span>
                    : <span style={{ background: "#f4f6fa", color: C2.muted, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>🪙 Credit-based</span>}
                </td>
                <td style={{ padding: "10px 16px" }}>
                  <button onClick={() => toggle(c.company_code, !!c.rate_map_free)} disabled={!!saving[c.company_code]}
                    style={{ padding: "6px 16px", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", background: c.rate_map_free ? "linear-gradient(135deg,#e74c3c,#c0392b)" : "linear-gradient(135deg,#27ae60,#1a7a3f)", color: "#fff", opacity: saving[c.company_code] ? 0.6 : 1 }}>
                    {saving[c.company_code] ? "…" : c.rate_map_free ? "Revoke Free Access" : "Enable Free Access"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Mass / Broadcast Email ────────────────────────────────────
function BroadcastEmail({ companies }) {
  const [subject, setSubject] = useState("");
  const [body, setBody]       = useState("");
  const [target, setTarget]   = useState("all");
  const [sending, setSending] = useState(false);
  const [result, setResult]   = useState(null);

  const send = async () => {
    if (!subject.trim() || !body.trim()) return alert("Subject and message are required.");
    if (!window.confirm(`Send to ${target === "all" ? "ALL companies" : target}?`)) return;
    setSending(true); setResult(null);
    try {
      // Wrap plain text body in basic HTML
      const html = `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:580px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e0e4ea;overflow:hidden">
        <div style="background:linear-gradient(135deg,#0f1f3d,#1a3a6b);padding:28px 32px;color:#fff">
          <h1 style="margin:0;font-size:20px;font-weight:800">${subject}</h1>
          <p style="margin:6px 0 0;opacity:0.7;font-size:12px">One Degree Consultant Pvt. Ltd. — Valuation System</p>
        </div>
        <div style="padding:28px 32px;font-size:14px;color:#2d3748;line-height:1.8;white-space:pre-wrap">${body.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</div>
        <div style="padding:16px 32px;border-top:1px solid #e2e8f0;font-size:12px;color:#aaa">
          One Degree Consultant Pvt. Ltd. &nbsp;|&nbsp; onedegreeconsultant@gmail.com &nbsp;|&nbsp; 9841357433
        </div>
      </div>`;
      const d = await api.broadcastEmail(subject, html, target);
      setResult({ ok: true, msg: `✓ Sent: ${d.sent}, Failed: ${d.failed}, Total: ${d.total}` });
      setSubject(""); setBody("");
    } catch (e) {
      setResult({ ok: false, msg: "❌ " + e.message });
    } finally { setSending(false); }
  };

  const C2 = { navy: "#0f1f3d", border: "#dde1e7", muted: "#8a97aa" };
  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${C2.border}`, padding: "24px 28px", marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: C2.navy }}>📧 Mass Email Broadcast</h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: C2.muted }}>Send a message to all registered companies or a specific one.</p>

        {/* Target */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C2.muted, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Send To</label>
          <select value={target} onChange={e => setTarget(e.target.value)}
            style={{ padding: "9px 12px", border: `1.5px solid ${C2.border}`, borderRadius: 8, fontSize: 13, width: "100%", boxSizing: "border-box" }}>
            <option value="all">All Companies</option>
            {(companies || []).filter(c => c.contact_email).map(c => (
              <option key={c.company_code} value={c.company_code}>{c.company_name} ({c.contact_email})</option>
            ))}
          </select>
        </div>

        {/* Subject */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C2.muted, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Subject</label>
          <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject..."
            style={{ padding: "9px 12px", border: `1.5px solid ${C2.border}`, borderRadius: 8, fontSize: 13, width: "100%", boxSizing: "border-box" }} />
        </div>

        {/* Body */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C2.muted, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Message</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={10} placeholder="Write your message here..."
            style={{ padding: "10px 12px", border: `1.5px solid ${C2.border}`, borderRadius: 8, fontSize: 13, width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
        </div>

        <button onClick={send} disabled={sending}
          style={{ padding: "11px 28px", background: GRAD.navy, color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: sending ? "not-allowed" : "pointer", opacity: sending ? 0.7 : 1 }}>
          {sending ? "Sending…" : "📤 Send Email"}
        </button>

        {result && (
          <div style={{ marginTop: 14, padding: "10px 16px", borderRadius: 8, background: result.ok ? "#f0fdf4" : "#fff5f5", border: `1px solid ${result.ok ? "#86efac" : "#fca5a5"}`, color: result.ok ? "#166534" : "#c0392b", fontSize: 13, fontWeight: 600 }}>
            {result.msg}
          </div>
        )}
      </div>

      {/* Email config status */}
      <div style={{ background: "#fff8e1", border: "1px solid #f6d860", borderRadius: 10, padding: "12px 18px", fontSize: 12, color: "#78580a" }}>
        <strong>⚙️ Email Config:</strong> Set <code>RESEND_API_KEY</code> and <code>EMAIL_FROM</code> in your server environment (.env / Railway variables) to enable sending.
      </div>
    </div>
  );
}

// ── Registration Requests Panel ───────────────────────────────
function RegistrationsPanel({ onCountChange }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("pending");
  const [approveModal, setApproveModal] = useState(null);
  const [rejectModal, setRejectModal]   = useState(null);
  const [form, setForm]   = useState({ company_code: "", admin_username: "", admin_password: "" });
  const [rejectNote, setRejectNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState("");

  const load = useCallback(async (f = filter) => {
    setLoading(true);
    try {
      const d = await api.listRegistrations(f || undefined);
      setRequests(d.requests);
      if (f === "pending" || f === "") {
        const pending = f === "pending" ? d.requests.length
          : d.requests.filter(r => r.status === "pending").length;
        onCountChange?.(pending);
      }
    } catch (_) {}
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, []);

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(""), 4000); };

  const handleApprove = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.approveRegistration(approveModal.id, form);
      showMsg(`✓ Company "${form.company_code}" created and request approved.`);
      setApproveModal(null);
      setForm({ company_code: "", admin_username: "", admin_password: "" });
      load("pending");
    } catch (err) { showMsg("⚠ " + err.message); }
    finally { setSaving(false); }
  };

  const handleReject = async () => {
    setSaving(true);
    try {
      await api.rejectRegistration(rejectModal.id, rejectNote);
      showMsg("✓ Request rejected.");
      setRejectModal(null); setRejectNote("");
      load(filter);
    } catch (err) { showMsg("⚠ " + err.message); }
    finally { setSaving(false); }
  };

  const fmtDate = (d) => d ? new Date(d.endsWith("Z") ? d : d + "Z").toLocaleString() : "—";
  const statusColor = { pending: C.warn, approved: C.success, rejected: C.danger };
  const statusBg    = { pending: "#fffbea", approved: "#f0fdf4", rejected: "#fff5f5" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.navy }}>📝 Registration Requests</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.muted }}>Companies that requested access via the registration form.</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {["pending", "approved", "rejected", ""].map((f) => (
            <button key={f || "all"} onClick={() => { setFilter(f); load(f); }}
              style={{ padding: "6px 14px", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700,
                background: filter === f ? GRAD.blue : "#f0f2f5",
                color: filter === f ? "#fff" : C.muted,
                boxShadow: filter === f ? "0 2px 8px rgba(26,115,232,0.3)" : "none" }}>
              {f || "All"}
            </button>
          ))}
          <button onClick={() => load(filter)} style={{ padding: "6px 12px", background: "#f0f2f5", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13 }}>↺</button>
        </div>
      </div>

      {msg && (
        <div style={{ padding: "10px 16px", background: msg.startsWith("✓") ? "#f0fdf4" : "#fff5f5",
          border: `1px solid ${msg.startsWith("✓") ? C.success : C.danger}`,
          borderRadius: 9, fontSize: 13, color: msg.startsWith("✓") ? "#1a5c3a" : C.danger, fontWeight: 600 }}>
          {msg}
        </div>
      )}

      <div style={S.section}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: C.muted }}>Loading…</div>
        ) : requests.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: C.muted }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
            <p>No {filter || ""} registration requests.</p>
          </div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>{["#", "Company", "Contact", "Email", "Phone", "Message", "Submitted", "Status", "Actions"].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {requests.map((r, i) => (
                <tr key={r.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfd" }}>
                  <td style={{ ...S.td, color: C.muted, fontSize: 11 }}>{r.id}</td>
                  <td style={{ ...S.td, fontWeight: 700, color: C.navy }}>{r.company_name}</td>
                  <td style={S.td}>{r.contact_name}</td>
                  <td style={{ ...S.td, color: C.blue }}>{r.email}</td>
                  <td style={{ ...S.td, color: C.muted }}>{r.phone || "—"}</td>
                  <td style={{ ...S.td, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: C.muted, fontSize: 12 }}
                    title={r.message}>{r.message || "—"}</td>
                  <td style={{ ...S.td, fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>{fmtDate(r.created_at)}</td>
                  <td style={S.td}>
                    <span style={{ background: statusBg[r.status], color: statusColor[r.status],
                      borderRadius: 5, padding: "3px 9px", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>
                      {r.status}
                    </span>
                    {r.status !== "pending" && r.reviewed_by && (
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>by {r.reviewed_by}</div>
                    )}
                  </td>
                  <td style={S.td}>
                    {r.status === "pending" ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => { setApproveModal(r); setForm({ company_code: "", admin_username: "", admin_password: "" }); }}
                          style={{ padding: "5px 12px", background: GRAD.green, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                          ✓ Approve
                        </button>
                        <button onClick={() => { setRejectModal(r); setRejectNote(""); }}
                          style={{ padding: "5px 12px", background: "#fff", color: C.danger, border: `1px solid ${C.danger}`, borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                          ✕ Reject
                        </button>
                      </div>
                    ) : r.status === "rejected" && r.rejection_note ? (
                      <span style={{ fontSize: 11, color: C.muted, fontStyle: "italic" }} title={r.rejection_note}>
                        "{r.rejection_note.slice(0, 30)}{r.rejection_note.length > 30 ? "…" : ""}"
                      </span>
                    ) : <span style={{ color: C.muted, fontSize: 12 }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Approve Modal */}
      {approveModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,31,61,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000, padding: 16, backdropFilter: "blur(2px)" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", width: "100%", maxWidth: 480, boxShadow: "0 32px 80px rgba(0,0,0,0.3)" }}>
            <h3 style={{ margin: "0 0 6px", color: C.navy }}>✓ Approve Registration</h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: C.muted }}>
              Approving <strong>{approveModal.company_name}</strong> — create a company code and admin account.
            </p>
            <form onSubmit={handleApprove}>
              {msg.startsWith("⚠") && (
                <div style={{ background: "#fdecea", color: C.danger, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{msg}</div>
              )}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#666", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Company Code *</label>
                <input value={form.company_code} onChange={e => setForm(f => ({ ...f, company_code: e.target.value.toUpperCase() }))}
                  required placeholder="e.g. HBL001"
                  style={{ width: "100%", padding: "10px 14px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#666", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Admin Username *</label>
                <input value={form.admin_username} onChange={e => setForm(f => ({ ...f, admin_username: e.target.value }))}
                  required placeholder="Admin login name"
                  style={{ width: "100%", padding: "10px 14px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#666", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Temporary Password * (admin must change on first login)</label>
                <input type="password" value={form.admin_password} onChange={e => setForm(f => ({ ...f, admin_password: e.target.value }))}
                  required minLength={6} placeholder="Min 6 characters"
                  style={{ width: "100%", padding: "10px 14px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" style={S.outlineBtn} onClick={() => setApproveModal(null)}>Cancel</button>
                <button type="submit" disabled={saving}
                  style={{ padding: "9px 22px", background: GRAD.green, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
                  {saving ? "Creating…" : "✓ Create & Approve"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,31,61,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000, padding: 16, backdropFilter: "blur(2px)" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", width: "100%", maxWidth: 420, boxShadow: "0 32px 80px rgba(0,0,0,0.3)" }}>
            <h3 style={{ margin: "0 0 6px", color: C.danger }}>✕ Reject Request</h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: C.muted }}>
              Rejecting <strong>{rejectModal.company_name}</strong> ({rejectModal.email})
            </p>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#666", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Reason (optional)</label>
              <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                rows={3} placeholder="Reason for rejection…"
                style={{ width: "100%", padding: "10px 14px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 14, boxSizing: "border-box", resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={S.outlineBtn} onClick={() => setRejectModal(null)}>Cancel</button>
              <button onClick={handleReject} disabled={saving}
                style={{ padding: "9px 22px", background: GRAD.danger, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
                {saving ? "Rejecting…" : "✕ Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SuperUserDashboard({ user, onLogout }) {
  const [companies, setCompanies]   = useState([]);
  const [users, setUsers]           = useState([]);
  const [tab, setTab]               = useState("companies");
  const [pendingRegCount, setPendingRegCount] = useState(0);
  const [expandedCompany, setExpandedCompany] = useState(null);
  const [companySearch, setCompanySearch]     = useState("");

  const [stats, setStats]           = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsFilter, setStatsFilter]   = useState("");
  // Expanded company reports in the breakdown table
  const [expandedCompanyCode, setExpandedCompanyCode]     = useState(null);
  const [companyReports, setCompanyReports]               = useState([]);
  const [companyReportsLoading, setCompanyReportsLoading] = useState(false);
  const [companyBreakdownSearch, setCompanyBreakdownSearch] = useState("");

  const [modal, setModal]   = useState(null);
  const [target, setTarget] = useState(null);
  const [form, setForm]     = useState({});
  const [error, setError]   = useState("");
  const [saving, setSaving] = useState(false);
  const [detailCompany, setDetailCompany] = useState(null); // company detail side panel

  const loadData = useCallback(async () => {
    const [c, u] = await Promise.all([api.listCompanies(), api.listUsers()]);
    setCompanies(c); setUsers(u);
  }, []);

  const loadStats = useCallback(async (companyCode = "") => {
    setStatsLoading(true);
    try {
      const params = companyCode ? { company_code: companyCode } : {};
      const data = await api.getReportStats(params);
      setStats(data);
    } catch (e) { console.error(e); }
    finally { setStatsLoading(false); }
  }, []);

  const loadCompanyReports = useCallback(async (companyCode) => {
    setCompanyReportsLoading(true);
    try {
      const data = await api.listAdminReports({ company_code: companyCode, limit: 200 });
      setCompanyReports(data.reports || []);
    } catch (e) { console.error(e); setCompanyReports([]); }
    finally { setCompanyReportsLoading(false); }
  }, []);

  useEffect(() => {
    loadData();
    // Load pending registration count for the badge
    api.listRegistrations("pending")
      .then(d => setPendingRegCount(d.requests.length))
      .catch(() => {});
  }, [loadData]);
  useEffect(() => { if (tab === "reports") loadStats(statsFilter); }, [tab, statsFilter, loadStats]);

  const openModal = (name, row = null) => {
    setError(""); setTarget(row);
    if (row) {
      // Parse letterhead_text_box from JSON string if needed
      let parsed = { ...row };
      if (typeof parsed.letterhead_text_box === "string" && parsed.letterhead_text_box) {
        try { parsed.letterhead_text_box = JSON.parse(parsed.letterhead_text_box); } catch(_) { parsed.letterhead_text_box = null; }
      }
      setForm(parsed);
    } else {
      setForm({});
    }
    setModal(name);
  };
  const closeModal = () => { setModal(null); setTarget(null); setForm({}); setError(""); };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const saveCompany = async (e) => {
    e.preventDefault(); setSaving(true); setError("");
    try {
      // Serialize letterhead_text_box to JSON string for storage
      const payload = { ...form };
      if (payload.letterhead_text_box && typeof payload.letterhead_text_box === "object") {
        payload.letterhead_text_box = JSON.stringify(payload.letterhead_text_box);
      }
      modal === "addCompany" ? await api.createCompany(payload) : await api.updateCompany(target.id, payload);
      await loadData(); closeModal();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const deleteCompany = async () => {
    setSaving(true); setError("");
    try { await api.deleteCompany(target.id); await loadData(); closeModal(); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const saveUser = async (e) => {
    e.preventDefault(); setSaving(true); setError("");
    try {
      modal === "addUser" ? await api.createUser(form) : await api.updateUser(target.id, form);
      await loadData(); closeModal();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const deleteUser = async () => {
    setSaving(true); setError("");
    try { await api.deleteUser(target.id); await loadData(); closeModal(); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const roleColor = (r) => ({ super_user: C.danger, admin: C.warn, user: C.blue }[r] || C.muted);

  const systemCompany   = companies.find(c => c.company_code === "SYSTEM");
  const clientCompanies = companies.filter(c => c.company_code !== "SYSTEM");
  const filteredCompanies = clientCompanies.filter(c => {
    const q = companySearch.toLowerCase();
    return !q || c.company_code.toLowerCase().includes(q) || (c.company_name || "").toLowerCase().includes(q);
  });
  const usersByCompany = filteredCompanies.map(c => ({
    ...c, members: users.filter(u => u.company_code === c.company_code),
  }));
  const systemUsers = users.filter(u => u.company_code === "SYSTEM");
  const toggleCompany = (code) => setExpandedCompany(prev => prev === code ? null : code);

  // ── KPI data ────────────────────────────────────────────────
  const kpis = [
    { label: "Total Companies",       value: clientCompanies.length,                                grad: GRAD.navy,   icon: "🏢" },
    { label: "Total Users",           value: users.filter(u => u.company_code !== "SYSTEM").length, grad: GRAD.blue,   icon: "👥" },
    { label: "Pending Registrations", value: pendingRegCount, onClick: () => setTab("registrations"), grad: pendingRegCount > 0 ? GRAD.orange : GRAD.green, icon: "📝" },
    { label: "Total Reports",         value: stats?.totals?.total ?? "—", onClick: () => setTab("reports"), grad: GRAD.purple, icon: "📋" },
  ];

  const tabs = [
    ["companies",     "🏢", "Companies"],
    ["users",         "👥", "All Users"],
    ["reports",       "📊", "Reports"],
    ["credits",       "🪙", "Credits"],
    ["ratemap",       "🗺️", "Rate Map Access"],
    ["registrations", "📝", "Registrations", pendingRegCount],
    ["feedback",      "💬", "Feedback"],
    ["broadcast",     "📧", "Mass Email"],
    ["map",           "🗺",  "Map"],
  ];

  return (
    <div style={S.page}>

      {/* ── Header ── */}
      <div style={S.header}>
        {/* Left: logo + title */}
        <div style={S.headerLeft}>
          <div style={S.headerLogo}>⚙</div>
          <div>
            <p style={S.headerTitle}>System Administration</p>
          </div>
        </div>

        {/* Center: developer credit */}
        <div style={S.headerCenter}>
          <DevCredit
            style={{ color: "#fff" }}
            textStyle={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.2px" }}
          />
        </div>

        {/* Right: badge + user + logout */}
        <div style={S.headerRight}>
          <span style={S.badge}>SUPER ADMIN</span>
          <div style={S.userPill}>
            <div style={S.avatar}>👤</div>
            <span>{user.username}</span>
          </div>
          <button style={S.logoutBtn} onClick={onLogout}>Sign Out</button>
        </div>
      </div>

      <div style={S.body}>

        {/* ── KPI Cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18, marginBottom: 26 }}>
          {kpis.map(({ label, value, grad, icon, onClick }) => (
            <div key={label} onClick={onClick} style={{ ...S.statCard(grad), cursor: onClick ? "pointer" : "default" }}>
              <div style={S.statGlow} />
              <p style={S.statLabel}>{label}</p>
              <p style={S.statValue}>{value}</p>
              <span style={S.statIcon}>{icon}</span>
            </div>
          ))}
        </div>

        {/* ── Tab Navigation ── */}
        <div style={S.tabBar}>
          {tabs.map(([t, icon, label, badge]) => (
            <button key={t} onClick={() => setTab(t)} style={{ ...S.tab(tab === t), position: "relative" }}>
              {icon} {label}
              {badge > 0 && (
                <span style={{ position: "absolute", top: 4, right: 6, background: C.danger, color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════════ Companies Tab ══════════════ */}
        {tab === "companies" && (<>

          {/* System Administration card — top */}
          {systemCompany && (
            <div style={{ ...S.section, border: `1.5px solid ${C.navy}20`, marginBottom: 18 }}>
              <SystemSectionHead title="System Administration" sub="Super admin accounts only — not a client company" />
              <table style={S.table}>
                <thead><tr>{["Code","Name","Email","Phone","Super Users","Created"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  <tr style={{ background: "#f8f9fc" }}>
                    <td style={S.td}><code style={{ background: "#fdecea", color: C.danger, padding: "2px 8px", borderRadius: 5, fontSize: 12, fontWeight: 700 }}>{systemCompany.company_code}</code></td>
                    <td style={S.td}><strong>{systemCompany.company_name}</strong></td>
                    <td style={S.td}>{systemCompany.contact_email || <span style={{ color: C.muted }}>—</span>}</td>
                    <td style={S.td}>{systemCompany.contact_phone || <span style={{ color: C.muted }}>—</span>}</td>
                    <td style={S.td}><span style={S.tag(C.danger)}>{systemCompany.user_count} users</span></td>
                    <td style={{ ...S.td, color: C.muted, fontSize: 12 }}>{systemCompany.created_at?.slice(0,10)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Client companies */}
          <div style={S.section}>
            <div style={S.sectionHead}>
              <div>
                <h2 style={S.sectionTitle}>Companies</h2>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: C.muted }}>
                  {filteredCompanies.length}{companySearch ? ` of ${clientCompanies.length}` : ""} registered
                </p>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: C.muted, fontSize: 13 }}>🔍</span>
                  <input
                    type="text" placeholder="Search code or name…"
                    value={companySearch} onChange={e => setCompanySearch(e.target.value)}
                    style={{ padding: "8px 32px 8px 34px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, width: 210, outline: "none", background: "#fafbfd" }}
                  />
                  {companySearch && (
                    <button onClick={() => setCompanySearch("")} style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.muted, lineHeight: 1 }}>✕</button>
                  )}
                </div>
                <button style={S.btn()} onClick={() => openModal("addCompany")}>+ Add Company</button>
              </div>
            </div>
            <table style={S.table}>
              <thead>
                <tr>{["Code","Company Name","Email","Phone","Credits","Users","Created","Actions"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filteredCompanies.map((c, i) => {
                  const bal      = c.credit_balance ?? 0;
                  const low      = bal <= (c.credit_low_threshold ?? 5);
                  const critical = bal <= 2;
                  const expired  = c.credit_expiry && new Date(c.credit_expiry) < new Date();
                  const creditColor  = expired || critical ? C.danger : low ? C.warn : C.success;
                  const creditBg     = expired || critical ? "#fff5f5"  : low ? "#fffbea" : "#f0fdf4";
                  return (
                    <tr key={c.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfd" }}>
                      <td style={S.td}>
                        <code style={{ background: "#edf2ff", color: C.blue, padding: "2px 8px", borderRadius: 5, fontSize: 12, fontWeight: 700 }}>{c.company_code}</code>
                      </td>
                      <td style={S.td}>
                        <span
                          onClick={() => setDetailCompany({ ...c, members: users.filter(u => u.company_code === c.company_code) })}
                          style={{ color: C.blue, fontWeight: 700, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}
                        >
                          {c.company_name || "—"}
                        </span>
                      </td>
                      <td style={{ ...S.td, color: C.muted }}>{c.contact_email || "—"}</td>
                      <td style={{ ...S.td, color: C.muted }}>{c.contact_phone || "—"}</td>
                      <td style={S.td}>
                        <span style={{ background: creditBg, color: creditColor, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          🪙 {bal}
                          {(expired || critical) && <span style={{ fontSize: 9, marginLeft: 2 }}>!</span>}
                        </span>
                        {expired && <div style={{ fontSize: 9, color: C.danger, marginTop: 2 }}>Expired</div>}
                        {!expired && low && !critical && <div style={{ fontSize: 9, color: C.warn, marginTop: 2 }}>Low</div>}
                      </td>
                      <td style={S.td}>
                        <span style={{ ...S.tag(C.blue), cursor: "pointer" }} onClick={() => { setTab("users"); setExpandedCompany(c.company_code); }}>
                          {c.user_count} users
                        </span>
                      </td>
                      <td style={{ ...S.td, color: C.muted, fontSize: 12 }}>{c.created_at?.slice(0,10)}</td>
                      <td style={S.td}>
                        <div style={{ display: "flex", gap: 7 }}>
                          <button style={S.outlineBtn} onClick={() => openModal("editCompany", c)}>Edit</button>
                          <button style={S.dangerOutlineBtn} onClick={() => openModal("deleteCompany", c)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredCompanies.length === 0 && (
                  <tr><td colSpan={8} style={{ ...S.td, textAlign: "center", color: C.muted, padding: 40 }}>
                    {companySearch ? `No companies match "${companySearch}"` : 'No companies yet — click "+ Add Company"'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>)}

        {/* ══════════════ Users Tab ══════════════ */}
        {tab === "users" && (<>

          {/* System users — top */}
          <div style={{ ...S.section, border: `1.5px solid ${C.navy}20`, marginBottom: 18 }}>
            <SystemSectionHead title="System Administration Users" sub="Super admin accounts — not part of any client company" />
            {systemUsers.length === 0 ? (
              <p style={{ padding: "20px 24px", color: C.muted, fontSize: 13 }}>No system users found.</p>
            ) : (
              <table style={S.table}>
                <thead><tr>{["Username","Email","Role","Status","Actions"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {systemUsers.map((u, i) => (
                    <tr key={u.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfd" }}>
                      <td style={S.td}><strong>{u.username}</strong></td>
                      <td style={{ ...S.td, color: C.muted }}>{u.email || "—"}</td>
                      <td style={S.td}><span style={S.tag(C.danger)}>{u.role.replace("_"," ").toUpperCase()}</span></td>
                      <td style={S.td}>{u.must_change_password ? <span style={S.tag(C.warn)}>TEMP PWD</span> : <span style={S.tag(C.success)}>ACTIVE</span>}</td>
                      <td style={S.td}>
                        <div style={{ display: "flex", gap: 7 }}>
                          <button style={S.outlineBtn} onClick={() => openModal("editUser", u)}>Edit</button>
                          <button style={S.dangerOutlineBtn} onClick={() => openModal("deleteUser", u)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Client accordion */}
          <div style={S.section}>
            <div style={S.sectionHead}>
              <div>
                <h2 style={S.sectionTitle}>All Users by Company</h2>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: C.muted }}>{users.filter(u => u.company_code !== "SYSTEM").length} users across {clientCompanies.length} companies</p>
              </div>
              <button style={S.btn()} onClick={() => openModal("addUser")}>+ Add User</button>
            </div>

            {usersByCompany.length === 0 && (
              <p style={{ padding: "32px 24px", textAlign: "center", color: C.muted }}>No companies found.</p>
            )}

            {usersByCompany.map(group => {
              const isOpen = expandedCompany === group.company_code;
              return (
                <div key={group.company_code}>
                  {/* Accordion header */}
                  <div onClick={() => toggleCompany(group.company_code)} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 22px", cursor: "pointer",
                    background: isOpen ? "#edf5ff" : "#fff",
                    borderBottom: `1px solid ${C.border}`,
                    transition: "background 0.15s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: isOpen ? GRAD.blue : "#f0f2f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: isOpen ? "#fff" : C.muted, transition: "all 0.15s" }}>
                        {isOpen ? "▼" : "▶"}
                      </div>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 14, color: isOpen ? C.blue : C.navy }}>{group.company_name || group.company_code}</span>
                        <code style={{ marginLeft: 9, background: "#edf2ff", color: C.muted, padding: "1px 7px", borderRadius: 4, fontSize: 11 }}>{group.company_code}</code>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {group.contact_email && <span style={{ fontSize: 12, color: C.muted }}>✉ {group.contact_email}</span>}
                      <span style={S.tag(C.blue)}>{group.members.length} user{group.members.length !== 1 ? "s" : ""}</span>
                    </div>
                  </div>

                  {/* Expanded */}
                  {isOpen && (
                    <div style={{ background: "#f6f9ff", borderBottom: `2px solid #1a73e820` }}>
                      <div style={{ padding: "10px 22px 8px 62px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
                        <h3 style={{ margin: 0, fontSize: 13, color: C.navy, fontWeight: 700 }}>Users of {group.company_name || group.company_code}</h3>
                        <span style={S.tag(C.blue)}>{group.members.length}</span>
                      </div>
                      {group.members.length === 0 ? (
                        <p style={{ padding: "16px 62px", color: C.muted, fontSize: 13 }}>No users yet.</p>
                      ) : (
                        <table style={{ ...S.table, background: "transparent" }}>
                          <thead><tr>{["Username","Email","Role","Status","Actions"].map(h=><th key={h} style={{ ...S.th, paddingLeft: h === "Username" ? 62 : 16, background: "transparent" }}>{h}</th>)}</tr></thead>
                          <tbody>
                            {group.members.map(u => (
                              <tr key={u.id}>
                                <td style={{ ...S.td, paddingLeft: 62 }}><strong>{u.username}</strong></td>
                                <td style={{ ...S.td, color: C.muted }}>{u.email || "—"}</td>
                                <td style={S.td}><span style={S.tag(roleColor(u.role))}>{u.role.replace("_"," ").toUpperCase()}</span></td>
                                <td style={S.td}>{u.must_change_password ? <span style={S.tag(C.warn)}>TEMP PWD</span> : <span style={S.tag(C.success)}>ACTIVE</span>}</td>
                                <td style={S.td}>
                                  <div style={{ display: "flex", gap: 7 }}>
                                    <button style={S.outlineBtn} onClick={() => openModal("editUser", u)}>Edit</button>
                                    <button style={S.dangerOutlineBtn} onClick={() => openModal("deleteUser", u)}>Delete</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>)}

        {/* ══════════════ Reports Tab ══════════════ */}
        {tab === "reports" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>Filter by Company:</label>
              <select value={statsFilter} onChange={e => setStatsFilter(e.target.value)}
                style={{ padding: "8px 13px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, minWidth: 220, background: "#fff" }}>
                <option value="">All Companies</option>
                {clientCompanies.map(c => <option key={c.company_code} value={c.company_code}>{c.company_code} — {c.company_name || "—"}</option>)}
              </select>
              <button style={S.outlineBtn} onClick={() => loadStats(statsFilter)}>↺ Refresh</button>
            </div>

            {statsLoading ? (
              <div style={{ textAlign: "center", padding: 56, color: C.muted, fontSize: 15 }}>Loading statistics…</div>
            ) : !stats ? (
              <div style={{ textAlign: "center", padding: 56, color: C.muted }}>No data available.</div>
            ) : (
              <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18, marginBottom: 24 }}>
                {[
                  { label: "Total Reports",       value: stats.totals?.total ?? 0,       grad: GRAD.navy,   icon: "📋" },
                  { label: "Preliminary Reports",  value: stats.totals?.preliminary ?? 0, grad: GRAD.blue,   icon: "📝" },
                  { label: "Final Reports",        value: stats.totals?.final ?? 0,       grad: GRAD.green,  icon: "✅" },
                ].map(({ label, value, grad, icon }) => (
                  <div key={label} style={S.statCard(grad)}>
                    <div style={S.statGlow} />
                    <p style={S.statLabel}>{label}</p>
                    <p style={S.statValue}>{value}</p>
                    <span style={S.statIcon}>{icon}</span>
                  </div>
                ))}
              </div>

              <div style={S.section}>
                <div style={{ ...S.sectionHead, flexWrap: "wrap", gap: 10 }}>
                  <h2 style={S.sectionTitle}>📊 Report Breakdown by Company</h2>
                  <div style={{ position: "relative", marginLeft: "auto" }}>
                    <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.muted, fontSize: 14, pointerEvents: "none" }}>🔍</span>
                    <input
                      type="text"
                      placeholder="Search company code or name…"
                      value={companyBreakdownSearch}
                      onChange={e => setCompanyBreakdownSearch(e.target.value)}
                      style={{ padding: "7px 12px 7px 32px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, width: 240, outline: "none", background: "#fff" }}
                    />
                    {companyBreakdownSearch && (
                      <button onClick={() => setCompanyBreakdownSearch("")}
                        style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 14, lineHeight: 1 }}>✕</button>
                    )}
                  </div>
                </div>
                <table style={S.table}>
                  <thead><tr>{["Company Code","Company Name","Total","Preliminary","Final","Last Activity",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {stats.perCompany.length === 0 ? (
                      <tr><td colSpan={7} style={{ ...S.td, textAlign: "center", color: C.muted, padding: 32 }}>No reports found.</td></tr>
                    ) : stats.perCompany
                        .filter(row => {
                          const q = companyBreakdownSearch.toLowerCase().trim();
                          if (!q) return true;
                          return (row.company_code || "").toLowerCase().includes(q) ||
                                 (row.company_name || "").toLowerCase().includes(q);
                        })
                        .map((row, i) => {
                      const isOpen = expandedCompanyCode === row.company_code;
                      return (
                        <React.Fragment key={row.company_code}>
                          {/* Company summary row — clickable */}
                          <tr
                            style={{ background: isOpen ? "#edf2ff" : i % 2 === 0 ? "#fff" : "#fafbfd", cursor: "pointer", transition: "background 0.15s" }}
                            onClick={() => {
                              if (isOpen) {
                                setExpandedCompanyCode(null);
                                setCompanyReports([]);
                              } else {
                                setExpandedCompanyCode(row.company_code);
                                loadCompanyReports(row.company_code);
                              }
                            }}
                          >
                            <td style={S.td}><code style={{ background: "#edf2ff", color: C.blue, padding: "2px 8px", borderRadius: 5, fontSize: 12, fontWeight: 700 }}>{row.company_code || "—"}</code></td>
                            <td style={S.td}><strong>{row.company_name || "—"}</strong></td>
                            <td style={S.td}><span style={{ fontWeight: 800, fontSize: 18, color: C.navy }}>{row.total}</span></td>
                            <td style={S.td}><span style={{ ...S.tag("#1565c0"), padding: "3px 10px", fontSize: 12 }}>{row.preliminary}</span></td>
                            <td style={S.td}><span style={{ ...S.tag(C.success), padding: "3px 10px", fontSize: 12 }}>{row.final}</span></td>
                            <td style={{ ...S.td, color: C.muted, fontSize: 12 }}>{fmtLocal(row.last_activity)}</td>
                            <td style={{ ...S.td, textAlign: "center", color: C.blue, fontSize: 13, fontWeight: 700 }}>
                              {isOpen ? "▲ Hide" : "▼ Reports"}
                            </td>
                          </tr>

                          {/* Expanded report list */}
                          {isOpen && (
                            <tr>
                              <td colSpan={7} style={{ padding: 0, background: "#f0f4ff", borderBottom: `2px solid ${C.blue}33` }}>
                                {companyReportsLoading ? (
                                  <div style={{ padding: "20px 32px", color: C.muted, fontSize: 13 }}>Loading reports…</div>
                                ) : companyReports.length === 0 ? (
                                  <div style={{ padding: "20px 32px", color: C.muted, fontSize: 13, fontStyle: "italic" }}>No reports found for this company.</div>
                                ) : (
                                  <div style={{ overflowX: "auto" }}>
                                    <table style={{ ...S.table, fontSize: 12 }}>
                                      <thead>
                                        <tr style={{ background: "#e8edf8" }}>
                                          {["#", "Client / Owner", "Bank", "Branch", "Type", "Visit Date", "Report Date", "Created By", "Last Saved"].map(h => (
                                            <th key={h} style={{ ...S.th, background: "#e8edf8", fontSize: 10, padding: "8px 12px" }}>{h}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {companyReports.map((r, ri) => (
                                          <tr key={r.id} style={{ background: ri % 2 === 0 ? "#fff" : "#f8faff" }}>
                                            <td style={{ ...S.td, fontSize: 11, color: C.muted, padding: "8px 12px" }}>{r.id}</td>
                                            <td style={{ ...S.td, fontWeight: 500, padding: "8px 12px", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.client_name || "—"}</td>
                                            <td style={{ ...S.td, padding: "8px 12px", whiteSpace: "nowrap" }}>{r.bank || "—"}</td>
                                            <td style={{ ...S.td, padding: "8px 12px" }}>{r.branch || "—"}</td>
                                            <td style={{ ...S.td, padding: "8px 12px" }}>
                                              <span style={{
                                                background: r.report_type === "preliminary" ? "#e8f0fe" : "#e8f5e9",
                                                color: r.report_type === "preliminary" ? "#1565c0" : C.success,
                                                borderRadius: 5, padding: "2px 8px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
                                              }}>{r.report_type}</span>
                                            </td>
                                            <td style={{ ...S.td, fontSize: 11, color: C.muted, padding: "8px 12px", whiteSpace: "nowrap" }}>{r.visit_date || "—"}</td>
                                            <td style={{ ...S.td, fontSize: 11, color: C.muted, padding: "8px 12px", whiteSpace: "nowrap" }}>{r.report_date || "—"}</td>
                                            <td style={{ ...S.td, padding: "8px 12px", fontSize: 12, fontWeight: 600, color: C.navy }}>
                                              {r.created_by || <span style={{ color: C.muted }}>—</span>}
                                            </td>
                                            <td style={{ ...S.td, fontSize: 11, color: C.muted, padding: "8px 12px", whiteSpace: "nowrap" }}>{fmtLocal(r.updated_at)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                    <div style={{ padding: "8px 16px", fontSize: 11, color: C.muted, background: "#edf2ff", borderTop: `1px solid ${C.border}` }}>
                                      {companyReports.length} report{companyReports.length !== 1 ? "s" : ""} for {row.company_name || row.company_code}
                                    </div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
                {companyBreakdownSearch && stats.perCompany.filter(r => {
                  const q = companyBreakdownSearch.toLowerCase().trim();
                  return (r.company_code||"").toLowerCase().includes(q) || (r.company_name||"").toLowerCase().includes(q);
                }).length === 0 && (
                  <div style={{ padding: "20px 24px", textAlign: "center", color: C.muted, fontSize: 13, fontStyle: "italic" }}>
                    No companies match "{companyBreakdownSearch}"
                  </div>
                )}
              </div>

              <div style={S.section}>
                <div style={S.sectionHead}><h2 style={S.sectionTitle}>🕐 Recent Reports (last 20)</h2></div>
                <table style={S.table}>
                  <thead><tr>{["#","Company","Client","Bank","Branch","Type","Date","Saved"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {stats.recent.length === 0 ? (
                      <tr><td colSpan={8} style={{ ...S.td, textAlign: "center", color: C.muted, padding: 32 }}>No reports yet.</td></tr>
                    ) : stats.recent.map((r, i) => (
                      <tr key={r.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfd" }}>
                        <td style={{ ...S.td, color: C.muted, fontSize: 11 }}>{r.id}</td>
                        <td style={S.td}><code style={{ background: "#edf2ff", color: C.blue, padding: "1px 6px", borderRadius: 4, fontSize: 11 }}>{r.company_code || "—"}</code></td>
                        <td style={{ ...S.td, fontWeight: 500 }}>{r.client_name || "—"}</td>
                        <td style={S.td}>{r.bank || "—"}</td>
                        <td style={S.td}>{r.branch || "—"}</td>
                        <td style={S.td}><span style={{ ...S.tag(r.report_type === "preliminary" ? "#1565c0" : C.success), fontSize: 11 }}>{r.report_type}</span></td>
                        <td style={{ ...S.td, fontSize: 12 }}>{r.report_date || "—"}</td>
                        <td style={{ ...S.td, color: C.muted, fontSize: 11 }}>{fmtLocal(r.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
                <table style={S.table}>
                  <thead><tr>{["#","Company","Client","Bank","Branch","Type","Date","Saved"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {stats.recent.length === 0 ? (
                      <tr><td colSpan={8} style={{ ...S.td, textAlign: "center", color: C.muted, padding: 32 }}>No reports yet.</td></tr>
                    ) : stats.recent.map((r, i) => (
                      <tr key={r.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfd" }}>
                        <td style={{ ...S.td, color: C.muted, fontSize: 11 }}>{r.id}</td>
                        <td style={S.td}><code style={{ background: "#edf2ff", color: C.blue, padding: "1px 6px", borderRadius: 4, fontSize: 11 }}>{r.company_code || "—"}</code></td>
                        <td style={{ ...S.td, fontWeight: 500 }}>{r.client_name || "—"}</td>
                        <td style={S.td}>{r.bank || "—"}</td>
                        <td style={S.td}>{r.branch || "—"}</td>
                        <td style={S.td}><span style={{ ...S.tag(r.report_type === "preliminary" ? "#1565c0" : C.success), fontSize: 11 }}>{r.report_type}</span></td>
                        <td style={{ ...S.td, fontSize: 12 }}>{r.report_date || "—"}</td>
                        <td style={{ ...S.td, color: C.muted, fontSize: 11 }}>{fmtLocal(r.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ══════════════ Credits Tab ══════════════ */}
        {tab === "credits" && <CreditManagement companies={companies} />}

        {/* ══════════════ Rate Map Access Tab ══════════════ */}
        {tab === "ratemap" && <RateMapAccessAdmin companies={companies} />}

        {/* ══════════════ Registrations Tab ══════════════ */}
        {tab === "registrations" && (
          <RegistrationsPanel onCountChange={setPendingRegCount} />
        )}

        {/* ══════════════ Feedback Tab ══════════════ */}
        {tab === "feedback" && <FeedbackAdmin companies={companies} />}

        {/* ══════════════ Mass Email Tab ══════════════ */}
        {tab === "broadcast" && <BroadcastEmail companies={companies} />}

        {/* ══════════════ Map Tab ══════════════ */}
        {tab === "map" && (
          <div style={{ margin: "-28px -32px", height: "calc(100vh - 180px)" }}>
            <ContourMap user={user} companies={companies} />
          </div>
        )}
      </div>

      {/* ══════════════ Company Detail Slide-over ══════════════ */}
      {detailCompany && (() => {
        const c = detailCompany;
        const bal      = c.credit_balance ?? 0;
        const low      = bal <= (c.credit_low_threshold ?? 5);
        const critical = bal <= 2;
        const expired  = c.credit_expiry && new Date(c.credit_expiry) < new Date();
        const creditStatus = expired ? { label: "Expired", color: C.danger, bg: "#fff5f5" }
          : critical ? { label: "Critical", color: C.danger,  bg: "#fff5f5" }
          : low      ? { label: "Low",      color: C.warn,    bg: "#fffbea" }
          :             { label: "Healthy",  color: C.success, bg: "#f0fdf4" };
        const members = c.members || [];

        return (
          <>
            {/* Backdrop */}
            <div onClick={() => setDetailCompany(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(15,31,61,0.45)", zIndex: 8000, backdropFilter: "blur(2px)" }} />

            {/* Drawer */}
            <div style={{
              position: "fixed", top: 0, right: 0, bottom: 0, width: 480,
              background: "#fff", zIndex: 8001,
              boxShadow: "-8px 0 48px rgba(0,0,0,0.22)",
              display: "flex", flexDirection: "column", overflowY: "auto",
            }}>
              {/* Drawer header */}
              <div style={{ background: GRAD.navy, padding: "24px 28px", color: "#fff", flexShrink: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.55, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 6 }}>Company Details</div>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.3px" }}>{c.company_name || "—"}</h2>
                    <code style={{ marginTop: 6, display: "inline-block", background: "rgba(255,255,255,0.15)", padding: "2px 10px", borderRadius: 5, fontSize: 12, fontWeight: 700 }}>{c.company_code}</code>
                  </div>
                  <button onClick={() => setDetailCompany(null)}
                    style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 8, width: 32, height: 32, color: "#fff", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                </div>
              </div>

              <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>

                {/* Credit card */}
                <div style={{ background: creditStatus.bg, border: `1.5px solid ${creditStatus.color}33`, borderRadius: 12, padding: "18px 20px" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: creditStatus.color, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 10 }}>🪙 Credit Balance</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 48, fontWeight: 900, color: "#0f1f3d", lineHeight: 1 }}>{bal}</span>
                    <span style={{ background: creditStatus.bg, color: creditStatus.color, border: `1.5px solid ${creditStatus.color}55`, borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
                      {creditStatus.label}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
                    {c.credit_expiry && (
                      <div>
                        <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: "0.4px" }}>Expiry</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: expired ? C.danger : "#333" }}>{c.credit_expiry?.slice(0,10)}</div>
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: "0.4px" }}>Low Alert At</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>{c.credit_low_threshold ?? 5}</div>
                    </div>
                  </div>
                </div>

                {/* Contact info */}
                <div style={{ background: "#f8fafc", borderRadius: 12, padding: "18px 20px" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 12 }}>Contact Information</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
                    {[
                      ["✉ Email",    c.contact_email],
                      ["📞 Phone",   c.contact_phone],
                      ["🏙 City",    c.city],
                      ["🗺 State",   c.state],
                      ["📮 ZIP",     c.zip],
                      ["🌍 Country", c.country],
                    ].map(([label, val]) => val ? (
                      <div key={label}>
                        <div style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#333", marginTop: 2 }}>{val}</div>
                      </div>
                    ) : null)}
                    {(c.address1 || c.address2) && (
                      <div style={{ gridColumn: "1 / -1" }}>
                        <div style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.4px" }}>📍 Address</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#333", marginTop: 2 }}>
                          {[c.address1, c.address2].filter(Boolean).join(", ")}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* PAN / Bank */}
                {(c.pan_vat || c.bank_account || c.bill_prefix) && (
                  <div style={{ background: "#f8fafc", borderRadius: 12, padding: "18px 20px" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 12 }}>Billing Info</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
                      {[["PAN / VAT", c.pan_vat], ["Bank Account", c.bank_account], ["Bill Prefix", c.bill_prefix]].map(([label, val]) => val ? (
                        <div key={label}>
                          <div style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#333", marginTop: 2 }}>{val}</div>
                        </div>
                      ) : null)}
                    </div>
                  </div>
                )}

                {/* System info */}
                <div style={{ background: "#f8fafc", borderRadius: 12, padding: "18px 20px" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 12 }}>System</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.4px" }}>Created</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#333", marginTop: 2 }}>{c.created_at?.slice(0,10) || "—"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.4px" }}>Rate Map</div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>
                        {c.rate_map_free ? <span style={{ color: C.success }}>✅ Free</span> : <span style={{ color: C.muted }}>🪙 Credit-based</span>}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.4px" }}>Report Theme</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#333", marginTop: 2, textTransform: "capitalize" }}>{c.report_color_theme || "blue"}</div>
                    </div>
                  </div>
                </div>

                {/* Users */}
                <div style={{ background: "#f8fafc", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.6px" }}>👥 Users ({members.length})</div>
                    <button onClick={() => { setDetailCompany(null); setTab("users"); setExpandedCompany(c.company_code); }}
                      style={{ fontSize: 11, color: C.blue, fontWeight: 700, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                      Manage →
                    </button>
                  </div>
                  {members.length === 0 ? (
                    <div style={{ padding: "12px 20px 16px", fontSize: 13, color: C.muted }}>No users yet.</div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr>{["Username","Role","Status"].map(h => (
                          <th key={h} style={{ padding: "8px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", background: "#f0f2f6", borderBottom: `1px solid ${C.border}` }}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {members.map((u, i) => (
                          <tr key={u.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfd" }}>
                            <td style={{ padding: "9px 16px", fontWeight: 600, color: C.navy }}>{u.username}</td>
                            <td style={{ padding: "9px 16px" }}><span style={S.tag(({ super_user: C.danger, admin: C.warn, user: C.blue })[u.role] || C.muted)}>{u.role.replace("_"," ").toUpperCase()}</span></td>
                            <td style={{ padding: "9px 16px" }}>{u.must_change_password ? <span style={S.tag(C.warn)}>TEMP PWD</span> : <span style={S.tag(C.success)}>ACTIVE</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 10 }}>
                  <button style={{ ...S.btn(), flex: 1 }} onClick={() => { setDetailCompany(null); openModal("editCompany", c); }}>✏ Edit Company</button>
                  <button style={{ ...S.btn(GRAD.danger) }} onClick={() => { setDetailCompany(null); openModal("deleteCompany", c); }}>🗑</button>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* ══════════════ Modals ══════════════ */}

      {modal === "addCompany" && (
        <Modal title="Add New Company" onClose={closeModal} maxWidth={560}>
          {error && <div style={{ background: "#fdecea", color: C.danger, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{error}</div>}
          <form onSubmit={saveCompany}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              <FL label="Company Name" col={2}><Input value={form.company_name || ""} onChange={set("company_name")} placeholder="e.g. Himalayan Bank Ltd" /></FL>
              <FL label="Company Code (auto-generated if blank)" col={2}><Input value={form.company_code || ""} onChange={set("company_code")} placeholder="e.g. HBL001" /></FL>
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, margin: "14px 0 12px", paddingTop: 14 }}>
              <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Initial Admin Account</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <FL label="Admin Username *"><Input value={form.admin_username || ""} onChange={set("admin_username")} required placeholder="Admin login name" /></FL>
                <FL label="Admin Temp Password *"><PasswordInput value={form.admin_password || ""} onChange={set("admin_password")} required placeholder="Min 6 chars" /></FL>
              </div>
            </div>
            <p style={{ fontSize: 12, color: C.muted, margin: "0 0 16px" }}>Admin must change this password on first login.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" style={S.outlineBtn} onClick={closeModal}>Cancel</button>
              <button type="submit" style={S.btn()} disabled={saving}>{saving ? "Creating…" : "Create Company"}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "editCompany" && (
        <Modal title={`Edit: ${target?.company_code}`} onClose={closeModal} maxWidth={640}>
          {error && <div style={{ background: "#fdecea", color: C.danger, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{error}</div>}
          <form onSubmit={saveCompany}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              <FL label="Company Name" col={2}><Input value={form.company_name || ""} onChange={set("company_name")} /></FL>
              <FL label="Address Line 1" col={2}><Input value={form.address1 || ""} onChange={set("address1")} placeholder="Street address" /></FL>
              <FL label="Address Line 2" col={2}><Input value={form.address2 || ""} onChange={set("address2")} placeholder="Suite, floor, etc." /></FL>
              <FL label="City"><Input value={form.city || ""} onChange={set("city")} /></FL>
              <FL label="State / Province"><Input value={form.state || ""} onChange={set("state")} /></FL>
              <FL label="ZIP / Postal Code"><Input value={form.zip || ""} onChange={set("zip")} /></FL>
              <FL label="Country"><Input value={form.country || ""} onChange={set("country")} /></FL>
              <FL label="Contact Email"><Input type="email" value={form.contact_email || ""} onChange={set("contact_email")} /></FL>
              <FL label="Contact Phone"><Input type="tel" value={form.contact_phone || ""} onChange={set("contact_phone")} /></FL>
            </div>

            {/* ── Letterhead PNG ── */}
            <div style={{ marginTop: 18, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                🖼 Cover Letter Letterhead (PNG)
              </div>
              <p style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
                Upload your letterhead PNG. Then <strong>drag on the preview</strong> to define the text area box — the cover letter text will be placed exactly within that box.
              </p>

              {/* Upload + Remove buttons */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 18px", background: "#f0f4ff", border: `1.5px solid ${C.blue}`, color: C.blue, borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  📎 Choose PNG / JPG
                  <input type="file" accept="image/png,image/jpeg,image/jpg" style={{ display: "none" }}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = ev => setForm(f => ({ ...f, letterhead_png: ev.target.result, letterhead_text_box: null }));
                      reader.readAsDataURL(file);
                      e.target.value = "";
                    }}
                  />
                </label>
                {form.letterhead_png && (
                  <button type="button" onClick={() => setForm(f => ({ ...f, letterhead_png: "", letterhead_text_box: null }))}
                    style={{ padding: "9px 14px", background: "#fff", color: C.danger, border: `1px solid ${C.danger}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    ✕ Remove
                  </button>
                )}
                {form.letterhead_text_box && (
                  <button type="button" onClick={() => setForm(f => ({ ...f, letterhead_text_box: null }))}
                    style={{ padding: "9px 14px", background: "#fff", color: C.warn, border: `1px solid ${C.warn}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    ↺ Reset Box
                  </button>
                )}
              </div>

              {/* Interactive A4 preview with drag-to-define text box */}
              {form.letterhead_png ? (
                <LetterheadBoxDefiner
                  png={form.letterhead_png}
                  box={form.letterhead_text_box}
                  onChange={box => setForm(f => ({ ...f, letterhead_text_box: box }))}
                />
              ) : (
                <div style={{ padding: "20px", border: `1.5px dashed ${C.border}`, borderRadius: 8, textAlign: "center", color: C.muted, fontSize: 13, fontStyle: "italic" }}>
                  No letterhead uploaded yet
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
              <button type="button" style={S.outlineBtn} onClick={closeModal}>Cancel</button>
              <button type="submit" style={S.btn()} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "deleteCompany" && (
        <Modal title="Delete Company" onClose={closeModal}>
          {error && <div style={{ background: "#fdecea", color: C.danger, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{error}</div>}
          <p style={{ fontSize: 15, color: C.text }}>Permanently delete <strong>{target?.company_code}</strong>{target?.company_name ? ` (${target.company_name})` : ""}?</p>
          <p style={{ color: C.danger, fontSize: 13 }}>⚠ This deletes ALL users and data for this company. Cannot be undone.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" style={S.outlineBtn} onClick={closeModal}>Cancel</button>
            <button style={S.btn(GRAD.danger)} onClick={deleteCompany} disabled={saving}>{saving ? "Deleting…" : "Delete Permanently"}</button>
          </div>
        </Modal>
      )}

      {(modal === "addUser" || modal === "editUser") && (
        <Modal title={modal === "addUser" ? "Add User" : `Edit: ${target?.username}`} onClose={closeModal}>
          {error && <div style={{ background: "#fdecea", color: C.danger, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{error}</div>}
          <form onSubmit={saveUser}>
            {modal === "addUser" && (<>
              <FL label="Company *"><Select value={form.company_code || ""} onChange={set("company_code")} required>
                <option value="">Select company…</option>
                {companies.map(c => <option key={c.id} value={c.company_code}>{c.company_code} — {c.company_name}</option>)}
              </Select></FL>
              <FL label="Role *"><Select value={form.role || "user"} onChange={set("role")} required>
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="super_user">Super User</option>
              </Select></FL>
            </>)}
            <FL label="Username *"><Input value={form.username || ""} onChange={set("username")} required /></FL>
            <FL label="Email"><Input type="email" value={form.email || ""} onChange={set("email")} placeholder="optional" /></FL>
            <FL label={modal === "editUser" ? "New Password (blank = keep)" : "Temporary Password *"}>
              <PasswordInput value={form.password || ""} onChange={set("password")} required={modal === "addUser"} placeholder="Min 6 characters" />
            </FL>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" style={S.outlineBtn} onClick={closeModal}>Cancel</button>
              <button type="submit" style={S.btn()} disabled={saving}>{saving ? "Saving…" : modal === "addUser" ? "Create User" : "Save"}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "deleteUser" && (
        <Modal title="Delete User" onClose={closeModal}>
          {error && <div style={{ background: "#fdecea", color: C.danger, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{error}</div>}
          <p style={{ fontSize: 15 }}>Delete user <strong>{target?.username}</strong> from <strong>{target?.company_code}</strong>?</p>
          <p style={{ color: C.danger, fontSize: 13 }}>⚠ This cannot be undone.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" style={S.outlineBtn} onClick={closeModal}>Cancel</button>
            <button style={S.btn(GRAD.danger)} onClick={deleteUser} disabled={saving}>{saving ? "Deleting…" : "Delete"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
