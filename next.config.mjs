export default {
  output: "export",
  trailingSlash: false,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_AMAP_KEY: process.env.NEXT_PUBLIC_AMAP_KEY ?? process.env.VITE_AMAP_KEY ?? "",
    NEXT_PUBLIC_AMAP_SECURITY_JS_CODE: process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE ?? process.env.VITE_AMAP_SECURITY_JS_CODE ?? ""
  },
  turbopack: {
    root: import.meta.dirname,
    resolveAlias: {
      "virtual:article-image-manifest": "./src/generated/article-image-manifest.js"
    }
  }
};
