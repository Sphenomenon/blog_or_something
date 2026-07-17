import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  ARTICLE_IMAGE_FIXTURE_MARKER,
  ARTICLE_IMAGE_FIXTURE_TITLE,
  ARTICLE_IMAGE_REMOTE_URL,
  getArticleImageFixtureRuntime
} from "./article-image-fixture-config.mjs";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const FIXTURE_ROOT = path.join(PROJECT_ROOT, "scripts/fixtures/article-images");
const INVENTORY_PATH = path.join(FIXTURE_ROOT, "inventory.json");
const FIXTURE_EVIDENCE_ROOT = path.join(PROJECT_ROOT, ".sisyphus/evidence/article-media/fixtures");
const INVENTORY_EVIDENCE_PATH = path.join(FIXTURE_EVIDENCE_ROOT, "inventory.json");
const ISOLATION_EVIDENCE_PATH = path.join(FIXTURE_EVIDENCE_ROOT, "isolation.json");
const APP_SOURCE_ROOT = path.join(PROJECT_ROOT, "src");
const PRODUCTION_POST_ROOT = path.join(APP_SOURCE_ROOT, "content/posts");
const PUBLIC_UPLOAD_ROOT = path.join(PROJECT_ROOT, "public/images/uploads");
const ALLOWED_APP_MARKER_REFERENCES = new Set();

const requiredAssetCategories = new Set([
  "landscape",
  "large-jpeg",
  "portrait",
  "alpha",
  "exif-rotated",
  "above-1920",
  "below-480",
  "nested-same-basename"
]);

const requiredInvalidCategories = new Set([
  "empty-alt",
  "inline-media-plus-prose",
  "nested-directive",
  "unclosed-directive",
  "unknown-mode",
  "unknown-option",
  "image-count",
  "focal-misuse",
  "duplicate-focal",
  "focal-out-of-range",
  "gallery-count-1",
  "gallery-count-7",
  "gallery-prose",
  "unsafe-scheme-data",
  "unsafe-scheme-blob",
  "unsafe-scheme-file",
  "unsafe-scheme-javascript",
  "relative-url",
  "protocol-relative-url",
  "path-traversal",
  "encoded-traversal",
  "encoded-separator",
  "malformed-percent-encoding",
  "control-character",
  "local-query",
  "local-fragment"
]);

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function listFiles(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function relativeProjectPath(filePath) {
  return path.relative(PROJECT_ROOT, filePath).split(path.sep).join("/");
}

function assertInside(childPath, parentPath, label) {
  const relative = path.relative(parentPath, childPath);
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative), `${label} must stay inside ${relativeProjectPath(parentPath)}`);
}

function collectValidMarkdownContract(markdown, sourceMap) {
  const imageLines = markdown.split("\n").filter((line) => /^!\[[^\]]+\]\([^\s)]+(?: "[^"]*")?\)$/.test(line));
  const sources = imageLines.map((line) => line.match(/^!\[[^\]]+\]\(([^\s)]+)/)?.[1]).filter(Boolean);
  const localSources = sources.filter((source) => source.startsWith("/images/uploads/"));
  const remoteSources = sources.filter((source) => /^https?:\/\//.test(source));
  const captionedCount = imageLines.filter((line) => / "[^"]+"\)$/.test(line)).length;
  const galleryCounts = [];
  const lines = markdown.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index] !== ":::gallery") continue;
    let count = 0;
    index += 1;
    while (index < lines.length && lines[index] !== ":::") {
      if (lines[index].startsWith("![")) count += 1;
      index += 1;
    }
    galleryCounts.push(count);
  }

  assert.match(markdown, new RegExp(`^# ${ARTICLE_IMAGE_FIXTURE_TITLE}$`, "m"));
  assert.ok(markdown.includes(ARTICLE_IMAGE_FIXTURE_MARKER), "Valid Markdown must contain the unique leakage marker");
  assert.ok(markdown.includes(":::image wide\n"), "Valid Markdown must contain exact wide directive grammar");
  assert.ok(markdown.includes(":::image panorama focal=73%,31%\n"), "Valid Markdown must contain a non-central panorama focal point");
  assert.deepEqual(galleryCounts, [2, 6]);
  assert.equal(remoteSources.length, 1);
  assert.equal(remoteSources[0], ARTICLE_IMAGE_REMOTE_URL);
  assert.ok(captionedCount > 0 && captionedCount < imageLines.length, "Fixtures must mix captions and captionless images");
  assert.deepEqual(new Set(localSources), new Set(Object.keys(sourceMap)));

  return {
    imageLineCount: imageLines.length,
    localSourceCount: localSources.length,
    uniqueLocalSourceCount: new Set(localSources).size,
    remoteSources,
    captionedCount,
    captionlessCount: imageLines.length - captionedCount,
    galleryCounts,
    modes: ["standard", "wide", "panorama", "gallery"]
  };
}

