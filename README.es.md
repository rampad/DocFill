<div align="center">

[English](README.md) · **Español**

# ⚡ DocFill

**Rellena documentos de Word automáticamente a partir de datos.**

Aplicación de escritorio (macOS y Windows) para generar documentos `.docx` —y opcionalmente `.pdf`—
a partir de plantillas con variables `{{...}}`, usando datos de Excel o introducidos a mano.

Construida con **Electron + React + Vite**. Todo el procesamiento es **local**: tus datos no salen del equipo.

</div>

---

## 📸 Capturas

| Inicio | Generar (asistente) |
|:---:|:---:|
| ![Inicio](docs/screenshots/01-inicio.png) | ![Generar](docs/screenshots/03-generar.png) |
| **Plantillas** | **Configuración** |
| ![Plantillas](docs/screenshots/02-plantillas.png) | ![Configuración](docs/screenshots/04-configuracion.png) |

---

## ✨ Qué hace

Guardas plantillas de Word que contienen variables (`{{nombre}}`, `{{rut}}`, `{{fecha}}`…) y DocFill
genera los documentos rellenos: uno por cada fila de un Excel, combinando varios Excel, o desde un
formulario manual.

- 📄 **Plantillas** — sube un `.docx`, detecta automáticamente las variables `{{…}}` y edítalas
  (etiqueta legible, tipo: texto/fecha/número/importe, y valor por defecto). Vista previa del documento en vivo.
- ⚡ **Generar (asistente por pasos)** — plantilla → origen de datos → datos → confirmar → resultado.
- 📊 **Desde Excel (uno o varios archivos)**:
  - Un documento por cada fila de la **lista principal**.
  - Si cargas varios Excel, los demás aportan **datos compartidos** (iguales en todos) — útil para
    combinar, p. ej., una lista de empleados con los datos fijos de empresa y obra.
  - Mapeo automático **columna → variable** (por nombre, tolerante a mayúsculas/acentos/espacios),
    con opción de **valor fijo** por variable.
  - **Selección de filas**: todas, un rango o una lista (`1-5, 8, 12-20`).
- ✍️ **Manual** — formulario dinámico con validación y vista previa en vivo.
- 🧩 **Perfiles de valores fijos** — guarda conjuntos reutilizables (datos de empresa, etc.) y aplícalos de un clic.
- ✅ **Comprobación previa** — avisa de campos vacíos, números no válidos y nombres de archivo duplicados antes de generar.
- 🛡️ **Tolerancia a fallos** — si una fila falla, continúa el resto y se reporta cuáles fallaron.
- 🔢 **Formato automático** — importes `4.200,00`, fechas `dd/mm/aaaa` según el tipo de cada variable.
- 🗂️ **Nombre de archivo configurable** — patrón con variables + separadores (editable también en el paso de confirmar).
- 🧾 **PDF** — exporta una copia `.pdf` de cada documento (vía LibreOffice headless).
- 📦 **Al terminar** — abrir carpeta, **exportar todo en `.zip`** o **combinar los PDF en uno**.
- 🕘 **Historial** — actividad reciente con opción de **repetir** una generación.
- 🎨 **Apariencia** — color de acento, densidad; marco de ventana nativo (macOS / Windows); **idioma ES/EN**.
- 🖱️ **Arrastrar y soltar** archivos `.docx` / `.xlsx`.

---

## 🚀 Desarrollo

