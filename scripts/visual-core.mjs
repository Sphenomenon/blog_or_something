import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import path from "node:path";

const execFileAsync = promisify(execFile);
const BASE_URL = process.env.VISUAL_BASE_URL ?? process.env.VITE_BASE_URL ?? "http://127.0.0.1:5173/";
const EVIDENCE_DIR = new URL("../.sisyphus/evidence/", import.meta.url);
const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));
const DEFAULT_VIEWPORTS = [375, 768, 1024, 1440];
const SECTION_SLUGS = ["tech", "essay", "diary", "reading", "travel", "links"];
const VERCOUNT_SCRIPT_SRC = "https://events.vercount.one/js";
const MUSIC_FALLBACK_HREF = "https://music.163.com/song?id=2707332868";
const MUSIC_IFRAME_EXPECTATIONS = {
  type: "2",
  id: "2707332868",
  auto: "0",
  height: "66"
};
const BLOCKED_THIRD_PARTY_HOSTS = new Set(["identity.netlify.com", "events.vercount.one", "music.163.com"]);

function shouldIgnoreConsoleEntry(type, text) {
  return type === "warning" && text === "API error: Failed to fetch";
}

function loadYamlSync(relativePath) {
  return yaml.load(readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8"));
}

const SECTION_TAGLINES = (() => {
  const site = loadYamlSync("src/content/site.yaml");
  const taglines = { home: site.header_subtitle };
  for (const slug of SECTION_SLUGS) {
    const sec = loadYamlSync(`src/content/sections/${slug}.yaml`);
    if (sec.subtitle) {
      taglines[slug] = sec.subtitle;
    }
  }
  return taglines;
})();
const GREETING_PANEL_IDS = loadYamlSync("src/content/greeting.yaml").panels.map((panel) => String(panel.id));
const FIRST_GREETING_PANEL_ID = GREETING_PANEL_IDS[0];
const SECOND_GREETING_PANEL_ID = GREETING_PANEL_IDS[1];
const THIRD_GREETING_PANEL_ID = GREETING_PANEL_IDS[2];

async function ensureEvidenceDir() {
  await mkdir(EVIDENCE_DIR, { recursive: true });
}

async function launchPage(viewport = { width: 1440, height: 1100 }) {
  const browser = await chromium.launch({ headless: true });
  const { page, errors, consoleEntries } = await createPage(browser, viewport);
  await goToPath(page, "/");

  return { browser, page, errors, consoleEntries };
}

async function createPage(browser, viewport = { width: 1440, height: 1100 }) {
  const context = await browser.newContext({ viewport });
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (BLOCKED_THIRD_PARTY_HOSTS.has(url.hostname)) {
      const resourceType = route.request().resourceType();
      return route.fulfill({
        status: 200,
        contentType: resourceType === "script" ? "application/javascript" : "text/html",
        body: resourceType === "script" ? "" : "<!doctype html><html><body></body></html>"
      });
    }
    return route.continue();
  });
  const page = await context.newPage();
  const errors = [];
  const consoleEntries = [];

  page.on("pageerror", (error) => errors.push(error.stack || error.message));
  page.on("console", (message) => {
    const type = message.type();
    const text = message.text();
    if ((type === "error" || type === "warning") && !shouldIgnoreConsoleEntry(type, text)) {
      consoleEntries.push({ type, text });
    }
  });

  return { context, page, errors, consoleEntries };
}

async function capturePageState(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const shell = document.querySelector(".app-shell");
    const greetingGate = document.querySelector('[data-testid="greeting-gate"]');
    return {
      title: document.title,
      activeHeading: document.querySelector("h1")?.textContent ?? null,
      bodyTextLength: body.innerText.length,
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      bodyScrollWidth: body.scrollWidth,
      bodyClientWidth: body.clientWidth,
      hasShell: Boolean(shell),
      hasGreetingGate: Boolean(greetingGate),
      visibleButtons: Array.from(document.querySelectorAll("button")).slice(0, 16).map((button) => button.textContent?.trim()),
      activeElement: document.activeElement?.tagName ?? null
    };
  });
}

async function collectTransitionState(page) {
  return page.evaluate(() => {
    const stage = document.querySelector('.route-stage');
    if (!stage) {
      return null;
    }

    const computed = window.getComputedStyle(stage);
    return {
      transitionState: stage.getAttribute('data-transition-state'),
      listTransitionState: stage.getAttribute('data-list-transition-state'),
      transitionDuration: computed.transitionDuration,
      transitionProperty: computed.transitionProperty,
      animationName: computed.animationName,
      animationDuration: computed.animationDuration
    };
  });
}

async function collectArchiveYearState(page) {
  return page.evaluate(() => {
    const heading = document.querySelector('[data-testid="archive-year-heading"]')?.textContent?.trim() ?? null;
    const label = document.querySelector('[data-testid="archive-year-label"]')?.textContent?.trim() ?? null;
    const position = document.querySelector('[data-testid="archive-year-position"]')?.textContent?.trim() ?? null;
    const summary = document.querySelector('[data-testid="archive-year-summary"]')?.textContent?.trim() ?? null;
    const prevButton = document.querySelector('[data-testid="archive-year-prev"]');
    const nextButton = document.querySelector('[data-testid="archive-year-next"]');
    const cards = Array.from(document.querySelectorAll('.archive-group [data-testid^="archive-view-"]')).map((node) => node.getAttribute('data-testid'));

    return {
      heading,
      label,
      position,
      summary,
      cards,
      previousDisabled: prevButton?.disabled ?? null,
      nextDisabled: nextButton?.disabled ?? null,
      previousAriaDisabled: prevButton?.getAttribute('aria-disabled') ?? null,
      nextAriaDisabled: nextButton?.getAttribute('aria-disabled') ?? null
    };
  });
}

async function collectHeaderSubtitle(page) {
  return page.evaluate(() => document.querySelector('[data-testid="site-header-subtitle"]')?.textContent?.trim() ?? null);
}

async function collectActiveSectionSlug(page) {
  return page.evaluate(() => {
    const active = document.querySelector('.site-nav--sections .active');
    const testId = active?.getAttribute('data-testid') ?? null;
    return testId?.startsWith('nav-section-') ? testId.slice('nav-section-'.length) : null;
  });
}

async function collectSectionEntranceState(page, sectionSlug) {
  return page.evaluate((slug) => {
    const cardNodes = Array.from(document.querySelectorAll(`[data-testid="section-representatives-${slug}"] .archive-card`));
    const cta = document.querySelector(`[data-testid="section-all-posts-${slug}"]`);
    const intro = document.querySelector(`[data-testid="section-view-${slug}"] .page-panel-lead`)?.textContent?.trim() ?? null;

    return {
      sectionSlug: slug,
      cardCount: cardNodes.length,
      cardTestIds: cardNodes.map((card) => card.querySelector('[data-testid^="archive-card-"]')?.getAttribute('data-testid') ?? null).filter(Boolean),
      hasCta: Boolean(cta),
      ctaText: cta?.textContent?.trim() ?? null,
      intro
    };
  }, sectionSlug);
}

async function collectSectionToggleState(page, sectionSlug) {
  return page.evaluate((slug) => {
    const sectionRoot = document.querySelector(`[data-testid="section-view-${slug}"]`);
    const list = document.querySelector(`[data-testid="section-representatives-${slug}"]`);
    const cta = document.querySelector(`[data-testid="section-all-posts-${slug}"]`);

    return {
      sectionSlug: slug,
      sectionVisible: Boolean(sectionRoot),
      listVisible: Boolean(list),
      listCardCount: Array.from(document.querySelectorAll(`[data-testid="section-representatives-${slug}"] .archive-card [data-testid^="archive-card-"]`)).length,
      ctaText: cta?.textContent?.trim() ?? null,
      ctaExpanded: cta?.getAttribute('aria-expanded') ?? null,
      listExpanded: list?.getAttribute('aria-expanded') ?? null
    };
  }, sectionSlug);
}

async function runBuild() {
  const started = Date.now();
  try {
    const result = await execFileAsync("npm", ["run", "build"], {
      cwd: PROJECT_ROOT,
      env: { ...process.env }
    });
    return {
      ok: true,
      code: 0,
      durationMs: Date.now() - started,
      stdout: result.stdout,
      stderr: result.stderr
    };
  } catch (error) {
    return {
      ok: false,
      code: error.code ?? 1,
      durationMs: Date.now() - started,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? error.message
    };
  }
}

async function saveEvidence(filename, data) {
  await ensureEvidenceDir();
  const fileUrl = new URL(filename, EVIDENCE_DIR);
  const payload = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  await writeFile(fileUrl, payload.endsWith("\n") ? payload : `${payload}\n`, "utf8");
  return fileUrl.pathname;
}

async function saveScreenshot(filename, page) {
  await ensureEvidenceDir();
  const fileUrl = new URL(filename, EVIDENCE_DIR);
  await page.screenshot({ path: fileUrl.pathname, fullPage: true });
  return fileUrl.pathname;
}

async function openRouteInFreshContext(browser, path, viewport = { width: 1440, height: 1100 }) {
  const { context, page, errors, consoleEntries } = await createPage(browser, viewport);
  await goToPath(page, path);
  return { context, page, errors, consoleEntries };
}

function assertCondition(condition, message, details = {}) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

export async function inspectHomePage() {
  const { browser, page, errors } = await launchPage();
  try {
    const info = await capturePageState(page);
    const payload = { page: "home", errors, info };
    await saveEvidence("debug-page.json", payload);
    console.log(JSON.stringify(payload, null, 2));
    assertCondition(errors.length === 0, "Home page reported page errors", { errors });
  } finally {
    await browser.close();
  }
}

