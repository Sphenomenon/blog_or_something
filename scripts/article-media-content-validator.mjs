import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseArticleMarkdown } from "../src/article-media.js";
import { assertArticleMediaManifest } from "./article-media-manifest-contract.mjs";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const DEFAULT_POST_ROOT = path.join(PROJECT_ROOT, "src/content/posts");
const DEFAULT_MANIFEST_PATH = path.join(PROJECT_ROOT, "public/images/optimized/articles/manifest.json");

function validationError(source, line, code, message) {
  return { source, line, code, message };
}

function extractPostBody(raw, source) {
  const lines = String(raw).replace(/\r\n?/g, "\n").split("\n");
  if (lines[0] !== "---") {
    return {
      body: lines.join("\n"),
      lineOffset: 0,
      errors: [validationError(source, 1, "ARTICLE_MEDIA_FRONTMATTER_OPEN", "Post is missing its opening frontmatter delimiter.")]
    };
  }

  const closingIndex = lines.indexOf("---", 1);
  if (closingIndex === -1) {
    return {
      body: "",
      lineOffset: 0,
      errors: [validationError(source, 1, "ARTICLE_MEDIA_FRONTMATTER_CLOSE", "Post is missing its closing frontmatter delimiter.")]
    };
  }

  return {
    body: lines.slice(closingIndex + 1).join("\n"),
    lineOffset: closingIndex + 1,
    errors: []
  };
}

function collectLocalMedia(blocks) {
  const media = [];
  for (const block of blocks) {
    if (block.type === "image" && block.sourceType === "local") {
      media.push(block);
    }
    if (block.type === "gallery") {
      media.push(...block.images.filter((image) => image.sourceType === "local"));
    }
  }
  return media;
}

async function readManifest(manifestPath) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    const detail = error.code === "ENOENT" ? "does not exist" : error.message;
    throw new Error(`ARTICLE_MEDIA_MANIFEST_INVALID: ${manifestPath}: ${detail}`);
  }
  return assertArticleMediaManifest(manifest, manifestPath);
}

export function formatArticleMediaValidationError(error) {
  return `${error.source}:${error.line} [${error.code}] ${error.message}`;
}

export async function validateProductionArticleMedia(options = {}) {
  const postRoot = path.resolve(options.postRoot ?? DEFAULT_POST_ROOT);
  const manifestPath = path.resolve(options.manifestPath ?? DEFAULT_MANIFEST_PATH);
  const manifest = options.manifest
    ? assertArticleMediaManifest(options.manifest, manifestPath)
    : await readManifest(manifestPath);
  const entries = (await readdir(postRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .sort((left, right) => left.name.localeCompare(right.name));
  const errors = [];
  let localReferenceCount = 0;
  let remoteReferenceCount = 0;

  for (const entry of entries) {
    const filePath = path.join(postRoot, entry.name);
    const source = path.relative(PROJECT_ROOT, filePath).split(path.sep).join("/");
    const raw = await readFile(filePath, "utf8");
    const extracted = extractPostBody(raw, source);
    errors.push(...extracted.errors);
    if (extracted.errors.length > 0) continue;

    const parsed = parseArticleMarkdown(extracted.body, { source });
    errors.push(...parsed.errors.map((error) => ({ ...error, line: error.line + extracted.lineOffset })));

    for (const block of parsed.blocks) {
      if (block.type === "image" && block.sourceType === "remote") remoteReferenceCount += 1;
      if (block.type === "gallery") remoteReferenceCount += block.images.filter((image) => image.sourceType === "remote").length;
    }

    for (const image of collectLocalMedia(parsed.blocks)) {
      localReferenceCount += 1;
      if (!Object.hasOwn(manifest.images, image.source)) {
        errors.push(validationError(
          source,
          image.line + extracted.lineOffset,
          "ARTICLE_MEDIA_LOCAL_MANIFEST_MISSING",
          `Local article image ${image.source} is absent from ${path.relative(PROJECT_ROOT, manifestPath).split(path.sep).join("/")}.`
        ));
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    postCount: entries.length,
    localReferenceCount,
    remoteReferenceCount,
    manifestPath
  };
}
