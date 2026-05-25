import { FOOD_MAP_AMAP_LOADER_STATES } from "./contracts.js";

const AMAP_CALLBACK_NAME = "__foodMapAmapLoaded";
const AMAP_SCRIPT_DATASET_KEY = "foodMapAmapLoader";
const AMAP_SCRIPT_SELECTOR = 'script[data-food-map-amap-loader="true"]';
const AMAP_PLUGIN_LIST = "AMap.Scale,AMap.ToolBar";
const DEFAULT_MAP_OPTIONS = Object.freeze({
  viewMode: "2D",
  zoom: 11,
  mapStyle: "amap://styles/normal"
});

let amapLoadPromise = null;
let amapLoaderState = FOOD_MAP_AMAP_LOADER_STATES.idle;

function getRuntimeWindow(explicitWindow) {
  if (explicitWindow) return explicitWindow;
  if (typeof window === "undefined") return null;
  return window;
}

function getRuntimeDocument(explicitDocument, runtimeWindow) {
  if (explicitDocument) return explicitDocument;
  if (runtimeWindow?.document) return runtimeWindow.document;
  if (typeof document === "undefined") return null;
  return document;
}

function getEnvValue(name, explicitValue) {
  if (explicitValue !== undefined) {
    return String(explicitValue).trim();
  }

  return String(import.meta.env?.[name] ?? "").trim();
}

function readyResult(AMap) {
  amapLoaderState = FOOD_MAP_AMAP_LOADER_STATES.ready;
  return { state: FOOD_MAP_AMAP_LOADER_STATES.ready, AMap };
}

function missingKeyResult() {
  amapLoaderState = FOOD_MAP_AMAP_LOADER_STATES.missingKey;
  return { state: FOOD_MAP_AMAP_LOADER_STATES.missingKey, AMap: null };
}

function failedResult(error) {
  amapLoaderState = FOOD_MAP_AMAP_LOADER_STATES.failed;
  return { state: FOOD_MAP_AMAP_LOADER_STATES.failed, AMap: null, error };
}

function removeScript(script) {
  if (script?.parentNode?.removeChild) {
    script.parentNode.removeChild(script);
  } else if (script?.remove) {
    script.remove();
  }
}

function cleanupCallback(runtimeWindow) {
  try {
    delete runtimeWindow[AMAP_CALLBACK_NAME];
  } catch {
    runtimeWindow[AMAP_CALLBACK_NAME] = undefined;
  }
}

function buildAmapScriptUrl(key) {
  const url = new URL("https://webapi.amap.com/maps");
  url.searchParams.set("v", "2.0");
  url.searchParams.set("key", key);
  url.searchParams.set("plugin", AMAP_PLUGIN_LIST);
  url.searchParams.set("callback", AMAP_CALLBACK_NAME);
  return url.toString();
}

function createScriptLoadError(script, reason) {
  const error = new Error(`AMap JSAPI script failed to load: ${reason}`);
  error.scriptUrl = script?.src ?? "";
  return error;
}

