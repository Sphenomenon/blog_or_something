import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { dirname, resolve } from "node:path";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const command = "npm run verify:article-media-render";
const reportPath = resolve(".sisyphus/evidence/article-media/render/report.json");
const temporaryRoot = await mkdtemp(resolve(os.tmpdir(), "nocturne-article-media-render-"));
const manifestPath = resolve(temporaryRoot, "manifest.json");
const markdown = [
  "## Semantic section",
  "",
  "Paragraph with **bold**, *italic*, `code`, ~~strike~~, and [link](https://example.test).",
  "",
  "![Exact <alt> & text](/images/uploads/standard.jpg \"Plain <caption> & text\")",
  "",
  ":::image wide",
  "![Wide alt](/images/uploads/wide.jpg)",
  ":::",
  "",
  ":::image panorama focal=68%,42%",
  "![Panorama alt](https://images.example.test/panorama.jpg)",
  ":::",
  "",
  ":::gallery",
  "![Gallery first](/images/uploads/gallery/first.jpg \"Gallery first caption\")",
  "![Gallery second](https://images.example.test/gallery-second.jpg)",
  ":::",
  "",
  "> Quoted text",
  "",
  "- unordered one",
  "- unordered two",
  "",
  "1. ordered one",
  "2. ordered two",
  "",
  "| Column A | Column B |",
  "| --- | --- |",
  "| Cell A | Cell B |"
].join("\n");

const postTemplate = {
  id: "VERIFY-MEDIA-SSR",
  slug: "article-media-render-verification",
  title: "Article media render verification",
  excerpt: "Controlled in-memory article for semantic SSR verification.",
  date: "2026-07-17",
  tags: ["verification"],
  status: "VERIFIED",
  reading: "1 min",
  category: "Verification",
  sections: ["Semantic section"],
  section: "tech",
  content: markdown
};

const localSources = [
  "/images/uploads/standard.jpg",
  "/images/uploads/wide.jpg",
  "/images/uploads/gallery/first.jpg"
];
const fixtureImages = Object.fromEntries(localSources.map((source, sourceIndex) => [source, {
  width: 1600,
  height: 900,
  sourceFingerprint: `sha256:${String(sourceIndex + 1).padStart(64, "0")}`,
  variants: [480, 768, 1200, 1600].map((width) => ({
    width,
    height: Math.round(width * 9 / 16),
    src: `/images/optimized/articles/render-fixture-${sourceIndex + 1}-w${width}.webp`
  }))
}]));

await writeFile(manifestPath, `${JSON.stringify({ schemaVersion: 1, images: fixtureImages }, null, 2)}\n`, "utf8");
const previousManifestPath = process.env.ARTICLE_IMAGE_MANIFEST_PATH;
process.env.ARTICLE_IMAGE_MANIFEST_PATH = manifestPath;

const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true }
});