export async function inspectInteractions() {
  const { browser, page, errors } = await launchPage();
  try {
    const greetingGate = page.getByTestId("greeting-gate");
    if (await greetingGate.isVisible().catch(() => false)) {
      await page.getByTestId("greeting-enter-home").click();
      await greetingGate.waitFor({ state: "hidden", timeout: 10000 });
    }

    await page.getByTestId("search-query").fill("冷光");
    const searchText = await page.locator("body").innerText();

    await goToPath(page, "/archive");
    const archiveVisible = await page.getByRole("heading", { name: "归档页" }).isVisible();

    await goToPath(page, "/sections/tech");
    const techVisible = await page.getByTestId("section-view-tech").isVisible();

    await goToPath(page, "/");
    if (await page.getByTestId("greeting-gate").isVisible().catch(() => false)) {
      await page.getByTestId("greeting-enter-home").click();
      await page.getByTestId("greeting-gate").waitFor({ state: "hidden", timeout: 10000 });
    }
    await page.getByTestId("search-query").fill("");
    await page.getByTestId("archive-card-AR-2026-041").click();
    const articleVisible = await page.getByRole("heading", { name: "在石化走廊里记录一场缓慢失真" }).isVisible();

    const payload = {
      page: "interactions",
      errors,
      searchMatchedColdLight: searchText.includes("冷光线路在地下图书馆的再生路径"),
      archiveVisible,
      techVisible,
      articleVisible
    };

    await saveEvidence("debug-interactions.json", payload);
    console.log(JSON.stringify(payload, null, 2));

    assertCondition(payload.searchMatchedColdLight, "Search interaction did not surface the cold-light post", payload);
    assertCondition(archiveVisible, "Archive page was not visible after clicking navigation", payload);
    assertCondition(techVisible, "Tech section page was not visible after navigation", payload);
    assertCondition(articleVisible, "Article page was not visible after opening the post", payload);
    assertCondition(errors.length === 0, "Interactions reported page errors", { errors });
  } finally {
    await browser.close();
  }
}

async function openView(page, viewName) {
  if (viewName === "home") {
    await goToPath(page, "/");
    const greetingGate = page.getByTestId("greeting-gate");
    if (await greetingGate.isVisible().catch(() => false)) {
      await page.getByTestId("greeting-enter-home").click();
      await greetingGate.waitFor({ state: "hidden", timeout: 10000 });
    }
    await page.getByRole("heading", { name: "档案索引" }).waitFor({ state: "visible", timeout: 10000 });
    return;
  }

  if (viewName === "article") {
    await goToPath(page, "/posts/petrified-corridor");
    await page.getByRole("heading", { name: "在石化走廊里记录一场缓慢失真" }).waitFor({ state: "visible", timeout: 10000 });
    return;
  }

  if (viewName === "archive") {
    await goToPath(page, "/archive");
    await page.getByRole("heading", { name: "归档页" }).waitFor({ state: "visible", timeout: 10000 });
    return;
  }

  if (viewName === "section-tech") {
    await goToPath(page, "/sections/tech");
    await page.getByTestId("section-view-tech").waitFor({ state: "visible", timeout: 10000 });
    return;
  }

  if (viewName.startsWith("section-")) {
    const sectionSlug = viewName.slice("section-".length);
    await goToPath(page, `/sections/${sectionSlug}`);
    await page.getByTestId(`section-view-${sectionSlug}`).waitFor({ state: "visible", timeout: 10000 });
    return;
  }

  if (viewName === "about") {
    await goToPath(page, "/about");
    await page.getByRole("heading", { name: "关于这座档案馆" }).waitFor({ state: "visible", timeout: 10000 });
  }
}

async function verifyDirectRoute(browser, path, expected) {
  const { context, page, errors, consoleEntries } = await openRouteInFreshContext(browser, path);
  try {
    if (expected.kind === "home") {
      const gate = page.getByTestId("greeting-gate");
      await gate.waitFor({ state: "visible", timeout: 10000 });
      const state = await capturePageState(page);
      const comments = await collectArticleCommentScopeState(page);
      assertCondition(comments.commentsSectionPresent === false, `Article comments leaked into home route`, { path, comments });
      assertCondition(consoleEntries.length === 0, `Console warnings/errors detected on ${path}`, { path, consoleEntries });
      return { path, ...expected, errors, consoleEntries, state, comments };
    }

    if (expected.kind === "post") {
      await page.getByRole("heading", { name: expected.heading }).waitFor({ state: "visible", timeout: 10000 });
      const state = await capturePageState(page);
      const navigation = await collectArticleNavigationState(page);
      const comments = await collectArticleCommentScopeState(page);
      const hasWalineServerURL = Boolean(process.env.VITE_WALINE_SERVER_URL?.trim());
      assertCondition(navigation.commentsSectionPresent === true, `Article comments section missing on ${path}`, { path, navigation, comments });
      if (expected.expectedNavigation) {
        const normalizedNavigation = {
          previousTitle: navigation.previousTitle,
          previousEmpty: Boolean(navigation.previousEmpty),
          nextTitle: navigation.nextTitle,
          nextEmpty: Boolean(navigation.nextEmpty)
        };
        if (expected.expectedNavigation.previousTitle !== undefined) {
          assertCondition(normalizedNavigation.previousTitle === expected.expectedNavigation.previousTitle, `Previous article title mismatch on ${path}`, { path, navigation, expected: expected.expectedNavigation });
        }
        if (expected.expectedNavigation.previousEmpty !== undefined) {
          assertCondition(normalizedNavigation.previousEmpty === expected.expectedNavigation.previousEmpty, `Previous article boundary mismatch on ${path}`, { path, navigation, expected: expected.expectedNavigation });
        }
        if (expected.expectedNavigation.nextTitle !== undefined) {
          assertCondition(normalizedNavigation.nextTitle === expected.expectedNavigation.nextTitle, `Next article title mismatch on ${path}`, { path, navigation, expected: expected.expectedNavigation });
        }
        if (expected.expectedNavigation.nextEmpty !== undefined) {
          assertCondition(normalizedNavigation.nextEmpty === expected.expectedNavigation.nextEmpty, `Next article boundary mismatch on ${path}`, { path, navigation, expected: expected.expectedNavigation });
        }
      }
      if (hasWalineServerURL) {
        assertCondition(comments.commentsContainerPresent === true, `Waline container missing on ${path}`, { path, navigation, comments });
      } else {
        assertCondition(comments.commentsDisabledPresent === true, `Disabled comments notice missing on ${path}`, { path, navigation, comments });
      }
      assertCondition(consoleEntries.length === 0, `Console warnings/errors detected on ${path}`, { path, consoleEntries });
      return { path, ...expected, errors, consoleEntries, state, navigation, comments };
    }

    if (expected.kind === "archive") {
      await page.getByRole("heading", { name: expected.heading }).waitFor({ state: "visible", timeout: 10000 });
      const state = await capturePageState(page);
      const archiveYearState = await collectArchiveYearState(page);
      const comments = await collectArticleCommentScopeState(page);
      assertCondition(comments.commentsSectionPresent === false, `Article comments leaked into archive route`, { path, comments });
      assertCondition(consoleEntries.length === 0, `Console warnings/errors detected on ${path}`, { path, consoleEntries });
      return { path, ...expected, errors, consoleEntries, state, archiveYearState, comments };
    }

    if (expected.kind === "section") {
      await page.getByTestId(expected.testId).waitFor({ state: "visible", timeout: 10000 });
      const state = await capturePageState(page);
      const comments = await collectArticleCommentScopeState(page);
      assertCondition(comments.commentsSectionPresent === false, `Article comments leaked into section route`, { path, comments });
      assertCondition(consoleEntries.length === 0, `Console warnings/errors detected on ${path}`, { path, consoleEntries });
      return { path, ...expected, errors, consoleEntries, state, comments };
    }

    if (expected.kind === "about") {
      await page.getByRole("heading", { name: expected.heading }).waitFor({ state: "visible", timeout: 10000 });
      const state = await capturePageState(page);
      const comments = await collectArticleCommentScopeState(page);
      assertCondition(comments.commentsSectionPresent === false, `Article comments leaked into about route`, { path, comments });
      assertCondition(consoleEntries.length === 0, `Console warnings/errors detected on ${path}`, { path, consoleEntries });
      return { path, ...expected, errors, consoleEntries, state, comments };
    }

    if (expected.kind === "not-found") {
      await page.getByTestId("not-found-view").waitFor({ state: "visible", timeout: 10000 });
      const state = await capturePageState(page);
      const text = await page.getByTestId("not-found-view").innerText();
      const comments = await collectArticleCommentScopeState(page);
      assertCondition(comments.commentsSectionPresent === false, `Article comments leaked into not-found route`, { path, comments });
      assertCondition(consoleEntries.length === 0, `Console warnings/errors detected on ${path}`, { path, consoleEntries });
      return { path, ...expected, errors, consoleEntries, state, notFoundText: text, comments };
    }

    throw new Error(`Unsupported route expectation: ${expected.kind}`);
  } finally {
    await context.close();
  }
}

async function collectMusicState(page) {
  return page.evaluate(() => {
    const toggle = document.querySelector('[data-testid="music-easter-egg-toggle"]');
    const panel = document.querySelector('[data-testid="music-easter-egg-panel"]');
    const section = document.querySelector('.music-easter-egg');
    const iframes = Array.from(document.querySelectorAll('iframe')).map((element) => ({
      tag: element.tagName,
      autoplay: element.getAttribute('autoplay'),
      allow: element.getAttribute('allow'),
      src: element.getAttribute('src'),
      title: element.getAttribute('title')
    }));
    const fallbackLink = document.querySelector('[data-testid="music-easter-egg-fallback-link"]');

    return {
      hasSection: Boolean(section),
      toggleExpanded: toggle?.getAttribute('aria-expanded') ?? null,
      panelVisible: Boolean(panel),
      panelText: panel?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      iframeCount: iframes.length,
      iframes,
      fallbackHref: fallbackLink?.getAttribute('href') ?? null,
      panelContentTestIds: panel ? Array.from(panel.querySelectorAll('[data-testid]')).map((node) => node.getAttribute('data-testid')) : []
    };
  });
}

