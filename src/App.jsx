"use client";

import { createContext, useContext, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import { SiteHeader } from "./components/SiteHeader.jsx";
import { posts } from "./data/posts.js";
import { MusicEasterEgg } from "./components/MusicEasterEgg.jsx";
import { BackToTop } from "./components/BackToTop.jsx";
import { getSectionBySlug } from "./data/sections.js";

const LIST_TRANSITION_MS = 220;
const GREETING_SESSION_KEY = "nocturne:greeting-dismissed";
const NETLIFY_IDENTITY_SCRIPT_URL = "https://identity.netlify.com/v1/netlify-identity-widget.js";
const SiteContext = createContext(null);

export function useSiteState() {
  return useContext(SiteContext);
}

export default function App({ children }) {
  // History updates are urgent in Next. Deferring only the local view lets
  // React's ViewTransition capture it without delaying the address or controls.
  const pathname = useDeferredValue(usePathname() || "/");
  const shouldReduceMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [tagFilter, setTagFilter] = useState("All");
  const [greetingDismissed, setGreetingDismissed] = useState(false);
  const [listTransitionState, setListTransitionState] = useState("idle");
  const listTransitionTimerRef = useRef(null);
  const searchScrollPendingRef = useRef(false);
  const routeScrollPendingRef = useRef(false);
  const pendingPathRef = useRef(null);
  const navigateRef = useRef(null);
  const filterSnapshotRef = useRef({ query: "", statusFilter: "All", tagFilter: "All" });

  const postBySlug = useMemo(() => {
    return posts.reduce((acc, post) => {
      acc[post.slug] = post;
      return acc;
    }, {});
  }, []);

  const route = useMemo(() => parseRoute(pathname), [pathname]);
  const selectedPost = route.kind === "post" ? postBySlug[route.slug] ?? null : null;
  const selectedSection = route.kind === "section" ? route.sectionSlug : null;
  const activeHeaderSection = selectedSection ?? selectedPost?.section ?? "";
  const isGreetingVisible = route.kind === "home" && !greetingDismissed;

  const activeView = useMemo(() => {
    if (route.kind === "home") return "home";
    if (route.kind === "post" && selectedPost) return "post";
    if (route.kind === "archive") return "archive";
    if (route.kind === "about") return "about";
    if (route.kind === "food-map") return "food-map";
    return "";
  }, [route.kind, selectedPost]);

  function clearListTransitionTimer() {
    if (listTransitionTimerRef.current !== null) {
      window.clearTimeout(listTransitionTimerRef.current);
      listTransitionTimerRef.current = null;
    }
  }

  function armListTransition() {
    clearListTransitionTimer();
    setListTransitionState("refreshing");
    listTransitionTimerRef.current = window.setTimeout(() => {
      setListTransitionState("idle");
      listTransitionTimerRef.current = null;
    }, LIST_TRANSITION_MS);
  }

  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return posts.filter((post) => {
      const sectionMeta = getSectionBySlug(post.section);
      const sectionLabel = sectionMeta?.label ?? "";
      const sectionShortLabel = sectionMeta?.shortLabel ?? "";
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [post.id, post.title, post.excerpt, sectionLabel, sectionShortLabel, post.section, ...post.tags]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesStatus = statusFilter === "All" || post.status.trim().toLowerCase() === statusFilter.toLowerCase();
      const matchesTag = tagFilter === "All" || post.tags.includes(tagFilter);
      return matchesQuery && matchesStatus && matchesTag;
    });
  }, [query, statusFilter, tagFilter]);

  useEffect(() => {
    try {
      setGreetingDismissed(window.sessionStorage.getItem(GREETING_SESSION_KEY) === "true");
    } catch {
      setGreetingDismissed(false);
    }
  }, []);

  useEffect(() => {
    function followInternalLink(event) {
      let link = event.target.closest?.(".site-header a[href], .route-stage a[href]");
      // During snapshot capture the browser redirects pointer targets to <html>.
      if (!link && event.target === document.documentElement && event.detail > 0) {
        let capturing = false;
        try { capturing = document.documentElement.matches(":active-view-transition"); } catch { /* Older browsers keep native hit testing. */ }
        if (capturing) {
          link = [...document.querySelectorAll(".site-header a[href]")].find((candidate) => {
            const bounds = candidate.getBoundingClientRect();
            return bounds.width > 0 && bounds.height > 0 && event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
          });
        }
      }
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute("download") || (link.target && link.target !== "_self") || link.origin !== window.location.origin) return;
      if (link.hash && link.pathname === window.location.pathname) return;
      const destination = parseRoute(link.pathname);
      if (destination.kind === "not-found") return;
      event.preventDefault();
      navigateRef.current(`${link.pathname}${link.search}${link.hash}`);
    }
    document.addEventListener("click", followInternalLink, true);
    return () => document.removeEventListener("click", followInternalLink, true);
  }, []);

  useEffect(() => {
    if (route.kind !== "home") {
      clearListTransitionTimer();
      setListTransitionState("idle");
    }
  }, [route.kind]);

  useEffect(() => {
    if (route.kind !== "home" || !greetingDismissed || !searchScrollPendingRef.current) {
      return undefined;
    }

    searchScrollPendingRef.current = false;
    const frameId = window.requestAnimationFrame(() => {
      document.getElementById("home-archive-index")?.scrollIntoView({
        behavior: shouldReduceMotion ? "auto" : "smooth",
        block: "start"
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [greetingDismissed, route.kind, shouldReduceMotion]);

  useEffect(() => {
    const previous = filterSnapshotRef.current;
    const next = { query, statusFilter, tagFilter };
    filterSnapshotRef.current = next;

    if (route.kind !== "home") {
      return;
    }

    if (previous.query !== query || previous.statusFilter !== statusFilter || previous.tagFilter !== tagFilter) {
      armListTransition();
    }
  }, [query, statusFilter, tagFilter, route.kind]);

  useEffect(() => {
    return () => {
      clearListTransitionTimer();
    };
  }, []);

  useEffect(() => {
    if (document.querySelector('script[data-netlify-identity-widget="true"]')) {
      return undefined;
    }

    let idleCallbackId = null;
    let fallbackTimerId = null;
    let didScheduleScript = false;

    function appendIdentityWidget() {
      if (didScheduleScript || document.querySelector('script[data-netlify-identity-widget="true"]')) {
        return;
      }

      didScheduleScript = true;
      const script = document.createElement("script");
      script.src = NETLIFY_IDENTITY_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.dataset.netlifyIdentityWidget = "true";
      document.body.appendChild(script);
    }

    if ("requestIdleCallback" in window) {
      idleCallbackId = window.requestIdleCallback(appendIdentityWidget, { timeout: 2500 });
    } else {
      fallbackTimerId = window.setTimeout(appendIdentityWidget, 1200);
    }

    return () => {
      if (idleCallbackId !== null) {
        window.cancelIdleCallback(idleCallbackId);
      }
      if (fallbackTimerId !== null) {
        window.clearTimeout(fallbackTimerId);
      }
    };
  }, []);

  function navigateTo(nextPath) {
    if (normalizePath(nextPath) === normalizePath(pendingPathRef.current ?? pathname)) {
      return;
    }

    pendingPathRef.current = nextPath;
    routeScrollPendingRef.current = true;
    // Every view already uses bundled content. Next's supported History API
    // updates usePathname without fetching redundant route/segment payloads.
    window.history.pushState(null, "", nextPath);
  }
  navigateRef.current = navigateTo;

  function dismissGreeting() {
    routeScrollPendingRef.current = true;
    setGreetingDismissed(true);
    try {
      window.sessionStorage.setItem(GREETING_SESSION_KEY, "true");
    } catch {
      // In-memory state still works when browser storage is unavailable.
    }
  }

  function replayGreeting() {
    routeScrollPendingRef.current = true;
    setGreetingDismissed(false);
    navigateTo("/");
  }

  function openPost(postOrSlug) {
    if (typeof postOrSlug === "string") {
      navigateTo(`/posts/${postOrSlug}`);
      return;
    }

    if (postOrSlug?.slug) {
      navigateTo(`/posts/${postOrSlug.slug}`);
    }
  }

  function openSection(sectionSlug) {
    navigateTo(`/sections/${sectionSlug}`);
  }

  function submitSearch() {
    searchScrollPendingRef.current = true;
    dismissGreeting();

    if (route.kind !== "home") {
      navigateTo("/");
    }
  }

  function handleViewChange(nextView) {
    if (nextView === "home") {
      navigateTo("/");
      return;
    }
    if (nextView === "post") {
      navigateTo(`/posts/${posts[0].slug}`);
      return;
    }
    if (nextView === "archive") {
      navigateTo("/archive");
      return;
    }
    if (nextView === "about") {
      navigateTo("/about");
      return;
    }
    if (nextView === "food-map") {
      navigateTo("/food-map");
      return;
    }
  }

  const state = {
    pathname,
    greetingDismissed, filteredPosts, statusFilter, setStatusFilter, tagFilter, setTagFilter,
    dismissGreeting, replayGreeting, openPost, openSection, navigateTo, listTransitionState,
    resetScroll: routeScrollPendingRef.current,
    completeNavigation: () => {
      if (pendingPathRef.current === null || normalizePath(pendingPathRef.current) === normalizePath(pathname)) {
        pendingPathRef.current = null;
        routeScrollPendingRef.current = false;
      }
    }
  };

  return (
    <SiteContext.Provider value={state}>
    <div className="app-shell">
      {!isGreetingVisible && (
        <SiteHeader
          routeKey={pathname}
          activeSectionSlug={activeHeaderSection}
          activeView={activeView}
          onSectionChange={openSection}
          onViewChange={handleViewChange}
          query={query}
          onQueryChange={setQuery}
          onSearchSubmit={submitSearch}
        />
      )}
      {children}
      <MusicEasterEgg
        variant={route.kind === "home" ? "full" : "mini"}
        isHomeReady={route.kind !== "home" || greetingDismissed}
      />
      <BackToTop routeKey={pathname} />
    </div>
    </SiteContext.Provider>
  );
}

export function parseRoute(pathname) {
  const normalizedPath = normalizePath(pathname);

  if (normalizedPath === "/") {
    return { kind: "home" };
  }

  if (normalizedPath === "/archive") {
    return { kind: "archive" };
  }

  if (normalizedPath === "/about") {
    return { kind: "about" };
  }

  if (normalizedPath === "/food-map") {
    return { kind: "food-map" };
  }

  const postMatch = normalizedPath.match(/^\/posts\/([^/]+)$/);
  if (postMatch) {
    return { kind: "post", slug: decodeURIComponent(postMatch[1]) };
  }

  const sectionMatch = normalizedPath.match(/^\/sections\/([^/]+)$/);
  if (sectionMatch) {
    return { kind: "section", sectionSlug: decodeURIComponent(sectionMatch[1]) };
  }

  return { kind: "not-found" };
}

function normalizePath(pathname) {
  if (!pathname) return "/";
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return trimmed || "/";
}
