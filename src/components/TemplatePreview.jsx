import DocPreview from "./DocPreview.jsx";

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ESC[c]);

// Substitute {{var}} placeholders inside the template's mammoth-rendered HTML,
// wrapping filled values (and unfilled placeholders) in the same .doc-fill spans
// the body-based preview uses.
function fillHtml(html, values, flashKey) {
  return html.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_m, v) => {
    const val = values[v];
    if (val != null && String(val).trim() !== "") {
      return `<span class="doc-fill${flashKey === v ? " flash" : ""}">${escapeHtml(val)}</span>`;
    }
    return `<span class="doc-fill empty">{{${v}}}</span>`;
  });
}

// Renders a real imported .docx (previewHtml) or a structured sample (body).
export default function TemplatePreview({ template, values = {}, flashKey }) {
  if (template.previewHtml) {
    return <div className="doc-paper" dangerouslySetInnerHTML={{ __html: fillHtml(template.previewHtml, values, flashKey) }} />;
  }
  if (template.body) {
    return <DocPreview template={template} values={values} flashKey={flashKey} />;
  }
  return (
    <div className="doc-paper">
      {template.vars.map((v) => (
        <p key={v}>
          {v}: {values[v] != null && String(values[v]).trim() !== ""
            ? <span className={"doc-fill" + (flashKey === v ? " flash" : "")}>{String(values[v])}</span>
            : <span className="doc-fill empty">{"{{" + v + "}}"}</span>}
        </p>
      ))}
    </div>
  );
}