async function collectVisitCounterState(page) {
  return page.evaluate((scriptSrc) => {
    const counter = document.querySelector('[data-testid="home-visit-counter"]');
    const value = counter?.querySelector('.vercount_value_site_pv') ?? null;
    const scripts = Array.from(document.querySelectorAll('script[src]')).filter((script) => script.getAttribute('src') === scriptSrc);
    const style = counter ? window.getComputedStyle(counter) : null;

    return {
      scriptCount: scripts.length,
      scriptSrcs: scripts.map((script) => script.getAttribute('src')),
      hasCounter: Boolean(counter),
      counterVisible: Boolean(counter && style && style.display !== 'none' && style.visibility !== 'hidden'),
      counterText: counter?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      label: counter?.querySelector('.side-panel-counter__label')?.textContent?.trim() ?? null,
      valueText: value?.textContent?.trim() ?? null,
      valueClass: value?.getAttribute('class') ?? null
    };
  }, VERCOUNT_SCRIPT_SRC);
}

function assertMusicIframeContract(state, expectedParams) {
  assertCondition(state.iframeCount === 1, "Music easter egg should mount exactly one iframe after expansion", state);
  const iframe = state.iframes[0];
  assertCondition(Boolean(iframe?.src), "Music iframe is missing its src", state);
  const iframeUrl = new URL(iframe.src);
  for (const [name, expectedValue] of Object.entries(expectedParams)) {
    assertCondition(iframeUrl.searchParams.get(name) === expectedValue, `Music iframe ${name} param mismatch`, { state, src: iframe.src, expectedParams });
  }
  assertCondition(iframe.autoplay === null, "Music iframe should not include an autoplay attribute", state);
  assertCondition(!iframe.allow?.toLowerCase().includes("autoplay"), "Music iframe allow attribute should not permit autoplay", state);
}

async function collectMarkdownState(page) {
  return page.evaluate(() => {
    const article = document.querySelector('article.prose');
    return {
      hasArticle: Boolean(article),
      headingCount: document.querySelectorAll('article.prose h2, article.prose h3').length,
      blockquoteCount: document.querySelectorAll('article.prose blockquote').length,
      codeBlockCount: document.querySelectorAll('article.prose pre code').length,
      listCount: document.querySelectorAll('article.prose ul, article.prose ol').length,
      tableCount: document.querySelectorAll('article.prose table').length,
      tocCount: document.querySelectorAll('[data-testid^="toc-"]').length,
      title: article?.querySelector('h1')?.textContent?.trim() ?? null
    };
  });
}

async function collectArticleNavigationState(page) {
  return page.evaluate(() => ({
    previousEyebrow: document.querySelector('[data-testid="article-prev"] .article-nav__eyebrow')?.textContent?.trim() ?? null,
    previousTitle: document.querySelector('[data-testid="article-prev"] .article-nav__title')?.textContent?.trim() ?? null,
    nextEyebrow: document.querySelector('[data-testid="article-next"] .article-nav__eyebrow')?.textContent?.trim() ?? null,
    nextTitle: document.querySelector('[data-testid="article-next"] .article-nav__title')?.textContent?.trim() ?? null,
    previousEmpty: document.querySelector('[data-testid="article-prev-empty"]')?.textContent?.trim() ?? null,
    nextEmpty: document.querySelector('[data-testid="article-next-empty"]')?.textContent?.trim() ?? null,
    commentContainerPresent: Boolean(document.querySelector('[data-testid="article-comments-container"]')),
    commentDisabledPresent: Boolean(document.querySelector('[data-testid="article-comments-disabled"]')),
    commentsSectionPresent: Boolean(document.querySelector('[aria-label="文章评论"]'))
  }));
}

async function collectArticleCommentScopeState(page) {
  return page.evaluate(() => ({
    commentsSectionPresent: Boolean(document.querySelector('[aria-label="文章评论"]')),
    commentsContainerPresent: Boolean(document.querySelector('[data-testid="article-comments-container"]')),
    commentsDisabledPresent: Boolean(document.querySelector('[data-testid="article-comments-disabled"]'))
  }));
}

async function collectOnboardingState(page) {
  return page.evaluate((panelIds) => {
    const panels = panelIds.map((id) => document.querySelector(`[data-testid="${CSS.escape(id)}"]`)).filter(Boolean);
    const visiblePanels = panels.filter((panel) => panel.getAttribute('data-state') !== 'hidden');
    const enteringPanels = panels.filter((panel) => panel.getAttribute('data-state') === 'entering');

    return {
      visiblePanelTestId: visiblePanels.at(-1)?.getAttribute('data-testid') ?? null,
      visiblePanelTestIds: visiblePanels.map((panel) => panel.getAttribute('data-testid')),
      visiblePanelStates: visiblePanels.map((panel) => panel.getAttribute('data-state')),
      enteringPanelTestIds: enteringPanels.map((panel) => panel.getAttribute('data-testid')),
      activeIndex: Number(document.querySelector('[data-testid="greeting-gate-panel"]')?.getAttribute('data-active-index') ?? 0),
      revealedCount: Number(document.querySelector('[data-testid="greeting-gate-panel"]')?.getAttribute('data-revealed-count') ?? 0),
      gateVisible: Boolean(document.querySelector('[data-testid="greeting-gate"]')),
      homeHeadingVisible: Boolean(document.querySelector('main h1'))
    };
  }, GREETING_PANEL_IDS);
}

async function exerciseGreetingGate(page) {
  await goToPath(page, "/");
  const gate = page.getByTestId("greeting-gate");
  await gate.waitFor({ state: "visible", timeout: 10000 });
  await gate.focus();
  await page.getByTestId("greeting-panel-1").waitFor({ state: "visible", timeout: 10000 });

  const expectGreetingState = async (expectedVisibleIds, expectedActiveIndex) => {
    await page.waitForFunction(
      ({ expectedVisibleIds: ids, expectedActiveIndex: activeIndex }) => {
        const panel = document.querySelector('[data-testid="greeting-gate-panel"]');
        const visiblePanels = Array.from(document.querySelectorAll('[data-testid^="greeting-panel-"]'))
          .filter((node) => Number.parseFloat(window.getComputedStyle(node).opacity || '0') > 0 || node.getAttribute('data-state') === 'entering')
          .map((node) => node.getAttribute('data-testid'));
        return panel?.getAttribute('data-active-index') === String(activeIndex) && ids.length === visiblePanels.length && ids.every((id, index) => id === visiblePanels[index]);
      },
      { expectedVisibleIds, expectedActiveIndex },
      { timeout: 1000 }
    );
  };

  await expectGreetingState(["greeting-panel-1"], 0);
  await page.keyboard.press("ArrowDown");
  await expectGreetingState(["greeting-panel-1", "greeting-panel-2"], 1);
  await page.keyboard.press("PageDown");
  await expectGreetingState(["greeting-panel-1", "greeting-panel-2", "greeting-panel-3"], 2);
  await page.keyboard.press("PageUp");
  await expectGreetingState(["greeting-panel-1", "greeting-panel-2", "greeting-panel-3"], 1);
  await page.mouse.wheel(0, 360);
  await expectGreetingState(["greeting-panel-1", "greeting-panel-2", "greeting-panel-3"], 2);
  await page.mouse.wheel(0, -360);
  await expectGreetingState(["greeting-panel-1", "greeting-panel-2", "greeting-panel-3"], 1);
  await page.getByTestId("greeting-prev").click();
  await expectGreetingState(["greeting-panel-1", "greeting-panel-2", "greeting-panel-3"], 0);
  await page.getByTestId("greeting-next").click();
  await expectGreetingState(["greeting-panel-1", "greeting-panel-2", "greeting-panel-3"], 1);
  await page.getByTestId("greeting-next").click();
  await expectGreetingState(["greeting-panel-1", "greeting-panel-2", "greeting-panel-3"], 2);
  await page.getByTestId("greeting-next").click();
  await expectGreetingState(["greeting-panel-1", "greeting-panel-2", "greeting-panel-3"], 2);
  await page.getByTestId("greeting-enter-home").click();
  await page.getByTestId("greeting-gate").waitFor({ state: "hidden", timeout: 10000 });
  await page.getByRole("heading", { name: "档案索引" }).waitFor({ state: "visible", timeout: 10000 });
}

async function goToPath(page, path) {
  await page.goto(new URL(path, BASE_URL).href, { waitUntil: "domcontentloaded", timeout: 15000 });
}

async function verifyFocusAndMotion(page) {
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const navFocus = await page.evaluate(() => {
    const active = document.activeElement;
    if (!active) return null;
    const style = window.getComputedStyle(active);
    return {
      tag: active.tagName,
      testId: active.getAttribute("data-testid"),
      text: active.textContent?.trim() ?? "",
      matchesFocusVisible: active.matches(":focus-visible"),
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
      outlineColor: style.outlineColor,
      outlineOffset: style.outlineOffset
    };
  });

  await page.getByTestId("archive-card-AR-2026-041").focus();
  const cardFocus = await page.evaluate(() => {
    const active = document.activeElement;
    if (!active) return null;
    const style = window.getComputedStyle(active);
    return {
      tag: active.tagName,
      testId: active.getAttribute("data-testid"),
      matchesFocusVisible: active.matches(":focus-visible"),
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
      outlineColor: style.outlineColor,
      outlineOffset: style.outlineOffset
    };
  });

  await page.emulateMedia({ reducedMotion: "reduce" });
  const motionState = await page.evaluate((secondGreetingPanelId) => {
    const sample = document.querySelector(".site-nav button") ?? document.querySelector(".greeting-gate__entry") ?? document.body;
    const revealStyle = window.getComputedStyle(document.querySelector(".reveal") ?? document.body);
    const style = window.getComputedStyle(sample);
    const entryStyle = window.getComputedStyle(document.querySelector(`[data-testid="${CSS.escape(secondGreetingPanelId)}"]`) ?? document.body);
    return {
      sampleTag: sample.tagName,
      sampleTestId: sample.getAttribute?.("data-testid") ?? null,
      animationName: revealStyle.animationName,
      animationDuration: revealStyle.animationDuration,
      transitionDuration: style.transitionDuration,
      entryTransitionDuration: entryStyle.transitionDuration,
      entryTransform: entryStyle.transform,
      entryOpacity: entryStyle.opacity
    };
  }, SECOND_GREETING_PANEL_ID);

  return { navFocus, cardFocus, motionState };
}

