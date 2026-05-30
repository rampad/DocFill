import Icon from "./Icon.jsx";

const NAV = [
  { id: "home", label: "Inicio", icon: "home" },
  { id: "templates", label: "Plantillas", icon: "docs" },
  { id: "generate", label: "Generar documentos", icon: "bolt" },
];

export default function Sidebar({ route, onNav }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><Icon name="bolt" /></div>
        <div>
          <div className="brand-name">DocFill</div>
          <div className="brand-sub">Plantillas de Word</div>
        </div>
      </div>

      <nav className="nav">
        {NAV.map((n) => (
          <button key={n.id} className={"nav-item" + (route === n.id ? " active" : "")} onClick={() => onNav(n.id)}>
            <Icon name={n.icon} />
            {n.label}
          </button>
        ))}
        <div className="nav-label">Sistema</div>
        <button className={"nav-item" + (route === "settings" ? " active" : "")} onClick={() => onNav("settings")}>
          <Icon name="settings" />
          Configuración
        </button>
      </nav>
    </aside>
  );
}
