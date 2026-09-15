// ─── Mulyanka brand tokens ───────────────────────────────────────────────────
// Single source of truth for product identity: name, tagline, palette, fonts.
// Everything that paints app chrome should read from here instead of hard-coding
// hex values, so a palette tweak lands everywhere at once.

export const BRAND = {
  name:        "Mulyanka",
  tagline:     "मूल्यांकन अब डिजिटल।",
  taglineEn:   "Valuation, now digital.",
  legal:       "One Degree Consultant Pvt. Ltd.",
  pillars:     ["Property", "Land", "Building", "Bank", "Valuation"],
};

// ─── Palette ────────────────────────────────────────────────────────────────
// Deep forest green carries the identity, emerald is the working accent, gold
// is reserved for the wordmark and highlights. Tints below are derived.
export const C = {
  // Primary — deep forest
  forest:      "#064E3B",   // brand sheet
  forestDeep:  "#04382A",
  forestMid:   "#0A6B50",
  forestSoft:  "#10906C",

  // Secondary — emerald
  emerald:     "#10B981",
  emeraldDeep: "#0E9E6E",
  emeraldSoft: "#34D399",

  // Accent — gold (wordmark, highlights; never a warning state)
  gold:        "#D4AF37",   // brand sheet
  goldDeep:    "#B8942B",
  goldPale:    "#FAF3DF",

  // Washes / surfaces
  mint:        "#A7E3B1",   // brand sheet
  mintPale:    "#E8F5EC",
  mist:        "#F3F6F5",
  bg:          "#F3F6F5",
  surface:     "#FFFFFF",
  surfaceAlt:  "#EDF2EF",

  // Text
  text:        "#10362C",
  text2:       "#3D5A50",
  muted:       "#7A8F87",

  // Lines
  border:      "#D6DCE5",   // brand sheet — pale grey
  borderDark:  "#BCCCC2",

  // Status — no equivalents on the brand sheet, tuned to sit beside it
  success:     "#10B981",
  successPale: "#E8F5EC",
  danger:      "#D14343",
  dangerPale:  "#FDECEC",
  warn:        "#C9861F",
  warnPale:    "#FBF1DC",

  // Back-compat aliases for call sites that still ask for these names
  navy:        "#064E3B",
  green:       "#10B981",
  blue:        "#10B981",
  lime:        "#D4AF37",
};

// ─── Gradients ──────────────────────────────────────────────────────────────
export const GRAD = {
  navy:   "linear-gradient(135deg, #064E3B 0%, #0A6B50 100%)",
  green:  "linear-gradient(135deg, #10B981 0%, #0E9E6E 100%)",
  lime:   "linear-gradient(135deg, #D4AF37 0%, #B8942B 100%)",
  teal:   "linear-gradient(135deg, #1E9AAF 0%, #0F6B7A 100%)",
  purple: "linear-gradient(135deg, #5A7FB0 0%, #37567A 100%)",
  orange: "linear-gradient(135deg, #C9861F 0%, #A76D14 100%)",
  danger: "linear-gradient(135deg, #D14343 0%, #A83232 100%)",
  // The signature forest → emerald → gold sweep used on accent bars
  brand:  "linear-gradient(100deg, #064E3B 0%, #10B981 58%, #D4AF37 100%)",
};

// Tonal sets for KPI tiles / section icons: ink (text), ic (icon), wash (chip bg).
// These sit side by side in the same rows, so each stays visually distinct —
// a categorical set, not six shades of one hue.
export const TONE = {
  navy:  { ink: "#064E3B", ic: "#0A6B50", wash: "#E8F1EC" },
  blue:  { ink: "#37567A", ic: "#5A7FB0", wash: "#EDF1F7" },
  green: { ink: "#0E9E6E", ic: "#10B981", wash: "#E8F5EC" },
  lime:  { ink: "#8A6F1C", ic: "#D4AF37", wash: "#FAF3DF" },
  teal:  { ink: "#0F6B7A", ic: "#1E9AAF", wash: "#E4F4F7" },
  gold:  { ink: "#8A5E12", ic: "#C9861F", wash: "#FBF1DC" },
  amber: { ink: "#8A5E12", ic: "#C9861F", wash: "#FBF1DC" },
};

// ─── Typography ─────────────────────────────────────────────────────────────
// Poppins carries the Devanagari subset the tagline needs; system stack behind.
const STACK = "system-ui, -apple-system, 'Segoe UI', sans-serif";
export const FONT_UI      = `'Poppins', ${STACK}`;
export const FONT_DISPLAY = `'Poppins', ${STACK}`;
export const FONT_MONO    = "'IBM Plex Mono', ui-monospace, monospace";

// ─── Shadows ────────────────────────────────────────────────────────────────
export const SHADOW = {
  sm: "0 1px 3px rgba(6,78,59,0.07), 0 2px 8px rgba(6,78,59,0.05)",
  md: "0 4px 16px rgba(6,78,59,0.10), 0 1px 3px rgba(6,78,59,0.06)",
  lg: "0 12px 40px rgba(6,78,59,0.15), 0 4px 12px rgba(6,78,59,0.08)",
};
