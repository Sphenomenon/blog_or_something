import { SharedText } from "./SharedText.jsx";
import { motion, useReducedMotion } from "framer-motion";
import { cardMotion, navigationTransition } from "../lib/motion.js";
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
              scale: 0.975,
              transition: navigationTransition,
            }
      }
      custom={shouldReduceMotion}
    >
      <motion.a
        className="card-hit"
        data-testid={`archive-card-${post.id}`}
        href={`/posts/${post.slug}`}
        onClick={(event) => navigateFromLink(event, () => onOpen(post.slug))}
      >
        <div className="card-body">
          <header>
            <p className="archive-id"><SharedText>{post.id}</SharedText></p>
            <h3><SharedText>{post.title}</SharedText></h3>
          </header>

          <p className="excerpt"><SharedText>{post.excerpt}</SharedText></p>

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
