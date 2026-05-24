import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArchiveCard } from "../components/ArchiveCard.jsx";
import { getTagCounts } from "../data/posts.js";
import { sections } from "../data/sections.js";
import { archiveEase, durationFast, reducedMotionTransition, revealFrame, staggerContainer } from "../lib/motion.js";
import { site } from "../data/yaml-loader.js";

const heroTitleCharacters = Array.from(site.home_hero_title);

const heroTitleCharacter = {
  hidden: {
    opacity: 0,
    y: 10,
    filter: "blur(0.18rem)",
  },
  visible: (shouldReduceMotion = false) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0)",
    transition: shouldReduceMotion
      ? reducedMotionTransition
      : {
          duration: durationFast,
          ease: archiveEase,
        },
  }),
};

function HeroPanel() {
  const shouldReduceMotion = useReducedMotion();

  function handleGoDown() {
    const archiveIndex = document.querySelector("#home-archive-index");

    if (!archiveIndex) {
      return;
    }

    archiveIndex.scrollIntoView({
      behavior: shouldReduceMotion ? "auto" : "smooth",
      block: "start",
    });
  }

  return (
    <motion.section
      className="hero-panel"
      data-testid="home-hero"
      aria-labelledby="hero-title"
      variants={revealFrame}
      initial="hidden"
      animate="visible"
      custom={shouldReduceMotion}
    >
      <motion.div className="hero-marker" aria-hidden="true" variants={revealFrame} custom={shouldReduceMotion}>
        <span>{site.home_hero_marker}</span>
      </motion.div>
      <motion.div className="hero-copy" variants={staggerContainer} initial="hidden" animate="visible" custom={shouldReduceMotion}>
        <motion.p className="hero-code" variants={revealFrame} custom={shouldReduceMotion}>{site.home_hero_code}</motion.p>
        <motion.h1
          id="hero-title"
          className="hero-title"
          data-testid="home-hero-title"
          aria-label={site.home_hero_title}
          variants={staggerContainer}
          custom={shouldReduceMotion}
        >
          {heroTitleCharacters.map((character, index) => (
            <motion.span
              key={`${character}-${index}`}
              className="hero-title__character"
              aria-hidden="true"
              variants={heroTitleCharacter}
              custom={shouldReduceMotion}
            >
              {character === " " ? "\u00A0" : character}
            </motion.span>
          ))}
        </motion.h1>
        <motion.p className="hero-body" variants={revealFrame} custom={shouldReduceMotion}>{site.home_hero_body}</motion.p>
        <motion.button
          className="hero-go-down"
          data-testid="home-go-down"
          type="button"
          aria-label="进入档案索引"
          onClick={handleGoDown}
          variants={revealFrame}
          custom={shouldReduceMotion}
          whileHover={shouldReduceMotion ? undefined : { y: -2 }}
          whileTap={shouldReduceMotion ? undefined : { y: 0 }}
        >
          <span className="hero-go-down__label">进入档案索引</span>
          <span className="hero-go-down__glyph" aria-hidden="true">↓</span>
        </motion.button>
      </motion.div>
    </motion.section>
  );
}

function FilterBar({ statusFilter, onStatusFilter, tagFilter, onTagFilter }) {
  const tags = Object.keys(getTagCounts());
  return (
    <section className="filter-bar" aria-label="档案筛选">
      <div className="filter-group">
        <span>STATE</span>
        <div className="filter-chips">
          {["All", "Published", "Draft", "Sealed"].map((status) => (
            <button
              key={status}
              className={statusFilter === status ? "active" : ""}
              onClick={() => onStatusFilter(status)}
              type="button"
            >
              {status}
            </button>
          ))}
        </div>
      </div>
      <div className="filter-group">
        <span>TAG</span>
        <div className="filter-chips">
          <button
            className={tagFilter === "All" ? "active" : ""}
            onClick={() => onTagFilter("All")}
            type="button"
          >
            All
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              className={tagFilter === tag ? "active" : ""}
              onClick={() => onTagFilter(tag)}
              type="button"
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function SidePanel({ onSectionChange }) {
  useEffect(() => {
    const existingScript = document.querySelector('script[data-vercount-script="true"]');

    if (existingScript) {
      return undefined;
    }

    const script = document.createElement("script");
    script.src = "https://events.vercount.one/js";
    script.defer = true;
    script.dataset.vercountScript = "true";
    document.body.appendChild(script);

    return undefined;
  }, []);

  return (
    <aside className="side-panel reveal">
      <section>
        <h3>{site.home_sidebar_categories_label}</h3>
        <ul className="side-panel-list">
          {sections.map((section) => (
            <li key={section.slug}>
              <button data-testid={`home-section-${section.slug}`} onClick={() => onSectionChange(section.slug)} type="button">
                <span>{section.label}</span>
                <em>{section.shortLabel}</em>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="side-panel-counter" data-testid="home-visit-counter" aria-label="本站总访问次数">
        <span className="side-panel-counter__label">本站总访问次数</span>
        <span className="side-panel-counter__value" id="vercount_value_site_pv" data-testid="home-visit-counter-value">--</span>
      </section>

      <section>
        <h3>{site.home_sidebar_terminal_label}</h3>
        <p>{site.home_sidebar_status}</p>
        <p>{site.home_sidebar_sync}</p>
        <p>{site.home_sidebar_integrity}</p>
      </section>
    </aside>
  );
}

export function HomeView({ filteredPosts, onOpenPost, onSectionChange, statusFilter, setStatusFilter, tagFilter, setTagFilter }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <>
      <HeroPanel />
      <FilterBar
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        tagFilter={tagFilter}
        onTagFilter={setTagFilter}
      />
      <section id="home-archive-index" className="home-grid" data-testid="home-archive-index" aria-label="首页索引">
        <div className="archive-column">
          <h2 className="section-title">{site.home_grid_title}</h2>
          <motion.ol className="archive-list" variants={staggerContainer} initial="hidden" animate="visible" custom={shouldReduceMotion}>
            {filteredPosts.map((post) => (
              <motion.li key={post.id} variants={revealFrame} custom={shouldReduceMotion}>
                <ArchiveCard post={post} onOpen={onOpenPost} />
              </motion.li>
            ))}
          </motion.ol>
        </div>

        <SidePanel onSectionChange={onSectionChange} />
      </section>
    </>
  );
}
