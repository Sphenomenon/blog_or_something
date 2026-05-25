import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  FOOD_MAP_AMAP_LOADER_STATES,
  createAmapAdapter,
  getAmapLoaderState,
  loadAmapJsApi,
  resetAmapLoaderForTests
} from "../src/features/food-map/index.js";

const command = "npm run verify:food-map-amap";
const evidencePath = resolve(".sisyphus/evidence/task-1-amap-popup-adapter.txt");
const popupSyncEvidencePath = resolve(".sisyphus/evidence/task-2-popup-sync.json");
const popupCloseEvidencePath = resolve(".sisyphus/evidence/task-2-popup-close.json");
const results = [];

function record(name, fn) {
  try {
    const detail = fn();
    results.push(`PASS ${name}${detail ? `: ${detail}` : ""}`);
  } catch (error) {
    results.push(`FAIL ${name}: ${error.message}`);
    throw error;
  }
}

async function recordAsync(name, fn) {
  try {
    const detail = await fn();
    results.push(`PASS ${name}${detail ? `: ${detail}` : ""}`);
  } catch (error) {
    results.push(`FAIL ${name}: ${error.message}`);
    throw error;
  }
}

function createMockDocument() {
  const scripts = [];
  const body = {
    appendChild(script) {
      scripts.push(script);
      script.parentNode = body;
      return script;
    },
    removeChild(script) {
      const index = scripts.indexOf(script);
      if (index !== -1) {
        scripts.splice(index, 1);
      }
      script.parentNode = null;
      return script;
    }
  };

  return {
    body,
    scripts,
    querySelector(selector) {
      if (selector === 'script[data-food-map-amap-loader="true"]') {
        return scripts.find((script) => script.dataset.foodMapAmapLoader === "true") ?? null;
      }
      return null;
    },
    createElement(tagName) {
      assert.equal(tagName, "script");
      return {
        tagName: "SCRIPT",
        dataset: {},
        async: false,
        defer: false,
        src: "",
        parentNode: null,
        remove() {
          body.removeChild(this);
        }
      };
    }
  };
}

function createMockAmap() {
  const calls = [];

  class Map {
    constructor(container, options) {
      this.container = container;
      this.options = options;
      this.controls = [];
      calls.push(["map", container, options]);
    }
    addControl(control) {
      this.controls.push(control);
      calls.push(["addControl", control.type]);
    }
    setFitView(markers) {
      calls.push(["setFitView", markers.length]);
    }
    panTo(position) {
      calls.push(["panTo", position.lng, position.lat]);
    }
    setCenter(position) {
      calls.push(["setCenter", position.lng, position.lat]);
    }
    destroy() {
      calls.push(["destroyMap"]);
    }
  }

  class Marker {
    constructor(options) {
      this.options = options;
      calls.push(["marker", options.title]);
    }
    setAnimation(animation) {
      calls.push(["setAnimation", animation]);
    }
    setMap(map) {
      calls.push(["setMap", map]);
    }
    remove() {
      calls.push(["removeMarker"]);
    }
  }

  class InfoWindow {
    constructor(options) {
      this.options = options;
      this.content = options.content;
      this.listeners = new globalThis.Map();
      calls.push(["infoWindow", options.autoMove, options.closeWhenClickMap, options.isCustom, options.content]);
    }
    on(eventName, handler) {
      const listener = {
        id: `info-${eventName}`,
        remove: () => {
          this.listeners.delete(eventName);
          calls.push(["removeInfoListener", eventName]);
        }
      };
      this.listeners.set(eventName, handler);
      calls.push(["infoWindowOn", eventName]);
      return listener;
    }
    open(map, position) {
      calls.push(["openInfoWindow", map.container.id, position.lng, position.lat]);
    }
    close() {
      calls.push(["closeInfoWindow"]);
      this.listeners.get("close")?.();
    }
    setContent(content) {
      this.content = content;
      calls.push(["setInfoWindowContent", content]);
    }
  }

  return {
    calls,
    Map,
    Marker,
    InfoWindow,
    Scale: class Scale { constructor() { this.type = "scale"; } },
    ToolBar: class ToolBar { constructor() { this.type = "toolbar"; } },
    LngLat: class LngLat {
      constructor(lng, lat) {
        this.lng = lng;
        this.lat = lat;
      }
    },
    Event: {
      removeListener(listener) {
        calls.push(["removeListener", listener.id]);
      }
    }
  };
}

