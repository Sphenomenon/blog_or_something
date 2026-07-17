import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const EVIDENCE_PATH = path.join(PROJECT_ROOT, ".sisyphus/evidence/article-media/integration/aggregate.json");
const commands = [
  ["fixtures", "verify:article-media-fixtures"],
  ["parser", "verify:article-media-parser"],
  ["assets", "verify:article-media-assets"],
  ["browser", "verify:article-media-browser"],
  ["production-isolation", "verify:article-media-isolation"]
];
const results = [];

for (const [group, script] of commands) {
  const command = `npm run ${script}`;
  const result = spawnSync("npm", ["run", script], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 50,
    timeout: 10 * 60 * 1000
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  results.push({ group, command, status: result.status, signal: result.signal, error: result.error?.message ?? null, output });
  if (result.status !== 0) {
    await mkdir(path.dirname(EVIDENCE_PATH), { recursive: true });
    await writeFile(EVIDENCE_PATH, `${JSON.stringify({ passed: false, results }, null, 2)}\n`);
    if (output) console.error(output);
    process.exit(result.status ?? 1);
  }
  if (output) console.log(output);
}

await mkdir(path.dirname(EVIDENCE_PATH), { recursive: true });
await writeFile(EVIDENCE_PATH, `${JSON.stringify({ passed: true, serial: true, results }, null, 2)}\n`);
console.log("PASS article media aggregate verification (fixtures preflight; parser -> assets -> browser -> production isolation)");
