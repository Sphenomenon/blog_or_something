import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  canonicalizeArticleMediaUrl,
  parseArticleMarkdown
} from "../src/article-media.js";

const command = "npm run verify:article-media-parser";
const reportPath = resolve(".sisyphus/evidence/article-media/parser/report.json");
const errorsPath = resolve(".sisyphus/evidence/article-media/parser/errors.json");
const validResults = [];
const invalidResults = [];

function parseValid(name, markdown) {
  const source = `fixtures/${name}.md`;
  const result = parseArticleMarkdown(markdown, { source });
  assert.deepEqual(result.errors, [], `${name} unexpectedly produced validation errors`);
  validResults.push({ name, source, blocks: result.blocks, headings: result.headings });
  return result;
}

function expectError(name, markdown, code, line) {
  const source = `fixtures/invalid/${name}.md`;
  const result = parseArticleMarkdown(markdown, { source });
  const error = result.errors.find((item) => item.code === code);
  assert.ok(error, `${name} did not produce ${code}: ${JSON.stringify(result.errors)}`);
  assert.equal(error.source, source);
  assert.equal(error.line, line);
  assert.equal(typeof error.message, "string");
  assert.ok(error.message.length > 0);
  invalidResults.push({ name, expectedCode: code, error });
}

function expectUrlError(name, value, code) {
  const source = `fixtures/invalid/${name}.md`;
  const result = canonicalizeArticleMediaUrl(value, { source, line: 4 });
  assert.equal(result.ok, false, `${name} unexpectedly accepted ${value}`);
  assert.equal(result.error.source, source);
  assert.equal(result.error.line, 4);
  assert.equal(result.error.code, code);
  assert.ok(result.error.message.length > 0);
  invalidResults.push({ name, expectedCode: code, error: result.error });
}

const standard = parseValid(
  "standard",
  "Intro paragraph.\n\n![Night market stalls](/images/uploads/taipei/night-market.jpg \"Raohe at midnight\")"
);
assert.deepEqual(standard.blocks[1], {
  type: "image",
  mode: "standard",
  focal: null,
  source: "/images/uploads/taipei/night-market.jpg",
  sourceType: "local",
  alt: "Night market stalls",
  caption: "Raohe at midnight",
  line: 3
});

const wide = parseValid(
  "wide",
  ":::image wide\n![Mountain road](https://cdn.example.test/yunnan/road.jpg \"Road into the valley\")\n:::"
);
assert.deepEqual(wide.blocks[0], {
  type: "image",
  mode: "wide",
  focal: null,
  source: "https://cdn.example.test/yunnan/road.jpg",
  sourceType: "remote",
  alt: "Mountain road",
  caption: "Road into the valley",
  line: 2,
  directiveLine: 1
});

const panoramaDefault = parseValid(
  "panorama-default",
  ":::image panorama\n![Harbour skyline](/images/uploads/hong-kong/harbour.jpg)\n:::"
);
assert.deepEqual(panoramaDefault.blocks[0].focal, { x: 50, y: 50 });
assert.equal(panoramaDefault.blocks[0].line, 2);
assert.equal(panoramaDefault.blocks[0].caption, null);

const panoramaAuthored = parseValid(
  "panorama-authored",
  ":::image panorama focal=68%,42%\n![Harbour skyline](/images/uploads/hong-kong/harbour.jpg \"Victoria Harbour\")\n:::"
);
assert.deepEqual(panoramaAuthored.blocks[0].focal, { x: 68, y: 42 });
assert.equal(panoramaAuthored.blocks[0].mode, "panorama");

const galleryTwo = parseValid(
  "gallery-two",
  ":::gallery\n![Station platform](/images/uploads/journey/platform.jpg \"Before departure\")\n\n![Train window](http://images.example.test/window.jpg)\n:::"
);
assert.equal(galleryTwo.blocks[0].type, "gallery");
assert.equal(galleryTwo.blocks[0].line, 1);
assert.deepEqual(galleryTwo.blocks[0].images.map((image) => image.line), [2, 4]);
assert.deepEqual(galleryTwo.blocks[0].images.map((image) => image.sourceType), ["local", "remote"]);

const gallerySixMarkdown = [
  ":::gallery",
  ...Array.from({ length: 6 }, (_, index) => `![Gallery item ${index + 1}](/images/uploads/gallery/item-${index + 1}.jpg${index === 0 ? " \"Opening frame\"" : ""})`),
  ":::"
].join("\n");
const gallerySix = parseValid("gallery-six", gallerySixMarkdown);
assert.equal(gallerySix.blocks[0].images.length, 6);
assert.deepEqual(gallerySix.blocks[0].images.map((image) => image.line), [2, 3, 4, 5, 6, 7]);

const nonMedia = parseValid(
  "non-media-regression",
  "## Section\n\nParagraph with **bold**, *italic*, `code`, ~~strike~~, and [link](https://example.test).\n\n> Quote\n\n- one\n- two\n\n1. first\n2. second\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n```js\nconst value = 1;\n```"
);
assert.deepEqual(nonMedia.blocks.map((block) => block.type), ["h2", "paragraph", "blockquote", "ul", "ol", "table", "code"]);
assert.deepEqual(nonMedia.headings, [{ id: "section", label: "Section" }]);

