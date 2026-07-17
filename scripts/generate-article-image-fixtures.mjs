import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const FIXTURE_ROOT = fileURLToPath(new URL("./fixtures/article-images/assets/", import.meta.url));

function svg(width, height, colors, label, alpha = false) {
  const [start, end] = colors;
  const background = alpha
    ? `<rect width="${width}" height="${height}" fill="none"/>`
    : `<rect width="${width}" height="${height}" fill="${start}"/>`;
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      ${background}
      <path d="M0 ${height} L${width} 0 L${width} ${height} Z" fill="${end}" fill-opacity="0.82"/>
      <circle cx="${Math.round(width * 0.72)}" cy="${Math.round(height * 0.28)}" r="${Math.max(24, Math.round(Math.min(width, height) * 0.13))}" fill="#d6a85f" fill-opacity="0.88"/>
      <text x="${Math.round(width * 0.06)}" y="${Math.round(height * 0.88)}" fill="#f4ead7" font-family="monospace" font-size="${Math.max(18, Math.round(Math.min(width, height) * 0.065))}">${label}</text>
    </svg>
  `);
}

const fixtures = [
  {
    file: "landscape-large.jpg",
    input: svg(1600, 900, ["#17232b", "#6f3d2f"], "LANDSCAPE"),
    format: "jpeg",
    options: { quality: 82, chromaSubsampling: "4:4:4" }
  },
  {
    file: "portrait.webp",
    input: svg(720, 1080, ["#252038", "#764d3a"], "PORTRAIT"),
    format: "webp",
    options: { quality: 82, effort: 6 }
  },
  {
    file: "alpha.png",
    input: svg(800, 600, ["#000000", "#365d68"], "ALPHA", true),
    format: "png",
    options: { compressionLevel: 9, palette: false }
  },
  {
    file: "exif-rotated.jpg",
    input: svg(640, 960, ["#283829", "#765036"], "EXIF-6"),
    format: "jpeg",
    options: { quality: 82, chromaSubsampling: "4:4:4" },
    orientation: 6
  },
  {
    file: "oversized-2400.jpg",
    input: svg(2400, 1350, ["#142c34", "#82452f"], "OVER-1920"),
    format: "jpeg",
    options: { quality: 80, chromaSubsampling: "4:2:0" }
  },
  {
    file: "small-320.jpg",
    input: svg(320, 240, ["#29333c", "#714534"], "UNDER-480"),
    format: "jpeg",
    options: { quality: 84, chromaSubsampling: "4:4:4" }
  },
  {
    file: "nested/alpha/shared-name.jpg",
    input: svg(900, 600, ["#203845", "#76543d"], "NESTED-A"),
    format: "jpeg",
    options: { quality: 82, chromaSubsampling: "4:4:4" }
  },
  {
    file: "nested/beta/shared-name.jpg",
    input: svg(600, 900, ["#30283f", "#7b493d"], "NESTED-B"),
    format: "jpeg",
    options: { quality: 82, chromaSubsampling: "4:4:4" }
  }
];

for (const fixture of fixtures) {
  const outputPath = path.join(FIXTURE_ROOT, fixture.file);
  await mkdir(path.dirname(outputPath), { recursive: true });
  let pipeline = sharp(fixture.input)[fixture.format](fixture.options);
  if (fixture.orientation) {
    pipeline = pipeline.withMetadata({ orientation: fixture.orientation });
  }
  await pipeline.toFile(outputPath);
}

console.log(`PASS generated ${fixtures.length} deterministic article image fixtures`);
