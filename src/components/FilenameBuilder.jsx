import Icon from "./Icon.jsx";
import { useT } from "../i18n.js";

// Visual filename-pattern builder. `tokens` is an array of
// { type: 'var'|'lit', value }. `options` are the variable names offered as
// chips to add (e.g. the template's variables).
export default function FilenameBuilder({ tokens, setTokens, options = [] }) {
  const { t } = useT();
  return (
    <div>
      <div className="token-build">
        {tokens.length === 0 && <span className="muted" style={{ fontSize: 12.5 }}>{t("fb.empty")}</span>}
        {tokens.map((tk, i) => (
          tk.type === "var" ? (
            <span className="ftoken" key={i}>
              {"{{" + tk.value + "}}"}
              <button onClick={() => setTokens(tokens.filter((_, j) => j !== i))}><Icon name="x" /></button>
            </span>
          ) : (
            <span className="ftoken lit" key={i}>
              {tk.value === "_" ? "«_»" : tk.value === "-" ? "«-»" : tk.value}
              <button onClick={() => setTokens(tokens.filter((_, j) => j !== i))}><Icon name="x" /></button>
            </span>
          )
        ))}
      </div>
      <div className="token-add">
        <span>{t("fb.addVar")}</span>
        {options.map((o) => (
          <button key={o} onClick={() => setTokens([...tokens, { type: "var", value: o }])}>+ {"{{" + o + "}}"}</button>
        ))}
        <button onClick={() => setTokens([...tokens, { type: "lit", value: "_" }])}>{t("fb.addSep")}</button>
        <button onClick={() => setTokens([...tokens, { type: "lit", value: "-" }])}>{t("fb.addDash")}</button>
      </div>
    </div>
  );
}
