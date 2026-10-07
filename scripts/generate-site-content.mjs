import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import yaml from "js-yaml";
import { loadPublicFoodMapPlaces } from "../src/features/food-map/loader-core.js";
import { assertArticleMediaManifest } from "./article-media-manifest-contract.mjs";

const contentRoot = resolve("src/content");
const generatedRoot = resolve("src/generated");

async function readYaml(filename) {
  return yaml.load(await readFile(resolve(contentRoot, filename), "utf8")) ?? {};
}

async function readModules(folder, extension, parse) {
  const names = (await readdir(resolve(contentRoot, folder))).filter((name) => name.endsWith(extension)).sort();
  return Object.fromEntries(await Promise.all(names.map(async (name) => [
    `../content/${folder}/${name}`,
    await parse(await readFile(resolve(contentRoot, folder, name), "utf8"))
  ])));
}

const [site, greeting, about, music, linksYaml, sectionsGlob, markdownModules, foodPlaceModules, manifest] = await Promise.all([
  readYaml("site.yaml"), readYaml("greeting.yaml"), readYaml("about.yaml"), readYaml("music.yaml"), readYaml("links.yaml"),
  readModules("sections", ".yaml", (text) => yaml.load(text)),
  readModules("posts", ".md", (text) => text),
  readModules("food-places", ".yaml", (text) => yaml.load(text)),
  readFile(resolve("public/images/optimized/articles/manifest.json"), "utf8").then((text) => assertArticleMediaManifest(JSON.parse(text), "public/images/optimized/articles/manifest.json"))
]);
await mkdir(generatedRoot, { recursive: true });
const values = { site, greeting, about, music, linksYaml, sectionsGlob, markdownModules, publicFoodMapPlaces: loadPublicFoodMapPlaces(foodPlaceModules) };
await writeFile(resolve(generatedRoot, "content.js"), Object.entries(values).map(([key, value]) => `export const ${key} = ${JSON.stringify(value)};`).join("\n") + "\n");
await writeFile(resolve(generatedRoot, "article-image-manifest.js"), `export default ${JSON.stringify(manifest)};\n`);
await import(`../src/data/content.js?validate=${Date.now()}`);
console.log(`Generated and validated site content: ${Object.keys(markdownModules).length} posts, ${Object.keys(sectionsGlob).length} sections, public food-map projection.`);
