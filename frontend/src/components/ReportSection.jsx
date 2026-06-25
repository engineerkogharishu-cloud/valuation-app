import React from "react";
import ShadowPreview from "./ShadowPreview";
import { buildPrintHTML } from "../report/buildPrintHTML";
import { captureAllMapSnapshots } from "../utils/mapUtils";
import { expandPdfLegalDocs, expandPdfSitePlans } from "../utils/pdfUtils";
import { api } from "../services/api";
import { usePrintCredit } from "./ui/CreditBadge";
import { toWords } from "../utils/numberWords";

// ── Valuation fee tiers (NRB/financial institution schedule) ──────────────────
const FEE_TIERS = [
  { upto: 2_500_000,       base: 0,          rate: 0,      label: "Up to 25 Lakh" },
  { upto: 5_000_000,       base: 7_500,       rate: 0.0020, label: "25L – 50L" },
  { upto: 10_000_000,      base: 12_500,      rate: 0.0015, label: "50L – 1Cr" },
  { upto: 50_000_000,      base: 20_000,      rate: 0.0010, label: "1Cr – 5Cr" },
  { upto: 100_000_000,     base: 60_000,      rate: 0.0008, label: "5Cr – 10Cr" },
  { upto: 200_000_000,     base: 100_000,     rate: 0.0005, label: "10Cr – 20Cr" },
  { upto: 500_000_000,     base: 150_000,     rate: 0.0003, label: "20Cr – 50Cr" },
  { upto: 1_000_000_000,   base: 240_000,     rate: 0.0002, label: "50Cr – 100Cr" },
  { upto: Infinity,        base: 340_000,     rate: 0.0001, label: "Above 100Cr" },
];
const TIER_FLOORS = [0, 2_500_000, 5_000_000, 10_000_000, 50_000_000, 100_000_000, 200_000_000, 500_000_000, 1_000_000_000];

export function calcValuationFee(fmv) {
  if (!fmv || fmv <= 0) return 0;
  // flat minimum
  if (fmv <= 2_500_000) return 7_500;
  for (let i = 1; i < FEE_TIERS.length; i++) {
    if (fmv <= FEE_TIERS[i].upto) {
      return Math.round(FEE_TIERS[i].base + (fmv - TIER_FLOORS[i]) * FEE_TIERS[i].rate);
    }
  }
  // above 100Cr
  return Math.round(340_000 + (fmv - 1_000_000_000) * 0.0001);
}

