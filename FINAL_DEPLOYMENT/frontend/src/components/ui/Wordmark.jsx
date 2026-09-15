import React from "react";
import { BRAND, C, FONT_DISPLAY } from "../../constants/brand";

/* ── Monogram tile ──────────────────────────────────────────────
   Placeholder for the "M" building mark — a Poppins glyph on the
   brand gradient. Swap the inner <span> for the real SVG when the
   logo asset lands; the sizing/shadow contract stays the same. */
export function Monogram({ size = 36, radius, style = {} }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, flex: `0 0 ${size}px`,
        borderRadius: radius ?? Math.round(size * 0.28),
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: `linear-gradient(135deg, ${C.forest} 0%, ${C.forestMid} 100%)`,
        boxShadow: `0 ${Math.round(size * 0.14)}px ${Math.round(size * 0.5)}px rgba(6, 78, 59,0.28), inset 0 1px 0 rgba(255,255,255,0.28)`,
        ...style,
      }}
    >
      <span style={{
        fontFamily: FONT_DISPLAY, fontWeight: 800, color: C.mint,
        fontSize: Math.round(size * 0.52), lineHeight: 1, letterSpacing: "-0.04em",
      }}>M</span>
    </span>
  );
}

/* ── Full wordmark: monogram + name (+ optional Devanagari tagline) ──
   `tone` picks the text colour: "dark" on light surfaces, "light" on navy. */
export default function Wordmark({
  size = 36,
  tagline = false,
  tone = "dark",
  nameSize,
  style = {},
}) {
  const ink    = tone === "light" ? C.gold : C.forest;
  const subInk = tone === "light" ? "rgba(255,255,255,0.66)" : C.forestMid;
  const fs     = nameSize ?? Math.round(size * 0.56);

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.3), ...style }}>
      <Monogram size={size} />
      <span style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 1, minWidth: 0 }}>
        <span style={{
          fontFamily: FONT_DISPLAY, fontWeight: 700, color: ink,
          fontSize: fs, lineHeight: 1.05, letterSpacing: "-0.02em", whiteSpace: "nowrap",
        }}>
          {BRAND.name}
        </span>
        {tagline && (
          <span style={{
            fontFamily: FONT_DISPLAY, fontWeight: 400, color: subInk,
            fontSize: Math.max(9, Math.round(fs * 0.5)), lineHeight: 1.3, whiteSpace: "nowrap",
          }}>
            {BRAND.tagline}
          </span>
        )}
      </span>
    </span>
  );
}
