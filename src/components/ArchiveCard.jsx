import React from "react";

export function ArchiveCard({ post, onOpen }) {
  return (
    <article className="archive-card reveal">
      <button className="card-hit" data-testid={`archive-card-${post.id}`} onClick={() => onOpen(post.slug)} type="button">
        <div className="card-body">
          <header>
            <p className="archive-id">{post.id}</p>
            <h3>{post.title}</h3>
          </header>

          <p className="excerpt">{post.excerpt}</p>

          <dl className="meta-grid">
            <div>
              <dt>DATE</dt>
              <dd>{post.date}</dd>
            </div>
            <div>
              <dt>TYPE</dt>
              <dd>{post.category}</dd>
            </div>
            <div>
              <dt>STATE</dt>
              <dd>{post.status}</dd>
            </div>
            <div>
              <dt>READ</dt>
              <dd>{post.reading}</dd>
            </div>
          </dl>
        </div>
      </button>

      <footer className="card-foot">
        <ul className="tag-list" aria-label="标签">
          {post.tags.map((tag) => (
            <li key={tag}>#{tag}</li>
          ))}
        </ul>
      </footer>
    </article>
  );
}
