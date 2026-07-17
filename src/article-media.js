const IMAGE_LINE_PATTERN = /^!\[([^\]\n]*)\]\(([^\s)]+)(?:\s+"([^"\n]*)")?\)$/;
const IMAGE_MARKER_PATTERN = /!\[[^\n]*\]\([^\n]*\)/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const MALFORMED_PERCENT_PATTERN = /%(?![0-9a-f]{2})/i;
const ENCODED_SEPARATOR_PATTERN = /%(?:2f|5c)/i;

function createError(source, line, code, message) {
  return { source, line, code, message };
}

function hasTraversal(pathname) {
  return pathname.split(/[\\/]/).some((segment) => segment === "." || segment === "..");
}

function validateEncodedUrl(value, source, line) {
  if (MALFORMED_PERCENT_PATTERN.test(value)) {
    return createError(source, line, "ARTICLE_MEDIA_URL_MALFORMED_ENCODING", "Image URL contains malformed percent encoding.");
  }

  if (ENCODED_SEPARATOR_PATTERN.test(value)) {
    return createError(source, line, "ARTICLE_MEDIA_URL_ENCODED_SEPARATOR", "Image URL must not contain an encoded slash or backslash.");
  }

  let decoded;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return createError(source, line, "ARTICLE_MEDIA_URL_MALFORMED_ENCODING", "Image URL contains malformed percent encoding.");
  }

  if (CONTROL_CHARACTER_PATTERN.test(decoded)) {
    return createError(source, line, "ARTICLE_MEDIA_URL_CONTROL_CHARACTER", "Image URL must not contain control characters.");
  }

  if (hasTraversal(decoded)) {
    return createError(source, line, "ARTICLE_MEDIA_URL_TRAVERSAL", "Image URL must not contain path traversal segments.");
  }

  return null;
}

export function canonicalizeArticleMediaUrl(value, options = {}) {
  const source = options.source ?? "<article>";
  const line = options.line ?? 1;

  if (typeof value !== "string" || value.length === 0) {
    return {
      ok: false,
      error: createError(source, line, "ARTICLE_MEDIA_URL_REQUIRED", "Image URL must not be empty.")
    };
  }

  if (CONTROL_CHARACTER_PATTERN.test(value)) {
    return {
      ok: false,
      error: createError(source, line, "ARTICLE_MEDIA_URL_CONTROL_CHARACTER", "Image URL must not contain control characters.")
    };
  }

  const encodedError = validateEncodedUrl(value, source, line);
  if (encodedError) {
    return { ok: false, error: encodedError };
  }

  if (value.startsWith("/images/uploads/")) {
    if (value === "/images/uploads/") {
      return {
        ok: false,
        error: createError(source, line, "ARTICLE_MEDIA_URL_REQUIRED", "Local upload URL must identify a file under /images/uploads/.")
      };
    }

    if (value.includes("?") || value.includes("#")) {
      return {
        ok: false,
        error: createError(source, line, "ARTICLE_MEDIA_URL_LOCAL_SUFFIX", "Local upload URLs must not contain a query string or fragment.")
      };
    }

    if (value.includes("\\") || value.includes("//") || hasTraversal(value)) {
      return {
        ok: false,
        error: createError(source, line, "ARTICLE_MEDIA_URL_NOT_CANONICAL", "Local upload URL must use a canonical /images/uploads/... path.")
      };
    }

    return { ok: true, source: value, sourceType: "local" };
  }

  if (value.startsWith("//")) {
    return {
      ok: false,
      error: createError(source, line, "ARTICLE_MEDIA_URL_PROTOCOL_RELATIVE", "Protocol-relative image URLs are not allowed.")
    };
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    return {
      ok: false,
      error: createError(source, line, "ARTICLE_MEDIA_URL_UNSUPPORTED", "Image URL must be an absolute HTTP(S) URL or a canonical /images/uploads/... path.")
    };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      ok: false,
      error: createError(source, line, "ARTICLE_MEDIA_URL_UNSAFE_SCHEME", "Remote image URL must use HTTP or HTTPS.")
    };
  }

  if (!url.hostname) {
    return {
      ok: false,
      error: createError(source, line, "ARTICLE_MEDIA_URL_UNSUPPORTED", "Remote image URL must include a hostname.")
    };
  }

  return { ok: true, source: url.href, sourceType: "remote" };
}

function parseImageLine(text, source, line) {
  const match = IMAGE_LINE_PATTERN.exec(text);
  if (!match) {
    return {
      error: createError(source, line, "ARTICLE_MEDIA_IMAGE_SYNTAX", "Media blocks require one complete Markdown image per line.")
    };
  }

  const alt = match[1];
  if (!alt.trim()) {
    return {
      error: createError(source, line, "ARTICLE_MEDIA_ALT_REQUIRED", "Article images require non-empty alt text.")
    };
  }

  const urlResult = canonicalizeArticleMediaUrl(match[2], { source, line });
  if (!urlResult.ok) {
    return { error: urlResult.error };
  }

  return {
    image: {
      source: urlResult.source,
      sourceType: urlResult.sourceType,
      alt,
      caption: match[3] || null,
      line
    }
  };
}

