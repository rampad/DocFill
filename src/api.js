// api.js — unified access to the desktop backend.
// In Electron, delegates to window.docfill (preload bridge).
// In a plain browser (pnpm dev:web), uses a simulated fallback backed by the
// sample data, so the UI remains explorable without the native engine.
import { TEMPLATES, RECENT, EXCEL } from "./data.js";

const n = typeof window !== "undefined" ? window.docfill : null;
export const isNative = !!n;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- sample/simulated template used by the web "import" flow ----
const SAMPLE_IMPORT = {
  id: "sample-nomina",
  name: "Nómina mensual",
  file: "nomina_mensual.docx",
  vars: ["empleado", "dni", "mes", "salario_bruto", "irpf", "ss", "salario_neto"],
  meta: {},
  date: "Hoy",
  body: [
    { t: "h", text: "NÓMINA" },
    { t: "p", parts: ["Empleado/a: ", { v: "empleado" }, "  ·  DNI: ", { v: "dni" }] },
    { t: "p", parts: ["Mes: ", { v: "mes" }] },
    { t: "p", parts: ["Salario bruto: ", { v: "salario_bruto" }, " €"] },
    { t: "p", parts: ["IRPF: ", { v: "irpf" }, "  ·  S.S.: ", { v: "ss" }] },
    { t: "p", parts: ["Salario neto: ", { v: "salario_neto" }, " €"] },
  ],
};

const webFallback = {
  platform: typeof navigator !== "undefined" && /win/i.test(navigator.platform) ? "win32" : "darwin",

  // window controls (no-ops in browser)
  minimize() {}, maximizeToggle() {}, close() {}, isMaximized() { return false; },
  onMaximizeChange() { return () => {}; },

  async getState() {
    return {
      templates: TEMPLATES,
      settings: {
        folder: "~/Documentos/DocFill", pdf: true, openAfter: true, overwrite: false,
        tokens: [{ type: "var", value: "cliente" }, { type: "lit", value: "_" }, { type: "var", value: "fecha" }],
      },
      appearance: { accent: "grafito", density: "comfy" },
      history: RECENT,
      pdfAvailable: false,
      platform: this.platform,
    };
  },
  async saveSettings(s) { return s; },
  async saveAppearance(a) { return a; },

  async pickTemplate() {
    await delay(500);
    return { canceled: false, template: { ...SAMPLE_IMPORT, id: "u" + Date.now() } };
  },
  async replaceDocx() { await delay(300); return { canceled: true }; },
  async importTemplatePath() { return { canceled: false, error: "Arrastrar archivos solo está disponible en la app de escritorio." }; },
  async readExcelPaths() { return { canceled: false, error: "Arrastrar archivos solo está disponible en la app de escritorio." }; },
  async updateTemplate(t) { return t; },
  async deleteTemplate() { return null; },

  async pickExcel() {
    await delay(400);
    return { canceled: false, files: [{ file: EXCEL.file, columns: EXCEL.columns, rows: EXCEL.rows, total: EXCEL.total }] };
  },
  async pickFolder() { return { canceled: false, path: "~/Documentos/DocFill" }; },

  // fixed-value profiles (in-memory for the web fallback)
  _profiles: [],
  async listProfiles() { return this._profiles; },
  async saveProfile(p) {
    const i = this._profiles.findIndex((x) => x.id === p.id);
    if (i >= 0) this._profiles[i] = p; else this._profiles.unshift(p);
    return this._profiles;
  },
  async deleteProfile(id) { this._profiles = this._profiles.filter((p) => p.id !== id); return this._profiles; },

  async zipResults() { return { error: "Exportar .zip solo está disponible en la app de escritorio." }; },
  async mergePdfs() { return { error: "Combinar PDFs solo está disponible en la app de escritorio." }; },

  _cancel: false,
  async cancelGenerate() { this._cancel = true; },
  async _generate(payload, onProgress) {
    this._cancel = false;
    const total = payload.source === "excel"
      ? (payload.batches || []).reduce((n, b) => n + b.rows.length, 0) + ((payload.batches || []).length <= 1 ? (payload.manualRows?.length || 0) : 0)
      : 1;
    const files = [];
    let cancelled = false;
    for (let i = 0; i < total; i++) {
      if (this._cancel) { cancelled = true; break; }
      await delay(Math.min(120, 40 + total));
      const base = `documento_${i + 1}`;
      const file = { name: base + ".docx", path: "(simulado)", pdf: payload.options.pdf ? { name: base + ".pdf" } : null };
      files.push(file);
      onProgress && onProgress({ done: i + 1, total, file });
    }
    return { outDir: payload.options.folder, files, failures: [], total, cancelled, batches: (payload.batches || []).length || 1, pdf: !!payload.options.pdf, pdfUnavailable: !!payload.options.pdf };
  },

  async openPath() {}, async showItem() {},
};

// Unified generate(payload, onProgress) for both backends.
export function generate(payload, onProgress) {
  if (isNative) {
    const off = n.onGenerateProgress(onProgress || (() => {}));
    return Promise.resolve(n.generate(payload)).finally(() => off && off());
  }
  return webFallback._generate(payload, onProgress);
}

export const api = isNative
  ? {
      platform: n.platform,
      minimize: n.minimize, maximizeToggle: n.maximizeToggle, close: n.close,
      isMaximized: n.isMaximized, onMaximizeChange: n.onMaximizeChange,
      getState: n.getState, saveSettings: n.saveSettings, saveAppearance: n.saveAppearance,
      pickTemplate: n.pickTemplate, replaceDocx: n.replaceDocx,
      importTemplatePath: n.importTemplatePath, readExcelPaths: n.readExcelPaths,
      updateTemplate: n.updateTemplate, deleteTemplate: n.deleteTemplate,
      pickExcel: n.pickExcel, pickFolder: n.pickFolder,
      listProfiles: n.listProfiles, saveProfile: n.saveProfile, deleteProfile: n.deleteProfile,
      zipResults: n.zipResults, mergePdfs: n.mergePdfs,
      cancelGenerate: n.cancelGenerate,
      openPath: n.openPath, showItem: n.showItem,
      generate,
    }
  : { ...webFallback, generate };

export const platform = api.platform;

// Extract absolute file paths from a drop event (Electron augments File with
// .path). Returns [] in a plain browser. `exts` like [".docx"] filters by suffix.
export function droppedPaths(e, exts) {
  const files = e.dataTransfer && e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
  const out = [];
  for (const f of files) {
    const p = f.path;
    if (!p) continue;
    if (!exts || exts.some((x) => p.toLowerCase().endsWith(x))) out.push(p);
  }
  return out;
}