async function sweepOverflow(page, viewName, width) {
  await page.setViewportSize({ width, height: 1100 });
  if (viewName !== "home") {
    await openView(page, viewName);
  }

  const snapshot = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return {
      rootScrollWidth: root.scrollWidth,
      rootClientWidth: root.clientWidth,
      bodyScrollWidth: body.scrollWidth,
      bodyClientWidth: body.clientWidth,
      overflowed: root.scrollWidth > root.clientWidth || body.scrollWidth > body.clientWidth
    };
  });

  return { viewName, width, ...snapshot };
}


async function collectSectionBackgroundState(page, sectionSlug) {
  return page.evaluate((slug) => {
    const testId = `section-view-${slug}`;
    const sectionNode = document.querySelector(`[data-testid="${testId}"]`);
    if (!sectionNode) {
      return {
        sectionSlug: slug,
        testId,
        found: false,
        hasBackgroundUrl: false,
        backgroundImage: null
      };
    }

    const computed = window.getComputedStyle(sectionNode);
    const backgroundImage = computed.backgroundImage ?? "";

    return {
      sectionSlug: slug,
      testId,
      found: true,
      hasBackgroundUrl: backgroundImage.includes("url("),
      backgroundImage
    };
  }, sectionSlug);
}

async function collectRouteBackgroundLeakState(page) {
  return page.evaluate(() => {
    const routeNodes = Array.from(document.querySelectorAll('[data-testid^="section-view-"]'));
    const archiveNode = document.querySelector('.page-panel--archive') ?? document.querySelector('[data-testid="archive-year-heading"]')?.closest('.page-panel--archive') ?? document.querySelector('[data-testid="archive-year-heading"]');
    const targets = [...routeNodes, archiveNode].filter(Boolean);

    return {
      found: Boolean(archiveNode),
      archiveSelector: archiveNode?.matches?.('.page-panel--archive') ? '.page-panel--archive' : archiveNode?.getAttribute?.('data-testid') === 'archive-year-heading' ? '[data-testid="archive-year-heading"]' : null,
      nodes: targets.map((node) => {
      const computed = window.getComputedStyle(node);
      return {
        testId: node.getAttribute('data-testid'),
        backgroundImage: computed.backgroundImage,
        backgroundColor: computed.backgroundColor
      };
      })
    };
  });
}

async function collectGlobalBackgroundState(page) {
  return page.evaluate(() => {
    const body = document.body;
    const appShell = document.querySelector('.app-shell');
    const bodyBefore = window.getComputedStyle(body, '::before');
    const bodyAfter = window.getComputedStyle(body, '::after');
    const shellStyle = appShell ? window.getComputedStyle(appShell) : null;

    const layers = [
      {
        name: 'body::before',
        content: bodyBefore.content,
        opacity: bodyBefore.opacity,
        pointerEvents: bodyBefore.pointerEvents,
        position: bodyBefore.position,
        zIndex: bodyBefore.zIndex,
        backgroundImage: bodyBefore.backgroundImage,
        backgroundBlendMode: bodyBefore.backgroundBlendMode
      },
      {
        name: 'body::after',
        content: bodyAfter.content,
        opacity: bodyAfter.opacity,
        pointerEvents: bodyAfter.pointerEvents,
        position: bodyAfter.position,
        zIndex: bodyAfter.zIndex,
        backgroundImage: bodyAfter.backgroundImage,
        backgroundBlendMode: bodyAfter.backgroundBlendMode
      }
    ];

    return {
      layers,
      shellIsolation: shellStyle?.isolation ?? null,
      shellPosition: shellStyle?.position ?? null,
      shellZIndex: shellStyle?.zIndex ?? null
    };
  });
}

async function collectProseReadabilityState(page) {
  return page.evaluate(() => {
    const article = document.querySelector('article.prose');
    if (!article) {
      return { found: false };
    }

    const articleStyle = window.getComputedStyle(article);
    const firstParagraph = article.querySelector('p');
    const paragraphStyle = firstParagraph ? window.getComputedStyle(firstParagraph) : null;
    const beforeStyle = window.getComputedStyle(article, '::before');
    const afterStyle = window.getComputedStyle(article, '::after');

    const paragraphFontSize = paragraphStyle ? Number.parseFloat(paragraphStyle.fontSize || '0') : 0;
    const paragraphLineHeight = paragraphStyle ? Number.parseFloat(paragraphStyle.lineHeight || '0') : 0;

    return {
      found: true,
      articleBackgroundColor: articleStyle.backgroundColor,
      articleBackgroundImage: articleStyle.backgroundImage,
      articleMixBlendMode: articleStyle.mixBlendMode,
      articlePosition: articleStyle.position,
      articleBeforeContent: beforeStyle.content,
      articleBeforeDisplay: beforeStyle.display,
      articleAfterContent: afterStyle.content,
      articleAfterDisplay: afterStyle.display,
      paragraphColor: paragraphStyle?.color ?? null,
      paragraphLineHeight: paragraphStyle?.lineHeight ?? null,
      paragraphFontSize: paragraphStyle?.fontSize ?? null,
      paragraphLineHeightRatio: paragraphFontSize > 0 ? paragraphLineHeight / paragraphFontSize : null
    };
  });
}

function createCheck(name, passed, details = {}) {
  return { name, passed, details };
}

function summarizeGroup(group) {
  const total = group.checks.length;
  const passed = group.checks.filter((check) => check.passed).length;
  return `${group.name}: ${group.passed ? 'passed' : 'failed'} (${passed}/${total})`;
}