function getLngLat(AMap, place) {
  if (!place) return null;
  const lng = Number(place.lng);
  const lat = Number(place.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  return typeof AMap.LngLat === "function" ? new AMap.LngLat(lng, lat) : [lng, lat];
}

function callIfPresent(target, methodName, ...args) {
  if (typeof target?.[methodName] === "function") {
    return target[methodName](...args);
  }
  return undefined;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getRatingClassName(rating) {
  const numericRating = Number(rating);
  if (!Number.isFinite(numericRating)) return "food-map-marker--rating-default";
  if (numericRating >= 4.5) return "food-map-marker--rating-loved";
  if (numericRating >= 4.0) return "food-map-marker--rating-good";
  return "food-map-marker--rating-default";
}

function createMarkerContent(place) {
  const ratingClassName = getRatingClassName(place?.rating);
  const name = escapeHtml(place?.name || "美食地点");
  const meta = [place?.city, place?.district, place?.category].filter(Boolean).map(escapeHtml).join(" · ");
  const rating = Number.isFinite(Number(place?.rating)) ? `<span class="food-map-amap-marker__rating">${escapeHtml(place.rating)}</span>` : "";

  return `
    <div class="food-map-amap-marker food-map-marker ${ratingClassName}" aria-label="${name}">
      <span class="food-map-marker-index" aria-hidden="true">${rating || "•"}</span>
      <span class="food-map-amap-marker__copy">
        <span class="food-map-marker-title">${name}</span>
        ${meta ? `<span class="food-map-marker-address">${meta}</span>` : ""}
      </span>
    </div>
  `;
}

export function getAmapLoaderState() {
  return amapLoaderState;
}

export function resetAmapLoaderForTests() {
  amapLoadPromise = null;
  amapLoaderState = FOOD_MAP_AMAP_LOADER_STATES.idle;
}

export function loadAmapJsApi(options = {}) {
  const key = getEnvValue("VITE_AMAP_KEY", options.key);
  if (!key) {
    return Promise.resolve(missingKeyResult());
  }

  const runtimeWindow = getRuntimeWindow(options.window);
  const runtimeDocument = getRuntimeDocument(options.document, runtimeWindow);
  if (!runtimeWindow || !runtimeDocument) {
    return Promise.resolve(failedResult(new Error("AMap JSAPI can only be loaded in a browser runtime")));
  }

  if (runtimeWindow.AMap) {
    return Promise.resolve(readyResult(runtimeWindow.AMap));
  }

  if (amapLoadPromise) {
    return amapLoadPromise;
  }

  const securityJsCode = getEnvValue("VITE_AMAP_SECURITY_JS_CODE", options.securityJsCode);
  if (securityJsCode) {
    runtimeWindow._AMapSecurityConfig = { securityJsCode };
  }

  amapLoaderState = FOOD_MAP_AMAP_LOADER_STATES.loading;
  amapLoadPromise = new Promise((resolve) => {
    let settled = false;
    const existingScript = runtimeDocument.querySelector?.(AMAP_SCRIPT_SELECTOR);
    const script = existingScript ?? runtimeDocument.createElement("script");

    const settle = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    runtimeWindow[AMAP_CALLBACK_NAME] = () => {
      cleanupCallback(runtimeWindow);
      if (runtimeWindow.AMap) {
        settle(readyResult(runtimeWindow.AMap));
        return;
      }

      amapLoadPromise = null;
      removeScript(script);
      settle(failedResult(createScriptLoadError(script, "callback ran without window.AMap")));
    };

    script.onload = () => {
      if (!runtimeWindow.AMap || settled) return;
      cleanupCallback(runtimeWindow);
      settle(readyResult(runtimeWindow.AMap));
    };

    script.onerror = () => {
      cleanupCallback(runtimeWindow);
      amapLoadPromise = null;
      removeScript(script);
      settle(failedResult(createScriptLoadError(script, "network, key/domain restriction, or browser policy blocked webapi.amap.com")));
    };

    if (!existingScript) {
      script.src = buildAmapScriptUrl(key);
      script.async = true;
      script.defer = true;
      script.dataset[AMAP_SCRIPT_DATASET_KEY] = "true";
      runtimeDocument.body.appendChild(script);
    }
  });

  return amapLoadPromise;
}

export async function createAmapAdapter(options = {}) {
  const loadResult = options.AMap
    ? readyResult(options.AMap)
    : await loadAmapJsApi(options);

  if (loadResult.state !== FOOD_MAP_AMAP_LOADER_STATES.ready) {
    return {
      state: loadResult.state,
      error: loadResult.error,
      AMap: null,
      createMap: () => null,
      createMarker: () => null,
      createInfoWindow: () => null,
      openInfoWindow: () => {},
      closeInfoWindow: () => {},
      setInfoWindowContent: () => {},
      panToPlace: () => {},
      focusPlace: () => {},
      addListener: () => null,
      selectMarker: () => {},
      clearSelectedMarker: () => {},
      resize: () => {},
      fitBounds: () => {},
      destroy: () => {}
    };
  }

  const AMap = loadResult.AMap;
  const markers = new Set();
  const infoWindows = new Set();
  const listeners = new Set();
  let map = options.map ?? null;
  let selectedMarker = null;

  function createMap(container, mapOptions = {}) {
    if (!container || typeof AMap.Map !== "function") {
      return null;
    }

    const defaultLayer = typeof AMap.createDefaultLayer === "function"
      ? { layers: [AMap.createDefaultLayer()] }
      : {};

    map = new AMap.Map(container, {
      ...DEFAULT_MAP_OPTIONS,
      ...defaultLayer,
      ...mapOptions
    });

    if (typeof AMap.Scale === "function") {
      callIfPresent(map, "addControl", new AMap.Scale());
    }
    if (typeof AMap.ToolBar === "function") {
      callIfPresent(map, "addControl", new AMap.ToolBar());
    }

    return map;
  }

  function createMarker(place, markerOptions = {}) {
    if (typeof AMap.Marker !== "function") {
      return null;
    }

    const position = getLngLat(AMap, place);
    if (!position) {
      return null;
    }

    const marker = new AMap.Marker({
      map,
      position,
      title: place?.name,
      content: createMarkerContent(place),
      anchor: "bottom-center",
      ...markerOptions
    });

    markers.add(marker);
    return marker;
  }

  function createInfoWindow(content, infoWindowOptions = {}) {
    if (typeof AMap.InfoWindow !== "function") {
      return null;
    }

    const { onClose, ...restInfoWindowOptions } = infoWindowOptions ?? {};
    const infoWindow = new AMap.InfoWindow({
      autoMove: false,
      closeWhenClickMap: true,
      isCustom: false,
      content,
      ...restInfoWindowOptions
    });

    infoWindows.add(infoWindow);
    if (typeof onClose === "function") {
      addListener(infoWindow, "close", onClose);
    }

    return infoWindow;
  }

  function openInfoWindow(infoWindow, place) {
    const position = getLngLat(AMap, place);
    if (!map || !infoWindow || !position) {
      return;
    }

    callIfPresent(infoWindow, "open", map, position);
  }

  function closeInfoWindow(infoWindow) {
    callIfPresent(infoWindow, "close");
  }

  function setInfoWindowContent(infoWindow, content) {
    if (!infoWindow) {
      return;
    }

    if (typeof infoWindow.setContent === "function") {
      infoWindow.setContent(content);
      return;
    }

    infoWindow.content = content;
  }

  function addListener(target, eventName, handler) {
    if (!target || !eventName || typeof handler !== "function") {
      return null;
    }

    const listener = callIfPresent(target, "on", eventName, handler)
      ?? callIfPresent(AMap.Event, "addListener", target, eventName, handler)
      ?? null;

    if (listener) {
      listeners.add(listener);
    }

    return listener;
  }

  function selectMarker(marker) {
    clearSelectedMarker();
    selectedMarker = marker ?? null;
    callIfPresent(selectedMarker, "setAnimation", "AMAP_ANIMATION_BOUNCE");
  }

  function clearSelectedMarker() {
    callIfPresent(selectedMarker, "setAnimation", null);
    selectedMarker = null;
  }

  function fitBounds(targetMarkers = Array.from(markers)) {
    const boundsMarkers = targetMarkers.filter(Boolean);
    if (!boundsMarkers.length) {
      return;
    }
    callIfPresent(map, "setFitView", boundsMarkers);
  }

  function panToPlace(place) {
    const position = getLngLat(AMap, place);
    if (!map || !position) {
      return;
    }

    if (typeof map.panTo === "function") {
      map.panTo(position);
      return;
    }

    callIfPresent(map, "setCenter", position);
  }

  function focusPlace(place, infoWindow = null) {
    panToPlace(place);
    openInfoWindow(infoWindow, place);
  }

  function resize() {
    callIfPresent(map, "resize");
  }

  function destroy() {
    clearSelectedMarker();

    for (const listener of listeners) {
      callIfPresent(listener, "remove");
      callIfPresent(AMap.Event, "removeListener", listener);
    }
    listeners.clear();

    for (const marker of markers) {
      callIfPresent(marker, "setMap", null);
      callIfPresent(marker, "remove");
    }
    markers.clear();

    for (const infoWindow of infoWindows) {
      closeInfoWindow(infoWindow);
    }
    infoWindows.clear();

    callIfPresent(map, "destroy");
    map = null;
  }

  return {
    state: FOOD_MAP_AMAP_LOADER_STATES.ready,
    AMap,
    get map() {
      return map;
    },
    createMap,
    createMarker,
    createInfoWindow,
    openInfoWindow,
    closeInfoWindow,
    setInfoWindowContent,
    panToPlace,
    focusPlace,
    addListener,
    selectMarker,
    clearSelectedMarker,
    resize,
    fitBounds,
    destroy
  };
}
