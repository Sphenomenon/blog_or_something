import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";
import sharp from "sharp";
import { createServer } from "vite";

import {
  ARTICLE_IMAGE_FIXTURE_MARKER,
  ARTICLE_IMAGE_FIXTURE_TITLE,
  ARTICLE_IMAGE_REMOTE_URL
} from "./article-image-fixture-config.mjs";
import { prepareArticleMediaVerificationRuntime } from "./prepare-article-media-verification.mjs";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const FIXTURE_ROOT = path.join(PROJECT_ROOT, "scripts/fixtures/article-images");
const EVIDENCE_ROOT = path.join(PROJECT_ROOT, ".sisyphus/evidence/article-media/browser");
const ROUTE_PATH = "/__verify__/article-images";
const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 }
];
const EXPECTED_THIRD_PARTY_HOSTS = new Set([
  "identity.netlify.com",
  "events.vercount.one",
  "music.163.com",
  "fonts.loli.net",
  "gstatic.loli.net"
]);
const PAINT_VARIANCE_MINIMUM = 8;

function closeEnough(actual, expected, tolerance = 1) {
  return Math.abs(actual - expected) <= tolerance;
}

function shouldIgnoreConsoleEntry(type, text) {
  return type === "warning" && text.startsWith("You have Reduced Motion enabled on your device. Animations may not appear as expected.");
}

async function installNetworkIsolation(context, baseUrl, network) {
  const localOrigin = new URL(baseUrl).origin;
  const remoteBody = await readFile(path.join(FIXTURE_ROOT, "assets/landscape-large.jpg"));

  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    network.requests.push({ url: request.url(), resourceType: request.resourceType() });

    if (url.href === ARTICLE_IMAGE_REMOTE_URL) {
      network.remoteIntercepts += 1;
      await route.fulfill({ status: 200, contentType: "image/jpeg", body: remoteBody });
      return;
    }

    if (url.origin === localOrigin || url.protocol === "data:" || url.protocol === "blob:") {
      await route.continue();
      return;
    }

    if (EXPECTED_THIRD_PARTY_HOSTS.has(url.hostname)) {
      network.blockedExpected.push(request.url());
      const resourceType = request.resourceType();
      await route.fulfill({
        status: 200,
        contentType: resourceType === "script" ? "application/javascript" : "text/html",
        body: resourceType === "script" ? "" : "<!doctype html><html><body></body></html>"
      });
      return;
    }

    network.unexpectedPublic.push(request.url());
    await route.fulfill({ status: 204, body: "" });
  });
}

function captureRuntimeSignals(page, signals) {
  page.on("pageerror", (error) => signals.pageErrors.push(error.stack || error.message));
  page.on("console", (message) => {
    const type = message.type();
    const text = message.text();
    if ((type === "error" || type === "warning") && !shouldIgnoreConsoleEntry(type, text)) {
      signals.consoleEntries.push({ type, text });
    }
  });
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (url.hostname !== "identity.netlify.com" && !signals.network.unexpectedPublic.includes(request.url())) {
      signals.failedRequests.push({ url: request.url(), error: request.failure()?.errorText ?? null });
    }
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === new URL(page.url() || "http://127.0.0.1").origin && url.pathname.startsWith("/images/optimized/articles/")) {
      signals.localImageResponses.push({ url: response.url(), status: response.status() });
    }
  });
}

