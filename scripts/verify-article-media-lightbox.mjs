import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";
import { createServer } from "vite";

import { generateArticleMediaAssets } from "./article-media-assets.mjs";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const FIXTURE_ROOT = path.join(PROJECT_ROOT, "scripts/fixtures/article-images");
const RUNTIME_ROOT = path.join(PROJECT_ROOT, ".sisyphus/evidence/article-media/lightbox-runtime");
const SOURCE_ROOT = path.join(RUNTIME_ROOT, "uploads");
const OUTPUT_ROOT = path.join(RUNTIME_ROOT, "optimized");
const MANIFEST_PATH = path.join(OUTPUT_ROOT, "manifest.json");
const EVIDENCE_ROOT = path.join(PROJECT_ROOT, ".sisyphus/evidence/article-media/browser");
const STANDALONE_REPORT_PATH = path.join(EVIDENCE_ROOT, "lightbox-standalone.json");
const GALLERY_REPORT_PATH = path.join(EVIDENCE_ROOT, "lightbox-gallery.json");
const REMOTE_URL = "https://article-media.invalid/intercepted/lightbox-remote.jpg";
const VIEWPORTS = [
  { width: 1440, height: 900, screenshot: "lightbox-open-desktop.png" },
  { width: 375, height: 812, screenshot: "lightbox-open-mobile.png" }
];

const fixtureSources = {
  "/images/uploads/fixture/oversized-2400.jpg": "assets/oversized-2400.jpg",
  "/images/uploads/fixture/alpha.png": "assets/alpha.png",
  "/images/uploads/fixture/exif-rotated.jpg": "assets/exif-rotated.jpg",
  "/images/uploads/fixture/portrait.webp": "assets/portrait.webp"
};

function harnessModule() {
  return `
    import React, { useState } from "react";
    import { createRoot } from "react-dom/client";
    import { ArticleMediaFigure, ArticleMediaGallery, ArticleMediaLightbox } from "/src/components/ArticleMedia.jsx";
    import { MusicEasterEgg } from "/src/components/MusicEasterEgg.jsx";
    import "/src/styles.css";

    const local = (source, mode, alt, caption, line, focal = null) => ({
      source, sourceType: "local", mode, alt, caption, line, focal,
      articleSource: "scripts/fixtures/article-images/markdown/valid.md"
    });
    const remote = {
      source: ${JSON.stringify(REMOTE_URL)}, sourceType: "remote", mode: "wide",
      alt: "Remote exact alternative", caption: null, line: 18, focal: null,
      articleSource: "scripts/fixtures/article-images/markdown/valid.md"
    };
    const gallery = {
      images: [
        local("/images/uploads/fixture/alpha.png", "gallery", "Gallery alpha alternative", "Gallery alpha caption", 21),
        local("/images/uploads/fixture/exif-rotated.jpg", "gallery", "Gallery rotated alternative", null, 22),
        local("/images/uploads/fixture/portrait.webp", "gallery", "Gallery portrait alternative", "Gallery portrait caption", 23)
      ]
    };

    function ArticleHarness({ ownerKey }) {
      return <ArticleMediaLightbox ownerKey={ownerKey}>
        <article className="prose" data-testid="article-card">
          <h1>Article lightbox verification</h1>
          <div style={{ height: "720px" }} aria-hidden="true" />
          <ArticleMediaFigure image={local("/images/uploads/fixture/oversized-2400.jpg", "standard", "Standalone exact alternative", "Standalone authored caption", 7)} mediaOrder={1} />
          <ArticleMediaFigure image={remote} mediaOrder={2} />
          <ArticleMediaGallery block={gallery} galleryOrder={1} mediaStartOrder={3} articleSource="scripts/fixtures/article-images/markdown/valid.md" />
          <div style={{ height: "1000px" }} aria-hidden="true" />
        </article>
      </ArticleMediaLightbox>;
    }

    function Harness() {
      const [route, setRoute] = useState("article-a");
      return <main className="app-shell">
        <button type="button" data-testid="route-toggle" onClick={() => setRoute((value) => value === "other" ? "article-b" : "other")}>Change route</button>
        {route === "other" ? <section data-testid="other-route" style={{ minHeight: "4000px" }}><h1>Other route</h1></section> : <ArticleHarness ownerKey={route} />}
        <MusicEasterEgg variant="mini" isHomeReady />
      </main>;
    }

    createRoot(document.getElementById("root")).render(<Harness />);
  `;
}