**Requisitos:** [Node.js 20](https://nodejs.org) y **pnpm** (vía Corepack).

> Nota: este proyecto usa **pnpm 10** (pnpm 11 no es compatible con Node 20). Actívalo con:
> `corepack prepare pnpm@10.34.1 --activate`

```bash
pnpm install          # instala dependencias (node-linker=hoisted, ver .npmrc)
pnpm dev              # Vite + Electron juntos (app de escritorio, recarga en caliente)
pnpm dev:web          # solo la UI en el navegador (backend simulado, sin motor nativo)
node scripts/smoke-engine.cjs   # prueba del motor de documentos (detectar/rellenar/zip/lotes)
```

Para ver las DevTools en `dev`: `DOCFILL_DEVTOOLS=1 pnpm dev`.

---

## 📦 Empaquetado (instaladores)

```bash
pnpm build:mac            # macOS, arquitectura actual (arm64) → release/*.dmg + *.zip
pnpm build:mac:universal  # macOS Intel + Apple Silicon (universal)
pnpm build:win            # Windows x64 → "release/DocFill Setup 0.1.0.exe"
```

La salida queda en `release/`. Los builds van **sin firmar** (`CSC_IDENTITY_AUTO_DISCOVERY=false`),
así que en equipos ajenos:
- **macOS**: clic derecho → *Abrir* (Gatekeeper).
- **Windows**: *Más información → Ejecutar de todos modos* (SmartScreen).

Para distribución sin avisos hace falta firma/notarización (Apple Developer ID en mac, certificado de
*code signing* en Windows) — son sistemas independientes.

### PDF / LibreOffice

La conversión `.docx → .pdf` usa **LibreOffice headless**. Orden de búsqueda del binario
(`electron/engine/pdf.cjs`): `LIBREOFFICE_PATH` → copia empaquetada → instalación del sistema. Si no
hay ninguno, la exportación a PDF se desactiva sola y solo se generan `.docx`.

Para **empaquetar** LibreOffice y que el PDF funcione sin instalación previa:

```bash
# macOS — descarga LibreOffice y lo copia a resources/libreoffice/ (~1 GB)
bash scripts/fetch-libreoffice-mac.sh

# Windows (ejecutar EN Windows) — ver scripts/BUNDLING-WINDOWS.md
pnpm fetch:lo:win
```

> Incluir LibreOffice añade ~700 MB–1 GB al instalador. Si `resources/libreoffice/` está vacío, el
> build sale ligero y el PDF usa el LibreOffice del sistema.

---

## 🧱 Arquitectura

```
electron/
  main.cjs            proceso principal: ventana, diálogos, IPC
  preload.cjs         puente seguro (contextBridge) → window.docfill
  engine/
    docx.cjs          detectar variables + rellenar (docxtemplater) + vista previa (mammoth)
    xlsx.cjs          leer Excel (exceljs)
    pdf.cjs           docx → pdf (LibreOffice headless)
    generate.cjs      orquestación: nombres, formato, escritura, progreso, fallos por fila
    export.cjs        zip de resultados + combinar PDFs (pdf-lib)
    store.cjs         estado persistente (electron-store): plantillas, ajustes, historial, perfiles
src/
  App.jsx             enrutado, estado, apariencia
  api.js              acceso unificado al backend (nativo o simulado en navegador)
  i18n.js             textos ES/EN + helper de traducción
  components/         Icon, TitleBar, Sidebar, Toolbar, DocPreview, TemplatePreview, Switch, FilenameBuilder
  screens/            Home, Templates, Generate, Settings
  styles.css          tokens de diseño + estilos
resources/libreoffice copia empaquetada de LibreOffice (mac; no se versiona)
scripts/              make-icon, fetch-libreoffice-*, smoke-engine
```

`src/api.js` unifica el acceso al backend: en Electron usa `window.docfill` (preload); en un navegador
normal (`pnpm dev:web`) cae a un modo simulado para poder explorar la UI sin el motor nativo.

---

## 🛠️ Stack

- **Electron 31** · **React 18** · **Vite 5**
- **docxtemplater** + **pizzip** (rellenar `.docx`)
- **exceljs** (leer Excel) · **mammoth** (vista previa) · **pdf-lib** (combinar PDF)
- **electron-store** (persistencia) · **electron-builder** (instaladores)
- **LibreOffice** headless (conversión a PDF)

---

## 🔒 Privacidad

Todo se procesa **en local**. Las plantillas y la configuración se guardan en la carpeta de datos de
la app del usuario; no se envía nada a ningún servidor.

---

## 📋 Notas

- Es una herramienta de escritorio real; las plantillas subidas se copian a los datos de la app.
- macOS universal **no** incluye LibreOffice (la copia empaquetada es arm64); para PDF offline en
  Apple Silicon usa el build `arm64`.

---

## 📄 Licencia

[MIT](LICENSE) © 2026 Benjamín Acosta Salinas
