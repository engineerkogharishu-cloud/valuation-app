import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { api } from "../services/api";

// ── Helpers ───────────────────────────────────────────────────
function fmtRate(n) {
  if (!n || n === 0) return "—";
  return "NPR " + Number(n).toLocaleString("en-NP") + " / Aana";
}
function msLeft(expiresAt) {
  return Math.max(0, new Date(expiresAt).getTime() - Date.now());
}
function fmtCountdown(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

// ── Rate Detail Panel ─────────────────────────────────────────
function RateDetailPanel({ point, onClose }) {
  if (!point) return null;
  const C = { navy: "#0f1f3d", border: "#dde1e7", muted: "#7f8c8d" };
  const rows = [
    ["Plot No.", point.plotNo || "—"],
    ["Trace Sheet No.", point.traceSheetNo || "—"],
    ["Field Visit Date", point.fieldVisitDate || "—"],
    ["Market Rate", fmtRate(point.marketRate)],
    ["Government Rate", fmtRate(point.govRate)],
    ["Road Type", point.roadType || "—"],
    ["Road Width", point.roadWidth ? point.roadWidth + " ft" : "—"],
    ["Hazard", point.hazard || "None"],
  ];
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,31,61,0.5)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "0 24px 64px rgba(0,0,0,0.3)", overflow: "hidden", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        <div style={{ background: point.isOwn ? "linear-gradient(135deg,#1a73e8,#0d47a1)" : "linear-gradient(135deg,#0f1f3d,#1a3a6b)", padding: "18px 22px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 18 }}>{point.isOwn ? "🔵" : "📍"}</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>Rate Details {point.isOwn && <span style={{ fontSize: 11, background: "rgba(255,255,255,0.2)", borderRadius: 10, padding: "2px 8px", marginLeft: 6 }}>Your Report</span>}</div>
            {point.plotNo && <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>Plot No. {point.plotNo}</div>}
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, color: "#fff", width: 32, height: 32, cursor: "pointer", fontSize: 16, fontWeight: 700 }}>✕</button>
        </div>
        <div style={{ padding: "16px 22px 20px" }}>
          {rows.map(([label, value]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 13, color: C.muted, fontWeight: 600, minWidth: 130 }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.navy, textAlign: "right" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Session start dialog ──────────────────────────────────────
function SessionDialog({ access, onStarted, onClose }) {
  const durations = access.settings?.durations || [{ minutes: 10, credits: 3 }, { minutes: 15, credits: 5 }];
  const [selected, setSelected] = useState(durations[0]?.minutes || 10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const opt = durations.find(o => o.minutes === selected) || durations[0];
  const canAfford = access.free || (access.balance >= (opt?.credits || 0));

  const handleStart = async () => {
    setLoading(true); setError("");
    try {
      const res = await api.startRateMapSession(selected);
      onStarted(res.expires_at);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,31,61,0.6)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "0 24px 64px rgba(0,0,0,0.35)", overflow: "hidden", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        <div style={{ background: "linear-gradient(135deg,#0f1f3d,#1a3a6b)", padding: "22px 26px", color: "#fff" }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>🗺️</div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Rate Entered by Other Users</div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>Select a duration to access the live rate map</div>
        </div>
        <div style={{ padding: "22px 26px" }}>
          {access.free && (
            <div style={{ background: "#e8f5e9", border: "1.5px solid #27ae60", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#1a5c3a", fontWeight: 600, marginBottom: 18 }}>
              ✅ Free Access Enabled by Super Admin — no credits will be deducted.
            </div>
          )}
          {!access.free && (
            <div style={{ background: "#f4f6fa", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 18, display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#7f8c8d" }}>Your Credit Balance</span>
              <span style={{ fontWeight: 700, color: "#0f1f3d" }}>🪙 {access.balance}</span>
            </div>
          )}
          <div style={{ fontSize: 12, fontWeight: 700, color: "#7f8c8d", textTransform: "uppercase", marginBottom: 10 }}>Select Usage Duration</div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${durations.length}, 1fr)`, gap: 12, marginBottom: 20 }}>
            {durations.map(({ minutes, credits }) => {
              const active = selected === minutes;
              const affordable = access.free || access.balance >= credits;
              return (
                <div key={minutes} onClick={() => setSelected(minutes)}
                  style={{ padding: "16px 14px", border: `2px solid ${active ? "#1a73e8" : "#dde1e7"}`, borderRadius: 12, background: active ? "#e8f0fe" : "#fafbfd", cursor: affordable ? "pointer" : "not-allowed", textAlign: "center", opacity: affordable ? 1 : 0.5, transition: "all 0.15s" }}>
                  <div style={{ fontWeight: 700, fontSize: 20, color: active ? "#1a73e8" : "#0f1f3d" }}>⏱ {minutes} min</div>
                  {access.free
                    ? <div style={{ fontSize: 12, marginTop: 4, color: "#27ae60", fontWeight: 600 }}>Free</div>
                    : <div style={{ fontSize: 14, marginTop: 6, color: active ? "#1a73e8" : "#5f6b7a", fontWeight: 700 }}>🪙 {credits} Credits</div>}
                  {!affordable && !access.free && <div style={{ fontSize: 11, color: "#e74c3c", marginTop: 2 }}>Insufficient</div>}
                </div>
              );
            })}
          </div>
          {error && (
            <div style={{ background: "#fff5f5", border: "1px solid #e74c3c", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#c0392b", marginBottom: 14 }}>
              ⚠ {error}
              {(error.includes("expired") || error.includes("Insufficient")) && (
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  Contact: <strong>One Degree Consultant Pvt. Ltd.</strong> —{" "}
                  <a href="mailto:onedegreeconsultant@gmail.com" style={{ color: "#c0392b" }}>onedegreeconsultant@gmail.com</a>{" "}
                  | <a href="tel:9841357433" style={{ color: "#c0392b" }}>9841357433</a>
                </div>
              )}
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} disabled={loading} style={{ flex: 1, padding: "11px", border: "1.5px solid #dde1e7", borderRadius: 9, background: "#fff", color: "#2c3e50", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleStart} disabled={loading || !canAfford}
              style={{ flex: 2, padding: "11px", border: "none", borderRadius: 9, background: canAfford ? "linear-gradient(135deg,#1a73e8,#0d47a1)" : "#ccc", color: "#fff", fontWeight: 700, fontSize: 13, cursor: canAfford && !loading ? "pointer" : "not-allowed", opacity: loading ? 0.7 : 1 }}>
              {loading ? "Starting…" : access.free ? `🗺️ View on Map — ${opt?.minutes} min` : `🗺️ Use for ${opt?.minutes} min — ${opt?.credits} Credits`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Live Leaflet Map ──────────────────────────────────────────
function RateMap({ points, rejectedPoints = [] }) {
  const mapRef     = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef([]);
  const rejMarkersRef = useRef([]);
  const [selected, setSelected] = useState(null);
  const [selectedRej, setSelectedRej] = useState(null);
  const [leafletReady, setLeafletReady] = useState(!!window.L);

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

  useEffect(() => {
    if (!leafletReady || !mapRef.current || leafletRef.current) return;
    const L = window.L;
    const map = L.map(mapRef.current, { center: [27.7172, 85.324], zoom: 12 });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    leafletRef.current = map;
  }, [leafletReady]);

  useEffect(() => {
    if (!leafletRef.current || !window.L) return;
    const L = window.L;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const others = points.filter(p => !p.isOwn);
    const rates  = others.map(p => p.marketRate).filter(r => r > 0);
    const minR = rates.length ? Math.min(...rates) : 0;
    const maxR = rates.length ? Math.max(...rates) : 1;

    for (const p of points) {
      let color;
      if (p.isOwn) {
        color = "#1a73e8"; // own: always blue
      } else {
        const t = maxR > minR ? (p.marketRate - minR) / (maxR - minR) : 0.5;
        const hue = Math.round(120 - t * 120);
        color = `hsl(${hue},85%,42%)`;
      }

      const icon = L.divIcon({
        className: "",
        html: `<div style="width:${p.isOwn ? 18 : 14}px;height:${p.isOwn ? 18 : 14}px;border-radius:50%;background:${color};border:${p.isOwn ? "2.5px solid #fff" : "2px solid rgba(255,255,255,0.85)"};box-shadow:0 2px 6px rgba(0,0,0,0.4);cursor:pointer;${p.isOwn ? "box-shadow:0 0 0 3px rgba(26,115,232,0.35),0 2px 6px rgba(0,0,0,0.4);" : ""}"></div>`,
        iconSize: [p.isOwn ? 18 : 14, p.isOwn ? 18 : 14],
        iconAnchor: [p.isOwn ? 9 : 7, p.isOwn ? 9 : 7],
      });

      const marker = L.marker([p.lat, p.lng], { icon });
      marker.on("click", () => setSelected(p));
      marker.addTo(leafletRef.current);
      markersRef.current.push(marker);
    }

    const allCoords = [...points.map(p => [p.lat, p.lng]), ...rejectedPoints.filter(r => r.lat && r.lng).map(r => [r.lat, r.lng])];
    if (allCoords.length > 0) {
      try {
        const bounds = L.latLngBounds(allCoords);
        leafletRef.current.fitBounds(bounds, { padding: [40, 40] });
      } catch (_) {}
    }
  }, [points, leafletReady]);

  // Rejected markers effect
  useEffect(() => {
    if (!leafletRef.current || !window.L) return;
    const L = window.L;
    rejMarkersRef.current.forEach(m => m.remove());
    rejMarkersRef.current = [];
    for (const r of rejectedPoints) {
      if (!r.lat || !r.lng) continue;
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:22px;height:22px;border-radius:50%;background:#c0392b;border:2.5px solid #fff;box-shadow:0 0 0 3px rgba(192,57,43,0.4),0 2px 8px rgba(0,0,0,0.45);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:11px;line-height:1;">🚫</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const marker = L.marker([r.lat, r.lng], { icon, zIndexOffset: 500 });
      marker.on("click", () => { setSelectedRej(r); setSelected(null); });
      marker.addTo(leafletRef.current);
      rejMarkersRef.current.push(marker);
    }
  }, [rejectedPoints, leafletReady]);

  const ownPts   = points.filter(p => p.isOwn);
  const otherPts = points.filter(p => !p.isOwn);
  const rates    = otherPts.map(p => p.marketRate).filter(r => r > 0);
  const avg      = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 480, borderRadius: 12, overflow: "hidden", border: "1px solid #dde1e7" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

      {/* Stats overlay */}
      <div style={{ position: "absolute", top: 14, right: 14, zIndex: 1000, background: "rgba(255,255,255,0.97)", borderRadius: 10, padding: "12px 16px", boxShadow: "0 4px 16px rgba(0,0,0,0.18)", fontSize: 12, minWidth: 190 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#0f1f3d", marginBottom: 8 }}>📊 Map Statistics</div>
        {[
          ["Your Plots", ownPts.length],
          ["Other Valuators", otherPts.length],
          ["Total Points", points.length],
          ["Avg Market Rate (Others)", avg ? "NPR " + avg.toLocaleString("en-NP") : "—"],
          ...(rejectedPoints.length > 0 ? [["🚫 Rejected (Field)", rejectedPoints.filter(r => r.lat && r.lng).length + " on map"]] : []),
        ].map(([l, v]) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
            <span style={{ color: "#666" }}>{l}</span>
            <span style={{ fontWeight: 600, color: "#0f1f3d" }}>{v}</span>
          </div>
        ))}
        {/* Legend */}
        <div style={{ borderTop: "1px solid #eee", marginTop: 8, paddingTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#1a73e8", border: "2px solid #fff", boxShadow: "0 0 0 2px rgba(26,115,232,0.35)", flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#555" }}>Your reports</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "hsl(60,85%,42%)", border: "2px solid rgba(255,255,255,0.8)", flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#555" }}>Other valuators (green→red by rate)</span>
          </div>
          {rejectedPoints.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#c0392b", border: "2px solid #fff", boxShadow: "0 0 0 2px rgba(192,57,43,0.35)", flexShrink: 0, fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>🚫</div>
              <span style={{ fontSize: 11, color: "#555" }}>Rejected field submissions</span>
            </div>
          )}
        </div>
      </div>

      {points.length > 0 && !selected && !selectedRej && (
        <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", zIndex: 1000, background: "rgba(15,31,61,0.85)", color: "#fff", borderRadius: 20, padding: "6px 18px", fontSize: 12, fontWeight: 600, pointerEvents: "none", whiteSpace: "nowrap" }}>
          Click any point to view rate details
        </div>
      )}

      <RateDetailPanel point={selected} onClose={() => setSelected(null)} />

      {/* Rejected submission detail panel */}
      {selectedRej && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,31,61,0.5)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, padding: 16 }} onClick={() => setSelectedRej(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "0 24px 64px rgba(0,0,0,0.3)", overflow: "hidden", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
            {/* Red header */}
            <div style={{ background: "linear-gradient(135deg,#c0392b,#e74c3c)", padding: "18px 22px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 18 }}>🚫</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>
                  Rejected Field Submission
                  <span style={{ fontSize: 11, background: "rgba(255,255,255,0.2)", borderRadius: 10, padding: "2px 8px", marginLeft: 8 }}>Field Data</span>
                </div>
                {selectedRej.client_name && <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{selectedRej.client_name}</div>}
              </div>
              <button onClick={() => setSelectedRej(null)} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, color: "#fff", width: 32, height: 32, cursor: "pointer", fontSize: 16, fontWeight: 700 }}>✕</button>
            </div>
            {/* Rows */}
            <div style={{ padding: "16px 22px 20px" }}>
              {(() => {
                const fd = selectedRej.fieldData || {};
                const h = fd.hazards || {};
                const flags = ["highTensionLine","river","kuloKholchi","floodZone","landslide","graveyard","encroachment"];
                const hazardList = flags.filter(f => h[f]).map(f => f.replace(/([A-Z])/g, " $1").trim()).join(", ") || "None";
                return [
                  ["Owner Name",      fd.ownerName || null],
                  ["Plot No.",        Array.isArray(fd.plotNos) && fd.plotNos.length ? fd.plotNos.join(", ") : (fd.plotNo || null)],
                  ["Trace Sheet No.", fd.traceSheetNo || null],
                  ["Field Visit Date",fd.visitDate || null],
                  ["Market Rate",     fd.landMarketRate ? `Rs. ${Number(fd.landMarketRate).toLocaleString()} / anna` : null],
                  ["Road Type",       fd.roadType || null],
                  ["Road Width",      fd.roadWidth ? `${fd.roadWidth} ft` : null],
                  ["Hazard",          hazardList],
                  ["Client",          selectedRej.client_name || null],
                  ["Bank",            selectedRej.bank || null],
                  ["Branch",          selectedRej.branch || null],
                  ["Location",        fd.location || selectedRej.location || null],
                  ["GPS",             selectedRej.lat ? `${selectedRej.lat}, ${selectedRej.lng}` : null],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid #dde1e7" }}>
                    <span style={{ fontSize: 13, color: "#7f8c8d", fontWeight: 600, minWidth: 130 }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0f1f3d", textAlign: "right", maxWidth: 230, wordBreak: "break-word" }}>{value}</span>
                  </div>
                ));
              })()}
              {/* Rejection reason — prominent */}
              <div style={{ marginTop: 14, background: "#fdecea", border: "1.5px solid #f5c6cb", borderRadius: 10, padding: "12px 16px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#c0392b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Reason for Rejection</div>
                <div style={{ fontSize: 13, color: "#c0392b", fontWeight: 600, lineHeight: 1.5 }}>
                  {selectedRej.rejection_reason || <span style={{ fontStyle: "italic", opacity: 0.7 }}>No reason provided</span>}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Rejected Reports Panel ────────────────────────────────────
function RejectedPanel({ reports }) {
  const C = { navy: "#0f1f3d", border: "#dde1e7", muted: "#7f8c8d", danger: "#c0392b" };
  const [viewing, setViewing] = useState(null);
  const [search, setSearch] = useState("");

  const openView = async (s) => {
    setViewing({ summary: s, detail: null, loading: true });
    try {
      const d = await api.getFieldSubmission(s.id);
      setViewing(prev => prev?.summary?.id === s.id ? { ...prev, detail: d, loading: false } : prev);
    } catch {
      setViewing(prev => prev?.summary?.id === s.id ? { ...prev, loading: false } : prev);
    }
  };

  if (!reports || reports.length === 0) return (
    <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`, padding: "24px", textAlign: "center", color: C.muted, fontSize: 13 }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
      No rejected field submissions found.
    </div>
  );
  return (
    <div style={{ background: "#fff", borderRadius: 12, border: `1.5px solid #e74c3c`, overflow: "hidden" }}>
      <div style={{ background: "linear-gradient(135deg,#c0392b,#e74c3c)", color: "#fff", padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 16 }}>🚫</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Rejected Field Submissions <span style={{ opacity: 0.75, fontWeight: 400, fontSize: 11 }}>({reports.length})</span></div>
        </div>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12, opacity: 0.7, pointerEvents: "none" }}>🔍</span>
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 26, paddingRight: 8, paddingTop: 5, paddingBottom: 5, border: "none", borderRadius: 6, fontSize: 12, width: 160, background: "rgba(255,255,255,0.2)", color: "#fff", outline: "none" }}
          />
        </div>
      </div>
      {(() => {
        const q = search.trim().toLowerCase();
        const rows = q
          ? reports.filter(r =>
              (r.client_name || "").toLowerCase().includes(q) ||
              (r.bank || "").toLowerCase().includes(q) ||
              (r.branch || "").toLowerCase().includes(q) ||
              (r.rejected_by_username || "").toLowerCase().includes(q) ||
              (r.rejection_reason || "").toLowerCase().includes(q)
            )
          : reports;
        if (rows.length === 0) return (
          <div style={{ padding: "20px", textAlign: "center", color: C.muted, fontSize: 12 }}>No results for "{search}"</div>
        );
        return (
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "5%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "15%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "13%" }} />
          <col />
          <col style={{ width: "60px" }} />
        </colgroup>
        <thead>
          <tr style={{ background: "#fafbfd" }}>
            {["#", "Client", "Bank", "Branch", "Rejected By", "Reason", ""].map(h => (
              <th key={h} style={{ padding: "7px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", borderBottom: `2px solid ${C.border}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? "#fff" : "#fff8f8" }}>
              <td style={{ padding: "6px 10px", color: C.muted, fontSize: 11 }}>{r.id}</td>
              <td style={{ padding: "6px 10px", fontWeight: 600, color: C.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.client_name || "—"}</td>
              <td style={{ padding: "6px 10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.bank || "—"}</td>
              <td style={{ padding: "6px 10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.branch || "—"}</td>
              <td style={{ padding: "6px 10px", color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.rejected_by_username || "—"}</td>
              <td style={{ padding: "6px 10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.rejection_reason
                  ? <span style={{ color: C.danger, fontStyle: "italic", fontSize: 11 }}>⚠ {r.rejection_reason}</span>
                  : <span style={{ color: C.muted, fontStyle: "italic", fontSize: 11 }}>No reason provided</span>}
              </td>
              <td style={{ padding: "6px 10px" }}>
                <button onClick={() => openView(r)}
                  style={{ padding: "3px 10px", background: C.navy, color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
        );
      })()}

      {/* ── Detail modal ── */}
      {viewing && (() => {
        const { summary: s, detail: d, loading: dl } = viewing;
        const data = d?.data || {};
        const fmtDate = (v) => v ? new Date(v).toLocaleString("en-NP") : null;
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
        return createPortal(
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,31,61,0.55)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }} onClick={() => setViewing(null)}>
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
                <button onClick={() => setViewing(null)} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, color: "#fff", width: 32, height: 32, cursor: "pointer", fontSize: 16, fontWeight: 700 }}>✕</button>
              </div>
              {/* Body */}
              <div style={{ overflowY: "auto", flex: 1, padding: "16px 22px" }}>
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
                    <div style={{ marginTop: 14, background: "#fdecea", border: "1.5px solid #f5c6cb", borderRadius: 10, padding: "12px 16px" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.danger, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Reason for Rejection</div>
                      <div style={{ fontSize: 14, color: C.danger, fontWeight: 700, lineHeight: 1.5 }}>
                        {s.rejection_reason || <span style={{ fontStyle: "italic", fontWeight: 400, opacity: 0.7 }}>No reason provided</span>}
                      </div>
                    </div>
                    {d?.photos?.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Photos ({d.photos.length})</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
                          {d.photos.map((src, idx) => (
                            <img key={idx} src={src} alt="" onClick={() => window.open(src, "_blank")}
                              style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer" }} />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
}

// ── Main section ──────────────────────────────────────────────
export default function RateMapSection({ rejectedReports = [] }) {
  const [access, setAccess]               = useState(null);
  const [sessionExpiry, setSessionExpiry] = useState(null);
  const [isTrial, setIsTrial]             = useState(false);
  const [showDialog, setShowDialog]       = useState(false);
  const [points, setPoints]               = useState([]);
  const [loadingPts, setLoadingPts]       = useState(false);
  const [countdown, setCountdown]         = useState(0);
  const [trialStarted, setTrialStarted]   = useState(false);
  const [rejectedPoints, setRejectedPoints] = useState([]);
  const timerRef  = useRef(null);
  const C = { navy: "#0f1f3d", border: "#dde1e7", muted: "#7f8c8d" };

  // Fetch lat/lng for rejected field submissions
  useEffect(() => {
    if (!rejectedReports.length) { setRejectedPoints([]); return; }
    let cancelled = false;
    Promise.all(
      rejectedReports.map(s =>
        api.getFieldSubmission(s.id)
          .then(d => ({ ...s, lat: d?.data?.lat ? parseFloat(d.data.lat) : null, lng: d?.data?.lng ? parseFloat(d.data.lng) : null, fieldData: d?.data || {} }))
          .catch(() => ({ ...s, lat: null, lng: null, fieldData: {} }))
      )
    ).then(results => {
      if (!cancelled) setRejectedPoints(results.filter(r => r.lat && r.lng));
    });
    return () => { cancelled = true; };
  }, [rejectedReports]);

  const loadAccess = useCallback(async () => {
    try {
      const d = await api.getRateMapAccess();
      setAccess(d);
      if (d.active_session) {
        setSessionExpiry(d.active_session.expires_at);
        setCountdown(msLeft(d.active_session.expires_at));
        setIsTrial(d.active_session.credits_used === 0 && !d.free);
      }
    } catch (_) {}
  }, []);

  useEffect(() => { loadAccess(); }, [loadAccess]);

  // Auto-start free trial on first load once access info is available
  useEffect(() => {
    if (!access || trialStarted || access.free || access.active_session) return;
    const trialSecs = access.settings?.free_trial_seconds || 30;
    if (trialSecs <= 0) return;
    setTrialStarted(true);
    api.startRateMapTrial()
      .then(res => {
        setSessionExpiry(res.expires_at);
        setCountdown(msLeft(res.expires_at));
        setIsTrial(true);
        setLoadingPts(true);
        return api.getRateMapPoints();
      })
      .then(d => setPoints(d.points || []))
      .catch(() => {})
      .finally(() => setLoadingPts(false));
  }, [access, trialStarted]);

  // Countdown timer
  useEffect(() => {
    if (!sessionExpiry) return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const left = msLeft(sessionExpiry);
      setCountdown(left);
      if (left === 0) {
        clearInterval(timerRef.current);
        if (isTrial) {
          setSessionExpiry(null);
          setPoints([]);
        }
        loadAccess();
      }
    }, 500);
    return () => clearInterval(timerRef.current);
  }, [sessionExpiry, isTrial, loadAccess]);

  const hasAccess = access?.free || (sessionExpiry && countdown > 0);
  const isTrialActive = isTrial && hasAccess;

  // Load points when paid/free session becomes active
  useEffect(() => {
    if (!hasAccess || points.length > 0 || loadingPts) return;
    setLoadingPts(true);
    api.getRateMapPoints()
      .then(d => setPoints(d.points || []))
      .catch(() => {})
      .finally(() => setLoadingPts(false));
  }, [hasAccess]);

  const handleSessionStarted = async (expires_at) => {
    setSessionExpiry(expires_at);
    setCountdown(msLeft(expires_at));
    setIsTrial(false);
    setShowDialog(false);
    setLoadingPts(true);
    try {
      const d = await api.getRateMapPoints();
      setPoints(d.points || []);
    } catch (_) {}
    finally { setLoadingPts(false); }
  };

  const durations = access?.settings?.durations || [{ minutes: 10, credits: 3 }, { minutes: 15, credits: 5 }];
  const trialSecs = access?.settings?.free_trial_seconds || 30;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "calc(100vh - 200px)", minHeight: 620 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.navy }}>🗺️ Rate Entered by Other Users</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.muted }}>Counter map of market rates by other valuators. 🔵 = Your reports &nbsp;|&nbsp; 🟢→🔴 = Others (by rate)</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {/* Status badges */}
          {access?.free ? (
            <span style={{ background: "#e8f5e9", color: "#1a5c3a", border: "1.5px solid #27ae60", borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 700 }}>✅ Free Access</span>
          ) : isTrialActive ? (
            <span style={{ background: countdown < 10000 ? "#fff5f5" : "#fff8e1", color: countdown < 10000 ? "#e74c3c" : "#7a5c00", border: `1.5px solid ${countdown < 10000 ? "#e74c3c" : "#f39c12"}`, borderRadius: 20, padding: "5px 14px", fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              ⏱ Free Trial: {fmtCountdown(countdown)}
            </span>
          ) : sessionExpiry && countdown > 0 ? (
            <span style={{ background: countdown < 60000 ? "#fff5f5" : "#e8f0fe", color: countdown < 60000 ? "#e74c3c" : "#1a73e8", border: `1.5px solid ${countdown < 60000 ? "#e74c3c" : "#1a73e8"}`, borderRadius: 20, padding: "5px 14px", fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              ⏱ {fmtCountdown(countdown)} remaining
            </span>
          ) : null}
          {/* Action buttons */}
          {!access?.free && (!hasAccess || isTrialActive) && (
            <button onClick={() => setShowDialog(true)} style={{ padding: "9px 20px", background: "linear-gradient(135deg,#1a73e8,#0d47a1)", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              🗺️ View on Map
            </button>
          )}
          {hasAccess && (
            <button onClick={() => { setLoadingPts(true); api.getRateMapPoints().then(d => setPoints(d.points || [])).catch(() => {}).finally(() => setLoadingPts(false)); }}
              disabled={loadingPts} style={{ padding: "8px 16px", background: "#f0f2f5", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              ↺ Refresh
            </button>
          )}
        </div>
      </div>

      {/* Pricing cards — shown when no paid session and trial not active */}
      {!access?.free && (!hasAccess || isTrialActive) && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${durations.length}, 1fr)`, gap: 14 }}>
          {durations.map(({ minutes, credits }) => (
            <div key={minutes} onClick={() => setShowDialog(true)} style={{ padding: "18px 20px", borderRadius: 14, border: "2px solid #dde1e7", background: "#fafbfd", textAlign: "center", cursor: "pointer", transition: "border-color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#1a73e8"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#dde1e7"}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>⏱</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: C.navy }}>Use for {minutes} Minutes</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1a73e8", margin: "8px 0" }}>🪙 {credits} Credits</div>
              <div style={{ fontSize: 12, color: C.muted }}>Full rate map access for {minutes} min</div>
            </div>
          ))}
          {trialSecs > 0 && (
            <div style={{ padding: "18px 20px", borderRadius: 14, border: "2px solid #f39c12", background: "#fffbea", textAlign: "center", gridColumn: durations.length > 1 ? "span 2" : "auto" }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>🎁</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#7a5c00" }}>Free Preview</div>
              <div style={{ fontSize: 13, color: "#7a5c00", margin: "6px 0" }}>{trialSecs} seconds — auto-started on load</div>
            </div>
          )}
        </div>
      )}

      {/* Map / locked state */}
      {hasAccess ? (
        loadingPts ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#fafbfd", borderRadius: 14, border: "2px dashed #dde1e7", color: C.muted, fontSize: 15, fontWeight: 600 }}>
            ⏳ Loading rate points…
          </div>
        ) : (
          <RateMap points={points} rejectedPoints={rejectedPoints} />
        )
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#fafbfd", borderRadius: 14, border: "2px dashed #dde1e7", color: C.muted, gap: 12 }}>
          <div style={{ fontSize: 52 }}>🔒</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.navy }}>Trial Expired</div>
          <div style={{ fontSize: 13, textAlign: "center", maxWidth: 340 }}>
            Your {trialSecs}-second free preview has ended. Select a paid duration to continue viewing rates.
          </div>
          <button onClick={() => setShowDialog(true)} style={{ marginTop: 8, padding: "11px 28px", background: "linear-gradient(135deg,#1a73e8,#0d47a1)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            🗺️ View on Map
          </button>
        </div>
      )}

      {showDialog && access && (
        <SessionDialog access={access} onStarted={handleSessionStarted} onClose={() => setShowDialog(false)} />
      )}
    </div>
  );
}