function verificationPlugin() {
  return {
    name: "article-media-lightbox-harness",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.url === "/__article-media-lightbox-harness") {
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Article lightbox verification</title></head><body style="color-scheme: dark; --verify-body: preserved;"><div id="root"></div><script type="module" src="/__article-media-lightbox-harness.jsx"></script></body></html>');
          return;
        }
        if (request.url?.startsWith("/images/optimized/articles/")) {
          const relative = request.url.slice("/images/optimized/articles/".length).split("?", 1)[0];
          const assetPath = path.resolve(OUTPUT_ROOT, ...relative.split("/"));
          if (assetPath.startsWith(`${path.resolve(OUTPUT_ROOT)}${path.sep}`)) {
            try {
              response.setHeader("Content-Type", "image/webp");
              response.end(await readFile(assetPath));
              return;
            } catch (error) {
              if (error.code !== "ENOENT") throw error;
            }
          }
        }
        next();
      });
    },
    load(id) {
      if (id === "/__article-media-lightbox-harness.jsx") return harnessModule();
      return null;
    }
  };
}

async function prepareRuntime() {
  await rm(RUNTIME_ROOT, { recursive: true, force: true });
  for (const [source, fixture] of Object.entries(fixtureSources)) {
    const relative = source.slice("/images/uploads/".length);
    const target = path.join(SOURCE_ROOT, ...relative.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(FIXTURE_ROOT, fixture), target);
  }
  await generateArticleMediaAssets({ sourceRoot: SOURCE_ROOT, outputRoot: OUTPUT_ROOT, manifestPath: MANIFEST_PATH });
}

async function getState(page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('[data-testid="article-media-dialog"]');
    const image = document.querySelector('[data-testid="article-media-dialog-image"]');
    const active = document.activeElement;
    const iframe = document.querySelector('[data-testid="music-easter-egg-player"]');
    return {
      bodyStyle: document.body.getAttribute("style"),
      dialogOpen: dialog?.open === true,
      dialogLabelledBy: dialog?.getAttribute("aria-labelledby") ?? null,
      dialogTransitionDuration: dialog ? getComputedStyle(dialog).transitionDuration : null,
      imageAlt: image?.getAttribute("alt") ?? null,
      imageSrc: image?.getAttribute("src") ?? null,
      imageCurrentSrc: image?.currentSrc ?? null,
      imageComplete: image?.complete ?? false,
      imageNaturalWidth: image?.naturalWidth ?? 0,
      imageNaturalHeight: image?.naturalHeight ?? 0,
      imageMediaOrder: image?.dataset.mediaOrder ?? null,
      imageFullSource: image?.dataset.mediaFullSource ?? null,
      imageGalleryIndex: image?.dataset.galleryIndex ?? null,
      caption: dialog?.querySelector("figcaption")?.textContent ?? null,
      status: document.querySelector('[data-testid="article-media-dialog-status"]')?.textContent?.trim() ?? null,
      activeTestId: active?.getAttribute?.("data-testid") ?? null,
      focusInside: dialog?.contains(active) ?? false,
      navigationCount: dialog?.querySelectorAll('[data-testid="article-media-dialog-previous"], [data-testid="article-media-dialog-next"]').length ?? 0,
      iframeCount: document.querySelectorAll('[data-testid="music-easter-egg-player"]').length,
      iframeSrc: iframe?.src ?? null,
      route: document.querySelector('[data-testid="other-route"]') ? "other" : "article"
    };
  });
}

async function waitForActiveImage(page, expected) {
  const expectedUrl = new URL(expected.fullSource, page.url()).href;
  await page.waitForFunction(({ fullSource, mediaOrder, galleryIndex }) => {
    const image = document.querySelector('[data-testid="article-media-dialog-image"]');
    return image?.dataset.mediaFullSource === fullSource &&
      image.dataset.mediaOrder === String(mediaOrder) &&
      (galleryIndex === undefined || image.dataset.galleryIndex === String(galleryIndex)) &&
      image.complete && image.naturalWidth > 0 && image.naturalHeight > 0 &&
      image.currentSrc === new URL(fullSource, window.location.href).href;
  }, expected);
  const loaded = await getState(page);
  assert.equal(loaded.imageFullSource, expected.fullSource);
  assert.equal(loaded.imageMediaOrder, String(expected.mediaOrder));
  if (expected.galleryIndex !== undefined) assert.equal(loaded.imageGalleryIndex, String(expected.galleryIndex));
  assert.equal(loaded.imageCurrentSrc, expectedUrl);
  assert.equal(loaded.imageComplete, true);
  assert.ok(loaded.imageNaturalWidth > 0);
  assert.ok(loaded.imageNaturalHeight > 0);
  return loaded;
}

async function assertFocusTrap(page) {
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press("Tab");
    assert.equal(await page.locator('[data-testid="article-media-dialog"]').evaluate((dialog) => dialog.contains(document.activeElement)), true, "Tab escaped dialog");
  }
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.locator('[data-testid="article-media-dialog"]').evaluate((dialog) => dialog.contains(document.activeElement)), true, "Shift+Tab escaped dialog");
  }
}

