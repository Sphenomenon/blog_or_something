import { sections as yamlSections } from "./yaml-loader.js";

const sections = yamlSections.map((sec) => ({
  ...sec,
  background: `/images/optimized/${sec.background.replace(/\.(png|jpg|jpeg)$/i, '.webp')}`,
}));

const sectionsBySlug = new Map(sections.map((section) => [section.slug, section]));

export function getSectionBySlug(slug) {
  return sectionsBySlug.get(slug) ?? null;
}

export { sections, sections as SECTION_REGISTRY };
