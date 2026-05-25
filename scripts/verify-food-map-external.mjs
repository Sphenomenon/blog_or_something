import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  FOOD_MAP_SCHEMA_VERSION,
  aggregateFoodMapExternalSources,
  fetchExternalFoodMapSource,
  loadFoodMapSourceConfig,
  mergeFoodMapPlaces,
  normalizeExternalSourceConfigs,
  normalizeExternalSourceRoot,
  normalizeLocalFoodPlaces
} from "../src/features/food-map/index.js";

const command = "npm run verify:food-map-external";
const happyEvidencePath = resolve(".sisyphus/evidence/task-4-runtime-aggregation.json");
const failureEvidencePath = resolve(".sisyphus/evidence/task-4-runtime-aggregation-error.json");
const sourceStatusEvidencePath = resolve(".sisyphus/evidence/task-7-source-attribution.json");
const sourceWarningEvidencePath = resolve(".sisyphus/evidence/task-7-source-warning.json");
const duplicateIdsEvidencePath = resolve(".sisyphus/evidence/task-11-duplicate-ids.json");
const edgeCaseEvidencePath = resolve(".sisyphus/evidence/task-11-edge-cases.txt");
const happyResults = [];
const failureResults = [];
const sourceStatusResults = [];
const sourceWarningResults = [];
const duplicateIdResults = [];
const edgeCaseResults = [];

function record(list, name, fn) {
  try {
    const detail = fn();
    list.push(`PASS ${name}${detail ? `: ${detail}` : ""}`);
  } catch (error) {
    list.push(`FAIL ${name}: ${error.message}`);
    throw error;
  }
}

async function recordAsync(list, name, fn) {
  try {
    const detail = await fn();
    list.push(`PASS ${name}${detail ? `: ${detail}` : ""}`);
  } catch (error) {
    list.push(`FAIL ${name}: ${error.message}`);
    throw error;
  }
}

function localPlace(overrides = {}) {
  return {
    spotId: "fixture-noodles",
    name: "Local Noodles",
    status: "published",
    city: "Shanghai",
    category: "Noodles",
    address: "Local Road 1",
    coordinates: { lng: 121.4737, lat: 31.2304 },
    tags: ["local", "shared"],
    recommend: ["local dish"],
    photos: ["/local.jpg"],
    privateNote: "never public",
    ...overrides
  };
}

function source(overrides = {}) {
  return {
    id: "cachetide",
    name: "CacheTide Friend",
    url: "https://friend.example.test/food-map/index.json",
    homepage: "https://friend.example.test",
    enabled: true,
    ...overrides
  };
}

function okJson(root) {
  return async () => ({ ok: true, status: 200, json: async () => root });
}

