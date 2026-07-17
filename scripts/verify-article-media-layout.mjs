import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";
import { createServer } from "vite";

import { generateArticleMediaAssets } from "./article-media-assets.mjs";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const FIXTURE_ROOT = path.join(PROJECT_ROOT, "scripts/fixtures/article-images");
const RUNTIME_ROOT = path.join(PROJECT_ROOT, ".sisyphus/evidence/article-media/fixture-runtime");
const SOURCE_ROOT = path.join(RUNTIME_ROOT, "uploads");
const OUTPUT_ROOT = path.join(RUNTIME_ROOT, "optimized");
const MANIFEST_PATH = path.join(OUTPUT_ROOT, "manifest.json");
const EVIDENCE_ROOT = path.join(PROJECT_ROOT, ".sisyphus/evidence/article-media/browser");
const REPORT_PATH = path.join(EVIDENCE_ROOT, "layout-report.json");
const REMOTE_URL = "https://article-media.invalid/intercepted/remote-landscape.jpg";
const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 }
];

const fixtureSources = {
  "/images/uploads/fixture/landscape-large.jpg": "assets/landscape-large.jpg",
  "/images/uploads/fixture/portrait.webp": "assets/portrait.webp",
  "/images/uploads/fixture/alpha.png": "assets/alpha.png",
  "/images/uploads/fixture/exif-rotated.jpg": "assets/exif-rotated.jpg",
  "/images/uploads/fixture/oversized-2400.jpg": "assets/oversized-2400.jpg",
  "/images/uploads/fixture/small-320.jpg": "assets/small-320.jpg"
};

function harnessModule() {
  return `
    import React from "react";
    import { createRoot } from "react-dom/client";
    import { ArticleMediaFigure, ArticleMediaGallery } from "/src/components/ArticleMedia.jsx";
    import "/src/styles.css";

    const local = (source, mode, alt, caption, line, focal = null) => ({
      source, sourceType: "local", mode, alt, caption, line, focal,
      articleSource: "scripts/fixtures/article-images/markdown/valid.md"
    });
    const remote = {
      source: ${JSON.stringify(REMOTE_URL)}, sourceType: "remote", mode: "standard",
      alt: "Intercepted remote landscape", caption: "Remote verification source", line: 17,
      focal: null, articleSource: "scripts/fixtures/article-images/markdown/valid.md"
    };
    const gallery = {
      images: [
        local("/images/uploads/fixture/alpha.png", "gallery", "Alpha gallery fixture", "A long archival caption that must wrap safely inside the equal gallery column without escaping its restrained figure frame or relying on hover disclosure.", 20),
        local("/images/uploads/fixture/exif-rotated.jpg", "gallery", "Rotated gallery fixture", null, 21),
        local("/images/uploads/fixture/small-320.jpg", "gallery", "Small gallery fixture", "Small source caption", 25),
        local("/images/uploads/fixture/portrait.webp", "gallery", "Portrait gallery fixture", null, 29)
      ]
    };

    function Harness() {
      return <main className="app-shell">
        <section className="article-layout" data-testid="layout-shell">
          <aside className="rail rail-left" aria-label="Verification rail"><h4>LAYOUT</h4><p>Scoped media geometry</p></aside>
          <article className="prose" data-testid="article-card">
            <header className="article-hero"><p className="hero-code">VERIFY / ARTICLE MEDIA</p><h1>Calm media geometry</h1></header>
            <p data-testid="prose-reference">A restrained prose line establishes the ordinary content bounds used by standard media.</p>
            <ArticleMediaFigure image={local("/images/uploads/fixture/landscape-large.jpg", "standard", "Standard landscape", "Standard natural-ratio caption", 7)} mediaOrder={1} />
            <ArticleMediaFigure image={local("/images/uploads/fixture/landscape-large.jpg", "wide", "Wide landscape", null, 10)} mediaOrder={2} />
            <ArticleMediaFigure image={local("/images/uploads/fixture/oversized-2400.jpg", "panorama", "Panorama focal fixture", "Panorama focal 73 by 31", 14, { x: 73, y: 31 })} mediaOrder={3} />
            <ArticleMediaFigure image={local("/images/uploads/fixture/portrait.webp", "standard", "Tall portrait fixture", "Portrait contained without clipping", 10)} mediaOrder={4} />
            <ArticleMediaFigure image={remote} mediaOrder={5} />
            <ArticleMediaGallery block={gallery} galleryOrder={1} mediaStartOrder={6} articleSource="scripts/fixtures/article-images/markdown/valid.md" />
          </article>
          <aside className="rail rail-right" aria-label="Verification notes"><h4>NOTES</h4><p>Card-bounded breakout</p></aside>
        </section>
      </main>;
    }

    createRoot(document.getElementById("root")).render(<Harness />);
  `;
}

