import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { canonicalizeArticleMediaUrl } from "../src/article-media.js";

export const ARTICLE_MEDIA_MANIFEST_VERSION = 1;
export const ARTICLE_MEDIA_WIDTHS = Object.freeze([480, 768, 1200, 1600, 1920]);
// Output paths use SHA-256(canonical source URL)[:12]/SHA-256(source bytes)[:16]-w<width>.webp.
export const ARTICLE_MEDIA_PATH_HASH_LENGTH = 12;
export const ARTICLE_MEDIA_CONTENT_HASH_LENGTH = 16;

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const DEFAULT_SOURCE_ROOT = path.join(PROJECT_ROOT, "public/images/uploads");
const DEFAULT_OUTPUT_ROOT = path.join(PROJECT_ROOT, "public/images/optimized/articles");
const DEFAULT_MANIFEST_PATH = path.join(DEFAULT_OUTPUT_ROOT, "manifest.json");
const SOURCE_URL_PREFIX = "/images/uploads/";
const OUTPUT_URL_PREFIX = "/images/optimized/articles/";
const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function encodePathSegments(value) {
  return value.split(path.sep).map((segment) => encodeURIComponent(segment)).join("/");
}

function isInside(childPath, parentPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function articleMediaError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function assertNoSymlinkSegments(filePath, rootPath) {
  if (!isInside(filePath, rootPath)) {
    throw articleMediaError("ARTICLE_MEDIA_SOURCE_OUTSIDE_ROOT", `Article image source resolves outside source root: ${filePath}`);
  }
  const relative = path.relative(rootPath, filePath);
  let current = rootPath;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if ((await lstat(current)).isSymbolicLink()) {
      throw articleMediaError("ARTICLE_MEDIA_SOURCE_SYMLINK", `Article image sources must not use symlinks: ${current}`);
    }
  }
}

async function validateSourcePath(filePath, sourceRootReal) {
  await assertNoSymlinkSegments(filePath, sourceRootReal);
  const resolved = await realpath(filePath);
  if (!isInside(resolved, sourceRootReal)) {
    throw articleMediaError("ARTICLE_MEDIA_SOURCE_OUTSIDE_ROOT", `Article image source resolves outside source root: ${filePath}`);
  }
  if (!(await stat(resolved)).isFile()) {
    throw articleMediaError("ARTICLE_MEDIA_SOURCE_NOT_FILE", `Article image source is not a file: ${filePath}`);
  }
  return resolved;
}

async function discoverSourceFiles(directoryPath, sourceRootReal) {
  const files = [];
  const entries = await readdir(directoryPath, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right));
  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isSymbolicLink()) {
      throw articleMediaError("ARTICLE_MEDIA_SOURCE_SYMLINK", `Article image sources must not use symlinks: ${entryPath}`);
    }
    if (entry.isDirectory()) files.push(...await discoverSourceFiles(entryPath, sourceRootReal));
    else if (entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(await validateSourcePath(entryPath, sourceRootReal));
    }
  }
  return files;
}

function canonicalUrlForSource(filePath, sourceRootReal) {
  const relativePath = encodePathSegments(path.relative(sourceRootReal, filePath));
  const canonical = canonicalizeArticleMediaUrl(`${SOURCE_URL_PREFIX}${relativePath}`, { source: filePath });
  if (!canonical.ok || canonical.sourceType !== "local") {
    throw articleMediaError("ARTICLE_MEDIA_SOURCE_URL_INVALID", canonical.error?.message ?? `Unsupported article image source: ${filePath}`);
  }
  return canonical.source;
}

async function resolveReferencedSources(sourceUrls, sourceRootReal) {
  const files = [];
  for (const sourceUrl of sourceUrls) {
    const canonical = canonicalizeArticleMediaUrl(sourceUrl, { source: "article media asset generator" });
    if (!canonical.ok || canonical.sourceType !== "local") {
      throw articleMediaError("ARTICLE_MEDIA_SOURCE_URL_INVALID", canonical.error?.message ?? `Unsupported article image URL: ${sourceUrl}`);
    }
    const relativeUrl = canonical.source.slice(SOURCE_URL_PREFIX.length);
    if (!SUPPORTED_EXTENSIONS.has(path.posix.extname(relativeUrl).toLowerCase())) {
      throw articleMediaError("ARTICLE_MEDIA_SOURCE_FORMAT_UNSUPPORTED", `Unsupported article image format: ${canonical.source}`);
    }
    const decodedSegments = relativeUrl.split("/").map((segment) => decodeURIComponent(segment));
    const candidatePath = path.resolve(sourceRootReal, ...decodedSegments);
    files.push(await validateSourcePath(candidatePath, sourceRootReal));
  }
  return [...new Set(files)].sort((left, right) => left.localeCompare(right));
}

function candidateWidths(sourceWidth) {
  const widths = ARTICLE_MEDIA_WIDTHS.filter((width) => width <= sourceWidth);
  if (sourceWidth < 1920) widths.push(sourceWidth);
  return [...new Set(widths)].sort((left, right) => left - right);
}

