import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArchiveCard } from "../components/ArchiveCard.jsx";
import { getTagCounts } from "../data/posts.js";
import { sections } from "../data/sections.js";
import { archiveEase, durationFast, reducedMotionTransition, revealFrame, staggerContainer } from "../lib/motion.js";
import { site } from "../data/yaml-loader.js";

const heroTitleCharacters = Array.from(site.home_hero_title);
const defaultHeroTitleEffect = "memory-fade";
const heroTitleEffects = new Set(["fading-font", "vanishing-points", "memory-fade", "blur-focus"]);

function getHeroTitleCharacterState(shouldReduceMotion = false) {
  return typeof shouldReduceMotion === "object" ? shouldReduceMotion : { shouldReduceMotion };
}

function getHeroTitleEffect() {
  const effect = new URLSearchParams(window.location.search).get("heroTitleEffect");
  return heroTitleEffects.has(effect) ? effect : defaultHeroTitleEffect;
}

function getHiddenHeroTitleCharacter({ effect, index }) {
  if (effect === "fading-font") {
    return {
      opacity: index % 4 === 0 ? 0.12 : 0.28,
      x: 0,
      y: 0,
      scale: 1,
      rotate: 0,
      filter: "blur(0.18rem)",
      textShadow: "0 0 0.62rem rgb(232 225 210 / 0.12)",
    };
  }

  if (effect === "vanishing-points") {
    return {
      opacity: index % 3 === 0 ? 0.1 : 0.22,
      x: 0,
      y: 2,
      scale: 1,
      rotate: 0,
      filter: "blur(0.42rem)",
      textShadow: "0 0 0.9rem rgb(179 154 99 / 0.22)",
    };
  }

  if (effect === "memory-fade") {
    return {
      opacity: 0.18,
      x: 0,
      y: 1,
      scale: 1,
      rotate: 0,
      filter: "blur(0.24rem)",
      textShadow: "0 0 0.72rem rgb(165 168 163 / 0.16)",
    };
  }

  return {
    opacity: 0.16,
    x: 0,
    y: 1,
    scale: 1,
    rotate: 0,
    filter: "blur(0.36rem)",
    textShadow: "0 0 0 rgb(179 154 99 / 0)",
  };
}

function getVisibleHeroTitleCharacter({ effect, shouldReduceMotion }) {
  const settled = {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    rotate: 0,
    filter: "blur(0)",
    textShadow: "0 0 0 rgb(179 154 99 / 0)",
  };

  if (shouldReduceMotion) {
    return {
      ...settled,
      transition: reducedMotionTransition,
    };
  }

  if (effect === "memory-fade") {
    return {
      ...settled,
      opacity: [0.18, 0.88, 0.42, 1],
      y: [1, 0, 0, 0],
      filter: ["blur(0.24rem)", "blur(0.04rem)", "blur(0.2rem)", "blur(0)"],
      textShadow: [
        "0 0 0.72rem rgb(165 168 163 / 0.16)",
        "0 0 0.24rem rgb(232 225 210 / 0.08)",
        "0 0 0.58rem rgb(165 168 163 / 0.12)",
        "0 0 0 rgb(179 154 99 / 0)",
      ],
      transition: {
        duration: durationFast * 5,
        ease: archiveEase,
        times: [0, 0.34, 0.68, 1],
      },
    };
  }

  const durationByEffect = {
    "fading-font": durationFast * 4.6,
    "vanishing-points": durationFast * 4.8,
    "blur-focus": durationFast * 5.2,
  };

  return {
    ...settled,
    transition: {
      duration: durationByEffect[effect] ?? durationByEffect[defaultHeroTitleEffect],
      ease: archiveEase,
    },
  };
}

const heroTitleCharacter = {
  hidden: (custom = false) => {
    const { effect = defaultHeroTitleEffect, index = 0, shouldReduceMotion = false } = getHeroTitleCharacterState(custom);

    if (shouldReduceMotion) {
      return {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        rotate: 0,
        filter: "blur(0)",
        textShadow: "0 0 0 rgb(179 154 99 / 0)",
      };
    }

    return getHiddenHeroTitleCharacter({ effect, index });
  },
  visible: (custom = false) => {
    const { effect = defaultHeroTitleEffect, shouldReduceMotion = false } = getHeroTitleCharacterState(custom);

    return getVisibleHeroTitleCharacter({ effect, shouldReduceMotion });
  },
};

function HeroPanel() {
  const shouldReduceMotion = useReducedMotion();
  const heroTitleEffect = getHeroTitleEffect();

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
          data-hero-title-effect={heroTitleEffect}
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
              custom={{ effect: heroTitleEffect, index, shouldReduceMotion }}
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
