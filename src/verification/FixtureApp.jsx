import { useState } from "react";
import ArticleImagesVerificationView from "./ArticleImagesVerificationView.jsx";
import { AboutView } from "../views/AboutView.jsx";
import { MusicEasterEgg } from "../components/MusicEasterEgg.jsx";

export default function FixtureApp() {
  const [pathname, setPathname] = useState(window.location.pathname);
  function navigate(path) {
    window.history.pushState({}, "", path);
    setPathname(path);
  }
  return <div className="app-shell"><main className="route-stage">
    {pathname === "/__verify__/article-images" ? <ArticleImagesVerificationView onNavigate={navigate} /> : <AboutView />}
  </main><MusicEasterEgg variant="mini" isHomeReady /></div>;
}
