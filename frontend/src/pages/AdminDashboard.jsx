import React, { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../services/api";
import PasswordInput from "../components/ui/PasswordInput";
import { DevCredit } from "../components/ui/DeveloperCard";
import { PRESET_COLORS, resolveThemeHex } from "../utils/reportTheme";
import FieldSubmissions from "../components/FieldSubmissions";
import RateMapSection from "../components/RateMapSection";
import FeedbackSection from "../components/FeedbackSection";

const fmtLocal = (iso) => {
  if (!iso) return "—";
  return new Date(iso.endsWith("Z") ? iso : iso + "Z")
    .toLocaleString(undefined, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
};

const GRAD = {
  navy:   "linear-gradient(135deg, #0f1f3d 0%, #1a3a6b 100%)",
  blue:   "linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%)",
  green:  "linear-gradient(135deg, #27ae60 0%, #1a7a3f 100%)",
  orange: "linear-gradient(135deg, #f39c12 0%, #e67e22 100%)",
  teal:   "linear-gradient(135deg, #00bcd4 0%, #0097a7 100%)",
  purple: "linear-gradient(135deg, #8e44ad 0%, #6c3483 100%)",
  danger: "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)",
};

const C = {
  navy: "#0f1f3d", blue: "#1a73e8", danger: "#e74c3c",
  success: "#27ae60", warn: "#f39c12", bg: "#f0f2f5",
  border: "#dde1e7", text: "#2c3e50", muted: "#7f8c8d",
};

// ── Reusable: blurred modal backdrop ─────────────────────────
function Modal({ title, onClose, children, width = 500 }) {
  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(15,31,61,0.55)",
      backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000,
    }}>
      <div style={{
        background: "#fff", borderRadius: 14,
        padding: "28px 32px", width: "100%", maxWidth: width,
        boxShadow: "0 24px 64px rgba(0,0,0,0.28)",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <h3 style={{ margin: 0, color: C.navy, fontSize: 18, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{
            width: 30, height: 30, border: "none", borderRadius: 8,
            background: "#f0f2f6", cursor: "pointer", fontSize: 15,
            display: "flex", alignItems: "center", justifyContent: "center", color: C.muted,
          }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Report on Map ─────────────────────────────────────────────
function ReportMapSection() {
  const mapRef     = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef([]);
  const [points, setPoints]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [leafletReady, setLeafletReady] = useState(!!window.L);

  // Load Leaflet if not yet ready
  useEffect(() => {
    if (window.L) { setLeafletReady(true); return; }
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => setLeafletReady(true);
    document.head.appendChild(script);
  }, []);

  // Fetch own rate points
  useEffect(() => {
    setLoading(true);
    api.getOwnReportPoints().then(data => {
      const own = (data.points || []).filter(p => p.isOwn && p.lat && p.lng);
      // Group by rounded coordinate (within ~50m) to create counter clusters
      const clusters = {};
      for (const p of own) {
        const key = `${(p.lat).toFixed(3)}_${(p.lng).toFixed(3)}`;
        if (!clusters[key]) clusters[key] = { lat: p.lat, lng: p.lng, items: [] };
        clusters[key].items.push(p);
      }
      setPoints(Object.values(clusters));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Render markers
  useEffect(() => {
    if (!leafletReady || !mapRef.current || !window.L) return;
    const L = window.L;
    if (!leafletRef.current) {
      leafletRef.current = L.map(mapRef.current, { zoomControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors", maxZoom: 19,
      }).addTo(leafletRef.current);
    }
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    if (!points.length) return;

    const allCoords = points.map(c => [c.lat, c.lng]);
    const bounds = window.L.latLngBounds(allCoords);
    leafletRef.current.fitBounds(bounds, { padding: [40, 40] });

    for (const cluster of points) {
      const count = cluster.items.length;
      const size  = count > 1 ? 36 : 28;
      const bg    = count > 9 ? "#c0392b" : count > 4 ? "#e67e22" : "#1a73e8";
      const icon  = L.divIcon({
        className: "",
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:${count>9?11:13}px;font-weight:700;color:#fff;cursor:pointer;">${count}</div>`,
        iconSize: [size, size], iconAnchor: [size/2, size/2],
      });
      const marker = L.marker([cluster.lat, cluster.lng], { icon });
      marker.on("click", () => setSelected(cluster));
      marker.addTo(leafletRef.current);
      markersRef.current.push(marker);
    }
  }, [points, leafletReady]);

  useEffect(() => () => { if (leafletRef.current) { leafletRef.current.remove(); leafletRef.current = null; } }, []);

  const totalPlots = points.reduce((s, c) => s + c.items.length, 0);

  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden", minHeight: 520, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "16px 22px", borderBottom: "1.5px solid #dde1e7", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(135deg,#0f1f3d,#1a3a6b)", color: "#fff" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>📍 Report on Map</div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>GPS coordinates from your submitted reports</div>
        </div>
        <div style={{ display: "flex", gap: 20, fontSize: 13 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 20 }}>{totalPlots}</div>
            <div style={{ opacity: 0.7, fontSize: 11 }}>Total Plots</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 20 }}>{points.length}</div>
            <div style={{ opacity: 0.7, fontSize: 11 }}>Locations</div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, minHeight: 460, position: "relative" }}>
        {loading ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#7f8c8d", gap: 10 }}>
            <span style={{ fontSize: 22 }}>📍</span> Loading report locations…
          </div>
        ) : totalPlots === 0 ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#7f8c8d", gap: 10 }}>
            <span style={{ fontSize: 40 }}>🗺️</span>
            <div style={{ fontWeight: 600 }}>No GPS data found</div>
            <div style={{ fontSize: 13 }}>Reports need GPS coordinates in their property entries.</div>
          </div>
        ) : null}
        <div ref={mapRef} style={{ width: "100%", height: "100%", minHeight: 460, display: loading || totalPlots === 0 ? "none" : "block" }} />

        {/* Legend */}
        {!loading && totalPlots > 0 && (
          <div style={{ position: "absolute", bottom: 16, right: 12, zIndex: 1000, background: "rgba(255,255,255,0.95)", borderRadius: 10, padding: "10px 14px", boxShadow: "0 2px 10px rgba(0,0,0,0.15)", fontSize: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: "#0f1f3d" }}>Counter</div>
            {[["1–4", "#1a73e8"], ["5–9", "#e67e22"], ["10+", "#c0392b"]].map(([label, color]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: color, border: "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.2)", flexShrink: 0 }} />
                <span style={{ color: "#555" }}>{label} reports</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected cluster detail */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,31,61,0.5)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }} onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "0 24px 64px rgba(0,0,0,0.3)", overflow: "hidden", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <div style={{ background: "linear-gradient(135deg,#0f1f3d,#1a3a6b)", padding: "16px 22px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>📍 {selected.items.length} Report{selected.items.length > 1 ? "s" : ""} at this location</div>
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>GPS: {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, color: "#fff", width: 32, height: 32, cursor: "pointer", fontSize: 16, fontWeight: 700 }}>✕</button>
            </div>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {selected.items.map((item, i) => (
                <div key={i} style={{ padding: "14px 22px", borderBottom: "1px solid #eef0f4" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#0f1f3d", marginBottom: 6 }}>Plot {item.plotNo || `#${i+1}`}</div>
                  {[
                    ["Trace Sheet",    item.traceSheetNo],
                    ["Market Rate",    item.marketRate ? `Rs. ${Number(item.marketRate).toLocaleString()} / sq.m` : null],
                    ["Road Type",      item.roadType],
                    ["Road Width",     item.roadWidth ? `${item.roadWidth} ft` : null],
                    ["Hazard",         item.hazard],
                    ["Visit Date",     item.fieldVisitDate],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12 }}>
                      <span style={{ color: "#7f8c8d", fontWeight: 600 }}>{label}</span>
                      <span style={{ color: "#2c3e50", fontWeight: 600, textAlign: "right", maxWidth: 260, wordBreak: "break-word" }}>{value}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Form helpers ──────────────────────────────────────────────
const FL = ({ label, span, children }) => (
  <div style={{ marginBottom: 16, gridColumn: span === 2 ? "1 / -1" : undefined }}>
    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#666", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</label>
    {children}
  </div>
);

const Input = (props) => (
  <input {...props} style={{
    width: "100%", padding: "10px 14px",
    border: `1.5px solid ${C.border}`, borderRadius: 8,
    fontSize: 14, boxSizing: "border-box", outline: "none",
    transition: "border-color 0.2s",
  }} />
);

// ── Gradient KPI Stat Card ────────────────────────────────────
function StatCard({ label, value, gradient, icon, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: gradient, borderRadius: 12,
      padding: "22px 24px", color: "#fff",
      boxShadow: "0 4px 16px rgba(0,0,0,0.14)",
      cursor: onClick ? "pointer" : "default",
      position: "relative", overflow: "hidden",
      transition: "transform 0.15s, box-shadow 0.15s",
    }}
      onMouseEnter={e => onClick && (e.currentTarget.style.transform = "translateY(-2px)")}
      onMouseLeave={e => onClick && (e.currentTarget.style.transform = "")}
    >
      {/* ghost icon */}
      <span style={{
        position: "absolute", right: 16, bottom: 6,
        fontSize: 52, opacity: 0.18, lineHeight: 1,
        userSelect: "none", pointerEvents: "none",
      }}>{icon}</span>
      {/* glow circle */}
      <div style={{
        position: "absolute", top: -24, right: -24,
        width: 90, height: 90, borderRadius: "50%",
        background: "rgba(255,255,255,0.12)",
        pointerEvents: "none",
      }} />
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, opacity: 0.82, textTransform: "uppercase", letterSpacing: "0.6px" }}>{label}</p>
      <p style={{ margin: "8px 0 0", fontSize: 36, fontWeight: 800, lineHeight: 1 }}>{value}</p>
    </div>
  );
}

export default function AdminDashboard({ user, onLogout, onOpen }) {
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [profile, setProfile] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeMsg, setThemeMsg] = useState("");
  const colorInputRef = useRef(null);

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Full report list for analytics tab
  const [reportList, setReportList]       = useState([]);
  const [reportTotal, setReportTotal]     = useState(0);
  const [reportSearch, setReportSearch]   = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [expandedReport, setExpandedReport] = useState(null); // id of expanded row (prints)
  const [expandedVersions, setExpandedVersions] = useState(null); // id of expanded row (edit history)
  const [versionsCache, setVersionsCache] = useState({}); // { [reportId]: { loading, data } }
  const [diffModal, setDiffModal] = useState(null); // { label, loading, rows: [{key,oldVal,newVal,type}] }
  const [deleteConfirm, setDeleteConfirm] = useState(null); // report id to delete
  const [reportSubTab, setReportSubTab]   = useState("all"); // "all" | "preliminary" | "final" | "analysis" | "billing"
  const [billTypeFilter, setBillTypeFilter] = useState("all"); // "all" | "preliminary" | "bill" | "final"
  const [bankSearch, setBankSearch] = useState("");
  const [selectedBank, setSelectedBank] = useState(null); // bankName string | null

  // Bank list management
  const [bankList, setBankList]       = useState([]);
  const [newBankInput, setNewBankInput] = useState("");
  const [bankSaving, setBankSaving]   = useState(false);
  const [bankMsg, setBankMsg]         = useState("");

  // Payment methods management
  const emptyPaymentMethod = () => ({ id: String(Date.now()+Math.random()), bankName:"", branch:"", location:"", accountName:"", accountNumber:"", qrCode:"" });
  const [paymentMethodList, setPaymentMethodList]   = useState([]);
  const [paymentMethodSaving, setPaymentMethodSaving] = useState(false);
  const [paymentMethodMsg, setPaymentMethodMsg]     = useState("");
  const [editingPM, setEditingPM]                   = useState(null); // null | payment method object

  // Valuator management
  const emptyValuator = () => ({ id: String(Date.now()+Math.random()), name:"", licenseNo:"", company:"", phone:"", email:"" });
  const [valuatorList, setValuatorList]   = useState([]);
  const [valuatorSaving, setValuatorSaving] = useState(false);
  const [valuatorMsg, setValuatorMsg]     = useState("");
  const [editingValuator, setEditingValuator] = useState(null); // null | valuator object

  // Fee tier management (bank-keyed map)
  const emptyTier = () => ({ label: "", upto: "", base: "", rate: "" });
  const [feeTiersMap, setFeeTiersMap]   = useState({}); // { [bankName]: tier[] }
  const [feeTierSaving, setFeeTierSaving] = useState(false);
  const [feeTierMsg, setFeeTierMsg]     = useState("");
  const [editingTier, setEditingTier]   = useState(null); // null | tier object with _bank, _idx
  const [feeTierBank, setFeeTierBank]   = useState("Default"); // which bank is being viewed/edited

  const [modal, setModal] = useState(null);
  const [target, setTarget] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [credits, setCredits] = useState(null);   // { balance, expiry, low_threshold, history }
  const [creditModal, setCreditModal] = useState(false);
  const [billingStats, setBillingStats] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);

  const [rejectedSubmissions, setRejectedSubmissions] = useState([]);
  const [rejectedLoading, setRejectedLoading] = useState(false);
  const [viewRejectedSub, setViewRejectedSub] = useState(null);   // { summary, detail, detailLoading }
  const [rejectedSearch, setRejectedSearch] = useState("");
  const [expandedBanks, setExpandedBanks] = useState(new Set());


  const loadRejectedSubmissions = useCallback(async () => {
    setRejectedLoading(true);
    try {
      const d = await api.listFieldSubmissions();
      setRejectedSubmissions((d.submissions || []).filter(s => s.status === "rejected"));
    } catch (e) { console.error(e); }
    finally { setRejectedLoading(false); }
  }, []);

  const loadCredits = useCallback(async () => {
    try { const d = await api.getCredits(); setCredits(d); } catch (e) { console.error(e); }
  }, []);

  const loadUsers = useCallback(async () => {
    try { setUsers(await api.listUsers()); } catch (e) { console.error(e); }
  }, []);

  const loadProfile = useCallback(async () => {
    try { setProfile(await api.getCompanyProfile()); } catch (e) { console.error(e); }
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try { setStats(await api.getReportStats()); }
    catch (e) { console.error(e); }
    finally { setStatsLoading(false); }
  }, []);

  const loadReports = useCallback(async (search = "") => {
    setReportLoading(true);
    try {
      const d = await api.listAdminReports({ search, limit: 200 });
      setReportList(d.reports || []);
      setReportTotal(d.total || 0);
    } catch (e) { console.error(e); }
    finally { setReportLoading(false); }
  }, []);

  const loadBanks = useCallback(async () => {
    try { const d = await api.getCompanyBanks(); setBankList(d.banks || []); }
    catch (e) { console.error(e); }
  }, []);

  const loadValuators = useCallback(async () => {
    try { const d = await api.getCompanyValuators(); setValuatorList(d.valuators || []); }
    catch (e) { console.error(e); }
  }, []);

  const loadPaymentMethods = useCallback(async () => {
    try { const d = await api.getCompanyPaymentMethods(); setPaymentMethodList(d.payment_methods || []); }
    catch (e) { console.error(e); }
  }, []);

  const loadFeeTiers = useCallback(async () => {
    try { const d = await api.getCompanyFeeTiers(); setFeeTiersMap(d.fee_tiers || {}); }
    catch (e) { console.error(e); }
  }, []);

  const loadBillingStats = useCallback(async () => {
    setBillingLoading(true);
    try { setBillingStats(await api.getBillingStats()); }
    catch (e) { console.error(e); }
    finally { setBillingLoading(false); }
  }, []);

  useEffect(() => { loadUsers(); loadProfile(); loadBanks(); loadValuators(); loadPaymentMethods(); loadFeeTiers(); loadCredits(); loadBillingStats(); loadRejectedSubmissions(); }, [loadUsers, loadProfile, loadBanks, loadValuators, loadPaymentMethods, loadFeeTiers, loadCredits, loadBillingStats, loadRejectedSubmissions]);
  useEffect(() => { if (tab === "reports") { loadStats(); loadReports(reportSearch); loadRejectedSubmissions(); } }, [tab]); // mount-only per tab switch

  // ── Bank list helpers ─────────────────────────────────────
  const saveBanks = async (list) => {
    setBankSaving(true); setBankMsg("");
    try {
      const d = await api.updateCompanyBanks(list);
      setBankList(d.banks);
      setBankMsg("✓ Bank list saved.");
      setTimeout(() => setBankMsg(""), 3000);
    } catch (e) {
      setBankMsg("Error: " + e.message);
    } finally {
      setBankSaving(false);
    }
  };

  const addBank = () => {
    const name = newBankInput.trim();
    if (!name || bankList.includes(name)) return;
    const updated = [...bankList, name];
    setNewBankInput("");
    saveBanks(updated);
  };

  const removeBank = (b) => saveBanks(bankList.filter(x => x !== b));

  const moveBank = (i, dir) => {
    const l = [...bankList];
    const j = i + dir;
    if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
    saveBanks(l);
  };

  // ── Valuator helpers ──────────────────────────────────────
  const saveValuators = async (list) => {
    setValuatorSaving(true); setValuatorMsg("");
    try {
      const d = await api.updateCompanyValuators(list);
      setValuatorList(d.valuators);
      setValuatorMsg("✓ Valuator list saved.");
      setTimeout(() => setValuatorMsg(""), 3000);
    } catch (e) {
      setValuatorMsg("Error: " + e.message);
    } finally {
      setValuatorSaving(false);
    }
  };

  const saveEditingValuator = () => {
    if (!editingValuator || !editingValuator.name.trim()) return;
    const exists = valuatorList.find(v => v.id === editingValuator.id);
    const updated = exists
      ? valuatorList.map(v => v.id === editingValuator.id ? editingValuator : v)
      : [...valuatorList, editingValuator];
    setEditingValuator(null);
    saveValuators(updated);
  };

  const removeValuator = (id) => saveValuators(valuatorList.filter(v => v.id !== id));

  // ── Fee tier helpers ──────────────────────────────────────────
  const saveFeeTiersMap = async (map) => {
    setFeeTierSaving(true); setFeeTierMsg("");
    try {
      // Normalise upto field before sending
      const payload = {};
      for (const [bank, list] of Object.entries(map)) {
        payload[bank] = list.map(t => ({ ...t, upto: t.upto === "" || t.upto === null ? null : Number(t.upto), base: Number(t.base || 0), rate: Number(t.rate || 0) }));
      }
      const d = await api.updateCompanyFeeTiers(payload);
      setFeeTiersMap(d.fee_tiers);
      setFeeTierMsg("✓ Fee tiers saved.");
      setTimeout(() => setFeeTierMsg(""), 3000);
    } catch (e) {
      setFeeTierMsg("Error: " + e.message);
    } finally {
      setFeeTierSaving(false);
    }
  };

  const saveEditingTier = () => {
    if (!editingTier || !editingTier.label.trim()) return;
    const bank = editingTier._bank;
    const currentList = feeTiersMap[bank] || [];
    const row = { label: editingTier.label, upto: editingTier.upto, base: editingTier.base, rate: editingTier.rate };
    const updated = editingTier._isNew
      ? [...currentList, row]
      : currentList.map((t, i) => i === editingTier._idx ? row : t);
    setEditingTier(null);
    saveFeeTiersMap({ ...feeTiersMap, [bank]: updated });
  };

  const removeTier = (bank, idx) => {
    const updated = (feeTiersMap[bank] || []).filter((_, i) => i !== idx);
    const next = { ...feeTiersMap };
    if (updated.length === 0) delete next[bank]; else next[bank] = updated;
    saveFeeTiersMap(next);
  };
  const moveTier = (bank, idx, dir) => {
    const l = [...(feeTiersMap[bank] || [])];
    const j = idx + dir;
    if (j < 0 || j >= l.length) return;
    [l[idx], l[j]] = [l[j], l[idx]];
    saveFeeTiersMap({ ...feeTiersMap, [bank]: l });
  };

  // ── Payment method helpers ────────────────────────────────────
  const savePaymentMethods = async (list) => {
    setPaymentMethodSaving(true); setPaymentMethodMsg("");
    try {
      const d = await api.updateCompanyPaymentMethods(list);
      setPaymentMethodList(d.payment_methods);
      setPaymentMethodMsg("✓ Payment methods saved.");
      setTimeout(() => setPaymentMethodMsg(""), 3000);
    } catch (e) {
      setPaymentMethodMsg("Error: " + e.message);
    } finally {
      setPaymentMethodSaving(false);
    }
  };

  const saveEditingPM = () => {
    if (!editingPM || !editingPM.bankName.trim()) return;
    const exists = paymentMethodList.find(m => m.id === editingPM.id);
    const updated = exists
      ? paymentMethodList.map(m => m.id === editingPM.id ? editingPM : m)
      : [...paymentMethodList, editingPM];
    setEditingPM(null);
    savePaymentMethods(updated);
  };

  const removePM = (id) => savePaymentMethods(paymentMethodList.filter(m => m.id !== id));

  const openModal = (name, row = null) => {
    setError(""); setTarget(row);
    setForm(row ? { ...row } : {});
    setModal(name);
  };
  const closeModal = () => { setModal(null); setTarget(null); setForm({}); setError(""); };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setP = (k) => (e) => setProfile((p) => ({ ...p, [k]: e.target.value }));

  const saveUser = async (e) => {
    e.preventDefault(); setSaving(true); setError("");
    try {
      if (modal === "addUser") await api.createUser(form);
      else await api.updateUser(target.id, form);
      await loadUsers(); closeModal();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const deleteUser = async () => {
    setSaving(true); setError("");
    try { await api.deleteUser(target.id); await loadUsers(); closeModal(); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const saveProfile = async (e) => {
    e.preventDefault(); setProfileSaving(true); setProfileMsg("");
    try {
      await api.updateCompanyProfile(profile);
      setProfileMsg("success");
    } catch (err) { setProfileMsg("error:" + err.message); }
    finally { setProfileSaving(false); }
  };

  const saveTheme = async (key) => {
    setThemeSaving(true); setThemeMsg("");
    setProfile(p => ({ ...p, report_color_theme: key }));
    try {
      await api.updateCompanyTheme(key);
      setThemeMsg("✓ Saved");
      setTimeout(() => setThemeMsg(""), 2500);
    } catch (err) { setThemeMsg("⚠ " + err.message); }
    finally { setThemeSaving(false); }
  };

  const active = users.filter(u => !u.must_change_password).length;
  const tempPwd = users.filter(u => u.must_change_password).length;

  // ── Diff helpers ──────────────────────────────────────────────
  function flattenState(obj, prefix = "", out = {}) {
    if (!obj || typeof obj !== "object") { out[prefix] = obj; return out; }
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => flattenState(item, `${prefix}[${i}]`, out));
      return out;
    }
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "string" && v.startsWith("data:image")) { out[path] = "[photo]"; continue; }
      if (typeof v === "object" && v !== null) flattenState(v, path, out);
      else out[path] = v;
    }
    return out;
  }

  const LABEL_MAP = {
    bank: "Bank", branch: "Branch", reportType: "Report Type",
    visitDate: "Visit Date", reportDate: "Report Date",
    "clients[0].person.name": "Client 1 Name",
    "clients[0].company.name": "Client 1 Company",
    "clients[1].person.name": "Client 2 Name",
    "properties[0].location": "Property 1 Location",
    "properties[0].landArea.aana": "Property 1 Land Area (Aana)",
    "properties[0].landArea.sqm": "Property 1 Land Area (Sqm)",
    "properties[0].landRate": "Property 1 Land Rate",
    "properties[0].landValue": "Property 1 Land Value",
    remarks: "Remarks", conclusion: "Conclusion",
  };
  function label(key) {
    if (LABEL_MAP[key]) return LABEL_MAP[key];
    return key.replace(/\[(\d+)\]/g, " $1").replace(/\./g, " › ").replace(/_/g, " ");
  }

  async function openDiff(reportId, version, versions, currentReportState) {
    setDiffModal({ label: `Changes for v${version.vNum} — saved ${fmtLocal(version.created_at)}`, loading: true, rows: [] });
    try {
      // "before" state = this version's state_json (state before the save happened)
      const { state: beforeState } = await api.getReportVersion(reportId, version.id);
      // "after" state = previous version in the list (which is chronologically newer),
      // or the current saved state if this is the latest version in history
      let afterState;
      const prevVersion = versions[version.listIndex - 1]; // listIndex 0 = newest
      if (prevVersion) {
        const { state: s } = await api.getReportVersion(reportId, prevVersion.id);
        afterState = s;
      } else {
        afterState = currentReportState;
      }
      const before = flattenState(beforeState);
      const after  = flattenState(afterState);
      const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
      const rows = [];
      for (const k of allKeys) {
        const bv = before[k], av = after[k];
        const bStr = bv == null ? "" : String(bv);
        const aStr = av == null ? "" : String(av);
        if (bStr === aStr) continue;
        rows.push({
          key: label(k),
          rawKey: k,
          oldVal: bStr || "—",
          newVal: aStr || "—",
          type: bv == null ? "added" : av == null ? "removed" : "changed",
        });
      }
      setDiffModal({ label: `v${version.vNum} — saved ${fmtLocal(version.created_at)} by ${version.edited_by || "unknown"}`, loading: false, rows });
    } catch (err) {
      setDiffModal({ label: "Error", loading: false, rows: [], error: err.message });
    }
  }

  const TABS = [
    ["users",      "👥", "User Management"],
    ["valuators",  "👷", "Valuators"],
    ["banks",      "🏦", "Bank List"],
    ["payment",    "💳", "Payment Methods"],
    ["feetiers",   "📐", "Fee Tiers"],
    ["billing",    "🧾", "Billing"],
    ["field",      "📱", "Field Data"],
    ["reports",    "📊", "Report Analytics"],
    ["ratemap",    "🗺️", "Rate Map"],
    ["reportmap",  "📍", "Report on Map"],
    ["feedback",   "💬", "Feedback"],
    ["profile",    "🏢", "Company Profile"],
  ];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#e8edf5 0%,#f0f2f5 120px)", fontFamily: "'Segoe UI', sans-serif" }}>

      {/* ── Credit Balance Modal ── */}
      {creditModal && credits && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,31,61,0.6)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9100 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", width: "96%", maxWidth: 680, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.32)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <h3 style={{ margin: 0, color: C.navy, fontSize: 18, fontWeight: 700 }}>🪙 Credit Balance</h3>
              <button onClick={() => setCreditModal(false)} style={{ width: 32, height: 32, border: "none", borderRadius: 8, background: "#f0f2f6", cursor: "pointer", fontSize: 16, color: C.muted }}>✕</button>
            </div>

            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "Available Balance", value: `${credits.balance} 🪙`, bg: "linear-gradient(135deg,#f39c12,#e67e22)", big: true },
                { label: "Low Balance Alert", value: `≤ ${credits.low_threshold} 🪙`, bg: "linear-gradient(135deg,#e74c3c,#c0392b)" },
                { label: "Expiry", value: credits.expiry ? fmtLocal(credits.expiry) : "No Expiry", bg: "linear-gradient(135deg,#0f1f3d,#1a3a6b)" },
              ].map(({ label, value, bg, big }) => (
                <div key={label} style={{ background: bg, borderRadius: 12, padding: "16px 18px", color: "#fff", textAlign: "center" }}>
                  <div style={{ fontSize: big ? 32 : 18, fontWeight: 800 }}>{value}</div>
                  <div style={{ fontSize: 10, opacity: 0.8, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Transaction history */}
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 10 }}>Transaction History <span style={{ fontWeight: 400, color: C.muted }}>(last 50)</span></div>
            {credits.history?.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: C.muted, fontSize: 13 }}>No transactions yet.</div>
            ) : (
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>{["Date", "Action", "Amount", "Balance", "By", "Note"].map(h => (
                      <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", background: "#fafbfd", borderBottom: `2px solid ${C.border}` }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {(credits.history || []).map((tx, i) => {
                      const isDeduct = tx.action === "deduct" || tx.action === "rate_map";
                      const signedAmt = isDeduct ? -Math.abs(tx.amount) : Math.abs(tx.amount);
                      const noteText = tx.report_id
                        ? `${tx.note || "Print report"} — Report #${tx.report_id}${tx.report_type ? ` (${tx.report_type})` : ""}`
                        : tx.note || "—";
                      return (
                        <tr key={tx.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfd" }}>
                          <td style={{ padding: "9px 12px", color: C.muted, whiteSpace: "nowrap" }}>{fmtLocal(tx.created_at)}</td>
                          <td style={{ padding: "9px 12px" }}>
                            <span style={{ background: isDeduct ? "#fff5f5" : "#e8f5e9", color: isDeduct ? "#c0392b" : "#1a5c3a", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                              {isDeduct ? "▼ deduct" : "▲ credit"}
                            </span>
                          </td>
                          <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                            <span style={{ fontWeight: 800, fontSize: 14, color: isDeduct ? "#e74c3c" : "#27ae60" }}>
                              {signedAmt > 0 ? "+" : ""}{signedAmt}
                            </span>
                          </td>
                          <td style={{ padding: "9px 12px", fontWeight: 700, color: C.navy }}>{tx.balance_after ?? "—"}</td>
                          <td style={{ padding: "9px 12px", color: C.muted }}>{tx.actor_username || "—"}</td>
                          <td style={{ padding: "9px 12px", color: C.muted, fontSize: 12 }}>{noteText}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: 18, fontSize: 12, color: C.muted, textAlign: "center" }}>
              Contact <strong>One Degree Consultant Pvt. Ltd.</strong> to top up credits · <a href="mailto:onedegreeconsultant@gmail.com" style={{ color: C.blue }}>onedegreeconsultant@gmail.com</a> · <a href="tel:9841357433" style={{ color: C.blue }}>9841357433</a>
            </div>
          </div>
        </div>
      )}

      {/* ── Diff Modal ── */}
      {diffModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,31,61,0.6)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9100 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "28px 32px", width: "96%", maxWidth: 860, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.32)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, color: C.navy, fontSize: 17, fontWeight: 700 }}>Report Changes</h3>
                <p style={{ margin: "4px 0 0", color: C.muted, fontSize: 12 }}>{diffModal.label}</p>
              </div>
              <button onClick={() => setDiffModal(null)} style={{ width: 30, height: 30, border: "none", borderRadius: 8, background: "#f0f2f6", cursor: "pointer", fontSize: 15, color: C.muted }}>✕</button>
            </div>
            {diffModal.loading ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: C.muted }}>Computing diff…</div>
            ) : diffModal.error ? (
              <div style={{ color: C.danger, padding: 16 }}>{diffModal.error}</div>
            ) : diffModal.rows.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: C.muted }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>No changes detected between versions.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Field", "Before (this version)", "After (next save)"].map(h => (
                      <th key={h} style={{ padding: "9px 14px", textAlign: "left", background: "#f4f6fa", borderBottom: `2px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.4px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {diffModal.rows.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfd", borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "9px 14px", fontWeight: 600, color: C.navy, fontSize: 12, whiteSpace: "nowrap", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{row.key}</td>
                      <td style={{ padding: "9px 14px", color: row.type === "added" ? C.muted : C.danger, background: row.type === "added" ? "#fafbfd" : "#fff5f5", maxWidth: 280, wordBreak: "break-word" }}>
                        {row.type === "added" ? <span style={{ color: C.muted, fontStyle: "italic" }}>—</span> : (
                          <span style={{ display: "inline-flex", alignItems: "flex-start", gap: 6 }}>
                            <span style={{ fontSize: 11, marginTop: 2 }}>✕</span>{row.oldVal}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "9px 14px", color: row.type === "removed" ? C.muted : C.success, background: row.type === "removed" ? "#fafbfd" : "#f0fdf4", maxWidth: 280, wordBreak: "break-word" }}>
                        {row.type === "removed" ? <span style={{ color: C.muted, fontStyle: "italic" }}>—</span> : (
                          <span style={{ display: "inline-flex", alignItems: "flex-start", gap: 6 }}>
                            <span style={{ fontSize: 11, marginTop: 2 }}>✓</span>{row.newVal}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ marginTop: 20, textAlign: "right" }}>
              <button onClick={() => setDiffModal(null)} style={{ background: GRAD.navy, color: "#fff", border: "none", borderRadius: 8, padding: "9px 22px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,31,61,0.6)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9200 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "28px 32px", width: "100%", maxWidth: 420, boxShadow: "0 24px 64px rgba(0,0,0,0.32)" }}>
            <h3 style={{ margin: "0 0 10px", color: C.danger, fontSize: 17, fontWeight: 700 }}>Delete Report #{deleteConfirm}?</h3>
            <p style={{ margin: "0 0 24px", color: C.muted, fontSize: 13 }}>This action cannot be undone. All edit history and print records for this report will also be permanently deleted.</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: "9px 20px", border: `1.5px solid ${C.border}`, borderRadius: 8, background: "#fff", color: C.text, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button
                onClick={async () => {
                  try {
                    await api.deleteReport(deleteConfirm);
                    setDeleteConfirm(null);
                    loadReports(reportSearch);
                    loadStats();
                  } catch (e) { alert("Delete failed: " + e.message); }
                }}
                style={{ padding: "9px 20px", border: "none", borderRadius: 8, background: GRAD.danger, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              >Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sticky header ── */}
      <div style={{
        background: "linear-gradient(135deg,#0a1628 0%,#0f1f3d 60%,#112244 100%)",
        color: "#fff", padding: "0 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 60, position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 2px 16px rgba(0,0,0,0.35)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏢</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.2 }}>{profile?.company_name || user.companyCode}</div>
            <div style={{ fontSize: 9, opacity: 0.35, letterSpacing: "0.3px" }}><DevCredit /></div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ background: "linear-gradient(135deg,#f39c12,#e67e22)", color: "#fff", borderRadius: 5, padding: "2px 9px", fontSize: 10, fontWeight: 800, letterSpacing: "0.6px" }}>ADMIN</span>
          <div style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.1)", borderRadius: 20, padding: "4px 12px 4px 5px" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg,#1a73e8,#0d47a1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>
              {user.username.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 13 }}>{user.username}</span>
          </div>
          <button onClick={onLogout} style={{ background: "rgba(231,76,60,0.8)", color: "#fff", border: "none", borderRadius: 7, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Sign Out</button>
        </div>
      </div>

      {/* ── Hero banner ── */}
      <div style={{ background: "linear-gradient(135deg,#0f1f3d 0%,#1a3a6b 55%,#1a5276 100%)", color: "#fff", padding: "28px 32px 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px" }}>Admin Dashboard</p>
              <h2 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 900, letterSpacing: "-0.5px" }}>
                {profile?.company_name || user.companyCode}
              </h2>
            </div>
            {credits !== null && (
              <div
                onClick={() => setCreditModal(true)}
                style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 14, padding: "12px 20px", cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.14)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: credits.balance <= (credits.low_threshold ?? 5) ? "linear-gradient(135deg,#e74c3c,#c0392b)" : "linear-gradient(135deg,#f39c12,#e67e22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "0 4px 14px rgba(0,0,0,0.3)" }}>🪙</div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.6px" }}>Available Credits</div>
                  <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.1, color: credits.balance <= (credits.low_threshold ?? 5) ? "#ff8a80" : "#ffd54f" }}>{credits.balance}</div>
                  {credits.balance <= (credits.low_threshold ?? 5) && <div style={{ fontSize: 10, color: "#ff8a80", fontWeight: 700, marginTop: 1 }}>⚠ Low balance</div>}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginLeft: 4 }}>→</div>
              </div>
            )}
          </div>

        </div>
      </div>

      <div style={{ padding: "0 32px 32px", maxWidth: 1200, margin: "0 auto", display: "flex", gap: 24, alignItems: "flex-start" }}>

        {/* ── Vertical Sidebar Nav ── */}
        <div style={{
          width: 210, flexShrink: 0,
          background: "#fff", borderRadius: "0 0 14px 14px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          position: "sticky", top: 60, alignSelf: "flex-start",
          overflow: "hidden",
        }}>
          {TABS.map(([t, icon, lbl]) => {
            const isActive = tab === t;
            return (
              <button key={t} onClick={() => setTab(t)} style={{
                width: "100%", padding: "12px 18px",
                border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: isActive ? 700 : 500,
                background: isActive ? "#eef4ff" : "transparent",
                color: isActive ? C.blue : C.text,
                borderLeft: isActive ? `3px solid ${C.blue}` : "3px solid transparent",
                transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: 9,
                textAlign: "left",
              }}
                onMouseEnter={e => !isActive && (e.currentTarget.style.background = "#f5f7fa")}
                onMouseLeave={e => !isActive && (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: 16 }}>{icon}</span> {lbl}
              </button>
            );
          })}
        </div>

        {/* ── Main content ── */}
        <div style={{ flex: 1, minWidth: 0 }}>

        {/* ══════════════════════════════════════════
            TAB: USER MANAGEMENT
        ══════════════════════════════════════════ */}
        {tab === "users" && (
          <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
            {/* Card header */}
            <div style={{
              padding: "18px 24px",
              borderBottom: `2px solid ${C.border}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.navy }}>Users</h2>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: C.muted }}>{users.length} member{users.length !== 1 ? "s" : ""} in your company</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ background: "linear-gradient(135deg,#fff8e1,#fff3cd)", border: "1.5px solid #f39c12", borderRadius: 10, padding: "8px 18px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>🪙</span>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#7a5c00", textTransform: "uppercase", letterSpacing: "0.5px" }}>Available Credits</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#e67e22", lineHeight: 1.1 }}>{credits !== null ? credits.balance : "—"}</div>
                  </div>
                </div>
                <button
                  onClick={() => openModal("addUser")}
                  style={{
                    background: GRAD.blue, color: "#fff",
                    border: "none", borderRadius: 8,
                    padding: "9px 18px", cursor: "pointer",
                    fontSize: 13, fontWeight: 700,
                    boxShadow: "0 2px 8px rgba(26,115,232,0.3)",
                  }}
                >+ Add User</button>
              </div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Username", "Email", "Status", "Created", "Actions"].map(h => (
                    <th key={h} style={{
                      padding: "11px 18px", textAlign: "left",
                      fontSize: 11, fontWeight: 700, color: C.muted,
                      textTransform: "uppercase", letterSpacing: "0.5px",
                      background: "#fafbfd", borderBottom: `2px solid ${C.border}`,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 48, textAlign: "center", color: C.muted, fontSize: 14 }}>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>👤</div>
                      No users yet. Click "+ Add User" to create one.
                    </td>
                  </tr>
                ) : users.map((u, i) => (
                  <tr key={u.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfd", transition: "background 0.12s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#eef4ff"}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fafbfd"}
                  >
                    <td style={{ padding: "13px 18px", fontSize: 14, color: C.text }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%",
                          background: GRAD.blue,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", fontSize: 13, fontWeight: 700, flexShrink: 0,
                        }}>{u.username.charAt(0).toUpperCase()}</div>
                        <strong>{u.username}</strong>
                      </div>
                    </td>
                    <td style={{ padding: "13px 18px", fontSize: 14, color: C.text }}>
                      {u.email || <span style={{ color: C.muted }}>—</span>}
                    </td>
                    <td style={{ padding: "13px 18px" }}>
                      {u.must_change_password ? (
                        <span style={{ background: "#fff8e1", color: "#e67e22", border: "1px solid #f39c1244", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>TEMP PASSWORD</span>
                      ) : (
                        <span style={{ background: "#e8f5e9", color: "#27ae60", border: "1px solid #27ae6044", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>ACTIVE</span>
                      )}
                    </td>
                    <td style={{ padding: "13px 18px", fontSize: 13, color: C.muted }}>{fmtLocal(u.created_at)}</td>
                    <td style={{ padding: "13px 18px" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => openModal("editUser", u)}
                          style={{ background: "#f0f4ff", color: C.blue, border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                        >Edit</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB: VALUATORS
        ══════════════════════════════════════════ */}
        {tab === "valuators" && (
          <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
            <div style={{ padding: "20px 28px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.navy }}>👷 Company Valuators</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: C.muted }}>
                  Valuators added here can be selected by users when filling a report in Section 1.
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {valuatorMsg && (
                  <span style={{ fontSize: 13, color: valuatorMsg.startsWith("Error") ? C.danger : C.success, fontWeight: 600 }}>
                    {valuatorMsg}
                  </span>
                )}
                <button
                  onClick={() => setEditingValuator(emptyValuator())}
                  style={{ padding: "9px 20px", background: C.blue, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >
                  + Add Valuator
                </button>
              </div>
            </div>

            {/* Inline edit form */}
            {editingValuator && (
              <div style={{ padding: "20px 28px", background: "#f0f4ff", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.navy, marginBottom: 14 }}>
                  {valuatorList.find(v => v.id === editingValuator.id) ? "✏️ Edit Valuator" : "➕ New Valuator"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px 16px" }}>
                  {[
                    ["name",      "Valuator Name *",       "e.g. Er. Ram Sharma",          false],
                    ["licenseNo", "NEC / License No.",     'e.g. 11518 Civil "A"',         false],
                    ["company",   "Company / Firm",        "e.g. Neo-Civic Consulting",    false],
                    ["phone",     "Phone / Mobile",        "e.g. 98xxxxxxxx",              false],
                    ["email",     "Email",                 "e.g. ram@example.com",         true ],
                  ].map(([key, label, placeholder, isEmail]) => (
                    <div key={key}>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#555", marginBottom: 5, textTransform: "uppercase" }}>{label}</label>
                      <input
                        type={isEmail ? "email" : "text"}
                        value={editingValuator[key] || ""}
                        onChange={e => setEditingValuator(v => ({ ...v, [key]: e.target.value }))}
                        placeholder={placeholder}
                        style={{ width: "100%", padding: "9px 13px", border: `1.5px solid ${C.border}`, borderRadius: 7, fontSize: 14, boxSizing: "border-box" }}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button
                    onClick={saveEditingValuator}
                    disabled={!editingValuator.name.trim() || valuatorSaving}
                    style={{ padding: "8px 22px", background: C.success, color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: !editingValuator.name.trim() ? 0.5 : 1 }}
                  >
                    {valuatorSaving ? "Saving…" : "💾 Save"}
                  </button>
                  <button
                    onClick={() => setEditingValuator(null)}
                    style={{ padding: "8px 18px", background: "#fff", color: C.text, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Valuator list */}
            {valuatorList.length === 0 && !editingValuator ? (
              <div style={{ padding: "40px 28px", textAlign: "center", color: C.muted, fontStyle: "italic", fontSize: 14 }}>
                No valuators added yet. Click "+ Add Valuator" to create the first one.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Name", "License No.", "Company / Firm", "Phone", "Email", "Actions"].map(h => (
                      <th key={h} style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", borderBottom: `1px solid ${C.border}`, background: "#fafbfc" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {valuatorList.map((v, i) => (
                    <tr key={v.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                      <td style={{ padding: "12px 20px", fontWeight: 600, fontSize: 14, color: C.navy }}>{v.name}</td>
                      <td style={{ padding: "12px 20px", fontSize: 13, color: C.text }}>{v.licenseNo || <span style={{ color: C.muted }}>—</span>}</td>
                      <td style={{ padding: "12px 20px", fontSize: 13, color: C.text }}>{v.company || <span style={{ color: C.muted }}>—</span>}</td>
                      <td style={{ padding: "12px 20px", fontSize: 13, color: C.text }}>{v.phone || <span style={{ color: C.muted }}>—</span>}</td>
                      <td style={{ padding: "12px 20px", fontSize: 13, color: C.text }}>{v.email || <span style={{ color: C.muted }}>—</span>}</td>
                      <td style={{ padding: "8px 20px" }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => setEditingValuator({ ...v })}
                            style={{ padding: "5px 14px", background: "#fff", color: C.blue, border: `1px solid ${C.blue}`, borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => removeValuator(v.id)}
                            disabled={valuatorSaving}
                            style={{ padding: "5px 14px", background: "#fff", color: C.danger, border: `1px solid ${C.danger}`, borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                          >
                            ✕ Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ padding: "14px 28px", background: "#f8faff", borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.muted, borderRadius: "0 0 14px 14px" }}>
              💡 Users will see these valuators in a dropdown in Section 1 of the valuation form.
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB: BANK LIST MANAGEMENT
        ══════════════════════════════════════════ */}
        {tab === "banks" && (
          <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
            <div style={{ padding: "20px 28px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.navy }}>🏦 Company Bank List</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: C.muted }}>
                  Banks added here appear at the top of the bank dropdown for all users in your company.
                </p>
              </div>
              {bankMsg && (
                <span style={{ fontSize: 13, color: bankMsg.startsWith("Error") ? C.danger : C.success, fontWeight: 600 }}>
                  {bankMsg}
                </span>
              )}
            </div>

            {/* Add bank input */}
            <div style={{ padding: "20px 28px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                value={newBankInput}
                onChange={e => setNewBankInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addBank()}
                placeholder="Type bank name and press Enter or click Add…"
                style={{ flex: 1, minWidth: 220, padding: "9px 14px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 14, outline: "none" }}
              />
              <button
                onClick={addBank}
                disabled={!newBankInput.trim() || bankList.includes(newBankInput.trim()) || bankSaving}
                style={{ padding: "9px 22px", background: C.blue, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: (!newBankInput.trim() || bankList.includes(newBankInput.trim())) ? 0.5 : 1 }}
              >
                {bankSaving ? "Saving…" : "+ Add Bank"}
              </button>
            </div>

            {/* Bank list */}
            {bankList.length === 0 ? (
              <div style={{ padding: "40px 28px", textAlign: "center", color: C.muted, fontStyle: "italic", fontSize: 14 }}>
                No custom banks added yet. Use the input above to add your first bank.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["#", "Bank Name", "Order", "Remove"].map(h => (
                      <th key={h} style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", borderBottom: `1px solid ${C.border}`, background: "#fafbfc" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bankList.map((b, i) => (
                    <tr key={b} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                      <td style={{ padding: "11px 20px", color: C.muted, fontSize: 13, width: 40 }}>{i + 1}</td>
                      <td style={{ padding: "11px 20px", fontWeight: 500, fontSize: 14, color: C.text }}>{b}</td>
                      <td style={{ padding: "8px 20px", width: 100 }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => moveBank(i, -1)} disabled={i === 0 || bankSaving}
                            style={{ padding: "3px 8px", border: `1px solid ${C.border}`, borderRadius: 4, background: "#fff", cursor: i === 0 ? "not-allowed" : "pointer", opacity: i === 0 ? 0.4 : 1, fontSize: 12 }}>▲</button>
                          <button onClick={() => moveBank(i, 1)} disabled={i === bankList.length - 1 || bankSaving}
                            style={{ padding: "3px 8px", border: `1px solid ${C.border}`, borderRadius: 4, background: "#fff", cursor: i === bankList.length - 1 ? "not-allowed" : "pointer", opacity: i === bankList.length - 1 ? 0.4 : 1, fontSize: 12 }}>▼</button>
                        </div>
                      </td>
                      <td style={{ padding: "8px 20px", width: 80 }}>
                        <button onClick={() => removeBank(b)} disabled={bankSaving}
                          style={{ padding: "4px 12px", background: "#fff", color: C.danger, border: `1px solid ${C.danger}`, borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                          ✕ Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ padding: "14px 28px", background: "#f8faff", borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.muted, borderRadius: "0 0 14px 14px" }}>
              💡 Changes are saved immediately. All users in your company will see the updated list in their bank dropdown.
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB: PAYMENT METHODS
        ══════════════════════════════════════════ */}
        {tab === "payment" && (
          <div>
            <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 24 }}>
              <div style={{ padding: "20px 28px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.navy }}>💳 Payment Methods</h3>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: C.muted }}>
                    Add bank accounts with QR codes. Users select one when generating a bill — the details print on the bill PDF.
                  </p>
                </div>
                <button onClick={() => setEditingPM(emptyPaymentMethod())}
                  style={{ padding: "9px 20px", background: GRAD.blue, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  + Add Account
                </button>
              </div>

              {paymentMethodMsg && (
                <div style={{ padding: "10px 28px", background: paymentMethodMsg.startsWith("Error") ? "#fff5f5" : "#f0fdf4", color: paymentMethodMsg.startsWith("Error") ? C.danger : C.success, fontSize: 13, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>
                  {paymentMethodMsg}
                </div>
              )}

              {paymentMethodList.length === 0 ? (
                <div style={{ padding: "48px 28px", textAlign: "center", color: C.muted, fontStyle: "italic", fontSize: 14 }}>
                  No payment methods added yet. Click "+ Add Account" to add your first bank account.
                </div>
              ) : (
                <div style={{ padding: "16px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
                  {paymentMethodList.map((pm, i) => (
                    <div key={pm.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", display: "flex", alignItems: "stretch" }}>
                      <div style={{ flex: 1, padding: "14px 18px" }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: C.navy, marginBottom: 4 }}>
                          {pm.bankName || "—"}
                          {pm.branch && <span style={{ fontWeight: 400, fontSize: 13, color: C.muted, marginLeft: 8 }}>· {pm.branch}</span>}
                          {pm.location && <span style={{ fontWeight: 400, fontSize: 12, color: C.muted, marginLeft: 8 }}>📍 {pm.location}</span>}
                        </div>
                        <div style={{ fontSize: 13, color: C.text, display: "flex", gap: 20, flexWrap: "wrap" }}>
                          {pm.accountName   && <span>Name: <strong>{pm.accountName}</strong></span>}
                          {pm.accountNumber && <span>A/C No.: <strong>{pm.accountNumber}</strong></span>}
                          {pm.qrCode        && <span style={{ color: C.success }}>✓ QR attached</span>}
                        </div>
                      </div>
                      {pm.qrCode && (
                        <div style={{ padding: "10px 14px", background: "#fafbfd", borderLeft: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <img src={pm.qrCode} alt="QR" style={{ width: 56, height: 56, objectFit: "contain" }} />
                        </div>
                      )}
                      <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6, justifyContent: "center", borderLeft: `1px solid ${C.border}` }}>
                        <button onClick={() => setEditingPM({ ...pm })}
                          style={{ padding: "5px 14px", border: `1px solid ${C.border}`, borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✏ Edit</button>
                        <button onClick={() => removePM(pm.id)} disabled={paymentMethodSaving}
                          style={{ padding: "5px 14px", border: `1px solid #fcc`, borderRadius: 6, background: "#fff5f5", color: C.danger, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✕ Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Edit / Add modal */}
            {editingPM && (
              <Modal title={paymentMethodList.find(m => m.id === editingPM.id) ? "Edit Payment Method" : "Add Payment Method"} onClose={() => setEditingPM(null)} width={520}>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {[
                    ["bankName",      "Bank Name *",      "text",   "e.g. Nepal Bank Limited"],
                    ["branch",        "Branch",           "text",   "e.g. New Road Branch"],
                    ["location",      "Location",         "text",   "e.g. Kathmandu"],
                    ["accountName",   "Account Name",     "text",   "e.g. Neo Civic Consultant Pvt. Ltd."],
                    ["accountNumber", "Account Number",   "text",   "e.g. 0070100000001234"],
                  ].map(([key, label, type, placeholder]) => (
                    <div key={key}>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 5 }}>{label}</label>
                      <input type={type} value={editingPM[key]} onChange={e => setEditingPM(pm => ({ ...pm, [key]: e.target.value }))}
                        placeholder={placeholder}
                        style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
                    </div>
                  ))}

                  {/* QR upload */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 5 }}>Payment QR Code</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {editingPM.qrCode ? (
                        <div style={{ position: "relative" }}>
                          <img src={editingPM.qrCode} alt="QR preview" style={{ width: 72, height: 72, objectFit: "contain", border: `1.5px solid ${C.border}`, borderRadius: 8 }} />
                          <button onClick={() => setEditingPM(pm => ({ ...pm, qrCode: "" }))}
                            style={{ position: "absolute", top: -7, right: -7, background: C.danger, color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                        </div>
                      ) : (
                        <div style={{ width: 72, height: 72, border: `2px dashed ${C.border}`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 11 }}>QR</div>
                      )}
                      <label style={{ padding: "9px 18px", background: C.navy, color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        {editingPM.qrCode ? "Change QR" : "📷 Upload QR"}
                        <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                          const file = e.target.files[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = ev => setEditingPM(pm => ({ ...pm, qrCode: ev.target.result }));
                          reader.readAsDataURL(file);
                          e.target.value = "";
                        }} />
                      </label>
                      <div style={{ fontSize: 12, color: C.muted }}>PNG, JPG accepted</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                    <button onClick={() => setEditingPM(null)} style={{ padding: "9px 20px", border: `1.5px solid ${C.border}`, borderRadius: 8, background: "#fff", color: C.muted, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
                    <button onClick={saveEditingPM} disabled={!editingPM.bankName.trim() || paymentMethodSaving}
                      style={{ padding: "9px 22px", background: !editingPM.bankName.trim() ? "#ccc" : GRAD.blue, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: !editingPM.bankName.trim() ? "not-allowed" : "pointer" }}>
                      {paymentMethodSaving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              </Modal>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB: FEE TIERS
        ══════════════════════════════════════════ */}
        {tab === "feetiers" && (() => {
          const allBankNames = ["Default", ...bankList];
          const activeTiers = feeTiersMap[feeTierBank] || [];
          return (
            <div>
              {/* Bank selector */}
              <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`, padding: "16px 24px", marginBottom: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.navy, whiteSpace: "nowrap" }}>📐 Fee Schedule for:</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: 1 }}>
                  {allBankNames.map(bk => (
                    <button key={bk} onClick={() => setFeeTierBank(bk)}
                      style={{ padding: "6px 14px", borderRadius: 20, border: `2px solid ${feeTierBank === bk ? "#0f1f3d" : C.border}`, background: feeTierBank === bk ? "#0f1f3d" : "#fff", color: feeTierBank === bk ? "#fff" : C.text, fontWeight: 600, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
                      {bk}
                      {feeTiersMap[bk] && feeTiersMap[bk].length > 0 && (
                        <span style={{ marginLeft: 5, background: feeTierBank === bk ? "rgba(255,255,255,0.3)" : "#e8f0fe", color: feeTierBank === bk ? "#fff" : "#1a73e8", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{feeTiersMap[bk].length}</span>
                      )}
                    </button>
                  ))}
                </div>
                {feeTierMsg && <span style={{ fontSize: 13, fontWeight: 600, color: feeTierMsg.startsWith("✓") ? C.success : "#e74c3c" }}>{feeTierMsg}</span>}
              </div>

              <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 24 }}>
                <div style={{ padding: "14px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.navy }}>
                      {feeTierBank === "Default" ? "🏦 Default Fee Schedule" : `🏦 ${feeTierBank}`}
                    </h3>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted }}>
                      {feeTierBank === "Default"
                        ? "Applied to reports whose bank has no specific schedule configured."
                        : `Applied only when this bank is selected on a report. Falls back to Default if empty.`}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingTier({ ...emptyTier(), _isNew: true, _bank: feeTierBank })}
                    style={{ padding: "8px 18px", background: GRAD.navy, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    + Add Tier
                  </button>
                </div>

                {activeTiers.length === 0 ? (
                  <div style={{ padding: "40px 24px", textAlign: "center", color: C.muted, fontSize: 14 }}>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>📐</div>
                    <p style={{ margin: 0, fontWeight: 600, color: C.text2 }}>No tiers for {feeTierBank}</p>
                    <p style={{ margin: "6px 0 0", fontSize: 12 }}>
                      {feeTierBank === "Default" ? "Using built-in NRB schedule as fallback." : "Will use Default schedule (or built-in NRB if Default is also empty)."}
                    </p>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr>
                          {["#", "Label", "Up To FMV (NPR)", "Base Fee (NPR)", "Rate (%)", "Actions"].map(h => (
                            <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", borderBottom: `1px solid ${C.border}`, background: "#fafbfc", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeTiers.map((t, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? "#fff" : "#fafbfd" }}>
                            <td style={{ padding: "10px 16px", color: C.muted, fontWeight: 600 }}>{i + 1}</td>
                            <td style={{ padding: "10px 16px", fontWeight: 600, color: C.navy }}>{t.label}</td>
                            <td style={{ padding: "10px 16px", color: C.text }}>{t.upto === null || t.upto === "" ? <em style={{ color: C.muted }}>No limit (last tier)</em> : Number(t.upto).toLocaleString("en-NP")}</td>
                            <td style={{ padding: "10px 16px", color: C.text }}>{Number(t.base || 0).toLocaleString("en-NP")}</td>
                            <td style={{ padding: "10px 16px", color: C.text }}>{(Number(t.rate || 0) * 100).toFixed(4).replace(/\.?0+$/, "")}%</td>
                            <td style={{ padding: "10px 16px" }}>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={() => moveTier(feeTierBank, i, -1)} disabled={i === 0} style={{ padding: "4px 8px", border: `1px solid ${C.border}`, borderRadius: 5, background: "#fff", cursor: i === 0 ? "not-allowed" : "pointer", fontSize: 12, opacity: i === 0 ? 0.4 : 1 }}>↑</button>
                                <button onClick={() => moveTier(feeTierBank, i, 1)} disabled={i === activeTiers.length - 1} style={{ padding: "4px 8px", border: `1px solid ${C.border}`, borderRadius: 5, background: "#fff", cursor: i === activeTiers.length - 1 ? "not-allowed" : "pointer", fontSize: 12, opacity: i === activeTiers.length - 1 ? 0.4 : 1 }}>↓</button>
                                <button onClick={() => setEditingTier({ label: t.label, upto: t.upto === null ? "" : String(t.upto), base: String(t.base || ""), rate: String((Number(t.rate || 0) * 100).toFixed(4).replace(/\.?0+$/, "")), _idx: i, _bank: feeTierBank })}
                                  style={{ padding: "4px 10px", border: `1px solid ${C.border}`, borderRadius: 5, background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✏ Edit</button>
                                <button onClick={() => removeTier(feeTierBank, i)} style={{ padding: "4px 10px", border: "1px solid #fca5a5", borderRadius: 5, background: "#fff5f5", color: "#e74c3c", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✕</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ padding: "12px 24px", borderTop: `1px solid ${C.border}`, background: "#f9f9f9", fontSize: 12, color: C.muted }}>
                  <strong>How it works:</strong> Tiers are matched in order by FMV. Tier 1 base fee is a flat minimum. Subsequent tiers: fee = Base + (FMV − prev upper limit) × Rate/100. Leave "Up To" blank for the last open-ended tier. Priority: bank-specific → Default → built-in NRB schedule.
                </div>
              </div>

              {/* Edit / Add tier modal */}
              {editingTier && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(15,31,61,0.65)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9500 }}>
                  <div style={{ background: "#fff", borderRadius: 16, padding: "28px 30px", width: "96%", maxWidth: 440, boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}>
                    <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: C.navy }}>{editingTier._isNew ? "Add Fee Tier" : "Edit Fee Tier"}</h3>
                    <p style={{ margin: "0 0 20px", fontSize: 12, color: C.muted }}>Bank: <strong>{editingTier._bank}</strong></p>
                    {[
                      { key: "label", label: "Label", placeholder: "e.g. 25L – 50L", type: "text" },
                      { key: "upto",  label: "Up To FMV (NPR) — leave blank for last tier", placeholder: "e.g. 5000000", type: "number" },
                      { key: "base",  label: "Base Fee (NPR)", placeholder: "e.g. 7500", type: "number" },
                      { key: "rate",  label: "Rate (%) — e.g. 0.20 for 0.20%", placeholder: "e.g. 0.20", type: "number" },
                    ].map(({ key, label, placeholder, type }) => (
                      <div key={key} style={{ marginBottom: 14 }}>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 5 }}>{label}</label>
                        <input
                          type={type} value={editingTier[key]} placeholder={placeholder}
                          onChange={e => setEditingTier(t => ({ ...t, [key]: e.target.value }))}
                          style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
                        />
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
                      <button onClick={() => setEditingTier(null)} style={{ padding: "9px 20px", border: `1.5px solid ${C.border}`, borderRadius: 8, background: "#fff", color: "#555", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
                      <button onClick={saveEditingTier} disabled={!editingTier.label.trim() || feeTierSaving}
                        style={{ padding: "9px 22px", background: editingTier.label.trim() ? GRAD.navy : "#ccc", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: editingTier.label.trim() ? "pointer" : "not-allowed" }}>
                        {feeTierSaving ? "Saving…" : "Save Tier"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ══════════════════════════════════════════
            TAB: BILLING
        ══════════════════════════════════════════ */}
        {tab === "billing" && (
          <div>
            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Total Reports", value: billingStats?.totalReports ?? "—", gradient: GRAD.navy, icon: "📋" },
                { label: "Total Billed",  value: billingStats ? `NPR ${billingStats.totalBilled.toLocaleString("en-NP")}` : "—", gradient: GRAD.blue,  icon: "🧾" },
                { label: "Total Received", value: billingStats ? `NPR ${billingStats.totalReceived.toLocaleString("en-NP")}` : "—", gradient: GRAD.green, icon: "✅" },
                { label: "Outstanding",  value: billingStats ? `NPR ${billingStats.totalOutstanding.toLocaleString("en-NP")}` : "—", gradient: billingStats?.totalOutstanding > 0 ? GRAD.orange : GRAD.green, icon: "⏳" },
              ].map(({ label, value, gradient, icon }) => (
                <div key={label} style={{ background: gradient, borderRadius: 12, padding: "20px 22px", color: "#fff", position: "relative", overflow: "hidden" }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, opacity: 0.82, textTransform: "uppercase", letterSpacing: "0.6px" }}>{icon} {label}</p>
                  <p style={{ margin: "8px 0 0", fontSize: value?.toString().length > 10 ? 18 : 26, fontWeight: 800, lineHeight: 1 }}>{billingLoading ? "…" : value}</p>
                </div>
              ))}
            </div>

            {/* Per-report table */}
            <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.navy }}>🧾 Billing Details per Report</h3>
                <button onClick={loadBillingStats} disabled={billingLoading}
                  style={{ padding: "7px 16px", border: `1px solid ${C.border}`, borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: C.navy }}>
                  {billingLoading ? "Loading…" : "↺ Refresh"}
                </button>
              </div>
              {!billingStats || billingStats.perReport.length === 0 ? (
                <div style={{ padding: "48px 24px", textAlign: "center", color: C.muted, fontSize: 14, fontStyle: "italic" }}>
                  {billingLoading ? "Loading billing data…" : "No billing data found. Save reports with billing fields to see stats here."}
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        {["#", "Client", "Bank", "Report Date", "FMV (NPR)", "Bill Amount (NPR)", "Received (NPR)", "Outstanding (NPR)"].map(h => (
                          <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", borderBottom: `1px solid ${C.border}`, background: "#fafbfc", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {billingStats.perReport.map((r, i) => (
                        <tr key={r.id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? "#fff" : "#fafbfd" }}>
                          <td style={{ padding: "10px 16px", color: C.muted, fontWeight: 600 }}>{r.id}</td>
                          <td style={{ padding: "10px 16px", fontWeight: 600, color: C.navy }}>{r.clientName}</td>
                          <td style={{ padding: "10px 16px", color: C.text }}>{r.bank}</td>
                          <td style={{ padding: "10px 16px", color: C.muted, whiteSpace: "nowrap" }}>{r.reportDate}</td>
                          <td style={{ padding: "10px 16px", color: C.text }}>{r.fmv > 0 ? r.fmv.toLocaleString("en-NP") : "—"}</td>
                          <td style={{ padding: "10px 16px", fontWeight: 700, color: C.navy }}>{r.grandTotal > 0 ? r.grandTotal.toLocaleString("en-NP") : "—"}</td>
                          <td style={{ padding: "10px 16px", fontWeight: 700, color: r.received > 0 ? C.success : C.muted }}>{r.received > 0 ? r.received.toLocaleString("en-NP") : "—"}</td>
                          <td style={{ padding: "10px 16px", fontWeight: 700, color: r.outstanding > 0 ? "#e67e22" : C.success }}>
                            {r.outstanding > 0 ? r.outstanding.toLocaleString("en-NP") : <span style={{ color: C.success }}>✓ Paid</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "#f0f4ff", borderTop: `2px solid ${C.navy}` }}>
                        <td colSpan={5} style={{ padding: "10px 16px", fontWeight: 700, color: C.navy }}>TOTAL</td>
                        <td style={{ padding: "10px 16px", fontWeight: 800, color: C.navy }}>{billingStats.totalBilled.toLocaleString("en-NP")}</td>
                        <td style={{ padding: "10px 16px", fontWeight: 800, color: C.success }}>{billingStats.totalReceived.toLocaleString("en-NP")}</td>
                        <td style={{ padding: "10px 16px", fontWeight: 800, color: billingStats.totalOutstanding > 0 ? "#e67e22" : C.success }}>
                          {billingStats.totalOutstanding > 0 ? billingStats.totalOutstanding.toLocaleString("en-NP") : "✓ All Paid"}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB: REPORT ANALYTICS
        ══════════════════════════════════════════ */}
        {tab === "reports" && (
          <div>
            {/* Summary KPI cards */}
            {stats && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
                <StatCard label="Total Reports"       value={stats.totals?.total ?? 0}       gradient={GRAD.navy}   icon="📋" />
                <StatCard label="Preliminary Reports" value={stats.totals?.preliminary ?? 0} gradient={GRAD.blue}   icon="📝"
                  onClick={() => setReportSubTab("preliminary")} />
                <StatCard label="Final Reports"       value={stats.totals?.final ?? 0}       gradient={GRAD.green}  icon="✅"
                  onClick={() => setReportSubTab("final")} />
              </div>
            )}

            {/* Sub-tab pills */}
            <div style={{ display: "flex", gap: 6, marginBottom: 18, background: "#fff", borderRadius: 10, padding: 5, boxShadow: "0 1px 6px rgba(0,0,0,0.07)", width: "fit-content" }}>
              {[
                ["all",         "📋", "All Reports"],
                ["preliminary", "📝", "Preliminary"],
                ["bill",        "🧾", "Bill"],
                ["final",       "✅", "Final"],
                ["rejected",    "🚫", "Rejected"],
                ["analysis",    "📊", "Bank / Branch Analysis"],
              ].map(([key, icon, label]) => (
                <button key={key} onClick={() => setReportSubTab(key)} style={{
                  padding: "8px 18px", border: "none", borderRadius: 7, cursor: "pointer",
                  fontSize: 13, fontWeight: 600,
                  background: reportSubTab === key ? GRAD.blue : "transparent",
                  color: reportSubTab === key ? "#fff" : C.muted,
                  boxShadow: reportSubTab === key ? "0 2px 8px rgba(26,115,232,0.3)" : "none",
                  transition: "all 0.18s",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span>{icon}</span>{label}
                </button>
              ))}
            </div>

            {/* ── Bank / Branch Analysis ── */}
            {reportSubTab === "analysis" && (() => {
              const bankMap = {};
              reportList.forEach(r => {
                const bank   = r.bank   || "Unknown Bank";
                const branch = r.branch || "Unknown Branch";
                if (!bankMap[bank]) bankMap[bank] = { total: 0, preliminary: 0, final: 0, bill: 0, rejected: 0, branches: {}, reports: [] };
                bankMap[bank].total++;
                bankMap[bank][r.report_type] = (bankMap[bank][r.report_type] || 0) + 1;
                bankMap[bank].reports.push(r);
                if (!bankMap[bank].branches[branch]) bankMap[bank].branches[branch] = { total: 0, preliminary: 0, final: 0, bill: 0, rejected: 0 };
                bankMap[bank].branches[branch].total++;
                bankMap[bank].branches[branch][r.report_type] = (bankMap[bank].branches[branch][r.report_type] || 0) + 1;
              });
              // merge rejected field submissions into bankMap
              rejectedSubmissions.forEach(s => {
                const bank   = s.bank   || "Unknown Bank";
                const branch = s.branch || "Unknown Branch";
                if (!bankMap[bank]) bankMap[bank] = { total: 0, preliminary: 0, final: 0, bill: 0, rejected: 0, branches: {}, reports: [] };
                bankMap[bank].total++;
                bankMap[bank].rejected++;
                if (!bankMap[bank].branches[branch]) bankMap[bank].branches[branch] = { total: 0, preliminary: 0, final: 0, bill: 0, rejected: 0 };
                bankMap[bank].branches[branch].total++;
                bankMap[bank].branches[branch].rejected++;
              });
              const allBanks = Object.entries(bankMap).sort((a, b) => b[1].total - a[1].total);
              const filteredBanks = bankSearch.trim()
                ? allBanks.filter(([name]) => name.toLowerCase().includes(bankSearch.trim().toLowerCase()))
                : allBanks;
              const maxTotal = allBanks[0]?.[1].total || 1;
              const bankReports = selectedBank ? [
                ...(bankMap[selectedBank]?.reports || []),
                ...rejectedSubmissions
                  .filter(s => (s.bank || "Unknown Bank") === selectedBank)
                  .map(s => ({ _isFieldSub: true, id: s.id, client_name: s.client_name, branch: s.branch, visit_date: s.created_at, report_date: null, created_by: s.submitter_name, updated_at: s.rejected_at, rejection_reason: s.rejection_reason, rejected_by: s.rejected_by_username })),
              ] : [];

              // Overall totals across all banks
              const grandTotal = allBanks.reduce((acc, [, b]) => {
                acc.total       += b.total;
                acc.preliminary += b.preliminary || 0;
                acc.bill        += b.bill        || 0;
                acc.final       += b.final       || 0;
                acc.rejected    += b.rejected    || 0;
                return acc;
              }, { total: 0, preliminary: 0, bill: 0, final: 0, rejected: 0 });

              return (
                <div>
                  {/* Grand total summary cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 16 }}>
                    {[
                      { label: "Total",       value: grandTotal.total,       color: "#0f1f3d", bg: "#eef4ff",  icon: "📋" },
                      { label: "Preliminary", value: grandTotal.preliminary, color: "#1a73e8", bg: "#e8f0fe",  icon: "📝" },
                      { label: "Bill",        value: grandTotal.bill,        color: "#8e44ad", bg: "#f5eef8",  icon: "🧾" },
                      { label: "Final",       value: grandTotal.final,       color: "#27ae60", bg: "#eafaf1",  icon: "✅" },
                      { label: "Rejected",    value: grandTotal.rejected,    color: "#c0392b", bg: "#fdecea",  icon: "🚫" },
                    ].map(({ label, value, color, bg, icon }) => (
                      <div key={label} style={{ background: bg, borderRadius: 12, padding: "14px 18px", border: `1.5px solid ${color}22` }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{icon} {label}</div>
                        <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Header + search */}
                  <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden", marginBottom: selectedBank ? 20 : 0 }}>
                    <div style={{ padding: "16px 24px", borderBottom: `2px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                      <div>
                        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.navy }}>📊 Bank / Branch Analysis</h2>
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: C.muted }}>{allBanks.length} bank{allBanks.length !== 1 ? "s" : ""} · {reportList.length} total reports</p>
                      </div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        {/* Bank search */}
                        <div style={{ position: "relative" }}>
                          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.muted, fontSize: 14 }}>🔍</span>
                          <input
                            type="text"
                            placeholder="Search bank…"
                            value={bankSearch}
                            onChange={e => { setBankSearch(e.target.value); setSelectedBank(null); }}
                            style={{ padding: "8px 12px 8px 32px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, width: 220, outline: "none" }}
                          />
                          {bankSearch && (
                            <button onClick={() => { setBankSearch(""); setSelectedBank(null); }}
                              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 14, lineHeight: 1 }}>✕</button>
                          )}
                        </div>
                        <button onClick={() => { loadStats(); loadReports(reportSearch); setBankSearch(""); setSelectedBank(null); }}
                          style={{ padding: "8px 14px", background: "#f0f2f5", color: C.text, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>↺ Refresh</button>
                      </div>
                    </div>

                    {allBanks.length === 0 ? (
                      <div style={{ padding: 48, textAlign: "center", color: C.muted }}>No report data yet.</div>
                    ) : filteredBanks.length === 0 ? (
                      <div style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>No bank matching "<strong>{bankSearch}</strong>".</div>
                    ) : filteredBanks.map(([bankName, bankData]) => {
                      const branches   = Object.entries(bankData.branches).sort((a, b) => b[1].total - a[1].total);
                      const isExpanded = expandedBanks.has(bankName);
                      const isSelected = selectedBank === bankName;
                      const toggleExpand = () => setExpandedBanks(prev => {
                        const next = new Set(prev);
                        next.has(bankName) ? next.delete(bankName) : next.add(bankName);
                        return next;
                      });
                      return (
                        <div key={bankName} style={{ borderBottom: `1px solid ${C.border}` }}>
                          {/* Bank row */}
                          <div
                            style={{ padding: "13px 20px", background: isExpanded ? "#eef4ff" : "#f8faff", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
                          >
                            {/* Expand toggle */}
                            <button
                              onClick={toggleExpand}
                              title={isExpanded ? "Collapse branches" : "Expand branches"}
                              style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${C.border}`, background: isExpanded ? C.navy : "#fff", color: isExpanded ? "#fff" : C.muted, cursor: "pointer", fontSize: 11, fontWeight: 700, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                            >{isExpanded ? "▲" : "▼"}</button>

                            {/* Bank name + branch count — click to toggle branches */}
                            <div style={{ flex: 1, minWidth: 160, cursor: "pointer" }} onClick={toggleExpand}>
                              <div style={{ fontWeight: 700, fontSize: 14, color: isExpanded ? C.navy : C.navy }}>🏦 {bankName}</div>
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{branches.length} branch{branches.length !== 1 ? "es" : ""}</div>
                            </div>

                            {/* Bar */}
                            <div style={{ flex: 2, minWidth: 160 }}>
                              <div style={{ display: "flex", height: 16, borderRadius: 8, overflow: "hidden", background: "#e8ecf4" }}>
                                <div style={{ width: `${(bankData.preliminary / maxTotal) * 100}%`, background: "#1565c0" }} title={`Preliminary: ${bankData.preliminary}`} />
                                <div style={{ width: `${((bankData.bill || 0) / maxTotal) * 100}%`, background: "#c9922a" }} title={`Bill: ${bankData.bill || 0}`} />
                                <div style={{ width: `${(bankData.final / maxTotal) * 100}%`, background: C.success }} title={`Final: ${bankData.final}`} />
                                <div style={{ width: `${((bankData.rejected || 0) / maxTotal) * 100}%`, background: "#e74c3c" }} title={`Rejected: ${bankData.rejected || 0}`} />
                              </div>
                            </div>

                            {/* Badges */}
                            <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", alignItems: "center" }}>
                              <span style={{ background: "#e8f0fe", color: "#1565c0", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>P: {bankData.preliminary}</span>
                              {bankData.bill > 0 && <span style={{ background: "#fff8ee", color: "#c9922a", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>B: {bankData.bill}</span>}
                              <span style={{ background: "#e8f5e9", color: C.success, borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>F: {bankData.final}</span>
                              {bankData.rejected > 0 && <span style={{ background: "#fdecea", color: "#c0392b", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>🚫: {bankData.rejected}</span>}
                              <span style={{ background: "#f0f2f5", color: C.text, borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>Total: {bankData.total}</span>
                              <button
                                onClick={() => setSelectedBank(isSelected ? null : bankName)}
                                style={{ padding: "3px 10px", background: isSelected ? C.navy : "#fff", color: isSelected ? "#fff" : C.navy, border: `1px solid ${C.navy}`, borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                              >{isSelected ? "✕ Reports" : "Reports"}</button>
                            </div>
                          </div>

                          {/* Branch rows — collapsible */}
                          {isExpanded && branches.map(([branchName, branchData]) => (
                            <div key={branchName} style={{ padding: "8px 20px 8px 56px", display: "flex", alignItems: "center", gap: 12, borderTop: `1px solid ${C.border}`, flexWrap: "wrap", background: "#f9fbff" }}>
                              <div style={{ flex: 1, minWidth: 140, fontSize: 12, color: C.text }}>
                                <span style={{ color: C.muted, marginRight: 6, fontSize: 11 }}>└</span>{branchName}
                              </div>
                              <div style={{ flex: 2, minWidth: 140 }}>
                                <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", background: "#e8ecf4" }}>
                                  <div style={{ width: `${(branchData.preliminary / maxTotal) * 100}%`, background: "#1565c0" }} />
                                  <div style={{ width: `${((branchData.bill || 0) / maxTotal) * 100}%`, background: "#c9922a" }} />
                                  <div style={{ width: `${(branchData.final / maxTotal) * 100}%`, background: C.success }} />
                                  <div style={{ width: `${((branchData.rejected || 0) / maxTotal) * 100}%`, background: "#e74c3c" }} />
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                                <span style={{ background: "#e8f0fe", color: "#1565c0", borderRadius: 4, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>P: {branchData.preliminary}</span>
                                {branchData.bill > 0 && <span style={{ background: "#fff8ee", color: "#c9922a", borderRadius: 4, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>B: {branchData.bill}</span>}
                                <span style={{ background: "#e8f5e9", color: C.success, borderRadius: 4, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>F: {branchData.final}</span>
                                {branchData.rejected > 0 && <span style={{ background: "#fdecea", color: "#c0392b", borderRadius: 4, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>🚫: {branchData.rejected}</span>}
                                <span style={{ background: "#f0f2f5", color: C.text, borderRadius: 4, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{branchData.total}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}

                    <div style={{ padding: "10px 20px", background: "#fafbfd", display: "flex", gap: 16, fontSize: 11, color: C.muted, flexWrap: "wrap", alignItems: "center" }}>
                      <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#1565c0", borderRadius: 2, marginRight: 4, verticalAlign: "middle" }}/>Preliminary</span>
                      <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#c9922a", borderRadius: 2, marginRight: 4, verticalAlign: "middle" }}/>Bill</span>
                      <span><span style={{ display: "inline-block", width: 10, height: 10, background: C.success, borderRadius: 2, marginRight: 4, verticalAlign: "middle" }}/>Final</span>
                      <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#e74c3c", borderRadius: 2, marginRight: 4, verticalAlign: "middle" }}/>Rejected</span>
                      <span style={{ marginLeft: "auto" }}>▼ expand branches · Reports → view report list</span>
                    </div>
                  </div>

                  {/* ── Reports for selected bank ── */}
                  {selectedBank && (
                    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden" }}>
                      <div style={{ padding: "14px 24px", borderBottom: `2px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.navy }}>🏦 {selectedBank} — Reports</h3>
                          <p style={{ margin: "2px 0 0", fontSize: 12, color: C.muted }}>{bankReports.length} record{bankReports.length !== 1 ? "s" : ""} (reports + rejected field submissions)</p>
                        </div>
                        <button onClick={() => setSelectedBank(null)} style={{ background: "#f0f2f5", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: C.muted }}>✕ Close</button>
                      </div>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead>
                            <tr>
                              {["ID", "Client", "Branch", "Type", "Visit Date", "By", "Rejection Reason"].map(h => (
                                <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", borderBottom: `2px solid ${C.border}`, background: "#fafbfd", whiteSpace: "nowrap" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {bankReports.map((r, i) => (
                              <tr key={(r._isFieldSub ? "fs-" : "r-") + r.id} style={{ borderBottom: `1px solid ${C.border}`, background: r._isFieldSub ? (i % 2 === 0 ? "#fff8f8" : "#fff0f0") : (i % 2 === 0 ? "#fff" : "#fafbfd") }}>
                                <td style={{ padding: "8px 12px", color: C.muted, fontWeight: 600, fontSize: 12 }}>{r.id}</td>
                                <td style={{ padding: "8px 12px", fontWeight: 500, fontSize: 12, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.client_name || "—"}</td>
                                <td style={{ padding: "8px 12px", color: C.text, fontSize: 12 }}>{r.branch || "—"}</td>
                                <td style={{ padding: "8px 12px" }}>
                                  {r._isFieldSub ? (
                                    <span style={{ background: "#fdecea", color: "#c0392b", borderRadius: 5, padding: "2px 8px", fontSize: 10, fontWeight: 800 }}>🚫 Rejected</span>
                                  ) : (
                                    <span style={{
                                      background: r.report_type === "preliminary" ? "#e8f0fe" : r.report_type === "bill" ? "#fff8ee" : "#e8f5e9",
                                      color:      r.report_type === "preliminary" ? "#1565c0" : r.report_type === "bill" ? "#c9922a" : C.success,
                                      borderRadius: 5, padding: "2px 8px", fontSize: 10, fontWeight: 800,
                                    }}>
                                      {r.report_type === "preliminary" ? "Prelim" : r.report_type === "bill" ? "Bill" : "Final"}
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: "8px 12px", color: C.muted, fontSize: 12, whiteSpace: "nowrap" }}>{r.visit_date ? fmtLocal(r.visit_date) : "—"}</td>
                                <td style={{ padding: "8px 12px", color: C.navy, fontSize: 12, fontWeight: 600 }}>{r.created_by || "—"}</td>
                                <td style={{ padding: "8px 12px", fontSize: 11 }}>
                                  {r._isFieldSub && r.rejection_reason
                                    ? <span style={{ color: "#c0392b", fontStyle: "italic" }}>⚠ {r.rejection_reason}</span>
                                    : <span style={{ color: C.muted }}>—</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Rejected Field Submissions ── */}
            {reportSubTab === "rejected" && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", borderBottom: `2px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#c0392b" }}>🚫 Rejected Field Submissions</h2>
                  </div>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: C.muted, fontSize: 13, pointerEvents: "none" }}>🔍</span>
                    <input
                      type="text"
                      placeholder="Search client, bank, reason…"
                      value={rejectedSearch}
                      onChange={e => setRejectedSearch(e.target.value)}
                      style={{ paddingLeft: 30, paddingRight: 10, paddingTop: 6, paddingBottom: 6, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, width: 220, outline: "none" }}
                    />
                  </div>
                  <button onClick={loadRejectedSubmissions} disabled={rejectedLoading}
                    style={{ padding: "6px 14px", border: `1px solid ${C.border}`, borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: C.navy, flexShrink: 0 }}>
                    {rejectedLoading ? "…" : "↺"}
                  </button>
                </div>
                {rejectedLoading ? (
                  <div style={{ padding: "40px 24px", textAlign: "center", color: C.muted }}>Loading…</div>
                ) : rejectedSubmissions.length === 0 ? (
                  <div style={{ padding: "48px 24px", textAlign: "center", color: C.muted, fontSize: 14 }}>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
                    No rejected field submissions.
                  </div>
                ) : (() => {
                  const q = rejectedSearch.trim().toLowerCase();
                  const filtered = q
                    ? rejectedSubmissions.filter(s =>
                        (s.client_name || "").toLowerCase().includes(q) ||
                        (s.bank || "").toLowerCase().includes(q) ||
                        (s.branch || "").toLowerCase().includes(q) ||
                        (s.location || "").toLowerCase().includes(q) ||
                        (s.rejected_by_username || "").toLowerCase().includes(q) ||
                        (s.rejection_reason || "").toLowerCase().includes(q) ||
                        (s.submitter_name || "").toLowerCase().includes(q)
                      )
                    : rejectedSubmissions;
                  return filtered.length === 0 ? (
                    <div style={{ padding: "32px 24px", textAlign: "center", color: C.muted, fontSize: 13 }}>No results for "{rejectedSearch}"</div>
                  ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, tableLayout: "fixed" }}>
                    <colgroup>
                      <col style={{ width: "5%" }} />
                      <col style={{ width: "18%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "12%" }} />
                      <col />
                      <col style={{ width: "70px" }} />
                    </colgroup>
                    <thead>
                      <tr style={{ background: "#fafbfd" }}>
                        {["#", "Client", "Bank", "Branch", "Rejected By", "Reason", ""].map(h => (
                          <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", borderBottom: `2px solid ${C.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s, i) => (
                        <tr key={s.id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? "#fff" : "#fff8f8" }}>
                          <td style={{ padding: "7px 10px", color: C.muted, fontSize: 11 }}>{s.id}</td>
                          <td style={{ padding: "7px 10px", fontWeight: 600, color: C.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.client_name || "—"}</td>
                          <td style={{ padding: "7px 10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.bank || "—"}</td>
                          <td style={{ padding: "7px 10px", color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.branch || "—"}</td>
                          <td style={{ padding: "7px 10px", color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.rejected_by_username || "—"}</td>
                          <td style={{ padding: "7px 10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {s.rejection_reason
                              ? <span style={{ color: "#c0392b", fontStyle: "italic", fontSize: 11 }}>⚠ {s.rejection_reason}</span>
                              : <span style={{ color: C.muted, fontStyle: "italic", fontSize: 11 }}>No reason given</span>}
                          </td>
                          <td style={{ padding: "7px 10px" }}>
                            <button
                              onClick={async () => {
                                setViewRejectedSub({ summary: s, detail: null, detailLoading: true });
                                try {
                                  const d = await api.getFieldSubmission(s.id);
                                  setViewRejectedSub(prev => prev?.summary?.id === s.id ? { ...prev, detail: d, detailLoading: false } : prev);
                                } catch {
                                  setViewRejectedSub(prev => prev?.summary?.id === s.id ? { ...prev, detailLoading: false } : prev);
                                }
                              }}
                              style={{ padding: "3px 10px", background: C.navy, color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                            >View</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  );
                })()}
              </div>
            )}

            {/* ── Rejected submission detail modal ── */}
            {viewRejectedSub && (() => {
              const { summary: s, detail: d, detailLoading: dl } = viewRejectedSub;
              const data = d?.data || {};
              const hazardList = (() => {
                const h = data.hazards || {};
                const flags = ["highTensionLine","river","kuloKholchi","floodZone","landslide","graveyard","encroachment"];
                const found = flags.filter(f => h[f]).map(f => f.replace(/([A-Z])/g, " $1").trim());
                return found.length ? found.join(", ") : "None";
              })();
              const rows = [
                ["Owner Name",       data.ownerName || "—"],
                ["Plot No.",         Array.isArray(data.plotNos) && data.plotNos.length ? data.plotNos.join(", ") : (data.plotNo || "—")],
                ["Trace Sheet No.",  data.traceSheetNo || "—"],
                ["Field Visit Date", data.visitDate || "—"],
                ["Market Rate",      data.landMarketRate ? `Rs. ${Number(data.landMarketRate).toLocaleString()} / anna` : "—"],
                ["Road Type",        data.roadType || "—"],
                ["Road Width",       data.roadWidth ? `${data.roadWidth} ft` : "—"],
                ["Hazard",           hazardList],
              ];
              return (
                <div style={{ position: "fixed", inset: 0, background: "rgba(15,31,61,0.55)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }} onClick={() => setViewRejectedSub(null)}>
                  <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 440, boxShadow: "0 24px 64px rgba(0,0,0,0.3)", overflow: "hidden", fontFamily: "'Segoe UI', system-ui, sans-serif", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
                    {/* Header */}
                    <div style={{ background: "linear-gradient(135deg,#c0392b,#e74c3c)", padding: "18px 22px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                      <div>
                        <div style={{ fontSize: 18 }}>🚫</div>
                        <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>
                          Rejected Field Submission
                          <span style={{ fontSize: 11, background: "rgba(255,255,255,0.2)", borderRadius: 10, padding: "2px 8px", marginLeft: 8 }}>#{s.id}</span>
                        </div>
                        {s.submitter_name && <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>Submitted by {s.submitter_name}</div>}
                      </div>
                      <button onClick={() => setViewRejectedSub(null)} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, color: "#fff", width: 32, height: 32, cursor: "pointer", fontSize: 16, fontWeight: 700, flexShrink: 0 }}>✕</button>
                    </div>

                    {/* Body */}
                    <div style={{ overflowY: "auto", flex: 1 }}>
                      <div style={{ padding: "16px 22px" }}>
                        {dl ? (
                          <div style={{ textAlign: "center", padding: "32px 0", color: C.muted }}>Loading details…</div>
                        ) : (
                          <>
                            {rows.map(([label, value]) => (
                              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "9px 0", borderBottom: `1px solid ${C.border}` }}>
                                <span style={{ fontSize: 13, color: C.muted, fontWeight: 600, minWidth: 130 }}>{label}</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: C.navy, textAlign: "right", maxWidth: 240, wordBreak: "break-word" }}>{value}</span>
                              </div>
                            ))}

                            {/* Reason for rejection */}
                            <div style={{ marginTop: 14, background: "#fdecea", border: "1.5px solid #f5c6cb", borderRadius: 10, padding: "12px 16px" }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "#c0392b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Reason for Rejection</div>
                              <div style={{ fontSize: 14, color: "#c0392b", fontWeight: 700, lineHeight: 1.5 }}>
                                {s.rejection_reason || <span style={{ fontStyle: "italic", fontWeight: 400, opacity: 0.7 }}>No reason provided</span>}
                              </div>
                            </div>

                            {/* Photos */}
                            {d?.photos?.length > 0 && (
                              <div style={{ marginTop: 16 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Photos ({d.photos.length})</div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
                                  {d.photos.map((src, i) => (
                                    <img key={i} src={src} alt="" onClick={() => window.open(src, "_blank")}
                                      style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer" }} />
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Report list (All / Preliminary / Bill / Final) ── */}
            {!["analysis", "billing", "rejected"].includes(reportSubTab) && (() => {
              const filtered = reportSubTab === "all"
                ? reportList
                : reportList.filter(r => r.report_type === reportSubTab);

              const tabTitle = reportSubTab === "all"         ? "📋 All Reports"
                             : reportSubTab === "preliminary" ? "📝 Preliminary Reports"
                             : reportSubTab === "bill"        ? "🧾 Bill Reports"
                             :                                  "✅ Final Reports";

              return (
                <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
                  {/* Toolbar */}
                  <div style={{ padding: "18px 24px", borderBottom: `2px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.navy }}>
                        {tabTitle}
                      </h2>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: C.muted }}>{filtered.length} report{filtered.length !== 1 ? "s" : ""}</p>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.muted, fontSize: 14 }}>🔍</span>
                        <input
                          type="text"
                          placeholder="Search client, bank, branch, user…"
                          value={reportSearch}
                          onChange={e => setReportSearch(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && loadReports(reportSearch)}
                          style={{ padding: "8px 12px 8px 32px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, width: 260, outline: "none" }}
                        />
                        {reportSearch && (
                          <button onClick={() => { setReportSearch(""); loadReports(""); }}
                            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 14 }}>✕</button>
                        )}
                      </div>
                      <button onClick={() => loadReports(reportSearch)}
                        style={{ padding: "8px 16px", background: GRAD.blue, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Search</button>
                      <button onClick={() => { loadStats(); loadReports(reportSearch); }}
                        style={{ padding: "8px 14px", background: "#f0f2f5", color: C.text, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>↺ Refresh</button>
                    </div>
                  </div>

                  {reportLoading ? (
                    <div style={{ padding: 48, textAlign: "center", color: C.muted }}>Loading reports…</div>
                  ) : filtered.length === 0 ? (
                    <div style={{ padding: 48, textAlign: "center", color: C.muted }}>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>No reports found.
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            {["#", "Client / Owner", "Bank", "Branch", "T", "Visit", "Report Dt", "By", "Saved", "Prints", "Edits", ""].map(h => (
                              <th key={h} style={{ padding: "7px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.4px", background: "#fafbfd", borderBottom: `2px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((r, i) => {
                            const prelPrints  = r.prints.filter(p => p.print_type === "preliminary");
                            const finalPrints = r.prints.filter(p => p.print_type === "final");
                            const isExpanded  = expandedReport === r.id;
                            return (
                              <React.Fragment key={r.id}>
                                <tr style={{ background: i % 2 === 0 ? "#fff" : "#fafbfd", cursor: r.prints.length > 0 ? "pointer" : "default", fontSize: 12 }}
                                  onClick={() => r.prints.length > 0 && setExpandedReport(isExpanded ? null : r.id)}>
                                  <td style={{ padding: "7px 10px", fontSize: 11, color: C.muted }}>{r.id}</td>
                                  <td style={{ padding: "7px 10px", fontSize: 12, fontWeight: 500, color: C.text, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.client_name || "—"}</td>
                                  <td style={{ padding: "7px 10px", fontSize: 12, color: C.text, whiteSpace: "nowrap" }}>{r.bank || "—"}</td>
                                  <td style={{ padding: "7px 10px", fontSize: 12, color: C.text, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.branch || "—"}</td>
                                  <td style={{ padding: "7px 10px" }}>
                                    <span title={r.report_type} style={{
                                      background: r.report_type === "preliminary" ? "#e8f0fe" : r.report_type === "bill" ? "#fff8ee" : r.report_type === "rejected" ? "#fdecea" : "#e8f5e9",
                                      color:      r.report_type === "preliminary" ? "#1565c0" : r.report_type === "bill" ? "#c9922a" : r.report_type === "rejected" ? "#c0392b" : C.success,
                                      borderRadius: 5, padding: "2px 7px", fontSize: 11, fontWeight: 800,
                                    }}>
                                      {r.report_type === "preliminary" ? "P" : r.report_type === "bill" ? "B" : r.report_type === "rejected" ? "🚫" : "F"}
                                    </span>
                                  </td>
                                  <td style={{ padding: "7px 10px", fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>{r.visit_date || "—"}</td>
                                  <td style={{ padding: "7px 10px", fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>{r.report_date || "—"}</td>
                                  <td style={{ padding: "7px 10px", fontSize: 12, color: C.navy, fontWeight: 600 }}>
                                    {r.created_by ? (
                                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                        <span style={{ width: 18, height: 18, borderRadius: "50%", background: GRAD.blue, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{r.created_by.charAt(0).toUpperCase()}</span>
                                        {r.created_by}
                                      </span>
                                    ) : <span style={{ color: C.muted }}>—</span>}
                                  </td>
                                  <td style={{ padding: "7px 10px", fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>{fmtLocal(r.updated_at)}</td>
                                  <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>
                                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                      {prelPrints.length  > 0 && <span style={{ background: "#e8f0fe", color: "#1565c0", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>P×{prelPrints.length}</span>}
                                      {finalPrints.length > 0 && <span style={{ background: "#e8f5e9", color: C.success, borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>F×{finalPrints.length}</span>}
                                      {r.prints.length === 0 && <span style={{ color: C.muted, fontSize: 11 }}>—</span>}
                                      {r.prints.length > 0 && <span style={{ color: C.muted, fontSize: 11, cursor: "pointer" }}>{isExpanded ? "▲" : "▼"}</span>}
                                    </div>
                                  </td>
                                  <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
                                    <button
                                      onClick={() => {
                                        const next = expandedVersions === r.id ? null : r.id;
                                        setExpandedVersions(next);
                                        if (next && !versionsCache[r.id]) {
                                          setVersionsCache(c => ({ ...c, [r.id]: { loading: true, data: [] } }));
                                          api.getReportVersions(r.id)
                                            .then(d => setVersionsCache(c => ({ ...c, [r.id]: { loading: false, data: d.versions } })))
                                            .catch(() => setVersionsCache(c => ({ ...c, [r.id]: { loading: false, data: [] } })));
                                        }
                                      }}
                                      style={{ background: "#f0f4ff", color: C.navy, border: `1px solid ${C.border}`, borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}
                                    >
                                      {expandedVersions === r.id ? "▲" : "📝"}
                                    </button>
                                  </td>
                                  <td style={{ padding: "7px 10px" }} onClick={e => e.stopPropagation()}>
                                    <div style={{ display: "flex", gap: 6 }}>
                                      {onOpen && (
                                        <button
                                          onClick={() => onOpen(r.id)}
                                          style={{ background: GRAD.blue, color: "#fff", border: "none", borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}
                                        >Open</button>
                                      )}
                                      <button
                                        onClick={() => setDeleteConfirm(r.id)}
                                        style={{ background: GRAD.danger, color: "#fff", border: "none", borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}
                                      >Delete</button>
                                    </div>
                                  </td>
                                </tr>
                                {expandedVersions === r.id && (() => {
                                  const vc = versionsCache[r.id];
                                  return (
                                    <tr>
                                      <td colSpan={13} style={{ padding: "0 10px 10px 32px", background: "#f8f6ff" }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: C.navy, padding: "8px 0 5px", textTransform: "uppercase", letterSpacing: "0.4px" }}>📝 Edit History</div>
                                        {vc?.loading ? (
                                          <div style={{ color: C.muted, fontSize: 12, padding: "8px 0" }}>Loading…</div>
                                        ) : !vc?.data?.length ? (
                                          <div style={{ color: C.muted, fontSize: 12, padding: "8px 0" }}>No edit history recorded yet.</div>
                                        ) : (
                                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                            <thead>
                                              <tr>{["Version", "Edited By", "Client Name", "Bank", "Branch", "Type", "Visit Date", "Report Date", "Saved At", ""].map(h => (
                                                <th key={h} style={{ padding: "5px 10px", textAlign: "left", color: C.muted, fontWeight: 700, textTransform: "uppercase", fontSize: 10, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                                              ))}</tr>
                                            </thead>
                                            <tbody>
                                              {vc.data.map((v, vi) => {
                                                const versionWithIndex = { ...v, listIndex: vi, vNum: vc.data.length - vi };
                                                return (
                                                  <tr key={v.id} style={{ background: vi % 2 === 0 ? "#fff" : "#f5f3ff" }}>
                                                    <td style={{ padding: "6px 10px", color: C.muted, fontWeight: 600 }}>v{versionWithIndex.vNum}</td>
                                                    <td style={{ padding: "6px 10px", fontWeight: 600, color: C.navy }}>
                                                      {v.edited_by ? (
                                                        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                                          <span style={{ width: 18, height: 18, borderRadius: "50%", background: GRAD.purple, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{v.edited_by.charAt(0).toUpperCase()}</span>
                                                          {v.edited_by}
                                                        </span>
                                                      ) : "—"}
                                                    </td>
                                                    <td style={{ padding: "6px 10px" }}>{v.client_name || "—"}</td>
                                                    <td style={{ padding: "6px 10px" }}>{v.bank || "—"}</td>
                                                    <td style={{ padding: "6px 10px" }}>{v.branch || "—"}</td>
                                                    <td style={{ padding: "6px 10px" }}>
                                                      {v.report_type && <span style={{ background: v.report_type === "preliminary" ? "#e8f0fe" : "#e8f5e9", color: v.report_type === "preliminary" ? "#1565c0" : C.success, borderRadius: 4, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{v.report_type}</span>}
                                                    </td>
                                                    <td style={{ padding: "6px 10px", color: C.muted }}>{v.visit_date || "—"}</td>
                                                    <td style={{ padding: "6px 10px", color: C.muted }}>{v.report_date || "—"}</td>
                                                    <td style={{ padding: "6px 10px", color: C.muted }}>{fmtLocal(v.created_at)}</td>
                                                    <td style={{ padding: "6px 10px" }}>
                                                      <button
                                                        onClick={async () => {
                                                          let currentState = null;
                                                          if (vi === 0) {
                                                            try { const res = await api.getReport(r.id); currentState = res.state ?? res; } catch (_) {}
                                                          }
                                                          openDiff(r.id, versionWithIndex, vc.data, currentState);
                                                        }}
                                                        style={{ background: GRAD.teal, color: "#fff", border: "none", borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}
                                                      >View Changes</button>
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })()}
                                {isExpanded && (
                                  <tr>
                                    <td colSpan={13} style={{ padding: "0 10px 10px 32px", background: "#f0f4ff" }}>
                                      <div style={{ fontSize: 11, fontWeight: 700, color: C.navy, padding: "8px 0 5px", textTransform: "uppercase", letterSpacing: "0.4px" }}>🖨 Print / Download History</div>
                                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                        <thead>
                                          <tr>{["User", "Report Type", "Action", "Date & Time"].map(h => (
                                            <th key={h} style={{ padding: "5px 10px", textAlign: "left", color: C.muted, fontWeight: 700, textTransform: "uppercase", fontSize: 10, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                                          ))}</tr>
                                        </thead>
                                        <tbody>
                                          {r.prints.map((p, pi) => (
                                            <tr key={pi} style={{ background: pi % 2 === 0 ? "#fff" : "#f8faff" }}>
                                              <td style={{ padding: "6px 10px", fontWeight: 600, color: C.navy }}>
                                                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                  <span style={{ width: 18, height: 18, borderRadius: "50%", background: GRAD.blue, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{p.username.charAt(0).toUpperCase()}</span>
                                                  {p.username}
                                                </span>
                                              </td>
                                              <td style={{ padding: "6px 10px" }}>
                                                <span style={{ background: p.print_type === "preliminary" ? "#e8f0fe" : "#e8f5e9", color: p.print_type === "preliminary" ? "#1565c0" : C.success, borderRadius: 4, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{p.print_type}</span>
                                              </td>
                                              <td style={{ padding: "6px 10px" }}>
                                                <span style={{ background: p.action === "download" ? "#fff8e1" : "#f3e5f5", color: p.action === "download" ? "#e67e22" : "#8e44ad", borderRadius: 4, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>
                                                  {p.action === "download" ? "⬇ Download" : "🖨 Print"}
                                                </span>
                                              </td>
                                              <td style={{ padding: "6px 10px", color: C.muted }}>{fmtLocal(p.printed_at)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Sub-tab: Billing ── */}
            {reportSubTab === "billing" && (() => {
              const BILL_TYPES = [
                { key: "all",         label: "All",         icon: "📋", color: C.navy,    bg: "#f0f4ff" },
                { key: "preliminary", label: "Preliminary", icon: "📝", color: "#1565c0", bg: "#e8f0fe" },
                { key: "bill",        label: "Bill",        icon: "🧾", color: "#c9922a", bg: "#fff8ee" },
                { key: "final",       label: "Final",       icon: "✅", color: C.success, bg: "#e8f5e9" },
              ];
              const allRows = billingStats?.perReport || [];
              const filtered = billTypeFilter === "all" ? allRows : allRows.filter(r => r.report_type === billTypeFilter);
              const sumBilled      = filtered.reduce((s, r) => s + (r.billed   || 0), 0);
              const sumReceived    = filtered.reduce((s, r) => s + (r.received || 0), 0);
              const sumOutstanding = sumBilled - sumReceived;

              const typeStyle = (t) => ({
                background: t === "preliminary" ? "#e8f0fe" : t === "bill" ? "#fff8ee" : t === "final" ? "#e8f5e9" : "#f0f2f5",
                color:      t === "preliminary" ? "#1565c0" : t === "bill" ? "#c9922a" : t === "final" ? C.success  : C.muted,
              });
              const typeLabel = (t) => t === "preliminary" ? "Prelim" : t === "bill" ? "Bill" : t === "final" ? "Final" : t;

              return (
                <div>
                  {/* Type filter pills */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                    {BILL_TYPES.map(({ key, label, icon }) => {
                      const count = key === "all" ? allRows.length : allRows.filter(r => r.report_type === key).length;
                      const isActive = billTypeFilter === key;
                      return (
                        <button key={key} onClick={() => setBillTypeFilter(key)} style={{
                          padding: "8px 18px", border: "none", borderRadius: 8, cursor: "pointer",
                          fontSize: 13, fontWeight: 600,
                          background: isActive ? GRAD.blue : "#fff",
                          color: isActive ? "#fff" : C.muted,
                          boxShadow: isActive ? "0 2px 8px rgba(26,115,232,0.3)" : "0 1px 4px rgba(0,0,0,0.08)",
                          transition: "all 0.15s",
                          display: "flex", alignItems: "center", gap: 6,
                        }}>
                          {icon} {label}
                          <span style={{ background: isActive ? "rgba(255,255,255,0.25)" : "#f0f2f5", color: isActive ? "#fff" : C.muted, borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>{count}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* KPI summary cards — scoped to filter */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14, marginBottom: 24 }}>
                    {[
                      { label: "Reports",     value: filtered.length,                                                              gradient: GRAD.navy,   icon: "📋" },
                      { label: "Total Billed",  value: billingStats ? `NPR ${sumBilled.toLocaleString("en-NP")}` : "—",           gradient: GRAD.blue,   icon: "🧾" },
                      { label: "Total Received", value: billingStats ? `NPR ${sumReceived.toLocaleString("en-NP")}` : "—",        gradient: GRAD.green,  icon: "✅" },
                      { label: "Outstanding",  value: billingStats ? `NPR ${sumOutstanding.toLocaleString("en-NP")}` : "—",       gradient: sumOutstanding > 0 ? GRAD.orange : GRAD.green, icon: "⏳" },
                    ].map(({ label, value, gradient, icon }) => (
                      <div key={label} style={{ background: gradient, borderRadius: 12, padding: "18px 20px", color: "#fff" }}>
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, opacity: 0.82, textTransform: "uppercase", letterSpacing: "0.6px" }}>{icon} {label}</p>
                        <p style={{ margin: "8px 0 0", fontSize: value?.toString().length > 10 ? 17 : 24, fontWeight: 800, lineHeight: 1 }}>{billingLoading ? "…" : value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Per-report billing table */}
                  <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden" }}>
                    <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.navy }}>
                        🧾 Billing Details
                        {billTypeFilter !== "all" && <span style={{ fontSize: 12, fontWeight: 500, color: C.muted, marginLeft: 8 }}>— {BILL_TYPES.find(t => t.key === billTypeFilter)?.label}</span>}
                      </h3>
                      <button onClick={loadBillingStats} disabled={billingLoading}
                        style={{ padding: "7px 14px", border: `1px solid ${C.border}`, borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: C.navy }}>
                        {billingLoading ? "Loading…" : "↺ Refresh"}
                      </button>
                    </div>
                    {!billingStats || filtered.length === 0 ? (
                      <div style={{ padding: "48px 24px", textAlign: "center", color: C.muted, fontSize: 14, fontStyle: "italic" }}>
                        {billingLoading ? "Loading billing data…" : "No billing records for this filter."}
                      </div>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead>
                            <tr>
                              {["ID", "Client", "Bank", "Branch", "Type", "Bill No.", "Billed (NPR)", "Received (NPR)", "Outstanding (NPR)"].map(h => (
                                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", borderBottom: `2px solid ${C.border}`, background: "#fafbfd", whiteSpace: "nowrap" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((r, i) => {
                              const outstanding = (r.billed || 0) - (r.received || 0);
                              const ts = typeStyle(r.report_type);
                              return (
                                <tr key={r.id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? "#fff" : "#fafbfd" }}>
                                  <td style={{ padding: "10px 14px", color: C.muted, fontWeight: 600 }}>{r.id}</td>
                                  <td style={{ padding: "10px 14px", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.client_name || "—"}</td>
                                  <td style={{ padding: "10px 14px", color: C.text }}>{r.bank || "—"}</td>
                                  <td style={{ padding: "10px 14px", color: C.text }}>{r.branch || "—"}</td>
                                  <td style={{ padding: "10px 14px" }}>
                                    <span style={{ ...ts, borderRadius: 5, padding: "2px 8px", fontSize: 10, fontWeight: 800 }}>{typeLabel(r.report_type)}</span>
                                  </td>
                                  <td style={{ padding: "10px 14px", color: C.muted }}>{r.bill_no || "—"}</td>
                                  <td style={{ padding: "10px 14px", fontWeight: 700, color: C.navy }}>{r.billed ? r.billed.toLocaleString("en-NP") : "—"}</td>
                                  <td style={{ padding: "10px 14px", fontWeight: 600, color: C.success }}>{r.received ? r.received.toLocaleString("en-NP") : "—"}</td>
                                  <td style={{ padding: "10px 14px", fontWeight: 700, color: outstanding > 0 ? "#e67e22" : C.success }}>
                                    {r.billed ? (outstanding > 0 ? outstanding.toLocaleString("en-NP") : "✓ Paid") : "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: "#f0f4ff", borderTop: `2px solid ${C.navy}` }}>
                              <td colSpan={6} style={{ padding: "10px 14px", fontWeight: 700, color: C.navy }}>TOTAL ({filtered.length} report{filtered.length !== 1 ? "s" : ""})</td>
                              <td style={{ padding: "10px 14px", fontWeight: 800, color: C.navy }}>{sumBilled.toLocaleString("en-NP")}</td>
                              <td style={{ padding: "10px 14px", fontWeight: 800, color: C.success }}>{sumReceived.toLocaleString("en-NP")}</td>
                              <td style={{ padding: "10px 14px", fontWeight: 800, color: sumOutstanding > 0 ? "#e67e22" : C.success }}>
                                {sumOutstanding > 0 ? sumOutstanding.toLocaleString("en-NP") : "✓ All Paid"}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB: FIELD DATA
        ══════════════════════════════════════════ */}
        {tab === "field" && (
          <FieldSubmissions
            user={user}
            onUseData={(state) => {
              alert("To use this field data, switch to the Reports view and create a new report. The data has been copied — please open a new report from the main dashboard.");
            }}
          />
        )}

        {/* ══════════════════════════════════════════
            TAB: RATE MAP
        ══════════════════════════════════════════ */}
        {tab === "ratemap" && <RateMapSection rejectedReports={rejectedSubmissions} />}

        {/* ══════════════════════════════════════════
            TAB: REPORT ON MAP
        ══════════════════════════════════════════ */}
        {tab === "reportmap" && <ReportMapSection />}

        {/* ══════════════════════════════════════════
            TAB: FEEDBACK
        ══════════════════════════════════════════ */}
        {tab === "feedback" && <FeedbackSection user={user} />}

        {/* ══════════════════════════════════════════
            TAB: COMPANY PROFILE
        ══════════════════════════════════════════ */}
        {tab === "profile" && profile && (
          <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
            <div style={{
              padding: "18px 24px 16px",
              borderBottom: `2px solid ${C.border}`,
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: GRAD.navy,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20,
              }}>🏢</div>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.navy }}>Company Profile</h2>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: C.muted }}>Update your company's contact information and address</p>
              </div>
            </div>

            <form onSubmit={saveProfile} style={{ padding: "28px 28px 24px" }}>
              {profileMsg === "success" && (
                <div style={{ background: "#e8f5e9", color: C.success, border: "1px solid #a5d6a7", borderRadius: 8, padding: "11px 16px", fontSize: 14, marginBottom: 20, fontWeight: 600 }}>
                  ✓ Company profile saved successfully.
                </div>
              )}
              {profileMsg.startsWith("error:") && (
                <div style={{ background: "#fdecea", color: C.danger, border: "1px solid #f5c6cb", borderRadius: 8, padding: "11px 16px", fontSize: 14, marginBottom: 20 }}>
                  {profileMsg.slice(6)}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <FL label="Company Name" span={2}><Input value={profile.company_name || ""} onChange={setP("company_name")} placeholder="Your company's legal name" /></FL>
                <FL label="Address Line 1"><Input value={profile.address1 || ""} onChange={setP("address1")} placeholder="Street address" /></FL>
                <FL label="Address Line 2"><Input value={profile.address2 || ""} onChange={setP("address2")} placeholder="Suite, floor, etc." /></FL>
                <FL label="City"><Input value={profile.city || ""} onChange={setP("city")} /></FL>
                <FL label="State / Province"><Input value={profile.state || ""} onChange={setP("state")} /></FL>
                <FL label="ZIP / Postal Code"><Input value={profile.zip || ""} onChange={setP("zip")} /></FL>
                <FL label="Country"><Input value={profile.country || ""} onChange={setP("country")} /></FL>
                <FL label="Contact Email"><Input type="email" value={profile.contact_email || ""} onChange={setP("contact_email")} placeholder="contact@company.com" /></FL>
                <FL label="Contact Phone"><Input type="tel" value={profile.contact_phone || ""} onChange={setP("contact_phone")} placeholder="+977-..." /></FL>
              </div>

              {/* ── Bill / Invoice Details ── */}
              <div style={{ marginTop: 24, borderTop: `1.5px solid ${C.border}`, paddingTop: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 4 }}>🧾 Bill / Invoice Details</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>These appear on the Valuation Bill page generated with Final Reports.</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
                  <FL label="PAN / VAT Number"><Input value={profile.pan_vat || ""} onChange={setP("pan_vat")} placeholder="e.g. 123456789" /></FL>
                  <FL label="Bill Prefix"><Input value={profile.bill_prefix || ""} onChange={setP("bill_prefix")} placeholder="e.g. BILL or INV" /></FL>
                  <FL label="Bank Account Details" span={2}>
                    <textarea value={profile.bank_account || ""} onChange={setP("bank_account")} rows={3} placeholder={"Bank Name: Nepal Bank Ltd.\nAccount No.: 1234567890\nBranch: Kathmandu"} style={{ width: "100%", padding: "10px 14px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 14, boxSizing: "border-box", resize: "vertical", fontFamily: "'Segoe UI', sans-serif" }} />
                  </FL>
                </div>
              </div>

              {/* ── Report Color Theme ── */}
              {profile && (() => {
                const currentHex = resolveThemeHex(profile.report_color_theme);
                return (
                  <div style={{ marginTop: 24, borderTop: `1.5px solid ${C.border}`, paddingTop: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>Report Color Theme</div>
                      {themeSaving && <span style={{ fontSize: 12, color: C.muted }}>Saving…</span>}
                      {themeMsg && <span style={{ fontSize: 12, color: themeMsg.startsWith("⚠") ? C.danger : C.success, fontWeight: 600 }}>{themeMsg}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Choose any color — it applies instantly to all generated PDF reports.</div>

                    {/* Color swatch + color wheel trigger */}
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                      <div
                        onClick={() => colorInputRef.current?.click()}
                        title="Open color picker"
                        style={{
                          width: 54, height: 54, borderRadius: 12, background: currentHex,
                          boxShadow: `0 2px 12px ${currentHex}70`,
                          cursor: "pointer", flexShrink: 0,
                        }}
                      />
                      <input
                        ref={colorInputRef}
                        type="color"
                        value={currentHex}
                        onChange={(e) => saveTheme(e.target.value)}
                        style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
                      />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Current Color</div>
                        <div style={{ fontSize: 12, color: C.muted, fontFamily: "monospace", marginTop: 1 }}>{currentHex.toUpperCase()}</div>
                        <div
                          onClick={() => colorInputRef.current?.click()}
                          style={{ fontSize: 12, color: C.blue, cursor: "pointer", marginTop: 4, textDecoration: "underline" }}
                        >Open color wheel</div>
                      </div>
                    </div>

                    {/* Preset swatches */}
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, fontWeight: 600 }}>Quick presets</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {PRESET_COLORS.map(({ label, hex }) => {
                        const isActive = currentHex.toLowerCase() === hex.toLowerCase();
                        return (
                          <button
                            key={hex}
                            type="button"
                            disabled={themeSaving}
                            onClick={() => saveTheme(hex)}
                            title={label}
                            style={{
                              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                              padding: "8px 10px", borderRadius: 8, cursor: themeSaving ? "default" : "pointer",
                              border: isActive ? `2.5px solid ${hex}` : `1.5px solid ${C.border}`,
                              background: isActive ? hex + "18" : "#fff",
                              boxShadow: isActive ? `0 2px 6px ${hex}50` : "none",
                              transition: "all 0.15s", opacity: themeSaving ? 0.7 : 1, minWidth: 52,
                            }}
                          >
                            <div style={{ width: 24, height: 24, borderRadius: 6, background: hex, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                            <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 400, color: isActive ? hex : C.muted }}>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="submit"
                  disabled={profileSaving}
                  style={{
                    background: profileSaving ? "#ccc" : GRAD.blue,
                    color: "#fff", border: "none", borderRadius: 8,
                    padding: "10px 24px", cursor: profileSaving ? "default" : "pointer",
                    fontSize: 14, fontWeight: 700,
                    boxShadow: profileSaving ? "none" : "0 2px 8px rgba(26,115,232,0.3)",
                  }}
                >{profileSaving ? "Saving…" : "Save Changes"}</button>
              </div>
            </form>
          </div>
        )}
        </div>{/* end main content */}
      </div>

      {/* ══════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════ */}
      {(modal === "addUser" || modal === "editUser") && (
        <Modal title={modal === "addUser" ? "Add New User" : `Edit User — ${target?.username}`} onClose={closeModal}>
          {error && (
            <div style={{ background: "#fdecea", color: C.danger, border: "1px solid #f5c6cb", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>{error}</div>
          )}
          <form onSubmit={saveUser}>
            <FL label="Username *"><Input value={form.username || ""} onChange={set("username")} required placeholder="e.g. john.doe" /></FL>
            <FL label="Email"><Input type="email" value={form.email || ""} onChange={set("email")} placeholder="optional" /></FL>
            <FL label={modal === "editUser" ? "New Password (leave blank to keep)" : "Temporary Password *"}>
              <PasswordInput value={form.password || ""} onChange={set("password")} required={modal === "addUser"} placeholder="Min 6 characters" />
            </FL>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button type="button" onClick={closeModal} style={{ background: "#f0f2f5", color: C.text, border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ background: saving ? "#ccc" : GRAD.blue, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", cursor: saving ? "default" : "pointer", fontSize: 13, fontWeight: 700 }}>
                {saving ? "Saving…" : modal === "addUser" ? "Create User" : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "deleteUser" && (
        <Modal title="Delete User" onClose={closeModal} width={420}>
          {error && (
            <div style={{ background: "#fdecea", color: C.danger, border: "1px solid #f5c6cb", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>{error}</div>
          )}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🗑️</div>
            <p style={{ margin: 0, fontSize: 15, color: C.text }}>
              Delete user <strong style={{ color: C.navy }}>{target?.username}</strong>?
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: C.muted }}>This action cannot be undone.</p>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={closeModal} style={{ background: "#f0f2f5", color: C.text, border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Cancel</button>
            <button onClick={deleteUser} disabled={saving} style={{ background: saving ? "#ccc" : GRAD.danger, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", cursor: saving ? "default" : "pointer", fontSize: 13, fontWeight: 700 }}>
              {saving ? "Deleting…" : "Delete User"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
