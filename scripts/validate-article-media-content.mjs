import { formatArticleMediaValidationError, validateProductionArticleMedia } from "./article-media-content-validator.mjs";

const result = await validateProductionArticleMedia();
if (!result.ok) {
  for (const error of result.errors) console.error(formatArticleMediaValidationError(error));
  process.exitCode = 1;
} else {
  console.log(`PASS article media production content (${result.postCount} posts, ${result.localReferenceCount} local references, ${result.remoteReferenceCount} remote references)`);
}
