// export.cjs — bundle generated files into a .zip or merge PDFs into one.
const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");

// Zip a list of absolute file paths into outDir/<name>.zip, preserving the
// per-batch subfolder layout relative to the output root.
function zipFiles(paths, rootDir, name) {
  const zip = new PizZip();
  for (const p of paths) {
    if (!p || !fs.existsSync(p)) continue;
    let rel = path.relative(rootDir, p);
    if (rel.startsWith("..")) rel = path.basename(p); // outside root → flat
    zip.file(rel.split(path.sep).join("/"), fs.readFileSync(p));
  }
  const buf = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
  const out = path.join(rootDir, `${name}.zip`);
  fs.writeFileSync(out, buf);
  return out;
}

// Merge several PDFs into a single PDF. Lazy-require pdf-lib so the app still
// runs if the dep is missing (returns a clear error instead of crashing).
async function mergePdfs(pdfPaths, rootDir, name) {
  let PDFDocument;
  try { ({ PDFDocument } = require("pdf-lib")); }
  catch { throw new Error("Falta la dependencia pdf-lib para combinar PDFs."); }

  const existing = pdfPaths.filter((p) => p && fs.existsSync(p));
  if (existing.length === 0) throw new Error("No hay PDFs para combinar.");

  const merged = await PDFDocument.create();
  for (const p of existing) {
    const src = await PDFDocument.load(fs.readFileSync(p));
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((pg) => merged.addPage(pg));
  }
  const bytes = await merged.save();
  const out = path.join(rootDir, `${name}.pdf`);
  fs.writeFileSync(out, bytes);
  return out;
}

module.exports = { zipFiles, mergePdfs };
