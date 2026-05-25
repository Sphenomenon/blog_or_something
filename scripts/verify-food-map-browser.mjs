import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { chromium } from "playwright";
import { createServer } from "vite";

const command = "node scripts/verify-food-map-browser.mjs";
const popupEvidencePath = resolve(".sisyphus/evidence/task-5-browser-popup.json");
const aggregationEvidencePath = resolve(".sisyphus/evidence/task-5-browser-aggregation.json");
const filterSelectionEvidencePath = resolve(".sisyphus/evidence/task-11-filter-selection.json");
const edgeCaseEvidencePath = resolve(".sisyphus/evidence/task-11-browser-edge-cases.json");
const blockedThirdPartyHosts = new Set(["identity.netlify.com", "events.vercount.one", "music.163.com"]);
const friendFeedUrl = "https://friend-food-map.test/food-map/index.json";
const brokenFeedUrl = "https://broken-friend-source.test/food-map/index.json";
const removedReaderFacingStrings = [
  "已载入 1 个外部来源",
  "外部来源只显示共享 JSON 中的公开字段",
  "高德地图已就绪",
  "点击地图 marker 或地点卡片会同步选中同一个公开地点",
  "共享 JSON",
  "公开订阅入口",
  "把这个静态端点交给朋友站点读取",
  "/food-map/index.json",
  "直接打开",
  "复制链接"
];

const friendSources = [
  {
    id: "friend-food-map",
    name: "Friend Food Map",
    url: friendFeedUrl,
    homepage: "https://friend-food-map.test",
    enabled: true
  },
  {
    id: "broken-friend-source",
    name: "Broken Friend Source",
    url: brokenFeedUrl,
    homepage: "https://broken-friend-source.test",
    enabled: true
  }
];

const friendFeed = {
  schemaVersion: 1,
  spots: [
    {
      id: "friend-hotpot",
      name: "Friend Hotpot",
      city: "Chengdu",
      district: "Qingyang",
      address: "Friend Road 8",
      lng: 104.0668,
      lat: 30.5728,
      category: "Hotpot",
      rating: 4.8,
      recommend: ["butter broth"],
      tags: ["friend", "hotpot"]
    }
  ]
};