try {
  const { ArticleView } = await vite.ssrLoadModule("/src/pages/ArticleView.jsx");
  const { getArticleNeighbors, posts } = await vite.ssrLoadModule("/src/data/posts.js");
  const relatedPost = posts.find((candidate) => {
    if (candidate.slug === "swjtu-2026-major-group-forecast") {
      return false;
    }

    const neighbors = getArticleNeighbors(candidate.slug, candidate.section);
    return neighbors.previous && neighbors.next;
  });
  assert.ok(relatedPost, "Expected a representative article with previous and next neighbors");

  const post = {
    ...postTemplate,
    id: relatedPost.id,
    slug: relatedPost.slug,
    section: relatedPost.section
  };
  const html = renderToStaticMarkup(React.createElement(ArticleView, { post, onOpenPost: () => {} }));

  const count = (pattern) => html.match(pattern)?.length ?? 0;
  const indexOf = (text) => {
    const index = html.indexOf(text);
    assert.notEqual(index, -1, `Expected SSR markup to contain ${text}`);
    return index;
  };

  assert.equal(count(/<figure\b/g), 5);
  assert.equal(count(/<figcaption\b/g), 2);
  assert.equal(count(/data-testid="article-media-opener-\d+"/g), 5);
  assert.equal(count(/<button\b[^>]*type="button"[^>]*aria-label="Open image: /g), 5);
  assert.equal(count(/<section\b[^>]*data-testid="article-media-gallery-1"/g), 1);
  assert.equal(count(/<ul\b[^>]*class="article-gallery__list"/g), 1);
  assert.equal(count(/<li\b[^>]*data-testid="article-media-gallery-1-item-[12]"/g), 2);
  const paragraphMarkup = html.match(/<p\b[^>]*>[\s\S]*?<\/p>/g) ?? [];
  for (const paragraph of paragraphMarkup) {
    assert.equal(paragraph.includes("<figure"), false, "A figure rendered inside a paragraph");
    assert.equal(paragraph.includes('data-testid="article-media-'), false, "Article media rendered inside a paragraph");
  }

  const mediaSelectors = [
    "article-media-standard-1",
    "article-media-wide-2",
    "article-media-panorama-3",
    "article-media-gallery-4",
    "article-media-gallery-5"
  ];
  for (const selector of mediaSelectors) {
    assert.ok(html.includes(`data-testid="${selector}"`), `Missing ${selector}`);
  }

  assert.ok(html.includes('id="article-media-1"'));
  assert.ok(html.includes('id="article-media-5"'));
  assert.ok(html.includes('id="article-gallery-1"'));
  assert.ok(html.includes('aria-label="Image gallery 1"'));
  assert.ok(html.includes('data-gallery-id="article-gallery-1"'));
  assert.ok(html.includes('data-gallery-index="1"'));
  assert.ok(html.includes('data-gallery-index="2"'));
  assert.ok(html.includes('data-media-mode="panorama"'));
  assert.ok(html.includes('data-media-focal-x="68"'));
  assert.ok(html.includes('data-media-focal-y="42"'));
  assert.ok(html.includes('data-media-source-type="local"'));
  assert.ok(html.includes('data-media-source-type="remote"'));

  assert.ok(html.includes('alt="Exact &lt;alt&gt; &amp; text"'));
  assert.ok(html.includes('aria-label="Open image: Exact &lt;alt&gt; &amp; text"'));
  assert.ok(html.includes("<figcaption>Plain &lt;caption&gt; &amp; text</figcaption>"));
  assert.equal(html.includes("<figcaption>Panorama alt</figcaption>"), false);
  assert.equal(html.includes("<figcaption>Gallery second</figcaption>"), false);

  const structuralOrder = [
    "<h2 id=\"semantic-section\">",
    "data-testid=\"article-media-standard-1\"",
    "data-testid=\"article-media-wide-2\"",
    "data-testid=\"article-media-panorama-3\"",
    "data-testid=\"article-media-gallery-1\"",
    "<blockquote>",
    "<table>"
  ].map(indexOf);
  assert.deepEqual(structuralOrder, [...structuralOrder].sort((left, right) => left - right));

  assert.ok(html.includes('data-testid="toc-1"'));
  assert.ok(html.includes('data-testid="article-prev"'));
  assert.ok(html.includes('data-testid="article-next"'));
  assert.ok(/data-testid="article-related-[^"]+"/.test(html));
  assert.ok(/data-testid="article-related-panel-[^"]+"/.test(html));
  assert.ok(html.includes('data-testid="article-comments-container"'));
  assert.ok(html.includes("<blockquote>Quoted text</blockquote>"));
  assert.ok(html.includes("<ul><li>unordered one</li><li>unordered two</li></ul>"));
  assert.ok(html.includes("<ol><li>ordered one</li><li>ordered two</li></ol>"));
  assert.ok(html.includes("<table><thead>"));
  assert.equal(html.includes('data-testid="article-media-errors"'), false);

  const imageFreeHtml = renderToStaticMarkup(React.createElement(ArticleView, {
    post: { ...post, content: "## Image-free section\n\nOrdinary image-free article." },
    onOpenPost: () => {}
  }));
  assert.equal(/data-testid="article-media-(?:standard|wide|panorama|gallery|opener)-/.test(imageFreeHtml), false);
  assert.ok(imageFreeHtml.includes('data-testid="article-media-dialog"'));
  assert.equal(imageFreeHtml.includes('data-testid="article-media-dialog-image"'), false);
  assert.equal(imageFreeHtml.includes('data-testid="article-media-errors"'), false);

  const malformedHtml = renderToStaticMarkup(React.createElement(ArticleView, {
    post: { ...post, content: "Before <script>alert(1)</script> ![Unsafe](/images/uploads/unsafe.jpg) after." },
    onOpenPost: () => {}
  }));
  assert.ok(malformedHtml.includes('data-testid="article-media-errors"'));
  assert.ok(malformedHtml.includes("ARTICLE_MEDIA_INLINE_IMAGE"));
  assert.equal(malformedHtml.includes("<script>"), false);
  assert.ok(malformedHtml.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));

  const report = {
    command,
    passed: true,
    counts: {
      figures: count(/<figure\b/g),
      captions: count(/<figcaption\b/g),
      openers: count(/data-testid="article-media-opener-\d+"/g),
      galleries: count(/<section\b[^>]*data-testid="article-media-gallery-\d+"/g),
      galleryItems: count(/data-testid="article-media-gallery-\d+-item-\d+"/g)
    },
    selectors: mediaSelectors,
    ids: ["article-media-1", "article-media-2", "article-media-3", "article-media-4", "article-media-5", "article-gallery-1"],
    preserved: ["heading", "toc", "blockquote", "unordered-list", "ordered-list", "table", "navigation", "related", "comments"],
    safety: ["image-free-article", "escaped-development-errors"]
  };

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log("PASS article-media semantic render verification (5 figures, 1 gallery, 5 named openers)");
} finally {
  await vite.close();
  if (previousManifestPath === undefined) delete process.env.ARTICLE_IMAGE_MANIFEST_PATH;
  else process.env.ARTICLE_IMAGE_MANIFEST_PATH = previousManifestPath;
  await rm(temporaryRoot, { recursive: true, force: true });
}
