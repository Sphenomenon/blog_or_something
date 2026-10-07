import { watch } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const next = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "dev", ...process.argv.slice(2)], { stdio: "inherit" });
let timer;
let running = false;
let pending = false;
let generator;

async function refresh() {
  if (running) { pending = true; return; }
  running = true;
  generator = spawn("npm", ["run", "prepare:article-media"], { stdio: "inherit" });
  const mediaStatus = await new Promise((done) => generator.on("close", done));
  if (mediaStatus === 0) {
    generator = spawn("npm", ["run", "generate:site-content"], { stdio: "inherit" });
    await new Promise((done) => generator.on("close", done));
  }
  running = false;
  if (pending) { pending = false; await refresh(); }
}

const watchers = ["src/content", "public/images/uploads"].map((folder) => watch(resolve(folder), { recursive: true }, () => {
  clearTimeout(timer);
  timer = setTimeout(refresh, 180);
}));

function stop() {
  clearTimeout(timer);
  watchers.forEach((watcher) => watcher.close());
  generator?.kill("SIGTERM");
  next.kill("SIGTERM");
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
next.on("close", (code) => { stop(); process.exit(code ?? 0); });