function createAmapMockScript() {
  return String.raw`
    (() => {
      const calls = window.__foodMapAmapCalls = window.__foodMapAmapCalls || [];
      const record = (type, detail = {}) => calls.push({ type, detail, at: Date.now() });
      const listenersFor = (target) => target.__listeners || (target.__listeners = new window.Map());
      function addListener(target, eventName, handler) {
        const listeners = listenersFor(target);
        const handlers = listeners.get(eventName) || [];
        handlers.push(handler);
        listeners.set(eventName, handlers);
        return { remove: () => listeners.set(eventName, (listeners.get(eventName) || []).filter((item) => item !== handler)) };
      }
      function emit(target, eventName) {
        for (const handler of listenersFor(target).get(eventName) || []) handler();
      }
      class LngLat {
        constructor(lng, lat) { this.lng = Number(lng); this.lat = Number(lat); }
        toArray() { return [this.lng, this.lat]; }
      }
      class Pixel { constructor(x, y) { this.x = x; this.y = y; } }
      class Size { constructor(width, height) { this.width = width; this.height = height; } }
      class AMapMap {
        constructor(container, options = {}) {
          this.container = container;
          this.options = options;
          this.container.dataset.amapMockReady = 'true';
          this.markerLayer = document.createElement('div');
          this.markerLayer.className = 'amap-mock-marker-layer';
          this.container.appendChild(this.markerLayer);
          record('map:create', { zoom: options.zoom });
        }
        addControl() { record('map:addControl'); }
        setFitView(markers = []) { record('map:fitBounds', { count: markers.length }); }
        panTo(position) { record('map:panTo', { position: Array.isArray(position) ? position : position?.toArray?.() }); }
        setCenter(position) { record('map:setCenter', { position: Array.isArray(position) ? position : position?.toArray?.() }); }
        resize() { record('map:resize'); }
        destroy() { record('map:destroy'); this.container.replaceChildren(); }
      }
      class Marker {
        constructor(options = {}) {
          this.options = options;
          this.map = options.map;
          this.title = options.title || '';
          this.element = document.createElement('button');
          this.element.type = 'button';
          this.element.className = 'amap-mock-marker-hit';
          this.element.dataset.amapMarkerTitle = this.title;
          this.element.innerHTML = options.content || this.title;
          this.element.addEventListener('click', () => { record('marker:click', { title: this.title }); emit(this, 'click'); });
          this.map?.markerLayer?.appendChild(this.element);
          record('marker:create', { title: this.title });
        }
        on(eventName, handler) { return addListener(this, eventName, handler); }
        setAnimation(animation) { record('marker:setAnimation', { title: this.title, animation }); }
        setMap(map) { if (map === null) this.element.remove(); }
        remove() { this.element.remove(); }
      }
      class InfoWindow {
        constructor(options = {}) {
          this.content = options.content || '';
          this.element = document.createElement('div');
          this.element.className = 'amap-info-window amap-mock-info-window';
          this.closeButton = document.createElement('button');
          this.closeButton.type = 'button';
          this.closeButton.className = 'amap-info-close';
          this.closeButton.setAttribute('aria-label', '关闭信息窗');
          this.closeButton.textContent = '×';
          this.contentElement = document.createElement('div');
          this.contentElement.className = 'amap-info-content';
          this.element.append(this.closeButton, this.contentElement);
          this.closeButton.addEventListener('click', () => this.close());
          this.setContent(this.content);
          record('infowindow:create');
        }
        on(eventName, handler) { return addListener(this, eventName, handler); }
        setContent(content) { this.content = content || ''; this.contentElement.innerHTML = this.content; record('infowindow:setContent', { hasFriendHotpot: this.content.includes('Friend Hotpot') }); }
        open(map, position) { this.map = map; map?.container?.appendChild(this.element); record('infowindow:open', { position: Array.isArray(position) ? position : position?.toArray?.() }); }
        close() { if (this.element.isConnected) this.element.remove(); record('infowindow:close'); emit(this, 'close'); }
      }
      window.AMap = { Map: AMapMap, Marker, InfoWindow, LngLat, Pixel, Size, Scale: class Scale {}, ToolBar: class ToolBar {}, Event: { addListener, removeListener: (listener) => listener?.remove?.() }, createDefaultLayer: () => ({ mock: true }) };
      window.__foodMapAmapLoaded?.();
    })();
  `;
}

function shouldIgnoreConsoleEntry(entry) {
  if (entry.type === "warning" && entry.text.includes("Reduced Motion enabled")) {
    return true;
  }
  if (entry.type === "error" && entry.text.includes("503 (Service Unavailable)")) {
    return true;
  }
  if (entry.type === "error" && entry.text.includes("net::ERR_FAILED")) {
    return true;
  }
  return entry.text.includes("Failed to load resource") && (
    entry.text.includes("events.vercount.one") ||
    entry.text.includes("music.163.com") ||
    entry.text.includes("identity.netlify.com") ||
    entry.text.includes("webapi.amap.com")
  );
}

function assertNoBrowserErrors(errors, consoleEntries) {
  const filteredConsole = consoleEntries.filter((entry) => !shouldIgnoreConsoleEntry(entry));
  assert.deepEqual(errors, [], "page errors should be empty");
  assert.deepEqual(filteredConsole, [], "console warnings/errors should be empty after filtering intentional third-party blocks");
  return filteredConsole;
}

function assertRemovedReaderCopyAbsent(state, context) {
  for (const text of removedReaderFacingStrings) {
    assert.equal(state.bodyText.includes(text), false, `${context} should not render removed reader-facing copy: ${text}`);
  }
}

