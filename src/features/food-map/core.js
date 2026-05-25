import {
  FOOD_MAP_COORDINATE_SYSTEM,
  FOOD_MAP_FILTER_DEFAULTS,
  FOOD_MAP_GENERATOR_INFO,
  FOOD_MAP_PUBLIC_PLACE_KEYS,
  FOOD_MAP_PUBLIC_VISIT_KEYS,
  FOOD_MAP_SCHEMA,
  FOOD_MAP_SCHEMA_VERSION,
  FOOD_MAP_SHARED_SPOT_KEYS,
  FOOD_MAP_SOURCE_TYPES,
  FOOD_MAP_STATUS_VALUES
} from "./contracts.js";

const LOCAL_SOURCE = Object.freeze({
  type: FOOD_MAP_SOURCE_TYPES.local,
  id: "local",
  name: "Local"
});

function fail(message) {
  throw new Error(`[food-map] ${message}`);
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function trimString(value) {
  return typeof value === "string" ? value.trim() : value;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function uniqueLocalFirst(left = [], right = []) {
  const seen = new Set();
  const values = [];
  for (const item of [...left, ...right]) {
    const value = String(item ?? "").trim();
    if (value && !seen.has(value)) {
      seen.add(value);
      values.push(value);
    }
  }
  return values;
}

function pickDefined(source, keys) {
  const picked = {};
  for (const key of keys) {
    if (source[key] !== undefined) {
      picked[key] = source[key];
    }
  }
  return picked;
}

function warningForSource(sourceConfig, message) {
  const sourceId = hasValue(sourceConfig?.id) ? String(sourceConfig.id).trim() : "unknown";
  return `[food-map] external source "${sourceId}": ${message}`;
}

function emitWarnings(warnings, onWarning) {
  if (typeof onWarning !== "function") return;
  for (const warning of warnings) {
    onWarning(warning);
  }
}

function normalizeSourceIdentity(sourceConfig) {
  return {
    type: FOOD_MAP_SOURCE_TYPES.external,
    id: String(sourceConfig.id).trim(),
    name: String(sourceConfig.name).trim(),
    ...(hasValue(sourceConfig.homepage) ? { homepage: String(sourceConfig.homepage).trim() } : {}),
    ...(hasValue(sourceConfig.avatar) ? { avatar: String(sourceConfig.avatar).trim() } : {}),
    ...(hasValue(sourceConfig.url) ? { url: String(sourceConfig.url).trim() } : {})
  };
}

function warningForSourceConfig(sourceConfig, index, message) {
  const sourceId = hasValue(sourceConfig?.id) ? String(sourceConfig.id).trim() : `source[${index}]`;
  return `[food-map] source config "${sourceId}": ${message}`;
}

function normalizeExternalSourceConfig(sourceConfig, index, warnings) {
  if (!sourceConfig || typeof sourceConfig !== "object" || Array.isArray(sourceConfig)) {
    warnings.push(warningForSourceConfig(sourceConfig, index, "entry must be an object"));
    return undefined;
  }
  if (sourceConfig.enabled === false) return undefined;
  if (!hasValue(sourceConfig.id) || !hasValue(sourceConfig.name) || !hasValue(sourceConfig.url)) {
    warnings.push(warningForSourceConfig(sourceConfig, index, "entry requires id, name, and url"));
    return undefined;
  }

  return {
    id: String(sourceConfig.id).trim(),
    name: String(sourceConfig.name).trim(),
    url: String(sourceConfig.url).trim(),
    ...(hasValue(sourceConfig.homepage) ? { homepage: String(sourceConfig.homepage).trim() } : {}),
    ...(hasValue(sourceConfig.avatar) ? { avatar: String(sourceConfig.avatar).trim() } : {}),
    enabled: true
  };
}

function mergeScalarLocalFirst(localPlace, externalPlace, key) {
  return localPlace[key] !== undefined && localPlace[key] !== null && localPlace[key] !== "" ? localPlace[key] : externalPlace[key];
}

function mergeLocalWithExternal(localPlace, externalPlace) {
  const merged = { ...externalPlace, ...localPlace };
  for (const key of ["tags", "recommend", "photos"]) {
    merged[key] = uniqueLocalFirst(localPlace[key], externalPlace[key]);
  }
  for (const key of FOOD_MAP_PUBLIC_PLACE_KEYS) {
    if (["tags", "recommend", "photos", "source"].includes(key)) continue;
    merged[key] = mergeScalarLocalFirst(localPlace, externalPlace, key);
  }
  merged.source = localPlace.source;
  return pickDefined(merged, FOOD_MAP_PUBLIC_PLACE_KEYS);
}

function mergeExternalWithExternal(existingPlace, nextPlace) {
  return {
    ...existingPlace,
    tags: uniqueLocalFirst(existingPlace.tags, nextPlace.tags),
    recommend: uniqueLocalFirst(existingPlace.recommend, nextPlace.recommend),
    photos: uniqueLocalFirst(existingPlace.photos, nextPlace.photos)
  };
}

function assertRequiredString(raw, field, index) {
  const value = field.split(".").reduce((acc, part) => acc?.[part], raw);
  if (!hasValue(value)) {
    fail(`place[${index}] missing required field "${field}"`);
  }
  return String(value).trim();
}

function assertCoordinate(raw, field, min, max, index) {
  const value = raw.coordinates?.[field];
  if (value === undefined || value === null || value === "") {
    fail(`place[${index}] missing required field "coordinates.${field}"`);
  }

  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    fail(`place[${index}] field "coordinates.${field}" must be between ${min} and ${max}, got "${value}"`);
  }
  return number;
}

function normalizePeople(value) {
  if (!Array.isArray(value)) return undefined;
  const people = value
    .map((person) => ({
      name: trimString(person?.name),
      url: trimString(person?.url)
    }))
    .filter((person) => hasValue(person.name))
    .map((person) => pickDefined(person, ["name", "url"]));
  return people.length ? people : undefined;
}

function normalizeVisits(visits) {
  if (!Array.isArray(visits)) return [];
  return visits
    .map((visit, index) => ({
      visitId: hasValue(visit?.visitId) ? String(visit.visitId).trim() : `visit-${index + 1}`,
      visitedAt: trimString(visit?.visitedAt),
      note: trimString(visit?.note),
      rating: visit?.rating,
      people: normalizePeople(visit?.people),
      privateNote: trimString(visit?.privateNote),
      private: visit?.private === true
    }))
    .sort((left, right) => String(right.visitedAt || "").localeCompare(String(left.visitedAt || "")));
}

export function normalizeFilterState(filterState = {}) {
  return {
    city: String(filterState.city ?? FOOD_MAP_FILTER_DEFAULTS.city).trim(),
    category: String(filterState.category ?? FOOD_MAP_FILTER_DEFAULTS.category).trim(),
    query: String(filterState.query ?? FOOD_MAP_FILTER_DEFAULTS.query).trim(),
    includeExternal: filterState.includeExternal ?? FOOD_MAP_FILTER_DEFAULTS.includeExternal
  };
}

export function normalizeLocalFoodPlaces(rawPlaces) {
  if (!Array.isArray(rawPlaces)) {
    fail("local places must be an array");
  }

  const seenSpotIds = new Set();
  return rawPlaces.map((raw, index) => {
    const spotId = assertRequiredString(raw, "spotId", index);
    if (seenSpotIds.has(spotId)) {
      fail(`duplicate local spotId "${spotId}"`);
    }
    seenSpotIds.add(spotId);

    const name = assertRequiredString(raw, "name", index);
    const status = assertRequiredString(raw, "status", index);
    if (!Object.values(FOOD_MAP_STATUS_VALUES).includes(status)) {
      fail(`place[${index}] field "status" must be one of ${Object.values(FOOD_MAP_STATUS_VALUES).join("|")}, got "${status}"`);
    }

    const city = assertRequiredString(raw, "city", index);
    const category = assertRequiredString(raw, "category", index);
    const address = assertRequiredString(raw, "address", index);
    const lng = assertCoordinate(raw, "lng", -180, 180, index);
    const lat = assertCoordinate(raw, "lat", -90, 90, index);

    return {
      id: spotId,
      spotId,
      name,
      status,
      city,
      category,
      address,
      lng,
      lat,
      district: trimString(raw.district),
      price: raw.price,
      rating: raw.rating,
      recommend: normalizeStringArray(raw.recommend),
      tags: normalizeStringArray(raw.tags),
      description: trimString(raw.description),
      articleSlug: trimString(raw.articleSlug),
      articleUrl: trimString(raw.articleUrl),
      amapUrl: trimString(raw.amapUrl),
      showAmapLink: raw.showAmapLink ?? true,
      coordinateSystem: hasValue(raw.coordinateSystem) ? String(raw.coordinateSystem).trim() : FOOD_MAP_COORDINATE_SYSTEM,
      cover: trimString(raw.cover),
      photos: normalizeStringArray(raw.photos),
      noindex: raw.noindex === true,
      private: raw.private === true,
      visits: normalizeVisits(raw.visits),
      source: raw.source ?? LOCAL_SOURCE
    };
  });
}

export function validateLocalFoodPlaces(rawPlaces) {
  try {
    return { ok: true, errors: [], places: normalizeLocalFoodPlaces(rawPlaces) };
  } catch (error) {
    return { ok: false, errors: [error.message], places: [] };
  }
}

export function projectPublicFoodMapPlaces(places) {
  return places
    .filter((place) => place.status === FOOD_MAP_STATUS_VALUES.published && place.private !== true)
    .map((place) => {
      const projected = pickDefined(place, FOOD_MAP_PUBLIC_PLACE_KEYS);
      const visits = place.visits
        .filter((visit) => visit.private !== true && hasValue(visit.visitedAt))
        .map((visit) => pickDefined(visit, FOOD_MAP_PUBLIC_VISIT_KEYS));
      if (visits.length) {
        projected.visits = visits;
      }
      return projected;
    });
}

export function projectSharedFoodMapSpots(places) {
  return projectPublicFoodMapPlaces(places).map((place) => pickDefined(place, FOOD_MAP_SHARED_SPOT_KEYS));
}

export function createFoodMapSharedJsonRoot(places, options = {}) {
  return {
    schema: FOOD_MAP_SCHEMA,
    schemaVersion: FOOD_MAP_SCHEMA_VERSION,
    generator: options.generator ?? FOOD_MAP_GENERATOR_INFO,
    ...(options.owner ? { owner: options.owner } : {}),
    ...(options.site ? { site: options.site } : {}),
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    coordinateSystem: options.coordinateSystem ?? FOOD_MAP_COORDINATE_SYSTEM,
    spots: projectSharedFoodMapSpots(places)
  };
}

export function isEnabledExternalSourceConfig(source) {
  return source?.enabled !== false && hasValue(source?.id) && hasValue(source?.name) && hasValue(source?.url);
}

export function normalizeExternalSourceConfigs(rawSources) {
  const warnings = [];
  if (!Array.isArray(rawSources)) {
    return { sources: [], warnings: ["[food-map] source config must be an array"] };
  }

  const sources = rawSources
    .map((sourceConfig, index) => normalizeExternalSourceConfig(sourceConfig, index, warnings))
    .filter(Boolean);
  return { sources, warnings };
}

export async function loadFoodMapSourceConfig(options = {}) {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const url = options.url ?? "/food-map/sources.json";
  if (typeof fetchImpl !== "function") {
    const warnings = ["[food-map] source config fetch implementation is required"];
    emitWarnings(warnings, options.onWarning);
    return { sources: [], warnings, errors: warnings };
  }

  try {
    const response = await fetchImpl(url, { signal: options.signal });
    if (response?.status === 404) {
      return { sources: [], warnings: [], errors: [] };
    }
    if (!response?.ok) {
      const status = response?.status ? `HTTP ${response.status}` : "non-OK response";
      const warnings = [`[food-map] source config fetch failed with ${status}`];
      emitWarnings(warnings, options.onWarning);
      return { sources: [], warnings, errors: warnings };
    }

    const rawSources = await response.json();
    const result = normalizeExternalSourceConfigs(rawSources);
    emitWarnings(result.warnings, options.onWarning);
    return { ...result, errors: [] };
  } catch (error) {
    const warnings = [`[food-map] source config fetch failed: ${error.message}`];
    emitWarnings(warnings, options.onWarning);
    return { sources: [], warnings, errors: warnings };
  }
}

export function normalizeExternalSourceSpot(rawSpot, sourceConfig) {
  if (!isEnabledExternalSourceConfig(sourceConfig)) {
    fail("external source config requires id, name, url, and enabled !== false");
  }
  if (!hasValue(rawSpot?.name)) {
    fail(`external source "${sourceConfig.id}" spot missing required field "name"`);
  }
  const lng = Number(rawSpot.lng);
  const lat = Number(rawSpot.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    fail(`external source "${sourceConfig.id}" spot "${rawSpot.name}" requires lng/lat within valid coordinate ranges`);
  }

  const rawId = hasValue(rawSpot.id) ? String(rawSpot.id).trim() : String(rawSpot.name).trim();
  return {
    ...pickDefined(rawSpot, FOOD_MAP_SHARED_SPOT_KEYS),
    id: `${String(sourceConfig.id).trim()}:${rawId}`,
    spotId: `${String(sourceConfig.id).trim()}:${rawId}`,
    name: String(rawSpot.name).trim(),
    city: hasValue(rawSpot.city) ? String(rawSpot.city).trim() : "",
    address: hasValue(rawSpot.address) ? String(rawSpot.address).trim() : "",
    lng,
    lat,
    coordinateSystem: hasValue(rawSpot.coordinateSystem) ? String(rawSpot.coordinateSystem).trim() : FOOD_MAP_COORDINATE_SYSTEM,
    category: hasValue(rawSpot.category) ? String(rawSpot.category).trim() : "",
    status: FOOD_MAP_STATUS_VALUES.published,
    showAmapLink: rawSpot.showAmapLink ?? true,
    source: {
      type: FOOD_MAP_SOURCE_TYPES.external,
      id: String(sourceConfig.id).trim(),
      name: String(sourceConfig.name).trim(),
      ...(hasValue(sourceConfig.homepage) ? { homepage: String(sourceConfig.homepage).trim() } : {}),
      ...(hasValue(sourceConfig.avatar) ? { avatar: String(sourceConfig.avatar).trim() } : {}),
      ...(hasValue(sourceConfig.url) ? { url: String(sourceConfig.url).trim() } : {})
    },
    visits: []
  };
}

export function normalizeExternalSourceRoot(root, sourceConfig) {
  const warnings = [];
  if (!root || typeof root !== "object" || Array.isArray(root)) {
    return {
      source: isEnabledExternalSourceConfig(sourceConfig) ? normalizeSourceIdentity(sourceConfig) : undefined,
      spots: [],
      warnings: [warningForSource(sourceConfig, "shared JSON root must be an object")]
    };
  }
  if (root.schemaVersion !== FOOD_MAP_SCHEMA_VERSION) {
    return {
      source: normalizeSourceIdentity(sourceConfig),
      spots: [],
      warnings: [warningForSource(sourceConfig, `schemaVersion must be ${FOOD_MAP_SCHEMA_VERSION}, got ${JSON.stringify(root.schemaVersion)}`)]
    };
  }
  if (!Array.isArray(root.spots)) {
    return {
      source: normalizeSourceIdentity(sourceConfig),
      spots: [],
      warnings: [warningForSource(sourceConfig, "spots must be an array")]
    };
  }

  const spots = [];
  const seenIds = new Set();
  for (const [index, rawSpot] of root.spots.entries()) {
    try {
      const [publicSpot] = projectPublicFoodMapPlaces([normalizeExternalSourceSpot(rawSpot, sourceConfig)]);
      if (seenIds.has(publicSpot.id)) {
        warnings.push(warningForSource(sourceConfig, `duplicate external spot id "${publicSpot.id}" skipped`));
        continue;
      }
      seenIds.add(publicSpot.id);
      spots.push(publicSpot);
    } catch (error) {
      warnings.push(warningForSource(sourceConfig, `spot[${index}] skipped: ${error.message}`));
    }
  }

  return { source: normalizeSourceIdentity(sourceConfig), spots, warnings };
}

export async function fetchExternalFoodMapSource(sourceConfig, options = {}) {
  const sourceIdentity = isEnabledExternalSourceConfig(sourceConfig) ? normalizeSourceIdentity(sourceConfig) : undefined;
  if (sourceConfig?.enabled === false) {
    return { source: undefined, spots: [], warnings: [], errors: [], skipped: true };
  }
  if (!isEnabledExternalSourceConfig(sourceConfig)) {
    const warnings = [warningForSource(sourceConfig, "config requires id, name, url, and enabled !== false")];
    emitWarnings(warnings, options.onWarning);
    return { source: undefined, failedSource: undefined, spots: [], warnings, errors: warnings, skipped: false };
  }

  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    const warnings = [warningForSource(sourceConfig, "fetch implementation is required")];
    emitWarnings(warnings, options.onWarning);
    return { source: sourceIdentity, failedSource: sourceIdentity, spots: [], warnings, errors: warnings, skipped: false };
  }

  try {
    const response = await fetchImpl(String(sourceConfig.url).trim(), { signal: options.signal });
    if (!response?.ok) {
      const status = response?.status ? `HTTP ${response.status}` : "non-OK response";
      const warnings = [warningForSource(sourceConfig, `fetch failed with ${status}`)];
      emitWarnings(warnings, options.onWarning);
      return { source: sourceIdentity, failedSource: sourceIdentity, spots: [], warnings, errors: warnings, skipped: false };
    }
    const root = await response.json();
    const result = normalizeExternalSourceRoot(root, sourceConfig);
    emitWarnings(result.warnings, options.onWarning);
    return { ...result, failedSource: undefined, errors: [], skipped: false };
  } catch (error) {
    const warnings = [warningForSource(sourceConfig, `fetch failed: ${error.message}`)];
    emitWarnings(warnings, options.onWarning);
    return { source: sourceIdentity, failedSource: sourceIdentity, spots: [], warnings, errors: warnings, skipped: false };
  }
}

