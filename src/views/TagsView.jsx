import React from "react";
import { getTagCounts } from "../data/posts.js";

export function TagsView({ setTagFilter, onViewChange }) {
  const counts = getTagCounts();
  return (
    <section className="page-panel page-panel--tags reveal" aria-labelledby="tags-title">
      <p className="hero-code">METADATA / INDEX</p>
      <div className="page-panel-header">
        <div>
          <h1 id="tags-title">元数据页</h1>
          <p className="page-panel-lead">标签保留为辅助索引，用来补充栏目与文章的检索，不再承担主导航职责。</p>
        </div>
        <p className="page-panel-meta">{Object.keys(counts).length} tags</p>
      </div>
      <div className="tag-cloud">
        {Object.entries(counts).map(([tag, count]) => (
          <button
            key={tag}
            data-testid={`tag-${tag}`}
            type="button"
            onClick={() => {
              setTagFilter(tag);
              onViewChange("home");
            }}
          >
            <span>#{tag}</span>
            <em>{count} entries</em>
          </button>
        ))}
      </div>
    </section>
  );
}
