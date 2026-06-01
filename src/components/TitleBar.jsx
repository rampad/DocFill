import { useEffect, useState } from "react";
import Icon from "./Icon.jsx";
import { api } from "../api.js";
import { useT } from "../i18n.js";

// Real window title bar. On macOS the native frame (hiddenInset) draws the
// traffic lights, so we render only a draggable strip with the title. On
// Windows/Linux the window is frameless and we draw working controls.
export default function TitleBar({ title }) {
  const { t } = useT();
  const mac = api.platform === "darwin";
  const [maxed, setMaxed] = useState(false);

  useEffect(() => {
    let off;
    if (api.onMaximizeChange) off = api.onMaximizeChange(setMaxed);
    api.isMaximized && Promise.resolve(api.isMaximized()).then((v) => setMaxed(!!v));
    return () => off && off();
  }, []);

  if (mac) {
    return (
      <div className="titlebar app-drag" style={{ paddingLeft: 84 }}>
        <div className="title">{title}</div>
      </div>
    );
  }

  return (
    <div className="titlebar app-drag">
      <div className="win-brand">
        <span style={{ width: 16, height: 16, borderRadius: 4, background: "var(--accent)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="bolt" style={{ width: 10, height: 10 }} />
        </span>
        {title}
      </div>
      <div className="win-controls no-drag">
        <button title={t("win.minimize")} onClick={() => api.minimize()}><Icon name="win_min" /></button>
        <button title={maxed ? t("win.restore") : t("win.maximize")} onClick={() => api.maximizeToggle()}><Icon name="win_max" /></button>
        <button className="close" title={t("win.close")} onClick={() => api.close()}><Icon name="win_close" /></button>
      </div>
    </div>
  );
}
