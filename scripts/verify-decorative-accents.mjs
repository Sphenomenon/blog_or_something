import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";
import { createServer } from "vite";

import { decorativeAccents } from "../src/data/decorative-accents.js";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const EVIDENCE_ROOT = path.join(PROJECT_ROOT, ".sisyphus/evidence");
const SUMMARY_PATH = path.join(EVIDENCE_ROOT, "task-8-decorative-accents.json");
const ERROR_PATH = path.join(EVIDENCE_ROOT, "task-8-decorative-accents-error.txt");
const SCREENSHOT_PREFIX = "task-8-decorative-accent-";
const ATTRIBUTION_PATH = path.join(PROJECT_ROOT, "public/third-party/scp-ambrose-dusk/attribution.json");
const COMMAND = "npm run verify:decorative-accents";
const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1024, height: 900 },
  { width: 1440, height: 1000 }
];
const SCREENSHOT_WIDTH_LABELS = new Map([[375, "mobile"], [1440, "desktop"]]);
const BLOCKED_THIRD_PARTY_HOSTS = new Set([
  "identity.netlify.com",
  "events.vercount.one",
  "music.163.com",
  "fonts.loli.net",
  "gstatic.loli.net",
  "webapi.amap.com",
  "cachetide.top",
  "giscus.app"
]);
const EXCLUSION_SELECTORS = [
  ".site-header",
  ".music-easter-egg",
  ".music-mini-player",
  ".back-to-top",
  "article.prose",
  ".article-media",
  "[data-testid='article-media-dialog']",
  ".rail-left",
  ".rail-right",
  "[data-testid^='toc-']",
  ".archive-card",
  ".food-map-spot-card",
  ".food-map-detail",
  ".food-map-map-shell"
];
const NEGATIVE_CASES = ["wrong-url", "duplicate-accent", "source-png"];

function expectedHeight(width) {
  if (width <= 430) return 60;
  if (width <= 768) return 80;
  return Math.max(88, Math.min(width * 0.08, 120));
}

function closeEnough(actual, expected, tolerance = 1) {
  return Math.abs(actual - expected) <= tolerance;
}

function overlapArea(left, right) {
  const width = Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left));
  const height = Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
  return width * height;
}

function containerSelectorFor(record) {
  if (record.surface === "/") return ".hero-panel";
  if (record.surface === "/archive") return ".page-panel--archive";
  if (record.surface === "/food-map") return ".page-panel--food-map .page-panel-header--stacked";
  if (record.surface === "/about") return ".page-panel--about";
  if (record.surface.startsWith("/sections/")) return ".page-panel--section";
  throw new Error(`Unsupported decorative accent surface: ${record.surface}`);
}

function assertNonEmptyString(value, message) {
  assert.equal(typeof value, "string", message);
  assert.ok(value.trim().length > 0, message);
}

