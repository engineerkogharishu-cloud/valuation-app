import React, { useState } from "react";
import { createPortal } from "react-dom";

// ── Developer / Company info ──────────────────────────────────
const DEV_INFO = {
  company:  "One Degree Consultant",
  person:   "Ishu Raj Mainali",
  tagline:  "Property Valuation & Engineering Consultancy",
  phone:    "+977-9841357433",
  email:    "onedegreeconsultant@gmail.com",
  website:  "Coming Soon",
  address:  "Kathmandu, Nepal",
  services: [
    "Property Valuation",
    "Engineering Consultancy",
    "Software Development",
    "Bank Loan Security Assessment",
  ],
};

// ── Clickable credit label ────────────────────────────────────
export function DevCredit({ style = {}, textStyle = {} }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span
        onClick={() => setOpen(true)}
        title="Click for developer info"
        style={{
          cursor: "pointer",
          textDecoration: "underline dotted",
          textUnderlineOffset: "2px",
          ...style,
        }}
      >
        <span style={textStyle}>
          Developed by <strong>One Degree Consultant</strong>, Ishu Raj Mainali
        </span>
      </span>
      {open && createPortal(<DeveloperModal onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

// ── Modal ─────────────────────────────────────────────────────
function DeveloperModal({ onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(10,20,40,0.65)",
        backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 99999, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 16,
          width: "100%", maxWidth: 440,
          boxShadow: "0 24px 64px rgba(0,0,0,0.3)",
          overflow: "hidden",
          fontFamily: "'Segoe UI', system-ui, sans-serif",
        }}
      >
        {/* Header band */}
        <div style={{
          background: "linear-gradient(135deg, #0f1f3d 0%, #1a3a6b 100%)",
          padding: "28px 28px 22px",
          color: "#fff",
          position: "relative",
        }}>
          <button
            onClick={onClose}
            style={{
              position: "absolute", top: 14, right: 14,
              background: "rgba(255,255,255,0.15)", border: "none",
              borderRadius: 8, width: 30, height: 30,
              cursor: "pointer", color: "#fff", fontSize: 16,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >✕</button>

          {/* Logo circle */}
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: "rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, marginBottom: 14,
          }}>🏛️</div>

          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.3px" }}>
            {DEV_INFO.company}
          </div>
          <div style={{ fontSize: 13, opacity: 0.7, marginTop: 3 }}>
            {DEV_INFO.tagline}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "22px 28px 28px" }}>

          {/* Person */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 16px",
            background: "#f0f4ff", borderRadius: 10,
            marginBottom: 18,
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: "50%",
              background: "linear-gradient(135deg, #1a73e8, #0d47a1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 18, fontWeight: 700, flexShrink: 0,
            }}>
              {DEV_INFO.person.charAt(0)}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f3d" }}>{DEV_INFO.person}</div>
              <div style={{ fontSize: 12, color: "#7f8c8d", marginTop: 1 }}>Developer &amp; Consultant</div>
            </div>
          </div>

          {/* Contact rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            {[
              { icon: "📞", label: "Phone",   value: DEV_INFO.phone,   href: `tel:${DEV_INFO.phone}` },
              { icon: "✉️",  label: "Email",   value: DEV_INFO.email,   href: `mailto:${DEV_INFO.email}` },
              { icon: "🌐", label: "Website", value: DEV_INFO.website, href: null },
              { icon: "📍", label: "Address", value: DEV_INFO.address, href: null },
            ].map(({ icon, label, value, href }) => (
              <div key={label} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "9px 14px",
                border: "1.5px solid #e8ecf4", borderRadius: 8,
                background: "#fafbff",
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#7f8c8d", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
                  {href ? (
                    <a href={href} target="_blank" rel="noreferrer"
                      style={{ fontSize: 13, color: "#1a73e8", fontWeight: 500, textDecoration: "none", wordBreak: "break-all" }}>
                      {value}
                    </a>
                  ) : (
                    <div style={{ fontSize: 13, color: "#2c3e50", fontWeight: 500 }}>{value}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Services */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#7f8c8d", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Services</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {DEV_INFO.services.map(s => (
                <span key={s} style={{
                  background: "#e8f0fe", color: "#1a73e8",
                  borderRadius: 20, padding: "4px 12px",
                  fontSize: 12, fontWeight: 600,
                }}>{s}</span>
              ))}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: "100%", padding: "11px",
              background: "linear-gradient(135deg, #0f1f3d, #1a3a6b)",
              color: "#fff", border: "none", borderRadius: 9,
              fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}
          >Close</button>
        </div>
      </div>
    </div>
  );
}
