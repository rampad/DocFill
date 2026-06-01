import { useState, useEffect } from "react";
import Icon from "../components/Icon.jsx";
import Toolbar from "../components/Toolbar.jsx";
import TemplatePreview from "../components/TemplatePreview.jsx";
import { api, droppedPaths } from "../api.js";
import { VAR_LABELS } from "../data.js";
import { useT } from "../i18n.js";

const VAR_TYPES = [
  { id: "text", key: "type.text" },
  { id: "date", key: "type.date" },
  { id: "number", key: "type.number" },
  { id: "currency", key: "type.currency" },
];
const prettify = (v) => v.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const inferType = (v) =>
  v.includes("fecha") ? "date"
  : ["base", "total", "importe", "importe_mensual", "salario_bruto", "salario_neto"].some((k) => v.includes(k)) ? "currency"
  : ["iva", "horas", "duracion_meses", "cantidad", "numero"].some((k) => v.includes(k)) ? "number"
  : "text";

// Review modal shown after a .docx is imported: confirm name + see detected vars.
function ImportReview({ template, onCancel, onSave }) {
  const { t } = useT();
  const [name, setName] = useState(template.name);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      i++;
      setShown(i);
      if (i >= template.vars.length) clearInterval(t);
    }, 90);
    return () => clearInterval(t);
  }, [template.vars.length]);

  const noVars = template.vars.length === 0;

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{t("import.title")}</div>
          <button className="icon-btn" onClick={onCancel}><Icon name="x" /></button>
        </div>

        <div className="modal-body">
          <div className="detected-head">
            <div className="row-ic doc"><Icon name="doc" /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>{template.file}</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>{t("import.wordDoc")}</div>
            </div>
            <span className="badge green"><Icon name="check" style={{ width: 13, height: 13 }} /> {t("import.valid")}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "20px 0 12px" }}>
            <Icon name="sparkles" style={{ width: 17, height: 17, color: "var(--accent)" }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {noVars ? t("import.noVars") : t("import.varsDetected", { shown: Math.min(shown, template.vars.length), total: template.vars.length })}
            </span>
          </div>
          {noVars ? (
            <div className="fixed-note" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
              <Icon name="alert" style={{ width: 14, height: 14 }} />
              {t("import.noVarsNote")}
            </div>
          ) : (
            <div className="vchips">
              {template.vars.slice(0, shown).map((v) => (
                <span className="vchip fade-in" key={v}>{"{{" + v + "}}"}</span>
              ))}
            </div>
          )}

          <div className="field" style={{ marginTop: 22 }}>
            <label>{t("import.nameLabel")}</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn btn-subtle" onClick={onCancel}>{t("common.cancel")}</button>
          <button className="btn btn-primary" disabled={!name.trim()} onClick={() => onSave({ ...template, name: name.trim() })}>
            <Icon name="check" /> {t("import.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Full-screen template editor ----
function TemplateEditor({ template, onBack, onSave, onReplaced }) {
  const { t } = useT();
  const [name, setName] = useState(template.name);
  const [vars, setVars] = useState(
    template.vars.map((v) => {
      const m = (template.meta || {})[v] || {};
      return { key: v, label: m.label || VAR_LABELS[v] || prettify(v), type: m.type || inferType(v), def: m.def || "" };
    })
  );
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const upd = (i, patch) => setVars(vars.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const previewValues = {};
  vars.forEach((x) => { if (x.def.trim() !== "") previewValues[x.key] = x.def; });

  const doSave = () => {
    const meta = {};
    vars.forEach((x) => { meta[x.key] = { label: x.label, type: x.type, def: x.def }; });
    onSave({ ...template, name, meta });
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const doReplace = async () => {
    setBusy(true); setErr("");
    const r = await api.replaceDocx(template.id);
    setBusy(false);
    if (r.canceled) return;
    if (r.error) { setErr(r.error); return; }
    onReplaced(r.template);
  };

  const fixedCount = vars.filter((x) => x.def.trim() !== "").length;

  return (
    <div className="main">
      <div className="toolbar">
        <button className="btn btn-subtle" onClick={onBack} style={{ marginLeft: -8 }}><Icon name="chevL" /> {t("editor.back")}</button>
        <div style={{ marginLeft: 6 }}>
          <h1>{t("editor.title")}</h1>
          <div className="sub" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{template.file}</div>
        </div>
        <div className="spacer" />
        <button className="btn btn-ghost" onClick={doReplace} disabled={busy}>
          {busy ? <span className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }} /> : <Icon name="upload" />} {t("editor.replace")}
        </button>
        <button className="btn btn-primary" onClick={doSave}>
          <Icon name="check" /> {saved ? t("editor.saved") : t("editor.saveChanges")}
        </button>
      </div>
      <div className="scroll">
        <div className="editor-split">
          <div style={{ minWidth: 0 }}>
            <div className="field">
              <label>{t("editor.nameLabel")}</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            {err && (
              <div className="fixed-note" style={{ marginBottom: 18, background: "var(--danger-soft)", color: "var(--danger)" }}>
                <Icon name="alert" style={{ width: 14, height: 14 }} /> {err}
              </div>
            )}

            <div className="sec-head" style={{ marginTop: 6 }}>
              <Icon name="sparkles" style={{ width: 16, height: 16, color: "var(--accent)" }} />
              <h2>{t("editor.varsDetected")}</h2>
              <div className="spacer" />
              <span className="badge var">{vars.length}</span>
            </div>

            {vars.length === 0 ? (
              <div className="dropzone" style={{ cursor: "default" }}>
                <div className="dz-title">{t("editor.noVars.title")}</div>
                <div className="dz-sub">{t("editor.noVars.sub")}</div>
              </div>
            ) : (
              <div className="map-card var-editor">
                <div className="var-edit-head">
                  <span>{t("editor.col.var")}</span><span>{t("editor.col.label")}</span><span>{t("editor.col.type")}</span><span>{t("editor.col.default")}</span>
                </div>
                {vars.map((x, i) => (
                  <div className="var-edit-row" key={x.key}>
                    <span className="vchip">{"{{" + x.key + "}}"}</span>
                    <input className="input" value={x.label} onChange={(e) => upd(i, { label: e.target.value })} />
                    <select className="select" value={x.type} onChange={(e) => upd(i, { type: e.target.value })}>
                      {VAR_TYPES.map((ty) => <option key={ty.id} value={ty.id}>{t(ty.key)}</option>)}
                    </select>
                    <input className="input" placeholder={t("editor.noValue")} value={x.def} onChange={(e) => upd(i, { def: e.target.value })} />
                  </div>
                ))}
              </div>
            )}
            <p className="wiz-sub" style={{ marginTop: 12 }}>
              {t("editor.hint.a")}<strong>{t("editor.hint.type")}</strong>{t("editor.hint.b")}<strong>{t("editor.hint.def")}</strong>{t("editor.hint.c", { n: fixedCount })}
            </p>
          </div>

          <div className="manual-preview">
            <div className="preview-label"><Icon name="eye" style={{ width: 15, height: 15 }} /> {t("common.preview")}</div>
            <div className="preview-pane">
              <TemplatePreview template={template} values={previewValues} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Templates({ templates, setTemplates, onUse }) {
  const { t } = useT();
  const [query, setQuery] = useState("");
  const [justAdded, setJustAdded] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [review, setReview] = useState(null); // freshly imported template awaiting confirm
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);

  const editing = templates.find((t) => t.id === editingId);
  const filtered = templates.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()));

  const handleImported = (r) => {
    if (!r || r.canceled) return;
    if (r.error) { setError(r.error); return; }
    // Already persisted by the backend; show it provisionally + review modal.
    setTemplates([r.template, ...templates.filter((t) => t.id !== r.template.id)]);
    setReview(r.template);
  };

  const onNew = async () => {
    setError("");
    setImporting(true);
    const r = await api.pickTemplate();
    setImporting(false);
    handleImported(r);
  };

  const onDropDocx = async (e) => {
    e.preventDefault();
    setOver(false);
    const paths = droppedPaths(e, [".docx"]);
    if (!paths.length) return;
    setError("");
    setImporting(true);
    const r = await api.importTemplatePath(paths[0]);
    setImporting(false);
    handleImported(r);
  };

  const confirmImport = async (named) => {
    await api.updateTemplate(named);
    setTemplates((list) => list.map((t) => (t.id === named.id ? named : t)));
    setReview(null);
    setJustAdded(named.id);
    setTimeout(() => setJustAdded(null), 2000);
  };

  const cancelImport = async () => {
    if (review) {
      await api.deleteTemplate(review.id);
      setTemplates((list) => list.filter((t) => t.id !== review.id));
    }
    setReview(null);
  };

  const remove = async (id) => {
    await api.deleteTemplate(id);
    setTemplates((list) => list.filter((t) => t.id !== id));
  };

  const saveEdit = async (updated) => {
    await api.updateTemplate(updated);
    setTemplates((list) => list.map((t) => (t.id === updated.id ? updated : t)));
    setEditingId(null);
  };

  if (editing) {
    return (
      <TemplateEditor
        template={editing}
        onBack={() => setEditingId(null)}
        onSave={saveEdit}
        onReplaced={(t) => setTemplates((list) => list.map((x) => (x.id === t.id ? t : x)))}
      />
    );
  }

  return (
    <div className="main">
      <Toolbar title={t("templates.title")} sub={t("templates.count", { n: templates.length })}>
        <div className="search-box">
          <Icon name="search" />
          <input placeholder={t("templates.search")} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={onNew} disabled={importing}>
          {importing ? <span className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }} /> : <Icon name="plus" />} {t("templates.new")}
        </button>
      </Toolbar>

      <div className={"scroll" + (over && templates.length > 0 ? " drop-over" : "")}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setOver(false); }}
        onDrop={onDropDocx}>
        {error && (
          <div className="fixed-note" style={{ marginBottom: 16, background: "var(--danger-soft)", color: "var(--danger)" }}>
            <Icon name="alert" style={{ width: 14, height: 14 }} /> {error}
          </div>
        )}
        <div className="rows">
          {templates.length === 0 && !query ? (
            <div className={"dropzone" + (over ? " over" : "")} onClick={onNew}>
              <div className="dz-ic"><Icon name="upload" /></div>
              <div className="dz-title">{over ? t("templates.empty.titleOver") : t("templates.empty.title")}</div>
              <div className="dz-sub">{t("templates.empty.sub")}</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="dropzone" style={{ cursor: "default" }}>
              <div className="dz-title">{t("templates.noResults.title")}</div>
              <div className="dz-sub">{t("templates.noResults.sub", { q: query })}</div>
            </div>
          ) : (
            filtered.map((tpl) => (
              <div className={"row" + (justAdded === tpl.id ? " just-added" : "")} key={tpl.id}>
                <div className="row-ic doc"><Icon name="doc" /></div>
                <div className="row-main">
                  <div className="row-title">
                    {tpl.name}
                    {justAdded === tpl.id && <span className="badge green">{t("templates.added")}</span>}
                  </div>
                  <div className="row-meta">
                    <span style={{ fontFamily: "var(--mono)", fontSize: 11.5 }}>{tpl.file}</span>
                    <span className="dot-sep" />
                    <span>{tpl.date}</span>
                    <span className="dot-sep" />
                    <span className="badge var">{t("templates.varsCount", { n: tpl.vars.length })}</span>
                  </div>
                  <div className="vchips" style={{ marginTop: 10 }}>
                    {tpl.vars.slice(0, 6).map((v) => <span className="vchip" key={v}>{"{{" + v + "}}"}</span>)}
                    {tpl.vars.length > 6 && <span className="vchip" style={{ background: "transparent", color: "var(--ink-3)" }}>+{tpl.vars.length - 6}</span>}
                  </div>
                </div>
                <div className="row-actions" style={{ flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => onUse(tpl.id)}><Icon name="bolt" /> {t("templates.use")}</button>
                  <div style={{ display: "flex", gap: 2 }}>
                    <button className="icon-btn" title={t("templates.edit.title")} onClick={() => setEditingId(tpl.id)}><Icon name="edit" /></button>
                    <button className="icon-btn" title={t("templates.delete.title")} onClick={() => remove(tpl.id)}><Icon name="trash" /></button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {review && <ImportReview template={review} onCancel={cancelImport} onSave={confirmImport} />}
    </div>
  );
}