function assertRegistryAndAttribution(attribution) {
  assert.equal(decorativeAccents.length, 10, "decorative registry must contain ten records");
  assert.equal(new Set(decorativeAccents.map((record) => record.id)).size, decorativeAccents.length, "decorative registry IDs must be unique");
  assert.equal(new Set(decorativeAccents.map((record) => record.surface)).size, decorativeAccents.length, "decorative registry surfaces must be unique");
  assert.equal(new Set(decorativeAccents.map((record) => record.publicUrl)).size, decorativeAccents.length, "decorative registry URLs must be unique");
  assert.ok(attribution.sourceWork && typeof attribution.sourceWork === "object", "attribution sourceWork must be an object");
  assert.ok(Array.isArray(attribution.assets), "attribution assets must be an array");
  assert.equal(attribution.assets.length, 24, "attribution must preserve all 24 original asset records");
  assert.ok(Array.isArray(attribution.derivatives), "attribution derivatives must be an array");
  assert.equal(attribution.derivatives.length, decorativeAccents.length, "attribution derivative count must match registry");

  const sourceWork = attribution.sourceWork;
  assertNonEmptyString(sourceWork.title, "attribution sourceWork title must be nonempty");
  assert.ok(Array.isArray(sourceWork.authors) && sourceWork.authors.length > 0, "attribution sourceWork authors must be a nonempty array");
  for (const author of sourceWork.authors) assertNonEmptyString(author, "attribution sourceWork authors must be nonempty strings");
  assertNonEmptyString(sourceWork.url, "attribution sourceWork URL must be nonempty");
  assertNonEmptyString(sourceWork.license, "attribution sourceWork license must be nonempty");
  assertNonEmptyString(sourceWork.licenseUrl, "attribution sourceWork license URL must be nonempty");
  assertNonEmptyString(sourceWork.notice, "attribution sourceWork notice must be nonempty");

  for (const asset of attribution.assets) {
    assertNonEmptyString(asset.filename, "attribution original filename must be nonempty");
    assert.equal(asset.modified, false, `${asset.filename}: original asset modified must remain false`);
  }
  const excludedGif = attribution.assets.find((asset) => asset.filename === "hero-city-glitch.gif");
  assert.ok(excludedGif, "hero-city-glitch.gif: original asset record missing");
  assert.deepEqual(excludedGif.usedOn, [], "hero-city-glitch.gif: excluded asset must not claim any usage");

  const registryById = new Map(decorativeAccents.map((record) => [record.id, record]));
  const derivativesById = new Map(attribution.derivatives.map((record) => [record.accentId, record]));
  assert.equal(derivativesById.size, attribution.derivatives.length, "attribution derivative IDs must be unique");

  for (const record of decorativeAccents) {
    const matchingAssets = attribution.assets.filter((asset) => asset.filename === record.sourceFilename);
    assert.equal(matchingAssets.length, 1, `${record.id}: expected exactly one original asset for ${record.sourceFilename}`);
    const sourceAsset = matchingAssets[0];
    const derivative = derivativesById.get(record.id);
    assert.ok(derivative, `${record.id}: attribution derivative missing`);
    assert.equal(derivative.sourceFilename, record.sourceFilename, `${record.id}: attribution source mismatch`);
    assert.equal(derivative.outputPath, record.publicUrl, `${record.id}: attribution output mismatch`);
    assertNonEmptyString(derivative.usageLocation, `${record.id}: attribution usage location must be nonempty`);
    assert.ok(Array.isArray(sourceAsset.usedOn) && sourceAsset.usedOn.includes(derivative.usageLocation), `${record.id}: usage location must match the original asset ledger`);
    assert.deepEqual(derivative.conversion, {
      format: "WebP",
      quality: 80,
      effort: 6,
      width: 1920,
      withoutEnlargement: true,
      autoOrientation: true
    }, `${record.id}: attribution conversion metadata mismatch`);
    assert.deepEqual(derivative.sourceDimensions, { width: 2000, height: 500 }, `${record.id}: attribution source dimensions mismatch`);
    assert.deepEqual(derivative.outputDimensions, { width: 1920, height: 480 }, `${record.id}: attribution output dimensions mismatch`);
    assert.deepEqual(derivative.presentation, {
      cssCrop: true,
      cssCover: true,
      focalPosition: record.backgroundPosition,
      originalRasterModified: false
    }, `${record.id}: attribution presentation metadata mismatch or contains unsupported darkening metadata`);
    assert.equal(derivative.sourceWorkTitle, sourceWork.title, `${record.id}: source-work title mismatch`);
    assert.deepEqual(derivative.sourceWorkAuthors, sourceWork.authors, `${record.id}: source-work authors mismatch`);
    assert.equal(derivative.sourceWorkUrl, sourceWork.url, `${record.id}: source-work URL mismatch`);
    assert.equal(derivative.license, sourceWork.license, `${record.id}: license mismatch`);
    assert.equal(derivative.licenseUrl, sourceWork.licenseUrl, `${record.id}: license URL mismatch`);
    assert.equal(derivative.originalRasterAuthorCaveat, sourceAsset.author, `${record.id}: raster-author caveat mismatch`);
    assert.equal(derivative.directSourceUrl, sourceAsset.sourceUrl, `${record.id}: direct source URL mismatch`);
    assert.equal(derivative.attributionNotice, sourceWork.notice, `${record.id}: attribution notice mismatch`);
    assert.equal(sourceAsset.sourcePage, sourceWork.url, `${record.id}: original source page mismatch`);
    assert.equal(sourceAsset.license, sourceWork.license, `${record.id}: original asset license mismatch`);
    assertNonEmptyString(derivative.originalRasterAuthorCaveat, `${record.id}: raster-author caveat must be nonempty`);
    assertNonEmptyString(derivative.directSourceUrl, `${record.id}: direct source URL must be nonempty`);
    assertNonEmptyString(derivative.attributionNotice, `${record.id}: attribution notice must be nonempty`);
  }

  for (const derivative of attribution.derivatives) {
    const registryRecord = registryById.get(derivative.accentId);
    assert.ok(registryRecord, `${derivative.accentId}: attribution contains an unregistered derivative`);
    assert.equal(derivative.outputPath, registryRecord.publicUrl, `${derivative.accentId}: reverse output mismatch`);
  }
}

