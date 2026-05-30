# LibreOffice (empaquetado para exportar a PDF)

DocFill convierte `.docx → .pdf` invocando **LibreOffice en modo headless**.
Para que el instalador funcione sin depender de una instalación previa del
usuario, aquí se empaqueta una copia portátil de LibreOffice.

`electron-builder` copia el contenido de esta carpeta a
`Contents/Resources/libreoffice` (mac) / `resources/libreoffice` (win/linux)
del paquete final (ver `extraResources` en `package.json`).

El binario se localiza en `electron/engine/pdf.cjs` buscando, en este orden:
1. `process.env.LIBREOFFICE_PATH`
2. la copia empaquetada bajo `resources/libreoffice`
3. una instalación del sistema (`/Applications/LibreOffice.app`, `C:/Program Files/LibreOffice`, …)

## Cómo poblar esta carpeta

Descarga LibreOffice para cada plataforma de destino y copia su contenido aquí
con esta estructura:

- **macOS** → `resources/libreoffice/LibreOffice.app/…`
  (arrastra `LibreOffice.app` completo dentro de esta carpeta)
- **Windows** → `resources/libreoffice/program/soffice.exe` (+ resto de `program/` y `share/`)
  Puede obtenerse de la versión *portable* o del directorio de instalación.
- **Linux** → `resources/libreoffice/program/soffice` (+ árbol de instalación)

> Nota: LibreOffice ocupa ~300–600 MB por plataforma. Empaqueta solo la(s)
> plataforma(s) que vayas a distribuir. En desarrollo, si tienes LibreOffice
> instalado en el sistema, el PDF ya funciona sin poblar esta carpeta.

Esta carpeta puede quedar vacía durante el desarrollo; la exportación a PDF
se desactiva automáticamente si no se encuentra ningún `soffice`.
