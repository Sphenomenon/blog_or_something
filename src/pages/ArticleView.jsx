import React, { useEffect, useMemo, useRef, useState } from "react";
import { init } from "@waline/client";
import "@waline/client/style";
import { getArticleNeighbors, normalizeCanonicalArticleCommentPath } from "../data/posts.js";
import { getSectionBySlug } from "../data/sections.js";

function renderInline(text, keyPrefix) {
  const nodes = [];
  let cursor = 0;
  let nodeIndex = 0;

  // Combined inline pattern — bold first (since ** contains *), then italic, code, strikethrough, image, link
  const inlinePattern = /(\*\*|__)(.+?)\1|(\*|_)((?:(?!\3).)+?)\3|`([^`\n]+)`|~~(.+?)~~|!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)|\[([^\]]+)\]\(([^)\s]+)\)/g;

  let match;
  while ((match = inlinePattern.exec(text)) !== null) {
    // Push plain text before this match
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }

    if (match[1] !== undefined) {
      // Bold: **text** or __text__ (groups 1=delim, 2=content)
      nodes.push(<strong key={`${keyPrefix}-s-${nodeIndex}`}>{match[2]}</strong>);
      nodeIndex++;
    } else if (match[3] !== undefined) {
      // Italic: *text* or _text_ (groups 3=delim, 4=content)
      nodes.push(<em key={`${keyPrefix}-e-${nodeIndex}`}>{match[4]}</em>);
      nodeIndex++;
    } else if (match[5] !== undefined) {
      // Code: `text` (group 5=content)
      nodes.push(<code key={`${keyPrefix}-c-${nodeIndex}`}>{match[5]}</code>);
      nodeIndex++;
    } else if (match[6] !== undefined) {
      // Strikethrough: ~~text~~ (group 6=content)
      nodes.push(<del key={`${keyPrefix}-d-${nodeIndex}`}>{match[6]}</del>);
      nodeIndex++;
    } else if (match[7] !== undefined) {
      // Image: ![alt](src "title") (groups 7=alt, 8=src, 9=title)
      nodes.push(
        <figure key={`${keyPrefix}-img-${nodeIndex}`}>
          <img src={match[8]} alt={match[7]} loading="lazy" />
          {match[9] ? <figcaption>{match[9]}</figcaption> : null}
        </figure>
      );
      nodeIndex++;
    } else if (match[10] !== undefined) {
      // Link: [text](url) (groups 10=text, 11=url)
      nodes.push(
        <a key={`${keyPrefix}-link-${nodeIndex}`} href={match[11]} target="_blank" rel="noreferrer">
          {match[10]}
        </a>
      );
      nodeIndex++;
    }

    cursor = match.index + match[0].length;
  }

  // Push remaining text after last match
  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes.length ? nodes : text;
}

function parseMarkdown(markdown) {
  const blocks = [];
  const headings = [];
  const lines = markdown.split("\n");
  let index = 0;

  while (index < lines.length) {
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

      if (index < lines.length) {
        index += 1;
      }

      blocks.push({ type: "code", code: codeLines.join("\n"), language });
      continue;
    }

    if (trimmed.startsWith("### ")) {
      const text = trimmed.slice(4).trim();
      blocks.push({ type: "h3", text });
      headings.push(text);
      index += 1;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      const text = trimmed.slice(3).trim();
      blocks.push({ type: "h2", text });
      headings.push(text);
      index += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "blockquote", text: quoteLines.join(" ") });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, "").trim());
        index += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, "").trim());
        index += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    if (/^\|.+\|$/.test(trimmed)) {
      const tableLines = [];
      while (index < lines.length && /^\s*\|.+\|\s*$/.test(lines[index])) {
        tableLines.push(lines[index].trim());
        index += 1;
      }

      if (tableLines.length >= 2 && /^\|?[\s:-]+\|[\s|:-]*$/.test(tableLines[1])) {
        const headers = tableLines[0]
          .split("|")
          .map((cell) => cell.trim())
          .filter(Boolean);
        const rows = tableLines.slice(2).map((row) =>
          row
            .split("|")
            .map((cell) => cell.trim())
            .filter(Boolean)
        );
        blocks.push({ type: "table", headers, rows });
        continue;
      }

      blocks.push({ type: "paragraph", text: tableLines.join(" ") });
      continue;
    }

    const paragraph = [trimmed];
    index += 1;
    while (index < lines.length) {
      const peek = lines[index].trim();
      if (
        !peek ||
        peek.startsWith("## ") ||
        peek.startsWith("### ") ||
        peek.startsWith(">") ||
        peek.startsWith("```") ||
        peek.startsWith("~~~") ||
        /^[-*]\s+/.test(peek) ||
        /^\d+\.\s+/.test(peek) ||
        /^\|.+\|$/.test(peek)
      ) {
        break;
      }
      paragraph.push(peek);
      index += 1;
    }

    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }

  return { blocks, headings };
}

