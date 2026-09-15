import React, { useState } from "react";
import { api } from "../services/api";
import { setAuth } from "../services/auth";
import PasswordInput from "../components/ui/PasswordInput";
import { DevCredit } from "../components/ui/DeveloperCard";
import bgPhoto from "../assets/login-bg.jpg";
import { BRAND } from "../constants/brand";

/* ── Animated aurora background ── */
function Bg() {
  return (
    <div className="lp-bg" aria-hidden="true">
      <div className="lp-photo" style={{ backgroundImage: "url(" + bgPhoto + ")" }} />
      <div className="lp-scrim" />
      <span className="lp-blob lp-blob1" />
      <span className="lp-blob lp-blob2" />
      <span className="lp-blob lp-blob3" />
      <div className="lp-vignette" />
    </div>
  );
}

/* ── Floating feature pill ── */
function FeaturePill({ icon, text, delay }) {
  return (
    <div className="lp-pill" style={{ animationDelay: delay + "ms" }}>
      <span className="lp-pill-icon">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

const FEATURES = [
  { icon: "🏠", text: "Property Valuation" },
  { icon: "📍", text: "Land Valuation" },
  { icon: "🏢", text: "Building Valuation" },
  { icon: "🏦", text: "Bank Valuation" },
  { icon: "📈", text: "Market Data" },
  { icon: "📄", text: "Auto Reports" },
];

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState("login");

  return (
    <div className="lp-page">
      <Bg />

      {/* Left panel — branding */}
      <aside className="lp-left">
        <div className="lp-brand">
          <div className="lp-logo"><span className="lp-logo-mark">M</span></div>
          <h1 className="lp-title">
            <span className="lp-title-accent">{BRAND.name}</span>
          </h1>
          <p className="lp-tagline">{BRAND.tagline}</p>
          <p className="lp-sub">
            Property, land, building and bank valuation — from field data collection
            to the final signed report.
          </p>
          <div className="lp-pills">
            {FEATURES.map((f, i) => (
              <FeaturePill key={f.text} icon={f.icon} text={f.text} delay={260 + i * 90} />
            ))}
          </div>
        </div>
        <p className="lp-credit"><DevCredit style={{ color: "rgba(6, 78, 59,0.45)" }} /></p>
      </aside>

      {/* Right panel — form */}
      <main className="lp-right">
        <div className="lp-card-wrap">
          {/* Compact brand header, shown only on small screens */}
          <div className="lp-mini-brand">
            <div className="lp-mini-logo"><span className="lp-logo-mark">M</span></div>
            <div>
              <div className="lp-mini-title">{BRAND.name}</div>
              <div className="lp-mini-sub">{BRAND.tagline}</div>
            </div>
          </div>

          <div className="lp-card">
            <div className="lp-card-accent" />

            <div className="lp-tabbar">
              <span className={"lp-tab-pill" + (mode === "register" ? " is-right" : "")} />
              {[["login", "🔑", "Sign In"], ["register", "📝", "Register"]].map(([m, ic, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={"lp-tab" + (mode === m ? " is-active" : "")}
                >
                  <span className="lp-tab-ic">{ic}</span>{label}
                </button>
              ))}
            </div>

            <div key={mode} className="lp-fade">
              {mode === "login"
                ? <LoginForm onLogin={onLogin} onRegister={() => setMode("register")} />
                : <RegisterForm onBack={() => setMode("login")} />}
            </div>
          </div>

          <p className="lp-credit-mobile"><DevCredit style={{ color: "rgba(6, 78, 59,0.45)" }} /></p>
        </div>
      </main>
    </div>
  );
}

/* ── Field with inline leading icon ── */
function Field({ label, required, icon, children, full }) {
  return (
    <div className={"lp-field" + (full ? " lp-full" : "")}>
      <label className="lp-label">
        {label}
        {required && <span className="lp-req">*</span>}
      </label>
      <div className="lp-input-wrap">
        {icon && <span className="lp-input-icon">{icon}</span>}
        {children}
      </div>
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
      <div className="lp-form-head">
        <h2 className="lp-form-title">Welcome back</h2>
        <p className="lp-form-sub">Sign in to your company account</p>
      </div>

      {error && <div className="lp-error">⚠ {error}</div>}

      <Field label="Company Code" required icon="🏢">
        <input className="lp-input" type="text" placeholder="e.g. ABC123"
          value={form.company_code} onChange={set("company_code")} required autoComplete="organization" />
      </Field>
      <Field label="Username" required icon="👤">
        <input className="lp-input" type="text" placeholder="Your username"
          value={form.username} onChange={set("username")} required autoComplete="username" />
      </Field>
      <Field label="Password" required icon="🔒">
        <PasswordInput style={PW_STYLE} borderColor="transparent"
          placeholder="Your password"
          value={form.password} onChange={set("password")} required autoComplete="current-password" />
      </Field>

      <button className={"lp-btn" + (loading ? " is-loading" : "")} type="submit" disabled={loading}>
        <span className="lp-btn-label">
          {loading && <span className="lp-spinner" />}
          {loading ? "Signing in…" : "Sign In"}
          {!loading && <span className="lp-btn-arrow">→</span>}
        </span>
      </button>

      <p className="lp-switch">
        New company?{" "}
        <button type="button" className="lp-link" onClick={onRegister}>Register here</button>
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
    <div className="lp-success">
      <div className="lp-success-icon">✅</div>
      <h3 className="lp-success-title">Request Sent!</h3>
      <p className="lp-success-msg">{success}</p>
      <p className="lp-success-note">
        Our team will review your request and reach out to the email you provided to set up your account.
      </p>
      <button type="button" className="lp-btn-outline" onClick={onBack}>← Back to Sign In</button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit}>
      <div className="lp-form-head">
        <h2 className="lp-form-title">Register your company</h2>
        <p className="lp-form-sub">We'll review and set up your account within 24 hours</p>
      </div>

      {error && <div className="lp-error">⚠ {error}</div>}

      <div className="lp-grid2">
        <Field full label="Company Name" required icon="🏢">
          <input className="lp-input" type="text" placeholder="e.g. Himalayan Bank Ltd"
            value={form.company_name} onChange={set("company_name")} required />
        </Field>
        <Field label="Contact Person" required icon="👤">
          <input className="lp-input" type="text" placeholder="Full name"
            value={form.contact_name} onChange={set("contact_name")} required />
        </Field>
        <Field label="Phone" icon="📞">
          <input className="lp-input" type="tel" placeholder="+977-XXXXXXXXXX"
            value={form.phone} onChange={set("phone")} />
        </Field>
        <Field full label="Email Address" required icon="✉">
          <input className="lp-input" type="email" placeholder="your@email.com"
            value={form.email} onChange={set("email")} required />
        </Field>
        <Field full label="Message (optional)" icon="💬">
          <textarea className="lp-input lp-textarea" placeholder="Tell us about your business…"
            value={form.message} onChange={set("message")} />
        </Field>
      </div>

      <button className={"lp-btn lp-btn-green" + (loading ? " is-loading" : "")} type="submit" disabled={loading}>
        <span className="lp-btn-label">
          {loading && <span className="lp-spinner" />}
          {loading ? "Submitting…" : "Submit Request"}
          {!loading && <span className="lp-btn-arrow">→</span>}
        </span>
      </button>

      <p className="lp-switch">
        Already have an account?{" "}
        <button type="button" className="lp-link" onClick={onBack}>Sign in</button>
      </p>
    </form>
  );
}

/* PasswordInput builds its own inline styles, so override them here */
const PW_STYLE = {
  padding: "12px 44px 12px 40px",
  border: "1.5px solid transparent",
  borderRadius: 11,
  fontSize: 14,
  background: "#F3F6F5",
  color: "#064E3B",
  fontFamily: "inherit",
};

/* ────────────────── Styles ────────────────── */
const CSS = `
.lp-page{
  min-height:100vh; display:flex; align-items:stretch; position:relative;
  font-family:'Poppins',system-ui,-apple-system,'Segoe UI',sans-serif;
  background:linear-gradient(135deg,#F8FAF9 0%,#F3F6F5 45%,#EDF2EF 100%);
  overflow:hidden;
}

/* Background */
.lp-bg{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:0}
.lp-photo{
  position:absolute;inset:0;
  background-size:cover;background-position:center 38%;background-repeat:no-repeat;
  filter:saturate(.42) contrast(.92) brightness(1.14);
  opacity:.20;
  transform:scale(1.06);will-change:transform;
  animation:lpKen 46s ease-in-out infinite alternate;
}
.lp-scrim{
  position:absolute;inset:0;
  background:
    linear-gradient(100deg,
      rgba(255,255,255,.80) 0%,
      rgba(252,253,255,.66) 28%,
      rgba(248,251,255,.48) 52%,
      rgba(244,249,255,.52) 74%,
      rgba(238,245,254,.66) 100%),
    linear-gradient(to top,rgba(232,240,251,.72) 0%,transparent 46%);
}
.lp-blob{position:absolute;border-radius:50%;display:block;will-change:transform}
.lp-blob1{width:460px;height:460px;top:-140px;left:-120px;
  background:radial-gradient(circle,rgba(16, 185, 129,.13),transparent 68%);
  filter:blur(50px);animation:lpFloat1 20s ease-in-out infinite}
.lp-blob2{width:400px;height:400px;top:48%;left:64%;
  background:radial-gradient(circle,rgba(212, 175, 55,.11),transparent 68%);
  filter:blur(56px);animation:lpFloat2 24s ease-in-out infinite}
.lp-blob3{width:340px;height:340px;top:24%;left:-90px;
  background:radial-gradient(circle,rgba(16, 185, 129,.09),transparent 68%);
  filter:blur(52px);animation:lpFloat3 27s ease-in-out infinite}
.lp-vignette{position:absolute;inset:0;
  background:radial-gradient(ellipse at 50% 40%,transparent 40%,rgba(203,217,236,.42) 100%)}

@keyframes lpFloat1{0%,100%{transform:translate(0,0) scale(1)}
  50%{transform:translate(70px,60px) scale(1.12)}}
@keyframes lpFloat2{0%,100%{transform:translate(0,0) scale(1)}
  50%{transform:translate(-80px,-50px) scale(.9)}}
@keyframes lpFloat3{0%,100%{transform:translate(0,0) scale(1)}
  50%{transform:translate(50px,-70px) scale(1.16)}}
@keyframes lpKen{from{transform:scale(1.06) translate(0,0)}
  to{transform:scale(1.16) translate(-1.5%,-1.5%)}}

/* Left branding */
.lp-left{
  flex:0 0 460px; display:flex; flex-direction:column; justify-content:space-between;
  padding:56px 48px; position:relative; z-index:1;
}
.lp-brand{flex:1;display:flex;flex-direction:column;justify-content:center}
.lp-logo{
  width:68px;height:68px;border-radius:20px;font-size:34px;margin-bottom:24px;
  display:flex;align-items:center;justify-content:center;
  background:linear-gradient(135deg,#064E3B 0%,#0A6B50 100%);
  box-shadow:0 10px 34px rgba(6, 78, 59,.42),inset 0 1px 0 rgba(255,255,255,.35);
  animation:lpPop .6s cubic-bezier(.2,.9,.3,1.3) both, lpGlow 4.5s ease-in-out 1s infinite;
}
.lp-title{
  font-size:58px;font-weight:700;color:#064E3B;margin:0 0 6px;line-height:1;
  letter-spacing:-2px;animation:lpUp .6s ease .08s both;
}
.lp-tagline{
  font-size:17px;font-weight:500;color:#0A6B50;margin:0 0 16px;line-height:1.5;
  animation:lpUp .6s ease .12s both;
}
.lp-title-accent{
  background:linear-gradient(100deg,#064E3B 0%,#10B981 62%,#D4AF37 100%);
  -webkit-background-clip:text;background-clip:text;
  -webkit-text-fill-color:transparent;color:transparent;
}
.lp-sub{
  font-size:15px;color:#7A8F87;line-height:1.65;margin:0;max-width:320px;
  animation:lpUp .6s ease .16s both;
}
.lp-pills{display:flex;flex-wrap:wrap;gap:9px;margin-top:30px}
.lp-pill{
  display:flex;align-items:center;gap:7px;border-radius:22px;padding:7px 14px;
  font-size:12.5px;color:#3D5A50;font-weight:600;
  background:rgba(255,255,255,.78);border:1px solid rgba(6, 78, 59,.10);
  box-shadow:0 2px 8px rgba(6, 78, 59,.06);
  backdrop-filter:blur(8px);animation:lpUp .55s ease both;
  transition:transform .2s ease,background .2s ease,border-color .2s ease,box-shadow .2s ease;
}
.lp-pill:hover{transform:translateY(-3px);background:#fff;
  border-color:rgba(16, 185, 129,.32);box-shadow:0 6px 18px rgba(16, 185, 129,.16)}
.lp-pill-icon{font-size:14px}
.lp-credit{margin:0;font-size:11px;color:rgba(6, 78, 59,.42);animation:lpUp .6s ease .5s both}
.lp-credit-mobile{display:none}

/* Right panel */
.lp-right{
  flex:1;display:flex;align-items:center;justify-content:center;
  padding:32px 24px;position:relative;z-index:1;
}
.lp-card-wrap{width:100%;max-width:440px}
.lp-card{
  position:relative;overflow:hidden;
  background:rgba(255,255,255,.94);
  border-radius:22px;padding:34px 38px 32px;
  box-shadow:0 24px 60px rgba(6, 78, 59,.14),0 4px 14px rgba(6, 78, 59,.06),
             0 0 0 1px rgba(6, 78, 59,.06),inset 0 1px 0 rgba(255,255,255,.9);
  backdrop-filter:blur(14px);
  animation:lpCard .65s cubic-bezier(.2,.8,.25,1) both;
}
.lp-card-accent{
  position:absolute;top:0;left:0;right:0;height:4px;
  background:linear-gradient(90deg,#064E3B,#10B981 35%,#D4AF37 75%,#E0C468);
  background-size:200% 100%;animation:lpSlide 6s linear infinite;
}

/* Mini brand (mobile) */
.lp-mini-brand{display:none;align-items:center;gap:12px;margin-bottom:20px}
.lp-mini-logo{
  width:44px;height:44px;border-radius:13px;font-size:22px;flex:0 0 44px;
  display:flex;align-items:center;justify-content:center;
  background:linear-gradient(135deg,#064E3B 0%,#0A6B50 100%);
  box-shadow:0 6px 20px rgba(6, 78, 59,.32);
}
.lp-logo-mark{
  font-weight:800;color:#A7E3B1;line-height:1;letter-spacing:-.04em;
}
.lp-mini-title{color:#064E3B;font-weight:800;font-size:17px;letter-spacing:-.3px}
.lp-mini-sub{color:#7A8F87;font-size:11.5px;margin-top:2px}

/* Tabs */
.lp-tabbar{
  position:relative;display:flex;background:#EDF2EF;border-radius:13px;
  padding:5px;margin-bottom:26px;
}
.lp-tab-pill{
  position:absolute;top:5px;left:5px;width:calc(50% - 5px);height:calc(100% - 10px);
  background:#fff;border-radius:10px;box-shadow:0 2px 10px rgba(6, 78, 59,.16);
  transition:transform .28s cubic-bezier(.4,0,.2,1);
}
.lp-tab-pill.is-right{transform:translateX(100%)}
.lp-tab{
  position:relative;z-index:1;flex:1;padding:10px 0;border:none;border-radius:10px;
  cursor:pointer;font-size:13px;font-weight:700;font-family:inherit;
  background:transparent;color:#7A8F87;transition:color .2s;
  display:flex;align-items:center;justify-content:center;gap:6px;
}
.lp-tab.is-active{color:#064E3B}
.lp-tab-ic{font-size:13px}

/* Form */
.lp-fade{animation:lpUp .35s ease both}
.lp-form-head{margin-bottom:22px}
.lp-form-title{margin:0;font-size:23px;font-weight:800;color:#064E3B;letter-spacing:-.4px}
.lp-form-sub{margin:5px 0 0;font-size:13px;color:#7A8F87}

.lp-field{margin-bottom:16px}
.lp-label{
  display:block;font-size:10.5px;font-weight:700;color:#6b7280;margin-bottom:7px;
  text-transform:uppercase;letter-spacing:.7px;
}
.lp-req{color:#e74c3c;margin-left:3px}
.lp-input-wrap{position:relative;display:flex;align-items:center}
.lp-input-wrap > div{width:100%}
.lp-input-icon{
  position:absolute;left:14px;top:13px;font-size:14px;line-height:1;
  opacity:.55;pointer-events:none;z-index:1;
}
.lp-input-wrap input,.lp-input,.lp-textarea{
  width:100%;padding:12px 14px 12px 40px;
  border:1.5px solid transparent;border-radius:11px;
  font-size:14px;font-family:inherit;box-sizing:border-box;outline:none;
  background:#F3F6F5;color:#064E3B;
  transition:border-color .2s,box-shadow .2s,background .2s;
}
.lp-input-wrap input::placeholder,.lp-input::placeholder{color:#A8BAB0}
.lp-input-wrap input:hover,.lp-input:hover{background:#EDF2EF}
.lp-input-wrap input:focus,.lp-input:focus{
  border-color:#10B981;background:#fff;
  box-shadow:0 0 0 4px rgba(16, 185, 129,.14);
}
.lp-textarea{resize:vertical;min-height:74px}
.lp-grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}
.lp-full{grid-column:1 / -1}

/* Buttons */
.lp-btn{
  position:relative;overflow:hidden;width:100%;padding:14px;margin-top:8px;
  border:none;border-radius:12px;cursor:pointer;
  font-size:15px;font-weight:700;font-family:inherit;letter-spacing:.2px;color:#fff;
  background:linear-gradient(135deg,#064E3B 0%,#0A6B50 55%,#10B981 100%);
  box-shadow:0 8px 24px rgba(6, 78, 59,.35);
  transition:transform .15s ease,box-shadow .2s ease,filter .2s ease;
}
.lp-btn::after{
  content:"";position:absolute;top:0;left:-120%;width:60%;height:100%;
  background:linear-gradient(100deg,transparent,rgba(255,255,255,.28),transparent);
  transform:skewX(-18deg);transition:left .6s ease;
}
.lp-btn:hover:not(:disabled){transform:translateY(-2px);
  box-shadow:0 14px 32px rgba(16, 185, 129,.42);filter:brightness(1.07)}
.lp-btn:hover:not(:disabled)::after{left:130%}
.lp-btn:active:not(:disabled){transform:translateY(0)}
.lp-btn.is-loading,.lp-btn:disabled{opacity:.75;cursor:not-allowed;transform:none}
.lp-btn-green{background:linear-gradient(135deg,#0E9E6E 0%,#10B981 55%,#10B981 100%);
  box-shadow:0 8px 24px rgba(20,120,70,.32)}
.lp-btn-green:hover:not(:disabled){box-shadow:0 14px 32px rgba(16, 185, 129,.4)}
.lp-btn-label{display:flex;align-items:center;justify-content:center;gap:8px;
  position:relative;z-index:1}
.lp-btn-arrow{transition:transform .2s ease;display:inline-block}
.lp-btn:hover:not(:disabled) .lp-btn-arrow{transform:translateX(4px)}
.lp-btn-outline{
  padding:11px 26px;background:transparent;color:#064E3B;border:2px solid #064E3B;
  border-radius:11px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;
  transition:background .18s,color .18s;
}
.lp-btn-outline:hover{background:#064E3B;color:#fff}

.lp-spinner{
  display:inline-block;width:15px;height:15px;border:2px solid rgba(255,255,255,.32);
  border-top-color:#fff;border-radius:50%;animation:lpSpin .7s linear infinite;
}

.lp-error{
  background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:11px;
  padding:11px 14px;font-size:13px;margin-bottom:18px;font-weight:500;
  animation:lpShake .4s ease;
}

.lp-switch{text-align:center;font-size:13px;color:#7A8F87;margin:18px 0 0}
.lp-link{
  background:none;border:none;padding:0;font:inherit;font-weight:700;color:#10B981;
  cursor:pointer;text-decoration:underline;text-underline-offset:2px;
}
.lp-link:hover{color:#0E9E6E}

/* Success */
.lp-success{text-align:center;padding:8px 4px 4px;animation:lpUp .4s ease both}
.lp-success-icon{
  width:76px;height:76px;border-radius:50%;font-size:36px;margin:0 auto 18px;
  display:flex;align-items:center;justify-content:center;
  background:linear-gradient(135deg,#E8F5EC,#A7E3B1);
  box-shadow:0 6px 24px rgba(16, 185, 129,.28);
  animation:lpPop .5s cubic-bezier(.2,.9,.3,1.4) both;
}
.lp-success-title{margin:0 0 8px;color:#064E3B;font-size:21px;font-weight:800}
.lp-success-msg{margin:0 0 8px;font-size:14px;color:#0E9E6E;line-height:1.5}
.lp-success-note{font-size:13px;color:#555;line-height:1.55;margin:0 0 24px}

/* Keyframes */
@keyframes lpSpin{to{transform:rotate(360deg)}}
@keyframes lpUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes lpCard{from{opacity:0;transform:translateY(26px) scale(.97)}to{opacity:1;transform:none}}
@keyframes lpPop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
@keyframes lpGlow{
  0%,100%{box-shadow:0 10px 34px rgba(6, 78, 59,.42),inset 0 1px 0 rgba(255,255,255,.35)}
  50%{box-shadow:0 12px 44px rgba(16, 185, 129,.58),inset 0 1px 0 rgba(255,255,255,.35)}}
@keyframes lpSlide{to{background-position:200% 0}}
@keyframes lpShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}
  75%{transform:translateX(5px)}}

/* Responsive */
@media (max-width:980px){
  .lp-left{flex:0 0 390px;padding:44px 34px}
  .lp-title{font-size:46px}
  .lp-tagline{font-size:15px}
}
@media (max-width:860px){
  .lp-left{display:none}
  .lp-mini-brand{display:flex}
  .lp-photo{background-position:60% 38%}
  .lp-scrim{background:
    linear-gradient(180deg,rgba(255,255,255,.72) 0%,rgba(250,252,255,.56) 45%,
      rgba(238,245,254,.74) 100%)}
  .lp-credit-mobile{display:block;text-align:center;margin:18px 0 0;font-size:11px;
    color:rgba(6, 78, 59,.42)}
  .lp-right{padding:28px 18px}
  .lp-card{padding:28px 24px 26px;border-radius:18px}
  .lp-grid2{grid-template-columns:1fr}
}
@media (prefers-reduced-motion:reduce){
  .lp-page *,.lp-page *::after{animation:none !important;transition:none !important}
  .lp-photo{transform:scale(1.06)}
}
`;

/* Inject stylesheet (re-writes contents on hot reload instead of going stale) */
if (typeof document !== "undefined") {
  let style = document.getElementById("lp-styles");
  if (!style) {
    style = document.createElement("style");
    style.id = "lp-styles";
    document.head.appendChild(style);
  }
  if (style.textContent !== CSS) style.textContent = CSS;
}
