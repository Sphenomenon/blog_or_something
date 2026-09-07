import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
import { navigateFromLink } from "../src/lib/navigation.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const evidence = fileURLToPath(new URL("../.sisyphus/evidence/reading-experience/", import.meta.url));
const sessionKey = "nocturne:greeting-dismissed";
const pageErrors = [];
const measurements = [];

// Modified, downloaded, and already-handled links must retain native behavior.
for (const overrides of [
  { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true },
  { button: 1 }, { defaultPrevented: true },
  { currentTarget: { target: "_blank", hasAttribute: () => false } },
  { currentTarget: { target: "", hasAttribute: () => true } }
]) {
  let intercepted = false;
  navigateFromLink({ button: 0, currentTarget: { target: "", hasAttribute: () => false },
    preventDefault() { intercepted = true; }, ...overrides }, () => { intercepted = true; });
  assert.equal(intercepted, false, `Native link behavior: ${JSON.stringify(overrides)}`);
}
let navigations = 0;
let prevented = false;
navigateFromLink({ button: 0, currentTarget: { target: "", hasAttribute: () => false },
  preventDefault() { prevented = true; } }, () => { navigations += 1; });
assert.equal(navigations, 1);
assert.equal(prevented, true);

await mkdir(evidence, { recursive: true });
const server = await createServer({ root, logLevel: "error", server: { host: "127.0.0.1", port: 0 } });
let browser;
try {
  await server.listen();
  const origin = server.resolvedUrls.local[0].replace(/\/$/, "");
  const { posts } = await server.ssrLoadModule("/src/data/posts.js");
  const article = posts.find((post) => post.slug === "niri-logisim-xwayland-white-screen")
    ?? posts.find((post) => post.section === "tech" && (post.content.match(/^## /gm) ?? []).length >= 2);
  assert.ok(article, "A real technical article with multiple headings is required");
  browser = await chromium.launch({ headless: true });

  async function contextFor(width, dismissed = false) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    if (dismissed) await context.addInitScript(({ key, localOrigin }) => {
      if (location.origin === localOrigin) sessionStorage.setItem(key, "true");
    }, { key: sessionKey, localOrigin: origin });
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin === origin || ["data:", "blob:"].includes(url.protocol)) return route.continue();
      // Verification never depends on public fonts, counters, comments, maps or music.
      const type = route.request().resourceType();
      return route.fulfill({ status: 200, contentType: type === "script" ? "application/javascript"
        : type === "stylesheet" ? "text/css" : "text/html", body: "" });
    });
    context.on("page", (page) => page.on("pageerror", (error) => pageErrors.push(error.message)));
    return context;
  }

  async function ready(page, selector) {
    await page.locator(selector).first().waitFor({ state: "visible" });
    await page.waitForFunction(() => document.querySelector(".route-stage")?.dataset.transitionState === "idle");
    await page.evaluate(() => document.fonts.ready);
  }

  async function assertCount(page, count) {
    await page.waitForFunction((expected) => document.querySelectorAll(".archive-card").length === expected, count);
    assert.equal(await page.locator(".archive-card").count(), count);
  }

  const session = await contextFor(1440);
  const page = await session.newPage();
  await page.goto(origin);
  await ready(page, "[data-testid='greeting-gate']");
  await page.getByTestId("greeting-enter-home").click();
  await ready(page, ".home-grid");
  assert.equal(await page.evaluate((key) => sessionStorage.getItem(key), sessionKey), "true");
  await assertCount(page, posts.length);
  for (const status of ["Published", "Draft", "Sealed", "All"]) {
    await page.locator(".filter-group").first().getByRole("button", { name: status, exact: true }).click();
    await assertCount(page, status === "All" ? posts.length
      : posts.filter((post) => post.status.trim().toLowerCase() === status.toLowerCase()).length);
  }
  const card = page.locator(".card-hit").first();
  assert.equal(await card.evaluate((element) => element.tagName), "A");
  const href = await card.getAttribute("href");
  const [newTab] = await Promise.all([session.waitForEvent("page"), card.click({ modifiers: ["Control"] })]);
  await newTab.waitForURL(`${origin}${href}`);
  assert.equal(new URL(page.url()).pathname, "/", "Ctrl-click leaves the original page intact");
  await newTab.close();
  await card.click();
  await ready(page, "article.prose");
  await page.getByTestId("brand-home").click();
  await ready(page, ".home-grid");
  assert.equal(await page.getByTestId("greeting-gate").count(), 0);
  await page.reload();
  await ready(page, ".home-grid");
  await page.getByTestId("greeting-replay").click();
  await ready(page, "[data-testid='greeting-gate']");
  await page.getByTestId("greeting-enter-home").click();
  await ready(page, ".home-grid");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${evidence}home-desktop.png` });
  await page.locator(".archive-column").evaluate((element) => element.scrollIntoView({ block: "start", behavior: "instant" }));
  await page.screenshot({ path: `${evidence}cards-desktop.png` });
  await page.getByTestId("nav-section-links").click();
  await ready(page, ".section-hero");
  assert.equal(await page.locator(".section-metadata > div").count(), 1);
  assert.doesNotMatch(await page.locator(".section-metadata").innerText(), /SLUG|THEME|BACKGROUND/);
  await page.screenshot({ path: `${evidence}links-desktop.png` });
  await session.close();

  for (const width of [375, 390, 768, 1024, 1440]) {
    const context = await contextFor(width, true);
    const page = await context.newPage();
    await page.goto(`${origin}/posts/${article.slug}`);
    await ready(page, "article.prose > h2");
    const dimensions = await page.evaluate(() => ({
      viewport: innerWidth, document: document.documentElement.scrollWidth,
      header: document.querySelector(".site-header").getBoundingClientRect().height,
      firstHeading: document.querySelector("article.prose > h2").getBoundingClientRect().top,
      nextAfterBody: Boolean(document.querySelector("article.prose > h2:last-of-type")
        .compareDocumentPosition(document.querySelector(".article-nav")) & Node.DOCUMENT_POSITION_FOLLOWING)
    }));
    measurements.push({ width, ...dimensions });
    await page.screenshot({ path: `${evidence}article-${width}.png` });
    assert.ok(dimensions.document <= width + 1, `${width}: no horizontal overflow`);
    assert.equal(dimensions.nextAfterBody, true, "Adjacent navigation follows the article body");
    if (width <= 780) {
      assert.ok(dimensions.header < 120, `${width}: compact mobile header (${dimensions.header})`);
      assert.ok(dimensions.firstHeading < 600, `${width}: article text reaches the first screen (${dimensions.firstHeading})`);
      assert.equal(await page.getByTestId("nav-archive").isVisible(), false);
      await page.getByTestId("header-menu-toggle").click();
      assert.equal(await page.getByTestId("nav-archive").isVisible(), true);
      await page.keyboard.press("Escape");
      assert.equal(await page.getByTestId("header-menu-toggle").evaluate((el) => el === document.activeElement), true);
      await page.getByTestId("header-search-toggle").click();
      assert.equal(await page.getByTestId("search-query").evaluate((el) => el === document.activeElement), true);
      await page.keyboard.press("Escape");
      assert.equal(await page.getByTestId("header-search-toggle").evaluate((el) => el === document.activeElement), true);
      const mini = page.getByTestId("music-mini-player");
      const box = await mini.boundingBox();
      assert.ok(box.width <= 56 && box.height <= 56, "Collapsed music does not occupy a full row");
      await page.getByTestId("music-easter-egg-player").waitFor({ state: "attached" });
      await page.evaluate(() => { window.readingTestPlayer = document.querySelector("iframe[data-testid='music-easter-egg-player']"); });
      await page.getByTestId("music-easter-egg-toggle").click();
      assert.ok((await mini.boundingBox()).width > 200);
      await page.getByTestId("music-easter-egg-toggle").click();
      assert.equal(await page.evaluate(() => window.readingTestPlayer === document.querySelector("iframe[data-testid='music-easter-egg-player']")), true);
      assert.equal(await page.getByTestId("music-easter-egg-panel").evaluate((el) => el.inert), true, "Collapsed player content is not keyboard-focusable");
      assert.equal(new URL(await page.getByTestId("music-easter-egg-player").getAttribute("src")).searchParams.get("auto"), "0");
    }
    await page.screenshot({ path: `${evidence}article-${width}.png` });
    if (width <= 1180) {
      assert.equal(await page.locator(".rail-left").isVisible(), false);
      assert.equal(await page.locator(".rail-right").isVisible(), false);
      const toc = page.getByTestId("article-toc-mobile");
      assert.equal(await toc.getAttribute("open"), null);
      await toc.locator("summary").click();
      const target = await page.getByTestId("mobile-toc-2").getAttribute("data-section");
      await page.getByTestId("mobile-toc-2").click();
      assert.equal(await toc.getAttribute("open"), null, "TOC closes after selecting a heading");
      assert.equal(await page.evaluate(() => document.activeElement.id), target, "Keyboard focus follows the selected heading");
      const y = await page.locator(`[id=${JSON.stringify(target)}]`).evaluate((el) => el.getBoundingClientRect().top);
      assert.ok(y >= -1 && y < 180, `${width}: selected heading is visible (${y})`);
    } else {
      assert.equal(await page.locator(".rail-right").isVisible(), true);
      assert.equal(await page.getByTestId("article-toc-mobile").isVisible(), false);
    }
    if (width <= 780) {
      await page.getByTestId("header-menu-toggle").click();
      await page.getByTestId("nav-archive").click();
      await ready(page, ".page-panel--archive");
      assert.equal(await page.getByTestId("header-menu-toggle").getAttribute("aria-expanded"), "false");
      assert.equal(await page.evaluate(() => window.readingTestPlayer === document.querySelector("iframe[data-testid='music-easter-egg-player']")), true, "Music iframe survives SPA navigation");
      await page.getByTestId("header-search-toggle").click();
      await page.getByTestId("search-query").fill(article.title);
      await page.getByTestId("search-query").press("Enter");
      await ready(page, ".home-grid");
      await assertCount(page, posts.filter((post) => [post.title, post.excerpt, post.category, post.id, post.section, ...post.tags].join(" ").toLowerCase().includes(article.title.toLowerCase())).length);
      assert.equal(await page.getByTestId("header-search-toggle").getAttribute("aria-expanded"), "false");
      await page.getByTestId("header-search-toggle").click();
      await page.getByTestId("search-query").fill("");
      await page.getByTestId("search-query").press("Enter");
      await assertCount(page, posts.length);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}: home has no overflow`);
      await page.screenshot({ path: `${evidence}home-${width}.png` });
      await page.locator(".archive-column").evaluate((element) => element.scrollIntoView({ block: "start", behavior: "instant" }));
      await page.screenshot({ path: `${evidence}cards-${width}.png` });
      await page.getByTestId("header-menu-toggle").click();
      await page.getByTestId("nav-section-links").click();
      await ready(page, ".section-hero");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}: friendlinks have no overflow`);
      await page.screenshot({ path: `${evidence}links-${width}.png` });
    }
    await context.close();
  }

  const unavailable = await contextFor(390);
  await unavailable.addInitScript((key) => {
    for (const method of ["getItem", "setItem"]) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function (name, ...args) {
        if (name === key) throw new DOMException("Storage disabled", "SecurityError");
        return original.call(this, name, ...args);
      };
    }
  }, sessionKey);
  const fallback = await unavailable.newPage();
  await fallback.goto(origin);
  await ready(fallback, "[data-testid='greeting-gate']");
  await fallback.getByTestId("greeting-enter-home").click();
  await ready(fallback, ".home-grid");
  await fallback.locator(".card-hit").first().click();
  await ready(fallback, "article.prose");
  await fallback.getByTestId("brand-home").click();
  await ready(fallback, ".home-grid");
  await unavailable.close();
  assert.deepEqual(pageErrors, [], "No browser runtime errors");
  await writeFile(`${evidence}summary.json`, `${JSON.stringify({ passed: true, article: article.slug, measurements, pageErrors }, null, 2)}\n`);
  console.log("PASS reading experience: status filters, session/replay/storage fallback, native links, mobile menu/search/TOC, persistent music, 5 viewport layouts");
  console.log(`Evidence: ${evidence}`);
} finally {
  await browser?.close();
  await server.close();
}
