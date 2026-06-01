import Icon from "../components/Icon.jsx";
import Toolbar from "../components/Toolbar.jsx";
import { api } from "../api.js";
import { useT } from "../i18n.js";

// Friendly relative time from an ISO string; passes through plain labels.
function displayWhen(w, t, lang) {
  if (!w || typeof w !== "string") return "";
  if (!w.includes("T")) return w; // already a friendly label (web sample data)
  const then = Date.parse(w);
  if (Number.isNaN(then)) return w;
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return t("when.now");
  if (min < 60) return t("when.min", { n: min });
  const h = Math.round(min / 60);
  if (h < 24) return t("when.hours", { n: h });
  const d = Math.round(h / 24);
  if (d === 1) return t("when.yesterday");
  if (d < 30) return t("when.days", { n: d });
  return new Date(then).toLocaleDateString(lang === "en" ? "en-US" : "es-ES", { day: "numeric", month: "short" });
}

const folderName = (f) => (f ? f.split(/[\\/]/).filter(Boolean).slice(-2).join("/") : "");

export default function Home({ history = [], onNav, onStartGenerate, onRepeat }) {
  const { t, lang } = useT();
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 6) return t("home.greeting.evening");
    if (h < 13) return t("home.greeting.morning");
    if (h < 21) return t("home.greeting.afternoon");
    return t("home.greeting.evening");
  })();

  return (
    <div className="main">
      <Toolbar title={greeting} sub={t("home.sub")} />
      <div className="scroll">
        <div className="quick-grid">
          <button className="quick primary" onClick={onStartGenerate}>
            <div className="q-bg"><Icon name="bolt" /></div>
            <div className="q-ic"><Icon name="bolt" /></div>
            <div>
              <div className="q-title">{t("home.generate.title")}</div>
              <div className="q-sub">{t("home.generate.desc")}</div>
            </div>
            <div className="q-go">{t("home.generate.cta")} <Icon name="arrowR" /></div>
          </button>

          <button className="quick" onClick={() => onNav("templates")}>
            <div className="q-bg"><Icon name="docs" /></div>
            <div className="q-ic"><Icon name="docs" /></div>
            <div>
              <div className="q-title">{t("home.templates.title")}</div>
              <div className="q-sub">{t("home.templates.desc")}</div>
            </div>
            <div className="q-go">{t("home.templates.cta")} <Icon name="arrowR" /></div>
          </button>
        </div>

        <div className="sec-head">
          <h2>{t("home.recent")}</h2>
          <div className="spacer" />
          <a onClick={onStartGenerate}>{t("home.generateMore")}</a>
        </div>

        {history.length === 0 ? (
          <div className="dropzone" style={{ cursor: "default" }}>
            <div className="dz-ic"><Icon name="clock" /></div>
            <div className="dz-title">{t("home.empty.title")}</div>
            <div className="dz-sub">{t("home.empty.sub")}</div>
          </div>
        ) : (
          <div className="rows">
            {history.map((r) => (
              <div className="row" key={r.id}>
                <div className="row-ic doc"><Icon name="doc" /></div>
                <div className="row-main">
                  <div className="row-title">
                    {r.template}
                    <span className="badge count">{t("home.docCount", { n: r.count })}</span>
                  </div>
                  <div className="row-meta">
                    <span>{displayWhen(r.when, t, lang)}</span>
                    <span className="dot-sep" />
                    <span>{t("home.source", { s: r.source })}</span>
                    <span className="dot-sep" />
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Icon name="folder" style={{ width: 13, height: 13, color: "var(--ink-4)" }} />{folderName(r.folder)}
                    </span>
                  </div>
                </div>
                <div className="row-actions">
                  <button className="icon-btn" title={t("home.openFolder")} onClick={() => api.openPath(r.folder)}><Icon name="folderOpen" /></button>
                  <button className="icon-btn" title={t("home.repeat")} onClick={() => (onRepeat ? onRepeat(r) : onStartGenerate())}><Icon name="bolt" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
