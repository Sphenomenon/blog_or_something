import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import {
  FOOD_MAP_AMAP_LOADER_STATES,
  FOOD_MAP_FILTER_DEFAULTS,
  FOOD_MAP_SCHEMA_VERSION,
  aggregateFoodMapExternalSources,
  createFoodMapSharedJsonRoot,
  fetchExternalFoodMapSource,
  mergeFoodMapPlaces,
  normalizeExternalSourceRoot,
  normalizeFilterState,
  normalizeLocalFoodPlaces,
  projectPublicFoodMapPlaces,
  validateLocalFoodPlaces
} from "../src/features/food-map/index.js";

const command = "npm run verify:food-map";
const passEvidencePath = resolve(".sisyphus/evidence/task-9-tests-pass.txt");
const failureEvidencePath = resolve(".sisyphus/evidence/task-9-tests-failures.txt");
const jsonEndpointEvidencePath = resolve(".sisyphus/evidence/task-8-json-endpoint.json");
const routeSeparationEvidencePath = resolve(".sisyphus/evidence/task-8-json-route-separation.txt");
const aggregateEvidencePath = resolve(".sisyphus/evidence/task-10-aggregate-verify.txt");
const offlineSafeEvidencePath = resolve(".sisyphus/evidence/task-10-offline-safe.txt");
const passResults = [];
const failureResults = [];
const privateSharedJsonFields = new Set(["visits", "visitedAt", "people", "privateNote", "private", "draft"]);
const externalAggregateTokens = ["Friend Hotpot", "friend-hotpot", "friend-food-map", "Friend Food Map", "external"];

function validPlace(overrides = {}) {
  return {
    spotId: "fixture-noodles",
    name: "Fixture Noodles",
    status: "published",
    city: "Shanghai",
    category: "Noodles",
    address: "100 Fixture Road",
    coordinates: { lng: 121.4737, lat: 31.2304 },
    tags: [" local ", "shared"],
    recommend: [" soup "],
    photos: ["/local.jpg"],
    visits: [
      {
        visitId: "older",
        visitedAt: "2025-01-01",
        note: "older public note",
        privateNote: "older private note",
        people: [{ name: "Private Friend" }]
      },
      {
        visitId: "newer",
        visitedAt: "2026-01-01",
        note: "newer public note",
        rating: 4.5
      }
    ],
    ...overrides
  };
}

function externalSource(overrides = {}) {
  return {
    id: "friend",
    name: "Friend Source",
    url: "https://friend.example.test/food-map/index.json",
    homepage: "https://friend.example.test",
    enabled: true,
    ...overrides
  };
}

function record(list, name, fn) {
  try {
    const detail = fn();
    list.push(`PASS ${name}${detail ? `: ${detail}` : ""}`);
  } catch (error) {
    failureResults.push(`FAIL ${name}: ${error.message}`);
    throw error;
  }
}

async function recordAsync(list, name, fn) {
  try {
    const detail = await fn();
    list.push(`PASS ${name}${detail ? `: ${detail}` : ""}`);
  } catch (error) {
    failureResults.push(`FAIL ${name}: ${error.message}`);
    throw error;
  }
}

function runCommand(name, commandText, options = {}) {
  const result = spawnSync(commandText, {
    shell: true,
    cwd: resolve("."),
    env: options.env ?? process.env,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20
  });

  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  if (result.status !== 0) {
    throw new Error(`${name} exited ${result.status ?? "without status"}${output ? `\n${output}` : ""}`);
  }
  return output.split("\n").find((line) => line.startsWith("PASS ")) ?? `exit=${result.status}`;
}

function contentTypeForPath(path) {
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  return "application/octet-stream";
}

function staticPathForRequest(url) {
  const { pathname } = new URL(url, "http://127.0.0.1");
  const normalizedPath = decodeURIComponent(pathname).replace(/^\/+/, "");
  if (pathname === "/food-map" || pathname === "/food-map/") {
    return resolve("dist/index.html");
  }
  return resolve("dist", normalizedPath || "index.html");
}