async function waitForInflightImages(page) {
  const images = page.locator(".article-media__image");
  for (let index = 0; index < await images.count(); index += 1) {
    const image = images.nth(index);
    await image.scrollIntoViewIfNeeded();
    await image.evaluate(async (element) => {
      if (!element.complete || element.naturalWidth === 0) {
        await new Promise((resolve, reject) => {
          element.addEventListener("load", resolve, { once: true });
          element.addEventListener("error", reject, { once: true });
        });
      }
      await element.decode();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
  }
  await page.waitForFunction(() => Array.from(document.querySelectorAll(".article-media__image"))
    .every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0));
}

async function verifyImagePaintReadiness(page) {
  const images = page.locator(".article-media__image");
  const results = [];

  for (let index = 0; index < await images.count(); index += 1) {
    const image = images.nth(index);
    await image.evaluate(async (element) => {
      element.scrollIntoView({ behavior: "instant", block: "center", inline: "nearest" });
      if (!element.complete || element.naturalWidth === 0) {
        await new Promise((resolve, reject) => {
          element.addEventListener("load", resolve, { once: true });
          element.addEventListener("error", reject, { once: true });
        });
      }
      await element.decode();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await page.waitForTimeout(80);

    const identity = await image.evaluate((element) => {
      const figure = element.closest("figure.article-media");
      const rect = element.getBoundingClientRect();
      const intersectionWidth = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
      const intersectionHeight = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
      return {
        testId: figure?.getAttribute("data-testid") ?? null,
        mediaOrder: figure?.getAttribute("data-media-order") ?? null,
        currentSrc: element.currentSrc,
        complete: element.complete,
        naturalWidth: element.naturalWidth,
        naturalHeight: element.naturalHeight,
        intersectionArea: intersectionWidth * intersectionHeight
      };
    });
    assert.equal(identity.complete, true, `${identity.testId}: paint check image incomplete`);
    assert.ok(identity.naturalWidth > 0 && identity.naturalHeight > 0, `${identity.testId}: paint check has no natural dimensions`);
    assert.ok(identity.intersectionArea > 0, `${identity.testId}: paint check image is outside the viewport`);

    const screenshot = await image.screenshot({ animations: "disabled", scale: "css" });
    const screenshotMetadata = await sharp(screenshot).metadata();
    const inset = Math.max(1, Math.min(4, Math.floor(Math.min(screenshotMetadata.width, screenshotMetadata.height) / 8)));
    const interiorWidth = screenshotMetadata.width - inset * 2;
    const interiorHeight = screenshotMetadata.height - inset * 2;
    assert.ok(interiorWidth > 0 && interiorHeight > 0, `${identity.testId}: paint check screenshot is too small`);
    const interior = sharp(screenshot).extract({ left: inset, top: inset, width: interiorWidth, height: interiorHeight });
    const statistics = await interior.stats();
    const colorChannels = statistics.channels.slice(0, 3);
    const maximumDeviation = Math.max(...colorChannels.map((channel) => channel.stdev));
    assert.ok(
      maximumDeviation >= PAINT_VARIANCE_MINIMUM,
      `${identity.testId}: painted pixels are indistinguishable from a blank frame (${maximumDeviation})`
    );
    results.push({
      ...identity,
      screenshotWidth: screenshotMetadata.width,
      screenshotHeight: screenshotMetadata.height,
      entropy: statistics.entropy,
      maximumDeviation
    });
  }

  assert.equal(results.length, 12, "Every in-flow image must pass the per-instance paint check");
  return results;
}

async function waitForVisibleImagesToPaint(page) {
  return page.evaluate(async () => {
    const visibleImages = Array.from(document.querySelectorAll(".article-media__image")).filter((image) => {
      const rect = image.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
    });
    await Promise.all(visibleImages.map((image) => image.decode()));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return visibleImages.map((image) => image.closest("figure.article-media")?.getAttribute("data-testid") ?? null);
  });
}

async function captureReadingFlowScreenshot(page, screenshotPath) {
  const captureStyle = await page.addStyleTag({
    content: `
      html { scroll-behavior: auto !important; }
      body::before, body::after { content: none !important; }
      .article-layout .rail { position: static !important; }
      .music-mini-player, .back-to-top { visibility: hidden !important; }
    `
  });

  try {
    const dimensions = await page.evaluate(() => ({
      documentHeight: Math.ceil(document.documentElement.scrollHeight),
      viewportHeight: innerHeight,
      viewportWidth: innerWidth
    }));
    const maximumScroll = Math.max(0, dimensions.documentHeight - dimensions.viewportHeight);
    const requestedOffsets = [];
    for (let offset = 0; offset < maximumScroll; offset += dimensions.viewportHeight) {
      requestedOffsets.push(offset);
    }
    requestedOffsets.push(maximumScroll);

    const tiles = [];
    const capturedOffsets = new Set();
    for (const requestedOffset of requestedOffsets) {
      await page.evaluate((offset) => window.scrollTo(0, offset), requestedOffset);
      const actualOffset = await page.evaluate(() => Math.round(window.scrollY));
      if (capturedOffsets.has(actualOffset)) continue;
      capturedOffsets.add(actualOffset);
      await waitForVisibleImagesToPaint(page);
      await page.waitForTimeout(80);
      let screenshot = await page.screenshot({ animations: "disabled", scale: "css" });
      const availableHeight = Math.min(dimensions.viewportHeight, dimensions.documentHeight - actualOffset);
      if (availableHeight < dimensions.viewportHeight) {
        screenshot = await sharp(screenshot)
          .extract({ left: 0, top: 0, width: dimensions.viewportWidth, height: availableHeight })
          .png()
          .toBuffer();
      }
      tiles.push({ input: screenshot, left: 0, top: actualOffset });
    }

    await sharp({
      create: {
        width: dimensions.viewportWidth,
        height: dimensions.documentHeight,
        channels: 4,
        background: { r: 7, g: 9, b: 13, alpha: 1 }
      }
    }).composite(tiles).png().toFile(screenshotPath);

    return {
      ...dimensions,
      tileCount: tiles.length,
      capturedOffsets: [...capturedOffsets]
    };
  } finally {
    await captureStyle.evaluate((element) => element.remove());
    await page.evaluate(() => window.scrollTo(0, 0));
  }
}

async function collectPageContract(page, manifest) {
  return page.evaluate(({ fixtureMarker, fixtureTitle, manifestValue }) => {
    const box = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        ratio: rect.height > 0 ? rect.width / rect.height : null,
        contentRatio: element.clientHeight > 0 ? element.clientWidth / element.clientHeight : null,
        objectFit: style.objectFit,
        objectPosition: style.objectPosition,
        transitionDuration: style.transitionDuration,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        outlineColor: style.outlineColor
      };
    };
    const media = Array.from(document.querySelectorAll("figure.article-media"));
    const localImages = media
      .filter((figure) => figure.dataset.mediaSourceType === "local")
      .map((figure) => {
        const image = figure.querySelector("img");
        const opener = figure.querySelector("button");
        const source = figure.dataset.mediaSource;
        const record = manifestValue.images[source];
        const currentPath = new URL(image.currentSrc).pathname;
        const selectedVariant = record.variants.find((variant) => variant.src === currentPath) ?? null;
        return {
          testId: figure.dataset.testid ?? figure.getAttribute("data-testid"),
          source,
          mode: figure.dataset.mediaMode,
          src: image.getAttribute("src"),
          srcset: image.getAttribute("srcset"),
          sizes: image.getAttribute("sizes"),
          currentSrc: image.currentSrc,
          width: image.getAttribute("width"),
          height: image.getAttribute("height"),
          loading: image.getAttribute("loading"),
          decoding: image.getAttribute("decoding"),
          renderedWidth: image.getBoundingClientRect().width,
          selectedWidth: selectedVariant?.width ?? null,
          maxWidth: record.variants.at(-1).width,
          openerFullSource: opener.dataset.mediaFullSource,
          box: box(image)
        };
      });
    const remoteFigure = document.querySelector('[data-media-source-type="remote"]');
    const remoteImage = remoteFigure.querySelector("img");
    const standard = document.querySelector('[data-testid="article-media-standard-1"]');
    const wide = document.querySelector('[data-testid="article-media-wide-2"]');
    const panorama = document.querySelector('[data-testid="article-media-panorama-3"]');
    const proseReference = Array.from(document.querySelectorAll("article.prose > p"))
      .find((paragraph) => paragraph.textContent.includes("Minimal prose"));
    const article = document.querySelector("article.prose");
    const layoutShell = article.closest('.article-layout');
    const rightRail = layoutShell.querySelector(':scope > .rail-right');
    const layoutStyle = getComputedStyle(layoutShell);
    const articleStyle = getComputedStyle(article);
    const rightRailStyle = getComputedStyle(rightRail);
    const galleryLists = Array.from(document.querySelectorAll(".article-gallery__list"));
    const captions = Array.from(document.querySelectorAll("figure.article-media figcaption"));
    const openers = Array.from(document.querySelectorAll('[data-testid^="article-media-opener-"]'));
    const musicIframe = document.querySelector('[data-testid="music-easter-egg-player"]');

    return {
      viewport: { width: innerWidth, height: innerHeight },
      title: article.querySelector("h1")?.textContent?.trim() ?? null,
      markerPresent: document.querySelector('[data-testid="article-media-verification-route"]')?.getAttribute("data-fixture-marker") === fixtureMarker,
      routePresent: Boolean(document.querySelector('[data-testid="article-media-verification-route"]')),
      fixtureChrome: {
        comments: document.querySelectorAll('[aria-label="文章评论"], [data-testid="article-comments-container"]').length,
        related: document.querySelectorAll('[data-testid^="article-related-"], .related-panel').length,
        navigation: document.querySelectorAll('[data-testid="article-prev"], [data-testid="article-next"], [data-testid="article-prev-empty"], [data-testid="article-next-empty"]').length,
        leftRail: document.querySelectorAll('.rail-left').length
      },
      structure: {
        figures: media.length,
        standaloneFigures: document.querySelectorAll('article.prose > figure.article-media').length,
        galleries: document.querySelectorAll('article.prose > section.article-gallery').length,
        galleryItems: document.querySelectorAll('.article-gallery__item').length,
        captions: captions.length,
        openers: openers.length,
        paragraphFigures: document.querySelectorAll('p figure').length,
        paragraphMedia: document.querySelectorAll('p [data-testid^="article-media-"]').length,
        openerNames: openers.map((opener) => opener.getAttribute("aria-label")),
        imageAlts: media.map((figure) => figure.querySelector("img")?.getAttribute("alt")),
        captionTexts: captions.map((caption) => caption.textContent)
      },
      sources: {
        localImages,
        remote: {
          src: remoteImage.getAttribute("src"),
          currentSrc: remoteImage.currentSrc,
          srcset: remoteImage.getAttribute("srcset"),
          sizes: remoteImage.getAttribute("sizes"),
          width: remoteImage.getAttribute("width"),
          height: remoteImage.getAttribute("height"),
          loading: remoteImage.getAttribute("loading"),
          decoding: remoteImage.getAttribute("decoding")
        }
      },
      layout: {
        rootScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        rootFontSize: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
        shell: box(layoutShell),
        article: box(article),
        rightRail: box(rightRail),
        gridTemplateColumns: layoutStyle.gridTemplateColumns,
        articleGridColumnStart: articleStyle.gridColumnStart,
        articleGridColumnEnd: articleStyle.gridColumnEnd,
        rightRailGridColumnStart: rightRailStyle.gridColumnStart,
        rightRailGridColumnEnd: rightRailStyle.gridColumnEnd,
        prose: box(proseReference),
        standard: box(standard),
        standardImage: box(standard.querySelector("img")),
        wide: box(wide),
        wideImage: box(wide.querySelector("img")),
        panorama: box(panorama.querySelector("button")),
        panoramaImage: box(panorama.querySelector("img")),
        galleryColumns: galleryLists.map((list) => getComputedStyle(list).gridTemplateColumns.split(" ").length),
        galleryItems: Array.from(document.querySelectorAll('.article-gallery__item')).map((item) => {
          const image = item.querySelector("img");
          return {
            item: box(item),
            image: box(image),
            intrinsicRatio: Number(image.getAttribute("width")) / Number(image.getAttribute("height"))
          };
        })
      },
      preDialog: {
        enlargedImageCount: document.querySelectorAll('[data-testid="article-media-dialog-image"]').length,
        musicIframeCount: document.querySelectorAll('[data-testid="music-easter-egg-player"]').length,
        musicIframeSrc: musicIframe?.src ?? null
      },
      fixtureTitleMatches: article.querySelector("h1")?.textContent?.trim() === fixtureTitle
    };
  }, { fixtureMarker: ARTICLE_IMAGE_FIXTURE_MARKER, fixtureTitle: ARTICLE_IMAGE_FIXTURE_TITLE, manifestValue: manifest });
}

function assertPageContract(contract) {
  const { width } = contract.viewport;
  assert.equal(contract.routePresent, true, `${width}: verification route missing`);
  assert.equal(contract.fixtureTitleMatches, true, `${width}: fixture title mismatch`);
  assert.equal(contract.markerPresent, true, `${width}: fixture marker missing`);
  assert.deepEqual(contract.fixtureChrome, { comments: 0, related: 0, navigation: 0, leftRail: 0 });
  assert.deepEqual({
    figures: contract.structure.figures,
    standaloneFigures: contract.structure.standaloneFigures,
    galleries: contract.structure.galleries,
    galleryItems: contract.structure.galleryItems,
    captions: contract.structure.captions,
    openers: contract.structure.openers,
    paragraphFigures: contract.structure.paragraphFigures,
    paragraphMedia: contract.structure.paragraphMedia
  }, {
    figures: 12,
    standaloneFigures: 4,
    galleries: 2,
    galleryItems: 8,
    captions: 7,
    openers: 12,
    paragraphFigures: 0,
    paragraphMedia: 0
  });
  assert.ok(contract.structure.openerNames.every((name) => name?.startsWith("Open image: ")), `${width}: opener accessible names missing`);
  assert.equal(contract.preDialog.enlargedImageCount, 0, `${width}: enlarged image rendered before open`);

  for (const image of contract.sources.localImages) {
    assert.match(image.src, /^\/images\/optimized\/articles\/.+\.webp$/, `${width}: local fallback is not generated WebP`);
    assert.ok(image.srcset, `${width}: local srcset missing for ${image.source}`);
    assert.ok(image.sizes, `${width}: local sizes missing for ${image.source}`);
    assert.ok(Number(image.width) > 0 && Number(image.height) > 0, `${width}: local intrinsic dimensions missing`);
    assert.equal(image.loading, "lazy");
    assert.equal(image.decoding, "async");
    assert.ok(image.selectedWidth, `${width}: currentSrc is not a manifest variant for ${image.source}`);
    assert.ok(image.selectedWidth >= Math.min(Math.ceil(image.renderedWidth), image.maxWidth), `${width}: selected source undersized for ${image.source}`);
  }

  assert.equal(contract.sources.remote.src, ARTICLE_IMAGE_REMOTE_URL);
  assert.equal(contract.sources.remote.currentSrc, ARTICLE_IMAGE_REMOTE_URL);
  assert.equal(contract.sources.remote.srcset, null);
  assert.equal(contract.sources.remote.sizes, null);
  assert.equal(contract.sources.remote.width, null);
  assert.equal(contract.sources.remote.height, null);
  assert.equal(contract.sources.remote.loading, "lazy");
  assert.equal(contract.sources.remote.decoding, "async");

  assert.ok(contract.layout.rootScrollWidth <= contract.layout.clientWidth, `${width}: root horizontal overflow`);
  assert.ok(contract.layout.bodyScrollWidth <= contract.layout.clientWidth, `${width}: body horizontal overflow`);
  assertVerificationArticleFrame(contract);
  assert.ok(closeEnough(contract.layout.standard.width, contract.layout.prose.width, 1), `${width}: standard width differs from prose`);
  const standardSource = contract.sources.localImages.find((image) => image.mode === "standard" && image.source.endsWith("landscape-large.jpg"));
  assert.ok(standardSource, `${width}: standard landscape source missing`);
  assert.ok(closeEnough(Number(standardSource.width) / Number(standardSource.height), 16 / 9, 0.02), `${width}: standard intrinsic ratio changed`);
  assert.ok(closeEnough(contract.layout.wideImage.ratio, 2 / 3, 0.02), `${width}: wide portrait ratio changed`);
  if (width <= 768) {
    assert.ok(closeEnough(contract.layout.wide.width, contract.layout.standard.width, 1), `${width}: wide should equal standard`);
  } else {
    assert.ok(contract.layout.wide.width > contract.layout.standard.width + 1, `${width}: wide did not break beyond prose`);
    assert.ok(contract.layout.wide.left >= contract.layout.article.left - 1 && contract.layout.wide.right <= contract.layout.article.right + 1, `${width}: wide escaped article card`);
  }
  assert.ok(closeEnough(contract.layout.panorama.ratio, 21 / 9, 0.02), `${width}: panorama ratio mismatch`);
  assert.equal(contract.layout.panoramaImage.objectFit, "cover");
  assert.equal(contract.layout.panoramaImage.objectPosition, "73% 31%");
  assert.equal(contract.layout.standardImage.objectFit, "contain");
  assert.equal(contract.layout.wideImage.objectFit, "contain");
  assert.deepEqual(contract.layout.galleryColumns, [width >= 768 ? 2 : 1, width >= 768 ? 2 : 1]);
  for (const item of contract.layout.galleryItems) {
    const ratioDelta = Math.abs(item.image.contentRatio - item.intrinsicRatio) / item.intrinsicRatio;
    assert.equal(item.image.objectFit, "contain", `${width}: gallery image must avoid crop`);
    assert.ok(
      ratioDelta <= 0.03,
      `${width}: gallery image ratio changed (${item.image.contentRatio} vs ${item.intrinsicRatio})`
    );
  }
}

function assertVerificationArticleFrame(contract) {
  const { width } = contract.viewport;
  const { article, rightRail, shell } = contract.layout;

  if (width <= 1180) {
    assert.equal(contract.layout.gridTemplateColumns.split(" ").length, 1, `${width}: verification layout must collapse to one column`);
    assert.ok(article.width >= shell.width * 0.9, `${width}: verification article collapsed below the content width (${article.width}px of ${shell.width}px)`);
    assert.ok(closeEnough(article.left, shell.left, 2), `${width}: verification article is not aligned to the content shell`);
    assert.ok(rightRail.top >= article.bottom - 2, `${width}: verification TOC must follow the article in the single-column layout`);
    return;
  }

  assert.equal(contract.layout.gridTemplateColumns.split(" ").length, 3, `${width}: verification layout must retain the production desktop tracks`);
  assert.equal(contract.layout.articleGridColumnStart, "2", `${width}: verification article must occupy the center grid column`);
  assert.equal(contract.layout.rightRailGridColumnStart, "3", `${width}: verification TOC must occupy the right grid column`);
  assert.ok(article.width >= shell.width * 0.55, `${width}: verification article is rail-sized instead of content-sized (${article.width}px of ${shell.width}px)`);
  assert.ok(article.width >= rightRail.width * 2.5, `${width}: verification article is not materially wider than the TOC rail`);
  assert.ok(article.left >= shell.left + shell.width * 0.12, `${width}: verification article fell into the left rail column`);
  assert.ok(rightRail.left >= article.right - 2, `${width}: verification TOC is not positioned to the right of the article`);
  assert.ok(rightRail.right <= shell.right + 2, `${width}: verification TOC escaped the layout shell`);
}

async function getDialogState(page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('[data-testid="article-media-dialog"]');
    const image = document.querySelector('[data-testid="article-media-dialog-image"]');
    const iframe = document.querySelector('[data-testid="music-easter-egg-player"]');
    return {
      dialogOpen: dialog?.open === true,
      dialogLabelledBy: dialog?.getAttribute("aria-labelledby") ?? null,
      transitionDuration: dialog ? getComputedStyle(dialog).transitionDuration : null,
      imageAlt: image?.alt ?? null,
      imageCurrentSrc: image?.currentSrc ?? null,
      imageComplete: image?.complete ?? false,
      imageNaturalWidth: image?.naturalWidth ?? 0,
      imageNaturalHeight: image?.naturalHeight ?? 0,
      imageMediaOrder: image?.dataset.mediaOrder ?? null,
      imageFullSource: image?.dataset.mediaFullSource ?? null,
      imageGalleryIndex: image?.dataset.galleryIndex ?? null,
      caption: dialog?.querySelector("figcaption")?.textContent ?? null,
      status: document.querySelector('[data-testid="article-media-dialog-status"]')?.textContent?.trim() ?? null,
      activeTestId: document.activeElement?.getAttribute?.("data-testid") ?? null,
      focusInside: dialog?.contains(document.activeElement) ?? false,
      navigationCount: dialog?.querySelectorAll('[data-testid="article-media-dialog-previous"], [data-testid="article-media-dialog-next"]').length ?? 0,
      bodyStyle: document.body.getAttribute("style"),
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      iframeCount: document.querySelectorAll('[data-testid="music-easter-egg-player"]').length,
      iframeSrc: iframe?.src ?? null,
      iframeToken: iframe?.dataset.verificationPersistenceToken ?? null
    };
  });
}

