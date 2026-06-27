import React, { useState, useCallback, useRef, useEffect } from "react";
import { api } from "../services/api";
import { DevCredit } from "../components/ui/DeveloperCard";

// ─── Constants & Helpers ─────────────────────────────────────────────────────
import {
  BANKS, LAND_TYPES, LAND_CATEGORIES, OWNERSHIP_TYPES,
  FACE_DIRECTIONS, STRUCTURE_TYPES, FOUNDATION_TYPES,
  uid, floorName, emptyDirector,
  emptyClient, emptyProperty, emptyBuildingArea, emptyBuilding
} from "../constants";

// ─── Area Conversions ─────────────────────────────────────────────────────────
import {
  AANA_TO_SQM, DHUR_TO_SQM,
  sqmToRadp, sqmToAana, sqmToBkd, sqmToDhur, propAreaSqm, areaDisplay, rateUnitFactor, rateUnitLabel
} from "../utils/areaConversions";

// ─── Number Words ─────────────────────────────────────────────────────────────
import { toWords } from "../utils/numberWords";

// ─── BS Date Utilities ────────────────────────────────────────────────────────
import { bsToAd, adToBs, parseBsStr } from "../utils/bsDate";

// ─── Image & Map Utilities ────────────────────────────────────────────────────
import { compressImageFile } from "../utils/imageUtils";
import { captureAllMapSnapshots } from "../utils/mapUtils";

// ─── PDF Utilities ────────────────────────────────────────────────────────────
import { expandPdfLegalDocs, expandPdfSitePlans, renderPdfPages } from "../utils/pdfUtils";

// ─── Report Builders ─────────────────────────────────────────────────────────

// ─── Components ──────────────────────────────────────────────────────────────
import NepaliDatePicker from "../components/NepaliDatePicker";
import PropertyMap from "../components/PropertyMap";
import PhotoEditor from "../components/PhotoEditor";
import LetterheadSetup from "../components/LetterheadSetup";
import ReportSection from "../components/ReportSection";
import { Field, SectionHeader, PersonForm } from "../components/FormComponents";

// ─── Default specs: RCC building, Kathmandu ──────────────────────────────────
const RCC_KTM_DEFAULTS = {
  minColumn:          "12×12 inch",
  minBeam:            "9×12 inch",
  dpcTieBeam:         "4 inch DPC / 9×9 inch Tie Beam",
  slabThickness:      "5 inch",
  externalWall:       "9 inch brick masonry in cement mortar (1:6)",
  internalWall:       "4.5 inch brick masonry in cement mortar (1:4)",
  doorMaterial:       "Wood",
  windowMaterial:     "Wood",
  staircase:          "RCC slab type staircase",
  roof:               "RCC flat roof with waterproofing and top floor Roof Light gauge structure",
  externalFinishing:  "2-coat cement plaster with weather coat/snowcem paint",
  internalFinishing:  "2-coat cement plaster with emulsion/distemper paint",
  flooring:           "Ceramic tiles",
  verandah:           "Ceramic tiles",
  kitchen:            "Ceramic tiles",
  bathroom:           "Ceramic tiles, EWC, wash basin, shower",
  sanitary:           "PPR pipe with EWC, wash basin, shower",
  electricitySystem:  "Single phase NEA connection",
  ugWaterTank:        "Available",
  ohWaterTank:        "Available",
  solarPanel:         "Not Available",
  buildingPermit:     "Available",
  nbcCompliance:      "Yes",
  setback:            "Maintained",
  ceiling:            "Cement plaster with emulsion paint",
  lift:               "Not Available",
  generator:          "Not Available",
  parking:            "Available — 150 sq ft",
  compoundWall:       "Available",
  sewerage:           "Septic tank",
  waterSupply:        "KUKL/Municipality water supply",
  deepBoring:         "Not Available",
  defects:            "None observed. The building is in good structural condition with no visible cracks, dampness, settlement, tilting or spalling.",
  repairMaintenance:  "None required at present. The building is well-maintained and in good overall condition.",
  comments:           "The building is structurally sound and in good overall condition. Construction quality is satisfactory.",
};