function normalizeSectionSlug(section) {
  return String(section || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

function hasFrontmatterSections(postSections) {
  if (!Array.isArray(postSections) || !postSections.length) {
    return false;
  }

  return !(postSections.length === 1 && postSections[0] === "正文");
}

export function ArticleView({ post, onOpenPost, pathname }) {
  const { blocks, headings } = parseMarkdown(post.content || "");
  const tocSections = hasFrontmatterSections(post.sections) ? post.sections : headings;
  const sectionMeta = getSectionBySlug(post.section);
  const canonicalSectionLabel = sectionMeta?.label ?? post.section;
  const neighbors = useMemo(() => getArticleNeighbors(post.slug, post.section), [post.slug, post.section]);
  const related = useMemo(() => [neighbors.previous, neighbors.next].filter(Boolean), [neighbors.next, neighbors.previous]);
  const commentPath = useMemo(() => normalizeCanonicalArticleCommentPath(pathname ?? `/posts/${post.slug}`), [pathname, post.slug]);
  const walineServerURL = import.meta.env.VITE_WALINE_SERVER_URL?.trim() ?? "";
  const walineContainerRef = useRef(null);
  const walineInstanceRef = useRef(null);
  const [activeSection, setActiveSection] = useState(tocSections[0] ?? "正文");
  const previousArticle = neighbors.previous;
  const nextArticle = neighbors.next;

  useEffect(() => {
    setActiveSection(tocSections[0] ?? "正文");
  }, [post.id, tocSections]);

  useEffect(() => {
    if (!walineServerURL || !walineContainerRef.current) {
      walineInstanceRef.current?.destroy?.();
      walineInstanceRef.current = null;
      return undefined;
    }

    walineInstanceRef.current?.destroy?.();
    walineInstanceRef.current = init({
      el: walineContainerRef.current,
      serverURL: walineServerURL,
      login: "force",
      path: commentPath,
      dark: true
    });

    return () => {
      walineInstanceRef.current?.destroy?.();
      walineInstanceRef.current = null;
    };
  }, [commentPath, walineServerURL]);

  return (
    <section className="article-layout" aria-label="文章页">
      <aside className="rail rail-left" aria-label="左侧索引">
        <h4>档案柜</h4>
        <ul>
            {related.map((item) => (
            <li key={item.id}>
              <button data-testid={`article-related-${item.id}`} type="button" onClick={() => onOpenPost(item.slug)}>
                {item.id}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <article className="prose reveal" lang="zh-Hans">
        <header className="article-hero">
          <p className="archive-id">{post.id}</p>
          <h1>{post.title}</h1>
          <p className="hero-meta">
            {post.category} · {post.date} · {post.reading} · {post.status} · 栏目：
            <a href={`/sections/${post.section}`}>{canonicalSectionLabel}</a>
          </p>
          <ul className="tag-list" aria-label="文章标签">
            {post.tags.map((tag) => (
              <li key={tag}>#{tag}</li>
            ))}
          </ul>
        </header>

        <nav className="article-nav" aria-label="上一篇和下一篇文章">
          <div className="article-nav__item">
            {previousArticle ? (
              <button type="button" data-testid="article-prev" onClick={() => onOpenPost(previousArticle.slug)}>
                <span className="article-nav__eyebrow">上一篇</span>
                <span className="article-nav__title">{previousArticle.title}</span>
              </button>
            ) : (
              <p className="article-nav__empty" data-testid="article-prev-empty">已经是最新文章</p>
            )}
          </div>
          <div className="article-nav__item article-nav__item--next">
            {nextArticle ? (
              <button type="button" data-testid="article-next" onClick={() => onOpenPost(nextArticle.slug)}>
                <span className="article-nav__eyebrow">下一篇</span>
                <span className="article-nav__title">{nextArticle.title}</span>
              </button>
            ) : (
              <p className="article-nav__empty" data-testid="article-next-empty">已经是最旧文章</p>
            )}
          </div>
        </nav>

        {blocks.map((block, blockIndex) => {
          const key = `block-${blockIndex}`;

          if (block.type === "h2") {
            return <h2 key={key}>{block.text}</h2>;
          }

          if (block.type === "h3") {
            return <h3 key={key}>{block.text}</h3>;
          }

          if (block.type === "blockquote") {
            return <blockquote key={key}>{renderInline(block.text, key)}</blockquote>;
          }

          if (block.type === "code") {
            return (
              <pre key={key}>
                <code data-language={block.language || undefined}>{block.code}</code>
              </pre>
            );
          }

          if (block.type === "ul") {
            return (
              <ul key={key}>
                {block.items.map((item, itemIndex) => (
                  <li key={`${key}-item-${itemIndex}`}>{renderInline(item, `${key}-item-${itemIndex}`)}</li>
                ))}
              </ul>
            );
          }

          if (block.type === "ol") {
            return (
              <ol key={key}>
                {block.items.map((item, itemIndex) => (
                  <li key={`${key}-item-${itemIndex}`}>{renderInline(item, `${key}-item-${itemIndex}`)}</li>
                ))}
              </ol>
            );
          }

          if (block.type === "table") {
            return (
              <table key={key}>
                <thead>
                  <tr>
                    {block.headers.map((header, headerIndex) => (
                      <th key={`${key}-head-${headerIndex}`}>{renderInline(header, `${key}-head-${headerIndex}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={`${key}-row-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`${key}-row-${rowIndex}-cell-${cellIndex}`}>
                          {renderInline(cell, `${key}-row-${rowIndex}-cell-${cellIndex}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          }

          return <p key={key}>{renderInline(block.text, key)}</p>;
        })}

        <section className="related-panel" aria-label="相关条目">
          <h2>相关条目</h2>
          {related.map((item) => (
            <button key={item.id} data-testid={`article-related-panel-${item.id}`} type="button" onClick={() => onOpenPost(item.slug)}>
              <span>{item.id}</span>
              {item.title}
            </button>
          ))}
        </section>

        <section className="article-comments" aria-label="文章评论">
          {walineServerURL ? (
            <div ref={walineContainerRef} data-testid="article-comments-container" />
          ) : (
            <p data-testid="article-comments-disabled">评论暂不可用：未配置 VITE_WALINE_SERVER_URL。</p>
          )}
        </section>

        <p className="footnote">[1] 脚注示例：这里可以放文献来源、技术补记或术语定义。</p>
      </article>

        <aside className="rail rail-right" aria-label="目录">
          <h4>目录 TOC</h4>
          <ol>
            {tocSections.map((section, index) => {
              const isActive = activeSection === section;
              const sectionSlug = normalizeSectionSlug(section);

              return (
                <li key={section} className={isActive ? "active" : ""}>
                  <button
                    type="button"
                    data-testid={`toc-${index + 1}`}
                    onClick={() => setActiveSection(section)}
                    aria-current={isActive ? "true" : undefined}
                    data-active={isActive ? "true" : undefined}
                    data-section={sectionSlug || undefined}
                  >
                    <span className="toc-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="toc-label">{section}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>
      </section>
  );
}
