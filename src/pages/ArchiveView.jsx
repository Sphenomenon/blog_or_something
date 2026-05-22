import React, { useEffect, useMemo, useState } from "react";
import { getArchivePostsByYear, getArchiveYears } from "../data/posts.js";
import { site } from "../data/yaml-loader.js";

export function ArchiveView({ onOpenPost }) {
  const archiveYears = useMemo(() => getArchiveYears(), []);
  const [selectedYear, setSelectedYear] = useState(() => archiveYears[0] ?? "");

  const yearIndex = archiveYears.indexOf(selectedYear);
  const activeYear = yearIndex === -1 ? archiveYears[0] ?? "" : selectedYear;
  const activeIndex = activeYear ? archiveYears.indexOf(activeYear) : -1;
  const archivePosts = activeYear ? getArchivePostsByYear(activeYear) : [];
  const previousYear = activeIndex > 0 ? archiveYears[activeIndex - 1] : null;
  const nextYear = activeIndex >= 0 && activeIndex < archiveYears.length - 1 ? archiveYears[activeIndex + 1] : null;

  useEffect(() => {
    if (!selectedYear && archiveYears[0]) {
      setSelectedYear(archiveYears[0]);
    }
  }, [archiveYears, selectedYear]);

  return (
    <section className="page-panel page-panel--archive reveal" aria-labelledby="archive-title">
      <p className="hero-code">{site.archive_code_header}</p>
      <div className="page-panel-header">
        <div>
          <h1 id="archive-title">{site.archive_page_title}</h1>
          <p className="page-panel-lead">{site.archive_lead_text}</p>
        </div>
        <p className="page-panel-meta" data-testid="archive-page-meta">{archivePosts.length} records</p>
      </div>
      <nav className="archive-pagination" aria-label="归档年份分页">
        <button
          data-testid="archive-year-prev"
          type="button"
          onClick={() => previousYear && setSelectedYear(previousYear)}
          disabled={!previousYear}
          aria-disabled={!previousYear}
        >
          上一年
        </button>
        <div className="archive-pagination__status" aria-live="polite">
          <span data-testid="archive-year-label">{activeYear || "—"}</span>
          <em data-testid="archive-year-position">
            {activeIndex >= 0 ? `${activeIndex + 1} / ${archiveYears.length}` : "0 / 0"}
          </em>
        </div>
        <button
          data-testid="archive-year-next"
          type="button"
          onClick={() => nextYear && setSelectedYear(nextYear)}
          disabled={!nextYear}
          aria-disabled={!nextYear}
        >
          下一年
        </button>
      </nav>

      <section className="archive-group" aria-labelledby="archive-year-heading">
        <h2 id="archive-year-heading" data-testid="archive-year-heading">{activeYear || "—"}</h2>
        <p className="archive-group__summary" data-testid="archive-year-summary">
          {archivePosts.length} records in {activeYear || "—"}
        </p>
        {archivePosts.map((post) => (
          <button key={post.id} data-testid={`archive-view-${post.id}`} type="button" onClick={() => onOpenPost(post.slug)}>
            <span>{post.id}</span>
            <strong>{post.title}</strong>
            <em>{post.status}</em>
          </button>
        ))}
      </section>
    </section>
  );
}
