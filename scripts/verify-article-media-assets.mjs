import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  ARTICLE_MEDIA_CONTENT_HASH_LENGTH,
  ARTICLE_MEDIA_PATH_HASH_LENGTH,
  generateArticleMediaAssets
} from "./article-media-assets.mjs";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const FIXTURE_ASSET_ROOT = path.join(PROJECT_ROOT, "scripts/fixtures/article-images/assets");
const EVIDENCE_ROOT = path.join(PROJECT_ROOT, ".sisyphus/evidence/article-media/assets");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function copyTree(sourceRoot, destinationRoot) {
  await mkdir(destinationRoot, { recursive: true });
  for (const entry of await readdir(sourceRoot, { withFileTypes: true })) {
    const sourcePath = path.join(sourceRoot, entry.name);
    const destinationPath = path.join(destinationRoot, entry.name);
    if (entry.isDirectory()) await copyTree(sourcePath, destinationPath);
    else if (entry.isFile()) await copyFile(sourcePath, destinationPath);
  }
}

async function snapshotFiles(root) {
  const snapshot = {};
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(entryPath);
      else if (entry.isFile()) {
        const relative = path.relative(root, entryPath).split(path.sep).join("/");
        const details = await stat(entryPath);
        snapshot[relative] = { hash: sha256(await readFile(entryPath)), mtimeMs: details.mtimeMs };
      }
    }
  }
  await visit(root);
  return snapshot;
}

function widths(record) {
  return record.variants.map((variant) => variant.width);
}

function variantPaths(record, outputRoot) {
  return record.variants.map((variant) => path.join(outputRoot, variant.src.slice("/images/optimized/articles/".length)));
}

async function expectFailure(action, expectedCode) {
  await assert.rejects(action, (error) => error?.code === expectedCode);
  return expectedCode;
}

const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "nocturne-article-media-"));
const sourceRoot = path.join(temporaryRoot, "uploads");
const optimizedRoot = path.join(temporaryRoot, "optimized");
const outputRoot = path.join(optimizedRoot, "articles");
const manifestPath = path.join(outputRoot, "manifest.json");

