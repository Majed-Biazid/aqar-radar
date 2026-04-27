import { Pool } from "pg";

// Postgres pool against Supabase. Connection string lives in SUPABASE_DB_URL
// (see .env.local). We use the Session pooler — port 5432 — which is
// IPv4-friendly and supports prepared statements (unlike the Transaction pooler).

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (_pool) return _pool;
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("SUPABASE_DB_URL is not set");
  _pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    // Supabase Nano allows 15 backend connections shared across the pool;
    // keep this conservative so the scraper, API, and migration don't fight.
    max: 5,
    idleTimeoutMillis: 10_000,
  });
  return _pool;
}

export async function closeDb(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}
