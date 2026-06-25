import React, { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../../services/api";

// ── Color scale: FMV rate → hue (green=low, yellow=mid, red=high) ────────────
function rateToColor(rate, minRate, maxRate) {
  if (maxRate === minRate) return "#3b82f6";
  const t = Math.max(0, Math.min(1, (rate - minRate) / (maxRate - minRate)));
  // green(120°) → yellow(60°) → red(0°)
  const hue = Math.round(120 - t * 120);
  const sat = 85;
  const lit = 42 + (1 - t) * 12;
  return `hsl(${hue},${sat}%,${lit}%)`;
}

function rateToColorRgb(rate, minRate, maxRate) {
  const hex = rateToColor(rate, minRate, maxRate);
  // parse hsl to rgb for Leaflet
  return hex;
}

// ── Legend gradient ───────────────────────────────────────────────────────────
function Legend({ minRate, maxRate }) {
  const steps = 6;
  return (
    <div style={{
      position: "absolute", bottom: 32, right: 16, zIndex: 1000,
      background: "rgba(255,255,255,0.95)", borderRadius: 10,
      padding: "14px 18px", boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
      fontFamily: "'Segoe UI', sans-serif", minWidth: 160,
    }}>
      <div style={{ fontWeight: 700, fontSize: 12, color: "#333", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        FMV Rate (NPR/Anna)
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {Array.from({ length: steps }, (_, i) => {
          const t = i / (steps - 1);
          const rate = Math.round(minRate + t * (maxRate - minRate));
          const color = rateToColor(rate, minRate, maxRate);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: color, border: "1.5px solid rgba(0,0,0,0.15)", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#444" }}>
                {rate >= 1000000
                  ? (rate / 1000000).toFixed(1) + "M"
                  : rate >= 1000
                  ? (rate / 1000).toFixed(0) + "K"
                  : rate}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 10, borderTop: "1px solid #eee", paddingTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#6366f1", border: "1.5px solid rgba(0,0,0,0.15)", flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "#666" }}>No rate data</span>
        </div>
      </div>
    </div>
  );
}

// ── Stats panel ───────────────────────────────────────────────────────────────
function StatsPanel({ points, filtered }) {
  const rates = filtered.map(p => p.fmvRate).filter(r => r > 0);
  const avg = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;
  const max = rates.length ? Math.max(...rates) : 0;
  const min = rates.length ? Math.min(...rates) : 0;
  const fmt = n => n >= 1000000 ? (n / 1000000).toFixed(2) + "M" : n >= 1000 ? (n / 1000).toFixed(0) + "K" : n;

  return (
    <div style={{
      position: "absolute", top: 16, right: 16, zIndex: 1000,
      background: "rgba(255,255,255,0.97)", borderRadius: 10,
      padding: "14px 18px", boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
      fontFamily: "'Segoe UI', sans-serif", minWidth: 200,
    }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: "#0f1f3d", marginBottom: 10 }}>📊 Map Statistics</div>
      {[
        ["Visible Plots", filtered.length],
        ["With Rate Data", rates.length],
        ["Avg FMV Rate", fmt(avg) + " NPR/Anna"],
        ["Max FMV Rate", fmt(max) + " NPR/Anna"],
        ["Min FMV Rate", fmt(min) + " NPR/Anna"],
      ].map(([label, value]) => (
        <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 5, fontSize: 12 }}>
          <span style={{ color: "#666" }}>{label}</span>
          <span style={{ fontWeight: 600, color: "#0f1f3d" }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Popup content ─────────────────────────────────────────────────────────────
function popupHtml(p) {
  const fmt = n => n ? n.toLocaleString("en-NP") : "—";
  const fmtRate = n => n > 0 ? "NPR " + n.toLocaleString("en-NP") + "/Aana" : "—";
  return `
    <div style="font-family:'Segoe UI',sans-serif;min-width:220px;max-width:280px">
      <div style="background:#0f1f3d;color:#fff;padding:8px 12px;margin:-12px -12px 10px;border-radius:6px 6px 0 0;font-weight:700;font-size:13px">
        📍 ${p.plotNo ? "Plot No. " + p.plotNo : "Property"}
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        ${row("Plot No.", p.plotNo || "—")}
        ${row("Trace Sheet No.", p.traceSheetNo || "—")}
        ${row("Location", p.location || "—")}
        ${row("Owner", p.ownerName || "—")}
        ${row("Land Type", p.landType || "—")}
        ${row("Road Type", p.roadType || "—")}
        ${row("Road Width", p.roadWidth > 0 ? p.roadWidth + " ft" : "—")}
        ${row("FMV Rate", fmtRate(p.fmvRate))}
        ${row("Commercial Rate", fmtRate(p.commercialRate))}
        ${row("Govt. Rate", p.govRate > 0 ? fmtRate(p.govRate) : "—")}
        ${row("Bank", p.bank || "—")}
        ${row("Report Date", p.reportDate || "—")}
        ${row("Company", p.companyCode || "—")}
      </table>
    </div>
  `;
}
function row(label, value) {
  return `<tr>
    <td style="padding:3px 6px;color:#666;font-weight:600;white-space:nowrap">${label}</td>
    <td style="padding:3px 6px;color:#222">${value}</td>
  </tr>`;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ContourMap({ user, companies = [] }) {
  const mapRef      = useRef(null);
  const leafletRef  = useRef(null); // Leaflet map instance
  const markersRef  = useRef([]);   // current marker layer
  const heatLayerRef = useRef(null);

  const [points, setPoints]       = useState([]);
  const [filtered, setFiltered]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [leafletReady, setLeafletReady] = useState(false);

  // Filters
  const [filterCompany, setFilterCompany] = useState("");
  const [filterMinRate, setFilterMinRate] = useState("");
  const [filterMaxRate, setFilterMaxRate] = useState("");
  const [filterRoadMin, setFilterRoadMin] = useState("");
  const [showHeat, setShowHeat]   = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);

  // ── Load Leaflet from CDN ─────────────────────────────────
  useEffect(() => {
    if (window.L) { setLeafletReady(true); return; }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => setLeafletReady(true);
    document.head.appendChild(script);
  }, []);

  // ── Init Leaflet map ──────────────────────────────────────
  useEffect(() => {
    if (!leafletReady || !mapRef.current || leafletRef.current) return;
    const L = window.L;
    const map = L.map(mapRef.current, {
      center: [27.7172, 85.3240], // Kathmandu default
      zoom: 12,
      zoomControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    leafletRef.current = map;
  }, [leafletReady]);

  // ── Fetch data ────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = filterCompany ? { company_code: filterCompany } : {};
      const data = await api.getMapData(params);
      setPoints(data.points || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filterCompany]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Apply filters ─────────────────────────────────────────
  useEffect(() => {
    let f = [...points];
    if (filterMinRate) f = f.filter(p => p.fmvRate >= parseFloat(filterMinRate));
    if (filterMaxRate) f = f.filter(p => p.fmvRate <= parseFloat(filterMaxRate));
    if (filterRoadMin) f = f.filter(p => p.roadWidth >= parseFloat(filterRoadMin));
    setFiltered(f);
  }, [points, filterMinRate, filterMaxRate, filterRoadMin]);

  // ── Render markers on map ─────────────────────────────────
  useEffect(() => {
    const L = window.L;
    const map = leafletRef.current;
    if (!L || !map) return;

    // Remove old markers
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];
    if (heatLayerRef.current) { map.removeLayer(heatLayerRef.current); heatLayerRef.current = null; }

    if (filtered.length === 0) return;

    const rates = filtered.map(p => p.fmvRate).filter(r => r > 0);
    const minRate = rates.length ? Math.min(...rates) : 0;
    const maxRate = rates.length ? Math.max(...rates) : 1;

    // ── Heat circles (contour effect) ──
    if (showHeat) {
      filtered.forEach(p => {
        const color = p.fmvRate > 0
          ? rateToColorRgb(p.fmvRate, minRate, maxRate)
          : "#6366f1";
        const circle = L.circle([p.lat, p.lng], {
          radius: 120,
          color: "transparent",
          fillColor: color,
          fillOpacity: 0.35,
          weight: 0,
        }).addTo(map);
        markersRef.current.push(circle);
      });
    }

    // ── Point markers ──
    if (showMarkers) {
      filtered.forEach(p => {
        const color = p.fmvRate > 0
          ? rateToColorRgb(p.fmvRate, minRate, maxRate)
          : "#6366f1";

        const icon = L.divIcon({
          className: "",
          html: `<div style="
            width:14px;height:14px;border-radius:50%;
            background:${color};
            border:2.5px solid rgba(255,255,255,0.9);
            box-shadow:0 1px 4px rgba(0,0,0,0.4);
            cursor:pointer;
          "></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

        const marker = L.marker([p.lat, p.lng], { icon })
          .bindPopup(popupHtml(p), { maxWidth: 300, className: "contour-popup" })
          .addTo(map);
        markersRef.current.push(marker);
      });
    }

    // Auto-fit bounds
    if (filtered.length > 0) {
      const bounds = L.latLngBounds(filtered.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [filtered, showHeat, showMarkers, leafletReady]);

  const rates = filtered.map(p => p.fmvRate).filter(r => r > 0);
  const minRate = rates.length ? Math.min(...rates) : 0;
  const maxRate = rates.length ? Math.max(...rates) : 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "'Segoe UI', sans-serif" }}>

      {/* ── Toolbar ── */}
      <div style={{
        background: "#0f1f3d", color: "#fff", padding: "10px 20px",
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        borderBottom: "2px solid #1a3160",
      }}>
        <span style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>🗺 Market Rate Contour Map</span>

        {/* Company filter */}
        <select
          value={filterCompany}
          onChange={e => setFilterCompany(e.target.value)}
          style={{ padding: "5px 10px", borderRadius: 6, border: "none", fontSize: 12, minWidth: 160 }}
        >
          <option value="">All Companies</option>
          {companies.filter(c => c.company_code !== "SYSTEM").map(c => (
            <option key={c.company_code} value={c.company_code}>
              {c.company_code} — {c.company_name || "—"}
            </option>
          ))}
        </select>

        {/* Rate range */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, opacity: 0.7 }}>FMV Rate:</span>
          <input type="number" placeholder="Min" value={filterMinRate}
            onChange={e => setFilterMinRate(e.target.value)}
            style={{ width: 80, padding: "4px 8px", borderRadius: 5, border: "none", fontSize: 12 }} />
          <span style={{ opacity: 0.5 }}>–</span>
          <input type="number" placeholder="Max" value={filterMaxRate}
            onChange={e => setFilterMaxRate(e.target.value)}
            style={{ width: 80, padding: "4px 8px", borderRadius: 5, border: "none", fontSize: 12 }} />
        </div>

        {/* Road width filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, opacity: 0.7 }}>Road ≥</span>
          <input type="number" placeholder="ft" value={filterRoadMin}
            onChange={e => setFilterRoadMin(e.target.value)}
            style={{ width: 60, padding: "4px 8px", borderRadius: 5, border: "none", fontSize: 12 }} />
          <span style={{ fontSize: 11, opacity: 0.7 }}>ft</span>
        </div>

        {/* Toggle buttons */}
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={showHeat} onChange={e => setShowHeat(e.target.checked)} />
          Heat overlay
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={showMarkers} onChange={e => setShowMarkers(e.target.checked)} />
          Markers
        </label>

        <button
          onClick={loadData}
          disabled={loading}
          style={{ padding: "5px 14px", background: "#c9922a", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer", marginLeft: "auto" }}
        >
          {loading ? "Loading…" : "↺ Refresh"}
        </button>

        <span style={{ fontSize: 12, opacity: 0.7 }}>
          {filtered.length} plot{filtered.length !== 1 ? "s" : ""} shown
        </span>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ background: "#fdecea", color: "#c0392b", padding: "10px 20px", fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Map container ── */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        {!leafletReady && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f3f8", zIndex: 10, fontSize: 15, color: "#666" }}>
            Loading map…
          </div>
        )}
        {loading && (
          <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 1000, background: "rgba(15,31,61,0.85)", color: "#fff", padding: "8px 20px", borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
            ⏳ Loading plot data…
          </div>
        )}

        <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

        {/* Legend */}
        {filtered.length > 0 && rates.length > 0 && (
          <Legend minRate={minRate} maxRate={maxRate} />
        )}

        {/* Stats panel */}
        {filtered.length > 0 && (
          <StatsPanel points={points} filtered={filtered} />
        )}

        {/* Empty state */}
        {!loading && leafletReady && filtered.length === 0 && points.length === 0 && (
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            zIndex: 1000, background: "rgba(255,255,255,0.95)", borderRadius: 12,
            padding: "28px 36px", textAlign: "center", boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📍</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#0f1f3d", marginBottom: 6 }}>No plot data found</div>
            <div style={{ fontSize: 13, color: "#666" }}>
              Reports need lat/lng coordinates and FMV rates to appear on this map.
            </div>
          </div>
        )}
        {!loading && leafletReady && filtered.length === 0 && points.length > 0 && (
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            zIndex: 1000, background: "rgba(255,255,255,0.95)", borderRadius: 12,
            padding: "20px 28px", textAlign: "center", boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
          }}>
            <div style={{ fontSize: 13, color: "#666" }}>No plots match the current filters.</div>
          </div>
        )}
      </div>

      {/* Popup styles */}
      <style>{`
        .contour-popup .leaflet-popup-content-wrapper {
          border-radius: 8px; padding: 0; overflow: hidden;
          box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        }
        .contour-popup .leaflet-popup-content { margin: 12px; }
        .contour-popup .leaflet-popup-tip { background: #fff; }
      `}</style>
    </div>
  );
}
