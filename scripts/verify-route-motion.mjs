import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "./serve-static.mjs";
import { posts } from "../src/data/posts.js";
import { sections } from "../src/data/sections.js";
import { TEXT_TRANSITION_BUDGET, TEXT_TRANSITION_MOBILE_BUDGET } from "../src/lib/text-transition.js";
import { publicFoodMapPlaces } from "../src/generated/content.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const evidence = fileURLToPath(new URL("../.sisyphus/evidence/route-motion/", import.meta.url));
const server = await createServer({ root, server: { host: "127.0.0.1", port: 0 } });
const routes = ["/", "/archive", "/about", "/food-map", ...sections.map((section) => `/sections/${section.slug}`), ...posts.map((post) => `/posts/${post.slug}`)];
const results = [];
const pageErrors = [];
const consoleErrors = [];
let browser;

function normalize(path) {
  return path.replace(/\/$/, "") || "/";
}

async function settle(page, target) {
  await page.waitForFunction((pathname) => {
    const frame = document.querySelector(".route-frame");
    return location.pathname === pathname && frame && document.querySelectorAll(".route-frame").length === 1;
  }, target);
  await page.waitForFunction(() => document.getAnimations().every((animation) => !animation.effect?.pseudoElement || animation.playState === "finished" || animation.playState === "idle"));
  await page.waitForFunction(() => !document.querySelector(".greeting-screen"));
}

async function navigate(page, target) {
  const linked = await page.evaluate((href) => [...document.querySelectorAll(".route-stage a")].some((element) => new URL(element.href).pathname === href), target);
  if (!linked && target.startsWith("/posts/")) {
    const toggle = page.locator(".section-all-posts-cta button[aria-expanded='false']");
    if (await toggle.count()) await toggle.click();
  }
  await page.evaluate((href) => {
    const link = [...document.querySelectorAll(".site-header a, .route-stage a")].find((element) => (new URL(element.href).pathname.replace(/\/$/, "") || "/") === href);
    if (!link) throw new Error(`No native link for ${href}`);
    link.click();
  }, target);
}

