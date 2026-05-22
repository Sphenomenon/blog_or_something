import React, { useEffect, useRef, useState } from "react";

import { greeting } from "../data/yaml-loader.js";

const DEBOUNCE_MS = 260;

export function GreetingGate({ onEnterHome }) {
  const [gateState, setGateState] = useState({ activeIndex: 0, revealedCount: 1, pendingRevealIndex: null });
  const lastWheelTimeRef = useRef(0);
  const enterHomeRef = useRef(onEnterHome);
  const pendingRevealTimerRef = useRef(null);

  useEffect(() => {
    enterHomeRef.current = onEnterHome;
  }, [onEnterHome]);

  useEffect(() => {
    if (pendingRevealTimerRef.current !== null) {
      window.clearTimeout(pendingRevealTimerRef.current);
      pendingRevealTimerRef.current = null;
    }

    if (gateState.pendingRevealIndex === null) {
      return undefined;
    }

    pendingRevealTimerRef.current = window.setTimeout(() => {
      setGateState((current) =>
        current.pendingRevealIndex === gateState.pendingRevealIndex
          ? { ...current, pendingRevealIndex: null }
          : current
      );
      pendingRevealTimerRef.current = null;
    }, 180);

    return () => {
      if (pendingRevealTimerRef.current !== null) {
        window.clearTimeout(pendingRevealTimerRef.current);
        pendingRevealTimerRef.current = null;
      }
    };
  }, [gateState.pendingRevealIndex]);

  const activeIndex = gateState.activeIndex;
  const revealedCount = gateState.revealedCount;
  const isFinalPanel = activeIndex === greeting.panels.length - 1;
  function stepPanel(direction) {
    setGateState((current) => {
      const nextIndex = Math.min(greeting.panels.length - 1, Math.max(0, current.activeIndex + direction));
      const isNewReveal = nextIndex + 1 > current.revealedCount;
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      return {
        activeIndex: nextIndex,
        revealedCount: Math.max(current.revealedCount, nextIndex + 1),
        pendingRevealIndex: prefersReducedMotion || !isNewReveal ? null : nextIndex
      };
    });
  }

  function handleWheel(event) {
    const now = Date.now();
    if (now - lastWheelTimeRef.current < DEBOUNCE_MS) {
      return;
    }

    if (Math.abs(event.deltaY) < Math.abs(event.deltaX) && Math.abs(event.deltaX) > 0) {
      return;
    }

    if (event.deltaY > 0) {
      event.preventDefault();
      lastWheelTimeRef.current = now;
      stepPanel(1);
      return;
    }

    if (event.deltaY < 0) {
      event.preventDefault();
      lastWheelTimeRef.current = now;
      stepPanel(-1);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowDown" || event.key === "PageDown") {
      event.preventDefault();
      stepPanel(1);
      return;
    }

    if (event.key === "ArrowUp" || event.key === "PageUp") {
      event.preventDefault();
      stepPanel(-1);
    }
  }

  return (
    <section
      className="greeting-gate reveal"
      data-testid="greeting-gate"
      aria-labelledby="greeting-title"
      tabIndex={0}
      autoFocus
      style={{ "--greeting-background": "url(/images/optimized/greeting.webp)" }}
      onKeyDown={handleKeyDown}
      onWheel={handleWheel}
    >
      <div className="greeting-gate__backdrop" aria-hidden="true" />

      <div className="greeting-gate__panel" data-testid="greeting-gate-panel" data-active-index={activeIndex} data-revealed-count={revealedCount}>
        <p className="greeting-gate__kicker">{greeting.greeting_kicker}</p>
        <h1 id="greeting-title">{greeting.greeting_title}</h1>

        <div className="greeting-gate__sequence" aria-label="欢迎面板内容" aria-live="polite">
          {greeting.panels.map((panel, index) => {
            const isRevealed = index < revealedCount;
            const isActive = index === activeIndex;
            const isEntering = index === gateState.pendingRevealIndex;
            const state = !isRevealed ? "hidden" : isEntering ? "entering" : isActive ? "active" : "revealed";

            return (
              <article
                key={panel.id}
                id={panel.id}
                data-testid={panel.id}
                data-state={state}
                aria-hidden={isRevealed ? "false" : "true"}
                className="greeting-gate__entry"
              >
                <div className="greeting-gate__entry-marker" aria-hidden="true">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </div>
                <div className="greeting-gate__entry-copy">
                  <h2>{panel.title}</h2>
                  <p>{panel.body}</p>
                </div>
              </article>
            );
          })}
        </div>

        <div className="greeting-gate__steps" aria-label="欢迎面板切换">
          {greeting.panels.map((panel, index) => (
            <span
              key={panel.id}
              className={[
                index < revealedCount ? "is-revealed" : "",
                index === activeIndex ? "is-active" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              aria-hidden="true"
            />
          ))}
        </div>

        <div className="greeting-gate__controls" aria-label="欢迎操作">
          <button
            type="button"
            data-testid="greeting-prev"
            onClick={() => stepPanel(-1)}
            disabled={activeIndex === 0}
          >
            Previous
          </button>
          <button
            type="button"
            data-testid="greeting-next"
            onClick={() => stepPanel(1)}
            disabled={isFinalPanel}
          >
            Next
          </button>
          <button
            type="button"
            data-testid="greeting-enter-home"
            className="greeting-gate__enter"
            onClick={() => enterHomeRef.current()}
          >
            Enter Home
          </button>
        </div>
      </div>
    </section>
  );
}
