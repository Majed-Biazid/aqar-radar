# Aqar Radar — رادار

Rental tracker for Eastern-Province apartments listed on **sa.aqar.fm**, scoped to **Dammam**, **Khobar**, and **Dhahran**. Tracks new listings, gone listings, and price changes over time.

- **UI**: Next.js 16 + React 19 + Leaflet
- **DB**: Supabase Postgres
- **Scraper**: Python (requests + BeautifulSoup + psycopg2)
- **Cron**: GitHub Actions (every 30 min) and/or cron-job.org

## Local development

```bash
cp .env.example .env.local        # paste your Supabase creds
psql "$SUPABASE_DB_URL" < scripts/supabase-schema.sql   # one time only
npm install
npm run dev
```

Trigger a scrape locally:

```bash
python3 -m pip install -r scraper/requirements.txt
node scripts/cron.js   # runs immediately + every 30 min
# or one-shot:
python3 scraper/scrape.py --db-url "$SUPABASE_DB_URL" \
  --targets "الدمام:_all,الخبر:_all,الظهران:_all" \
  --price-min 28000 --price-max 40000
```

## Deployment

### 1) Supabase

1. Create a project → run `scripts/supabase-schema.sql` in the SQL Editor.
2. Copy the credentials from Settings → API and Settings → Database → Connect (Session pooler URI).

### 2) Vercel (UI only)

1. Import the repo in Vercel.
2. Add these env vars (Project Settings → Environment Variables):
   - `SUPABASE_DB_URL`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET` (any random string — `openssl rand -hex 32`)
3. Deploy. The UI reads from Supabase via `/api/listings`.

> **Note**: Vercel serverless functions can't run the Python scraper itself (time + runtime limits). Use the GitHub Actions cron below to populate Supabase. `/api/refresh` still exists for manual triggers from a host that *does* have Python.

### 3) GitHub Actions cron — fills Supabase every 30 min

The repo includes `.github/workflows/scrape.yml`. Once the repo is pushed:

1. GitHub → Repo → Settings → Secrets and variables → Actions → **New repository secret**
   - Name: `SUPABASE_DB_URL`
   - Value: your Postgres connection string (Session pooler URL with password)
2. The workflow runs automatically on the half-hour. To trigger immediately: Actions tab → **scrape** → **Run workflow**.

That's it — listings start showing up in Supabase, and your Vercel UI reads them.

### 4) cron-job.org (alternative / supplement)

If you want a redundant external cron pinging the deployed site:

1. cron-job.org → **Create cronjob**
2. URL: `https://<your-vercel-domain>.vercel.app/api/refresh`
3. Schedule: every 30 minutes
4. Headers → add: `Authorization: Bearer <CRON_SECRET>`
5. Method: GET

> This only works if `/api/refresh` can spawn Python. On Vercel that's blocked, so cron-job.org pinging Vercel will 500. Use this if you deploy the API on Render/Fly.io/Railway/etc. (any host that runs Python). Otherwise stick with the GitHub Actions cron above — it's simpler and free.

## Data model

```
listings        — one row per aqar listing, upserted by ID
price_history   — append-only: (listing_id, seen_at, price)
refresh_runs    — one row per scrape, with counters
```

Listings never get deleted. Listings missing from a scrape are marked `status='gone'` so price history stays intact.

## Districts

```
الدمام    — الشعلة، المنتزه، الفردوس، الندى، القصور، هجر
الخبر     — الخبر-الشمالية، الخبر-الجنوبية، الراكة-الشمالية، الراكة-الجنوبية
الظهران   — القصور، الجامعة، هجر، الدوحة-الجنوبية، الدانة-الشمالية، القشلة، تهامة، الدوحة-الشمالية
```

`القصور` and `هجر` exist in both Dammam and Dhahran — composite IDs (`city:slug`) keep them separate in the UI and in URL-pattern matching.

The scraper also runs a city-wide `_all` catch-all so listings filed under aqar slugs we don't enumerate still get pulled in (the API's text-override layer reclassifies them where descriptions match a known neighborhood).
