import { motion, useReducedMotion } from "framer-motion";
import { archiveEase, cardMotion, durationFast, reducedMotionTransition } from "../lib/motion.js";

export function ArchiveCard({ post, onOpen }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.article
      className="archive-card reveal"
      variants={cardMotion}
      initial="rest"
      animate="rest"
      whileHover="hover"
      whileTap={
        shouldReduceMotion
          ? undefined
          : {
              scale: 0.995,
              transition: { duration: durationFast, ease: archiveEase },
            }
      }
      custom={shouldReduceMotion}
    >
      <motion.button
        className="card-hit"
        data-testid={`archive-card-${post.id}`}
        onClick={() => onOpen(post.slug)}
        type="button"
        whileTap={shouldReduceMotion ? undefined : { scale: 0.99, transition: { duration: durationFast, ease: archiveEase } }}
        transition={shouldReduceMotion ? reducedMotionTransition : undefined}
      >
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
      </motion.button>

      <footer className="card-foot">
        <ul className="tag-list" aria-label="标签">
          {post.tags.map((tag) => (
            <li key={tag}>#{tag}</li>
          ))}
        </ul>
      </footer>
    </motion.article>
  );
}
