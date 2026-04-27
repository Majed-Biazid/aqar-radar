/**
 * scripts/cron.js — schedules the rental scraper to run every 30 minutes.
 *
 * Run: `npm run cron`. Keep it running in a tmux/screen/launchd job. When the
 * cron fires it spawns the same Python scraper that /api/refresh uses, but
 * directly — no Next.js round-trip, no web server required.
 *
 * Storage: writes to Supabase Postgres (via SUPABASE_DB_URL from .env.local).
 * Falls back to SQLite (LISTINGS_DB_PATH) only if SUPABASE_DB_URL isn't set.
 *
 * Targets are derived from lib/districts.ts at boot. Each city gets every
 * known slug + a city-wide _all catch-all so listings filed under slugs we
 * don't enumerate (or districts that aqar only labels in free text) still
 * get pulled in via the API's text-override layer.
 */
const cron = require("node-cron");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

// --- Load .env.local (no dotenv dep) -----------------------------------
const envPath = path.join(ROOT, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const k = trimmed.slice(0, idx).trim();
    const v = trimmed.slice(idx + 1).trim();
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

const PY = process.env.PYTHON_BIN || "python3";
const SCRIPT = path.join(ROOT, "scraper", "scrape.py");
const DB_URL = process.env.SUPABASE_DB_URL;
const DB_PATH = process.env.LISTINGS_DB_PATH || path.join(ROOT, "data", "listings.db");
const PRICE_MIN = process.env.SCRAPE_PRICE_MIN || "28000";
const PRICE_MAX = process.env.SCRAPE_PRICE_MAX || "40000";
const SCHEDULE = process.env.CRON_SCHEDULE || "*/30 * * * *"; // every 30 min

// --- Build targets list from lib/districts.ts --------------------------
// We don't import the TS file directly (no transpiler in cron) — instead we
// parse the slug/city pairs out of it. Cheap, robust, and avoids a build step.
function loadTargets() {
  const distFile = fs.readFileSync(path.join(ROOT, "lib", "districts.ts"), "utf8");
  const re = /\{\s*slug:\s*"([^"]+)"\s*,\s*label:\s*"[^"]+"\s*,\s*city:\s*"([^"]+)"/g;
  const pairs = new Set();
  const cities = new Set();
  let m;
  while ((m = re.exec(distFile))) {
    pairs.add(`${m[2]}:${m[1]}`);
    cities.add(m[2]);
  }
  for (const c of cities) pairs.add(`${c}:_all`);
  return Array.from(pairs);
}

let running = false;

function runScrape() {
  if (running) {
    console.log(`[cron] previous run still in flight, skipping ${new Date().toISOString()}`);
    return;
  }
  running = true;
  const startedAt = new Date();
  const targets = loadTargets();
  console.log(`[cron] ▸ scrape started ${startedAt.toISOString()} · ${targets.length} targets`);

  const args = [SCRIPT];
  if (DB_URL) {
    args.push("--db-url", DB_URL);
  } else {
    console.warn("[cron] SUPABASE_DB_URL not set — falling back to SQLite at", DB_PATH);
    args.push("--db-path", DB_PATH);
  }
  args.push("--targets", targets.join(","), "--price-min", PRICE_MIN, "--price-max", PRICE_MAX);

  const proc = spawn(PY, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });

  let stdout = "";
  let stderr = "";
  proc.stdout.on("data", (c) => (stdout += c.toString()));
  proc.stderr.on("data", (c) => (stderr += c.toString()));

  proc.on("close", (code) => {
    running = false;
    const dur = ((Date.now() - startedAt.getTime()) / 1000).toFixed(1);
    if (code !== 0) {
      console.error(`[cron] ✘ scrape failed in ${dur}s (exit ${code})`);
      if (stderr) console.error(stderr.split("\n").slice(-10).join("\n"));
      return;
    }
    const lastBrace = stdout.lastIndexOf("{");
    let summary = null;
    try {
      if (lastBrace >= 0) summary = JSON.parse(stdout.slice(lastBrace));
    } catch {}
    if (summary) {
      console.log(
        `[cron] ✓ ${dur}s · scraped=${summary.scraped} new=${summary.new} gone=${summary.gone} priceΔ=${summary.price_changes}`
      );
    } else {
      console.log(`[cron] ✓ ${dur}s · (no summary)`);
    }
  });
}

console.log(`[cron] schedule "${SCHEDULE}" · ${DB_URL ? "Supabase" : "SQLite at " + DB_PATH}`);
cron.schedule(SCHEDULE, runScrape, { timezone: "Asia/Riyadh" });

if (process.env.SKIP_INITIAL_RUN !== "1") {
  runScrape();
}

function shutdown(sig) {
  console.log(`[cron] received ${sig}, waiting for current scrape (if any)…`);
  const wait = setInterval(() => {
    if (!running) {
      clearInterval(wait);
      process.exit(0);
    }
  }, 500);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