async function waitForDialogImage(page, expected) {
  await page.waitForFunction(({ fullSource, mediaOrder, galleryIndex }) => {
    const image = document.querySelector('[data-testid="article-media-dialog-image"]');
    return image?.dataset.mediaFullSource === fullSource
      && image.dataset.mediaOrder === String(mediaOrder)
      && (galleryIndex === undefined || image.dataset.galleryIndex === String(galleryIndex))
      && image.complete
      && image.naturalWidth > 0
      && image.naturalHeight > 0
      && image.currentSrc === new URL(fullSource, location.href).href;
  }, expected);
  return getDialogState(page);
}

async function assertFocusTrap(page) {
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press("Tab");
    assert.equal(await page.getByTestId("article-media-dialog").evaluate((dialog) => dialog.contains(document.activeElement)), true, "Tab escaped dialog");
  }
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.getByTestId("article-media-dialog").evaluate((dialog) => dialog.contains(document.activeElement)), true, "Shift+Tab escaped dialog");
  }
}

async function verifyFocusIndicator(page, testId) {
  await page.getByTestId(testId).evaluate((element) => element.focus({ preventScroll: true }));
  const focus = await page.getByTestId(testId).evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      active: document.activeElement === element,
      focusVisible: element.matches(":focus-visible"),
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineColor: style.outlineColor
    };
  });
  assert.equal(focus.active, true);
  assert.equal(focus.focusVisible, true);
  assert.notEqual(focus.outlineStyle, "none");
  assert.notEqual(focus.outlineWidth, "0px");
  return focus;
}