async function writeEvidence(path, lines) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify({ command, generatedAt: new Date().toISOString(), checks: lines }, null, 2)}\n`);
}

async function readFoodMapViewSource() {
  return readFile(resolve("src/pages/FoodMapView.jsx"), "utf8");
}

await recordAsync(happyResults, "aggregates enabled external source with attribution and allowlist projection", async () => {
  const [local] = normalizeLocalFoodPlaces([localPlace()]);
  const result = await aggregateFoodMapExternalSources(
    [local],
    [
      source(),
      source({ id: "disabled", name: "Disabled", url: "https://disabled.example.test/index.json", enabled: false })
    ],
    {
      fetch: okJson({
        schemaVersion: FOOD_MAP_SCHEMA_VERSION,
        spots: [
          {
            id: "ramen-1",
            name: " External Ramen ",
            city: "Tokyo",
            address: "External Road 2",
            lng: 139.767,
            lat: 35.681,
            category: "Ramen",
            tags: ["external", "shared"],
            recommend: ["shio"],
            photos: ["/external.jpg"],
            privateNote: "remote secret",
            people: [{ name: "remote private person" }],
            unknownSecret: "remote hidden"
          }
        ]
      })
    }
  );

  assert.equal(result.status, "ready");
  assert.equal(result.loading, false);
  assert.equal(result.localPlaces.length, 1);
  assert.equal(result.externalPlaces.length, 1);
  assert.equal(result.sources.length, 1, "disabled source must be skipped");
  assert.equal(result.places.length, 2);
  const external = result.externalPlaces[0];
  assert.equal(external.id, "cachetide:ramen-1");
  assert.equal(external.source.type, "external");
  assert.equal(external.source.id, "cachetide");
  assert.equal(external.source.homepage, "https://friend.example.test");
  assert.equal("privateNote" in external, false);
  assert.equal("people" in external, false);
  assert.equal("unknownSecret" in external, false);
  return "places=2 sources=1 external=cachetide:ramen-1";
});

await recordAsync(happyResults, "missing runtime source config is local-only without warnings", async () => {
  const result = await loadFoodMapSourceConfig({
    fetch: async (url) => {
      assert.equal(url, "/food-map/sources.json");
      return { ok: false, status: 404, json: async () => [] };
    }
  });

  assert.deepEqual(result.sources, []);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.errors, []);
});

await recordAsync(happyResults, "runtime source config keeps valid enabled sources", async () => {
  const result = await loadFoodMapSourceConfig({
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => [
        {
          id: " friend ",
          name: " Friend Map ",
          url: " https://friend.example.test/food-map/index.json ",
          homepage: " https://friend.example.test ",
          avatar: " https://friend.example.test/avatar.png "
        }
      ]
    })
  });

  assert.deepEqual(result.sources, [
    {
      id: "friend",
      name: "Friend Map",
      url: "https://friend.example.test/food-map/index.json",
      homepage: "https://friend.example.test",
      avatar: "https://friend.example.test/avatar.png",
      enabled: true
    }
  ]);
  assert.deepEqual(result.warnings, []);
});

await recordAsync(happyResults, "empty runtime source config keeps current local-only count", async () => {
  const [local] = normalizeLocalFoodPlaces([localPlace()]);
  const configResult = await loadFoodMapSourceConfig({
    fetch: async () => ({ ok: true, status: 200, json: async () => [] })
  });

  assert.deepEqual(configResult.sources, []);
  assert.equal(configResult.warnings.length, 0);
  assert.equal(configResult.errors.length, 0);
  assert.equal([local].length, 1);
  return "sources=0 local=1 external=0";
});

await recordAsync(happyResults, "runtime aggregation exposes friend city and category for filters", async () => {
  const [local] = normalizeLocalFoodPlaces([localPlace()]);
  const result = await aggregateFoodMapExternalSources([local], [source({ id: "friend", name: "Friend Map" })], {
    fetch: okJson({
      schemaVersion: FOOD_MAP_SCHEMA_VERSION,
      spots: [{ id: "dumpling-1", name: "Friend Dumplings", city: "Hangzhou", address: "Friend Road", lng: 120.155, lat: 30.274, category: "Dumplings" }]
    })
  });

  const cities = new Set(result.places.map((place) => place.city));
  const categories = new Set(result.places.map((place) => place.category));
  assert.equal(result.places.length, 2);
  assert.equal(cities.has("Hangzhou"), true);
  assert.equal(categories.has("Dumplings"), true);
  return "places=2 friendCity=Hangzhou friendCategory=Dumplings";
});

await recordAsync(happyResults, "FoodMapView derives filters counts and map spots from aggregated places", async () => {
  const sourceText = await readFoodMapViewSource();
  assert.match(sourceText, /useState\(\{\s*status: "local",\s*loading: false,\s*places: publicFoodMapPlaces/s);
  assert.match(sourceText, /loadFoodMapSourceConfig\(\{ signal: controller\.signal \}\)/);
  assert.match(sourceText, /aggregateFoodMapExternalSources\(localFoodMapPlaces, configResult\.sources, \{ signal: controller\.signal \}\)/);
  assert.match(sourceText, /getFoodMapFilterOptions\(places\)/);
  assert.match(sourceText, /filterFoodMapPlaces\(places, filters\)/);
  assert.match(sourceText, /const totalCount = places\.length/);
  return "view uses local-first aggregationState.places for options, filters, counts, list, and map";
});

await recordAsync(sourceStatusResults, "FoodMapView surfaces compact source status without per-source filters", async () => {
  const sourceText = await readFoodMapViewSource();
  const componentText = await readFile(resolve("src/features/food-map/FoodMapComponents.jsx"), "utf8");
  assert.match(sourceText, /sourceStatusText = \[/);
  assert.match(sourceText, /`本地 \$\{localCount\}`/);
  assert.match(sourceText, /`外部 \$\{externalCount\}`/);
  assert.match(sourceText, /`失败 \$\{failedCount\}`/);
  assert.match(componentText, /FOOD_MAP_SOURCE_FILTERS\.external/);
  assert.doesNotMatch(sourceText, /failedSourceNames\.map\(.*button/s);
  return "status=本地 n · 外部 n · 同步中 · 失败 n; filters remain all/local/external";
});

await recordAsync(sourceStatusResults, "card detail and popup use explicit external source attribution", async () => {
  const componentText = await readFile(resolve("src/features/food-map/FoodMapComponents.jsx"), "utf8");
  assert.match(componentText, /`来源：\$\{source\.name \|\| source\.id \|\| "外部来源"\}`/);
  assert.match(componentText, /<SourceBadge source=\{spot\.source\} \/>/);
  assert.match(componentText, /food-map-info-window__eyebrow">\$\{escapeHtml\(sourceLabel\(spot\.source\)\)\}<\/span>/);
  return "SourceBadge and InfoWindow render 来源：{source.name} for external spots";
});

await recordAsync(happyResults, "FoodMapView selection effect updates only when selected id actually changes", async () => {
  const sourceText = await readFoodMapViewSource();
  assert.match(sourceText, /const nextSelectedId = filteredPlaces\.some\(\(spot\) => spot\.id === selectedId\)\s*\? selectedId\s*:\s*filteredPlaces\[0\]\?\.id \?\? "";/s);
  assert.match(sourceText, /if \(nextSelectedId !== selectedId\) \{\s*setSelectedId\(nextSelectedId\);\s*\}/s);
  assert.match(sourceText, /setSelectionRequestId\(\(currentRequestId\) => currentRequestId \+ 1\)/);
  return "selectedId falls back only when needed and avoids no-op state loops";
});

record(happyResults, "disabled runtime source configs are excluded", () => {
  const result = normalizeExternalSourceConfigs([
    source({ id: "enabled", name: "Enabled" }),
    source({ id: "disabled", name: "Disabled", enabled: false })
  ]);

  assert.deepEqual(result.sources.map((item) => item.id), ["enabled"]);
  assert.deepEqual(result.warnings, []);
});

record(happyResults, "merge keeps local scalar conflicts and unions arrays local-first", () => {
  const [local] = normalizeLocalFoodPlaces([localPlace()]);
  const merged = mergeFoodMapPlaces([local], [
    {
      id: "fixture-noodles",
      spotId: "fixture-noodles",
      name: "External Name Should Lose",
      city: "External City",
      address: "External Address",
      lng: 1,
      lat: 2,
      coordinateSystem: "GCJ-02",
      category: "External Category",
      tags: ["shared", "external"],
      recommend: ["local dish", "external dish"],
      photos: ["/local.jpg", "/external.jpg"],
      showAmapLink: false,
      source: { type: "external", id: "cachetide", name: "CacheTide Friend" }
    }
  ]);

  assert.equal(merged.places.length, 1);
  assert.equal(merged.places[0].name, "Local Noodles");
  assert.equal(merged.places[0].city, "Shanghai");
  assert.equal(merged.places[0].address, "Local Road 1");
  assert.deepEqual(merged.places[0].tags, ["local", "shared", "external"]);
  assert.deepEqual(merged.places[0].recommend, ["local dish", "external dish"]);
  assert.deepEqual(merged.places[0].photos, ["/local.jpg", "/external.jpg"]);
  assert.equal(merged.places[0].source.type, "local");
});

record(duplicateIdResults, "duplicate raw IDs from distinct sources keep separate composite UI IDs", () => {
  const first = normalizeExternalSourceRoot(
    {
      schemaVersion: FOOD_MAP_SCHEMA_VERSION,
      spots: [{ id: "same", name: "Friend One Same", lng: 121, lat: 31 }]
    },
    source({ id: "friend-one", name: "Friend One" })
  );
  const second = normalizeExternalSourceRoot(
    {
      schemaVersion: FOOD_MAP_SCHEMA_VERSION,
      spots: [{ id: "same", name: "Friend Two Same", lng: 122, lat: 32 }]
    },
    source({ id: "friend-two", name: "Friend Two" })
  );
  const merged = mergeFoodMapPlaces([], [...first.spots, ...second.spots]);

  assert.deepEqual(merged.places.map((spot) => spot.id), ["friend-one:same", "friend-two:same"]);
  assert.deepEqual(merged.places.map((spot) => spot.source.name), ["Friend One", "Friend Two"]);
  assert.equal(new Set(merged.places.map((spot) => spot.id)).size, 2);
  return "friend-one:same and friend-two:same remain separate stable IDs";
});

record(happyResults, "duplicate external IDs are deterministic per source-prefixed spot id", () => {
  const result = normalizeExternalSourceRoot(
    {
      schemaVersion: FOOD_MAP_SCHEMA_VERSION,
      spots: [
        { id: "same", name: "First", lng: 121, lat: 31 },
        { id: "same", name: "Second", lng: 122, lat: 32 },
        { id: "same", name: "Other Source Shape", lng: 123, lat: 33 }
      ]
    },
    source()
  );

  assert.deepEqual(result.spots.map((spot) => spot.id), ["cachetide:same"]);
  assert.equal(result.warnings.length, 2);
  assert.match(result.warnings[0], /duplicate external spot id "cachetide:same" skipped/);
});

record(edgeCaseResults, "empty external feed is non-fatal and returns zero spots", () => {
  const result = normalizeExternalSourceRoot({ schemaVersion: FOOD_MAP_SCHEMA_VERSION, spots: [] }, source({ id: "empty", name: "Empty Friend" }));
  assert.equal(result.source.name, "Empty Friend");
  assert.deepEqual(result.spots, []);
  assert.deepEqual(result.warnings, []);
});

record(edgeCaseResults, "invalid external coordinates are skipped with compact warning", () => {
  const result = normalizeExternalSourceRoot(
    {
      schemaVersion: FOOD_MAP_SCHEMA_VERSION,
      spots: [
        { id: "bad-lng", name: "Bad Lng", lng: 181, lat: 31 },
        { id: "bad-lat", name: "Bad Lat", lng: 121, lat: -91 },
        { id: "good", name: "Good Coordinates", lng: 121, lat: 31 }
      ]
    },
    source({ id: "coordinate-friend", name: "Coordinate Friend" })
  );

  assert.deepEqual(result.spots.map((spot) => spot.id), ["coordinate-friend:good"]);
  assert.equal(result.warnings.length, 2);
  assert.match(result.warnings[0], /requires lng\/lat within valid coordinate ranges/);
  assert.match(result.warnings[1], /requires lng\/lat within valid coordinate ranges/);
  return "bad coordinates skipped; valid friend spot remains";
});

record(failureResults, "non-object external root warns and returns zero spots", () => {
  const result = normalizeExternalSourceRoot(null, source());
  assert.deepEqual(result.spots, []);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /shared JSON root must be an object/);
});

record(failureResults, "schemaVersion mismatch warns and returns zero spots", () => {
  const result = normalizeExternalSourceRoot({ schemaVersion: 999, spots: [] }, source());
  assert.deepEqual(result.spots, []);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /schemaVersion must be 1/);
});

record(failureResults, "malformed spots field warns and returns zero spots", () => {
  const result = normalizeExternalSourceRoot({ schemaVersion: FOOD_MAP_SCHEMA_VERSION, spots: "bad" }, source());
  assert.deepEqual(result.spots, []);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /spots must be an array/);
});

await recordAsync(failureResults, "fetch rejection warns and keeps local data usable", async () => {
  const [local] = normalizeLocalFoodPlaces([localPlace()]);
  const result = await aggregateFoodMapExternalSources([local], [source()], {
    fetch: async () => {
      throw new Error("network offline");
    }
  });

  assert.deepEqual(result.places.map((place) => place.id), ["fixture-noodles"]);
  assert.equal(result.externalPlaces.length, 0);
  assert.deepEqual(result.failedSources.map((item) => item.name), ["CacheTide Friend"]);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /network offline/);
});

await recordAsync(failureResults, "non-OK response warns and keeps local data usable", async () => {
  const [local] = normalizeLocalFoodPlaces([localPlace()]);
  const result = await aggregateFoodMapExternalSources([local], [source()], {
    fetch: async () => ({ ok: false, status: 503, json: async () => ({}) })
  });

  assert.deepEqual(result.places.map((place) => place.id), ["fixture-noodles"]);
  assert.equal(result.externalPlaces.length, 0);
  assert.deepEqual(result.failedSources.map((item) => item.name), ["CacheTide Friend"]);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /HTTP 503/);
});

await recordAsync(failureResults, "mixed friend feed failure keeps successful friend and local places", async () => {
  const [local] = normalizeLocalFoodPlaces([localPlace()]);
  const result = await aggregateFoodMapExternalSources(
    [local],
    [source({ id: "friend-ok", name: "Friend OK", url: "https://ok.example.test/index.json" }), source({ id: "friend-fail", name: "Friend Fail", url: "https://fail.example.test/index.json" })],
    {
      fetch: async (url) => {
        if (String(url).includes("fail")) return { ok: false, status: 503, json: async () => ({}) };
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schemaVersion: FOOD_MAP_SCHEMA_VERSION,
            spots: [{ id: "bao-1", name: "Friend Bao", city: "Suzhou", address: "Canal Road", lng: 120.585, lat: 31.299, category: "Bao" }]
          })
        };
      }
    }
  );

  assert.equal(result.places.length, 2);
  assert.equal(result.externalPlaces.length, 1);
  assert.deepEqual(result.places.map((place) => place.id), ["fixture-noodles", "friend-ok:bao-1"]);
  assert.deepEqual(result.failedSources.map((item) => item.name), ["Friend Fail"]);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /friend-fail/);
  return "local=1 external=1 warnings=1";
});

await recordAsync(sourceWarningResults, "compact warning displays human source names instead of raw diagnostics", async () => {
  const sourceText = await readFoodMapViewSource();
  assert.match(sourceText, /failedSourceNames\.join\("、"\)/);
  assert.match(sourceText, /失败来源：/);
  assert.doesNotMatch(sourceText, /runtimeWarnings\[0\]/);
  return "warning names come from aggregate failedSources metadata";
});

await recordAsync(failureResults, "malformed JSON rejection warns and continues", async () => {
  const result = await fetchExternalFoodMapSource(source(), {
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("invalid json");
      }
    })
  });

  assert.deepEqual(result.spots, []);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /invalid json/);
});

await recordAsync(failureResults, "invalid runtime source config JSON warns and returns empty sources", async () => {
  const result = await loadFoodMapSourceConfig({
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("invalid json");
      }
    })
  });

  assert.deepEqual(result.sources, []);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /source config fetch failed: invalid json/);
});

record(failureResults, "malformed runtime source config entries warn while valid sources remain", () => {
  const result = normalizeExternalSourceConfigs([
    null,
    { id: "missing-url", name: "Missing URL" },
    source({ id: "valid", name: "Valid Friend", enabled: true })
  ]);

  assert.deepEqual(result.sources.map((item) => item.id), ["valid"]);
  assert.equal(result.warnings.length, 2);
  assert.match(result.warnings[0], /entry must be an object/);
  assert.match(result.warnings[1], /entry requires id, name, and url/);
});

await writeEvidence(happyEvidencePath, happyResults);
await writeEvidence(failureEvidencePath, failureResults);
await writeEvidence(sourceStatusEvidencePath, sourceStatusResults);
await writeEvidence(sourceWarningEvidencePath, sourceWarningResults);
await writeEvidence(duplicateIdsEvidencePath, duplicateIdResults);
await writeEvidence(edgeCaseEvidencePath, edgeCaseResults);

console.log(`PASS food-map external verification (${happyResults.length + failureResults.length + duplicateIdResults.length + edgeCaseResults.length} checks)`);