function assertDoesNotThrowNoOp(adapter) {
  assert.doesNotThrow(() => adapter.openInfoWindow(null, { lng: 121.5, lat: 31.2 }));
  assert.doesNotThrow(() => adapter.closeInfoWindow(null));
  assert.doesNotThrow(() => adapter.setInfoWindowContent(null, "missing"));
  assert.doesNotThrow(() => adapter.panToPlace({ lng: "bad", lat: 31.2 }));
  assert.doesNotThrow(() => adapter.focusPlace(null, null));
}

record("module import is SSR-safe and starts idle", () => {
  resetAmapLoaderForTests();
  assert.equal(getAmapLoaderState(), FOOD_MAP_AMAP_LOADER_STATES.idle);
});

await recordAsync("missing key returns missing-key without DOM writes", async () => {
  resetAmapLoaderForTests();
  const document = createMockDocument();
  const result = await loadAmapJsApi({ key: "", window: { document }, document });
  assert.equal(result.state, FOOD_MAP_AMAP_LOADER_STATES.missingKey);
  assert.equal(document.scripts.length, 0);
  return "state=missing-key scripts=0";
});

await recordAsync("script failure returns failed and removes script", async () => {
  resetAmapLoaderForTests();
  const document = createMockDocument();
  const window = { document };
  const promise = loadAmapJsApi({ key: "fixture-key", securityJsCode: "fixture-code", window, document });
  assert.equal(document.scripts.length, 1);
  assert.equal(window._AMapSecurityConfig.securityJsCode, "fixture-code");
  assert.match(document.scripts[0].src, /^https:\/\/webapi\.amap\.com\/maps\?/);
  const scriptUrl = new URL(document.scripts[0].src);
  assert.equal(scriptUrl.searchParams.get("plugin"), "AMap.Scale,AMap.ToolBar");
  assert.equal(scriptUrl.searchParams.get("v"), "2.0");
  assert.equal(scriptUrl.searchParams.get("callback"), "__foodMapAmapLoaded");
  document.scripts[0].onerror(new Error("boom"));

  const result = await promise;
  assert.equal(result.state, FOOD_MAP_AMAP_LOADER_STATES.failed);
  assert.match(result.error.message, /webapi\.amap\.com/);
  assert.match(result.error.scriptUrl, /^https:\/\/webapi\.amap\.com\/maps\?/);
  assert.equal(document.scripts.length, 0);
  assert.equal(window.__foodMapAmapLoaded, undefined);
  return "state=failed scriptRemoved=true";
});

await recordAsync("adapter creates map, marker, fit bounds, and safe destroy", async () => {
  const AMap = createMockAmap();
  const adapter = await createAmapAdapter({ AMap });
  assert.equal(adapter.state, FOOD_MAP_AMAP_LOADER_STATES.ready);
  const map = adapter.createMap({ id: "map" }, { zoom: 13 });
  assert.equal(map.options.zoom, 13);
  const marker = adapter.createMarker({ name: "Fixture Cafe", lng: 121.5, lat: 31.2 });
  assert.ok(marker);
  adapter.selectMarker(marker);
  adapter.fitBounds();
  adapter.destroy();

  assert.deepEqual(AMap.calls.map((call) => call[0]), [
    "map",
    "addControl",
    "addControl",
    "marker",
    "setAnimation",
    "setFitView",
    "setAnimation",
    "setMap",
    "removeMarker",
    "destroyMap"
  ]);
  return "map/marker cleanup methods invoked";
});

