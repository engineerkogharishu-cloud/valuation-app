import React, { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = (import.meta.env.VITE_API_URL || "") + "/api";

// ── Inline OLC encoder (lat/lng → Plus Code) ──────────────────
const OLC_ALPHABET = "23456789CFGHJMPQRVWX";
function encodePlusCode(lat, lng) {
  lat = Math.max(-90,  Math.min( 90, lat));
  lng = Math.max(-180, Math.min(180, lng));
  let tmpLat = lat + 90, tmpLng = lng + 180;
  let div = 400;
  const chars = [];
  for (let p = 0; p < 5; p++) {
    div /= 20;
    const ld = Math.floor(tmpLat / div);
    const nd = Math.floor(tmpLng / div);
    chars.push(OLC_ALPHABET[ld]);
    chars.push(OLC_ALPHABET[nd]);
    tmpLat -= ld * div;
    tmpLng -= nd * div;
  }
  chars.splice(8, 0, "+");
  return chars.join("");
}

// ── Photo compression — iterative, targets < 200 KB ──────────
async function compressPhoto(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const scale = Math.min(MAX / width, MAX / height);
          width  = Math.round(width  * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);

        // Iteratively reduce quality until < 200 KB
        const TARGET_BYTES = 200 * 1024;
        let quality = 0.85;
        let dataUrl;
        do {
          dataUrl = canvas.toDataURL("image/jpeg", quality);
          // base64: approx 0.75 bytes per char minus header
          const approxBytes = Math.round((dataUrl.length - 22) * 0.75);
          if (approxBytes <= TARGET_BYTES || quality <= 0.40) break;
          quality = Math.max(0.40, quality - 0.05);
        } while (true); // eslint-disable-line no-constant-condition

        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Offline queue helpers (localStorage) ─────────────────────
const QUEUE_PREFIX = "field_queue_";

function readQueue() {
  const items = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(QUEUE_PREFIX)) {
      try { items.push({ key: k, ...JSON.parse(localStorage.getItem(k)) }); }
      catch (_) {}
    }
  }
  return items;
}

function queueCount() {
  let n = 0;
  for (let i = 0; i < localStorage.length; i++) {
    if ((localStorage.key(i) || "").startsWith(QUEUE_PREFIX)) n++;
  }
  return n;
}

function saveToQueue(token, payload) {
  const key = QUEUE_PREFIX + token + "_" + Date.now();
  localStorage.setItem(key, JSON.stringify({ token, payload, savedAt: new Date().toISOString() }));
  return key;
}

async function flushQueue() {
  const items = readQueue();
  let sent = 0;
  for (const item of items) {
    try {
      const res = await fetch(`${API_BASE}/field/submit`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(item.payload),
      });
      if (res.ok) { localStorage.removeItem(item.key); sent++; }
    } catch (_) { /* keep for next attempt */ }
  }
  return sent;
}

