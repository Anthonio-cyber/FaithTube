# Putting FaithTube online — from a browser, on a free domain

This guide assumes you have **no terminal**. Everything below happens in
browser tabs. At the end you will have FaithTube running at a real HTTPS
address like `https://faithtube-yourname.onrender.com`, with a database,
file storage for uploads, and your own administrator account.

**Time:** about 30 minutes, most of it waiting for the first build.
**Cost:** nothing. Every service used here has a free tier that does not ask
for a card.

You will open four sites, in this order:

| # | Site | What it gives you | Card needed |
|---|------|-------------------|-------------|
| 1 | [github.com](https://github.com) | the code (already yours) | no |
| 2 | [neon.tech](https://neon.tech) | free Postgres database | no |
| 3 | [dash.cloudflare.com](https://dash.cloudflare.com) | free R2 storage for uploaded video | no |
| 4 | [render.com](https://render.com) | free hosting + the free domain | no |

Do them in order. Steps 2 and 3 produce values that step 4 asks you for, so
keep a scratch note open to paste them into.

> Prefer Vercel? [`VERCEL.md`](VERCEL.md) is the same walkthrough for a Vercel
> deployment. The trade-offs differ — Vercel uploads video straight to storage
> and never sleeps, Render can run the full ffmpeg pipeline — but both are free
> and both are browser-only.

---

## Before you start: what "free" costs you

Free hosting has real limits, and it is better to know them now than to be
surprised later.

- **The service sleeps.** After ~15 minutes with no visitors, Render stops
  the free instance. The next visitor waits ~30–50 seconds while it wakes.
  Everything is intact; it is just slow for that one request.
- **The disk is temporary.** Anything written to the server's own disk is
  gone on the next restart. This is why step 3 exists: uploaded videos go to
  Cloudflare R2, which is permanent, instead of to the server.
- **No video processing.** Render's free Node runtime has no `ffmpeg`, so
  FaithTube stores and plays each upload exactly as it arrives — no generated
  thumbnail, no quality ladder, no audio track pulled out for transcription.
  Upload, AI moderation, publishing and playback all work normally. The admin
  area reports transcoding as "not configured" rather than pretending. If you
  want the full pipeline later, see *Getting the full pipeline* at the end.

Everything else in the platform — accounts, roles, moderation, comments,
playlists, subscriptions, analytics, premium — works on the free tier.

---

## Step 1 — Point Render at the right branch

Your code is already on GitHub. The only thing to know is **which branch**
the finished platform is on:

```
claude/christian-video-platform-build-etadqh
```

`main` still holds the empty starting commit. You have two options:

- **Simplest:** leave the branches as they are, and pick the branch above in
  Render's Branch box in step 4. Nothing else changes.
- **Tidier:** merge the branch into `main` first, so `main` is the real
  thing. On GitHub, open **Pull requests → New pull request**, set base
  `main` and compare to the branch above, then **Create pull request** →
  **Merge pull request**. After that, use `main` in step 4.

Either works. If you are not sure, take the first one.

---

## Step 2 — A free Postgres database (Neon)

1. Go to **[neon.tech](https://neon.tech)** and **Sign up with GitHub**.
2. Neon creates a project for you. If it asks, name it `faithtube` and take
   the region closest to you.
3. On the project dashboard, find the **Connection string** box.
4. Make sure the dropdown says **Pooled connection** (it usually does).
5. Copy the whole string. It looks like:

   ```
   postgresql://neondb_owner:AbC123xyz@ep-cool-name-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

6. Paste it into your scratch note as **DATABASE_URL**.

> Neon's free project stays free indefinitely and holds far more than a new
> platform needs. It pauses when idle and wakes on the next query, which
> pairs naturally with a sleeping free web service.

---

## Step 3 — Free storage for uploaded video (Cloudflare R2)

Uploads have to live somewhere permanent. R2's free tier covers 10 GB of
storage and, unlike most alternatives, charges nothing for people watching
the videos.

1. Go to **[dash.cloudflare.com](https://dash.cloudflare.com)** and sign up
   (free, no card for R2's free tier — Cloudflare may ask you to verify your
   email first).
2. In the left sidebar choose **R2 Object Storage** → **Create bucket**.
3. Name it `faithtube-media`. Location: **Automatic**. Click **Create bucket**.
4. Open the bucket → **Settings** tab → find **Public Development URL** →
   **Enable**. Confirm.
   Copy the URL it shows you — `https://pub-xxxxxxxxxxxx.r2.dev`.
   Paste it into your note as **CDN_BASE_URL**.
   *(This is what lets viewers actually load the video files. Without it,
   uploads succeed but nothing plays.)*
5. Go back to the **R2 Object Storage** overview page. In the right-hand
   panel (or under **API**) click **Manage API tokens** → **Create API
   token**.
6. Set:
   - **Token name:** `faithtube`
   - **Permissions:** **Object Read & Write**
   - **Specify bucket:** `faithtube-media`
   Click **Create API Token**.
7. The next screen shows three things **once**. Copy all three into your note
   now — you cannot see the secret again:
   - **Access Key ID** → **S3_ACCESS_KEY_ID**
   - **Secret Access Key** → **S3_SECRET_ACCESS_KEY**
   - The endpoint under "Use jurisdiction-specific endpoints for S3 clients",
     which looks like `https://<account-id>.r2.cloudflarestorage.com`
     → **S3_ENDPOINT**
     *(Copy it without the bucket name on the end, if one is shown.)*

Your note should now hold six values: `DATABASE_URL`, `CDN_BASE_URL`,
`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, and the bucket
name `faithtube-media`.

---

## Step 4 — Deploy on Render

Render reads `render.yaml` from the repository, so it already knows how to
build and run FaithTube. It only needs the values from your note.

1. Go to **[render.com](https://render.com)** → **Get Started** → **GitHub**.
2. Authorise Render to see your repositories. When GitHub asks which, you can
   pick **Only select repositories** and choose `FaithTube`.
3. In the Render dashboard: **New +** → **Blueprint**.
4. Choose your `FaithTube` repository.
5. **Branch:** select `claude/christian-video-platform-build-etadqh`
   (or `main` if you merged in step 1). This matters — the wrong branch has
   no `render.yaml` and Render will say it found no blueprint.
6. **Blueprint Name:** `faithtube`. Click **Deploy Blueprint** / **Apply**.
7. Render now shows a form of the values it needs. Fill it in:

| Field | What to enter |
|-------|---------------|
| `DATABASE_URL` | the Neon string from step 2 |
| `SEED_ADMIN_EMAIL` | your own email — this becomes the owner account |
| `SEED_ADMIN_PASSWORD` | a strong password you choose now |
| `S3_BUCKET` | `faithtube-media` |
| `S3_ENDPOINT` | the `https://….r2.cloudflarestorage.com` value |
| `S3_ACCESS_KEY_ID` | from step 3 |
| `S3_SECRET_ACCESS_KEY` | from step 3 |
| `CDN_BASE_URL` | the `https://pub-….r2.dev` value |
| `APP_URL` | **leave blank** |
| `API_URL` | **leave blank** |
| everything else (`ANTHROPIC_API_KEY`, `GOOGLE_*`, `STRIPE_*`) | **leave blank** |

   Leaving `APP_URL` and `API_URL` blank is deliberate: the server reads the
   address Render assigns it, so you do not have to know the hostname before
   the service exists. Fill them in only when you attach a custom domain.

   The blank optional keys are not a broken setup. Each unset integration
   shows as "not configured" in the admin area and the platform uses its
   built-in fallback — most importantly, moderation runs on the on-device
   classifier, which is fully functional on its own.

8. If the service name `faithtube` is taken, Render asks for another. Use
   something like `faithtube-yourname`; that name becomes your domain.
9. Click **Apply**. The first build takes **5–10 minutes** — it installs
   dependencies and compiles the server, the shared package and the web app.
   Watch the **Logs** tab.

You are looking for this at the end of the log:

```
→ Applying the database schema…
🚀  Your database is now in sync with your Prisma schema.
→ Seeding initial data…
[seed] Seed complete.
→ Starting FaithTube on port 10000
[server] FaithTube API listening on …
[server] Motto: Every Video. Christ-Centered.
```

When the status badge turns **Live**, open your URL:
`https://<your-service-name>.onrender.com`

That is your free domain. It has HTTPS already.

---

## Step 5 — First sign-in, and locking things down

1. Open your site and click **Sign in**.
2. Use the `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` you entered. You are
   signed in as **SUPER_ADMIN**.
3. Go to **Settings → Privacy & security** and change your password to
   something only you know. The seeded value is sitting in Render's dashboard, so it should
   not stay in use.
4. Back in Render: **Environment** → set **`SEED_ON_BOOT`** to `false` →
   **Save Changes**. The seed is safe to re-run (it never overwrites your
   password) but there is no reason to run it on every restart.
5. The seed also created two demo staff accounts —
   `moderator@faithtube.example` and `viewer@faithtube.example` — so you can
   see how each role differs. They share the seeded password, so before you
   invite anyone real go to **Admin → Users** and **suspend** both. They exist
   to demonstrate the role system, not to be left open.

Now try the real thing: **Create → Upload**, put up a short video, and watch
it move through the pipeline. The AI review runs, and the result appears in
**Admin → Moderation** where you have the final say — which is how the
platform is meant to work: the classifier proposes, an administrator decides.

---

## Optional: switch on the paid-for integrations

None of these are required. Add them from **Render → your service →
Environment → Add Environment Variable**, then **Save Changes** (Render
restarts the service automatically, about a minute).

**Better AI moderation** — the on-device classifier is real and works. An
[Anthropic API key](https://console.anthropic.com) gives you a far more
capable reviewer that reads titles, descriptions and transcripts in context:

- `ANTHROPIC_API_KEY` = `sk-ant-…`

**Sign in with Google** — at
[console.cloud.google.com](https://console.cloud.google.com) create an OAuth
client (type: Web application) and set the authorised redirect URI to
`https://<your-domain>/api/auth/google/callback`. Then:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` = the same redirect URI

**Premium subscriptions** — at [stripe.com](https://stripe.com), take the
secret key from Developers → API keys, and add a webhook endpoint pointing at
`https://<your-domain>/api/premium/webhook` (events:
`checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.payment_failed`). Then:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

The $25/month price is not hard-coded — change it in **Admin → Settings**.
Card details never touch FaithTube's database; Stripe's hosted checkout
handles them and the platform only ever stores the subscription status.

> Keys go in Render's Environment tab and nowhere else. Never put one in the
> web app's code or in a `VITE_` variable — anything prefixed `VITE_` is
> compiled into the JavaScript that every visitor downloads.

---

## Optional: your own domain name

The `.onrender.com` address is permanent and free. If you would rather have
`faithtube.org`, buy the name anywhere (Namecheap, Cloudflare Registrar,
Porkbun — roughly $10/year; there is no genuinely free registrar worth
trusting a real site to), then:

1. Render → your service → **Settings** → **Custom Domains** → **Add**.
2. Render shows a CNAME record. Add it at your registrar's DNS page.
3. Wait for Render to show "Certificate issued" — usually minutes.
4. Then, and only then, set `APP_URL` and `API_URL` in Render's Environment
   tab to `https://yourdomain.com` and save.
5. If you set up Google sign-in, update the redirect URI in both Google Cloud
   Console and `GOOGLE_REDIRECT_URI` to the new domain.

---

## When something goes wrong

Everything you need is in **Render → your service → Logs**.

| What you see | What it means | Fix |
|---|---|---|
| `FATAL: DATABASE_URL is not set` | Render has no database string | Environment tab → add `DATABASE_URL` from step 2 |
| `Can't reach database server` | wrong or expired Neon string | copy the **pooled** connection string again; check it ends in `?sslmode=require` |
| `this build targets postgresql, but DATABASE_URL points at sqlite` | a `file:` URL was pasted in | use the Neon `postgresql://…` string |
| `FATAL: JWT_SECRET must be set…` | the generated secret went missing | Environment tab → `JWT_SECRET` → **Generate** |
| Build fails, `no render.yaml found` | wrong branch | Settings → Branch → the branch from step 1 |
| Site loads, but sign-in does nothing | usually a stale `APP_URL` | clear `APP_URL` and `API_URL` so they auto-detect, or set both to your exact `https://` address |
| Upload succeeds, video never plays | `CDN_BASE_URL` missing or the R2 public URL is disabled | R2 bucket → Settings → Public Development URL → Enable, then set `CDN_BASE_URL` |
| `Object storage (S3) is not configured` | an R2 key is missing or mistyped | re-check the four `S3_*` values; the secret is only shown once, so make a new token if you lost it |
| First visit takes ~40 seconds | the free instance was asleep | normal; upgrade to Render's paid tier, or accept it |
| Everything is fine but no videos appear | `SEED_ON_BOOT` was never `true` | set it to `true`, save, wait for the restart, then set it back to `false` |

To confirm the server itself is healthy, open
`https://<your-domain>/api/system/health` — it should answer
`{"status":"ok","database":"ok",…}`.

---

## Getting the full pipeline later

Thumbnails, the adaptive quality ladder and audio extraction all need
`ffmpeg`, which the free Node runtime does not have. The repository ships a
`Dockerfile` that installs it. To use it, edit `render.yaml` on GitHub
(pencil icon → commit) and change the service block from:

```yaml
    runtime: node
    buildCommand: npm run build:hosted
    startCommand: npm run start:hosted
```

to:

```yaml
    runtime: docker
    dockerfilePath: ./Dockerfile
    dockerContext: .
```

Commit, and Render rebuilds. The Docker build is slower (~10–15 minutes) and
uses more of the free instance's memory, so start with the Node runtime and
move over when you actually need processed video. `DEPLOYMENT.md` covers the
same choice for Fly.io, Koyeb and Railway.