// ── Field Charge Dialog ───────────────────────────────────────────────────────
function FieldChargeDialog({ onConfirm, onCancel }) {
  const [received, setReceived] = React.useState(null);
  const [amount, setAmount]     = React.useState("");
  const [transport, setTransport] = React.useState("");

  const canProceed = received !== null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,31,61,0.65)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9500 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "30px 32px", width: "96%", maxWidth: 480, boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700, color: "#0f1f3d" }}>📋 Field Charge</h3>
        <p style={{ margin: "0 0 22px", fontSize: 13, color: "#7f8c8d" }}>Before generating the Preliminary Report, confirm field charge details.</p>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f1f3d", marginBottom: 10 }}>Did you receive field charge from the client?</div>
          <div style={{ display: "flex", gap: 10 }}>
            {[{ val: true, label: "✅ Yes, Received" }, { val: false, label: "❌ No, Not Received" }].map(({ val, label }) => (
              <button key={String(val)} onClick={() => setReceived(val)}
                style={{ flex: 1, padding: "11px 0", borderRadius: 9, border: `2px solid ${received === val ? (val ? "#27ae60" : "#e74c3c") : "#dde1e7"}`, background: received === val ? (val ? "#e8f5e9" : "#fff5f5") : "#fafbfd", color: received === val ? (val ? "#1a5c3a" : "#c0392b") : "#555", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {received && (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#7f8c8d", textTransform: "uppercase", marginBottom: 5 }}>Field Charge Amount (NPR)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min="0" placeholder="e.g. 2000"
                style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #dde1e7", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#7f8c8d", textTransform: "uppercase", marginBottom: 5 }}>Transportation Charge (NPR) <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span></label>
              <input type="number" value={transport} onChange={e => setTransport(e.target.value)} min="0" placeholder="e.g. 500"
                style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #dde1e7", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "9px 20px", border: "1.5px solid #dde1e7", borderRadius: 8, background: "#fff", color: "#555", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={() => canProceed && onConfirm(received, amount, transport)} disabled={!canProceed}
            style={{ padding: "9px 22px", background: canProceed ? "linear-gradient(135deg,#0f1f3d,#1a3a6b)" : "#ccc", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: canProceed ? "pointer" : "not-allowed" }}>
            Generate Report →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Final Payment Dialog ──────────────────────────────────────────────────────
function FinalPaymentDialog({ onConfirm, onCancel }) {
  const [amountReceived, setAmountReceived] = React.useState("");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,31,61,0.65)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9500 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "30px 32px", width: "96%", maxWidth: 460, boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700, color: "#1a5c3a" }}>💰 Payment Received</h3>
        <p style={{ margin: "0 0 22px", fontSize: 13, color: "#7f8c8d" }}>Before generating the Final Report, enter how much has been received from the client.</p>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#7f8c8d", textTransform: "uppercase", marginBottom: 5 }}>Amount Received (NPR)</label>
          <input
            type="number" value={amountReceived} onChange={e => setAmountReceived(e.target.value)}
            min="0" placeholder="e.g. 15000" autoFocus
            style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #dde1e7", borderRadius: 8, fontSize: 15, boxSizing: "border-box" }}
          />
          <div style={{ fontSize: 11, color: "#aaa", marginTop: 5 }}>Leave blank if not applicable.</div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "9px 20px", border: "1.5px solid #dde1e7", borderRadius: 8, background: "#fff", color: "#555", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={() => onConfirm(amountReceived)}
            style={{ padding: "9px 22px", background: "linear-gradient(135deg,#1a5c3a,#27ae60)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Generate Final Report →
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReportSection({
  collectState, getFileName, showToast, reportType, setReportType, reportId,
  fieldChargeReceived, setFieldChargeReceived, fieldChargeAmount, setFieldChargeAmount,
  transportationCharge, setTransportationCharge,
  billNo, setBillNo, includeVat, setIncludeVat, billRemarks, setBillRemarks,
  extraChargeLabel, setExtraChargeLabel, extraChargeAmount, setExtraChargeAmount,
  discountAmount, setDiscountAmount,
  billQrCode, setBillQrCode,
  amountReceived, setAmountReceived,
  finalFMV,
}) {
  const [html, setHtml] = React.useState(null);
  const [fullHtml, setFullHtml] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [showFieldDialog, setShowFieldDialog] = React.useState(false);
  const [paymentMethods, setPaymentMethods] = React.useState([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = React.useState("");
  const { requestPrint, ConfirmDialog, creditData } = usePrintCredit(reportId);

  const valuationFee = calcValuationFee(finalFMV || 0);

  React.useEffect(() => {
    api.getCompanyPaymentMethods().then(d => {
      const methods = d.payment_methods || [];
      setPaymentMethods(methods);
      if (methods.length && !selectedPaymentMethodId) setSelectedPaymentMethodId(methods[0].id);
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLetterhead = React.useCallback(async (state) => {
    try {
      const lhData = await api.getCompanyLetterhead();
      state.companyName            = lhData.company_name            || "";
      state.letterheadPng          = lhData.letterhead_png          || "";
      state.letterheadTextBox      = lhData.letterhead_text_box     || null;
      state.letterheadWatermarkBox = lhData.letterhead_watermark_box || null;
      state.reportColorTheme       = lhData.report_color_theme      || "blue";
      state.companyAddress         = lhData.address                 || "";
      state.companyEmail           = lhData.contact_email           || "";
      state.companyPhone           = lhData.contact_phone           || "";
      state.companyPanVat          = lhData.pan_vat                 || "";
      state.companyBankAccount     = lhData.bank_account            || "";
      state.billPrefix             = lhData.bill_prefix             || "BILL";
      state.paymentMethods         = lhData.payment_methods         || [];
    } catch (_) {}
  }, []);

  const doPreviewBill = React.useCallback(async () => {
    setLoading(true);
    showToast("⏳ Generating bill preview…");
    try {
      const selectedPM = paymentMethods.find(m => m.id === selectedPaymentMethodId) || null;
      const state = { ...collectState(), finalFMV: finalFMV || 0, billQrCode: billQrCode || "", selectedPaymentMethod: selectedPM };
      await fetchLetterhead(state);
      const full = buildPrintHTML(state, getFileName("pdf"), false, {});
      setFullHtml(full);
      setHtml(full.replace(/<div class="no-print">[\s\S]*?<\/div>/, ""));
    } finally {
      setLoading(false);
    }
  }, [collectState, fetchLetterhead, getFileName, showToast, finalFMV, billQrCode, paymentMethods, selectedPaymentMethodId]);

  const doPrintBill = React.useCallback(() => {
    if (!fullHtml) return;
    const w = window.open("", "_blank");
    if (!w) { showToast("⚠ Pop-up blocked — allow pop-ups and try again"); return; }
    w.document.open();
    w.document.write(fullHtml);
    w.document.close();
  }, [fullHtml, showToast]);

  const doGenerate = React.useCallback(async () => {
    setLoading(true);
    showToast("⏳ Generating report preview…");
    try {
      const state = { ...collectState(), reportId: reportId || null };
      await fetchLetterhead(state);

      state.sitePlans = await expandPdfSitePlans(state.sitePlans || []);
      if ((state.reportType || "preliminary") === "final") {
        state.legalDocs = await expandPdfLegalDocs(state.legalDocs || []);
      }
      const mapSnapshots = await captureAllMapSnapshots(state.properties || []);
      const full = buildPrintHTML(state, getFileName("pdf"), false, mapSnapshots);
      setFullHtml(full);
      setHtml(full.replace(/<div class="no-print">[\s\S]*?<\/div>/, ""));
    } finally {
      setLoading(false);
    }
  }, [collectState, fetchLetterhead, getFileName, showToast]);

  const generate = React.useCallback(() => {
    if (reportType === "bill") {
      doPreviewBill();
    } else if (reportType === "preliminary" && fieldChargeReceived === null) {
      setShowFieldDialog(true);
    } else if (reportType === "final") {
      doGenerate();
    } else {
      doGenerate();
    }
  }, [reportType, fieldChargeReceived, doPreviewBill, doGenerate]);

  // Auto-regenerate when report type changes (if preview already exists)
  const prevTypeRef = React.useRef(reportType);
  React.useEffect(() => {
    if (prevTypeRef.current !== reportType) {
      prevTypeRef.current = reportType;
      if (reportType === "bill") {
        doPreviewBill();
      } else if (html !== null) {
        doGenerate();
      }
    }
  }, [reportType, html, doGenerate, doPreviewBill]);

  const doPrint = React.useCallback(() => {
    if (!fullHtml) return;
    const w = window.open("", "_blank");
    if (!w) { showToast("⚠ Pop-up blocked — allow pop-ups and try again"); return; }
    w.document.open();
    w.document.write(fullHtml);
    w.document.close();
  }, [fullHtml, showToast]);

  const handlePrint = React.useCallback(() => {
    if (!fullHtml) return;
    requestPrint(reportType, doPrint);
  }, [fullHtml, reportType, requestPrint, doPrint]);

  const COST = { preliminary: 1, final: 2 };
  const balance = creditData?.balance ?? null;
  const cost = COST[reportType] || 1;
  const low = balance !== null && balance <= (creditData?.low_threshold ?? 5);
  const critical = balance !== null && balance <= 2;

  const npr = (n) => `NPR ${Number(n||0).toLocaleString("en-NP")}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {ConfirmDialog}

      {/* ── Field Charge Dialog ── */}
      {showFieldDialog && (
        <FieldChargeDialog
          onConfirm={(received, amount, transport) => {
            setFieldChargeReceived(received);
            setFieldChargeAmount(amount);
            setTransportationCharge(transport);
            setShowFieldDialog(false);
            doGenerate();
          }}
          onCancel={() => setShowFieldDialog(false)}
        />
      )}


      {/* Credit balance bar — not shown for bill (free) */}
      {balance !== null && reportType !== "bill" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, padding: "10px 16px", borderRadius: 10, background: critical ? "#fff5f5" : low ? "#fffbea" : "#f0fdf4", border: `1.5px solid ${critical ? "#e74c3c" : low ? "#f39c12" : "#27ae60"}` }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: critical ? "#c0392b" : low ? "#7a5c00" : "#1a5c3a" }}>
            🪙 Credit Balance: <strong>{balance}</strong>
            {low && (
              <span style={{ marginLeft: 8, fontSize: 11 }}>
                {critical
                  ? <>⚠ Critical — contact <strong>One Degree Consultant Pvt. Ltd.</strong> <a href="mailto:onedegreeconsultant@gmail.com" style={{ color: "inherit" }}>onedegreeconsultant@gmail.com</a> | <a href="tel:9841357433" style={{ color: "inherit" }}>9841357433</a></>
                  : <>⚠ Low balance — contact <strong>One Degree Consultant Pvt. Ltd.</strong> <a href="mailto:onedegreeconsultant@gmail.com" style={{ color: "inherit" }}>onedegreeconsultant@gmail.com</a> | <a href="tel:9841357433" style={{ color: "inherit" }}>9841357433</a></>}
              </span>
            )}
          </span>
          <span style={{ fontSize: 12, color: "#5f6b7a" }}>This {reportType} report costs <strong>{cost} credit{cost > 1 ? "s" : ""}</strong></span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--navy)", margin: 0 }}>
            {reportType === "bill" ? "🧾 Valuation Bill" : "📄 Report Preview"}
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
            {reportType === "bill"
              ? "Configure bill details below, generate a preview, then print or download as PDF."
              : "Select report type, then generate a live preview."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={generate} disabled={loading}
            style={{ padding: "10px 20px", background: "var(--navy)", color: "#fff", border: "none", borderRadius: "var(--radius)", fontWeight: 700, fontSize: 13, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "⏳ Generating…" : "🔄 Generate Preview"}
          </button>
          {fullHtml && reportType === "bill" && (
            <button onClick={doPrintBill}
              style={{ padding: "10px 20px", background: "#c9922a", color: "#fff", border: "none", borderRadius: "var(--radius)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              🖨 Print / Download Bill
            </button>
          )}
          {fullHtml && reportType !== "bill" && (
            <button onClick={handlePrint}
              style={{ padding: "10px 20px", background: "#1a5c3a", color: "#fff", border: "none", borderRadius: "var(--radius)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              🖨️ Print / Save as PDF
            </button>
          )}
        </div>
      </div>

      {/* Report type selector */}
      <div className="report-type-bar">
        <span className="report-type-label">Report Type:</span>
        <label className={`radio-btn-sm ${reportType === "preliminary" ? "active" : ""}`} style={{ cursor: "pointer" }}>
          <input type="radio" checked={reportType === "preliminary"} onChange={() => setReportType("preliminary")} style={{ width: "auto" }} />
          Preliminary
        </label>
        <label className={`radio-btn-sm ${reportType === "bill" ? "active" : ""}`} style={{ cursor: "pointer" }}>
          <input type="radio" checked={reportType === "bill"} onChange={() => setReportType("bill")} style={{ width: "auto" }} />
          Bill
        </label>
        <label className={`radio-btn-sm ${reportType === "final" ? "active" : ""}`} style={{ cursor: "pointer" }}>
          <input type="radio" checked={reportType === "final"} onChange={() => setReportType("final")} style={{ width: "auto" }} />
          Final
        </label>
        <span className="filename-preview">📄 {getFileName("pdf")}</span>
      </div>

      {/* Type description cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {[
          { type: "preliminary", label: "Preliminary Report", color: "#1a73e8", bg: "#e8f0fe",
            desc: "Includes property details, land valuation, building valuation, and site plans. Used for initial bank assessment." },
          { type: "bill", label: "Bill", color: "#c9922a", bg: "#fff8ee",
            desc: "Standalone valuation bill / invoice showing fee breakdown, field charges, transportation, and grand total payable." },
          { type: "final", label: "Final Report", color: "#1a5c3a", bg: "#e8f5e9",
            desc: "Full report with all legal documents, photographs, and complete valuation. Submitted as official bank security assessment." },
        ].map(({ type, label, color, bg, desc }) => (
          <div key={type} onClick={() => setReportType(type)}
            style={{ padding: "14px 16px", borderRadius: 10, border: `2px solid ${reportType === type ? color : "#e0e4ea"}`, background: reportType === type ? bg : "#fafbfd", cursor: "pointer", transition: "all 0.15s" }}>
            <div style={{ fontWeight: 700, fontSize: 14, color, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 12, color: "#5f6b7a", lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>

      {/* ── Bill Summary Panel ── */}
      {reportType === "preliminary" && fieldChargeReceived !== null && (
        <div style={{ background: "#fff", border: "1.5px solid #dde1e7", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ background: "linear-gradient(135deg,#0f1f3d,#1a3a6b)", color: "#fff", padding: "10px 18px", fontWeight: 700, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>🧾 Field Charge Details</span>
            <button onClick={() => { setFieldChargeReceived(null); setFieldChargeAmount(""); setTransportationCharge(""); }}
              style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>✏ Edit</button>
          </div>
          <div style={{ padding: "14px 18px", display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13 }}>
            <div><span style={{ color: "#7f8c8d" }}>Field Charge Received:</span> <strong style={{ color: fieldChargeReceived ? "#27ae60" : "#e74c3c" }}>{fieldChargeReceived ? "Yes" : "No"}</strong></div>
            {fieldChargeReceived && fieldChargeAmount && <div><span style={{ color: "#7f8c8d" }}>Amount:</span> <strong>{npr(fieldChargeAmount)}</strong></div>}
            {fieldChargeReceived && transportationCharge && <div><span style={{ color: "#7f8c8d" }}>Transport:</span> <strong>{npr(transportationCharge)}</strong></div>}
          </div>
        </div>
      )}

      {/* ── Final Report — Amount Received Panel ── */}
      {reportType === "final" && (
        <div style={{ background: "#fff", border: "1.5px solid #dde1e7", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ background: "linear-gradient(135deg,#1a5c3a,#27ae60)", color: "#fff", padding: "10px 18px", fontWeight: 700, fontSize: 13 }}>
            💰 Payment Received
          </div>
          <div style={{ padding: "16px 18px", display: "flex", alignItems: "flex-end", gap: 20, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 220px" }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#7f8c8d", textTransform: "uppercase", marginBottom: 6 }}>
                Amount Received from Client (NPR)
              </label>
              <input
                type="number" min="0" placeholder="e.g. 15000"
                value={amountReceived}
                onChange={e => setAmountReceived(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #dde1e7", borderRadius: 8, fontSize: 15, boxSizing: "border-box" }}
              />
              <div style={{ fontSize: 11, color: "#aaa", marginTop: 5 }}>Leave blank if not applicable. This appears on the final report.</div>
            </div>
            {amountReceived && Number(amountReceived) > 0 && (
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1a5c3a", paddingBottom: 28 }}>
                ✓ {npr(amountReceived)} recorded
              </div>
            )}
          </div>
        </div>
      )}

      {reportType === "bill" && (() => {
        const fieldAmt    = Number(fieldChargeAmount)    || 0;
        const transAmt    = Number(transportationCharge) || 0;
        const fieldVisit  = fieldAmt + transAmt;
        const extraAmt    = Number(extraChargeAmount)    || 0;
        const subTotal    = fieldVisit + valuationFee + extraAmt;
        const advanceAmt  = fieldVisit; // field charge is recorded as advance
        const total       = subTotal - advanceAmt;
        const discAmt     = Number(discountAmount)       || 0;
        const vatBase     = Math.max(0, total - discAmt);
        const vatAmt      = includeVat ? Math.round(vatBase * 0.13) : 0;
        const grandTotal  = vatBase + vatAmt;
        const C2 = { border: "#dde1e7", muted: "#7f8c8d", navy: "#0f1f3d" };
        const Row = ({ label, value, bold, total: isTotal, color, sub, highlight }) => (
          <tr style={{ background: isTotal ? "#f0f4ff" : highlight ? "#fff8e1" : sub ? "#fafbfd" : "#fff", borderTop: isTotal ? "2px solid #0f1f3d" : "none" }}>
            <td style={{ padding: "7px 14px", color: bold||isTotal ? C2.navy : C2.muted, fontWeight: bold||isTotal ? 700 : 400, fontSize: isTotal ? 14 : 13 }}>{label}</td>
            <td style={{ padding: "7px 14px", textAlign: "right", fontWeight: bold||isTotal ? 800 : 600, fontSize: isTotal ? 15 : 13, color: color || (isTotal ? C2.navy : "#2c3e50") }}>{value}</td>
          </tr>
        );
        return (
          <div style={{ background: "#fff", border: "1.5px solid #dde1e7", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ background: "linear-gradient(135deg,#1a5c3a,#27ae60)", color: "#fff", padding: "12px 18px", fontWeight: 700, fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>🧾 Valuation Bill</span>
              <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.85 }}>Click "Print / Download Bill" to generate PDF</span>
            </div>

            {/* Bill inputs */}
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #eee", display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 180px" }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: C2.muted, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Bill No. <span style={{ fontWeight: 400 }}>(auto if blank)</span></label>
                <input type="text" value={billNo} onChange={e => setBillNo(e.target.value)} placeholder="e.g. 2081-082/001"
                  style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #dde1e7", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: "1 1 140px" }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: C2.muted, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Field Visit Charge (NPR)</label>
                <input type="number" value={fieldChargeAmount} onChange={e => setFieldChargeAmount(e.target.value)} min="0" placeholder="0"
                  style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #dde1e7", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: "1 1 140px" }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: C2.muted, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Transportation (NPR)</label>
                <input type="number" value={transportationCharge} onChange={e => setTransportationCharge(e.target.value)} min="0" placeholder="0"
                  style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #dde1e7", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: "1 1 140px" }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: C2.muted, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Discount (NPR)</label>
                <input type="number" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} min="0" placeholder="0"
                  style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #dde1e7", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: "1 1 180px" }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: C2.muted, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Extra Charge Label</label>
                <input type="text" value={extraChargeLabel} onChange={e => setExtraChargeLabel(e.target.value)} placeholder="e.g. Documentation Fee"
                  style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #dde1e7", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: "1 1 120px" }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: C2.muted, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Extra Charge (NPR)</label>
                <input type="number" value={extraChargeAmount} onChange={e => setExtraChargeAmount(e.target.value)} min="0" placeholder="0"
                  style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #dde1e7", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: "1 1 140px" }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: C2.muted, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Bill Remarks</label>
                <input type="text" value={billRemarks} onChange={e => setBillRemarks(e.target.value)} placeholder="e.g. Paid / Due"
                  style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #dde1e7", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
              </div>
              {/* Payment method selector */}
              {paymentMethods.length > 0 && (
                <div style={{ flex: "1 1 220px" }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: C2.muted, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Payment Account</label>
                  <select value={selectedPaymentMethodId} onChange={e => setSelectedPaymentMethodId(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #dde1e7", borderRadius: 7, fontSize: 13, boxSizing: "border-box", background: "#fff" }}>
                    <option value="">— Select account —</option>
                    {paymentMethods.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.bankName}{m.branch ? ` · ${m.branch}` : ""}{m.accountName ? ` — ${m.accountName}` : ""}
                      </option>
                    ))}
                  </select>
                  {selectedPaymentMethodId && (() => {
                    const pm = paymentMethods.find(m => m.id === selectedPaymentMethodId);
                    return pm ? (
                      <div style={{ marginTop: 5, fontSize: 11, color: C2.muted, lineHeight: 1.5 }}>
                        {pm.accountNumber && <span>A/C: <strong>{pm.accountNumber}</strong></span>}
                        {pm.location && <span style={{ marginLeft: 8 }}>📍 {pm.location}</span>}
                        {pm.qrCode && <span style={{ marginLeft: 8, color: "#27ae60" }}>✓ QR attached</span>}
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 2 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", color: C2.navy }}>
                  <input type="checkbox" checked={includeVat} onChange={e => setIncludeVat(e.target.checked)} style={{ width: 15, height: 15 }} />
                  Include VAT (13%)
                </label>
              </div>
            </div>

            {/* Fee table — new structure */}
            <div style={{ padding: "0 0 4px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <Row label="Fair Market Value (FMV)" value={npr(finalFMV)} sub />
                  <Row label="1. Field Visit Charge" value={npr(fieldVisit)} bold color="#1a5c3a" />
                  <Row label="2. Valuation Charge (NRB Schedule)" value={npr(valuationFee)} bold color="#1a5c3a" />
                  {extraAmt > 0 && <Row label={`   ${extraChargeLabel || "Extra Charge"}`} value={npr(extraAmt)} />}
                  <Row label="3. Sub Total" value={npr(subTotal)} highlight />
                  <Row label="4. Advance" value={`− ${npr(advanceAmt)}`} color="#e67e22" />
                  <Row label="5. Total" value={npr(total)} bold />
                  <Row label="6. Discount" value={`− ${npr(discAmt)}`} color="#e74c3c" />
                  {vatAmt > 0 && <Row label="7. VAT @ 13%" value={npr(vatAmt)} color="#e67e22" />}
                  <Row label={`${vatAmt > 0 ? "8" : "7"}. Grand Total Payable`} value={npr(grandTotal)} total />
                </tbody>
              </table>
              <div style={{ padding: "6px 14px 10px", fontSize: 11, color: C2.muted, fontStyle: "italic" }}>
                In Words: <strong style={{ color: C2.navy }}>{toWords(grandTotal)} Rupees Only</strong>
              </div>
              <div style={{ padding: "0 14px 10px", fontSize: 11, color: C2.muted }}>
                ✓ Fee calculated per NRB Valuation Fee Schedule for Financial Institutions
              </div>
            </div>
          </div>
        );
      })()}

      {/* Empty state */}
      {!html && !loading && (
        <div style={{ textAlign: "center", padding: "60px 20px", background: "var(--surface)", borderRadius: "var(--radius-lg)", border: "2px dashed var(--border)", color: "var(--text-3)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>No preview yet</p>
          <p style={{ fontSize: 13 }}>Select a report type above and click <strong>Generate Preview</strong>.</p>
        </div>
      )}

      {/* Preview frame */}
      {html && (
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", height: "calc(100vh - 360px)", minHeight: 500, display: "flex", flexDirection: "column" }}>
          <div style={{ background: "var(--surface-3)", borderBottom: "1px solid var(--border)", padding: "8px 14px", fontSize: 12, color: "var(--text-3)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>
              {reportType === "bill"
                ? <>🧾 Bill PDF preview — click <strong>Print / Download Bill</strong> to save as PDF</>
                : <>💡 Click <strong>Print / Save as PDF</strong> → use your browser's print dialog → choose <em>Save as PDF</em></>}
            </span>
            <button onClick={reportType === "bill" ? doPreviewBill : doGenerate} disabled={loading}
              style={{ fontSize: 11, padding: "3px 10px", background: "var(--navy)", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
              {loading ? "…" : "↺ Refresh"}
            </button>
          </div>
          <ShadowPreview html={html} />
        </div>
      )}
    </div>
  );
}
