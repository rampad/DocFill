import { useState, useEffect, useRef, useMemo, Fragment } from "react";
import Icon from "../components/Icon.jsx";
import Toolbar from "../components/Toolbar.jsx";
import TemplatePreview from "../components/TemplatePreview.jsx";
import Switch from "../components/Switch.jsx";
import FilenameBuilder from "../components/FilenameBuilder.jsx";
import { api, droppedPaths } from "../api.js";
import { VAR_LABELS } from "../data.js";
import { useT } from "../i18n.js";

const STEP_KEYS = ["gen.step.0", "gen.step.1", "gen.step.2", "gen.step.3", "gen.step.4"];

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

function autoMap(vars, columns) {
  const m = {};
  vars.forEach((v) => {
    const nv = norm(v);
    let col = columns.findIndex((c) => norm(c) === nv);
    if (col < 0) col = columns.findIndex((c) => norm(c).includes(nv) || nv.includes(norm(c)));
    m[v] = { mode: "col", col: col >= 0 ? col : null, colName: col >= 0 ? columns[col] : null, value: "" };
  });
  return m;
}

// Initial mapping for a freshly loaded file: reuse the template's remembered
// mapping where it still resolves against these columns, else auto-map.
function buildInitialMapping(template, columns) {
  const auto = autoMap(template.vars, columns);
  const saved = template.mapping;
  if (!saved) return auto;
  const m = {};
  template.vars.forEach((v) => {
    const s = saved[v];
    if (!s) { m[v] = auto[v]; return; }
    if (s.mode === "fixed") { m[v] = { mode: "fixed", col: null, colName: null, value: s.value || "" }; return; }
    const ci = s.colName != null ? columns.indexOf(s.colName) : -1;
    m[v] = ci >= 0 ? { mode: "col", col: ci, colName: s.colName, value: "" } : auto[v];
  });
  return m;
}

// Parse a row expression like "1-5, 8, 12-20" (1-based) into a Set of 0-based
// indices, clamped to [0, total).
function parseRowExpr(expr, total) {
  const set = new Set();
  String(expr || "").split(/[,\s]+/).forEach((tok) => {
    const m = tok.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) return;
    let a = parseInt(m[1], 10), b = m[2] ? parseInt(m[2], 10) : a;
    if (a > b) [a, b] = [b, a];
    for (let n = a; n <= b; n++) if (n >= 1 && n <= total) set.add(n - 1);
  });
  return set;
}

// Collapse a sorted list of 0-based indices into a 1-based expression "1-5, 8".
function compressSel(sorted) {
  const out = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    const a = sorted[i] + 1, b = sorted[j] + 1;
    out.push(a === b ? `${a}` : `${a}-${b}`);
    i = j + 1;
  }
  return out.join(", ");
}

function typeOfVar(template, v) {
  const meta = template.meta || {};
  if (meta[v] && meta[v].type) return meta[v].type;
  if (v.includes("fecha")) return "date";
  if (["base", "total", "importe", "salario"].some((k) => v.includes(k))) return "currency";
  if (["iva", "horas", "duracion", "cantidad", "numero"].some((k) => v.includes(k))) return "number";
  return "text";
}
const labelOfVar = (template, v) => (template.meta && template.meta[v] && template.meta[v].label) || VAR_LABELS[v] || v;

function Stepper({ current }) {
  const { t } = useT();
  return (
    <div className="stepper">
      {STEP_KEYS.map((s, i) => (
        <Fragment key={s}>
          <div className={"step" + (i === current ? " active" : "") + (i < current ? " done" : "")}>
            <div className="step-num">{i < current ? <Icon name="check" /> : i + 1}</div>
            <div className="step-label">{t(s)}</div>
          </div>
          {i < STEP_KEYS.length - 1 && <div className={"step-line" + (i < current ? " done" : "")} />}
        </Fragment>
      ))}
    </div>
  );
}

