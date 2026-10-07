import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "./serve-static.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const evidence = new URL("../.sisyphus/evidence/startup/", import.meta.url);
const server = await createServer({ root, server: { host: "127.0.0.1", port: 0 } });
const results = [];
const pageErrors = [];
let browser;

try {
  await server.listen();
  const origin = server.resolvedUrls.local[0].replace(/\/$/, "");
  browser = await chromium.launch({ headless: true });
  await mkdir(evidence, { recursive: true });

  for (const width of [1440, 390]) {
    for (const fontState of ["pending", "failed", "loaded"]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      const pendingFonts = [];
      const localFailures = [];
      const successfulHeadProbes = new WeakSet();
      let fontRequests = 0;
      await context.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin === origin || ["data:", "blob:"].includes(url.protocol)) return route.continue();
        if (url.hostname === "fonts.loli.net") {
          fontRequests += 1;
          if (fontState === "pending") { pendingFonts.push(route); return; }
          if (fontState === "failed") return route.abort("timedout");
          return route.fulfill({ status: 200, contentType: "text/css", body: "" });
        }
        return route.fulfill({ status: 200, contentType: route.request().resourceType() === "script" ? "application/javascript" : "text/html", body: "" });
      });

      const page = await context.newPage();
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("response", (response) => {
        if (response.request().method() === "HEAD" && response.status() === 200) successfulHeadProbes.add(response.request());
      });
      page.on("requestfailed", (request) => {
        // Next's successful HEAD probes can report a Chromium abort after HTTP 200.
        if (request.method() === "HEAD" && request.failure()?.errorText === "net::ERR_ABORTED" && successfulHeadProbes.has(request)) return;
        if (new URL(request.url()).origin === origin) localFailures.push(request.url());
      });
      try {
        // Font requests intentionally stay unresolved until after every interaction.
        await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 6000 });
        await page.waitForFunction(() => document.querySelector("link[data-site-fonts]"), null, { timeout: 6000 });
        await page.getByTestId("greeting-gate").waitFor({ state: "visible", timeout: 6000 });
        const background = await page.evaluate(async () => {
          const backdrop = document.querySelector(".greeting-gate__backdrop");
          const url = getComputedStyle(backdrop).backgroundImage.match(/^url\("?([^"\)]+)"?\)$/)?.[1];
          const image = new Image();
          image.src = url;
          await image.decode();
          return { url, width: image.naturalWidth, opacity: getComputedStyle(backdrop).opacity };
        });
        assert.equal(new URL(background.url).pathname, "/images/optimized/greeting.webp");
        assert(background.width > 0 && Number(background.opacity) > 0, "The greeting background must load and remain visible");

        await page.getByTestId("greeting-next").click({ timeout: 3000 });
        await page.waitForFunction(() => document.querySelector("[data-testid='greeting-gate-panel']")?.dataset.activeIndex === "1");
        await page.getByTestId("greeting-prev").click();
        await page.waitForFunction(() => document.querySelector("[data-testid='greeting-gate-panel']")?.dataset.activeIndex === "0");
        await page.getByTestId("greeting-enter-home").click();
        await page.locator(".home-grid").waitFor({ state: "visible", timeout: 6000 });
        assert.equal(await page.getByTestId("greeting-gate").count(), 0);
        assert.equal(await page.evaluate(() => sessionStorage.getItem("nocturne:greeting-dismissed")), "true");

        await page.getByTestId("greeting-replay").click();
        await page.getByTestId("greeting-gate").waitFor({ state: "visible" });
        await page.getByTestId("greeting-enter-home").click();
        await page.locator(".home-grid").waitFor({ state: "visible" });
        if (width === 390) await page.getByTestId("header-menu-toggle").click();
        await page.getByTestId("nav-about").click();
        await page.waitForURL(`${origin}/about`);
        await page.locator(".about-panel").waitFor({ state: "visible" });
        assert.equal(await page.locator("link[data-site-fonts]").count(), 1, "Navigation must not duplicate the font stylesheet");
        assert.equal(fontRequests, 1);
        assert.deepEqual(localFailures, [], "Local scripts, styles and background requests must succeed");
        results.push({ width, fontState, fontRequests, background, interactions: "next, previous, enter, replay, navigate" });
        await page.screenshot({ path: fileURLToPath(new URL(`${width}-${fontState}.png`, evidence)) });
      } finally {
        for (const route of pendingFonts) await route.fulfill({ status: 200, contentType: "text/css", body: "" }).catch(() => {});
        await context.close();
      }
    }
  }
  assert.deepEqual(pageErrors, [], "Startup and navigation must not throw hydration errors");
  await writeFile(new URL("results.json", evidence), `${JSON.stringify({ passed: true, results, pageErrors }, null, 2)}\n`);
  console.log("PASS startup: desktop/mobile greeting controls, background and navigation with pending, failed and loaded fonts");
} finally {
  await browser?.close();
  await server.close();
}
