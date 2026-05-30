// pdf.cjs — convert .docx → .pdf using LibreOffice in headless mode.
// Prefers the LibreOffice bundled under resources/libreoffice, then a path from
// env, then common system install locations.
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

function bundledCandidates() {
  // process.resourcesPath exists in a packaged app; in dev we look in ./resources.
  const base = process.resourcesPath
    ? path.join(process.resourcesPath, "libreoffice")
    : path.join(__dirname, "..", "..", "resources", "libreoffice");
  if (process.platform === "darwin") {
    return [
      path.join(base, "LibreOffice.app", "Contents", "MacOS", "soffice"),
      path.join(base, "program", "soffice"),
    ];
  }
  if (process.platform === "win32") {
    return [
      path.join(base, "program", "soffice.exe"),
      path.join(base, "App", "libreoffice", "program", "soffice.exe"),
    ];
  }
  return [path.join(base, "program", "soffice"), path.join(base, "opt", "libreoffice", "program", "soffice")];
}

function systemCandidates() {
  if (process.platform === "darwin") {
    return ["/Applications/LibreOffice.app/Contents/MacOS/soffice"];
  }
  if (process.platform === "win32") {
    return [
      "C:/Program Files/LibreOffice/program/soffice.exe",
      "C:/Program Files (x86)/LibreOffice/program/soffice.exe",
    ];
  }
  return ["/usr/bin/soffice", "/usr/bin/libreoffice", "/snap/bin/libreoffice", "/opt/libreoffice/program/soffice"];
}

let cached;
function resolveSoffice() {
  if (cached !== undefined) return cached;
  const fromEnv = process.env.LIBREOFFICE_PATH || process.env.SOFFICE_PATH;
  const candidates = [
    ...(fromEnv ? [fromEnv] : []),
    ...bundledCandidates(),
    ...systemCandidates(),
  ];
  cached = candidates.find((p) => { try { return fs.existsSync(p); } catch { return false; } }) || null;
  return cached;
}

function isPdfAvailable() {
  return !!resolveSoffice();
}

// Converts inputDocxPath to a PDF in outDir, returning the produced .pdf path.
function convertToPdf(inputDocxPath, outDir) {
  return new Promise((resolve, reject) => {
    const soffice = resolveSoffice();
    if (!soffice) {
      reject(new Error("LibreOffice no encontrado (no se puede exportar a PDF)."));
      return;
    }
    const profileDir = path.join(os.tmpdir(), "docfill-lo-profile");
    const args = [
      "--headless", "--norestore", "--nolockcheck", "--nodefault", "--nofirststartwizard",
      `-env:UserInstallation=file://${profileDir.replace(/\\/g, "/")}`,
      "--convert-to", "pdf:writer_pdf_Export",
      "--outdir", outDir,
      inputDocxPath,
    ];
    const child = spawn(soffice, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      const out = path.join(outDir, path.basename(inputDocxPath).replace(/\.docx$/i, ".pdf"));
      if (code === 0 && fs.existsSync(out)) resolve(out);
      else reject(new Error(`Conversión a PDF falló (código ${code}). ${stderr}`.trim()));
    });
  });
}

module.exports = { convertToPdf, isPdfAvailable, resolveSoffice };