async function verifyInventory(inventory) {
  assert.equal(inventory.schemaVersion, 1);
  assert.equal(inventory.marker, ARTICLE_IMAGE_FIXTURE_MARKER);
  assert.equal(inventory.title, ARTICLE_IMAGE_FIXTURE_TITLE);
  assert.equal(inventory.remoteUrl, ARTICLE_IMAGE_REMOTE_URL);
  assert.equal(inventory.runtimeRoot, ".sisyphus/evidence/article-media/fixture-runtime/");
  assert.equal(inventory.assets.length, 8);

  const categories = new Set(inventory.assets.flatMap((asset) => asset.categories));
  assert.deepEqual(categories, requiredAssetCategories);

  const basenameCounts = new Map();
  const assetResults = [];
  for (const asset of inventory.assets) {
    const assetPath = path.join(FIXTURE_ROOT, asset.file);
    assertInside(assetPath, FIXTURE_ROOT, `Fixture asset ${asset.file}`);
    const metadata = await sharp(assetPath).metadata();
    assert.equal(metadata.format, asset.format, `${asset.file} format mismatch`);
    assert.equal(metadata.width, asset.width, `${asset.file} width mismatch`);
    assert.equal(metadata.height, asset.height, `${asset.file} height mismatch`);
    if ("hasAlpha" in asset) assert.equal(metadata.hasAlpha, asset.hasAlpha, `${asset.file} alpha mismatch`);
    if ("orientation" in asset) assert.equal(metadata.orientation, asset.orientation, `${asset.file} EXIF orientation mismatch`);

    const oriented = metadata.autoOrient ?? { width: metadata.width, height: metadata.height };
    if ("orientedWidth" in asset) assert.equal(oriented.width, asset.orientedWidth, `${asset.file} oriented width mismatch`);
    if ("orientedHeight" in asset) assert.equal(oriented.height, asset.orientedHeight, `${asset.file} oriented height mismatch`);

    const basename = path.basename(asset.file);
    basenameCounts.set(basename, (basenameCounts.get(basename) ?? 0) + 1);
    assetResults.push({
      file: asset.file,
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      orientation: metadata.orientation ?? 1,
      orientedWidth: oriented.width,
      orientedHeight: oriented.height,
      hasAlpha: metadata.hasAlpha,
      categories: asset.categories
    });
  }

  assert.equal(basenameCounts.get("shared-name.jpg"), 2, "Expected two nested same-basename fixture sources");
  assert.equal(new Set(Object.values(inventory.sourceMap)).size, inventory.assets.length);

  const validMarkdownPath = path.join(FIXTURE_ROOT, inventory.validMarkdown);
  const validMarkdown = await readFile(validMarkdownPath, "utf8");
  const markdownContract = collectValidMarkdownContract(validMarkdown, inventory.sourceMap);
  const invalidRegistry = await readJson(path.join(FIXTURE_ROOT, inventory.invalidRegistry));
  const invalidCategories = new Set(invalidRegistry.cases.map((entry) => entry.category));
  assert.deepEqual(invalidCategories, requiredInvalidCategories);
  assert.equal(new Set(invalidRegistry.cases.map((entry) => entry.id)).size, invalidRegistry.cases.length);

  const invalidCases = [];
  for (const entry of invalidRegistry.cases) {
    const sourceReferenceCount = Number(typeof entry.file === "string") + Number(typeof entry.descriptor === "string");
    assert.equal(sourceReferenceCount, 1, `Invalid fixture ${entry.id} must define exactly one file or descriptor`);
    const sourceReference = entry.file ?? entry.descriptor;
    const casePath = path.join(FIXTURE_ROOT, sourceReference);
    assertInside(casePath, FIXTURE_ROOT, `Invalid fixture ${entry.id}`);
    const sourceControlledContent = await readFile(casePath, "utf8");
    assert.ok(sourceControlledContent.trim(), `Invalid fixture ${entry.id} source-controlled content must not be empty`);

    let content = sourceControlledContent;
    let sourceEncoding = "markdown-file";
    let controlCodePoint = null;
    if (entry.descriptor) {
      const descriptor = JSON.parse(sourceControlledContent);
      assert.equal(descriptor.encoding, "json-escaped-source", `Invalid fixture ${entry.id} descriptor encoding mismatch`);
      assert.equal(typeof descriptor.source, "string", `Invalid fixture ${entry.id} descriptor source must be a string`);
      assert.ok(descriptor.source.trim(), `Invalid fixture ${entry.id} reconstructed source must not be empty`);
      assert.equal(Number.isInteger(descriptor.controlCodePoint), true, `Invalid fixture ${entry.id} control code point must be an integer`);
      assert.ok(descriptor.controlCodePoint >= 0 && descriptor.controlCodePoint <= 31, `Invalid fixture ${entry.id} must describe an ASCII control character`);
      const escapedCodePoint = `\\u${descriptor.controlCodePoint.toString(16).padStart(4, "0")}`;
      assert.ok(sourceControlledContent.includes(escapedCodePoint), `Invalid fixture ${entry.id} must store the control character as ${escapedCodePoint}`);
      assert.equal(sourceControlledContent.includes(String.fromCodePoint(descriptor.controlCodePoint)), false, `Invalid fixture ${entry.id} descriptor must not contain a raw control character`);
      assert.ok(descriptor.source.includes(String.fromCodePoint(descriptor.controlCodePoint)), `Invalid fixture ${entry.id} must reconstruct the exact control character`);
      content = descriptor.source;
      sourceEncoding = descriptor.encoding;
      controlCodePoint = descriptor.controlCodePoint;
    }

    assert.ok(content.trim(), `Invalid fixture ${entry.id} must not be empty`);
    invalidCases.push({
      ...entry,
      lineCount: content.trimEnd().split("\n").length,
      sourceEncoding,
      controlCodePoint
    });
  }

  return {
    status: "passed",
    fixtureRoot: relativeProjectPath(FIXTURE_ROOT),
    marker: inventory.marker,
    title: inventory.title,
    assets: assetResults,
    categories: [...categories].sort(),
    markdown: markdownContract,
    invalidCases
  };
}

