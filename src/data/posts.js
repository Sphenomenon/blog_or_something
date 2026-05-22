import {
  getArticleNeighbors,
  getArchivePostsByYear,
  getArchiveYears,
  getSectionRepresentativePosts,
  normalizeCanonicalArticleCommentPath,
  posts,
  sortedPosts
} from "./content.js";

export { posts };
export { sortedPosts };
export { getSectionRepresentativePosts, getArticleNeighbors, getArchiveYears, getArchivePostsByYear, normalizeCanonicalArticleCommentPath };

export function getTagCounts() {
  return posts.reduce((acc, post) => {
    post.tags.forEach((tag) => {
      acc[tag] = (acc[tag] ?? 0) + 1;
    });
    return acc;
  }, {});
}
