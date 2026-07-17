# Content authoring

Put post files in `src/content/posts/*.md`. The runtime loads every markdown file there, validates frontmatter in `src/data/content.js`, and sorts posts by `date`.

## Required frontmatter

Every post must define these fields.

1. `id`
2. `slug`
3. `title`
4. `excerpt`
5. `date`
6. `section`
7. `status`
8. `reading`

Field rules:

1. `id`, `slug`, `title`, `excerpt`, `status`, and `reading` must be non empty strings.
2. `date` must use `YYYY-MM-DD` and be a real calendar day.
3. `section` must be one of `tech`, `essay`, `diary`, `reading`, `travel`, `links`.
4. `section` must also exist in `src/data/sections.js`.

## Optional frontmatter

1. `tags` is optional. When present, it must be an array literal such as `[a, b]`.
2. `category` is optional. It is stored as a plain string.
3. `sections` is optional. When present, it must be an array literal such as `[前言, 结构层]`.
4. If `sections` is omitted, the runtime uses `[正文]`.

## Section registry

Section labels, order, themes, intro copy, and background asset paths live in `src/data/sections.js`. That file is the source of truth for section metadata and the canonical slug list above.

Background assets live in `backgrounds/` and are referenced from the section registry.

## Deferred features

Comments, login, CMS integration, and Decap admin paths are future options only. They are not implemented here and should not be added as part of normal post authoring.

## Add a new post

1. Create one new markdown file in `src/content/posts/`.
2. Add valid frontmatter and post body.
3. Rebuild the site.

That is all the runtime needs.

## Minimal template

```md
---
id: AR-2026-999
slug: example-post
title: Example post title
excerpt: Short summary of the post.
date: 2026-05-21
section: essay
status: Draft
reading: 3 min
tags: [example, notes]
category: Example
sections: [前言, 正文]
---

## 前言

Write the post body here.
```

## Article images

Images in post bodies follow a block-only grammar. Inline `![alt](url)` inside prose lines is **not** supported. Every image must occupy its own line or live inside a directive block. The parser emits exact file and line diagnostics during `npm run dev` / `npm run build`.

### Upload and format

- Place local images under `public/images/uploads/`.
- Reference them with an absolute path starting `/images/uploads/`, for example `/images/uploads/travel/station.jpg`.
- Supported formats: `.jpg`, `.jpeg`, `.png`, `.webp` (static).
- `npm run dev` and `npm run build` automatically generate responsive WebP derivatives and a manifest that the renderer consumes.
- After adding or replacing an upload source, restart an already-running dev server. The generator does not watch.

### Standard images

A standalone image with required alt text and optional caption. It displays at natural ratio within the prose column.

```md
![Alt text describing the image](/images/uploads/travel/market.jpg "Optional visible caption")
```

### Wide images

Break beyond the prose measure on desktop (≥769 px) while staying inside the article card. On mobile they behave like standard images.

```md
:::image wide
![Alt text](/images/uploads/travel/panorama.jpg)
:::
```

### Panorama images

Cropped to 21:9 with an optional focal point so the most important part stays in frame. Only `panorama` uses `object-fit: cover`; all other modes preserve natural ratio.

```md
:::image panorama focal=73%,31%
![Alt text](/images/uploads/travel/wide-landscape.jpg "Caption for a focal crop")
:::
```

`focal` values use CSS percentage notation. If omitted, the centre of the image (`50%,50%`) is used. Only `panorama` accepts `focal`; putting it on `wide` or standard is an error.

### Galleries

Explicit groups of 2–6 images rendered in a responsive grid: one column below 768 px, two columns at 768 px and above. Images keep natural ratio and captions are supported per image.

```md
:::gallery
![First image](/images/uploads/travel/cafe.jpg "Café interior")
![Second image](/images/uploads/travel/coffee.jpg)
:::
```

### Remote images

HTTPS URLs from external hosts are allowed. They are never fetched or optimised at build time — the authored URL is used directly.

```md
![External photo](https://example.com/photos/landscape.jpg "Courtesy of Example")
```

### Opening the viewer

Every article image can be opened in an accessible full-screen dialog (native `<dialog>`) by clicking or pressing Enter/Space on it. Focus is trapped inside, Escape or the close button dismisses it, and scrolling is locked. Gallery images additionally support Previous/Next keyboard navigation (Left/Right arrows) so readers can browse the group without leaving the viewer.

### Invalid syntax

The parser rejects these forms with `ARTICLE_MEDIA_*` diagnostics that include the source file and exact line number.

| Invalid input | Diagnostic code |
|---|---|
| `![inline](/images/uploads/x.jpg) prose` on the same line | `ARTICLE_MEDIA_INLINE_WITH_PROSE` |
| `![]()` (missing alt) | `ARTICLE_MEDIA_ALT_REQUIRED` |
| `:::image unknown` (unsupported mode) | `ARTICLE_MEDIA_DIRECTIVE_UNKNOWN_MODE` |
| `:::image wide focal=50%,50%` (focal on non-panorama) | `ARTICLE_MEDIA_FOCAL_ON_WIDE` |
| `:::image panorama focal=120%,0%` (out of range) | `ARTICLE_MEDIA_FOCAL_OUT_OF_RANGE` |
| `:::gallery` with 1 or 7+ images | `ARTICLE_MEDIA_GALLERY_COUNT` |
| `/images/uploads/x.jpg?q=1` or `#frag` | `ARTICLE_MEDIA_URL_LOCAL_SUFFIX` |
| `data:…`, `blob:…`, `file:…`, `javascript:…` | `ARTICLE_MEDIA_URL_UNSUPPORTED_SCHEME` |
| Relative paths, `..`, protocol-relative `//` | `ARTICLE_MEDIA_URL_NOT_CANONICAL` / `ARTICLE_MEDIA_URL_PROTOCOL_RELATIVE` |

### Notes

- Panorama is the **only** mode that crops. Standard, wide, and gallery images are never clipped.
- Galleries are always expanded in the article; they do not collapse, carousel, or masonry.
- The lightbox viewer is supplementary — no content relies on it to be understood.
- Remote images lack intrinsic dimensions before they load; the browser cannot reserve space the way it does for locally resolved variants.
