/**
 * @typedef {"published" | "draft"} FoodMapStatus
 *
 * @typedef {"local" | "external"} FoodMapSourceType
 *
 * @typedef {"idle" | "loading" | "ready" | "missing-key" | "failed"} FoodMapAmapLoaderState
 *
 * @typedef {Object} RawLocalFoodPlace
 * @property {string} spotId
 * @property {string} name
 * @property {FoodMapStatus} status
 * @property {string} city
 * @property {string} category
 * @property {string} address
 * @property {{ lng: number, lat: number }} coordinates
 * @property {boolean=} private
 * @property {string=} coordinateSystem
 * @property {boolean=} showAmapLink
 * @property {Array<Object>=} visits
 *
 * @typedef {Object} NormalizedFoodPlace
 * @property {string} id
 * @property {string} spotId
 * @property {string} name
 * @property {FoodMapStatus} status
 * @property {string} city
 * @property {string} category
 * @property {string} address
 * @property {number} lng
 * @property {number} lat
 * @property {string} coordinateSystem
 * @property {boolean} showAmapLink
 * @property {{ type: FoodMapSourceType, id: string, name: string }} source
 *
 * @typedef {Object} PublicFoodMapPlace
 * @property {string} id
 * @property {string} spotId
 * @property {string} name
 * @property {string} city
 * @property {string} address
 * @property {number} lng
 * @property {number} lat
 * @property {string} coordinateSystem
 * @property {string} category
 * @property {boolean} showAmapLink
 * @property {{ type: FoodMapSourceType, id: string, name: string }} source
 * @property {Array<{ visitedAt: string, note?: string, rating?: number }>=} visits
 *
 * @typedef {Object} FoodMapSharedJsonSpot
 * @property {string} id
 * @property {string} name
 * @property {string} city
 * @property {string} address
 * @property {number} lng
 * @property {number} lat
 * @property {string} coordinateSystem
 * @property {string} category
 * @property {{ type: FoodMapSourceType, id: string, name: string }} source
 *
 * @typedef {Object} FoodMapSharedJsonRoot
 * @property {string} schema
 * @property {number} schemaVersion
 * @property {{ name: string, version: number }} generator
 * @property {Object=} owner
 * @property {Object=} site
 * @property {string} generatedAt
 * @property {string} coordinateSystem
 * @property {FoodMapSharedJsonSpot[]} spots
 *
 * @typedef {Object} FoodMapExternalSourceConfig
 * @property {string} id
 * @property {string} name
 * @property {string} url
 * @property {string=} homepage
 * @property {string=} avatar
 * @property {boolean=} enabled
 *
 * @typedef {Object} FoodMapExternalSourceSpot
 * @property {string=} id
 * @property {string} name
 * @property {string=} city
 * @property {string=} address
 * @property {number} lng
 * @property {number} lat
 * @property {string=} coordinateSystem
 * @property {string=} category
 * @property {{ type: "external", id: string, name: string }} source
 *
 * @typedef {Object} FoodMapValidationResult
 * @property {boolean} ok
 * @property {string[]} errors
 * @property {NormalizedFoodPlace[]} places
 *
 * @typedef {Object} FoodMapFilterState
 * @property {string} city
 * @property {string} category
 * @property {string} query
 * @property {boolean} includeExternal
 */

export const FOOD_MAP_SCHEMA = "https://valaxy.site/schemas/food-map.v1.json";
export const FOOD_MAP_SCHEMA_VERSION = 1;
export const FOOD_MAP_COORDINATE_SYSTEM = "GCJ-02";
export const FOOD_MAP_GENERATOR_INFO = Object.freeze({
  name: "nocturne-archive-blog-food-map",
  version: FOOD_MAP_SCHEMA_VERSION
});

export const FOOD_MAP_SOURCE_TYPES = Object.freeze({
  local: "local",
  external: "external"
});

export const FOOD_MAP_STATUS_VALUES = Object.freeze({
  published: "published",
  draft: "draft"
});

export const FOOD_MAP_PUBLIC_PLACE_KEYS = Object.freeze([
  "id",
  "spotId",
  "name",
  "city",
  "district",
  "address",
  "lng",
  "lat",
  "coordinateSystem",
  "category",
  "price",
  "rating",
  "recommend",
  "tags",
  "description",
  "articleUrl",
  "amapUrl",
  "showAmapLink",
  "cover",
  "photos",
  "source"
]);

export const FOOD_MAP_PUBLIC_VISIT_KEYS = Object.freeze([
  "visitedAt",
  "note",
  "rating"
]);

export const FOOD_MAP_SHARED_SPOT_KEYS = Object.freeze([
  "id",
  "name",
  "city",
  "address",
  "lng",
  "lat",
  "coordinateSystem",
  "category",
  "price",
  "rating",
  "recommend",
  "articleUrl",
  "amapUrl",
  "source"
]);

export const FOOD_MAP_FILTER_DEFAULTS = Object.freeze({
  city: "",
  category: "",
  query: "",
  includeExternal: true
});

export const FOOD_MAP_AMAP_LOADER_STATES = Object.freeze({
  idle: "idle",
  loading: "loading",
  ready: "ready",
  missingKey: "missing-key",
  failed: "failed"
});

export const FOOD_MAP_MERGE_PRECEDENCE_NOTES = Object.freeze([
  "Duplicate local spotId values are validation errors and must not be silently merged.",
  "Local places win scalar conflicts against external places with the same public identity.",
  "Array fields such as tags, recommend, and photos are unioned deterministically in local-first order.",
  "Source attribution is preserved for every normalized place; external IDs may be namespaced as sourceId:rawId."
]);