async function runScenario(browser, baseUrl, viewport, reducedMotion) {
  const context = await browser.newContext({ viewport, reducedMotion });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const requests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) consoleErrors.push(message.text());
  });
  page.on("request", (request) => requests.push(request.url()));
  await page.route(REMOTE_URL, async (route) => {
    const body = await readFile(path.join(FIXTURE_ROOT, "assets/landscape-large.jpg"));
    await route.fulfill({ status: 200, contentType: "image/jpeg", body });
  });
  await page.route(/music\.163\.com/, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>music fixture</title>" }));

  await page.goto(`${baseUrl}/__article-media-lightbox-harness`, { waitUntil: "networkidle" });
  const opener = page.getByTestId("article-media-opener-1");
  await opener.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 640));
  await page.waitForTimeout(50);
  const before = await page.evaluate(() => ({
    bodyStyle: document.body.getAttribute("style"),
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    fullSource: document.querySelector('[data-testid="article-media-opener-1"]').dataset.mediaFullSource,
    enlargedCount: document.querySelectorAll('[data-testid="article-media-dialog-image"]').length
  }));
  assert.equal(before.enlargedCount, 0, "Enlarged image must not exist before open");
  assert.equal(requests.includes(new URL(before.fullSource, baseUrl).href), false, "Full source requested before open");
  const musicBefore = await getState(page);

  await opener.focus();
  await page.keyboard.press("Enter");
  await page.getByTestId("article-media-dialog").waitFor({ state: "visible" });
  let state = await waitForActiveImage(page, { fullSource: before.fullSource, mediaOrder: 1 });
  assert.equal(state.dialogOpen, true);
  assert.equal(state.dialogLabelledBy, "article-lightbox-title");
  assert.equal(state.activeTestId, "article-media-dialog-close");
  assert.equal(state.imageAlt, "Standalone exact alternative");
  assert.equal(state.caption, "Standalone authored caption");
  assert.equal(state.navigationCount, 0);
  assert.equal(requests.includes(new URL(before.fullSource, baseUrl).href), true, "Full source not requested after open");
  assert.equal(state.iframeCount, musicBefore.iframeCount);
  assert.equal(state.iframeSrc, musicBefore.iframeSrc);
  if (reducedMotion === "reduce") assert.equal(state.dialogTransitionDuration, "0s");
  await assertFocusTrap(page);

  await page.getByTestId("article-media-dialog-image").click({ position: { x: 10, y: 10 } });
  assert.equal((await getState(page)).dialogOpen, true, "Image click closed dialog");
  const dialogBox = await page.getByTestId("article-media-dialog").boundingBox();
  assert.ok(dialogBox);
  await page.mouse.click(Math.max(1, dialogBox.x - 4), Math.max(1, dialogBox.y - 4));
  assert.equal((await getState(page)).dialogOpen, false, "Backdrop click did not close dialog");
  assert.equal(await opener.evaluate((element) => document.activeElement === element), true, "Backdrop close did not restore opener focus");
  let restored = await page.evaluate(() => ({ bodyStyle: document.body.getAttribute("style"), scrollX: window.scrollX, scrollY: window.scrollY }));
  assert.deepEqual(restored, { bodyStyle: before.bodyStyle, scrollX: before.scrollX, scrollY: before.scrollY });

  await opener.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  assert.equal((await getState(page)).dialogOpen, false, "Escape did not close dialog");
  assert.equal(await opener.evaluate((element) => document.activeElement === element), true, "Escape did not restore opener focus");

  const remoteOpener = page.getByTestId("article-media-opener-2");
  await remoteOpener.scrollIntoViewIfNeeded();
  await remoteOpener.focus();
  await page.keyboard.press("Enter");
  state = await waitForActiveImage(page, { fullSource: REMOTE_URL, mediaOrder: 2 });
  assert.equal(state.imageSrc, REMOTE_URL);
  assert.equal(state.imageAlt, "Remote exact alternative");
  assert.equal(state.caption, null);
  assert.equal(state.navigationCount, 0);
  await page.getByTestId("article-media-dialog-close").click();
  assert.equal((await getState(page)).dialogOpen, false, "Close button did not close dialog");
  assert.equal(await remoteOpener.evaluate((element) => document.activeElement === element), true, "Close button did not restore remote opener focus");

  await page.getByTestId("article-media-opener-3").scrollIntoViewIfNeeded();
  const galleryBefore = await page.evaluate(() => ({
    bodyStyle: document.body.getAttribute("style"),
    scrollX: window.scrollX,
    scrollY: window.scrollY
  }));
  const gallerySources = await page.evaluate(() => Array.from(document.querySelectorAll('[data-gallery-id="article-gallery-1"][data-testid^="article-media-opener-"]')).map((opener) => ({
    fullSource: opener.dataset.mediaFullSource,
    mediaOrder: Number(opener.dataset.mediaOrder),
    galleryIndex: Number(opener.dataset.galleryIndex)
  })));
  assert.equal(gallerySources.length, 3);
  await page.getByTestId("article-media-opener-3").click();
  state = await waitForActiveImage(page, gallerySources[0]);
  assert.equal(state.status, "Image 1 of 3");
  assert.equal(state.imageAlt, "Gallery alpha alternative");
  const next = page.getByTestId("article-media-dialog-next");
  await next.focus();
  await next.click();
  state = await waitForActiveImage(page, gallerySources[1]);
  assert.equal(state.status, "Image 2 of 3");
  assert.equal(state.imageAlt, "Gallery rotated alternative");
  assert.equal(state.caption, null);
  assert.equal(state.activeTestId, "article-media-dialog-next");
  await page.keyboard.press("ArrowLeft");
  state = await waitForActiveImage(page, gallerySources[0]);
  assert.equal(state.status, "Image 1 of 3");
  assert.equal(state.activeTestId, "article-media-dialog-next");
  const previous = page.getByTestId("article-media-dialog-previous");
  await previous.focus();
  await previous.click();
  state = await waitForActiveImage(page, gallerySources[2]);
  assert.equal(state.status, "Image 3 of 3");
  assert.equal(state.imageAlt, "Gallery portrait alternative");
  assert.equal(state.caption, "Gallery portrait caption");
  assert.equal(state.activeTestId, "article-media-dialog-previous");
  assert.ok(state.imageNaturalHeight > state.imageNaturalWidth, "Image 3 must decode as the portrait fixture");
  assert.ok(Math.abs((state.imageNaturalWidth / state.imageNaturalHeight) - (2 / 3)) < 0.02, "Portrait fixture must keep its 2:3 natural ratio");
  assert.equal(state.iframeCount, musicBefore.iframeCount);
  assert.equal(state.iframeSrc, musicBefore.iframeSrc);

  if (reducedMotion === "no-preference") {
    await page.screenshot({ path: path.join(EVIDENCE_ROOT, viewport.screenshot) });
  }

  const openBodyStyle = state.bodyStyle;
  await page.getByTestId("route-toggle").evaluate((button) => button.click());
  await page.getByTestId("other-route").waitFor();
  state = await getState(page);
  assert.equal(state.route, "other");
  assert.equal(state.dialogOpen, false);
  assert.notEqual(openBodyStyle, before.bodyStyle);
  restored = await page.evaluate(() => ({ bodyStyle: document.body.getAttribute("style"), scrollX: window.scrollX, scrollY: window.scrollY }));
  assert.deepEqual(restored, galleryBefore);
  assert.equal(state.iframeCount, musicBefore.iframeCount);
  assert.equal(state.iframeSrc, musicBefore.iframeSrc);
  await page.keyboard.press("ArrowRight");
  assert.equal((await getState(page)).route, "other", "Stale lightbox key listener acted after unmount");

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
  await context.close();
  return { viewport, reducedMotion, before, final: state, requestCount: requests.length };
}