// ---------- Step 1: pick template ----------
function PickTemplate({ templates, value, onPick, onManage }) {
  const { t } = useT();
  if (templates.length === 0) {
    return (
      <div className="fade-in">
        <h3 className="wiz-h">{t("gen.pick.h")}</h3>
        <div className="dropzone" onClick={onManage}>
          <div className="dz-ic"><Icon name="docs" /></div>
          <div className="dz-title">{t("gen.pick.none.title")}</div>
          <div className="dz-sub">{t("gen.pick.none.sub")}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="fade-in">
      <h3 className="wiz-h">{t("gen.pick.h")}</h3>
      <p className="wiz-sub">{t("gen.pick.sub")}</p>
      <div className="choice-grid">
        {templates.map((tpl) => (
          <button key={tpl.id} className={"choice" + (value === tpl.id ? " sel" : "")} onClick={() => onPick(tpl.id)}>
            <div className="ck">{value === tpl.id && <Icon name="check" />}</div>
            <div className="row-ic doc"><Icon name="doc" /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{tpl.name}</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 3, display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 11.5 }}>{tpl.file}</span>
                <span className="dot-sep" />
                <span className="badge var">{t("gen.varsCount", { n: tpl.vars.length })}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Step 2: choose source ----------
function PickSource({ value, onPick }) {
  const { t } = useT();
  const opts = [
    { id: "combine", icon: "excel", title: t("gen.source.combine.title"), desc: t("gen.source.combine.desc"), tag: t("gen.source.combine.tag"), color: "excel" },
    { id: "manual", icon: "form", title: t("gen.source.manual.title"), desc: t("gen.source.manual.desc"), tag: t("gen.source.manual.tag"), color: "" },
  ];
  return (
    <div className="fade-in">
      <h3 className="wiz-h">{t("gen.source.h")}</h3>
      <p className="wiz-sub">{t("gen.source.sub")}</p>
      <div className="choice-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {opts.map((o) => (
          <button key={o.id} className={"choice source" + (value === o.id ? " sel" : "")} onClick={() => onPick(o.id)} style={{ flexDirection: "column", alignItems: "flex-start", gap: 16 }}>
            <div style={{ display: "flex", width: "100%", alignItems: "flex-start" }}>
              <div className={"src-ic " + o.color}><Icon name={o.icon} /></div>
              <div className="ck" style={{ marginLeft: "auto" }}>{value === o.id && <Icon name="check" />}</div>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 9 }}>
                {o.title} <span className="badge">{o.tag}</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 6, lineHeight: 1.5 }}>{o.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Step 3a: Excel loader (multi-file) + mapping + manual rows ----------
function ExcelStep({ template, files, onAddFiles, onRemoveFile, onClear, mapping, setMapping, manualRows, setManualRows, selectedRows, setSelectedRows }) {
  const { t } = useT();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [over, setOver] = useState(false);

  const load = async () => {
    setLoading(true); setErr("");
    const r = await api.pickExcel();
    setLoading(false);
    if (r.canceled) return;
    if (r.error) { setErr(r.error); return; }
    onAddFiles(r.files || []);
  };

  const onDrop = async (e) => {
    e.preventDefault(); setOver(false);
    const paths = droppedPaths(e, [".xlsx", ".xlsm"]);
    if (!paths.length) return;
    setLoading(true); setErr("");
    const r = await api.readExcelPaths(paths);
    setLoading(false);
    if (r.canceled) return;
    if (r.error) { setErr(r.error); return; }
    onAddFiles(r.files || []);
  };

  if (files.length === 0) {
    return (
      <div className="fade-in">
        <h3 className="wiz-h">{t("gen.excel.h")}</h3>
        <p className="wiz-sub">{t("gen.excel.subA")}<strong>{t("gen.excel.subStrong")}</strong>{t("gen.excel.subB")}</p>
        {err && (
          <div className="fixed-note" style={{ marginBottom: 16, background: "var(--danger-soft)", color: "var(--danger)" }}>
            <Icon name="alert" style={{ width: 14, height: 14 }} /> {err}
          </div>
        )}
        <div className={"dropzone" + (over ? " over" : "")} onClick={loading ? undefined : load}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}>
          <div className="dz-ic">{loading ? <span className="spinner" /> : <Icon name="excel" />}</div>
          <div className="dz-title">{loading ? t("gen.excel.reading") : over ? t("gen.dropHere") : t("gen.excel.selectOrDrag")}</div>
          <div className="dz-sub">{t("gen.multiHint")}</div>
        </div>
      </div>
    );
  }

  const cols = files[0].columns;
  const refSig = cols.join("¦");
  const multi = files.length > 1;
  const isResolved = (m) => m && (m.mode === "col" ? (m.col !== null && m.col !== undefined) : m.value.trim() !== "");
  const usedCount = template.vars.filter((v) => isResolved(mapping[v])).length;
  const fixedCount = template.vars.filter((v) => mapping[v] && mapping[v].mode === "fixed").length;
  // Row selection (single-file only): null = all rows; otherwise a Set of 0-based indices.
  const fileTotal = files[0].total;
  const selCount = multi ? null : (selectedRows ? selectedRows.size : fileTotal);
  const totalRows = multi ? files.reduce((n, f) => n + f.total, 0) : (selCount + manualRows.length);
  const MAX_VISIBLE = 100;
  const preview = files[0].rows.slice(0, multi ? 8 : MAX_VISIBLE);

  // Local text for the range/list field so typing isn't overwritten by the
  // derived selection. Kept in sync when using the buttons/checkboxes. The
  // component is remounted (key) when the file set changes, resetting this.
  const [exprText, setExprText] = useState("");
  const isSel = (i) => (selectedRows ? selectedRows.has(i) : true);
  const toggleRow = (i) => {
    const base = selectedRows ? new Set(selectedRows) : new Set(files[0].rows.map((_, k) => k));
    if (base.has(i)) base.delete(i); else base.add(i);
    const all = base.size === fileTotal;
    setSelectedRows(all ? null : base);
    setExprText(all ? "" : compressSel([...base].sort((a, b) => a - b)));
  };
  const selectAll = () => { setSelectedRows(null); setExprText(""); };
  const selectNone = () => { setSelectedRows(new Set()); setExprText(""); };
  const onExprChange = (v) => {
    setExprText(v);
    const s = parseRowExpr(v, fileTotal);
    setSelectedRows(s.size === fileTotal ? null : s);
  };

  const setMode = (v, mode) => setMapping({ ...mapping, [v]: { ...(mapping[v] || { col: null, value: "" }), mode } });
  const setCol = (v, col) => setMapping({ ...mapping, [v]: { ...(mapping[v] || { value: "" }), mode: "col", col, colName: col != null ? cols[col] : null } });
  const setVal = (v, value) => setMapping({ ...mapping, [v]: { ...(mapping[v] || { col: null }), mode: "fixed", value } });
  const addRow = () => setManualRows([...manualRows, cols.map(() => "")]);
  const updateCell = (ri, ci, val) => setManualRows(manualRows.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? val : c)) : r)));
  const delRow = (ri) => setManualRows(manualRows.filter((_, i) => i !== ri));

  return (
    <div className="fade-in">
      <h3 className="wiz-h">{t("gen.map.h")}</h3>
      <p className="wiz-sub">
        <Icon name="excel" style={{ width: 15, height: 15, color: "var(--excel)", verticalAlign: "-3px", marginRight: 6 }} />
        {t("gen.excel.summary", { files: files.length, rows: totalRows, used: usedCount, total: template.vars.length })}
      </p>

      {/* loaded files list */}
      <div className="map-card" style={{ marginBottom: 18, padding: "var(--s3) var(--s4)" }}>
        {files.map((f) => {
          const mismatch = f.columns.join("¦") !== refSig;
          return (
            <div key={f.file} className="row" style={{ marginBottom: 6, border: "none", padding: "8px 4px" }}>
              <div className="row-ic" style={{ background: "var(--excel-soft)", color: "var(--excel)", width: 34, height: 34, flex: "0 0 34px" }}><Icon name="excel" style={{ width: 17, height: 17 }} /></div>
              <div className="row-main">
                <div className="row-title" style={{ fontSize: 13.5 }}>{f.file}</div>
                <div className="row-meta">
                  <span>{t("gen.excel.rowsCount", { n: f.total })}</span>
                  {mismatch && <><span className="dot-sep" /><span style={{ color: "var(--warn)", display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="alert" style={{ width: 12, height: 12 }} /> {t("gen.excel.mismatch")}</span></>}
                </div>
              </div>
              <button className="icon-btn" title={t("common.remove")} onClick={() => onRemoveFile(f.file)}><Icon name="x" /></button>
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={loading ? undefined : load} disabled={loading}>
            {loading ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Icon name="plus" />} {t("gen.addAnother")}
          </button>
          <button className="btn btn-subtle btn-sm" onClick={onClear}>{t("common.removeAll")}</button>
        </div>
      </div>
      {multi && (
        <p className="wiz-sub" style={{ marginTop: -8, marginBottom: 16 }}>
          {t("gen.excel.multiNote.a")}<strong>{files[0].file}</strong>{t("gen.excel.multiNote.b")}
        </p>
      )}

      <div className="map-card">
        <div className="map-head map-head-2">
          <span>{t("gen.col.templateVar")}</span>
          <span></span>
          <span>{t("gen.col.howFill")}</span>
        </div>
        {template.vars.map((v) => {
          const m = mapping[v] || { mode: "col", col: null, value: "" };
          const ok = isResolved(m);
          return (
            <div className="map-row map-row-2" key={v}>
              <div className="map-var"><span className="vchip">{"{{" + v + "}}"}</span></div>
              <div className="map-arrow"><Icon name="arrowR" /></div>
              <div className="map-control">
                <div className="mode-seg">
                  <button className={m.mode === "col" ? "on" : ""} onClick={() => setMode(v, "col")}>
                    <Icon name="excel" style={{ width: 13, height: 13 }} /> {t("gen.col.column")}
                  </button>
                  <button className={m.mode === "fixed" ? "on" : ""} onClick={() => setMode(v, "fixed")}>
                    <Icon name="edit" style={{ width: 12, height: 12 }} /> {t("gen.col.fixed")}
                  </button>
                </div>
                <div className="map-input-row">
                  {m.mode === "col" ? (
                    <select className="select" value={m.col ?? ""} onChange={(e) => setCol(v, e.target.value === "" ? null : Number(e.target.value))}>
                      <option value="">{t("gen.chooseColumn")}</option>
                      {cols.map((c, ci) => <option key={ci} value={ci}>{c}</option>)}
                    </select>
                  ) : (
                    <input className="input" placeholder={t("gen.fixedPlaceholderAll")} value={m.value} onChange={(e) => setVal(v, e.target.value)} />
                  )}
                  <span className={"map-status " + (ok ? "ok" : "miss")} title={ok ? t("gen.assignedOk") : t("gen.assignedMiss")}>
                    <Icon name={ok ? "checkCircle" : "alert"} style={{ width: 16, height: 16 }} />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {fixedCount > 0 && (
        <div className="fixed-note">
          <Icon name="edit" style={{ width: 14, height: 14 }} />
          {t("gen.fixedNote", { n: fixedCount, total: totalRows })}
        </div>
      )}

      <ProfilesBar
        getCurrent={() => {
          const o = {};
          template.vars.forEach((v) => { const m = mapping[v]; if (m && m.mode === "fixed" && String(m.value || "").trim() !== "") o[v] = m.value; });
          return o;
        }}
        onApply={(vals) => {
          const next = { ...mapping };
          Object.entries(vals).forEach(([v, value]) => { if (template.vars.includes(v)) next[v] = { ...(next[v] || { col: null }), mode: "fixed", value: String(value) }; });
          setMapping(next);
        }}
      />

      <div className="sec-head" style={{ marginTop: 26 }}>
        <Icon name="table" style={{ width: 16, height: 16, color: "var(--ink-3)" }} />
        <h2>{multi ? t("gen.previewOf", { file: files[0].file }) : t("gen.rowsToGen")}</h2>
        <div className="spacer" />
        {!multi && <button className="btn btn-ghost btn-sm" onClick={addRow}><Icon name="plus" /> {t("gen.addManualRow")}</button>}
      </div>

      {!multi && (
        <div className="row-select-bar">
          <span className="rsb-count">
            {t("gen.rowsSelected", { sel: selCount, total: fileTotal })}
          </span>
          <div className="spacer" />
          <button className="btn btn-subtle btn-sm" onClick={selectAll}>{t("gen.all")}</button>
          <button className="btn btn-subtle btn-sm" onClick={selectNone}>{t("gen.none")}</button>
          <div className="search-box" style={{ minWidth: 200 }} title="1-5, 8, 12-20">
            <Icon name="table" />
            <input
              placeholder={t("gen.rangePlaceholder")}
              value={exprText}
              onChange={(e) => onExprChange(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              {!multi && <th style={{ width: 34, textAlign: "center" }}>
                <input type="checkbox" checked={selCount === fileTotal && fileTotal > 0} onChange={(e) => (e.target.checked ? selectAll() : selectNone())} title={t("gen.selectAllTitle")} />
              </th>}
              <th style={{ width: 34 }}></th>
              {cols.map((c, i) => (
                <th key={i}><div className="excel-col-head"><Icon name="excel" className="xl" /> {c}</div></th>
              ))}
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {preview.map((r, ri) => (
              <tr key={"x" + ri} className={!multi && !isSel(ri) ? "row-unsel" : ""}>
                {!multi && <td style={{ textAlign: "center" }}>
                  <input type="checkbox" checked={isSel(ri)} onChange={() => toggleRow(ri)} />
                </td>}
                <td className="rownum">{ri + 1}</td>
                {cols.map((_c, ci) => <td key={ci}>{r[ci]}</td>)}
                <td><span className="origin-tag excel"><Icon name="excel" style={{ width: 11, height: 11 }} /> {t("gen.tag.excel")}</span></td>
              </tr>
            ))}
            {!multi && manualRows.map((r, ri) => (
              <tr key={"m" + ri} className="manual-tr">
                <td style={{ textAlign: "center", color: "var(--ink-4)" }}><Icon name="check" style={{ width: 13, height: 13 }} /></td>
                <td className="rownum">{files[0].total + ri + 1}</td>
                {cols.map((_c, ci) => (
                  <td key={ci} className="cell-edit">
                    <input className="cell-input" value={r[ci] || ""} placeholder="—" onChange={(e) => updateCell(ri, ci, e.target.value)} />
                  </td>
                ))}
                <td><button className="icon-btn" title={t("gen.removeRow")} onClick={() => delRow(ri)}><Icon name="trash" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="muted" style={{ fontSize: 12.5, marginTop: 10, display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
        <span>{t("gen.showing", { shown: preview.length, total: files[0].total, file: files[0].file, multi })}</span>
        {!multi && files[0].total > MAX_VISIBLE && <><span className="dot-sep" /><span>{t("gen.beyondRow", { max: MAX_VISIBLE })}</span></>}
        {!multi && manualRows.length > 0 && <><span className="dot-sep" /><span style={{ color: "var(--accent)", fontWeight: 600 }}>{t("gen.manualRowsExtra", { n: manualRows.length })}</span></>}
      </div>
    </div>
  );
}

// ---------- Step 3b: Manual form ----------
function ManualForm({ template, values, setValues, errors }) {
  const { t } = useT();
  const [flash, setFlash] = useState(null);
  const update = (v, val) => {
    setValues({ ...values, [v]: val });
    setFlash(v);
    setTimeout(() => setFlash(null), 500);
  };
  return (
    <div className="fade-in">
      <h3 className="wiz-h">{t("gen.manual.h")}</h3>
      <p className="wiz-sub">{t("gen.manual.sub", { name: template.name })}</p>
      <ProfilesBar
        getCurrent={() => {
          const o = {};
          template.vars.forEach((v) => { const val = String(values[v] || "").trim(); if (val !== "") o[v] = values[v]; });
          return o;
        }}
        onApply={(vals) => {
          const next = { ...values };
          Object.entries(vals).forEach(([v, value]) => { if (template.vars.includes(v)) next[v] = String(value); });
          setValues(next);
        }}
      />
      <div className="manual-split">
        <div className="manual-form">
          {template.vars.map((v) => {
            const type = typeOfVar(template, v);
            const isDate = type === "date";
            const isNum = type === "number" || type === "currency";
            const label = labelOfVar(template, v);
            return (
              <div className="field" key={v}>
                <label>{label}<span className="fvar">{"{{" + v + "}}"}</span></label>
                <div className={"input-wrap" + (type === "currency" ? " has-suffix" : "")}>
                  <input
                    className={"input" + (errors[v] ? " err" : "")}
                    type={isDate ? "date" : "text"}
                    inputMode={isNum ? "decimal" : undefined}
                    placeholder={isDate ? "" : t("gen.manual.writePh", { label: label.toLowerCase() })}
                    value={values[v] || ""}
                    onChange={(e) => update(v, e.target.value)}
                  />
                  {type === "currency" && <span className="input-suffix">€</span>}
                </div>
                {errors[v] && <div className="hint"><Icon name="alert" /> {errors[v]}</div>}
              </div>
            );
          })}
        </div>
        <div className="manual-preview">
          <div className="preview-label"><Icon name="eye" style={{ width: 15, height: 15 }} /> {t("gen.manual.previewLive")}</div>
          <div className="preview-pane">
            <TemplatePreview template={template} values={values} flashKey={flash} />
          </div>
        </div>
      </div>
    </div>
  );
}

// resolve one record's data for the filename sample
function resolveSample({ template, source, files, mapping, values }) {
  const data = {};
  if (source === "excel" && files.length && files[0].rows.length) {
    const cols = files[0].columns;
    const row = files[0].rows[0];
    template.vars.forEach((v) => {
      const m = mapping[v];
      if (!m) { data[v] = ""; return; }
      if (m.mode === "fixed") { data[v] = m.value; return; }
      const ci = m.colName != null && cols.indexOf(m.colName) >= 0 ? cols.indexOf(m.colName) : m.col;
      data[v] = ci != null && row[ci] != null ? row[ci] : "";
    });
  } else {
    template.vars.forEach((v) => { data[v] = values[v] || ""; });
  }
  return data;
}

function sampleFilename(tokens, data) {
  let out = "";
  for (const tk of tokens || []) {
    if (tk.type === "var") out += String(data[tk.value] || "valor").replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");
    else out += String(tk.value || "");
  }
  return (out.replace(/^[-_]+|[-_]+$/g, "") || "documento") + ".docx";
}

// Resolve { var: value } for one Excel record (mirrors the engine logic).
function resolveRecord(template, mapping, columns, row) {
  const data = {};
  template.vars.forEach((v) => {
    const m = mapping[v];
    if (!m) { data[v] = ""; return; }
    if (m.mode === "fixed") { data[v] = m.value || ""; return; }
    const ci = m.colName != null && columns.indexOf(m.colName) >= 0 ? columns.indexOf(m.colName) : m.col;
    data[v] = ci != null && row[ci] != null ? row[ci] : "";
  });
  return data;
}

// Group the effective records the way they'll be written (per output folder),
// so duplicate-name detection matches what the engine does.
function effectiveGroups({ source, files, selectedRows, manualRows }) {
  if (source !== "excel") return [[null]];
  const single = files.length === 1;
  return files.map((f) => {
    const rows = single && selectedRows ? f.rows.filter((_, i) => selectedRows.has(i)) : f.rows;
    const recs = rows.map((r) => ({ columns: f.columns, row: r }));
    if (single) manualRows.forEach((r) => recs.push({ columns: f.columns, row: r }));
    return recs;
  });
}

// Pre-flight: count empty required fields, bad numbers, and name collisions.
function computePreflight({ template, source, files, selectedRows, manualRows, mapping, values, tokens, overwrite }) {
  const groups = effectiveGroups({ source, files, selectedRows, manualRows });
  const empty = {}, badNum = {};
  let total = 0, maxDup = 0;

  groups.forEach((recs) => {
    const names = {};
    recs.forEach((rec) => {
      total++;
      const data = source === "excel" ? resolveRecord(template, mapping, rec.columns, rec.row || []) : values;
      template.vars.forEach((v) => {
        const val = String(data[v] == null ? "" : data[v]).trim();
        if (val === "") empty[v] = (empty[v] || 0) + 1;
        else {
          const ty = typeOfVar(template, v);
          if ((ty === "number" || ty === "currency") && isNaN(parseFloat(val.replace(",", ".")))) badNum[v] = (badNum[v] || 0) + 1;
        }
      });
      const nm = sampleFilename(tokens, data);
      names[nm] = (names[nm] || 0) + 1;
    });
    Object.values(names).forEach((c) => { if (c > maxDup) maxDup = c; });
  });

  const emptyList = Object.entries(empty).map(([v, c]) => ({ v, c }));
  const badList = Object.entries(badNum).map(([v, c]) => ({ v, c }));
  const dupCount = maxDup > 1 ? maxDup : 0;
  return { total, emptyList, badList, dupCount, overwrite, ok: emptyList.length === 0 && badList.length === 0 && (!dupCount || !overwrite) };
}

// ---- "Combinar varios Excel → 1 documento" ----
// Each variable resolves to a value taken from (file, column) at the first data
// row, or to a typed fixed value.
function autoCombineMap(vars, files) {
  const m = {};
  vars.forEach((v) => {
    const nv = norm(v);
    let found = null;
    for (let fi = 0; fi < files.length && !found; fi++) {
      const ci = files[fi].columns.findIndex((c) => norm(c) === nv);
      if (ci >= 0) found = { mode: "excel", fileIdx: fi, colName: files[fi].columns[ci], value: "" };
    }
    for (let fi = 0; fi < files.length && !found; fi++) {
      const ci = files[fi].columns.findIndex((c) => norm(c).includes(nv) || nv.includes(norm(c)));
      if (ci >= 0) found = { mode: "excel", fileIdx: fi, colName: files[fi].columns[ci], value: "" };
    }
    m[v] = found || { mode: "fixed", fileIdx: 0, colName: null, value: "" };
  });
  return m;
}

function combineCellValue(files, m) {
  if (!m || m.mode !== "excel") return m ? m.value || "" : "";
  const f = files[m.fileIdx];
  if (!f) return "";
  const ci = m.colName != null ? f.columns.indexOf(m.colName) : -1;
  return ci >= 0 && f.rows[0] ? (f.rows[0][ci] != null ? f.rows[0][ci] : "") : "";
}

function combineValues(template, files, combineMap) {
  const out = {};
  template.vars.forEach((v) => {
    const m = combineMap[v];
    out[v] = m && m.mode === "fixed" ? (m.value || "") : combineCellValue(files, m);
  });
  return out;
}

function CombineStep({ template, files, onAddFiles, onRemoveFile, onClear, combineMap, setCombineMap, primaryIdx, setPrimaryIdx, selectedRows, setSelectedRows }) {
  const { t } = useT();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [over, setOver] = useState(false);
  const [exprText, setExprText] = useState("");

  const addFrom = async (getter) => {
    setLoading(true); setErr("");
    const r = await getter();
    setLoading(false);
    if (r.canceled) return;
    if (r.error) { setErr(r.error); return; }
    onAddFiles(r.files || []);
  };
  const load = () => addFrom(() => api.pickExcel());
  const onDrop = (e) => {
    e.preventDefault(); setOver(false);
    const paths = droppedPaths(e, [".xlsx", ".xlsm"]);
    if (paths.length) addFrom(() => api.readExcelPaths(paths));
  };

  if (files.length === 0) {
    return (
      <div className="fade-in">
        <h3 className="wiz-h">{t("gen.combine.h")}</h3>
        <p className="wiz-sub">{t("gen.combine.sub.a")}<strong>{t("gen.combine.sub.oneOrMany")}</strong>{t("gen.combine.sub.b")}<strong>{t("gen.combine.sub.mainList")}</strong>{t("gen.combine.sub.c")}<strong>{t("gen.combine.sub.shared")}</strong>{t("gen.combine.sub.d")}</p>
        {err && <div className="fixed-note" style={{ marginBottom: 16, background: "var(--danger-soft)", color: "var(--danger)" }}><Icon name="alert" style={{ width: 14, height: 14 }} /> {err}</div>}
        <div className={"dropzone" + (over ? " over" : "")} onClick={loading ? undefined : load}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
          <div className="dz-ic">{loading ? <span className="spinner" /> : <Icon name="table" />}</div>
          <div className="dz-title">{loading ? t("gen.reading") : over ? t("gen.dropHere") : t("gen.combine.selectOrDrag")}</div>
          <div className="dz-sub">{t("gen.multiHint")}</div>
        </div>
      </div>
    );
  }

  const setMode = (v, mode) => setCombineMap({ ...combineMap, [v]: { ...(combineMap[v] || { fileIdx: 0, colName: null, value: "" }), mode } });
  const setFile = (v, fileIdx) => {
    const cur = combineMap[v] || {};
    const cols = files[fileIdx].columns;
    const colName = cur.colName && cols.includes(cur.colName) ? cur.colName : (cols[0] || null);
    setCombineMap({ ...combineMap, [v]: { ...cur, mode: "excel", fileIdx, colName } });
  };
  const setColName = (v, colName) => setCombineMap({ ...combineMap, [v]: { ...(combineMap[v] || {}), mode: "excel", colName } });
  const setFixed = (v, value) => setCombineMap({ ...combineMap, [v]: { ...(combineMap[v] || { fileIdx: 0, colName: null }), mode: "fixed", value } });

  const assigned = template.vars.filter((v) => { const val = combineValues(template, files, combineMap)[v]; return String(val).trim() !== ""; }).length;

  return (
    <div className="fade-in">
      <h3 className="wiz-h">{t("gen.map.h")}</h3>
      <p className="wiz-sub">
        <Icon name="table" style={{ width: 15, height: 15, color: "var(--excel)", verticalAlign: "-3px", marginRight: 6 }} />
        {t("gen.combine.summary", { files: files.length, assigned, total: template.vars.length })}
      </p>

      <div className="map-card" style={{ marginBottom: 18, padding: "var(--s3) var(--s4)" }}>
        {files.map((f) => (
          <div key={f.file} className="row" style={{ marginBottom: 6, border: "none", padding: "8px 4px" }}>
            <div className="row-ic" style={{ background: "var(--excel-soft)", color: "var(--excel)", width: 34, height: 34, flex: "0 0 34px" }}><Icon name="excel" style={{ width: 17, height: 17 }} /></div>
            <div className="row-main">
              <div className="row-title" style={{ fontSize: 13.5 }}>{f.file}</div>
              <div className="row-meta"><span>{t("gen.combine.colsInfo", { n: f.columns.length })}</span></div>
            </div>
            <button className="icon-btn" title={t("common.remove")} onClick={() => onRemoveFile(f.file)}><Icon name="x" /></button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={loading ? undefined : load} disabled={loading}>
            {loading ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Icon name="plus" />} {t("gen.addAnother")}
          </button>
          <button className="btn btn-subtle btn-sm" onClick={onClear}>{t("common.removeAll")}</button>
        </div>
      </div>

      {/* Primary list: its rows drive how many documents are generated */}
      {(() => {
        const primary = files[primaryIdx] || files[0];
        const pTotal = primary ? primary.total : 0;
        const selCount = selectedRows ? selectedRows.size : pTotal;
        return (
          <div className="map-card" style={{ marginBottom: 18, padding: "var(--s4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Icon name="docs" style={{ width: 16, height: 16, color: "var(--accent)" }} />
              {files.length > 1 ? (
                <>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t("gen.combine.mainListLabel")}</span>
                  <select className="select" style={{ width: "auto", minWidth: 220 }} value={primaryIdx}
                    onChange={(e) => { setPrimaryIdx(Number(e.target.value)); setSelectedRows(null); setExprText(""); }}>
                    {files.map((f, fi) => <option key={fi} value={fi}>{t("gen.combine.fileRows", { file: f.file, n: f.total })}</option>)}
                  </select>
                </>
              ) : (
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t("gen.combine.onePerRow.a")}<span style={{ fontFamily: "var(--mono)", fontWeight: 700 }}>{primary ? primary.file : ""}</span></span>
              )}
            </div>
            <div className="row-select-bar" style={{ marginTop: 12, marginBottom: 0 }}>
              <span className="rsb-count">{t("gen.combine.rowsToDocs", { sel: selCount, total: pTotal })}</span>
              <div className="spacer" />
              <button className="btn btn-subtle btn-sm" onClick={() => { setSelectedRows(null); setExprText(""); }}>{t("gen.all")}</button>
              <div className="search-box" style={{ minWidth: 200 }} title="1-5, 8">
                <Icon name="table" />
                <input placeholder={t("gen.combine.rowsPh")} value={exprText}
                  onChange={(e) => { const v = e.target.value; setExprText(v); const s = parseRowExpr(v, pTotal); setSelectedRows(v.trim() === "" || s.size === pTotal ? null : s); }} />
              </div>
            </div>
          </div>
        );
      })()}

      <div className="map-card var-editor">
        <div className="var-edit-head" style={{ gridTemplateColumns: "minmax(150px,1fr) 96px minmax(320px,1.6fr)" }}>
          <span>{t("gen.combine.col.var")}</span><span></span><span>{t("gen.combine.col.from")}</span>
        </div>
        {template.vars.map((v) => {
          const m = combineMap[v] || { mode: "fixed", fileIdx: 0, colName: null, value: "" };
          const resolved = combineValues(template, files, combineMap)[v];
          const cols = files[m.fileIdx] ? files[m.fileIdx].columns : [];
          return (
            <div className="var-edit-row" key={v} style={{ gridTemplateColumns: "minmax(150px,1fr) 96px minmax(320px,1.6fr)", alignItems: "start", padding: "12px 0" }}>
              <div>
                <span className="vchip">{"{{" + v + "}}"}</span>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>{labelOfVar(template, v)}</div>
                {m.mode === "excel" && (
                  <div style={{ fontSize: 10.5, marginTop: 3, fontWeight: 600, color: m.fileIdx === primaryIdx ? "var(--accent)" : "var(--ink-3)" }}>
                    {m.fileIdx === primaryIdx ? t("gen.combine.variesByRow") : t("gen.combine.sameAll")}
                  </div>
                )}
              </div>
              <div className="mode-seg" style={{ alignSelf: "start" }}>
                <button className={m.mode === "excel" ? "on" : ""} onClick={() => setMode(v, "excel")} title={t("gen.combine.fromExcel")}><Icon name="excel" style={{ width: 13, height: 13 }} /></button>
                <button className={m.mode === "fixed" ? "on" : ""} onClick={() => setMode(v, "fixed")} title={t("gen.combine.fixedValue")}><Icon name="edit" style={{ width: 12, height: 12 }} /></button>
              </div>
              <div className="map-control">
                {m.mode === "excel" ? (
                  <>
                    <div style={{ display: "flex", gap: 8 }}>
                      <select className="select" value={m.fileIdx} onChange={(e) => setFile(v, Number(e.target.value))} style={{ flex: 1 }}>
                        {files.map((f, fi) => <option key={fi} value={fi}>{f.file}</option>)}
                      </select>
                      <select className="select" value={m.colName ?? ""} onChange={(e) => setColName(v, e.target.value || null)} style={{ flex: 1 }}>
                        <option value="">{t("gen.combine.colPlaceholder")}</option>
                        {cols.map((c, ci) => <option key={ci} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      = <span style={{ fontWeight: 600, color: String(resolved).startsWith("{{") ? "var(--warn)" : "var(--ink-2)" }}>{String(resolved).trim() !== "" ? String(resolved) : "—"}</span>
                    </div>
                  </>
                ) : (
                  <input className="input" placeholder={t("gen.combine.writeValue")} value={m.value || ""} onChange={(e) => setFixed(v, e.target.value)} />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="wiz-sub" style={{ marginTop: 12 }}>
        {t("gen.combine.note.a")}<strong>{t("gen.combine.note.varies")}</strong>{t("gen.combine.note.b")}<strong>{t("gen.combine.note.same")}</strong>{t("gen.combine.note.c")}<span style={{ color: "var(--warn)" }}>{t("gen.combine.note.amber")}</span>{t("gen.combine.note.d")}
      </p>
    </div>
  );
}

// Reusable fixed-value profiles bar (used in Excel mapping + manual form).
function ProfilesBar({ onApply, getCurrent }) {
  const { t } = useT();
  const [profiles, setProfiles] = useState([]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => { api.listProfiles().then((p) => setProfiles(p || [])); }, []);

  const current = getCurrent();
  const canSave = Object.keys(current).length > 0;
  const save = async () => {
    const p = { id: "p" + Date.now(), name: name.trim() || t("gen.profiles.defaultName"), values: current };
    setProfiles(await api.saveProfile(p));
    setNaming(false); setName("");
  };
  const del = async (id) => setProfiles(await api.deleteProfile(id));

  return (
    <div className="profiles-bar">
      <Icon name="sparkles" style={{ width: 15, height: 15, color: "var(--accent)" }} />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" }}>{t("gen.profiles.label")}</span>
      {profiles.length === 0 && <span className="muted" style={{ fontSize: 12.5 }}>{t("gen.profiles.hint")}</span>}
      {profiles.map((p) => (
        <span className="ftoken" key={p.id} style={{ background: "var(--surface-2)", color: "var(--ink-2)", border: "1px solid var(--border)" }}>
          <button style={{ border: "none", background: "none", cursor: "pointer", color: "inherit", font: "inherit", padding: 0, display: "inline-flex", alignItems: "center", gap: 5 }}
            title={t("gen.profiles.apply", { name: p.name })} onClick={() => onApply(p.values)}>
            <Icon name="check" style={{ width: 12, height: 12, color: "var(--accent)" }} /> {p.name}
          </button>
          <button title={t("gen.profiles.delete")} onClick={() => del(p.id)} style={{ color: "var(--ink-3)" }}><Icon name="x" /></button>
        </span>
      ))}
      <div className="spacer" style={{ flex: 1 }} />
      <button className="btn btn-subtle btn-sm" disabled={!canSave} onClick={() => { setName(""); setNaming(true); }}>
        <Icon name="plus" /> {t("gen.profiles.saveCurrent")}
      </button>

      {naming && (
        <div className="overlay" onClick={() => setNaming(false)}>
          <div className="modal" style={{ width: "min(420px, 92%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><div className="modal-title">{t("gen.profiles.saveTitle")}</div><button className="icon-btn" onClick={() => setNaming(false)}><Icon name="x" /></button></div>
            <div className="modal-body">
              <p className="wiz-sub" style={{ marginTop: 0 }}>{t("gen.profiles.saveDesc", { n: Object.keys(current).length })}</p>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>{t("gen.profiles.nameLabel")}</label>
                <input className="input" autoFocus value={name} placeholder={t("gen.profiles.namePh")} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-subtle" onClick={() => setNaming(false)}>{t("common.cancel")}</button>
              <button className="btn btn-primary" onClick={save}><Icon name="check" /> {t("common.save")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Step 4: confirmation ----------
function Confirm({ template, source, files, count, mapping, values, settings, setSettings, pdfAvailable, preflight, previewData }) {
  const { t } = useT();
  const fixed = source === "excel"
    ? template.vars.filter((v) => mapping[v] && mapping[v].mode === "fixed" && mapping[v].value.trim() !== "")
    : [];
  const data = resolveSample({ template, source, files, mapping, values });
  const sampleName = sampleFilename(settings.tokens, data);
  const multi = files.length > 1;

  const changeFolder = async () => {
    const r = await api.pickFolder();
    if (!r.canceled && r.path) setSettings({ ...settings, folder: r.path });
  };

  return (
    <div className="fade-in">
      <h3 className="wiz-h">{t("gen.confirm.h")}</h3>
      <p className="wiz-sub">{t("gen.confirm.sub")}</p>
      <div className="summary">
        <div className="sum-row">
          <div className="sum-ic"><Icon name="doc" /></div>
          <div><div className="sum-label">{t("gen.confirm.template")}</div><div className="sum-value">{template.name}</div></div>
        </div>
        <div className="sum-row" style={multi ? { alignItems: "flex-start" } : undefined}>
          <div className="sum-ic"><Icon name={source === "excel" ? "excel" : "form"} /></div>
          <div style={{ flex: 1 }}>
            <div className="sum-label">{t("gen.confirm.dataSource")}</div>
            {source === "combine" ? (
              <div className="sum-value">{t("gen.confirm.combineDocs", { count, files: files.length })}</div>
            ) : source !== "excel" ? (
              <div className="sum-value">{t("gen.confirm.manualForm")}</div>
            ) : multi ? (
              <>
                <div className="sum-value">{t("gen.confirm.multiBatch", { files: files.length })}</div>
                <div className="vchips" style={{ marginTop: 8 }}>
                  {files.map((f) => (
                    <span className="vchip" key={f.file} style={{ display: "inline-flex", gap: 6, fontSize: 11 }}>
                      <Icon name="excel" style={{ width: 11, height: 11 }} /> {f.file}<span style={{ opacity: 0.55 }}>· {f.total}</span>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="sum-value">{files[0] ? files[0].file : "Excel"}</div>
            )}
          </div>
        </div>
        {fixed.length > 0 && (
          <div className="sum-row" style={{ alignItems: "flex-start" }}>
            <div className="sum-ic"><Icon name="edit" /></div>
            <div style={{ flex: 1 }}>
              <div className="sum-label">{t("gen.confirm.fixedValues")}</div>
              <div className="vchips" style={{ marginTop: 8 }}>
                {fixed.map((v) => (
                  <span className="vchip" key={v} style={{ display: "inline-flex", gap: 6 }}>
                    {"{{" + v + "}}"}<span style={{ opacity: 0.55 }}>=</span><span style={{ fontWeight: 700 }}>{mapping[v].value}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="sum-row">
          <div className="sum-ic"><Icon name="folder" /></div>
          <div style={{ flex: 1 }}>
            <div className="sum-label">{t("gen.confirm.destFolder")}</div>
            <div className="sum-value mono">{settings.folder}</div>
            {multi && <div className="sum-label" style={{ marginTop: 4 }}>{t("gen.confirm.subfolderNote")}</div>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={changeFolder}><Icon name="folderOpen" /> {t("common.change")}</button>
        </div>
        <div className="sum-row" style={{ alignItems: "flex-start" }}>
          <div className="sum-ic"><Icon name="doc" /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sum-label">{t("gen.confirm.filename")}</div>
            <div style={{ marginTop: 8 }}>
              <FilenameBuilder tokens={settings.tokens} setTokens={(tk) => setSettings({ ...settings, tokens: tk })} options={template.vars} />
            </div>
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
              <span className="muted">{t("gen.confirm.example")}</span>
              <span className="sum-value mono" style={{ fontSize: 13 }}>{sampleName}</span>
            </div>
          </div>
        </div>
        <div className="sum-row">
          <div className="sum-ic"><Icon name="pdf" /></div>
          <div style={{ flex: 1 }}>
            <div className="sum-value">{t("gen.confirm.pdfTitle")}</div>
            <div className="sum-label" style={{ marginTop: 2 }}>
              {pdfAvailable ? t("gen.confirm.pdf.on") : t("gen.confirm.pdf.off")}
            </div>
          </div>
          <Switch on={settings.pdf && pdfAvailable} onChange={(v) => pdfAvailable && setSettings({ ...settings, pdf: v })} />
        </div>
        <div className="sum-row" style={{ background: "var(--accent-soft)" }}>
          <div className="sum-ic" style={{ background: "var(--accent)", color: "#fff" }}><Icon name="bolt" /></div>
          <div><div className="sum-label">{t("gen.confirm.willGen")}</div><div className="sum-value">{t("gen.confirm.willGenValue", { count, pdf: settings.pdf && pdfAvailable })}</div></div>
          <div className="sum-big">{count}</div>
        </div>
      </div>

      {/* Pre-flight check */}
      {preflight && (
        <>
          <div className="sec-head" style={{ marginTop: "var(--s6)" }}>
            <Icon name={preflight.ok ? "checkCircle" : "alert"} style={{ width: 16, height: 16, color: preflight.ok ? "var(--success)" : "var(--warn)" }} />
            <h2>{t("gen.preflight.h")}</h2>
          </div>
          {preflight.ok ? (
            <div className="pf-row ok"><Icon name="checkCircle" style={{ width: 15, height: 15 }} /> {t("gen.preflight.ok", { count })}</div>
          ) : (
            <div className="preflight">
              {preflight.emptyList.map((e) => (
                <div className="pf-row warn" key={"e" + e.v}><Icon name="alert" style={{ width: 14, height: 14 }} /> {t("gen.preflight.empty", { c: e.c, label: labelOfVar(template, e.v) })}</div>
              ))}
              {preflight.badList.map((e) => (
                <div className="pf-row warn" key={"b" + e.v}><Icon name="alert" style={{ width: 14, height: 14 }} /> {t("gen.preflight.bad", { c: e.c, label: labelOfVar(template, e.v) })}</div>
              ))}
              {preflight.dupCount > 0 && (preflight.overwrite
                ? <div className="pf-row danger"><Icon name="alert" style={{ width: 14, height: 14 }} /> {t("gen.preflight.dupOverwrite", { n: preflight.dupCount })}</div>
                : <div className="pf-row info"><Icon name="alert" style={{ width: 14, height: 14 }} /> {t("gen.preflight.dupNumber", { n: preflight.dupCount })}</div>
              )}
              <div className="pf-foot muted">{t("gen.preflight.foot")}</div>
            </div>
          )}
        </>
      )}

      {/* Real-data preview (first record) */}
      <div className="sec-head" style={{ marginTop: "var(--s6)" }}>
        <Icon name="eye" style={{ width: 16, height: 16, color: "var(--ink-3)" }} />
        <h2>{t("gen.confirm.realPreview")}</h2>
        <div className="spacer" />
        <span className="muted" style={{ fontSize: 12.5 }}>{source === "excel" ? t("gen.confirm.firstRow") : t("gen.confirm.enteredData")}</span>
      </div>
      <div className="preview-pane">
        <TemplatePreview template={template} values={previewData || data} />
      </div>
    </div>
  );
}

// ---------- Step 5: generating + result ----------
function Result({ template, count, settings, payload, onRestart, onBack }) {
  const { t } = useT();
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [files, setFiles] = useState([]);
  const [failures, setFailures] = useState([]);
  const [cancelled, setCancelled] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState("");
  const [exportMsg, setExportMsg] = useState("");
  const [exportBusy, setExportBusy] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // guard against StrictMode double-invoke
    started.current = true;
    api.generate(payload, (p) => {
      setProgress(p.done);
      if (p.file) setRecent((prev) => [...prev, p.file].slice(-4));
    }).then((res) => {
      if (res && res.error) { setError(res.error); return; }
      setFiles(res.files || []);
      setFailures(res.failures || []);
      setCancelled(!!res.cancelled);
      setTimeout(() => setDone(true), 250);
    }).catch((e) => setError(String(e && e.message ? e.message : e)));
  }, []);

  const cancel = () => { setCanceling(true); api.cancelGenerate(); };

  const doZip = async () => {
    setExportBusy("zip"); setExportMsg("");
    const paths = files.flatMap((f) => [f.path, f.pdf && f.pdf.path]).filter(Boolean);
    const r = await api.zipResults({ paths, rootDir: payload.options.folder, name: "DocFill_export" });
    setExportBusy("");
    if (r.error) setExportMsg(r.error);
    else { setExportMsg(t("gen.result.zipDone")); api.openPath(r.path); }
  };
  const doMergePdf = async () => {
    setExportBusy("pdf"); setExportMsg("");
    const pdfPaths = files.map((f) => f.pdf && f.pdf.path).filter(Boolean);
    const r = await api.mergePdfs({ pdfPaths, rootDir: payload.options.folder, name: "DocFill_combinado" });
    setExportBusy("");
    if (r.error) setExportMsg(r.error);
    else { setExportMsg(t("gen.result.pdfDone")); api.openPath(r.path); }
  };
  const anyPdf = files.some((f) => f.pdf);

  const pct = count > 0 ? Math.round((progress / count) * 100) : 0;
  const R = 54, C = 2 * Math.PI * R;

  if (error) {
    return (
      <div className="fade-in" style={{ textAlign: "center", padding: "var(--s7) 0" }}>
        <div className="result-check" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}><Icon name="alert" /></div>
        <h3 className="wiz-h">{t("gen.result.errTitle")}</h3>
        <p className="wiz-sub">{error}</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button className="btn btn-ghost btn-lg" onClick={onBack}><Icon name="chevL" /> {t("gen.result.backConfirm")}</button>
          <button className="btn btn-ghost btn-lg" onClick={onRestart}><Icon name="bolt" /> {t("gen.result.restart")}</button>
        </div>
      </div>
    );
  }

  if (!done) {
    return (
      <div className="fade-in progress-wrap">
        <div className="prog-ring">
          <svg viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="60" cy="60" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="9" />
            <circle cx="60" cy="60" r={R} fill="none" stroke="var(--accent)" strokeWidth="9" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - (count ? progress / count : 0))} style={{ transition: "stroke-dashoffset 0.2s" }} />
          </svg>
          <div className="prog-num">{pct}%</div>
        </div>
        <h3 className="wiz-h" style={{ textAlign: "center" }}>{t("gen.progress.h")}</h3>
        <p className="wiz-sub" style={{ textAlign: "center" }}>{t("gen.progress.sub", { done: progress, count, name: template.name })}</p>
        <div className="prog-bar"><div className="prog-fill" style={{ width: pct + "%" }} /></div>
        <div className="prog-files">
          {recent.map((f, i) => (
            <div className="prog-file" key={f.name + i}><Icon name="checkCircle" /> {f.name}{f.pdf ? "  +  .pdf" : ""}</div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: "var(--s5)" }}>
          <button className="btn btn-ghost" onClick={cancel} disabled={canceling}>
            {canceling ? t("gen.progress.canceling") : <><Icon name="x" /> {t("gen.progress.cancel")}</>}
          </button>
        </div>
      </div>
    );
  }

  const open = (p) => p && p !== "(simulado)" && api.openPath(p);

  return (
    <div className="fade-in">
      <div className="result-hero">
        <div className="result-check" style={cancelled ? { background: "var(--warn-soft)", color: "var(--warn)" } : undefined}>
          <Icon name={cancelled ? "alert" : "checkCircle"} />
        </div>
        <h3 className="wiz-h" style={{ textAlign: "center", fontSize: 22 }}>
          {t("gen.result.title", { cancelled, n: files.length })}
        </h3>
        <p className="wiz-sub" style={{ textAlign: "center" }}>
          {cancelled && t("gen.result.savedIn.cancelled")}{t("gen.result.savedIn")}<span style={{ fontFamily: "var(--mono)", color: "var(--ink-2)" }}>{settings.folder}</span>
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
          <button className="btn btn-primary btn-lg" onClick={() => open(payload.options.folder)}><Icon name="folderOpen" /> {t("gen.result.openFolder")}</button>
          <button className="btn btn-ghost btn-lg" onClick={doZip} disabled={!!exportBusy || files.length === 0}>
            {exportBusy === "zip" ? <span className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }} /> : <Icon name="download" />} {t("gen.result.exportZip")}
          </button>
          {anyPdf && (
            <button className="btn btn-ghost btn-lg" onClick={doMergePdf} disabled={!!exportBusy}>
              {exportBusy === "pdf" ? <span className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }} /> : <Icon name="pdf" />} {t("gen.result.mergePdf")}
            </button>
          )}
          <button className="btn btn-ghost btn-lg" onClick={onRestart}><Icon name="bolt" /> {t("gen.result.genMore")}</button>
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-subtle btn-sm" onClick={onBack}><Icon name="chevL" /> {t("gen.result.backAdjust")}</button>
        </div>
        {exportMsg && <p className="wiz-sub" style={{ textAlign: "center", marginTop: 12 }}>{exportMsg}</p>}
      </div>

      {failures.length > 0 && (
        <div className="fixed-note" style={{ background: "var(--warn-soft)", color: "var(--warn)", marginBottom: 18 }}>
          <Icon name="alert" style={{ width: 15, height: 15 }} />
          {t("gen.result.failures", { n: failures.length, err: failures[0] && failures[0].error ? failures[0].error : "", more: failures.length > 1 })}
        </div>
      )}

      <div className="sec-head"><h2>{t("gen.result.generatedFiles")}</h2><div className="spacer" /><span className="badge">{t("gen.result.filesCount", { n: files.length })}</span></div>
      <div className="result-files">
        {files.map((f, i) => (
          <Fragment key={f.name + i}>
            <div className="rfile">
              <div className="rfile-ic docx"><Icon name="doc" /></div>
              <div className="rfile-name">{f.name}</div>
              <div className="spacer" style={{ flex: 1 }} />
              <button className="icon-btn" title={t("gen.openTitle")} onClick={() => open(f.path)}><Icon name="download" /></button>
            </div>
            {f.pdf && (
              <div className="rfile">
                <div className="rfile-ic pdf"><Icon name="pdf" /></div>
                <div className="rfile-name">{f.pdf.name}</div>
                <div className="spacer" style={{ flex: 1 }} />
                <button className="icon-btn" title={t("gen.openTitle")} onClick={() => open(f.pdf.path)}><Icon name="download" /></button>
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// ---------- Wizard orchestrator ----------
export default function Generate({ initialTemplate, initialSource, templates, defaults, pdfAvailable, onPersistTemplate, onHome }) {
  const { t } = useT();
  // When repeating a run we get a template (+ source) and jump ahead.
  const [step, setStep] = useState(initialTemplate ? (initialSource ? 2 : 1) : 0);
  const [templateId, setTemplateId] = useState(initialTemplate || null);
  const [source, setSource] = useState(initialSource || null);
  const [excelFiles, setExcelFiles] = useState([]);
  const [mapping, setMapping] = useState({});
  const [combineMap, setCombineMap] = useState({}); // source === "combine"
  const [primaryIdx, setPrimaryIdx] = useState(0); // combine: which file's rows drive doc count
  const [manualRows, setManualRows] = useState([]);
  const [selectedRows, setSelectedRows] = useState(null); // null = all (single-file only)
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [settings, setSettings] = useState({
    folder: defaults.folder, tokens: defaults.tokens, pdf: defaults.pdf,
    overwrite: defaults.overwrite, openAfter: defaults.openAfter, autoFormat: defaults.autoFormat !== false,
  });

  const template = templates.find((t) => t.id === templateId);

  // Seed manual defaults from the template meta when manual source is chosen.
  useEffect(() => {
    if (source === "manual" && template) {
      const meta = template.meta || {};
      const seed = {};
      template.vars.forEach((v) => { if (meta[v] && meta[v].def && String(meta[v].def).trim() !== "") seed[v] = meta[v].def; });
      if (Object.keys(seed).length) setValues((prev) => ({ ...seed, ...prev }));
    }
  }, [source, templateId]);

  const addExcelFiles = (newFiles) => {
    const merged = [...excelFiles];
    newFiles.forEach((f) => { if (!merged.some((x) => x.file === f.file)) merged.push(f); });
    setExcelFiles(merged);
    if (source === "combine") {
      // (re)derive auto map for vars still unassigned; keep user's choices
      const auto = autoCombineMap(template.vars, merged);
      setCombineMap((prev) => {
        const next = { ...auto };
        template.vars.forEach((v) => {
          const p = prev[v];
          if (p && (p.mode === "fixed" ? (p.value || "").trim() !== "" : p.colName)) next[v] = p;
        });
        return next;
      });
      // default the primary list to the file with the most rows (the "list")
      let argmax = 0;
      merged.forEach((f, i) => { if (f.total > merged[argmax].total) argmax = i; });
      setPrimaryIdx(argmax);
    } else if (excelFiles.length === 0 && merged.length > 0) {
      setMapping(buildInitialMapping(template, merged[0].columns)); // reuses remembered mapping
      setManualRows([]);
    }
    setSelectedRows(null); // adding files resets to "all rows"
  };
  const removeExcelFile = (name) => {
    const next = excelFiles.filter((f) => f.file !== name);
    setExcelFiles(next);
    setSelectedRows(null);
    if (source === "combine") { setCombineMap(next.length ? autoCombineMap(template.vars, next) : {}); setPrimaryIdx(0); }
    else if (next.length === 0) { setMapping({}); setManualRows([]); }
  };
  const clearExcel = () => { setExcelFiles([]); setMapping({}); setCombineMap({}); setPrimaryIdx(0); setManualRows([]); setSelectedRows(null); };

  const multiExcel = excelFiles.length > 1;
  const excelTotal = excelFiles.reduce((n, f) => n + f.total, 0);

  // "combine" → treat as an Excel batch over the primary file, with the values
  // from the other files (and fixed entries) resolved to constants.
  const combinePrimary = source === "combine" ? excelFiles[primaryIdx] : null;
  const combineExcelMapping = useMemo(() => {
    if (source !== "combine" || !template || !combinePrimary) return {};
    const m = {};
    template.vars.forEach((v) => {
      const cm = combineMap[v];
      if (cm && cm.mode === "excel" && cm.fileIdx === primaryIdx) {
        m[v] = { mode: "col", col: combinePrimary.columns.indexOf(cm.colName), colName: cm.colName };
      } else if (cm && cm.mode === "excel") {
        m[v] = { mode: "fixed", value: String(combineCellValue(excelFiles, cm)) };
      } else {
        m[v] = { mode: "fixed", value: cm ? (cm.value || "") : "" };
      }
    });
    return m;
  }, [source, template, excelFiles, combineMap, primaryIdx, combinePrimary]);

  // single file honours the row selection; multi-file uses every row of every file
  const selectedCount = excelFiles.length === 1
    ? (selectedRows ? selectedRows.size : excelFiles[0].total) + manualRows.length
    : excelTotal;
  const combineCount = combinePrimary ? (selectedRows ? selectedRows.size : combinePrimary.total) : 0;
  const count = source === "excel" ? (excelFiles.length ? selectedCount : 0)
    : source === "combine" ? combineCount : 1;

  // Pre-flight check + real-data preview (computed lazily for the Confirm step).
  const preflight = useMemo(() => {
    if (step !== 3 || !template) return null;
    if (source === "combine") {
      if (!combinePrimary) return null;
      return computePreflight({ template, source: "excel", files: [combinePrimary], selectedRows, manualRows: [], mapping: combineExcelMapping, values: {}, tokens: settings.tokens, overwrite: settings.overwrite });
    }
    return computePreflight({ template, source, files: excelFiles, selectedRows, manualRows, mapping, values, tokens: settings.tokens, overwrite: settings.overwrite });
  }, [step, template, source, excelFiles, selectedRows, manualRows, mapping, values, combineExcelMapping, combinePrimary, settings.tokens, settings.overwrite]);

  const previewData = useMemo(() => {
    if (!template) return {};
    if (source === "combine") {
      if (!combinePrimary) return {};
      const firstIdx = selectedRows ? Math.min(...[...selectedRows]) : 0;
      return resolveRecord(template, combineExcelMapping, combinePrimary.columns, combinePrimary.rows[firstIdx] || combinePrimary.rows[0] || []);
    }
    return resolveSample({ template, source, files: excelFiles, mapping, values });
  }, [template, source, excelFiles, mapping, values, combineExcelMapping, combinePrimary, selectedRows]);

  const validateManual = () => {
    const e = {};
    template.vars.forEach((v) => {
      const ty = typeOfVar(template, v);
      const val = (values[v] || "").trim();
      if (!val) e[v] = t("gen.err.required");
      else if ((ty === "number" || ty === "currency") && isNaN(parseFloat(val.replace(",", ".")))) e[v] = t("gen.err.number");
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const canNext = () => {
    if (step === 0) return !!templateId;
    if (step === 1) return !!source;
    if (step === 2 && source === "excel") {
      if (excelFiles.length === 0 || count === 0) return false;
      return template.vars.every((v) => {
        const m = mapping[v];
        if (!m) return false;
        return m.mode === "col" ? (m.col !== null && m.col !== undefined) : m.value.trim() !== "";
      });
    }
    if (step === 2 && source === "combine") return excelFiles.length > 0 && count > 0;
    return true;
  };

  const next = () => {
    if (step === 2 && source === "manual" && !validateManual()) return;
    setStep(step + 1);
  };
  const back = () => setStep(Math.max(0, step - 1));
  const restart = () => { setStep(0); setTemplateId(null); setSource(null); setExcelFiles([]); setValues({}); setMapping({}); setCombineMap({}); setManualRows([]); setErrors({}); };

  // Remember the Excel mapping on this template for next time, then generate.
  const startGeneration = () => {
    if (source === "excel" && onPersistTemplate && template) {
      onPersistTemplate({ ...template, mapping });
    }
    setStep(4);
  };

  const genOptions = () => ({
    folder: settings.folder,
    tokens: settings.tokens,
    pdf: settings.pdf && pdfAvailable,
    overwrite: settings.overwrite,
    openAfter: settings.openAfter,
    autoFormat: settings.autoFormat !== false,
  });

  // payload sent to the engine on generation
  const buildPayload = () => {
    const baseTemplate = { id: template.id, docxPath: template.docxPath, vars: template.vars, name: template.name };
    // "combine" → one document per row of the primary file; values from the
    // other files (and fixed entries) become constants. Reuses the Excel path.
    if (source === "combine") {
      const rows = (combinePrimary && selectedRows)
        ? combinePrimary.rows.filter((_, ri) => selectedRows.has(ri))
        : (combinePrimary ? combinePrimary.rows : []);
      return {
        template: baseTemplate,
        source: "excel",
        mapping: combineExcelMapping,
        batches: [{ file: combinePrimary ? combinePrimary.file : "", columns: combinePrimary ? combinePrimary.columns : [], rows }],
        manualRows: [],
        values: {},
        options: genOptions(),
      };
    }
    return ({
    template: baseTemplate,
    source,
    mapping,
    batches: source === "excel"
      ? excelFiles.map((f, i) => ({
          file: f.file,
          columns: f.columns,
          // single file: only the selected rows; multi: every row
          rows: (excelFiles.length === 1 && selectedRows)
            ? f.rows.filter((_, ri) => selectedRows.has(ri))
            : f.rows,
        }))
      : [],
    manualRows,
    values,
    options: {
      folder: settings.folder,
      tokens: settings.tokens,
      pdf: settings.pdf && pdfAvailable,
      overwrite: settings.overwrite,
      openAfter: settings.openAfter,
      autoFormat: settings.autoFormat !== false,
    },
    });
  };

  return (
    <div className="main">
      <Toolbar title={t("gen.title")} sub={template ? template.name : t("gen.sub.wizard")}>
        {step > 0 && step < 4 && <button className="btn btn-subtle" onClick={onHome}>{t("common.cancel")}</button>}
      </Toolbar>
      <div className="scroll">
        <div className="wizard">
          <Stepper current={step} />

          {step === 0 && <PickTemplate templates={templates} value={templateId} onPick={setTemplateId} onManage={onHome} />}
          {step === 1 && <PickSource value={source} onPick={setSource} />}
          {step === 2 && source === "combine" && (
            <CombineStep template={template} files={excelFiles} onAddFiles={addExcelFiles} onRemoveFile={removeExcelFile} onClear={clearExcel} combineMap={combineMap} setCombineMap={setCombineMap} primaryIdx={primaryIdx} setPrimaryIdx={setPrimaryIdx} selectedRows={selectedRows} setSelectedRows={setSelectedRows} />
          )}
          {step === 2 && source === "manual" && <ManualForm template={template} values={values} setValues={setValues} errors={errors} />}
          {step === 3 && <Confirm template={template} source={source} files={excelFiles} count={count} mapping={mapping} values={values} settings={settings} setSettings={setSettings} pdfAvailable={pdfAvailable} preflight={preflight} previewData={previewData} />}
          {step === 4 && <Result template={template} count={count} settings={settings} payload={buildPayload()} onRestart={restart} onBack={() => setStep(3)} />}

          {step < 4 && (
            <div className="wizard-foot">
              {step > 0 ? <button className="btn btn-ghost" onClick={back}>{t("gen.foot.back")}</button> : <span />}
              <div className="spacer" />
              {step < 3 && <button className="btn btn-primary" disabled={!canNext()} onClick={next}>{t("gen.foot.continue")} <Icon name="chevR" /></button>}
              {step === 3 && <button className="btn btn-primary btn-lg" disabled={count === 0} onClick={startGeneration}><Icon name="bolt" /> {t("gen.foot.generate", { n: count })}</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
