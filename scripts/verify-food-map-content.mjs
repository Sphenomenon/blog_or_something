import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import yaml from "js-yaml";

import {
  loadPublicFoodMapPlaces,
  normalizeFoodPlaceModules
} from "../src/features/food-map/loader-core.js";

const command = "npm run verify:food-map-content";
const adminEvidencePath = resolve(".sisyphus/evidence/task-2-admin-config.txt");
const validationEvidencePath = resolve(".sisyphus/evidence/task-2-validation-error.txt");
const adminResults = [];
const validationResults = [];

function record(list, name, fn) {
  try {
    const detail = fn();
    list.push(`PASS ${name}${detail ? `: ${detail}` : ""}`);
  } catch (error) {
    list.push(`FAIL ${name}: ${error.message}`);
    throw error;
  }
}

function validPlace(overrides = {}) {
  return {
    spotId: "fixture-noodles",
    name: "Fixture Noodles",
    status: "published",
    city: "Shanghai",
    category: "Noodles",
    address: "100 Fixture Road",
    coordinates: { lng: 121.4737, lat: 31.2304 },
    recommend: ["noodles"],
    tags: ["fixture"],
    visits: [
      {
        visitId: "visit-public",
        visitedAt: "2026-05-01",
        note: "public note",
        people: [{ name: "Private Friend", url: "https://example.test" }]
      },
      {
        visitId: "visit-private",
        visitedAt: "2026-05-02",
        note: "hidden note",
        privateNote: "hidden private note",
        private: true,
        people: [{ name: "Hidden Friend" }]
      }
    ],
    ...overrides
  };
}

function byName(fields) {
  return new Map(fields.map((field) => [field.name, field]));
}

function expectThrowsMessage(fn, expected) {
  try {
    fn();
  } catch (error) {
    assert.match(error.message, expected);
    return error.message;
  }
  assert.fail("Expected validation to throw");
}

async function writeEvidence(path, lines) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, [`Command: ${command}`, ...lines, ""].join("\n"));
}

const adminConfig = yaml.load(await readFile(resolve("public/admin/config.yml"), "utf8"));

record(adminResults, "food_places collection exists and targets YAML folder", () => {
  const collection = adminConfig.collections.find((item) => item.name === "food_places");
  assert.ok(collection, "missing food_places collection");
  assert.equal(collection.folder, "src/content/food-places");
  assert.equal(collection.create, true);
  assert.equal(collection.format, "yaml");
  assert.equal(collection.extension, "yaml");
  assert.equal(collection.identifier_field, "name");
  assert.equal(collection.slug, "{{slug}}");
  return "folder=src/content/food-places format=yaml extension=yaml";
});

const foodPlacesCollection = adminConfig.collections.find((item) => item.name === "food_places");
const fieldMap = byName(foodPlacesCollection.fields);

record(adminResults, "top-level Task 1 schema fields are configured", () => {
  for (const fieldName of [
    "spotId",
    "name",
    "status",
    "city",
    "category",
    "address",
    "coordinates",
    "district",
    "price",
    "rating",
    "recommend",
    "tags",
    "description",
    "articleSlug",
    "articleUrl",
    "amapUrl",
    "showAmapLink",
    "coordinateSystem",
    "cover",
    "photos",
    "noindex",
    "private",
    "visits"
  ]) {
    assert.ok(fieldMap.has(fieldName), `missing field ${fieldName}`);
  }
});

record(adminResults, "nested coordinates and visits fields are configured", () => {
  const coordinateFields = byName(fieldMap.get("coordinates").fields);
  assert.ok(coordinateFields.has("lng"), "missing coordinates.lng");
  assert.ok(coordinateFields.has("lat"), "missing coordinates.lat");

  const visitFields = byName(fieldMap.get("visits").fields);
  for (const fieldName of ["visitId", "visitedAt", "rating", "note", "people", "privateNote", "private"]) {
    assert.ok(visitFields.has(fieldName), `missing visits.${fieldName}`);
  }
  const peopleFields = byName(visitFields.get("people").fields);
  assert.ok(peopleFields.has("name"), "missing visits.people.name");
  assert.ok(peopleFields.has("url"), "missing visits.people.url");
});

record(validationResults, "loader normalizes YAML modules and projects public records", () => {
  const places = normalizeFoodPlaceModules({
    "/fixtures/public.yaml": { default: validPlace() },
    "/fixtures/draft.yaml": { default: validPlace({ spotId: "draft-fixture", name: "Draft Fixture", status: "draft" }) },
    "/fixtures/private.yaml": { default: validPlace({ spotId: "private-fixture", name: "Private Fixture", private: true }) }
  });
  assert.equal(places.length, 3);

  const publicPlaces = loadPublicFoodMapPlaces({
    "/fixtures/public.yaml": { default: validPlace() },
    "/fixtures/draft.yaml": { default: validPlace({ spotId: "draft-fixture", name: "Draft Fixture", status: "draft" }) },
    "/fixtures/private.yaml": { default: validPlace({ spotId: "private-fixture", name: "Private Fixture", private: true }) }
  });
  assert.deepEqual(publicPlaces.map((place) => place.spotId), ["fixture-noodles"]);
  assert.equal(publicPlaces[0].visits.length, 1);
  assert.equal("people" in publicPlaces[0].visits[0], false);
  assert.equal(JSON.stringify(publicPlaces).includes("hidden private note"), false);
});

record(validationResults, "invalid latitude error includes file path and field", () => {
  return expectThrowsMessage(
    () => normalizeFoodPlaceModules({ "/fixtures/invalid-lat.yaml": { default: validPlace({ coordinates: { lng: 121, lat: 91 } }) } }),
    /\/fixtures\/invalid-lat\.yaml: place\[0\] field "coordinates\.lat" must be between -90 and 90/
  );
});

record(validationResults, "duplicate spotId error includes both file paths and field", () => {
  return expectThrowsMessage(
    () => normalizeFoodPlaceModules({
      "/fixtures/first.yaml": { default: validPlace() },
      "/fixtures/second.yaml": { default: validPlace({ name: "Duplicate Fixture" }) }
    }),
    /duplicate local spotId "fixture-noodles" in \/fixtures\/first\.yaml and \/fixtures\/second\.yaml/
  );
});

await writeEvidence(adminEvidencePath, adminResults);
await writeEvidence(validationEvidencePath, validationResults);

console.log(`PASS food-map content verification (${adminResults.length + validationResults.length} checks)`);