await prepareRuntime();
const previousManifestPath = process.env.ARTICLE_IMAGE_MANIFEST_PATH;
process.env.ARTICLE_IMAGE_MANIFEST_PATH = MANIFEST_PATH;
let server;
let browser;

try {
  await mkdir(EVIDENCE_ROOT, { recursive: true });
  server = await createServer({
    root: PROJECT_ROOT,
    configFile: path.join(PROJECT_ROOT, "vite.config.js"),
    mode: "verification",
    logLevel: "error",
    plugins: [verificationPlugin()],
    server: { host: "127.0.0.1", port: 0, strictPort: false }
  });
  await server.listen();
  const address = server.httpServer.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
  const results = [];
  for (const viewport of VIEWPORTS) {
    for (const reducedMotion of ["no-preference", "reduce"]) {
      results.push(await runScenario(browser, baseUrl, viewport, reducedMotion));
    }
  }
  const report = { command: "npm run verify:article-media-lightbox", passed: true, results };
  await writeFile(STANDALONE_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(GALLERY_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log("PASS article media lightbox verification (desktop/mobile, normal + reduced motion)");
} finally {
  await browser?.close();
  await server?.close();
  if (previousManifestPath === undefined) delete process.env.ARTICLE_IMAGE_MANIFEST_PATH;
  else process.env.ARTICLE_IMAGE_MANIFEST_PATH = previousManifestPath;
}
