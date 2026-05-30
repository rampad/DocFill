// Generate build/icon.png (1024×1024). electron-builder derives .icns/.ico from it.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const S = 1024;
const scale = 21.7;
const off = (S - 24 * scale) / 2;
const bolt = "M13.2 2.2a.6.6 0 0 1 1.07.48L13 9.5h5.2a.7.7 0 0 1 .54 1.15l-8.9 10.9a.6.6 0 0 1-1.06-.48L10 14.5H4.8a.7.7 0 0 1-.54-1.15z";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#39434f"/>
      <stop offset="1" stop-color="#1f2630"/>
    </linearGradient>
  </defs>
  <rect width="${S}" height="${S}" rx="232" fill="url(#g)"/>
  <g transform="translate(${off} ${off}) scale(${scale})">
    <path d="${bolt}" fill="#ffffff"/>
  </g>
</svg>`;

const buildDir = path.join(__dirname, "..", "build");
fs.mkdirSync(buildDir, { recursive: true });
sharp(Buffer.from(svg)).png().toFile(path.join(buildDir, "icon.png"))
  .then((info) => console.log("build/icon.png written:", info.width + "x" + info.height))
  .catch((e) => { console.error(e); process.exit(1); });
