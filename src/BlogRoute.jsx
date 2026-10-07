"use client";

import { useSiteState, parseRoute } from "./App.jsx";
import { ViewTransition } from "react";
import { posts } from "./data/posts.js";
import { getSectionBySlug } from "./data/sections.js";
import { site } from "./data/yaml-loader.js";
import { TextRouteFrame } from "./components/TextRouteFrame.jsx";
import { SharedText } from "./components/SharedText.jsx";
import { GreetingGate } from "./components/GreetingGate.jsx";
import { HomeView } from "./views/HomeView.jsx";
import { AboutView } from "./views/AboutView.jsx";
import { ArchiveView } from "./views/ArchiveView.jsx";
import { ArticleView } from "./views/ArticleView.jsx";
import { SectionView } from "./views/SectionView.jsx";
import { FoodMapView } from "./views/FoodMapView.jsx";

export default function BlogRoute({ pathname }) {
  const state = useSiteState();
  const route = parseRoute(pathname);
  const selectedPost = route.kind === "post" ? posts.find((post) => post.slug === route.slug) : null;
  const selectedSectionData = route.kind === "section" ? getSectionBySlug(route.sectionSlug) : null;
  const isNotFound = route.kind === "not-found" || (route.kind === "post" && !selectedPost) || (route.kind === "section" && !selectedSectionData);
  const greeting = route.kind === "home" && !state.greetingDismissed;
  const routeKey = `${route.kind}-${pathname}-${greeting ? "gate" : "view"}`;
  return (
    <ViewTransition name="nocturne-route" update="nocturne-page" share="nocturne-page">
    <main className="route-stage" data-route-kind={route.kind} data-transition-state="idle" data-list-transition-state={state.listTransitionState}>
      <TextRouteFrame key={routeKey} greeting={greeting} resetScroll={state.resetScroll} completeNavigation={state.completeNavigation}>
        {greeting && <GreetingGate onEnterHome={state.dismissGreeting} />}
        {route.kind === "home" && !greeting && <HomeView filteredPosts={state.filteredPosts} onOpenPost={state.openPost} onSectionChange={state.openSection}
          statusFilter={state.statusFilter} setStatusFilter={state.setStatusFilter} tagFilter={state.tagFilter} setTagFilter={state.setTagFilter} onReplayGreeting={state.replayGreeting} />}
        {selectedPost && <ArticleView post={selectedPost} onOpenPost={state.openPost} onOpenSection={state.openSection} pathname={pathname} />}
        {route.kind === "archive" && <ArchiveView onOpenPost={state.openPost} />}
        {route.kind === "about" && <AboutView />}
        {route.kind === "food-map" && <FoodMapView />}
        {selectedSectionData && <SectionView sectionSlug={selectedSectionData.slug} onOpenPost={state.openPost} />}
        {isNotFound && <div data-testid="not-found-view">
          <h1><SharedText>{site.error_404_title}</SharedText></h1>
          <p><SharedText>{site.error_404_body}</SharedText></p>
          <button type="button" onClick={() => state.navigateTo("/")}>{site.error_404_button}</button>
        </div>}
      </TextRouteFrame>
    </main>
    </ViewTransition>
  );
}
