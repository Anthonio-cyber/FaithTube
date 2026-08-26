<div align="center">

# FaithTube

**Every Video. Christ-Centered.**

A dedicated Christian video platform — web and mobile — where every upload passes
a content review before anyone can watch it.

</div>

---

## What this is

FaithTube gives Christians the things a modern video platform provides — uploads,
channels, subscriptions, comments, playlists, search, recommendations, live
streaming, short-form video, a creator studio — inside a platform that hosts
Christian content only, with its own identity throughout.

It is a working application, not a mockup. Uploads run a real processing
pipeline. Moderation decisions come from a real classifier. Every figure in
every dashboard is computed from stored events. Where a third-party service is
not configured, the interface says so plainly instead of pretending.

## Quick start

```bash
git clone <this repository>
cd FaithTube
npm run setup      # install, build shared, create the database, seed it
npm run dev        # API on :4000, web client on :5173
```

Open http://localhost:5173. The seed creates three accounts:

| Role | Email | Password |
|---|---|---|
| Super admin | `admin@faithtube.example` | `ChangeMe!2024` |
| Moderator | `moderator@faithtube.example` | `ChangeMe!2024` |
| Viewer (Premium) | `viewer@faithtube.example` | `ChangeMe!2024` |

Eight creator accounts are seeded too, each `<name>@faithtube.example` with the
same password — sign in as `pastor.mensah@faithtube.example` to see the Creator
Studio with real analytics.

No API keys are needed. Everything above works on a clean checkout.

