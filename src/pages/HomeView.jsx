import { ArchiveCard } from "../components/ArchiveCard.jsx";
import { getTagCounts } from "../data/posts.js";
import { sections } from "../data/sections.js";
import { site } from "../data/yaml-loader.js";

function HeroPanel() {
  return (
    <section className="hero-panel reveal" aria-labelledby="hero-title">
      <div className="hero-marker" aria-hidden="true">
        <span>{site.home_hero_marker}</span>
      </div>
      <div>
        <p className="hero-code">{site.home_hero_code}</p>
        <h1 id="hero-title">{site.home_hero_title}</h1>
        <p>{site.home_hero_body}</p>
      </div>
    </section>
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
        <span className="side-panel-counter__value vercount_value_site_pv" data-testid="home-visit-counter-value">--</span>
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
  return (
    <>
      <HeroPanel />
      <FilterBar
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        tagFilter={tagFilter}
        onTagFilter={setTagFilter}
      />
      <section className="home-grid" aria-label="首页索引">
        <div className="archive-column">
          <h2 className="section-title">{site.home_grid_title}</h2>
          <ol className="archive-list">
            {filteredPosts.map((post) => (
              <li key={post.id}>
                <ArchiveCard post={post} onOpen={onOpenPost} />
              </li>
            ))}
          </ol>
        </div>

        <SidePanel onSectionChange={onSectionChange} />
      </section>
    </>
  );
}
