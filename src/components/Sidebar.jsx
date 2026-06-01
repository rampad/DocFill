import Icon from "./Icon.jsx";
import { useT } from "../i18n.js";

const NAV = [
  { id: "home", key: "nav.home", icon: "home" },
  { id: "templates", key: "nav.templates", icon: "docs" },
  { id: "generate", key: "nav.generate", icon: "bolt" },
];

export default function Sidebar({ route, onNav }) {
  const { t } = useT();
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><Icon name="bolt" /></div>
        <div>
          <div className="brand-name">DocFill</div>
          <div className="brand-sub">{t("brand.sub")}</div>
        </div>
      </div>

      <nav className="nav">
        {NAV.map((n) => (
          <button key={n.id} className={"nav-item" + (route === n.id ? " active" : "")} onClick={() => onNav(n.id)}>
            <Icon name={n.icon} />
            {t(n.key)}
          </button>
        ))}
        <div className="nav-label">{t("nav.system")}</div>
        <button className={"nav-item" + (route === "settings" ? " active" : "")} onClick={() => onNav("settings")}>
          <Icon name="settings" />
          {t("nav.settings")}
        </button>
      </nav>
    </aside>
  );
}