async function exerciseDialogAndPersistence(page, baseUrl, viewport, signals) {
  await page.evaluate(() => {
    const iframe = document.querySelector('[data-testid="music-easter-egg-player"]');
    if (iframe) iframe.dataset.verificationPersistenceToken = "article-media-browser";
  });
  const opener = page.getByTestId("article-media-opener-1");
  await opener.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, Math.min(640, document.documentElement.scrollHeight - innerHeight)));
  await page.waitForTimeout(50);
  const before = await page.evaluate(() => ({
    bodyStyle: document.body.getAttribute("style"),
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    fullSource: document.querySelector('[data-testid="article-media-opener-1"]').dataset.mediaFullSource,
    enlargedCount: document.querySelectorAll('[data-testid="article-media-dialog-image"]').length
  }));
  const musicBefore = await getDialogState(page);
  assert.equal(before.enlargedCount, 0);
  assert.equal(signals.network.requests.some((request) => request.url === new URL(before.fullSource, baseUrl).href), false, `${viewport.width}: full source preloaded`);

  await opener.focus();
  await page.keyboard.press("Enter");
  await page.getByTestId("article-media-dialog").waitFor({ state: "visible" });
  let state = await waitForDialogImage(page, { fullSource: before.fullSource, mediaOrder: 1 });
  assert.equal(state.dialogOpen, true);
  assert.equal(state.dialogLabelledBy, "article-lightbox-title");
  assert.equal(state.activeTestId, "article-media-dialog-close");
  assert.equal(state.imageAlt, "Large landscape fixture");
  assert.equal(state.caption, "Standard image caption");
  assert.equal(state.navigationCount, 0);
  assert.notEqual(state.bodyStyle, before.bodyStyle);
  assert.equal(state.iframeCount, musicBefore.iframeCount);
  assert.equal(state.iframeSrc, musicBefore.iframeSrc);
  assert.equal(state.iframeToken, "article-media-browser");
  await assertFocusTrap(page);

  await page.getByTestId("article-media-dialog-image").click({ position: { x: 8, y: 8 } });
  assert.equal((await getDialogState(page)).dialogOpen, true, "Image click closed dialog");
  const dialogBox = await page.getByTestId("article-media-dialog").boundingBox();
  assert.ok(dialogBox);
  await page.mouse.click(Math.max(1, dialogBox.x - 4), Math.max(1, dialogBox.y - 4));
  assert.equal((await getDialogState(page)).dialogOpen, false, "Backdrop did not close dialog");
  assert.equal(await opener.evaluate((element) => document.activeElement === element), true, "Backdrop did not restore focus");
  assert.deepEqual(await page.evaluate(() => ({ bodyStyle: document.body.getAttribute("style"), scrollX, scrollY })), {
    bodyStyle: before.bodyStyle,
    scrollX: before.scrollX,
    scrollY: before.scrollY
  });

  await opener.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  assert.equal((await getDialogState(page)).dialogOpen, false, "Escape did not close dialog");
  assert.equal(await opener.evaluate((element) => document.activeElement === element), true, "Escape did not restore focus");

  const remoteOpener = page.getByTestId("article-media-opener-4");
  await remoteOpener.scrollIntoViewIfNeeded();
  await remoteOpener.focus();
  await page.keyboard.press("Enter");
  state = await waitForDialogImage(page, { fullSource: ARTICLE_IMAGE_REMOTE_URL, mediaOrder: 4 });
  assert.equal(state.imageCurrentSrc, ARTICLE_IMAGE_REMOTE_URL);
  assert.equal(state.imageAlt, "Deterministic intercepted remote fixture");
  assert.equal(state.caption, "Remote source caption");
  assert.equal(state.navigationCount, 0);
  await page.getByTestId("article-media-dialog-close").click();
  assert.equal(await remoteOpener.evaluate((element) => document.activeElement === element), true);

  const gallerySources = await page.evaluate(() => Array.from(document.querySelectorAll('[data-gallery-id="article-gallery-1"][data-testid^="article-media-opener-"]')).map((element) => ({
    fullSource: element.dataset.mediaFullSource,
    mediaOrder: Number(element.dataset.mediaOrder),
    galleryIndex: Number(element.dataset.galleryIndex)
  })));
  assert.equal(gallerySources.length, 2);
  await page.getByTestId("article-media-opener-5").click();
  state = await waitForDialogImage(page, gallerySources[0]);
  assert.equal(state.status, "Image 1 of 2");
  const next = page.getByTestId("article-media-dialog-next");
  await next.focus();
  await next.click();
  state = await waitForDialogImage(page, gallerySources[1]);
  assert.equal(state.status, "Image 2 of 2");
  assert.equal(state.activeTestId, "article-media-dialog-next");
  await page.keyboard.press("ArrowRight");
  state = await waitForDialogImage(page, gallerySources[0]);
  assert.equal(state.status, "Image 1 of 2");
  assert.equal(state.activeTestId, "article-media-dialog-next");
  const previous = page.getByTestId("article-media-dialog-previous");
  await previous.focus();
  await previous.click();
  state = await waitForDialogImage(page, gallerySources[1]);
  assert.equal(state.status, "Image 2 of 2");
  assert.equal(state.activeTestId, "article-media-dialog-previous");

  if (viewport.width === 375 || viewport.width === 1440) {
    await page.screenshot({ path: path.join(EVIDENCE_ROOT, `article-media-dialog-${viewport.width}x${viewport.height}.png`) });
  }

  await page.getByTestId("article-media-verification-exit").evaluate((button) => button.click());
  await page.getByRole("heading", { name: "关于这座档案馆" }).waitFor({ state: "visible" });
  state = await getDialogState(page);
  assert.equal(state.dialogOpen, false);
  assert.equal(state.bodyStyle || null, before.bodyStyle || null);
  assert.equal(state.iframeCount, musicBefore.iframeCount);
  assert.equal(state.iframeSrc, musicBefore.iframeSrc);
  assert.equal(state.iframeToken, "article-media-browser");
  await page.keyboard.press("ArrowRight");
  assert.equal(new URL(page.url()).pathname, "/about", "Stale dialog listener changed route");

  return { before, final: state, gallerySources };
}

