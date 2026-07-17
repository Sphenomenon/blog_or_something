export function assertArticleMediaManifest(manifest, manifestPath = "<article media manifest>") {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error(`ARTICLE_MEDIA_MANIFEST_INVALID: Expected an object at ${manifestPath}`);
  }
  if (manifest.schemaVersion !== 1 || !manifest.images || typeof manifest.images !== "object" || Array.isArray(manifest.images)) {
    throw new Error(`ARTICLE_MEDIA_MANIFEST_INVALID: Expected schemaVersion 1 and an images object at ${manifestPath}`);
  }

  for (const [source, record] of Object.entries(manifest.images)) {
    if (!source.startsWith("/images/uploads/") || !record || typeof record !== "object" || Array.isArray(record)) {
      throw new Error(`ARTICLE_MEDIA_MANIFEST_INVALID: Invalid image record for ${source} in ${manifestPath}`);
    }
    if (!Number.isInteger(record.width) || record.width <= 0 || !Number.isInteger(record.height) || record.height <= 0 ||
        typeof record.sourceFingerprint !== "string" || !/^sha256:[0-9a-f]{64}$/.test(record.sourceFingerprint) ||
        !Array.isArray(record.variants) || record.variants.length === 0) {
      throw new Error(`ARTICLE_MEDIA_MANIFEST_INVALID: Invalid dimensions, fingerprint, or variants for ${source} in ${manifestPath}`);
    }

    const widths = new Set();
    for (const variant of record.variants) {
      if (!variant || typeof variant !== "object" || !Number.isInteger(variant.width) || variant.width <= 0 ||
          !Number.isInteger(variant.height) || variant.height <= 0 || typeof variant.src !== "string" ||
          !variant.src.startsWith("/images/optimized/articles/") || widths.has(variant.width)) {
        throw new Error(`ARTICLE_MEDIA_MANIFEST_INVALID: Invalid variant for ${source} in ${manifestPath}`);
      }
      widths.add(variant.width);
    }
  }

  return manifest;
}