function assertShareControlsAbsent(state, context) {
  assert.equal(state.sharePanelVisible, false, `${context} should not render share JSON panel`);
  assert.equal(state.shareHref, "", `${context} should not render share JSON link`);
  assert.equal(state.sharePath, "", `${context} should not render share JSON path`);
  assert.equal(state.copyButtonText, "", `${context} should not render copy button`);
  assert.equal(state.shareFeedback, "", `${context} should not render share feedback`);
}

async function writeEvidence(path, payload) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify({ command, generatedAt: new Date().toISOString(), ...payload }, null, 2)}\n`);
}

async function startServer(options = {}) {
  const previousKey = process.env.VITE_AMAP_KEY;
  if (options.amapKey === undefined) delete process.env.VITE_AMAP_KEY;
  else process.env.VITE_AMAP_KEY = options.amapKey;
  const server = await createServer({
    root: resolve("."),
    configFile: resolve("vite.config.js"),
    logLevel: "error",
    server: { host: "127.0.0.1", port: 0, strictPort: false }
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === "object" && address ? address.port : 5173;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: async () => {
      if (previousKey === undefined) delete process.env.VITE_AMAP_KEY;
      else process.env.VITE_AMAP_KEY = previousKey;
      await server.close();
    }
  };
}

async function createBrowserPage(browser, scenario, options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: "reduce",
    permissions: options.withoutClipboard ? [] : ["clipboard-read", "clipboard-write"]
  });
  if (options.withoutClipboard) {
    await context.addInitScript(() => {
      Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: undefined });
    });
  }
  const errors = [];
  const consoleEntries = [];

  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.hostname === "webapi.amap.com") {
      if (options.failAmapScript) {
        return route.abort("failed");
      }
      return route.fulfill({ status: 200, contentType: "application/javascript", body: createAmapMockScript() });
    }

    if (blockedThirdPartyHosts.has(url.hostname)) {
      return route.fulfill({ status: 204, body: "" });
    }

    if (url.pathname === "/food-map/sources.json") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(["aggregation", "filter-selection"].includes(scenario) ? friendSources : []) });
    }

    if (request.url() === friendFeedUrl) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(friendFeed) });
    }

    if (request.url() === brokenFeedUrl) {
      return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "offline fixture" }) });
    }

    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      return route.fulfill({ status: 204, body: "" });
    }

    return route.continue();
  });

  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.stack || error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleEntries.push({ type: message.type(), text: message.text() });
    }
  });

  return { context, page, errors, consoleEntries };
}

async function waitForFoodMapReady(page, baseUrl) {
  await page.goto(`${baseUrl}/food-map`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="food-map-view"]');
  await page.waitForFunction(() => document.querySelector('.food-map-map-shell--amap')?.getAttribute('data-amap-state') === 'ready');
  await page.waitForSelector('.amap-mock-marker-hit');
}

async function collectState(page) {
  return page.evaluate(() => ({
    statusText: document.querySelector('.food-map-source-status')?.textContent?.trim() ?? '',
    bodyText: document.body.innerText,
    detailTitle: document.querySelector('.food-map-detail-title')?.textContent?.trim() ?? '',
    selectedCards: Array.from(document.querySelectorAll('.food-map-spot-card--selected .food-map-card-title')).map((node) => node.textContent?.trim()),
    popupText: document.querySelector('.food-map-info-window')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    popupVisible: Boolean(document.querySelector('.food-map-info-window')),
    markerTitles: Array.from(document.querySelectorAll('.amap-mock-marker-hit')).map((node) => node.dataset.amapMarkerTitle),
    calls: window.__foodMapAmapCalls || [],
    shareHref: document.querySelector('.food-map-share-link')?.href ?? '',
    sharePath: document.querySelector('.food-map-share-path')?.textContent?.trim() ?? '',
    copyButtonText: document.querySelector('.food-map-share-button')?.textContent?.trim() ?? '',
    shareFeedback: document.querySelector('.food-map-share-feedback')?.textContent?.trim() ?? '',
    noResultsVisible: Boolean(document.querySelector('.food-map-no-results')),
    fallbackVisible: Boolean(document.querySelector('.food-map-map-fallback')),
    amapState: document.querySelector('.food-map-map-shell')?.getAttribute('data-amap-state') ?? '',
    sharePanelVisible: Boolean(document.querySelector('.food-map-share-panel'))
  }));
}

async function runPopupScenario(browser, baseUrl) {
  const { context, page, errors, consoleEntries } = await createBrowserPage(browser, "popup");
  try {
    await waitForFoodMapReady(page, baseUrl);
    const readyState = await collectState(page);
    assert.equal(readyState.amapState, "ready", "mocked AMap should still reach ready state");
    assert.ok(readyState.markerTitles.length > 0, "mocked AMap should still render markers");
    assertShareControlsAbsent(readyState, "ready food map");
    assertRemovedReaderCopyAbsent(readyState, "ready food map");

    const firstMarker = page.locator('.amap-mock-marker-hit').first();
    await firstMarker.click();
    await page.waitForSelector('.food-map-info-window');
    const afterMarkerClick = await collectState(page);
    assert.equal(afterMarkerClick.popupVisible, true, "marker click should open popup");
    assert.ok(afterMarkerClick.detailTitle, "selected detail remains visible after marker click");
    assert.equal(afterMarkerClick.selectedCards.length, 1, "marker click should select exactly one card");

    await page.locator('.amap-info-close').click();
    await page.waitForFunction(() => !document.querySelector('.food-map-info-window'));
    const afterClose = await collectState(page);
    assert.equal(afterClose.popupVisible, false, "InfoWindow close should clear popup focus");
    assert.equal(afterClose.detailTitle, afterMarkerClick.detailTitle, "InfoWindow close should leave selected detail visible");

    await page.locator('.food-map-spot-card').first().click();
    await page.waitForSelector('.food-map-info-window');
    const afterCardClick = await collectState(page);
    assert.equal(afterCardClick.popupVisible, true, "card click should reopen popup");
    assert.equal(afterCardClick.detailTitle, afterMarkerClick.detailTitle, "card click should preserve selected detail");
    assert.ok(afterCardClick.calls.some((call) => call.type === 'map:panTo'), "card click should focus/pan the map");

    const filteredConsole = assertNoBrowserErrors(errors, consoleEntries);
    const evidence = {
      status: "PASS",
      aggregateVerifyWiring: "Dedicated npm run verify:food-map-browser command; not folded into npm run verify:food-map so the aggregate verifier remains the existing unit/build gate while browser QA can be run explicitly with Playwright.",
      assertions: {
        amapReadyStatePreserved: readyState.amapState === "ready",
        markersRendered: readyState.markerTitles.length > 0,
        sharePanelAbsent: !readyState.sharePanelVisible,
        sharePathAbsent: readyState.sharePath === "",
        shareLinkAbsent: readyState.shareHref === "",
        copyButtonAbsent: readyState.copyButtonText === "",
        removedReaderCopyAbsent: removedReaderFacingStrings.every((text) => !readyState.bodyText.includes(text)),
        markerClickOpenedPopup: afterMarkerClick.popupVisible,
        markerClickSelectedCard: afterMarkerClick.selectedCards.length === 1,
        detailVisibleAfterMarkerClick: Boolean(afterMarkerClick.detailTitle),
        infoWindowCloseClearedPopup: !afterClose.popupVisible,
        detailVisibleAfterClose: afterClose.detailTitle === afterMarkerClick.detailTitle,
        cardClickReopenedPopup: afterCardClick.popupVisible,
        cardClickRecordedPan: afterCardClick.calls.some((call) => call.type === 'map:panTo')
      },
      removedCopyProbe: removedReaderFacingStrings,
      selectedDetail: afterCardClick.detailTitle,
      markerTitles: afterCardClick.markerTitles,
      amapCallTypes: afterCardClick.calls.map((call) => call.type),
      consoleErrors: filteredConsole,
      pageErrors: errors
    };
    await writeEvidence(popupEvidencePath, evidence);
    return evidence;
  } catch (error) {
    await writeEvidence(popupEvidencePath, { status: "FAIL", error: error.message, consoleErrors: consoleEntries, pageErrors: errors });
    throw error;
  } finally {
    await context.close();
  }
}

async function runFilterSelectionScenario(browser, baseUrl) {
  const { context, page, errors, consoleEntries } = await createBrowserPage(browser, "filter-selection");
  try {
    await waitForFoodMapReady(page, baseUrl);
    await page.waitForSelector('text=Friend Hotpot');
    await page.locator('.food-map-spot-card', { hasText: 'Friend Hotpot' }).click();
    await page.waitForSelector('.food-map-info-window');
    const afterSelect = await collectState(page);
    assert.equal(afterSelect.detailTitle, "Friend Hotpot", "friend spot should become selected before filtering");
    assert.equal(afterSelect.popupVisible, true, "friend selection should open popup before filtering");

    await page.locator('#food-map-query').fill('definitely-no-food-map-match');
    await page.waitForSelector('.food-map-no-results');
    await page.waitForFunction(() => !document.querySelector('.food-map-info-window'));
    const afterFilter = await collectState(page);

    assert.equal(afterFilter.noResultsVisible, true, "filtering selected friend spot away should show empty filter state");
    assert.equal(afterFilter.popupVisible, false, "popup should close when selected spot disappears from filtered places");
    assert.equal(afterFilter.selectedCards.length, 0, "no card should remain selected when filters show zero spots");

    const filteredConsole = assertNoBrowserErrors(errors, consoleEntries);
    const evidence = {
      status: "PASS",
      assertions: {
        selectedFriendBeforeFilter: afterSelect.detailTitle === "Friend Hotpot",
        popupOpenBeforeFilter: afterSelect.popupVisible,
        noResultsAfterFilter: afterFilter.noResultsVisible,
        popupClosedAfterFilter: !afterFilter.popupVisible,
        noSelectedCardsAfterFilter: afterFilter.selectedCards.length === 0
      },
      beforeFilter: { detailTitle: afterSelect.detailTitle, popupText: afterSelect.popupText },
      afterFilter: { bodyHasNoResults: afterFilter.noResultsVisible, popupVisible: afterFilter.popupVisible, selectedCards: afterFilter.selectedCards },
      consoleErrors: filteredConsole,
      pageErrors: errors
    };
    await writeEvidence(filterSelectionEvidencePath, evidence);
    return evidence;
  } catch (error) {
    await writeEvidence(filterSelectionEvidencePath, { status: "FAIL", error: error.message, consoleErrors: consoleEntries, pageErrors: errors });
    throw error;
  } finally {
    await context.close();
  }
}

async function runFallbackAndClipboardScenario(browser, baseUrl) {
  const { context, page, errors, consoleEntries } = await createBrowserPage(browser, "fallback", { withoutClipboard: true, failAmapScript: true });
  try {
    await page.goto(`${baseUrl}/food-map`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="food-map-view"]');
    await page.waitForFunction(() => ["missing-key", "failed"].includes(document.querySelector('.food-map-map-shell')?.getAttribute('data-amap-state')));
    const state = await collectState(page);

    assert.match(state.amapState, /^(missing-key|failed)$/, "missing or unavailable AMap should keep the map panel in a fallback state");
    assert.equal(state.fallbackVisible, true, "fallback marker list should remain visible without AMap key");
    assertShareControlsAbsent(state, "fallback food map");
    assertRemovedReaderCopyAbsent(state, "fallback food map");
    assert.match(state.bodyText, /(高德地图脚本加载失败|未配置 VITE_AMAP_KEY)/, "fallback diagnostic should explain missing or failed AMap setup");

    const filteredConsole = assertNoBrowserErrors(errors, consoleEntries);
    const evidence = {
      status: "PASS",
      assertions: {
        missingOrFailedAmapState: ["missing-key", "failed"].includes(state.amapState),
        fallbackVisible: state.fallbackVisible,
        diagnosticCopyVisible: /(高德地图脚本加载失败|未配置 VITE_AMAP_KEY)/.test(state.bodyText),
        sharePanelAbsent: !state.sharePanelVisible,
        sharePathAbsent: state.sharePath === "",
        shareLinkAbsent: state.shareHref === "",
        copyButtonAbsent: state.copyButtonText === "",
        shareFeedbackAbsent: state.shareFeedback === "",
        removedReaderCopyAbsent: removedReaderFacingStrings.every((text) => !state.bodyText.includes(text))
      },
      statusText: state.statusText,
      removedCopyProbe: removedReaderFacingStrings,
      consoleErrors: filteredConsole,
      pageErrors: errors
    };
    await writeEvidence(edgeCaseEvidencePath, evidence);
    return evidence;
  } catch (error) {
    await writeEvidence(edgeCaseEvidencePath, { status: "FAIL", error: error.message, consoleErrors: consoleEntries, pageErrors: errors });
    throw error;
  } finally {
    await context.close();
  }
}

async function runAggregationScenario(browser, baseUrl) {
  const { context, page, errors, consoleEntries } = await createBrowserPage(browser, "aggregation");
  try {
    await waitForFoodMapReady(page, baseUrl);
    await page.waitForSelector('text=Friend Hotpot');
    await page.waitForSelector('text=Broken Friend Source');
    const state = await collectState(page);

    assert.match(state.bodyText, /Friend Hotpot/, "successful friend source spot should be visible");
    assert.match(state.bodyText, /来源：Friend Food Map/, "friend source attribution should be visible");
    assert.match(state.bodyText, /Broken Friend Source/, "failed source name should be visible");
    assert.match(state.statusText, /本地 \d+ · 外部 1 · 失败 1/, "compact source status should show external and failed counts");
    assert.ok(state.markerTitles.includes("Friend Hotpot"), "friend spot should create a mocked marker");

    const filteredConsole = assertNoBrowserErrors(errors, consoleEntries);
    const evidence = {
      status: "PASS",
      aggregateVerifyWiring: "Dedicated npm run verify:food-map-browser command; not folded into npm run verify:food-map so the aggregate verifier remains the existing unit/build gate while browser QA can be run explicitly with Playwright.",
      assertions: {
        friendHotpotVisible: state.bodyText.includes("Friend Hotpot"),
        friendAttributionVisible: state.bodyText.includes("来源：Friend Food Map"),
        brokenSourceNameVisible: state.bodyText.includes("Broken Friend Source"),
        compactStatusShowsFailure: /本地 \d+ · 外部 1 · 失败 1/.test(state.statusText),
        friendMarkerCreated: state.markerTitles.includes("Friend Hotpot")
      },
      statusText: state.statusText,
      markerTitles: state.markerTitles,
      consoleErrors: filteredConsole,
      pageErrors: errors
    };
    await writeEvidence(aggregationEvidencePath, evidence);
    return evidence;
  } catch (error) {
    await writeEvidence(aggregationEvidencePath, { status: "FAIL", error: error.message, consoleErrors: consoleEntries, pageErrors: errors });
    throw error;
  } finally {
    await context.close();
  }
}

let server;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  server = await startServer({ amapKey: "food-map-browser-test-key" });
  const popupEvidence = await runPopupScenario(browser, server.baseUrl);
  const aggregationEvidence = await runAggregationScenario(browser, server.baseUrl);
  const filterSelectionEvidence = await runFilterSelectionScenario(browser, server.baseUrl);
  await server.close();
  server = await startServer();
  const edgeCaseEvidence = await runFallbackAndClipboardScenario(browser, server.baseUrl);
  console.log(`PASS food-map browser verification (popup=${popupEvidence.status} aggregation=${aggregationEvidence.status} filter=${filterSelectionEvidence.status} fallback=${edgeCaseEvidence.status})`);
} finally {
  await browser?.close();
  await server?.close();
}
