import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";

/**
 * Saved-listings endpoints (single-user app).
 *
 * GET  /api/saved              → { ids: string[] }
 * POST /api/saved              body: { id: string, note?: string }
 * DELETE /api/saved?id=…       remove a single id
 *
 * No auth yet — the app is single-user. When multi-user is added,
 * gate by a session token and add user_id to the table.
 */

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const pool = getPool();
  const { rows } = await pool.query<{ listing_id: string }>(
    "SELECT listing_id FROM saved_listings ORDER BY saved_at DESC"
  );
  return NextResponse.json({ ids: rows.map((r) => r.listing_id) });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as
    | { id?: string; note?: string }
    | null;
  if (!body?.id || typeof body.id !== "string") {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }
  const pool = getPool();
  await pool.query(
    `INSERT INTO saved_listings (listing_id, note)
     VALUES ($1, $2)
     ON CONFLICT (listing_id) DO UPDATE SET note = EXCLUDED.note`,
    [body.id, body.note ?? null]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }
  const pool = getPool();
  await pool.query("DELETE FROM saved_listings WHERE listing_id = $1", [id]);
  return NextResponse.json({ ok: true });
}