function parseImageDirective(trimmed, source, line) {
  const tokens = trimmed.split(/\s+/);
  const mode = tokens[1];
  const optionTokens = tokens.slice(2);
  const errors = [];

  if (mode !== "wide" && mode !== "panorama") {
    errors.push(createError(source, line, "ARTICLE_MEDIA_IMAGE_MODE", "Image directive mode must be wide or panorama."));
    return { mode: null, focal: null, errors };
  }

  let focal = mode === "panorama" ? { x: 50, y: 50 } : null;
  let focalSeen = false;

  for (const option of optionTokens) {
    const separator = option.indexOf("=");
    const name = separator === -1 ? option : option.slice(0, separator);
    const value = separator === -1 ? "" : option.slice(separator + 1);

    if (name !== "focal") {
      errors.push(createError(source, line, "ARTICLE_MEDIA_IMAGE_OPTION", `Unknown image directive option "${name}".`));
      continue;
    }

    if (focalSeen) {
      errors.push(createError(source, line, "ARTICLE_MEDIA_FOCAL_DUPLICATE", "Image directive must not repeat the focal option."));
      continue;
    }
    focalSeen = true;

    if (mode !== "panorama") {
      errors.push(createError(source, line, "ARTICLE_MEDIA_FOCAL_MODE", "The focal option is allowed only for panorama images."));
      continue;
    }

    const focalMatch = /^(\d{1,3})%,(\d{1,3})%$/.exec(value);
    if (!focalMatch) {
      errors.push(createError(source, line, "ARTICLE_MEDIA_FOCAL_FORMAT", "Panorama focal must contain two percentages, for example focal=68%,42%."));
      continue;
    }

    const x = Number(focalMatch[1]);
    const y = Number(focalMatch[2]);
    if (x > 100 || y > 100) {
      errors.push(createError(source, line, "ARTICLE_MEDIA_FOCAL_RANGE", "Panorama focal percentages must be between 0% and 100%."));
      continue;
    }

    focal = { x, y };
  }

  return { mode, focal, errors };
}

