// Smoke test for the document engine (no Electron needed).
const fs = require("fs");
const os = require("os");
const path = require("path");
const PizZip = require("pizzip");
const { detectVariables, fillTemplate } = require("../electron/engine/docx.cjs");
const { patternToName, sanitize, generateDocuments } = require("../electron/engine/generate.cjs");

// Minimal valid .docx (OOXML) with {{variables}} in the body text.
function makeDocx(paragraphs) {
  const zip = new PizZip();
  zip.file("[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `</Types>`);
  zip.folder("_rels").file(".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `</Relationships>`);
  const body = paragraphs.map((t) =>
    `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`).join("");
  zip.folder("word").file("document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${body}<w:sectPr/></w:body></w:document>`);
  return zip.generate({ type: "nodebuffer" });
}

const buf = makeDocx([
  "FACTURA Nº {{numero_factura}}",
  "Cliente: {{cliente}} · NIF: {{nif}}",
  "Total: {{total}} €",
]);

const vars = detectVariables(buf);
console.log("detected vars:", vars);
const expected = ["numero_factura", "cliente", "nif", "total"];
const allFound = expected.every((v) => vars.includes(v));
console.log("all expected detected:", allFound);

const out = fillTemplate(buf, { numero_factura: "2026-0142", cliente: "Construcciones Vega S.L.", nif: "B12345678", total: "5.082,00" });
const filledXml = new PizZip(out).file("word/document.xml").asText();
const filledOk = filledXml.includes("2026-0142") && filledXml.includes("Construcciones Vega") && !filledXml.includes("{{");
console.log("fill produced expected text, no leftover placeholders:", filledOk);

const fname = patternToName(
  [{ type: "var", value: "cliente" }, { type: "lit", value: "_" }, { type: "var", value: "numero_factura" }],
  { cliente: "Construcciones Vega S.L.", numero_factura: "2026-0142" },
  "fallback"
);
console.log("filename:", fname, "| sanitize('Atelier Marín'):", sanitize("Atelier Marín"));

const tmp = path.join(os.tmpdir(), "docfill-smoke.docx");
fs.writeFileSync(tmp, out);
console.log("wrote:", tmp, fs.statSync(tmp).size, "bytes");

if (!allFound || !filledOk) { console.error("SMOKE TEST FAILED"); process.exit(1); }

// ---- multi-file batch test: two Excel "files" with DIFFERENT column order ----
(async () => {
  const tpl = makeDocx(["FACTURA {{numero_factura}}", "Cliente: {{cliente}}", "Total: {{total}}"]);
  const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), "docfill-multi-"));
  const payload = {
    template: { vars: ["cliente", "numero_factura", "total"] },
    source: "excel",
    // mapping references columns by NAME (colName) — order differs between files
    mapping: {
      cliente: { mode: "col", col: 0, colName: "Razón social" },
      numero_factura: { mode: "col", col: 1, colName: "Nº doc" },
      total: { mode: "fixed", value: "100" },
    },
    batches: [
      { file: "sucursal_A.xlsx", columns: ["Razón social", "Nº doc"], rows: [["Vega SL", "A-1"], ["Marín", "A-2"]] },
      // file B has the SAME headers in REVERSED order → colName resolution must still work
      { file: "sucursal_B.xlsx", columns: ["Nº doc", "Razón social"], rows: [["B-1", "Aurora"]] },
    ],
    options: { folder: outRoot, tokens: [{ type: "var", value: "cliente" }], pdf: false, overwrite: false },
  };
  const res = await generateDocuments(payload, tpl, () => {});
  const dirA = path.join(outRoot, "sucursal_A");
  const dirB = path.join(outRoot, "sucursal_B");
  const subfoldersOk = fs.existsSync(dirA) && fs.existsSync(dirB) && fs.readdirSync(dirA).length === 2 && fs.readdirSync(dirB).length === 1;
  // verify file B resolved "Aurora" via column name despite reversed order
  const bDoc = fs.readdirSync(dirB)[0];
  const bXml = new PizZip(fs.readFileSync(path.join(dirB, bDoc))).file("word/document.xml").asText();
  const colNameOk = bXml.includes("Aurora") && bXml.includes("B-1") && bXml.includes("100");
  console.log("multi-file: total docs:", res.total, "| batches:", res.batches, "| per-file subfolders:", subfoldersOk, "| colName resolution:", colNameOk);
  fs.rmSync(outRoot, { recursive: true, force: true });

  if (res.total !== 3 || res.batches !== 2 || !subfoldersOk || !colNameOk) { console.error("SMOKE TEST FAILED (multi-file)"); process.exit(1); }

  // ---- per-row failure tolerance: a bad template tag must not abort the batch ----
  const badTpl = makeDocx(["Hola {{nombre}}", "Saldo: {{importe}}}}"]); // unbalanced tag → row error
  const outBad = fs.mkdtempSync(path.join(os.tmpdir(), "docfill-bad-"));
  const resBad = await generateDocuments(
    { template: { vars: ["nombre", "importe"] }, source: "excel",
      mapping: { nombre: { mode: "col", col: 0, colName: "nombre" }, importe: { mode: "col", col: 1, colName: "importe" } },
      batches: [{ file: "x.xlsx", columns: ["nombre", "importe"], rows: [["Ana", "10"], ["Luis", "20"]] }],
      options: { folder: outBad, tokens: [{ type: "var", value: "nombre" }], pdf: false, overwrite: false } },
    badTpl, () => {}
  ).catch((e) => ({ threw: e.message }));
  const tolerated = resBad && !resBad.threw && Array.isArray(resBad.failures) && resBad.failures.length === 2 && resBad.files.length === 0;
  console.log("failure tolerance: did not abort:", !!(resBad && !resBad.threw), "| failures reported:", resBad && resBad.failures && resBad.failures.length);

  // ---- zip export ----
  const { zipFiles } = require("../electron/engine/export.cjs");
  const goodDir = fs.mkdtempSync(path.join(os.tmpdir(), "docfill-zip-"));
  fs.writeFileSync(path.join(goodDir, "a.docx"), "x");
  fs.writeFileSync(path.join(goodDir, "b.docx"), "y");
  const zipPath = zipFiles([path.join(goodDir, "a.docx"), path.join(goodDir, "b.docx")], goodDir, "export");
  const zipOk = fs.existsSync(zipPath) && new PizZip(fs.readFileSync(zipPath)).file("a.docx") != null;
  console.log("zip export: created and contains entries:", zipOk);

  fs.rmSync(outRoot, { recursive: true, force: true });
  fs.rmSync(outBad, { recursive: true, force: true });
  fs.rmSync(goodDir, { recursive: true, force: true });

  if (!tolerated || !zipOk) { console.error("SMOKE TEST FAILED (failures/zip)"); process.exit(1); }
  console.log("SMOKE TEST PASSED");
})();