function verificationPlugin() {
  return {
    name: "article-media-layout-harness",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.url === "/__article-media-layout-harness") {
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Article media layout verification</title></head><body><div id="root"></div><script type="module" src="/__article-media-layout-harness.jsx"></script></body></html>');
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
      if (id === "/__article-media-layout-harness.jsx") return harnessModule();
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

function closeEnough(actual, expected, tolerance = 1) {
  return Math.abs(actual - expected) <= tolerance;
}

async function collectGeometry(page) {
  return page.evaluate(() => {
    const box = (selector) => {
      const element = document.querySelector(selector);
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        width: rect.width, height: rect.height,
        aspectRatio: rect.width / rect.height,
        transitionDuration: style.transitionDuration,
        objectFit: style.objectFit,
        objectPosition: style.objectPosition,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        outlineColor: style.outlineColor,
        outlineOffset: style.outlineOffset
      };
    };
    const card = box('[data-testid="article-card"]');
    const prose = box('[data-testid="prose-reference"]');
    const standard = box('[data-testid="article-media-standard-1"]');
    const standardImage = box('[data-testid="article-media-standard-1"] img');
    const wide = box('[data-testid="article-media-wide-2"]');
    const wideImage = box('[data-testid="article-media-wide-2"] img');
    const panoramaOpener = box('[data-testid="article-media-opener-3"]');
    const panoramaImage = box('[data-testid="article-media-panorama-3"] img');
    const portraitImage = box('[data-testid="article-media-standard-4"] img');
    const gallery = box('[data-testid="article-media-gallery-1"]');
    const galleryItems = Array.from(document.querySelectorAll('.article-gallery__item')).map((item) => {
      const itemRect = item.getBoundingClientRect();
      const image = item.querySelector('img');
      const imageRect = image.getBoundingClientRect();
      return {
        left: itemRect.left, top: itemRect.top, width: itemRect.width,
        imageWidth: imageRect.width, imageHeight: imageRect.height,
        intrinsicWidth: image.getAttribute('width'), intrinsicHeight: image.getAttribute('height')
      };
    });
    const caption = document.querySelector('[data-testid="article-media-gallery-1-item-1"] figcaption');
    const captionRect = caption.getBoundingClientRect();
    const captionParentRect = caption.parentElement.getBoundingClientRect();
    const focusTarget = document.querySelector('[data-testid="article-media-opener-1"]');
    return {
      viewport: { width: innerWidth, height: innerHeight },
      scrollWidth: document.documentElement.scrollWidth,
      card, prose, standard, standardImage, wide, wideImage, panoramaOpener, panoramaImage,
      portraitImage, gallery, galleryItems,
      galleryColumns: getComputedStyle(document.querySelector('.article-gallery__list')).gridTemplateColumns.split(' ').length,
      caption: {
        left: captionRect.left, right: captionRect.right, width: captionRect.width, height: captionRect.height,
        parentLeft: captionParentRect.left, parentRight: captionParentRect.right,
        scrollWidth: caption.scrollWidth, clientWidth: caption.clientWidth
      },
      focus: {
        isFocused: document.activeElement === focusTarget,
        ...box('[data-testid="article-media-opener-1"]')
      },
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      remoteLoaded: document.querySelector('[data-testid="article-media-standard-5"] img')?.complete === true
    };
  });
}

function assertGeometry(result) {
  const { width, height } = result.viewport;
  assert.ok(result.scrollWidth <= width, `${width} viewport must not overflow (${result.scrollWidth})`);
  assert.ok(result.standard.left >= result.prose.left - 1 && result.standard.right <= result.prose.right + 1, `${width} standard must stay in prose bounds`);
  assert.ok(closeEnough(result.standard.width, result.prose.width, 1), `${width} standard must equal prose width`);
  assert.ok(closeEnough(result.standardImage.aspectRatio, 16 / 9, 0.02), `${width} standard must preserve 16:9 ratio`);
  assert.ok(closeEnough(result.wideImage.aspectRatio, 16 / 9, 0.02), `${width} wide must preserve 16:9 ratio`);
  if (width <= 768) {
    assert.ok(closeEnough(result.wide.width, result.standard.width, 1), `${width} wide must equal standard width`);
  } else {
    assert.ok(result.wide.width > result.standard.width + 1, `${width} wide must exceed standard width`);
    assert.ok(result.wide.left >= result.card.left - 1 && result.wide.right <= result.card.right + 1, `${width} wide must stay inside article card`);
  }
  assert.ok(closeEnough(result.panoramaOpener.aspectRatio, 21 / 9, 0.02), `${width} panorama must be 21:9`);
  assert.equal(result.panoramaImage.objectFit, "cover", `${width} panorama alone must use cover`);
  assert.equal(result.panoramaImage.objectPosition, "73% 31%", `${width} panorama focal position must be authored`);
  assert.equal(result.standardImage.objectFit, "contain", `${width} standard must avoid cover crop`);
  assert.equal(result.wideImage.objectFit, "contain", `${width} wide must avoid cover crop`);
  assert.ok(result.portraitImage.height <= height * 0.72 + 1, `${width} portrait must be viewport-contained`);
  assert.ok(closeEnough(result.portraitImage.aspectRatio, 2 / 3, 0.02), `${width} portrait ratio must remain natural`);
  assert.equal(result.galleryColumns, width >= 768 ? 2 : 1, `${width} gallery column count mismatch`);
  for (const item of result.galleryItems) {
    const intrinsicRatio = Number(item.intrinsicWidth) / Number(item.intrinsicHeight);
    assert.ok(closeEnough(item.imageWidth / item.imageHeight, intrinsicRatio, 0.02), `${width} gallery image must preserve intrinsic ratio`);
  }
  if (width >= 768) {
    assert.ok(closeEnough(result.galleryItems[0].width, result.galleryItems[1].width, 1), `${width} gallery columns must be equal`);
  }
  assert.ok(result.caption.left >= result.caption.parentLeft - 1 && result.caption.right <= result.caption.parentRight + 1, `${width} caption must stay in figure`);
  assert.ok(result.caption.scrollWidth <= result.caption.clientWidth + 1, `${width} caption must wrap without overflow`);
  assert.equal(result.focus.isFocused, true, `${width} opener must receive keyboard focus`);
  assert.notEqual(result.focus.outlineStyle, "none", `${width} opener focus outline must be visible`);
  assert.notEqual(result.focus.outlineWidth, "0px", `${width} opener focus outline must have width`);
  if (result.reducedMotion) {
    assert.equal(result.focus.transitionDuration, "0s", `${width} reduced-motion opener transition must be 0s`);
    assert.equal(result.standardImage.transitionDuration, "0s", `${width} reduced-motion image transition must be 0s`);
  }
  assert.equal(result.remoteLoaded, true, `${width} intercepted remote fixture must load`);
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
      const context = await browser.newContext({ viewport, reducedMotion });
      const page = await context.newPage();
      const pageErrors = [];
      const consoleErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("console", (message) => {
        if (["error", "warning"].includes(message.type())) consoleErrors.push(message.text());
      });
      await page.route(REMOTE_URL, async (route) => {
        const body = await readFile(path.join(FIXTURE_ROOT, "assets/landscape-large.jpg"));
        await route.fulfill({ status: 200, contentType: "image/jpeg", body });
      });
      await page.goto(`${baseUrl}/__article-media-layout-harness`, { waitUntil: "networkidle" });
      const images = page.locator(".article-media__image");
      for (let imageIndex = 0; imageIndex < await images.count(); imageIndex += 1) {
        await images.nth(imageIndex).scrollIntoViewIfNeeded();
      }
      await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0));
      await page.locator('[data-testid="article-media-opener-1"]').focus();
      const geometry = await collectGeometry(page);
      assert.deepEqual(pageErrors, [], `${viewport.width} ${reducedMotion} page errors`);
      assert.deepEqual(consoleErrors, [], `${viewport.width} ${reducedMotion} console errors`);
      assertGeometry(geometry);
      const screenshotPath = path.join(EVIDENCE_ROOT, `${viewport.width}x${viewport.height}-${reducedMotion}.png`);
      if (reducedMotion === "no-preference" || [375, 1440].includes(viewport.width)) {
        await page.screenshot({ path: screenshotPath, fullPage: true });
      }
      results.push({ reducedMotion, ...geometry });
      await context.close();
    }
  }

  await writeFile(REPORT_PATH, `${JSON.stringify({
    command: "npm run verify:article-media-layout",
    passed: true,
    strategy: "standard content-box width; desktop wide negative-margin breakout bounded by article card padding; panorama-only 21:9 crop",
    results
  }, null, 2)}\n`);
  console.log("PASS article media layout verification (4 viewports, normal + reduced motion, screenshots + geometry)");
} finally {
  await browser?.close();
  await server?.close();
  if (previousManifestPath === undefined) delete process.env.ARTICLE_IMAGE_MANIFEST_PATH;
  else process.env.ARTICLE_IMAGE_MANIFEST_PATH = previousManifestPath;
}