function assertNegativeContract(probe) {
  assert.equal(probe.accents.length, 1, `${probe.surface}: expected exactly one decorative accent, found ${probe.accents.length}`);
  assert.equal(probe.accents[0].id, probe.expected.id, `${probe.surface}: expected accent ${probe.expected.id}, found ${probe.accents[0].id}`);
  assert.equal(probe.accents[0].url, probe.expected.url, `${probe.surface}: wrong decorative accent URL ${probe.accents[0].url}`);
  const sourceRequest = probe.imageRequests.find((url) => probe.sourceFilenames.some((filename) => new URL(url, "http://verification.invalid").pathname.endsWith(`/${filename}`)));
  assert.equal(sourceRequest, undefined, `${probe.surface}: source PNG request detected ${sourceRequest}`);
}

async function runNegativeChild(caseName) {
  const record = decorativeAccents[0];
  const baseProbe = {
    surface: record.surface,
    expected: { id: record.id, url: record.publicUrl },
    accents: [{ id: record.id, url: record.publicUrl }],
    imageRequests: [record.publicUrl],
    sourceFilenames: decorativeAccents.map((item) => item.sourceFilename)
  };

  if (caseName === "wrong-url") baseProbe.accents[0].url = decorativeAccents[1].publicUrl;
  if (caseName === "duplicate-accent") baseProbe.accents.push({ id: decorativeAccents[1].id, url: decorativeAccents[1].publicUrl });
  if (caseName === "source-png") baseProbe.imageRequests.push(`/third-party/scp-ambrose-dusk/${record.sourceFilename}`);
  assertNegativeContract(baseProbe);
}

async function runNegativeContracts() {
  const lines = [];
  for (const caseName of NEGATIVE_CASES) {
    try {
      await execFileAsync(process.execPath, [SCRIPT_PATH], {
        cwd: PROJECT_ROOT,
        env: { ...process.env, DECORATIVE_ACCENTS_NEGATIVE_CASE: caseName }
      });
      assert.fail(`${caseName}: negative contract unexpectedly passed`);
    } catch (error) {
      assert.notEqual(error.code, 0, `${caseName}: negative child must exit nonzero`);
      const output = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim();
      const expectedFragment = caseName === "wrong-url"
        ? "wrong decorative accent URL"
        : caseName === "duplicate-accent"
          ? "expected exactly one decorative accent"
          : "source PNG request detected";
      assert.match(output, new RegExp(expectedFragment), `${caseName}: failure diagnostic did not identify the violated contract`);
      lines.push(`[PASS] ${caseName}\n${output}`);
    }
  }
  await writeFile(ERROR_PATH, `${lines.join("\n\n")}\n`, "utf8");
  return lines;
}

async function cleanScreenshotEvidence() {
  await mkdir(EVIDENCE_ROOT, { recursive: true });
  const entries = await readdir(EVIDENCE_ROOT);
  await Promise.all(entries
    .filter((name) => name.startsWith(SCREENSHOT_PREFIX) && name.endsWith(".png"))
    .map((name) => rm(path.join(EVIDENCE_ROOT, name))));
}

async function startServer() {
  const previousAmapKey = process.env.VITE_AMAP_KEY;
  delete process.env.VITE_AMAP_KEY;
  const server = await createServer({
    root: PROJECT_ROOT,
    configFile: path.join(PROJECT_ROOT, "vite.config.js"),
    mode: "verification",
    logLevel: "error",
    server: { host: "127.0.0.1", port: 0, strictPort: false }
  });
  await server.listen();
  const address = server.httpServer?.address();
  assert.ok(address && typeof address === "object", "Vite verification server did not expose an address");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      if (previousAmapKey === undefined) delete process.env.VITE_AMAP_KEY;
      else process.env.VITE_AMAP_KEY = previousAmapKey;
      await server.close();
    }
  };
}

function createSignals() {
  return {
    consoleErrors: [],
    consoleWarnings: [],
    ignoredReducedMotionWarnings: [],
    pageErrors: [],
    failedRequests: [],
    requests: [],
    imageResponses: []
  };
}

