// Accent presets (oklch-balanced) — graphite default, matching the design tokens.
export const ACCENTS = {
  grafito: { accent: "#1f2630", hover: "#2c3542", soft: "#eef0f3", ring: "rgba(31,38,48,0.18)" },
  azul:    { accent: "#2455c0", hover: "#1f49a6", soft: "#e9eef9", ring: "rgba(36,85,192,0.20)" },
  teal:    { accent: "#0e6f63", hover: "#0b5a50", soft: "#e3f1ee", ring: "rgba(14,111,99,0.20)" },
  indigo:  { accent: "#4940c0", hover: "#3d36a6", soft: "#ecebf9", ring: "rgba(73,64,192,0.20)" },
};

export function applyAccent(key) {
  const a = ACCENTS[key] || ACCENTS.grafito;
  const r = document.documentElement.style;
  r.setProperty("--accent", a.accent);
  r.setProperty("--accent-hover", a.hover);
  r.setProperty("--accent-soft", a.soft);
  r.setProperty("--accent-ring", a.ring);
}

// Best-effort platform detection for the default window chrome.
export function detectChrome() {
  const p = (navigator.platform || navigator.userAgent || "").toLowerCase();
  if (p.includes("win")) return "windows";
  return "macos";
}