async function collectReducedMotion(page) {
  await page.getByTestId("article-media-opener-1").focus();
  const openerTransition = await page.getByTestId("article-media-opener-1").evaluate((element) => getComputedStyle(element).transitionDuration);
  const imageTransition = await page.locator('[data-testid="article-media-standard-1"] img').evaluate((element) => getComputedStyle(element).transitionDuration);
  await page.getByTestId("article-media-opener-1").click();
  const dialogTransition = await page.getByTestId("article-media-dialog").evaluate((element) => getComputedStyle(element).transitionDuration);
  await page.getByTestId("article-media-dialog-close").click();
  return { openerTransition, imageTransition, dialogTransition };
}

async function runViewport(browser, baseUrl, viewport, manifest) {
  const context = await browser.newContext({ viewport, reducedMotion: "no-preference", serviceWorkers: "block" });
  const signals = {
    pageErrors: [],
    consoleEntries: [],
    failedRequests: [],
    localImageResponses: [],
    network: { requests: [], remoteIntercepts: 0, blockedExpected: [], unexpectedPublic: [] }
  };
  await installNetworkIsolation(context, baseUrl, signals.network);
  const page = await context.newPage();
  captureRuntimeSignals(page, signals);

  try {
    await page.goto(`${baseUrl}${ROUTE_PATH}`, { waitUntil: "networkidle" });
    await page.getByTestId("article-media-verification-route").waitFor({ state: "visible" });
    await waitForInflightImages(page);
    const paintReadiness = await verifyImagePaintReadiness(page);
    const contract = await collectPageContract(page, manifest);
    assertPageContract(contract);
    let readingScreenshot = null;
    if (viewport.width === 375 || viewport.width === 1440) {
      readingScreenshot = await captureReadingFlowScreenshot(
        page,
        path.join(EVIDENCE_ROOT, `article-media-reading-${viewport.width}x${viewport.height}.png`)
      );
    }
    const focus = await verifyFocusIndicator(page, "article-media-opener-1");
    const interactions = await exerciseDialogAndPersistence(page, baseUrl, viewport, signals);

    assert.deepEqual(signals.pageErrors, [], `${viewport.width}: page errors`);
    assert.deepEqual(signals.consoleEntries, [], `${viewport.width}: console warnings/errors`);
    assert.deepEqual(signals.failedRequests, [], `${viewport.width}: failed requests`);
    assert.deepEqual(signals.network.unexpectedPublic, [], `${viewport.width}: unexpected public network`);
    assert.ok(signals.network.remoteIntercepts >= 2, `${viewport.width}: remote media was not intercepted in flow and dialog`);
    assert.ok(signals.localImageResponses.length > 0, `${viewport.width}: no generated image responses recorded`);
    assert.ok(signals.localImageResponses.every((response) => response.status >= 200 && response.status < 300), `${viewport.width}: generated image request failed`);

    return { viewport, contract, paintReadiness, readingScreenshot, focus, interactions, signals };
  } finally {
    await context.close();
  }
}

