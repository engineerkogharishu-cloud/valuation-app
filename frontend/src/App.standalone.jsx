import React, { useState, useCallback, useEffect } from "react";
import { api } from "./services/api";
import { DevCredit } from "./components/ui/DeveloperCard";
import ValuationForm from "./pages/ValuationForm";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const [view,          setView]          = useState("dashboard");
  const [editReportId,  setEditReportId]  = useState(null);
  const [editState,     setEditState]     = useState(null);
  const [loadingId,     setLoadingId]     = useState(null);
  const [loadError,     setLoadError]     = useState("");
  const [companyName,   setCompanyName]   = useState("");

  useEffect(() => {
    api.getCompanyProfile()
      .then(p => setCompanyName(p.company_name || ""))
      .catch(() => {});
  }, []);

  const handleOpen = useCallback(async (id) => {
    setLoadingId(id);
    setLoadError("");
    try {
      const data = await api.getReport(id);
      setEditReportId(data.id);
      setEditState(data.state);
      setView("form");
    } catch (e) {
      setLoadError("Failed to load report: " + e.message);
    } finally {
      setLoadingId(null);
    }
  }, []);

  const handleNew  = useCallback(() => { setEditReportId(null); setEditState(null); setView("form"); }, []);
  const handleBack = useCallback(() => { setEditReportId(null); setEditState(null); setView("dashboard"); }, []);
  const handleSavedToDb = useCallback((id) => setEditReportId(id), []);

  return (
    <div>
      {/* Top bar */}
      <div style={{
        background: "#0f1f3d", color: "#fff", padding: "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        minHeight: 48, fontFamily: "'Segoe UI', sans-serif",
      }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            📋 Valuation System{companyName ? ` — ${companyName}` : ""}
          </span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.3px" }}>
            <DevCredit style={{ color: "rgba(255,255,255,0.4)" }} />
          </span>
        </div>
        {view === "form" && (
          <button
            onClick={handleBack}
            style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "none",
                     borderRadius: 6, padding: "5px 14px", cursor: "pointer", fontSize: 12 }}>
            ← Dashboard
          </button>
        )}
      </div>

      {/* Loading overlay */}
      {loadingId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(255,255,255,0.85)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      zIndex: 9999, fontFamily: "sans-serif", fontSize: 18, color: "#0f1f3d" }}>
          Loading report…
        </div>
      )}

      {/* Error toast */}
      {loadError && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
                      background: "#c0392b", color: "#fff", borderRadius: 8, padding: "12px 24px",
                      zIndex: 9999, fontFamily: "sans-serif" }}>
          {loadError}
          <button onClick={() => setLoadError("")}
            style={{ marginLeft: 12, background: "none", border: "none", color: "#fff",
                     cursor: "pointer", fontWeight: 700 }}>✕</button>
        </div>
      )}

      {view === "dashboard" && <Dashboard onOpen={handleOpen} onNew={handleNew} />}
      {view === "form" && (
        <ValuationForm
          reportId={editReportId}
          initialState={editState}
          onSavedToDb={handleSavedToDb}
          onBack={handleBack}
        />
      )}
    </div>
  );
}