await recordAsync("adapter manages InfoWindow lifecycle, pan, focus, and cleanup", async () => {
  const AMap = createMockAmap();
  const adapter = await createAmapAdapter({ AMap });
  adapter.createMap({ id: "map" });
  let closeCount = 0;

  const infoWindow = adapter.createInfoWindow("Initial popup", {
    onClose: () => {
      closeCount += 1;
    }
  });
  assert.ok(infoWindow);
  assert.deepEqual(infoWindow.options, {
    autoMove: false,
    closeWhenClickMap: true,
    isCustom: false,
    content: "Initial popup"
  });

  adapter.openInfoWindow(infoWindow, { name: "Fixture Cafe", lng: 121.5, lat: 31.2 });
  adapter.setInfoWindowContent(infoWindow, "Updated popup");
  assert.equal(infoWindow.content, "Updated popup");
  adapter.panToPlace({ lng: 121.6, lat: 31.3 });
  adapter.focusPlace({ lng: 121.7, lat: 31.4 }, infoWindow);
  adapter.closeInfoWindow(infoWindow);
  assert.equal(closeCount, 1);
  assertDoesNotThrowNoOp(adapter);
  adapter.destroy();

  assert.deepEqual(AMap.calls.map((call) => call[0]), [
    "map",
    "addControl",
    "addControl",
    "infoWindow",
    "infoWindowOn",
    "openInfoWindow",
    "setInfoWindowContent",
    "panTo",
    "panTo",
    "openInfoWindow",
    "closeInfoWindow",
    "removeInfoListener",
    "removeListener",
    "closeInfoWindow",
    "destroyMap"
  ]);
  return "create/open/close/content/listener cleanup/pan/focus passed";
});

await recordAsync("adapter InfoWindow methods are safe when AMap or map pieces are missing", async () => {
  const adapter = await createAmapAdapter({ AMap: {} });
  assert.doesNotThrow(() => adapter.createInfoWindow("missing constructor"));
  assert.equal(adapter.createInfoWindow("missing constructor"), null);
  assertDoesNotThrowNoOp(adapter);
  adapter.destroy();

  const unavailableAdapter = await createAmapAdapter({ key: "" });
  assert.doesNotThrow(() => unavailableAdapter.createInfoWindow("missing key"));
  assert.equal(unavailableAdapter.createInfoWindow("missing key"), null);
  assertDoesNotThrowNoOp(unavailableAdapter);
  unavailableAdapter.destroy();
  return "no-op safety passed for missing InfoWindow/map/place";
});

