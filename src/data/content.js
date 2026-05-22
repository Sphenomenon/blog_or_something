import { getSectionBySlug, SECTION_REGISTRY } from "./sections.js";

const allowedSections = new Set(SECTION_REGISTRY.map((s) => s.slug));
const requiredFields = ["id", "slug", "title", "excerpt", "date", "section", "status", "reading"];

function comparePosts(left, right) {
  const dateDiff = right.date.localeCompare(left.date);
  if (dateDiff !== 0) return dateDiff;
  return left.slug.localeCompare(right.slug);
}

function fail(filePath, message) {
  throw new Error(`[content] ${filePath}: ${message}`);
}

function parseArray(value, key, filePath) {
  const trimmed = value.trim();
  if (trimmed === "") {
    return [];
  }

  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    fail(filePath, `field \"${key}\" must be an array literal like [a, b]`);
  }

  const inner = trimmed.slice(1, -1).trim();
  if (!inner) {
    return [];
  }

  return inner
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^"(.+)"$/, "$1").replace(/^'(.+)'$/, "$1"));
}

function parseFrontmatter(raw, filePath) {
  if (!raw.startsWith("---\n")) {
    fail(filePath, "missing frontmatter opening delimiter ---");
  }

  const endIndex = raw.indexOf("\n---\n", 4);
  if (endIndex === -1) {
    fail(filePath, "missing frontmatter closing delimiter ---");
  }

  const block = raw.slice(4, endIndex);
  const content = raw.slice(endIndex + 5).trim();

  const frontmatter = {};
  const lines = block.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf(":");
    if (separator === -1) {
      fail(filePath, `invalid frontmatter line \"${line}\"`);
    }

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();

    if (!key) {
      fail(filePath, `invalid frontmatter key in line \"${line}\"`);
    }

    frontmatter[key] = rawValue;
  }

  return { frontmatter, content };
}

function validateIsoDate(value, filePath) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail(filePath, `date must use ISO format YYYY-MM-DD, got \"${value}\"`);
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    fail(filePath, `date is invalid: \"${value}\"`);
  }

  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
    fail(filePath, `date is not a valid calendar day: \"${value}\"`);
  }

  return { year: yearText, month: monthText };
}

function validateAndNormalizeEntry(filePath, frontmatter, content, seenSlugs) {
  for (const field of requiredFields) {
    if (!(field in frontmatter) || frontmatter[field] === "") {
      fail(filePath, `missing required field \"${field}\"`);
    }
  }

  const slug = frontmatter.slug;
  if (seenSlugs.has(slug)) {
    fail(filePath, `duplicate slug \"${slug}\"`);
  }
  seenSlugs.add(slug);

  const section = frontmatter.section;
  if (!allowedSections.has(section)) {
    fail(filePath, `section must be one of ${Array.from(allowedSections).join("|")}, got \"${section}\"`);
  }

  if (!getSectionBySlug(section)) {
    fail(filePath, `section \"${section}\" does not exist in section registry`);
  }

  const { year, month } = validateIsoDate(frontmatter.date, filePath);

  const tags = "tags" in frontmatter ? parseArray(frontmatter.tags, "tags", filePath) : [];
  const sections = "sections" in frontmatter ? parseArray(frontmatter.sections, "sections", filePath) : ["正文"];

  return {
    id: frontmatter.id,
    slug,
    title: frontmatter.title,
    excerpt: frontmatter.excerpt,
    date: frontmatter.date,
    tags,
    status: frontmatter.status,
    reading: frontmatter.reading,
    category: frontmatter.category ?? "",
    year,
    month,
    sections,
    section,
    content
  };
}

const markdownModules = import.meta.glob("../content/posts/*.md", {
  query: "?raw",
  import: "default",
  eager: true
});

if (!Object.keys(markdownModules).length) {
  throw new Error("[content] no markdown posts found in src/content/posts/*.md");
}

const seenSlugs = new Set();

export const posts = Object.entries(markdownModules)
  .map(([filePath, raw]) => {
    if (typeof raw !== "string") {
      fail(filePath, "raw markdown module did not return a string");
    }

    const { frontmatter, content } = parseFrontmatter(raw, filePath);
    return validateAndNormalizeEntry(filePath, frontmatter, content, seenSlugs);
  })
  .sort(comparePosts);

export const sortedPosts = posts;

export function getSectionRepresentativePosts(sectionSlug, limit = 3) {
  if (!sectionSlug) {
    return [];
  }

  return sortedPosts.filter((post) => post.section === sectionSlug).slice(0, limit);
}

export function getArticleNeighbors(slug, sectionSlug) {
  const pool = sectionSlug
    ? sortedPosts.filter((post) => post.section === sectionSlug)
    : sortedPosts;
  const index = pool.findIndex((post) => post.slug === slug);
  if (index === -1) {
    return { previous: null, next: null };
  }

  return {
    previous: pool[index - 1] ?? null,
    next: pool[index + 1] ?? null
  };
}

export function getArchiveYears() {
  const years = new Set();

  for (const post of sortedPosts) {
    years.add(post.year);
  }

  return Array.from(years).sort((left, right) => right.localeCompare(left));
}

export function getArchivePostsByYear(year) {
  return sortedPosts.filter((post) => post.year === year);
}

export function normalizeCanonicalArticleCommentPath(pathname) {
  const withoutQuery = String(pathname || "").split("?")[0].split("#")[0];
  if (withoutQuery === "") {
    return "/";
  }

  if (withoutQuery === "/") {
    return "/";
  }

  return withoutQuery.replace(/\/+$/, "");
}