async function runReducedMotionViewport(browser, baseUrl, viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce", serviceWorkers: "block" });
  const signals = {
    pageErrors: [],
    consoleEntries: [],
    failedRequests: [],
    localImageResponses: [],
    network: { requests: [], remoteIntercepts: 0, blockedExpected: [], unexpectedPublic: [] }
  };
  await installNetworkIsolation(context, baseUrl, signals.network);
  const page = await context.newPage();
  captureRuntimeSignals(page, signals);
  try {
    await page.goto(`${baseUrl}${ROUTE_PATH}`, { waitUntil: "networkidle" });
    await page.getByTestId("article-media-verification-route").waitFor({ state: "visible" });
    await page.getByTestId("article-media-opener-1").scrollIntoViewIfNeeded();
    const motion = await collectReducedMotion(page);
    assert.equal(motion.openerTransition, "0s", `${viewport.width}: reduced-motion opener transition`);
    assert.equal(motion.imageTransition, "0s", `${viewport.width}: reduced-motion image transition`);
    assert.equal(motion.dialogTransition, "0s", `${viewport.width}: reduced-motion dialog transition`);
    assert.deepEqual(signals.pageErrors, []);
    assert.deepEqual(signals.consoleEntries, []);
    assert.deepEqual(signals.network.unexpectedPublic, []);
    return { viewport, motion, signals };
  } finally {
    await context.close();
  }
}

