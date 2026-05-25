import site from "../content/site.yaml";
import greeting from "../content/greeting.yaml";
import about from "../content/about.yaml";
import music from "../content/music.yaml";

function fail(msg) {
  throw new Error(`[yaml-loader] ${msg}`);
}

// ── Sections ────────────────────────────────────────────────────────────

const sectionsGlob = import.meta.glob("../content/sections/*.yaml", {
  eager: true,
});

function unwrapYamlModule(module) {
  return module?.default ?? module;
}

const sectionObjects = Object.values(sectionsGlob).map(unwrapYamlModule);

if (!sectionObjects.length) {
  fail("no section YAML files found via glob");
}

const seenSectionSlugs = new Set();

for (const sec of sectionObjects) {
  if (!sec.slug || typeof sec.slug !== "string" || sec.slug.trim() === "") {
    fail(`section missing required field "slug"`);
  }
  if (seenSectionSlugs.has(sec.slug)) {
    fail(`duplicate section slug "${sec.slug}"`);
  }
  seenSectionSlugs.add(sec.slug);

  if (!sec.label || typeof sec.label !== "string" || sec.label.trim() === "") {
    fail(`section "${sec.slug}" missing required field "label"`);
  }
  if (
    !sec.intro ||
    typeof sec.intro !== "string" ||
    sec.intro.trim() === ""
  ) {
    fail(`section "${sec.slug}" missing required field "intro"`);
  }
  if (
    !sec.background ||
    typeof sec.background !== "string" ||
    sec.background.trim() === ""
  ) {
    fail(`section "${sec.slug}" missing required field "background"`);
  }
}

const sections = [...sectionObjects].sort(
  (left, right) => (left.order ?? 0) - (right.order ?? 0)
);

// ── Greeting ────────────────────────────────────────────────────────────

if (!greeting.greeting_title || typeof greeting.greeting_title !== "string") {
  fail('greeting missing required field "greeting_title"');
}
if (
  !greeting.greeting_kicker ||
  typeof greeting.greeting_kicker !== "string"
) {
  fail('greeting missing required field "greeting_kicker"');
}
if (!Array.isArray(greeting.panels) || greeting.panels.length === 0) {
  fail('greeting missing required field "panels" (must be non-empty array)');
}
for (let i = 0; i < greeting.panels.length; i++) {
  const panel = greeting.panels[i];
  if (!panel.id || typeof panel.id !== "string" || panel.id.trim() === "") {
    fail(`greeting.panels[${i}] missing required field "id"`);
  }
  if (
    !panel.title ||
    typeof panel.title !== "string" ||
    panel.title.trim() === ""
  ) {
    fail(`greeting.panels[${i}] missing required field "title"`);
  }
  if (
    !panel.body ||
    typeof panel.body !== "string" ||
    panel.body.trim() === ""
  ) {
    fail(`greeting.panels[${i}] missing required field "body"`);
  }
}

// ── About ───────────────────────────────────────────────────────────────

if (!about.page_title || typeof about.page_title !== "string") {
  fail('about missing required field "page_title"');
}
if (!about.lead_text || typeof about.lead_text !== "string") {
  fail('about missing required field "lead_text"');
}
if (!about.body_text || typeof about.body_text !== "string") {
  fail('about missing required field "body_text"');
}
if (
  !Array.isArray(about.design_system) ||
  about.design_system.length === 0
) {
  fail('about missing required field "design_system" (must be non-empty array)');
}
for (let i = 0; i < about.design_system.length; i++) {
  const entry = about.design_system[i];
  if (
    !entry.term ||
    typeof entry.term !== "string" ||
    entry.term.trim() === ""
  ) {
    fail(`about.design_system[${i}] missing required field "term"`);
  }
  if (
    !entry.description ||
    typeof entry.description !== "string" ||
    entry.description.trim() === ""
  ) {
    fail(`about.design_system[${i}] missing required field "description"`);
  }
}

// ── Site ────────────────────────────────────────────────────────────────

if (!site.site_title || typeof site.site_title !== "string") {
  fail('site missing required field "site_title"');
}

// ── Music ───────────────────────────────────────────────────────────────

if (!music.title || typeof music.title !== "string") {
  fail('music missing required field "title"');
}

// ── Exports ─────────────────────────────────────────────────────────────

export { sections, site, greeting, about, music };
