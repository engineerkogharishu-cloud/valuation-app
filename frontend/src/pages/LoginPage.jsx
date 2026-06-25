import React, { useState } from "react";
import { api } from "../services/api";
import { setAuth } from "../services/auth";
import PasswordInput from "../components/ui/PasswordInput";
import { DevCredit } from "../components/ui/DeveloperCard";

/* Animated background dots */
function Bg() {
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      {[
        { w: 320, h: 320, top: "-80px", left: "-80px",  bg: "rgba(26,115,232,0.12)", blur: 60 },
        { w: 260, h: 260, top: "55%",   left: "70%",    bg: "rgba(201,146,42,0.10)", blur: 50 },
        { w: 200, h: 200, top: "30%",   left: "-40px",  bg: "rgba(39,174,96,0.08)",  blur: 48 },
        { w: 180, h: 180, top: "80%",   left: "15%",    bg: "rgba(142,68,173,0.08)", blur: 44 },
      ].map((d, i) => (
        <div key={i} style={{
          position: "absolute", width: d.w, height: d.h,
          top: d.top, left: d.left,
          borderRadius: "50%", background: d.bg,
          filter: `blur(${d.blur}px)`,
        }} />
      ))}
      {/* Subtle grid lines */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.04 }}>
        <defs>
          <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#fff" strokeWidth="0.8"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  );
}

/* Floating feature pill */
function FeaturePill({ icon, text }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 20, padding: "5px 12px", fontSize: 12, color: "rgba(255,255,255,0.7)",
    }}>
      <span>{icon}</span><span>{text}</span>
    </div>
  );
}

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState("login");

  return (
    <div style={S.page}>
      <Bg />

      {/* Left panel — branding */}
      <div style={S.left}>
        <div style={S.brand}>
          <div style={S.brandIcon}>🏢</div>
          <h1 style={S.brandTitle}>Valuation<br/>System</h1>
          <p style={S.brandSub}>
            A complete platform for property valuation management — from field data collection to final report generation.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 28 }}>
            <FeaturePill icon="📋" text="Report Management" />
            <FeaturePill icon="🗺️" text="Rate Map" />
            <FeaturePill icon="📱" text="Field Collection" />
            <FeaturePill icon="🪙" text="Credit System" />
          </div>
        </div>
        <p style={S.brandCredit}><DevCredit style={{ color: "rgba(255,255,255,0.35)" }} /></p>
      </div>

      {/* Right panel — form */}
      <div style={S.right}>
        <div style={S.card}>
          {/* Mode toggle */}
          <div style={S.tabBar}>
            {[["login","🔑 Sign In"],["register","📝 Register"]].map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)}
                style={{ ...S.tab, ...(mode === m ? S.tabActive : {}) }}>
                {label}
              </button>
            ))}
          </div>

          {mode === "login"
          ? <LoginForm onLogin={onLogin} onRegister={() => setMode("register")} />
          : <RegisterForm onBack={() => setMode("login")} />}
        </div>
      </div>
    </div>
  );
}

