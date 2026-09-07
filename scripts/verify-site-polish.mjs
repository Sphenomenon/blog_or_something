import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
import { parseArticleMarkdown } from "../src/article-media.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const evidence = fileURLToPath(new URL("../.sisyphus/evidence/site-polish/", import.meta.url));
const widths = [375, 390, 768, 1024, 1440];
const pageErrors = [];
const measurements = [];
await mkdir(evidence, { recursive: true });
const server = await createServer({ root, logLevel: "error", server: { host: "127.0.0.1", port: 0 } });
let browser;

try {
  await server.listen();
  const origin = server.resolvedUrls.local[0].replace(/\/$/, "");
  const { sortedPosts, getArchiveYears, getArchivePostsByYear } = await server.ssrLoadModule("/src/data/posts.js");
  const { sections } = await server.ssrLoadModule("/src/data/sections.js");
  const { friendLinks } = await server.ssrLoadModule("/src/data/links.js");
  const newestPublished = sortedPosts.find((post) => post.status.trim().toLowerCase() === "published");
  const article = sortedPosts.find((post) => parseArticleMarkdown(post.content).blocks.some((block) => block.type === "code"));
  assert.ok(article && newestPublished, "Real published and code-containing articles are required");
  const codeBlocks = parseArticleMarkdown(article.content).blocks.filter((block) => block.type === "code");
  const years = getArchiveYears();
  browser = await chromium.launch({ headless: true });

  async function ready(page, selector) {
    await page.locator(selector).first().waitFor({ state: "visible" });
    await page.waitForFunction(() => document.querySelector(".route-stage")?.dataset.transitionState === "idle");
    await page.evaluate(() => document.fonts.ready);
  }

  async function noOverflow(page, label) {
    const size = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    measurements.push({ label, ...size });
    assert.ok(size.document <= size.viewport + 1, `${label}: no horizontal overflow`);
  }

  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    await context.addInitScript((localOrigin) => {
      if (location.origin !== localOrigin) return;
      sessionStorage.setItem("nocturne:greeting-dismissed", "true");
      // Assert exact clipboard payloads, including permission-denied behavior, offline.
      window.polishCopiedText = null;
      window.polishRejectCopy = false;
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
        async writeText(text) {
          if (window.polishRejectCopy) throw new DOMException("Denied", "NotAllowedError");
          window.polishCopiedText = text;
        }
      } });
    }, origin);
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin === origin || ["data:", "blob:"].includes(url.protocol)) return route.continue();
      return route.fulfill({ status: 200, contentType: route.request().resourceType() === "script"
        ? "application/javascript" : "text/plain", body: "" });
    });
    context.on("page", (page) => page.on("pageerror", (error) => pageErrors.push(error.message)));
    const page = await context.newPage();

    await page.goto(origin);
    await ready(page, ".home-latest");
    assert.equal(await page.getByTestId("home-latest-post").getAttribute("href"), `/posts/${newestPublished.slug}`);
    assert.equal(await page.locator(".archive-card").count(), sortedPosts.length, "Latest entry does not remove or duplicate index cards");
    const latest = await page.getByTestId("home-latest-post").boundingBox();
    const hero = await page.getByTestId("home-hero-title").boundingBox();
    if (width > 780) assert.ok(latest.x > hero.x + hero.width, "Desktop latest article uses the empty right-hand column");
    else assert.ok(latest.y + latest.height < 600, "Mobile latest article is readable on the first screen");
    await noOverflow(page, `home-${width}`);
    await page.screenshot({ path: `${evidence}home-${width}.png` });
    await page.getByTestId("home-latest-post").click();
    await ready(page, "article.prose");
    assert.equal(new URL(page.url()).pathname, `/posts/${newestPublished.slug}`);

    await page.goto(`${origin}/archive`);
    await ready(page, ".archive-ledger");
    for (const [index, year] of years.entries()) {
      await page.getByTestId(`archive-select-year-${year}`).click();
      assert.equal(await page.getByTestId(`archive-select-year-${year}`).getAttribute("aria-pressed"), "true");
      assert.equal(await page.getByTestId("archive-year-label").innerText(), year);
      assert.equal(await page.getByTestId("archive-year-prev").isDisabled(), index === 0);
      assert.equal(await page.getByTestId("archive-year-next").isDisabled(), index === years.length - 1);
      const expected = getArchivePostsByYear(year);
      assert.deepEqual(await page.locator(".archive-entry").evaluateAll((links) => links.map((link) => ({
        href: link.getAttribute("href"), date: link.querySelector("time").dateTime
      }))), expected.map((post) => ({ href: `/posts/${post.slug}`, date: post.date })));
      const expectedMonths = [...new Set(expected.map((post) => post.date.slice(5, 7)))];
      assert.deepEqual(await page.locator(".archive-month > h3 > span").allTextContents(), expectedMonths);
      assert.equal(await page.locator(".archive-month ol > li").count(), expected.length);
    }
    // Year buttons and next/previous paging must remain in sync.
    await page.getByTestId(`archive-select-year-${years[0]}`).click();
    if (years.length > 1) {
      await page.getByTestId("archive-year-next").click();
      assert.equal(await page.getByTestId("archive-year-label").innerText(), years[1]);
      await page.getByTestId("archive-year-prev").click();
      assert.equal(await page.getByTestId("archive-year-label").innerText(), years[0]);
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await noOverflow(page, `archive-${width}`);
    if (width <= 780) assert.ok((await page.locator(".archive-pagination").boundingBox()).height < 90, "Mobile year paging stays in one compact row");
    await page.screenshot({ path: `${evidence}archive-${width}.png`, fullPage: true });
    const archiveLink = page.locator(".archive-entry").first();
    if (width === 1440) {
      const href = await archiveLink.getAttribute("href");
      const [newTab] = await Promise.all([context.waitForEvent("page"), archiveLink.click({ modifiers: ["Control"] })]);
      await newTab.waitForURL(`${origin}${href}`);
      assert.equal(new URL(page.url()).pathname, "/archive", "Ctrl-click preserves the archive tab");
      await newTab.close();
    }
    await archiveLink.click();
    await ready(page, "article.prose");

    await page.goto(`${origin}/posts/${article.slug}?source=test`);
    await ready(page, ".article-code-block");
    assert.equal(await page.getByTestId("article-code-block").count(), codeBlocks.length);
    const codeBlock = page.getByTestId("article-code-block").first();
    assert.equal(await codeBlock.locator("code").textContent(), codeBlocks[0].code);
    await codeBlock.getByRole("button", { name: "复制代码", exact: true }).click();
    assert.equal(await page.evaluate(() => window.polishCopiedText), codeBlocks[0].code);
    assert.match(await codeBlock.getByRole("status").innerText(), /成功/);
    await page.evaluate(() => { window.polishRejectCopy = true; });
    await codeBlock.getByRole("button", { name: "复制代码", exact: true }).click();
    assert.equal(await page.evaluate(() => window.getSelection().toString()), codeBlocks[0].code);
    assert.match(await codeBlock.getByRole("status").innerText(), /未能复制/);
    assert.equal(await codeBlock.locator("pre").evaluate((el) => el === document.activeElement), true);
    if (width === 375) {
      await page.evaluate(() => { Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined }); });
      await codeBlock.getByRole("button", { name: "复制代码", exact: true }).click();
      assert.equal(await page.evaluate(() => window.getSelection().toString()), codeBlocks[0].code, "No Clipboard API also falls back to manual selection");
      await page.evaluate(() => { Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
        async writeText(text) {
          if (window.polishRejectCopy) throw new DOMException("Denied", "NotAllowedError");
          window.polishCopiedText = text;
        }
      } }); });
    }
    await codeBlock.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${evidence}code-${width}.png` });

    const endnote = page.getByTestId("article-endnote");
    await page.evaluate(() => { window.polishRejectCopy = false; });
    await endnote.getByRole("button", { name: "复制文章链接", exact: true }).click();
    assert.equal(await page.evaluate(() => window.polishCopiedText), `${origin}/posts/${article.slug}`, "Shared article URL omits tracking/search parameters");
    await page.evaluate(() => { window.polishRejectCopy = true; });
    await endnote.getByRole("button", { name: "复制文章链接", exact: true }).click();
    const manual = endnote.getByRole("textbox");
    assert.equal(await manual.inputValue(), `${origin}/posts/${article.slug}`);
    assert.equal(await manual.evaluate((el) => el === document.activeElement && el.selectionStart === 0 && el.selectionEnd === el.value.length), true);
    await page.waitForFunction(() => document.querySelector(".back-to-top__progress")?.getAttribute("aria-valuenow") === "100");
    assert.equal(await page.locator(".back-to-top__progress").getAttribute("aria-label"), "正文阅读进度");
    await noOverflow(page, `article-${width}`);
    await page.screenshot({ path: `${evidence}article-end-${width}.png` });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForFunction(() => document.querySelector(".back-to-top__progress")?.getAttribute("aria-valuenow") === "0");

    await page.goto(`${origin}/sections/links`);
    await ready(page, ".friend-link-card");
    assert.equal(await page.locator(".friend-link-card").count(), friendLinks.length);
    for (const link of await page.locator(".friend-link-card").all()) {
      assert.equal(await link.getAttribute("target"), "_blank");
      assert.match(await link.getAttribute("rel"), /noopener/);
      assert.equal(await link.locator(".friend-link-domain").innerText(), new URL(await link.getAttribute("href")).hostname.replace(/^www\./, ""));
    }
    const first = page.locator(".friend-link-card").first();
    await first.locator("img").evaluate((img) => img.dispatchEvent(new Event("error")));
    assert.equal(await first.locator("img").count(), 0, "A failed logo is removed, without a broken-image icon");
    assert.ok((await first.locator(".friend-link-initial").innerText()).length > 0);
    await noOverflow(page, `links-${width}`);
    await page.screenshot({ path: `${evidence}links-${width}.png`, fullPage: true });

    if (width === 1440) {
      for (const section of sections.filter((item) => item.slug !== "links")) {
        await page.goto(`${origin}/sections/${section.slug}`);
        await ready(page, ".section-hero");
        const count = sortedPosts.filter((post) => post.section === section.slug).length;
        const toggle = page.getByTestId(`section-all-posts-${section.slug}`);
        assert.equal(await toggle.count(), count > 3 ? 1 : 0, "Only a truncated list offers an expand button");
        if (count > 3) {
          const target = await toggle.getAttribute("aria-controls");
          assert.equal(await page.locator(`[id=${JSON.stringify(target)}]`).count(), 1);
          await toggle.click();
          assert.equal(await page.locator(".archive-card").count(), count);
          await toggle.click();
          assert.equal(await page.locator(".archive-card").count(), 3);
        }
      }
    }
    await context.close();
  }
  assert.deepEqual(pageErrors, [], "No browser runtime errors");
  await writeFile(`${evidence}summary.json`, `${JSON.stringify({ passed: true, widths, measurements, pageErrors }, null, 2)}\n`);
  console.log("PASS site polish: published entry, monthly archive/year navigation/native links, exact clipboard payloads/denied fallback, body progress, logo fallback, section expansion, 5 viewports");
  console.log(`Evidence: ${evidence}`);
} finally {
  await browser?.close();
  await server.close();
}
