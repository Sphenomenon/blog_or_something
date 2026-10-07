import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const evidence = new URL("../.sisyphus/evidence/visual-verification.json", import.meta.url);
const checks = [
  ["startup", "verify-startup.mjs"],
  ["reading", "verify-reading-experience.mjs"],
  ["site-polish", "verify-site-polish.mjs"],
  ["decorative-accents", "verify-decorative-accents.mjs"],
  ["route-motion", "verify-route-motion.mjs"]
];

await stat(new URL("../out/index.html", import.meta.url)).catch(() => {
  throw new Error("Build the Next.js static output first: npm run build");
});
await mkdir(new URL("../.sisyphus/evidence/", import.meta.url), { recursive: true });

const results = [];
for (const [name, script] of checks) {
  const started = performance.now();
  const child = spawn(process.execPath, [fileURLToPath(new URL(script, import.meta.url))], { cwd: root, stdio: "inherit" });
  const result = await new Promise((resolve) => {
    child.once("error", (error) => resolve({ name, passed: false, error: error.message }));
    child.once("close", (code, signal) => resolve({ name, passed: code === 0, code, signal, durationMs: Math.round(performance.now() - started) }));
  });
  results.push(result);
}

await writeFile(evidence, `${JSON.stringify({ passed: results.every((result) => result.passed), results }, null, 2)}\n`);
assert(results.every((result) => result.passed), `Visual verification failed: ${results.filter((result) => !result.passed).map((result) => result.name).join(", ")}`);
console.log("PASS visual verification (current content, responsive layout, keyboard interactions, persistent music, native text transitions and reduced motion)");
