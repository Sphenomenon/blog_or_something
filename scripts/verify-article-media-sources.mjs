import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const EVIDENCE_PATH = path.join(PROJECT_ROOT, ".sisyphus/evidence/article-media/sources/report.json");
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "nocturne-article-media-sources-"));
const manifestPath = path.join(temporaryRoot, "manifest.json");
const localSources = {
  standard: "/images/uploads/verify/standard.jpg",
  wide: "/images/uploads/verify/wide.jpg",
  panorama: "/images/uploads/verify/panorama.jpg",
  gallery: "/images/uploads/verify/gallery.jpg"
};
const remoteSource = "https://images.example.test/remote.jpg";

function record(sourceIndex, width, height, candidates) {
  return {
    width,
    height,
    sourceFingerprint: `sha256:${String(sourceIndex).padStart(64, "0")}`,
    variants: candidates.map((candidateWidth) => ({
      width: candidateWidth,
      height: Math.round(candidateWidth * height / width),
      src: `/images/optimized/articles/source-fixture-${sourceIndex}-w${candidateWidth}.webp`
    }))
  };
}

const manifest = {
  schemaVersion: 1,
  images: {
    [localSources.standard]: record(1, 1600, 900, [1200, 480, 1600, 768]),
    [localSources.wide]: record(2, 720, 1080, [720, 480]),
    [localSources.panorama]: record(3, 2400, 1350, [1920, 480, 1200, 768, 1600]),
    [localSources.gallery]: record(4, 960, 640, [960, 480, 768])
  }
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
const previousManifestPath = process.env.ARTICLE_IMAGE_MANIFEST_PATH;
process.env.ARTICLE_IMAGE_MANIFEST_PATH = manifestPath;

const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  mode: "verification",
  server: { middlewareMode: true }
});

function imageNode(source, sourceType, mode, line, alt) {
  return {
    source,
    sourceType,
    mode,
    line,
    articleSource: "scripts/fixtures/article-images/markdown/source-resolution.md",
    alt,
    caption: null,
    focal: mode === "panorama" ? { x: 73, y: 31 } : null
  };
}

function attribute(markup, name) {
  return markup.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
}

