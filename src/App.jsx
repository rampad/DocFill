import { useState, useEffect, useMemo, useCallback } from "react";
import TitleBar from "./components/TitleBar.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Home from "./screens/Home.jsx";
import Templates from "./screens/Templates.jsx";
import Generate from "./screens/Generate.jsx";
import Settings from "./screens/Settings.jsx";
import { api } from "./api.js";
import { applyAccent } from "./theme.js";

const TITLES = {
  home: "DocFill",
  templates: "Plantillas — DocFill",
  generate: "Generar documentos — DocFill",
  settings: "Configuración — DocFill",
};

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [route, setRoute] = useState("home");
  const [genTemplate, setGenTemplate] = useState(null);
  const [genSource, setGenSource] = useState(null);
  const [genKey, setGenKey] = useState(0);

  const [templates, setTemplates] = useState([]);
  const [history, setHistory] = useState([]);
  const [pdfAvailable, setPdfAvailable] = useState(false);
  const [settings, setSettingsState] = useState(null);
  const [appearance, setAppearanceState] = useState({ accent: "grafito", density: "comfy" });

  // Load persisted state from the backend on startup.
  useEffect(() => {
    let alive = true;
    api.getState().then((s) => {
      if (!alive) return;
      setTemplates(s.templates || []);
      setHistory(s.history || []);
      setSettingsState(s.settings);
      setAppearanceState(s.appearance || { accent: "grafito", density: "comfy" });
      setPdfAvailable(!!s.pdfAvailable);
      setLoaded(true);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => { applyAccent(appearance.accent); }, [appearance.accent]);
  useEffect(() => { document.documentElement.setAttribute("data-density", appearance.density); }, [appearance.density]);
  useEffect(() => { document.title = TITLES[route] || "DocFill"; }, [route]);

  // Persisting setters.
  const setSettings = useCallback((next) => {
    setSettingsState(next);
    api.saveSettings(next);
  }, []);
  const setAppearance = useCallback((next) => {
    setAppearanceState(next);
    api.saveAppearance(next);
  }, []);

  const navTo = (r) => {
    if (r === "generate") setGenKey((k) => k + 1);
    setGenTemplate(null);
    setGenSource(null);
    setRoute(r);
  };
  const startGenerate = (templateId, source) => {
    setGenTemplate(templateId || null);
    setGenSource(source || null);
    setGenKey((k) => k + 1);
    setRoute("generate");
  };
  // Repeat a past run: reopen the wizard with the same template + source.
  const repeatRun = (entry) => {
    if (entry.templateId && templates.some((t) => t.id === entry.templateId)) {
      startGenerate(entry.templateId, entry.sourceKey || null);
    } else {
      startGenerate(null);
    }
  };

  const genDefaults = useMemo(() => settings && ({
    folder: settings.folder,
    tokens: settings.tokens,
    pdf: settings.pdf,
    overwrite: settings.overwrite,
    openAfter: settings.openAfter,
    autoFormat: settings.autoFormat !== false,
  }), [settings]);

  // Persist a template change (e.g. remembered Excel mapping) to state + disk.
  const persistTemplate = useCallback((updated) => {
    setTemplates((list) => list.map((t) => (t.id === updated.id ? updated : t)));
    api.updateTemplate(updated);
  }, []);

  if (!loaded || !settings) {
    return <div className="app-loading"><span className="spinner" /></div>;
  }

  return (
    <div className="app-shell">
      <TitleBar title={TITLES[route]} />
      <div className="app-body">
        <Sidebar route={route} onNav={navTo} />
        {route === "home" && <Home history={history} onNav={navTo} onStartGenerate={() => startGenerate(null)} onRepeat={repeatRun} />}
        {route === "templates" && <Templates templates={templates} setTemplates={setTemplates} onUse={(id) => startGenerate(id)} />}
        {route === "generate" && (
          <Generate
            key={genKey}
            initialTemplate={genTemplate}
            initialSource={genSource}
            templates={templates}
            defaults={genDefaults}
            pdfAvailable={pdfAvailable}
            onPersistTemplate={persistTemplate}
            onHome={() => navTo("home")}
          />
        )}
        {route === "settings" && (
          <Settings
            settings={settings}
            setSettings={setSettings}
            appearance={appearance}
            setAppearance={setAppearance}
            pdfAvailable={pdfAvailable}
          />
        )}
      </div>
    </div>
  );
}
