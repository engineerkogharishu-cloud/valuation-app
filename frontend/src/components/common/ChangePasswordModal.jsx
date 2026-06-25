import React, { useState } from "react";
import { api } from "../../services/api";
import { clearAuth } from "../../services/auth";
import PasswordInput from "../ui/PasswordInput";

const overlay = {
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 9999, fontFamily: "'Segoe UI', sans-serif",
};
const card = {
  background: "#fff", borderRadius: 12,
  padding: "36px 32px", width: "100%", maxWidth: 420,
  boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
};
const labelStyle  = { display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6, textTransform: "uppercase" };
const group = { marginBottom: 16 };
const btn   = { padding: "11px 20px", borderRadius: 8, border: "none", fontWeight: 600, cursor: "pointer", fontSize: 14 };

function isStrongPassword(pwd) {
  return (
    pwd.length >= 10 &&
    /[A-Z]/.test(pwd) &&
    /[a-z]/.test(pwd) &&
    /[0-9]/.test(pwd) &&
    /[^A-Za-z0-9]/.test(pwd)
  );
}

function PasswordStrength({ password }) {
  if (!password) return null;
  const checks = [
    { label: "≥ 10 characters",          ok: password.length >= 10 },
    { label: "Uppercase letter",          ok: /[A-Z]/.test(password) },
    { label: "Lowercase letter",          ok: /[a-z]/.test(password) },
    { label: "Number",                    ok: /[0-9]/.test(password) },
    { label: "Symbol (!@#$... etc.)",     ok: /[^A-Za-z0-9]/.test(password) },
  ];
  return (
    <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none" }}>
      {checks.map(({ label, ok }) => (
        <li key={label} style={{ fontSize: 11, color: ok ? "#27ae60" : "#aaa", marginBottom: 2 }}>
          {ok ? "✓" : "○"} {label}
        </li>
      ))}
    </ul>
  );
}

export default function ChangePasswordModal({ user, onDone }) {
  const [form, setForm]     = useState({ current: "", next: "", confirm: "" });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.next !== form.confirm) return setError("New passwords do not match");
    if (!isStrongPassword(form.next))
      return setError("Password must be ≥10 chars with uppercase, lowercase, number, and symbol.");
    setError("");
    setLoading(true);
    try {
      await api.changePassword(form.current, form.next);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try { await api.logout(); } catch (_) {}
    clearAuth();
    window.location.reload();
  };

  return (
    <div style={overlay}>
      <div style={card}>
        <h2 style={{ margin: "0 0 6px", color: "#0f1f3d", fontSize: 20 }}>Change Password</h2>
        <p style={{ margin: "0 0 24px", color: "#666", fontSize: 13 }}>
          Welcome, <strong>{user.username}</strong>! Please set a new password to continue.
        </p>

        {error && (
          <div style={{ background: "#fdecea", color: "#c0392b", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={group}>
            <label style={labelStyle}>Current Password</label>
            <PasswordInput value={form.current} onChange={set("current")} required autoComplete="current-password" />
          </div>
          <div style={group}>
            <label style={labelStyle}>New Password</label>
            <PasswordInput value={form.next} onChange={set("next")} required autoComplete="new-password" />
            <PasswordStrength password={form.next} />
          </div>
          <div style={group}>
            <label style={labelStyle}>Confirm New Password</label>
            <PasswordInput value={form.confirm} onChange={set("confirm")} required autoComplete="new-password" />
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button
              type="button"
              style={{ ...btn, background: "#f5f5f5", color: "#555" }}
              onClick={handleLogout}
            >
              Logout
            </button>
            <button
              style={{ ...btn, background: loading ? "#aaa" : "#1a73e8", color: "#fff" }}
              type="submit"
              disabled={loading}
            >
              {loading ? "Saving…" : "Set Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
