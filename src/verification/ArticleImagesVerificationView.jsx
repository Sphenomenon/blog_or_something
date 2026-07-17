import { ArticleView } from "../pages/ArticleView.jsx";
import verificationArticle from "virtual:article-image-verification-fixture";

export default function ArticleImagesVerificationView({ onNavigate }) {
  return (
    <div
      data-testid="article-media-verification-route"
      data-fixture-marker={verificationArticle.fixtureMarker}
    >
      <button
        type="button"
        data-testid="article-media-verification-exit"
        onClick={() => onNavigate("/about")}
      >
        Exit verification article
      </button>
      <ArticleView
        post={verificationArticle}
        onOpenPost={() => {}}
        verificationOnly
      />
    </div>
  );
}
