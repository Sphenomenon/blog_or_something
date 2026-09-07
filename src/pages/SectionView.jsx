import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArchiveCard } from "../components/ArchiveCard.jsx";
import { DecorativeAccent } from "../components/DecorativeAccent.jsx";
import { SectionMark } from "../components/SectionMark.jsx";
import { FriendLinkCard } from "../components/FriendLinkCard.jsx";
import { friendLinks } from "../data/links.js";
import { getSectionRepresentativePosts } from "../data/posts.js";
import { getSectionBySlug } from "../data/sections.js";
import { revealFrame, staggerContainer } from "../lib/motion.js";

const ACCENTED_SECTION_SLUGS = new Set(["tech", "essay", "diary", "reading", "travel", "links"]);

function compareSectionPosts(left, right) {
  const dateDiff = right.date.localeCompare(left.date);
  if (dateDiff !== 0) return dateDiff;
  return left.slug.localeCompare(right.slug);
}

export function SectionView({ sectionSlug, onOpenPost }) {
  const section = getSectionBySlug(sectionSlug);
  const shouldReduceMotion = useReducedMotion();
  const [isExpanded, setIsExpanded] = useState(false);

  const allSectionPosts = useMemo(() => {
    if (!section) return [];
    return getSectionRepresentativePosts(section.slug, Number.MAX_SAFE_INTEGER).sort(compareSectionPosts);
  }, [section]);
  const sectionPosts = isExpanded ? allSectionPosts : allSectionPosts.slice(0, 3);

  useEffect(() => {
    setIsExpanded(false);
  }, [section?.slug]);

  const isLinksSection = section?.slug === "links";

  if (!section) {
    return null;
  }

  const decorativeAccentId = ACCENTED_SECTION_SLUGS.has(section.slug) ? `section-${section.slug}` : null;
  const backgroundImage = `linear-gradient(165deg, rgb(18 21 24 / 0.2), rgb(12 14 16 / 0.82)), url("${section.background}")`;

  return (
    <section
      className={`page-panel page-panel--section page-panel--section-${section.slug}`}
      data-testid={`section-view-${section.slug}`}
      aria-labelledby={`section-title-${section.slug}`}
      style={{ backgroundImage }}
    >
      <p className="hero-code">SECTION / {section.navKicker.toUpperCase()}</p>
      <div className="section-hero">
        <div className="section-hero-copy">
          <div className="section-hero-mark-wrap" data-testid="section-mark" data-section-mark={section.slug}>
            <SectionMark slug={section.slug} className="section-mark--hero" title={`${section.label}栏目标记`} />
          </div>
          <div className="section-hero-text">
            <p className="section-hero-kicker">{section.shortLabel}</p>
            <h1 id={`section-title-${section.slug}`}>{section.label}</h1>
            <p className="page-panel-lead">{section.intro}</p>
          </div>
        </div>

        <dl className="section-metadata" aria-label="收录数量">
          <div>
            <dt>{isLinksSection ? "位朋友" : "篇文章"}</dt>
            <dd>{isLinksSection ? friendLinks.length : allSectionPosts.length}</dd>
          </div>
        </dl>
      </div>

      {decorativeAccentId ? <DecorativeAccent id={decorativeAccentId} /> : null}

      {isLinksSection ? (
        <section className="section-posts" aria-label="友链列表">
          <div className="section-posts-header">
            <h2 className="section-title">友链</h2>
          </div>

          {friendLinks.length === 0 ? (
            <div className="section-empty-state" data-testid="section-empty-state">
              <p>暂无友链。</p>
              <p>新的站点收录后，将显示在这里。</p>
            </div>
          ) : (
            <motion.div className="friend-links-grid" variants={staggerContainer} initial="hidden" animate="visible" custom={shouldReduceMotion}>
              {friendLinks.map((link) => (
                <FriendLinkCard key={`${link.url}:${link.logo}`} link={link} shouldReduceMotion={shouldReduceMotion} />
              ))}
            </motion.div>
          )}
        </section>
      ) : (
        <section className="section-posts" aria-label="栏目文章列表">
          <div className="section-posts-header">
            <h2 className="section-title">最近入柜</h2>
            <p className="section-posts-note">
              {isExpanded
                ? `FULL CABINET / ${allSectionPosts.length} RECORDS · 全部条目`
                : `LATEST ${sectionPosts.length} / ${allSectionPosts.length} RECORDS · 最近记录`}
            </p>
          </div>

          {sectionPosts.length === 0 ? (
            <div className="section-empty-state" data-testid="section-empty-state">
              <p>这个栏目暂时没有已入库的文章档案。</p>
              <p>后续条目归档后，会自动出现在这份栏目索引中。</p>
            </div>
          ) : (
            <motion.ol
              className="archive-list"
              id={`section-representatives-${section.slug}`}
              data-testid={`section-representatives-${section.slug}`}
              aria-expanded={isExpanded}
              aria-label={`${section.label}文章列表`}
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              custom={shouldReduceMotion}
            >
              {sectionPosts.map((post) => (
                <motion.li key={post.id} variants={revealFrame} custom={shouldReduceMotion}>
                  <ArchiveCard post={post} onOpen={onOpenPost} />
                </motion.li>
              ))}
            </motion.ol>
          )}

          {allSectionPosts.length > 3 ? <div className="section-all-posts-cta">
            <button
              data-testid={`section-all-posts-${section.slug}`}
              aria-controls={`section-representatives-${section.slug}`}
              aria-expanded={isExpanded}
              type="button"
              onClick={() => setIsExpanded((current) => !current)}
            >
              {isExpanded ? "收起" : "查看全部文章"}
            </button>
          </div> : null}
        </section>
      )}
    </section>
  );
}
