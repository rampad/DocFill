// Toggle switch
export default function Switch({ on, onChange }) {
  return (
    <button className={"switch" + (on ? " on" : "")} onClick={() => onChange(!on)} aria-pressed={on}><i /></button>
  );
}
