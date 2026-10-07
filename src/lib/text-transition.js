export const TEXT_TRANSITION_BUDGET = 80;
export const TEXT_TRANSITION_MOBILE_BUDGET = 48;
let previousGlyphs = [];
const namedElements = new WeakMap();
const wordCache = new WeakMap();
const candidateCache = new WeakMap();
let movementStyle;
const wordSegmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter("zh-CN", { granularity: "word" }) : null;

export function invalidateTextTransition(frame) {
  candidateCache.delete(frame);
}

function getCandidates(frame) {
  let candidates = candidateCache.get(frame);
  if (!candidates) {
    const priorities = new Map();
    candidates = [...frame.querySelectorAll("[data-shared-glyph]")].map((element) => {
      const wrapper = element.parentElement;
      if (!priorities.has(wrapper)) {
        priorities.set(wrapper, wrapper.closest("h1") ? 0 : wrapper.closest("h2, h3, .food-map-card-title") ? 1 : wrapper.closest(".hero-code, .archive-id, .hero-meta") ? 3 : 2);
      }
      return { element, wrapper, priority: priorities.get(wrapper) };
    }).sort((a, b) => a.priority - b.priority);
    candidateCache.set(frame, candidates);
  }
  return candidates;
}

function getWord(element, wrapper, preparedWords) {
  if (!wrapper.classList.contains("shared-text") || !wordSegmenter) return {};
  let cached = preparedWords.get(wrapper);
  if (!cached) {
    cached = wordCache.get(wrapper);
    const text = wrapper.textContent;
    if (!cached || cached.text !== text) {
      cached = { text, words: [...wordSegmenter.segment(text)] };
      wordCache.set(wrapper, cached);
    }
    preparedWords.set(wrapper, cached);
  }
  const position = Number(element.dataset.sharedOffset);
  const word = cached.words.find((part) => part.isWordLike && part.index <= position && part.index + part.segment.length > position);
  return { word: word?.segment, offset: position - (word?.index ?? position) };
}

function clearNames(frame) {
  for (const element of namedElements.get(frame) ?? []) {
    element.style.removeProperty("view-transition-name");
    element.style.removeProperty("view-transition-class");
  }
}

export function prepareTextTransition(frame, { remember = true, transition = false } = {}) {
  if (!document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    clearNames(frame);
    frame.dataset.sharedGlyphs = "0";
    previousGlyphs = [];
    return;
  }
  const counts = new Map();
  const used = new Set();
  const glyphs = [];
  const wrapperBounds = new Map();
  const preparedWords = new Map();
  const activeElements = [];
  const movementRules = [];
  const previousByText = new Map();
  for (const glyph of previousGlyphs) {
    const entries = previousByText.get(glyph.text) ?? [];
    entries.push(glyph);
    previousByText.set(glyph.text, entries);
  }
  const limit = window.innerWidth <= 780 ? TEXT_TRANSITION_MOBILE_BUDGET : TEXT_TRANSITION_BUDGET;
  let matchOnly = false;
  try { matchOnly = transition && document.documentElement.matches(":active-view-transition"); } catch { /* Native API fallback remains valid. */ }
  for (const { element, wrapper } of getCandidates(frame)) {
    let containerBounds = wrapperBounds.get(wrapper);
    if (!containerBounds) {
      containerBounds = wrapper.getBoundingClientRect();
      wrapperBounds.set(wrapper, containerBounds);
    }
    if (containerBounds.bottom < 0 || containerBounds.top > window.innerHeight) continue;
    const text = element.dataset.sharedGlyph;
    if (!text.trim() || /^\p{P}+$/u.test(text)) continue;
    const bounds = element.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0 || bounds.bottom < 0 || bounds.top > window.innerHeight || bounds.right < 0 || bounds.left > window.innerWidth) continue;
    if (glyphs.length >= limit) break;
    const ordinal = (counts.get(text) ?? 0) + 1;
    counts.set(text, ordinal);
    const code = Array.from(text, (character) => character.codePointAt(0).toString(16)).join("-");
    const { word, offset } = getWord(element, wrapper, preparedWords);
    let matched;
    let bestScore = Infinity;
    for (const glyph of previousByText.get(text) ?? []) {
      if (used.has(glyph.name)) continue;
      const score = (word && glyph.word === word && glyph.offset === offset ? 0 : 10000) + Math.hypot(glyph.x - bounds.x, glyph.y - bounds.y);
      if (score < bestScore) { matched = glyph; bestScore = score; }
    }
    if (matchOnly && !matched) continue;
    let name = matched?.name ?? `nocturne-letter-${code}-${ordinal}`;
    let suffix = ordinal;
    while (used.has(name)) name = `nocturne-letter-${code}-${++suffix}`;
    used.add(name);
    activeElements.push(element);
    glyphs.push({ name, text, word, offset, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
    if (transition && matched?.width > 0 && matched.height > 0) {
      movementRules.push(`::view-transition-group(${name}) { animation-name: nocturne-letter-move; --letter-from: translate(${matched.x}px, ${matched.y}px) scale(${matched.width / bounds.width}, ${matched.height / bounds.height}); --letter-to: translate(${bounds.x}px, ${bounds.y}px); }\n::view-transition-old(${name}) { animation-duration: 680ms; }`);
    }
  }
  const nextElements = new Set(activeElements);
  for (const element of namedElements.get(frame) ?? []) {
    if (nextElements.has(element)) continue;
    element.style.removeProperty("view-transition-name");
    element.style.removeProperty("view-transition-class");
  }
  activeElements.forEach((element, index) => {
    if (element.style.viewTransitionName !== glyphs[index].name) element.style.viewTransitionName = glyphs[index].name;
    if (element.style.getPropertyValue("view-transition-class") !== "nocturne-letter") element.style.setProperty("view-transition-class", "nocturne-letter");
  });
  namedElements.set(frame, activeElements);
  if (transition) {
    if (!movementStyle?.isConnected) {
      movementStyle = document.createElement("style");
      movementStyle.dataset.textTransition = "movement";
      document.head.appendChild(movementStyle);
    }
    movementStyle.textContent = movementRules.join("\n");
    frame.dataset.compositorGlyphs = String(movementRules.length);
  }
  frame.dataset.sharedGlyphs = String(glyphs.length);
  if (remember) previousGlyphs = glyphs;
  return glyphs;
}
