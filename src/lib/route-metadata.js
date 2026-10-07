import { posts } from "../data/posts.js";
import { sections } from "../data/sections.js";

export const SITE_TITLE = "失眠档案馆 · Nocturne Archive";
export const SITE_DESCRIPTION = "清醒的档案系统，记录一场正在腐朽的梦。";

export function getRouteMetadata(pathname) {
  const path = pathname.replace(/\/$/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const post = path[0] === "posts" ? posts.find((entry) => entry.slug === path[1]) : null;
  const section = path[0] === "sections" ? sections.find((entry) => entry.slug === path[1]) : null;
  return {
    title: post?.title ?? section?.label ?? { archive: "存档", about: "关于", "food-map": "美食地图" }[path[0]],
    description: post?.excerpt ?? section?.intro ?? SITE_DESCRIPTION
  };
}
