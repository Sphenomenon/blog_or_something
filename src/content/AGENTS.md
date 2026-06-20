# CONTENT KNOWLEDGE

## OVERVIEW

`src/content` is source-controlled CMS/content input for the Vite React app. Markdown and YAML are loaded by custom project code, not by Astro, MDX, or a headless CMS runtime.

## WHERE TO LOOK

| Task | Location | Notes |
|---|---|---|
| Post authoring rules | `README.md`, `posts/*.md` | Runtime validates frontmatter in `src/data/content.js`. |
| Section metadata | `sections/*.yaml` | Loaded/sorted by `src/data/yaml-loader.js`; backgrounds rewritten by `src/data/sections.js`. |
| Site/header/archive/404 copy | `site.yaml` | Many keys are consumed directly by views/components. |
| Greeting gate copy | `greeting.yaml` | Panels require `id`, `title`, `body`; image path is currently hardcoded in component CSS style. |
| About page | `about.yaml` | Requires title/lead/body/design-system entries. |
| Music player | `music.yaml` | Uses NetEase embed URL; no autoplay behavior. |
| Friend links | `links.yaml` | Rendered only by `/sections/links`. |
| Food places | `food-places/*.yaml` | Feature-specific rules live in `../features/food-map/AGENTS.md`. |
| CMS field schema | `../../public/admin/config.yml` | Keep schema aligned with loaders. |

## POST FRONTMATTER

Required fields:

```yaml
id: AR-2026-999
slug: example-post
title: Example title
excerpt: Short summary.
date: 2026-05-21
section: essay
status: Draft
reading: 3 min
```

Optional fields:

```yaml
tags: [example, notes]
category: Example
sections: [前言, 正文]
```

Rules enforced by `src/data/content.js`:

- File must start with `---` and close frontmatter with `---`.
- `date` must be `YYYY-MM-DD` and a real calendar day.
- `slug` must be unique across all posts.
- `section` must exist in `src/content/sections/*.yaml`.
- `tags` defaults to `[]`; `sections` defaults to `[正文]`; `category` defaults to empty string.
- Posts sort by date descending, then slug ascending.
- Inline arrays (`[a, b]`) and YAML block lists are both accepted for `tags`/`sections`.

## SECTION YAML

Current slugs: `tech`, `essay`, `diary`, `reading`, `travel`, `links`.

Required by loader: `slug`, `label`, `intro`, `background`. Current files also use `shortLabel`, `subtitle`, `order`, `theme`, `navKicker`.

Background convention:

- Author raw filenames such as `tech.png` or `travel.jpg`.
- Raw files live in `../../backgrounds/`.
- Runtime consumes `/images/optimized/<basename>.webp` after `npm run optimize-images`.

## SINGLETON YAML

- `site.yaml`: broad UI copy; changing keys can break header/home/archive/404 views.
- `greeting.yaml`: non-empty `panels`; each panel needs stable `id` values used as DOM ids/testids.
- `about.yaml`: `design_system` entries need `term` + `description`.
- `music.yaml`: preserve `embed_url`; component forces NetEase player `auto=0`.
- `links.yaml`: each link uses `name`, `url`, `logo`, `description`.

## ANTI-PATTERNS

- Do not add Astro `defineCollection`, MDX, gray-matter, or a generic CMS runtime without replacing the existing loaders intentionally.
- Do not edit section slugs casually; routes, posts, nav, and CMS select options depend on them.
- Do not assume `links` is a normal post section; `SectionView.jsx` special-cases it for friend links.
- Do not reference `backgrounds/` directly from browser UI; use optimized public URLs.
- Do not convert CMS post body back to a markdown widget; `public/admin/config.yml` intentionally uses `Body (纯文本)` as text.