async function createContext(browser, baseUrl, viewport, reducedMotion = "no-preference") {
  const context = await browser.newContext({ viewport, reducedMotion, serviceWorkers: "block" });
  const signals = createSignals();
  const localOrigin = new URL(baseUrl).origin;

  await context.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const requestUrl = new URL(typeof input === "string" ? input : input.url, location.href);
      if (requestUrl.pathname === "/food-map/sources.json") {
        return Promise.resolve(new Response("[]", { status: 200, headers: { "content-type": "application/json" } }));
      }
      return nativeFetch(input, init);
    };
  });

  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    signals.requests.push({ url: request.url(), resourceType: request.resourceType() });

    if (url.origin === localOrigin || url.protocol === "data:" || url.protocol === "blob:") {
      await route.continue();
      return;
    }

    const resourceType = request.resourceType();
    const contentType = resourceType === "script"
      ? "application/javascript"
      : resourceType === "stylesheet"
        ? "text/css"
        : resourceType === "image"
          ? "image/svg+xml"
          : "text/html";
    const body = resourceType === "image"
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'
      : resourceType === "script" || resourceType === "stylesheet"
        ? ""
        : "<!doctype html><html><body></body></html>";
    if (!BLOCKED_THIRD_PARTY_HOSTS.has(url.hostname)) signals.requests.at(-1).unexpectedPublic = true;
    await route.fulfill({ status: 200, contentType, body });
  });

  const page = await context.newPage();
  page.on("pageerror", (error) => signals.pageErrors.push(error.stack || error.message));
  page.on("requestfailed", (request) => signals.failedRequests.push({ url: request.url(), error: request.failure()?.errorText ?? null }));
  page.on("console", (message) => {
    const entry = { type: message.type(), text: message.text() };
    if (entry.type === "error") signals.consoleErrors.push(entry);
    if (entry.type === "warning") {
      if (entry.text.startsWith("You have Reduced Motion enabled on your device.")) signals.ignoredReducedMotionWarnings.push(entry);
      else signals.consoleWarnings.push(entry);
    }
  });
  page.on("response", (response) => {
    if (response.request().resourceType() === "image") {
      signals.imageResponses.push({ url: response.url(), status: response.status() });
    }
  });
  return { context, page, signals };
}

async function openTargetRoute(page, baseUrl, record) {
  await page.goto(`${baseUrl}${record.surface}`, { waitUntil: "networkidle", timeout: 20000 });
  if (record.surface === "/") {
    const gate = page.getByTestId("greeting-gate");
    if (await gate.isVisible().catch(() => false)) {
      await page.getByTestId("greeting-enter-home").click();
      await gate.waitFor({ state: "hidden", timeout: 10000 });
    }
  }
  await page.getByTestId(`decorative-accent-${record.id}`).waitFor({ state: "visible", timeout: 10000 });
  await page.waitForFunction((id) => {
    const accent = document.querySelector(`[data-accent-id="${CSS.escape(id)}"]`);
    return Boolean(accent && getComputedStyle(accent).backgroundImage.includes("url("));
  }, record.id);
}