export function mergeFoodMapPlaces(localPlaces = [], externalPlaces = []) {
  const localPublicPlaces = projectPublicFoodMapPlaces(localPlaces);
  const localBySpotId = new Map(localPublicPlaces.map((place) => [place.spotId, place]));
  const mergedById = new Map(localPublicPlaces.map((place) => [place.id, place]));
  const externalPlacesMerged = [];

  for (const externalPlace of externalPlaces) {
    const matchingLocal = localBySpotId.get(externalPlace.spotId);
    if (matchingLocal) {
      mergedById.set(matchingLocal.id, mergeLocalWithExternal(matchingLocal, externalPlace));
      continue;
    }
    if (mergedById.has(externalPlace.id)) {
      mergedById.set(externalPlace.id, mergeExternalWithExternal(mergedById.get(externalPlace.id), externalPlace));
      continue;
    }
    mergedById.set(externalPlace.id, externalPlace);
    externalPlacesMerged.push(externalPlace);
  }

  return {
    places: [...mergedById.values()],
    localPlaces: localPublicPlaces,
    externalPlaces: externalPlacesMerged
  };
}

export async function aggregateFoodMapExternalSources(localPlaces = [], externalSources = [], options = {}) {
  const warnings = [];
  const errors = [];
  const enabledSources = externalSources.filter((source) => source?.enabled !== false);
  const sourceResults = [];

  for (const sourceConfig of enabledSources) {
    const result = await fetchExternalFoodMapSource(sourceConfig, options);
    sourceResults.push(result);
    warnings.push(...result.warnings);
    errors.push(...result.errors);
  }

  const externalPlaces = sourceResults.flatMap((result) => result.spots);
  const merged = mergeFoodMapPlaces(localPlaces, externalPlaces);
  return {
    status: "ready",
    loading: false,
    places: merged.places,
    localPlaces: merged.localPlaces,
    externalPlaces: merged.externalPlaces,
    sources: sourceResults.map((result) => result.source).filter(Boolean),
    failedSources: sourceResults.map((result) => result.failedSource).filter(Boolean),
    warnings,
    errors
  };
}

export { fail as failFoodMapValidation };
