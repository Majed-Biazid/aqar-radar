import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import { DISTRICTS } from "@/lib/districts";

export const dynamic = "force-dynamic";
export const maxDuration = 900; // 15 min cap — detail-page photo fetch is slow

/**
 * POST /api/refresh — kicks off the Python scraper. Two ways to call it:
 *
 *   1. From the in-app "تحديث" button (same-origin, no auth header).
 *   2. From cron-job.org or another external cron, using a Bearer token in
 *      either the `Authorization` header OR a `?secret=` query param. The
 *      expected token is the env var CRON_SECRET (set in .env.local + on the
 *      production host).
 *
 * If CRON_SECRET is set, ALL requests must authenticate (in-app button uses
 * fetch() with the same-origin header injected client-side — see RefreshButton).
 */
async function authorize(req: NextRequest): Promise<true | NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev mode — no auth required

  // Same-origin requests (the in-app refresh button) are trusted. Browsers
  // attach Origin on fetch() POSTs, so external sites can't impersonate us
  // without the user already running this site.
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host === host) return true;
    } catch { /* fall through to secret check */ }
  }

  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const queryToken = req.nextUrl.searchParams.get("secret");
  const provided = bearer ?? queryToken;
  if (provided !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return true;
}

async function runScrape(): Promise<Response> {
  const cwd = process.cwd();
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_DB_URL is not set on the server" },
      { status: 500 }
    );
  }
  const scriptPath = path.join(cwd, "scraper", "scrape.py");

  const cities = Array.from(new Set(DISTRICTS.map((d) => d.city)));
  const targetsArg = [
    ...DISTRICTS.map((d) => `${d.city}:${d.slug}`),
    ...cities.map((c) => `${c}:_all`),
  ].join(",");

  return new Promise<Response>((resolve) => {
    const proc = spawn(
      "python3",
      [
        scriptPath,
        "--db-url", dbUrl,
        "--targets", targetsArg,
        "--price-min", process.env.SCRAPE_PRICE_MIN ?? "28000",
        "--price-max", process.env.SCRAPE_PRICE_MAX ?? "40000",
      ],
      { cwd, stdio: ["ignore", "pipe", "pipe"] }
    );

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    proc.stderr.on("data", (chunk) => (stderr += chunk.toString()));

    proc.on("close", (code) => {
      if (code !== 0) {
        resolve(
          NextResponse.json(
            { ok: false, code, stderr: stderr.slice(-2000), stdout: stdout.slice(-2000) },
            { status: 500 }
          )
        );
        return;
      }
      const jsonStart = stdout.lastIndexOf("{");
      let summary: unknown = null;
      try {
        if (jsonStart >= 0) summary = JSON.parse(stdout.slice(jsonStart));
      } catch {
        summary = null;
      }
      resolve(NextResponse.json({ ok: true, summary, log_tail: stdout.slice(-1500) }));
    });
  });
}

export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if (auth !== true) return auth;
  return runScrape();
}

// Also accept GET — cron-job.org defaults to GET. Treats it identically.
export async function GET(req: NextRequest) {
  const auth = await authorize(req);
  if (auth !== true) return auth;
  return runScrape();
}