async function collectContract(page, record, containerSelector) {
  return page.evaluate(({ expectedId, selector, exclusions, focusableSelector }) => {
    const rectValue = (element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number.parseFloat(style.opacity || "1") > 0 && rect.width > 0 && rect.height > 0;
    };
    const accents = Array.from(document.querySelectorAll(".decorative-accent"));
    const accent = document.querySelector(`[data-accent-id="${CSS.escape(expectedId)}"]`);
    const container = document.querySelector(selector);
    const accentStyle = accent ? getComputedStyle(accent) : null;
    const backgroundUrls = accentStyle
      ? Array.from(accentStyle.backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g), (match) => new URL(match[1], location.href).href)
      : [];
    const relevantNodes = container
      ? Array.from(container.querySelectorAll("h1, h2, p, dl, button, a, input, select, textarea"))
        .filter((node) => !accent?.contains(node) && visible(node))
        .map((node) => ({ tag: node.tagName, className: node.className, testId: node.getAttribute("data-testid"), rect: rectValue(node) }))
      : [];
    const originalScroll = { x: scrollX, y: scrollY };
    const controls = Array.from(document.querySelectorAll(focusableSelector))
      .filter((node) => visible(node) && !node.disabled)
      .map((node) => {
        node.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
        const clientRects = Array.from(node.getClientRects());
        const rect = clientRects.reduce((largest, candidate) => {
          if (!largest) return candidate;
          return candidate.width * candidate.height > largest.width * largest.height ? candidate : largest;
        }, null) ?? node.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(x, y);
        let clippedByAncestor = false;
        let hiddenByAncestorState = false;
        for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
          if (ancestor.getAttribute("aria-hidden") === "true" || ancestor.getAttribute("data-expanded") === "false" || ancestor.classList.contains("is-collapsed")) {
            hiddenByAncestorState = true;
            break;
          }
          const ancestorStyle = getComputedStyle(ancestor);
          const clipsX = ["auto", "clip", "hidden", "scroll"].includes(ancestorStyle.overflowX);
          const clipsY = ["auto", "clip", "hidden", "scroll"].includes(ancestorStyle.overflowY);
          if (!clipsX && !clipsY) continue;
          const ancestorRect = ancestor.getBoundingClientRect();
          if ((clipsX && (x < ancestorRect.left || x > ancestorRect.right)) || (clipsY && (y < ancestorRect.top || y > ancestorRect.bottom))) {
            clippedByAncestor = true;
            break;
          }
        }
        return {
          tag: node.tagName,
          id: node.id,
          className: node.className,
          ariaLabel: node.getAttribute("aria-label"),
          testId: node.getAttribute("data-testid"),
          text: node.textContent?.replace(/\s+/g, " ").trim().slice(0, 80) ?? "",
          markup: node.outerHTML.slice(0, 240),
          centerInViewport: x >= 0 && x < innerWidth && y >= 0 && y < innerHeight,
          clippedByAncestor,
          hiddenByAncestorState,
          centerHit: !hit || node === hit || node.contains(hit),
          hitTag: hit?.tagName ?? null,
          hitClassName: hit?.className ?? null,
          hitTestId: hit?.getAttribute?.("data-testid") ?? null
        };
      });
    scrollTo(originalScroll.x, originalScroll.y);
    return {
      pathname: location.pathname,
      headingCount: document.querySelectorAll("h1").length,
      accentCount: accents.length,
      accentIds: accents.map((node) => node.getAttribute("data-accent-id")),
      matchingCount: document.querySelectorAll(`[data-accent-id="${CSS.escape(expectedId)}"]`).length,
      accentParentMatchesContainer: Boolean(accent && container && accent.parentElement === container),
      accentPreviousSiblingClassName: accent?.previousElementSibling?.className ?? null,
      accentNextSiblingClassName: accent?.nextElementSibling?.className ?? null,
      sectionHeroDirectChildClassNames: Array.from(document.querySelector(".section-hero")?.children ?? []).map((node) => node.className),
      accentRect: accent ? rectValue(accent) : null,
      containerRect: container ? rectValue(container) : null,
      backgroundUrls,
      pointerEvents: accentStyle?.pointerEvents ?? null,
      ariaHidden: accent?.getAttribute("aria-hidden") ?? null,
      focusableDescendants: accent?.querySelectorAll(focusableSelector).length ?? null,
      motion: {
        animationName: accentStyle?.animationName ?? null,
        animationDuration: accentStyle?.animationDuration ?? null,
        animationDelay: accentStyle?.animationDelay ?? null,
        transitionDuration: accentStyle?.transitionDuration ?? null,
        transitionDelay: accentStyle?.transitionDelay ?? null,
        transform: accentStyle?.transform ?? null
      },
      overflow: {
        rootScrollWidth: document.documentElement.scrollWidth,
        rootClientWidth: document.documentElement.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
        bodyClientWidth: document.body.clientWidth
      },
      relevantNodes,
      controls,
      exclusions: exclusions.map((exclusionSelector) => ({
        selector: exclusionSelector,
        containers: document.querySelectorAll(exclusionSelector).length,
        accentDescendants: Array.from(document.querySelectorAll(exclusionSelector)).reduce((sum, node) => sum + node.querySelectorAll(".decorative-accent").length, 0)
      }))
    };
  }, {
    expectedId: record.id,
    selector: containerSelector,
    exclusions: EXCLUSION_SELECTORS,
    focusableSelector: "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])"
  });
}

function assertCleanSignals(signals, label) {
  assert.deepEqual(signals.pageErrors, [], `${label}: page errors`);
  assert.deepEqual(signals.consoleErrors, [], `${label}: console errors`);
  assert.deepEqual(signals.consoleWarnings, [], `${label}: console warnings`);
  assert.deepEqual(signals.failedRequests, [], `${label}: failed requests`);
  const unexpectedPublicUrls = signals.requests.filter((request) => request.unexpectedPublic === true).map((request) => request.url);
  assert.deepEqual(unexpectedPublicUrls, [], `${label}: unexpected non-allowlisted public requests: ${unexpectedPublicUrls.join(", ")}`);
}

