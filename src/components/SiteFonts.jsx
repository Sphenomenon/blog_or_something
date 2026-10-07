"use client";

import { useEffect } from "react";

const FONT_STYLESHEET = "https://fonts.loli.net/css2?family=JetBrains+Mono:wght@400;500&family=Noto+Sans+SC:wght@400;500;700&family=Noto+Serif+SC:wght@400;500;700&display=swap";

export function SiteFonts() {
  useEffect(() => {
    if (document.querySelector("link[data-site-fonts]")) return;

    // A parser-inserted external stylesheet blocks first paint and hydration.
    // Load fonts after hydration so slow font hosts leave the site interactive.
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = FONT_STYLESHEET;
    stylesheet.dataset.siteFonts = "true";
    document.head.appendChild(stylesheet);
  }, []);

  return null;
}