function createUniqueSectionId(section, counts) {
  const slug = String(section || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{Letter}\p{Number}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "section";
  const count = counts.get(slug) ?? 0;
  counts.set(slug, count + 1);
  return count === 0 ? slug : `${slug}-${count + 1}`;
}

function recordInlineImageError(errors, text, source, line) {
  if (IMAGE_MARKER_PATTERN.test(text)) {
    errors.push(createError(source, line, "ARTICLE_MEDIA_INLINE_IMAGE", "Article images must occupy their own block and cannot be mixed with prose."));
  }
}

export function parseArticleMarkdown(markdown, options = {}) {
  const source = options.source ?? "<article>";
  const blocks = [];
  const headings = [];
  const errors = [];
  const headingIdCounts = new Map();
  const lines = String(markdown ?? "").split("\n");
  let index = 0;

  while (index < lines.length) {
    const lineNumber = index + 1;
    const line = lines[index].trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      const fence = trimmed.slice(0, 3);
      const language = trimmed.slice(3).trim();
      const codeLines = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith(fence)) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: "code", code: codeLines.join("\n"), language });
      continue;
    }

    if (trimmed === ":::gallery" || trimmed.startsWith(":::image")) {
      const directiveLine = lineNumber;
      const isGallery = trimmed === ":::gallery";
      const directive = isGallery ? null : parseImageDirective(trimmed, source, directiveLine);
      if (directive) errors.push(...directive.errors);
      const images = [];
      let closed = false;
      index += 1;

      while (index < lines.length) {
        const contentLine = lines[index].trim();
        const contentLineNumber = index + 1;
        if (contentLine === ":::") {
          closed = true;
          index += 1;
          break;
        }
        if (contentLine.startsWith(":::")) {
          errors.push(createError(source, contentLineNumber, "ARTICLE_MEDIA_DIRECTIVE_NESTED", "Article media directives cannot be nested."));
          index += 1;
          continue;
        }
        if (!contentLine && isGallery) {
          index += 1;
          continue;
        }

        const parsedImage = parseImageLine(contentLine, source, contentLineNumber);
        if (parsedImage.error) {
          if (contentLine.startsWith("![")) {
            errors.push(parsedImage.error);
          } else {
            errors.push(createError(source, contentLineNumber, "ARTICLE_MEDIA_DIRECTIVE_CONTENT", "Media directives may contain only supported image lines."));
          }
        } else {
          images.push(parsedImage.image);
        }
        index += 1;
      }

      if (!closed) {
        errors.push(createError(source, directiveLine, "ARTICLE_MEDIA_DIRECTIVE_UNCLOSED", "Article media directive is missing its closing ::: line."));
      }

      if (isGallery) {
        if (images.length < 2 || images.length > 6) {
          errors.push(createError(source, directiveLine, "ARTICLE_MEDIA_GALLERY_COUNT", "Gallery directives require between 2 and 6 images."));
        }
        if (closed && images.length >= 2 && images.length <= 6) {
          blocks.push({ type: "gallery", images, line: directiveLine });
        }
      } else {
        if (images.length !== 1) {
          errors.push(createError(source, directiveLine, "ARTICLE_MEDIA_IMAGE_COUNT", "Image directives require exactly one image."));
        }
        if (closed && directive.errors.length === 0 && images.length === 1) {
          blocks.push({
            type: "image",
            mode: directive.mode,
            focal: directive.focal,
            ...images[0],
            directiveLine
          });
        }
      }
      continue;
    }

    if (trimmed.startsWith(":::")) {
      errors.push(createError(source, lineNumber, "ARTICLE_MEDIA_DIRECTIVE_UNKNOWN", "Unknown or misplaced article media directive."));
      index += 1;
      continue;
    }

    if (trimmed.startsWith("![")) {
      const parsedImage = parseImageLine(trimmed, source, lineNumber);
      if (parsedImage.error) {
        errors.push(parsedImage.error.code === "ARTICLE_MEDIA_IMAGE_SYNTAX" && IMAGE_MARKER_PATTERN.test(trimmed)
          ? createError(source, lineNumber, "ARTICLE_MEDIA_INLINE_IMAGE", "Article images must occupy their own block and cannot be mixed with prose.")
          : parsedImage.error);
      } else {
        blocks.push({ type: "image", mode: "standard", focal: null, ...parsedImage.image });
      }
      index += 1;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      const text = trimmed.slice(4).trim();
      recordInlineImageError(errors, text, source, lineNumber);
      const id = createUniqueSectionId(text, headingIdCounts);
      blocks.push({ type: "h3", text, id });
      headings.push({ id, label: text });
      index += 1;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      const text = trimmed.slice(3).trim();
      recordInlineImageError(errors, text, source, lineNumber);
      const id = createUniqueSectionId(text, headingIdCounts);
      blocks.push({ type: "h2", text, id });
      headings.push({ id, label: text });
      index += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        const quoteText = lines[index].trim().replace(/^>\s?/, "");
        recordInlineImageError(errors, quoteText, source, index + 1);
        quoteLines.push(quoteText);
        index += 1;
      }
      blocks.push({ type: "blockquote", text: quoteLines.join(" ") });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        const item = lines[index].replace(/^\s*[-*]\s+/, "").trim();
        recordInlineImageError(errors, item, source, index + 1);
        items.push(item);
        index += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        const item = lines[index].replace(/^\s*\d+\.\s+/, "").trim();
        recordInlineImageError(errors, item, source, index + 1);
        items.push(item);
        index += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    if (/^\|.+\|$/.test(trimmed)) {
      const tableLines = [];
      const tableStart = index;
      while (index < lines.length && /^\s*\|.+\|\s*$/.test(lines[index])) {
        recordInlineImageError(errors, lines[index], source, index + 1);
        tableLines.push(lines[index].trim());
        index += 1;
      }
      if (tableLines.length >= 2 && /^\|?[\s:-]+\|[\s|:-]*$/.test(tableLines[1])) {
        const headers = tableLines[0].split("|").map((cell) => cell.trim()).filter(Boolean);
        const rows = tableLines.slice(2).map((row) => row.split("|").map((cell) => cell.trim()).filter(Boolean));
        blocks.push({ type: "table", headers, rows });
        continue;
      }
      blocks.push({ type: "paragraph", text: tableLines.join(" "), line: tableStart + 1 });
      continue;
    }

    const paragraph = [trimmed];
    recordInlineImageError(errors, trimmed, source, lineNumber);
    index += 1;
    while (index < lines.length) {
      const peek = lines[index].trim();
      if (
        !peek || peek.startsWith("## ") || peek.startsWith("### ") || peek.startsWith(">") ||
        peek.startsWith("```") || peek.startsWith("~~~") || peek.startsWith(":::") || peek.startsWith("![") ||
        /^[-*]\s+/.test(peek) || /^\d+\.\s+/.test(peek) || /^\|.+\|$/.test(peek)
      ) break;
      recordInlineImageError(errors, peek, source, index + 1);
      paragraph.push(peek);
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }

  return { blocks, headings, errors };
}