async function startDistStaticServer() {
  const server = createServer(async (request, response) => {
    const filePath = staticPathForRequest(request.url ?? "/");
    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      response.writeHead(200, { "content-type": contentTypeForPath(filePath) });
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  });

  await new Promise((resolveServer, rejectServer) => {
    server.once("error", rejectServer);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectServer);
      resolveServer();
    });
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolveClose, rejectClose) => {
      server.close((error) => error ? rejectClose(error) : resolveClose());
    })
  };
}

async function fetchText(url) {
  const response = await fetch(url);
  const body = await response.text();
  return {
    url,
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    body
  };
}

function collectForbiddenFields(value, path = "$", matches = []) {
  if (!value || typeof value !== "object") return matches;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectForbiddenFields(item, `${path}[${index}]`, matches));
    return matches;
  }
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (privateSharedJsonFields.has(key)) {
      matches.push(childPath);
    }
    collectForbiddenFields(child, childPath, matches);
  }
  return matches;
}

function assertSharedJsonRoot(root, rawJson, label) {
  assert.equal(root.schemaVersion, FOOD_MAP_SCHEMA_VERSION, `${label} schemaVersion must be ${FOOD_MAP_SCHEMA_VERSION}`);
  assert.ok(Array.isArray(root.spots), `${label} spots must be an array`);
  assert.ok(root.spots.length > 0, `${label} should include local shared spot(s)`);
  assert.ok(root.spots.every((spot) => spot.source?.type === "local"), `${label} should contain only local shared spots`);
  assert.deepEqual(collectForbiddenFields(root), [], `${label} should not include private shared JSON fields`);
  for (const token of externalAggregateTokens) {
    assert.equal(rawJson.includes(token), false, `${label} leaked aggregate/external token ${token}`);
  }
}

async function writeJsonEndpointEvidence(payload) {
  await mkdir(dirname(jsonEndpointEvidencePath), { recursive: true });
  await writeFile(jsonEndpointEvidencePath, `${JSON.stringify({ command, generatedAt: new Date().toISOString(), ...payload }, null, 2)}\n`);
}

async function writeRouteSeparationEvidence(lines) {
  await mkdir(dirname(routeSeparationEvidencePath), { recursive: true });
  await writeFile(routeSeparationEvidencePath, [`Command: ${command}`, ...lines, ""].join("\n"));
}

async function writeEvidence() {
  await mkdir(dirname(passEvidencePath), { recursive: true });
  await writeFile(passEvidencePath, [`Command: ${command}`, ...passResults, ""].join("\n"));
  await writeFile(failureEvidencePath, [`Command: ${command}`, ...failureResults, ""].join("\n"));
}

async function writeTask10Evidence() {
  await mkdir(dirname(aggregateEvidencePath), { recursive: true });
  await writeFile(aggregateEvidencePath, [
    `Command: ${command}`,
    "Status: PASS",
    "Aggregate orchestration includes schema/content checks, runtime external source config tests, AMap popup tests, browser mocked-flow tests, build, and static JSON privacy checks.",
    ...passResults.filter((line) => /schema|content|external|AMap|browser|JSON|build|static HTTP/i.test(line)),
    ""
  ].join("\n"));
  await writeFile(offlineSafeEvidencePath, [
    `Command: ${command}`,
    "Status: PASS",
    "Offline safety: aggregate verification uses Node assertions, local files, local dist/Vite servers, mocked fetch responses, and Playwright route fulfillment.",
    "No live AMap, CacheTide, public internet, production deploy, or real VITE_AMAP_KEY is required.",
    "AMap coverage comes from mocked adapter/browser flows; webapi.amap.com is only asserted or fulfilled as a local mock target.",
    "CacheTide is not contacted; external source tests use example.test fixtures and injected fetch implementations.",
    ""
  ].join("\n"));
}