expectError("empty-alt", "![](/images/uploads/empty.jpg)", "ARTICLE_MEDIA_ALT_REQUIRED", 1);
expectError("inline-image-prose", "Before ![alt](/images/uploads/inline.jpg) after.", "ARTICLE_MEDIA_INLINE_IMAGE", 1);
expectError("nested-directive", ":::gallery\n:::image wide\n![Nested](/images/uploads/nested.jpg)\n:::\n:::", "ARTICLE_MEDIA_DIRECTIVE_NESTED", 2);
expectError("unclosed-directive", ":::image wide\n![Open](/images/uploads/open.jpg)", "ARTICLE_MEDIA_DIRECTIVE_UNCLOSED", 1);
expectError("unknown-mode", ":::image standard\n![Mode](/images/uploads/mode.jpg)\n:::", "ARTICLE_MEDIA_IMAGE_MODE", 1);
expectError("focal-on-wide", ":::image wide focal=50%,50%\n![Wide](/images/uploads/wide.jpg)\n:::", "ARTICLE_MEDIA_FOCAL_MODE", 1);
expectError("duplicate-focal", ":::image panorama focal=10%,20% focal=30%,40%\n![Duplicate](/images/uploads/duplicate.jpg)\n:::", "ARTICLE_MEDIA_FOCAL_DUPLICATE", 1);
expectError("out-of-range-focal", ":::image panorama focal=101%,20%\n![Range](/images/uploads/range.jpg)\n:::", "ARTICLE_MEDIA_FOCAL_RANGE", 1);
expectError("unknown-option", ":::image panorama crop=top\n![Option](/images/uploads/option.jpg)\n:::", "ARTICLE_MEDIA_IMAGE_OPTION", 1);
expectError("one-image-gallery", ":::gallery\n![Only](/images/uploads/only.jpg)\n:::", "ARTICLE_MEDIA_GALLERY_COUNT", 1);
expectError(
  "seven-image-gallery",
  [":::gallery", ...Array.from({ length: 7 }, (_, index) => `![Item ${index}](/images/uploads/item-${index}.jpg)`), ":::"].join("\n"),
  "ARTICLE_MEDIA_GALLERY_COUNT",
  1
);
expectError("gallery-prose", ":::gallery\n![First](/images/uploads/first.jpg)\nNot an image.\n![Second](/images/uploads/second.jpg)\n:::", "ARTICLE_MEDIA_DIRECTIVE_CONTENT", 3);
expectError("image-directive-two-images", ":::image wide\n![First](/images/uploads/first.jpg)\n![Second](/images/uploads/second.jpg)\n:::", "ARTICLE_MEDIA_IMAGE_COUNT", 1);

for (const scheme of ["data", "blob", "file", "javascript"]) {
  expectUrlError(`${scheme}-scheme`, `${scheme}:fixture`, "ARTICLE_MEDIA_URL_UNSAFE_SCHEME");
}
expectUrlError("relative-url", "images/uploads/relative.jpg", "ARTICLE_MEDIA_URL_UNSUPPORTED");
expectUrlError("protocol-relative", "//cdn.example.test/image.jpg", "ARTICLE_MEDIA_URL_PROTOCOL_RELATIVE");
expectUrlError("local-traversal", "/images/uploads/../secret.jpg", "ARTICLE_MEDIA_URL_TRAVERSAL");
expectUrlError("encoded-traversal", "/images/uploads/%2e%2e/secret.jpg", "ARTICLE_MEDIA_URL_TRAVERSAL");
expectUrlError("encoded-slash", "/images/uploads/folder%2fsecret.jpg", "ARTICLE_MEDIA_URL_ENCODED_SEPARATOR");
expectUrlError("encoded-backslash", "/images/uploads/folder%5csecret.jpg", "ARTICLE_MEDIA_URL_ENCODED_SEPARATOR");
expectUrlError("malformed-encoding", "/images/uploads/bad%2.jpg", "ARTICLE_MEDIA_URL_MALFORMED_ENCODING");
expectUrlError("local-query", "/images/uploads/image.jpg?size=large", "ARTICLE_MEDIA_URL_LOCAL_SUFFIX");
expectUrlError("local-fragment", "/images/uploads/image.jpg#detail", "ARTICLE_MEDIA_URL_LOCAL_SUFFIX");
expectUrlError("control-character", "/images/uploads/image\u0000.jpg", "ARTICLE_MEDIA_URL_CONTROL_CHARACTER");

const articleViewSource = await readFile(resolve("src/pages/ArticleView.jsx"), "utf8");
const renderInlineSource = articleViewSource.match(/function renderInline\([\s\S]*?\n}\n/)?.[0] ?? "";
assert.ok(renderInlineSource, "Could not locate renderInline in ArticleView.jsx");
assert.equal(/<\s*(?:figure|img)\b/.test(renderInlineSource), false, "renderInline must not create figure or img JSX");
assert.equal(/createElement\(\s*["'](?:figure|img)["']/.test(renderInlineSource), false, "renderInline must not create figure or img elements");
assert.equal(renderInlineSource.includes("!["), false, "renderInline must not parse Markdown images");
validResults.push({ name: "render-inline-media-isolation", source: "src/pages/ArticleView.jsx", passed: true });

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

await writeJson(reportPath, { command, passed: true, cases: validResults });
await writeJson(errorsPath, { command, passed: true, cases: invalidResults });

console.log(`PASS article-media parser verification (${validResults.length} valid checks, ${invalidResults.length} invalid checks)`);
