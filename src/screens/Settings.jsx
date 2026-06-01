import Icon from "../components/Icon.jsx";
import Toolbar from "../components/Toolbar.jsx";
import Switch from "../components/Switch.jsx";
import FilenameBuilder from "../components/FilenameBuilder.jsx";
import { api } from "../api.js";
import { ACCENTS } from "../theme.js";
import { useT, LANGS } from "../i18n.js";

const TOKEN_OPTS = ["nombre", "fecha", "numero_factura", "cliente", "empresa"];

export default function Settings({ settings, setSettings, appearance, setAppearance, pdfAvailable }) {
  const { t } = useT();
  const ACCENT_LABELS = { grafito: t("accent.grafito"), azul: t("accent.azul"), teal: t("accent.teal"), indigo: t("accent.indigo") };
  const tokensToPattern = (tk) => tk.map((tok) => (tok.type === "var" ? "{{" + tok.value + "}}" : tok.value)).join("");
  const preview = tokensToPattern(settings.tokens)
    .replace("{{nombre}}", "Ana_Lopez")
    .replace("{{fecha}}", "2026-05-29")
    .replace("{{numero_factura}}", "2026-0142")
    .replace("{{cliente}}", "Vega_SL")
    .replace("{{empresa}}", "Acme") + ".docx";

  const browseFolder = async () => {
    const r = await api.pickFolder();
    if (!r.canceled && r.path) setSettings({ ...settings, folder: r.path });
  };

  return (
    <div className="main">
      <Toolbar title={t("settings.title")} sub={t("settings.sub")} />
      <div className="scroll">
        <div className="set-group">
          <div className="sec-head" style={{ marginTop: 0 }}><h2>{t("settings.group.output")}</h2></div>
          <div className="card">
            <div className="set-item">
              <div className="sum-ic"><Icon name="folder" /></div>
              <div className="set-text">
                <div className="set-title">{t("settings.outFolder.title")}</div>
                <div className="set-desc">{t("settings.outFolder.desc")}</div>
              </div>
              <div className="path-input">
                <span className="path-field">{settings.folder}</span>
                <button className="btn btn-ghost btn-sm" onClick={browseFolder}><Icon name="folderOpen" /> {t("common.browse")}</button>
              </div>
            </div>

            <div className="set-item">
              <div className="sum-ic"><Icon name="pdf" /></div>
              <div className="set-text">
                <div className="set-title">{t("settings.pdf.title")}</div>
                <div className="set-desc">
                  {pdfAvailable ? t("settings.pdf.desc.on") : t("settings.pdf.desc.off")}
                </div>
              </div>
              <Switch on={settings.pdf && pdfAvailable} onChange={(v) => pdfAvailable && setSettings({ ...settings, pdf: v })} />
            </div>
          </div>
        </div>

        <div className="set-group">
          <div className="sec-head"><h2>{t("settings.group.filename")}</h2></div>
          <div className="card card-pad">
            <div className="set-text" style={{ marginBottom: 16 }}>
              <div className="set-title">{t("settings.filename.title")}</div>
              <div className="set-desc">{t("settings.filename.desc")}</div>
            </div>
            <FilenameBuilder tokens={settings.tokens} setTokens={(tk) => setSettings({ ...settings, tokens: tk })} options={TOKEN_OPTS} />
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <span className="muted">{t("settings.example")}</span>
              <span style={{ fontFamily: "var(--mono)", fontWeight: 600, background: "var(--surface-2)", padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>{preview}</span>
            </div>
          </div>
        </div>

        <div className="set-group">
          <div className="sec-head"><h2>{t("settings.group.appearance")}</h2></div>
          <div className="card">
            <div className="set-item">
              <div className="sum-ic"><Icon name="sparkles" /></div>
              <div className="set-text">
                <div className="set-title">{t("settings.accent.title")}</div>
                <div className="set-desc">{t("settings.accent.desc")}</div>
              </div>
              <div className="accent-swatches">
                {Object.keys(ACCENTS).map((k) => (
                  <button
                    key={k}
                    className={"accent-swatch" + (appearance.accent === k ? " on" : "")}
                    title={ACCENT_LABELS[k]}
                    style={{ background: ACCENTS[k].accent }}
                    onClick={() => setAppearance({ ...appearance, accent: k })}
                  >
                    {appearance.accent === k && <Icon name="check" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="set-item">
              <div className="sum-ic"><Icon name="table" /></div>
              <div className="set-text">
                <div className="set-title">{t("settings.density.title")}</div>
                <div className="set-desc">{t("settings.density.desc")}</div>
              </div>
              <div className="seg-control">
                {[{ id: "comfy", label: t("settings.density.comfy") }, { id: "compact", label: t("settings.density.compact") }].map((o) => (
                  <button key={o.id} className={appearance.density === o.id ? "on" : ""} onClick={() => setAppearance({ ...appearance, density: o.id })}>{o.label}</button>
                ))}
              </div>
            </div>

            <div className="set-item">
              <div className="sum-ic"><Icon name="form" /></div>
              <div className="set-text">
                <div className="set-title">{t("settings.language.title")}</div>
                <div className="set-desc">{t("settings.language.desc")}</div>
              </div>
              <div className="seg-control">
                {LANGS.map((o) => (
                  <button key={o.id} className={((appearance.lang || "es") === o.id) ? "on" : ""} onClick={() => setAppearance({ ...appearance, lang: o.id })}>{o.label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="set-group">
          <div className="sec-head"><h2>{t("settings.group.app")}</h2></div>
          <div className="card">
            <div className="set-item">
              <div className="sum-ic"><Icon name="docs" /></div>
              <div className="set-text">
                <div className="set-title">{t("settings.openAfter.title")}</div>
                <div className="set-desc">{t("settings.openAfter.desc")}</div>
              </div>
              <Switch on={settings.openAfter} onChange={(v) => setSettings({ ...settings, openAfter: v })} />
            </div>
            <div className="set-item">
              <div className="sum-ic"><Icon name="bolt" /></div>
              <div className="set-text">
                <div className="set-title">{t("settings.overwrite.title")}</div>
                <div className="set-desc">{t("settings.overwrite.desc")}</div>
              </div>
              <Switch on={settings.overwrite} onChange={(v) => setSettings({ ...settings, overwrite: v })} />
            </div>
            <div className="set-item">
              <div className="sum-ic"><Icon name="sparkles" /></div>
              <div className="set-text">
                <div className="set-title">{t("settings.autoFormat.title")}</div>
                <div className="set-desc">{t("settings.autoFormat.desc")}</div>
              </div>
              <Switch on={settings.autoFormat !== false} onChange={(v) => setSettings({ ...settings, autoFormat: v })} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
