// store.cjs — persistent app state (templates, settings, history, appearance)
const Store = require("electron-store");

const DEFAULTS = {
  templates: [],
  settings: {
    folder: "", // resolved to ~/Documentos/DocFill on first run by main
    pdf: true,
    openAfter: true,
    overwrite: false,
    autoFormat: true,
    tokens: [
      { type: "var", value: "cliente" },
      { type: "lit", value: "_" },
      { type: "var", value: "fecha" },
    ],
  },
  appearance: { accent: "grafito", density: "comfy", lang: "es" },
  history: [],
  profiles: [], // reusable fixed-value sets: { id, name, values: { varName: value } }
};

const store = new Store({ name: "docfill", defaults: DEFAULTS });

function getState() {
  return {
    templates: store.get("templates"),
    settings: store.get("settings"),
    appearance: store.get("appearance"),
    history: store.get("history"),
    profiles: store.get("profiles"),
  };
}

function saveSettings(settings) { store.set("settings", settings); return store.get("settings"); }
function saveAppearance(appearance) { store.set("appearance", appearance); return store.get("appearance"); }

function upsertTemplate(t) {
  const list = store.get("templates");
  const i = list.findIndex((x) => x.id === t.id);
  if (i >= 0) list[i] = t; else list.unshift(t);
  store.set("templates", list);
  return list;
}

function deleteTemplate(id) {
  const list = store.get("templates").filter((t) => t.id !== id);
  store.set("templates", list);
  return list;
}

function getTemplate(id) {
  return store.get("templates").find((t) => t.id === id) || null;
}

function addHistory(entry) {
  const list = store.get("history");
  list.unshift(entry);
  store.set("history", list.slice(0, 50));
  return store.get("history");
}

function getProfiles() { return store.get("profiles"); }
function saveProfile(p) {
  const list = store.get("profiles");
  const i = list.findIndex((x) => x.id === p.id);
  if (i >= 0) list[i] = p; else list.unshift(p);
  store.set("profiles", list);
  return list;
}
function deleteProfile(id) {
  const list = store.get("profiles").filter((p) => p.id !== id);
  store.set("profiles", list);
  return list;
}

module.exports = {
  store, getState, saveSettings, saveAppearance,
  upsertTemplate, deleteTemplate, getTemplate, addHistory,
  getProfiles, saveProfile, deleteProfile,
};
