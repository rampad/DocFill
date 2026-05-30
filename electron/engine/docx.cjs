// docx.cjs — detect {{variables}} and fill .docx templates with docxtemplater
const fs = require("fs");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const InspectModule = require("docxtemplater/js/inspect-module.js");
const mammoth = require("mammoth");

const DELIMITERS = { start: "{{", end: "}}" };

// Detect the {{variables}} present in a .docx buffer. docxtemplater's inspect
// module resolves tags even when Word splits them across multiple runs.
function detectVariables(buffer) {
  const zip = new PizZip(buffer);
  const iModule = new InspectModule();
  // Constructing Docxtemplater compiles the template and populates the module.
  // eslint-disable-next-line no-new
  new Docxtemplater(zip, {
    delimiters: DELIMITERS,
    modules: [iModule],
    paragraphLoop: true,
    linebreaks: true,
  });
  const tags = iModule.getAllTags() || {};
  // getAllTags returns a nested structure; top-level keys are the variable names.
  return Object.keys(tags);
}

// Render a .docx buffer to HTML for the live preview (placeholders preserved).
async function toPreviewHtml(buffer) {
  try {
    const { value } = await mammoth.convertToHtml({ buffer });
    return value || "";
  } catch {
    return "";
  }
}

// Fill a template buffer with a flat { var: value } map and return a .docx Buffer.
function fillTemplate(buffer, data) {
  const zip = new PizZip(buffer);
  const doc = new Docxtemplater(zip, {
    delimiters: DELIMITERS,
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "", // missing variables render as empty, never "undefined"
  });
  doc.render(data || {});
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
}

function detectFromPath(path) {
  return detectVariables(fs.readFileSync(path));
}

module.exports = { detectVariables, detectFromPath, toPreviewHtml, fillTemplate, DELIMITERS };
