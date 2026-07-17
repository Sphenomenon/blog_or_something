import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";
import { preview } from "vite";

import { ARTICLE_IMAGE_FIXTURE_MARKER, ARTICLE_IMAGE_FIXTURE_TITLE } from "./article-image-fixture-config.mjs";
import { validateProductionArticleMedia } from "./article-media-content-validator.mjs";
import { prepareArticleMediaVerificationRuntime } from "./prepare-article-media-verification.mjs";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const DIST_ROOT = path.join(PROJECT_ROOT, "dist");
const POST_ROOT = path.join(PROJECT_ROOT, "src/content/posts");
const FIXTURE_ROOT = path.join(PROJECT_ROOT, "scripts/fixtures/article-images");
const EVIDENCE_ROOT = path.join(PROJECT_ROOT, ".sisyphus/evidence/article-media/integration");
const EVIDENCE_PATH = path.join(EVIDENCE_ROOT, "production-isolation.json");
const BUILD_LOG_PATH = path.join(EVIDENCE_ROOT, "build.log");
const ROUTE_PATH = "/__verify__/article-images";
const FORBIDDEN_TEXT = [
  ARTICLE_IMAGE_FIXTURE_TITLE,
  ARTICLE_IMAGE_FIXTURE_MARKER,
  "scripts/fixtures/article-images",
  "/images/uploads/fixture/",
  "virtual:article-image-verification-fixture",
  "article-media-verification-route",
  ROUTE_PATH
];
const TEXT_EXTENSIONS = new Set([".css", ".html", ".js", ".json", ".map", ".svg", ".txt", ".xml"]);

