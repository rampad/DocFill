// Live document preview
export default function DocPreview({ template, values, flashKey }) {
  const renderVal = (vname) => {
    const val = values[vname];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      return <span className={"doc-fill" + (flashKey === vname ? " flash" : "")} key={vname + val}>{String(val)}</span>;
    }
    return <span className="doc-fill empty">{"{{" + vname + "}}"}</span>;
  };
  return (
    <div className="doc-paper">
      {template.body.map((blk, i) => {
        if (blk.t === "h") {
          return <h4 key={i}>{blk.text}{blk.v ? <> {renderVal(blk.v)}</> : null}</h4>;
        }
        if (blk.parts) {
          return (
            <p key={i}>
              {blk.parts.map((part, j) =>
                typeof part === "string" ? <span key={j}>{part}</span> : <span key={j}>{renderVal(part.v)}</span>
              )}
            </p>
          );
        }
        return <p key={i}>{blk.text}</p>;
      })}
    </div>
  );
}
