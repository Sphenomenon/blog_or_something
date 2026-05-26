import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SiteHeader } from "./components/SiteHeader.jsx";
import { posts } from "./data/posts.js";
import { AboutView } from "./pages/AboutView.jsx";
import { ArchiveView } from "./pages/ArchiveView.jsx";
import { ArticleView } from "./pages/ArticleView.jsx";
import { GreetingGate } from "./components/GreetingGate.jsx";
import { MusicEasterEgg } from "./components/MusicEasterEgg.jsx";
import { BackToTop } from "./components/BackToTop.jsx";
import { HomeView } from "./pages/HomeView.jsx";
import { SectionView } from "./pages/SectionView.jsx";
import { FoodMapView } from "./pages/FoodMapView.jsx";
import { site } from "./data/yaml-loader.js";
import { getSectionBySlug } from "./data/sections.js";
import { viewTransition } from "./lib/motion.js";

const ROUTE_TRANSITION_MS = 320;
const LIST_TRANSITION_MS = 220;

export default function App() {
  const shouldReduceMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [tagFilter, setTagFilter] = useState("All");
  const [greetingDismissed, setGreetingDismissed] = useState(false);
  const [pathname, setPathname] = useState(() => window.location.pathname || "/");
  const [transitionState, setTransitionState] = useState("idle");
  const [listTransitionState, setListTransitionState] = useState("idle");
  const routeTransitionTimerRef = useRef(null);
  const listTransitionTimerRef = useRef(null);
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
  const selectedSectionData = selectedSection ? getSectionBySlug(selectedSection) : null;
  const isNotFound = route.kind === "not-found" || (route.kind === "post" && !selectedPost) || (route.kind === "section" && !selectedSectionData);
  const routeFrameKey = `${route.kind}:${normalizePath(pathname)}:${route.kind === "home" && !greetingDismissed ? "gate" : "view"}`;

  const activeView = useMemo(() => {
    if (route.kind === "home") return "home";
    if (route.kind === "post" && selectedPost) return "post";
    if (route.kind === "archive") return "archive";
    if (route.kind === "about") return "about";
    if (route.kind === "food-map") return "food-map";
    return "";
  }, [route.kind, selectedPost]);

  function clearRouteTransitionTimer() {
    if (routeTransitionTimerRef.current !== null) {
      window.clearTimeout(routeTransitionTimerRef.current);
      routeTransitionTimerRef.current = null;
    }
  }

  function clearListTransitionTimer() {
    if (listTransitionTimerRef.current !== null) {
      window.clearTimeout(listTransitionTimerRef.current);
      listTransitionTimerRef.current = null;
    }
  }

  function armRouteTransition() {
    clearRouteTransitionTimer();
    setTransitionState("transitioning");
    routeTransitionTimerRef.current = window.setTimeout(() => {
      setTransitionState("idle");
      routeTransitionTimerRef.current = null;
    }, ROUTE_TRANSITION_MS);
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
      const matchesStatus = statusFilter === "All" || post.status === statusFilter;
      const matchesTag = tagFilter === "All" || post.tags.includes(tagFilter);
      return matchesQuery && matchesStatus && matchesTag;
    });
  }, [query, statusFilter, tagFilter]);

  useEffect(() => {
    function handlePopState() {
      armRouteTransition();
      setPathname(window.location.pathname || "/");
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (route.kind !== "home") {
      setGreetingDismissed(false);
      clearListTransitionTimer();
      setListTransitionState("idle");
    }
  }, [route.kind]);

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
      clearRouteTransitionTimer();
      clearListTransitionTimer();
    };
  }, []);

  function navigateTo(nextPath) {
    if (normalizePath(nextPath) === normalizePath(pathname)) {
      return;
    }

    armRouteTransition();
    if (nextPath !== window.location.pathname) {
      window.history.pushState({}, "", nextPath);
    }
    setPathname(nextPath);
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

  return (
    <div className="app-shell">
      {(!(route.kind === "home" && !greetingDismissed)) && (
        <SiteHeader
          activeSectionSlug={activeHeaderSection}
          activeView={activeView}
          onSectionChange={openSection}
          onViewChange={handleViewChange}
          query={query}
          onQueryChange={setQuery}
        />
      )}
      <main
        className="route-stage"
        data-route-kind={route.kind}
        data-transition-state={transitionState}
        data-list-transition-state={listTransitionState}
      >
        <motion.div
          key={routeFrameKey}
          className="route-frame"
          variants={viewTransition}
          initial={shouldReduceMotion ? false : "initial"}
          animate="animate"
          custom={shouldReduceMotion}
        >
          {route.kind === "home" && !greetingDismissed && (
            <GreetingGate onEnterHome={() => setGreetingDismissed(true)} />
          )}
          {route.kind === "home" && greetingDismissed && (
            <HomeView
              filteredPosts={filteredPosts}
              onOpenPost={openPost}
              onSectionChange={openSection}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              tagFilter={tagFilter}
              setTagFilter={setTagFilter}
            />
          )}
          {route.kind === "post" && selectedPost && <ArticleView post={selectedPost} onOpenPost={openPost} pathname={pathname} />}
          {route.kind === "archive" && <ArchiveView onOpenPost={openPost} />}
          {route.kind === "about" && <AboutView />}
          {route.kind === "food-map" && <FoodMapView />}
          {route.kind === "section" && selectedSectionData && <SectionView sectionSlug={selectedSectionData.slug} onOpenPost={openPost} onOpenArchive={() => navigateTo("/archive")} />}
          {isNotFound && (
            <div data-testid="not-found-view">
              <h1>{site.error_404_title}</h1>
              <p>{site.error_404_body}</p>
              <button type="button" onClick={() => navigateTo("/")}>{site.error_404_button}</button>
            </div>
          )}
        </motion.div>
      </main>
      <MusicEasterEgg
        variant={route.kind === "home" ? "full" : "mini"}
        isHomeReady={route.kind !== "home" || greetingDismissed}
      />
      <BackToTop routeKey={pathname} />
    </div>
  );
}

function parseRoute(pathname) {
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
