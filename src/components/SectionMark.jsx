const MARKS = {
  tech: (
    <g>
      <rect x="22" y="22" width="20" height="20" />
      <line x1="16" y1="24" x2="22" y2="24" />
      <line x1="16" y1="32" x2="22" y2="32" />
      <line x1="16" y1="40" x2="22" y2="40" />
      <line x1="42" y1="24" x2="48" y2="24" />
      <line x1="42" y1="32" x2="48" y2="32" />
      <line x1="42" y1="40" x2="48" y2="40" />
      <line x1="24" y1="16" x2="24" y2="22" />
      <line x1="32" y1="16" x2="32" y2="22" />
      <line x1="40" y1="16" x2="40" y2="22" />
      <line x1="24" y1="42" x2="24" y2="48" />
      <line x1="32" y1="42" x2="32" y2="48" />
      <line x1="40" y1="42" x2="40" y2="48" />
      <path d="M28 32h8M32 28v8" />
    </g>
  ),
  essay: (
    <g>
      <path d="M22 18h18l4 4v24H22z" />
      <polyline points="40 18 40 22 44 22" />
      <line x1="27" y1="28" x2="39" y2="28" />
      <line x1="27" y1="34" x2="37" y2="34" />
      <line x1="27" y1="40" x2="34" y2="40" />
      <path d="M18 44c5-4 11-4 16 0" />
    </g>
  ),
  diary: (
    <g>
      <rect x="21" y="17" width="24" height="30" />
      <line x1="26" y1="17" x2="26" y2="47" />
      <circle cx="35" cy="32" r="5" />
      <path d="M32 32h6M35 29v6" />
      <line x1="18" y1="23" x2="21" y2="23" />
      <line x1="18" y1="32" x2="21" y2="32" />
      <line x1="18" y1="41" x2="21" y2="41" />
    </g>
  ),
  reading: (
    <g>
      <path d="M16 22c6-3 11-3 16 1v23c-5-4-10-4-16-1z" />
      <path d="M32 23c5-4 10-4 16-1v23c-6-3-11-3-16 1z" />
      <line x1="32" y1="23" x2="32" y2="46" />
      <line x1="21" y1="29" x2="27" y2="28" />
      <line x1="21" y1="36" x2="27" y2="35" />
      <line x1="37" y1="28" x2="43" y2="29" />
      <line x1="37" y1="35" x2="43" y2="36" />
    </g>
  ),
  travel: (
    <g>
      <circle cx="32" cy="32" r="14" />
      <path d="M18 32h28" />
      <path d="M32 18c5 6 5 22 0 28" />
      <path d="M32 18c-5 6-5 22 0 28" />
      <path d="M22 24c6 3 14 3 20 0" />
      <path d="M22 40c6-3 14-3 20 0" />
      <path d="M42 18l4-4M46 14l1 6" />
    </g>
  ),
  links: (
    <g>
      <path d="M25 24l-5 5c-4 4-4 10 0 14s10 4 14 0l4-4" />
      <path d="M39 40l5-5c4-4 4-10 0-14s-10-4-14 0l-4 4" />
      <line x1="27" y1="37" x2="37" y2="27" />
      <circle cx="20" cy="44" r="2" />
      <circle cx="44" cy="20" r="2" />
    </g>
  ),
  "food-map": (
    <g>
      <path d="M32 17c7 0 12 5 12 12 0 9-12 18-12 18S20 38 20 29c0-7 5-12 12-12z" />
      <circle cx="32" cy="29" r="4" />
      <path d="M22 46h20" />
      <path d="M18 23h7M39 23h7" />
      <path d="M24 18l-4-4M40 18l4-4" />
    </g>
  ),
  fallback: (
    <g>
      <circle cx="32" cy="32" r="12" />
      <path d="M32 20v24" />
      <path d="M20 32h24" />
      <path d="M24 24l16 16" />
      <path d="M40 24L24 40" />
    </g>
  ),
};

function getMark(slug) {
  return MARKS[slug] || MARKS.fallback;
}

export function SectionMark({ slug, className = "", title }) {
  const markClassName = ["section-mark", className].filter(Boolean).join(" ");
  const accessibilityProps = title
    ? { role: "img", "aria-label": title }
    : { "aria-hidden": "true" };

  return (
    <span className={markClassName} data-section-mark={slug || "fallback"}>
      <svg
        className="section-mark__glyph"
        viewBox="0 0 64 64"
        focusable="false"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...accessibilityProps}
      >
        {title ? <title>{title}</title> : null}
        <rect className="section-mark__outer" x="10" y="10" width="44" height="44" transform="rotate(45 32 32)" />
        <rect className="section-mark__inner" x="16" y="16" width="32" height="32" />
        {getMark(slug)}
      </svg>
    </span>
  );
}
