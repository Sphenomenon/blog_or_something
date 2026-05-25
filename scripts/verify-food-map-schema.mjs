import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import assert from "node:assert/strict";

import {
  FOOD_MAP_AMAP_LOADER_STATES,
  FOOD_MAP_COORDINATE_SYSTEM,
  FOOD_MAP_FILTER_DEFAULTS,
  FOOD_MAP_MERGE_PRECEDENCE_NOTES,
  FOOD_MAP_SCHEMA,
  FOOD_MAP_SCHEMA_VERSION,
  createFoodMapSharedJsonRoot,
  normalizeFilterState,
  normalizeLocalFoodPlaces,
  projectPublicFoodMapPlaces,
  projectSharedFoodMapSpots,
  validateLocalFoodPlaces
} from "../src/features/food-map/index.js";

const evidencePath = resolve(".sisyphus/evidence/task-1-schema.txt");
const privacyEvidencePath = resolve(".sisyphus/evidence/task-1-schema-privacy.txt");
const results = [];
const privacyResults = [];

function record(list, name, fn) {
  try {
    fn();
    list.push(`PASS ${name}`);
  } catch (error) {
    list.push(`FAIL ${name}: ${error.message}`);
    throw error;
  }
}

function validPlace(overrides = {}) {
  return {
    spotId: "local-ramen-1",
    name: "  Fixture Ramen  ",
    status: "published",
    city: "  Shanghai ",
    category: "  Ramen ",
    address: "100 Test Road",
    coordinates: { lng: 121.4737, lat: 31.2304 },
    tags: [" noodles ", "fixture"],
    recommend: [" shio "],
    showAmapLink: undefined,
    visits: [
      {
        visitedAt: "2025-12-02",
        note: "newer public note",
        rating: 4.5,
        people: [{ name: "Public Friend", url: "https://example.test" }]
      },
      {
        visitedAt: "2024-01-01",
        note: "older public note",
        privateNote: "owner-only visit note"
      }
    ],
    ...overrides
  };
}

function expectValidationError(place, expected) {
  const result = validateLocalFoodPlaces([place]);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], expected);
}

record(results, "schema defaults and normalization", () => {
  const [place] = normalizeLocalFoodPlaces([validPlace()]);
  assert.equal(place.spotId, "local-ramen-1");
  assert.equal(place.name, "Fixture Ramen");
  assert.equal(place.city, "Shanghai");
  assert.equal(place.category, "Ramen");
  assert.equal(place.coordinateSystem, FOOD_MAP_COORDINATE_SYSTEM);
  assert.equal(place.showAmapLink, true);
  assert.equal(place.source.type, "local");
  assert.deepEqual(normalizeFilterState({ city: " Shanghai ", category: " Ramen " }), {
    ...FOOD_MAP_FILTER_DEFAULTS,
    city: "Shanghai",
    category: "Ramen"
  });
  assert.equal(FOOD_MAP_AMAP_LOADER_STATES.missingKey, "missing-key");
  assert.ok(FOOD_MAP_MERGE_PRECEDENCE_NOTES.some((note) => note.includes("Local places win")));
});

record(results, "public projection allowlist and newest-first visits", () => {
  const [place] = normalizeLocalFoodPlaces([validPlace({ privateNote: "raw secret", unknownSecret: "never public" })]);
  const [publicPlace] = projectPublicFoodMapPlaces([place]);
  assert.deepEqual(Object.keys(publicPlace).sort(), [
    "address",
    "category",
    "city",
    "coordinateSystem",
    "id",
    "lat",
    "lng",
    "name",
    "photos",
    "recommend",
    "showAmapLink",
    "source",
    "spotId",
    "tags",
    "visits"
  ].sort());
  assert.equal(publicPlace.visits[0].visitedAt, "2025-12-02");
  assert.equal(publicPlace.visits[1].visitedAt, "2024-01-01");
  assert.deepEqual(Object.keys(publicPlace.visits[0]).sort(), ["note", "rating", "visitedAt"].sort());
  assert.equal("privateNote" in publicPlace, false);
  assert.equal("unknownSecret" in publicPlace, false);
  assert.equal("people" in publicPlace.visits[0], false);
  assert.equal("privateNote" in publicPlace.visits[1], false);
});

