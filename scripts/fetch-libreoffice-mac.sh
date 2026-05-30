#!/usr/bin/env bash
# Download LibreOffice for macOS and place LibreOffice.app under
# resources/libreoffice/ so electron-builder bundles it (offline PDF export).
# Usage: scripts/fetch-libreoffice-mac.sh [version] [arch]   (arch: aarch64|x86_64)
set -euo pipefail

VER="${1:-26.2.3}"
ARCH="${2:-aarch64}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/resources/libreoffice"
URL="https://download.documentfoundation.org/libreoffice/stable/${VER}/mac/${ARCH}/LibreOffice_${VER}_MacOS_${ARCH}.dmg"
DMG="$(mktemp -t libreoffice).dmg"
MNT="$(mktemp -d -t lomnt)"

echo "↓ Descargando LibreOffice ${VER} (${ARCH})…"
curl -L --fail -o "$DMG" "$URL"

echo "⏏ Montando…"
hdiutil attach "$DMG" -nobrowse -mountpoint "$MNT" >/dev/null

APP="$(/bin/ls -d "$MNT"/*.app | head -1)"
echo "→ Copiando $(basename "$APP") a resources/libreoffice/ (puede tardar)…"
mkdir -p "$DEST"
rm -rf "$DEST/LibreOffice.app"
ditto "$APP" "$DEST/LibreOffice.app"

hdiutil detach "$MNT" >/dev/null
rm -f "$DMG"; rmdir "$MNT" 2>/dev/null || true

echo "✓ Listo: $DEST/LibreOffice.app"
"$DEST/LibreOffice.app/Contents/MacOS/soffice" --version 2>/dev/null | head -1 || echo "(soffice copiado)"
