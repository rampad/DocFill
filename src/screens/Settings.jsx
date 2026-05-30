import Icon from "../components/Icon.jsx";
import Toolbar from "../components/Toolbar.jsx";
import Switch from "../components/Switch.jsx";
import FilenameBuilder from "../components/FilenameBuilder.jsx";
import { api } from "../api.js";
import { ACCENTS } from "../theme.js";

const TOKEN_OPTS = ["nombre", "fecha", "numero_factura", "cliente", "empresa"];

const ACCENT_LABELS = { grafito: "Grafito", azul: "Azul", teal: "Verde azulado", indigo: "Índigo" };

export default function Settings({ settings, setSettings, appearance, setAppearance, pdfAvailable }) {
  const tokensToPattern = (tk) => tk.map((t) => (t.type === "var" ? "{{" + t.value + "}}" : t.value)).join("");
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
      <Toolbar title="Configuración" sub="Preferencias por defecto para generar documentos" />
      <div className="scroll">
        <div className="set-group">
          <div className="sec-head" style={{ marginTop: 0 }}><h2>Salida</h2></div>
          <div className="card">
            <div className="set-item">
              <div className="sum-ic"><Icon name="folder" /></div>
              <div className="set-text">
                <div className="set-title">Carpeta de salida por defecto</div>
                <div className="set-desc">Dónde se guardarán los documentos generados si no eliges otra carpeta.</div>
              </div>
              <div className="path-input">
                <span className="path-field">{settings.folder}</span>
                <button className="btn btn-ghost btn-sm" onClick={browseFolder}><Icon name="folderOpen" /> Examinar</button>
              </div>
            </div>

            <div className="set-item">
              <div className="sum-ic"><Icon name="pdf" /></div>
              <div className="set-text">
                <div className="set-title">Exportar también a PDF</div>
                <div className="set-desc">
                  {pdfAvailable
                    ? "Genera automáticamente una copia en PDF junto a cada documento de Word."
                    : "LibreOffice no detectado: la exportación a PDF no está disponible en este equipo."}
                </div>
              </div>
              <Switch on={settings.pdf && pdfAvailable} onChange={(v) => pdfAvailable && setSettings({ ...settings, pdf: v })} />
            </div>
          </div>
        </div>

        <div className="set-group">
          <div className="sec-head"><h2>Nombre de los archivos</h2></div>
          <div className="card card-pad">
            <div className="set-text" style={{ marginBottom: 16 }}>
              <div className="set-title">Formato del nombre</div>
              <div className="set-desc">Construye el patrón combinando variables de la plantilla y separadores. Cada documento usará el valor real de sus datos.</div>
            </div>
            <FilenameBuilder tokens={settings.tokens} setTokens={(tk) => setSettings({ ...settings, tokens: tk })} options={TOKEN_OPTS} />
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <span className="muted">Ejemplo:</span>
              <span style={{ fontFamily: "var(--mono)", fontWeight: 600, background: "var(--surface-2)", padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>{preview}</span>
            </div>
          </div>
        </div>

        <div className="set-group">
          <div className="sec-head"><h2>Apariencia</h2></div>
          <div className="card">
            <div className="set-item">
              <div className="sum-ic"><Icon name="sparkles" /></div>
              <div className="set-text">
                <div className="set-title">Color de acento</div>
                <div className="set-desc">El color principal de botones, enlaces y elementos destacados.</div>
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
                <div className="set-title">Densidad de la interfaz</div>
                <div className="set-desc">Cómoda deja más aire entre los elementos; compacta muestra más contenido a la vez.</div>
              </div>
              <div className="seg-control">
                {[{ id: "comfy", label: "Cómoda" }, { id: "compact", label: "Compacta" }].map((o) => (
                  <button key={o.id} className={appearance.density === o.id ? "on" : ""} onClick={() => setAppearance({ ...appearance, density: o.id })}>{o.label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="set-group">
          <div className="sec-head"><h2>Aplicación</h2></div>
          <div className="card">
            <div className="set-item">
              <div className="sum-ic"><Icon name="docs" /></div>
              <div className="set-text">
                <div className="set-title">Abrir la carpeta al terminar</div>
                <div className="set-desc">Muestra automáticamente los archivos en el explorador cuando finaliza la generación.</div>
              </div>
              <Switch on={settings.openAfter} onChange={(v) => setSettings({ ...settings, openAfter: v })} />
            </div>
            <div className="set-item">
              <div className="sum-ic"><Icon name="bolt" /></div>
              <div className="set-text">
                <div className="set-title">Sobrescribir si ya existe</div>
                <div className="set-desc">Si está desactivado, DocFill añadirá un número al final para no reemplazar archivos.</div>
              </div>
              <Switch on={settings.overwrite} onChange={(v) => setSettings({ ...settings, overwrite: v })} />
            </div>
            <div className="set-item">
              <div className="sum-ic"><Icon name="sparkles" /></div>
              <div className="set-text">
                <div className="set-title">Formato automático de números y fechas</div>
                <div className="set-desc">Aplica miles y decimales a los importes (4.200,00) y convierte fechas a dd/mm/aaaa según el tipo de cada variable.</div>
              </div>
              <Switch on={settings.autoFormat !== false} onChange={(v) => setSettings({ ...settings, autoFormat: v })} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
