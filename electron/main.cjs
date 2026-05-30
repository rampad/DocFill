// main.cjs — Electron main process: window, dialogs, document engine IPC
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");

const store = require("./engine/store.cjs");
const { detectVariables, toPreviewHtml } = require("./engine/docx.cjs");
const { readExcel } = require("./engine/xlsx.cjs");
const { generateDocuments } = require("./engine/generate.cjs");
const { isPdfAvailable } = require("./engine/pdf.cjs");
const { zipFiles, mergePdfs } = require("./engine/export.cjs");

const isDev = !!process.env.ELECTRON_DEV;
const DEV_URL = "http://127.0.0.1:5173";

let win;

function templatesDir() {
  const dir = path.join(app.getPath("userData"), "templates");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function ensureDefaultFolder() {
  const settings = store.store.get("settings");
  if (!settings.folder) {
    settings.folder = path.join(app.getPath("documents"), "DocFill");
    store.store.set("settings", settings);
  }
}

function createWindow() {
  const mac = process.platform === "darwin";
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: "#eceef1",
    show: false,
    frame: mac, // mac keeps native frame (hidden title); others are frameless
    titleBarStyle: mac ? "hiddenInset" : "default",
    trafficLightPosition: mac ? { x: 16, y: 15 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => win.show());

  // Screenshot mode for the README (DOCFILL_CAPTURE=1 electron .)
  if (process.env.DOCFILL_CAPTURE) {
    win.webContents.once("did-finish-load", async () => {
      const dir = path.join(__dirname, "..", "docs", "screenshots");
      fs.mkdirSync(dir, { recursive: true });
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const shot = async (name) => { const img = await win.webContents.capturePage(); fs.writeFileSync(path.join(dir, name + ".png"), img.toPNG()); };
      const nav = (label) => win.webContents.executeJavaScript(
        `(()=>{const b=[...document.querySelectorAll('.nav-item')].find(x=>x.textContent.includes(${JSON.stringify(label)}));if(b)b.click();})()`);
      try {
        await wait(1800); await shot("01-inicio");
        await nav("Plantillas"); await wait(1200); await shot("02-plantillas");
        await nav("Generar"); await wait(1200); await shot("03-generar");
        await nav("Configuración"); await wait(1200); await shot("04-configuracion");
      } catch (e) { console.error("capture error", e); }
      app.quit();
    });
  }
  const emitMax = () => win.webContents.send("window:maximized", win.isMaximized());
  win.on("maximize", emitMax);
  win.on("unmaximize", emitMax);

  if (isDev) {
    win.loadURL(DEV_URL);
    // Open DevTools only when explicitly requested (DOCFILL_DEVTOOLS=1).
    if (process.env.DOCFILL_DEVTOOLS) win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  ensureDefaultFolder();
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

// ---------------- Window controls ----------------
ipcMain.handle("window:minimize", () => win && win.minimize());
ipcMain.handle("window:maximizeToggle", () => {
  if (!win) return false;
  if (win.isMaximized()) win.unmaximize(); else win.maximize();
  return win.isMaximized();
});
ipcMain.handle("window:close", () => win && win.close());
ipcMain.handle("window:isMaximized", () => !!(win && win.isMaximized()));

// ---------------- State ----------------
ipcMain.handle("state:get", () => ({ ...store.getState(), pdfAvailable: isPdfAvailable(), platform: process.platform }));
ipcMain.handle("settings:save", (_e, s) => store.saveSettings(s));
ipcMain.handle("appearance:save", (_e, a) => store.saveAppearance(a));
ipcMain.handle("template:update", (_e, t) => store.upsertTemplate(t));
ipcMain.handle("template:delete", (_e, id) => store.deleteTemplate(id));

// ---------------- Fixed-value profiles ----------------
ipcMain.handle("profile:list", () => store.getProfiles());
ipcMain.handle("profile:save", (_e, p) => store.saveProfile(p));
ipcMain.handle("profile:delete", (_e, id) => store.deleteProfile(id));

// ---------------- Import a .docx template ----------------
function prettifyName(file) {
  return file.replace(/\.docx$/i, "").replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

async function importDocx(srcPath) {
  const buffer = fs.readFileSync(srcPath);
  const vars = detectVariables(buffer);
  const previewHtml = await toPreviewHtml(buffer);
  const id = "t" + Date.now();
  const file = path.basename(srcPath);
  const docxPath = path.join(templatesDir(), id + ".docx");
  fs.copyFileSync(srcPath, docxPath);
  const template = {
    id,
    name: prettifyName(file),
    file,
    docxPath,
    vars,
    previewHtml,
    meta: {},
    date: new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }),
  };
  return template;
}

ipcMain.handle("template:pickAndImport", async () => {
  const r = await dialog.showOpenDialog(win, {
    title: "Selecciona una plantilla de Word",
    filters: [{ name: "Documentos de Word", extensions: ["docx"] }],
    properties: ["openFile"],
  });
  if (r.canceled || !r.filePaths.length) return { canceled: true };
  try {
    const template = await importDocx(r.filePaths[0]);
    store.upsertTemplate(template);
    return { canceled: false, template };
  } catch (err) {
    return { canceled: false, error: "No se pudo leer el .docx: " + err.message };
  }
});

// Import a .docx by path (drag & drop) — no dialog.
ipcMain.handle("template:importPath", async (_e, p) => {
  if (!p || !/\.docx$/i.test(p)) return { canceled: false, error: "Arrastra un archivo .docx." };
  try {
    const template = await importDocx(p);
    store.upsertTemplate(template);
    return { canceled: false, template };
  } catch (err) {
    return { canceled: false, error: "No se pudo leer el .docx: " + err.message };
  }
});

ipcMain.handle("template:replaceDocx", async (_e, id) => {
  const r = await dialog.showOpenDialog(win, {
    title: "Reemplazar archivo .docx",
    filters: [{ name: "Documentos de Word", extensions: ["docx"] }],
    properties: ["openFile"],
  });
  if (r.canceled || !r.filePaths.length) return { canceled: true };
  const existing = store.getTemplate(id);
  if (!existing) return { canceled: false, error: "Plantilla no encontrada." };
  try {
    const buffer = fs.readFileSync(r.filePaths[0]);
    fs.writeFileSync(existing.docxPath, buffer);
    const updated = {
      ...existing,
      file: path.basename(r.filePaths[0]),
      vars: detectVariables(buffer),
      previewHtml: await toPreviewHtml(buffer),
    };
    store.upsertTemplate(updated);
    return { canceled: false, template: updated };
  } catch (err) {
    return { canceled: false, error: "No se pudo leer el .docx: " + err.message };
  }
});

// ---------------- Excel ----------------
ipcMain.handle("excel:pickAndRead", async () => {
  const r = await dialog.showOpenDialog(win, {
    title: "Selecciona uno o varios archivos Excel",
    filters: [{ name: "Hojas de cálculo", extensions: ["xlsx", "xlsm"] }],
    properties: ["openFile", "multiSelections"],
  });
  if (r.canceled || !r.filePaths.length) return { canceled: true };
  try {
    const files = [];
    for (const p of r.filePaths) {
      const data = await readExcel(p);
      files.push({ file: path.basename(p), ...data });
    }
    return { canceled: false, files };
  } catch (err) {
    return { canceled: false, error: "No se pudo leer el Excel: " + err.message };
  }
});

// Read Excel files by path (drag & drop) — no dialog.
ipcMain.handle("excel:readPaths", async (_e, paths) => {
  try {
    const files = [];
    for (const p of paths || []) {
      if (!/\.(xlsx|xlsm)$/i.test(p)) continue;
      const data = await readExcel(p);
      files.push({ file: path.basename(p), ...data });
    }
    if (!files.length) return { canceled: false, error: "Arrastra archivos .xlsx válidos." };
    return { canceled: false, files };
  } catch (err) {
    return { canceled: false, error: "No se pudo leer el Excel: " + err.message };
  }
});

// ---------------- Folder picker ----------------
ipcMain.handle("folder:pick", async () => {
  const r = await dialog.showOpenDialog(win, { title: "Carpeta de destino", properties: ["openDirectory", "createDirectory"] });
  if (r.canceled || !r.filePaths.length) return { canceled: true };
  return { canceled: false, path: r.filePaths[0] };
});

// ---------------- Generation ----------------
let genCancel = false;
ipcMain.handle("generate:cancel", () => { genCancel = true; });
ipcMain.handle("generate:run", async (e, payload) => {
  const template = store.getTemplate(payload.template.id) || payload.template;
  if (!template || !template.docxPath || !fs.existsSync(template.docxPath)) {
    return { error: "No se encuentra el archivo .docx de la plantilla." };
  }
  const buffer = fs.readFileSync(template.docxPath);
  genCancel = false;
  try {
    const result = await generateDocuments(
      { ...payload, template },
      buffer,
      (p) => e.sender.send("generate:progress", p),
      { shouldCancel: () => genCancel }
    );
    store.addHistory({
      id: Date.now(),
      templateId: template.id,
      template: template.name,
      count: result.files.length,
      when: new Date().toISOString(),
      source: payload.source === "excel" ? "Excel" : "Manual",
      sourceKey: payload.source,
      folder: result.outDir,
      cancelled: result.cancelled,
    });
    if (payload.options.openAfter && !result.cancelled) shell.openPath(result.outDir);
    return result;
  } catch (err) {
    return { error: err.message };
  }
});

// ---------------- Export / combine results ----------------
ipcMain.handle("result:zip", (_e, { paths, rootDir, name }) => {
  try { return { path: zipFiles(paths, rootDir, name || "DocFill_export") }; }
  catch (err) { return { error: err.message }; }
});
ipcMain.handle("result:mergePdf", async (_e, { pdfPaths, rootDir, name }) => {
  try { return { path: await mergePdfs(pdfPaths, rootDir, name || "DocFill_combinado") }; }
  catch (err) { return { error: err.message }; }
});

// ---------------- Shell helpers ----------------
ipcMain.handle("shell:openPath", (_e, p) => shell.openPath(p));
ipcMain.handle("shell:showItem", (_e, p) => shell.showItemInFolder(p));
