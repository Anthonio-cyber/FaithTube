# Putting FaithTube online with Vercel — from a browser, on a free domain

This guide assumes you have **no terminal**. Everything happens in browser tabs.
At the end the whole platform — client, API and moderation — runs on Vercel at
`https://faithtube-yourname.vercel.app`, with HTTPS included.

**Time:** about 30 minutes. **Cost:** nothing; none of these ask for a card.

| # | Site | What it gives you |
|---|------|-------------------|
| 1 | [github.com](https://github.com) | the code (already yours) |
| 2 | [neon.tech](https://neon.tech) | free Postgres database |
| 3 | [dash.cloudflare.com](https://dash.cloudflare.com) | free R2 storage for uploaded video |
| 4 | [vercel.com](https://vercel.com) | free hosting + the free domain |

Do them in order — steps 2 and 3 produce values that step 4 asks for. Keep a
scratch note open.

---

## What Vercel can and cannot do here

Vercel runs serverless functions: short-lived, with no disk and no background
process. FaithTube is set up to work within that, but two things genuinely
change, and it is better to know now.

**Video does not pass through the API.** A Vercel function rejects any request
body over 4.5 MB, which is most sermons. So the browser uploads **directly to
Cloudflare R2** using a signed URL the API issues, and only tells the API the
upload is done. This is why step 3 is not optional: with no R2, there is nowhere
for video to go and uploads will not work at all. (On this path the size limit
is the bucket's, not the function's — so it is actually the more generous
arrangement.)

**There is no ffmpeg and no background worker.** Video is stored and played
exactly as uploaded: no generated thumbnail, no quality ladder, no audio
extracted for transcription. The moderation pipeline instead runs *inline*, in
the request that finishes the upload, so a creator still gets a decision
immediately rather than waiting on a schedule. Everything else — accounts,
roles, moderation queues, comments, playlists, subscriptions, analytics,
premium — works normally, and the admin area reports transcoding as "not
configured" rather than pretending.

If you want thumbnails and the quality ladder, that needs a host that runs a
real process; [`HOSTING.md`](HOSTING.md) covers that path. Nothing about your
data or your code changes if you move later.

---

## Step 1 — Nothing to do

Your code is already on GitHub, on `main`, which is the branch Vercel deploys
by default. There is no branch to choose and nothing to merge — go to step 2.

---

## Step 2 — A free Postgres database (Neon)

1. **[neon.tech](https://neon.tech)** → **Sign up with GitHub**.
2. Let it create a project; name it `faithtube` if asked.
3. On the dashboard find **Connection string**, with the dropdown on
   **Pooled connection**.
4. Copy it — `postgresql://neondb_owner:…@ep-…-pooler.….neon.tech/neondb?sslmode=require`
5. Save it in your note as **DATABASE_URL**.

> The **pooled** string matters more here than on a normal host. Every
> serverless request may open its own connection, and the pooler is what stops
> a busy moment from exhausting the database's connection limit.

---

## Step 3 — Storage for video (Cloudflare R2) — required

1. **[dash.cloudflare.com](https://dash.cloudflare.com)** → sign up (free).
2. Sidebar → **R2 Object Storage** → **Create bucket** → name it
   `faithtube-media`, location **Automatic** → **Create bucket**.
3. Open the bucket → **Settings** → **Public Development URL** → **Enable**.
   Copy the `https://pub-xxxxxxxx.r2.dev` URL into your note as **CDN_BASE_URL**.
   *(Without this, uploads succeed but nothing plays.)*
4. **Still in Settings, add a CORS policy.** This is the step people miss, and
   without it the browser refuses to upload. Find **CORS Policy** → **Add CORS
   policy**, and paste:

   ```json
   [
     {
       "AllowedOrigins": ["https://faithtube-yourname.vercel.app"],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   Use your real Vercel domain. You will not know it until step 4 — so either
   come back to this after deploying, or put `"*"` in `AllowedOrigins` to get
   going and tighten it afterwards.
5. Back on the **R2 Object Storage** overview → **Manage API tokens** →
   **Create API token**. Name `faithtube`, permission **Object Read & Write**,
   scoped to the `faithtube-media` bucket.
6. Copy all three values now — the secret is shown **once**:
   - **Access Key ID** → **S3_ACCESS_KEY_ID**
   - **Secret Access Key** → **S3_SECRET_ACCESS_KEY**
   - the S3 endpoint, `https://<account-id>.r2.cloudflarestorage.com`
     → **S3_ENDPOINT** *(the account address, with no bucket name on the end)*

---

## Step 4 — Deploy on Vercel

`vercel.json` in the repository root already describes the build, the function
and the routing, so Vercel only needs your values.

1. **[vercel.com](https://vercel.com)** → **Sign up with GitHub** → **Add New →
   Project** → import your `FaithTube` repository.
2. **Do not change Root Directory.** Leave it at the repository root — the API
   function and the build settings live there. (An older version of this guide
   said `apps/web`; that was for hosting the client alone.)
3. Leave **Git Branch** on `main`.
4. Expand **Environment Variables** and add these:

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | the Neon pooled string |
   | `DATABASE_PROVIDER` | `postgresql` |
   | `JWT_SECRET` | a long random string you make up — 40+ characters |
   | `COOKIE_SECURE` | `true` |
   | `S3_BUCKET` | `faithtube-media` |
   | `S3_REGION` | `auto` |
   | `S3_ENDPOINT` | your `https://….r2.cloudflarestorage.com` |
   | `S3_ACCESS_KEY_ID` | from step 3 |
   | `S3_SECRET_ACCESS_KEY` | from step 3 |
   | `CDN_BASE_URL` | your `https://pub-….r2.dev` |
   | `SEED_ON_BOOT` | `true` — remove it after the first deploy |
   | `SEED_ADMIN_EMAIL` | your email; this becomes the owner account |
   | `SEED_ADMIN_PASSWORD` | a strong password you choose now |

   Nothing else is needed. `APP_URL` and `API_URL` are worked out from Vercel's
   own domain, and the storage driver, the disabled worker and the inline
   pipeline are all set automatically because the code can see it is running on
   Vercel.

   Leave `ANTHROPIC_API_KEY`, `GOOGLE_*` and `STRIPE_*` unset for now. Each
   unset integration shows as "not configured" in the admin area and the
   platform uses its built-in fallback — moderation runs on the on-device
   classifier, which is fully functional on its own.

5. **Deploy.** The first build takes 3–6 minutes. It compiles the shared
   package, the API and the web client, then applies the database schema and
   seeds it.

When it finishes, open your `https://faithtube-yourname.vercel.app` domain.

6. **Go back to R2 and put that exact domain in the CORS policy** from step 3,
   if you used `"*"` or guessed.

---

## Step 5 — First sign-in, and locking down

1. Sign in with the `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` you set. You are
   **SUPER_ADMIN**.
2. **Settings → Privacy & security** → change your password. The seeded one is
   sitting in Vercel's dashboard.
3. Vercel → **Settings → Environment Variables** → delete **`SEED_ON_BOOT`**,
   then **Redeploy**. Re-running the seed is harmless — it never overwrites a
   password you have changed — but there is no reason to repeat it.
4. The seed also creates `moderator@faithtube.example` and
   `viewer@faithtube.example` so you can see how the roles differ. They share
   the seeded password: **suspend both from Admin → Users** before the site is
   public.

Then upload something. Watch the network panel if you like — the video goes
straight to `r2.cloudflarestorage.com`, never to Vercel.

---

## Optional integrations

Add these in **Vercel → Settings → Environment Variables**, then **Redeploy**
(environment changes do not reach an existing deployment on their own).

**Better AI moderation.** The on-device classifier is real and works. An
[Anthropic API key](https://console.anthropic.com) gives you a reviewer that
reads titles, descriptions and transcripts in context:
`ANTHROPIC_API_KEY`.

**Sign in with Google.** At
[console.cloud.google.com](https://console.cloud.google.com) create an OAuth
client (Web application) with redirect URI
`https://<your-domain>/api/auth/google/callback`, then set `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET` and `GOOGLE_REDIRECT_URI`.

**Premium subscriptions.** At [stripe.com](https://stripe.com) take the secret
key, and add a webhook endpoint at `https://<your-domain>/api/premium/webhook`
for `checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted` and `invoice.payment_failed`. Then set
`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. The $25/month price is not
hard-coded — change it in **Admin → Settings**. Card details never reach
FaithTube's database; Stripe's hosted checkout handles them.

> Keys belong in Vercel's Environment Variables and nowhere else. Never put one
> in a `VITE_` variable — anything with that prefix is compiled into the
> JavaScript every visitor downloads.

---

## A custom domain

Vercel → your project → **Settings → Domains → Add**. Vercel issues the
certificate. Afterwards:

1. Add the new origin to the R2 bucket's CORS policy.
2. Update `GOOGLE_REDIRECT_URI` (and the URI in Google Cloud Console).
3. Update the Stripe webhook URL.
4. Set `APP_URL` and `API_URL` to `https://yourdomain.com` — only needed once
   you have a custom domain; on a `.vercel.app` address they work themselves out.

---

## When something goes wrong

Vercel → your project → **Deployments** → click the deployment → **Build Logs**
for build problems, **Runtime Logs** for anything after.

| What you see | What it means | Fix |
|---|---|---|
| Build fails, `DATABASE_URL is not set` | the variable is missing, or was added to Preview only | add it for **Production**, then redeploy |
| `this build targets sqlite, but DATABASE_URL points at postgresql` | `DATABASE_PROVIDER` is missing | set it to `postgresql` and redeploy |
| `Query engine library for current platform not found` | a stale build from before this was configured | **Redeploy** with *Use existing build cache* switched off |
| Upload stalls, console shows a CORS error on `r2.cloudflarestorage.com` | the bucket's CORS policy does not list your domain | step 3.4, using the exact origin — scheme and host, no trailing slash |
| Upload finishes, then "That upload did not finish" | the PUT never reached the bucket | same CORS policy; check the network panel for a failed `PUT` |
| Video plays nowhere | `CDN_BASE_URL` missing, or the R2 public URL is off | R2 → Settings → Public Development URL → Enable |
| `Object storage (S3) is not configured` | an `S3_*` value is missing or mistyped | re-check all four; the secret is shown once, so make a new token if lost |
| Sign-in appears to work, then you are signed out | `COOKIE_SECURE` is not `true` | set it and redeploy |
| Everything works but there are no videos | `SEED_ON_BOOT` was never `true` | set it, redeploy, then remove it |
| `504` on a slow request | the function's 60-second budget | usually a very large upload finalising; retry |

To check the API itself: open `https://<your-domain>/api/system/health`, which
should answer `{"status":"ok","database":"ok",…}`.

---

## Hosting only the client on Vercel

If you would rather run the API on a host with ffmpeg and a real worker, and
keep Vercel for the client alone, that split is still supported: set **Root
Directory** to `apps/web` (which uses `apps/web/vercel.json` instead), give it
`VITE_API_URL` pointing at your API, and on the API set `SERVE_WEB=false`,
`CORS_EXTRA_ORIGINS=https://your-app.vercel.app`, `COOKIE_SAMESITE=none` and
`COOKIE_SECURE=true`.

`COOKIE_SAMESITE` is the one people miss: with the default `lax` the browser
will not send the session cookie to an API on another domain, and sign-in
appears to do nothing. The API refuses to start on `none` without
`COOKIE_SECURE=true`, because browsers discard that combination silently.
`VITE_API_URL` is read at **build time**, so changing it means redeploying.