function assertRequestContract(signals, baseUrl, record) {
  const localOrigin = new URL(baseUrl).origin;
  const expectedUrl = new URL(record.publicUrl, baseUrl).href;
  const registryUrls = new Set(decorativeAccents.map((item) => new URL(item.publicUrl, baseUrl).href));
  const sourceFilenames = decorativeAccents.map((item) => item.sourceFilename);
  const imageRequests = signals.requests.filter((request) => request.resourceType === "image").map((request) => request.url);
  const decorativeRequests = imageRequests.filter((url) => registryUrls.has(url));
  const sourceRequests = imageRequests.filter((url) => sourceFilenames.some((filename) => new URL(url).pathname.endsWith(`/${filename}`)));
  const gifRequests = imageRequests.filter((url) => new URL(url).pathname.endsWith("/hero-city-glitch.gif"));
  const unscopedDecorativeWebps = imageRequests.filter((url) => {
    const parsed = new URL(url);
    return parsed.pathname.includes("/scp-ambrose-dusk/") && parsed.pathname.endsWith(".webp") && !registryUrls.has(url);
  });
  const externalDecorativeRequests = imageRequests.filter((url) => {
    const parsed = new URL(url);
    return parsed.origin !== localOrigin && (sourceFilenames.some((filename) => parsed.pathname.endsWith(`/${filename}`)) || parsed.pathname.endsWith("/hero-city-glitch.gif"));
  });
  const expectedResponses = signals.imageResponses.filter((response) => response.url === expectedUrl);

  assert.deepEqual(decorativeRequests, [expectedUrl], `${record.surface}: route must request only its registered decorative WebP`);
  assert.deepEqual(sourceRequests, [], `${record.surface}: source PNG requested`);
  assert.deepEqual(gifRequests, [], `${record.surface}: excluded GIF requested`);
  assert.deepEqual(unscopedDecorativeWebps, [], `${record.surface}: unscoped decorative WebP requested`);
  assert.deepEqual(externalDecorativeRequests, [], `${record.surface}: external decorative image requested`);
  assert.equal(expectedResponses.length, 1, `${record.surface}: expected one decorative image response`);
  assert.equal(new URL(expectedResponses[0].url).origin, localOrigin, `${record.surface}: decorative response must be same-origin`);
  assert.ok(expectedResponses[0].status >= 200 && expectedResponses[0].status < 300, `${record.surface}: decorative response must be 2xx`);
  return { imageRequests, decorativeRequests, expectedResponses, sourceRequests, gifRequests, unscopedDecorativeWebps, externalDecorativeRequests };
}

function assertPageContract(contract, record, viewport) {
  const expectedUrl = new URL(record.publicUrl, "http://127.0.0.1").pathname;
  assert.equal(contract.pathname, record.surface, `${record.id}: pathname mismatch`);
  assert.equal(contract.headingCount, 1, `${record.surface}: expected one h1`);
  assert.equal(contract.accentCount, 1, `${record.surface}: expected exactly one accent`);
  assert.equal(contract.matchingCount, 1, `${record.surface}: matching accent count`);
  assert.deepEqual(contract.accentIds, [record.id], `${record.surface}: another accent leaked onto route`);
  assert.equal(contract.accentParentMatchesContainer, true, `${record.surface}: accent is not a direct child of its required container`);
  if (record.surface.startsWith("/sections/")) {
    assert.deepEqual(contract.sectionHeroDirectChildClassNames, ["section-hero-copy", "section-metadata"], `${record.surface}: section hero must keep its two-column direct-child order`);
    assert.equal(contract.accentPreviousSiblingClassName, "section-hero", `${record.surface}: section accent must immediately follow the complete hero`);
    assert.equal(contract.accentNextSiblingClassName, "section-posts", `${record.surface}: section accent must remain immediately before the posts block`);
  }
  assert.deepEqual(contract.backgroundUrls.map((url) => new URL(url).pathname), [expectedUrl], `${record.surface}: computed accent URL mismatch`);
  assert.ok(contract.accentRect.width > 0 && contract.accentRect.height > 0, `${record.surface}: accent has no rendered box`);
  assert.equal(contract.pointerEvents, "none", `${record.surface}: accent pointer-events must be none`);
  assert.equal(contract.ariaHidden, "true", `${record.surface}: accent must be aria-hidden`);
  assert.equal(contract.focusableDescendants, 0, `${record.surface}: accent contains focusable descendants`);
  assert.ok(closeEnough(contract.accentRect.height, expectedHeight(viewport.width), 1), `${record.surface} ${viewport.width}: accent height ${contract.accentRect.height} does not match contract ${expectedHeight(viewport.width)}`);
  assert.ok(contract.accentRect.left >= contract.containerRect.left - 1, `${record.surface}: accent escapes container left edge`);
  assert.ok(contract.accentRect.right <= contract.containerRect.right + 1, `${record.surface}: accent escapes container right edge`);
  assert.ok(contract.accentRect.top >= contract.containerRect.top - 1, `${record.surface}: accent escapes container top edge`);
  assert.ok(contract.accentRect.bottom <= contract.containerRect.bottom + 1, `${record.surface}: accent escapes container bottom edge`);
  assert.ok(contract.overflow.rootScrollWidth <= contract.overflow.rootClientWidth, `${record.surface} ${viewport.width}: root horizontal overflow`);
  assert.ok(contract.overflow.bodyScrollWidth <= contract.overflow.bodyClientWidth, `${record.surface} ${viewport.width}: body horizontal overflow`);
  for (const node of contract.relevantNodes) {
    assert.equal(overlapArea(contract.accentRect, node.rect), 0, `${record.surface} ${viewport.width}: accent overlaps ${node.testId ?? node.className ?? node.tag}`);
  }
  for (const control of contract.controls.filter((item) => item.centerInViewport && !item.clippedByAncestor && !item.hiddenByAncestorState)) {
    assert.equal(control.centerHit, true, `${record.surface} ${viewport.width}: control center is blocked (${control.testId || control.id || control.ariaLabel || control.className || control.text || control.tag}; hit ${control.hitTestId || control.hitClassName || control.hitTag}; target ${control.markup})`);
  }
  for (const exclusion of contract.exclusions) {
    assert.equal(exclusion.accentDescendants, 0, `${record.surface}: accent entered excluded container ${exclusion.selector}`);
  }
}

