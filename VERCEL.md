# Deploying FaithTube with Vercel

**Short version:** put the web client on Vercel and the API somewhere that can
run a process. Vercel is excellent at the first job and a poor fit for the
second, for reasons that are specific and worth knowing before you commit.

Both halves are free, and both give you an HTTPS domain:

```
  faithtube.vercel.app   ──►   faithtube-api.onrender.com
  (Vercel, static SPA)         (Render or Fly, API + worker)
```

---

## Why the API does not go on Vercel

Vercel runs serverless functions. Four of its limits collide with what a video
platform has to do:

| Limit | What breaks |
|---|---|
| **4.5 MB request body** | Video upload. Not "slow" — rejected. This alone is decisive. |
| **No persistent process** | The processing worker polls a job queue. There is nothing to poll from. |
| **No ffmpeg** | No thumbnails, no audio extraction for transcription, no quality ladder. |
| **Hobby cron runs once per day** | Even driving the queue by schedule, an upload could wait 24 hours. |

You could work around the first by uploading straight to object storage with a
presigned URL, and the second with Vercel Cron on a Pro plan. You cannot work
around ffmpeg, and on the free tier the daily cron makes the platform unusable.

So: Vercel for the client, Render or Fly for the API. This is a normal split and
everything in the repo supports it.

> If you would rather have one deployment on one domain, skip Vercel entirely and
> follow [`DEPLOYMENT.md`](DEPLOYMENT.md) — the app also runs as a single service
> that serves the API and the client together.

---

## Step 1 — Deploy the API first

The client needs the API's URL at build time, so do this half first.

Follow [`DEPLOYMENT.md`](DEPLOYMENT.md) to put the API on Render or Fly. You need
a free Postgres database (Neon) and free object storage (Cloudflare R2). Note the
API's URL, e.g. `https://faithtube-api.onrender.com`.

Then set these three on the API, which are what make a cross-domain client work:

```bash
APP_URL=https://faithtube.vercel.app       # your Vercel domain
CORS_EXTRA_ORIGINS=https://faithtube.vercel.app
COOKIE_SAMESITE=none                        # the client is on another domain
COOKIE_SECURE=true                          # browsers require this with SameSite=None
SERVE_WEB=false                             # Vercel serves the client, not the API
```

`COOKIE_SAMESITE` is the one people miss. With the default `lax`, the browser
will not send the session cookie to an API on a different domain, and sign-in
appears to do nothing at all. The API refuses to start if you set `none` without
`COOKIE_SECURE=true`, because browsers discard that combination silently.

## Step 2 — Deploy the client to Vercel

Push the repository to GitHub, then:

1. **vercel.com → Add New → Project**, import the repository.
2. Set **Root Directory** to `apps/web`. This matters — the repo is a monorepo
   and `apps/web/vercel.json` carries the build settings.
3. Leave the framework preset as **Vite** (detected automatically).
4. Add one environment variable:

   | Name | Value |
   |---|---|
   | `VITE_API_URL` | `https://faithtube-api.onrender.com` |

   Add it for Production, Preview and Development.
5. **Deploy.**

`apps/web/vercel.json` already handles the rest: it builds the shared package
before the client, rewrites unknown paths to `index.html` so deep links like
`/watch/abc123` work, caches hashed assets for a year while keeping `index.html`
uncached, and sets the usual security headers.

### With the Vercel CLI instead

```bash
npm i -g vercel
cd apps/web
vercel link
vercel env add VITE_API_URL production      # paste the API URL
vercel --prod
```

## Step 3 — Point the two at each other

`VITE_API_URL` is read at **build time**, not runtime. If you change it, or the
API's domain changes, you must redeploy the client — setting the variable alone
does nothing to an existing build.

Once both are up:

1. Open your Vercel URL and sign in. If sign-in appears to succeed but you land
   back signed out, `COOKIE_SAMESITE` is the culprit — see step 1.
2. Check `/admin` → Overview. The integrations panel shows what the API actually
   has configured.

## Step 4 — A custom domain

Vercel issues certificates automatically. After adding your domain there:

1. Update `APP_URL` and `CORS_EXTRA_ORIGINS` on the API to the new origin.
2. Update `GOOGLE_REDIRECT_URI` and re-save it in Google Cloud Console.
3. Update the Stripe webhook URL.
4. **Redeploy the Vercel project** so the client picks up any changed
   `VITE_API_URL`.

If you put the client and API on subdomains of one domain — `app.example.org` and
`api.example.org` — you can use `COOKIE_DOMAIN=.example.org` with
`COOKIE_SAMESITE=lax` instead, which is slightly stricter and works because the
two are then same-site.

---

## Troubleshooting

**Sign-in seems to work, then I am signed out.** The session cookie is being
discarded. Set `COOKIE_SAMESITE=none` and `COOKIE_SECURE=true` on the API, and
make sure both sides are HTTPS.

**Browser console shows a CORS error.** Your Vercel origin is not in
`CORS_EXTRA_ORIGINS` on the API. It must be the exact origin — scheme and host,
no trailing slash. Preview deployments get their own hostnames, so add those too
or test against production.

**Deep links 404 on refresh.** Root Directory is not set to `apps/web`, so
`vercel.json` and its rewrites are not being read.

**The build fails with "Cannot find module '@faithtube/shared'".** Same cause —
the build command in `vercel.json` builds the shared package first, and Vercel
only reads that file when Root Directory points at `apps/web`.

**Uploads succeed but nothing ever processes.** The API's worker is not running.
Check `WORKER_ENABLED` is not set to `false`, and that the API host runs a
persistent process rather than serverless functions.

---

## If you really want everything on Vercel

Understand what you are giving up: no video upload above 4.5 MB through the API,
no ffmpeg, and processing only as often as your plan's cron allows. The pieces
that exist for it:

- `GET|POST /api/system/cron/process` runs one pass of the job queue. Set
  `CRON_SECRET` on the API and call it on a schedule — Vercel Cron sends the
  secret as a Bearer token automatically. It processes up to `CRON_MAX_JOBS`
  (default 3) per invocation so it fits inside a function timeout.
- `WORKER_ENABLED=false` turns off the in-process worker when cron is driving it.

Making uploads work would additionally require presigned direct-to-storage
uploads so the video never passes through a function, which the current upload
route does not do.
