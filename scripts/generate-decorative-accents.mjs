import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import sharp from "sharp";

import { decorativeAccents } from "../src/data/decorative-accents.js";

const EXPECTED_ACCENT_COUNT = 10;
const OUTPUT_URL_PREFIX = "/images/optimized/third-party/scp-ambrose-dusk/";
const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const DEFAULT_SOURCE_ROOT = path.join(PROJECT_ROOT, "public/third-party/scp-ambrose-dusk");
const DEFAULT_OUTPUT_ROOT = path.join(PROJECT_ROOT, "public/images/optimized/third-party/scp-ambrose-dusk");
const REQUIRED_FIELDS = Object.freeze([
  "id",
  "sourceFilename",
  "outputFilename",
  "publicUrl",
  "surface",
  "backgroundPosition"
]);

function accentError(id, reason) {
  return new Error(`Decorative accent ${id || "<registry>"}: ${reason}`);
}

function isInside(childPath, parentPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertUnique(value, values, id, field) {
  if (values.has(value)) throw accentError(id, `duplicate ${field}: ${value}`);
  values.add(value);
}

export function validateDecorativeAccentRegistry(registry, options = {}) {
  const sourceRoot = path.resolve(options.sourceRoot ?? DEFAULT_SOURCE_ROOT);
  const outputRoot = path.resolve(options.outputRoot ?? DEFAULT_OUTPUT_ROOT);
  if (!Array.isArray(registry)) throw accentError("", "registry must be an array");
  if (registry.length !== EXPECTED_ACCENT_COUNT) {
    throw accentError("", `registry must contain exactly ${EXPECTED_ACCENT_COUNT} entries; received ${registry.length}`);
  }

  const ids = new Set();
  const sources = new Set();
  const outputs = new Set();
  return registry.map((entry, index) => {
    const id = typeof entry?.id === "string" && entry.id ? entry.id : `<entry ${index}>`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw accentError(id, "entry must be an object");
    }
    for (const field of REQUIRED_FIELDS) {
      if (typeof entry[field] !== "string" || entry[field].length === 0) {
        throw accentError(id, `required field ${field} must be a non-empty string`);
      }
    }
    if (entry.backgroundPosition !== "center center") {
      throw accentError(id, "backgroundPosition must be center center");
    }
    if (path.basename(entry.sourceFilename) !== entry.sourceFilename) {
      throw accentError(id, `sourceFilename must be a basename: ${entry.sourceFilename}`);
    }
    if (path.basename(entry.outputFilename) !== entry.outputFilename) {
      throw accentError(id, `outputFilename must be a basename: ${entry.outputFilename}`);
    }
    if (path.extname(entry.sourceFilename).toLowerCase() !== ".png") {
      throw accentError(id, `sourceFilename must use .png: ${entry.sourceFilename}`);
    }
    if (path.extname(entry.outputFilename).toLowerCase() !== ".webp") {
      throw accentError(id, `outputFilename must use .webp: ${entry.outputFilename}`);
    }
    const expectedPublicUrl = `${OUTPUT_URL_PREFIX}${entry.outputFilename}`;
    if (entry.publicUrl !== expectedPublicUrl) {
      throw accentError(id, `publicUrl must equal ${expectedPublicUrl}`);
    }

    assertUnique(entry.id, ids, id, "id");
    assertUnique(entry.sourceFilename, sources, id, "sourceFilename");
    assertUnique(entry.outputFilename, outputs, id, "outputFilename");

    const sourcePath = path.resolve(sourceRoot, entry.sourceFilename);
    const outputPath = path.resolve(outputRoot, entry.outputFilename);
    if (!isInside(sourcePath, sourceRoot) || sourcePath === sourceRoot) {
      throw accentError(id, `source path escapes source root: ${entry.sourceFilename}`);
    }
    if (!isInside(outputPath, outputRoot) || outputPath === outputRoot) {
      throw accentError(id, `output path escapes output root: ${entry.outputFilename}`);
    }
    return { entry, sourcePath, outputPath };
  });
}

async function validateSource(candidate, sourceRootReal) {
  const { entry, sourcePath } = candidate;
  let details;
  try {
    details = await lstat(sourcePath);
  } catch (error) {
    if (error.code === "ENOENT") throw accentError(entry.id, `source file is missing: ${entry.sourceFilename}`);
    throw error;
  }
  if (details.isSymbolicLink()) throw accentError(entry.id, `source file must not be a symlink: ${entry.sourceFilename}`);
  if (!details.isFile()) throw accentError(entry.id, `source path must be a regular file: ${entry.sourceFilename}`);

  const resolvedSourcePath = await realpath(sourcePath);
  if (!isInside(resolvedSourcePath, sourceRootReal) || resolvedSourcePath === sourceRootReal) {
    throw accentError(entry.id, `source file resolves outside source root: ${entry.sourceFilename}`);
  }
  const sourceBytes = await readFile(resolvedSourcePath);
  let sourceMetadata;
  try {
    sourceMetadata = await sharp(sourceBytes).metadata();
  } catch (error) {
    throw accentError(entry.id, `source metadata could not be read: ${error.message}`);
  }
  if (sourceMetadata.format !== "png") throw accentError(entry.id, `source content must be PNG; received ${sourceMetadata.format ?? "unknown"}`);
  if (!Number.isInteger(sourceMetadata.width) || sourceMetadata.width <= 0 || !Number.isInteger(sourceMetadata.height) || sourceMetadata.height <= 0) {
    throw accentError(entry.id, "source dimensions must be positive integers");
  }
  return { ...candidate, sourceBytes, sourceMetadata };
}