async function runViewport(browser, baseUrl, record, viewport) {
  const { context, page, signals } = await createContext(browser, baseUrl, viewport);
  try {
    await openTargetRoute(page, baseUrl, record);
    const contract = await collectContract(page, record, containerSelectorFor(record));
    assertPageContract(contract, record, viewport);
    const network = assertRequestContract(signals, baseUrl, record);
    assertCleanSignals(signals, `${record.surface} ${viewport.width}`);
    let screenshot = null;
    const screenshotLabel = SCREENSHOT_WIDTH_LABELS.get(viewport.width);
    if (screenshotLabel) {
      screenshot = `${SCREENSHOT_PREFIX}${record.id}-${screenshotLabel}.png`;
      await page.screenshot({ path: path.join(EVIDENCE_ROOT, screenshot), fullPage: true, animations: "disabled", scale: "css" });
    }
    return { viewport, contract, network, signals, screenshot };
  } finally {
    await context.close();
  }
}

async function runReducedMotion(browser, baseUrl, record) {
  const viewport = { width: 1440, height: 1000 };
  const { context, page, signals } = await createContext(browser, baseUrl, viewport, "reduce");
  try {
    await openTargetRoute(page, baseUrl, record);
    const contract = await collectContract(page, record, containerSelectorFor(record));
    assert.equal(contract.accentCount, 1, `${record.surface}: reduced-motion accent missing`);
    assert.equal(contract.motion.animationName, "none", `${record.surface}: reduced-motion animation name`);
    assert.equal(contract.motion.animationDuration, "0s", `${record.surface}: reduced-motion animation duration`);
    assert.equal(contract.motion.animationDelay, "0s", `${record.surface}: reduced-motion animation delay`);
    assert.equal(contract.motion.transitionDuration, "0s", `${record.surface}: reduced-motion transition duration`);
    assert.equal(contract.motion.transitionDelay, "0s", `${record.surface}: reduced-motion transition delay`);
    assert.equal(contract.motion.transform, "none", `${record.surface}: reduced-motion transform`);
    const network = assertRequestContract(signals, baseUrl, record);
    assert.deepEqual(network.gifRequests, [], `${record.surface}: reduced-motion requested excluded GIF`);
    assertCleanSignals(signals, `${record.surface} reduced-motion`);
    return { surface: record.surface, motion: contract.motion, signals, network };
  } finally {
    await context.close();
  }
}

async function assertZeroAccentRoute(browser, baseUrl, route, waitSelector, options = {}) {
  const { context, page, signals } = await createContext(browser, baseUrl, { width: 1440, height: 1000 });
  try {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle", timeout: 20000 });
    await page.locator(waitSelector).waitFor({ state: "visible", timeout: 10000 });
    if (options.greeting) assert.equal(await page.getByTestId("greeting-gate").isVisible(), true, "greeting gate must be visible for zero-accent check");
    const state = await page.evaluate((exclusions) => ({
      accentCount: document.querySelectorAll(".decorative-accent").length,
      headingCount: document.querySelectorAll("h1").length,
      exclusions: exclusions.map((selector) => ({
        selector,
        accentDescendants: Array.from(document.querySelectorAll(selector)).reduce((sum, node) => sum + node.querySelectorAll(".decorative-accent").length, 0)
      }))
    }), EXCLUSION_SELECTORS);
    assert.equal(state.accentCount, 0, `${route}: non-target route rendered an accent`);
    for (const exclusion of state.exclusions) assert.equal(exclusion.accentDescendants, 0, `${route}: excluded container ${exclusion.selector} contains an accent`);
    const registryUrls = new Set(decorativeAccents.map((record) => new URL(record.publicUrl, baseUrl).href));
    assert.deepEqual(signals.requests.filter((request) => request.resourceType === "image" && registryUrls.has(request.url)), [], `${route}: non-target route requested a decorative WebP`);
    assertCleanSignals(signals, `${route} zero-accent`);
    return { route, state, signals };
  } finally {
    await context.close();
  }
}

