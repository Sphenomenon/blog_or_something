import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";
import yaml from "js-yaml";
import { assertArticleMediaManifest } from "./scripts/article-media-manifest-contract.mjs";

const PROJECT_ROOT = fileURLToPath(new URL("./", import.meta.url));
const ARTICLE_IMAGE_MANIFEST_ID = "virtual:article-image-manifest";
const RESOLVED_ARTICLE_IMAGE_MANIFEST_ID = `\0${ARTICLE_IMAGE_MANIFEST_ID}`;
const ARTICLE_IMAGE_VERIFICATION_FIXTURE_ID = "virtual:article-image-verification-fixture";
const RESOLVED_ARTICLE_IMAGE_VERIFICATION_FIXTURE_ID = `\0${ARTICLE_IMAGE_VERIFICATION_FIXTURE_ID}`;
const PRODUCTION_ARTICLE_IMAGE_MANIFEST_PATH = path.join(
  PROJECT_ROOT,
  "public/images/optimized/articles/manifest.json"
);
const VERIFICATION_ARTICLE_IMAGE_MANIFEST_PATH = path.join(
  PROJECT_ROOT,
  ".sisyphus/evidence/article-media/fixture-runtime/manifest.json"
);
const VERIFICATION_ARTICLE_IMAGE_FIXTURE_PATH = path.join(
  PROJECT_ROOT,
  "scripts/fixtures/article-images/markdown/valid.md"
);
const VERIFICATION_ARTICLE_IMAGE_RUNTIME_ROOT = path.join(
  PROJECT_ROOT,
  ".sisyphus/evidence/article-media/fixture-runtime"
);

function articleImageManifestPlugin({ mode }) {
  const configuredPath = mode === "verification" ? process.env.ARTICLE_IMAGE_MANIFEST_PATH : null;
  const manifestPath = path.resolve(
    configuredPath || (mode === "verification"
      ? VERIFICATION_ARTICLE_IMAGE_MANIFEST_PATH
      : PRODUCTION_ARTICLE_IMAGE_MANIFEST_PATH)
  );
  let manifest;

  try {
    manifest = assertArticleMediaManifest(JSON.parse(readFileSync(manifestPath, "utf8")), manifestPath);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`ARTICLE_MEDIA_MANIFEST_INVALID: Could not parse JSON at ${manifestPath}: ${error.message}`);
    }
    throw error;
  }

  return {
    name: "article-image-manifest",
    resolveId(id) {
      return id === ARTICLE_IMAGE_MANIFEST_ID ? RESOLVED_ARTICLE_IMAGE_MANIFEST_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ARTICLE_IMAGE_MANIFEST_ID) {
        return null;
      }

      return `export default ${JSON.stringify(manifest)};`;
    }
  };
}

function articleImageVerificationFixturePlugin({ mode }) {
  return {
    name: "article-image-verification-fixture",
    resolveId(id) {
      if (mode === "verification" && id === ARTICLE_IMAGE_VERIFICATION_FIXTURE_ID) {
        return RESOLVED_ARTICLE_IMAGE_VERIFICATION_FIXTURE_ID;
      }
      return null;
    },
    load(id) {
      if (id !== RESOLVED_ARTICLE_IMAGE_VERIFICATION_FIXTURE_ID) {
        return null;
      }

      const content = readFileSync(VERIFICATION_ARTICLE_IMAGE_FIXTURE_PATH, "utf8");
      return `export default ${JSON.stringify({
        id: "VERIFY-ARTICLE-MEDIA",
        slug: "__verify__-article-images",
        title: "Verification Article Media Ledger",
        excerpt: "Verification-only article media fixture.",
        category: "Verification",
        date: "2026-07-17",
        reading: "fixture",
        status: "Verification",
        section: "travel",
        sections: ["正文"],
        tags: ["article-media", "verification"],
        fixtureMarker: content.split("\n").find((line) => line.startsWith("NOCTURNE_ARTICLE_MEDIA_FIXTURE_")) ?? "",
        content
      })};`;
    },
    configureServer(server) {
      if (mode !== "verification") {
        return;
      }

      server.middlewares.use((request, response, next) => {
        const prefix = "/images/optimized/articles/";
        const requestPath = request.url?.split("?", 1)[0] ?? "";
        if (!requestPath.startsWith(prefix)) {
          next();
          return;
        }

        const relativePath = requestPath.slice(prefix.length);
        const assetPath = path.resolve(VERIFICATION_ARTICLE_IMAGE_RUNTIME_ROOT, ...relativePath.split("/"));
        const runtimeRoot = path.resolve(VERIFICATION_ARTICLE_IMAGE_RUNTIME_ROOT);
        if (!assetPath.startsWith(`${runtimeRoot}${path.sep}`)) {
          next();
          return;
        }

        try {
          response.setHeader("Content-Type", "image/webp");
          response.end(readFileSync(assetPath));
        } catch (error) {
          if (error.code === "ENOENT") {
            next();
            return;
          }
          next(error);
        }
      });
    }
  };
}

function yamlContentPlugin() {
  return {
    name: "yaml-content-loader",
    transform(code, id) {
      const filePath = id.split("?", 1)[0];
      if (!filePath.endsWith(".yaml") && !filePath.endsWith(".yml")) {
        return null;
      }

      const value = yaml.load(code) ?? {};
      return {
        code: `export default ${JSON.stringify(value)};`,
        map: null,
      };
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    articleImageManifestPlugin({ mode }),
    articleImageVerificationFixturePlugin({ mode }),
    yamlContentPlugin()
  ]
}));
