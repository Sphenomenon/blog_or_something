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
