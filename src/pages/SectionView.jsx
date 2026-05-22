import React, { useEffect, useMemo, useState } from "react";
import { ArchiveCard } from "../components/ArchiveCard.jsx";
import { getSectionRepresentativePosts } from "../data/posts.js";
import { getSectionBySlug } from "../data/sections.js";

function compareSectionPosts(left, right) {
  const dateDiff = right.date.localeCompare(left.date);
  if (dateDiff !== 0) return dateDiff;
  return left.slug.localeCompare(right.slug);
}

export function SectionView({ sectionSlug, onOpenPost, onOpenArchive }) {
  const section = getSectionBySlug(sectionSlug);
  const [isExpanded, setIsExpanded] = useState(false);

  const sectionPosts = useMemo(() => {
    if (!section) return [];
    return getSectionRepresentativePosts(section.slug, isExpanded ? Number.MAX_SAFE_INTEGER : 3).sort(compareSectionPosts);
  }, [isExpanded, section]);

  useEffect(() => {
    setIsExpanded(false);
  }, [section?.slug]);

  if (!section) {
    return null;
  }

  const backgroundImage = `linear-gradient(165deg, rgb(18 21 24 / 0.2), rgb(12 14 16 / 0.82)), url("${section.background}")`;

  return (
    <section
      className={`page-panel page-panel--section page-panel--section-${section.slug} reveal`}
      data-testid={`section-view-${section.slug}`}
      aria-labelledby={`section-title-${section.slug}`}
      style={{ backgroundImage }}
    >
      <p className="hero-code">SECTION / {section.navKicker.toUpperCase()}</p>
      <div className="section-hero">
        <div className="section-hero-copy">
          <p className="section-hero-kicker">{section.shortLabel}</p>
          <h1 id={`section-title-${section.slug}`}>{section.label}</h1>
          <p className="page-panel-lead">{section.intro}</p>
        </div>

        <dl className="section-metadata" aria-label="栏目元数据">
          <div>
            <dt>SLUG</dt>
            <dd>{section.slug}</dd>
          </div>
          <div>
            <dt>THEME</dt>
            <dd>{section.theme}</dd>
          </div>
          <div>
            <dt>POSTS</dt>
            <dd>{sectionPosts.length}</dd>
          </div>
          <div>
            <dt>BACKGROUND</dt>
            <dd>{section.background ? "asset" : "fallback"}</dd>
          </div>
        </dl>
      </div>

      <section className="section-posts" aria-label="栏目文章列表">
        <div className="section-posts-header">
          <h2 className="section-title">代表作</h2>
          <p className="section-posts-note">按最新时间截取最多三篇，低数量栏目只展示现有条目。</p>
        </div>

        {sectionPosts.length === 0 ? (
          <div className="section-empty-state" data-testid="section-empty-state">
            <p>这个栏目暂时没有可展示的条目。</p>
            <p>背景与简介已就位，等后续内容进入后会自动出现在这里。</p>
          </div>
        ) : (
          <ol
            className="archive-list"
            data-testid={`section-representatives-${section.slug}`}
            aria-expanded={isExpanded}
            aria-label={`${section.label}文章列表`}
          >
            {sectionPosts.map((post) => (
              <li key={post.id}>
                <ArchiveCard post={post} onOpen={onOpenPost} />
              </li>
            ))}
          </ol>
        )}

        <div className="section-all-posts-cta">
          <button
            data-testid={`section-all-posts-${section.slug}`}
            aria-controls={`section-representatives-${section.slug}`}
            aria-expanded={isExpanded}
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded ? "收起" : "查看全部文章"}
          </button>
        </div>
      </section>
    </section>
  );
}