try {
  await copyTree(FIXTURE_ASSET_ROOT, sourceRoot);
  await sharp({ create: { width: 1000, height: 625, channels: 3, background: "#334455" } })
    .jpeg({ quality: 82 })
    .toFile(path.join(sourceRoot, "exact-1000.jpg"));
  await mkdir(path.join(sourceRoot, "encoded paths"), { recursive: true });
  await sharp({ create: { width: 640, height: 480, channels: 3, background: "#526477" } })
    .jpeg({ quality: 82 })
    .toFile(path.join(sourceRoot, "encoded paths/night market.jpg"));
  await mkdir(path.join(sourceRoot, "城市"), { recursive: true });
  await sharp({ create: { width: 720, height: 540, channels: 3, background: "#755263" } })
    .jpeg({ quality: 82 })
    .toFile(path.join(sourceRoot, "城市/夜景.jpg"));
  await writeFile(path.join(sourceRoot, "ignored.gif"), "unsupported discovery file\n", "utf8");
  await mkdir(outputRoot, { recursive: true });
  const unrelatedPath = path.join(optimizedRoot, "background.webp");
  const unrelatedArticlePath = path.join(outputRoot, "unrelated.keep");
  await writeFile(unrelatedPath, "unrelated optimized asset\n", "utf8");
  await writeFile(unrelatedArticlePath, "not manifest owned\n", "utf8");
  const unrelatedBefore = await readFile(unrelatedPath);

  const first = await generateArticleMediaAssets({ sourceRoot, outputRoot, manifestPath });
  assert.equal(first.sourceCount, 11, "Recursive discovery must include supported nested fixtures and encoded-path cases");
  assert.equal(first.manifest.schemaVersion, 1);
  assert.deepEqual(Object.keys(first.manifest.images), [...Object.keys(first.manifest.images)].sort());

  const spaceUrl = "/images/uploads/encoded%20paths/night%20market.jpg";
  const unicodeUrl = "/images/uploads/%E5%9F%8E%E5%B8%82/%E5%A4%9C%E6%99%AF.jpg";
  const oversized = first.manifest.images["/images/uploads/oversized-2400.jpg"];
  const exact1000 = first.manifest.images["/images/uploads/exact-1000.jpg"];
  const small = first.manifest.images["/images/uploads/small-320.jpg"];
  const rotated = first.manifest.images["/images/uploads/exif-rotated.jpg"];
  const alpha = first.manifest.images["/images/uploads/alpha.png"];
  const spaceRecord = first.manifest.images[spaceUrl];
  const unicodeRecord = first.manifest.images[unicodeUrl];
  assert.ok(spaceRecord, `Manifest must contain exact encoded space key ${spaceUrl}`);
  assert.ok(unicodeRecord, `Manifest must contain exact encoded Unicode key ${unicodeUrl}`);
  assert.equal("/images/uploads/encoded paths/night market.jpg" in first.manifest.images, false);
  assert.equal("/images/uploads/城市/夜景.jpg" in first.manifest.images, false);
  assert.ok(first.manifest.images["/images/uploads/exact-1000.jpg"], "Existing ASCII keys must remain unchanged");
  assert.deepEqual(widths(oversized), [480, 768, 1200, 1600, 1920]);
  assert.deepEqual(widths(exact1000), [480, 768, 1000]);
  assert.deepEqual(widths(small), [320]);
  assert.deepEqual([rotated.width, rotated.height], [960, 640]);
  assert.match(oversized.sourceFingerprint, /^sha256:[0-9a-f]{64}$/);

  for (const record of Object.values(first.manifest.images)) {
    assert.deepEqual(record.variants, [...record.variants].sort((left, right) => left.width - right.width));
    for (const variantPath of variantPaths(record, outputRoot)) assert.equal((await lstat(variantPath)).isFile(), true);
  }

  const alphaMetadata = await sharp(variantPaths(alpha, outputRoot)[0]).metadata();
  assert.equal(alphaMetadata.hasAlpha, true, "Alpha must survive WebP generation");
  const nestedAlpha = first.manifest.images["/images/uploads/nested/alpha/shared-name.jpg"].variants[0].src;
  const nestedBeta = first.manifest.images["/images/uploads/nested/beta/shared-name.jpg"].variants[0].src;
  assert.notEqual(nestedAlpha.split("/").at(-2), nestedBeta.split("/").at(-2), "Nested duplicate basenames need distinct path hashes");
  assert.match(nestedAlpha, new RegExp(`/[0-9a-f]{${ARTICLE_MEDIA_PATH_HASH_LENGTH}}/[0-9a-f]{${ARTICLE_MEDIA_CONTENT_HASH_LENGTH}}-w\\d+\\.webp$`));
  assert.notEqual(
    spaceRecord.variants[0].src.split("/").at(-2),
    unicodeRecord.variants[0].src.split("/").at(-2),
    "Encoded space and Unicode source URLs need distinct path hashes"
  );

  const referencedOutputRoot = path.join(temporaryRoot, "referenced-output");
  const referenced = await generateArticleMediaAssets({
    sourceRoot,
    outputRoot: referencedOutputRoot,
    manifestPath: path.join(referencedOutputRoot, "manifest.json"),
    sourceUrls: [spaceUrl, unicodeUrl]
  });
  assert.equal(referenced.sourceCount, 2);
  assert.deepEqual(Object.keys(referenced.manifest.images), [unicodeUrl, spaceUrl].sort());
  assert.ok(referenced.manifest.images[spaceUrl]);
  assert.ok(referenced.manifest.images[unicodeUrl]);

  const firstSnapshot = await snapshotFiles(outputRoot);
  await new Promise((resolve) => setTimeout(resolve, 30));
  const second = await generateArticleMediaAssets({ sourceRoot, outputRoot, manifestPath });
  assert.equal(second.writtenVariants, 0);
  assert.equal(second.manifestWritten, false);
  assert.deepEqual(await snapshotFiles(outputRoot), firstSnapshot, "Unchanged rerun must preserve bytes and mtimes");

  const changedUrl = "/images/uploads/exact-1000.jpg";
  const oldChangedRecord = second.manifest.images[changedUrl];
  await sharp({ create: { width: 1000, height: 625, channels: 3, background: "#884422" } })
    .jpeg({ quality: 82 })
    .toFile(path.join(sourceRoot, "exact-1000.jpg"));
  const changed = await generateArticleMediaAssets({ sourceRoot, outputRoot, manifestPath });
  const newChangedRecord = changed.manifest.images[changedUrl];
  assert.notEqual(newChangedRecord.sourceFingerprint, oldChangedRecord.sourceFingerprint);
  assert.notDeepEqual(newChangedRecord.variants.map((variant) => variant.src), oldChangedRecord.variants.map((variant) => variant.src));
  for (const oldPath of variantPaths(oldChangedRecord, outputRoot)) await assert.rejects(stat(oldPath), { code: "ENOENT" });

  const deletedUrl = "/images/uploads/small-320.jpg";
  const deletedRecord = changed.manifest.images[deletedUrl];
  await unlink(path.join(sourceRoot, "small-320.jpg"));
  const afterDelete = await generateArticleMediaAssets({ sourceRoot, outputRoot, manifestPath });
  assert.equal(deletedUrl in afterDelete.manifest.images, false);
  for (const deletedPath of variantPaths(deletedRecord, outputRoot)) await assert.rejects(stat(deletedPath), { code: "ENOENT" });
  assert.deepEqual(await readFile(unrelatedPath), unrelatedBefore, "General optimized assets must survive article cleanup");
  assert.equal(await readFile(unrelatedArticlePath, "utf8"), "not manifest owned\n");

  const unsafeRoot = path.join(temporaryRoot, "unsafe-uploads");
  const unsafeOutput = path.join(temporaryRoot, "unsafe-output");
  await mkdir(unsafeRoot, { recursive: true });
  await symlink(path.join(FIXTURE_ASSET_ROOT, "small-320.jpg"), path.join(unsafeRoot, "linked.jpg"));
  const symlinkError = await expectFailure(
    () => generateArticleMediaAssets({ sourceRoot: unsafeRoot, outputRoot: unsafeOutput, manifestPath: path.join(unsafeOutput, "manifest.json") }),
    "ARTICLE_MEDIA_SOURCE_SYMLINK"
  );
  const unsupportedError = await expectFailure(
    () => generateArticleMediaAssets({
      sourceRoot,
      outputRoot: path.join(temporaryRoot, "unsupported-output"),
      manifestPath: path.join(temporaryRoot, "unsupported-output/manifest.json"),
      sourceUrls: ["/images/uploads/ignored.gif"]
    }),
    "ARTICLE_MEDIA_SOURCE_FORMAT_UNSUPPORTED"
  );

  await mkdir(EVIDENCE_ROOT, { recursive: true });
  await writeFile(path.join(EVIDENCE_ROOT, "manifest.json"), `${JSON.stringify(afterDelete.manifest, null, 2)}\n`, "utf8");
  await writeFile(path.join(EVIDENCE_ROOT, "safety-report.json"), `${JSON.stringify({
    command: "npm run verify:article-media-assets",
    status: "passed",
    temporaryRootsOnly: true,
    recursiveSourceCount: first.sourceCount,
    encodedManifestKeys: [spaceUrl, unicodeUrl],
    referencedEncodedSourcesResolved: true,
    duplicateBasenamesDistinct: true,
    exifOrientedDimensions: { width: rotated.width, height: rotated.height },
    alphaPreserved: alphaMetadata.hasAlpha,
    widthCases: { source2400: widths(oversized), source1000: widths(exact1000), source320: widths(small) },
    unchangedRerunPreservedBytesAndMtimes: true,
    changedSourceChangedFingerprintAndUrls: true,
    deletedSourceCleanedOwnedVariants: true,
    unrelatedOutputSurvived: true,
    unrelatedArticleNamespaceFileSurvived: true,
    symlinkError,
    unsupportedError
  }, null, 2)}\n`, "utf8");

  console.log(`PASS article media asset verification (${first.sourceCount} recursive sources, deterministic manifest and safe cleanup)`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