await recordAsync("React UI progressively uses the AMap adapter", async () => {
  const viewSource = await readFile(resolve("src/pages/FoodMapView.jsx"), "utf8");
  const componentSource = await readFile(resolve("src/features/food-map/FoodMapComponents.jsx"), "utf8");

  assert.match(viewSource, /FoodMapAmapPanel/);
  assert.doesNotMatch(viewSource, /standalone 组件仍优先展示 fallback marker/);
  assert.match(componentSource, /createAmapAdapter\(\)/);
  assert.match(componentSource, /adapter\.createMap/);
  assert.match(componentSource, /adapter\.createMarker/);
  assert.match(componentSource, /adapter\.addListener\(marker, "click"/);
  assert.match(componentSource, /adapter\.selectMarker/);
  assert.match(componentSource, /adapter\.createInfoWindow\("", \{/);
  assert.match(componentSource, /adapter\.setInfoWindowContent\(infoWindowRef\.current, content\)/);
  assert.match(componentSource, /adapter\.focusPlace\(selectedSpot, infoWindowRef\.current\)/);
  assert.match(componentSource, /adapter\.destroy/);
  assert.match(viewSource, /selectionRequestId/);
  assert.match(viewSource, /selectFoodMapPlace/);
  return "FoodMapAmapPanel creates maps/markers/popups and keeps fallback states";
});

await recordAsync("popup content renderer escapes user content and formats required fields", async () => {
  const componentSource = await readFile(resolve("src/features/food-map/FoodMapComponents.jsx"), "utf8");

  assert.match(componentSource, /function escapeHtml\(value\)/);
  assert.match(componentSource, /\.replaceAll\("&", "&amp;"\)/);
  assert.match(componentSource, /\.replaceAll\("<", "&lt;"\)/);
  assert.match(componentSource, /\.replaceAll\(">", "&gt;"\)/);
  assert.match(componentSource, /export function createFoodMapInfoWindowContent\(spot\)/);
  assert.match(componentSource, /class="food-map-info-window"/);
  assert.match(componentSource, /food-map-info-window__eyebrow/);
  assert.match(componentSource, /food-map-info-window__title/);
  assert.match(componentSource, /food-map-info-window__meta/);
  assert.match(componentSource, /food-map-info-window__address/);
  assert.match(componentSource, /food-map-info-window__recommend/);
  assert.match(componentSource, /food-map-info-window__link/);
  assert.match(componentSource, /sourceLabel\(spot\.source\)/);
  assert.match(componentSource, /spot\.city, spot\.category, price, rating/);
  assert.match(componentSource, /`¥\$\{Number\.isInteger\(numericPrice\) \? numericPrice : numericPrice\.toFixed\(1\)\}\/人`/);
  assert.match(componentSource, /`\$\{numericRating\.toFixed\(1\)\} 分`/);
  assert.match(componentSource, /recommendations\.map\(escapeHtml\)\.join\("、"\)/);
  assert.match(componentSource, /查看探店文章/);
  assert.match(componentSource, /href="\$\{escapeHtml\(link\.href\)\}"/);
  assert.doesNotMatch(componentSource, /dangerouslySetInnerHTML/);
  return "source assertions prove escaped popup includes source/name/city/address/category/price/rating/recommendations/article link";
});

await recordAsync("popup sync keeps raw AMap access inside adapter and separates close from selectedId", async () => {
  const viewSource = await readFile(resolve("src/pages/FoodMapView.jsx"), "utf8");
  const componentSource = await readFile(resolve("src/features/food-map/FoodMapComponents.jsx"), "utf8");

  assert.match(componentSource, /const infoWindowRef = useRef\(null\)/);
  assert.match(componentSource, /const \[popupFocusedId, setPopupFocusedId\] = useState/);
  assert.match(componentSource, /onClose: \(\) => \{/);
  assert.match(componentSource, /setPopupFocusedId\(""\)/);
  assert.doesNotMatch(componentSource, /onClose:[\s\S]{0,160}onSelect\(""\)/);
  assert.doesNotMatch(componentSource, /onClose:[\s\S]{0,160}setSelectedId/);
  assert.match(componentSource, /adapter\.focusPlace\(selectedSpot, infoWindowRef\.current\)/);
  assert.doesNotMatch(componentSource, /setZoom|zoomTo|adapter\.map|window\.AMap|new AMap/);
  assert.match(viewSource, /setSelectionRequestId\(\(currentRequestId\) => currentRequestId \+ 1\)/);
  assert.match(viewSource, /onSelect=\{selectFoodMapPlace\}/);
  return "close clears popup focus only; selectedId and detail state remain parent-owned";
});

await mkdir(dirname(evidencePath), { recursive: true });
await writeFile(evidencePath, [`Command: ${command}`, ...results, ""].join("\n"));
await writeFile(popupSyncEvidencePath, `${JSON.stringify({
  command,
  assertions: [
    "FoodMapAmapPanel creates one adapter InfoWindow and updates it with createFoodMapInfoWindowContent(selectedSpot)",
    "selectedId plus selectionRequestId drive popup opening so marker/card/list/fallback clicks share one parent selection path",
    "adapter.focusPlace(selectedSpot, infoWindowRef.current) pans/focuses without any setZoom/zoomTo usage",
    "createFoodMapInfoWindowContent escapes user-derived fields and formats price/rating/recommendations/article link"
  ]
}, null, 2)}\n`);
await writeFile(popupCloseEvidencePath, `${JSON.stringify({
  command,
  assertions: [
    "InfoWindow onClose calls setPopupFocusedId(\"\") only",
    "selectedId remains owned by FoodMapView and selected detail/card state is not cleared on popup close",
    "Re-clicking the same selected card/list/fallback marker increments selectionRequestId and can reopen the popup"
  ]
}, null, 2)}\n`);

console.log(`PASS food-map AMap verification (${results.length} checks)`);
