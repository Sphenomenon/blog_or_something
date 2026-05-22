/**
 * optimize-images.mjs
 *
 * Standalone script using sharp to optimize background and CMS-uploaded images.
 * Produces .webp variants at quality 80, resized to max 1920px width.
 *
 * Usage: npm run optimize-images
 *
 * Input directories:
 *   - backgrounds/         (7 background images: tech.png, essay.png, etc.)
 *   - public/images/uploads/  (CMS uploads, if any)
 *
 * Output directory:
 *   - public/images/optimized/  (mirrored to dist/ by Vite on build)
 */

import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ── Configuration ──────────────────────────────────────────────────────────
const QUALITY = 80;
const MAX_WIDTH = 1920;

const SOURCE_DIRS = [
  { root: "backgrounds", relative: "" },
  {
    root: "public/images/uploads",
    relative: "public/images/uploads",
  },
];

const OUTPUT_ROOT = "public/images/optimized";

// ── Helpers ────────────────────────────────────────────────────────────────
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg"]);

function isImageFile(name) {
  return IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase());
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
async function optimize() {
  let totalOptimized = 0;

  ensureDir(OUTPUT_ROOT);

  for (const { root, relative } of SOURCE_DIRS) {
    if (!fs.existsSync(root)) {
      console.log(`  Skipping (not found): ${root}`);
      continue;
    }

    const entries = fs.readdirSync(root);
    const imageFiles = entries.filter(isImageFile);

    if (imageFiles.length === 0) {
      console.log(`  No images to process in: ${root}`);
      continue;
    }

    for (const file of imageFiles) {
      const inputPath = path.join(root, file);
      const baseName = path.parse(file).name;
      const outputFile = `${baseName}.webp`;
      const outputPath = path.join(OUTPUT_ROOT, outputFile);

      // Skip if already exists (avoid re-processing)
      if (fs.existsSync(outputPath)) {
        console.log(`  Skipping (already exists): ${file} → ${outputFile}`);
        continue;
      }

      try {
        await sharp(inputPath)
          .webp({ quality: QUALITY })
          .resize({ width: MAX_WIDTH, withoutEnlargement: true })
          .toFile(outputPath);

        console.log(`  Optimizing: ${file} → ${outputFile} ✓`);
        totalOptimized++;
      } catch (err) {
        console.error(`  ERROR: ${file} — ${err.message}`);
        process.exitCode = 1;
      }
    }
  }

  console.log(`\nDone. ${totalOptimized} image${totalOptimized !== 1 ? "s" : ""} optimized.`);
  process.exit(process.exitCode ?? 0);
}

optimize();
