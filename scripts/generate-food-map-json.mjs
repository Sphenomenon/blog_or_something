import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";

import yaml from "js-yaml";

import {
  createFoodMapSharedJsonRoot,
  normalizeLocalFoodPlaces
} from "../src/features/food-map/core.js";

const CONTENT_DIR = resolve("src/content/food-places");
const OUTPUT_PATH = resolve("public/food-map/index.json");

function isYamlFile(fileName) {
  return extname(fileName).toLowerCase() === ".yaml";
}

function failFoodPlaceFile(path, message) {
  throw new Error(`[food-map] ${path}: ${message.replace(/^\[food-map\]\s*/, "")}`);
}

async function readFoodPlaceYamlFiles() {
  const entries = await readdir(CONTENT_DIR, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });

  const yamlFiles = entries
    .filter((entry) => entry.isFile() && isYamlFile(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const rawPlaces = [];
  for (const fileName of yamlFiles) {
    const filePath = join(CONTENT_DIR, fileName);
    const relativePath = join("src/content/food-places", fileName);
    try {
      const content = await readFile(filePath, "utf8");
      const parsed = yaml.load(content);
      if (parsed === null || parsed === undefined) {
        failFoodPlaceFile(relativePath, "empty YAML document");
      }
      rawPlaces.push(parsed);
    } catch (error) {
      if (error.message.startsWith("[food-map]")) {
        throw error;
      }
      failFoodPlaceFile(relativePath, error.message);
    }
  }

  return rawPlaces;
}

async function generateFoodMapJson() {
  const rawPlaces = await readFoodPlaceYamlFiles();
  const places = normalizeLocalFoodPlaces(rawPlaces);
  const root = createFoodMapSharedJsonRoot(places, {
    owner: { name: "Nocturne Archive" },
    site: { name: "Nocturne Archive", url: "https://blog.sphenicidition.top" }
  });

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(root, null, 2)}\n`);
  console.log(`Generated ${OUTPUT_PATH} with ${root.spots.length} spot${root.spots.length === 1 ? "" : "s"}.`);
}

await generateFoodMapJson();
