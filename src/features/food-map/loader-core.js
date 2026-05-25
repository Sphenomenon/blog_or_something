import {
  normalizeLocalFoodPlaces,
  projectPublicFoodMapPlaces,
  validateLocalFoodPlaces
} from "./core.js";

function unwrapYamlModule(module) {
  return module?.default ?? module;
}

function sortedFoodPlaceEntries(modules) {
  return Object.entries(modules).sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath));
}

function failFoodPlaceFile(path, message) {
  throw new Error(`[food-map] ${path}: ${message.replace(/^\[food-map\]\s*/, "")}`);
}

function assertUniqueSpotIds(entries) {
  const seen = new Map();

  for (const [path, rawPlace] of entries) {
    const spotId = typeof rawPlace?.spotId === "string" ? rawPlace.spotId.trim() : rawPlace?.spotId;
    if (!spotId) continue;

    if (seen.has(spotId)) {
      throw new Error(`[food-map] duplicate local spotId "${spotId}" in ${seen.get(spotId)} and ${path}`);
    }
    seen.set(spotId, path);
  }
}

export function normalizeFoodPlaceModules(modules = {}) {
  const entries = sortedFoodPlaceEntries(modules).map(([path, module]) => [path, unwrapYamlModule(module)]);

  for (const [path, rawPlace] of entries) {
    const result = validateLocalFoodPlaces([rawPlace]);
    if (!result.ok) {
      failFoodPlaceFile(path, result.errors[0]);
    }
  }

  assertUniqueSpotIds(entries);
  return normalizeLocalFoodPlaces(entries.map(([, rawPlace]) => rawPlace));
}

export function loadPublicFoodMapPlaces(modules = {}) {
  return projectPublicFoodMapPlaces(normalizeFoodPlaceModules(modules));
}