export default function MobileCollectPage({ token }) {
  const [companyName, setCompanyName] = useState("");
  const [banks,       setBanks]       = useState([]);
  const [tokenError,  setTokenError]  = useState("");
  const [shareCopied, setShareCopied] = useState(false);

  // ── Offline state ─────────────────────────────────────────
  const [isOnline,     setIsOnline]     = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(queueCount);
  const [syncToast,    setSyncToast]    = useState("");

  const updatePending = () => setPendingCount(queueCount());

  const attemptFlush = useCallback(async () => {
    const sent = await flushQueue();
    if (sent > 0) {
      setSyncToast(`✅ ${sent} queued submission${sent > 1 ? "s" : ""} sent successfully`);
      setTimeout(() => setSyncToast(""), 4000);
      updatePending();
    }
  }, []);

  useEffect(() => {
    const goOnline  = () => { setIsOnline(true);  attemptFlush(); };
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    if (navigator.onLine) attemptFlush();
    return () => {
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [attemptFlush]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: "Field Data Collection", text: `Fill in field data for ${companyName}`, url }); }
      catch (_) {}
    } else {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    }
  };

  const todayISO = () => new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    submitterName: "", clientName: "", ownerName: "", location: "",
    bank: "", branch: "", visitDate: todayISO(), notes: "", lat: "", lng: "", googlePlusCode: "",
    landMarketRate: "", buildingRate: "",
  });

  const EMPTY_HAZARDS = {
    highTensionLine: false, highTensionLineComment: "", highTensionLineDistance: "", highTensionLineSide: "",
    river:           false, riverComment:           "", riverDistance:           "", riverSide:           "",
    kuloKholchi:     false, kuloKholchiComment:     "", kuloKholchiDistance:     "", kuloKholchiSide:     "",
    floodZone:       false, floodZoneComment:       "",
    landslide:       false, landslideComment:       "", landslideDistance:       "", landslideSide:       "",
    graveyard:       false, graveyardComment:       "", graveyardDistance:       "", graveyardSide:       "",
    encroachment:    false, encroachmentComment:    "", encroachmentSide:        "",
  };
  const [hazards, setHazards] = useState(EMPTY_HAZARDS);
  const toggleHazard  = (k)    => setHazards((h) => ({ ...h, [k]: !h[k] }));
  const setHazardNote = (k, v) => setHazards((h) => ({ ...h, [k]: v }));

  const [plotNos, setPlotNos] = useState([""]);

  const EMPTY_ROAD = { type: "", width: "", side: "", surface: "", remarks: "" };
  const [roads, setRoads] = useState([{ ...EMPTY_ROAD }]);
  const addRoad      = () => setRoads((r) => [...r, { ...EMPTY_ROAD }]);
  const removeRoad   = (i) => setRoads((r) => r.filter((_, idx) => idx !== i));
  const setRoadField = (i, k, v) => setRoads((r) => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row));

  const [photos,      setPhotos]      = useState([]);
  const [compressing, setCompressing] = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [gpsLoading,  setGpsLoading]  = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    fetch(`${API_BASE}/field/company-info?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setTokenError(d.error);
        else {
          setCompanyName(d.companyName || d.companyCode || "");
          setBanks(Array.isArray(d.banks) ? d.banks : []);
        }
      })
      .catch(() => {
        if (!navigator.onLine) setCompanyName("");
        else setTokenError("Could not verify link. Check your internet connection.");
      });
  }, [token]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const setPlotNo    = (i, val) => setPlotNos((p) => p.map((v, idx) => idx === i ? val : v));
  const addPlotNo    = () => setPlotNos((p) => [...p, ""]);
  const removePlotNo = (i) => setPlotNos((p) => p.filter((_, idx) => idx !== i));

  const handlePhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setCompressing(true);
    const compressed = await Promise.all(files.map(compressPhoto));
    setPhotos((prev) => [...prev, ...compressed].slice(0, 20));
    e.target.value = "";
    setCompressing(false);
  };

  const removePhoto = (i) => setPhotos((p) => p.filter((_, idx) => idx !== i));

  const getGPS = () => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setForm((f) => ({ ...f, lat: lat.toFixed(6), lng: lng.toFixed(6), googlePlusCode: encodePlusCode(lat, lng) }));
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const buildPayload = () => ({
    token,
    data: {
      ...form,
      plotNos: plotNos.map((p) => p.trim()).filter(Boolean),
      roads:   roads.filter((r) => r.type || r.width || r.side || r.surface || r.remarks),
      hazards,
    },
    photos,
  });

  const handleShareData = async () => {
    const payload  = buildPayload();
    const filename = `field-data-${form.clientName.replace(/\s+/g,"-")||"entry"}-${Date.now()}.json`;
    const json     = JSON.stringify(payload, null, 2);
    const blob     = new Blob([json], { type: "application/json" });
    const file     = new File([blob], filename, { type: "application/json" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ title: "Field Data — " + (form.clientName || form.location || "Entry"), text: `Field data collected for ${companyName}`, files: [file] }); return; }
      catch (_) {}
    }
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = filename; link.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.clientName.trim() && !form.location.trim())
      return setSubmitError("Please enter at least a client name or location.");
    setSubmitting(true);
    setSubmitError("");
    const payload = buildPayload();

    // ── Offline: queue it ─────────────────────────────────
    if (!navigator.onLine) {
      saveToQueue(token, payload);
      updatePending();
      setSubmitting(false);
      setSubmitted(true);
      return;
    }

    // ── Online: submit directly ───────────────────────────
    try {
      const res  = await fetch(`${API_BASE}/field/submit`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Submission failed");
      setSubmitted(true);
    } catch (err) {
      if (!navigator.onLine || err.message === "Failed to fetch") {
        saveToQueue(token, payload);
        updatePending();
        setSubmitted(true);
      } else {
        setSubmitError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm({ submitterName: "", clientName: "", ownerName: "", location: "", bank: "", branch: "", visitDate: todayISO(), notes: "", lat: "", lng: "", googlePlusCode: "", landMarketRate: "", buildingRate: "" });
    setHazards(EMPTY_HAZARDS);
    setPlotNos([""]);
    setRoads([{ ...EMPTY_ROAD }]);
    setPhotos([]);
    setSubmitted(false);
    setSubmitError("");
  };

  // ── Render ────────────────────────────────────────────────

  if (tokenError && isOnline) return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.errorBox}>{tokenError}</div>
        <p style={{ color: "#666", fontSize: 14, textAlign: "center" }}>
          Ask your admin to generate a new collection link.
        </p>
      </div>
    </div>
  );

  const savedOffline = submitted && !isOnline;

  if (submitted) return (
    <div style={S.page}>
      {!isOnline && <OfflineBanner pendingCount={pendingCount} />}
      <div style={{ ...S.card, textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>{savedOffline ? "💾" : "✅"}</div>
        <h2 style={{ color: savedOffline ? "#0f1f3d" : "#1a7a3f", margin: "0 0 8px" }}>
          {savedOffline ? "Saved Offline" : "Submitted!"}
        </h2>
        <p style={{ color: "#555", fontSize: 15 }}>
          {savedOffline
            ? "Your data is saved on this device. It will be sent automatically when you reconnect."
            : `Your field data has been sent to ${companyName}.`}
        </p>
        {pendingCount > 0 && (
          <div style={S.pendingBadge}>
            💾 {pendingCount} submission{pendingCount > 1 ? "s" : ""} queued — will send when online
          </div>
        )}
        <button style={S.btnSecondary} onClick={resetForm}>Submit Another</button>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      {!isOnline && <OfflineBanner pendingCount={pendingCount} />}
      {syncToast && <div style={S.syncToast}>{syncToast}</div>}

      <div style={S.header}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>📋 Field Data Collection</div>
          {companyName && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>{companyName}</div>}
        </div>
        <button type="button" onClick={handleShare} style={S.btnShare}>
          {shareCopied ? "✓ Copied!" : "🔗 Share"}
        </button>
      </div>

      {pendingCount > 0 && isOnline && (
        <div style={{ background: "#fff3cd", borderBottom: "1px solid #ffc107", padding: "10px 20px", fontSize: 13, color: "#7a5000" }}>
          ⏳ Sending {pendingCount} queued submission{pendingCount > 1 ? "s" : ""}…
        </div>
      )}

      <form onSubmit={handleSubmit} style={S.card}>

        <Field label="Your Name (Collector)">
          <input style={S.input} value={form.submitterName} onChange={set("submitterName")}
            placeholder="Enter your name" autoComplete="name" />
        </Field>

        <Field label="Client / Borrower Name *">
          <input style={S.input} value={form.clientName} onChange={set("clientName")}
            placeholder="Full name of client" autoComplete="off" />
        </Field>

        <Field label="Owner Name">
          <input style={S.input} value={form.ownerName} onChange={set("ownerName")}
            placeholder="Property owner name (if different from client)" autoComplete="off" />
        </Field>

        <Field label="Bank">
          {banks.length > 0 ? (
            <select style={S.select} value={form.bank} onChange={set("bank")}>
              <option value="">— Select bank —</option>
              {banks.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          ) : (
            <input style={S.input} value={form.bank} onChange={set("bank")}
              placeholder="Bank name (if applicable)" autoComplete="off" />
          )}
        </Field>

        <Field label="Branch">
          <input style={S.input} value={form.branch} onChange={set("branch")}
            placeholder="Branch name (if applicable)" autoComplete="off" />
        </Field>

        <Field label="Visit Date">
          <input style={S.input} type="date" value={form.visitDate} onChange={set("visitDate")} />
        </Field>

        <Field label="Property Location / Address *">
          <input style={S.input} value={form.location} onChange={set("location")}
            placeholder="Ward, VDC/Municipality, District" autoComplete="off" />
        </Field>

        <div style={{ marginBottom: 18 }}>
          <label style={S.label}>Plot Number(s)</label>
          {plotNos.map((val, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <input
                style={{ ...S.input, flex: 1, marginBottom: 0 }}
                value={val}
                onChange={(e) => setPlotNo(i, e.target.value)}
                placeholder={`Kitta / Plot No. ${plotNos.length > 1 ? i + 1 : ""}`}
                autoComplete="off"
              />
              {plotNos.length > 1 && (
                <button type="button" onClick={() => removePlotNo(i)} style={S.btnRemovePlot}>✕</button>
              )}
            </div>
          ))}
          <button type="button" onClick={addPlotNo} style={S.btnAddPlot}>＋ Add Plot Number</button>
        </div>

        <div style={S.roadBox}>
          <div style={S.rateTitle}>🛣️ Road Details</div>
          {roads.map((road, i) => {
            const ROAD_TYPES    = ["Pitched / Black Topped", "Graveled", "Earthen / Kachchi", "Goreto / Footpath", "Under Construction"];
            const ROAD_SURFACES = ["Good", "Fair", "Poor"];
            const ROAD_SIDES    = ["North","South","East","West","North-East","North-West","South-East","South-West"];
            return (
              <div key={i} style={{ border: "1.5px solid #c8dff0", borderRadius: 8, padding: "12px 12px 10px", marginBottom: 10, background: "#f4f9ff", position: "relative" }}>
                {roads.length > 1 && (
                  <button type="button" onClick={() => removeRoad(i)}
                    style={{ position: "absolute", top: 8, right: 8, padding: "4px 9px", background: "#fff0f0", color: "#c0392b", border: "1px solid #f5c6c6", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✕</button>
                )}
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0f1f3d", marginBottom: 10 }}>Road {roads.length > 1 ? i + 1 : ""}</div>
                <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={S.subLabel}>TYPE</div>
                    <select style={{ ...S.select, fontSize: 13 }} value={road.type} onChange={(e) => setRoadField(i, "type", e.target.value)}>
                      <option value="">— Select —</option>
                      {ROAD_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={S.subLabel}>SIDE</div>
                    <select style={{ ...S.select, fontSize: 13 }} value={road.side} onChange={(e) => setRoadField(i, "side", e.target.value)}>
                      <option value="">— Select —</option>
                      {ROAD_SIDES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={S.subLabel}>WIDTH (ft)</div>
                    <input style={{ ...S.input, fontSize: 13 }} type="number" min="0" value={road.width}
                      onChange={(e) => setRoadField(i, "width", e.target.value)} placeholder="e.g. 20" autoComplete="off" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={S.subLabel}>SURFACE CONDITION</div>
                    <select style={{ ...S.select, fontSize: 13 }} value={road.surface} onChange={(e) => setRoadField(i, "surface", e.target.value)}>
                      <option value="">— Select —</option>
                      {ROAD_SURFACES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <div style={S.subLabel}>REMARKS</div>
                  <input style={{ ...S.input, fontSize: 13 }} value={road.remarks}
                    onChange={(e) => setRoadField(i, "remarks", e.target.value)}
                    placeholder="Additional remarks…" autoComplete="off" />
                </div>
              </div>
            );
          })}
          <button type="button" onClick={addRoad} style={S.btnAddPlot}>＋ Add Another Road</button>
        </div>

        <div style={S.rateBox}>
          <div style={S.rateTitle}>📊 Market Rates</div>
          <div style={S.rateRow}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Land Market Rate <span style={S.unit}>(Rs. / aana)</span></label>
              <input style={S.input} type="number" min="0" value={form.landMarketRate}
                onChange={set("landMarketRate")} placeholder="0" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Building Rate <span style={S.unit}>(Rs. / sq.ft)</span></label>
              <input style={S.input} type="number" min="0" value={form.buildingRate}
                onChange={set("buildingRate")} placeholder="0" />
            </div>
          </div>
        </div>

        <Field label="GPS Coordinates">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input style={{ ...S.input, flex: 1 }} value={form.lat ? `${form.lat}, ${form.lng}` : ""}
              placeholder="Tap Get GPS" readOnly />
            <button type="button" style={S.btnGps} onClick={getGPS} disabled={gpsLoading}>
              {gpsLoading ? "…" : "📍 GPS"}
            </button>
          </div>
        </Field>

        <Field label="Google Plus Code">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              style={{ ...S.input, flex: 1, fontFamily: "monospace", letterSpacing: "0.5px" }}
              value={form.googlePlusCode}
              onChange={set("googlePlusCode")}
              placeholder="e.g. P977+95 Kathmandu (auto-filled by GPS)"
              autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false}
            />
            {form.lat && !form.googlePlusCode && (
              <button type="button" style={S.btnGps}
                onClick={() => setForm((f) => ({ ...f, googlePlusCode: encodePlusCode(parseFloat(f.lat), parseFloat(f.lng)) }))}>
                Generate
              </button>
            )}
          </div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
            Auto-filled when GPS is captured. You can also type or paste a Plus Code from Google Maps.
          </div>
        </Field>

        <Field label="Notes / Observations">
          <textarea style={{ ...S.input, height: 90, resize: "vertical" }}
            value={form.notes} onChange={set("notes")}
            placeholder="Any relevant observations, remarks, or instructions…" />
        </Field>

        <div style={S.hazardBox}>
          <div style={S.rateTitle}>⚠️ Hazards / Encumbrances</div>
          {(() => {
            const HAZARD_LIST = [
              { key:"highTensionLine", label:"⚡ High Tension Line",    hasSide:true,  hasDist:true  },
              { key:"river",           label:"🌊 River",                 hasSide:true,  hasDist:true  },
              { key:"kuloKholchi",     label:"💧 Kulo / Kholchi",        hasSide:true,  hasDist:true  },
              { key:"floodZone",       label:"🌧 Flood Zone",            hasSide:false, hasDist:false },
              { key:"landslide",       label:"⛰ Landslide / Erosion",   hasSide:true,  hasDist:true  },
              { key:"graveyard",       label:"⚰ Graveyard / Cemetery",  hasSide:true,  hasDist:true  },
              { key:"encroachment",    label:"🚧 Encroachment",          hasSide:true,  hasDist:false },
            ];
            const SIDES = ["North","South","East","West","North-East","North-West","South-East","South-West","Adjacent / On boundary","Multiple sides"];
            return (
              <div style={S.hazardGrid}>
                {HAZARD_LIST.map(({ key, label, hasSide, hasDist }) => (
                  <div key={key} style={{ border:`1.5px solid ${hazards[key]?"#f0c070":"#e5e7eb"}`, borderRadius:8, padding:"10px 12px", background:hazards[key]?"#fffaf4":"#fff" }}>
                    <button type="button" onClick={() => toggleHazard(key)}
                      style={{ ...S.hazardBtn, border:"none", background:"transparent", padding:0, width:"100%", marginBottom: hazards[key] ? 10 : 0 }}>
                      <span style={{ ...S.hazardCheck, ...(hazards[key] ? S.hazardCheckOn : {}) }}>
                        {hazards[key] ? "✓" : ""}
                      </span>
                      <span style={{ fontSize:15, fontWeight: hazards[key]?700:400, color: hazards[key]?"#7a4f00":"#444" }}>{label}</span>
                    </button>
                    {hazards[key] && (
                      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        {hasDist && (
                          <div>
                            <div style={S.subLabel}>DISTANCE</div>
                            <input style={{ ...S.input, borderColor:"#f0c070", background:"#fffaf4" }}
                              value={hazards[key+"Distance"]} onChange={(e) => setHazardNote(key+"Distance", e.target.value)}
                              placeholder="e.g. 50 metres, approx. 100 ft" autoComplete="off" />
                          </div>
                        )}
                        {hasSide && (
                          <div>
                            <div style={S.subLabel}>SIDE / DIRECTION</div>
                            <select style={{ ...S.select, borderColor:"#f0c070", background:"#fffaf4" }}
                              value={hazards[key+"Side"]} onChange={(e) => setHazardNote(key+"Side", e.target.value)}>
                              <option value="">— Select —</option>
                              {SIDES.map(s => <option key={s}>{s}</option>)}
                            </select>
                          </div>
                        )}
                        <div>
                          <div style={S.subLabel}>REMARKS</div>
                          <input style={{ ...S.input, borderColor:"#f0c070", background:"#fffaf4" }}
                            value={hazards[key+"Comment"]} onChange={(e) => setHazardNote(key+"Comment", e.target.value)}
                            placeholder="Additional remarks…" autoComplete="off" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={S.label}>Photos ({photos.length}/20)</label>
          <button type="button" style={S.btnPhoto} onClick={() => fileRef.current?.click()} disabled={compressing}>
            {compressing ? "⏳ Compressing photos…" : "📷 Add Photos"}
          </button>
          <div style={{ fontSize: 11, color: "#888", marginTop: 2, marginBottom: 8 }}>
            Photos are automatically compressed to save mobile data.
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple capture="environment"
            style={{ display: "none" }} onChange={handlePhotos} />
          {photos.length > 0 && (
            <div style={S.photoGrid}>
              {photos.map((src, i) => (
                <div key={i} style={S.photoThumb}>
                  <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button type="button" onClick={() => removePhoto(i)} style={S.photoRemove}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {submitError && <div style={S.errorBox}>{submitError}</div>}

        <button type="submit"
          style={{ ...S.btnSubmit, background: isOnline ? "#c9922a" : "#0f1f3d" }}
          disabled={submitting || compressing}>
          {submitting ? "Submitting…" : isOnline ? "Submit Field Data" : "💾 Save Offline"}
        </button>

        {!isOnline && (
          <p style={{ textAlign: "center", fontSize: 12, color: "#666", margin: "8px 0 0" }}>
            You are offline — data will be saved on this device and sent automatically when you reconnect.
          </p>
        )}

        <div style={S.divider}>
          <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
          <span>or</span>
          <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
        </div>

        <button type="button" style={S.btnShareData} onClick={handleShareData}>
          📤 Share Entered Data as File
        </button>
        <p style={S.shareHint}>
          Saves your entered data as a <strong>.json</strong> file you can share via WhatsApp, email, etc. — office staff can then import it directly.
        </p>
      </form>
    </div>
  );
}

function OfflineBanner({ pendingCount }) {
  return (
    <div style={{ background: "#1a1a2e", color: "#fff", padding: "10px 20px", display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
      <span style={{ fontSize: 18 }}>📴</span>
      <span style={{ flex: 1 }}>
        You are offline — data will be saved locally and sent when you reconnect.
        {pendingCount > 0 && <strong> ({pendingCount} queued)</strong>}
      </span>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  );
}

const S = {
  page:         { minHeight: "100vh", background: "#f0f2f5", fontFamily: "'Segoe UI', sans-serif" },
  header:       { background: "#0f1f3d", padding: "18px 20px 16px", marginBottom: 0, display: "flex", alignItems: "center", gap: 12 },
  btnShare:     { padding: "9px 16px", background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 },
  card:         { background: "#fff", margin: "0 auto", maxWidth: 520, padding: "24px 20px 32px", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" },
  label:        { display: "block", fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 6 },
  input:        { width: "100%", padding: "12px 14px", border: "1.5px solid #ddd", borderRadius: 8, fontSize: 15, boxSizing: "border-box", outline: "none" },
  select:       { width: "100%", padding: "12px 14px", border: "1.5px solid #ddd", borderRadius: 8, fontSize: 15, boxSizing: "border-box", background: "#fff", appearance: "auto" },
  btnGps:       { padding: "12px 14px", background: "#0f1f3d", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap", fontSize: 14 },
  btnPhoto:     { width: "100%", padding: "13px", background: "#f5f5f5", border: "1.5px dashed #bbb", borderRadius: 8, cursor: "pointer", fontSize: 15, color: "#555", marginBottom: 4 },
  btnSubmit:    { width: "100%", padding: "15px", color: "#fff", border: "none", borderRadius: 10, fontSize: 17, fontWeight: 700, cursor: "pointer", marginTop: 8 },
  btnSecondary: { marginTop: 16, padding: "12px 28px", background: "#0f1f3d", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, cursor: "pointer", fontWeight: 600 },
  btnShareData: { width: "100%", padding: "13px", background: "#fff", color: "#0f1f3d", border: "2px solid #0f1f3d", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" },
  divider:      { display: "flex", alignItems: "center", gap: 10, margin: "14px 0 12px", color: "#aaa", fontSize: 13 },
  shareHint:    { textAlign: "center", fontSize: 12, color: "#888", margin: "8px 0 0", lineHeight: 1.5 },
  btnAddPlot:   { padding: "8px 14px", background: "#f0f4ff", color: "#0f1f3d", border: "1px solid #c0cfe8", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 600 },
  hazardBox:    { border: "1.5px solid #fde8c8", borderRadius: 10, padding: "14px 14px 12px", marginBottom: 18, background: "#fffaf4" },
  hazardGrid:   { display: "flex", flexDirection: "column", gap: 10 },
  hazardBtn:    { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", border: "1.5px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 15, color: "#444", textAlign: "left" },
  hazardBtnOn:  { border: "1.5px solid #c9922a", background: "#fff8ee", color: "#7a4f00", fontWeight: 600 },
  hazardCheck:  { width: 20, height: 20, borderRadius: 4, border: "1.5px solid #ccc", background: "#f5f5f5", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#c9922a", fontWeight: 700, flexShrink: 0 },
  hazardCheckOn:{ border: "1.5px solid #c9922a", background: "#fff3d6" },
  subLabel:     { fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: "0.4px", marginBottom: 4 },
  roadBox:      { border: "1.5px solid #c8dff0", borderRadius: 10, padding: "14px 14px 12px", marginBottom: 18, background: "#eef5fb" },
  rateBox:      { border: "1.5px solid #e0e8f0", borderRadius: 10, padding: "14px 14px 10px", marginBottom: 18, background: "#f8fbff" },
  rateTitle:    { fontSize: 13, fontWeight: 700, color: "#0f1f3d", marginBottom: 12 },
  rateRow:      { display: "flex", gap: 12 },
  unit:         { fontWeight: 400, color: "#888", fontSize: 11 },
  btnRemovePlot:{ padding: "10px 12px", background: "#fff0f0", color: "#c0392b", border: "1px solid #f5c6c6", borderRadius: 7, cursor: "pointer", fontSize: 13, flexShrink: 0 },
  errorBox:     { background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 8, padding: "12px 16px", marginBottom: 16, color: "#7a5000", fontSize: 14 },
  photoGrid:    { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 },
  photoThumb:   { position: "relative", aspectRatio: "1", borderRadius: 6, overflow: "hidden", border: "1px solid #ddd" },
  photoRemove:  { position: "absolute", top: 3, right: 3, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: "50%", width: 22, height: 22, cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" },
  pendingBadge: { background: "#e8f4fd", border: "1px solid #bee3f8", borderRadius: 8, padding: "10px 16px", margin: "12px 0", color: "#0f1f3d", fontSize: 13, fontWeight: 600 },
  syncToast:    { position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: "#1a7a3f", color: "#fff", padding: "12px 24px", borderRadius: 10, fontSize: 14, fontWeight: 700, zIndex: 9999, boxShadow: "0 4px 16px rgba(0,0,0,0.2)", whiteSpace: "nowrap" },
};