async function writeFileIfChanged(filePath, bytes) {
  try {
    if ((await readFile(filePath)).equals(bytes)) return false;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
  return true;
}

async function readPreviousManifest(manifestPath) {
  try {
    const value = JSON.parse(await readFile(manifestPath, "utf8"));
    if (value.schemaVersion !== ARTICLE_MEDIA_MANIFEST_VERSION || typeof value.images !== "object" || value.images === null) {
      throw articleMediaError("ARTICLE_MEDIA_MANIFEST_INVALID", `Unsupported article media manifest at ${manifestPath}`);
    }
    return value;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function collectOwnedVariantUrls(manifest) {
  const urls = new Set();
  for (const record of Object.values(manifest?.images ?? {})) {
    for (const variant of record?.variants ?? []) {
      if (typeof variant.src === "string") urls.add(variant.src);
    }
  }
  return urls;
}

async function deleteStaleOwnedVariants(previousManifest, nextManifest, outputRootReal) {
  const nextUrls = collectOwnedVariantUrls(nextManifest);
  let deleted = 0;
  for (const variantUrl of collectOwnedVariantUrls(previousManifest)) {
    if (nextUrls.has(variantUrl)) continue;
    if (!variantUrl.startsWith(OUTPUT_URL_PREFIX)) {
      throw articleMediaError("ARTICLE_MEDIA_MANIFEST_UNSAFE_PATH", `Prior manifest owns an unsafe derivative URL: ${variantUrl}`);
    }
    const filePath = path.resolve(outputRootReal, ...variantUrl.slice(OUTPUT_URL_PREFIX.length).split("/"));
    if (!isInside(filePath, outputRootReal) || filePath === outputRootReal) {
      throw articleMediaError("ARTICLE_MEDIA_MANIFEST_UNSAFE_PATH", `Prior manifest derivative escapes article namespace: ${variantUrl}`);
    }
    try {
      const details = await lstat(filePath);
      if (details.isSymbolicLink() || !details.isFile()) {
        throw articleMediaError("ARTICLE_MEDIA_MANIFEST_UNSAFE_PATH", `Prior manifest derivative is not a safe file: ${variantUrl}`);
      }
      await unlink(filePath);
      deleted += 1;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return deleted;
}

async function publishManifestAtomically(manifestPath, bytes) {
  try {
    if ((await readFile(manifestPath)).equals(bytes)) return false;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await mkdir(path.dirname(manifestPath), { recursive: true });
  const temporaryPath = `${manifestPath}.tmp-${process.pid}-${Date.now()}`;
  try {
    await writeFile(temporaryPath, bytes);
    await rename(temporaryPath, manifestPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
  return true;
}

export async function generateArticleMediaAssets(options = {}) {
  const sourceRoot = path.resolve(options.sourceRoot ?? DEFAULT_SOURCE_ROOT);
  const outputRoot = path.resolve(options.outputRoot ?? DEFAULT_OUTPUT_ROOT);
  const manifestPath = path.resolve(options.manifestPath ?? DEFAULT_MANIFEST_PATH);
  await mkdir(sourceRoot, { recursive: true });
  await mkdir(outputRoot, { recursive: true });
  const sourceRootReal = await realpath(sourceRoot);
  const outputRootReal = await realpath(outputRoot);
  if (!isInside(manifestPath, outputRootReal)) {
    throw articleMediaError("ARTICLE_MEDIA_MANIFEST_OUTSIDE_NAMESPACE", `Manifest must stay inside article output namespace: ${manifestPath}`);
  }

  const sourceFiles = options.sourceUrls
    ? await resolveReferencedSources(options.sourceUrls, sourceRootReal)
    : await discoverSourceFiles(sourceRootReal, sourceRootReal);
  const previousManifest = await readPreviousManifest(manifestPath);
  const images = {};
  let writtenVariants = 0;

  for (const sourcePath of sourceFiles) {
    const sourceBytes = await readFile(sourcePath);
    const sourceHash = sha256(sourceBytes);
    const canonicalUrl = canonicalUrlForSource(sourcePath, sourceRootReal);
    const pathHash = sha256(canonicalUrl).slice(0, ARTICLE_MEDIA_PATH_HASH_LENGTH);
    const contentHash = sourceHash.slice(0, ARTICLE_MEDIA_CONTENT_HASH_LENGTH);
    const metadata = await sharp(sourceBytes, { animated: true }).metadata();
    if (metadata.pages && metadata.pages > 1) {
      throw articleMediaError("ARTICLE_MEDIA_SOURCE_FORMAT_UNSUPPORTED", `Animated WebP is not supported: ${canonicalUrl}`);
    }
    const oriented = metadata.autoOrient ?? { width: metadata.width, height: metadata.height };
    if (!oriented.width || !oriented.height) {
      throw articleMediaError("ARTICLE_MEDIA_SOURCE_DIMENSIONS_INVALID", `Could not determine article image dimensions: ${canonicalUrl}`);
    }

    const variants = [];
    for (const width of candidateWidths(oriented.width)) {
      const variantRelativePath = `${pathHash}/${contentHash}-w${width}.webp`;
      const variantPath = path.join(outputRootReal, ...variantRelativePath.split("/"));
      const variantBytes = await sharp(sourceBytes)
        .autoOrient()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 80, effort: 6 })
        .toBuffer();
      if (await writeFileIfChanged(variantPath, variantBytes)) writtenVariants += 1;
      const variantMetadata = await sharp(variantBytes).metadata();
      variants.push({ width: variantMetadata.width, height: variantMetadata.height, src: `${OUTPUT_URL_PREFIX}${variantRelativePath}` });
    }
    images[canonicalUrl] = {
      width: oriented.width,
      height: oriented.height,
      sourceFingerprint: `sha256:${sourceHash}`,
      variants
    };
  }

  const manifest = {
    schemaVersion: ARTICLE_MEDIA_MANIFEST_VERSION,
    images: Object.fromEntries(Object.entries(images).sort(([left], [right]) => left.localeCompare(right)))
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const manifestWritten = await publishManifestAtomically(manifestPath, manifestBytes);
  const deletedVariants = await deleteStaleOwnedVariants(previousManifest, manifest, outputRootReal);
  return { manifest, sourceCount: sourceFiles.length, writtenVariants, deletedVariants, manifestWritten, sourceRoot, outputRoot, manifestPath };
}