For the mobile app, see [`apps/mobile/README.md`](apps/mobile/README.md).
For hosting on a free domain, see [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Layout

```
packages/shared    Types, RBAC, categories, moderation vocabulary, Scripture parsing
apps/server        Express + Prisma API, processing worker, AI moderation
apps/web           React + Vite + Tailwind web client
apps/mobile        Expo React Native app
```

## The content rule

Every video must be Christ-centred. That is enforced by a pipeline, not a
promise.

```
Upload → Probe → Thumbnail → Transcribe → AI review → Transcode → Publish
```

Each stage is a persisted job row, so progress survives a restart and the
creator watches it move in the studio. The review stage produces one of four
outcomes:

- **Approved** — clearly Christian, clearly safe.
- **Restricted** — genuinely Christian, but covering subject matter that warrants
  an age gate and a content notice.
- **Human review** — ambiguous, thin evidence, or borderline. This is the
  intended outcome whenever the classifier is not confident.
- **Rejected** — a clear breach.

A human moderator has the final say on all of it, and a creator can appeal a
rejection once.

### Two classifiers, one interface

The **on-device classifier** is the default and needs no API key. It scores
Christian relevance, safety, family suitability and eight risk signals from the
title, description, tags, transcript, thumbnail and sampled frames, then applies
a decision matrix.

The **Claude classifier** runs when `ANTHROPIC_API_KEY` is set. The on-device
classifier still runs first — as a cheap pre-filter, as a sanity check on the
model's answer, and as the fallback if the API is unreachable. On fallback an
automatic *approve* is downgraded to human review, so **moderation never fails
open**.

### What the classifier will not do

It makes **no judgement between Christian denominations or traditions**. Nothing
in the lexicon distinguishes one from another, the model prompt forbids it, and
a test asserts that Catholic, Reformed, Orthodox and Pentecostal teaching all
pass equally.

Apologetics that quotes objections to Christianity is treated as Christian
content, not as an attack on it — also covered by a test.

Comment moderation looks for spam, scams, harassment, explicit content and hate.
Theological disagreement, including sharp disagreement, is explicitly out of
scope.

### What creators are told

Rejection messages name the rule that applies and nothing more. The reasoning
that produced the decision is kept for moderators. A test asserts that no score
or percentage leaks into creator-facing copy.

## Monetisation, deliberately absent

**FaithTube does not pay creators based on subscriber count or views.** There is
no threshold to cross, no monetisation tier, no earnings figure anywhere in the
creator dashboard. Ten subscribers and ten thousand generate the same amount
from this platform: nothing.

Paying by audience size shapes what people make — it rewards the thumbnail, the
hook and the upload cadence over the teaching. The creator dashboard states this
directly rather than leaving people to wonder what they are working toward.

Premium (£/$25 per month by default, editable by an admin without a deploy) pays
for storage, bandwidth and the review process. If creator support is introduced
later it will be separate, optional, and never automatic.

## What is built

**Watching** — custom player with an adaptive quality ladder, chapters,
transcripts, captions and full keyboard control. Continue Watching, history,
saved videos, playlists.

**Discovery** — home rails, trending by velocity rather than raw view count,
category browsing, and recommendations drawn from watch history, likes,
subscriptions, search behaviour and completion rate. Candidates come only from
videos that passed moderation; that constraint is structural rather than a
filter applied afterwards.

**Search** — ranks across titles, tags, transcripts, channels and Scripture
references, so "Romans 8" finds sermons that preach it.

**Bible Search** — ask a question in plain words and get actual Scripture (World
English Bible, public domain) alongside teaching on the passage. AI commentary,
when configured, is boxed, labelled and carries a disclaimer. Generated text is
never styled to look like Scripture.

**Creating** — channels, uploads with scheduling and visibility control, Faith
Clips (short-form vertical), live streaming with real-time chat moderation,
community posts and polls, and a studio with analytics, audience insight and
comment moderation.

**Moderating** — a review queue showing the video, creator, transcript,
classification, confidence, findings, reports and prior history on one page.
Reports, appeals, user and channel management, platform analytics, and an
append-only audit log of every administrative action.

**Accounts** — email and Google sign-in, five roles from viewer to super admin
with fine-grained permissions, revocable sessions, notification preferences,
data export and account deletion.

## Design

The brand, palette, icon set, logo, typography and navigation are original to
this project. Deep navy, warm gold and cream; a chapel-arch mark with a cross at
its apex; navigation organised as Discover / Watch / Connect / Library /
Ministry / Profile.

Accessibility is built in: keyboard navigation throughout, visible focus, screen
reader labelling, captions and transcripts, adjustable playback speed, a
high-contrast mode, and reduced-motion support. Chart colours are validated for
colour-vision deficiency and contrast in both light and dark themes.

## Configuration

Everything optional is genuinely optional. Copy `.env.example` to `.env` and set
only what you need.

| Service | Without it |
|---|---|
| `ANTHROPIC_API_KEY` | The on-device classifier handles moderation |
| `GOOGLE_CLIENT_ID` / `SECRET` | Google sign-in reports itself unavailable; email sign-in works |
| `STRIPE_SECRET_KEY` | Premium checkout says payments are not configured |
| `WHISPER_API_URL` | The classifier is told speech evidence is missing, not given a fake transcript |
| `LIVE_INGEST_BASE` | Streams can be scheduled and chatted in; no video is received |
| ffmpeg | Videos are served exactly as uploaded, with no generated thumbnails or renditions |
| `S3_*` | Files are stored on local disk |

`/admin` shows which of these are on and off for the running deployment.

## Commands

```bash
npm run dev          # API and web client together
npm run build        # production build of everything
npm run test         # moderation and classifier tests
npm run typecheck    # shared, server and web
npm run db:seed      # re-seed
```

## Security

Sessions are httpOnly cookies on web and keychain-stored tokens on mobile,
revocable individually. Passwords are bcrypt-hashed. IP addresses are hashed
before they reach the audit log. Rate limiting covers auth, uploads, writes,
search and reports. Card details never touch the database — checkout is hosted
by Stripe. A production Content Security Policy restricts sources to the origins
the deployment actually uses.

## Licence and attribution

Scripture is the World English Bible, which is in the public domain. All other
text, artwork and code here is original to this project. Nothing in the
interface, branding or iconography is derived from any existing video platform.