try {
  await mkdir(evidence, { recursive: true });
  await server.listen();
  const origin = server.resolvedUrls.local[0].replace(/\/$/, "");
  browser = await chromium.launch({ headless: true });

  for (const width of [390, 1440]) {
    for (const reducedMotion of ["no-preference", "reduce"]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion });
      await context.addInitScript(() => {
        sessionStorage.setItem("nocturne:greeting-dismissed", "true");
        window.__routeTransitions = [];
        const original = document.startViewTransition?.bind(document);
        if (!original) return;
        document.startViewTransition = (...args) => {
          const record = { started: performance.now(), sourceNames: [...document.querySelectorAll("[data-shared-glyph]")].map((element) => element.style.viewTransitionName).filter(Boolean) };
          window.__routeTransitions.push(record);
          const transition = original(...args);
          transition.ready.then(() => { record.ready = true; }, (error) => { record.error = error.message; });
          transition.finished.then(() => { record.finished = true; });
          return transition;
        };
      });
      await context.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin === origin || ["data:", "blob:"].includes(url.protocol)) return route.continue();
        return route.fulfill({ status: 200, contentType: route.request().resourceType() === "script" ? "application/javascript" : "text/plain", body: "" });
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      await page.goto(origin);
      await settle(page, "/");
      await page.evaluate(() => { window.__persistentPlayer = document.querySelector("[data-testid='music-easter-egg-player']"); });

      const targets = ["/archive", "/about", "/food-map", ...sections.map((section) => `/sections/${section.slug}`), "/"];
      for (const post of posts) targets.push(`/sections/${post.section}`, `/posts/${post.slug}`);
      targets.push("/about", "/archive", "/");
      for (const target of targets) {
        const from = normalize(new URL(page.url()).pathname);
        if (from === target) continue;
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await page.waitForTimeout(30);
        const oldNames = await page.locator("[data-shared-glyph]").evaluateAll((elements) => elements.map((element) => element.style.viewTransitionName).filter(Boolean));
        assert.equal(new Set(oldNames).size, oldNames.length, "Old-page glyph identities must be unique");
        await page.evaluate(() => { window.__routeTransitions = []; });
        await navigate(page, target);
        await page.waitForFunction((pathname) => location.pathname === pathname && document.querySelector(".route-frame")?.dataset.entryMotion === "text", target);
        const active = await page.evaluate(() => {
          const oldNames = window.__routeTransitions.at(-1)?.sourceNames ?? [];
          const named = [...document.querySelectorAll("[data-shared-glyph]")].filter((element) => element.style.viewTransitionName);
          const names = named.map((element) => element.style.viewTransitionName);
          const animations = document.getAnimations().filter((animation) => animation.effect?.pseudoElement).map((animation) => ({
            pseudo: animation.effect.pseudoElement,
            duration: animation.effect.getTiming().duration,
            delay: animation.effect.getTiming().delay,
            frames: animation.effect.getKeyframes()
          }));
          return { names, shared: names.filter((name) => oldNames.includes(name)), animations, transitions: window.__routeTransitions };
        });
        assert.equal(new Set(active.names).size, active.names.length, "New-page glyph identities must be unique");
        assert(active.names.length <= (width <= 780 ? TEXT_TRANSITION_MOBILE_BUDGET : TEXT_TRANSITION_BUDGET));
        const groups = active.animations.filter((animation) => animation.pseudo.startsWith("::view-transition-group(nocturne-letter-"));
        if (reducedMotion === "no-preference") {
          assert(active.transitions.length > 0, `${from} -> ${target}: native transition was not started`);
          assert(active.shared.length > 0, `${from} -> ${target}: shared visible text expected`);
          assert(groups.length > 0, `${from} -> ${target}: shared text did not receive movement animations`);
          assert(groups.every((animation) => animation.duration === 680));
          assert(groups.some((animation) => animation.frames.length >= 2));
          assert(groups.every((animation) => animation.frames.every((frame) => !("width" in frame) && !("height" in frame))), "Shared text should move with transforms, without per-frame width/height layout");
          assert(active.animations.some((animation) => animation.delay === 260 && animation.duration === 260), "Unmatched content should reveal after shared-text motion starts");
        } else {
          assert.equal(active.names.length, 0);
          assert(active.animations.every((animation) => animation.duration <= 1 && animation.delay === 0));
        }
        await settle(page, target);
        assert.equal(await page.evaluate(() => window.__persistentPlayer === document.querySelector("[data-testid='music-easter-egg-player']")), true, "Music iframe must persist through route commits");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, `${target}: horizontal overflow`);
        assert.equal(await page.locator("main.route-stage").count(), 1);
        if (target.startsWith("/posts/")) {
          assert.equal(await page.locator("article.prose h1").textContent(), posts.find((post) => target === `/posts/${post.slug}`).title);
        }
        assert.deepEqual(await page.evaluate(() => window.__routeTransitions.filter((record) => record.error)), []);
        results.push({ width, reducedMotion, from, to: target, shared: active.shared.length, groups: groups.length });
      }

      await page.evaluate(async () => {
        for (const href of ["/archive", "/food-map", "/about"]) {
          document.querySelector(`.site-header a[href='${href}']`).click();
          await new Promise((done) => setTimeout(done, 70));
        }
      });
      await settle(page, "/about");
      if (width === 1440) {
        for (const href of ["/archive", "/food-map", "/about"]) {
          const box = await page.locator(`.site-header a[href='${href}']`).boundingBox();
          assert(box, `Visible pointer target required: ${href}`);
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          await page.waitForTimeout(70);
        }
        await settle(page, "/about");
      } else {
        await page.getByTestId("header-menu-toggle").click();
        await page.getByTestId("nav-archive").click();
        await settle(page, "/archive");
        assert.equal(await page.locator(".site-header").getAttribute("data-header-panel"), "closed");
      }
      await navigate(page, "/food-map");
      await settle(page, "/food-map");
      await navigate(page, "/archive");
      await settle(page, "/archive");
      await page.goBack();
      await settle(page, "/food-map");
      await page.goForward();
      await settle(page, "/archive");
      await page.screenshot({ path: `${evidence}text-${width}-${reducedMotion}.png`, fullPage: true });
      await context.close();
    }
  }

  const fallback = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await fallback.addInitScript(() => { document.startViewTransition = undefined; sessionStorage.setItem("nocturne:greeting-dismissed", "true"); });
  await fallback.route("**/*", (route) => route.request().url().startsWith(origin) ? route.continue() : route.fulfill({ body: "" }));
  const fallbackPage = await fallback.newPage();
  fallbackPage.on("pageerror", (error) => pageErrors.push(error.message));
  await fallbackPage.goto(`${origin}/archive`);
  await settle(fallbackPage, "/archive");
  await navigate(fallbackPage, "/about");
  await settle(fallbackPage, "/about");
  await fallback.close();

  for (const route of routes.filter((route) => route !== "/")) {
    const html = await readFile(`${root}out${route}.html`, "utf8");
    assert(html.includes("route-stage"));
    assert(html.includes("data-shared-glyph"));
  }
  const publicFoodData = JSON.stringify(publicFoodMapPlaces);
  for (const forbidden of ["privateNote", "people", '"private":', '"draft":']) assert.equal(publicFoodData.includes(forbidden), false);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
  await writeFile(`${evidence}summary.json`, `${JSON.stringify({ checks: results.length, budget: TEXT_TRANSITION_BUDGET, results, pageErrors, consoleErrors, fallback: true, staticRoutes: routes.length }, null, 2)}\n`);
  console.log(`PASS shared-text route motion (${results.length} transitions, ${routes.length} static routes, persisted music, rapid navigation, history, reduced-motion and API fallback)`);
} finally {
  await browser?.close();
  await server.close();
}
