# Deploying FaithTube on a free domain

> **Never used a terminal?** [`HOSTING.md`](HOSTING.md) (Render) and
> [`VERCEL.md`](VERCEL.md) (Vercel) each walk through a deployment entirely in
> the browser, click by click. This page is the reference: every host, every
> option, and what each setting does.

FaithTube is built to run as **one service**: a single Node process serves the
API, runs the video-processing worker, and serves the built web client. That
means one deployment, one free subdomain, no CORS setup, and no separate
frontend host.

Every free host below gives you an HTTPS domain at no cost:

| Host | Free domain | Notes |
|---|---|---|
| **Render** | `https://<name>.onrender.com` | Easiest. Sleeps after ~15 min idle, wakes in a few seconds. `render.yaml` included, and needs no terminal at all. |
| **Fly.io** | `https://<name>.fly.dev` | Includes a small persistent volume, so local file storage is viable. `fly.toml` included. |
| **Koyeb** | `https://<name>.koyeb.app` | Docker deploy, similar to Render. |
| **Vercel** | `https://<name>.vercel.app` | Whole platform, browser-only — see [VERCEL.md](VERCEL.md). Serverless: uploads go direct to storage, moderation runs inline, no ffmpeg. |
| **Railway** | `https://<name>.up.railway.app` | Trial credit rather than a permanent free tier. |

You will also need a free database, and — on most hosts — free object storage.

---

## Before you start: what a free tier actually means

Three things matter, and it is better to know them now than after your first
upload disappears.

**1. The filesystem is usually ephemeral.** On Render's free plan, anything
written to disk is erased when the service restarts or redeploys. Uploaded
videos are files. If you leave `STORAGE_DRIVER=local` there, your library will
vanish. Use object storage (below), or use Fly.io, which gives you a volume.

**2. Free services sleep.** A sleeping service is not processing the upload
queue. A video uploaded just before the service idles out will finish
processing when the service next wakes — the job rows are persisted, so nothing
is lost, but it will not be instant.

**3. Video is heavy.** Transcoding is CPU-bound and free instances are small. A
40-minute sermon can take a while to work through the quality ladder. If that
is a problem, set `TRANSCODE_ENABLED=false` and serve originals, or pay for a
larger instance.

None of these stop the platform working. They shape what you should expect.

---

## Recommended free stack

