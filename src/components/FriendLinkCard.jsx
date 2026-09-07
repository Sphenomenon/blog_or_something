import { useState } from "react";
import { motion } from "framer-motion";
import { revealFrame } from "../lib/motion.js";

export function FriendLinkCard({ link, shouldReduceMotion }) {
  const [logoFailed, setLogoFailed] = useState(false);
  let domain = "";
  try {
    domain = new URL(link.url).hostname.replace(/^www\./, "");
  } catch {
    // A malformed label must not take down the rest of the directory.
  }

  return (
    <motion.a href={link.url} target="_blank" rel="noopener noreferrer"
      className="friend-link-card" variants={revealFrame} custom={shouldReduceMotion}>
      <span className="friend-link-avatar" aria-hidden="true">
        <span className="friend-link-initial">{Array.from(link.name)[0]?.toUpperCase() || "↗"}</span>
        {link.logo && !logoFailed ? <img src={link.logo} alt="" className="friend-link-logo"
          width="48" height="48" loading="lazy" onError={() => setLogoFailed(true)} /> : null}
      </span>
      <div className="friend-link-info">
        <span className="friend-link-name">{link.name}</span>
        <p className="friend-link-desc">{link.description}</p>
        <span className="friend-link-domain">{domain}</span>
      </div>
      <span className="friend-link-arrow" aria-hidden="true">↗</span>
      <span className="sr-only">（在新标签页打开）</span>
    </motion.a>
  );
}
