// generate.cjs — orchestrates document generation from a template + data source.
const fs = require("fs");
const path = require("path");
const os = require("os");
const { fillTemplate } = require("./docx.cjs");
const { convertToPdf, isPdfAvailable } = require("./pdf.cjs");

function expandHome(p) {
  if (!p) return p;
  if (p === "~" || p.startsWith("~/") || p.startsWith("~\\")) return path.join(os.homedir(), p.slice(1));
  return p;
}

// Keep letters (incl. accents/ñ) and digits; collapse everything else to "_".
function sanitize(s) {
  return String(s == null ? "" : s)
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}

function patternToName(tokens, data, fallback) {
  let out = "";
  for (const tk of tokens || []) {
    if (tk.type === "var") out += sanitize(data[tk.value] || "");
    else out += String(tk.value || "");
  }
  out = out.replace(/^[-_]+|[-_]+$/g, "");
  return out || fallback;
}

// ---- automatic value formatting (currency / number / date) ----
function typeOf(template, v) {
  const meta = (template.meta || {})[v];
  if (meta && meta.type) return meta.type;
  if (v.includes("fecha")) return "date";
  if (["base", "total", "importe", "salario"].some((k) => v.includes(k))) return "currency";
  if (["iva", "horas", "duracion", "cantidad", "numero"].some((k) => v.includes(k))) return "number";
  return "text";
}

// Lenient es-ES / en-US number parse. Returns NaN if it doesn't look numeric.
function parseNum(s) {
  let t = String(s == null ? "" : s).trim().replace(/\s/g, "");
  if (!t || !/[0-9]/.test(t)) return NaN;
  if (t.includes(".") && t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (t.includes(",")) t = t.replace(",", ".");
  else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, "");
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : NaN;
}

// useGrouping:"always" so 4-digit amounts group too (4.200,00), matching
// common Spanish accounting style rather than CLDR's 5-digit threshold.
const fmtCurrency = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: "always" });
const fmtNumber = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 6 });

function formatValue(raw, type) {
  const s = String(raw == null ? "" : raw).trim();
  if (s === "") return s;
  if (type === "currency") { const n = parseNum(s); return Number.isNaN(n) ? s : fmtCurrency.format(n); }
  if (type === "number") { const n = parseNum(s); return Number.isNaN(n) ? s : fmtNumber.format(n); }
  if (type === "date") {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); // ISO from <input type=date>
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return s;
  }
  return s;
}

function formatData(data, template) {
  const out = {};
  for (const v of Object.keys(data)) out[v] = formatValue(data[v], typeOf(template, v));
  return out;
}

// Resolve a column index for a variable within a specific batch's columns.
// Prefers matching by stored column NAME (resilient to column reordering across
// files), falling back to the stored index.
function resolveColIndex(m, columns) {
  if (m.colName != null) {
    const i = columns.indexOf(m.colName);
    if (i >= 0) return i;
  }
  return m.col != null ? m.col : -1;
}

// Resolve the flat { var: value } map for one record in a given batch.
function resolveRow({ template, source, mapping, row, columns, values }) {
  const data = {};
  if (source === "excel") {
    for (const v of template.vars) {
      const m = (mapping || {})[v];
      if (!m) { data[v] = ""; continue; }
      if (m.mode === "fixed") { data[v] = m.value || ""; continue; }
      const ci = resolveColIndex(m, columns || []);
      data[v] = ci >= 0 && row[ci] != null ? row[ci] : "";
    }
  } else {
    for (const v of template.vars) data[v] = (values || {})[v] || "";
  }
  return data;
}

function uniqueName(base, ext, dir, used, overwrite) {
  let name = `${base}${ext}`;
  if (overwrite) return name;
  let i = 2;
  while (used.has(name.toLowerCase()) || fs.existsSync(path.join(dir, name))) {
    name = `${base}_${i}${ext}`;
    i++;
  }
  used.add(name.toLowerCase());
  return name;
}

// Build the list of batches to process.
// - excel: payload.batches = [{ file, columns, rows }]; manualRows are appended
//   to the single batch when there is exactly one file.
// - manual: one synthetic batch with a single record.
function buildBatches(payload) {
  const { source, batches = [], manualRows = [], values } = payload;
  if (source !== "excel") {
    return [{ label: null, columns: [], records: [null], values }];
  }
  const multi = batches.length > 1;
  return batches.map((b, i) => {
    const records = [...b.rows];
    if (!multi && i === 0) records.push(...manualRows); // manual rows only in single-file mode
    return {
      label: b.file ? b.file.replace(/\.(xlsx|xlsm)$/i, "") : null,
      columns: b.columns || [],
      records,
      subdir: multi ? sanitize(b.file ? b.file.replace(/\.(xlsx|xlsm)$/i, "") : `lote_${i + 1}`) : null,
    };
  });
}

// onProgress({ done, total, file }) is invoked after each document.
// opts.shouldCancel() — if it returns true between records, generation stops early.
async function generateDocuments(payload, templateBuffer, onProgress, opts = {}) {
  const { template, source, mapping, options } = payload;
  const shouldCancel = opts.shouldCancel || (() => false);
  const rootDir = expandHome(options.folder);
  fs.mkdirSync(rootDir, { recursive: true });

  const wantPdf = !!options.pdf && isPdfAvailable();
  const autoFormat = options.autoFormat !== false; // default on
  const batches = buildBatches(payload);
  const total = batches.reduce((n, b) => n + b.records.length, 0);

  const files = [];
  const failures = [];
  let done = 0;
  let cancelled = false;

  outer:
  for (const batch of batches) {
    const outDir = batch.subdir ? path.join(rootDir, batch.subdir) : rootDir;
    fs.mkdirSync(outDir, { recursive: true });
    const used = new Set();

    for (let i = 0; i < batch.records.length; i++) {
      if (shouldCancel()) { cancelled = true; break outer; }
      done++;
      let data = resolveRow({ template, source, mapping, row: batch.records[i] || [], columns: batch.columns, values: payload.values });
      if (autoFormat) data = formatData(data, template);
      const fallback = `documento_${done}`;
      const base = patternToName(options.tokens, data, fallback);

      // A bad template/data combination must not abort the whole batch: record
      // the failure, keep going, and report it at the end.
      try {
        const docxName = uniqueName(base, ".docx", outDir, used, options.overwrite);
        const docxPath = path.join(outDir, docxName);
        fs.writeFileSync(docxPath, fillTemplate(templateBuffer, data));
        const entry = { name: docxName, path: docxPath, pdf: null, batch: batch.label };

        if (wantPdf) {
          try {
            const pdfPath = await convertToPdf(docxPath, outDir);
            entry.pdf = { name: path.basename(pdfPath), path: pdfPath };
          } catch (err) {
            entry.pdfError = err.message;
          }
        }

        files.push(entry);
        if (onProgress) onProgress({ done, total, file: entry });
      } catch (err) {
        const fail = { index: done, batch: batch.label, base, error: err.message };
        failures.push(fail);
        if (onProgress) onProgress({ done, total, failed: fail });
      }
    }
  }

  return {
    outDir: rootDir,
    files,
    failures,
    total,
    batches: batches.length,
    cancelled,
    pdf: wantPdf,
    pdfUnavailable: !!options.pdf && !isPdfAvailable(),
  };
}

module.exports = { generateDocuments, expandHome, sanitize, patternToName, formatValue, parseNum };
