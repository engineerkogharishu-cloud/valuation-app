import React, { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../services/api";
import FieldSubmissions from "../components/FieldSubmissions";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-NP") : "—");
const fmtDateShort = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NP", { day: "2-digit", month: "short", year: "numeric" });
};

function CreditCard({ credits, loading }) {
  if (loading) return (
    <div style={S.creditCard}>
      <div style={S.creditSkeleton} />
    </div>
  );

  const { balance = 0, expiry, low_threshold = 5 } = credits || {};
  const isLow = balance <= low_threshold;
  const isExpiringSoon = expiry && (new Date(expiry) - Date.now()) < 7 * 24 * 60 * 60 * 1000;
  const isExpired = expiry && new Date(expiry) < new Date();

  const statusColor = isExpired ? "#c0392b"
    : isLow ? "#e67e22"
    : "#27ae60";
  const statusBg = isExpired ? "rgba(192,57,43,0.12)"
    : isLow ? "rgba(230,126,34,0.12)"
    : "rgba(39,174,96,0.12)";
  const statusText = isExpired ? "Expired"
    : isLow ? "Low Credits"
    : "Active";

  return (
    <div style={S.creditCard}>
      <div style={S.creditTop}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={S.creditIcon}>🪙</div>
          <span style={S.creditLabel}>Remaining Credits</span>
        </div>
        <span style={{ ...S.creditBadge, background: statusBg, color: statusColor }}>
          {statusText}
        </span>
      </div>
      <div style={S.creditBalance}>{balance.toLocaleString()}</div>
      <div style={S.creditMeta}>
        <div style={S.creditMetaItem}>
          <span style={S.creditMetaLabel}>Preliminary</span>
          <span style={S.creditMetaValue}>1 credit each</span>
        </div>
        <div style={S.creditDivider} />
        <div style={S.creditMetaItem}>
          <span style={S.creditMetaLabel}>Final</span>
          <span style={S.creditMetaValue}>2 credits each</span>
        </div>
        {expiry && (
          <>
            <div style={S.creditDivider} />
            <div style={S.creditMetaItem}>
              <span style={S.creditMetaLabel}>Expires</span>
              <span style={{ ...S.creditMetaValue, color: (isExpiringSoon || isExpired) ? statusColor : undefined }}>
                {fmtDateShort(expiry)}
              </span>
            </div>
          </>
        )}
      </div>
      {(isLow || isExpiringSoon || isExpired) && (
        <div style={{ ...S.creditAlert, background: statusBg, borderColor: statusColor + "44", color: statusColor }}>
          {isExpired ? "⛔ Your credit package has expired. Contact admin to renew."
            : isExpiringSoon && isLow ? "⚠ Credits low and expiring soon. Contact admin."
            : isLow ? "⚠ Running low on credits. Contact your admin to top up."
            : "⚠ Credits expiring soon. Contact admin to renew."}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div style={{ ...S.statCard, borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#0f1f3d", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#444", marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function Dashboard({ onOpen, onNew, user }) {
  const [tab,       setTab]       = useState("reports");
  const [reports,   setReports]   = useState([]);
  const [total,     setTotal]     = useState(0);
  const [search,    setSearch]    = useState("");
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [delId,     setDelId]     = useState(null);
  const [importing, setImporting] = useState(false);
  const [importErr, setImportErr] = useState("");
  const [credits,   setCredits]   = useState(null);
  const [credLoading, setCredLoading] = useState(true);
  const importRef = useRef();

  const load = useCallback(async (q = search) => {
    setLoading(true); setError("");
    try {
      const data = await api.listReports({ search: q, limit: 100 });
      setReports(data.reports);
      setTotal(data.total);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
    api.getCredits()
      .then(setCredits)
      .catch(() => {})
      .finally(() => setCredLoading(false));
  }, []);

  const handleDelete = async (id) => {
    try { await api.deleteReport(id); setDelId(null); load(); }
    catch (e) { alert("Delete failed: " + e.message); }
  };

  const handleExport = async (report) => {
    try {
      const data = await api.getReport(report.id);
      const state = data.state ?? data;
      const json = JSON.stringify(state, null, 2);
      const filename = (report.client_name || `report-${report.id}`).replace(/[^\w\-]/g, "_") + ".json";
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = filename;
      link.style.cssText = "position:fixed;left:-9999px";
      document.body.appendChild(link); link.click();
      setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 200);
    } catch (e) { alert("Export failed: " + e.message); }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!importRef.current) return;
    importRef.current.value = "";
    if (!file) return;
    setImporting(true); setImportErr("");
    try {
      const text = await file.text();
      const state = JSON.parse(text);
      await api.saveReport(state, file.name.replace(/\.json$/i, ""));
      await load();
    } catch (e) {
      setImportErr("Import failed: " + (e.message || "invalid file"));
    } finally { setImporting(false); }
  };

  const preliminary = reports.filter(r => r.report_type === "preliminary").length;
  const final       = reports.filter(r => r.report_type === "final").length;
  const bills       = reports.filter(r => r.report_type === "bill").length;
  const billReports = reports.filter(r => r.report_type === "bill");

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  };

  return (
    <div style={S.page}>
      {/* ── Hero banner ── */}
      <div style={S.hero}>
        <div style={S.heroInner}>
          <div>
            <p style={S.greeting}>{greeting()}, {user?.username} 👋</p>
            <h1 style={S.heroTitle}>Valuation Dashboard</h1>
            <p style={S.heroSub}>Manage your property valuation reports</p>
          </div>
          <button style={S.heroCta} onClick={onNew}>＋ New Report</button>
        </div>
      </div>

      <div style={S.content}>
        {/* ── Stats + Credits row ── */}
        <div style={S.topRow}>
          <div style={S.statsGrid}>
            <StatCard icon="📋" label="Total Reports" value={total} sub="all time" color="#1a73e8" />
            <StatCard icon="📝" label="Preliminary" value={preliminary} sub="draft reports" color="#c9922a" />
            <StatCard icon="🧾" label="Bill" value={bills} sub="bill reports" color="#c9922a" />
            <StatCard icon="✅" label="Final" value={final} sub="completed reports" color="#27ae60" />
          </div>
          <CreditCard credits={credits} loading={credLoading} />
        </div>

        {/* ── Tab bar + actions ── */}
        <div style={S.toolbar}>
          <div style={S.tabBar}>
            {[["reports", "📋 All Reports"], ["preliminary", "📝 Preliminary"], ["bill", "🧾 Bill"], ["final", "✅ Final"], ["field", "📱 Field Data"]].map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)}
                style={{ ...S.tabBtn, ...(tab === t ? S.tabActive : {}) }}>
                {label}
              </button>
            ))}
          </div>
          {tab === "reports" && (
            <div style={{ display: "flex", gap: 8 }}>
              <input ref={importRef} type="file" accept=".json,application/json"
                style={{ display: "none" }} onChange={handleImport} />
              <button style={S.btnOutline} onClick={() => importRef.current?.click()} disabled={importing}>
                {importing ? "Importing…" : "⬆ Import"}
              </button>
            </div>
          )}
        </div>

        {/* ── Reports tab ── */}
        {tab === "reports" && (
          <>
            {importErr && (
              <div style={S.errorBox}>
                ⚠ {importErr}
                <button style={S.dismissBtn} onClick={() => setImportErr("")}>✕</button>
              </div>
            )}
            <div style={S.searchRow}>
              <div style={S.searchWrap}>
                <span style={S.searchIcon}>🔍</span>
                <input
                  style={S.search}
                  placeholder="Search by client, bank, or branch…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && load(search)}
                />
                {search && (
                  <button style={S.clearBtn} onClick={() => { setSearch(""); load(""); }}>✕</button>
                )}
              </div>
              <button style={S.btnSearch} onClick={() => load(search)}>Search</button>
            </div>

            {error && <div style={S.errorBox}>⚠ Could not load reports: {error}</div>}

            {loading ? (
              <div style={S.loadingWrap}>
                {[1,2,3,4].map(i => <div key={i} style={S.skeletonRow} />)}
              </div>
            ) : reports.length === 0 ? (
              <div style={S.empty}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>📂</div>
                <h3 style={{ color: "#333", margin: "0 0 8px" }}>No reports yet</h3>
                <p style={{ color: "#888", marginBottom: 24 }}>Create your first valuation report to get started.</p>
                <button style={S.btnPrimary} onClick={onNew}>＋ Create First Report</button>
              </div>
            ) : (
              <div style={S.tableCard}>
                <div style={S.tableScrollWrap}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        {["#", "Client / Owner", "Bank", "Branch", "Type", "Visit Date", "Last Saved", ""].map(h => (
                          <th key={h} style={S.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((r, i) => (
                        <tr key={r.id} style={S.tr}
                          onMouseEnter={e => e.currentTarget.style.background = "#f0f4ff"}
                          onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fafbfc"}>
                          <td style={{ ...S.td, color: "#999", fontSize: 12 }}>{r.id}</td>
                          <td style={{ ...S.td, fontWeight: 600, color: "#0f1f3d" }}>{r.client_name || "—"}</td>
                          <td style={S.td}>{r.bank || "—"}</td>
                          <td style={S.td}>{r.branch || "—"}</td>
                          <td style={S.td}>
                            <span style={{
                              ...S.badge,
                              background: r.report_type === "preliminary" ? "#fff3e0" : r.report_type === "bill" ? "#fff8ee" : "#e8f5e9",
                              color:      r.report_type === "preliminary" ? "#e65100" : r.report_type === "bill" ? "#c9922a" : "#2e7d32",
                              border: `1px solid ${r.report_type === "preliminary" ? "#ffcc80" : r.report_type === "bill" ? "#f6d08a" : "#a5d6a7"}`,
                            }}>
                              {r.report_type === "preliminary" ? "📝 Prelim" : r.report_type === "bill" ? "🧾 Bill" : "✅ Final"}
                            </span>
                          </td>
                          <td style={{ ...S.td, color: "#555" }}>{fmtDate(r.visit_date)}</td>
                          <td style={{ ...S.td, color: "#888", fontSize: 12 }}>{fmtDate(r.updated_at)}</td>
                          <td style={S.tdActions}>
                            <button style={S.btnOpen} onClick={() => onOpen(r.id)}>Open</button>
                            <button style={S.btnSave} onClick={() => handleExport(r)} title="Download as JSON">💾</button>
                            {user?.role === "admin" && (
                              <button style={S.btnDel} onClick={() => setDelId(r.id)} title="Delete">🗑</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={S.tableFooter}>
                  Showing {reports.length} of {total} report{total !== 1 ? "s" : ""}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Preliminary tab ── */}
        {tab === "preliminary" && (
          <ReportTypeTab
            reports={reports.filter(r => r.report_type === "preliminary")}
            icon="📝" label="Preliminary Reports"
            emptyIcon="📝" emptyMsg="No preliminary reports yet."
            badgeBg="#fff3e0" badgeColor="#e65100" badgeBorder="#ffcc80" badgeText="📝 Prelim"
            hoverBg="#f0f7ff"
            onOpen={onOpen} onExport={handleExport} onDelete={id => setDelId(id)} user={user}
          />
        )}

        {/* ── Final tab ── */}
        {tab === "final" && (
          <ReportTypeTab
            reports={reports.filter(r => r.report_type === "final")}
            icon="✅" label="Final Reports"
            emptyIcon="✅" emptyMsg="No final reports yet."
            badgeBg="#e8f5e9" badgeColor="#2e7d32" badgeBorder="#a5d6a7" badgeText="✅ Final"
            hoverBg="#f0fff4"
            onOpen={onOpen} onExport={handleExport} onDelete={id => setDelId(id)} user={user}
          />
        )}

        {/* ── Bill tab ── */}
        {tab === "bill" && (
          <ReportTypeTab
            reports={billReports}
            icon="🧾" label="Bill Reports"
            emptyIcon="🧾" emptyMsg='Reports set to "Bill" type will appear here.'
            badgeBg="#fff8ee" badgeColor="#c9922a" badgeBorder="#f6d08a" badgeText="🧾 Bill"
            hoverBg="#fffbf0"
            showBillNo
            onOpen={onOpen} onExport={handleExport} onDelete={id => setDelId(id)} user={user}
          />
        )}

        {/* ── Field Data tab ── */}
        {tab === "field" && (
          <FieldSubmissions user={user} onUseData={(state) => onNew(state)} />
        )}
      </div>

      {/* ── Delete confirm modal ── */}
      {delId && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={{ fontSize: 40, textAlign: "center", marginBottom: 12 }}>🗑️</div>
            <h3 style={{ textAlign: "center", margin: "0 0 8px", color: "#0f1f3d" }}>Delete Report #{delId}?</h3>
            <p style={{ color: "#666", textAlign: "center", marginBottom: 24, fontSize: 14 }}>
              This action cannot be undone. The report will be permanently removed.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={S.btnCancel} onClick={() => setDelId(null)}>Cancel</button>
              <button style={S.btnDelConfirm} onClick={() => handleDelete(delId)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  page: { minHeight: "100vh", background: "#f4f6fb", fontFamily: "'Segoe UI', system-ui, sans-serif" },

  // Hero
  hero: { background: "linear-gradient(135deg, #0f1f3d 0%, #1a3a6b 60%, #1a5276 100%)", padding: "32px 0 28px" },
  heroInner: { maxWidth: 1200, margin: "0 auto", padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 },
  greeting: { color: "rgba(255,255,255,0.65)", fontSize: 14, margin: "0 0 4px" },
  heroTitle: { color: "#fff", fontSize: 28, fontWeight: 700, margin: 0 },
  heroSub: { color: "rgba(255,255,255,0.5)", fontSize: 13, margin: "6px 0 0" },
  heroCta: { background: "#c9922a", color: "#fff", border: "none", borderRadius: 10, padding: "12px 24px", fontWeight: 700, fontSize: 15, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 4px 14px rgba(201,146,42,0.4)" },

  content: { maxWidth: 1200, margin: "0 auto", padding: "28px 28px 48px" },

  // Top row
  topRow: { display: "flex", gap: 20, marginBottom: 28, flexWrap: "wrap" },
  statsGrid: { display: "flex", gap: 14, flex: 1, minWidth: 280 },
  statCard: { flex: 1, background: "#fff", borderRadius: 12, padding: "20px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", textAlign: "center" },

  // Credit card
  creditCard: { background: "#fff", borderRadius: 12, padding: "20px 22px", minWidth: 260, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", gap: 12 },
  creditTop: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  creditIcon: { width: 34, height: 34, borderRadius: 8, background: "linear-gradient(135deg, #f6d365, #fda085)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 },
  creditLabel: { fontSize: 13, fontWeight: 600, color: "#555" },
  creditBadge: { fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 },
  creditBalance: { fontSize: 48, fontWeight: 800, color: "#0f1f3d", lineHeight: 1, letterSpacing: "-1px" },
  creditMeta: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  creditMetaItem: { display: "flex", flexDirection: "column", gap: 2 },
  creditMetaLabel: { fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.5px" },
  creditMetaValue: { fontSize: 12, fontWeight: 600, color: "#555" },
  creditDivider: { width: 1, height: 24, background: "#eee" },
  creditAlert: { fontSize: 12, padding: "8px 12px", borderRadius: 8, border: "1px solid", lineHeight: 1.4 },
  creditSkeleton: { height: 120, background: "linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)", borderRadius: 8, backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" },

  // Toolbar
  toolbar: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 },
  tabBar: { display: "flex", background: "#e9ecef", borderRadius: 10, padding: 4, gap: 4 },
  tabBtn: { padding: "8px 20px", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 600, background: "transparent", color: "#666", transition: "all 0.15s" },
  tabActive: { background: "#fff", color: "#0f1f3d", boxShadow: "0 1px 6px rgba(0,0,0,0.12)" },

  // Buttons
  btnPrimary: { background: "#c9922a", color: "#fff", border: "none", borderRadius: 8, padding: "11px 22px", fontWeight: 700, cursor: "pointer", fontSize: 14 },
  btnOutline: { background: "#fff", color: "#0f1f3d", border: "1.5px solid #d0d5dd", borderRadius: 8, padding: "8px 16px", fontWeight: 600, cursor: "pointer", fontSize: 13 },

  // Search
  searchRow: { display: "flex", gap: 10, marginBottom: 16 },
  searchWrap: { flex: 1, display: "flex", alignItems: "center", background: "#fff", border: "1.5px solid #e0e0e0", borderRadius: 8, padding: "0 12px", gap: 8 },
  searchIcon: { fontSize: 14, opacity: 0.5 },
  search: { flex: 1, border: "none", outline: "none", padding: "10px 0", fontSize: 14, background: "transparent" },
  clearBtn: { background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: 14, padding: 4 },
  btnSearch: { padding: "10px 20px", background: "#0f1f3d", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 },

  // Errors / Loading
  errorBox: { background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 8, padding: "12px 16px", marginBottom: 16, color: "#7a5000", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 14 },
  dismissBtn: { background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: "#7a5000" },
  loadingWrap: { display: "flex", flexDirection: "column", gap: 10 },
  skeletonRow: { height: 52, background: "linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)", borderRadius: 8, backgroundSize: "200% 100%" },

  // Empty
  empty: { textAlign: "center", padding: "64px 24px", background: "#fff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" },

  // Table
  tableCard: { background: "#fff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", overflow: "hidden" },
  tableScrollWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13.5 },
  th: { background: "#0f1f3d", color: "rgba(255,255,255,0.85)", padding: "13px 16px", textAlign: "left", fontWeight: 600, whiteSpace: "nowrap", fontSize: 12, letterSpacing: "0.3px" },
  tr: { transition: "background 0.1s", cursor: "default" },
  td: { padding: "13px 16px", color: "#333", borderBottom: "1px solid #f0f2f5" },
  tdActions: { padding: "10px 16px", whiteSpace: "nowrap", borderBottom: "1px solid #f0f2f5" },
  badge: { padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700 },
  tableFooter: { padding: "12px 18px", borderTop: "1px solid #f0f2f5", fontSize: 12, color: "#aaa", textAlign: "right" },

  // Action buttons in table
  btnOpen: { background: "#0f1f3d", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", marginRight: 6, fontSize: 12, fontWeight: 600 },
  btnSave: { background: "#f5f5f5", color: "#555", border: "1px solid #e0e0e0", borderRadius: 6, padding: "6px 10px", cursor: "pointer", marginRight: 6, fontSize: 13 },
  btnDel: { background: "#fff5f5", color: "#c0392b", border: "1px solid #fcc", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 13 },

  // Modal
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, backdropFilter: "blur(2px)" },
  modal: { background: "#fff", borderRadius: 14, padding: "32px 28px", width: 360, boxShadow: "0 24px 64px rgba(0,0,0,0.25)" },
  btnCancel: { flex: 1, padding: "10px", border: "1.5px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14 },
  btnDelConfirm: { flex: 1, padding: "10px", background: "#c0392b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14 },
};

function ReportTypeTab({ reports, icon, label, emptyIcon, emptyMsg, badgeBg, badgeColor, badgeBorder, hoverBg, showBillNo, onOpen, onExport, onDelete, user }) {
  if (reports.length === 0) return (
    <div style={S.empty}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>{emptyIcon}</div>
      <h3 style={{ color: "#333", margin: "0 0 8px" }}>No {label.toLowerCase()} yet</h3>
      <p style={{ color: "#888" }}>{emptyMsg}</p>
    </div>
  );
  const cols = showBillNo
    ? ["#", "Client / Owner", "Bank", "Branch", "Bill No.", "Visit Date", "Last Saved", ""]
    : ["#", "Client / Owner", "Bank", "Branch", "Visit Date", "Last Saved", ""];
  return (
    <div style={S.tableCard}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #f0f2f5" }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: "#0f1f3d" }}>{icon} {label}</span>
        <span style={{ fontSize: 12, color: "#aaa", marginLeft: 10 }}>{reports.length} report{reports.length !== 1 ? "s" : ""}</span>
      </div>
      <div style={S.tableScrollWrap}>
        <table style={S.table}>
          <thead><tr>{cols.map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {reports.map((r, i) => (
              <tr key={r.id} style={S.tr}
                onMouseEnter={e => e.currentTarget.style.background = hoverBg}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fafbfc"}>
                <td style={{ ...S.td, color: "#999", fontSize: 12 }}>{r.id}</td>
                <td style={{ ...S.td, fontWeight: 600, color: "#0f1f3d" }}>{r.client_name || "—"}</td>
                <td style={S.td}>{r.bank || "—"}</td>
                <td style={S.td}>{r.branch || "—"}</td>
                {showBillNo && (
                  <td style={S.td}>
                    <span style={{ ...S.badge, background: badgeBg, color: badgeColor, border: `1px solid ${badgeBorder}` }}>
                      {r.bill_no || "—"}
                    </span>
                  </td>
                )}
                <td style={{ ...S.td, color: "#555" }}>{fmtDate(r.visit_date)}</td>
                <td style={{ ...S.td, color: "#888", fontSize: 12 }}>{fmtDate(r.updated_at)}</td>
                <td style={S.tdActions}>
                  <button style={S.btnOpen} onClick={() => onOpen(r.id)}>Open</button>
                  <button style={S.btnSave} onClick={() => onExport(r)} title="Download as JSON">💾</button>
                  {user?.role === "admin" && (
                    <button style={S.btnDel} onClick={() => onDelete(r.id)} title="Delete">🗑</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={S.tableFooter}>{reports.length} report{reports.length !== 1 ? "s" : ""}</div>
    </div>
  );
}