async function verifyIsolation(inventory) {
  const verificationRuntime = getArticleImageFixtureRuntime("verification");
  assert.throws(() => getArticleImageFixtureRuntime("production"), /only in Vite verification mode/);
  assertInside(verificationRuntime.runtimeRoot, path.join(PROJECT_ROOT, ".sisyphus/evidence/article-media"), "Fixture runtime root");
  assert.equal(relativeProjectPath(verificationRuntime.runtimeRoot), ".sisyphus/evidence/article-media/fixture-runtime");

  const fixtureFiles = await listFiles(FIXTURE_ROOT);
  for (const fixtureFile of fixtureFiles) {
    assert.equal(fixtureFile.startsWith(PRODUCTION_POST_ROOT + path.sep), false, `${relativeProjectPath(fixtureFile)} entered the production post glob`);
    assert.equal(fixtureFile.startsWith(PUBLIC_UPLOAD_ROOT + path.sep), false, `${relativeProjectPath(fixtureFile)} entered public uploads`);
  }

  const appSourceFiles = (await listFiles(APP_SOURCE_ROOT)).filter((filePath) => /\.(?:js|jsx|mjs|json|md|ya?ml)$/.test(filePath));
  const markerReferences = [];
  const fixturePathReferences = [];
  for (const appSourceFile of appSourceFiles) {
    const source = await readFile(appSourceFile, "utf8");
    const relative = relativeProjectPath(appSourceFile);
    if (source.includes(ARTICLE_IMAGE_FIXTURE_MARKER) && !ALLOWED_APP_MARKER_REFERENCES.has(relative)) markerReferences.push(relative);
    if (source.includes("scripts/fixtures/article-images")) fixturePathReferences.push(relative);
  }
  assert.deepEqual(markerReferences, [], "Unique fixture marker leaked into normal app modules");
  assert.deepEqual(fixturePathReferences, [], "Normal app modules reference fixture source paths");

  const cmsConfig = await readFile(path.join(PROJECT_ROOT, "public/admin/config.yml"), "utf8");
  assert.match(cmsConfig, /^media_folder: public\/images\/uploads$/m);
  assert.match(cmsConfig, /^\s+folder: src\/content\/posts$/m);
  assert.equal(cmsConfig.includes(ARTICLE_IMAGE_FIXTURE_MARKER), false);
  assert.equal(cmsConfig.includes("scripts/fixtures/article-images"), false);

  const sourceMapEntries = Object.entries(inventory.sourceMap).map(([url, fixtureRelativePath]) => {
    assert.ok(url.startsWith("/images/uploads/fixture/"), `Fixture source-map URL must exercise canonical local upload syntax: ${url}`);
    const fixturePath = path.join(FIXTURE_ROOT, fixtureRelativePath);
    assertInside(fixturePath, FIXTURE_ROOT, `Source map fixture ${url}`);
    return { url, fixture: relativeProjectPath(fixturePath) };
  });

  await mkdir(verificationRuntime.runtimeRoot, { recursive: true });
  await writeFile(verificationRuntime.runtimeManifestPath, `${JSON.stringify({
    schemaVersion: 1,
    mode: "verification",
    marker: ARTICLE_IMAGE_FIXTURE_MARKER,
    fixtureRoot: relativeProjectPath(verificationRuntime.fixtureRoot),
    sourceMap: inventory.sourceMap
  }, null, 2)}\n`, "utf8");

  return {
    status: "passed",
    productionPostGlob: "src/content/posts/*.md",
    cmsPostFolder: "src/content/posts",
    cmsUploadFolder: "public/images/uploads",
    fixtureFileCount: fixtureFiles.length,
    fixtureFiles: fixtureFiles.map(relativeProjectPath),
    appSourceFileCount: appSourceFiles.length,
    markerReferences,
    fixturePathReferences,
    sourceMapEntries,
    normalModeRejected: true,
    runtimeRoot: relativeProjectPath(verificationRuntime.runtimeRoot),
    runtimeManifestPath: relativeProjectPath(verificationRuntime.runtimeManifestPath),
    runtimeInsideEvidenceRoot: true,
    productionPathsModifiedByVerifier: []
  };
}

const inventory = await readJson(INVENTORY_PATH);
const inventoryReport = await verifyInventory(inventory);
const isolationReport = await verifyIsolation(inventory);

await mkdir(FIXTURE_EVIDENCE_ROOT, { recursive: true });
await writeFile(INVENTORY_EVIDENCE_PATH, `${JSON.stringify(inventoryReport, null, 2)}\n`, "utf8");
await writeFile(ISOLATION_EVIDENCE_PATH, `${JSON.stringify(isolationReport, null, 2)}\n`, "utf8");

console.log(`PASS article image fixture inventory (${inventoryReport.assets.length} assets, ${inventoryReport.invalidCases.length} invalid cases)`);
console.log(`PASS article image fixture isolation (${isolationReport.fixtureFileCount} source-controlled fixture files)`);
