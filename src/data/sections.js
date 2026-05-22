import { sections as yamlSections } from "./yaml-loader.js";

const sections = yamlSections.map((sec) => ({
  ...sec,
  background: new URL(`../../backgrounds/${sec.background}`, import.meta.url).href,
}));

const sectionsBySlug = new Map(sections.map((section) => [section.slug, section]));

export function getSectionBySlug(slug) {
  return sectionsBySlug.get(slug) ?? null;
}

export { sections, sections as SECTION_REGISTRY };
