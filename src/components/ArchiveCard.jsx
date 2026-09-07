import { motion, useReducedMotion } from "framer-motion";
import { archiveEase, cardMotion, durationFast, reducedMotionTransition } from "../lib/motion.js";
import { navigateFromLink } from "../lib/navigation.js";

export function ArchiveCard({ post, onOpen }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.article
      className="archive-card"
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
      <motion.a
        className="card-hit"
        data-testid={`archive-card-${post.id}`}
        href={`/posts/${post.slug}`}
        onClick={(event) => navigateFromLink(event, () => onOpen(post.slug))}
        whileTap={shouldReduceMotion ? undefined : { scale: 0.99, transition: { duration: durationFast, ease: archiveEase } }}
        transition={shouldReduceMotion ? reducedMotionTransition : undefined}
      >
        <div className="card-body">
          <header>
            <p className="archive-id">{post.id}</p>
            <h3>{post.title}</h3>
          </header>

          <p className="excerpt">{post.excerpt}</p>

          <dl className="card-meta">
            <div>
              <dt className="sr-only">日期</dt>
              <dd><time dateTime={post.date}>{post.date}</time></dd>
            </div>
            <div>
              <dt className="sr-only">分类</dt>
              <dd>{post.category}</dd>
            </div>
            <div>
              <dt className="sr-only">状态</dt>
              <dd>{post.status}</dd>
            </div>
            <div>
              <dt className="sr-only">阅读时间</dt>
              <dd>{post.reading}</dd>
            </div>
          </dl>
        </div>
      </motion.a>

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
