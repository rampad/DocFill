# Empaquetar DocFill para Windows con LibreOffice incluido (PDF offline)

El instalador de Windows se puede generar desde macOS (electron-builder descarga
su propio *wine*), **pero LibreOffice para Windows hay que prepararlo en una
máquina Windows**, porque su instalador es un `.msi` que necesita herramientas de
Windows para extraerse. Por eso lo más sencillo es hacer todo el flujo en Windows.

## Pasos (en una máquina Windows)

Requisitos: [Node.js 20+](https://nodejs.org) y pnpm (`corepack enable pnpm`).

```powershell
# 1. Copia/clona el proyecto y entra en la carpeta
cd C:\ruta\a\Contratos

# 2. Instala dependencias
pnpm install

# 3. Descarga y extrae LibreOffice a resources\libreoffice-win\  (~1 GB)
pnpm fetch:lo:win
#   (equivale a: powershell -ExecutionPolicy Bypass -File scripts\fetch-libreoffice-win.ps1)

# 4. Genera el instalador  ->  release\DocFill Setup 0.1.0.exe
pnpm build:win
```

El `.exe` resultante incluirá LibreOffice y exportará PDF **sin** que el usuario
final tenga que instalar nada.

## Cómo lo encuentra la app

`electron/engine/pdf.cjs` busca el binario en este orden:

1. Variable de entorno `LIBREOFFICE_PATH` / `SOFFICE_PATH`
2. **Empaquetado**: `resources\libreoffice\program\soffice.exe` (lo que copia el script)
3. Instalación del sistema (`C:\Program Files\LibreOffice\program\soffice.exe`)

Si no encuentra ninguno, la exportación a PDF se desactiva sola y solo genera `.docx`.

## Notas

- **Sin LibreOffice empaquetado** (carpeta `resources\libreoffice-win\` vacía): el
  `.exe` sigue funcionando; el PDF usará el LibreOffice del sistema si existe.
- **Tamaño**: incluir LibreOffice añade ~700 MB–1 GB al instalador.
- **Firma**: el `.exe` va sin firmar → SmartScreen avisará. Para evitarlo hace
  falta un certificado de *code signing* de Windows.
- **Extraer el MSI sin Windows**: si tienes Linux/macOS con `msitools`
  (`msiextract`) puedes extraer el `.msi` y copiar el árbol `program\`+`share\`
  a `resources/libreoffice-win/` manualmente, pero el camino soportado es Windows.
