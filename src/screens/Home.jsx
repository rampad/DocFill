import Icon from "../components/Icon.jsx";
import Toolbar from "../components/Toolbar.jsx";
import { api } from "../api.js";

// Friendly relative time from an ISO string; passes through plain labels.
function displayWhen(w) {
  if (!w || typeof w !== "string") return "";
  if (!w.includes("T")) return w; // already a friendly label (web sample data)
  const then = Date.parse(w);
  if (Number.isNaN(then)) return w;
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "Hace un momento";
  if (min < 60) return `Hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Hace ${h} ${h === 1 ? "hora" : "horas"}`;
  const d = Math.round(h / 24);
  if (d === 1) return "Ayer";
  if (d < 30) return `Hace ${d} días`;
  return new Date(then).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

const folderName = (f) => (f ? f.split(/[\\/]/).filter(Boolean).slice(-2).join("/") : "");

export default function Home({ history = [], onNav, onStartGenerate, onRepeat }) {
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 6) return "Buenas noches";
    if (h < 13) return "Buenos días";
    if (h < 21) return "Buenas tardes";
    return "Buenas noches";
  })();

  return (
    <div className="main">
      <Toolbar title={greeting} sub="¿Qué quieres hacer hoy?" />
      <div className="scroll">
        <div className="quick-grid">
          <button className="quick primary" onClick={onStartGenerate}>
            <div className="q-bg"><Icon name="bolt" /></div>
            <div className="q-ic"><Icon name="bolt" /></div>
            <div>
              <div className="q-title">Generar documentos</div>
              <div className="q-sub">Rellena una plantilla con datos desde Excel o a mano y crea uno o miles de documentos.</div>
            </div>
            <div className="q-go">Empezar <Icon name="arrowR" /></div>
          </button>

          <button className="quick" onClick={() => onNav("templates")}>
            <div className="q-bg"><Icon name="docs" /></div>
            <div className="q-ic"><Icon name="docs" /></div>
            <div>
              <div className="q-title">Gestionar plantillas</div>
              <div className="q-sub">Sube tus archivos .docx con variables {"{{...}}"} y administra tus plantillas guardadas.</div>
            </div>
            <div className="q-go">Abrir <Icon name="arrowR" /></div>
          </button>
        </div>

        <div className="sec-head">
          <h2>Actividad reciente</h2>
          <div className="spacer" />
          <a onClick={onStartGenerate}>Generar más</a>
        </div>

        {history.length === 0 ? (
          <div className="dropzone" style={{ cursor: "default" }}>
            <div className="dz-ic"><Icon name="clock" /></div>
            <div className="dz-title">Aún no has generado documentos</div>
            <div className="dz-sub">Cuando generes documentos aparecerán aquí para abrirlos o repetirlos.</div>
          </div>
        ) : (
          <div className="rows">
            {history.map((r) => (
              <div className="row" key={r.id}>
                <div className="row-ic doc"><Icon name="doc" /></div>
                <div className="row-main">
                  <div className="row-title">
                    {r.template}
                    <span className="badge count">{r.count} {r.count === 1 ? "doc" : "docs"}</span>
                  </div>
                  <div className="row-meta">
                    <span>{displayWhen(r.when)}</span>
                    <span className="dot-sep" />
                    <span>Origen: {r.source}</span>
                    <span className="dot-sep" />
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Icon name="folder" style={{ width: 13, height: 13, color: "var(--ink-4)" }} />{folderName(r.folder)}
                    </span>
                  </div>
                </div>
                <div className="row-actions">
                  <button className="icon-btn" title="Abrir carpeta" onClick={() => api.openPath(r.folder)}><Icon name="folderOpen" /></button>
                  <button className="icon-btn" title="Repetir con esta plantilla" onClick={() => (onRepeat ? onRepeat(r) : onStartGenerate())}><Icon name="bolt" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
