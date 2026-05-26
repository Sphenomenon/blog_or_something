import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

const VISIBILITY_THRESHOLD = 240;
const MIN_SCROLLABLE_DISTANCE = 120;
const PROGRESS_RING_RADIUS = 22;
const PROGRESS_RING_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RING_RADIUS;

function getScrollState() {
  const scrollingElement = document.scrollingElement || document.documentElement || document.body;
  const scrollTop = Math.max(0, scrollingElement?.scrollTop ?? window.scrollY ?? 0);
  const scrollableDistance = Math.max(0, (scrollingElement?.scrollHeight ?? 0) - (scrollingElement?.clientHeight ?? 0));
  const progress = scrollableDistance > 0 ? Math.min(1, Math.max(0, scrollTop / scrollableDistance)) : 0;
  const canScroll = scrollableDistance > MIN_SCROLLABLE_DISTANCE;

  return {
    canScroll,
    isVisible: canScroll && scrollTop > VISIBILITY_THRESHOLD,
    progress,
    scrollTop,
    scrollableDistance,
  };
}

export function BackToTop({ routeKey }) {
  const shouldReduceMotion = useReducedMotion();
  const [scrollState, setScrollState] = useState(() => ({
    canScroll: false,
    isVisible: false,
    progress: 0,
    scrollTop: 0,
    scrollableDistance: 0,
  }));

  useEffect(() => {
    let animationFrame = null;

    function updateScrollState() {
      animationFrame = null;
      setScrollState(getScrollState());
    }

    function requestScrollStateUpdate() {
      if (animationFrame !== null) {
        return;
      }

      animationFrame = window.requestAnimationFrame(updateScrollState);
    }

    updateScrollState();
    const routeUpdateTimer = window.setTimeout(requestScrollStateUpdate, 120);

    window.addEventListener("scroll", requestScrollStateUpdate, { passive: true });
    window.addEventListener("resize", requestScrollStateUpdate);

    return () => {
      window.clearTimeout(routeUpdateTimer);
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      window.removeEventListener("scroll", requestScrollStateUpdate);
      window.removeEventListener("resize", requestScrollStateUpdate);
    };
  }, [routeKey]);

  function handleBackToTop() {
    const behavior = shouldReduceMotion ? "auto" : "smooth";

    window.scrollTo({
      top: 0,
      behavior,
    });

    if (!shouldReduceMotion) {
      window.setTimeout(() => {
        if (window.scrollY > 12) {
          window.scrollTo({ top: 0, behavior: "auto" });
        }
      }, 520);
    }
  }

  const progressOffset = PROGRESS_RING_CIRCUMFERENCE * (1 - scrollState.progress);

  if (!scrollState.canScroll) {
    return null;
  }

  return (
    <button
      type="button"
      className="back-to-top"
      data-testid="back-to-top"
      data-visible={scrollState.isVisible}
      aria-label="返回顶部"
      aria-hidden={scrollState.isVisible ? undefined : "true"}
      disabled={!scrollState.isVisible}
      onClick={handleBackToTop}
      tabIndex={scrollState.isVisible ? 0 : -1}
    >
      <svg
        className="back-to-top__progress"
        viewBox="0 0 56 56"
        role="progressbar"
        aria-label="阅读进度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(scrollState.progress * 100)}
      >
        <circle className="back-to-top__track" cx="28" cy="28" r={PROGRESS_RING_RADIUS} />
        <circle
          className="back-to-top__meter"
          data-testid="back-to-top-progress"
          cx="28"
          cy="28"
          r={PROGRESS_RING_RADIUS}
          strokeDasharray={PROGRESS_RING_CIRCUMFERENCE}
          strokeDashoffset={progressOffset}
        />
      </svg>
      <span className="back-to-top__arrow" aria-hidden="true">↑</span>
      <span className="back-to-top__label">TOP</span>
    </button>
  );
}
