import BlogRoute from "../../src/BlogRoute.jsx";
import { posts } from "../../src/data/posts.js";
import { sections } from "../../src/data/sections.js";

export const dynamicParams = false;

export function generateStaticParams() {
  return ["archive", "about", "food-map"].map((path) => ({ path: [path] }))
    .concat(posts.map((post) => ({ path: ["posts", post.slug] })), sections.map((section) => ({ path: ["sections", section.slug] })));
}

export async function generateMetadata({ params }) {
  const { path } = await params;
  const post = path[0] === "posts" ? posts.find((entry) => entry.slug === path[1]) : null;
  const section = path[0] === "sections" ? sections.find((entry) => entry.slug === path[1]) : null;
  const title = post?.title ?? section?.label ?? { archive: "存档", about: "关于", "food-map": "美食地图" }[path[0]];
  return { title, description: post?.excerpt ?? section?.intro };
}

export default async function Page({ params }) {
  const { path } = await params;
  return <BlogRoute pathname={`/${path.join("/")}`} />;
}