record(results, "validation rejects duplicate and invalid records", () => {
  const duplicate = validateLocalFoodPlaces([validPlace(), validPlace({ name: "Duplicate" })]);
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.errors[0], /duplicate local spotId "local-ramen-1"/);
  expectValidationError(validPlace({ spotId: "" }), /missing required field "spotId"/);
  expectValidationError(validPlace({ name: "" }), /missing required field "name"/);
  expectValidationError(validPlace({ status: "archived" }), /field "status" must be one of published\|draft/);
  expectValidationError(validPlace({ city: "" }), /missing required field "city"/);
  expectValidationError(validPlace({ category: "" }), /missing required field "category"/);
  expectValidationError(validPlace({ address: "" }), /missing required field "address"/);
  expectValidationError(validPlace({ coordinates: { lat: 31 } }), /missing required field "coordinates.lng"/);
  expectValidationError(validPlace({ coordinates: { lng: 121 } }), /missing required field "coordinates.lat"/);
  expectValidationError(validPlace({ coordinates: { lng: 181, lat: 31 } }), /coordinates.lng" must be between -180 and 180/);
  expectValidationError(validPlace({ coordinates: { lng: 121, lat: -91 } }), /coordinates.lat" must be between -90 and 90/);
});

record(results, "shared JSON root and spot projection contract", () => {
  const places = normalizeLocalFoodPlaces([validPlace()]);
  const root = createFoodMapSharedJsonRoot(places, {
    generatedAt: "2026-01-01T00:00:00.000Z",
    owner: { name: "Fixture Owner" },
    site: { url: "https://example.test" }
  });
  assert.equal(root.schema, "https://valaxy.site/schemas/food-map.v1.json");
  assert.equal(root.schema, FOOD_MAP_SCHEMA);
  assert.equal(root.schemaVersion, FOOD_MAP_SCHEMA_VERSION);
  assert.equal(root.coordinateSystem, FOOD_MAP_COORDINATE_SYSTEM);
  assert.deepEqual(root.owner, { name: "Fixture Owner" });
  assert.deepEqual(root.site, { url: "https://example.test" });
  assert.equal(root.spots.length, 1);
  assert.equal(root.spots[0].id, "local-ramen-1");
  assert.equal("visits" in root.spots[0], false);
});

record(privacyResults, "draft and private local places excluded", () => {
  const places = normalizeLocalFoodPlaces([
    validPlace({ spotId: "public-place" }),
    validPlace({ spotId: "draft-place", status: "draft", name: "Draft Fixture" }),
    validPlace({ spotId: "private-place", private: true, name: "Private Fixture" })
  ]);
  const publicPlaces = projectPublicFoodMapPlaces(places);
  assert.deepEqual(publicPlaces.map((place) => place.spotId), ["public-place"]);
});

record(privacyResults, "public projection and shared JSON omit people and private visit fields", () => {
  const secretText = "DO_NOT_LEAK_SECRET_FIXTURE";
  const [place] = normalizeLocalFoodPlaces([
    validPlace({
      visits: [
        { visitedAt: "2025-01-01", note: "public", people: [{ name: "Visible" }] },
        { visitedAt: "2026-01-01", note: secretText, privateNote: secretText, private: true, people: [{ name: secretText }] }
      ],
      privateNote: secretText,
      private: false
    })
  ]);
  const publicJson = JSON.stringify(projectPublicFoodMapPlaces([place]));
  const sharedJson = JSON.stringify(projectSharedFoodMapSpots([place]));
  assert.equal(publicJson.includes(secretText), false);
  assert.equal(publicJson.includes("people"), false);
  assert.equal(sharedJson.includes(secretText), false);
  assert.equal(sharedJson.includes("visits"), false);
  assert.equal(sharedJson.includes("visitedAt"), false);
  assert.equal(sharedJson.includes("people"), false);
  assert.equal(sharedJson.includes("privateNote"), false);
  assert.equal(sharedJson.includes("private"), false);
});

async function writeEvidence(path, lines) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, [`Command: npm run verify:food-map-schema`, ...lines, ""].join("\n"));
}

await writeEvidence(evidencePath, results);
await writeEvidence(privacyEvidencePath, privacyResults);

console.log(`PASS food-map schema verification (${results.length + privacyResults.length} checks)`);