try {
  record(passResults, "schema validation rejects duplicate spotId and invalid coordinates", () => {
    const duplicate = validateLocalFoodPlaces([validPlace(), validPlace({ name: "Duplicate Fixture" })]);
    assert.equal(duplicate.ok, false);
    assert.match(duplicate.errors[0], /duplicate local spotId "fixture-noodles"/);

    const invalidCoordinates = validateLocalFoodPlaces([
      validPlace({ spotId: "bad-coordinates", coordinates: { lng: 181, lat: -91 } })
    ]);
    assert.equal(invalidCoordinates.ok, false);
    assert.match(invalidCoordinates.errors[0], /coordinates\.lng" must be between -180 and 180/);
    return "duplicate and out-of-range coordinates fail fast";
  });

  record(passResults, "public projection privacy excludes draft/private records and visit secrets", () => {
    const places = normalizeLocalFoodPlaces([
      validPlace({ privateNote: "top-level secret", unknownSecret: "unknown secret" }),
      validPlace({ spotId: "draft-place", name: "Draft Place", status: "draft" }),
      validPlace({ spotId: "private-place", name: "Private Place", private: true })
    ]);
    const publicPlaces = projectPublicFoodMapPlaces(places);
    assert.deepEqual(publicPlaces.map((place) => place.spotId), ["fixture-noodles"]);
    assert.equal(publicPlaces[0].visits[0].visitedAt, "2026-01-01");
    const publicJson = JSON.stringify(publicPlaces);
    for (const privateToken of ["top-level secret", "unknown secret", "older private note", "Private Friend", "privateNote", "people"]) {
      assert.equal(publicJson.includes(privateToken), false, `${privateToken} leaked into public projection`);
    }
    return "public spots=1 private tokens absent";
  });

  record(passResults, "filter defaults and trimming are derived from shared constants", () => {
    assert.deepEqual(normalizeFilterState(), FOOD_MAP_FILTER_DEFAULTS);
    assert.deepEqual(normalizeFilterState({ city: " Shanghai ", category: " Noodles ", query: " soup ", includeExternal: false }), {
      city: "Shanghai",
      category: "Noodles",
      query: "soup",
      includeExternal: false
    });
  });

  record(passResults, "visit sorting is newest first after normalization", () => {
    const [place] = normalizeLocalFoodPlaces([validPlace()]);
    assert.deepEqual(place.visits.map((visit) => visit.visitId), ["newer", "older"]);
  });

  record(passResults, "local and external merge precedence keeps local scalar values", () => {
    const [local] = normalizeLocalFoodPlaces([validPlace()]);
    const merged = mergeFoodMapPlaces([local], [
      {
        id: "fixture-noodles",
        spotId: "fixture-noodles",
        name: "External Name",
        city: "External City",
        address: "External Address",
        lng: 1,
        lat: 2,
        coordinateSystem: "GCJ-02",
        category: "External Category",
        tags: ["shared", "external"],
        recommend: ["soup", "external dish"],
        photos: ["/local.jpg", "/external.jpg"],
        source: { type: "external", id: "friend", name: "Friend Source" }
      }
    ]);
    assert.equal(merged.places.length, 1);
    assert.equal(merged.places[0].name, "Fixture Noodles");
    assert.equal(merged.places[0].city, "Shanghai");
    assert.deepEqual(merged.places[0].tags, ["local", "shared", "external"]);
    assert.deepEqual(merged.places[0].recommend, ["soup", "external dish"]);
    assert.equal(merged.places[0].source.type, "local");
  });

  await recordAsync(passResults, "external malformed roots and fetch failures tolerate local data", async () => {
    const [local] = normalizeLocalFoodPlaces([validPlace()]);
    const malformedRoot = normalizeExternalSourceRoot({ schemaVersion: FOOD_MAP_SCHEMA_VERSION, spots: "bad" }, externalSource());
    assert.deepEqual(malformedRoot.spots, []);
    assert.match(malformedRoot.warnings[0], /spots must be an array/);

    const emptyRoot = normalizeExternalSourceRoot({ schemaVersion: FOOD_MAP_SCHEMA_VERSION, spots: [] }, externalSource({ id: "empty" }));
    assert.deepEqual(emptyRoot.spots, []);
    assert.deepEqual(emptyRoot.warnings, []);

    const invalidCoordinates = normalizeExternalSourceRoot({
      schemaVersion: FOOD_MAP_SCHEMA_VERSION,
      spots: [
        { id: "bad-lng", name: "Bad Lng", lng: 181, lat: 31 },
        { id: "good", name: "Good Coordinates", lng: 121, lat: 31 }
      ]
    }, externalSource({ id: "coordinate-friend" }));
    assert.deepEqual(invalidCoordinates.spots.map((spot) => spot.id), ["coordinate-friend:good"]);
    assert.match(invalidCoordinates.warnings[0], /requires lng\/lat within valid coordinate ranges/);

    const duplicateRawIds = mergeFoodMapPlaces([], [
      ...normalizeExternalSourceRoot({ schemaVersion: FOOD_MAP_SCHEMA_VERSION, spots: [{ id: "same", name: "Friend One", lng: 121, lat: 31 }] }, externalSource({ id: "friend-one" })).spots,
      ...normalizeExternalSourceRoot({ schemaVersion: FOOD_MAP_SCHEMA_VERSION, spots: [{ id: "same", name: "Friend Two", lng: 122, lat: 32 }] }, externalSource({ id: "friend-two" })).spots
    ]);
    assert.deepEqual(duplicateRawIds.places.map((spot) => spot.id), ["friend-one:same", "friend-two:same"]);

    const failedFetch = await fetchExternalFoodMapSource(externalSource(), {
      fetch: async () => {
        throw new Error("network offline");
      }
    });
    assert.deepEqual(failedFetch.spots, []);
    assert.match(failedFetch.warnings[0], /network offline/);

    const aggregate = await aggregateFoodMapExternalSources([local], [externalSource()], {
      fetch: async () => ({ ok: false, status: 503, json: async () => ({}) })
    });
    assert.deepEqual(aggregate.places.map((place) => place.spotId), ["fixture-noodles"]);
    assert.match(aggregate.warnings[0], /HTTP 503/);
    return "malformed root, empty feed, invalid coordinates, duplicate raw ids, thrown fetch, and HTTP 503 are non-fatal";
  });

  record(passResults, "shared JSON export privacy uses shared-spot allowlist", () => {
    const secret = "TASK9_SECRET_SHOULD_NOT_LEAK";
    const [place] = normalizeLocalFoodPlaces([
      validPlace({ privateNote: secret, visits: [{ visitedAt: "2026-01-01", note: secret, privateNote: secret, people: [{ name: secret }] }] })
    ]);
    const root = createFoodMapSharedJsonRoot([place], { generatedAt: "2026-01-01T00:00:00.000Z" });
    const json = JSON.stringify(root);
    assert.equal(root.schemaVersion, FOOD_MAP_SCHEMA_VERSION);
    assert.equal(root.spots.length, 1);
    for (const privateToken of [secret, "visits", "visitedAt", "privateNote", "people", "private"]) {
      assert.equal(json.includes(privateToken), false, `${privateToken} leaked into shared JSON`);
    }
  });

  for (const [name, commandText] of [
    ["schema verification", "npm run verify:food-map-schema"],
    ["content verification", "npm run verify:food-map-content"],
    ["external verification", "npm run verify:food-map-external"],
    ["AMap verification", "npm run verify:food-map-amap"],
    ["browser mocked-flow verification", "npm run verify:food-map-browser"]
  ]) {
    record(passResults, name, () => runCommand(name, commandText));
  }

  record(passResults, "missing AMap-key build behavior and static export", () => {
    const env = { ...process.env };
    delete env.VITE_AMAP_KEY;
    return runCommand("missing AMap-key build", "npm run build", { env });
  });

  await recordAsync(passResults, "generated JSON export exists and remains privacy-safe", async () => {
    const publicJson = await readFile(resolve("public/food-map/index.json"), "utf8");
    const distJson = await readFile(resolve("dist/food-map/index.json"), "utf8");
    const publicRoot = JSON.parse(publicJson);
    const distRoot = JSON.parse(distJson);
    assertSharedJsonRoot(publicRoot, publicJson, "public/food-map/index.json");
    assertSharedJsonRoot(distRoot, distJson, "dist/food-map/index.json");
    for (const exportedJson of [publicJson, distJson]) {
      for (const privateToken of ["privateNote", "people", "visits", "visitedAt"]) {
        assert.equal(exportedJson.includes(privateToken), false, `${privateToken} leaked into exported JSON`);
      }
    }
    assert.equal(FOOD_MAP_AMAP_LOADER_STATES.missingKey, "missing-key");
    return `public spots=${publicRoot.spots.length} dist spots=${distRoot.spots.length}`;
  });

  await recordAsync(passResults, "static HTTP serves food-map page shell separately from shared JSON", async () => {
    let server;
    try {
      server = await startDistStaticServer();
      const pageResponse = await fetchText(`${server.baseUrl}/food-map`);
      const jsonResponse = await fetchText(`${server.baseUrl}/food-map/index.json`);
      assert.equal(pageResponse.status, 200, "/food-map should return HTTP 200");
      assert.equal(jsonResponse.status, 200, "/food-map/index.json should return HTTP 200");
      assert.match(pageResponse.contentType, /text\/html/, "/food-map should be HTML");
      assert.match(jsonResponse.contentType, /application\/json/, "/food-map/index.json should be JSON");
      assert.match(pageResponse.body, /<html/i, "/food-map should return the SPA HTML shell");
      assert.doesNotMatch(jsonResponse.body.trimStart(), /^<!doctype html/i, "/food-map/index.json should not return SPA HTML");
      const root = JSON.parse(jsonResponse.body);
      assertSharedJsonRoot(root, jsonResponse.body, "HTTP /food-map/index.json");
      await writeJsonEndpointEvidence({
        status: "PASS",
        server: "local dist static server",
        assertions: {
          distJsonExists: true,
          jsonStatus: jsonResponse.status,
          jsonContentType: jsonResponse.contentType,
          schemaVersion: root.schemaVersion,
          spotCount: root.spots.length,
          localOnly: root.spots.every((spot) => spot.source?.type === "local"),
          forbiddenPrivateFields: collectForbiddenFields(root),
          externalAggregateTokensAbsent: externalAggregateTokens.filter((token) => jsonResponse.body.includes(token)),
          jsonIsNotHtml: !/^<!doctype html/i.test(jsonResponse.body.trimStart())
        },
        jsonUrl: jsonResponse.url
      });
      await writeRouteSeparationEvidence([
        "Status: PASS",
        `Server: local dist static server (${server.baseUrl})`,
        `/food-map -> status ${pageResponse.status}, content-type ${pageResponse.contentType}, html shell=${/<html/i.test(pageResponse.body)}`,
        `/food-map/index.json -> status ${jsonResponse.status}, content-type ${jsonResponse.contentType}, schemaVersion=${root.schemaVersion}, spots=${root.spots.length}`,
        "Route separation: /food-map remains the SPA HTML page shell while /food-map/index.json remains a static JSON endpoint."
      ]);
      return `page=${pageResponse.status} ${pageResponse.contentType}; json=${jsonResponse.status} ${jsonResponse.contentType}; spots=${root.spots.length}`;
    } catch (error) {
      await writeJsonEndpointEvidence({ status: "FAIL", error: error.message });
      await writeRouteSeparationEvidence(["Status: FAIL", `Error: ${error.message}`]);
      throw error;
    } finally {
      await server?.close();
    }
  });
} catch (error) {
  await writeEvidence();
  throw error;
}

await writeEvidence();
await writeTask10Evidence();
console.log(`PASS food-map aggregate verification (${passResults.length} checks)`);
