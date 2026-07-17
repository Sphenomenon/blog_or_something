import path from "node:path";
import { fileURLToPath } from "node:url";

export const ARTICLE_IMAGE_FIXTURE_MARKER = "NOCTURNE_ARTICLE_MEDIA_FIXTURE_7D3A91";
export const ARTICLE_IMAGE_FIXTURE_TITLE = "Verification Article Media Ledger";
export const ARTICLE_IMAGE_REMOTE_URL = "https://article-media.invalid/intercepted/remote-landscape.jpg";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const FIXTURE_ROOT = path.join(PROJECT_ROOT, "scripts/fixtures/article-images");
const EVIDENCE_ROOT = path.join(PROJECT_ROOT, ".sisyphus/evidence/article-media");

export function getArticleImageFixtureRuntime(mode) {
  if (mode !== "verification") {
    throw new Error("Article image fixtures are available only in Vite verification mode");
  }

  return Object.freeze({
    fixtureRoot: FIXTURE_ROOT,
    assetRoot: path.join(FIXTURE_ROOT, "assets"),
    validMarkdownPath: path.join(FIXTURE_ROOT, "markdown/valid.md"),
    invalidRegistryPath: path.join(FIXTURE_ROOT, "invalid-cases.json"),
    runtimeRoot: path.join(EVIDENCE_ROOT, "fixture-runtime"),
    runtimeManifestPath: path.join(EVIDENCE_ROOT, "fixture-runtime/manifest.json")
  });
}
