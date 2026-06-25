function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function toHex(r, g, b) {
  return "#" + [r, g, b]
    .map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0"))
    .join("");
}

function mixWhite(hex, t) {
  const [r, g, b] = hexToRgb(hex);
  return toHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t);
}

function mixBlack(hex, t) {
  const [r, g, b] = hexToRgb(hex);
  return toHex(r * (1 - t), g * (1 - t), b * (1 - t));
}

export const PRESET_COLORS = [
  { label: "Blue",     hex: "#2c5f9a" },
  { label: "Green",    hex: "#276749" },
  { label: "Maroon",   hex: "#7b2d3e" },
  { label: "Purple",   hex: "#5c3d8f" },
  { label: "Teal",     hex: "#1f7a78" },
  { label: "Charcoal", hex: "#3d4a5c" },
  { label: "Orange",   hex: "#b35a00" },
  { label: "Indigo",   hex: "#3730a3" },
];

// Legacy key → hex map for backward compatibility
const LEGACY_KEYS = {
  blue: "#2c5f9a", green: "#276749", maroon: "#7b2d3e",
  purple: "#5c3d8f", teal: "#1f7a78", charcoal: "#3d4a5c",
};

export function resolveThemeHex(colorOrKey) {
  if (!colorOrKey) return "#2c5f9a";
  if (LEGACY_KEYS[colorOrKey]) return LEGACY_KEYS[colorOrKey];
  if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(colorOrKey)) return colorOrKey;
  return "#2c5f9a";
}

export function buildTheme(colorOrKey) {
  const primary = resolveThemeHex(colorOrKey);
  return {
    primary,
    dark:    mixBlack(primary, 0.22),
    medium:  mixWhite(primary, 0.38),
    lighter: mixWhite(primary, 0.65),
    light:   mixWhite(primary, 0.84),
    border:  mixWhite(primary, 0.52),
    row:     mixWhite(primary, 0.93),
    info:    mixWhite(primary, 0.88),
    total:   mixWhite(primary, 0.12),
  };
}