- **App:** Render (free web service) or Fly.io
- **Database:** [Neon](https://neon.tech) — free Postgres that does not expire
- **Object storage:** [Cloudflare R2](https://developers.cloudflare.com/r2/) —
  10 GB free and, importantly for video, **no egress charges**

> Render's own free Postgres expires after a limited period, which is why Neon
> is recommended instead. Nothing in the code depends on either.

---

## Step 1 — Database

Create a free Postgres database at [neon.tech](https://neon.tech) and copy the
connection string. It looks like:

```
postgresql://user:password@ep-something.eu-central-1.aws.neon.tech/faithtube?sslmode=require
```

You do not need to create any tables. The container applies the schema on boot.

The data model is provider-portable — no SQLite-only or Postgres-only types, and
enum-like columns are plain strings validated in `@faithtube/shared` — so
switching between the two is just an environment variable.

## Step 2 — Object storage (Cloudflare R2)

1. In the Cloudflare dashboard, create an R2 bucket, e.g. `faithtube-media`.
2. Create an R2 API token with **Object Read & Write** on that bucket.
3. Enable public access on the bucket (or attach a custom domain) and copy the
   public URL — this becomes `CDN_BASE_URL`.

You will end up with:

```bash
STORAGE_DRIVER=s3
S3_BUCKET=faithtube-media
S3_REGION=auto                                    # "auto" is correct for R2
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=<token id>
S3_SECRET_ACCESS_KEY=<token secret>
CDN_BASE_URL=https://pub-<hash>.r2.dev            # or your custom domain
```

The S3 driver signs requests with SigV4 over plain `fetch`, so it works with any
S3-compatible service — R2, Backblaze B2, Wasabi, MinIO or AWS itself.

## Step 3 — Deploy

### Render

1. Push this repository to GitHub.
2. In Render: **New → Blueprint**, point it at the repo. It reads `render.yaml`
   from the default branch.
3. Fill in the values marked `sync: false` in the dashboard:
   - `DATABASE_URL` — from step 1
   - the `S3_*` and `CDN_BASE_URL` values from step 2
   - `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` — **choose your own**
   - `APP_URL` and `API_URL` — **leave blank**. The server falls back to
     `RENDER_EXTERNAL_URL`, so it knows its own address without you having to
     predict the hostname. Set them only for a custom domain.
4. `JWT_SECRET` is generated for you by Render. Do not set it by hand.
5. Deploy.

`SEED_ON_BOOT=true` is already in the blueprint, so the first boot creates the
admin account, the categories and the starter content. Set it to `false` once
you have signed in. Re-running it is harmless — the seed never overwrites a
password you have changed — but there is no reason to repeat it.

**The blueprint uses Render's native Node runtime**, which has no `ffmpeg`:
video is stored and played exactly as uploaded, with no generated thumbnail,
quality ladder or extracted audio. Everything else works, and the admin area
reports transcoding as not configured rather than faking it. To get the full
pipeline, switch the service block in `render.yaml` to:

```yaml
    runtime: docker
    dockerfilePath: ./Dockerfile
    dockerContext: .
```

and drop `buildCommand` / `startCommand`. The build is slower and heavier, so
it is worth doing only once you need processed video.

### Fly.io

```bash
fly launch --no-deploy                      # pick your app name
fly volumes create faithtube_data --size 3
fly secrets set \
  DATABASE_URL="postgresql://…" \
  JWT_SECRET="$(openssl rand -base64 48)" \
  APP_URL="https://<your-app>.fly.dev" \
  API_URL="https://<your-app>.fly.dev" \
  SEED_ADMIN_EMAIL="you@example.org" \
  SEED_ADMIN_PASSWORD="<a strong password>"
fly deploy
```

Fly's volume makes `STORAGE_DRIVER=local` workable (that is what `fly.toml`
sets). Switch to R2 when your library outgrows the volume.

### Any Docker host

```bash
docker build -t faithtube .
docker run -p 4000:4000 \
  -e DATABASE_URL="postgresql://…" \
  -e JWT_SECRET="$(openssl rand -base64 48)" \
  -e APP_URL="https://your-domain.example" \
  -e COOKIE_SECURE=true \
  faithtube
```

---

## Step 4 — After the first deploy

**Sign in and change the seeded password.** The seeded admin account is only as
safe as the password you gave it, and that password is sitting in your host's
dashboard. Change it from **Settings → Privacy & security**, which also signs
every other device out.

**Deal with the demo staff accounts.** The seed creates
`moderator@faithtube.example` and `viewer@faithtube.example` so you can see how
the roles differ. They share the seeded password — suspend them from
**Admin → Users** before the site is public.

**Check the integrations panel.** Go to `/admin` → Overview. Every optional
service is listed as *configured* or *not configured*. Nothing is faked: if
Stripe is off, the Premium button says so rather than failing silently; if no
transcription service is set, the classifier is told speech evidence is missing
rather than being handed an invented transcript.

**Set `COOKIE_SECURE=true`.** Session cookies must be HTTPS-only in production.
`render.yaml` and `fly.toml` already do this.

---

## Optional integrations

Each of these is genuinely optional. The platform is fully functional without
any of them.

### Sign in with Google

1. Google Cloud Console → **APIs & Services → Credentials → OAuth client ID →
   Web application**.
2. Authorised redirect URI: `https://your-domain.example/auth/google/callback`
   — it must match exactly.
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.

The code exchange happens server-side, so the client secret never reaches the
browser. Until this is configured, "Continue with Google" tells people it is
unavailable and email sign-in works normally.

### Claude-assisted moderation

Set `ANTHROPIC_API_KEY`. The on-device classifier still runs first as a
pre-filter and as the fallback if the API is unreachable — and on fallback an
automatic *approve* is downgraded to human review, so moderation never fails
open.

Without a key the platform uses the on-device classifier, which is fully
functional. This is stated plainly on the admin dashboard rather than implied.

### Transcription

Set `WHISPER_API_URL` and `WHISPER_API_KEY` to any Whisper-compatible endpoint.
This materially improves moderation quality, because the classifier can then
read what was actually said instead of judging on metadata alone.

### Premium payments

```bash
STRIPE_SECRET_KEY=sk_live_…
STRIPE_WEBHOOK_SECRET=whsec_…
STRIPE_PRICE_ID=price_…            # optional; a price is created inline if unset
```

Add a Stripe webhook pointing at `https://your-domain.example/api/premium/webhook`
for `checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted` and `invoice.payment_failed`.

Card details never touch this application — checkout is hosted by Stripe, and
the database stores only subscription identifiers and status.

### Live streaming

Set `LIVE_INGEST_BASE` (RTMP) and `LIVE_PLAYBACK_BASE` (HLS) to a streaming
provider. Without them, creators can still schedule streams and run live chat,
but no video can be received — and the UI says exactly that.

---

## Using your own domain

All the hosts above accept a custom domain on the free plan and issue a
certificate automatically. After pointing DNS at the host:

1. Update `APP_URL` and `API_URL` to the new origin.
2. Update `GOOGLE_REDIRECT_URI` and re-save it in Google Cloud Console.
3. Update the Stripe webhook URL.
4. Redeploy.

If you serve the app from a subdomain but want the session to work across
several, set `COOKIE_DOMAIN=.your-domain.example`.

## Rebranding

The platform name, motto, palette and support address all live in one file:
`packages/shared/src/brand.ts`. The logo, favicon, app icon and wordmark are in
`apps/web/public/` and `apps/web/src/components/brand/Logo.tsx`. Changing those
rebrands the whole product — nothing else hard-codes the name.

## Health and monitoring

- `GET /api/system/health` — liveness and database reachability. Both
  `render.yaml` and `fly.toml` use it, and so does the Docker `HEALTHCHECK`.
- `GET /api/system/config` — what this deployment can actually do.
- `/admin/audit` — every administrative and moderation action, append-only.
