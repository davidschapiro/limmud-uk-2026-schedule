# Limmud Festival 2026 – programme browser

A private planner for Limmud Festival UK 2026 (25–30 December): browse the programme by day, search everything, open presenter bios, star sessions with a Magen David, see which sessions your friends starred, and export your picks to a calendar.

- **Hosting:** Cloudflare Pages (static page + Pages Functions)
- **Login:** Cloudflare Access (email one-time PIN, only for addresses you allow)
- **Storage:** one Workers KV namespace, one key per person (`user:<email>` → `{ name, ids, share, updatedAt }`)
- **Programme data:** `public/data.json`, refreshed nightly from events.limmud.org by a GitHub Action

```
public/                  the app (index.html) and the programme (data.json)
functions/api/me.js      GET/PUT your own stars, display name, sharing switch
functions/api/friends.js GET everyone else's shared stars (names only, never emails)
functions/api/join.js    POST the invite code to become a member (invite mode)
functions/api/_middleware.js + functions/_lib/access.js
                         every /api call must carry a valid Cloudflare Access login (JWT verified)
scripts/scrape.py        downloads the programme → public/data.json (only rewrites on real changes)
                         and logs what changed → public/changes.json (shown in the "What's new" tab)
.github/workflows/refresh-programme.yml   runs the scraper daily at 03:17 UTC
```

## Setup (about 15 minutes)

### 1. Pages project
Workers & Pages → Create → Pages → Connect to Git → this repo.

| Setting | Value |
|---|---|
| Production branch | `main` |
| Framework preset | None |
| Build command | *(empty)* |
| Build output directory | `public` |
| Root directory | `/` |

The first deploy works, but the API answers with errors until steps 2–4 are done.

### 2. KV namespace
Storage & Databases → Workers KV → Create namespace, e.g. `limmud-2026-favs`.
Then Pages project → Settings → Bindings → Add → KV namespace: **variable name `FAVS`**, the namespace you just created.

### 3. Cloudflare Access (who may log in)
Zero Trust → Access → Applications → Add an application → **Self-hosted**.

- Application domain: `<project>.pages.dev`. Add a second domain `*.<project>.pages.dev` so preview deployments are covered too (and your custom domain, if you add one).
- Policy, two ways to run it:
  - **Invite link (friends sign up themselves):** Action **Allow**, Include → **Everyone**, and set `INVITE_CODE` in step 4. Access still emails a one-time code, so every address is verified; the app only lets in people who used your invite.
  - **Fixed list:** Action **Allow**, Include → **Emails** → your friends' addresses. Leave `INVITE_CODE` unset.
- Login methods: **One-time PIN**. Friends get a code by email; no account needed.
- After saving, open the application and copy its **Application Audience (AUD) Tag**.
- Your team domain is under Zero Trust → Settings → Custom Pages (`<team>.cloudflareaccess.com`).

### 4. Environment variables
Pages project → Settings → Variables and Secrets (Production, and Preview if you use it):

| Name | Value |
|---|---|
| `ACCESS_TEAM_DOMAIN` | `<team>.cloudflareaccess.com` |
| `ACCESS_AUD` | the AUD tag from step 3 |
| `INVITE_CODE` | *(optional)* turns on invite mode, e.g. `sufganiya`; not case-sensitive |
| `OWNER_EMAILS` | *(optional)* comma-separated addresses that are always members |

Never set `DEV_EMAIL` here; it disables the login check and exists only for local development.

Then trigger a new deployment (Deployments → Retry, or push a commit); variable and binding changes only apply to new deployments.

### Inviting friends (invite mode)
Send them `https://<project>.pages.dev/#join-<INVITE_CODE>`. They log in with their own email and are in.
Without the link they see a "Join the group" box where they can type the code. 10 wrong codes per hour per address, then it locks for an hour.

- People who had saved stars before invite mode was switched on stay members automatically.
- Link leaked? Change `INVITE_CODE` and redeploy; existing members stay in.
- Remove someone: delete their `member:<email>` and `user:<email>` keys in the KV namespace. With the Access policy on "Everyone" they can still log in and browse, but can't see the group's stars.
- The free Zero Trust plan allows 50 users; everyone who completes a login takes a seat (Zero Trust → Settings → Account → seats).

### 5. Nightly refresh
Nothing to do if the repo's Actions are enabled. To refresh by hand: Actions → *Refresh programme* → Run workflow. Each change commits `public/data.json`, which redeploys the site.
If the push fails with a permissions error: repo Settings → Actions → General → Workflow permissions → *Read and write*.

## Install as an app
The page has a web app manifest, icons (`public/icons/`, made by `scripts/make_icons.py`) and a service worker (`public/sw.js`).
Android, ChromeOS and desktop Chrome/Edge show an "Add to home screen" button that triggers the install prompt; on iPhone the button explains the Share → Add to Home Screen steps.
The service worker keeps the last programme readable offline. If the install button never appears on Android/Chrome, add a Cloudflare Access **Bypass** application for `/manifest.webmanifest` and `/icons/*` (nothing private is in them).

## Local development

```bash
npm install
npm run dev          # http://localhost:8788, logged in as dev@example.com, local KV
npm run scrape       # refresh public/data.json from events.limmud.org
```

## Notes
- Times are UK time. Calendar entries run 60 minutes, or less if the next timeslot that day starts sooner (Limmud's pages only publish start times).
- Stars are cached in the browser too, so the app keeps working on patchy festival Wi-Fi and syncs when back online.
- Anyone can switch off "Show my stars to friends" in Settings; their stars then only sync across their own devices.
- After the festival, the scheduled workflow keeps running daily but commits nothing once the programme stops changing. Disable it under Actions when you're done.
