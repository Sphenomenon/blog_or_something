import { useEffect, useRef, useState } from "react";
import { site, sections } from "../data/yaml-loader.js";
import { navigateFromLink } from "../lib/navigation.js";

const secondaryViews = [
  { id: "archive", label: site.nav_archive_label },
  { id: "about", label: site.nav_about_label },
  { id: "food-map", label: "美食地图" }
];

export function SiteHeader({ activeSectionSlug, activeView, onSectionChange, onViewChange, query, onQueryChange, onSearchSubmit }) {
  const [panel, setPanel] = useState(null);
  const searchInputRef = useRef(null);
  const menuToggleRef = useRef(null);
  const searchToggleRef = useRef(null);
  const section = sections.find(s => s.slug === activeSectionSlug);
  const subtitle = section?.subtitle || site.header_subtitle;

  useEffect(() => {
    if (panel === "search") searchInputRef.current?.focus();
  }, [panel]);

  function followLink(event, navigate) {
    navigateFromLink(event, () => {
      setPanel(null);
      navigate();
    });
  }

  function handleEscape(event) {
    if (event.key !== "Escape" || !panel) return;
    event.preventDefault();
    (panel === "search" ? searchToggleRef : menuToggleRef).current?.focus();
    setPanel(null);
  }

  return (
    <header className="site-header" data-header-panel={panel ?? "closed"} data-header-view={activeView} onKeyDown={handleEscape}>
      <a className="brand" data-testid="brand-home" href="/" onClick={(event) => followLink(event, () => onViewChange("home"))}>
        <span className="kicker">{site.brand_kicker}</span>
        <span className="brand-title">{site.brand_name}</span>
        <span className="subtitle" data-testid="site-header-subtitle">{subtitle}</span>
      </a>

      <div className="site-header__controls">
        <button ref={searchToggleRef} type="button" data-testid="header-search-toggle" aria-expanded={panel === "search"} aria-controls="site-search" aria-label="搜索文章" onClick={() => setPanel(panel === "search" ? null : "search")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
        </button>
        <button ref={menuToggleRef} type="button" data-testid="header-menu-toggle" aria-expanded={panel === "menu"} aria-controls="site-sections-nav site-secondary-nav" onClick={() => setPanel(panel === "menu" ? null : "menu")}>
          {panel === "menu" ? "收起" : "菜单"}
        </button>
      </div>

      <nav id="site-sections-nav" className="site-nav site-nav--sections" aria-label="主导航：栏目">
        {sections.map((section) => (
          <a
            key={section.slug}
            className={activeSectionSlug === section.slug ? "active" : ""}
            data-testid={`nav-section-${section.slug}`}
            href={`/sections/${section.slug}`}
            aria-current={activeSectionSlug === section.slug ? "page" : undefined}
            onClick={(event) => followLink(event, () => onSectionChange(section.slug))}
          >
            {section.shortLabel}
          </a>
        ))}
      </nav>

      <nav id="site-secondary-nav" className="site-nav site-nav--secondary" aria-label="辅助导航">
        {secondaryViews.map((view) => (
          <a
            key={view.id}
            className={activeView === view.id ? "active" : ""}
            data-testid={`nav-${view.id}`}
            href={`/${view.id}`}
            aria-current={activeView === view.id ? "page" : undefined}
            onClick={(event) => followLink(event, () => onViewChange(view.id))}
          >
            {view.label}
          </a>
        ))}
      </nav>

      <form
        id="site-search"
        className="search-box"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setPanel(null);
          if (window.matchMedia("(width <= 780px)").matches) searchToggleRef.current?.focus();
          onSearchSubmit();
        }}
      >
        <label htmlFor="q" className="sr-only">
          {site.search_label}
        </label>
        <input
          ref={searchInputRef}
          id="q"
          data-testid="search-query"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={site.search_placeholder}
        />
      </form>
    </header>
  );
}