/* ── Input with floating label feel ── */
function Field({ label, required, icon, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={S.label}>
        {icon && <span style={{ marginRight: 5 }}>{icon}</span>}
        {label}
        {required && <span style={{ color: "#e74c3c", marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function LoginForm({ onLogin, onRegister }) {
  const [form, setForm]       = useState({ company_code: "", username: "", password: "" });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const { user } = await api.login(form.company_code.trim(), form.username.trim(), form.password);
      setAuth(user); onLogin(user);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={S.formHeader}>
        <h2 style={S.formTitle}>Welcome back</h2>
        <p style={S.formSub}>Sign in to your company account</p>
      </div>

      {error && <div style={S.error}>⚠ {error}</div>}

      <Field label="Company Code" required icon="🏢">
        <input style={S.input} type="text" placeholder="e.g. ABC123"
          value={form.company_code} onChange={set("company_code")} required autoComplete="organization" />
      </Field>
      <Field label="Username" required icon="👤">
        <input style={S.input} type="text" placeholder="Your username"
          value={form.username} onChange={set("username")} required autoComplete="username" />
      </Field>
      <Field label="Password" required icon="🔒">
        <PasswordInput style={S.input} placeholder="Your password"
          value={form.password} onChange={set("password")} required autoComplete="current-password" />
      </Field>

      <button style={{ ...S.btn, ...(loading ? S.btnLoading : {}) }} type="submit" disabled={loading}>
        {loading
          ? <span style={S.spinner} />
          : null}
        {loading ? "Signing in…" : "Sign In →"}
      </button>

      <p style={S.switchHint}>
        New company?{" "}
        <span style={S.switchLink} onClick={onRegister}>Register here</span>
      </p>
    </form>
  );
}

function RegisterForm({ onBack }) {
  const [form, setForm]       = useState({ company_name: "", contact_name: "", email: "", phone: "", message: "" });
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await api.submitRegistration(form);
      setSuccess(res.message || "Request submitted!");
      setForm({ company_name: "", contact_name: "", email: "", phone: "", message: "" });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  if (success) return (
    <div style={S.successWrap}>
      <div style={S.successIcon}>✅</div>
      <h3 style={{ margin: "0 0 8px", color: "#0f5132", fontSize: 20, fontWeight: 800 }}>Request Sent!</h3>
      <p style={{ margin: "0 0 8px", fontSize: 14, color: "#1a7a46", lineHeight: 1.5 }}>{success}</p>
      <p style={{ fontSize: 13, color: "#555", lineHeight: 1.5, margin: "0 0 24px" }}>
        Our team will review your request and reach out to the email you provided to set up your account.
      </p>
      <button style={S.btnOutline} onClick={onBack}>← Back to Sign In</button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit}>
      <div style={S.formHeader}>
        <h2 style={S.formTitle}>Register your company</h2>
        <p style={S.formSub}>We'll review and set up your account within 24 hours</p>
      </div>

      {error && <div style={S.error}>⚠ {error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Company Name" required icon="🏢">
            <input style={S.input} type="text" placeholder="e.g. Himalayan Bank Ltd"
              value={form.company_name} onChange={set("company_name")} required />
          </Field>
        </div>
        <Field label="Contact Person" required icon="👤">
          <input style={S.input} type="text" placeholder="Full name"
            value={form.contact_name} onChange={set("contact_name")} required />
        </Field>
        <Field label="Phone" icon="📞">
          <input style={S.input} type="tel" placeholder="+977-XXXXXXXXXX"
            value={form.phone} onChange={set("phone")} />
        </Field>
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Email Address" required icon="✉">
            <input style={S.input} type="email" placeholder="your@email.com"
              value={form.email} onChange={set("email")} required />
          </Field>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Message (optional)" icon="💬">
            <textarea style={{ ...S.input, resize: "vertical", minHeight: 68 }}
              placeholder="Tell us about your business…"
              value={form.message} onChange={set("message")} />
          </Field>
        </div>
      </div>

      <button style={{ ...S.btn, background: "linear-gradient(135deg,#1a5c3a,#27ae60)", ...(loading ? S.btnLoading : {}) }}
        type="submit" disabled={loading}>
        {loading ? "Submitting…" : "Submit Request →"}
      </button>
    </form>
  );
}

/* ────────────────── Styles ────────────────── */
const S = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0a1628 0%, #0f1f3d 45%, #112244 100%)",
    display: "flex", alignItems: "stretch",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    position: "relative",
  },

  /* Left branding panel */
  left: {
    flex: "0 0 420px",
    display: "flex", flexDirection: "column", justifyContent: "space-between",
    padding: "56px 48px",
    position: "relative", zIndex: 1,
    "@media(max-width:860px)": { display: "none" },
  },
  brand: { flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" },
  brandIcon: {
    width: 64, height: 64, borderRadius: 18,
    background: "linear-gradient(135deg,#1a73e8,#0d47a1)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 32, marginBottom: 24,
    boxShadow: "0 8px 32px rgba(26,115,232,0.35)",
  },
  brandTitle: {
    fontSize: 42, fontWeight: 900, color: "#fff",
    margin: "0 0 16px", lineHeight: 1.1, letterSpacing: "-1px",
  },
  brandSub: {
    fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, margin: 0, maxWidth: 300,
  },
  brandCredit: { margin: 0, fontSize: 11, color: "rgba(255,255,255,0.2)" },

  /* Right form panel */
  right: {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
    padding: "32px 24px", position: "relative", zIndex: 1,
  },
  card: {
    background: "rgba(255,255,255,0.97)",
    borderRadius: 20, padding: "36px 40px",
    width: "100%", maxWidth: 420,
    boxShadow: "0 32px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)",
    backdropFilter: "blur(8px)",
  },

  /* Tabs */
  tabBar: {
    display: "flex", background: "#f0f2f5", borderRadius: 12, padding: 5,
    marginBottom: 28, gap: 4,
  },
  tab: {
    flex: 1, padding: "9px 0", border: "none", borderRadius: 9,
    cursor: "pointer", fontSize: 13, fontWeight: 700,
    background: "transparent", color: "#8a97aa", transition: "all 0.18s",
  },
  tabActive: {
    background: "#fff", color: "#0f1f3d",
    boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
  },

  /* Form */
  formHeader: { marginBottom: 22 },
  formTitle: { margin: 0, fontSize: 22, fontWeight: 800, color: "#0f1f3d" },
  formSub: { margin: "5px 0 0", fontSize: 13, color: "#8a97aa" },

  label: {
    display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280",
    marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.6px",
  },
  input: {
    width: "100%", padding: "11px 14px",
    border: "1.5px solid #e2e8f0", borderRadius: 10,
    fontSize: 14, boxSizing: "border-box", outline: "none",
    background: "#fafbfd", color: "#1a202c",
    transition: "border-color 0.2s, box-shadow 0.2s",
    fontFamily: "inherit",
  },

  btn: {
    width: "100%", padding: "13px",
    background: "linear-gradient(135deg, #0f1f3d 0%, #1a3a6b 100%)",
    color: "#fff", border: "none", borderRadius: 10,
    fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 6,
    letterSpacing: "0.2px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    boxShadow: "0 4px 16px rgba(15,31,61,0.3)",
    transition: "opacity 0.2s, transform 0.1s",
  },
  btnLoading: { opacity: 0.75, cursor: "not-allowed" },
  btnOutline: {
    padding: "10px 24px", background: "transparent",
    color: "#0f1f3d", border: "2px solid #0f1f3d",
    borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer",
    transition: "all 0.15s",
  },

  spinner: {
    display: "inline-block", width: 14, height: 14,
    border: "2px solid rgba(255,255,255,0.3)",
    borderTopColor: "#fff", borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
  },

  error: {
    background: "#fef2f2", color: "#b91c1c",
    border: "1px solid #fecaca", borderRadius: 10,
    padding: "10px 14px", fontSize: 13, marginBottom: 18,
    fontWeight: 500,
  },

  switchHint: { textAlign: "center", fontSize: 13, color: "#8a97aa", marginTop: 18 },
  switchLink: { color: "#1a73e8", fontWeight: 700, cursor: "pointer", textDecoration: "underline" },

  /* Success screen */
  successWrap: {
    textAlign: "center", padding: "8px 4px 4px",
  },
  successIcon: {
    width: 72, height: 72, borderRadius: "50%",
    background: "linear-gradient(135deg,#d1fae5,#a7f3d0)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 36, margin: "0 auto 18px",
    boxShadow: "0 4px 20px rgba(16,185,129,0.25)",
  },
};

/* Inject keyframe for spinner */
if (typeof document !== "undefined" && !document.getElementById("lp-spin")) {
  const style = document.createElement("style");
  style.id = "lp-spin";
  style.textContent = `
    @keyframes spin { to { transform: rotate(360deg); } }
    input:focus, textarea:focus, select:focus {
      border-color: #1a73e8 !important;
      box-shadow: 0 0 0 3px rgba(26,115,232,0.12) !important;
      background: #fff !important;
    }
    @media (max-width: 860px) {
      .lp-left { display: none !important; }
    }
  `;
  document.head.appendChild(style);
}