async function run() {
  const attribution = JSON.parse(await readFile(ATTRIBUTION_PATH, "utf8"));
  assertRegistryAndAttribution(attribution);
  await cleanScreenshotEvidence();
  const negativeContracts = await runNegativeContracts();
  let server;
  let browser;
  try {
    server = await startServer();
    browser = await chromium.launch({ headless: true });
    const routeResults = [];
    for (const record of decorativeAccents) {
      const widths = [];
      for (const viewport of VIEWPORTS) widths.push(await runViewport(browser, server.baseUrl, record, viewport));
      routeResults.push({ record, widths });
    }

    const reducedMotionResults = [];
    for (const record of decorativeAccents) reducedMotionResults.push(await runReducedMotion(browser, server.baseUrl, record));

    const zeroAccentResults = [
      await assertZeroAccentRoute(browser, server.baseUrl, "/", "[data-testid='greeting-gate']", { greeting: true }),
      await assertZeroAccentRoute(browser, server.baseUrl, "/posts/petrified-corridor", "article.prose"),
      await assertZeroAccentRoute(browser, server.baseUrl, "/route-that-does-not-exist", "[data-testid='not-found-view']")
    ];

    const screenshotFiles = (await readdir(EVIDENCE_ROOT)).filter((name) => name.startsWith(SCREENSHOT_PREFIX) && name.endsWith(".png")).sort();
    assert.equal(screenshotFiles.length, 20, "verification must write exactly 20 decorative accent screenshots");
    const allSignals = [
      ...routeResults.flatMap((result) => result.widths.map((width) => width.signals)),
      ...reducedMotionResults.map((result) => result.signals),
      ...zeroAccentResults.map((result) => result.signals)
    ];
    const summary = {
      command: COMMAND,
      generatedAt: new Date().toISOString(),
      passed: true,
      totals: {
        routes: { passed: routeResults.length, total: decorativeAccents.length },
        widths: { passed: VIEWPORTS.length, total: VIEWPORTS.length },
        routeWidthChecks: routeResults.reduce((sum, result) => sum + result.widths.length, 0),
        screenshots: screenshotFiles.length,
        failedRequests: allSignals.reduce((sum, signals) => sum + signals.failedRequests.length, 0),
        consoleErrors: allSignals.reduce((sum, signals) => sum + signals.consoleErrors.length, 0),
        consoleWarnings: allSignals.reduce((sum, signals) => sum + signals.consoleWarnings.length, 0),
        pageErrors: allSignals.reduce((sum, signals) => sum + signals.pageErrors.length, 0)
      },
      registry: decorativeAccents,
      attributionParity: { registryCount: decorativeAccents.length, derivativeCount: attribution.derivatives.length, bidirectional: true },
      viewports: VIEWPORTS,
      routeResults,
      reducedMotionResults,
      zeroAccentResults,
      negativeContracts,
      screenshots: screenshotFiles
    };
    assert.deepEqual(summary.totals.routes, { passed: 10, total: 10 });
    assert.deepEqual(summary.totals.widths, { passed: 4, total: 4 });
    assert.equal(summary.totals.routeWidthChecks, 40);
    assert.equal(summary.totals.screenshots, 20);
    assert.equal(summary.totals.failedRequests, 0);
    assert.equal(summary.totals.consoleErrors, 0);
    assert.equal(summary.totals.consoleWarnings, 0);
    assert.equal(summary.totals.pageErrors, 0);
    await writeFile(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    console.log("PASS decorative accents verification (10/10 routes, 4/4 widths, 20 screenshots, 0 failed requests, 0 console errors)");
  } finally {
    await Promise.allSettled([browser?.close(), server?.close()].filter(Boolean));
  }
}

const negativeCase = process.env.DECORATIVE_ACCENTS_NEGATIVE_CASE;
if (negativeCase) {
  try {
    await runNegativeChild(negativeCase);
    console.log(`PASS negative-contract ${negativeCase}`);
  } catch (error) {
    console.error(`FAIL negative-contract ${negativeCase}: ${error.message}`);
    process.exitCode = 1;
  }
} else {
  await run();
}
