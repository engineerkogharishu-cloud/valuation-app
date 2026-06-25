import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { api } from "../../services/api";

const COST = { preliminary: 1, final: 2 };

// ── Small badge shown in header ───────────────────────────────
export function CreditBadge() {
  const [balance, setBalance] = useState(null);
  const [threshold, setThreshold] = useState(5);

  useEffect(() => {
    api.getCredits()
      .then(d => { setBalance(d.balance); setThreshold(d.low_threshold ?? 5); })
      .catch(() => {});
  }, []);

  if (balance === null) return null;

  const low = balance <= threshold;
  const critical = balance <= 2;

  return (
    <div title={`Credit balance: ${balance}`} style={{
      display: "flex", alignItems: "center", gap: 5,
      background: critical ? "rgba(231,76,60,0.2)" : low ? "rgba(243,156,18,0.2)" : "rgba(39,174,96,0.15)",
      border: `1px solid ${critical ? "rgba(231,76,60,0.5)" : low ? "rgba(243,156,18,0.5)" : "rgba(39,174,96,0.4)"}`,
      borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 700,
      color: critical ? "#e74c3c" : low ? "#f39c12" : "#27ae60",
    }}>
      <span style={{ fontSize: 14 }}>🪙</span>
      {balance} {low && <span style={{ fontSize: 10, fontWeight: 600 }}>{critical ? "⚠ Critical" : "⚠ Low"}</span>}
    </div>
  );
}

// ── Print confirmation modal with credit deduction ────────────
export function usePrintCredit(reportId) {
  const [creditData, setCreditData] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null); // { type, onConfirm }

  useEffect(() => {
    api.getCredits()
      .then(setCreditData)
      .catch(() => {});
  }, []);

  const requestPrint = useCallback((reportType, onProceed) => {
    const type = reportType || "preliminary";
    const cost = COST[type];
    const balance = creditData?.balance ?? 0;
    setConfirmModal({ type, cost, balance, onProceed });
  }, [creditData]);

  const ConfirmDialog = confirmModal ? createPortal(
    <PrintConfirmModal
      {...confirmModal}
      reportId={reportId}
      onClose={() => setConfirmModal(null)}
      onSuccess={(newBalance) => {
        setCreditData(d => d ? { ...d, balance: newBalance } : d);
        setConfirmModal(null);
      }}
    />,
    document.body
  ) : null;

  return { requestPrint, ConfirmDialog, creditData };
}

function PrintConfirmModal({ type, cost, balance, reportId, onProceed, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const remaining = balance - cost;
  const canPrint = balance >= cost;

  const handleConfirm = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.deductCredits(reportId, type);
      onSuccess(res.balance);
      onProceed();
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(15,31,61,0.65)",
      backdropFilter: "blur(3px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 99999, padding: 16,
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, width: "100%", maxWidth: 440,
        boxShadow: "0 24px 64px rgba(0,0,0,0.35)", overflow: "hidden",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}>
        {/* Header */}
        <div style={{
          background: canPrint ? "linear-gradient(135deg,#0f1f3d,#1a3a6b)" : "linear-gradient(135deg,#c0392b,#e74c3c)",
          padding: "20px 24px", color: "#fff",
        }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>{canPrint ? "🖨️" : "🚫"}</div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>
            {canPrint ? "Confirm Print" : "Insufficient Credits"}
          </div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
            {type === "final" ? "Final Report" : "Preliminary Report"}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px" }}>
          {canPrint ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {[
                  ["Report Type", type === "final" ? "Final" : "Preliminary"],
                  ["Credit Cost", `${cost} credit${cost > 1 ? "s" : ""}`],
                  ["Current Balance", `${balance} credits`],
                  ["Balance After", `${remaining} credits`],
                ].map(([label, value]) => (
                  <div key={label} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "9px 14px", background: "#f4f6fa", borderRadius: 8,
                  }}>
                    <span style={{ fontSize: 13, color: "#5f6b7a" }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: remaining <= 2 && label === "Balance After" ? "#e74c3c" : "#0f1f3d" }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
              {remaining <= 5 && remaining >= 0 && (
                <div style={{ background: "#fff8e1", border: "1px solid #f39c12", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#7a5c00", marginBottom: 16 }}>
                  ⚠ Your balance will be low after this print. Contact the Super Admin to top up.
                </div>
              )}
              {error && (
                <div style={{ background: "#fff5f5", border: "1px solid #e74c3c", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#c0392b", marginBottom: 16 }}>
                  {error}
                </div>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={onClose} disabled={loading} style={{
                  flex: 1, padding: "10px", border: "1.5px solid #dde1e7", borderRadius: 8,
                  background: "#fff", color: "#2c3e50", fontWeight: 600, fontSize: 13, cursor: "pointer",
                }}>Cancel</button>
                <button onClick={handleConfirm} disabled={loading} style={{
                  flex: 2, padding: "10px", border: "none", borderRadius: 8,
                  background: "linear-gradient(135deg,#0f1f3d,#1a3a6b)", color: "#fff",
                  fontWeight: 700, fontSize: 13, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
                }}>
                  {loading ? "Processing…" : `Confirm — Use ${cost} Credit${cost > 1 ? "s" : ""}`}
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: 14, color: "#5f6b7a", lineHeight: 1.6, marginBottom: 20 }}>
                Printing a <strong>{type}</strong> report requires <strong>{cost} credit{cost > 1 ? "s" : ""}</strong>,
                but your current balance is <strong style={{ color: "#e74c3c" }}>{balance} credit{balance !== 1 ? "s" : ""}</strong>.
              </p>
              <div style={{ background: "#fff5f5", border: "1px solid #e74c3c", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#c0392b", marginBottom: 20 }}>
                Please contact your Super Admin to top up your credit balance:
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(231,76,60,0.25)", display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontWeight: 700, color: "#7b1a1a" }}>One Degree Consultant Pvt. Ltd.</span>
                  <a href="mailto:onedegreeconsultant@gmail.com" style={{ color: "#c0392b", textDecoration: "none", fontWeight: 600 }}>
                    ✉ onedegreeconsultant@gmail.com
                  </a>
                  <a href="tel:9841357433" style={{ color: "#c0392b", textDecoration: "none", fontWeight: 600 }}>
                    📞 9841357433
                  </a>
                </div>
              </div>
              <button onClick={onClose} style={{
                width: "100%", padding: "10px", border: "1.5px solid #dde1e7", borderRadius: 8,
                background: "#fff", color: "#2c3e50", fontWeight: 600, fontSize: 13, cursor: "pointer",
              }}>Close</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
