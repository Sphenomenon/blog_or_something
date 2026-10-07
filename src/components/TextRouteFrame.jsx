import { useLayoutEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { invalidateTextTransition, prepareTextTransition } from "../lib/text-transition.js";

export function TextRouteFrame({ children, greeting, resetScroll, completeNavigation }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const frame = ref.current;
    if (resetScroll) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    completeNavigation();
    prepareTextTransition(frame, { transition: true });
    let request = null;
    const refresh = () => {
      if (request !== null) window.cancelAnimationFrame(request);
      request = window.requestAnimationFrame(() => {
        try {
          if (document.documentElement.matches(":active-view-transition")) {
            refresh();
            return;
          }
        } catch { /* Browsers without the selector still refresh normally. */ }
        prepareTextTransition(frame);
        request = null;
      });
    };
    const prepare = (event) => {
      if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
      if (!event.target.closest?.("a[href], button")) return;
      prepareTextTransition(frame);
    };
    window.addEventListener("scroll", refresh, { passive: true });
    window.addEventListener("resize", refresh, { passive: true });
    document.addEventListener("pointerdown", prepare, true);
    document.addEventListener("keydown", prepare, true);
    const observer = new ResizeObserver(refresh);
    observer.observe(frame);
    const contentObserver = new MutationObserver(() => {
      invalidateTextTransition(frame);
      refresh();
    });
    contentObserver.observe(frame, { childList: true, subtree: true });
    return () => {
      if (request !== null) window.cancelAnimationFrame(request);
      window.removeEventListener("scroll", refresh);
      window.removeEventListener("resize", refresh);
      document.removeEventListener("pointerdown", prepare, true);
      document.removeEventListener("keydown", prepare, true);
      observer.disconnect();
      contentObserver.disconnect();
    };
  }, []);

  return (
      <div ref={ref} className={`route-frame route-transition-frame${greeting ? " route-frame--greeting" : ""}`} data-entry-motion="text">
        <AnimatePresence initial={greeting}><>{children}</></AnimatePresence>
      </div>
  );
}
