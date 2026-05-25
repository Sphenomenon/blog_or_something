import { site, sections } from "../data/yaml-loader.js";

const secondaryViews = [
  { id: "archive", label: site.nav_archive_label },
  { id: "about", label: site.nav_about_label },
  { id: "food-map", label: "美食地图" }
];

export function SiteHeader({ activeSectionSlug, activeView, onSectionChange, onViewChange, query, onQueryChange }) {
  const section = sections.find(s => s.slug === activeSectionSlug);
  const subtitle = section?.subtitle || site.header_subtitle;

  return (
    <header className="site-header">
      <button className="brand" data-testid="brand-home" onClick={() => onViewChange("home")} type="button">
        <span className="kicker">{site.brand_kicker}</span>
        <span className="brand-title">{site.brand_name}</span>
        <span className="subtitle" data-testid="site-header-subtitle">{subtitle}</span>
      </button>

      <nav className="site-nav site-nav--sections" aria-label="主导航：栏目">
        {sections.map((section) => (
          <button
            key={section.slug}
            className={activeSectionSlug === section.slug ? "active" : ""}
            data-testid={`nav-section-${section.slug}`}
            onClick={() => onSectionChange(section.slug)}
            type="button"
          >
            {section.shortLabel}
          </button>
        ))}
      </nav>

      <nav className="site-nav site-nav--secondary" aria-label="辅助导航">
        {secondaryViews.map((view) => (
          <button
            key={view.id}
            className={activeView === view.id ? "active" : ""}
            data-testid={`nav-${view.id}`}
            onClick={() => onViewChange(view.id)}
            type="button"
          >
            {view.label}
          </button>
        ))}
      </nav>

      <form className="search-box" role="search" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="q" className="sr-only">
          {site.search_label}
        </label>
        <input
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