try {
  const {
    ARTICLE_IMAGE_GALLERY_SIZES,
    ARTICLE_IMAGE_STANDARD_SIZES,
    ARTICLE_IMAGE_WIDE_SIZES,
    resolveArticleImage
  } = await vite.ssrLoadModule("/src/article-image-resolver.js");
  const { ArticleMediaFigure } = await vite.ssrLoadModule("/src/components/ArticleMedia.jsx");

  const cases = [
    { name: "standard", mode: "standard", source: localSources.standard, sizes: ARTICLE_IMAGE_STANDARD_SIZES, order: 1 },
    { name: "wide", mode: "wide", source: localSources.wide, sizes: ARTICLE_IMAGE_WIDE_SIZES, order: 2 },
    { name: "panorama", mode: "panorama", source: localSources.panorama, sizes: ARTICLE_IMAGE_WIDE_SIZES, order: 3 },
    { name: "gallery", mode: "gallery", source: localSources.gallery, sizes: ARTICLE_IMAGE_GALLERY_SIZES, order: 4 }
  ];
  const results = [];

  for (const fixture of cases) {
    const image = imageNode(fixture.source, "local", fixture.mode, fixture.order + 6, `${fixture.name} alt`);
    const resolved = resolveArticleImage(image);
    const markup = renderToStaticMarkup(React.createElement(ArticleMediaFigure, {
      image,
      mediaOrder: fixture.order
    }));
    const expectedVariants = [...manifest.images[fixture.source].variants].sort((left, right) => left.width - right.width);
    const expectedSrcSet = expectedVariants.map((variant) => `${variant.src} ${variant.width}w`).join(", ");
    const expectedFullSource = expectedVariants.at(-1).src;

    assert.equal(resolved.src, expectedFullSource);
    assert.equal(resolved.srcSet, expectedSrcSet);
    assert.equal(resolved.sizes, fixture.sizes);
    assert.equal(resolved.fullSource, expectedFullSource);
    assert.equal(attribute(markup, "src"), expectedFullSource);
    assert.equal(attribute(markup, "srcSet"), expectedSrcSet);
    assert.equal(attribute(markup, "sizes"), fixture.sizes);
    assert.equal(Number(attribute(markup, "width")), manifest.images[fixture.source].width);
    assert.equal(Number(attribute(markup, "height")), manifest.images[fixture.source].height);
    assert.ok(Number(attribute(markup, "width")) > 0 && Number(attribute(markup, "height")) > 0);
    assert.equal(attribute(markup, "loading"), "lazy");
    assert.equal(attribute(markup, "decoding"), "async");
    assert.equal(attribute(markup, "data-media-full-source"), expectedFullSource);
    assert.equal(markup.match(/<img\b/g)?.length, 1);
    assert.equal(markup.includes("<link"), false);
    assert.deepEqual(expectedVariants.map((variant) => variant.width), [...expectedVariants.map((variant) => variant.width)].sort((left, right) => left - right));

    results.push({
      mode: fixture.mode,
      src: expectedFullSource,
      srcset: expectedSrcSet,
      sizes: fixture.sizes,
      width: manifest.images[fixture.source].width,
      height: manifest.images[fixture.source].height,
      fullSource: expectedFullSource
    });
  }

  const remoteImage = imageNode(remoteSource, "remote", "standard", 17, "remote alt");
  const remoteMarkup = renderToStaticMarkup(React.createElement(ArticleMediaFigure, {
    image: remoteImage,
    mediaOrder: 5
  }));
  assert.equal(attribute(remoteMarkup, "src"), remoteSource);
  assert.equal(attribute(remoteMarkup, "srcSet"), undefined);
  assert.equal(attribute(remoteMarkup, "sizes"), undefined);
  assert.equal(attribute(remoteMarkup, "width"), undefined);
  assert.equal(attribute(remoteMarkup, "height"), undefined);
  assert.equal(attribute(remoteMarkup, "loading"), "lazy");
  assert.equal(attribute(remoteMarkup, "decoding"), "async");
  assert.equal(attribute(remoteMarkup, "data-media-full-source"), remoteSource);
  assert.equal(remoteMarkup.match(/<img\b/g)?.length, 1);
  assert.equal(remoteMarkup.includes("<link"), false);

  const missingImage = imageNode(
    "/images/uploads/verify/missing.jpg",
    "local",
    "standard",
    23,
    "missing alt"
  );
  assert.throws(
    () => resolveArticleImage(missingImage),
    (error) => error?.code === "ARTICLE_MEDIA_MANIFEST_MISSING" &&
      error.source === "scripts/fixtures/article-images/markdown/source-resolution.md" &&
      error.line === 23 &&
      error.message.includes("/images/uploads/verify/missing.jpg") &&
      error.message.includes("source-resolution.md:23")
  );

  const report = {
    command: "npm run verify:article-media-sources",
    passed: true,
    manifestPathMode: "ARTICLE_IMAGE_MANIFEST_PATH with Vite verification mode",
    sizes: {
      standard: ARTICLE_IMAGE_STANDARD_SIZES,
      wide: ARTICLE_IMAGE_WIDE_SIZES,
      panorama: ARTICLE_IMAGE_WIDE_SIZES,
      gallery: ARTICLE_IMAGE_GALLERY_SIZES
    },
    local: results,
    remote: {
      src: remoteSource,
      loading: "lazy",
      decoding: "async",
      generatedAttributesAbsent: ["srcset", "sizes", "width", "height"]
    },
    missingLocal: {
      code: "ARTICLE_MEDIA_MANIFEST_MISSING",
      source: missingImage.articleSource,
      line: missingImage.line,
      rawFallback: false
    },
    hiddenOrPrefetchedImages: 0
  };

  await mkdir(path.dirname(EVIDENCE_PATH), { recursive: true });
  await writeFile(EVIDENCE_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log("PASS article media source resolution (4 local modes, remote boundary, missing-local diagnostic)");
} finally {
  await vite.close();
  if (previousManifestPath === undefined) delete process.env.ARTICLE_IMAGE_MANIFEST_PATH;
  else process.env.ARTICLE_IMAGE_MANIFEST_PATH = previousManifestPath;
  await rm(temporaryRoot, { recursive: true, force: true });
}
