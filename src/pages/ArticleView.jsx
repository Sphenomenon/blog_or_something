import { useEffect, useMemo, useState } from "react";
import Giscus from "@giscus/react";
import { parseArticleMarkdown } from "../article-media.js";
import {
  ArticleMediaFigure,
  ArticleMediaGallery,
  ArticleMediaLightbox
} from "../components/ArticleMedia.jsx";
import { getArticleNeighbors } from "../data/posts.js";
import { getSectionBySlug } from "../data/sections.js";

const GISCUS_REPO = "Sphenomenon/blog_or_something";
const GISCUS_REPO_ID = "R_kgDOSk91lw";
const GISCUS_CATEGORY = "Announcements";
const GISCUS_CATEGORY_ID = "DIC_kwDOSk91l84C_iQE";
const PILOT_SCROLL_OFFSET = 96;

function renderInline(text, keyPrefix) {
  const nodes = [];
  let cursor = 0;
  let nodeIndex = 0;

  // Combined inline pattern — bold first (since ** contains *), then italic, code, strikethrough, link
  const inlinePattern = /(\*\*|__)(.+?)\1|(\*|_)((?:(?!\3).)+?)\3|`([^`\n]+)`|~~(.+?)~~|\[([^\]]+)\]\(([^)\s]+)\)/g;

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
      // Link: [text](url) (groups 7=text, 8=url)
      nodes.push(
        <a key={`${keyPrefix}-link-${nodeIndex}`} href={match[8]} target="_blank" rel="noreferrer">
          {match[7]}
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

function hasFrontmatterSections(postSections) {
  if (!Array.isArray(postSections) || !postSections.length) {
    return false;
  }

  return !(postSections.length === 1 && postSections[0] === "正文");
}

function buildTocItems(postSections, headings) {
  if (!hasFrontmatterSections(postSections)) {
    return headings;
  }

  const availableHeadings = [...headings];
  const frontmatterSections = postSections.map((section) => {
    const matchingHeadingIndex = availableHeadings.findIndex((heading) => heading.label === section);

    if (matchingHeadingIndex === -1) {
      return null;
    }

    const [matchingHeading] = availableHeadings.splice(matchingHeadingIndex, 1);
    return {
      id: matchingHeading.id,
      label: section
    };
  });

  return frontmatterSections.every(Boolean) ? frontmatterSections : headings;
}

function getArticleMediaPositions(blocks) {
  let galleryOrder = 0;
  let mediaOrder = 0;

  return blocks.map((block) => {
    if (block.type === "image") {
      mediaOrder += 1;
      return { mediaOrder, galleryOrder: null };
    }

    if (block.type === "gallery") {
      galleryOrder += 1;
      const mediaStartOrder = mediaOrder + 1;
      mediaOrder += block.images.length;
      return { mediaStartOrder, galleryOrder };
    }

    return null;
  });
}

function getDecodedHashTargetId() {
  if (!window.location.hash) {
    return "";
  }

  try {
    return decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return window.location.hash.slice(1);
  }
}

function scrollToPilotHeading(target, behavior) {
  const targetTop = target.getBoundingClientRect().top + window.scrollY - PILOT_SCROLL_OFFSET;

  window.scrollTo({
    top: Math.max(0, targetTop),
    behavior
  });
}

function schedulePilotHashScroll(targetId, onTick) {
  let attempts = 0;
  let intervalId;

  const scrollTarget = () => {
    onTick();

    const target = document.getElementById(targetId);

    if (target) {
      scrollToPilotHeading(target, "auto");
    }

    attempts += 1;

    if (attempts >= 24 && intervalId) {
      window.clearInterval(intervalId);
    }
  };

  const frameId = window.requestAnimationFrame(() => {
    scrollTarget();
    intervalId = window.setInterval(scrollTarget, 120);
  });

  return () => {
    window.cancelAnimationFrame(frameId);

    if (intervalId) {
      window.clearInterval(intervalId);
    }
  };
}

export function ArticleView({ post, onOpenPost, verificationOnly = false }) {
  const articleSource = post.slug || post.id || "<article>";
  const { blocks, headings, errors: articleMediaErrors } = useMemo(
    () => parseArticleMarkdown(post.content || "", { source: articleSource }),
    [post.content, post.id, post.slug]
  );
  const articleMediaPositions = useMemo(() => getArticleMediaPositions(blocks), [blocks]);
  const tocSections = useMemo(() => buildTocItems(post.sections, headings), [headings, post.sections]);
  const sectionMeta = getSectionBySlug(post.section);
  const canonicalSectionLabel = sectionMeta?.label ?? post.section;
  const neighbors = useMemo(
    () => verificationOnly ? { previous: null, next: null } : getArticleNeighbors(post.slug, post.section),
    [post.slug, post.section, verificationOnly]
  );
  const related = useMemo(() => [neighbors.previous, neighbors.next].filter(Boolean), [neighbors.next, neighbors.previous]);
  const isSwjtuReport = post.slug === "swjtu-2026-major-group-forecast";
  const articleClassName = isSwjtuReport ? "prose reveal prose--dense-report prose--swjtu-report" : "prose reveal";
  const layoutClassName = [
    "article-layout",
    isSwjtuReport ? "article-layout--swjtu-report" : "",
    verificationOnly ? "article-layout--verification" : ""
  ].filter(Boolean).join(" ");
  const [activeSectionId, setActiveSectionId] = useState(tocSections[0]?.id ?? "section");
  const hashSectionId = isSwjtuReport ? getDecodedHashTargetId() : "";
  const renderedActiveSectionId = tocSections.some((section) => section.id === hashSectionId)
    ? hashSectionId
    : activeSectionId;
  const previousArticle = neighbors.previous;
  const nextArticle = neighbors.next;
  const commentsSection = verificationOnly ? null : (
    <section className="article-comments" aria-label="文章评论">
      <div data-testid="article-comments-container">
        <Giscus
          repo={GISCUS_REPO}
          repoId={GISCUS_REPO_ID}
          category={GISCUS_CATEGORY}
          categoryId={GISCUS_CATEGORY_ID}
          mapping="pathname"
          strict="1"
          reactionsEnabled="1"
          emitMetadata="0"
          inputPosition="bottom"
          theme="transparent_dark"
          lang="zh-CN"
          loading="lazy"
        />
      </div>
    </section>
  );

  useEffect(() => {
    if (isSwjtuReport) {
      const hashTargetId = getDecodedHashTargetId();

      if (tocSections.some((section) => section.id === hashTargetId)) {
        setActiveSectionId(hashTargetId);
        return;
      }
    }

    setActiveSectionId(tocSections[0]?.id ?? "section");
  }, [isSwjtuReport, post.id, tocSections]);

  useEffect(() => {
    if (!isSwjtuReport || !window.location.hash) {
      return undefined;
    }

    const targetId = getDecodedHashTargetId();

    if (!tocSections.some((section) => section.id === targetId)) {
      return undefined;
    }

    setActiveSectionId(targetId);

    return schedulePilotHashScroll(targetId, () => setActiveSectionId(targetId));
  }, [isSwjtuReport, post.id, tocSections]);

  const handleTocClick = (section) => {
    const target = document.getElementById(section.id);

    if (!target) {
      return;
    }

    setActiveSectionId(section.id);
    if (isSwjtuReport) {
      history.replaceState(null, "", `#${section.id}`);
    }

    if (isSwjtuReport) {
      scrollToPilotHeading(
        target,
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
      );
      return;
    }

    target.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start"
    });
  };

  return (
    <ArticleMediaLightbox ownerKey={post.slug || post.id}>
    <section className={layoutClassName} aria-label="文章页">
      {!verificationOnly ? <aside className="rail rail-left" aria-label="左侧索引">
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
      </aside> : null}

      <article className={articleClassName} lang="zh-Hans" data-post-slug={post.slug}>
        <header className="article-hero">
          <p className="archive-id">{post.id}</p>
          <h1>{post.title}</h1>
          <p className="hero-meta">
            {post.category} · {post.date} · {post.reading} · {post.status} · 栏目：
            <a href={`/sections/${post.section}`}>{canonicalSectionLabel}</a>
          </p>
          {isSwjtuReport ? (
            <div className="article-hero__pilot-meta" aria-label="试点报告信息">
              <p className="article-hero__pilot-label">Research Report Pilot</p>
              <p>{post.excerpt}</p>
              <p>{tocSections.length} sections</p>
            </div>
          ) : null}
          <ul className="tag-list" aria-label="文章标签">
            {post.tags.map((tag) => (
              <li key={tag}>#{tag}</li>
            ))}
          </ul>
        </header>

        {!verificationOnly ? <nav className="article-nav" aria-label="上一篇和下一篇文章">
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
        </nav> : null}

        {import.meta.env.DEV && articleMediaErrors.length ? (
          <aside className="article-media-errors" aria-label="Article media errors" data-testid="article-media-errors">
            <p>Some article media could not be rendered.</p>
            <ul>
              {articleMediaErrors.map((error, errorIndex) => (
                <li key={`${error.code}-${error.line}-${errorIndex}`}>
                  {error.source}:{error.line} {error.code}: {error.message}
                </li>
              ))}
            </ul>
          </aside>
        ) : null}

        {blocks.map((block, blockIndex) => {
          const key = `block-${blockIndex}`;

          if (block.type === "image") {
            return (
              <ArticleMediaFigure
                key={key}
                image={{ ...block, articleSource }}
                mediaOrder={articleMediaPositions[blockIndex].mediaOrder}
              />
            );
          }

          if (block.type === "gallery") {
            return (
              <ArticleMediaGallery
                key={key}
                block={block}
                galleryOrder={articleMediaPositions[blockIndex].galleryOrder}
                mediaStartOrder={articleMediaPositions[blockIndex].mediaStartOrder}
                articleSource={articleSource}
              />
            );
          }

          if (block.type === "h2") {
            return <h2 key={key} id={block.id}>{block.text}</h2>;
          }

          if (block.type === "h3") {
            return <h3 key={key} id={block.id}>{block.text}</h3>;
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

        {!verificationOnly ? <section className="related-panel" aria-label="相关条目">
          <h2>相关条目</h2>
          {related.map((item) => (
            <button key={item.id} data-testid={`article-related-panel-${item.id}`} type="button" onClick={() => onOpenPost(item.slug)}>
              <span>{item.id}</span>
              {item.title}
            </button>
          ))}
        </section> : null}

        {!isSwjtuReport ? commentsSection : null}

      </article>

        {isSwjtuReport ? commentsSection : null}

        <aside className="rail rail-right" aria-label="目录">
          <h4>目录 TOC</h4>
          <ol>
            {tocSections.map((section, index) => {
              const isActive = renderedActiveSectionId === section.id;

              return (
                <li key={section.id} className={isActive ? "active" : ""}>
                  <button
                    type="button"
                    data-testid={`toc-${index + 1}`}
                    onClick={() => handleTocClick(section)}
                    aria-current={isActive ? "true" : undefined}
                    data-active={isActive ? "true" : undefined}
                    data-section={section.id}
                  >
                    <span className="toc-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="toc-label">{section.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>
      </section>
    </ArticleMediaLightbox>
  );
}
