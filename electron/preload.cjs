// preload.cjs — safe bridge between the renderer and the main process.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("docfill", {
  platform: process.platform,

  // window controls
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximizeToggle: () => ipcRenderer.invoke("window:maximizeToggle"),
  close: () => ipcRenderer.invoke("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:isMaximized"),
  onMaximizeChange: (cb) => {
    const h = (_e, v) => cb(v);
    ipcRenderer.on("window:maximized", h);
    return () => ipcRenderer.removeListener("window:maximized", h);
  },

  // state
  getState: () => ipcRenderer.invoke("state:get"),
  saveSettings: (s) => ipcRenderer.invoke("settings:save", s),
  saveAppearance: (a) => ipcRenderer.invoke("appearance:save", a),

  // templates
  pickTemplate: () => ipcRenderer.invoke("template:pickAndImport"),
  importTemplatePath: (p) => ipcRenderer.invoke("template:importPath", p),
  replaceDocx: (id) => ipcRenderer.invoke("template:replaceDocx", id),
  updateTemplate: (t) => ipcRenderer.invoke("template:update", t),
  deleteTemplate: (id) => ipcRenderer.invoke("template:delete", id),

  // fixed-value profiles
  listProfiles: () => ipcRenderer.invoke("profile:list"),
  saveProfile: (p) => ipcRenderer.invoke("profile:save", p),
  deleteProfile: (id) => ipcRenderer.invoke("profile:delete", id),

  // excel + folders
  pickExcel: () => ipcRenderer.invoke("excel:pickAndRead"),
  readExcelPaths: (paths) => ipcRenderer.invoke("excel:readPaths", paths),
  pickFolder: () => ipcRenderer.invoke("folder:pick"),

  // export / combine
  zipResults: (args) => ipcRenderer.invoke("result:zip", args),
  mergePdfs: (args) => ipcRenderer.invoke("result:mergePdf", args),

  // generation
  generate: (payload) => ipcRenderer.invoke("generate:run", payload),
  cancelGenerate: () => ipcRenderer.invoke("generate:cancel"),
  onGenerateProgress: (cb) => {
    const h = (_e, p) => cb(p);
    ipcRenderer.on("generate:progress", h);
    return () => ipcRenderer.removeListener("generate:progress", h);
  },

  // shell
  openPath: (p) => ipcRenderer.invoke("shell:openPath", p),
  showItem: (p) => ipcRenderer.invoke("shell:showItem", p),
});
