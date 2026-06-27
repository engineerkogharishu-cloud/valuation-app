import React, { useState, useCallback, useEffect } from "react";
import { getUser, clearAuth } from "./services/auth";
import LoginPage from "./pages/LoginPage";
import ChangePasswordModal from "./components/common/ChangePasswordModal";
import SuperUserDashboard from "./pages/SuperUserDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Dashboard from "./pages/Dashboard";
import ValuationForm from "./pages/ValuationForm";
import MobileCollectPage from "./pages/MobileCollectPage";
import { api } from "./services/api";
import { DevCredit } from "./components/ui/DeveloperCard";

// Check if this is a mobile field-collection URL
// Supports: ?collect=TOKEN (old) and /collect/SHORTCODE (new)
const _pathMatch = window.location.pathname.match(/^\/collect\/([A-Za-z0-9]{4,12})$/i);
const collectToken = new URLSearchParams(window.location.search).get("collect");
const collectShortCode = _pathMatch ? _pathMatch[1].toUpperCase() : null;

// ── User Dashboard ────────────────────────────────────────────
function UserApp({ user }) {
  const [view, setView]               = useState("dashboard");
  const [editReportId, setEditReportId] = useState(null);
  const [editState, setEditState]      = useState(null);
  const [loadingId, setLoadingId]      = useState(null);
  const [loadError, setLoadError]      = useState("");
  const [companyName, setCompanyName]  = useState("");

  useEffect(() => {
    api.getCompanyProfile()
      .then((p) => setCompanyName(p.company_name || ""))
      .catch(() => {});
  }, []);

  const handleOpen = useCallback(async (id) => {
    setLoadingId(id); setLoadError("");
    try {
      const data = await api.getReport(id);
      setEditReportId(data.id);
      setEditState(data.state);
      setView("form");
    } catch (e) {
      setLoadError("Failed to load report #" + id + ": " + e.message);
    } finally {
      setLoadingId(null);
    }
  }, []);

  const handleNew  = useCallback((prefill = null) => { setEditReportId(null); setEditState(prefill || null); setView("form"); }, []);
  const handleBack = useCallback(() => { setEditReportId(null); setEditState(null); setView("dashboard"); }, []);
  const handleSavedToDb = useCallback((id) => setEditReportId(id), []);

  const handleLogout = async () => {
    try { await api.logout(); } catch (_) {}
    clearAuth();
    window.location.reload();
  };

  return (
    <div>
      <div style={{
        background: "#0f1f3d", color: "#fff", padding: "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        minHeight: 48, fontFamily: "'Segoe UI', sans-serif",
      }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            📋 Valuation System — {companyName || user.companyCode}
          </span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.3px" }}>
            <DevCredit style={{ color: "rgba(255,255,255,0.4)" }} />
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13 }}>👤 {user.username}</span>
          <button
            onClick={handleLogout}
            style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12 }}
          >
            Logout
          </button>
        </div>
      </div>

      {loadingId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(255,255,255,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, fontFamily: "sans-serif", fontSize: 18, color: "#0f1f3d" }}>
          Loading report #{loadingId}…
        </div>
      )}
      {loadError && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#c0392b", color: "#fff", borderRadius: 8, padding: "12px 24px", zIndex: 9999, fontFamily: "sans-serif" }}>
          {loadError}
          <button onClick={() => setLoadError("")} style={{ marginLeft: 12, background: "none", border: "none", color: "#fff", cursor: "pointer", fontWeight: 700 }}>✕</button>
        </div>
      )}
      {view === "dashboard" && <Dashboard onOpen={handleOpen} onNew={handleNew} user={user} />}
      {view === "form" && (
        <ValuationForm
          reportId={editReportId}
          initialState={editState}
          onSavedToDb={handleSavedToDb}
          onBack={handleBack}
          user={user}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

// ── Admin App (dashboard + ability to open reports) ───────────
function AdminApp({ user, onLogout }) {
  const [view, setView]         = useState("dashboard");
  const [editReportId, setEditReportId] = useState(null);
  const [editState, setEditState]       = useState(null);
  const [loadingId, setLoadingId]       = useState(null);
  const [loadError, setLoadError]       = useState("");

  const handleOpen = useCallback(async (id) => {
    setLoadingId(id); setLoadError("");
    try {
      const data = await api.getReport(id);
      setEditReportId(data.id);
      setEditState(data.state);
      setView("form");
    } catch (e) {
      setLoadError("Failed to load report #" + id + ": " + e.message);
    } finally {
      setLoadingId(null);
    }
  }, []);

  const handleBack = useCallback(() => { setEditReportId(null); setEditState(null); setView("dashboard"); }, []);
  const handleSavedToDb = useCallback((id) => setEditReportId(id), []);

  return (
    <div>
      {loadingId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(255,255,255,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, fontFamily: "sans-serif", fontSize: 18, color: "#0f1f3d" }}>
          Loading report #{loadingId}…
        </div>
      )}
      {loadError && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#c0392b", color: "#fff", borderRadius: 8, padding: "12px 24px", zIndex: 9999, fontFamily: "sans-serif" }}>
          {loadError}
          <button onClick={() => setLoadError("")} style={{ marginLeft: 12, background: "none", border: "none", color: "#fff", cursor: "pointer", fontWeight: 700 }}>✕</button>
        </div>
      )}
      {view === "dashboard" && <AdminDashboard user={user} onLogout={onLogout} onOpen={handleOpen} />}
      {view === "form" && (
        <ValuationForm
          reportId={editReportId}
          initialState={editState}
          onSavedToDb={handleSavedToDb}
          onBack={handleBack}
          user={user}
          onLogout={onLogout}
        />
      )}
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => getUser());

  const handleLogin = (u) => setUser(u);

  const handleLogout = async () => {
    try { await api.logout(); } catch (_) {}
    clearAuth();
    setUser(null);
  };

  const handlePasswordChanged = () => {
    setUser((u) => ({ ...u, mustChangePassword: false }));
  };

  if (collectToken) return <MobileCollectPage token={collectToken} />;
  if (collectShortCode) return <MobileCollectPage shortCode={collectShortCode} />;

  if (!user) return <LoginPage onLogin={handleLogin} />;

  if (user.mustChangePassword)
    return <ChangePasswordModal user={user} onDone={handlePasswordChanged} />;

  if (user.role === "super_user") return <SuperUserDashboard user={user} onLogout={handleLogout} />;
  if (user.role === "admin")      return <AdminApp user={user} onLogout={handleLogout} />;
  return <UserApp user={user} />;
}