// Parse "9'5"" or "9.5" → decimal feet
function parseFtIn(val) {
  if (!val) return 0;
  const m = String(val).match(/^(\d+(?:\.\d+)?)'(\d+(?:\.\d+)?)"?$/);
  if (m) return parseFloat(m[1]) + parseFloat(m[2]) / 12;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}
// Format decimal feet → e.g. "28'3""
function fmtFtIn(ft) {
  if (!ft) return "";
  const totalIn = Math.round(ft * 12);
  return `${Math.floor(totalIn / 12)}'${totalIn % 12}"`;
}

export default function ValuationForm({ reportId: initialReportId, initialState, onSavedToDb, onBack, user, onLogout }) {
  // ── DB integration ──────────────────────────────────────────
  const [reportId, setReportId] = React.useState(initialReportId || null);
  const [dbSaving, setDbSaving] = React.useState(false);
  const [dbMsg, setDbMsg] = React.useState("");

  // Load initialState if provided (opening existing report)
  React.useEffect(() => {
    if (!initialState) return;
    const s = initialState;
    if (s.bank)       setBank(s.bank);
    if (s.branch)     setBranch(s.branch);
    if (s.visitDate)  setVisitDate(s.visitDate);
    if (s.reportDate) setReportDate(s.reportDate);
    if (s.reportType) setReportType(s.reportType);
    if (s.clients)    setClients(s.clients);
    if (s.owners)     setOwners(s.owners);
    if (typeof s.isBuySell !== "undefined") setIsBuySell(s.isBuySell);
    if (s.properties) setProperties(s.properties);
    if (s.buildings)  setBuildings(s.buildings);
    if (typeof s.hasBuilding !== "undefined") setHasBuilding(s.hasBuilding);
    if (s.mortgagedIds) setMortgagedIds(new Set(s.mortgagedIds));
    if (s.areaMeasured) setAreaMeasured(s.areaMeasured);
    if (s.deductions)   setDeductions(s.deductions);
    if (s.rates)        setRates(s.rates);
    if (s.plotRateSplits) setPlotRateSplits(s.plotRateSplits);
    if (s.access)       setAccess(s.access);
    if (s.roadAccess)   setRoadAccess(s.roadAccess);
    if (s.buildingVals) setBuildingVals(s.buildingVals);
    if (typeof s.commercialPct !== "undefined") setCommercialPct(s.commercialPct);
    if (s.remarks)      setRemarks(s.remarks);
    if (s.limitingConditions) setLimitingConditions(s.limitingConditions);
    if (s.includeLimitingConditions !== undefined) setIncludeLimitingConditions(s.includeLimitingConditions);
    if (s.propDescriptions)   setPropDescriptions(s.propDescriptions);
    if (s.photos)       setPhotos(s.photos);
    if (s.sitePlans)    setSitePlans(s.sitePlans);
    if (s.legalDocs)    setLegalDocs(s.legalDocs);
    if (s.valuatorInfo) setValuatorInfo(s.valuatorInfo);
    if (s.buildingDetails) setBuildingDetails(s.buildingDetails);
    // letterhead now comes from server (company profile), not from saved state
  }, [initialState]);

  // ── /DB integration ─────────────────────────────────────────

  // 1. Bank
  const [bank, setBank] = useState("");
  const [branch, setBranch] = useState("");
  // 2. Dates
  const [visitDate, setVisitDate] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [dateErrors, setDateErrors] = useState({ visit:"", report:"" });
  const todayAD = new Date(); todayAD.setHours(0,0,0,0);

  const handleVisitDate = (v) => {
    const d = new Date(v); d.setHours(0,0,0,0);
    let err = "";
    if (d > todayAD) err = "Field visit date cannot be in the future.";
    else if (reportDate) {
      const r = new Date(reportDate); r.setHours(0,0,0,0);
      if (d > r) err = "Field visit cannot be after the reporting date.";
    }
    setDateErrors(e=>({...e, visit: err}));
    if (reportDate) {
      const r = new Date(reportDate); r.setHours(0,0,0,0);
      setDateErrors(e=>({...e, report: r < d ? "Reporting date cannot be before the field visit date." : ""}));
    }
    setVisitDate(v);
  };

  const handleReportDate = (v) => {
    const d = new Date(v); d.setHours(0,0,0,0);
    let err = "";
    if (d > todayAD) err = "Reporting date cannot be in the future.";
    else if (visitDate) {
      const vd = new Date(visitDate); vd.setHours(0,0,0,0);
      if (d < vd) err = "Reporting date cannot be before the field visit date.";
    }
    setDateErrors(e=>({...e, report: err}));
    if (visitDate) {
      const vd = new Date(visitDate); vd.setHours(0,0,0,0);
      setDateErrors(e=>({...e, visit: vd > d ? "Field visit cannot be after the reporting date." : ""}));
    }
    setReportDate(v);
  };
  // 3.1 Clients (multiple)
  const [clients, setClients] = useState([emptyClient()]);
  // 3.1b Owners (multiple)
  const [owners, setOwners] = useState([emptyClient()]);
  // Buy/Sell mode: client = buyer, owner = seller
  const [isBuySell, setIsBuySell] = useState(false);
  // 3.2 Properties
  const [properties, setProperties] = useState([emptyProperty()]);
  // 3.3 Mortgage selection
  const [mortgagedIds, setMortgagedIds] = useState(new Set());
  // 4. Area Measurement
  const [areaMeasured, setAreaMeasured] = useState({});
  // 5. Deductions
  const [deductions, setDeductions] = useState({});
  // 6. Valuation rates
  const [rates, setRates] = useState({});
  const [plotRateSplits, setPlotRateSplits] = useState({});
  // 7. Access
  const [access, setAccess] = useState({});
  const [extraBoundaryRows, setExtraBoundaryRows] = useState([]);
  // road access rows per property: { [propId]: [{id, roadType, frontage, widthField, widthTrace, remarks}] }
  const [roadAccess, setRoadAccess] = useState({});
  // Buildings (multiple)
  const [buildings, setBuildings] = useState([]);
  const [hasBuilding, setHasBuilding] = useState(null); // null=unanswered, true, false
  // Building valuations (rates entered in valuation section, keyed by building id)
  const [buildingVals, setBuildingVals] = useState({});
  // Commercial valuation factor (% multiplier on FMV, default 110%)
  const [commercialPct, setCommercialPct] = useState("110");
  // Distress value weightage (% of FMV, default 80%)
  const [distressPct, setDistressPct] = useState("80");
  // Government value per property (keyed by property id, NPR/Aana)
  const [govValues, setGovValues] = useState({});
  // Remarks & limiting conditions (free text)
  const [remarks, setRemarks] = useState("The opinions of the value are based on the facts and assumptions identified in this report. To the best of our knowledge, all matters of a factual nature discussed in this report are true and correct. We have submitted the preliminary valuation report; it does not have any legal responsibility and is not for mortgaging purposes. It is just for your kind reference only. If the client submits all the required legal documents, then we will prepare the final valuation report as soon as possible.");
  const [limitingConditions, setLimitingConditions] = useState("");
  const [includeLimitingConditions, setIncludeLimitingConditions] = useState(false);
  // Bill fields
  const [fieldChargeReceived, setFieldChargeReceived] = useState(null); // null=unanswered, true, false
  const [fieldChargeAmount, setFieldChargeAmount]     = useState("3000"); // NPR — default Rs 3000
  const [transportationCharge, setTransportationCharge] = useState("");  // NPR
  const [billNo, setBillNo]                           = useState("");    // auto or manual
  const [includeVat, setIncludeVat]                   = useState(false); // 13% VAT
  const [billRemarks, setBillRemarks]                 = useState("");    // optional bill remark
  const [extraChargeLabel, setExtraChargeLabel]       = useState("");    // custom bill line item heading
  const [extraChargeAmount, setExtraChargeAmount]     = useState("");    // custom bill line item amount
  const [discountAmount, setDiscountAmount]           = useState("");    // discount on bill
  const [deductFieldVisit, setDeductFieldVisit]       = useState(true);  // deduct field visit as advance on bill
  const [billingSystem, setBillingSystem]             = useState("nva"); // "nva" = Nepal Valuators Assoc, "bank" = bank-specific tiers
  const [billQrCode, setBillQrCode]                   = useState("");    // payment QR code data URL
  const [amountReceived, setAmountReceived]           = useState("");    // advance / amount received from client
  // Final report extra fields
  // Letterhead — fetched from server (set by company admin/super_user via company profile)
  const [letterheadHtml, setLetterheadHtml] = useState("");
  const [letterheadPng, setLetterheadPng] = useState("");
  const [letterheadTextBox, setLetterheadTextBox] = useState(null); // {top,left,width,height} as %
  const [letterheadWatermarkBox, setLetterheadWatermarkBox] = useState(null); // {top,left,width,height,opacity} as %
  const [companyName, setCompanyName] = useState("");
  const [reportColorTheme, setReportColorTheme] = useState("blue");
  const saveLetterhead = async (png) => {
    try {
      await api.updateCompanyLetterhead(png);
      setLetterheadPng(png);
      setLetterheadHtml(png ? `<img src="${png}" style="width:100%;display:block;height:auto" alt="Company Letterhead"/>` : "");
    } catch (err) {
      showToast("⚠ Failed to save letterhead: " + (err.message || "Server error"));
    }
  };

  // Fetch company letterhead on mount — source of truth is always the company profile DB.
  // Super admin changes propagate automatically since we re-fetch on each report generation.
  useEffect(() => {
    api.getCompanyLetterhead()
      .then(data => {
        if (data.company_name) setCompanyName(data.company_name);
        if (data.letterhead_png) {
          setLetterheadPng(data.letterhead_png);
          setLetterheadHtml(`<img src="${data.letterhead_png}" style="width:100%;display:block;height:auto" alt="Company Letterhead"/>`);
        }
        if (data.letterhead_text_box) {
          setLetterheadTextBox(data.letterhead_text_box);
        }
        if (data.letterhead_watermark_box) {
          setLetterheadWatermarkBox(data.letterhead_watermark_box);
        }
        if (data.report_color_theme) setReportColorTheme(data.report_color_theme);
      })
      .catch(() => {}); // silent — letterhead will be re-fetched at report generation time
  }, []); // mount-only
  // 5B: Per-building technical details keyed by building id
  const [buildingDetails, setBuildingDetails] = useState({});
  const updBldDet = (bid, key, val) => setBuildingDetails(bd => ({...bd, [bid]: {...(bd[bid]||{}), [key]: val}}));

  // Auto-fill specs for a newly added building from the previous building (or RCC defaults)
  const PER_BUILDING_KEYS = new Set(["floorHeights","floorHeightRemarks","totalHeight"]);
  useEffect(() => {
    if (!buildings.length) return;
    setBuildingDetails(bd => {
      let changed = false;
      const next = { ...bd };
      buildings.forEach((b, i) => {
        if (next[b.id] && Object.keys(next[b.id]).some(k => !PER_BUILDING_KEYS.has(k) && next[b.id][k])) return;
        // Building has no specs yet — fill from previous building or RCC defaults
        const prevDet = i > 0 ? (next[buildings[i-1].id] || {}) : {};
        const template = { ...RCC_KTM_DEFAULTS };
        for (const [k, v] of Object.entries(prevDet))
          if (!PER_BUILDING_KEYS.has(k) && v) template[k] = v;
        next[b.id] = { ...(next[b.id] || {}), ...template };
        changed = true;
      });
      return changed ? next : bd;
    });
  }, [buildings]);
  const [propDescriptions, setPropDescriptions] = useState({}); // keyed by property id
  const updPropDesc = (pid, key, val) => setPropDescriptions(d => ({...d, [pid]: {...(d[pid]||{}), [key]: val}}));

  const [photos, setPhotos] = useState([]);
  const [guthiAlert, setGuthiAlert] = useState(null); // property id awaiting Guthi Raitani confirmation
  const [editingPhoto, setEditingPhoto] = useState(null); // { id, dataUrl } | null
  const [sitePlans, setSitePlans] = useState([]); // [{id, name, dataUrl}]
  const [legalDocs, setLegalDocs] = useState([]); // [{id, name, category, fileNo, date, issuedBy, remarks, dataUrl}] // [{id, caption, dataUrl}]
  const [viewerDoc, setViewerDoc] = useState(null); // { id, dataUrl, name } | null
  const [viewerRotation, setViewerRotation] = useState(0);
  // PDF viewer
  const [pdfPages, setPdfPages] = useState(null);    // [{pageNum, dataUrl}] | null
  const [pdfPageRotations, setPdfPageRotations] = useState([]); // per-page rotation degrees
  const [pdfLoading, setPdfLoading] = useState(false);
  // Refs to detect whether rotation changed after initial viewer open (skip first-load assignment)
  const viewerRotInitRef = useRef(null);
  const pdfRotInitRef = useRef(null);
  const [valuatorInfo, setValuatorInfo] = useState({ name:'', licenseNo:'', company:'', phone:'', email:'' });
  // Company valuators fetched from server (managed by admin)
  const [companyValuators, setCompanyValuators] = useState([]);
  useEffect(() => {
    api.getCompanyValuators()
      .then(data => {
        const list = data.valuators || [];
        setCompanyValuators(list);
        // Auto-select first valuator if none chosen yet
        if (list.length > 0 && !valuatorInfo.name) {
          setValuatorInfo(list[0]);
        }
      })
      .catch(() => {});
  }, []); // mount-only — intentionally no deps
  // Custom bank list — fetched from server (managed by company admin, read-only here)
  const [customBanks, setCustomBanks] = useState([]);
  useEffect(() => {
    api.getCompanyBanks()
      .then(data => setCustomBanks(data.banks || []))
      .catch(() => {
        // fallback: try sessionStorage for offline/legacy support
        try { setCustomBanks(JSON.parse(sessionStorage.getItem("ncc_custom_banks") || "[]")); } catch(_) {}
      });
  }, []);
  // UI
  const [activeSection, setActiveSection] = useState(1);
  const [reportType, setReportType] = useState("preliminary");
  const [toast, setToast] = useState("");

  // ── Autosave ──────────────────────────────────────────────
  const AUTOSAVE_KEY = "ncc_autosave_draft";
  const [autoSaveStatus, setAutoSaveStatus] = useState(null); // null | "pending" | "saving" | "saved" | "error"
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);
  const autoSaveTimer = useRef(null);
  // Keep a ref to reportId so the debounced callback always sees the latest value
  const reportIdRef = useRef(reportId);
  // finalFMValue is computed later in the render (after helper fns); ref lets collectState
  // read the current value without a TDZ ordering problem in the dependency array.
  const finalFMVRef = useRef(0);
  useEffect(() => { reportIdRef.current = reportId; }, [reportId]);

  // Load PDF pages when a PDF document is opened in the viewer
  useEffect(() => {
    // Reset auto-save init refs whenever the viewer doc changes
    viewerRotInitRef.current = null;
    pdfRotInitRef.current = null;

    if (!viewerDoc || !viewerDoc.dataUrl?.startsWith('data:application/pdf')) {
      setPdfPages(null);
      return;
    }
    let cancelled = false;
    setPdfLoading(true);
    setPdfPages(null);
    // Find saved per-page rotations — check sitePlans first, then legalDocs
    const savedSitePlan = sitePlans.find(sp => sp.id === viewerDoc.id);
    const savedDoc = savedSitePlan || legalDocs.find(d => d.id === viewerDoc.id);
    const saved = savedDoc?.pdfPageRotations || [];
    setPdfPageRotations(saved);
    renderPdfPages(viewerDoc.dataUrl, new Array(99).fill(0)) // render at 0°, apply rotation via CSS
      .then(pages => {
        if (!cancelled) { setPdfPages(pages); setPdfLoading(false); }
      })
      .catch(() => { if (!cancelled) { setPdfPages([]); setPdfLoading(false); } });
    return () => { cancelled = true; };
  }, [viewerDoc]); // sitePlans/legalDocs intentionally omitted — only read on open

  // Auto-save image rotation (viewerRotation) when user rotates in viewer
  useEffect(() => {
    if (!viewerDoc) return;
    if (viewerRotInitRef.current === null) {
      viewerRotInitRef.current = viewerRotation; // record initial value, don't save
      return;
    }
    if (viewerDoc.source === 'sitePlan') {
      setSitePlans(prev => prev.map(sp => sp.id === viewerDoc.id ? { ...sp, rotation: viewerRotation } : sp));
    } else {
      setLegalDocs(ds => ds.map(d => d.id === viewerDoc.id ? { ...d, rotation: viewerRotation } : d));
    }
  }, [viewerRotation]); // viewerDoc intentionally omitted — ref handles freshness

  // Auto-save PDF per-page rotations when user rotates a page
  useEffect(() => {
    if (!viewerDoc) return;
    if (pdfRotInitRef.current === null) {
      pdfRotInitRef.current = pdfPageRotations; // record initial value, don't save
      return;
    }
    if (viewerDoc.source === 'sitePlan') {
      setSitePlans(prev => prev.map(sp => sp.id === viewerDoc.id ? { ...sp, pdfPageRotations: [...pdfPageRotations] } : sp));
    } else {
      setLegalDocs(ds => ds.map(d => d.id === viewerDoc.id ? { ...d, pdfPageRotations: [...pdfPageRotations] } : d));
    }
  }, [pdfPageRotations]); // viewerDoc intentionally omitted — ref handles freshness

  // On mount: check for a sessionStorage draft (fallback from a failed DB autosave).
  // sessionStorage is tab-scoped and cleared when the browser tab closes, preventing
  // sensitive financial data from persisting across sessions on shared machines.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(AUTOSAVE_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (!initialState && draft._savedAt && (draft.bank || draft.branch || (draft.clients||[]).some(c=>c.person?.name||c.company?.name))) {
          setShowRestoreBanner(true);
        }
      }
    } catch(e) { /* ignore */ }
  }, []); // mount-only

  // Core autosave function — saves to DB, falls back to sessionStorage on failure
  const doAutosave = useCallback(async (stateFn, filenameFn) => {
    setAutoSaveStatus("saving");
    const state = stateFn();
    const filename = filenameFn("json");
    const currentReportId = reportIdRef.current;
    try {
      if (currentReportId) {
        await api.updateReport(currentReportId, state, filename);
      } else {
        const res = await api.saveReport(state, filename);
        // Persist the new ID so subsequent autosaves update instead of insert
        setReportId(res.id);
        reportIdRef.current = res.id;
        if (onSavedToDb) onSavedToDb(res.id);
      }
      // DB save succeeded — clear any sessionStorage fallback draft
      try { sessionStorage.removeItem(AUTOSAVE_KEY); } catch(e) { /* ignore */ }
      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus(s => s === "saved" ? null : s), 4000);
    } catch(e) {
      // DB unavailable — fall back to sessionStorage so work isn't lost within this tab
      try {
        const payload = { ...state, _savedAt: new Date().toISOString() };
        sessionStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
      } catch(le) { /* ignore */ }
      setAutoSaveStatus("error");
      setTimeout(() => setAutoSaveStatus(s => s === "error" ? null : s), 5000);
    }
  }, [onSavedToDb]); // setReportId is stable

  // Debounced scheduler — resets the 5s timer on every state change
  const scheduleAutosave = useCallback((stateFn, filenameFn) => {
    setAutoSaveStatus("pending");
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      doAutosave(stateFn, filenameFn);
    }, 5000);
  }, [doAutosave]);

  // Watch all form state and schedule autosave on change
  useEffect(() => {
    scheduleAutosave(collectState, getFileName);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [bank, branch, visitDate, reportDate, reportType, clients, owners, properties,
      buildings, hasBuilding, mortgagedIds, areaMeasured, deductions, rates,
      plotRateSplits, access, roadAccess, buildingVals, commercialPct, distressPct,
      govValues, remarks, limitingConditions, includeLimitingConditions, propDescriptions, photos, sitePlans, legalDocs,
      valuatorInfo, buildingDetails, customBanks,
      fieldChargeReceived, fieldChargeAmount, transportationCharge, billNo, includeVat, billRemarks,
      extraChargeLabel, extraChargeAmount]); // scheduleAutosave, collectState, getFileName are stable refs

  const clearAutosave = useCallback(() => {
    try { sessionStorage.removeItem(AUTOSAVE_KEY); } catch(e) { /* ignore */ }
    setAutoSaveStatus(null);
    setShowRestoreBanner(false);
  }, []);

  const restoreAutosave = useCallback(() => {
    try {
      const raw = sessionStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      loadJsonData(JSON.stringify(d), "autosave");
      clearAutosave();
      showToast("✓ Draft restored from autosave");
    } catch(e) {
      showToast("⚠ Could not restore autosave: " + e.message);
    }
  }, [clearAutosave]); // loadJsonData and showToast are stable

  // ── File name generator ──
  const getFileName = useCallback((ext) => {
    const clientNames = clients.map(cl => {
      const parts = [];
      if (cl.showPerson && cl.person.name) parts.push(cl.person.name.trim().replace(/\s+/g,"-"));
      if (cl.showCompany && cl.company.name) parts.push(cl.company.name.trim().replace(/\s+/g,"-"));
      return parts.join("_");
    }).filter(Boolean).join("_") || "client";
    const bankPart = (bank || "bank").replace(/\s+/g,"-");
    const branchPart = (branch || "branch").replace(/\s+/g,"-");
    const datePart = reportDate ? reportDate.replace(/-/g,".") : "no-date";
    return `${clientNames}.${bankPart}.${branchPart}.${datePart}-${reportType}.${ext}`;
  }, [clients, bank, branch, reportDate, reportType]);

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(""), 3500); };

  // ── Collect all state ──
  const collectState = useCallback(() => ({
    _version: 1,
    bank, branch, visitDate, reportDate, reportType,
    clients, owners, isBuySell, properties, buildings, hasBuilding,
    mortgagedIds: [...mortgagedIds],
    areaMeasured, deductions, rates, plotRateSplits, access, roadAccess, buildingVals, extraBoundaryRows,
    commercialPct, distressPct, govValues, remarks, limitingConditions, includeLimitingConditions,
    propDescriptions, photos, sitePlans, legalDocs, valuatorInfo,
    buildingDetails,
    fieldChargeReceived, fieldChargeAmount, transportationCharge,
    billNo, includeVat, billRemarks, extraChargeLabel, extraChargeAmount, discountAmount, deductFieldVisit, billingSystem, billQrCode, amountReceived,
    finalFMV: finalFMVRef.current,
    // letterheadHtml and letterheadTextBox are intentionally excluded here.
    // They are stored in the company profile (DB) and always fetched fresh
    // from the server. Saving them per-report would embed a large base64 PNG
    // in every report snapshot and prevent the super admin's changes from
    // taking effect on existing reports.
    customBanks,
  }), [bank, branch, visitDate, reportDate, reportType, clients, owners, isBuySell, properties, buildings, hasBuilding, mortgagedIds, areaMeasured, deductions, rates, plotRateSplits, access, roadAccess, buildingVals, extraBoundaryRows, commercialPct, distressPct, govValues, remarks, limitingConditions, includeLimitingConditions, propDescriptions, photos, sitePlans, legalDocs, valuatorInfo, buildingDetails, customBanks, fieldChargeReceived, fieldChargeAmount, transportationCharge, billNo, includeVat, billRemarks, extraChargeLabel, extraChargeAmount, discountAmount, deductFieldVisit, billingSystem, billQrCode, amountReceived]);

  const handleSaveToDb = React.useCallback(async () => {
    setDbSaving(true);
    setDbMsg("");
    try {
      const state = collectState();
      const filename = getFileName("json");
      if (reportId) {
        await api.updateReport(reportId, state, filename);
        setDbMsg("✓ Updated in database");
      } else {
        const res = await api.saveReport(state, filename);
        setReportId(res.id);
        setDbMsg("✓ Saved to database (ID #" + res.id + ")");
        if (onSavedToDb) onSavedToDb(res.id);
      }
      clearAutosave();
    } catch (e) {
      setDbMsg("⚠ Save failed: " + e.message);
    } finally {
      setDbSaving(false);
      setTimeout(() => setDbMsg(""), 4000);
    }
  }, [collectState, getFileName, reportId, onSavedToDb]);

  // ── Save as JSON file (uses File System Access API where available, with download fallback) ──
  const handleSave = useCallback(async () => {
    const json = JSON.stringify(collectState(), null, 2);
    const filename = getFileName("json");

    // Try modern File System Access API first — lets user pick save location
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: "Valuation Report (JSON)",
            accept: { "application/json": [".json"] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        showToast("✓ File saved successfully");
        return;
      } catch (err) {
        if (err.name === "AbortError") return; // user cancelled
        console.warn("File System Access API failed, falling back:", err);
      }
    }

    // Fallback 1: Blob + object URL (works in regular browsers)
    try {
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0";
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 200);
      showToast("✓ Saved — check your Downloads folder");
      return;
    } catch (e) {
      console.warn("Blob download failed, trying data URI:", e);
    }

    // Fallback 2: data URI
    try {
      const link = document.createElement("a");
      link.href = "data:application/json;charset=utf-8," + encodeURIComponent(json);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("✓ Saved — check your Downloads folder");
    } catch (e) {
      showToast("⚠ Save failed: " + e.message);
    }
  }, [collectState, getFileName]);


  const loadJsonData = useCallback((text, filename) => {
    try {
      const d = JSON.parse(text);
      if (d._version !== 1) { showToast("⚠ Unrecognised file format"); return; }

      // ── Normalise data regardless of source (mobile app or desktop) ──
      // Ensure clients have proper structure
      const normalizeClient = (cl) => ({
        id: cl.id || uid(),
        showPerson: cl.showPerson ?? true,
        showCompany: cl.showCompany ?? false,
        person: {
          name: cl.person?.name||'', citizenshipNo: cl.person?.citizenshipNo||'',
          issuedDate: cl.person?.issuedDate||'', issuedBy: cl.person?.issuedBy||'',
          fatherName: cl.person?.fatherName||'', grandfatherName: cl.person?.grandfatherName||'',
          husbandName: cl.person?.husbandName||'', contact: cl.person?.contact||'',
          address: cl.person?.address||''
        },
        company: {
          name: cl.company?.name||'', panVat: cl.company?.panVat||'',
          regNo: cl.company?.regNo||'', regDate: cl.company?.regDate||'',
          regOn: cl.company?.regOn||'', address: cl.company?.address||'',
          contact: cl.company?.contact||'',
          directors: (cl.company?.directors||[]).map(dd=>({
            id: dd.id||uid(), name:dd.name||'', citizenshipNo:dd.citizenshipNo||'',
            issuedDate:dd.issuedDate||'', issuedBy:dd.issuedBy||'',
            address:dd.address||'', contact:dd.contact||'',
            fatherName:dd.fatherName||'', husbandName:dd.husbandName||'',
            grandfatherName:dd.grandfatherName||''
          }))
        }
      });

      // Normalise photos: accept [{id,caption,dataUrl}] or [{label,data}]
      const normalizePhotos = (arr) => (arr||[]).filter(Boolean).map(ph => ({
        id: ph.id||uid(),
        caption: ph.caption||ph.label||'Photo',
        dataUrl: ph.dataUrl||ph.data||''
      }));

      setBank(d.bank||"");
      setBranch(d.branch||"");
      setVisitDate(d.visitDate||"");
      setReportDate(d.reportDate||"");
      setReportType(d.reportType||"preliminary");
      setClients((d.clients||[emptyClient()]).map(normalizeClient));
      setOwners((d.owners||d.clients||[emptyClient()]).map(normalizeClient));
      setIsBuySell(d.isBuySell || false);
      setProperties(d.properties||[emptyProperty()]);
      setBuildings(d.buildings||[]);
      setHasBuilding(d.hasBuilding ?? null);
      setMortgagedIds(new Set(d.mortgagedIds||[]));
      setAreaMeasured(d.areaMeasured||{});
      setDeductions(d.deductions||{});
      setRates(d.rates||{});
      setPlotRateSplits(d.plotRateSplits||{});
      setAccess(d.access||{});
      setExtraBoundaryRows(d.extraBoundaryRows||[]);
      setRoadAccess(d.roadAccess||{});
      setBuildingVals(d.buildingVals||{});
      setCommercialPct(d.commercialPct||"110");
      if(d.distressPct !== undefined) setDistressPct(String(d.distressPct||"80"));
      if(d.govValues) setGovValues(d.govValues);
      setRemarks(d.remarks||"");
      setLimitingConditions(d.limitingConditions||"");
      if (d.includeLimitingConditions !== undefined) setIncludeLimitingConditions(d.includeLimitingConditions);
      // Support both old single propDescription and new per-property propDescriptions
      if (d.propDescriptions) {
        setPropDescriptions(d.propDescriptions);
      } else if (d.propDescription && Object.keys(d.propDescription).some(k=>d.propDescription[k])) {
        // Migrate old single description to first property
        const firstPid = (d.properties||[])[0]?.id;
        if (firstPid) setPropDescriptions({ [firstPid]: d.propDescription });
        else setPropDescriptions({});
      } else {
        setPropDescriptions({});
      }
      setPhotos(normalizePhotos(d.photos));
      setSitePlans((d.sitePlans||[]).map(sp=>({ id: sp.id||uid(), name: sp.name||'', dataUrl: sp.dataUrl||'', rotation: sp.rotation||0, pdfPageRotations: sp.pdfPageRotations||[] })));
      setLegalDocs((d.legalDocs||[]).map(doc=>({
        id: doc.id||uid(), name: doc.name||'', category: doc.category||'',
        fileNo: doc.fileNo||'', date: doc.date||'', issuedBy: doc.issuedBy||'',
        remarks: doc.remarks||'', dataUrl: doc.dataUrl||'', rotation: doc.rotation||0,
        pdfPageRotations: doc.pdfPageRotations||[],
      })));
      setValuatorInfo(d.valuatorInfo||{ name:'Er. Saakar Rimal', licenseNo:'11518 Civil "A"', company:'Neo-Civic Consulting (P). Ltd', phone:'', email:'' });
      setBuildingDetails(d.buildingDetails||{});
      if (d.fieldChargeReceived !== undefined) setFieldChargeReceived(d.fieldChargeReceived);
      if (d.fieldChargeAmount !== undefined) setFieldChargeAmount(d.fieldChargeAmount || "");
      if (d.transportationCharge !== undefined) setTransportationCharge(d.transportationCharge || "");
      if (d.billNo !== undefined) setBillNo(d.billNo || "");
      if (d.includeVat !== undefined) setIncludeVat(!!d.includeVat);
      if (d.billRemarks !== undefined) setBillRemarks(d.billRemarks || "");
      if (d.extraChargeLabel !== undefined) setExtraChargeLabel(d.extraChargeLabel || "");
      if (d.extraChargeAmount !== undefined) setExtraChargeAmount(d.extraChargeAmount || "");
      if (d.discountAmount !== undefined) setDiscountAmount(d.discountAmount || "");
      if (d.deductFieldVisit !== undefined) setDeductFieldVisit(d.deductFieldVisit !== false);
      if (d.billingSystem !== undefined) setBillingSystem(d.billingSystem || "nva");
      if (d.billQrCode !== undefined) setBillQrCode(d.billQrCode || "");
      if (d.amountReceived !== undefined) setAmountReceived(d.amountReceived || "");
      if(d.letterheadHtml !== undefined) { /* letterhead now comes from server, not saved state */ }
      if(d.customBanks) saveCustomBanks(d.customBanks);
      setActiveSection(1);
      const src = d._mobileState ? ' (from mobile app)' : '';
      showToast("✓ Loaded" + src + " — " + (filename || "file"));
      clearAutosave();
    } catch(err) {
      showToast("⚠ Could not read file: " + err.message);
    }
  }, []);


  // Pre-renders PDF legal docs to images for final reports (needed before HTML generation)
  const prepareFinalState = useCallback(async (state) => {
    // Always inject the letterhead from the company profile (not from saved state).
    // If the super admin has updated the letterhead, this ensures the new one is used.
    // We re-fetch from the API each time so the report always reflects the current
    // company letterhead, even if the session is long-running.
    try {
      const lhData = await api.getCompanyLetterhead();
      state.companyName = lhData.company_name || companyName;
      state.letterheadPng = lhData.letterhead_png || "";
      state.letterheadHtml = lhData.letterhead_png
        ? `<img src="${lhData.letterhead_png}" style="width:100%;display:block;height:auto" alt="Company Letterhead"/>`
        : "";
      state.letterheadTextBox = lhData.letterhead_text_box || null;
      state.letterheadWatermarkBox = lhData.letterhead_watermark_box || null;
      state.reportColorTheme = lhData.report_color_theme || "blue";
    } catch (_) {
      // Fall back to whatever is in component state (fetched on mount)
      state.companyName = companyName;
      state.letterheadPng = letterheadPng;
      state.letterheadHtml = letterheadHtml;
      state.letterheadTextBox = letterheadTextBox;
      state.letterheadWatermarkBox = letterheadWatermarkBox;
      state.reportColorTheme = reportColorTheme;
    }
    state.sitePlans = await expandPdfSitePlans(state.sitePlans || []);
    if ((state.reportType || "preliminary") === "final") {
      state.legalDocs = await expandPdfLegalDocs(state.legalDocs || []);
    }
    return state;
  }, [letterheadPng, letterheadHtml, letterheadTextBox, letterheadWatermarkBox]);

  // ── Client helpers ──
  const addClient = () => setClients(c => [...c, emptyClient()]);
  const removeClient = (id) => setClients(c => c.filter(x => x.id !== id));
  const updateClient = (id, data) => setClients(c => c.map(x => x.id === id ? data : x));
  const toggleClientFlag = (id, flag) => {
    const cl = clients.find(x=>x.id===id);
    // ensure at least one is always active
    const next = { ...cl, [flag]: !cl[flag] };
    if (!next.showPerson && !next.showCompany) return;
    updateClient(id, next);
  };
  const updateClientPerson = (id, person) => updateClient(id, { ...clients.find(x=>x.id===id), person });
  const updateClientCompany = (id, company) => updateClient(id, { ...clients.find(x=>x.id===id), company });
  const addClientDirector = (cid) => {
    const cl = clients.find(x=>x.id===cid);
    updateClientCompany(cid, { ...cl.company, directors: [...cl.company.directors, emptyDirector()] });
  };
  const removeClientDirector = (cid, did) => {
    const cl = clients.find(x=>x.id===cid);
    updateClientCompany(cid, { ...cl.company, directors: cl.company.directors.filter(d=>d.id!==did) });
  };
  const updateClientDirector = (cid, did, data) => {
    const cl = clients.find(x=>x.id===cid);
    updateClientCompany(cid, { ...cl.company, directors: cl.company.directors.map(d=>d.id===did?data:d) });
  };

  // ── Owner helpers ──
  const addOwner = () => setOwners(o => [...o, emptyClient()]);
  const removeOwner = (id) => setOwners(o => o.filter(x=>x.id!==id));
  const updateOwner = (id, data) => setOwners(o => o.map(x=>x.id===id?data:x));
  const toggleOwnerFlag = (id, flag) => {
    const ow = owners.find(x=>x.id===id);
    const next = { ...ow, [flag]: !ow[flag] };
    if (!next.showPerson && !next.showCompany) return;
    updateOwner(id, next);
  };
  const updateOwnerPerson = (id, person) => updateOwner(id, { ...owners.find(x=>x.id===id), person });
  const updateOwnerCompany = (id, company) => updateOwner(id, { ...owners.find(x=>x.id===id), company });
  const addOwnerDirector = (oid) => {
    const ow = owners.find(x=>x.id===oid);
    updateOwnerCompany(oid, { ...ow.company, directors: [...ow.company.directors, emptyDirector()] });
  };
  const removeOwnerDirector = (oid, did) => {
    const ow = owners.find(x=>x.id===oid);
    updateOwnerCompany(oid, { ...ow.company, directors: ow.company.directors.filter(d=>d.id!==did) });
  };
  const updateOwnerDirector = (oid, did, data) => {
    const ow = owners.find(x=>x.id===oid);
    updateOwnerCompany(oid, { ...ow.company, directors: ow.company.directors.map(d=>d.id===did?data:d) });
  };

  // ── Properties helpers ──
  const addProperty = () => setProperties(p => [...p, emptyProperty()]);
  const removeProperty = (id) => setProperties(p => p.filter(x=>x.id!==id));
  const updateProperty = (id, data) => setProperties(p => p.map(x=>x.id===id?data:x));
  const copyFromProperty = (sourceId) => {
    const src = properties.find(p => p.id === sourceId);
    if (!src) return;
    const newId = uid();
    const copied = { ...src, id: newId, plotNo: "", lat: "", lng: "", areaSqm: "", areaRadp: {r:"",a:"",p:"",d:""}, _mapEnabled: false };
    setProperties(p => [...p, copied]);
    if (propDescriptions[sourceId]) {
      setPropDescriptions(d => ({...d, [newId]: { ...propDescriptions[sourceId] }}));
    }
  };

  // ── Building helpers ──
  const addBuilding = () => setBuildings(b => [...b, emptyBuilding()]);
  const removeBuilding = (id) => setBuildings(b => b.filter(x=>x.id!==id));
  const updateBuilding = (id, data) => setBuildings(b => b.map(x=>x.id===id?data:x));
  const updateBuildingFromOwner = (bid, propId) => {
    const b = buildings.find(x=>x.id===bid); if (!b) return;
    if (!propId) { updateBuilding(bid, {...b, ownerSource:"", ownerName:"", plotNo:""}); return; }
    const prop = properties.find(p=>p.id===propId);
    if (prop) updateBuilding(bid, {...b, ownerSource:propId, ownerName:prop.ownerName||"", plotNo:prop.plotNo||""});
  };
  const addBuildingArea = (bid) => {
    const b = buildings.find(x=>x.id===bid);
    // Exclude basement rows AND the plinth row from floor naming count
    const floorCount = b.areaTable.filter(r=>
      !r.description.startsWith("Basement") && r.description !== "Up to Plinth Level"
    ).length;
    updateBuilding(bid, {...b, areaTable: [...b.areaTable, emptyBuildingArea(floorName(floorCount))]});
  };
  const removeBuildingArea = (bid, aid) => {
    const b = buildings.find(x=>x.id===bid);
    updateBuilding(bid, {...b, areaTable: b.areaTable.filter(a=>a.id!==aid)});
  };
  const updateBuildingArea = (bid, aid, data) => {
    const b = buildings.find(x=>x.id===bid);
    updateBuilding(bid, {...b, areaTable: b.areaTable.map(a=>a.id===aid?data:a)});
  };
  const sumAreas = (areaTable, key) => areaTable.reduce((s,a)=>s+(parseFloat(a[key])||0),0);

  // ── Mortgage toggle ──
  const toggleMortgage = (id) => {
    setMortgagedIds(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  // ── Calculations ──
  const getConsideredArea = (pid) => {
    const prop = properties.find(p=>p.id===pid);
    if (!prop) return 0;
    const lalpurjaSqm = propAreaSqm(prop);
    const measuredSqm = parseFloat(areaMeasured[pid]);
    const smaller = Math.min(lalpurjaSqm, isNaN(measuredSqm) ? lalpurjaSqm : measuredSqm);
    const deduct = parseFloat(deductions[pid]?.area)||0;
    return Math.max(0, smaller - deduct);
  };

  // Helper: get splits for a plot (falls back to single-row from rates state)
  const getPlotSplits = (pid) => {
    const splits = plotRateSplits[pid];
    if (splits && splits.length > 0) return splits;
    // No splits — return a synthetic single split using the whole considered area
    const ca = getConsideredArea(pid);
    const r = rates[pid]||{};
    return [{
      id: "default",
      label: "Full Area",
      areaSqm: ca,
      commercialRate: parseFloat(r.commercialRate)||0,
      govRate: parseFloat(r.govRate)||0,
      commercialWeight: r.commercialWeight !== undefined && r.commercialWeight !== "" ? parseFloat(r.commercialWeight) : 70,
      govWeight: r.govWeight !== undefined && r.govWeight !== "" ? parseFloat(r.govWeight) : 30,
    }];
  };

  const getSplitFMVRate = (split) => {
    const cW = split.commercialWeight ?? 70;
    const gW = split.govWeight ?? 30;
    return (split.commercialRate * cW / 100) + (split.govRate * gW / 100);
  };

  const getWeightedRate = (pid) => {
    const r = rates[pid]||{};
    const commRate = parseFloat(r.commercialRate)||0;
    const govRate  = parseFloat(r.govRate)||0;
    const commW    = parseFloat(r.commercialWeight)||70;
    const govW     = parseFloat(r.govWeight)||30;
    return (commRate * commW / 100) + (govRate * govW / 100);
  };

  const _propUnitFactor = (pid) => rateUnitFactor(properties.find(p=>p.id===pid));
  const _propUnitLabel  = (pid) => rateUnitLabel(properties.find(p=>p.id===pid));
  const _propUnitDisplay = (pid, sqm) => {
    const prop = properties.find(p=>p.id===pid);
    if (prop && prop.areaUnit === "bkd") return sqmToDhur(sqm).toFixed(3) + " Dhur";
    return sqmToAana(sqm).toFixed(4) + " Anna";
  };

  const getFairMarketValue = (pid) => {
    const uf = _propUnitFactor(pid);
    return getPlotSplits(pid).reduce((sum, split) => {
      const fmvRate = getSplitFMVRate(split);
      return sum + (parseFloat(split.areaSqm)||0) * fmvRate / uf;
    }, 0);
  };

  // Per-plot Commercial Rate (NPR/unit) — only used as fallback
  const getCommercialRate = (pid) => parseFloat(rates[pid]?.commercialRate)||0;
  const getGovRate = (pid) => parseFloat(rates[pid]?.govRate)||0;
  const getFMVRate = (pid) => getWeightedRate(pid);

  // Land value at commercial rate (sum across splits)
  const getCommercialLandValue = (pid) => {
    const uf = _propUnitFactor(pid);
    return getPlotSplits(pid).reduce((sum, split) => {
      return sum + (parseFloat(split.areaSqm)||0) * (parseFloat(split.commercialRate)||0) / uf;
    }, 0);
  };
  const getCommercialLandValueRounded = (pid) => Math.floor(getCommercialLandValue(pid) / 100) * 100;
  // Land value at FMV rate (sum across splits)
  const getFMVLandValue = (pid) => {
    const uf = _propUnitFactor(pid);
    return getPlotSplits(pid).reduce((sum, split) => {
      const fmvRate = getSplitFMVRate(split);
      return sum + (parseFloat(split.areaSqm)||0) * fmvRate / uf;
    }, 0);
  };
  const getFMVLandValueRounded = (pid) => Math.floor(getFMVLandValue(pid) / 100) * 100;

  const totalFMV = properties.filter(p=>mortgagedIds.has(p.id)).reduce((s,p)=>s+getFairMarketValue(p.id),0);
  const totalCommercialLand = properties.filter(p=>mortgagedIds.has(p.id)).reduce((s,p)=>s+getCommercialLandValueRounded(p.id),0);
  const totalFMVLand = properties.filter(p=>mortgagedIds.has(p.id)).reduce((s,p)=>s+getFMVLandValueRounded(p.id),0);

  const mortgaged = properties.filter(p => mortgagedIds.has(p.id));

  const sumBuildingAreas = (b, key) =>
    (b.areaTable||[]).reduce((s,a)=>s+(parseFloat(a[key])||0),0);

  const getBuildingValuation = (b) => {
    const v = buildingVals[b.id]||{};
    const floorRates = v.floorRates||{};
    // per-floor base costs
    const floorCalcs = (b.areaTable||[]).map(row => {
      const area = parseFloat(row.areaActual)||0;
      const rate = parseFloat(floorRates[row.id])||0;
      return { id: row.id, description: row.description, area, rate, baseCost: area * rate };
    });
    const totalArea = floorCalcs.reduce((s,f)=>s+f.area, 0);
    const baseCost  = floorCalcs.reduce((s,f)=>s+f.baseCost, 0);
    const sanPct    = parseFloat(v.sanitaryPct)||0;
    const elecPct   = parseFloat(v.electricalPct)||0;
    const finPct    = parseFloat(v.finishingPct)||0;
    const sanCost   = baseCost * sanPct  / 100;
    const elecCost  = baseCost * elecPct / 100;
    const finCost   = baseCost * finPct  / 100;
    const totalWithFixtures = baseCost + sanCost + elecCost + finCost;
    const age = parseFloat(b.ageOfBuilding)||0;
    const depRate = parseFloat(v.depreciationRate)||2.25;
    const totalDepPct = Math.min(100, age * depRate);
    const totalDep = totalWithFixtures * totalDepPct / 100;
    const actualValue = Math.max(0, totalWithFixtures - totalDep);
    const roundedValue = Math.floor(actualValue / 100) * 100;
    return { floorCalcs, totalArea, baseCost, sanCost, elecCost, finCost, totalWithFixtures, age, depRate, totalDepPct, totalDep, actualValue, roundedValue };
  };

  const totalBuildingValue = buildings.reduce((s,b)=>s+getBuildingValuation(b).roundedValue,0);

  // Final composite values: rate × land area + total building value
  const finalCommercialValue = totalCommercialLand + totalBuildingValue;
  const finalFMValue = totalFMVLand + totalBuildingValue;
  finalFMVRef.current = finalFMValue; // keep ref in sync so collectState always reads the latest value
  const distressMultiplier = Math.min(100, Math.max(0, parseFloat(distressPct) || 80)) / 100;
  const finalDistressValue = Math.floor(finalFMValue * distressMultiplier / 100) * 100;
  // Government value total — uses Govt Rate from Section 6 (rates[pid].govRate)
  const getGovRateForPlot = (pid) => {
    const splits = plotRateSplits[pid];
    if (splits && splits.length > 0) {
      // For split plots, use the govRate from the first split (they share the same govt rate)
      return parseFloat(splits[0].govRate) || 0;
    }
    return parseFloat(rates[pid]?.govRate) || 0;
  };
  const totalGovValue = mortgaged.reduce((sum, p) => {
    const gRate = getGovRateForPlot(p.id);
    const ca = getConsideredArea(p.id);
    return sum + (gRate * sqmToAana(ca));
  }, 0);
  const finalGovValue = Math.floor(totalGovValue / 100) * 100;

  // Keep grandTotalValue for backwards compatibility with summary card
  const grandTotalValue = finalFMValue;

  // ─── Section Renderers ────────────────────────────────────────────────────

  const sections = [
    {
      title: "Letterhead Setup",
      render: () => <LetterheadSetup letterheadHtml={letterheadHtml} saveLetterhead={saveLetterhead} showToast={showToast} />
    },
    {
      title: "Bank Information",
      render: () => (
        <div>
          <SectionHeader num="1" title="Bank Information" />
          <div className="grid-2">
            <Field label="Name of Bank" required>
              <select value={bank} onChange={e=>setBank(e.target.value)}>
                <option value="">— Select Bank —</option>
                {customBanks.length > 0
                  ? customBanks.map(b => <option key={b}>{b}</option>)
                  : BANKS.map(b => <option key={b}>{b}</option>)
                }
              </select>
            </Field>
            <Field label="Branch" required>
              <input value={branch} onChange={e=>setBranch(e.target.value)} placeholder="e.g. Kathmandu, New Road"/>
            </Field>
          </div>
          <SectionHeader num="2" title="Dates" />
          <div className="grid-2">
            <div>
              <Field label="Date of Field Visit (AD)" required>
                <input type="date" value={visitDate}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={e=>handleVisitDate(e.target.value)}
                  className={dateErrors.visit ? "input-error" : ""}
                />
              </Field>
              {dateErrors.visit && <div className="field-error">⚠ {dateErrors.visit}</div>}
            </div>
            <div>
              <Field label="Date of Reporting (AD)" required>
                <input type="date" value={reportDate}
                  max={new Date().toISOString().split("T")[0]}
                  min={visitDate || undefined}
                  onChange={e=>handleReportDate(e.target.value)}
                  className={dateErrors.report ? "input-error" : ""}
                />
              </Field>
              {dateErrors.report && <div className="field-error">⚠ {dateErrors.report}</div>}
            </div>
          </div>

          <SectionHeader num="3" title="Valuator / Inspector" />
          {companyValuators.length > 0 ? (
            <div>
              <Field label="Select Valuator" required>
                <select
                  value={valuatorInfo.id || ""}
                  onChange={e => {
                    const v = companyValuators.find(x => x.id === e.target.value);
                    if (v) setValuatorInfo(v);
                  }}
                >
                  <option value="">— Select Valuator —</option>
                  {companyValuators.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name}{v.licenseNo ? ` (${v.licenseNo})` : ""}{v.company ? ` — ${v.company}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
              {valuatorInfo.name && (
                <div style={{
                  marginTop:"8px", padding:"12px 16px", background:"var(--surface-2)",
                  borderRadius:"var(--radius)", border:"1px solid var(--border)",
                  display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 24px", fontSize:"13px"
                }}>
                  {valuatorInfo.name      && <span><strong>Name:</strong> {valuatorInfo.name}</span>}
                  {valuatorInfo.licenseNo && <span><strong>License:</strong> {valuatorInfo.licenseNo}</span>}
                  {valuatorInfo.company   && <span><strong>Firm:</strong> {valuatorInfo.company}</span>}
                  {valuatorInfo.phone     && <span><strong>Phone:</strong> {valuatorInfo.phone}</span>}
                  {valuatorInfo.email     && <span><strong>Email:</strong> {valuatorInfo.email}</span>}
                </div>
              )}
            </div>
          ) : (
            <div style={{
              padding:"12px 16px", background:"var(--accent-bg)", borderRadius:"var(--radius)",
              border:"1px solid var(--border)", fontSize:"13px", color:"var(--text-2)",
              display:"flex", alignItems:"center", gap:"10px"
            }}>
              <span style={{fontSize:"16px"}}>🔒</span>
              <span>No valuators configured. Ask your <strong>Company Admin</strong> to add valuators in the Admin Panel.</span>
            </div>
          )}
        </div>
      )
    },
    {
      title: "Client Information",
      render: () => (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
            <SectionHeader num="3.1" title="Client's Information" />
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", background: isBuySell ? "#fff3e0" : "#f5f7fa", border: `1.5px solid ${isBuySell ? "#e67e22" : "#dde1e7"}`, borderRadius: 8, padding: "7px 14px", fontWeight: 700, fontSize: 13, color: isBuySell ? "#e67e22" : "#555", transition: "all 0.15s", userSelect: "none" }}>
              <input type="checkbox" checked={isBuySell} onChange={e => setIsBuySell(e.target.checked)} style={{ width: "auto", accentColor: "#e67e22" }} />
              🤝 Buy / Sell Transaction
            </label>
          </div>
          <p className="hint">{isBuySell ? "Buy/Sell mode: Client = Buyer, Owner = Seller." : "Each client entry can include Person details, Company details, or both."}</p>

          {clients.map((cl, i) => {
            const label = [
              cl.showPerson && cl.person.name,
              cl.showCompany && cl.company.name,
            ].filter(Boolean).join(" / ");
            return (
              <div key={cl.id} className="card-entry">
                <div className="card-entry-header">
                  <span>{isBuySell ? "Buyer" : "Client"} {i+1}{label ? ` — ${label}` : ""}</span>
                  <div style={{display:"flex",gap:"8px",alignItems:"center",flexWrap:"wrap"}}>
                    <label className={`chk-btn ${cl.showPerson?"active":""}`}>
                      <input type="checkbox" checked={cl.showPerson}
                        onChange={()=>toggleClientFlag(cl.id,"showPerson")} style={{width:"auto"}}/>
                      👤 Person
                    </label>
                    <label className={`chk-btn ${cl.showCompany?"active":""}`}>
                      <input type="checkbox" checked={cl.showCompany}
                        onChange={()=>toggleClientFlag(cl.id,"showCompany")} style={{width:"auto"}}/>
                      🏢 Company
                    </label>
                    {clients.length > 1 &&
                      <button className="btn-remove" onClick={()=>removeClient(cl.id)}>✕ Remove</button>
                    }
                  </div>
                </div>

                <div style={{padding:"16px",display:"flex",flexDirection:"column",gap:"20px"}}>
                  {cl.showPerson && (
                    <div>
                      <div className="inline-section-label">👤 Person / Individual Details</div>
                      <PersonForm data={cl.person} onChange={d=>updateClientPerson(cl.id,d)} />
                    </div>
                  )}

                  {cl.showPerson && cl.showCompany && <div className="divider"/>}

                  {cl.showCompany && (
                    <div>
                      <div className="inline-section-label">🏢 Company / Firm Details</div>
                      <div className="sub-grid">
                        <Field label="Name of Company" required><input value={cl.company.name} onChange={e=>updateClientCompany(cl.id,{...cl.company,name:e.target.value})}/></Field>
                        <Field label="PAN / VAT No."><input value={cl.company.panVat} onChange={e=>updateClientCompany(cl.id,{...cl.company,panVat:e.target.value})}/></Field>
                        <Field label="Registration No." required><input value={cl.company.regNo} onChange={e=>updateClientCompany(cl.id,{...cl.company,regNo:e.target.value})}/></Field>
                        <Field label="Registration Date (BS)">
                          <NepaliDatePicker value={cl.company.regDate}
                            onChange={v=>updateClientCompany(cl.id,{...cl.company,regDate:v})}
                            maxBs={adToBs(new Date())} />
                        </Field>
                        <Field label="Registration On (Office/Place)"><input value={cl.company.regOn} onChange={e=>updateClientCompany(cl.id,{...cl.company,regOn:e.target.value})} placeholder="e.g. Department of Industry, Kathmandu"/></Field>
                        <Field label="Contact Number"><input value={cl.company.contact} onChange={e=>updateClientCompany(cl.id,{...cl.company,contact:e.target.value})}/></Field>
                        <Field label="Address"><textarea value={cl.company.address} onChange={e=>updateClientCompany(cl.id,{...cl.company,address:e.target.value})} rows={2}/></Field>
                      </div>
                      <div className="subsection-label">
                        Director Information
                        <button className="btn-add" onClick={()=>addClientDirector(cl.id)}>+ Add Director</button>
                      </div>
                      {cl.company.directors.map((dir, di) => (
                        <div key={dir.id} className="card-entry" style={{marginLeft:"8px"}}>
                          <div className="card-entry-header">
                            <span>Director {di+1}{dir.name?` — ${dir.name}`:""}</span>
                            {cl.company.directors.length > 1 &&
                              <button className="btn-remove" onClick={()=>removeClientDirector(cl.id,dir.id)}>✕ Remove</button>
                            }
                          </div>
                          <div style={{padding:"14px"}}>
                            <PersonForm data={dir} onChange={d=>updateClientDirector(cl.id,dir.id,d)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <button className="btn-add-main" onClick={addClient}>+ Add Another {isBuySell ? "Buyer" : "Client"}</button>

          <SectionHeader num="3.2" title={isBuySell ? "Seller's Information" : "Owner's Information"} />
          <p className="hint">{isBuySell ? "Seller details for the Buy/Sell transaction. Use 'Pull from Buyer' to copy a buyer's data." : "Each owner entry can include Person details, Company details, or both. Use 'Pull from Client' to copy a client's data."}</p>

          {owners.map((ow, i) => {
            const label = [
              ow.showPerson && ow.person.name,
              ow.showCompany && ow.company.name,
            ].filter(Boolean).join(" / ");
            const clientOptions = clients.map((cl, ci) => {
              const name = [cl.showPerson && cl.person.name, cl.showCompany && cl.company.name].filter(Boolean).join(" / ");
              return { id: cl.id, label: name || `${isBuySell ? "Buyer" : "Client"} ${ci+1}`, data: cl };
            });
            const pullFromClient = (clientId) => {
              if (!clientId) return;
              const src = clients.find(c => c.id === clientId);
              if (!src) return;
              // deep-copy but give new id so owner remains independent
              const copied = JSON.parse(JSON.stringify(src));
              copied.id = ow.id;
              updateOwner(ow.id, copied);
            };
            return (
              <div key={ow.id} className="card-entry">
                <div className="card-entry-header">
                  <span>{isBuySell ? "Seller" : "Owner"} {i+1}{label ? ` — ${label}` : ""}</span>
                  <div style={{display:"flex",gap:"8px",alignItems:"center",flexWrap:"wrap"}}>
                    <select
                      defaultValue=""
                      onChange={e => { pullFromClient(e.target.value); e.target.value = ""; }}
                      style={{fontSize:"12px",padding:"4px 8px",borderRadius:"4px",border:"1.5px solid var(--accent-light)",background:"var(--accent-bg)",color:"var(--accent)",cursor:"pointer",fontWeight:600}}
                      title="Copy all data from a client entry into this owner"
                    >
                      <option value="" disabled>⬇ Pull from {isBuySell ? "Buyer" : "Client"}…</option>
                      {clientOptions.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                    <label className={`chk-btn ${ow.showPerson?"active":""}`}>
                      <input type="checkbox" checked={ow.showPerson}
                        onChange={()=>toggleOwnerFlag(ow.id,"showPerson")} style={{width:"auto"}}/>
                      👤 Person
                    </label>
                    <label className={`chk-btn ${ow.showCompany?"active":""}`}>
                      <input type="checkbox" checked={ow.showCompany}
                        onChange={()=>toggleOwnerFlag(ow.id,"showCompany")} style={{width:"auto"}}/>
                      🏢 Company
                    </label>
                    {owners.length > 1 &&
                      <button className="btn-remove" onClick={()=>removeOwner(ow.id)}>✕ Remove</button>
                    }
                  </div>
                </div>

                <div style={{padding:"16px",display:"flex",flexDirection:"column",gap:"20px"}}>
                  {ow.showPerson && (
                    <div>
                      <div className="inline-section-label">👤 Person / Individual Details</div>
                      <PersonForm data={ow.person} onChange={d=>updateOwnerPerson(ow.id,d)} />
                    </div>
                  )}

                  {ow.showPerson && ow.showCompany && <div className="divider"/>}

                  {ow.showCompany && (
                    <div>
                      <div className="inline-section-label">🏢 Company / Firm Details</div>
                      <div className="sub-grid">
                        <Field label="Name of Company" required><input value={ow.company.name} onChange={e=>updateOwnerCompany(ow.id,{...ow.company,name:e.target.value})}/></Field>
                        <Field label="PAN / VAT No."><input value={ow.company.panVat} onChange={e=>updateOwnerCompany(ow.id,{...ow.company,panVat:e.target.value})}/></Field>
                        <Field label="Registration No." required><input value={ow.company.regNo} onChange={e=>updateOwnerCompany(ow.id,{...ow.company,regNo:e.target.value})}/></Field>
                        <Field label="Registration Date (BS)">
                          <NepaliDatePicker value={ow.company.regDate}
                            onChange={v=>updateOwnerCompany(ow.id,{...ow.company,regDate:v})}
                            maxBs={adToBs(new Date())} />
                        </Field>
                        <Field label="Registration On (Office/Place)"><input value={ow.company.regOn} onChange={e=>updateOwnerCompany(ow.id,{...ow.company,regOn:e.target.value})} placeholder="e.g. Department of Industry, Kathmandu"/></Field>
                        <Field label="Contact Number"><input value={ow.company.contact} onChange={e=>updateOwnerCompany(ow.id,{...ow.company,contact:e.target.value})}/></Field>
                        <Field label="Address"><textarea value={ow.company.address} onChange={e=>updateOwnerCompany(ow.id,{...ow.company,address:e.target.value})} rows={2}/></Field>
                      </div>
                      <div className="subsection-label">
                        Director Information
                        <button className="btn-add" onClick={()=>addOwnerDirector(ow.id)}>+ Add Director</button>
                      </div>
                      {ow.company.directors.map((dir, di) => (
                        <div key={dir.id} className="card-entry" style={{marginLeft:"8px"}}>
                          <div className="card-entry-header">
                            <span>Director {di+1}{dir.name?` — ${dir.name}`:""}</span>
                            {ow.company.directors.length > 1 &&
                              <button className="btn-remove" onClick={()=>removeOwnerDirector(ow.id,dir.id)}>✕ Remove</button>
                            }
                          </div>
                          <div style={{padding:"14px"}}>
                            <PersonForm data={dir} onChange={d=>updateOwnerDirector(ow.id,dir.id,d)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <button className="btn-add-main" onClick={addOwner}>+ Add Another {isBuySell ? "Seller" : "Owner"}</button>
        </div>
      )
    },
    {
      title: "Land Details",
      render: () => (
        <div>
          <SectionHeader num="3.2" title="Land Details" />
          {properties.map((prop, i) => (
            <div key={prop.id} className="card-entry">
              <div className="card-entry-header">
                <span>Land {i+1} {prop.plotNo ? `— Plot No. ${prop.plotNo}` : ""}</span>
                {properties.length > 1 && <button className="btn-remove" onClick={()=>removeProperty(prop.id)}>✕ Remove</button>}
              </div>
              <div className="sub-grid">
                <Field label="Plot No." required>
                  <input value={prop.plotNo} onChange={e=>updateProperty(prop.id,{...prop,plotNo:e.target.value})} placeholder="e.g. 123"/>
                </Field>
                <Field label="Trace Sheet No.">
                  <input value={prop.traceSheetNo} onChange={e=>updateProperty(prop.id,{...prop,traceSheetNo:e.target.value})} placeholder="e.g. TS-2081-045"/>
                </Field>
                <Field label="Type of Land">
                  <select value={prop.landType} onChange={e=>updateProperty(prop.id,{...prop,landType:e.target.value})}>
                    <option value="">— Select —</option>
                    {LAND_TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Category of Land">
                  <select value={prop.category} onChange={e=>updateProperty(prop.id,{...prop,category:e.target.value})}>
                    <option value="">— Select —</option>
                    {LAND_CATEGORIES.map(c=><option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Type of Ownership">
                  <select value={prop.ownershipType} onChange={e=>{
                    updateProperty(prop.id,{...prop,ownershipType:e.target.value});
                    if (e.target.value === "Guthi Raitani") setGuthiAlert(prop.id);
                  }}>
                    <option value="">— Select —</option>
                    {OWNERSHIP_TYPES.map(o=><option key={o}>{o}</option>)}
                  </select>
                </Field>
                {/* Name of Owner — full width */}
                <div style={{gridColumn:"1 / -1"}}>
                <Field label="Name of Owner" required>
                  <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
                    <select
                      value={prop.ownerSalutation||""}
                      onChange={e=>updateProperty(prop.id,{...prop,ownerSalutation:e.target.value})}
                      style={{width:"90px",flexShrink:0}}
                    >
                      <option value="">—</option>
                      {["Mr.","Mrs.","Ms.","Dr.","Prof.","Er.","Adv.","CA","Arch."].map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                    <input
                      value={prop.ownerName}
                      onChange={e=>updateProperty(prop.id,{...prop,ownerName:e.target.value})}
                      placeholder="Type or select from Owner's Info →"
                      style={{flex:1}}
                    />
                    <select
                      defaultValue=""
                      onChange={e=>{
                        if(!e.target.value) return;
                        const selected = e.target.value;
                        const ownerObj = owners.flatMap(ow=>ow.showPerson?[{sal:ow.person.salutation||"",name:ow.person.name}]:[]).find(o=>o.name===selected);
                        updateProperty(prop.id,{...prop, ownerName:selected, ownerSalutation: ownerObj?.sal||prop.ownerSalutation||""});
                        e.target.value="";
                      }}
                      style={{
                        width:"auto",flex:"0 0 auto",
                        fontSize:"12px",padding:"10px 32px 10px 10px",
                        borderRadius:"10px",border:"1.5px solid var(--accent-light)",
                        background:"var(--accent-bg)",color:"var(--accent)",
                        fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",
                        boxShadow:"none"
                      }}
                      title="Pick a name from Owner's Information"
                    >
                      <option value="" disabled>👤 From Owners…</option>
                      {owners.flatMap((ow, oi) => {
                        const opts = [];
                        if(ow.showPerson && ow.person.name) {
                          const sal = ow.person.salutation ? ow.person.salutation+" " : "";
                          opts.push({label:`Owner ${oi+1} — ${sal}${ow.person.name}`, value: ow.person.name});
                        }
                        if(ow.showCompany && ow.company.name) opts.push({label:`Owner ${oi+1} — ${ow.company.name}`, value: ow.company.name});
                        if(!opts.length) opts.push({label:`Owner ${oi+1} (unnamed)`, value:""});
                        return opts;
                      }).filter(o=>o.value).map((o,idx)=>(
                        <option key={idx} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </Field>
                </div>
                <Field label="Area as per Lalpurja" required>
                  <div className="area-unit-tabs">
                    <button type="button"
                      className={`area-tab ${prop.areaUnit==="radp"?"active":""}`}
                      onClick={()=>updateProperty(prop.id,{...prop,areaUnit:"radp"})}>
                      R-A-P-D
                    </button>
                    <button type="button"
                      className={`area-tab ${prop.areaUnit==="bkd"?"active":""}`}
                      onClick={()=>updateProperty(prop.id,{...prop,areaUnit:"bkd"})}>
                      B-K-D
                    </button>
                    <button type="button"
                      className={`area-tab ${prop.areaUnit==="sqm"?"active":""}`}
                      onClick={()=>updateProperty(prop.id,{...prop,areaUnit:"sqm"})}>
                      sq.m
                    </button>
                  </div>
                  {prop.areaUnit === "radp" ? (
                    <div>
                      <div className="radp-inputs">
                        <div className="radp-cell">
                          <input type="number" min="0" placeholder="0"
                            value={prop.areaRadp?.r||""}
                            onChange={e=>updateProperty(prop.id,{...prop,areaRadp:{...prop.areaRadp,r:e.target.value}})}/>
                          <span>Ropani</span>
                        </div>
                        <div className="radp-cell">
                          <input type="number" min="0" max="15" placeholder="0"
                            value={prop.areaRadp?.a||""}
                            onChange={e=>updateProperty(prop.id,{...prop,areaRadp:{...prop.areaRadp,a:e.target.value}})}/>
                          <span>Aana</span>
                        </div>
                        <div className="radp-cell">
                          <input type="number" min="0" max="3" placeholder="0"
                            value={prop.areaRadp?.p||""}
                            onChange={e=>updateProperty(prop.id,{...prop,areaRadp:{...prop.areaRadp,p:e.target.value}})}/>
                          <span>Paisa</span>
                        </div>
                        <div className="radp-cell">
                          <input type="number" min="0" max="3" placeholder="0"
                            value={prop.areaRadp?.d||""}
                            onChange={e=>updateProperty(prop.id,{...prop,areaRadp:{...prop.areaRadp,d:e.target.value}})}/>
                          <span>Dam</span>
                        </div>
                      </div>
                      {propAreaSqm(prop) > 0 && (
                        <div className="area-equiv">
                          ≈ {propAreaSqm(prop).toFixed(3)} sq.m &nbsp;|&nbsp;
                          {sqmToAana(propAreaSqm(prop)).toFixed(4)} Aana
                        </div>
                      )}
                    </div>
                  ) : prop.areaUnit === "bkd" ? (
                    <div>
                      <div className="radp-inputs">
                        <div className="radp-cell">
                          <input type="number" min="0" placeholder="0"
                            value={prop.areaBkd?.b||""}
                            onChange={e=>updateProperty(prop.id,{...prop,areaBkd:{...prop.areaBkd,b:e.target.value}})}/>
                          <span>Bigha</span>
                        </div>
                        <div className="radp-cell">
                          <input type="number" min="0" max="19" placeholder="0"
                            value={prop.areaBkd?.k||""}
                            onChange={e=>updateProperty(prop.id,{...prop,areaBkd:{...prop.areaBkd,k:e.target.value}})}/>
                          <span>Kattha</span>
                        </div>
                        <div className="radp-cell">
                          <input type="number" min="0" max="19" placeholder="0"
                            value={prop.areaBkd?.d||""}
                            onChange={e=>updateProperty(prop.id,{...prop,areaBkd:{...prop.areaBkd,d:e.target.value}})}/>
                          <span>Dhur</span>
                        </div>
                      </div>
                      {propAreaSqm(prop) > 0 && (
                        <div className="area-equiv">
                          ≈ {propAreaSqm(prop).toFixed(3)} sq.m &nbsp;|&nbsp;
                          {sqmToDhur(propAreaSqm(prop)).toFixed(3)} Dhur
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="input-unit-row">
                        <input type="number" min="0" placeholder="0.00"
                          value={prop.areaSqm||""}
                          onChange={e=>updateProperty(prop.id,{...prop,areaSqm:e.target.value})}
                          style={{flex:1}}/>
                        <span className="unit-badge">sq.m</span>
                      </div>
                      {propAreaSqm(prop) > 0 && (()=>{
                        const {r,a,p,d} = sqmToRadp(propAreaSqm(prop));
                        return (
                          <div className="area-equiv">
                            ≈ {r}-{a}-{p}-{d} (R-A-P-D) &nbsp;|&nbsp;
                            {sqmToAana(propAreaSqm(prop)).toFixed(4)} Aana
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </Field>
                <Field label="Address as per Lalpurja">
                  <textarea value={prop.addressLalpurja} onChange={e=>updateProperty(prop.id,{...prop,addressLalpurja:e.target.value})} rows={2}/>
                </Field>
                <Field label="Present Address">
                  <textarea value={prop.presentAddress} onChange={e=>updateProperty(prop.id,{...prop,presentAddress:e.target.value})} rows={2}/>
                </Field>
                <Field label="Location / Area Name">
                  <input value={prop.location||""} onChange={e=>updateProperty(prop.id,{...prop,location:e.target.value})} placeholder="e.g. Baneshwor, Kathmandu"/>
                </Field>
                <Field label="Google Plus Code">
                  <input value={prop.googlePlusCode||""} onChange={e=>updateProperty(prop.id,{...prop,googlePlusCode:e.target.value})} placeholder="e.g. 7MQP+GF Kathmandu"/>
                </Field>
                <Field label="Name & Address of Tenant (if any)">
                  <textarea value={prop.tenantInfo} onChange={e=>updateProperty(prop.id,{...prop,tenantInfo:e.target.value})} rows={2}/>
                </Field>
                <Field label="Mode of Transfer">
                  <input value={prop.modeOfTransfer||""} onChange={e=>updateProperty(prop.id,{...prop,modeOfTransfer:e.target.value})} placeholder="e.g. Purchase, Inheritance, Gift…"/>
                </Field>
                <Field label="Transfer Date (BS)">
                  <NepaliDatePicker value={prop.transferDate||""} onChange={val=>updateProperty(prop.id,{...prop,transferDate:val})}/>
                  {prop.transferDate && (()=>{
                    const parsed = parseBsStr(prop.transferDate);
                    if (!parsed) return null;
                    const from = bsToAd(parsed.y, parsed.m, parsed.d);
                    const to = new Date();
                    let yy = to.getFullYear() - from.getFullYear();
                    let mm = to.getMonth() - from.getMonth();
                    let dd = to.getDate() - from.getDate();
                    if (dd < 0) { mm--; dd += new Date(to.getFullYear(), to.getMonth(), 0).getDate(); }
                    if (mm < 0) { yy--; mm += 12; }
                    return <div style={{fontSize:"12px",color:"var(--accent)",marginTop:"4px"}}>{yy}Y {mm}M {dd}D since transfer</div>;
                  })()}
                </Field>
              </div>

            {/* Physical Description */}
            {(()=>{
              const pd = propDescriptions[prop.id] || {};
              const upd = (key, val) => updPropDesc(prop.id, key, val);
              return (
                <div style={{padding:"0 16px 16px"}}>
                  <div className="inline-section-label" style={{margin:"8px 0"}}>📝 Physical Description</div>
                  <div className="sub-grid" style={{padding:"0 0 4px 0"}}>
                    <Field label="Shape of Land">
                      <select value={pd.shape||""} onChange={e=>upd("shape",e.target.value)}>
                        <option value="">— Select —</option>
                        {["Regular (Rectangular)","Regular (Square)","Irregular","L-Shaped","Triangular","Trapezoidal","Other"].map(s=><option key={s}>{s}</option>)}
                      </select>
                    </Field>
                    <Field label="Topography">
                      <select value={pd.topography||""} onChange={e=>upd("topography",e.target.value)}>
                        <option value="">— Select —</option>
                        {["Flat","Slightly Sloped","Moderately Sloped","Steeply Sloped","Undulating","Low-lying","Elevated"].map(t=><option key={t}>{t}</option>)}
                      </select>
                    </Field>
                    <Field label="Present Condition of Property">
                      <select value={pd.presentCondition||""} onChange={e=>upd("presentCondition",e.target.value)}>
                        <option value="">— Select —</option>
                        {["Vacant Land","Under Construction","Fully Constructed","Partially Constructed","Old Construction","Good Condition","Dilapidated"].map(c=><option key={c}>{c}</option>)}
                      </select>
                    </Field>
                    <Field label="Occupancy Status">
                      <select value={pd.occupancy||""} onChange={e=>upd("occupancy",e.target.value)}>
                        <option value="">— Select —</option>
                        {["Owner Occupied","Tenant Occupied","Vacant / Unoccupied","Partially Occupied","Commercial Use","Mixed Use"].map(o=><option key={o}>{o}</option>)}
                      </select>
                    </Field>
                    <Field label="Surroundings / Neighborhood">
                      <textarea rows={2} value={pd.surroundings||""} onChange={e=>upd("surroundings",e.target.value)} placeholder="e.g. Residential area, commercial shops nearby..."/>
                    </Field>
                    <Field label="Detailed Description">
                      <textarea rows={3} value={pd.description||""} onChange={e=>upd("description",e.target.value)} placeholder="Any additional physical description, special features, access details..."/>
                    </Field>
                    {/* Hazards / Encumbrances */}
                    {(() => {
                      const HAZARDS = [
                        { flag:"highTensionLine", label:"⚡ High Tension Line",     hasSide:true,  hasDist:true  },
                        { flag:"river",           label:"🌊 River",                  hasSide:true,  hasDist:true  },
                        { flag:"kuloKholchi",     label:"💧 Kulo / Kholchi",         hasSide:true,  hasDist:true  },
                        { flag:"floodZone",       label:"🌧 Flood Zone",             hasSide:false, hasDist:false },
                        { flag:"landslide",       label:"⛰ Landslide / Erosion",    hasSide:true,  hasDist:true  },
                        { flag:"graveyard",       label:"⚰ Graveyard / Cemetery",   hasSide:true,  hasDist:true  },
                        { flag:"encroachment",    label:"🚧 Encroachment",           hasSide:true,  hasDist:false },
                      ];
                      const SIDES = ["North","South","East","West","North-East","North-West","South-East","South-West","Adjacent / On boundary","Multiple sides"];
                      const inputSt  = {padding:"6px 10px",border:"1.5px solid #f0c070",borderRadius:6,fontSize:13,boxSizing:"border-box",background:"#fffaf4",width:"100%"};
                      const selectSt = {padding:"6px 10px",border:"1.5px solid #f0c070",borderRadius:6,fontSize:13,background:"#fffaf4",width:"100%"};
                      return (
                        <div style={{gridColumn:"1 / -1"}}>
                          <div style={{fontSize:12,fontWeight:700,color:"#666",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>Hazards / Encumbrances</div>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>
                            {HAZARDS.map(({flag,label,hasSide,hasDist})=>{
                              const active = !!pd[flag];
                              return (
                                <div key={flag} style={{border:`1.5px solid ${active?"#f0c070":"#e5e7eb"}`,borderRadius:8,padding:"10px 12px",background:active?"#fffaf4":"#fafafa",transition:"all 0.15s"}}>
                                  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",userSelect:"none",marginBottom:active?10:0}}>
                                    <input type="checkbox" checked={active} onChange={e=>upd(flag,e.target.checked)} style={{width:15,height:15,cursor:"pointer",accentColor:"#c9922a"}}/>
                                    <span style={{fontSize:14,fontWeight:active?700:400,color:active?"#7a4f00":"#444"}}>{label}</span>
                                  </label>
                                  {active && (
                                    <div style={{display:"flex",flexDirection:"column",gap:7}}>
                                      {hasDist && (
                                        <div>
                                          <div style={{fontSize:11,fontWeight:600,color:"#888",marginBottom:3}}>DISTANCE</div>
                                          <input style={inputSt} value={pd[flag+"Distance"]||""} onChange={e=>upd(flag+"Distance",e.target.value)} placeholder="e.g. 50 metres, approx. 100 ft"/>
                                        </div>
                                      )}
                                      {hasSide && (
                                        <div>
                                          <div style={{fontSize:11,fontWeight:600,color:"#888",marginBottom:3}}>SIDE / DIRECTION</div>
                                          <select style={selectSt} value={pd[flag+"Side"]||""} onChange={e=>upd(flag+"Side",e.target.value)}>
                                            <option value="">— Select —</option>
                                            {SIDES.map(s=><option key={s}>{s}</option>)}
                                          </select>
                                        </div>
                                      )}
                                      <div>
                                        <div style={{fontSize:11,fontWeight:600,color:"#888",marginBottom:3}}>MINIMUM REQUIREMENT</div>
                                        <input style={inputSt} value={pd[flag+"Comment"]||""} onChange={e=>upd(flag+"Comment",e.target.value)} placeholder="e.g. Complies, Does not comply…"/>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Minimum Requirement Compliance */}
                          <div style={{marginTop:14,border:`2px solid ${pd.meetsMinReq===false?"#e74c3c":pd.meetsMinReq===true?"#27ae60":"#e5e7eb"}`,borderRadius:8,padding:"12px 14px",background:pd.meetsMinReq===false?"#fff5f5":pd.meetsMinReq===true?"#f0fff4":"#fafafa"}}>
                            <div style={{fontSize:12,fontWeight:700,color:"#666",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8}}>Minimum Requirement Compliance</div>
                            <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:8}}>
                              {[{val:true,label:"✅ Fulfills All Requirements"},{val:false,label:"❌ Does Not Fulfill"}].map(({val,label})=>(
                                <label key={String(val)} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontWeight:pd.meetsMinReq===val?700:400,color:pd.meetsMinReq===val?(val?"#1a7a3a":"#c0392b"):"#555"}}>
                                  <input type="radio" name={`meetsMinReq-${prop.id}`} checked={pd.meetsMinReq===val} onChange={()=>upd("meetsMinReq",val)} style={{accentColor:val?"#27ae60":"#e74c3c"}}/>
                                  {label}
                                </label>
                              ))}
                            </div>
                            <div style={{fontSize:11,fontWeight:600,color:"#888",marginBottom:3}}>REMARKS</div>
                            <input style={{...inputSt,borderColor:"#c8e6c9"}} value={pd.meetsMinReqComment||""} onChange={e=>upd("meetsMinReqComment",e.target.value)} placeholder="Optional remarks on compliance…"/>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })()}

              {/* Map + Coordinate Pin */}
              {properties.length > 1 && !prop.lat && !prop.lng && prop._mapEnabled !== true ? (
                <div style={{margin:"0 0 16px 0",padding:"16px 20px",
                  background:"var(--surface-2)",border:"1.5px dashed var(--border)",
                  borderRadius:"var(--radius)",display:"flex",alignItems:"center",
                  justifyContent:"space-between",gap:"12px",flexWrap:"wrap"}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:"13px",color:"var(--text)"}}>
                      📍 Add Location Map for Land {i+1}{prop.plotNo ? ` (Plot No. ${prop.plotNo})` : ""}?
                    </div>
                    <div style={{fontSize:"12px",color:"var(--text-3)",marginTop:"3px"}}>
                      Pin this property on the map to include location maps in the report.
                    </div>
                  </div>
                  <button
                    onClick={()=>updateProperty(prop.id,{...prop,_mapEnabled:true})}
                    style={{padding:"8px 20px",background:"var(--navy)",color:"#fff",border:"none",
                      borderRadius:"var(--radius)",fontWeight:700,fontSize:"13px",cursor:"pointer",
                      whiteSpace:"nowrap"}}>
                    + Add Map
                  </button>
                </div>
              ) : (
              <div style={{padding:"0 0 16px 0"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"4px"}}>
                  <div className="inline-section-label" style={{margin:"8px 0"}}>📍 Property Location Pin</div>
                  {properties.length > 1 && (prop.lat || prop.lng || prop._mapEnabled) && (
                    <button
                      onClick={()=>updateProperty(prop.id,{...prop,lat:"",lng:"",_mapEnabled:false})}
                      style={{fontSize:"11px",padding:"3px 10px",background:"var(--red-pale)",
                        border:"1px solid var(--red)",color:"var(--red)",borderRadius:"4px",
                        cursor:"pointer",marginRight:"16px"}}>
                      ✕ Remove Map
                    </button>
                  )}
                </div>
                <div style={{display:"flex",gap:"10px",flexWrap:"wrap",marginBottom:"8px"}}>
                  <Field label="Latitude" style={{flex:1,minWidth:"140px"}}>
                    <input type="number" step="any" placeholder="e.g. 27.7172"
                      value={prop.lat||""}
                      onChange={e=>updateProperty(prop.id,{...prop,lat:e.target.value})}
                      style={{width:"100%"}}/>
                  </Field>
                  <Field label="Longitude" style={{flex:1,minWidth:"140px"}}>
                    <input type="number" step="any" placeholder="e.g. 85.3240"
                      value={prop.lng||""}
                      onChange={e=>updateProperty(prop.id,{...prop,lng:e.target.value})}
                      style={{width:"100%"}}/>
                  </Field>
                </div>
              {/* Two maps stacked top and bottom */}
              <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
                <PropertyMap
                  propId={`${prop.id}-z16`}
                  lat={prop.lat}
                  lng={prop.lng}
                  plusCode={prop.googlePlusCode}
                  fixedZoom={16}
                  label="Overview (Z16)"
                  onPin={(lat,lng)=>updateProperty(prop.id,{...prop,lat:lat.toFixed(6),lng:lng.toFixed(6)})}
                  onPlusCodeLocate={(lat,lng)=>updateProperty(prop.id,{...prop,lat:lat.toFixed(6),lng:lng.toFixed(6)})}
                />
                <PropertyMap
                  propId={`${prop.id}-z18`}
                  lat={prop.lat}
                  lng={prop.lng}
                  plusCode={prop.googlePlusCode}
                  fixedZoom={18}
                  label="Detail (Z18)"
                  onPin={(lat,lng)=>updateProperty(prop.id,{...prop,lat:lat.toFixed(6),lng:lng.toFixed(6)})}
                  onPlusCodeLocate={(lat,lng)=>updateProperty(prop.id,{...prop,lat:lat.toFixed(6),lng:lng.toFixed(6)})}
                />
              </div>
              </div>
              )}
          </div>
          ))}
          <div style={{display:"flex",gap:"8px",alignItems:"center",flexWrap:"wrap"}}>
            <button className="btn-add-main" onClick={addProperty}>+ Add Another Land</button>
            {properties.length > 0 && (
              <select
                defaultValue=""
                onChange={e => {
                  if (!e.target.value) return;
                  copyFromProperty(e.target.value);
                  e.target.value = "";
                }}
                style={{
                  fontSize:"13px",padding:"10px 16px",
                  borderRadius:"10px",border:"1.5px solid var(--accent-light)",
                  background:"var(--accent-bg)",color:"var(--accent)",
                  fontWeight:600,cursor:"pointer"
                }}
              >
                <option value="" disabled>Copy from Land…</option>
                {properties.map((p, i) => (
                  <option key={p.id} value={p.id}>
                    Land {i+1}{p.plotNo ? ` — Plot ${p.plotNo}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <SectionHeader num="3.3" title="Properties to be Mortgaged" />
          <p className="hint">Select properties from the list above to include in the mortgage:</p>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Select</th><th>Plot No.</th><th>Trace Sheet No.</th><th>Owner's Name</th><th>Address (Lalpurja)</th></tr></thead>
              <tbody>
                {properties.map(p => (
                  <tr key={p.id} className={mortgagedIds.has(p.id)?"row-selected":""}>
                    <td><input type="checkbox" checked={mortgagedIds.has(p.id)} onChange={()=>toggleMortgage(p.id)}/></td>
                    <td>{p.plotNo||"—"}</td>
                    <td>{p.traceSheetNo||"—"}</td>
                    <td>{p.ownerName||"—"}</td>
                    <td>{p.addressLalpurja||"—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    },
    {
      title: "Area & Deductions",
      render: () => (
        <div>
          <SectionHeader num="4" title="Area of Plot to be Mortgaged" />
          <div className="table-wrapper">
            <table>
              <thead>
                {(() => {
                  const allBkd4 = mortgaged.length > 0 && mortgaged.every(p => p.areaUnit === "bkd");
                  const anyBkd4 = mortgaged.some(p => p.areaUnit === "bkd");
                  const natHdr4 = allBkd4 ? "B-K-D" : anyBkd4 ? "R-A-P-D / B-K-D" : "R-A-P-D";
                  const unitHdr4 = allBkd4 ? "Dhur" : anyBkd4 ? "Aana / Dhur" : "Aana";
                  return (
                    <tr>
                      <th>Plot No.</th>
                      <th>Area as per Lalpurja</th>
                      <th>{natHdr4}</th>
                      <th>sq.m</th>
                      <th>{unitHdr4}</th>
                      <th>Measured Area (sq.m)</th>
                    </tr>
                  );
                })()}
              </thead>
              <tbody>
                {mortgaged.length === 0 && <tr><td colSpan={6} className="empty-row">No properties selected for mortgage</td></tr>}
                {mortgaged.map(p => {
                  const lSqm = propAreaSqm(p);
                  const nativeStr = p.areaUnit==="bkd"
                    ? (()=>{ const bv=p.areaBkd||{}; return `${bv.b||0}-${bv.k||0}-${bv.d||0}`; })()
                    : p.areaUnit==="radp"
                      ? `${p.areaRadp?.r||0}-${p.areaRadp?.a||0}-${p.areaRadp?.p||0}-${p.areaRadp?.d||0}`
                      : (()=>{ const x=sqmToRadp(lSqm); return `${x.r}-${x.a}-${x.p}-${x.d}`; })();
                  const unitDisplay = p.areaUnit==="bkd"
                    ? sqmToDhur(lSqm).toFixed(3)
                    : sqmToAana(lSqm).toFixed(4);
                  return (
                    <tr key={p.id}>
                      <td>{p.plotNo}</td>
                      <td>{areaDisplay(p)}</td>
                      <td className="calc-cell">{nativeStr}</td>
                      <td className="calc-cell">{lSqm.toFixed(3)}</td>
                      <td className="calc-cell">{unitDisplay}</td>
                      <td>
                        <input type="number" placeholder="sq.m" value={areaMeasured[p.id]||""}
                          onChange={e=>setAreaMeasured(a=>({...a,[p.id]:e.target.value}))}
                          style={{width:"100px"}}/>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <SectionHeader num="5" title="Deduction Declaration" />
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Plot No.</th>
                  <th>Dimension</th>
                  <th>Area to Deduct (sq.m)</th>
                  <th>Reason / Remarks</th>
                </tr>
              </thead>
              <tbody>
                {mortgaged.length === 0 && <tr><td colSpan={4} className="empty-row">No properties selected for mortgage</td></tr>}
                {mortgaged.map(p => (
                  <tr key={p.id}>
                    <td>{p.plotNo}</td>
                    <td><input placeholder="e.g. 5m×10m" value={deductions[p.id]?.dim||""}
                      onChange={e=>setDeductions(d=>({...d,[p.id]:{...d[p.id],dim:e.target.value}}))} /></td>
                    <td><input type="number" placeholder="0" value={deductions[p.id]?.area||""}
                      onChange={e=>setDeductions(d=>({...d,[p.id]:{...d[p.id],area:e.target.value}}))} style={{width:"90px"}}/></td>
                    <td><input placeholder="Road setback, river, etc." value={deductions[p.id]?.reason||""}
                      onChange={e=>setDeductions(d=>({...d,[p.id]:{...d[p.id],reason:e.target.value}}))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SectionHeader num="5B" title="Considered Area for Valuation" />
          <p className="hint">Auto-calculated: <em>min(Lalpurja Area, Measured Area) − Deduction</em>. The smaller of declared/measured is used after subtracting deductions.</p>
          <div className="table-wrapper">
            <table>
              <thead>
                {(() => {
                  const allBkd5 = mortgaged.length > 0 && mortgaged.every(p => p.areaUnit === "bkd");
                  const anyBkd5 = mortgaged.some(p => p.areaUnit === "bkd");
                  const natHdr5 = allBkd5 ? "B-K-D" : anyBkd5 ? "R-A-P-D / B-K-D" : "R-A-P-D";
                  const unitHdr5 = allBkd5 ? "Dhur" : anyBkd5 ? "Aana / Dhur" : "Aana";
                  return (
                    <tr>
                      <th>Plot No.</th>
                      <th>Lalpurja (sq.m)</th>
                      <th>Measured (sq.m)</th>
                      <th>Deduction (sq.m)</th>
                      <th>Considered Area (sq.m)</th>
                      <th>{natHdr5}</th>
                      <th>{unitHdr5}</th>
                    </tr>
                  );
                })()}
              </thead>
              <tbody>
                {mortgaged.length === 0 && <tr><td colSpan={7} className="empty-row">No properties selected for mortgage</td></tr>}
                {mortgaged.map(p => {
                  const lSqm = propAreaSqm(p);
                  const mRaw = parseFloat(areaMeasured[p.id]);
                  const mSqm = isNaN(mRaw) ? lSqm : mRaw;
                  const dSqm = parseFloat(deductions[p.id]?.area) || 0;
                  const considered = getConsideredArea(p.id);
                  const nativeConsStr = p.areaUnit === "bkd"
                    ? (()=>{ const x=sqmToBkd(considered); return `${x.b}-${x.k}-${parseFloat(x.d).toFixed(3)}`; })()
                    : (()=>{ const x=sqmToRadp(considered); return `${x.r}-${x.a}-${x.p}-${x.d}`; })();
                  const unitConsDisplay = p.areaUnit === "bkd"
                    ? sqmToDhur(considered).toFixed(3)
                    : sqmToAana(considered).toFixed(4);
                  return (
                    <tr key={p.id}>
                      <td>{p.plotNo}</td>
                      <td className="calc-cell">{lSqm.toFixed(3)}</td>
                      <td className="calc-cell">{mSqm.toFixed(3)}</td>
                      <td className="calc-cell">{dSqm.toFixed(3)}</td>
                      <td className="calc-cell highlight"><strong>{considered.toFixed(3)}</strong></td>
                      <td className="calc-cell highlight"><strong>{nativeConsStr}</strong></td>
                      <td className="calc-cell highlight"><strong>{unitConsDisplay}</strong></td>
                    </tr>
                  );
                })}
                {mortgaged.length > 0 && (() => {
                  const totalSqm = mortgaged.reduce((s,p)=>s+getConsideredArea(p.id),0);
                  const allBkdT = mortgaged.every(p => p.areaUnit === "bkd");
                  const totalNativeStr = allBkdT
                    ? (()=>{ const x=sqmToBkd(totalSqm); return `${x.b}-${x.k}-${parseFloat(x.d).toFixed(3)}`; })()
                    : (()=>{ const x=sqmToRadp(totalSqm); return `${x.r}-${x.a}-${x.p}-${x.d}`; })();
                  const totalUnitStr = allBkdT ? sqmToDhur(totalSqm).toFixed(3) : sqmToAana(totalSqm).toFixed(4);
                  return (
                    <tr className="total-row">
                      <td colSpan={4}><strong>TOTAL CONSIDERED AREA</strong></td>
                      <td className="highlight"><strong>{totalSqm.toFixed(2)}</strong></td>
                      <td className="highlight"><strong>{totalNativeStr}</strong></td>
                      <td className="highlight"><strong>{totalUnitStr}</strong></td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
          <SectionHeader num="5C" title="Access Road" />
          <p className="hint">Multiple access rows can be added per plot (e.g. different road frontages).</p>
          {properties.length === 0 && <p className="hint">No land entries found — add properties in Land Details first.</p>}
          {properties.map(prop => {
            const rows = roadAccess[prop.id] || [];
            const addRow = () => setRoadAccess(ra => ({
              ...ra,
              [prop.id]: [...(ra[prop.id]||[]), { id: uid(), roadType:"", frontage:"", widthField:"", widthTrace:"", remarks:"" }]
            }));
            const removeRow = (rid) => setRoadAccess(ra => ({
              ...ra, [prop.id]: (ra[prop.id]||[]).filter(r=>r.id!==rid)
            }));
            const updateRow = (rid, key, val) => setRoadAccess(ra => ({
              ...ra, [prop.id]: (ra[prop.id]||[]).map(r=>r.id===rid?{...r,[key]:val}:r)
            }));
            return (
              <div key={prop.id} style={{marginBottom:"20px"}}>
                <div className="subsection-label" style={{marginBottom:"8px"}}>
                  Plot No. {prop.plotNo||"(unnamed)"}{prop.ownerName ? ` — ${prop.ownerName}` : ""}
                  <button className="btn-add" onClick={addRow}>+ Add Access Row</button>
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Type of Road</th>
                        <th>Frontage of Plot (ft)</th>
                        <th>Width as per Field (ft)</th>
                        <th>Width as per Trace (ft)</th>
                        <th>Remarks</th>
                        <th style={{width:"36px"}}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 && (
                        <tr><td colSpan={6} className="empty-row">No access rows — click "+ Add Access Row" above</td></tr>
                      )}
                      {rows.map(row => (
                        <tr key={row.id}>
                          <td><input value={row.roadType} onChange={e=>updateRow(row.id,"roadType",e.target.value)} placeholder="e.g. Motorable, Graveled, Black Top"/></td>
                          <td><input type="text" value={row.frontage} onChange={e=>updateRow(row.id,"frontage",e.target.value)} placeholder={`e.g. 10'6"`} style={{width:"80px"}}/></td>
                          <td><input type="text" value={row.widthField} onChange={e=>updateRow(row.id,"widthField",e.target.value)} placeholder={`e.g. 12'`} style={{width:"80px"}}/></td>
                          <td><input type="text" value={row.widthTrace} onChange={e=>updateRow(row.id,"widthTrace",e.target.value)} placeholder={`e.g. 12'`} style={{width:"80px"}}/></td>
                          <td><input value={row.remarks} onChange={e=>updateRow(row.id,"remarks",e.target.value)} placeholder="Additional notes"/></td>
                          <td><button className="btn-remove" onClick={()=>removeRow(row.id)}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )
    },
    {
      title: "Building",
      render: () => (
        <div>
          <SectionHeader num="5A" title="Building Details" />

          {/* Availability question */}
          <div className="card-entry" style={{padding:"20px 24px",marginBottom:"20px"}}>
            <p style={{fontWeight:600,fontSize:"14px",marginBottom:"14px",color:"var(--text)"}}>
              Is there any building on the property?
            </p>
            <div style={{display:"flex",gap:"12px",flexWrap:"wrap"}}>
              <button
                onClick={()=>{ setHasBuilding(true); if(buildings.length===0) addBuilding(); }}
                style={{
                  padding:"9px 28px", borderRadius:"var(--radius)", fontWeight:700, fontSize:"13px", cursor:"pointer",
                  border: hasBuilding===true ? "2px solid var(--green)" : "1.5px solid var(--border-dark)",
                  background: hasBuilding===true ? "var(--green-light)" : "var(--surface)",
                  color: hasBuilding===true ? "var(--green)" : "var(--text-2)",
                }}>
                ✅ Yes — Enter Building Detail
              </button>
              <button
                onClick={()=>{ setHasBuilding("skip"); setBuildings([]); }}
                style={{
                  padding:"9px 28px", borderRadius:"var(--radius)", fontWeight:700, fontSize:"13px", cursor:"pointer",
                  border: hasBuilding==="skip" ? "2px solid #e67e22" : "1.5px solid var(--border-dark)",
                  background: hasBuilding==="skip" ? "#fff8f0" : "var(--surface)",
                  color: hasBuilding==="skip" ? "#e67e22" : "var(--text-2)",
                }}>
                🏗 Building Available — Not Valuing
              </button>
              <button
                onClick={()=>{ setHasBuilding(false); setBuildings([]); }}
                style={{
                  padding:"9px 28px", borderRadius:"var(--radius)", fontWeight:700, fontSize:"13px", cursor:"pointer",
                  border: hasBuilding===false ? "2px solid var(--red)" : "1.5px solid var(--border-dark)",
                  background: hasBuilding===false ? "#fdf0f0" : "var(--surface)",
                  color: hasBuilding===false ? "var(--red)" : "var(--text-2)",
                }}>
                ❌ No Building
              </button>
            </div>
            {hasBuilding===false && (
              <p style={{marginTop:"12px",fontSize:"13px",color:"var(--text-3)",fontStyle:"italic"}}>
                No building on this property. This section will be marked as N/A in the report.
              </p>
            )}
            {hasBuilding==="skip" && (
              <p style={{marginTop:"12px",fontSize:"13px",color:"#e67e22",fontStyle:"italic"}}>
                Building exists on this property but is not being valued. The report will note this accordingly.
              </p>
            )}
            {hasBuilding===null && (
              <p style={{marginTop:"12px",fontSize:"13px",color:"var(--text-3)",fontStyle:"italic"}}>
                Please indicate whether a building exists on the property.
              </p>
            )}
          </div>

          {hasBuilding===true && (<>
          <p className="hint">Add details for each building on the property.</p>

          {buildings.length === 0 && (
            <div className="card-entry" style={{padding:"24px",textAlign:"center",color:"var(--text-3)",fontStyle:"italic"}}>
              No buildings added yet — click below to add one.
            </div>
          )}

          {buildings.map((b, i) => {
            const totalActual = sumAreas(b.areaTable, "areaActual");
            const totalApproved = sumAreas(b.areaTable, "areaApproved");
            const totalCertificate = sumAreas(b.areaTable, "areaCertificate");
            return (
              <div key={b.id} className="card-entry">
                <div className="card-entry-header">
                  <span>Building {i+1}{b.plotNo?` — Plot No. ${b.plotNo}`:""}{b.ownerName?` (${b.ownerName})`:""}</span>
                  <button className="btn-remove" onClick={()=>removeBuilding(b.id)}>✕ Remove</button>
                </div>
                <div style={{padding:"16px"}}>
                  {/* Basic Info */}
                  <div className="inline-section-label">📋 Basic Information</div>
                  <div className="sub-grid">
                    <Field label="Owner (from Land)" required>
                      <select value={b.ownerSource} onChange={e=>updateBuildingFromOwner(b.id,e.target.value)}>
                        <option value="">— Select Land / Owner —</option>
                        {properties.map(p=>(
                          <option key={p.id} value={p.id}>
                            {p.plotNo?`Plot ${p.plotNo}`:"(no plot)"} — {p.ownerName||"(no owner)"}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Plot No.">
                      <input value={b.plotNo} readOnly placeholder="(auto-filled)" style={{background:"var(--surface2)",color:"var(--text-2)"}}/>
                    </Field>
                    <Field label="Name of Building Owner">
                      <input value={b.ownerName} readOnly placeholder="(auto-filled)" style={{background:"var(--surface2)",color:"var(--text-2)"}}/>
                    </Field>
                    <Field label="Face of Building">
                      <select value={b.faceDirection} onChange={e=>updateBuilding(b.id,{...b,faceDirection:e.target.value})}>
                        <option value="">— Select Direction —</option>
                        {FACE_DIRECTIONS.map(d=><option key={d}>{d}</option>)}
                      </select>
                    </Field>
                    <Field label="No. of Floors">
                      <input type="number" min="0" value={b.numFloors} onChange={e=>updateBuilding(b.id,{...b,numFloors:e.target.value})} placeholder="e.g. 3"/>
                    </Field>
                    <Field label="Permission of Floors (Local Authority)">
                      <input type="number" min="0" value={b.floorPermission} onChange={e=>updateBuilding(b.id,{...b,floorPermission:e.target.value})} placeholder="e.g. 4"/>
                    </Field>
                    <Field label="Year of Construction">
                      <input type="number" value={b.yearOfConstruction} onChange={e=>{
                        const updated = {...b, yearOfConstruction: e.target.value};
                        const parsed = parseBsStr(b.completionDate);
                        if (parsed) {
                          const completionAd = bsToAd(parsed.y, parsed.m, parsed.d);
                          const days = Math.floor((new Date() - completionAd) / 86400000);
                          updated.ageOfBuilding = String(Math.max(0, Math.floor(days / 365)));
                        }
                        updateBuilding(b.id, updated);
                      }} placeholder="e.g. 2070 BS"/>
                    </Field>
                    <Field label="Date of Completion">
                      <NepaliDatePicker value={b.completionDate}
                        onChange={v=>{
                          const updated={...b, completionDate:v};
                          const parsed = parseBsStr(v);
                          if (parsed) {
                            const completionAd = bsToAd(parsed.y, parsed.m, parsed.d);
                            const days = Math.floor((new Date() - completionAd) / 86400000);
                            updated.ageOfBuilding = String(Math.max(0, Math.floor(days / 365)));
                          }
                          updateBuilding(b.id, updated);
                        }}
                        maxBs={adToBs(new Date())}/>
                    </Field>
                    <Field label="Expected Life (Years)">
                      <input type="number" min="0" value={b.expectedLife} onChange={e=>updateBuilding(b.id,{...b,expectedLife:e.target.value})} placeholder="e.g. 60"/>
                    </Field>
                    <Field label="Age of Building (Years)">
                      <input type="number" min="0" value={b.ageOfBuilding} onChange={e=>updateBuilding(b.id,{...b,ageOfBuilding:e.target.value})} placeholder="auto from completion date"/>
                    </Field>
                  </div>

                  <div className="divider" style={{margin:"18px 0"}}/>

                  {/* Technical Info */}
                  <div className="inline-section-label">🏗️ Technical Details</div>
                  <div className="sub-grid">
                    <Field label="Type of Building Structure">
                      <select value={b.structureType} onChange={e=>updateBuilding(b.id,{...b,structureType:e.target.value})}>
                        <option value="">— Select Structure —</option>
                        {STRUCTURE_TYPES.map(s=><option key={s}>{s}</option>)}
                      </select>
                    </Field>
                    <Field label="Type of Foundation">
                      <select value={b.foundationType} onChange={e=>updateBuilding(b.id,{...b,foundationType:e.target.value})}>
                        <option value="">— Select Foundation —</option>
                        {FOUNDATION_TYPES.map(f=><option key={f}>{f}</option>)}
                      </select>
                    </Field>
                  </div>

                  <div className="subsection-label" style={{marginTop:"18px"}}>
                    Building Area Details
                    <div style={{display:"flex",gap:"6px"}}>
                      <button className="btn-add" onClick={()=>{
                        const b2 = buildings.find(x=>x.id===b.id);
                        const basementCount = b2.areaTable.filter(r=>r.description.startsWith("Basement")).length;
                        const label = basementCount === 0 ? "Basement" : `Basement ${basementCount + 1}`;
                        const newRow = emptyBuildingArea(label);
                        // insert before first non-basement row (i.e. at top)
                        const firstNonBasement = b2.areaTable.findIndex(r=>!r.description.startsWith("Basement"));
                        const insertAt = firstNonBasement === -1 ? b2.areaTable.length : firstNonBasement;
                        const updated = [...b2.areaTable.slice(0,insertAt), newRow, ...b2.areaTable.slice(insertAt)];
                        updateBuilding(b.id, {...b2, areaTable: updated});
                      }}>+ Basement</button>
                      <button className="btn-add" onClick={()=>addBuildingArea(b.id)}>+ Add Floor</button>
                    </div>
                  </div>

                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th>Actual Construction (sq.ft)</th>
                          <th>Approved Map (sq.ft)</th>
                          <th>Completion Cert. (sq.ft)</th>
                          <th style={{width:"40px"}}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.areaTable.map(row=>(
                          <tr key={row.id}>
                            <td><input value={row.description} onChange={e=>updateBuildingArea(b.id,row.id,{...row,description:e.target.value})} placeholder="e.g. Ground Floor"/></td>
                            <td><input type="number" min="0" value={row.areaActual} onChange={e=>updateBuildingArea(b.id,row.id,{...row,areaActual:e.target.value})} placeholder="0" style={{width:"110px"}}/></td>
                            <td><input type="number" min="0" value={row.areaApproved} onChange={e=>updateBuildingArea(b.id,row.id,{...row,areaApproved:e.target.value})} placeholder="0" style={{width:"110px"}}/></td>
                            <td><input type="number" min="0" value={row.areaCertificate} onChange={e=>updateBuildingArea(b.id,row.id,{...row,areaCertificate:e.target.value})} placeholder="0" style={{width:"110px"}}/></td>
                            <td>
                              {b.areaTable.length>1 && (
                                <button className="btn-remove" onClick={()=>removeBuildingArea(b.id,row.id)} style={{padding:"3px 7px"}}>✕</button>
                              )}
                            </td>
                          </tr>
                        ))}
                        <tr className="total-row">
                          <td><strong>TOTAL</strong></td>
                          <td className="highlight"><strong>{totalActual.toFixed(2)}</strong></td>
                          <td className="highlight"><strong>{totalApproved.toFixed(2)}</strong></td>
                          <td className="highlight"><strong>{totalCertificate.toFixed(2)}</strong></td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {totalApproved > 0 && (totalActual > totalApproved || totalCertificate > totalApproved) && (
                    <div className="abhilekh-warning">
                      <div className="abhilekh-icon">⚠️</div>
                      <div className="abhilekh-content">
                        <div className="abhilekh-title">Abhilekhikaran (अभिलेखीकरण) Verification Required</div>
                        <div className="abhilekh-body">
                          {totalActual > totalApproved && (
                            <p>
                              <strong>Actual Construction</strong> ({totalActual.toFixed(2)} sq.ft) exceeds
                              <strong> Approved Map</strong> ({totalApproved.toFixed(2)} sq.ft) by
                              <strong> {(totalActual - totalApproved).toFixed(2)} sq.ft</strong>.
                            </p>
                          )}
                          {totalCertificate > totalApproved && (
                            <p>
                              <strong>Completion Certificate</strong> ({totalCertificate.toFixed(2)} sq.ft) exceeds
                              <strong> Approved Map</strong> ({totalApproved.toFixed(2)} sq.ft) by
                              <strong> {(totalCertificate - totalApproved).toFixed(2)} sq.ft</strong>.
                            </p>
                          )}
                          <p className="abhilekh-action">
                            Please verify whether the building has obtained <strong>Abhilekhikaran (अभिलेखीकरण / regularization)</strong> from the local authority for the unauthorized excess construction.
                          </p>
                          <label className="abhilekh-confirm">
                            <input
                              type="checkbox"
                              checked={!!b.abhilekhVerified}
                              onChange={e=>updateBuilding(b.id,{...b,abhilekhVerified:e.target.checked,abhilekhRemark:e.target.checked?b.abhilekhRemark:""})}
                            />
                            <span>I have verified the abhilekhikaran status</span>
                          </label>
                          {b.abhilekhVerified && (
                            <textarea
                              className="abhilekh-remark"
                              placeholder="Enter abhilekhikaran details, certificate number, date, or remarks..."
                              value={b.abhilekhRemark||""}
                              onChange={e=>updateBuilding(b.id,{...b,abhilekhRemark:e.target.value})}
                              rows={2}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <button className="btn-add-main" onClick={addBuilding}>+ Add Building</button>
          </>)}

          {/* ── 5B: Building Technical Details ── */}
          {hasBuilding === true && buildings.length > 0 && (
            <>
              <SectionHeader num="5B" title="Detail of Building — Technical Specifications" />
              <p className="hint">Record structural and finishing specifications for each building. These appear in the Final Report.</p>
              {buildings.map((b, bi) => {
                const det = buildingDetails[b.id] || {};
                const upd = (key, val) => updBldDet(b.id, key, val);
                // Per-building fields that must NOT be copied from a previous building
                const PER_BUILDING_KEYS = new Set(["floorHeights","floorHeightRemarks","totalHeight"]);
                const prevDet = bi > 0 ? (buildingDetails[buildings[bi-1]?.id] || {}) : {};
                const hasPrev  = bi > 0 && Object.keys(prevDet).some(k => !PER_BUILDING_KEYS.has(k) && prevDet[k]);
                // Template: RCC defaults as base, previous building's values on top (where not per-building)
                const template = { ...RCC_KTM_DEFAULTS };
                if (hasPrev) {
                  for (const [k, v] of Object.entries(prevDet))
                    if (!PER_BUILDING_KEYS.has(k) && v) template[k] = v;
                }
                const applyRccDefaults = () => setBuildingDetails(bd => {
                  const existing = bd[b.id] || {};
                  const fill = {};
                  for (const [k, v] of Object.entries(template))
                    if (!existing[k]) fill[k] = v;
                  // Fill empty floor heights with 9'5" (skip plinth level — no height needed)
                  const heights = { ...(existing.floorHeights || {}) };
                  let hChanged = false;
                  for (const row of b.areaTable || []) {
                    if (row.description === "Up to Plinth Level") continue;
                    if (!heights[row.id]) { heights[row.id] = "9'5\""; hChanged = true; }
                  }
                  if (hChanged) fill.floorHeights = heights;
                  return { ...bd, [b.id]: { ...existing, ...fill } };
                });
                const inp = (key, placeholder="") => (
                  <input value={det[key]||""} onChange={e=>upd(key,e.target.value)} placeholder={placeholder} style={{width:"100%"}}/>
                );
                const sel = (key, opts) => (
                  <select value={det[key]||""} onChange={e=>upd(key,e.target.value)} style={{width:"100%"}}>
                    <option value="">— Select —</option>
                    {opts.map(o=><option key={o}>{o}</option>)}
                  </select>
                );
                const combo = (key, opts) => {
                  const dlId = `dl-${b.id}-${key}`;
                  return (<>
                    <input list={dlId} value={det[key]||""} onChange={e=>upd(key,e.target.value)}
                      placeholder="Type or select…" style={{width:"100%"}}/>
                    <datalist id={dlId}>{opts.map(o=><option key={o} value={o}/>)}</datalist>
                  </>);
                };
                // floor heights: one row per floor in areaTable (exclude plinth — no height applicable)
                const floorHeights = (b.areaTable || []).filter(r => r.description !== "Up to Plinth Level");
                return (
                  <div key={b.id} className="card-entry" style={{marginBottom:"16px"}}>
                    <div className="card-entry-header" style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <span>Building {bi+1}{b.plotNo ? ` — Plot No. ${b.plotNo}` : ""}{b.ownerName ? ` (${b.ownerName})` : ""}</span>
                      <button
                        type="button"
                        onClick={applyRccDefaults}
                        title={hasPrev ? `Copy specs from Building ${bi} (falls back to RCC Kathmandu defaults for missing fields)` : "Fill empty fields with standard RCC building values for Kathmandu"}
                        style={{fontSize:"11px",padding:"3px 10px",background:"#e8f0fe",color:"#1a56db",border:"1px solid #c3d5fc",borderRadius:"4px",cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"}}
                      >
                        {hasPrev ? `Copy from Building ${bi}` : "Fill RCC (Kathmandu)"}
                      </button>
                    </div>
                    <div style={{padding:"14px"}}>

                      {/* Floor Heights */}
                      <div className="inline-section-label" style={{marginBottom:"10px"}}>📐 Floor Heights</div>
                      <div className="table-wrapper" style={{marginBottom:"16px"}}>
                        <table>
                          <thead>
                            <tr>
                              <th>Floor</th>
                              <th>Height (ft)</th>
                              <th>Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {floorHeights.length === 0 && <tr><td colSpan={3} className="empty-row">Add floors in Building tab first</td></tr>}
                            {floorHeights.map(row => (
                              <tr key={row.id}>
                                <td style={{fontWeight:600}}>{row.description||"—"}</td>
                                <td><input type="text" placeholder="9'5&quot;"
                                  value={(det.floorHeights||{})[row.id]||""}
                                  onChange={e=>upd("floorHeights",{...(det.floorHeights||{}),[row.id]:e.target.value})}
                                  style={{width:"90px"}}/></td>
                                <td><input placeholder="Optional note"
                                  value={(det.floorHeightRemarks||{})[row.id]||""}
                                  onChange={e=>upd("floorHeightRemarks",{...(det.floorHeightRemarks||{}),[row.id]:e.target.value})}/></td>
                              </tr>
                            ))}
                            {floorHeights.length > 0 && (
                              <tr className="total-row">
                                <td><strong>Total Height of Building</strong></td>
                                <td className="highlight">
                                  <input type="text" placeholder="auto"
                                    value={det.totalHeight || fmtFtIn(floorHeights.reduce((s,r)=>s+parseFtIn((det.floorHeights||{})[r.id]),0))}
                                    onChange={e=>upd("totalHeight",e.target.value)}
                                    style={{width:"90px",fontWeight:700}}/>
                                  <span style={{fontSize:"11px",color:"var(--text-3)",marginLeft:"4px"}}>ft</span>
                                </td>
                                <td></td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Structural Details */}
                      <div className="inline-section-label" style={{marginBottom:"10px"}}>🏗 Structural Members</div>
                      <div className="table-wrapper" style={{marginBottom:"16px"}}>
                        <table>
                          <thead><tr><th style={{width:"40%"}}>Item</th><th>Specification / Description</th></tr></thead>
                          <tbody>
                            {[
                              ["minColumn",    "Minimum Size of Column",         null],
                              ["minBeam",      "Minimum Size of Beam",           null],
                              ["dpcTieBeam",   "Thickness of DPC / Size of Tie Beam", null],
                              ["slabThickness","Thickness of Slab (e.g. 5 inch)",null],
                            ].map(([key, label, render]) => (
                              <tr key={key}>
                                <td style={{fontWeight:600,background:"#f5f0eb"}}>{label}</td>
                                <td>{render ? render(key) : inp(key, 'e.g. 9×12 inch')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Building Information */}
                      <div className="inline-section-label" style={{marginBottom:"10px"}}>📋 Building Information</div>
                      <div className="table-wrapper" style={{marginBottom:"16px"}}>
                        <table>
                          <thead><tr><th style={{width:"40%"}}>Item</th><th>Specification / Description</th></tr></thead>
                          <tbody>
                            {[
                              ["buildingPermit",   "Building Permit / Approved Drawing", k => sel(k, ["Available","Not Available","Under Process"])],
                              ["nbcCompliance",    "NBC Code Compliance",                k => sel(k, ["Yes","No","Partially"])],
                              ["setback",          "Setback Maintained",                 k => sel(k, ["Maintained","Not Maintained","Partially Maintained"])],
                              ["compoundWall",     "Compound / Boundary Wall",           k => sel(k, ["Available","Not Available"])],
                              ["parking",          "Parking Facility",                   k => combo(k, ["Available — 150 sq ft","Available — 200 sq ft","Available — Basement","Available — Open","Not Available","Other"])],
                            ].map(([key, label, render]) => (
                              <tr key={key}>
                                <td style={{fontWeight:600,background:"#f5f0eb"}}>{label}</td>
                                <td>{render ? render(key) : inp(key,"Enter details")}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Wall & Finishes */}
                      <div className="inline-section-label" style={{marginBottom:"10px"}}>🧱 Walls, Doors & Windows</div>
                      <div className="table-wrapper" style={{marginBottom:"16px"}}>
                        <table>
                          <thead><tr><th style={{width:"40%"}}>Item</th><th>Specification / Description</th></tr></thead>
                          <tbody>
                            {[
                              ["externalWall",  "External Wall Construction", null],
                              ["internalWall",  "Internal Wall Construction", null],
                              ["doorMaterial",  "Material of Door",    k => sel(k, ["Wood","Aluminum","UPVC"])],
                              ["windowMaterial","Material of Window",  k => sel(k, ["Wood","Aluminum","UPVC"])],
                              ["staircase",     "Staircase",           null],
                              ["roof",          "Roof",                null],
                            ].map(([key, label, render]) => (
                              <tr key={key}>
                                <td style={{fontWeight:600,background:"#f5f0eb"}}>{label}</td>
                                <td>{render ? render(key) : inp(key,"Enter specification")}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Finishing */}
                      <div className="inline-section-label" style={{marginBottom:"10px"}}>🎨 Finishing & Fixtures</div>
                      <div className="table-wrapper" style={{marginBottom:"16px"}}>
                        <table>
                          <thead><tr><th style={{width:"40%"}}>Item</th><th>Specification / Description</th></tr></thead>
                          <tbody>
                            {[
                              ["externalFinishing","External Finishing", null],
                              ["internalFinishing","Internal Finishing", null],
                              ["ceiling","Ceiling", k => sel(k, [
                                "Cement plaster with emulsion paint",
                                "POP (Plaster of Paris) with paint",
                                "False ceiling (gypsum board)",
                                "Exposed RCC",
                                "Wooden ceiling",
                              ])],
                              ["flooring","Flooring", k => sel(k, [
                                "Ceramic tiles","Vitrified tiles","Marble","Granite","Mosaic","Cement screed",
                              ])],
                              ["verandah","Verandah", k => sel(k, [
                                "Ceramic tiles","Vitrified tiles","Marble","Granite","Cement screed","Not Applicable",
                              ])],
                              ["kitchen","Kitchen / Dining", k => sel(k, [
                                "Ceramic tiles",
                                "Vitrified tiles",
                                "Granite",
                                "Marble",
                              ])],
                              ["bathroom","Bathroom / Toilet", k => sel(k, [
                                "Ceramic tiles, EWC, wash basin, shower",
                                "Ceramic tiles, Indian WC",
                                "Vitrified tiles, EWC, wash basin, shower",
                                "Ceramic tiles, EWC, wash basin, shower, bathtub",
                              ])],
                            ].map(([key, label, render]) => (
                              <tr key={key}>
                                <td style={{fontWeight:600,background:"#f5f0eb"}}>{label}</td>
                                <td>{render ? render(key) : inp(key,"Enter specification")}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Services */}
                      <div className="inline-section-label" style={{marginBottom:"10px"}}>⚡ Services & Utilities</div>
                      <div className="table-wrapper" style={{marginBottom:"16px"}}>
                        <table>
                          <thead><tr><th style={{width:"40%"}}>Item</th><th>Specification / Description</th></tr></thead>
                          <tbody>
                            {[
                              ["sanitary","Sanitary and Plumbing Works", k => sel(k, [
                                "PPR pipe with EWC, wash basin, shower",
                                "CPVC pipe with EWC, wash basin, shower",
                                "GI pipe with EWC, wash basin",
                                "PVC pipe",
                              ])],
                              ["electricitySystem","Electricity Supply System", null],
                              ["ugWaterTank","Underground Water Tank", k => sel(k, ["Available","Not Available"])],
                              ["ohWaterTank",      "Overhead Water Tank",       null],
                              ["solarPanel","Solar Panel",            k => sel(k, ["Available","Not Available"])],
                              ["waterSupply",      "Water Supply",             null],
                              ["deepBoring","Deep Boring / Tube Well", k => sel(k, ["Available","Not Available"])],
                              ["sewerage","Sewerage System", k => sel(k, ["Connected to municipality","Septic tank","Not Available"])],
                              ["lift",   "Lift / Elevator",     k => sel(k, ["Available","Not Available"])],
                              ["generator","Generator / Backup Power", k => sel(k, ["Available","Not Available"])],
                            ].map(([key, label, render]) => (
                              <tr key={key}>
                                <td style={{fontWeight:600,background:"#f5f0eb"}}>{label}</td>
                                <td>{render ? render(key) : inp(key,"Enter details")}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Defects & Remarks */}
                      <div className="inline-section-label" style={{marginBottom:"10px"}}>🔍 Condition & Remarks</div>
                      <div className="sub-grid" style={{gridTemplateColumns:"1fr"}}>
                        <Field label="Any Remarkable Defects (dampness, cracks, settlement, etc.)">
                          <textarea rows={3} value={det.defects||""} onChange={e=>upd("defects",e.target.value)}
                            placeholder="Describe any visible defects — cracks, dampness, settlement, tilting, spalling, etc. Enter 'None' if no defects observed."/>
                        </Field>
                        <Field label="Repair and Maintenance">
                          <textarea rows={2} value={det.repairMaintenance||""} onChange={e=>upd("repairMaintenance",e.target.value)}
                            placeholder="Describe any required or recent repair/maintenance work..."/>
                        </Field>
                        <Field label="Comments">
                          <textarea rows={2} value={det.comments||""} onChange={e=>upd("comments",e.target.value)}
                            placeholder="Any additional comments about this building..."/>
                        </Field>
                      </div>

                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )
    },
    {
      title: "Valuation Rates",
      render: () => (
        <div>
          <SectionHeader num="6" title="Considered Area & Land Rates" />
          <p className="hint">
            Each plot can be split into multiple rate zones (e.g. Front, Back, Side) with different commercial and government rates.
            Click <strong>+ Add Zone</strong> to split a plot. FMV = <em>(Commercial Rate × Commercial %) + (Govt Rate × Govt %)</em>.
          </p>

          {mortgaged.length === 0 && <p className="hint">No properties selected for mortgage yet.</p>}

          {mortgaged.map(p => {
            const ca = getConsideredArea(p.id);
            const splits = plotRateSplits[p.id] || [];
            const hasSplits = splits.length > 0;

            // Default single-row (no splits)
            const r = rates[p.id]||{};
            const setR = (k,v) => setRates(rv=>({...rv,[p.id]:{...rv[p.id],[k]:v}}));

            const addSplit = () => {
              const existing = plotRateSplits[p.id]||[];
              // First split seeds from main rates; subsequent splits are blank
              const newSplit = existing.length === 0
                ? { id: uid(), label:"Front Area", areaSqm:"", commercialRate: r.commercialRate||"", govRate: r.govRate||"", commercialWeight: r.commercialWeight||70, govWeight: r.govWeight||30 }
                : { id: uid(), label:"", areaSqm:"", commercialRate:"", govRate:"", commercialWeight:70, govWeight:30 };
              setPlotRateSplits(ps => ({...ps, [p.id]: [...(ps[p.id]||[]), newSplit]}));
            };
            const removeSplit = (sid) => setPlotRateSplits(ps => ({...ps, [p.id]: (ps[p.id]||[]).filter(s=>s.id!==sid)}));
            const updateSplit = (sid, key, val) => setPlotRateSplits(ps => ({
              ...ps, [p.id]: (ps[p.id]||[]).map(s => s.id===sid ? {...s,[key]:val} : s)
            }));

            const splitTotal = splits.reduce((sum,s)=>sum+(parseFloat(s.areaSqm)||0),0);
            const splitDiff = ca - splitTotal;

            return (
              <div key={p.id} className="card-entry" style={{marginBottom:"16px"}}>
                <div className="card-entry-header">
                  <span>Plot No. {p.plotNo||"—"}{p.ownerName?` — ${p.ownerName}`:""}</span>
                  <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
                    <span style={{fontSize:"12px",color:"var(--text-3)"}}>Considered: {ca.toFixed(2)} sq.m ({_propUnitDisplay(p.id, ca)})</span>
                    <button className="btn-add" onClick={addSplit}>+ Add Zone</button>
                  </div>
                </div>
                <div style={{padding:"12px"}}>
                  {!hasSplits && (
                    // Single-rate mode
                    <div className="table-wrapper">
                      <table style={{minWidth:"860px",fontSize:"14px"}}>
                        <thead>
                          <tr>
                            <th style={{minWidth:"140px"}}>Considered Area (sq.m)</th>
                            <th style={{minWidth:"120px"}}>Area ({_propUnitLabel(p.id)})</th>
                            <th style={{minWidth:"160px"}}>Commercial Rate (NPR/{_propUnitLabel(p.id)})</th>
                            <th style={{minWidth:"150px"}}>Govt Rate (NPR/{_propUnitLabel(p.id)})</th>
                            <th style={{minWidth:"130px"}}>Commercial Wt. (%)</th>
                            <th style={{minWidth:"110px"}}>Govt Wt. (%)</th>
                            <th style={{minWidth:"150px"}}>FMV Rate (NPR/{_propUnitLabel(p.id)})</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{height:"52px"}}>
                            <td className="calc-cell" style={{fontSize:"15px",fontWeight:600}}>{ca.toFixed(2)}</td>
                            <td className="calc-cell" style={{fontSize:"15px",fontWeight:600}}>{_propUnitDisplay(p.id, ca)}</td>
                            <td><input type="number" min="0" placeholder="0" value={r.commercialRate||""} onChange={e=>setR("commercialRate",e.target.value)} style={{width:"130px",fontSize:"14px",padding:"8px 10px"}}/></td>
                            <td><input type="number" min="0" placeholder="0" value={r.govRate||""} onChange={e=>setR("govRate",e.target.value)} style={{width:"130px",fontSize:"14px",padding:"8px 10px"}}/></td>
                            <td>
                              <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
                                <input type="number" min="0" max="100" placeholder="70" value={r.commercialWeight!==undefined&&r.commercialWeight!==""?r.commercialWeight:70} onChange={e=>setR("commercialWeight",e.target.value)} style={{width:"75px",fontSize:"14px",padding:"8px 10px"}}/>
                                <span style={{fontSize:"13px",color:"var(--text-3)",fontWeight:600}}>%</span>
                              </div>
                            </td>
                            <td>
                              <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
                                <input type="number" min="0" max="100" placeholder="30" value={r.govWeight!==undefined&&r.govWeight!==""?r.govWeight:30} onChange={e=>setR("govWeight",e.target.value)} style={{width:"75px",fontSize:"14px",padding:"8px 10px"}}/>
                                <span style={{fontSize:"13px",color:"var(--text-3)",fontWeight:600}}>%</span>
                              </div>
                            </td>
                            <td className="calc-cell highlight" style={{fontSize:"16px"}}><strong>{getFMVRate(p.id).toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {hasSplits && (
                    <div className="table-wrapper">
                      {Math.abs(splitDiff) > 0.01 && (
                        <div style={{padding:"6px 10px",marginBottom:"6px",background: splitDiff < 0 ? "#fdf0f0" : "#fff8e6",borderRadius:"5px",fontSize:"12px",color: splitDiff < 0 ? "var(--red)" : "#c07800"}}>
                          {splitDiff > 0
                            ? `⚠ ${splitDiff.toFixed(2)} sq.m unallocated across zones (total = ${splitTotal.toFixed(2)}, considered = ${ca.toFixed(2)})`
                            : `⚠ Zones exceed considered area by ${Math.abs(splitDiff).toFixed(2)} sq.m`}
                        </div>
                      )}
                      <table style={{minWidth:"1200px",fontSize:"14px"}}>
                        <thead>
                          <tr>
                            <th style={{minWidth:"120px"}}>Zone Label</th>
                            <th style={{minWidth:"110px"}}>Area (sq.m)</th>
                            <th style={{minWidth:"110px"}}>Area ({_propUnitLabel(p.id)})</th>
                            <th style={{minWidth:"130px"}}>Commercial Rate (/{_propUnitLabel(p.id)})</th>
                            <th style={{minWidth:"120px"}}>Govt Rate (/{_propUnitLabel(p.id)})</th>
                            <th style={{minWidth:"100px"}}>Comm Wt.%</th>
                            <th style={{minWidth:"100px"}}>Govt Wt.%</th>
                            <th style={{minWidth:"110px"}}>FMV Rate</th>
                            <th style={{minWidth:"120px"}}>Comm Value</th>
                            <th style={{minWidth:"120px"}}>FMV Value</th>
                            <th style={{minWidth:"40px"}}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {splits.map((sp,si) => {
                            const spArea = parseFloat(sp.areaSqm)||0;
                            const spUnitAmt = p.areaUnit === "bkd" ? sqmToDhur(spArea) : sqmToAana(spArea);
                            const spCommRate = parseFloat(sp.commercialRate)||0;
                            const spCW = sp.commercialWeight !== undefined ? parseFloat(sp.commercialWeight) : 70;
                            const spGW = sp.govWeight !== undefined ? parseFloat(sp.govWeight) : 30;
                            const spFmvRate = getSplitFMVRate({...sp, commercialWeight:spCW, govWeight:spGW});
                            const spUf = _propUnitFactor(p.id);
                            const spCommVal = spArea * spCommRate / spUf;
                            const spFmvVal  = spArea * spFmvRate / spUf;
                            return (
                              <tr key={sp.id} style={{height:"50px"}}>
                                <td><input value={sp.label} onChange={e=>updateSplit(sp.id,"label",e.target.value)} placeholder={`Zone ${si+1}`} style={{width:"110px",fontSize:"14px",padding:"8px 10px"}}/></td>
                                <td><input type="number" min="0" value={sp.areaSqm} onChange={e=>updateSplit(sp.id,"areaSqm",e.target.value)} placeholder="0" style={{width:"100px",fontSize:"14px",padding:"8px 10px"}}/></td>
                                <td className="calc-cell" style={{fontSize:"14px",fontWeight:600}}>{p.areaUnit==="bkd"?spUnitAmt.toFixed(3):spUnitAmt.toFixed(4)}</td>
                                <td><input type="number" min="0" value={sp.commercialRate} onChange={e=>updateSplit(sp.id,"commercialRate",e.target.value)} placeholder="0" style={{width:"110px",fontSize:"14px",padding:"8px 10px"}}/></td>
                                <td><input type="number" min="0" value={sp.govRate} onChange={e=>updateSplit(sp.id,"govRate",e.target.value)} placeholder="0" style={{width:"100px",fontSize:"14px",padding:"8px 10px"}}/></td>
                                <td>
                                  <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
                                    <input type="number" min="0" max="100" value={sp.commercialWeight!==undefined?sp.commercialWeight:70} onChange={e=>updateSplit(sp.id,"commercialWeight",e.target.value)} style={{width:"65px",fontSize:"14px",padding:"8px 8px"}}/>
                                    <span style={{fontSize:"13px",fontWeight:600}}>%</span>
                                  </div>
                                </td>
                                <td>
                                  <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
                                    <input type="number" min="0" max="100" value={sp.govWeight!==undefined?sp.govWeight:30} onChange={e=>updateSplit(sp.id,"govWeight",e.target.value)} style={{width:"65px",fontSize:"14px",padding:"8px 8px"}}/>
                                    <span style={{fontSize:"13px",fontWeight:600}}>%</span>
                                  </div>
                                </td>
                                <td className="calc-cell highlight" style={{fontSize:"14px"}}>{spFmvRate.toFixed(2)}</td>
                                <td className="calc-cell" style={{fontSize:"14px"}}>{spCommVal.toLocaleString("en-NP",{maximumFractionDigits:0})}</td>
                                <td className="calc-cell" style={{fontSize:"14px"}}>{spFmvVal.toLocaleString("en-NP",{maximumFractionDigits:0})}</td>
                                <td><button className="btn-remove" onClick={()=>removeSplit(sp.id)} style={{padding:"5px 9px"}}>✕</button></td>
                              </tr>
                            );
                          })}
                          <tr className="total-row">
                            <td><strong>Total</strong></td>
                            <td className="calc-cell"><strong>{splitTotal.toFixed(2)}</strong></td>
                            <td className="calc-cell"><strong>{p.areaUnit==="bkd"?sqmToDhur(splitTotal).toFixed(3):sqmToAana(splitTotal).toFixed(4)}</strong></td>
                            <td colSpan={5}></td>
                            <td className="highlight"><strong>NPR {getCommercialLandValue(p.id).toLocaleString("en-NP",{maximumFractionDigits:0})}</strong></td>
                            <td className="highlight"><strong>NPR {getFMVLandValue(p.id).toLocaleString("en-NP",{maximumFractionDigits:0})}</strong></td>
                            <td></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <SectionHeader num="7" title="Boundary Declaration" />
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Plot No.</th><th>East</th><th>West</th><th>North</th><th>South</th><th>Remarks</th></tr>
              </thead>
              <tbody>
                {mortgaged.length === 0 && <tr><td colSpan={6} className="empty-row">No properties selected</td></tr>}
                {mortgaged.map(p => {
                  const ac = access[p.id]||{};
                  const upd = (k,v) => setAccess(a=>({...a,[p.id]:{...a[p.id],[k]:v}}));
                  return (
                    <tr key={p.id}>
                      <td>{p.plotNo}</td>
                      <td><input placeholder="Neighbor/Road" value={ac.east||""} onChange={e=>upd("east",e.target.value)}/></td>
                      <td><input placeholder="Neighbor/Road" value={ac.west||""} onChange={e=>upd("west",e.target.value)}/></td>
                      <td><input placeholder="Neighbor/Road" value={ac.north||""} onChange={e=>upd("north",e.target.value)}/></td>
                      <td><input placeholder="Neighbor/Road" value={ac.south||""} onChange={e=>upd("south",e.target.value)}/></td>
                      <td><input placeholder="Additional notes" value={ac.remarks||""} onChange={e=>upd("remarks",e.target.value)}/></td>
                    </tr>
                  );
                })}
                {extraBoundaryRows.map(row => (
                  <tr key={row.id}>
                    <td><input placeholder="Plot No." value={row.plotNo||""} onChange={e=>setExtraBoundaryRows(rows=>rows.map(r=>r.id===row.id?{...r,plotNo:e.target.value}:r))}/></td>
                    <td><input placeholder="Neighbor/Road" value={row.east||""} onChange={e=>setExtraBoundaryRows(rows=>rows.map(r=>r.id===row.id?{...r,east:e.target.value}:r))}/></td>
                    <td><input placeholder="Neighbor/Road" value={row.west||""} onChange={e=>setExtraBoundaryRows(rows=>rows.map(r=>r.id===row.id?{...r,west:e.target.value}:r))}/></td>
                    <td><input placeholder="Neighbor/Road" value={row.north||""} onChange={e=>setExtraBoundaryRows(rows=>rows.map(r=>r.id===row.id?{...r,north:e.target.value}:r))}/></td>
                    <td><input placeholder="Neighbor/Road" value={row.south||""} onChange={e=>setExtraBoundaryRows(rows=>rows.map(r=>r.id===row.id?{...r,south:e.target.value}:r))}/></td>
                    <td style={{display:"flex",gap:"4px",alignItems:"center"}}>
                      <input placeholder="Additional notes" value={row.remarks||""} onChange={e=>setExtraBoundaryRows(rows=>rows.map(r=>r.id===row.id?{...r,remarks:e.target.value}:r))} style={{flex:1}}/>
                      <button type="button" title="Remove row" onClick={()=>setExtraBoundaryRows(rows=>rows.filter(r=>r.id!==row.id))} style={{background:"none",border:"none",color:"#c00",cursor:"pointer",fontSize:"16px",lineHeight:1,padding:"0 2px"}}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={()=>setExtraBoundaryRows(rows=>[...rows,{id:Date.now(),plotNo:"",east:"",west:"",north:"",south:"",remarks:""}])} style={{marginTop:"6px",padding:"4px 12px",fontSize:"13px",cursor:"pointer"}}>+ Add Row</button>
        </div>
      )
    },
    {
      title: "Valuation of Property",
      render: () => (
        <div>
          <SectionHeader num="8" title="Valuation of Land" />
          <p style={{fontWeight:"bold",fontSize:"13px",margin:"6px 0 2px"}}>8A. Land Rates per Anna</p>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Plot No. / Zone</th>
                  <th>Area (sq.m)</th>
                  <th>R-A-P-D</th>
                  <th>Anna</th>
                  <th>Govt. Rate (NPR/Anna)</th>
                  <th>Commercial Rate (NPR/Anna)</th>
                  <th>FMV Rate (NPR/Anna)</th>
                </tr>
              </thead>
              <tbody>
                {mortgaged.length === 0 && <tr><td colSpan={7} className="empty-row">No properties selected</td></tr>}
                {mortgaged.map(p => {
                  const ca = getConsideredArea(p.id);
                  const {r,a,p:pp,d} = sqmToRadp(ca);
                  const splits = plotRateSplits[p.id]||[];
                  const hasSplits = splits.length > 0;

                  if (hasSplits) {
                    return (
                      <React.Fragment key={p.id}>
                        {splits.map((sp, si) => {
                          const spArea = parseFloat(sp.areaSqm)||0;
                          const spCW = sp.commercialWeight !== undefined ? parseFloat(sp.commercialWeight) : 70;
                          const spGW = sp.govWeight !== undefined ? parseFloat(sp.govWeight) : 30;
                          const spCRate = parseFloat(sp.commercialRate)||0;
                          const spFmvRate = getSplitFMVRate({...sp, commercialWeight:spCW, govWeight:spGW});
                          const spZoneGovRate = parseFloat(sp.govRate)||0;
                          const {r:sr,a:sa,p:sp2,d:sd} = sqmToRadp(spArea);
                          return (
                            <tr key={sp.id} style={{background:"#fffaf5"}}>
                              <td style={{paddingLeft:"20px",fontStyle:"italic",color:"#555"}}>
                                {p.plotNo||"—"} — {sp.label||`Zone ${si+1}`}
                              </td>
                              <td className="calc-cell">{spArea.toFixed(2)}</td>
                              <td className="calc-cell">{sr}-{sa}-{sp2}-{sd}</td>
                              <td className="calc-cell">{sqmToAana(spArea).toFixed(4)}</td>
                              <td className="calc-cell" style={{color:"#1565c0",fontWeight:700}}>
                                {spZoneGovRate ? spZoneGovRate.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2}) : <span style={{color:"var(--text-3)",fontStyle:"italic",fontWeight:400}}>—</span>}
                              </td>
                              <td className="calc-cell">{spCRate.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                              <td className="calc-cell">{spFmvRate.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                            </tr>
                          );
                        })}
                        {(()=>{
                          const gRate = parseFloat(splits[0]?.govRate)||0;
                          return (
                          <tr style={{background:"#f0ece6",fontWeight:600}}>
                            <td>{p.plotNo||"—"} — Sub-total</td>
                            <td className="calc-cell">{ca.toFixed(2)}</td>
                            <td className="calc-cell">{r}-{a}-{pp}-{d}</td>
                            <td className="calc-cell">{sqmToAana(ca).toFixed(4)}</td>
                            <td className="calc-cell" style={{color:"var(--text-3)",fontStyle:"italic",fontWeight:400}}>—</td>
                            <td colSpan={2} style={{textAlign:"center",fontStyle:"italic",color:"var(--text-3)",fontSize:"11px"}}>Multiple rates</td>
                          </tr>
                          );
                        })()}
                      </React.Fragment>
                    );
                  }

                  // Single-rate
                  const cr = getCommercialRate(p.id);
                  const fr = getFMVRate(p.id);
                  const gRate = parseFloat(rates[p.id]?.govRate)||0;
                  return (
                    <tr key={p.id}>
                      <td>{p.plotNo||"—"}</td>
                      <td className="calc-cell">{ca.toFixed(2)}</td>
                      <td className="calc-cell">{r}-{a}-{pp}-{d}</td>
                      <td className="calc-cell">{sqmToAana(ca).toFixed(4)}</td>
                      <td className="calc-cell" style={{color:"#1565c0",fontWeight:700}}>
                        {gRate ? gRate.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2}) : <span style={{color:"var(--text-3)",fontStyle:"italic",fontWeight:400}}>enter in Sec. 6</span>}
                      </td>
                      <td className="calc-cell">{cr.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                      <td className="calc-cell">{fr.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p style={{fontWeight:"bold",fontSize:"13px",margin:"14px 0 2px"}}>8B. Value of Property</p>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Plot No. / Zone</th>
                  <th>Anna</th>
                  <th>Govt. Value (NPR)</th>
                  <th>Commercial Value (NPR)</th>
                  <th>FMV Value (NPR)</th>
                  <th>Distress Value ({distressPct||80}% of FMV)</th>
                </tr>
              </thead>
              <tbody>
                {mortgaged.length === 0 && <tr><td colSpan={6} className="empty-row">No properties selected</td></tr>}
                {mortgaged.map(p => {
                  const ca = getConsideredArea(p.id);
                  const splits = plotRateSplits[p.id]||[];
                  const hasSplits = splits.length > 0;
                  const cv = getCommercialLandValue(p.id);
                  const fv = getFMVLandValue(p.id);
                  const cvR = Math.floor(cv / 100) * 100;
                  const fvR = Math.floor(fv / 100) * 100;
                  const dvR = Math.floor(fvR * distressMultiplier / 100) * 100;

                  if (hasSplits) {
                    return (
                      <React.Fragment key={p.id}>
                        {splits.map((sp, si) => {
                          const spArea = parseFloat(sp.areaSqm)||0;
                          const spCW = sp.commercialWeight !== undefined ? parseFloat(sp.commercialWeight) : 70;
                          const spGW = sp.govWeight !== undefined ? parseFloat(sp.govWeight) : 30;
                          const spCRate = parseFloat(sp.commercialRate)||0;
                          const spFmvRate = getSplitFMVRate({...sp, commercialWeight:spCW, govWeight:spGW});
                          const spCVal = spArea * spCRate / AANA_TO_SQM;
                          const spFVal = spArea * spFmvRate / AANA_TO_SQM;
                          const spDVal = Math.floor(spFVal * distressMultiplier / 100) * 100;
                          const spZoneGovRate2 = parseFloat(sp.govRate)||0;
                          const spGovVal2 = spZoneGovRate2 * sqmToAana(spArea);
                          return (
                            <tr key={sp.id} style={{background:"#fffaf5"}}>
                              <td style={{paddingLeft:"20px",fontStyle:"italic",color:"#555"}}>
                                {p.plotNo||"—"} — {sp.label||`Zone ${si+1}`}
                              </td>
                              <td className="calc-cell">{sqmToAana(spArea).toFixed(4)}</td>
                              <td className="calc-cell" style={{color:"#1565c0"}}>
                                {spZoneGovRate2 ? `NPR ${spGovVal2.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}` : <span style={{color:"var(--text-3)",fontStyle:"italic"}}>—</span>}
                              </td>
                              <td className="calc-cell">NPR {spCVal.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                              <td className="calc-cell">NPR {spFVal.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                              <td className="calc-cell">NPR {spDVal.toLocaleString("en-NP")}</td>
                            </tr>
                          );
                        })}
                        {(()=>{
                          const gRate = parseFloat(splits[0]?.govRate)||0;
                          const gVal = gRate * sqmToAana(ca);
                          const gValR = Math.floor(gVal/100)*100;
                          return (<>
                          <tr style={{background:"#f0ece6",fontWeight:600}}>
                            <td>{p.plotNo||"—"} — Sub-total</td>
                            <td className="calc-cell">{sqmToAana(ca).toFixed(4)}</td>
                            <td className="highlight" style={{color:"#1565c0"}}>NPR {gVal.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                            <td className="highlight">NPR {cv.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                            <td className="highlight">NPR {fv.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                            <td className="highlight">NPR {(Math.floor(fv*distressMultiplier/100)*100).toLocaleString("en-NP")}</td>
                          </tr>
                          <tr style={{background:"#e8f5e9"}}>
                            <td colSpan={2} style={{fontSize:"11px",color:"#555",paddingLeft:"16px"}}>Rounded Down (to nearest 100)</td>
                            <td className="highlight" style={{color:"#1565c0"}}><strong>NPR {gValR.toLocaleString("en-NP")}</strong></td>
                            <td className="highlight" style={{color:"#2e7d32"}}><strong>NPR {cvR.toLocaleString("en-NP")}</strong></td>
                            <td className="highlight" style={{color:"#2e7d32"}}><strong>NPR {fvR.toLocaleString("en-NP")}</strong></td>
                            <td className="highlight" style={{color:"#2e7d32"}}><strong>NPR {dvR.toLocaleString("en-NP")}</strong></td>
                          </tr>
                          </>);
                        })()}
                      </React.Fragment>
                    );
                  }

                  // Single-rate
                  const gRate = parseFloat(rates[p.id]?.govRate)||0;
                  const gVal = gRate * sqmToAana(ca);
                  const gValR = Math.floor(gVal/100)*100;
                  return (
                    <React.Fragment key={p.id}>
                      <tr>
                        <td>{p.plotNo||"—"}</td>
                        <td className="calc-cell">{sqmToAana(ca).toFixed(4)}</td>
                        <td className="highlight" style={{color:"#1565c0"}}>NPR {gVal.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                        <td className="highlight">NPR {cv.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                        <td className="highlight">NPR {fv.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                        <td className="highlight">NPR {(Math.floor(fv*distressMultiplier/100)*100).toLocaleString("en-NP")}</td>
                      </tr>
                      <tr style={{background:"#e8f5e9"}}>
                        <td colSpan={2} style={{fontSize:"11px",color:"#555",paddingLeft:"16px"}}>Rounded Down (to nearest 100)</td>
                        <td className="highlight" style={{color:"#1565c0"}}><strong>NPR {gValR.toLocaleString("en-NP")}</strong></td>
                        <td className="highlight" style={{color:"#2e7d32"}}><strong>NPR {cvR.toLocaleString("en-NP")}</strong></td>
                        <td className="highlight" style={{color:"#2e7d32"}}><strong>NPR {fvR.toLocaleString("en-NP")}</strong></td>
                        <td className="highlight" style={{color:"#2e7d32"}}><strong>NPR {dvR.toLocaleString("en-NP")}</strong></td>
                      </tr>
                    </React.Fragment>
                  );
                })}
                {mortgaged.length > 0 && (
                  <tr className="total-row">
                    <td colSpan={2}><strong>TOTAL LAND VALUE (Rounded)</strong></td>
                    <td className="highlight" style={{color:"#1565c0"}}><strong>NPR {finalGovValue.toLocaleString("en-NP")}</strong></td>
                    <td className="highlight"><strong>NPR {totalCommercialLand.toLocaleString("en-NP")}</strong></td>
                    <td className="highlight"><strong>NPR {totalFMVLand.toLocaleString("en-NP")}</strong></td>
                    <td className="highlight"><strong>NPR {(Math.floor(totalFMVLand*distressMultiplier/100)*100).toLocaleString("en-NP")}</strong></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {buildings.length > 0 && (
            <>
              <SectionHeader num="8B" title="Valuation of Building" />
              <p className="hint">Enter the construction rate (NPR/sq.ft) for each floor separately. Sanitary, electrical, finishing, and depreciation apply to the total.</p>

              {buildings.map((b, i) => {
                const v = buildingVals[b.id]||{};
                const floorRates = v.floorRates||{};
                const upd = (k,val) => setBuildingVals(bv => ({...bv, [b.id]: {...bv[b.id], [k]: val}}));
                const updFloor = (areaId, val) => setBuildingVals(bv => ({
                  ...bv, [b.id]: { ...bv[b.id], floorRates: { ...(bv[b.id]?.floorRates||{}), [areaId]: val } }
                }));
                const calc = getBuildingValuation(b);
                return (
                  <div key={b.id} className="card-entry" style={{marginBottom:"16px"}}>
                    <div className="card-entry-header">
                      <span>Building {i+1}{b.plotNo?` — Plot No. ${b.plotNo}`:""}{b.ownerName?` (${b.ownerName})`:""}</span>
                      <span style={{fontSize:"11px",color:"var(--text-3)"}}>
                        Total Area: {calc.totalArea.toFixed(2)} sq.ft &nbsp;·&nbsp; Age: {calc.age} yr
                      </span>
                    </div>
                    <div style={{padding:"14px"}}>

                      {/* Per-floor construction rate table */}
                      <div className="inline-section-label" style={{marginBottom:"8px"}}>🏗 Construction Cost by Floor</div>
                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th>Floor</th>
                              <th>Area (sq.ft)</th>
                              <th>Rate (NPR/sq.ft)</th>
                              <th>Floor Cost (NPR)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {b.areaTable.length === 0 && (
                              <tr><td colSpan={4} className="empty-row">No floor rows — add floors in the Building tab</td></tr>
                            )}
                            {b.areaTable.map(row => {
                              const area = parseFloat(row.areaActual)||0;
                              const rate = parseFloat(floorRates[row.id])||0;
                              const cost = area * rate;
                              return (
                                <tr key={row.id}>
                                  <td>{row.description||"—"}</td>
                                  <td className="calc-cell">{area.toFixed(2)}</td>
                                  <td>
                                    <input type="number" min="0" placeholder="e.g. 2500"
                                      value={floorRates[row.id]||""}
                                      onChange={e=>updFloor(row.id, e.target.value)}
                                      style={{width:"110px"}}/>
                                  </td>
                                  <td className="calc-cell highlight">{cost.toLocaleString("en-NP",{maximumFractionDigits:2})}</td>
                                </tr>
                              );
                            })}
                            {b.areaTable.length > 0 && (
                              <tr className="total-row">
                                <td><strong>Total</strong></td>
                                <td className="calc-cell"><strong>{calc.totalArea.toFixed(2)}</strong></td>
                                <td></td>
                                <td className="highlight"><strong>NPR {calc.baseCost.toLocaleString("en-NP",{maximumFractionDigits:2})}</strong></td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Fixture & depreciation inputs */}
                      <div className="inline-section-label" style={{marginTop:"16px",marginBottom:"8px"}}>📋 Fixtures & Depreciation</div>
                      <div className="sub-grid">
                        <Field label="Sanitary Cost (%)">
                          <input type="number" min="0" max="100" placeholder="e.g. 5" value={v.sanitaryPct||""} onChange={e=>upd("sanitaryPct",e.target.value)}/>
                        </Field>
                        <Field label="Electrical Cost (%)">
                          <input type="number" min="0" max="100" placeholder="e.g. 8" value={v.electricalPct||""} onChange={e=>upd("electricalPct",e.target.value)}/>
                        </Field>
                        <Field label="Finishing Cost (%)">
                          <input type="number" min="0" max="100" placeholder="e.g. 10" value={v.finishingPct||""} onChange={e=>upd("finishingPct",e.target.value)}/>
                        </Field>
                        <Field label="Depreciation Rate (% per annum)">
                          <input type="number" min="0" max="100" placeholder="2.25" value={v.depreciationRate ?? ""} onChange={e=>upd("depreciationRate",e.target.value)}/>
                        </Field>
                        <Field label="Age of Building (years)">
                          <input type="number" value={calc.age} readOnly style={{background:"var(--surface2)",color:"var(--text-2)"}}/>
                        </Field>
                      </div>

                      {/* Summary breakdown */}
                      <div className="table-wrapper" style={{marginTop:"14px"}}>
                        <table>
                          <thead><tr><th>Description</th><th>Calculation</th><th>Amount (NPR)</th></tr></thead>
                          <tbody>
                            <tr>
                              <td>Total Base Construction Cost</td>
                              <td className="calc-cell">{calc.totalArea.toFixed(2)} sq.ft (all floors)</td>
                              <td className="calc-cell">{calc.baseCost.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                            </tr>
                            <tr>
                              <td>Sanitary Cost</td>
                              <td className="calc-cell">{parseFloat(v.sanitaryPct)||0}% of base</td>
                              <td className="calc-cell">{calc.sanCost.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                            </tr>
                            <tr>
                              <td>Electrical Cost</td>
                              <td className="calc-cell">{parseFloat(v.electricalPct)||0}% of base</td>
                              <td className="calc-cell">{calc.elecCost.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                            </tr>
                            <tr>
                              <td>Finishing Cost</td>
                              <td className="calc-cell">{parseFloat(v.finishingPct)||0}% of base</td>
                              <td className="calc-cell">{calc.finCost.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                            </tr>
                            <tr style={{background:"#fff8e6"}}>
                              <td><strong>Total Cost (with fixtures)</strong></td>
                              <td></td>
                              <td className="highlight"><strong>{calc.totalWithFixtures.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></td>
                            </tr>
                            <tr>
                              <td>Total Depreciation</td>
                              <td className="calc-cell">{calc.age} yr × {calc.depRate}% = {calc.totalDepPct.toFixed(2)}%</td>
                              <td className="calc-cell" style={{color:"var(--red)"}}>− {calc.totalDep.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                            </tr>
                            <tr className="total-row">
                              <td colSpan={2}><strong>ACTUAL COST OF BUILDING (Depreciated)</strong></td>
                              <td className="highlight"><strong>NPR {calc.actualValue.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></td>
                            </tr>
                            <tr style={{background:"#e8f5e9"}}>
                              <td><strong>Rounded Down Cost (to nearest 100)</strong></td>
                              <td className="calc-cell" style={{fontSize:"11px",color:"var(--text-3)"}}>floor({calc.actualValue.toLocaleString("en-NP",{maximumFractionDigits:2})} ÷ 100) × 100</td>
                              <td className="highlight" style={{color:"#2e7d32"}}><strong>NPR {calc.roundedValue.toLocaleString("en-NP")}</strong></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="summary-box" style={{marginBottom:"20px",padding:"14px 18px"}}>
                <div className="valuation-total" style={{margin:0}}>
                  <span>Total Building Valuation</span>
                  <span>NPR {totalBuildingValue.toLocaleString("en-NP",{maximumFractionDigits:2})}</span>
                </div>
              </div>
            </>
          )}

          <SectionHeader num="9" title="Summary of Valuation" />
          <div className="summary-box">
            <p><strong>Bank:</strong> {bank||"—"} &nbsp;|&nbsp; <strong>Branch:</strong> {branch||"—"}</p>
            <p><strong>Client(s):</strong> {clients.map(cl => {
              const parts = [];
              if (cl.showPerson && cl.person.name) parts.push(cl.person.name);
              if (cl.showCompany && cl.company.name) parts.push(cl.company.name);
              return parts.join(" / ") || "—";
            }).join(", ")}</p>
            <p><strong>Date of Field Visit:</strong> {visitDate||"—"} &nbsp;|&nbsp; <strong>Report Date:</strong> {reportDate||"—"}</p>
            <p><strong>Properties Mortgaged:</strong> {mortgaged.map(p=>p.plotNo).join(", ")||"None selected"}</p>

            {/* ── A. Commercial Value ── */}
            <div style={{margin:"16px 0 8px",border:"2px solid #2d6a4f",borderRadius:"8px",overflow:"hidden"}}>
              <div style={{background:"#2d6a4f",color:"#fff",padding:"8px 14px",fontWeight:700,fontSize:"13px",letterSpacing:"0.3px"}}>
                A. Commercial Value of Property
              </div>
              <div style={{padding:"10px 14px",background:"#f4f9f6"}}>
                <div style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",marginBottom:"4px",background:"#fff",borderRadius:"5px",fontSize:"13px",border:"1px solid #c8e6c9"}}>
                  <span>1. Value of Land <span style={{fontSize:"11px",color:"#666"}}>(Table 8 — Commercial Rounded)</span></span>
                  <strong>NPR {totalCommercialLand.toLocaleString("en-NP")}</strong>
                </div>
                {buildings.length > 0 && (
                  <div style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",marginBottom:"4px",background:"#fff",borderRadius:"5px",fontSize:"13px",border:"1px solid #c8e6c9"}}>
                    <span>2. Value of Building <span style={{fontSize:"11px",color:"#666"}}>(Table 8B — Rounded)</span></span>
                    <strong>NPR {totalBuildingValue.toLocaleString("en-NP")}</strong>
                  </div>
                )}
                <div style={{display:"flex",justifyContent:"space-between",padding:"8px 10px",background:"#2d6a4f",color:"#fff",borderRadius:"5px",fontSize:"14px",fontWeight:700,marginTop:"6px"}}>
                  <span>Total Commercial Value (A)</span>
                  <span>NPR {finalCommercialValue.toLocaleString("en-NP")}</span>
                </div>
                <div style={{marginTop:"8px",padding:"8px 10px",background:"#e8f5e9",borderRadius:"5px",fontSize:"12px",color:"#2d6a4f",fontStyle:"italic",borderLeft:"3px solid #2d6a4f"}}>
                  <strong>In Words:</strong> Nepalese Rupees {toWords(finalCommercialValue)} Only
                  <div style={{fontSize:"11px",marginTop:"2px",opacity:0.85}}>(NPR {Math.round(finalCommercialValue).toLocaleString("en-NP")}/-)</div>
                </div>
              </div>
            </div>

            {/* ── B. Fair Market Value ── */}
            <div style={{margin:"8px 0",border:"2px solid var(--accent)",borderRadius:"8px",overflow:"hidden"}}>
              <div style={{background:"var(--accent)",color:"#fff",padding:"8px 14px",fontWeight:700,fontSize:"13px",letterSpacing:"0.3px"}}>
                B. Fair Market Value (FMV)
              </div>
              <div style={{padding:"10px 14px",background:"#fdf7f0"}}>
                <div style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",marginBottom:"4px",background:"#fff",borderRadius:"5px",fontSize:"13px",border:"1px solid #f0d9c0"}}>
                  <span>1. Value of Land <span style={{fontSize:"11px",color:"#666"}}>(Table 8 — FMV Rounded)</span></span>
                  <strong>NPR {totalFMVLand.toLocaleString("en-NP")}</strong>
                </div>
                {buildings.length > 0 && (
                  <div style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",marginBottom:"4px",background:"#fff",borderRadius:"5px",fontSize:"13px",border:"1px solid #f0d9c0"}}>
                    <span>2. Value of Building <span style={{fontSize:"11px",color:"#666"}}>(Table 8B — Rounded)</span></span>
                    <strong>NPR {totalBuildingValue.toLocaleString("en-NP")}</strong>
                  </div>
                )}
                <div style={{display:"flex",justifyContent:"space-between",padding:"8px 10px",background:"var(--accent)",color:"#fff",borderRadius:"5px",fontSize:"14px",fontWeight:700,marginTop:"6px"}}>
                  <span>Total Fair Market Value (B)</span>
                  <span>NPR {finalFMValue.toLocaleString("en-NP")}</span>
                </div>
                <div style={{marginTop:"8px",padding:"8px 10px",background:"#fdf0e0",borderRadius:"5px",fontSize:"12px",color:"var(--accent)",fontStyle:"italic",borderLeft:"3px solid var(--accent)"}}>
                  <strong>In Words:</strong> Nepalese Rupees {toWords(finalFMValue)} Only
                  <div style={{fontSize:"11px",marginTop:"2px",opacity:0.85}}>(NPR {Math.round(finalFMValue).toLocaleString("en-NP")}/-)</div>
                </div>
              </div>
            </div>

            {/* ── C. Distress Value ── */}
            <div style={{margin:"8px 0",border:"2px solid #c0392b",borderRadius:"8px",overflow:"hidden"}}>
              <div style={{background:"#c0392b",color:"#fff",padding:"8px 14px",fontWeight:700,fontSize:"13px",letterSpacing:"0.3px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"8px"}}>
                <span>C. Distress Value ({distressPct||80}% of FMV)</span>
                <label style={{display:"flex",alignItems:"center",gap:"6px",fontWeight:500,fontSize:"12px"}}>
                  Weightage:
                  <input type="number" min="1" max="100" step="1"
                    value={distressPct}
                    onChange={e=>setDistressPct(e.target.value)}
                    style={{width:"60px",padding:"2px 6px",borderRadius:"4px",border:"none",
                      textAlign:"center",fontWeight:700,fontSize:"13px",color:"#c0392b"}}/>
                  %
                </label>
              </div>
              <div style={{padding:"10px 14px",background:"#fff5f5"}}>
                <div style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",marginBottom:"4px",background:"#fff",borderRadius:"5px",fontSize:"13px",border:"1px solid #f5c6c6"}}>
                  <span>1. Value of Land <span style={{fontSize:"11px",color:"#666"}}>({distressPct||80}% of FMV Land)</span></span>
                  <strong>NPR {(Math.floor(totalFMVLand * distressMultiplier / 100) * 100).toLocaleString("en-NP")}</strong>
                </div>
                {buildings.length > 0 && (
                  <div style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",marginBottom:"4px",background:"#fff",borderRadius:"5px",fontSize:"13px",border:"1px solid #f5c6c6"}}>
                    <span>2. Value of Building <span style={{fontSize:"11px",color:"#666"}}>({distressPct||80}% of Building Value)</span></span>
                    <strong>NPR {(Math.floor(totalBuildingValue * distressMultiplier / 100) * 100).toLocaleString("en-NP")}</strong>
                  </div>
                )}
                <div style={{display:"flex",justifyContent:"space-between",padding:"8px 10px",background:"#c0392b",color:"#fff",borderRadius:"5px",fontSize:"14px",fontWeight:700,marginTop:"6px"}}>
                  <span>Total Distress Value (C)</span>
                  <span>NPR {finalDistressValue.toLocaleString("en-NP")}</span>
                </div>
                <div style={{marginTop:"8px",padding:"8px 10px",background:"#fff0f0",borderRadius:"5px",fontSize:"12px",color:"#c0392b",fontStyle:"italic",borderLeft:"3px solid #c0392b"}}>
                  <strong>In Words:</strong> Nepalese Rupees {toWords(finalDistressValue)} Only
                  <div style={{fontSize:"11px",marginTop:"2px",opacity:0.85}}>(NPR {Math.round(finalDistressValue).toLocaleString("en-NP")}/-)</div>
                </div>
              </div>
            </div>

            {/* ── D. Government Value ── */}
            {finalGovValue > 0 && (
            <div style={{margin:"8px 0",border:"2px solid #1565c0",borderRadius:"8px",overflow:"hidden"}}>
              <div style={{background:"#1565c0",color:"#fff",padding:"8px 14px",fontWeight:700,fontSize:"13px",letterSpacing:"0.3px"}}>
                D. Government Value of Land
              </div>
              <div style={{padding:"10px 14px",background:"#e8f0fe"}}>
                {mortgaged.map(p=>{
                  const gRate = getGovRateForPlot(p.id);
                  const ca = getConsideredArea(p.id);
                  const gVal = Math.floor(gRate * sqmToAana(ca) / 100) * 100;
                  if (!gRate) return null;
                  return (
                    <div key={p.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",marginBottom:"4px",background:"#fff",borderRadius:"5px",fontSize:"13px",border:"1px solid #bbdefb"}}>
                      <span>Plot No. {p.plotNo||"—"} <span style={{fontSize:"11px",color:"#666"}}>({gRate.toLocaleString("en-NP")} NPR/Anna × {sqmToAana(ca).toFixed(4)} Anna)</span></span>
                      <strong>NPR {gVal.toLocaleString("en-NP")}</strong>
                    </div>
                  );
                })}
                <div style={{display:"flex",justifyContent:"space-between",padding:"8px 10px",background:"#1565c0",color:"#fff",borderRadius:"5px",fontSize:"14px",fontWeight:700,marginTop:"6px"}}>
                  <span>Total Government Value (D)</span>
                  <span>NPR {finalGovValue.toLocaleString("en-NP")}</span>
                </div>
                <div style={{marginTop:"8px",padding:"8px 10px",background:"#e3f2fd",borderRadius:"5px",fontSize:"12px",color:"#1565c0",fontStyle:"italic",borderLeft:"3px solid #1565c0"}}>
                  <strong>In Words:</strong> Nepalese Rupees {toWords(finalGovValue)} Only
                  <div style={{fontSize:"11px",marginTop:"2px",opacity:0.85}}>(NPR {Math.round(finalGovValue).toLocaleString("en-NP")}/-)</div>
                </div>
              </div>
            </div>
            )}

            <p className="disclaimer">
              This valuation report is prepared based on physical inspection conducted on {visitDate||"___"} and is valid for 
              a period of six months from the date of reporting. The valuation is subject to change with market conditions.
            </p>
          </div>

          {/* Remarks & Limiting Conditions — Preliminary Report only */}
          {reportType === "preliminary" && (<>
            <SectionHeader num="13" title="Remarks & Limiting Conditions" />
            <p className="hint" style={{color:"#b8860b",fontWeight:600}}>⚠ This section appears in the Preliminary Report only.</p>
            <div className="sub-grid" style={{gridTemplateColumns:"1fr"}}>
              <Field label="Remarks">
                <textarea value={remarks} onChange={e=>setRemarks(e.target.value)} rows={6}
                  placeholder="General remarks about the property, special considerations, etc."/>
              </Field>
              <Field label="Limiting Conditions">
                <label style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px",fontWeight:"600",fontSize:"13px",cursor:"pointer",userSelect:"none"}}>
                  <input type="checkbox" checked={includeLimitingConditions} onChange={e=>setIncludeLimitingConditions(e.target.checked)} style={{width:"15px",height:"15px",accentColor:"#1a3a6e",cursor:"pointer"}}/>
                  Include Limiting Conditions in report
                </label>
                {includeLimitingConditions && (
                  <textarea value={limitingConditions} onChange={e=>setLimitingConditions(e.target.value)} rows={4}
                    placeholder="e.g. Valuation valid for 6 months. Subject to change in market rates. Boundary not physically demarcated. Title verification pending. etc."/>
                )}
              </Field>
            </div>
          </>)}

        </div>
      )
    },
    // ── FINAL REPORT EXTRA SECTIONS ──────────────────────────────────────────
    {
      title: "Site Plan",
      render: () => {
        const addSitePlans = async (files) => {
          for (const file of files) {
            let dataUrl;
            if (file.type.startsWith("image/")) {
              dataUrl = await compressImageFile(file, 1600, 1200, 0.80);
            } else {
              dataUrl = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = ev => resolve(ev.target.result);
                reader.readAsDataURL(file);
              });
            }
            setSitePlans(prev => [...prev, { id: uid(), name: file.name.replace(/\.[^.]+$/, ''), dataUrl, rotation: 0 }]);
          }
        };

        return (
          <div>
            <SectionHeader num="8" title="Site and Location Plan" />
            <p className="hint">Upload site plan and location plan documents (images or PDFs). These appear in both reports before the photographs section. {sitePlans.length > 0 && <strong>{sitePlans.length} file{sitePlans.length!==1?"s":""} uploaded.</strong>}</p>

            <div style={{
              border:"1.5px solid var(--border)", borderRadius:"var(--radius-lg)",
              overflow:"hidden", background:"var(--surface)", boxShadow:"var(--shadow-sm)",
            }}>
              {/* Header */}
              <div style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"12px 16px",
                background: sitePlans.length > 0 ? "var(--accent-bg)" : "var(--surface-2)",
                borderBottom: sitePlans.length > 0 ? "1px solid var(--border)" : "none",
              }}>
                <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                  <span style={{fontSize:"20px"}}>🗺️</span>
                  <div>
                    <div style={{fontWeight:700,fontSize:"14px",color:"var(--navy)"}}>Site &amp; Location Plans</div>
                    <div style={{fontSize:"11px",color:"var(--text-3)",marginTop:"1px"}}>
                      {sitePlans.length === 0 ? "No files uploaded" : `${sitePlans.length} file${sitePlans.length!==1?"s":""} uploaded`}
                    </div>
                  </div>
                </div>
                <label style={{
                  display:"inline-flex",alignItems:"center",gap:"6px",
                  padding:"7px 14px",
                  background:"var(--green-pale)",border:"1.5px solid var(--green)",
                  color:"var(--green)",borderRadius:"var(--radius)",
                  fontWeight:700,fontSize:"12px",cursor:"pointer",whiteSpace:"nowrap",
                }}>
                  {sitePlans.length === 0 ? "📎 Upload" : "➕ Add More"}
                  <input type="file" accept="image/*,application/pdf" multiple style={{display:"none"}}
                    onChange={e=>{ addSitePlans(Array.from(e.target.files||[])); e.target.value=''; }}/>
                </label>
              </div>

              {/* Thumbnail grid */}
              {sitePlans.length > 0 && (
                <div style={{padding:"12px 16px"}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:"10px"}}>
                    {sitePlans.map((sp, i) => (
                      <div key={sp.id} style={{
                        border:"1px solid var(--border)",borderRadius:"8px",
                        overflow:"hidden",background:"var(--surface-2)",position:"relative",
                      }}>
                        {/* Thumbnail — click to view */}
                        {sp.dataUrl?.startsWith("data:image") ? (
                          <div style={{position:"relative",cursor:"pointer"}}
                            onClick={()=>{setViewerDoc({id:sp.id,dataUrl:sp.dataUrl,name:sp.name||`Plan ${i+1}`,source:"sitePlan"});setViewerRotation(sp.rotation||0);}}>
                            <img src={sp.dataUrl} alt={sp.name}
                              style={{width:"100%",height:"100px",objectFit:"cover",display:"block",
                                transform:`rotate(${sp.rotation||0}deg)`,transition:"transform 0.3s"}}/>
                            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",
                              justifyContent:"center",background:"rgba(0,0,0,0.35)",opacity:0,
                              transition:"opacity 0.15s"}}
                              onMouseEnter={e=>e.currentTarget.style.opacity=1}
                              onMouseLeave={e=>e.currentTarget.style.opacity=0}>
                              <span style={{color:"#fff",fontSize:"13px",fontWeight:700,
                                background:"rgba(0,0,0,0.5)",padding:"4px 10px",borderRadius:"6px"}}>View</span>
                            </div>
                          </div>
                        ) : (
                          <div style={{height:"100px",display:"flex",alignItems:"center",
                            justifyContent:"center",background:"#f0f4ff",fontSize:"32px",cursor:"pointer"}}
                            onClick={()=>{setViewerDoc({id:sp.id,dataUrl:sp.dataUrl,name:sp.name||`Plan ${i+1}`,source:"sitePlan"});setViewerRotation(sp.rotation||0);}}>
                            📄
                          </div>
                        )}
                        {/* File name */}
                        <div style={{padding:"5px 8px",fontSize:"11px",color:"var(--text-2)",
                          fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}
                          title={sp.name}>
                          {sp.name || `Plan ${i+1}`}
                        </div>
                        {/* Remove */}
                        <button
                          onClick={()=>setSitePlans(prev=>prev.filter(x=>x.id!==sp.id))}
                          style={{
                            position:"absolute",top:"4px",right:"4px",
                            width:"22px",height:"22px",borderRadius:"50%",
                            background:"rgba(192,57,43,0.85)",color:"#fff",
                            border:"none",cursor:"pointer",fontSize:"12px",
                            display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,
                          }}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      }
    },
    {
      title: "Photographs",
      render: () => (
        <div>
          <SectionHeader num="F6" title="Property Photographs" />
          <p className="hint">Upload photographs of the property. These will be embedded in both the Preliminary and Final Reports as landscape A4 pages. Maximum 10 photos.</p>
          <div style={{marginBottom:"14px",display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
            <label style={{display:"inline-flex",alignItems:"center",gap:"8px",padding:"9px 18px",
              background:"var(--green-light)",border:"1.5px solid var(--green)",color:"var(--green)",
              borderRadius:"var(--radius)",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>
              📷 Add Photos
              <input type="file" accept="image/*" multiple style={{display:"none"}}
                onChange={e=>{
                  const files = Array.from(e.target.files||[]);
                  files.forEach(async file=>{
                    if(photos.length>=10) return;
                    const compressed = await compressImageFile(file, 1400, 1050, 0.75);
                    setPhotos(ps=>{
                      if(ps.length>=10) return ps;
                      return [...ps,{id:uid(),caption:"",dataUrl:compressed}];
                    });
                  });
                  e.target.value="";
                }}/>
            </label>
            {photos.length > 0 && (
              <button
                style={{display:"inline-flex",alignItems:"center",gap:"8px",padding:"9px 18px",
                  background:"var(--accent-bg)",border:"1.5px solid var(--accent)",color:"var(--accent)",
                  borderRadius:"var(--radius)",fontWeight:700,fontSize:"13px",cursor:"pointer"}}
                onClick={()=>{
                  photos.forEach((ph, i) => {
                    const ext = ph.dataUrl.startsWith("data:image/png") ? "png" : "jpg";
                    const filename = (ph.caption||`Photo_${i+1}`).replace(/[^a-zA-Z0-9_\-. ]/g,"_").trim() + "." + ext;
                    const a = document.createElement("a");
                    a.href = ph.dataUrl;
                    a.download = filename;
                    a.style.cssText = "position:fixed;left:-9999px";
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(()=>document.body.removeChild(a), 200);
                  });
                }}>
                💾 Save All Photos ({photos.length})
              </button>
            )}
            <span style={{fontSize:"12px",color:"var(--text-3)",marginLeft:"4px"}}>{photos.length}/10 photos</span>
          </div>
          {photos.length === 0 && (
            <div style={{padding:"30px",textAlign:"center",border:"1.5px dashed var(--border)",borderRadius:"8px",color:"var(--text-3)",fontStyle:"italic"}}>
              No photos added yet. Click "Add Photos" to upload images.
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:"14px"}}>
            {photos.map((ph,i)=>(
              <div key={ph.id} style={{border:"1.5px solid var(--border)",borderRadius:"8px",overflow:"hidden",background:"var(--surface)"}}>
                <img src={ph.dataUrl} alt={ph.caption||`Photo ${i+1}`} style={{width:"100%",height:"160px",objectFit:"cover",display:"block"}}/>
                <div style={{padding:"8px"}}>
                  <input value={ph.caption} onChange={e=>setPhotos(ps=>ps.map(p=>p.id===ph.id?{...p,caption:e.target.value}:p))}
                    placeholder={`Caption for photo ${i+1}`} style={{marginBottom:"6px"}}/>
                  <div style={{display:"flex",gap:"6px"}}>
                    <button
                      onClick={()=>setEditingPhoto(ph)}
                      style={{flex:1,padding:"6px",background:"var(--accent-bg)",color:"var(--accent)",
                        border:"1.5px solid var(--accent-light)",borderRadius:"6px",
                        fontWeight:700,fontSize:"12px",cursor:"pointer"}}>
                      ✏️ Edit
                    </button>
                    <button className="btn-remove" onClick={()=>setPhotos(ps=>ps.filter(p=>p.id!==ph.id))}
                      style={{flex:1}}>✕ Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Photo editor modal */}
          {editingPhoto && (
            <PhotoEditor
              photo={editingPhoto}
              onSave={dataUrl => {
                setPhotos(ps => ps.map(p => p.id === editingPhoto.id ? { ...p, dataUrl } : p));
                setEditingPhoto(null);
              }}
              onClose={() => setEditingPhoto(null)}
            />
          )}
        </div>
      )
    },
    {
      title: "Legal Documents",
      render: () => {
        const DOC_CATEGORIES = [
          { key: "govt_rate",        label: "Government Rate",                  icon: "🏛️" },
          { key: "lorc",             label: "LORC",                             icon: "📋" },
          { key: "citizenship",      label: "Citizenship",                      icon: "🪪" },
          { key: "trace",            label: "Trace",                            icon: "🗺️" },
          { key: "charkilla",        label: "Charkilla",                        icon: "📐" },
          { key: "tiro_receipt",     label: "Tiro Receipt",                     icon: "🧾" },
          { key: "company_doc",      label: "Company Document",                 icon: "🏢" },
          { key: "building_approval",label: "Building Approval",                icon: "🏗️" },
          { key: "completion_cert",  label: "Building Completion Certificate",  icon: "✅" },
          { key: "building_drawing", label: "Building Drawing",                 icon: "📏" },
          { key: "other",            label: "Other Documents",                  icon: "📎" },
        ];

        const addDocForCategory = async (files, catKey) => {
          for (const file of files) {
            let dataUrl;
            if (file.type.startsWith("image/")) {
              dataUrl = await compressImageFile(file, 1600, 1200, 0.80);
            } else {
              dataUrl = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = ev => resolve(ev.target.result);
                reader.readAsDataURL(file);
              });
            }
            setLegalDocs(ds => {
              if (ds.length >= 40) return ds;
              return [...ds, {
                id: uid(),
                name: file.name.replace(/\.[^.]+$/, ''),
                category: catKey,
                dataUrl,
                rotation: 0,
                pdfPageRotations: [],
                // legacy fields kept for report compatibility
                fileNo: '', date: '', issuedBy: '', remarks: '',
              }];
            });
          }
        };

        const totalCount = legalDocs.length;

        return (
          <div>
            <SectionHeader num="F6b" title="Legal Documents" />
            <p className="hint">Upload documents under each category. They will appear in the final report. {totalCount > 0 && <strong>{totalCount} file{totalCount!==1?"s":""} uploaded.</strong>}</p>

            <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
              {DOC_CATEGORIES.map(cat => {
                const catDocs = legalDocs.filter(d => d.category === cat.key);

                return (
                  <div key={cat.key} style={{
                    border:"1.5px solid var(--border)", borderRadius:"var(--radius-lg)",
                    overflow:"hidden", background:"var(--surface)",
                    boxShadow:"var(--shadow-sm)",
                  }}>
                    {/* Category header */}
                    <div style={{
                      display:"flex", alignItems:"center", justifyContent:"space-between",
                      padding:"12px 16px",
                      background: catDocs.length > 0 ? "var(--accent-bg)" : "var(--surface-2)",
                      borderBottom: catDocs.length > 0 ? "1px solid var(--border)" : "none",
                    }}>
                      <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                        <span style={{fontSize:"20px"}}>{cat.icon}</span>
                        <div>
                          <div style={{fontWeight:700,fontSize:"14px",color:"var(--navy)"}}>{cat.label}</div>
                          <div style={{fontSize:"11px",color:"var(--text-3)",marginTop:"1px"}}>
                            {catDocs.length === 0
                              ? (cat.multiple ? "No files yet" : "Not uploaded")
                              : `${catDocs.length} file${catDocs.length!==1?"s":""} uploaded`}
                          </div>
                        </div>
                      </div>
                      {/* Always show upload button — multiple files always allowed */}
                        <label style={{
                          display:"inline-flex",alignItems:"center",gap:"6px",
                          padding:"7px 14px",
                          background:"var(--green-pale)",border:"1.5px solid var(--green)",
                          color:"var(--green)",borderRadius:"var(--radius)",
                          fontWeight:700,fontSize:"12px",cursor:"pointer",
                          whiteSpace:"nowrap",
                        }}>
                          {catDocs.length === 0 ? "📎 Upload" : "➕ Add More"}
                          <input type="file" accept="image/*,application/pdf"
                            multiple style={{display:"none"}}
                            onChange={e=>{
                              addDocForCategory(Array.from(e.target.files||[]), cat.key);
                              e.target.value='';
                            }}/>
                        </label>
                    </div>

                    {/* Uploaded files grid */}
                    {catDocs.length > 0 && (
                      <div style={{padding:"12px 16px"}}>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:"10px"}}>
                          {catDocs.map((doc, di) => (
                            <div key={doc.id} style={{
                              border:"1px solid var(--border)",borderRadius:"8px",
                              overflow:"hidden",background:"var(--surface-2)",
                              position:"relative",
                            }}>
                              {/* Thumbnail — click to view */}
                              {doc.dataUrl?.startsWith("data:image") ? (
                                <div style={{position:"relative",cursor:"pointer"}}
                                  onClick={()=>{setViewerDoc({id:doc.id,dataUrl:doc.dataUrl,name:doc.name||`File ${di+1}`});setViewerRotation(doc.rotation||0);}}>
                                  <img src={doc.dataUrl} alt={doc.name}
                                    style={{width:"100%",height:"100px",objectFit:"cover",display:"block",
                                      transform:`rotate(${doc.rotation||0}deg)`,
                                      transition:"transform 0.3s"}}/>
                                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",
                                    justifyContent:"center",background:"rgba(0,0,0,0.35)",opacity:0,
                                    transition:"opacity 0.15s"}}
                                    onMouseEnter={e=>e.currentTarget.style.opacity=1}
                                    onMouseLeave={e=>e.currentTarget.style.opacity=0}>
                                    <span style={{color:"#fff",fontSize:"13px",fontWeight:700,
                                      background:"rgba(0,0,0,0.5)",padding:"4px 10px",borderRadius:"6px"}}>
                                      View
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div style={{height:"100px",display:"flex",alignItems:"center",
                                  justifyContent:"center",background:"#f0f4ff",fontSize:"32px",
                                  cursor:"pointer"}}
                                  onClick={()=>{setViewerDoc({id:doc.id,dataUrl:doc.dataUrl,name:doc.name||`File ${di+1}`});setViewerRotation(doc.rotation||0);}}>
                                  📄
                                </div>
                              )}
                              {/* File name */}
                              <div style={{padding:"5px 8px",fontSize:"11px",color:"var(--text-2)",
                                fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}
                                title={doc.name}>
                                {doc.name || `File ${di+1}`}
                              </div>
                              {/* Remove button */}
                              <button
                                onClick={()=>setLegalDocs(ds=>ds.filter(d=>d.id!==doc.id))}
                                style={{
                                  position:"absolute",top:"4px",right:"4px",
                                  width:"22px",height:"22px",borderRadius:"50%",
                                  background:"rgba(192,57,43,0.85)",color:"#fff",
                                  border:"none",cursor:"pointer",fontSize:"12px",
                                  display:"flex",alignItems:"center",justifyContent:"center",
                                  lineHeight:1,
                                }}>✕</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      }
    },
    {
      title: "Report",
      render: () => (
        <ReportSection
          collectState={collectState}
          getFileName={getFileName}
          showToast={showToast}
          reportType={reportType}
          setReportType={setReportType}
          reportId={reportId}
          fieldChargeReceived={fieldChargeReceived}
          setFieldChargeReceived={setFieldChargeReceived}
          fieldChargeAmount={fieldChargeAmount}
          setFieldChargeAmount={setFieldChargeAmount}
          transportationCharge={transportationCharge}
          setTransportationCharge={setTransportationCharge}
          billNo={billNo}
          setBillNo={setBillNo}
          includeVat={includeVat}
          setIncludeVat={setIncludeVat}
          billRemarks={billRemarks}
          setBillRemarks={setBillRemarks}
          extraChargeLabel={extraChargeLabel}
          setExtraChargeLabel={setExtraChargeLabel}
          extraChargeAmount={extraChargeAmount}
          setExtraChargeAmount={setExtraChargeAmount}
          discountAmount={discountAmount}
          setDiscountAmount={setDiscountAmount}
          deductFieldVisit={deductFieldVisit}
          setDeductFieldVisit={setDeductFieldVisit}
          billingSystem={billingSystem}
          setBillingSystem={setBillingSystem}
          billQrCode={billQrCode}
          setBillQrCode={setBillQrCode}
          amountReceived={amountReceived}
          setAmountReceived={setAmountReceived}
          finalFMV={finalFMValue}
          bank={bank}
          clients={clients}
          owners={owners}
          hasBuilding={hasBuilding}
          properties={properties}
        />
      ),
    },
  ];

  return (
    <div className="app">
      {/* ── Guthi Raitani warning popup ───────────────────────────────────── */}
      {guthiAlert && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:"12px",padding:"32px 28px",maxWidth:"420px",width:"90%",boxShadow:"0 8px 32px rgba(0,0,0,0.25)",fontFamily:"'Segoe UI',sans-serif"}}>
            <div style={{fontSize:"36px",textAlign:"center",marginBottom:"12px"}}>⚠️</div>
            <h3 style={{fontSize:"15px",fontWeight:700,color:"#7b3f00",textAlign:"center",marginBottom:"14px",lineHeight:1.4}}>
              Guthi Raitani Ownership
            </h3>
            <p style={{fontSize:"13px",color:"#333",lineHeight:1.6,marginBottom:"24px",textAlign:"center"}}>
              Have you asked for the <strong>Malpot letter</strong> for verification?<br/>
              Raitani ownership may have been changed <strong>before 2066/10/10</strong>.
            </p>
            <div style={{display:"flex",gap:"12px",justifyContent:"center"}}>
              <button
                onClick={()=>setGuthiAlert(null)}
                style={{padding:"9px 32px",background:"#1a56db",color:"#fff",border:"none",borderRadius:"7px",fontSize:"14px",fontWeight:600,cursor:"pointer"}}
              >Yes</button>
              <button
                onClick={()=>setGuthiAlert(null)}
                style={{padding:"9px 32px",background:"#f3f4f6",color:"#333",border:"1px solid #d1d5db",borderRadius:"7px",fontSize:"14px",fontWeight:600,cursor:"pointer"}}
              >No</button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          /* Core palette — deep navy + warm gold */
          --navy:        #0f1f3d;
          --navy-2:      #1a3160;
          --navy-3:      #243d7a;
          --gold:        #c9922a;
          --gold-light:  #e8b84b;
          --gold-pale:   #fdf5e6;
          --gold-border: #e8c87a;

          /* Surfaces */
          --bg:          #f0f3f8;
          --surface:     #ffffff;
          --surface-2:   #f7f9fc;
          --surface-3:   #edf1f7;

          /* Text */
          --text:        #0f1f3d;
          --text-2:      #3d5080;
          --text-3:      #7a90b8;

          /* Accents */
          --green:       #1a6b4a;
          --green-pale:  #e8f5ef;
          --red:         #c0392b;
          --red-pale:    #fef2f2;

          /* UI tokens */
          --border:      #d0d9ea;
          --border-dark: #a8b8d4;
          --radius:      8px;
          --radius-lg:   14px;
          --shadow-sm:   0 1px 3px rgba(15,31,61,0.07), 0 2px 8px rgba(15,31,61,0.05);
          --shadow:      0 4px 16px rgba(15,31,61,0.10), 0 1px 3px rgba(15,31,61,0.06);
          --shadow-lg:   0 12px 40px rgba(15,31,61,0.15), 0 4px 12px rgba(15,31,61,0.08);
          --accent:      var(--navy);
          --accent-light: var(--navy-2);
          --accent-bg:   #e8edf8;
          --highlight:   var(--gold);
          --selected-bg: var(--gold-pale);
        }

        body {
          font-family: 'DM Sans', system-ui, sans-serif;
          background: var(--bg);
          color: var(--text);
          font-size: 14px;
          line-height: 1.5;
          -webkit-font-smoothing: antialiased;
        }

        .app { height: 100vh; display: flex; flex-direction: column; overflow: hidden; }

        /* ── Header ─────────────────────────────────────────────── */
        .app-header {
          background: linear-gradient(135deg, var(--navy) 0%, var(--navy-2) 60%, var(--navy-3) 100%);
          color: white;
          padding: 0 24px;
          position: sticky; top: 0; z-index: 100;
          box-shadow: 0 2px 20px rgba(15,31,61,0.35);
        }
        .header-top {
          display: grid; grid-template-columns: 1fr auto 1fr;
          align-items: center; gap: 12px; min-height: 68px; padding: 8px 0;
        }
        .header-center {
          display: flex; flex-direction: column; align-items: center; text-align: center;
        }
        .app-header h1 {
          font-family: 'DM Serif Display', serif;
          font-size: 22px; font-weight: 700; letter-spacing: 0.01em;
          display: flex; align-items: center; gap: 10px; margin: 0;
        }
        .app-header h1::before {
          content: '🏛️'; font-size: 24px;
        }
        .app-header p { font-size: 12px; opacity: 0.6; margin-top: 2px; }
        .dev-credit { font-size: 10px !important; opacity: 0.45 !important; letter-spacing: 0.3px; margin-top: 2px !important; }
        .header-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
        .hdr-btn {
          background: rgba(255,255,255,0.10);
          border: 1px solid rgba(255,255,255,0.20);
          color: rgba(255,255,255,0.90); padding: 7px 14px; border-radius: 6px;
          font-size: 12px; font-weight: 600; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          transition: all 0.18s cubic-bezier(0.4,0,0.2,1);
          white-space: nowrap; letter-spacing: 0.02em;
        }
        .hdr-btn:hover {
          background: rgba(255,255,255,0.20);
          border-color: rgba(255,255,255,0.40);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .hdr-btn.accent {
          background: linear-gradient(135deg, var(--gold) 0%, var(--gold-light) 100%);
          color: var(--navy); border-color: var(--gold);
          font-weight: 700;
        }
        .hdr-btn.accent:hover {
          background: linear-gradient(135deg, var(--gold-light) 0%, #f0c060 100%);
          box-shadow: 0 4px 16px rgba(201,146,42,0.4);
        }
        .header-meta {
          display: flex; align-items: center; gap: 10px;
          margin-top: 0; padding: 8px 0; flex-wrap: wrap;
          border-top: 1px solid rgba(255,255,255,0.10);
        }
        .report-badge {
          font-size: 10px; font-weight: 700; letter-spacing: 2.5px;
          padding: 3px 12px; border-radius: 20px; text-transform: uppercase;
        }
        .report-badge.preliminary {
          background: rgba(201,146,42,0.2); border: 1px solid rgba(232,184,75,0.5);
          color: #f0c060;
        }
        .report-badge.final {
          background: rgba(26,107,74,0.3); border: 1px solid rgba(26,107,74,0.6);
          color: #5de0a0;
        }
        .header-filename {
          font-size: 11px; opacity: 0.5; font-style: italic;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 520px;
        }

        /* ── Toast ───────────────────────────────────────────────── */
        .toast {
          position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
          background: var(--navy); color: white;
          padding: 12px 24px; border-radius: 40px;
          font-size: 13px; font-weight: 500; z-index: 9999;
          box-shadow: 0 8px 32px rgba(15,31,61,0.35);
          pointer-events: none; border: 1px solid rgba(255,255,255,0.12);
          animation: toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes toastIn {
          from { opacity:0; transform:translateX(-50%) translateY(16px) scale(0.9); }
          to   { opacity:1; transform:translateX(-50%) translateY(0)    scale(1);   }
        }

        /* ── Modal ───────────────────────────────────────────────── */
        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(10,20,45,0.65);
          backdrop-filter: blur(4px);
          z-index: 9000;
          display: flex; align-items: flex-start; justify-content: center; padding: 0;
        }
        .modal-box {
          background: white; width: 100%; max-width: 1000px; height: 100vh;
          display: flex; flex-direction: column;
          box-shadow: var(--shadow-lg);
        }
        .modal-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 14px 20px;
          background: linear-gradient(135deg, var(--navy) 0%, var(--navy-2) 100%);
          color: white; flex-shrink: 0; flex-wrap: wrap; gap: 10px;
        }
        .modal-header strong { font-size: 14px; font-family: 'DM Serif Display', serif; font-weight: 400; }
        .modal-hint { font-size: 12px; margin-left: 6px; opacity: 0.7; }
        .modal-close {
          background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.25);
          color: white; padding: 7px 16px; border-radius: 6px; cursor: pointer;
          font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif;
          transition: all 0.15s;
        }
        .modal-close:hover { background: rgba(255,255,255,0.22); }
        .modal-print-btn {
          background: linear-gradient(135deg, var(--gold) 0%, var(--gold-light) 100%);
          border: none; color: var(--navy); padding: 7px 18px;
          border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 700;
          font-family: 'DM Sans', sans-serif; transition: all 0.15s;
        }
        .modal-print-btn:hover { filter: brightness(1.08); }

        /* ── Action grid ─────────────────────────────────────────── */
        .report-type-bar {
          display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
          background: var(--surface-2); border: 1.5px solid var(--border);
          border-radius: var(--radius-lg); padding: 12px 16px; margin-bottom: 18px;
          box-shadow: var(--shadow-sm);
        }
        .report-type-label { font-size: 11px; font-weight: 700; color: var(--text-2); text-transform: uppercase; letter-spacing: 0.08em; }
        .filename-preview { font-size: 11px; color: var(--text-3); font-style: italic; margin-left: auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 400px; }
        .action-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-top: 16px; }
        @media (max-width: 700px) { .action-grid { grid-template-columns: repeat(2,1fr); } }
        .action-btn {
          padding: 13px 8px; border-radius: var(--radius); font-size: 12px;
          font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif;
          transition: all 0.18s cubic-bezier(0.4,0,0.2,1);
          text-align: center; border: 1.5px solid transparent;
          letter-spacing: 0.02em;
        }
        .action-btn:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
        .action-btn:active { transform: translateY(0); }
        .action-btn.save   { background: var(--green-pale); border-color: var(--green); color: var(--green); }
        .action-btn.save:hover { background: var(--green); color: white; }
        .action-btn.open   { background: #e8edf8; border-color: var(--navy-2); color: var(--navy-2); }
        .action-btn.open:hover { background: var(--navy-2); color: white; }
        .action-btn.preview{ background: var(--surface-3); border-color: var(--border-dark); color: var(--text-2); }
        .action-btn.preview:hover { background: var(--navy); color: white; border-color: var(--navy); }
        .action-btn.print  { background: var(--gold-pale); border-color: var(--gold-border); color: var(--gold); }
        .action-btn.print:hover { background: var(--gold); color: white; border-color: var(--gold); }
        .action-btn.pdf    {
          background: linear-gradient(135deg, var(--navy) 0%, var(--navy-2) 100%);
          border-color: var(--navy); color: white;
        }
        .action-btn.pdf:hover { filter: brightness(1.15); }

        /* ── Main body layout (sidebar + content) ───────────────── */
        .main-body {
          display: flex;
          flex: 1;          /* fills all remaining height inside .app column */
          overflow: hidden; /* prevents the body itself from scrolling */
        }

        /* ── Nav tabs (left sidebar) ─────────────────────────────── */
        .nav-tabs {
          display: flex; flex-direction: column; gap: 0;
          background: linear-gradient(180deg, #0b1830 0%, var(--navy) 100%);
          width: 215px; min-width: 215px; flex-shrink: 0;
          overflow-y: auto; overflow-x: hidden;
          border-right: 1px solid rgba(255,255,255,0.06);
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.15) transparent;
          scroll-behavior: smooth;
          height: 100%;
        }
        .nav-tabs::-webkit-scrollbar { width: 4px; }
        .nav-tabs::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }

        /* sidebar progress header */
        .nav-sidebar-head {
          padding: 14px 16px 10px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
        }
        .nav-sidebar-head-label {
          font-size: 9px; font-weight: 700; letter-spacing: 1.5px;
          color: rgba(255,255,255,0.35); text-transform: uppercase; margin-bottom: 8px;
        }
        .nav-progress-bar {
          height: 3px; background: rgba(255,255,255,0.1);
          border-radius: 3px; overflow: hidden;
        }
        .nav-progress-fill {
          height: 100%;
          background: linear-gradient(to right, var(--gold), var(--gold-light));
          border-radius: 3px; transition: width 0.35s cubic-bezier(0.4,0,0.2,1);
        }
        .nav-progress-text {
          font-size: 10px; color: rgba(255,255,255,0.40); margin-top: 5px;
          display: flex; justify-content: space-between;
        }

        .nav-tab {
          padding: 10px 12px; font-size: 11px; font-weight: 500;
          color: rgba(255,255,255,0.50);
          cursor: pointer; white-space: normal; border: none; background: transparent;
          transition: all 0.18s; letter-spacing: 0.025em;
          font-family: 'DM Sans', sans-serif;
          text-align: left; line-height: 1.35;
          position: relative; display: flex; align-items: flex-start; gap: 8px;
        }
        .nav-tab-num {
          flex-shrink: 0; width: 20px; height: 20px; border-radius: 5px;
          background: rgba(255,255,255,0.07);
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 700; transition: all 0.18s;
          margin-top: 0px;
        }
        .nav-tab-label { flex: 1; text-transform: uppercase; letter-spacing: 0.04em; padding-top: 2px; }
        .nav-tab:hover { color: rgba(255,255,255,0.80); }
        .nav-tab:hover .nav-tab-num { background: rgba(201,146,42,0.25); color: var(--gold-light); }
        .nav-tab.active {
          color: #fff;
          background: rgba(201,146,42,0.10);
          border-radius: 0;
        }
        .nav-tab.active .nav-tab-num {
          background: linear-gradient(135deg, var(--gold) 0%, var(--gold-light) 100%);
          color: var(--navy); font-weight: 800;
          box-shadow: 0 2px 8px rgba(201,146,42,0.4);
        }
        .nav-tab.active .nav-tab-label { color: var(--gold-light); font-weight: 700; }
        /* active left accent line */
        .nav-tab.active::before {
          content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
          background: linear-gradient(to bottom, var(--gold), var(--gold-light));
          border-radius: 0 2px 2px 0;
        }

        /* ── Content area ────────────────────────────────────────── */
        .content {
          flex: 1;
          overflow-y: auto; overflow-x: hidden;
          padding: 28px 28px 80px;
          background: var(--bg);
        }

        /* ── Section card wrapper ────────────────────────────────── */
        .section-card {
          background: var(--surface); border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
          padding: 28px 28px 20px;
          border: 1px solid var(--border);
          position: relative; overflow: hidden;
          margin-bottom: 24px;
        }
        .section-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(to right, var(--gold), var(--gold-border), transparent);
        }

        /* ── Section headers ─────────────────────────────────────── */
        .section-header {
          display: flex; align-items: center; gap: 12px;
          margin: 32px 0 20px; padding-bottom: 0;
        }
        .sec-num {
          background: linear-gradient(135deg, var(--navy) 0%, var(--navy-2) 100%);
          color: white; font-family: 'DM Serif Display', serif;
          font-size: 12px; font-weight: 400; padding: 4px 10px; border-radius: 5px;
          letter-spacing: 0.06em; min-width: 32px; text-align: center;
          box-shadow: 0 2px 8px rgba(15,31,61,0.25);
        }
        .sec-title {
          font-family: 'DM Serif Display', serif; font-size: 19px;
          font-weight: 400; color: var(--navy); letter-spacing: 0.01em;
        }
        .section-header::after {
          content: ''; flex: 1; height: 1px;
          background: linear-gradient(to right, var(--gold-border), transparent);
          margin-left: 8px;
        }

        /* ── Grid ────────────────────────────────────────────────── */
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .sub-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        @media (max-width: 600px) { .grid-2, .sub-grid { grid-template-columns: 1fr; } }

        /* ── Fields ──────────────────────────────────────────────── */
        .field { display: flex; flex-direction: column; gap: 5px; }
        .field label {
          font-size: 11px; font-weight: 600; color: var(--text-2);
          text-transform: uppercase; letter-spacing: 0.07em;
        }
        .req { color: var(--red); }
        input, input[type=text], input[type=number], input[type=date],
        input[type=email], input[type=tel], input[type=url],
        input[type=password], select, textarea {
          border: 1.5px solid var(--border);
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 14px; font-family: 'DM Sans', sans-serif;
          background: var(--surface); color: var(--text);
          transition: border-color 0.18s, box-shadow 0.18s;
          width: 100%;
          box-shadow: 0 1px 3px rgba(15,31,61,0.06);
          box-sizing: border-box;
        }
        /* Exclude checkbox/radio/file/color/range/submit/button inputs */
        input[type=checkbox], input[type=radio], input[type=file],
        input[type=color], input[type=range], input[type=submit],
        input[type=button], input[type=hidden] {
          width: auto; padding: 0; border: none; border-radius: 0;
          box-shadow: none; background: none;
        }
        select {
          appearance: none; -webkit-appearance: none;
          padding-right: 36px;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%237a90b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          cursor: pointer;
        }
        input:focus, select:focus, textarea:focus {
          outline: none; border-color: var(--gold-border);
          box-shadow: 0 0 0 3px rgba(201,146,42,0.12), 0 0 0 1px var(--gold-border);
        }
        input:hover:not(:focus), select:hover:not(:focus), textarea:hover:not(:focus) {
          border-color: var(--border-dark);
        }
        /* Table inputs — keep rounded but allow custom widths */
        table input, table select {
          border-radius: 8px;
          padding: 7px 10px;
          font-size: 13px;
        }
        textarea { resize: vertical; min-height: 64px; line-height: 1.5; }
        .input-unit-row { display: flex; gap: 8px; align-items: center; }
        .unit-badge {
          background: var(--surface-2); border: 1.5px solid var(--border);
          border-radius: 10px; padding: 9px 14px; font-size: 13px;
          color: var(--text-2); font-weight: 600; white-space: nowrap;
          box-shadow: 0 1px 3px rgba(15,31,61,0.06);
        }

        /* ── Area unit tabs ──────────────────────────────────────── */
        .area-unit-tabs {
          display: flex; gap: 0; margin-bottom: 10px; border-radius: var(--radius);
          overflow: hidden; border: 1.5px solid var(--border); width: fit-content;
        }
        .area-tab {
          padding: 6px 16px; font-size: 12px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          border: none; cursor: pointer; background: var(--surface-2);
          color: var(--text-2); letter-spacing: 0.04em; transition: all 0.15s;
        }
        .area-tab:first-child { border-right: 1.5px solid var(--border); }
        .area-tab.active {
          background: linear-gradient(135deg, var(--navy) 0%, var(--navy-2) 100%);
          color: white;
        }

        /* ── RADP inputs ─────────────────────────────────────────── */
        .radp-inputs { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; }
        .radp-cell { display: flex; flex-direction: column; gap: 4px; }
        .radp-cell input { text-align: center; padding: 8px 4px; }
        .radp-cell span {
          font-size: 10px; font-weight: 700; text-align: center;
          color: var(--text-3); text-transform: uppercase; letter-spacing: 0.08em;
        }
        .area-equiv {
          font-size: 11px; color: var(--gold); margin-top: 6px;
          padding: 5px 10px; background: var(--gold-pale);
          border-radius: 5px; font-style: italic; border-left: 2px solid var(--gold-border);
        }

        /* ── Radio / check buttons ───────────────────────────────── */
        .radio-group { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .radio-btn {
          display: flex; align-items: center; gap: 8px; padding: 10px 18px;
          border: 2px solid var(--border); border-radius: var(--radius); cursor: pointer;
          font-size: 14px; font-weight: 500; transition: all 0.18s; background: var(--surface-2);
        }
        .radio-btn input[type=radio] { width: auto; accent-color: var(--gold); }
        .radio-btn.active {
          border-color: var(--gold-border); background: var(--gold-pale);
          color: var(--navy); box-shadow: 0 0 0 1px var(--gold-border);
        }
        .radio-btn-sm {
          display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px;
          border: 1.5px solid var(--border); border-radius: 6px; cursor: pointer;
          font-size: 12px; font-weight: 500; transition: all 0.15s; background: var(--surface-2);
        }
        .radio-btn-sm.active { border-color: var(--gold-border); background: var(--gold-pale); color: var(--navy); }
        .chk-btn {
          display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px;
          border: 1.5px solid var(--border); border-radius: 6px; cursor: pointer;
          font-size: 12px; font-weight: 500; transition: all 0.15s; background: var(--surface-2);
          user-select: none;
        }
        .chk-btn:hover { border-color: var(--gold-border); }
        .chk-btn.active {
          border-color: var(--gold-border); background: var(--gold-pale);
          color: var(--navy); font-weight: 600;
        }
        .inline-section-label {
          font-size: 12px; font-weight: 700; color: var(--navy-2); margin-bottom: 12px;
          padding: 7px 12px; background: var(--accent-bg);
          border-left: 3px solid var(--gold); border-radius: 0 6px 6px 0;
          letter-spacing: 0.03em;
        }
        .divider { border: none; border-top: 1px dashed var(--border); margin: 6px 0; }

        /* ── Nepali date picker ───────────────────────────────────── */
        .nepali-date-picker { display: flex; flex-direction: column; gap: 6px; }
        .ndp-selects { display: flex; gap: 10px; }
        .ndp-selects select {
          flex: 1; min-width: 0;
          font-size: 14px; font-family: 'DM Sans', sans-serif;
          padding: 10px 36px 10px 14px;
          border: 1.5px solid var(--border);
          border-radius: 10px;
          background: var(--surface);
          color: var(--text);
          appearance: none;
          -webkit-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%237a90b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          cursor: pointer;
          transition: border-color 0.18s, box-shadow 0.18s;
          box-shadow: 0 1px 3px rgba(15,31,61,0.06);
        }
        .ndp-selects select:hover { border-color: var(--border-dark); }
        .ndp-selects select:focus { outline: none; border-color: var(--gold); box-shadow: 0 0 0 3px rgba(201,146,42,0.12); }
        .ndp-ad-equiv { font-size: 11px; color: var(--text-3); font-style: italic; padding-left: 2px; }

        /* ── Validation ───────────────────────────────────────────── */
        .input-error { border-color: var(--red) !important; background: var(--red-pale) !important; }
        .field-error {
          font-size: 12px; color: var(--red); margin-top: 4px;
          padding: 4px 10px; background: var(--red-pale);
          border-left: 3px solid var(--red); border-radius: 0 5px 5px 0;
        }

        /* ── Warning ─────────────────────────────────────────────── */
        .abhilekh-warning {
          display: flex; gap: 14px; align-items: flex-start;
          background: #fffbeb; border: 2px solid #d97706; border-radius: 10px;
          padding: 16px 18px; margin-top: 16px;
          box-shadow: 0 2px 12px rgba(217,119,6,0.12);
        }
        .abhilekh-icon { font-size: 24px; line-height: 1; flex-shrink: 0; margin-top: 2px; }
        .abhilekh-content { flex: 1; }
        .abhilekh-title { font-size: 12px; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
        .abhilekh-body { font-size: 13px; color: #5a3a08; line-height: 1.55; }
        .abhilekh-body p { margin-bottom: 6px; }
        .abhilekh-action { background: rgba(255,255,255,0.65); border-left: 3px solid #d97706; padding: 6px 10px; margin: 8px 0 !important; border-radius: 0 5px 5px 0; }
        .abhilekh-confirm { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 13px; font-weight: 600; color: #92400e; cursor: pointer; }
        .abhilekh-confirm input { width: auto; cursor: pointer; accent-color: #d97706; }
        .abhilekh-remark { margin-top: 8px; width: 100%; padding: 8px 12px; border: 1.5px solid #d97706; border-radius: 5px; font-size: 13px; font-family: 'DM Sans', sans-serif; background: white; }

        /* ── Cards ───────────────────────────────────────────────── */
        .card-entry {
          background: var(--surface); border: 1.5px solid var(--border);
          border-radius: var(--radius-lg); margin-bottom: 16px; overflow: hidden;
          box-shadow: var(--shadow-sm);
          transition: box-shadow 0.2s;
        }
        .card-entry:hover { box-shadow: var(--shadow); }
        .card-entry-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 11px 16px;
          background: linear-gradient(to right, var(--surface-3), var(--surface-2));
          border-bottom: 1px solid var(--border);
          font-size: 13px; font-weight: 600; color: var(--navy-2);
        }
        .card-entry-header::before {
          content: ''; width: 3px; height: 16px;
          background: linear-gradient(to bottom, var(--gold), var(--gold-border));
          border-radius: 2px; margin-right: 8px;
        }
        .card-entry .sub-grid { padding: 18px; }
        .subsection-label {
          font-size: 12px; font-weight: 700; color: var(--navy); text-transform: uppercase;
          letter-spacing: 0.07em; margin: 22px 0 12px;
          display: flex; justify-content: space-between; align-items: center;
          padding-bottom: 6px; border-bottom: 1px solid var(--border);
        }

        /* ── Buttons ─────────────────────────────────────────────── */
        .btn-add {
          background: var(--gold-pale); border: 1.5px solid var(--gold-border);
          color: var(--gold); padding: 6px 14px; border-radius: var(--radius);
          font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif;
          transition: all 0.15s;
        }
        .btn-add:hover { background: var(--gold); color: white; border-color: var(--gold); }
        .btn-add-main {
          margin-top: 10px; background: var(--green-pale); border: 1.5px solid var(--green);
          color: var(--green); padding: 9px 18px; border-radius: var(--radius);
          font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif;
          transition: all 0.15s;
        }
        .btn-add-main:hover { background: var(--green); color: white; }
        .btn-remove {
          background: transparent; border: 1px solid #fca5a5; color: var(--red);
          padding: 4px 10px; border-radius: 5px; font-size: 11px; cursor: pointer;
          font-family: 'DM Sans', sans-serif; transition: all 0.15s;
        }
        .btn-remove:hover { background: var(--red); color: white; border-color: var(--red); }

        /* ── Tables ──────────────────────────────────────────────── */
        .table-wrapper {
          overflow-x: auto; margin-bottom: 22px;
          border-radius: var(--radius-lg); border: 1.5px solid var(--border);
          box-shadow: var(--shadow-sm);
        }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        thead {
          background: linear-gradient(135deg, var(--navy) 0%, var(--navy-2) 100%);
        }
        thead th {
          color: rgba(255,255,255,0.90); font-weight: 600; padding: 11px 14px;
          text-align: left; font-size: 11px; text-transform: uppercase;
          letter-spacing: 0.07em; white-space: nowrap;
        }
        tbody tr { border-bottom: 1px solid var(--border); transition: background 0.1s; }
        tbody tr:last-child { border-bottom: none; }
        tbody tr:nth-child(even) { background: var(--surface-2); }
        tbody tr:hover { background: var(--gold-pale); }
        tbody td { padding: 9px 12px; vertical-align: middle; }
        tbody td input, tbody td select { border-color: var(--border); font-size: 13px; padding: 6px 8px; }
        .row-selected { background: var(--gold-pale) !important; }
        .calc-cell { font-family: 'DM Sans', monospace; color: var(--text-2); }
        .highlight { color: var(--navy); font-weight: 700; }
        .empty-row { text-align: center; color: var(--text-3); font-style: italic; padding: 24px !important; }
        .total-row {
          background: var(--gold-pale) !important;
          border-top: 2px solid var(--gold-border) !important;
          font-weight: 700;
        }

        /* ── Hint ────────────────────────────────────────────────── */
        .hint {
          font-size: 13px; color: var(--text-3); margin-bottom: 12px;
          font-style: italic; line-height: 1.5;
        }

        /* ── Summary / Valuation ─────────────────────────────────── */
        .summary-box {
          background: var(--surface); border: 1.5px solid var(--border);
          border-radius: var(--radius-lg); padding: 28px; margin-top: 6px;
          box-shadow: var(--shadow);
        }
        .summary-box p { margin-bottom: 12px; font-size: 14px; color: var(--text-2); line-height: 1.65; }
        .valuation-total {
          display: flex; justify-content: space-between; align-items: center;
          background: linear-gradient(135deg, var(--navy) 0%, var(--navy-2) 60%, var(--navy-3) 100%);
          color: white; padding: 16px 22px; border-radius: 10px;
          font-family: 'DM Serif Display', serif; font-size: 18px;
          font-weight: 400; margin: 18px 0 12px;
          box-shadow: 0 4px 20px rgba(15,31,61,0.25);
        }
        .in-words {
          background: var(--gold-pale); border: 1px solid var(--gold-border);
          border-radius: 8px; padding: 12px 18px;
          font-size: 14px; color: var(--navy); margin-bottom: 16px; line-height: 1.55;
          border-left: 3px solid var(--gold);
        }
        .disclaimer { font-size: 12px; color: var(--text-3); font-style: italic; margin-top: 16px !important; line-height: 1.6; }

        /* ── Section nav bottom ──────────────────────────────────── */
        .section-nav {
          display: flex; justify-content: space-between; align-items: center;
          flex-wrap: wrap; gap: 10px;
          margin-top: 32px; padding: 18px 20px;
          background: var(--surface); border-radius: var(--radius-lg);
          border: 1px solid var(--border);
          box-shadow: var(--shadow-sm);
        }
        .btn-nav {
          background: var(--surface); border: 1.5px solid var(--border-dark);
          color: var(--text); padding: 9px 20px; border-radius: var(--radius);
          font-size: 13px; font-weight: 600; cursor: pointer;
          font-family: 'DM Sans', sans-serif; transition: all 0.18s;
        }
        .btn-nav:hover { border-color: var(--gold-border); color: var(--gold); transform: translateY(-1px); }
        .btn-nav.primary {
          background: linear-gradient(135deg, var(--navy) 0%, var(--navy-2) 100%);
          border-color: var(--navy); color: white;
          box-shadow: 0 4px 14px rgba(15,31,61,0.25);
        }
        .btn-nav.primary:hover { filter: brightness(1.1); transform: translateY(-1px); }
        .btn-nav.html-dl {
          background: var(--surface); border-color: var(--green);
          color: var(--green); font-weight: 700;
        }
        .btn-nav.html-dl:hover { background: var(--green); color: white; }
        .step-indicator {
          display: flex; flex-direction: column; align-items: center; gap: 5px;
          font-size: 11px; color: var(--text-3);
        }
        .step-progress-bar {
          width: 120px; height: 4px; background: var(--border);
          border-radius: 4px; overflow: hidden;
        }
        .step-progress-fill {
          height: 100%;
          background: linear-gradient(to right, var(--gold), var(--gold-light));
          border-radius: 4px; transition: width 0.35s cubic-bezier(0.4,0,0.2,1);
        }

        /* ── Scrollbar ───────────────────────────────────────────── */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border-dark); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--text-3); }

        /* ── Selection ───────────────────────────────────────────── */
        ::selection { background: rgba(201,146,42,0.2); color: var(--navy); }

        /* ── Print ───────────────────────────────────────────────── */
        @media print {
          /* Hide ALL app UI — only the modal content should print */
          .app-header, .nav-tabs, .section-nav, .print-actions,
          .main-body, .btn-add, .btn-add-main, .btn-remove, .content,
          .modal-overlay, .dev-credit { display: none !important; }
          /* Ensure body has no background colour */
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

      `}</style>

      <div className="app-header">
        <div className="header-top">
          {/* Left: empty spacer to balance the grid */}
          <div />

          {/* Center: title + subtitle */}
          <div className="header-center">
            <h1>Property Valuation Report</h1>
            <p>Bank Loan Security Assessment — Nepal</p>
            <p className="dev-credit"><DevCredit style={{ color: "rgba(255,255,255,0.45)" }} /></p>
          </div>

          {/* Right: autosave badge + action buttons */}
          <div className="header-actions">
            {/* Autosave status badge */}
            {autoSaveStatus === "pending" && (
              <span style={{fontSize:"11px",color:"rgba(255,255,255,0.45)",display:"flex",alignItems:"center",gap:"4px"}}>
                <span style={{width:"6px",height:"6px",borderRadius:"50%",background:"rgba(255,255,255,0.35)",display:"inline-block"}}/>
                Unsaved changes
              </span>
            )}
            {autoSaveStatus === "saving" && (
              <span style={{fontSize:"11px",color:"rgba(255,255,255,0.55)",display:"flex",alignItems:"center",gap:"4px"}}>
                <span style={{width:"6px",height:"6px",borderRadius:"50%",background:"#f9c74f",display:"inline-block",animation:"pulse 1s infinite"}}/>
                Autosaving to DB…
              </span>
            )}
            {autoSaveStatus === "saved" && (
              <span style={{fontSize:"11px",color:"rgba(100,220,130,0.9)",display:"flex",alignItems:"center",gap:"4px"}}>
                <span style={{width:"6px",height:"6px",borderRadius:"50%",background:"rgba(100,220,130,0.9)",display:"inline-block"}}/>
                Autosaved to DB
              </span>
            )}
            {autoSaveStatus === "error" && (
              <span style={{fontSize:"11px",color:"rgba(255,120,120,0.9)",display:"flex",alignItems:"center",gap:"4px"}}>
                <span style={{width:"6px",height:"6px",borderRadius:"50%",background:"rgba(255,120,120,0.9)",display:"inline-block"}}/>
                DB offline (saved locally)
              </span>
            )}
            {user && (
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12 }}>
                  {user.username?.charAt(0).toUpperCase()}
                </span>
                {user.username}
              </span>
            )}
            {onLogout && (
              <button
                onClick={onLogout}
                className="hdr-btn"
                style={{ background: "rgba(231,76,60,0.85)", color: "#fff", border: "none" }}
              >
                Logout
              </button>
            )}
          </div>
        </div>
        <div className="header-meta">
          <span className={`report-badge ${reportType}`}>{reportType.toUpperCase()} REPORT</span>
          <span className="header-filename">📄 {getFileName("pdf")}</span>
        </div>
      </div>

      {/* Autosave restore banner */}
      {showRestoreBanner && (
        <div style={{
          background:"#1a3a1a", color:"#a8e6b0", padding:"10px 20px",
          display:"flex", alignItems:"center", gap:"12px", flexWrap:"wrap",
          fontSize:"13px", borderBottom:"1px solid #2d6a2d", zIndex:50, position:"relative"
        }}>
          <span style={{fontSize:"16px"}}>💾</span>
          <span style={{flex:1}}>
            <strong>Unsaved draft found</strong> — you may have left work in progress.
            Autosaved: <em>{(()=>{ try { const d=JSON.parse(sessionStorage.getItem(AUTOSAVE_KEY)||"{}"); return d._savedAt ? new Date(d._savedAt).toLocaleString() : "unknown time"; } catch(e){ return "unknown"; } })()}</em>
          </span>
          <button
            onClick={restoreAutosave}
            style={{padding:"6px 16px",background:"#2e7d32",color:"#fff",border:"none",
              borderRadius:"6px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>
            ↩ Restore Draft
          </button>
          <button
            onClick={clearAutosave}
            style={{padding:"6px 12px",background:"rgba(255,255,255,0.1)",color:"#a8e6b0",
              border:"1px solid rgba(255,255,255,0.2)",borderRadius:"6px",fontSize:"12px",cursor:"pointer"}}>
            ✕ Discard
          </button>
        </div>
      )}


      {toast && <div className="toast">{toast}</div>}

      <div className="main-body">
        {/* Left sidebar tabs */}
        <div id="nav-tabs-scroll" className="nav-tabs">
          {/* Sidebar progress header */}
          <div className="nav-sidebar-head">
            <div className="nav-sidebar-head-label">Form Progress</div>
            <div className="nav-progress-bar">
              <div className="nav-progress-fill" style={{width:`${Math.round((activeSection/(sections.length-1))*100)}%`}} />
            </div>
            <div className="nav-progress-text">
              <span>Section {activeSection} of {sections.length-1}</span>
              <span>{Math.round((activeSection/(sections.length-1))*100)}%</span>
            </div>
          </div>

          {sections.map((s, i) => i === 0 ? null : (
            <button key={i} className={`nav-tab ${activeSection===i?"active":""}`}
              onClick={()=>{
                setActiveSection(i);
                setTimeout(()=>{
                  const el=document.getElementById("nav-tabs-scroll");
                  const btn=el?.querySelectorAll(".nav-tab")[i-1];
                  if(btn) btn.scrollIntoView({behavior:"smooth",block:"nearest"});
                },50);
              }}>
              <span className="nav-tab-num">{i}</span>
              <span className="nav-tab-label">{s.title}</span>
            </button>
          ))}
        </div>

      <div className="content">
        <div className="section-card">
          {sections[activeSection].render()}
        </div>

        <div className="section-nav">
          <button className="btn-nav" onClick={()=>setActiveSection(s=>Math.max(1,s-1))} disabled={activeSection<=1}>
            ← Previous
          </button>
          <span className="step-indicator">
            <div className="step-progress-bar">
              <div className="step-progress-fill" style={{width:`${Math.round((activeSection/(sections.length-1))*100)}%`}} />
            </div>
            {activeSection} / {sections.length-1}
          </span>
          <button className="btn-nav primary" onClick={()=>setActiveSection(s=>Math.min(sections.length-1,s+1))} disabled={activeSection===sections.length-1}>
            Next →
          </button>
          <button
            className="btn-nav"
            style={{background:"#2e7d32",color:"#fff",opacity:dbSaving?0.7:1}}
            onClick={handleSaveToDb}
            disabled={dbSaving}
            title="Save report to local database"
          >
            {dbSaving ? "Saving…" : (reportId ? "💾 Update DB" : "💾 Save to DB")}
          </button>
          {onBack && (
            <button className="btn-nav" style={{background:"#f1f1f1",color:"#333"}} onClick={onBack}>
              ← Dashboard
            </button>
          )}
        </div>
        {dbMsg && (
          <div style={{textAlign:"center",padding:"6px 12px",fontSize:13,color:dbMsg.startsWith("⚠")?"#c0392b":"#2e7d32",background:dbMsg.startsWith("⚠")?"#fdf0f0":"#f0fdf4",borderTop:"1px solid #e5e7eb"}}>
            {dbMsg}
          </div>
        )}
      </div>{/* end .content */}
      </div>{/* end .main-body */}

      {/* Legal Document Viewer Modal */}
      {viewerDoc && (() => {
        const isImage = viewerDoc.dataUrl?.startsWith("data:image");
        const isPdf   = viewerDoc.dataUrl?.startsWith("data:application/pdf");

        const saveRotationAndClose = () => {
          if (viewerDoc.id) {
            if (viewerDoc.source === 'sitePlan') {
              if (isPdf) {
                setSitePlans(prev => prev.map(sp => sp.id === viewerDoc.id ? { ...sp, pdfPageRotations: [...pdfPageRotations] } : sp));
              } else {
                setSitePlans(prev => prev.map(sp => sp.id === viewerDoc.id ? { ...sp, rotation: viewerRotation } : sp));
              }
            } else if (isPdf) {
              setLegalDocs(ds => ds.map(d => d.id === viewerDoc.id ? { ...d, pdfPageRotations: [...pdfPageRotations] } : d));
            } else {
              setLegalDocs(ds => ds.map(d => d.id === viewerDoc.id ? { ...d, rotation: viewerRotation } : d));
            }
          }
          setViewerDoc(null);
        };

        const handlePrint = () => {
          const w = window.open("", "_blank");
          if (!w) return;
          w.document.write(`<!DOCTYPE html><html><head><title>${viewerDoc.name}</title>
<style>
  body{margin:0;background:#fff;}
  .pg{page-break-after:always;display:flex;align-items:center;justify-content:center;min-height:100vh;}
  .pg:last-child{page-break-after:avoid;}
  img{max-width:100%;max-height:100vh;object-fit:contain;}
  @media print{body{background:#fff;}}
</style></head><body>`);
          if (isImage) {
            w.document.write(`<div class="pg"><img src="${viewerDoc.dataUrl}" style="transform:rotate(${viewerRotation}deg)"/></div>`);
          } else if (pdfPages && pdfPages.length > 0) {
            pdfPages.forEach((pg, idx) => {
              const rot = pdfPageRotations[idx] || 0;
              w.document.write(`<div class="pg"><img src="${pg.dataUrl}" style="transform:rotate(${rot}deg)"/></div>`);
            });
          }
          w.document.write(`</body></html>`);
          w.document.close();
          w.onload = () => { w.focus(); w.print(); };
        };

        const handleSave = () => {
          if (isImage) {
            // For rotated images, draw onto canvas then download
            const img = new Image();
            img.onload = () => {
              const rad = (viewerRotation * Math.PI) / 180;
              const absCos = Math.abs(Math.cos(rad));
              const absSin = Math.abs(Math.sin(rad));
              const cw = Math.round(img.width * absCos + img.height * absSin);
              const ch = Math.round(img.width * absSin + img.height * absCos);
              const canvas = document.createElement("canvas");
              canvas.width = cw; canvas.height = ch;
              const ctx = canvas.getContext("2d");
              ctx.translate(cw / 2, ch / 2);
              ctx.rotate(rad);
              ctx.drawImage(img, -img.width / 2, -img.height / 2);
              const a = document.createElement("a");
              a.href = canvas.toDataURL("image/jpeg", 0.92);
              a.download = (viewerDoc.name || "document") + ".jpg";
              a.click();
            };
            img.src = viewerDoc.dataUrl;
          } else if (pdfPages && pdfPages.length > 0) {
            // Save PDF as rotated page images (zip not available — save page 1 or all individually)
            pdfPages.forEach((pg, idx) => {
              const rot = pdfPageRotations[idx] || 0;
              const img = new Image();
              img.onload = () => {
                const rad = (rot * Math.PI) / 180;
                const absCos = Math.abs(Math.cos(rad));
                const absSin = Math.abs(Math.sin(rad));
                const cw = Math.round(img.width * absCos + img.height * absSin);
                const ch = Math.round(img.width * absSin + img.height * absCos);
                const canvas = document.createElement("canvas");
                canvas.width = cw; canvas.height = ch;
                const ctx = canvas.getContext("2d");
                ctx.translate(cw / 2, ch / 2);
                ctx.rotate(rad);
                ctx.drawImage(img, -img.width / 2, -img.height / 2);
                const a = document.createElement("a");
                a.href = canvas.toDataURL("image/jpeg", 0.92);
                a.download = `${viewerDoc.name || "document"}_page${pg.pageNum}.jpg`;
                a.click();
              };
              img.src = pg.dataUrl;
            });
          } else {
            const a = document.createElement("a");
            a.href = viewerDoc.dataUrl;
            a.download = (viewerDoc.name || "document") + ".pdf";
            a.click();
          }
        };

        return (
          <div style={{
            position:"fixed",inset:0,zIndex:9999,
            background:"rgba(0,0,0,0.88)",
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
          }} onClick={e=>{if(e.target===e.currentTarget)saveRotationAndClose();}}>

            {/* Toolbar */}
            <div style={{
              display:"flex",alignItems:"center",gap:"10px",
              padding:"10px 18px",
              background:"rgba(255,255,255,0.08)",
              borderRadius:"12px",marginBottom:"14px",
              backdropFilter:"blur(4px)",
              flexWrap:"wrap",justifyContent:"center",
            }}>
              <span style={{color:"#fff",fontWeight:600,fontSize:"14px",maxWidth:"240px",
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {viewerDoc.name}
              </span>
              <div style={{width:"1px",height:"24px",background:"rgba(255,255,255,0.2)"}}/>
              {isImage && (<>
                <button onClick={()=>setViewerRotation(r=>(r-90+360)%360)} title="Rotate left" style={btnStyle}>
                  ↺ Rotate Left
                </button>
                <button onClick={()=>setViewerRotation(r=>(r+90)%360)} title="Rotate right" style={btnStyle}>
                  ↻ Rotate Right
                </button>
                {viewerRotation !== 0 && (
                  <span style={{color:"#ffd700",fontSize:"12px",fontWeight:600}}>
                    {viewerRotation}° rotated
                  </span>
                )}
                <div style={{width:"1px",height:"24px",background:"rgba(255,255,255,0.2)"}}/>
              </>)}
              {isPdf && pdfPages && pdfPages.length > 0 && (
                <span style={{color:"#aaa",fontSize:"12px"}}>
                  {pdfPages.length} page{pdfPages.length!==1?"s":""}
                  {pdfPageRotations.some(r=>r) ? " · rotated" : ""}
                </span>
              )}
              <button onClick={handlePrint} title="Print" style={btnStyle}>
                🖨 Print
              </button>
              <button onClick={handleSave} title="Save / Download" style={btnStyle}>
                ⬇ Save
              </button>
              <button onClick={saveRotationAndClose} title="Close" style={{...btnStyle,background:"rgba(192,57,43,0.7)"}}>
                ✕ Close
              </button>
            </div>

            {/* Document display */}
            <div style={{
              maxWidth:"92vw",maxHeight:"78vh",
              display:"flex",alignItems:"center",justifyContent:"center",
              overflow:"visible",
            }}>
              {isImage && (()=>{
                const isRotated90 = viewerRotation === 90 || viewerRotation === 270;
                return (
                  <img
                    src={viewerDoc.dataUrl}
                    alt={viewerDoc.name}
                    style={{
                      maxWidth:  isRotated90 ? "74vh" : "90vw",
                      maxHeight: isRotated90 ? "90vw" : "74vh",
                      width:"auto",height:"auto",
                      objectFit:"contain",
                      transform:`rotate(${viewerRotation}deg)`,
                      transformOrigin:"center center",
                      transition:"transform 0.3s ease",
                      borderRadius:"4px",
                      boxShadow:"0 4px 32px rgba(0,0,0,0.6)",
                    }}
                  />
                );
              })()}
              {isPdf && (
                <div style={{
                  width:"88vw",maxHeight:"74vh",overflowY:"auto",
                  display:"flex",flexDirection:"column",gap:"16px",
                  padding:"8px",
                }}>
                  {pdfLoading && (
                    <div style={{color:"#fff",textAlign:"center",padding:"40px",fontSize:"15px"}}>
                      Loading PDF pages…
                    </div>
                  )}
                  {pdfPages && pdfPages.map((pg, idx) => {
                    const rot = pdfPageRotations[idx] || 0;
                    const is90 = rot === 90 || rot === 270;
                    return (
                      <div key={pg.pageNum} style={{background:"rgba(255,255,255,0.06)",borderRadius:"8px",padding:"10px"}}>
                        {/* Per-page controls */}
                        <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px",flexWrap:"wrap"}}>
                          <span style={{color:"#ccc",fontSize:"12px",fontWeight:600}}>Page {pg.pageNum}</span>
                          <button onClick={()=>setPdfPageRotations(rs=>{const a=[...rs];a[idx]=((a[idx]||0)-90+360)%360;return a;})}
                            style={{...btnStyle,padding:"4px 10px",fontSize:"11px"}}>↺ Left</button>
                          <button onClick={()=>setPdfPageRotations(rs=>{const a=[...rs];a[idx]=((a[idx]||0)+90)%360;return a;})}
                            style={{...btnStyle,padding:"4px 10px",fontSize:"11px"}}>↻ Right</button>
                          {rot !== 0 && <span style={{color:"#ffd700",fontSize:"11px",fontWeight:600}}>{rot}°</span>}
                        </div>
                        {/* Page image with CSS rotation */}
                        <div style={{
                          display:"flex",alignItems:"center",justifyContent:"center",
                          overflow:"hidden",
                          minHeight: is90 ? "200px" : "auto",
                        }}>
                          <img src={pg.dataUrl} alt={`Page ${pg.pageNum}`} style={{
                            maxWidth: is90 ? "60vh" : "100%",
                            maxHeight: is90 ? "80vw" : "60vh",
                            objectFit:"contain",
                            transform:`rotate(${rot}deg)`,
                            transition:"transform 0.3s",
                            borderRadius:"4px",
                            boxShadow:"0 2px 12px rgba(0,0,0,0.5)",
                          }}/>
                        </div>
                      </div>
                    );
                  })}
                  {pdfPages && pdfPages.length === 0 && (
                    <div style={{color:"#f88",textAlign:"center",padding:"40px"}}>
                      Could not render PDF pages. Use Save to download.
                    </div>
                  )}
                </div>
              )}
              {!isImage && !isPdf && (
                <div style={{color:"#fff",fontSize:"16px",textAlign:"center",padding:"40px"}}>
                  Cannot preview this file type.<br/>Use the Save button to download it.
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const btnStyle = {
  padding:"7px 14px",borderRadius:"8px",border:"none",cursor:"pointer",
  background:"rgba(255,255,255,0.15)",color:"#fff",
  fontSize:"13px",fontWeight:600,
  transition:"background 0.15s",
};