async function createDerivative(candidate) {
  const { entry, sourceBytes } = candidate;
  let outputBytes;
  try {
    outputBytes = await sharp(sourceBytes)
      .autoOrient()
      .resize({ width: 1920, withoutEnlargement: true })
      .webp({ quality: 80, effort: 6 })
      .toBuffer();
  } catch (error) {
    throw accentError(entry.id, `WebP generation failed: ${error.message}`);
  }
  const outputMetadata = await sharp(outputBytes).metadata();
  if (outputMetadata.format !== "webp") throw accentError(entry.id, `generated output must be WebP; received ${outputMetadata.format ?? "unknown"}`);
  if (!Number.isInteger(outputMetadata.width) || outputMetadata.width <= 0 || !Number.isInteger(outputMetadata.height) || outputMetadata.height <= 0) {
    throw accentError(entry.id, "generated WebP dimensions must be positive integers");
  }
  return { ...candidate, outputBytes, outputMetadata };
}

async function assertSafeExistingOutput(candidate) {
  try {
    const details = await lstat(candidate.outputPath);
    if (details.isSymbolicLink()) throw accentError(candidate.entry.id, `owned output must not be a symlink: ${candidate.entry.outputFilename}`);
    if (!details.isFile()) throw accentError(candidate.entry.id, `owned output must be a regular file: ${candidate.entry.outputFilename}`);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function publishIfChanged(candidate) {
  if (candidate.outputExists && (await readFile(candidate.outputPath)).equals(candidate.outputBytes)) return false;

  const temporaryPath = path.join(
    path.dirname(candidate.outputPath),
    `.${path.basename(candidate.outputPath)}.tmp-${process.pid}-${Date.now()}`
  );
  try {
    await writeFile(temporaryPath, candidate.outputBytes, { flag: "wx" });
    await rename(temporaryPath, candidate.outputPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
  return true;
}

export async function generateDecorativeAccents(options = {}) {
  const registry = options.registry ?? decorativeAccents;
  const sourceRoot = path.resolve(options.sourceRoot ?? DEFAULT_SOURCE_ROOT);
  const outputRoot = path.resolve(options.outputRoot ?? DEFAULT_OUTPUT_ROOT);
  const candidates = validateDecorativeAccentRegistry(registry, { sourceRoot, outputRoot });

  let sourceRootReal;
  try {
    sourceRootReal = await realpath(sourceRoot);
  } catch (error) {
    if (error.code === "ENOENT") throw accentError("", `source root is missing: ${sourceRoot}`);
    throw error;
  }
  const sourceRootDetails = await lstat(sourceRoot);
  if (sourceRootDetails.isSymbolicLink()) throw accentError("", `source root must not be a symlink: ${sourceRoot}`);
  if (!sourceRootDetails.isDirectory()) throw accentError("", `source root must be a directory: ${sourceRoot}`);

  const validatedSources = [];
  for (const candidate of candidates) validatedSources.push(await validateSource(candidate, sourceRootReal));

  const derivatives = [];
  for (const candidate of validatedSources) derivatives.push(await createDerivative(candidate));

  await mkdir(outputRoot, { recursive: true });
  const outputRootDetails = await lstat(outputRoot);
  if (outputRootDetails.isSymbolicLink()) throw accentError("", `output root must not be a symlink: ${outputRoot}`);
  if (!outputRootDetails.isDirectory()) throw accentError("", `output root must be a directory: ${outputRoot}`);
  const outputRootReal = await realpath(outputRoot);
  for (const derivative of derivatives) {
    if (!isInside(derivative.outputPath, outputRootReal) || derivative.outputPath === outputRootReal) {
      throw accentError(derivative.entry.id, `output path escapes resolved output root: ${derivative.entry.outputFilename}`);
    }
    derivative.outputExists = await assertSafeExistingOutput(derivative);
  }

  let writtenCount = 0;
  for (const derivative of derivatives) {
    if (await publishIfChanged(derivative)) writtenCount += 1;
  }
  return {
    sourceCount: validatedSources.length,
    ownedOutputCount: derivatives.length,
    writtenCount,
    unchangedCount: derivatives.length - writtenCount,
    sourceRoot,
    outputRoot
  };
}

async function main() {
  try {
    const result = await generateDecorativeAccents();
    console.log(
      `PASS decorative accents: ${result.sourceCount} sources / ${result.ownedOutputCount} owned outputs ` +
      `(${result.writtenCount} written, ${result.unchangedCount} unchanged).`
    );
  } catch (error) {
    console.error(`FAIL decorative accents: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
