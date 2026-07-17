import articleImageManifest from "virtual:article-image-manifest";

export const ARTICLE_IMAGE_STANDARD_SIZES = "(max-width: 430px) calc(100vw - 4.2rem), (max-width: 768px) calc(100vw - 4.6rem), (min-width: 1500px) 980px, (min-width: 1181px) 880px, calc(100vw - 8rem)";
export const ARTICLE_IMAGE_WIDE_SIZES = "(max-width: 430px) calc(100vw - 4.2rem), (max-width: 768px) calc(100vw - 4.6rem), (min-width: 1500px) 1028px, (min-width: 1181px) 928px, calc(100vw - 8rem)";
export const ARTICLE_IMAGE_GALLERY_SIZES = "(max-width: 430px) calc(100vw - 4.2rem), (max-width: 767px) calc(100vw - 4.6rem), (min-width: 1500px) 506px, (min-width: 1181px) 456px, calc((100vw - 8rem - 0.9rem) / 2)";

function createResolutionError(image, code, message) {
  const error = new Error(`${image.articleSource ?? "<article>"}:${image.line ?? 1} ${code}: ${message}`);
  error.code = code;
  error.source = image.articleSource ?? "<article>";
  error.line = image.line ?? 1;
  return error;
}

function sizesForMode(mode) {
  if (mode === "gallery") {
    return ARTICLE_IMAGE_GALLERY_SIZES;
  }

  if (mode === "wide" || mode === "panorama") {
    return ARTICLE_IMAGE_WIDE_SIZES;
  }

  return ARTICLE_IMAGE_STANDARD_SIZES;
}

function validateRecord(image, record) {
  if (!record || typeof record !== "object" || !Number.isInteger(record.width) || record.width <= 0 ||
      !Number.isInteger(record.height) || record.height <= 0 || !Array.isArray(record.variants) ||
      record.variants.length === 0) {
    throw createResolutionError(
      image,
      "ARTICLE_MEDIA_MANIFEST_RECORD_INVALID",
      `Manifest record for ${image.source} is missing positive dimensions or generated variants.`
    );
  }

  const variants = record.variants.map((variant) => {
    if (!variant || !Number.isInteger(variant.width) || variant.width <= 0 ||
        !Number.isInteger(variant.height) || variant.height <= 0 ||
        typeof variant.src !== "string" || !variant.src.startsWith("/images/optimized/articles/")) {
      throw createResolutionError(
        image,
        "ARTICLE_MEDIA_MANIFEST_RECORD_INVALID",
        `Manifest record for ${image.source} contains an invalid generated variant.`
      );
    }

    return variant;
  }).sort((left, right) => left.width - right.width);

  for (let index = 1; index < variants.length; index += 1) {
    if (variants[index - 1].width === variants[index].width) {
      throw createResolutionError(
        image,
        "ARTICLE_MEDIA_MANIFEST_RECORD_INVALID",
        `Manifest record for ${image.source} contains duplicate candidate width ${variants[index].width}.`
      );
    }
  }

  return variants;
}

export function resolveArticleImage(image) {
  if (image.sourceType === "remote") {
    return {
      src: image.source,
      srcSet: undefined,
      sizes: undefined,
      width: undefined,
      height: undefined,
      loading: "lazy",
      decoding: "async",
      fullSource: image.source
    };
  }

  if (image.sourceType !== "local") {
    throw createResolutionError(
      image,
      "ARTICLE_MEDIA_SOURCE_TYPE_INVALID",
      `Unsupported parser-classified source type for ${image.source}.`
    );
  }

  const record = articleImageManifest.images[image.source];
  if (!record) {
    throw createResolutionError(
      image,
      "ARTICLE_MEDIA_MANIFEST_MISSING",
      `No generated article image record exists for ${image.source}. Run the article media asset generator before validation or build.`
    );
  }

  const variants = validateRecord(image, record);
  const fallback = variants.at(-1);

  return {
    src: fallback.src,
    srcSet: variants.map((variant) => `${variant.src} ${variant.width}w`).join(", "),
    sizes: sizesForMode(image.mode),
    width: record.width,
    height: record.height,
    loading: "lazy",
    decoding: "async",
    fullSource: fallback.src
  };
}
