import BlogRoute from "../../src/BlogRoute.jsx";
import { posts } from "../../src/data/posts.js";
import { sections } from "../../src/data/sections.js";
import { getRouteMetadata } from "../../src/lib/route-metadata.js";

export const dynamicParams = false;

export function generateStaticParams() {
  return ["archive", "about", "food-map"].map((path) => ({ path: [path] }))
    .concat(posts.map((post) => ({ path: ["posts", post.slug] })), sections.map((section) => ({ path: ["sections", section.slug] })));
}

export async function generateMetadata({ params }) {
  const { path } = await params;
  return getRouteMetadata(`/${path.join("/")}`);
}

export default async function Page({ params }) {
  const { path } = await params;
  return <BlogRoute pathname={`/${path.join("/")}`} />;
}
