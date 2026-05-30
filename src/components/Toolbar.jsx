// Page header
export default function Toolbar({ title, sub, children }) {
  return (
    <div className="toolbar">
      <div>
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      <div className="spacer" />
      {children}
    </div>
  );
}
