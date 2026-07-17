import { copyFile, lstat, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { generateArticleMediaAssets } from "./article-media-assets.mjs";
import { canonicalizeArticleMediaUrl } from "../src/article-media.js";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const FIXTURE_ROOT = path.join(PROJECT_ROOT, "scripts/fixtures/article-images");
const INVENTORY_PATH = path.join(FIXTURE_ROOT, "inventory.json");
const RUNTIME_ROOT = path.join(PROJECT_ROOT, ".sisyphus/evidence/article-media/fixture-runtime");
const SOURCE_ROOT = path.join(RUNTIME_ROOT, "uploads");
const MANIFEST_PATH = path.join(RUNTIME_ROOT, "manifest.json");

function isInside(childPath, parentPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function assertExistingPathSegmentsAreNotSymlinks(targetPath, stopPath) {
  const relative = path.relative(stopPath, targetPath);
  let current = stopPath;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink()) {
        throw new Error(`ARTICLE_MEDIA_FIXTURE_SYMLINK: ${current}`);
      }
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
  }
}

export async function prepareArticleMediaVerificationRuntime() {
  const inventory = JSON.parse(await readFile(INVENTORY_PATH, "utf8"));
  if (inventory?.schemaVersion !== 1 || !inventory.sourceMap || typeof inventory.sourceMap !== "object" || Array.isArray(inventory.sourceMap)) {
    throw new Error(`ARTICLE_MEDIA_FIXTURE_INVENTORY_INVALID: Expected schemaVersion 1 and sourceMap object at ${INVENTORY_PATH}`);
  }
  await assertExistingPathSegmentsAreNotSymlinks(RUNTIME_ROOT, PROJECT_ROOT);
  await rm(RUNTIME_ROOT, { recursive: true, force: true });

  for (const [source, fixturePath] of Object.entries(inventory.sourceMap)) {
    const canonical = canonicalizeArticleMediaUrl(source, { source: INVENTORY_PATH });
    if (!canonical.ok || canonical.sourceType !== "local" || !canonical.source.startsWith("/images/uploads/fixture/")) {
      throw new Error(`ARTICLE_MEDIA_FIXTURE_SOURCE_INVALID: ${source}`);
    }
    if (typeof fixturePath !== "string" || fixturePath.length === 0) {
      throw new Error(`ARTICLE_MEDIA_FIXTURE_PATH_INVALID: ${source}`);
    }
    const fixtureSourcePath = path.resolve(FIXTURE_ROOT, fixturePath);
    if (!isInside(fixtureSourcePath, FIXTURE_ROOT) || fixtureSourcePath === FIXTURE_ROOT) {
      throw new Error(`ARTICLE_MEDIA_FIXTURE_PATH_OUTSIDE_ROOT: ${fixturePath}`);
    }
    await assertExistingPathSegmentsAreNotSymlinks(fixtureSourcePath, FIXTURE_ROOT);
    const relativeSource = canonical.source.slice("/images/uploads/".length);
    const targetPath = path.join(SOURCE_ROOT, ...relativeSource.split("/"));
    if (!isInside(targetPath, SOURCE_ROOT) || targetPath === SOURCE_ROOT) {
      throw new Error(`ARTICLE_MEDIA_FIXTURE_TARGET_OUTSIDE_ROOT: ${source}`);
    }
    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(fixtureSourcePath, targetPath);
  }

  const generation = await generateArticleMediaAssets({
    sourceRoot: SOURCE_ROOT,
    outputRoot: RUNTIME_ROOT,
    manifestPath: MANIFEST_PATH,
    sourceUrls: Object.keys(inventory.sourceMap)
  });
  return { inventory, generation };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { generation } = await prepareArticleMediaVerificationRuntime();
  console.log(`PASS article media verification runtime (${generation.sourceCount} sources, ${generation.writtenVariants} variants written)`);
}
