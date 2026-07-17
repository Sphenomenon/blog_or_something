import { generateArticleMediaAssets } from "./article-media-assets.mjs";

const result = await generateArticleMediaAssets();
console.log(`PASS article media assets (${result.sourceCount} sources, ${result.writtenVariants} variants written, ${result.deletedVariants} stale variants removed)`);