export async function runVisualVerification() {
  const { browser, page, errors, consoleEntries } = await launchPage();
  const started = Date.now();
  try {
    const routeChecks = [];
    const archiveYearChecks = [];
    const articleNavigationChecks = [];
    const walineScopeChecks = [];
    const taglineChecks = [];
    const lowCountChecks = [];
    const onboardingChecks = [];
    const sectionScreenshots = [];
    const sectionBackgroundChecks = [];
    const musicChecks = [];
    const visitCounterChecks = [];
    const viewChecks = [];
    const transitionChecks = [];
    const greetingStackChecks = [];
    const backgroundLayerChecks = [];
    let archiveBackgroundLeakState = null;
    const readabilityChecks = [];
    const reducedMotionChecks = [];
    const consoleCleanlinessChecks = [];

    const initialState = await capturePageState(page);
    routeChecks.push(await verifyDirectRoute(browser, "/", { kind: "home" }));
    routeChecks.push(await verifyDirectRoute(browser, "/posts/petrified-corridor", { kind: "post", heading: "在石化走廊里记录一场缓慢失真" }));
    routeChecks.push(await verifyDirectRoute(browser, "/archive", { kind: "archive", heading: "归档页" }));
    routeChecks.push(await verifyDirectRoute(browser, "/sections/tech", { kind: "section", testId: "section-view-tech" }));
    routeChecks.push(await verifyDirectRoute(browser, "/sections/essay", { kind: "section", testId: "section-view-essay" }));
    routeChecks.push(await verifyDirectRoute(browser, "/sections/diary", { kind: "section", testId: "section-view-diary" }));
    routeChecks.push(await verifyDirectRoute(browser, "/sections/reading", { kind: "section", testId: "section-view-reading" }));
    routeChecks.push(await verifyDirectRoute(browser, "/sections/travel", { kind: "section", testId: "section-view-travel" }));
    routeChecks.push(await verifyDirectRoute(browser, "/sections/links", { kind: "section", testId: "section-view-links" }));
    routeChecks.push(await verifyDirectRoute(browser, "/about", { kind: "about", heading: "关于这座档案馆" }));
    routeChecks.push(await verifyDirectRoute(browser, "/__visual-unknown-route__", { kind: "not-found" }));

    articleNavigationChecks.push(await verifyDirectRoute(browser, "/posts/petrified-corridor", {
      kind: "post",
      heading: "在石化走廊里记录一场缓慢失真",
      expectedNavigation: {
        previousTitle: "志愿填报师不配叫老师",
        nextEmpty: true
      }
    }));
    articleNavigationChecks.push(await verifyDirectRoute(browser, "/posts/ashes-indexing", {
      kind: "post",
      heading: "灰烬中的目录学：如何为碎片命名",
      expectedNavigation: {
        previousTitle: "他所不希望的一切",
        nextEmpty: true
      }
    }));
    articleNavigationChecks.push(await verifyDirectRoute(browser, "/posts/quiet-machinery", {
      kind: "post",
      heading: "一台安静机器如何保存梦境残影",
      expectedNavigation: {
        previousTitle: "五月随笔",
        nextEmpty: true
      }
    }));

    walineScopeChecks.push(routeChecks[0].comments);
    walineScopeChecks.push(routeChecks[1].comments);
    walineScopeChecks.push(routeChecks[2].comments);
    walineScopeChecks.push(routeChecks[3].comments);
    walineScopeChecks.push(routeChecks[4].comments);
    walineScopeChecks.push(routeChecks[5].comments);
    walineScopeChecks.push(routeChecks[6].comments);
    walineScopeChecks.push(routeChecks[7].comments);
    walineScopeChecks.push(routeChecks[8].comments);
    walineScopeChecks.push(routeChecks[9].comments);
    walineScopeChecks.push(routeChecks[10].comments);

    const subtitleExpectations = [
      ["/", "home"],
      ["/sections/essay", "essay"],
      ["/sections/diary", "diary"],
      ["/sections/reading", "reading"],
      ["/sections/travel", "travel"],
      ["/sections/links", "links"],
      ["/sections/tech", "tech"],
      ["/archive", "home"],
      ["/about", "home"]
    ];

    for (const [path, expectedKey] of subtitleExpectations) {
      await goToPath(page, path);
      if (path === "/") {
        const gate = page.getByTestId("greeting-gate");
        if (await gate.isVisible().catch(() => false)) {
          await page.getByTestId("greeting-enter-home").click();
          await gate.waitFor({ state: "hidden", timeout: 10000 });
        }
      }

      const subtitle = await collectHeaderSubtitle(page);
      const activeSectionSlug = await collectActiveSectionSlug(page);
      taglineChecks.push({ path, expectedKey, subtitle, activeSectionSlug });

      assertCondition(
        subtitle === SECTION_TAGLINES[expectedKey],
        `Unexpected subtitle for ${path}`,
        { path, expectedKey, subtitle, activeSectionSlug, expected: SECTION_TAGLINES[expectedKey] }
      );
    }

    const sectionEntrancePaths = ["/sections/tech", "/sections/essay", "/sections/diary", "/sections/reading", "/sections/travel", "/sections/links"];
    for (const path of sectionEntrancePaths) {
      const slug = path.split("/").at(-1);
      await goToPath(page, path);
      const state = await collectSectionEntranceState(page, slug);
      lowCountChecks.push(state);
      assertCondition(state.cardCount <= 3, `Section representative count must be capped at three for ${slug}`, state);
      if (state.cardCount > 0) {
        assertCondition(state.hasCta === true, `Section CTA missing for ${slug}`, state);
        assertCondition(state.ctaText === "查看全部文章", `Section CTA text mismatch for ${slug}`, state);
      } else {
        assertCondition(state.hasCta === false, `Empty section should not show a CTA for ${slug}`, state);
      }
    }

    await goToPath(page, "/sections/tech");
    const lowCountSectionState = await collectSectionEntranceState(page, "tech");
    const techCollapsedState = await collectSectionToggleState(page, "tech");
    await page.getByTestId("section-all-posts-tech").click();
    await page.waitForFunction(() => document.querySelector('[data-testid="section-all-posts-tech"]')?.getAttribute('aria-expanded') === 'true', null, { timeout: 1000 });
    const techExpandedState = await collectSectionToggleState(page, "tech");
    assertCondition(techExpandedState.ctaExpanded === "true", "Tech section CTA should expand inline", techExpandedState);
    assertCondition(techExpandedState.ctaText === "收起", "Expanded section CTA text should switch to collapse action", techExpandedState);
    assertCondition(techExpandedState.sectionVisible === true && techExpandedState.listVisible === true, "Expanded section should remain on the section page", techExpandedState);

    await goToPath(page, "/sections/essay");
    const essayResetState = await collectSectionToggleState(page, "essay");
    assertCondition(essayResetState.ctaExpanded === "false", "Section CTA should reset when the section slug changes", essayResetState);
    assertCondition(essayResetState.ctaText === "查看全部文章", "Section CTA should return to the collapsed label after slug change", essayResetState);

    await saveEvidence("task-2-section-low-count.json", lowCountChecks);
    await saveEvidence("task-2-section-taglines.json", taglineChecks);
    await saveScreenshot("task-2-section-entrance.png", page);
    assertCondition(lowCountSectionState.cardCount <= 3, "Tech section should render only available representative posts", lowCountSectionState);

    viewChecks.push({ view: "home", state: initialState });

    const onboarding = await openRouteInFreshContext(browser, "/");
    try {
      const { page: onboardingPage, context: onboardingContext } = onboarding;
      const gateVisible = await onboardingPage.getByTestId("greeting-gate").isVisible().catch(() => false);
      assertCondition(gateVisible === true, "Greeting gate should be visible in a fresh home context", await collectOnboardingState(onboardingPage));

      const onboardingBefore = await collectOnboardingState(onboardingPage);
      onboardingChecks.push({ step: "initial-greeting", ...onboardingBefore });
      assertCondition(
        onboardingBefore.visiblePanelTestIds?.join(",") === FIRST_GREETING_PANEL_ID,
        "Greeting should start with only the first panel visible",
        onboardingBefore
      );
      assertCondition(
        onboardingBefore.enteringPanelTestIds?.length === 0,
        "Greeting should not start in an entering state",
        onboardingBefore
      );
      greetingStackChecks.push(createCheck("initial-panel-visible", true, onboardingBefore));
      sectionScreenshots.push({ view: "greeting", path: await saveScreenshot("visual-greeting-1440.png", onboardingPage) });
      await onboardingPage.getByTestId("greeting-gate").focus();
      await onboardingPage.keyboard.press("ArrowDown");
      const keyboardDownState = await collectOnboardingState(onboardingPage);
      onboardingChecks.push({ step: "panel-2", ...keyboardDownState });
      assertCondition(
        keyboardDownState.visiblePanelTestIds?.join(",") === [FIRST_GREETING_PANEL_ID, SECOND_GREETING_PANEL_ID].join(","),
        "ArrowDown should reveal the second panel without hiding the first",
        keyboardDownState
      );
      assertCondition(
        keyboardDownState.enteringPanelTestIds?.includes(SECOND_GREETING_PANEL_ID) === true,
        "ArrowDown should put the newly revealed panel into an entering state",
        keyboardDownState
      );
      greetingStackChecks.push(createCheck("arrow-down-reveals-panel-2", true, keyboardDownState));
      await onboardingPage.waitForFunction(
        (panelId) => document.querySelector(`[data-testid="${CSS.escape(panelId)}"]`)?.getAttribute('data-state') === 'active',
        SECOND_GREETING_PANEL_ID,
        { timeout: 1000 }
      );
      await onboardingPage.keyboard.press("ArrowDown");
      const keyboardDownFinalState = await collectOnboardingState(onboardingPage);
      onboardingChecks.push({ step: "panel-3", ...keyboardDownFinalState });
      assertCondition(
        keyboardDownFinalState.visiblePanelTestIds?.join(",") === GREETING_PANEL_IDS.join(","),
        "ArrowDown should reveal the full greeting stack in order",
        keyboardDownFinalState
      );
      assertCondition(
        keyboardDownFinalState.enteringPanelTestIds?.includes(THIRD_GREETING_PANEL_ID) === true,
        "Second reveal should also animate the newly entered panel",
        keyboardDownFinalState
      );
      greetingStackChecks.push(createCheck("arrow-down-reveals-panel-3", true, keyboardDownFinalState));
      await onboardingPage.waitForFunction(
        (panelId) => document.querySelector(`[data-testid="${CSS.escape(panelId)}"]`)?.getAttribute('data-state') === 'active',
        THIRD_GREETING_PANEL_ID,
        { timeout: 1000 }
      );
      await onboardingPage.keyboard.press("PageUp");
      const keyboardUpState = await collectOnboardingState(onboardingPage);
      onboardingChecks.push({ step: "panel-2-return", ...keyboardUpState });
      assertCondition(
        keyboardUpState.visiblePanelTestIds?.join(",") === GREETING_PANEL_IDS.join(","),
        "PageUp should move the active marker without hiding revealed panels",
        keyboardUpState
      );
      greetingStackChecks.push(createCheck("page-up-keeps-revealed-stack", true, keyboardUpState));
      await onboardingPage.mouse.wheel(0, 360);
      const wheelDownState = await collectOnboardingState(onboardingPage);
      onboardingChecks.push({ step: "panel-3-wheel-down", ...wheelDownState });
      assertCondition(
        wheelDownState.visiblePanelTestIds?.join(",") === GREETING_PANEL_IDS.join(","),
        "Wheel down should preserve the revealed stack",
        wheelDownState
      );
      greetingStackChecks.push(createCheck("wheel-down-keeps-revealed-stack", true, wheelDownState));
      await onboardingPage.keyboard.press("ArrowUp");
      const keyboardReturnState = await collectOnboardingState(onboardingPage);
      onboardingChecks.push({ step: "panel-2-return", ...keyboardReturnState });
      assertCondition(
        keyboardReturnState.visiblePanelTestIds?.join(",") === GREETING_PANEL_IDS.join(","),
        "ArrowUp should adjust the active marker without removing revealed entries",
        keyboardReturnState
      );
      greetingStackChecks.push(createCheck("arrow-up-keeps-revealed-stack", true, keyboardReturnState));
      await onboardingPage.mouse.wheel(0, -360);
      const wheelUpState = await collectOnboardingState(onboardingPage);
      onboardingChecks.push({ step: "panel-2-wheel-up", ...wheelUpState });
      assertCondition(
        wheelUpState.visiblePanelTestIds?.join(",") === GREETING_PANEL_IDS.join(","),
        "Wheel up should keep the stack visible while moving back",
        wheelUpState
      );
      greetingStackChecks.push(createCheck("wheel-up-keeps-revealed-stack", true, wheelUpState));
      await onboardingPage.getByTestId("greeting-next").click();
      const clickNextState = await collectOnboardingState(onboardingPage);
      onboardingChecks.push({ step: "panel-3-click", ...clickNextState });
      assertCondition(
        clickNextState.visiblePanelTestIds?.join(",") === GREETING_PANEL_IDS.join(","),
        "Next should preserve revealed history when returning to the final step",
        clickNextState
      );
      greetingStackChecks.push(createCheck("next-keeps-revealed-history", true, clickNextState));
      await onboardingPage.getByTestId("greeting-enter-home").click();
      await onboardingPage.getByTestId("greeting-gate").waitFor({ state: "hidden", timeout: 10000 });
      await onboardingPage.getByRole("heading", { name: "档案索引" }).waitFor({ state: "visible", timeout: 10000 });
      onboardingChecks.push({ step: "dismissed", ...(await collectOnboardingState(onboardingPage)) });
      greetingStackChecks.push(createCheck("enter-home-dismisses-gate", true, await collectOnboardingState(onboardingPage)));
      viewChecks.push({ view: "greeting", state: await capturePageState(onboardingPage) });
      await saveScreenshot("visual-home-1440.png", onboardingPage);
      assertCondition(onboarding.errors.length === 0, "Greeting flow reported page errors", { errors: onboarding.errors });
      assertCondition(onboarding.consoleEntries.length === 0, "Greeting flow reported console warnings/errors", { consoleEntries: onboarding.consoleEntries });
    } finally {
      await onboarding.context.close();
    }

    await openView(page, "home");
    await Promise.all([
      page.waitForFunction(() => document.querySelector('.route-stage')?.dataset.transitionState === 'transitioning', null, { timeout: 3000 }),
      page.getByTestId("nav-section-tech").click()
    ]);
    const routeTransitionStart = await collectTransitionState(page);
    assertCondition(routeTransitionStart?.transitionState === "transitioning", "Route transition state was not exposed immediately after navigation", routeTransitionStart);
    await page.getByTestId("section-view-tech").waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(700);
    const routeTransitionEnd = await collectTransitionState(page);
    assertCondition(routeTransitionEnd?.transitionState === "idle", "Route transition state did not clean up within the expected window", routeTransitionEnd);
    transitionChecks.push(createCheck("route-transition-state-cleans-up", true, { start: routeTransitionStart, end: routeTransitionEnd }));

    await page.getByTestId("nav-archive").click();
    await page.getByRole("heading", { name: "归档页" }).waitFor({ state: "visible", timeout: 10000 });
    const archiveInitialState = await collectArchiveYearState(page);
    archiveYearChecks.push({ step: "default", ...archiveInitialState });
    assertCondition(Boolean(archiveInitialState.heading), "Archive should default to the latest year", archiveInitialState);
    assertCondition(archiveInitialState.heading === archiveInitialState.label, "Archive year label should reflect the default year", archiveInitialState);
    assertCondition(archiveInitialState.previousDisabled === true && archiveInitialState.previousAriaDisabled === "true", "Newest archive year should disable previous navigation", archiveInitialState);
      assertCondition(archiveInitialState.nextDisabled === false && archiveInitialState.nextAriaDisabled === "false", "Newest archive year should keep next navigation enabled when older years exist", archiveInitialState);
      assertCondition(archiveInitialState.cards.length > 0, "Archive year page should show posts for the selected year", archiveInitialState);
      archiveBackgroundLeakState = await collectRouteBackgroundLeakState(page);
      assertCondition(archiveBackgroundLeakState.found === true, "Archive root not found for background leak check", archiveBackgroundLeakState);
      assertCondition(
        archiveBackgroundLeakState.nodes.every((entry) => entry.backgroundImage === 'none' || entry.backgroundImage.includes('greeting.png') === false),
        "Archive route should not inherit greeting background layers",
        archiveBackgroundLeakState
      );
      backgroundLayerChecks.push(createCheck("archive-route-does-not-inherit-greeting-background", archiveBackgroundLeakState.nodes.every((entry) => entry.backgroundImage === 'none' || entry.backgroundImage.includes('greeting.png') === false), archiveBackgroundLeakState));

      const archiveHeadings = [archiveInitialState.heading];
    let archiveCursorState = archiveInitialState;
    let archiveStep = 1;
    while (!archiveCursorState.nextDisabled) {
      await page.getByTestId("archive-year-next").click();
      archiveCursorState = await collectArchiveYearState(page);
      archiveYearChecks.push({ step: `year-${archiveStep}`, ...archiveCursorState });
      archiveHeadings.push(archiveCursorState.heading);
      assertCondition(Boolean(archiveCursorState.heading), `Archive year page ${archiveStep} should have a visible year heading`, archiveCursorState);
      assertCondition(archiveCursorState.heading === archiveCursorState.label, `Archive year label should match the heading on page ${archiveStep}`, archiveCursorState);
      assertCondition(archiveCursorState.cards.length > 0, `Archive year page ${archiveStep} should show posts for that year`, archiveCursorState);
      archiveStep += 1;
      if (archiveStep > 10) {
        throw new Error("Archive year pagination exceeded the expected safety limit");
      }
    }

    assertCondition(archiveHeadings.length >= 1, "Archive should expose at least one year", { archiveHeadings });
    assertCondition(new Set(archiveHeadings).size === archiveHeadings.length, "Archive should not repeat years while paginating", { archiveHeadings });
    assertCondition(archiveCursorState.previousDisabled === false && archiveCursorState.nextDisabled === true && archiveCursorState.nextAriaDisabled === "true", "Oldest archive year should disable next navigation", archiveCursorState);

    const markdownArticle = await openRouteInFreshContext(browser, "/posts/petrified-corridor");
    let markdownState = null;
    try {
      await markdownArticle.page.getByRole("heading", { name: "在石化走廊里记录一场缓慢失真" }).waitFor({ state: "visible", timeout: 10000 });
      markdownState = await collectMarkdownState(markdownArticle.page);
      assertCondition(markdownState.hasArticle, "Markdown article view did not render", markdownState);
      assertCondition(markdownState.title === "在石化走廊里记录一场缓慢失真", "Markdown article title did not render", markdownState);
      assertCondition(markdownState.headingCount >= 5, "Markdown article should render the expected markdown section headings", markdownState);
      assertCondition(markdownState.tocCount === 5, "Markdown article TOC count should match the five documented sections", markdownState);
      assertCondition(markdownState.listCount === 1, "Markdown article should render the TOC list in the right rail", markdownState);
      viewChecks.push({ view: "article", state: await capturePageState(markdownArticle.page) });
      sectionScreenshots.push({ view: "article", path: await saveScreenshot("visual-article-1440.png", markdownArticle.page) });
      readabilityChecks.push(createCheck("markdown-article-renders-structure", true, markdownState));
      assertCondition(markdownArticle.errors.length === 0, "Markdown article flow reported page errors", { errors: markdownArticle.errors });
      assertCondition(markdownArticle.consoleEntries.length === 0, "Markdown article flow reported console warnings/errors", { consoleEntries: markdownArticle.consoleEntries });
    } finally {
      await markdownArticle.context.close();
    }

    await openView(page, "archive");
    viewChecks.push({ view: "archive", state: await capturePageState(page) });
    sectionScreenshots.push({ view: "archive", path: await saveScreenshot("visual-archive-1440.png", page) });

    for (const sectionSlug of SECTION_SLUGS) {
      await openView(page, `section-${sectionSlug}`);
      const state = await capturePageState(page);
      viewChecks.push({ view: `section-${sectionSlug}`, state });
      sectionScreenshots.push({ view: `section-${sectionSlug}`, path: await saveScreenshot(`visual-section-${sectionSlug}-1440.png`, page) });
      const backgroundState = await collectSectionBackgroundState(page, sectionSlug);
      sectionBackgroundChecks.push(backgroundState);
      assertCondition(backgroundState.found === true, `Section root not found for ${sectionSlug}`, backgroundState);
      assertCondition(backgroundState.hasBackgroundUrl === true, `Section background image missing for ${sectionSlug}`, backgroundState);
    }
    backgroundLayerChecks.push(createCheck("section-background-images-retain-url-layers", sectionBackgroundChecks.every((check) => check.hasBackgroundUrl === true), { sectionBackgroundChecks }));

    const globalBackgroundState = await collectGlobalBackgroundState(page);
    const globalLayersVisible = globalBackgroundState.layers.filter((layer) => layer.content !== 'none' && layer.opacity !== '0').length;
    backgroundLayerChecks.push(createCheck(
      "global-background-has-generated-layers",
      globalLayersVisible >= 2,
      globalBackgroundState
    ));
    backgroundLayerChecks.push(createCheck(
      "global-decorative-layers-stay-behind-content",
      globalBackgroundState.layers.every((layer) => layer.pointerEvents === 'none' && Number.parseInt(layer.zIndex || '0', 10) < 0),
      globalBackgroundState
    ));

    await openView(page, "about");
    viewChecks.push({ view: "about", state: await capturePageState(page) });
    sectionScreenshots.push({ view: "about", path: await saveScreenshot("visual-about-1440.png", page) });

    await openView(page, "home");
    const homeReadyState = await capturePageState(page);
    viewChecks.push({ view: "home-ready", state: homeReadyState });

    const homeVisitCounterState = await collectVisitCounterState(page);
    visitCounterChecks.push({ path: "/", ...homeVisitCounterState });
    assertCondition(homeVisitCounterState.hasCounter === true, "Homepage visit counter should exist on /", homeVisitCounterState);
    assertCondition(homeVisitCounterState.scriptCount === 1, "Vercount script should be present exactly once", homeVisitCounterState);
    assertCondition(homeVisitCounterState.label === "本站总访问次数", "Homepage visit counter label mismatch", homeVisitCounterState);
    assertCondition(homeVisitCounterState.valueClass?.split(/\s+/).includes("vercount_value_site_pv") === true, "Homepage visit counter value class mismatch", homeVisitCounterState);

    for (const routePath of ["/archive", "/about", "/posts/petrified-corridor", "/sections/tech"]) {
      await goToPath(page, routePath);
      const routeCounterState = await collectVisitCounterState(page);
      visitCounterChecks.push({ path: routePath, ...routeCounterState });
      assertCondition(routeCounterState.hasCounter === false, `Homepage visit counter leaked into ${routePath}`, routeCounterState);
      assertCondition(routeCounterState.scriptCount === 1, `Vercount script count changed on ${routePath}`, routeCounterState);
    }

    await openView(page, "home");

    const musicCollapsedState = await collectMusicState(page);
    musicChecks.push({ step: "collapsed", ...musicCollapsedState });
    assertCondition(musicCollapsedState.toggleExpanded === "false", "Music easter egg should remain collapsed before expansion", musicCollapsedState);
    assertCondition(musicCollapsedState.panelVisible === false, "Music easter egg panel should not be visible before expansion", musicCollapsedState);
    assertCondition(musicCollapsedState.iframeCount === 0, "Music easter egg should not include a NetEase iframe before expansion", musicCollapsedState);

    await page.getByTestId("music-easter-egg-toggle").click();
    await page.getByTestId("music-easter-egg-panel").waitFor({ state: "visible", timeout: 10000 });
    const musicExpandedState = await collectMusicState(page);
    musicChecks.push({ step: "expanded", ...musicExpandedState });
    assertCondition(musicExpandedState.toggleExpanded === "true", "Music easter egg did not expand", musicExpandedState);
    assertCondition(musicExpandedState.panelVisible === true, "Music easter egg panel did not render", musicExpandedState);
    assertCondition(musicExpandedState.fallbackHref === MUSIC_FALLBACK_HREF, "Music fallback link href mismatch", musicExpandedState);
    assertMusicIframeContract(musicExpandedState, MUSIC_IFRAME_EXPECTATIONS);

    await saveScreenshot("visual-music-1440.png", page);

    const overflowChecks = [];
    const overflowViews = ["home", "article", "archive", ...SECTION_SLUGS.map((slug) => `section-${slug}`), "about"];
    for (const width of DEFAULT_VIEWPORTS) {
      for (const viewName of overflowViews) {
        const result = await sweepOverflow(page, viewName, width);
        overflowChecks.push(result);
        assertCondition(!result.overflowed, `Overflow detected for ${viewName} at ${width}px`, result);
      }
    }

    await page.setViewportSize({ width: 1440, height: 1100 });
    await openView(page, "home");

    await page.emulateMedia({ reducedMotion: "reduce" });
    const reducedMotionTransition = await collectTransitionState(page);
    assertCondition(reducedMotionTransition?.transitionDuration === "0s", "Route transition duration should be zero under reduced motion", reducedMotionTransition);
    assertCondition(reducedMotionTransition?.animationDuration === "0s", "Route transition animation duration should be zero under reduced motion", reducedMotionTransition);
    assertCondition(reducedMotionTransition?.animationName === "none", "Route transition animation name should be none under reduced motion", reducedMotionTransition);
    reducedMotionChecks.push(createCheck("route-stage-zero-motion", reducedMotionTransition?.transitionDuration === "0s" && reducedMotionTransition?.animationDuration === "0s" && reducedMotionTransition?.animationName === "none", reducedMotionTransition));
    const reducedMotionSample = await page.evaluate((secondGreetingPanelId) => {
      const stage = document.querySelector('.route-stage');
      const listSurface = document.querySelector('.archive-card, .archive-group button, .related-panel button, .side-panel-list button, .site-nav button, .greeting-gate__entry');
      const stageStyle = window.getComputedStyle(stage ?? document.body);
      const listStyle = window.getComputedStyle(listSurface ?? document.body);
      const entryStyle = window.getComputedStyle(document.querySelector(`[data-testid="${CSS.escape(secondGreetingPanelId)}"]`) ?? document.body);
      return {
        stageTransitionDuration: stageStyle.transitionDuration,
        stageAnimationName: stageStyle.animationName,
        listTransitionDuration: listStyle.transitionDuration,
        listAnimationName: listStyle.animationName,
        entryTransitionDuration: entryStyle.transitionDuration,
        entryTransform: entryStyle.transform,
        entryOpacity: entryStyle.opacity
      };
    }, SECOND_GREETING_PANEL_ID);
    assertCondition(reducedMotionSample.stageTransitionDuration === "0s", "Reduced motion route stage still transitions", reducedMotionSample);
    assertCondition(reducedMotionSample.listTransitionDuration === "0s", "Reduced motion list surface still transitions", reducedMotionSample);
    assertCondition(reducedMotionSample.stageAnimationName === "none", "Reduced motion route stage still animates", reducedMotionSample);
    assertCondition(reducedMotionSample.listAnimationName === "none", "Reduced motion list surface still animates", reducedMotionSample);
    assertCondition(reducedMotionSample.entryTransitionDuration === "0s", "Reduced motion greeting entry still transitions", reducedMotionSample);
    assertCondition(reducedMotionSample.entryTransform === "none", "Reduced motion greeting entry still transforms", reducedMotionSample);
    reducedMotionChecks.push(createCheck("surface-and-greeting-zero-motion", reducedMotionSample.stageTransitionDuration === "0s" && reducedMotionSample.listTransitionDuration === "0s" && reducedMotionSample.stageAnimationName === "none" && reducedMotionSample.listAnimationName === "none" && reducedMotionSample.entryTransitionDuration === "0s" && reducedMotionSample.entryTransform === "none", reducedMotionSample));
    await page.emulateMedia({ reducedMotion: "no-preference" });

    const focusAndMotion = await verifyFocusAndMotion(page);
    assertCondition(
      focusAndMotion.navFocus?.testId?.startsWith("nav-section-") === true,
      "Keyboard focus did not land on a section nav control",
      focusAndMotion
    );
    assertCondition(focusAndMotion.navFocus?.matchesFocusVisible === true, "Focused nav control is not matching :focus-visible", focusAndMotion);
    assertCondition(focusAndMotion.navFocus?.outlineStyle !== "none", "Focused nav control is missing a visible outline", focusAndMotion);
    assertCondition(focusAndMotion.navFocus?.outlineWidth !== "0px", "Focused nav control is missing outline width", focusAndMotion);
    assertCondition(
      focusAndMotion.navFocus?.outlineStyle !== "none" || focusAndMotion.navFocus?.boxShadow !== "none",
      "Focused nav control is missing visible focus indication",
      focusAndMotion
    );
    assertCondition(focusAndMotion.cardFocus?.testId === "archive-card-AR-2026-041", "Focused card target mismatch", focusAndMotion);
    assertCondition(focusAndMotion.cardFocus?.matchesFocusVisible === true, "Focused archive card is not matching :focus-visible", focusAndMotion);
    assertCondition(
      focusAndMotion.cardFocus?.outlineStyle !== "none" || focusAndMotion.cardFocus?.boxShadow !== "none",
      "Focused archive card lacks visible focus indication",
      focusAndMotion
    );
    assertCondition(focusAndMotion.motionState.animationName === "none", "Reduced motion still animates", focusAndMotion);
    assertCondition(focusAndMotion.motionState.animationDuration === "0s", "Reduced motion animation duration is not zero", focusAndMotion);
    assertCondition(focusAndMotion.motionState.transitionDuration === "0s", "Reduced motion still transitions", focusAndMotion);
    reducedMotionChecks.push(createCheck("focus-targets-remain-visible-under-reduced-motion", focusAndMotion.navFocus?.matchesFocusVisible === true && focusAndMotion.cardFocus?.matchesFocusVisible === true && focusAndMotion.motionState.animationName === "none" && focusAndMotion.motionState.animationDuration === "0s" && focusAndMotion.motionState.transitionDuration === "0s", focusAndMotion));

    await page.getByTestId("search-query").fill("冷光");
    await page.waitForFunction(() => document.querySelector('.route-stage')?.dataset.listTransitionState === 'refreshing', null, { timeout: 1000 });
    const searchState = await collectTransitionState(page);
    assertCondition(searchState?.listTransitionState === "refreshing", "Home filter/list refresh transition did not engage while typing", searchState);
    const searchInputValue = await page.getByTestId("search-query").inputValue();
    assertCondition(searchInputValue === "冷光", "Search query typing was delayed or desynchronized", { searchInputValue });
    const searchText = await page.locator("body").innerText();
    await page.getByTestId("search-query").fill("");
    await page.getByTestId("archive-card-AR-2026-041").click();
    const articleVisible = await page.getByRole("heading", { name: "在石化走廊里记录一场缓慢失真" }).isVisible();
    const interactions = {
      searchMatchedColdLight: searchText.includes("冷光线路"),
      articleVisible
    };
    assertCondition(interactions.searchMatchedColdLight, "Search flow failed to surface the expected post", interactions);
    assertCondition(interactions.articleVisible, "Article was not visible after opening it", interactions);
    transitionChecks.push(createCheck("search-input-remains-synchronous-while-list-refreshes", searchState?.listTransitionState === "refreshing" && searchInputValue === "冷光" && interactions.searchMatchedColdLight === true, { searchState, searchInputValue, interactions }));

    const proseReadabilityState = await collectProseReadabilityState(page);
    assertCondition(proseReadabilityState.found === true, "Markdown prose article was not found for readability checks", proseReadabilityState);
    assertCondition(proseReadabilityState.articleBackgroundImage === "none", "Prose article should not add a decorative background image", proseReadabilityState);
    assertCondition(proseReadabilityState.articleBeforeContent === "none" && proseReadabilityState.articleAfterContent === "none", "Prose article should not expose pseudo-element overlays", proseReadabilityState);
    assertCondition(proseReadabilityState.paragraphLineHeightRatio !== null && proseReadabilityState.paragraphLineHeightRatio >= 1.5, "Prose paragraph line-height is too tight for readable long-form text", proseReadabilityState);
    readabilityChecks.push(createCheck("prose-remains-calm-and-readable", proseReadabilityState.found === true && proseReadabilityState.articleBackgroundImage === "none" && proseReadabilityState.articleBeforeContent === "none" && proseReadabilityState.articleAfterContent === "none" && proseReadabilityState.paragraphLineHeightRatio !== null && proseReadabilityState.paragraphLineHeightRatio >= 1.5, proseReadabilityState));

    await openView(page, "archive");
    await openView(page, "section-tech");
    await openView(page, "about");

    assertCondition(errors.length === 0, "Main visual verification flow reported page errors", { errors });
    assertCondition(consoleEntries.length === 0, "Main visual verification flow reported console warnings/errors", { consoleEntries });
    consoleCleanlinessChecks.push(createCheck("main-flow-has-no-console-warnings-or-errors", consoleEntries.length === 0 && errors.length === 0, { errors, consoleEntries }));
    consoleCleanlinessChecks.push(createCheck("route-checks-have-no-console-warnings-or-errors", routeChecks.every((route) => Array.isArray(route.consoleEntries) && route.consoleEntries.length === 0), {
      routes: routeChecks.map((route) => ({ path: route.path, consoleEntries: route.consoleEntries }))
    }));

    const buildResult = await runBuild();
    assertCondition(buildResult.ok, "Build command failed during visual verification", buildResult);

    await saveEvidence("task-5-greeting-transition.json", {
      task: 5,
      focus: "greeting-enter-transition",
      passed: greetingStackChecks.every((check) => check.passed),
      checks: greetingStackChecks,
      onboarding: onboardingChecks,
      reducedMotion: reducedMotionChecks,
      build: { ok: buildResult.ok, code: buildResult.code }
    });

    await saveEvidence("task-5-no-background-flash.json", {
      task: 5,
      focus: "no-non-home-greeting-background-flash",
      passed: backgroundLayerChecks.every((check) => check.passed),
      archiveRouteLeakState: archiveBackgroundLeakState,
      backgroundLayerChecks,
      sectionBackgroundChecks,
      views: viewChecks.filter((entry) => ["archive", "section-tech", "about"].includes(entry.view))
    });

    const sectionEntrancePassed = lowCountChecks.length === SECTION_SLUGS.length && lowCountChecks.every((check) => check.cardCount <= 3 && (check.cardCount > 0 ? check.hasCta === true && check.ctaText === "查看全部文章" : check.hasCta === false)) && techCollapsedState.ctaExpanded === "false" && techExpandedState.ctaExpanded === "true" && techExpandedState.ctaText === "收起" && essayResetState.ctaExpanded === "false";
    const routeCommentScopePassed = routeChecks.every((route) => {
      if (route.kind === "post") {
        return route.comments?.commentsSectionPresent === true;
      }
      return route.comments?.commentsSectionPresent === false;
    });
    const articleNavigationCoveragePassed = articleNavigationChecks.length >= 3 && articleNavigationChecks.every((check) => Array.isArray(check.consoleEntries) && check.consoleEntries.length === 0 && check.comments?.commentsSectionPresent === true && (check.comments?.commentsContainerPresent === true || check.comments?.commentsDisabledPresent === true));
    const articleNavigationAndCommentsScopePassed = routeCommentScopePassed && articleNavigationCoveragePassed;
    const archiveYearPaginationPassed = archiveYearChecks.length >= 1;
    const greetingTransitionPassed = greetingStackChecks.every((check) => check.passed);
    const routeBackgroundFlashPassed = backgroundLayerChecks.every((check) => check.passed);
    const reducedMotionPassed = reducedMotionChecks.every((check) => check.passed);
    const overflowFocusConsoleCleanlinessPassed = overflowChecks.every((check) => check.overflowed === false) && focusAndMotion.navFocus?.matchesFocusVisible === true && focusAndMotion.cardFocus?.matchesFocusVisible === true && consoleCleanlinessChecks.every((check) => check.passed);

    const payload = {
      status: "ok",
      durationMs: Date.now() - started,
      errors,
      routeChecks,
      archiveYearChecks,
      articleNavigationChecks,
      walineScopeChecks,
      onboardingChecks,
      transitionChecks: {
        passed: transitionChecks.every((check) => check.passed),
        checks: transitionChecks
      },
      greetingStackChecks: {
        passed: greetingStackChecks.every((check) => check.passed),
        checks: greetingStackChecks
      },
      backgroundLayerChecks: {
        passed: backgroundLayerChecks.every((check) => check.passed),
        checks: backgroundLayerChecks
      },
      readabilityChecks: {
        passed: readabilityChecks.every((check) => check.passed),
        checks: readabilityChecks
      },
      reducedMotionChecks: {
        passed: reducedMotionChecks.every((check) => check.passed),
        checks: reducedMotionChecks
      },
      consoleCleanlinessChecks: {
        passed: consoleCleanlinessChecks.every((check) => check.passed),
        checks: consoleCleanlinessChecks
      },
      sectionScreenshots,
      sectionBackgroundChecks,
      taglineChecks,
      lowCountChecks,
      visitCounterChecks,
      musicChecks,
      viewChecks,
      overflowChecks,
      markdown: markdownState,
      focusAndMotion,
      interactions,
      buildSummary: {
        ok: buildResult.ok,
        code: buildResult.code,
        durationMs: buildResult.durationMs,
        stdout: buildResult.stdout,
        stderr: buildResult.stderr
      },
      selectedScopeGroups: {
        sectionEntrance: { passed: sectionEntrancePassed },
        articleNavigationAndCommentsScope: {
          passed: articleNavigationAndCommentsScopePassed
        },
        archiveYearPagination: { passed: archiveYearPaginationPassed },
        greetingTransition: { passed: greetingTransitionPassed },
        routeBackgroundFlash: { passed: routeBackgroundFlashPassed },
        reducedMotion: { passed: reducedMotionPassed },
        overflowFocusConsoleCleanliness: {
          passed: overflowFocusConsoleCleanlinessPassed
        }
      }
    };

    await saveEvidence("visual-verification.json", payload);
    await saveEvidence(
      "visual-verification-summary.md",
      [
        "# Visual verification summary",
        `- Route checks: /, /posts/petrified-corridor, /archive, /sections/tech, /sections/essay, /sections/diary, /sections/reading, /sections/travel, /sections/links, /about, unknown route passed`,
        `- Archive year checks: latest-year default, one-year pagination, and boundary disabling passed`,
        `- Article navigation checks: newest, middle, and oldest article boundary states passed`,
        `- Waline scope checks: article-only comments block rendered on article routes and stayed absent on non-article routes`,
        `- Onboarding checks: greeting panel traversal and dismissal passed`,
        `- Transition checks: ${summarizeGroup({ name: 'transitionChecks', passed: transitionChecks.every((check) => check.passed), checks: transitionChecks })}`,
        `- Greeting stack checks: ${summarizeGroup({ name: 'greetingStackChecks', passed: greetingStackChecks.every((check) => check.passed), checks: greetingStackChecks })}`,
        `- Background layer checks: ${summarizeGroup({ name: 'backgroundLayerChecks', passed: backgroundLayerChecks.every((check) => check.passed), checks: backgroundLayerChecks })}`,
        `- Readability checks: ${summarizeGroup({ name: 'readabilityChecks', passed: readabilityChecks.every((check) => check.passed), checks: readabilityChecks })}`,
        `- Reduced-motion checks: ${summarizeGroup({ name: 'reducedMotionChecks', passed: reducedMotionChecks.every((check) => check.passed), checks: reducedMotionChecks })}`,
        `- Console cleanliness checks: ${summarizeGroup({ name: 'consoleCleanlinessChecks', passed: consoleCleanlinessChecks.every((check) => check.passed), checks: consoleCleanlinessChecks })}`,
        `- Section screenshots: ${sectionScreenshots.map((item) => item.view).join(", ")}`,
        `- Section background checks: ${sectionBackgroundChecks.length} section routes expose computed background-image URLs`,
        `- Section CTA toggle: tech expands inline, flips to 收起, and resets collapsed state on section change`,
        `- Visit counter checks: homepage counter DOM/script contract passed and stayed absent on archive/about/post/tech routes`,
        `- Music checks: collapsed state has no iframe; expanded state mounts one non-autoplay NetEase iframe with the expected song params and fallback link`,
        `- Route transition state: visible then cleaned within 700ms on section/archive navigation`,
        `- Viewport sweep: ${overflowChecks.length} checks passed across ${DEFAULT_VIEWPORTS.join(", ")}px`,
        `- Focus check: ${focusAndMotion.navFocus?.text ?? "unknown"} (${focusAndMotion.navFocus?.testId ?? "no-testid"}) matched :focus-visible with outline ${focusAndMotion.navFocus?.outlineStyle ?? "unknown"}`,
        `- Reduced motion: animation=${focusAndMotion.motionState.animationName}, duration=${focusAndMotion.motionState.animationDuration}, transition=${focusAndMotion.motionState.transitionDuration}`,
        `- Interaction flow: search/article/archive/section/about all passed`,
        `- Markdown checks: headings, blockquote, code, list, table, TOC passed`,
        `- Selected scope pass groups: sectionEntrance=${payload.selectedScopeGroups.sectionEntrance.passed}, articleNavigationAndCommentsScope=${payload.selectedScopeGroups.articleNavigationAndCommentsScope.passed}, archiveYearPagination=${payload.selectedScopeGroups.archiveYearPagination.passed}, greetingTransition=${payload.selectedScopeGroups.greetingTransition.passed}, routeBackgroundFlash=${payload.selectedScopeGroups.routeBackgroundFlash.passed}, reducedMotion=${payload.selectedScopeGroups.reducedMotion.passed}, overflowFocusConsoleCleanliness=${payload.selectedScopeGroups.overflowFocusConsoleCleanliness.passed}`,
        `- Build: passed in ${buildResult.durationMs}ms`
      ].join("\n")
    );

    await openView(page, "home");
    await page.setViewportSize({ width: 375, height: 812 });
    await saveScreenshot("task-6-mobile-smoke.png", page);

    const noRegressions = Object.values(payload.selectedScopeGroups).every((group) => group.passed === true)
      && payload.transitionChecks.passed
      && payload.greetingStackChecks.passed
      && payload.backgroundLayerChecks.passed
      && payload.readabilityChecks.passed
      && payload.reducedMotionChecks.passed
      && payload.consoleCleanlinessChecks.passed;

    await saveEvidence("task-6-full-regression.json", {
      task: 6,
      status: "ok",
      noRegressions,
      durationMs: payload.durationMs,
      selectedScopeGroups: payload.selectedScopeGroups,
      namedPassGroups: {
        transitionChecks: payload.transitionChecks.passed,
        greetingStackChecks: payload.greetingStackChecks.passed,
        backgroundLayerChecks: payload.backgroundLayerChecks.passed,
        readabilityChecks: payload.readabilityChecks.passed,
        reducedMotionChecks: payload.reducedMotionChecks.passed,
        consoleCleanlinessChecks: payload.consoleCleanlinessChecks.passed
      },
      artifactPointers: {
        visualVerificationJson: "visual-verification.json",
        visualVerificationSummary: "visual-verification-summary.md",
        mobileSmokePng: "task-6-mobile-smoke.png",
        sectionToggleEvidence: "task-2-section-low-count.json"
      }
    });
    await saveEvidence(
      "build-summary.txt",
      [
        `build ok: ${buildResult.ok}`,
        `exit code: ${buildResult.code}`,
        `duration ms: ${buildResult.durationMs}`,
        "stdout:",
        buildResult.stdout || "(empty)",
        "stderr:",
        buildResult.stderr || "(empty)"
      ].join("\n")
    );

    console.log(JSON.stringify(payload, null, 2));
  } catch (error) {
    const payload = {
      status: "failed",
      durationMs: Date.now() - started,
      message: error.message,
      details: error.details ?? null,
      errors
    };
    await saveEvidence("visual-verification.json", payload);
    console.error(JSON.stringify(payload, null, 2));
    throw error;
  } finally {
    await browser.close();
  }
}
