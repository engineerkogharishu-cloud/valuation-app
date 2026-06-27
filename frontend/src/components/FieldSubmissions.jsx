import React, { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../services/api";
import { uid, emptyBuilding } from "../constants";

const fmtDate = (d) => (d ? new Date(d).toLocaleString("en-NP") : "—");

// Map field submission data into ValuationForm initialState
function toFormState(data, photos) {
  const makePersonEntry = (name) => name ? [{
    id: uid(), showPerson: true, showCompany: false,
    person: {
      name, citizenshipNo: "", issuedDate: "", issuedBy: "",
      address: data.location || "", contact: "", fatherName: "", husbandName: "", grandfatherName: "",
    },
    company: { name: "", panVat: "", regNo: "", regDate: "", regOn: "", address: "", contact: "", directors: [] },
  }] : undefined;

  const client = makePersonEntry(data.clientName);
  // Owner: use ownerName if provided, otherwise fall back to clientName
  const ownerEntry = makePersonEntry(data.ownerName || data.clientName);

  // Build one property per plot number (or a single property if none specified)
  const plotNos = Array.isArray(data.plotNos) && data.plotNos.length > 0
    ? data.plotNos
    : [data.plotNo || ""];

  const properties = plotNos.map((plotNo, i) => ({
    id: uid(), plotNo: plotNo || "", traceSheetNo: "", landType: "",
    addressLalpurja: "", presentAddress: data.location || "",
    category: "", areaUnit: "radp", areaSqm: "",
    areaRadp: { r: "", a: "", p: "", d: "" }, areaBkd: { b: "", k: "", d: "" },
    ownershipType: "", ownerName: data.ownerName || data.clientName || "", tenantInfo: "",
    location: data.location || "",
    lat: i === 0 ? (data.lat || "") : "",
    lng: i === 0 ? (data.lng || "") : "",
    googlePlusCode: i === 0 ? (data.googlePlusCode || "") : "",
    _mapEnabled: i === 0 && !!(data.lat && data.lng),
  }));

  // Build propDescriptions: hazards → dedicated fields per property
  const h = data.hazards || {};
  const HAZARD_FLAGS = ["highTensionLine","river","kuloKholchi","floodZone","landslide","graveyard","encroachment"];
  const hasHazard = HAZARD_FLAGS.some((f) => h[f]);
  const propDescriptions = hasHazard
    ? Object.fromEntries(properties.map((p) => [p.id,
        Object.fromEntries(
          HAZARD_FLAGS.flatMap((f) => [
            [f,              !!h[f]],
            [f+"Comment",    h[f+"Comment"]    || ""],
            [f+"Distance",   h[f+"Distance"]   || ""],
            [f+"Side",       h[f+"Side"]       || ""],
          ])
        )
      ]))
    : undefined;

  // Build rates object: one entry per property (land market rate → commercialRate)
  const rates = {};
  if (data.landMarketRate) {
    properties.forEach((p) => {
      rates[p.id] = {
        commercialRate:   String(data.landMarketRate),
        govRate:          "",
        commercialWeight: 70,
        govWeight:        30,
      };
    });
  }

  // Pre-create a building with building rate pre-filled for all floor area rows
  let buildings    = undefined;
  let buildingVals = undefined;
  let hasBuilding  = undefined;
  if (data.buildingRate) {
    const bldg = emptyBuilding();
    bldg.ownerSource = properties[0].id;
    bldg.ownerName   = data.clientName || "";
    bldg.plotNo      = plotNos[0] || "";
    buildingVals = {
      [bldg.id]: {
        floorRates: Object.fromEntries(
          bldg.areaTable.map((row) => [row.id, String(data.buildingRate)])
        ),
      },
    };
    buildings   = [bldg];
    hasBuilding = true;
  }

  return {
    bank:        data.bank      || "",
    branch:      data.branch    || "",
    visitDate:   data.visitDate || "",
    remarks:     data.notes     || "",
    clients:     client,
    owners:      ownerEntry,
    properties,
    propDescriptions,
    rates:       Object.keys(rates).length ? rates : undefined,
    buildings,
    buildingVals,
    hasBuilding,
    photos:      (photos || []).map((src, i) => ({
      id: uid(), src, caption: `Field photo ${i + 1}`, category: "site",
    })),
  };
}

export default function FieldSubmissions({ onUseData, user }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [viewId,   setViewId]   = useState(null);
  const [detail,   setDetail]   = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [delId,    setDelId]    = useState(null);

  // ── Link management ─────────────────────────────────────────
  const [links,       setLinks]       = useState([]);
  const [linksLoaded, setLinksLoaded] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [newLinkType,  setNewLinkType]  = useState("permanent");
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkDays,  setNewLinkDays]  = useState(7);
  const [genLoading,   setGenLoading]   = useState(false);
  const [copiedId,     setCopiedId]     = useState(null);
  const [showQrId,     setShowQrId]     = useState(null);

  const shortUrl = (code) => `${window.location.origin}/collect/${code}`;

  const loadLinks = useCallback(async () => {
    try { const d = await api.listFieldLinks(); setLinks(Array.isArray(d) ? d : []); setLinksLoaded(true); }
    catch (_) { setLinksLoaded(true); }
  }, []);

  useEffect(() => { loadLinks(); }, [loadLinks]);
  const [importError, setImportError] = useState("");
  const [importing,   setImporting]   = useState(false);
  const fileInputRef = useRef();
  const [activeTab, setActiveTab] = useState("pending"); // "pending" | "rejected" | "pulled"
  const [rejectId,  setRejectId]  = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectExtra, setRejectExtra] = useState({ plotNo: "" });
  const [rejecting, setRejecting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const d = await api.listFieldSubmissions();
      setSubmissions(d.submissions || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id) => {
    setViewId(id); setDetail(null); setDetailLoading(true);
    try {
      const d = await api.getFieldSubmission(id);
      setDetail(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUse = async (sub) => {
    let d = detail;
    if (!d || d.id !== sub.id) {
      try { d = await api.getFieldSubmission(sub.id); } catch { return; }
    }
    await api.markFieldSubmissionPulled(sub.id).catch(() => {});
    const state = toFormState(d.data || {}, d.photos || []);
    setViewId(null); setDetail(null);
    onUseData(state);
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteFieldSubmission(id);
      setDelId(null);
      if (viewId === id) { setViewId(null); setDetail(null); }
      load();
    } catch (e) {
      alert("Delete failed: " + e.message);
    }
  };

  // Pre-fill extra fields from field submission data when reject dialog opens
  useEffect(() => {
    if (!rejectId) return;
    const src = (detail && detail.id === rejectId) ? detail : null;
    const pick = (d) => {
      const fd = d || {};
      setRejectExtra({ plotNo: (Array.isArray(fd.plotNos) && fd.plotNos.length ? fd.plotNos.join(", ") : fd.plotNo) || "" });
    };
    if (src) {
      pick(src.data);
    } else {
      api.getFieldSubmission(rejectId).then(d => pick(d?.data)).catch(() => {});
    }
  }, [rejectId]);

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setRejecting(true);
    try {
      const extra = rejectExtra.plotNo.trim() ? { plotNo: rejectExtra.plotNo.trim() } : undefined;
      await api.rejectFieldSubmission(rejectId, rejectReason.trim(), extra);
      setRejectId(null); setRejectReason(""); setRejectExtra({ plotNo: "" });
      setViewId(null); setDetail(null);
      setActiveTab("rejected");
      load();
    } catch (e) {
      alert("Reject failed: " + e.message);
    } finally {
      setRejecting(false);
    }
  };

  const exportRejected = () => {
    const rejected = submissions.filter(s => s.status === "rejected");
    const csv = [
      ["ID", "Client", "Location", "Bank", "Branch", "Submitted By", "Submitted At", "Rejected By", "Rejected At", "Rejection Reason"],
      ...rejected.map(s => [
        s.id, s.client_name||"", s.location||"", s.bank||"", s.branch||"",
        s.submitter_name||"", s.created_at||"",
        s.rejected_by_username||"", s.rejected_at||"",
        `"${(s.rejection_reason||"").replace(/"/g,'""')}"`,
      ])
    ].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rejected_field_submissions_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const createLink = async () => {
    setGenLoading(true);
    try {
      const payload = { label: newLinkLabel.trim() || (newLinkType === "permanent" ? "Permanent Link" : "Temporary Link"), link_type: newLinkType };
      if (newLinkType === "temporary") payload.expires_days = Number(newLinkDays) || 7;
      await api.createFieldLink(payload);
      await loadLinks();
      setShowLinkForm(false);
      setNewLinkLabel("");
      setNewLinkType("permanent");
      setNewLinkDays(7);
    } catch (e) {
      alert("Failed to create link: " + e.message);
    } finally {
      setGenLoading(false);
    }
  };

  const deactivateLink = async (id) => {
    if (!window.confirm("Deactivate this link? Field staff using it will no longer be able to submit.")) return;
    try { await api.deleteFieldLink(id); await loadLinks(); }
    catch (e) { alert("Failed: " + e.message); }
  };

  const copyUrl = (code) => {
    navigator.clipboard.writeText(shortUrl(code)).then(() => { setCopiedId(code); setTimeout(() => setCopiedId(null), 2000); });
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImportError(""); setImporting(true);
    try {
      const text = await file.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch {
        throw new Error("Invalid file — must be a valid JSON file.");
      }
      // Accept either a single submission object or an array
      const items = Array.isArray(parsed) ? parsed : [parsed];
      if (!items.length) throw new Error("File contains no records.");
      let count = 0;
      for (const item of items) {
        const data   = item.data   ?? item;           // support flat or {data, photos}
        const photos = item.photos ?? [];
        await api.importFieldSubmission(data, photos);
        count++;
      }
      await load();
      alert(`Successfully imported ${count} submission${count !== 1 ? "s" : ""}.`);
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const isAdmin = user?.role === "admin" || user?.role === "super_user";

  return (
    <div>
      {/* ── Mobile Collection Links (admin only) ── */}
      {isAdmin && (
        <div style={{ background: "linear-gradient(135deg,#0f1f3d,#1a3a6b)", borderRadius: 14, padding: "20px 22px", marginBottom: 24, color: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,0.18)" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>📱 Mobile Collection Links</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>Share with field staff — no login needed</div>
            </div>
            <button onClick={() => setShowLinkForm(f => !f)}
              style={{ padding: "8px 16px", background: showLinkForm ? "rgba(255,255,255,0.1)" : "#1a73e8", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
              {showLinkForm ? "✕ Cancel" : "+ New Link"}
            </button>
          </div>

          {/* New link form */}
          {showLinkForm && (
            <div style={{ background: "rgba(0,0,0,0.25)", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 10 }}>CREATE NEW LINK</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>LABEL (optional)</div>
                  <input value={newLinkLabel} onChange={e => setNewLinkLabel(e.target.value)}
                    placeholder="e.g. Pokhara team"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.2)", background: "#fff", color: "#0f1f3d", fontSize: 13, boxSizing: "border-box", outline: "none" }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>TYPE</div>
                  <div style={{ display: "flex", gap: 0, borderRadius: 7, overflow: "hidden", border: "1px solid rgba(255,255,255,0.2)" }}>
                    {["permanent","temporary"].map(t => (
                      <button key={t} onClick={() => setNewLinkType(t)}
                        style={{ padding: "8px 14px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: newLinkType === t ? "#1a73e8" : "rgba(255,255,255,0.08)", color: "#fff" }}>
                        {t === "permanent" ? "♾ Permanent" : "⏱ Temporary"}
                      </button>
                    ))}
                  </div>
                </div>
                {newLinkType === "temporary" && (
                  <div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>EXPIRES IN</div>
                    <select value={newLinkDays} onChange={e => setNewLinkDays(e.target.value)}
                      style={{ padding: "8px 10px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 13, outline: "none" }}>
                      <option value={1}>1 day</option>
                      <option value={3}>3 days</option>
                      <option value={7}>7 days</option>
                      <option value={14}>14 days</option>
                      <option value={30}>30 days</option>
                    </select>
                  </div>
                )}
                <button onClick={createLink} disabled={genLoading}
                  style={{ padding: "8px 18px", background: "#22c55e", border: "none", borderRadius: 7, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
                  {genLoading ? "Creating…" : "⚡ Create"}
                </button>
              </div>
            </div>
          )}

          {/* Links list */}
          {linksLoaded && links.length === 0 && !showLinkForm && (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontStyle: "italic", textAlign: "center", padding: "8px 0" }}>
              No links yet. Click "+ New Link" to create one.
            </div>
          )}

          {links.map(lnk => {
            const url    = shortUrl(lnk.short_code);
            const isCopied = copiedId === lnk.short_code;
            const isQr   = showQrId === lnk.short_code;
            const expired = lnk.expires_at && new Date(lnk.expires_at) < new Date();
            const expiresLabel = lnk.expires_at
              ? (expired ? "⛔ Expired" : `⏱ Expires ${new Date(lnk.expires_at).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"})}`)
              : "♾ Permanent";

            return (
              <div key={lnk.id} style={{ background: expired ? "rgba(180,0,0,0.18)" : "rgba(0,0,0,0.22)", borderRadius: 10, padding: "10px 14px", marginBottom: 8, opacity: expired ? 0.7 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {/* Label + type badge */}
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#fff" }}>{lnk.label || "Collection Link"}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 1 }}>{expiresLabel}</div>
                  </div>
                  {/* Short URL */}
                  <div style={{ fontFamily: "monospace", fontSize: 13, color: "#7dd3fc", background: "rgba(0,0,0,0.3)", borderRadius: 6, padding: "4px 10px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>
                    {url.replace(/^https?:\/\//, "")}
                  </div>
                  {/* Actions */}
                  <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                    <button onClick={() => copyUrl(lnk.short_code)}
                      style={{ padding: "5px 12px", background: isCopied ? "#22c55e" : "#1a73e8", border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                      {isCopied ? "✓" : "Copy"}
                    </button>
                    {navigator.share && (
                      <button onClick={() => navigator.share({ title: lnk.label || "Field Collection", url }).catch(() => {})}
                        style={{ padding: "5px 10px", background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 12 }}>
                        Share
                      </button>
                    )}
                    <button onClick={() => setShowQrId(isQr ? null : lnk.short_code)}
                      style={{ padding: "5px 10px", background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 12 }}>
                      QR
                    </button>
                    <button onClick={() => deactivateLink(lnk.id)}
                      style={{ padding: "5px 10px", background: "rgba(200,0,0,0.35)", border: "none", borderRadius: 6, color: "#ffaaaa", cursor: "pointer", fontSize: 12 }}>
                      ✕
                    </button>
                  </div>
                </div>
                {/* QR panel */}
                {isQr && (
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ background: "#fff", borderRadius: 8, padding: 6, display: "inline-block" }}>
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(url)}`}
                        alt="QR" width={110} height={110} style={{ display: "block" }} />
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
                      Scan with any phone camera<br />to open the collection form.<br />
                      <span style={{ fontFamily: "monospace", color: "#7dd3fc", fontSize: 11 }}>{url}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Submissions list ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <h2 style={S.sectionTitle}>Field Submissions</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button style={S.btnImport} onClick={() => fileInputRef.current?.click()} disabled={importing}>
            {importing ? "Importing…" : "📂 Add from File"}
          </button>
          <input ref={fileInputRef} type="file" accept=".json,application/json"
            style={{ display: "none" }} onChange={handleImportFile} />
          <button style={S.btnRefresh} onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {/* ── Tabs ── */}
      {(() => {
        const counts = { pending: 0, pulled: 0, rejected: 0 };
        submissions.forEach(s => { if (counts[s.status] !== undefined) counts[s.status]++; });
        const tabs = [
          { key: "pending",  label: "Pending",  count: counts.pending,  color: "#e65100", bg: "#fff3e0" },
          { key: "pulled",   label: "Used",     count: counts.pulled,   color: "#2e7d32", bg: "#e8fdf0" },
          { key: "rejected", label: "Rejected", count: counts.rejected, color: "#c0392b", bg: "#fdecea" },
        ];
        return (
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                padding: "7px 16px", borderRadius: 20, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13,
                background: activeTab === t.key ? t.color : "#f1f3f5",
                color: activeTab === t.key ? "#fff" : "#555",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {t.label}
                <span style={{ background: activeTab === t.key ? "rgba(255,255,255,0.25)" : t.bg, color: activeTab === t.key ? "#fff" : t.color, borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>{t.count}</span>
              </button>
            ))}
            {activeTab === "rejected" && isAdmin && submissions.filter(s => s.status === "rejected").length > 0 && (
              <button onClick={exportRejected} style={{ marginLeft: "auto", padding: "7px 14px", background: "#0f1f3d", color: "#fff", border: "none", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                ⬇ Export CSV
              </button>
            )}
          </div>
        );
      })()}

      {importError && (
        <div style={{ ...S.errorBox, marginBottom: 14 }}>⚠ {importError}
          <button onClick={() => setImportError("")} style={{ marginLeft: 10, background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>✕</button>
        </div>
      )}

      {error && <div style={S.errorBox}>{error}</div>}

      {loading ? (
        <div style={S.center}>Loading…</div>
      ) : (() => {
        const filtered = submissions.filter(s => s.status === activeTab);
        if (filtered.length === 0) return (
          <div style={S.empty}>
            <p>No {activeTab} submissions.</p>
          </div>
        );
        return (
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  {activeTab === "rejected"
                    ? ["#", "Submitted By", "Client", "Location", "Bank", "Rejected By", "Rejection Reason", "Date", ""].map(h => <th key={h} style={S.th}>{h}</th>)
                    : ["#", "Submitted By", "Client", "Location", "Bank", "Branch", "Status", "Date", ""].map(h => <th key={h} style={S.th}>{h}</th>)
                  }
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} style={i % 2 === 0 ? S.trEven : S.trOdd}>
                    <td style={S.td}>{s.id}</td>
                    <td style={S.td}>{s.submitter_name || "—"}</td>
                    <td style={{ ...S.td, fontWeight: 500 }}>{s.client_name || "—"}</td>
                    <td style={S.td}>{s.location || "—"}</td>
                    <td style={S.td}>{s.bank || "—"}</td>
                    {activeTab === "rejected" ? (
                      <>
                        <td style={S.td}>{s.rejected_by_username || "—"}</td>
                        <td style={{ ...S.td, color: "#c0392b", fontStyle: "italic" }}>{s.rejection_reason || "—"}</td>
                      </>
                    ) : (
                      <>
                        <td style={S.td}>{s.branch || "—"}</td>
                        <td style={S.td}>
                          <span style={{ ...S.badge, ...(s.status === "pulled" ? S.badgePulled : S.badgePending) }}>
                            {s.status === "pulled" ? "Used" : "Pending"}
                          </span>
                        </td>
                      </>
                    )}
                    <td style={{ ...S.td, fontSize: 12, color: "#888", whiteSpace: "nowrap" }}>
                      {fmtDate(s.created_at)}
                    </td>
                    <td style={{ ...S.td, whiteSpace: "nowrap" }}>
                      <button style={S.btnView} onClick={() => openDetail(s.id)}>View</button>
                      {activeTab !== "rejected" && (
                        <button style={S.btnUse} onClick={() => handleUse(s)}>Use for Report</button>
                      )}
                      {activeTab === "pending" && (
                        <button style={S.btnReject} onClick={() => { setRejectId(s.id); setRejectReason(""); }}>Reject</button>
                      )}
                      {isAdmin && <button style={S.btnDel} onClick={() => setDelId(s.id)}>✕</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* ── Detail modal ── */}
      {viewId && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ margin: 0, color: "#0f1f3d" }}>Field Submission #{viewId}</h3>
              <button onClick={() => { setViewId(null); setDetail(null); }} style={S.closeBtn}>✕</button>
            </div>
            {detailLoading ? (
              <div style={S.center}>Loading…</div>
            ) : detail ? (
              <div>
                <DataRow label="Submitted By"  value={detail.submitter_name} />
                <DataRow label="Client Name"   value={detail.data?.clientName} />
                <DataRow label="Owner Name"    value={detail.data?.ownerName} />
                <DataRow label="Visit Date"    value={detail.data?.visitDate} />
                <DataRow label="Bank"          value={detail.data?.bank} />
                <DataRow label="Branch"        value={detail.data?.branch} />
                <DataRow label="Location"      value={detail.data?.location} />
                <DataRow label="Plot No.(s)"
                  value={
                    Array.isArray(detail.data?.plotNos) && detail.data.plotNos.length
                      ? detail.data.plotNos.join(", ")
                      : detail.data?.plotNo || null
                  } />
                <DataRow label="GPS"           value={detail.data?.lat ? `${detail.data.lat}, ${detail.data.lng}` : null} />
                <DataRow label="Plus Code"     value={detail.data?.googlePlusCode} />
                <DataRow label="Hazards"       value={[
                    detail.data?.hazards?.highTensionLine && ("High Tension Line" + (detail.data.hazards.highTensionLineComment ? ` — ${detail.data.hazards.highTensionLineComment}` : "")),
                    detail.data?.hazards?.river           && ("River"             + (detail.data.hazards.riverComment           ? ` — ${detail.data.hazards.riverComment}`           : "")),
                    detail.data?.hazards?.kuloKholchi     && ("Kulo / Kholchi"    + (detail.data.hazards.kuloKholchiComment     ? ` — ${detail.data.hazards.kuloKholchiComment}`     : "")),
                  ].filter(Boolean).join(" | ") || null} />
                <DataRow label="Land Rate"     value={detail.data?.landMarketRate ? `Rs. ${Number(detail.data.landMarketRate).toLocaleString()} / sq.m` : null} />
                <DataRow label="Building Rate" value={detail.data?.buildingRate    ? `Rs. ${Number(detail.data.buildingRate).toLocaleString()} / sq.ft` : null} />
                <DataRow label="Notes"         value={detail.data?.notes} />
                <DataRow label="Submitted"     value={fmtDate(detail.created_at)} />
                <DataRow label="Status"        value={detail.status === "pulled" ? "Already used for a report" : "Pending"} />

                {detail.photos?.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                      Photos ({detail.photos.length})
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px,1fr))", gap: 8 }}>
                      {detail.photos.map((src, i) => (
                        <img key={i} src={src} alt=""
                          style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 6, border: "1px solid #ddd", cursor: "pointer" }}
                          onClick={() => window.open(src, "_blank")} />
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  {detail?.status !== "rejected" && (
                    <button style={S.btnUseModal} onClick={() => handleUse(submissions.find(s => s.id === viewId) || { id: viewId })}>
                      Use for Report →
                    </button>
                  )}
                  {detail?.status === "pending" && (
                    <button style={{ padding: "9px 18px", background: "#c0392b", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 14 }}
                      onClick={() => { setRejectId(viewId); setRejectReason(""); }}>
                      ✕ Reject
                    </button>
                  )}
                  {isAdmin && <button style={S.btnDelModal} onClick={() => setDelId(viewId)}>Delete</button>}
                  <button style={S.btnCancel} onClick={() => { setViewId(null); setDetail(null); }}>Close</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Reject confirm ── */}
      {rejectId && (() => {
        const sub = submissions.find(s => s.id === rejectId);
        const iField = (label, key, placeholder, type = "text") => (
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>{label}</label>
            <input
              type={type}
              value={rejectExtra[key]}
              onChange={e => setRejectExtra(prev => ({ ...prev, [key]: e.target.value }))}
              placeholder={placeholder}
              style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #ddd", borderRadius: 7, fontSize: 13, boxSizing: "border-box", fontFamily: "inherit" }}
            />
          </div>
        );
        return (
          <div style={S.overlay}>
            <div style={{ ...S.modal, maxWidth: 500 }}>
              {/* Header */}
              <div style={{ background: "linear-gradient(135deg,#c0392b,#e74c3c)", borderRadius: "10px 10px 0 0", margin: "-24px -28px 18px", padding: "16px 22px", color: "#fff" }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>🚫 Reject Submission #{rejectId}</div>
                {sub && <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{sub.client_name || sub.submitter_name || ""}</div>}
              </div>

              {/* Plot No. — confirm from field data */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 5 }}>
                  Plot No. <span style={{ fontWeight: 400, color: "#aaa", textTransform: "none", fontSize: 10 }}>(pre-filled from field data — correct if needed)</span>
                </label>
                <input
                  type="text"
                  value={rejectExtra.plotNo}
                  onChange={e => setRejectExtra(prev => ({ ...prev, plotNo: e.target.value }))}
                  placeholder="e.g. 523"
                  style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #c8d6ea", borderRadius: 8, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit", background: rejectExtra.plotNo ? "#f0f7ff" : "#fff", fontWeight: rejectExtra.plotNo ? 600 : 400 }}
                />
              </div>

              {/* Reason */}
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 6 }}>Reason for Rejection <span style={{ color: "#c0392b" }}>*</span></label>
              <textarea
                autoFocus
                rows={3}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="e.g. Incomplete data, wrong location, photos missing…"
                style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e0b0b0", borderRadius: 8, fontSize: 13, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }}
              />
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
                <button style={S.btnCancel} onClick={() => { setRejectId(null); setRejectReason(""); setRejectExtra({ plotNo: "" }); }}>Cancel</button>
                <button
                  disabled={!rejectReason.trim() || rejecting}
                  onClick={handleReject}
                  style={{ padding: "9px 20px", background: rejectReason.trim() ? "#c0392b" : "#ccc", color: "#fff", border: "none", borderRadius: 7, cursor: rejectReason.trim() ? "pointer" : "default", fontWeight: 700, fontSize: 14 }}>
                  {rejecting ? "Rejecting…" : "Confirm Rejection"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Delete confirm ── */}
      {delId && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 360 }}>
            <h3 style={{ marginBottom: 10 }}>Delete submission #{delId}?</h3>
            <p style={{ color: "#555", marginBottom: 20 }}>This cannot be undone.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={S.btnCancel} onClick={() => setDelId(null)}>Cancel</button>
              <button style={S.btnDelConfirm} onClick={() => handleDelete(delId)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DataRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 12, padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.4px", minWidth: 100 }}>{label}</span>
      <span style={{ fontSize: 14, color: "#333", flex: 1 }}>{value}</span>
    </div>
  );
}

const S = {
  linkBox: { background: "#f8f9ff", border: "1px solid #d0d9f0", borderRadius: 10, padding: "18px 20px", marginBottom: 28 },
  btnGenerate: { padding: "10px 20px", background: "#0f1f3d", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 },
  linkInput: { flex: 1, minWidth: 200, padding: "9px 12px", border: "1px solid #ccc", borderRadius: 6, fontSize: 13, background: "#fff" },
  btnCopy: { padding: "9px 16px", background: "#27ae60", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 },
  sectionTitle: { fontSize: 20, fontWeight: 700, color: "#0f1f3d", margin: 0 },
  btnRefresh: { padding: "7px 14px", background: "#f1f3f5", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  btnImport:  { padding: "7px 16px", background: "#0f1f3d", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 },
  errorBox: { background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 8, padding: "12px 16px", marginBottom: 16, color: "#7a5000" },
  center: { textAlign: "center", padding: 40, color: "#888" },
  empty:  { textAlign: "center", padding: "48px 20px", color: "#555" },
  tableWrap: { overflowX: "auto", borderRadius: 10, border: "1px solid #e5e7eb" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: { background: "#0f1f3d", color: "#fff", padding: "12px 14px", textAlign: "left", fontWeight: 600, whiteSpace: "nowrap" },
  td: { padding: "11px 14px", color: "#333", borderBottom: "1px solid #f0f0f0" },
  trEven: { background: "#fff" },
  trOdd:  { background: "#fafafa" },
  badge: { padding: "3px 9px", borderRadius: 20, fontSize: 12, fontWeight: 600 },
  badgePending: { background: "#fff3e0", color: "#e65100" },
  badgePulled:  { background: "#e8fdf0", color: "#2e7d32" },
  btnView: { background: "#0f1f3d", color: "#fff", border: "none", borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 12, marginRight: 5 },
  btnUse:  { background: "#c9922a", color: "#fff", border: "none", borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 12, marginRight: 5, fontWeight: 600 },
  btnDel:    { background: "transparent", color: "#c0392b", border: "1px solid #c0392b", borderRadius: 5, padding: "4px 8px", cursor: "pointer", fontSize: 12 },
  btnReject: { background: "#fdecea", color: "#c0392b", border: "1px solid #e8a09a", borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600, marginRight: 5 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 },
  modal: { background: "#fff", borderRadius: 12, padding: "24px 28px", width: "100%", maxWidth: 560, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" },
  closeBtn: { background: "#f0f2f6", border: "none", borderRadius: 6, width: 30, height: 30, cursor: "pointer", fontSize: 14, color: "#666" },
  btnUseModal: { padding: "9px 20px", background: "#c9922a", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 14 },
  btnDelModal: { padding: "9px 16px", background: "#fff", color: "#c0392b", border: "1px solid #c0392b", borderRadius: 7, cursor: "pointer", fontSize: 14 },
  btnCancel: { padding: "9px 18px", border: "1px solid #ccc", borderRadius: 7, background: "#fff", cursor: "pointer", fontSize: 14 },
  btnDelConfirm: { padding: "9px 18px", background: "#c0392b", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 600 },
};
