import React, { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = (import.meta.env.VITE_API_URL || "") + "/api";

// ── Constants (mirrors main form) ────────────────────────────
const LAND_TYPES      = ["Agricultural","Residential","Commercial","Industrial","Forest","River/Water","Road","Other"];
const LAND_CATEGORIES = ["Aabal","Doyam","Sim","Chahar","Pancham"];
const OWNERSHIP_TYPES = ["Single","Private","Joint","Government","Guthi","Guthi Raitani","Other"];
const FACE_DIRECTIONS = ["East","West","North","South","North-East","North-West","South-East","South-West"];
const STRUCTURE_TYPES = ["RCC Framed","Load Bearing Brick","Load Bearing Stone","Steel Framed","Wood Framed","Mud/Adobe","Other"];
const FOUNDATION_TYPES= ["Isolated Footing","Combined Footing","Raft","Strip","Pile","Stone","Mud","Other"];
const ROAD_TYPES      = ["Pitched / Black Topped","Graveled","Earthen / Kachchi","Goreto / Footpath","Under Construction"];
const ROAD_SURFACES   = ["Good","Fair","Poor"];
const ROAD_SIDES      = ["North","South","East","West","North-East","North-West","South-East","South-West"];
const HAZARD_SIDES    = ["North","South","East","West","North-East","North-West","South-East","South-West","Adjacent / On boundary","Multiple sides"];
const HAZARD_LIST     = [
  { key:"highTensionLine", label:"⚡ High Tension Line",   hasSide:true,  hasDist:true  },
  { key:"river",           label:"🌊 River",                hasSide:true,  hasDist:true  },
  { key:"kuloKholchi",     label:"💧 Kulo / Kholchi",       hasSide:true,  hasDist:true  },
  { key:"floodZone",       label:"🌧 Flood Zone",           hasSide:false, hasDist:false },
  { key:"landslide",       label:"⛰ Landslide / Erosion",  hasSide:true,  hasDist:true  },
  { key:"graveyard",       label:"⚰ Graveyard / Cemetery", hasSide:true,  hasDist:true  },
  { key:"encroachment",    label:"🚧 Encroachment",         hasSide:true,  hasDist:false },
];

// ── OLC encoder ───────────────────────────────────────────────
const OLC_ALPHABET = "23456789CFGHJMPQRVWX";
function encodePlusCode(lat, lng) {
  lat = Math.max(-90, Math.min(90, lat));
  lng = Math.max(-180, Math.min(180, lng));
  let tmpLat = lat + 90, tmpLng = lng + 180, div = 400;
  const chars = [];
  for (let p = 0; p < 5; p++) {
    div /= 20;
    const ld = Math.floor(tmpLat / div), nd = Math.floor(tmpLng / div);
    chars.push(OLC_ALPHABET[ld]); chars.push(OLC_ALPHABET[nd]);
    tmpLat -= ld * div; tmpLng -= nd * div;
  }
  chars.splice(8, 0, "+");
  return chars.join("");
}

// ── Photo compression — iterative < 200 KB ───────────────────
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
          width = Math.round(width * scale); height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        const TARGET = 200 * 1024;
        let quality = 0.85, dataUrl;
        do {
          dataUrl = canvas.toDataURL("image/jpeg", quality);
          if (Math.round((dataUrl.length - 22) * 0.75) <= TARGET || quality <= 0.40) break;
          quality = Math.max(0.40, quality - 0.05);
        } while (true); // eslint-disable-line no-constant-condition
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Offline queue ─────────────────────────────────────────────
const QUEUE_PREFIX = "field_queue_";
function readQueue() {
  const items = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(QUEUE_PREFIX)) try { items.push({ key: k, ...JSON.parse(localStorage.getItem(k)) }); } catch (_) {}
  }
  return items;
}
function queueCount() {
  let n = 0;
  for (let i = 0; i < localStorage.length; i++) if ((localStorage.key(i) || "").startsWith(QUEUE_PREFIX)) n++;
  return n;
}
function saveToQueue(key, payload) {
  localStorage.setItem(QUEUE_PREFIX + key + "_" + Date.now(), JSON.stringify({ payload, savedAt: new Date().toISOString() }));
}
async function flushQueue() {
  const items = readQueue(); let sent = 0;
  for (const item of items) {
    try {
      const res = await fetch(`${API_BASE}/field/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item.payload) });
      if (res.ok) { localStorage.removeItem(item.key); sent++; }
    } catch (_) {}
  }
  return sent;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const EMPTY_HAZARDS = Object.fromEntries(
  HAZARD_LIST.flatMap(({ key, hasSide, hasDist }) => [
    [key, false], [key + "Comment", ""],
    ...(hasDist ? [[key + "Distance", ""]] : []),
    ...(hasSide ? [[key + "Side",     ""]] : []),
  ])
);

export default function MobileCollectPage({ token, shortCode }) {
  const [companyName, setCompanyName] = useState("");
  const [banks,       setBanks]       = useState([]);
  const [tokenError,  setTokenError]  = useState("");
  const [shareCopied, setShareCopied] = useState(false);

  // ── Offline ────────────────────────────────────────────────
  const [isOnline,     setIsOnline]     = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(queueCount);
  const [syncToast,    setSyncToast]    = useState("");
  const updatePending = () => setPendingCount(queueCount());

  const attemptFlush = useCallback(async () => {
    const sent = await flushQueue();
    if (sent > 0) { setSyncToast(`✅ ${sent} queued submission${sent > 1 ? "s" : ""} sent`); setTimeout(() => setSyncToast(""), 4000); updatePending(); }
  }, []);

  useEffect(() => {
    const goOnline  = () => { setIsOnline(true);  attemptFlush(); };
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    if (navigator.onLine) attemptFlush();
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, [attemptFlush]);

  // ── Link resolution ───────────────────────────────────────
  useEffect(() => {
    if (!shortCode) return;
    fetch(`${API_BASE}/field/link/${encodeURIComponent(shortCode)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setTokenError(d.error); return; }
        setCompanyName(d.companyName || ""); setBanks(Array.isArray(d.banks) ? d.banks : []);
      })
      .catch(() => { if (!navigator.onLine) return; setTokenError("Could not verify link."); });
  }, [shortCode]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/field/company-info?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setTokenError(d.error);
        else { setCompanyName(d.companyName || ""); setBanks(Array.isArray(d.banks) ? d.banks : []); }
      })
      .catch(() => { if (!navigator.onLine) return; setTokenError("Could not verify link. Check your internet connection."); });
  }, [token]);

  // ── Form state ────────────────────────────────────────────
  const [form, setForm] = useState({
    submitterName: "", visitDate: todayISO(),
    bank: "", branch: "", clientName: "", ownerName: "",
    location: "", addressLalpurja: "", lat: "", lng: "", googlePlusCode: "",
    landType: "", landCategory: "", ownershipType: "", faceDirection: "",
    landMarketRate: "", buildingRate: "", notes: "",
  });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  // ── Plot numbers ──────────────────────────────────────────
  const [plotNos, setPlotNos] = useState([{ no: "", traceSheet: "" }]);
  const setPlotField = (i, k, v) => setPlotNos(p => p.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
  const addPlot    = () => setPlotNos(p => [...p, { no: "", traceSheet: "" }]);
  const removePlot = (i) => setPlotNos(p => p.filter((_, idx) => idx !== i));

  // ── Area ──────────────────────────────────────────────────
  const [area, setArea] = useState({ r: "", a: "", p: "", d: "" });
  const setAreaField = (k) => (e) => setArea(a => ({ ...a, [k]: e.target.value }));

  // ── Roads ─────────────────────────────────────────────────
  const EMPTY_ROAD = { type: "", width: "", side: "", surface: "", remarks: "" };
  const [roads, setRoads] = useState([{ ...EMPTY_ROAD }]);
  const addRoad      = () => setRoads(r => [...r, { ...EMPTY_ROAD }]);
  const removeRoad   = (i) => setRoads(r => r.filter((_, idx) => idx !== i));
  const setRoadField = (i, k, v) => setRoads(r => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row));

  // ── Building ──────────────────────────────────────────────
  const [hasBuilding, setHasBuilding] = useState(null); // null=unset, "yes"|"yes_not_valuing"|"no"
  const [building, setBuilding] = useState({ numFloors: "", structureType: "", foundationType: "", faceDirection: "", totalAreaSqft: "", remarks: "" });
  const RCC_DEFAULTS = {
    minColumn: "12×12 inch", minBeam: "9×12 inch", dpcTieBeam: "4 inch DPC / 9×9 inch Tie Beam", slabThickness: "5 inch",
    externalWall: "9 inch brick masonry in cement mortar (1:6)", internalWall: "4.5 inch brick masonry in cement mortar (1:4)",
    doorMaterial: "Wood", windowMaterial: "Wood",
    staircase: "RCC slab type staircase", roof: "RCC flat roof with waterproofing and top floor Roof Light gauge structure",
    externalFinishing: "2-coat cement plaster with weather coat/snowcem paint",
    internalFinishing: "2-coat cement plaster with emulsion/distemper paint",
    ceiling: "Cement plaster with emulsion paint",
    flooring: "Ceramic tiles", verandah: "Ceramic tiles", kitchen: "Ceramic tiles",
    bathroom: "Ceramic tiles, EWC, wash basin, shower",
    sanitary: "PPR pipe with EWC, wash basin, shower",
    electricitySystem: "Single phase NEA connection",
    ugWaterTank: "Available", ohWaterTank: "Available", solarPanel: "Not Available",
    waterSupply: "KUKL/Municipality water supply", deepBoring: "Not Available",
    sewerage: "Septic tank", lift: "Not Available", generator: "Not Available",
    parking: "Available — 150 sq ft", compoundWall: "Available",
    buildingPermit: "Available", nbcCompliance: "Yes", setback: "Maintained",
    defects: "None observed. The building is in good structural condition with no visible cracks, dampness, settlement, tilting or spalling.",
    repairMaintenance: "None required at present. The building is well-maintained and in good overall condition.",
    comments: "The building is structurally sound and in good overall condition. Construction quality is satisfactory.",
  };
  const [specs, setSpecs] = useState({ ...RCC_DEFAULTS });
  const setSpec = (k) => (e) => setSpecs(s => ({ ...s, [k]: e.target.value }));
  const setB = (k) => (e) => setBuilding(b => ({ ...b, [k]: e.target.value }));

  // ── Hazards ───────────────────────────────────────────────
  const [hazards, setHazards] = useState(EMPTY_HAZARDS);
  const toggleHazard  = (k)    => setHazards(h => ({ ...h, [k]: !h[k] }));
  const setHazardNote = (k, v) => setHazards(h => ({ ...h, [k]: v }));

  // ── Missing Documents ─────────────────────────────────────
  const [docChecks,   setDocChecks]   = useState({});   // { label: true/false }
  const [customDocs,  setCustomDocs]  = useState([]);   // extra doc labels
  const [newDocText,  setNewDocText]  = useState("");

  const toggleDoc  = (label) => setDocChecks(prev => ({ ...prev, [label]: !prev[label] }));
  const addCustomDoc = () => {
    const t = newDocText.trim();
    if (!t || customDocs.includes(t)) return;
    setCustomDocs(prev => [...prev, t]);
    setNewDocText("");
  };
  const removeCustomDoc = (label) => {
    setCustomDocs(prev => prev.filter(l => l !== label));
    setDocChecks(prev => { const n = { ...prev }; delete n[label]; return n; });
  };

  // ── Photos ────────────────────────────────────────────────
  const [photos,      setPhotos]      = useState([]);
  const [compressing, setCompressing] = useState(false);
  const fileRef = useRef();
  const handlePhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setCompressing(true);
    const compressed = await Promise.all(files.map(compressPhoto));
    setPhotos(prev => [...prev, ...compressed].slice(0, 20));
    e.target.value = "";
    setCompressing(false);
  };

  // ── GPS ───────────────────────────────────────────────────
  const [gpsLoading, setGpsLoading] = useState(false);
  const getGPS = () => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        setForm(f => ({ ...f, lat: lat.toFixed(6), lng: lng.toFixed(6), googlePlusCode: encodePlusCode(lat, lng) }));
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ── Share ─────────────────────────────────────────────────
  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) try { await navigator.share({ title: "Field Data Collection", url }); } catch (_) {}
    else { await navigator.clipboard.writeText(url); setShareCopied(true); setTimeout(() => setShareCopied(false), 2500); }
  };

  // ── Build payload ─────────────────────────────────────────
  const buildPayload = () => {
    const allDocLabels = [
      "Land Ownership Certificate (Lalpurja)", "Trace", "Tiro", "Charkilla",
      "Field Book or Shresta", "Road Verification Letter", "Land Registration Paper",
      ...(hasBuilding === "yes" ? ["Building Ijajat (Asthai / Sthai)", "Building Nirman Sampanna", "Building Naksa"] : []),
      ...customDocs,
    ];
    const missingDocs = allDocLabels.filter(l => !docChecks[l]);
    const availableDocs = allDocLabels.filter(l => !!docChecks[l]);
    return {
      ...(shortCode ? { short_code: shortCode } : { token }),
      data: {
        ...form,
        plotNos: plotNos.map(p => p.no.trim()).filter(Boolean),
        traceSheets: Object.fromEntries(plotNos.filter(p => p.no.trim()).map(p => [p.no.trim(), p.traceSheet])),
        area,
        roads: roads.filter(r => r.type || r.width || r.side),
        building: hasBuilding === "yes" ? { ...building, present: true, specs } : { present: false, status: hasBuilding },
        hazards,
        missingDocs,
        availableDocs,
      },
      photos,
    };
  };

  // ── Submit ────────────────────────────────────────────────
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [submitError, setSubmitError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.clientName.trim() && !form.location.trim())
      return setSubmitError("Please enter at least a client name or location.");
    setSubmitting(true); setSubmitError("");
    const payload = buildPayload();
    if (!navigator.onLine) {
      saveToQueue(shortCode || token, payload); updatePending(); setSubmitting(false); setSubmitted(true); return;
    }
    try {
      const res  = await fetch(`${API_BASE}/field/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Submission failed");
      setSubmitted(true);
    } catch (err) {
      if (!navigator.onLine || err.message === "Failed to fetch") { saveToQueue(shortCode || token, payload); updatePending(); setSubmitted(true); }
      else setSubmitError(err.message);
    } finally { setSubmitting(false); }
  };

  const resetForm = () => {
    setForm({ submitterName: "", visitDate: todayISO(), bank: "", branch: "", clientName: "", ownerName: "", location: "", addressLalpurja: "", lat: "", lng: "", googlePlusCode: "", landType: "", landCategory: "", ownershipType: "", faceDirection: "", landMarketRate: "", buildingRate: "", notes: "" });
    setPlotNos([{ no: "", traceSheet: "" }]);
    setArea({ r: "", a: "", p: "", d: "" });
    setRoads([{ ...EMPTY_ROAD }]);
    setHasBuilding(null); setBuilding({ numFloors: "", structureType: "", foundationType: "", faceDirection: "", totalAreaSqft: "", remarks: "" }); setSpecs({ ...RCC_DEFAULTS });
    setHazards(EMPTY_HAZARDS); setPhotos([]); setDocChecks({}); setCustomDocs([]); setNewDocText(""); setSubmitted(false); setSubmitError("");
  };

  // ── Render ────────────────────────────────────────────────

  if (tokenError && isOnline) return (
    <div style={S.page}><div style={S.card}>
      <div style={S.errorBox}>{tokenError}</div>
      <p style={{ color: "#666", fontSize: 14, textAlign: "center" }}>Ask your admin to generate a new collection link.</p>
    </div></div>
  );

  if (submitted) return (
    <div style={S.page}>
      {!isOnline && <OfflineBanner pendingCount={pendingCount} />}
      <div style={{ ...S.card, textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>{!isOnline ? "💾" : "✅"}</div>
        <h2 style={{ color: !isOnline ? "#0f1f3d" : "#1a7a3f", margin: "0 0 8px" }}>{!isOnline ? "Saved Offline" : "Submitted!"}</h2>
        <p style={{ color: "#555", fontSize: 15 }}>{!isOnline ? "Data saved on device — will send when reconnected." : `Field data sent to ${companyName}.`}</p>
        {pendingCount > 0 && <div style={S.pendingBadge}>💾 {pendingCount} queued — will send when online</div>}
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
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>📋 Field Data Collection</div>
          {companyName && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>{companyName}</div>}
        </div>
        <button type="button" onClick={handleShare} style={S.btnShare}>{shareCopied ? "✓ Copied!" : "🔗 Share"}</button>
      </div>

      {pendingCount > 0 && isOnline && (
        <div style={{ background: "#fff3cd", padding: "8px 20px", fontSize: 13, color: "#7a5000" }}>
          ⏳ Sending {pendingCount} queued submission{pendingCount > 1 ? "s" : ""}…
        </div>
      )}

      <form onSubmit={handleSubmit} style={S.form}>

        {/* ── 1. BASIC INFO ── */}
        <Section icon="📝" title="Basic Information">
          <Row2>
            <FL label="Collector Name">
              <input style={S.input} value={form.submitterName} onChange={set("submitterName")} placeholder="Your name" autoComplete="name" />
            </FL>
            <FL label="Bank">
              {banks.length > 0
                ? <select style={S.select} value={form.bank} onChange={set("bank")}><option value="">— Select —</option>{banks.map(b => <option key={b}>{b}</option>)}</select>
                : <input style={S.input} value={form.bank} onChange={set("bank")} placeholder="Bank name" />}
            </FL>
          </Row2>
          <Row2>
            <FL label="Branch"><input style={S.input} value={form.branch} onChange={set("branch")} placeholder="Branch" /></FL>
            <FL label="Field Visit Date"><input style={S.input} type="date" value={form.visitDate} onChange={set("visitDate")} /></FL>
          </Row2>
          <FL label="Present Address / Location *">
            <input style={S.input} value={form.location} onChange={set("location")} placeholder="Ward, VDC/Municipality, District" />
          </FL>
        </Section>

        {/* ── 2. CLIENT ── */}
        <Section icon="👤" title="Client / Borrower">
          <FL label="Full Name *"><input style={S.input} value={form.clientName} onChange={set("clientName")} placeholder="Full name of client" autoComplete="off" /></FL>
        </Section>

        {/* ── 3. OWNER ── */}
        <Section icon="🏠" title="Property Owner">
          <FL label="Owner Name"><input style={S.input} value={form.ownerName} onChange={set("ownerName")} placeholder="If different from client" autoComplete="off" /></FL>
        </Section>

        {/* ── 4. LAND ── */}
        <Section icon="🗺️" title="Land Details">
          {/* Plot numbers with trace sheets */}
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Plot Number(s) & Trace Sheet</label>
            {plotNos.map((row, i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
                <input style={{ ...S.input, flex: 1 }} value={row.no} onChange={e => setPlotField(i, "no", e.target.value)} placeholder={`Kitta/Plot ${plotNos.length > 1 ? i+1 : ""}`} autoComplete="off" />
                <input style={{ ...S.input, flex: 1 }} value={row.traceSheet} onChange={e => setPlotField(i, "traceSheet", e.target.value)} placeholder="Trace Sheet No." autoComplete="off" />
                {plotNos.length > 1 && <button type="button" onClick={() => removePlot(i)} style={S.btnX}>✕</button>}
              </div>
            ))}
            <button type="button" onClick={addPlot} style={S.btnAdd}>＋ Add Plot</button>
          </div>

          {/* Area */}
          <div style={{ ...S.groupBox, marginBottom: 14 }}>
            <div style={S.groupTitle}>Area (Ropani-Aana-Paisa-Dam)</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[["r","Ro."],["a","Aa."],["p","Pa."],["d","Dam"]].map(([k, lbl]) => (
                <div key={k} style={{ flex: 1 }}>
                  <div style={S.subLabel}>{lbl}</div>
                  <input style={{ ...S.input, textAlign: "center" }} type="number" min="0" value={area[k]} onChange={setAreaField(k)} placeholder="0" />
                </div>
              ))}
            </div>
          </div>

          <Row2>
            <FL label="Land Type">
              <select style={S.select} value={form.landType} onChange={set("landType")}>
                <option value="">— Select —</option>{LAND_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </FL>
            <FL label="Land Category">
              <select style={S.select} value={form.landCategory} onChange={set("landCategory")}>
                <option value="">— Select —</option>{LAND_CATEGORIES.map(t => <option key={t}>{t}</option>)}
              </select>
            </FL>
          </Row2>
          <Row2>
            <FL label="Type of Ownership">
              <select style={S.select} value={form.ownershipType} onChange={set("ownershipType")}>
                <option value="">— Select —</option>{OWNERSHIP_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </FL>
            <FL label="Face Direction">
              <select style={S.select} value={form.faceDirection} onChange={set("faceDirection")}>
                <option value="">— Select —</option>{FACE_DIRECTIONS.map(t => <option key={t}>{t}</option>)}
              </select>
            </FL>
          </Row2>
          <FL label="Address as per Lalpurja">
            <textarea style={{ ...S.input, height: 70, resize: "vertical" }} value={form.addressLalpurja} onChange={set("addressLalpurja")} placeholder="Address as recorded on land certificate (Lalpurja)" />
          </FL>
        </Section>

        {/* ── 5. GPS ── */}
        <Section icon="📍" title="GPS Location">
          <FL label="Coordinates">
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...S.input, flex: 1 }} value={form.lat ? `${form.lat}, ${form.lng}` : ""} placeholder="Tap Get GPS" readOnly />
              <button type="button" style={S.btnGps} onClick={getGPS} disabled={gpsLoading}>{gpsLoading ? "…" : "📍 GPS"}</button>
            </div>
          </FL>
          <FL label="Google Plus Code">
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...S.input, flex: 1, fontFamily: "monospace" }} value={form.googlePlusCode} onChange={set("googlePlusCode")} placeholder="Auto-filled or paste from Google Maps" autoComplete="off" autoCapitalize="characters" />
              {form.lat && !form.googlePlusCode && (
                <button type="button" style={S.btnGps} onClick={() => setForm(f => ({ ...f, googlePlusCode: encodePlusCode(parseFloat(f.lat), parseFloat(f.lng)) }))}>Gen</button>
              )}
            </div>
          </FL>
        </Section>

        {/* ── 6. ROADS ── */}
        <Section icon="🛣️" title="Road Details">
          {roads.map((road, i) => (
            <div key={i} style={{ ...S.groupBox, position: "relative", marginBottom: 10 }}>
              {roads.length > 1 && <button type="button" onClick={() => removeRoad(i)} style={{ position:"absolute", top:8, right:8, padding:"3px 8px", background:"#fff0f0", color:"#c0392b", border:"1px solid #f5c6c6", borderRadius:6, cursor:"pointer", fontSize:11, fontWeight:700 }}>✕</button>}
              <div style={S.groupTitle}>Road {roads.length > 1 ? i+1 : ""}</div>
              <Row2>
                <div>
                  <div style={S.subLabel}>TYPE</div>
                  <select style={{ ...S.select, fontSize: 13 }} value={road.type} onChange={e => setRoadField(i,"type",e.target.value)}>
                    <option value="">— Select —</option>{ROAD_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <div style={S.subLabel}>SIDE</div>
                  <select style={{ ...S.select, fontSize: 13 }} value={road.side} onChange={e => setRoadField(i,"side",e.target.value)}>
                    <option value="">— Select —</option>{ROAD_SIDES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </Row2>
              <Row2>
                <div>
                  <div style={S.subLabel}>WIDTH (ft)</div>
                  <input style={{ ...S.input, fontSize: 13 }} type="number" min="0" value={road.width} onChange={e => setRoadField(i,"width",e.target.value)} placeholder="e.g. 20" />
                </div>
                <div>
                  <div style={S.subLabel}>SURFACE</div>
                  <select style={{ ...S.select, fontSize: 13 }} value={road.surface} onChange={e => setRoadField(i,"surface",e.target.value)}>
                    <option value="">— Select —</option>{ROAD_SURFACES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </Row2>
              <div style={S.subLabel}>REMARKS</div>
              <input style={{ ...S.input, fontSize: 13 }} value={road.remarks} onChange={e => setRoadField(i,"remarks",e.target.value)} placeholder="Additional remarks…" />
            </div>
          ))}
          <button type="button" onClick={addRoad} style={S.btnAdd}>＋ Add Another Road</button>
        </Section>

        {/* ── 7. MARKET RATES ── */}
        <Section icon="📊" title="Market Rates">
          <Row2>
            <FL label={<>Land Rate <span style={S.unit}>(Rs./aana)</span></>}>
              <input style={S.input} type="number" min="0" value={form.landMarketRate} onChange={set("landMarketRate")} placeholder="0" />
            </FL>
            <FL label={<>Building Rate <span style={S.unit}>(Rs./sq.ft)</span></>}>
              <input style={S.input} type="number" min="0" value={form.buildingRate} onChange={set("buildingRate")} placeholder="0" />
            </FL>
          </Row2>
        </Section>

        {/* ── 8. BUILDING ── */}
        <Section icon="🏗️" title="Building">
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {[
              ["yes",           "✅ Yes — building present and valuing"],
              ["yes_not_valuing","⚠️ Yes — building present but not valuing"],
              ["no",            "❌ No building"],
            ].map(([val, lbl]) => (
              <button key={val} type="button"
                onClick={() => setHasBuilding(val)}
                style={{ padding: "10px 14px", borderRadius: 8, textAlign: "left",
                  border: `2px solid ${hasBuilding === val ? "#1a73e8" : "#ddd"}`,
                  background: hasBuilding === val ? "#e8f0fe" : "#f8f9fa",
                  color: hasBuilding === val ? "#1a73e8" : "#555",
                  cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                {lbl}
              </button>
            ))}
          </div>

          {hasBuilding === "yes" && (
            <div>
              <Row2>
                <FL label="No. of Floors">
                  <input style={S.input} type="number" min="0" value={building.numFloors} onChange={setB("numFloors")} placeholder="e.g. 3" />
                </FL>
                <FL label={<>Total Built Area <span style={S.unit}>(sq.ft)</span></>}>
                  <input style={S.input} type="number" min="0" value={building.totalAreaSqft} onChange={setB("totalAreaSqft")} placeholder="0" />
                </FL>
              </Row2>
              <Row2>
                <FL label="Structure Type">
                  <select style={S.select} value={building.structureType} onChange={setB("structureType")}>
                    <option value="">— Select —</option>{STRUCTURE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </FL>
                <FL label="Foundation Type">
                  <select style={S.select} value={building.foundationType} onChange={setB("foundationType")}>
                    <option value="">— Select —</option>{FOUNDATION_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </FL>
              </Row2>
              <FL label="Face Direction">
                <select style={S.select} value={building.faceDirection} onChange={setB("faceDirection")}>
                  <option value="">— Select —</option>{FACE_DIRECTIONS.map(t => <option key={t}>{t}</option>)}
                </select>
              </FL>
              <FL label="Building Remarks">
                <textarea style={{ ...S.input, height: 70, resize: "vertical" }} value={building.remarks} onChange={setB("remarks")} placeholder="Condition, defects, observations…" />
              </FL>

              {/* Technical Specifications */}
              <div style={{ marginTop: 18, borderTop: "1.5px solid #e0e7ef", paddingTop: 14 }}>
                <div style={{ fontWeight: 700, color: "#0f1f3d", fontSize: 13, marginBottom: 12, letterSpacing: 0.2 }}>📐 Technical Specifications</div>

                <div style={{ fontWeight: 600, color: "#555", fontSize: 11, textTransform: "uppercase", marginBottom: 6 }}>Structure</div>
                {[
                  ["minColumn",    "Minimum Column Size",   ["12×12 inch","9×9 inch","10×10 inch","14×14 inch"]],
                  ["minBeam",      "Minimum Beam Size",     ["9×12 inch","9×9 inch","9×15 inch","12×12 inch"]],
                  ["dpcTieBeam",   "DPC / Tie Beam",        ["4 inch DPC / 9×9 inch Tie Beam","6 inch DPC / 9×9 inch Tie Beam","4 inch DPC only"]],
                  ["slabThickness","Slab Thickness",        ["5 inch","4 inch","6 inch"]],
                ].map(([k, label, opts]) => (
                  <FL key={k} label={label}>
                    <EditableSelect style={S} value={specs[k]} onChange={setSpec(k)} options={opts} />
                  </FL>
                ))}

                <div style={{ fontWeight: 600, color: "#555", fontSize: 11, textTransform: "uppercase", margin: "12px 0 6px" }}>Walls, Doors & Windows</div>
                {[
                  ["externalWall",  "External Wall",    ["9 inch brick masonry in cement mortar (1:6)","9 inch brick masonry in cement mortar (1:4)","Stone masonry in cement mortar"]],
                  ["internalWall",  "Internal Wall",    ["4.5 inch brick masonry in cement mortar (1:4)","4.5 inch brick masonry in cement mortar (1:6)","Lightweight partition wall"]],
                  ["doorMaterial",  "Doors",            ["Wood","Aluminum","UPVC"]],
                  ["windowMaterial","Windows",          ["Wood","Aluminum","UPVC"]],
                  ["staircase",     "Staircase",        ["RCC slab type staircase","Timber staircase","Marble staircase","Steel staircase"]],
                  ["roof",          "Roof",             ["RCC flat roof with waterproofing and top floor Roof Light gauge structure","RCC flat roof with waterproofing","CGI sheet roofing","Timber roof with CGI sheet"]],
                ].map(([k, label, opts]) => (
                  <FL key={k} label={label}>
                    <EditableSelect style={S} value={specs[k]} onChange={setSpec(k)} options={opts} />
                  </FL>
                ))}

                <div style={{ fontWeight: 600, color: "#555", fontSize: 11, textTransform: "uppercase", margin: "12px 0 6px" }}>Finishing & Fixtures</div>
                {[
                  ["externalFinishing","External Finishing",["2-coat cement plaster with weather coat/snowcem paint","3-coat cement plaster with weather coat paint","Exposed brick finish","Stone cladding"]],
                  ["internalFinishing","Internal Finishing",["2-coat cement plaster with emulsion/distemper paint","3-coat cement plaster with emulsion paint","POP finish with paint"]],
                  ["ceiling",         "Ceiling",           ["Cement plaster with emulsion paint","POP (Plaster of Paris) with paint","False ceiling (gypsum board)","Exposed RCC","Wooden ceiling"]],
                  ["flooring",        "Flooring",          ["Ceramic tiles","Vitrified tiles","Marble","Granite","Mosaic","Cement screed"]],
                  ["verandah",        "Verandah",          ["Ceramic tiles","Vitrified tiles","Marble","Granite","Cement screed","Not Applicable"]],
                  ["kitchen",         "Kitchen / Dining",  ["Ceramic tiles","Vitrified tiles","Granite","Marble"]],
                  ["bathroom",        "Bathroom / Toilet", ["Ceramic tiles, EWC, wash basin, shower","Ceramic tiles, Indian WC","Vitrified tiles, EWC, wash basin, shower","Ceramic tiles, EWC, wash basin, shower, bathtub"]],
                ].map(([k, label, opts]) => (
                  <FL key={k} label={label}>
                    <EditableSelect style={S} value={specs[k]} onChange={setSpec(k)} options={opts} />
                  </FL>
                ))}

                <div style={{ fontWeight: 600, color: "#555", fontSize: 11, textTransform: "uppercase", margin: "12px 0 6px" }}>Services & Utilities</div>
                {[
                  ["sanitary",         "Sanitary & Plumbing",   ["PPR pipe with EWC, wash basin, shower","CPVC pipe with EWC, wash basin, shower","GI pipe with EWC, wash basin","PVC pipe"]],
                  ["electricitySystem","Electricity System",    ["Single phase NEA connection","Three phase NEA connection","Solar only","NEA + Solar backup"]],
                  ["ugWaterTank",      "Underground Water Tank",["Available","Not Available"]],
                  ["ohWaterTank",      "Overhead Water Tank",   ["Available","Not Available"]],
                  ["solarPanel",       "Solar Panel",           ["Not Available","Available"]],
                  ["waterSupply",      "Water Supply",          ["KUKL/Municipality water supply","Borewell / deep boring","Water tanker","Stream/spring water"]],
                  ["deepBoring",       "Deep Boring",           ["Not Available","Available"]],
                  ["sewerage",         "Sewerage System",       ["Septic tank","Connected to municipality","Not Available"]],
                  ["lift",             "Lift / Elevator",       ["Not Available","Available"]],
                  ["generator",        "Generator / Backup",    ["Not Available","Available"]],
                ].map(([k, label, opts]) => (
                  <FL key={k} label={label}>
                    <EditableSelect style={S} value={specs[k]} onChange={setSpec(k)} options={opts} />
                  </FL>
                ))}

                <div style={{ fontWeight: 600, color: "#555", fontSize: 11, textTransform: "uppercase", margin: "12px 0 6px" }}>Compliance & Amenities</div>
                {[
                  ["buildingPermit","Building Permit",    ["Available","Not Available","Under Process"]],
                  ["nbcCompliance", "NBC Code Compliance",["Yes","No","Partially"]],
                  ["setback",       "Setback Maintained", ["Maintained","Not Maintained","Partially Maintained"]],
                  ["compoundWall",  "Compound Wall",      ["Available","Not Available"]],
                  ["parking",       "Parking",            ["Available — 150 sq ft","Available — 200 sq ft","Available — Basement","Available — Open","Not Available","Other"]],
                ].map(([k, label, opts]) => (
                  <FL key={k} label={label}>
                    <EditableSelect style={S} value={specs[k]} onChange={setSpec(k)} options={opts} />
                  </FL>
                ))}

                <div style={{ fontWeight: 600, color: "#555", fontSize: 11, textTransform: "uppercase", margin: "12px 0 6px" }}>Condition & Remarks</div>
                <FL label="Defects / Observations">
                  <textarea style={{ ...S.input, height: 70, resize: "vertical" }} value={specs.defects} onChange={setSpec("defects")} placeholder="Visible defects, cracks, dampness…" />
                </FL>
                <FL label="Repair & Maintenance">
                  <textarea style={{ ...S.input, height: 60, resize: "vertical" }} value={specs.repairMaintenance} onChange={setSpec("repairMaintenance")} placeholder="Required or recent maintenance…" />
                </FL>
                <FL label="Comments">
                  <textarea style={{ ...S.input, height: 60, resize: "vertical" }} value={specs.comments} onChange={setSpec("comments")} placeholder="Additional comments…" />
                </FL>
              </div>
            </div>
          )}
        </Section>

        {/* ── 9. HAZARDS ── */}
        <Section icon="⚠️" title="Hazards / Encumbrances">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {HAZARD_LIST.map(({ key, label, hasSide, hasDist }) => (
              <div key={key} style={{ border: `1.5px solid ${hazards[key] ? "#f0c070" : "#e5e7eb"}`, borderRadius: 8, padding: "10px 12px", background: hazards[key] ? "#fffaf4" : "#fff" }}>
                <button type="button" onClick={() => toggleHazard(key)}
                  style={{ display:"flex", alignItems:"center", gap:10, border:"none", background:"transparent", padding:0, width:"100%", cursor:"pointer", marginBottom: hazards[key] ? 10 : 0 }}>
                  <span style={{ width:20, height:20, borderRadius:4, border:`1.5px solid ${hazards[key]?"#c9922a":"#ccc"}`, background: hazards[key]?"#fff3d6":"#f5f5f5", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:13, color:"#c9922a", fontWeight:700, flexShrink:0 }}>{hazards[key] ? "✓" : ""}</span>
                  <span style={{ fontSize:15, fontWeight: hazards[key]?700:400, color: hazards[key]?"#7a4f00":"#444" }}>{label}</span>
                </button>
                {hazards[key] && (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {hasDist && (<><div style={S.subLabel}>DISTANCE</div><input style={{ ...S.input, borderColor:"#f0c070" }} value={hazards[key+"Distance"]} onChange={e => setHazardNote(key+"Distance", e.target.value)} placeholder="e.g. 50 metres" /></>)}
                    {hasSide && (<><div style={S.subLabel}>SIDE</div><select style={{ ...S.select, borderColor:"#f0c070" }} value={hazards[key+"Side"]} onChange={e => setHazardNote(key+"Side", e.target.value)}><option value="">— Select —</option>{HAZARD_SIDES.map(s => <option key={s}>{s}</option>)}</select></>)}
                    <div style={S.subLabel}>REMARKS</div>
                    <input style={{ ...S.input, borderColor:"#f0c070" }} value={hazards[key+"Comment"]} onChange={e => setHazardNote(key+"Comment", e.target.value)} placeholder="Additional remarks…" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* ── 10. NOTES ── */}
        <Section icon="📝" title="Notes & Observations">
          <FL label="General Notes">
            <textarea style={{ ...S.input, height: 100, resize: "vertical" }} value={form.notes} onChange={set("notes")} placeholder="Any relevant observations, conditions, instructions…" />
          </FL>
        </Section>

        {/* ── 11. MISSING DOCUMENTS ── */}
        <Section icon="📋" title="Missing Documents Checklist">
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#555" }}>
            Check each document that is <strong>available</strong>. Unchecked items will be flagged as missing.
          </p>

          {/* Standard land docs */}
          {[
            "Land Ownership Certificate (Lalpurja)",
            "Trace",
            "Tiro",
            "Charkilla",
            "Field Book or Shresta",
            "Road Verification Letter",
            "Land Registration Paper",
          ].map(label => (
            <DocCheckRow key={label} label={label} checked={!!docChecks[label]} onToggle={() => toggleDoc(label)} />
          ))}

          {/* Building docs — only if building present */}
          {hasBuilding === "yes" && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#be185d", textTransform: "uppercase", margin: "12px 0 6px", letterSpacing: 0.4 }}>Building</div>
              {["Building Ijajat (Asthai / Sthai)", "Building Nirman Sampanna", "Building Naksa"].map(label => (
                <DocCheckRow key={label} label={label} checked={!!docChecks[label]} onToggle={() => toggleDoc(label)} />
              ))}
            </>
          )}

          {/* Custom docs */}
          {customDocs.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", margin: "12px 0 6px", letterSpacing: 0.4 }}>Additional</div>
              {customDocs.map(label => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <DocCheckRow label={label} checked={!!docChecks[label]} onToggle={() => toggleDoc(label)} />
                  </div>
                  <button type="button" onClick={() => removeCustomDoc(label)} style={S.btnX}>✕</button>
                </div>
              ))}
            </>
          )}

          {/* Add custom doc */}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input
              style={{ ...S.input, flex: 1 }}
              value={newDocText}
              onChange={e => setNewDocText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCustomDoc())}
              placeholder="Add custom document…"
            />
            <button type="button" onClick={addCustomDoc} style={{ ...S.btnAdd, whiteSpace: "nowrap" }}>＋ Add</button>
          </div>

          {/* Missing summary */}
          {(() => {
            const allLabels = [
              "Land Ownership Certificate (Lalpurja)", "Trace", "Tiro", "Charkilla",
              "Field Book or Shresta", "Road Verification Letter", "Land Registration Paper",
              ...(hasBuilding === "yes" ? ["Building Ijajat (Asthai / Sthai)", "Building Nirman Sampanna", "Building Naksa"] : []),
              ...customDocs,
            ];
            const missing = allLabels.filter(l => !docChecks[l]);
            if (missing.length === 0) return <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "#e8f5e9", border: "1.5px solid #27ae60", color: "#1a5c3a", fontWeight: 700, fontSize: 13 }}>✅ All documents available</div>;
            return (
              <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "#fff8e1", border: "1.5px solid #f39c12" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#7a5c00", marginBottom: 5 }}>📋 {missing.length} document{missing.length > 1 ? "s" : ""} to request from client:</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {missing.map(l => <li key={l} style={{ fontSize: 12, color: "#7a5c00", marginBottom: 2 }}>{l}</li>)}
                </ul>
              </div>
            );
          })()}
        </Section>

        {/* ── 12. PHOTOS ── */}
        <Section icon="📷" title={`Photos (${photos.length}/20)`}>
          <button type="button" style={S.btnPhoto} onClick={() => fileRef.current?.click()} disabled={compressing}>
            {compressing ? "⏳ Compressing…" : "📷 Add Photos"}
          </button>
          <div style={{ fontSize: 11, color: "#888", marginTop: 3, marginBottom: 10 }}>Auto-compressed to save mobile data.</div>
          <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" style={{ display: "none" }} onChange={handlePhotos} />
          {photos.length > 0 && (
            <div style={S.photoGrid}>
              {photos.map((src, i) => (
                <div key={i} style={S.photoThumb}>
                  <img src={src} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  <button type="button" onClick={() => setPhotos(p => p.filter((_,idx) => idx !== i))} style={S.photoRemove}>✕</button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {submitError && <div style={S.errorBox}>{submitError}</div>}

        <div style={{ padding: "0 0 20px" }}>
          <button type="submit" style={{ ...S.btnSubmit, background: isOnline ? "#c9922a" : "#0f1f3d" }} disabled={submitting || compressing}>
            {submitting ? "Submitting…" : isOnline ? "Submit Field Data" : "💾 Save Offline"}
          </button>
          {!isOnline && <p style={{ textAlign:"center", fontSize:12, color:"#666", margin:"8px 0 0" }}>Offline — data saved locally, sent when reconnected.</p>}

          <div style={{ display:"flex", alignItems:"center", gap:10, margin:"14px 0 12px", color:"#aaa", fontSize:13 }}>
            <div style={{ flex:1, height:1, background:"#e5e7eb" }} /><span>or</span><div style={{ flex:1, height:1, background:"#e5e7eb" }} />
          </div>
          <button type="button" style={{ width:"100%", padding:"13px", background:"#fff", color:"#0f1f3d", border:"2px solid #0f1f3d", borderRadius:10, fontSize:15, fontWeight:700, cursor:"pointer" }}
            onClick={async () => {
              const payload = buildPayload();
              const filename = `field-${form.clientName.replace(/\s+/g,"-")||"entry"}-${Date.now()}.json`;
              const blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" });
              const file = new File([blob], filename, { type:"application/json" });
              if (navigator.share && navigator.canShare?.({ files:[file] })) { try { await navigator.share({ title:"Field Data", files:[file] }); return; } catch (_) {} }
              const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
            }}>
            📤 Share Data as File
          </button>
          <p style={{ textAlign:"center", fontSize:12, color:"#888", margin:"6px 0 0" }}>Share via WhatsApp / email — office can import directly.</p>
        </div>
      </form>
    </div>
  );
}

function OfflineBanner({ pendingCount }) {
  return (
    <div style={{ background:"#1a1a2e", color:"#fff", padding:"10px 20px", display:"flex", alignItems:"center", gap:10, fontSize:13 }}>
      <span style={{ fontSize:18 }}>📴</span>
      <span style={{ flex:1 }}>Offline — data saved locally, sent when reconnected.{pendingCount > 0 && <strong> ({pendingCount} queued)</strong>}</span>
    </div>
  );
}

// Editable combobox: shows preset options but value is a free-text input
function EditableSelect({ value, onChange, options, style }) {
  const id = React.useId();
  return (
    <>
      <datalist id={id}>{options.map(o => <option key={o} value={o} />)}</datalist>
      <input style={style.input} list={id} value={value} onChange={onChange} />
    </>
  );
}

function DocCheckRow({ label, checked, onToggle }) {
  return (
    <button type="button" onClick={onToggle}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", border: `1.5px solid ${checked ? "#27ae60" : "#ddd"}`, borderRadius: 8, padding: "10px 12px", background: checked ? "#e8f5e9" : "#fff", cursor: "pointer", marginBottom: 7, textAlign: "left" }}>
      <span style={{ width: 20, height: 20, borderRadius: 4, border: `1.5px solid ${checked ? "#27ae60" : "#ccc"}`, background: checked ? "#27ae60" : "#f5f5f5", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff", fontWeight: 700, flexShrink: 0 }}>
        {checked ? "✓" : ""}
      </span>
      <span style={{ fontSize: 14, fontWeight: checked ? 600 : 400, color: checked ? "#1a5c3a" : "#444", flex: 1 }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: checked ? "#27ae60" : "#f39c12", color: "#fff", whiteSpace: "nowrap", flexShrink: 0 }}>
        {checked ? "✓ Available" : "⚠ Missing"}
      </span>
    </button>
  );
}

function Section({ icon, title, children }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ background: "#0f1f3d", padding: "10px 20px", display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:16 }}>{icon}</span>
        <span style={{ fontWeight:700, fontSize:14, color:"#fff" }}>{title}</span>
      </div>
      <div style={{ background:"#fff", padding:"18px 20px 8px" }}>{children}</div>
    </div>
  );
}

function FL({ label, children }) {
  return <div style={{ marginBottom: 14 }}><label style={S.label}>{label}</label>{children}</div>;
}

function Row2({ children }) {
  return <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:0 }}>{children}</div>;
}

const S = {
  page:    { minHeight:"100vh", background:"#f0f2f5", fontFamily:"'Segoe UI', sans-serif" },
  header:  { background:"#0f1f3d", padding:"16px 20px", display:"flex", alignItems:"center", gap:12 },
  form:    { maxWidth:560, margin:"0 auto" },
  btnShare:{ padding:"8px 14px", background:"rgba(255,255,255,0.15)", color:"#fff", border:"1px solid rgba(255,255,255,0.3)", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:600, whiteSpace:"nowrap" },
  card:    { background:"#fff", margin:"0 auto", maxWidth:560, padding:"24px 20px 32px", boxShadow:"0 2px 12px rgba(0,0,0,0.08)" },
  label:   { display:"block", fontSize:13, fontWeight:600, color:"#444", marginBottom:5 },
  input:   { width:"100%", padding:"11px 13px", border:"1.5px solid #ddd", borderRadius:8, fontSize:15, boxSizing:"border-box", outline:"none" },
  select:  { width:"100%", padding:"11px 13px", border:"1.5px solid #ddd", borderRadius:8, fontSize:15, boxSizing:"border-box", background:"#fff", appearance:"auto" },
  btnGps:  { padding:"11px 13px", background:"#0f1f3d", color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontWeight:600, whiteSpace:"nowrap", fontSize:14 },
  btnPhoto:{ width:"100%", padding:"13px", background:"#f5f5f5", border:"1.5px dashed #bbb", borderRadius:8, cursor:"pointer", fontSize:15, color:"#555" },
  btnSubmit:{ width:"100%", padding:"15px", color:"#fff", border:"none", borderRadius:10, fontSize:17, fontWeight:700, cursor:"pointer", marginTop:4 },
  btnSecondary:{ marginTop:16, padding:"12px 28px", background:"#0f1f3d", color:"#fff", border:"none", borderRadius:8, fontSize:15, cursor:"pointer", fontWeight:600 },
  btnAdd:  { padding:"7px 13px", background:"#f0f4ff", color:"#0f1f3d", border:"1px solid #c0cfe8", borderRadius:7, cursor:"pointer", fontSize:13, fontWeight:600 },
  btnX:    { padding:"9px 11px", background:"#fff0f0", color:"#c0392b", border:"1px solid #f5c6c6", borderRadius:7, cursor:"pointer", fontSize:12, flexShrink:0 },
  groupBox:{ border:"1.5px solid #e5e7eb", borderRadius:8, padding:"12px 12px 10px", background:"#f9fafb" },
  groupTitle:{ fontSize:12, fontWeight:700, color:"#0f1f3d", marginBottom:10 },
  subLabel:{ fontSize:11, fontWeight:700, color:"#888", letterSpacing:"0.4px", marginBottom:4 },
  unit:    { fontWeight:400, color:"#888", fontSize:11 },
  errorBox:{ background:"#fff3cd", border:"1px solid #ffc107", borderRadius:8, padding:"12px 16px", margin:"0 20px 12px", color:"#7a5000", fontSize:14 },
  photoGrid:{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 },
  photoThumb:{ position:"relative", aspectRatio:"1", borderRadius:6, overflow:"hidden", border:"1px solid #ddd" },
  photoRemove:{ position:"absolute", top:3, right:3, background:"rgba(0,0,0,0.6)", color:"#fff", border:"none", borderRadius:"50%", width:22, height:22, cursor:"pointer", fontSize:11, display:"flex", alignItems:"center", justifyContent:"center" },
  pendingBadge:{ background:"#e8f4fd", border:"1px solid #bee3f8", borderRadius:8, padding:"10px 16px", margin:"12px 0", color:"#0f1f3d", fontSize:13, fontWeight:600 },
  syncToast:{ position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", background:"#1a7a3f", color:"#fff", padding:"12px 24px", borderRadius:10, fontSize:14, fontWeight:700, zIndex:9999, boxShadow:"0 4px 16px rgba(0,0,0,0.2)", whiteSpace:"nowrap" },
};