const { inventory, generation } = await prepareArticleMediaVerificationRuntime();
await mkdir(EVIDENCE_ROOT, { recursive: true });
let server;
let browser;

try {
  server = await createServer({
    root: PROJECT_ROOT,
    configFile: path.join(PROJECT_ROOT, "vite.config.js"),
    mode: "verification",
    logLevel: "error",
    server: { host: "127.0.0.1", port: 0, strictPort: false }
  });
  await server.listen();
  const address = server.httpServer.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });

  const viewportResults = [];
  for (const viewport of VIEWPORTS) {
    viewportResults.push(await runViewport(browser, baseUrl, viewport, generation.manifest));
  }

  const reducedMotionResults = [];
  for (const viewport of VIEWPORTS) {
    reducedMotionResults.push(await runReducedMotionViewport(browser, baseUrl, viewport));
  }

  const summary = {
    command: "npm run verify:article-media-browser",
    passed: true,
    route: ROUTE_PATH,
    fixture: {
      title: inventory.title,
      marker: inventory.marker,
      sourceCount: generation.sourceCount
    },
    viewports: VIEWPORTS,
    viewportResults,
    reducedMotionResults
  };
  const interactions = {
    command: summary.command,
    passed: true,
    results: viewportResults.map(({ viewport, focus, interactions, signals }) => ({ viewport, focus, interactions, signals }))
  };

  await writeFile(path.join(EVIDENCE_ROOT, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(path.join(EVIDENCE_ROOT, "dom-structure.json"), `${JSON.stringify(viewportResults.map(({ viewport, contract }) => ({ viewport, structure: contract.structure, fixtureChrome: contract.fixtureChrome })), null, 2)}\n`);
  await writeFile(path.join(EVIDENCE_ROOT, "responsive-sources.json"), `${JSON.stringify(viewportResults.map(({ viewport, contract }) => ({ viewport, sources: contract.sources })), null, 2)}\n`);
  await writeFile(path.join(EVIDENCE_ROOT, "layout-metrics.json"), `${JSON.stringify(viewportResults.map(({ viewport, contract }) => ({ viewport, layout: contract.layout })), null, 2)}\n`);
  await writeFile(path.join(EVIDENCE_ROOT, "interactions.json"), `${JSON.stringify(interactions, null, 2)}\n`);
  await writeFile(path.join(EVIDENCE_ROOT, "motion-focus.json"), `${JSON.stringify({ focus: viewportResults.map(({ viewport, focus }) => ({ viewport, focus })), reducedMotionResults }, null, 2)}\n`);
  console.log("PASS article media browser verification (4 viewports, real route, responsive media, dialog, network, persistence)");
} finally {
  await Promise.allSettled([browser?.close(), server?.close()].filter(Boolean));
}