async function listFiles(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`ARTICLE_MEDIA_ISOLATION_SYMLINK: ${entryPath}`);
    if (entry.isDirectory()) files.push(...await listFiles(entryPath));
    else if (entry.isFile()) files.push(entryPath);
    else throw new Error(`ARTICLE_MEDIA_ISOLATION_UNSUPPORTED_ENTRY: ${entryPath}`);
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function runBuild() {
  const env = { ...process.env };
  delete env.ARTICLE_IMAGE_MANIFEST_PATH;
  const result = spawnSync("npm", ["run", "build"], {
    cwd: PROJECT_ROOT,
    env,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 50,
    timeout: 10 * 60 * 1000
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  assert.equal(result.status, 0, `Production build failed${output ? `\n${output}` : ""}`);
  return output;
}

async function scanProductionSources() {
  const postFiles = (await listFiles(POST_ROOT)).filter((filePath) => filePath.endsWith(".md"));
  const cmsPath = path.join(PROJECT_ROOT, "public/admin/config.yml");
  const sourceFiles = [...postFiles, cmsPath];
  const matches = [];
  for (const filePath of sourceFiles) {
    const content = await readFile(filePath, "utf8");
    for (const token of FORBIDDEN_TEXT) {
      if (content.includes(token)) matches.push({ file: path.relative(PROJECT_ROOT, filePath), token });
    }
  }
  assert.deepEqual(matches, [], "Production posts or CMS configuration contain fixture records");
  return { postCount: postFiles.length, cmsPath: path.relative(PROJECT_ROOT, cmsPath), matches };
}

async function verifyValidatorFailures() {
  const temporaryRoot = await mkdtemp(path.join(PROJECT_ROOT, ".sisyphus/article-media-validator-"));
  const postRoot = path.join(temporaryRoot, "posts");
  const manifestPath = path.join(temporaryRoot, "manifest.json");
  await mkdir(postRoot, { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify({ schemaVersion: 1, images: {} }, null, 2)}\n`);
  await writeFile(path.join(postRoot, "malformed.md"), [
    "---",
    "title: Malformed",
    "---",
    "Intro line.",
    "",
    ":::gallery",
    "![Only item](/images/uploads/missing.jpg)",
    ":::"
  ].join("\n"));
  await writeFile(path.join(postRoot, "missing.md"), [
    "---",
    "title: Missing",
    "---",
    "Intro line.",
    "",
    "![Missing local](/images/uploads/missing.jpg)"
  ].join("\n"));
  await writeFile(path.join(postRoot, "remote.md"), [
    "---",
    "title: Remote",
    "---",
    "![Remote](https://article-media.invalid/never-fetch.jpg)"
  ].join("\n"));

  try {
    await assert.rejects(
      validateProductionArticleMedia({
        postRoot,
        manifestPath,
        manifest: {
          schemaVersion: 1,
          images: {
            "/images/uploads/missing.jpg": {
              width: 1200,
              height: 800,
              sourceFingerprint: "sha256:invalid",
              variants: []
            }
          }
        }
      }),
      /ARTICLE_MEDIA_MANIFEST_INVALID: Invalid dimensions, fingerprint, or variants/
    );
    const result = await validateProductionArticleMedia({ postRoot, manifestPath });
    const diagnostics = result.errors.map(({ line, code, message }) => ({ line, code, message }));
    assert.deepEqual(diagnostics.map(({ line, code }) => ({ line, code })), [
      { line: 6, code: "ARTICLE_MEDIA_GALLERY_COUNT" },
      { line: 6, code: "ARTICLE_MEDIA_LOCAL_MANIFEST_MISSING" }
    ]);
    assert.equal(diagnostics[0].message, "Gallery directives require between 2 and 6 images.");
    assert.match(diagnostics[1].message, /Local article image \/images\/uploads\/missing\.jpg is absent from \.sisyphus\/article-media-validator-/);
    assert.equal(result.remoteReferenceCount, 1);
    return { postCount: result.postCount, remoteReferenceCount: result.remoteReferenceCount, malformedManifestRejected: true, diagnostics };
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function scanDist() {
  const files = await listFiles(DIST_ROOT);
  const textualFiles = files.filter((filePath) => TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase()));
  const textMatches = [];
  for (const filePath of textualFiles) {
    const content = await readFile(filePath, "utf8");
    for (const token of FORBIDDEN_TEXT) {
      if (content.includes(token)) textMatches.push({ file: path.relative(DIST_ROOT, filePath), token });
    }
  }
  const pathMatches = files
    .map((filePath) => path.relative(DIST_ROOT, filePath).split(path.sep).join("/"))
    .filter((relativePath) => /fixture|articleimagesverification|verification-fixture/i.test(relativePath));
  const { inventory, generation } = await prepareArticleMediaVerificationRuntime();
  const fixtureSourceHashes = new Set();
  for (const fixturePath of Object.values(inventory.sourceMap)) {
    const bytes = await readFile(path.join(FIXTURE_ROOT, fixturePath));
    fixtureSourceHashes.add(createHash("sha256").update(bytes).digest("hex"));
  }
  const fixtureVariantPaths = new Set(Object.values(generation.manifest.images)
    .flatMap((record) => record.variants.map((variant) => variant.src.replace(/^\//, ""))));
  const binaryMatches = [];
  for (const filePath of files) {
    const relativePath = path.relative(DIST_ROOT, filePath).split(path.sep).join("/");
    const bytes = await readFile(filePath);
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (fixtureSourceHashes.has(hash) || fixtureVariantPaths.has(relativePath)) {
      binaryMatches.push({ file: relativePath, hash, exactFixtureSource: fixtureSourceHashes.has(hash), fixtureVariantPath: fixtureVariantPaths.has(relativePath) });
    }
  }
  assert.deepEqual(textMatches, [], "Production dist text contains verification fixture content");
  assert.deepEqual(pathMatches, [], "Production dist contains fixture-named assets or modules");
  assert.deepEqual(binaryMatches, [], "Production dist contains fixture source bytes or generated fixture derivative paths");
  return { fileCount: files.length, textualFileCount: textualFiles.length, textMatches, pathMatches, binaryMatches, fixtureSourceHashCount: fixtureSourceHashes.size, fixtureVariantPathCount: fixtureVariantPaths.size };
}

async function inspectProductionCollections() {
  const server = await import("vite").then(({ createServer }) => createServer({
    root: PROJECT_ROOT,
    configFile: path.join(PROJECT_ROOT, "vite.config.js"),
    mode: "production",
    appType: "custom",
    server: { middlewareMode: true },
    logLevel: "error"
  }));
  try {
    const module = await server.ssrLoadModule("/src/data/posts.js");
    const serialized = JSON.stringify(module.posts);
    assert.equal(serialized.includes(ARTICLE_IMAGE_FIXTURE_TITLE), false);
    assert.equal(serialized.includes(ARTICLE_IMAGE_FIXTURE_MARKER), false);
    assert.equal(module.posts.some((post) => post.slug === "__verify__-article-images"), false);

    const neighborReferences = module.posts.flatMap((post) => {
      const neighbors = module.getArticleNeighbors(post.slug, post.section);
      return [neighbors.previous?.slug, neighbors.next?.slug].filter(Boolean);
    });
    assert.equal(neighborReferences.includes("__verify__-article-images"), false);
    assert.equal(Object.keys(module.getTagCounts()).some((tag) => /verification|article-media/i.test(tag)), false);

    return {
      postCount: module.posts.length,
      slugs: module.posts.map((post) => post.slug),
      archiveYears: module.getArchiveYears(),
      fixtureSlugPresent: false,
      fixtureNeighborPresent: false,
      fixtureFilterTagPresent: false
    };
  } finally {
    await server.close();
  }
}

async function inspectPreview() {
  let server;
  let browser;
  let context;
  const pageErrors = [];
  try {
    server = await preview({
      root: PROJECT_ROOT,
      configFile: path.join(PROJECT_ROOT, "vite.config.js"),
      preview: { host: "127.0.0.1", port: 0, strictPort: false },
      logLevel: "error"
    });
    const address = server.httpServer.address();
    assert.ok(address && typeof address === "object", "Vite preview did not expose a TCP address");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ viewport: { width: 1024, height: 768 }, serviceWorkers: "block" });
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === baseUrl || url.protocol === "data:" || url.protocol === "blob:") await route.continue();
      else await route.fulfill({ status: 204, body: "" });
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`${baseUrl}${ROUTE_PATH}`, { waitUntil: "networkidle" });
    await page.getByTestId("not-found-view").waitFor({ state: "visible" });
    const state = await page.evaluate(({ title, marker }) => ({
      pathname: location.pathname,
      notFoundCount: document.querySelectorAll('[data-testid="not-found-view"]').length,
      verificationRouteCount: document.querySelectorAll('[data-testid="article-media-verification-route"]').length,
      fixtureTitlePresent: document.body.textContent.includes(title),
      fixtureMarkerPresent: document.documentElement.innerHTML.includes(marker)
    }), { title: ARTICLE_IMAGE_FIXTURE_TITLE, marker: ARTICLE_IMAGE_FIXTURE_MARKER });
    assert.equal(state.pathname, ROUTE_PATH);
    assert.equal(state.notFoundCount, 1);
    assert.equal(state.verificationRouteCount, 0);
    assert.equal(state.fixtureTitlePresent, false);
    assert.equal(state.fixtureMarkerPresent, false);
    assert.deepEqual(pageErrors, []);
    return { baseUrl, ...state, pageErrors };
  } finally {
    await Promise.allSettled([context?.close(), browser?.close(), server?.close()].filter(Boolean));
  }
}

await mkdir(EVIDENCE_ROOT, { recursive: true });
const productionValidation = await validateProductionArticleMedia();
assert.equal(productionValidation.ok, true, JSON.stringify(productionValidation.errors));
const buildLog = runBuild();
await writeFile(BUILD_LOG_PATH, `${buildLog}\n`);
const validatorFailures = await verifyValidatorFailures();
const sourceIsolation = await scanProductionSources();
const distIsolation = await scanDist();
const collections = await inspectProductionCollections();
const previewIsolation = await inspectPreview();
const report = {
  command: "npm run verify:article-media-isolation",
  passed: true,
  forbiddenText: FORBIDDEN_TEXT,
  productionValidation: {
    postCount: productionValidation.postCount,
    localReferenceCount: productionValidation.localReferenceCount,
    remoteReferenceCount: productionValidation.remoteReferenceCount,
    errors: productionValidation.errors
  },
  validatorFailures,
  sourceIsolation,
  distIsolation,
  collections,
  previewIsolation,
  buildLog: path.relative(PROJECT_ROOT, BUILD_LOG_PATH)
};
await writeFile(EVIDENCE_PATH, `${JSON.stringify(report, null, 2)}\n`);
console.log(`PASS article media production isolation (${distIsolation.textualFileCount} text assets, ${collections.postCount} posts, ordinary not-found preview)`);
