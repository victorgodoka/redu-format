# REDU Format

Site and tournament system for Yu-Gi-Oh! REDU Format (retro, 2012.10 / Wind-Up banlist), with support for tournaments on other formats (today: TCG). Signup, deck validation against the event's banlist, bracket, player self-reported results, automatic duel verification on Dueling Nexus, ranking, and prizing by redemption code.

- **Stack:** Next.js 16 (App Router, Server Components and Server Actions), React 19, TypeScript, MariaDB/MySQL.
- **No REST API of its own:** pages read straight from server-side services and write through Server Actions. The few HTTP routes that exist are listed under [HTTP routes](#http-routes).
- **Identity:** Discord login (site and admin), in-game identity from Dueling Nexus.

Further documentation: [backend structure](docs/backend-structure.md) and [tournament flow](docs/fluxo-do-torneio.md) (both in Portuguese).

## Contents

- [Requirements](#requirements)
- [Running locally](#running-locally)
- [Environment variables](#environment-variables)
- [Database](#database)
- [Deploy](#deploy)
- [Authentication and sessions](#authentication-and-sessions)
- [Admin area](#admin-area)
- [Public site](#public-site)
- [HTTP routes](#http-routes)
- [External integrations](#external-integrations)
- [Deck validation](#deck-validation)
- [Prizing](#prizing)
- [Messages to players](#messages-to-players)
- [Tests](#tests)
- [Folder structure](#folder-structure)
- [Technical debt](#technical-debt)

---

## Requirements

| Item | Version / detail | Why |
|---|---|---|
| Node.js | **22 or newer** | Next 16 requires ≥ 20.9; the tests use `--experimental-strip-types` (Node 22.6+) to run TypeScript directly. |
| pnpm | 9+ | The repository's lockfile is `pnpm-lock.yaml`. `npm`/`yarn` work but ignore the lock. |
| MariaDB or MySQL | MariaDB 10.6+ / MySQL 8+ | Uses `JSON`, `DATETIME(3)`, `INSERT ... ON DUPLICATE KEY UPDATE` and `INSERT IGNORE`. On MariaDB, `JSON` is an alias for `LONGTEXT` — the code already handles both shapes the driver returns. |
| Discord application | with a bot in the server | Login (OAuth2 `identify`) and reading the member's role to authorise admins. |
| Outbound HTTPS | `duelingnexus.com`, `discord.com` | Nexus profile/decks/replays and the Discord API. An environment without outbound access will not work. |

No Redis needed (rate limiting is a table), no file storage (tournament banners are stored as `MEDIUMBLOB` in the database), and no mail service (player messages are delivered to the site's own inbox).

## Running locally

```bash
pnpm install
```

Create a `.env.local` at the root with the variables from the next section, then:

```bash
pnpm db:migrate
```

```bash
pnpm dev
```

The site comes up at `http://localhost:3000`.

Other scripts:

| Script | What it does |
|---|---|
| `pnpm dev` | Development server (Turbopack). |
| `pnpm build` | Production build. |
| `pnpm start` | Serves the production build. Requires `pnpm build` first. |
| `pnpm lint` | ESLint (`eslint-config-next`). |
| `pnpm test` | Test suite on `node:test`. Part of it touches the database — see [Tests](#tests). |
| `pnpm db:migrate` | Applies pending migrations. Idempotent. |
| `pnpm db:seed` | Today it only runs the migrations; there is no sample data. |

> `db:migrate`, `db:seed` and `test` read `--env-file=.env.local`. In CI, either generate that file or run the equivalent command with the variables already exported in the environment.

## Environment variables

**No variable in this project is prefixed with `NEXT_PUBLIC_`**, so nothing is inlined into the browser bundle. Every one of them is read on the server only. Even so, the "secret" column below separates what is a real secret (leaking it is a compromise) from what is merely configuration (it shows up in the OAuth URL, in the HTML, or is public by nature).

### Secrets — never commit, never log

| Variable | Secret | Description |
|---|---|---|
| `DATABASE_URL` | **Yes** | `mysql://user:password@host:port/database`. Full database credential. |
| `AUTH_SECRET` | **Yes** | HMAC key (HS256) signing the admin session JWT. Rotating it invalidates every admin session. |
| `SESSION_SECRET` | **Yes** | Encryption key for the player session (iron-session). **At least 32 characters** — the app throws at runtime if it is shorter. Rotating it signs everyone out. Generate with `openssl rand -base64 32`. |
| `DISCORD_CLIENT_SECRET` | **Yes** | Client secret of the Discord application, used to exchange the `code` for a token. |
| `DISCORD_BOT_TOKEN` | **Yes** | Bot token. Used to read a member's role in the server (admin authorisation). |
| `CRON_SECRET` | **Yes** | Bearer that authorises `GET /api/cron/round-deadlines`. If it is unset, the route answers 401 to everyone. |

### Configuration — not secrets

| Variable | Secret | Description |
|---|---|---|
| `DISCORD_CLIENT_ID` | No | Discord application id. Appears in the authorisation URL. |
| `DISCORD_OAUTH_URL` | No | Authorisation endpoint, normally `https://discord.com/api/oauth2/authorize`. |
| `DISCORD_API_URL` | No | API base, normally `https://discord.com/api/v10`. |
| `DISCORD_GUILD_ID` | No | Server where the moderation role is checked. |
| `DISCORD_MOD_ROLE_ID` | No | Role that grants access to `/admin`. Not a secret, but no reason to publish it either. |
| `DISCORD_REDIRECT_URI` | No | **Admin** callback: `https://YOUR_DOMAIN/admin/callback`. Must be registered on the Discord application. |
| `DISCORD_PLAYER_REDIRECT_URI` | No | **Player** callback. Optional: when absent it is derived as `/login/callback` on the same origin as `DISCORD_REDIRECT_URI`. **It also has to be registered on the Discord application.** |
| `DISCORD_BOT_PUBLIC_KEY` | No | Application public key, used to verify the signature of bot interactions. Public by definition. |

Example `.env.local`:

```bash
DATABASE_URL=mysql://redu:password@localhost:3306/redu
AUTH_SECRET=change-me
SESSION_SECRET=change-me-to-32-characters-or-more
CRON_SECRET=change-me

DISCORD_CLIENT_ID=000000000000000000
DISCORD_CLIENT_SECRET=xxxxx
DISCORD_BOT_TOKEN=xxxxx
DISCORD_BOT_PUBLIC_KEY=xxxxx
DISCORD_GUILD_ID=000000000000000000
DISCORD_MOD_ROLE_ID=000000000000000000
DISCORD_OAUTH_URL=https://discord.com/api/oauth2/authorize
DISCORD_API_URL=https://discord.com/api/v10
DISCORD_REDIRECT_URI=http://localhost:3000/admin/callback
DISCORD_PLAYER_REDIRECT_URI=http://localhost:3000/login/callback
```

The Discord variables are read strictly (`requiredEnv`): with any of them missing, the request that needs it throws — the build passes, the runtime does not.

## Database

Migrations are numbered `.sql` files in `lib/backend/db/migrations/`, applied in filename order by the runner in `lib/backend/db/migrate.ts`, which records what has already run in the `_migrations` table. The runner strips `--` comments and splits the file on `;`, so **avoid `;` inside literals** and do not use `DELIMITER`/procedures.

To add a migration: create `NNN_description.sql` with the next number and run `pnpm db:migrate`. Never edit a migration that has already been applied — write the next one.

### Table map

**Tournaments and signup**

| Table | Contents |
|---|---|
| `tournaments` | The event: name, description (markdown), banner (bytes + mime), start, structure, rounds, top cut, match format, engine, **banlist**, seats, entry (free/paid), host, status (`scheduled`/`running`/`finished`/`cancelled`), `has_prizing`, `prizes_sent_at`. |
| `registrations` | One row per entrant: display name, deck (uuid + name), the list snapshot taken at signup and the one locked at the start, payment, source (`public_signup`/`admin_manual`), drop, disqualification, absences. |
| `saved_tournaments` | The player's "save event". Stored by slug, not by FK — it works for static events too. |
| `tournament_prizes` | Redemption codes: tier, code, who it went to and when. |

**Results**

| Table | Contents |
|---|---|
| `tournament_brackets` | Bracket state serialised by the `tournament-organizer` library, one JSON blob per tournament. It is the source of truth for the bracket. |
| `tournament_placings` | Final standings frozen at completion: place, points, ranking points and the match record (`wins`/`losses`/`draws`). This is the leaderboard's read model. |
| `match_reports` | Player self-reports. Rows disappear once a match resolves; two disagreeing rows = a contested match. |
| `match_deadlines` | The matches' own clock (the engine has no notion of time). |
| `match_flags` | Open no-show calls and contested results. |
| `redo_requests` | Request to replay a duel lost to a disconnect. |

**Players and identity**

| Table | Contents |
|---|---|
| `players` | The player account: Nexus identity key (sha256 of the token), Nexus user id and name, avatar, contributor, `discord_user_id` and the linked `nexus_token`. |
| `discord_accounts` | What Discord reported at login: username, display name, avatar, first seen and last login. Record only — nothing on the site displays it. |
| `admins` | Admins who have signed in, with the Nexus token each of them linked. |
| `audit_logs` | Every administrative action: who, what, target, detail, when. |

**Communication**

| Table | Contents |
|---|---|
| `notifications` | The site's inbox (player and admin). A null `player_id` means a global alert for that audience. The unique `fingerprint` keeps the same alert from being re-sent. |
| `notification_reads` | Read state per reader — a global alert read by one admin stays unread for every other admin. |

**Cache and infrastructure**

| Table | Contents |
|---|---|
| `nexus_profile_cache` | Shared cache of the Nexus profile (an in-memory cache does not cross serverless instances). |
| `nexus_replay_cache` | Replays already seen, so none is fetched twice. |
| `nexus_fetch_log` | Cache + lock for calls to Nexus: two concurrent requests never call the API twice. |
| `duel_slots` / `duel_attempts` | Each game inside a match, and the attempts to match it to a real replay. |
| `deck_snapshots` | Per-round history of deck lists. |
| `rate_limits` | Fixed window per key (`login:IP`, `nexus-link:IP`). Stands in for Redis. |

## Deploy

This is a Next.js app **with a server** (Server Components, Server Actions, `after()`, database access). It cannot be exported as a static site and does not run on the edge alone.

### What the server needs

1. **A Node.js 22+ runtime** able to run `next start` (or your platform's adapter).
2. **A reachable MariaDB/MySQL database**, with migrations applied.
3. **Outbound HTTPS** to `duelingnexus.com` and `discord.com`.
4. **A stable, public HTTPS origin** — both OAuth callbacks have to be registered on the Discord application (`/admin/callback` and `/login/callback`).
5. **~512 MB of memory** per instance, minimum. The TCG validator loads `lib/cardinfo.json` (24 MB) once per process, on demand, and reduces it to a small index — the parsing peak is what sets that number. REDU-only tournaments never pay it.
6. **A scheduler** able to hit `GET /api/cron/round-deadlines` with the `Authorization: Bearer $CRON_SECRET` header. Platform cron, system cron with `curl`, or any external scheduler.
7. **`lib/cardinfo.json` present next to the build.** It is read at runtime through `fs`, not imported. With `next build` + `next start` in the repository directory that already holds; on platforms that trace files and ship only what is needed (Vercel, `output: standalone`), `next.config.ts` already declares `outputFileTracingIncludes` to include it.

### Steps

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
pnpm start
```

Put the app behind HTTPS. In production (`NODE_ENV=production`) cookies are issued with `secure: true` — over plain HTTP the browser drops them and login never completes.

**The build itself does not touch the database.** Every route is server-rendered on demand (each one reads the session cookie), and `/sitemap.xml` is explicitly `force-dynamic` for the same reason, so `next build` never queries and a database that is down or out of connections cannot fail a deploy. `pnpm db:migrate` does need it, which is why it is a separate step.

### Platform notes

- **Vercel:** `vercel.json` already declares the cron (`0 12 * * *`) and Vercel injects the `Authorization` header from `CRON_SECRET`. The Hobby plan allows one run a day — enough, because the cron is a *backstop*, not the main clock (see [Rounds and deadlines](#rounds-and-deadlines)).
- **Docker / VPS / managed Node:** works with `next start` behind a reverse proxy. If you use `output: "standalone"`, confirm `lib/cardinfo.json` was copied along. Point the system cron at the endpoint above.
- **Horizontal scaling:** safe. There is no in-process state that needs sharing — profile cache, rate limit and fetch lock all live in the database. The connection pool is deliberately small (3 per instance, at most 1 kept idle for 30s) precisely because many instances share one database's `max_connections`. If you ever see `ER_CON_COUNT_ERROR`, count the clients attached to that database before raising the pool.

## Authentication and sessions

There are **two independent sessions**, with different cookies and different rules. Signing out of one does not sign out of the other.

### Player session — `redu_session` cookie

- Encrypted with iron-session (`SESSION_SECRET`), `httpOnly`, `sameSite=lax`, 7-day TTL.
- Holds: the Discord identity (`userId`, `username`, `displayName`, `avatar`), the **Nexus token**, and a name/avatar/contributor snapshot used as a render fallback.
- The Nexus token rides inside the encrypted cookie because it is the only credential that can read a player's decks. The client only ever holds ciphertext.

**Flow:**

1. `/login` → **Continue with Discord** → `/login/discord` builds the authorisation URL (`scope=identify`) and writes two short-lived cookies (`player_oauth_state`, `player_next`, scoped to `/login`, 10 min).
2. Discord redirects to `/login/callback`. The `state` is checked, the `code` exchanged for a token, and the profile read.
3. **No role or server membership is checked** — any valid Discord account gets in.
4. The Discord data is written to `discord_accounts` (upserted on every login).
5. If that Discord account already has a Nexus token linked (`players.nexus_token`) and it still works, the session is completed and the player lands where they were headed. If the token has been revoked, it is dropped from the database right there.
6. Without a valid token the player goes to `/login/nexus`, pastes it, and it is validated against Nexus, tied to the Discord account and kept for future logins.

**The gate to the signed-in area is the Nexus token.** Every signed-in page checks `session.token`; without it, the visitor is sent to `/login`, which forwards to `/login/nexus` when a Discord session already exists. In other words: signing in with Discord identifies you, but opens nothing until a valid Nexus token exists.

If Nexus later rejects the token (revoked, account deleted), `SiteHeader` catches it on the next render and the `SessionExpiredRedirect` overlay destroys the session and returns the player to login.

### Admin session — `admin_session` cookie

- HS256 JWT signed with `AUTH_SECRET` (`jose`), `httpOnly`, `sameSite=lax`, 1-day TTL.
- Holds: `userId`, `username`, `displayName` from Discord and, if there is one, the Nexus token the admin linked.

**Flow:** `/admin` → `/admin/login` → Discord → `/admin/callback`, which requires the **`DISCORD_MOD_ROLE_ID` role in the `DISCORD_GUILD_ID` server** (read with the bot). Without the role, back to the home page with no session. With it: upsert into `admins`, JWT created, and — if the admin has already linked a Nexus token — the public session is created too, carrying the same Discord identity.

**Route protection:** `proxy.ts` (Next 16's middleware) intercepts `/admin/:path*`. Only `/admin`, `/admin/login`, `/admin/callback` and `/admin/logout` pass without a session; every other route requires a valid JWT. A new admin page is therefore protected the moment it exists, and a rejected request never renders protected markup. The original destination travels in `next` for the post-login return.

## Admin area

Everything under `/admin` renders inside `AdminShell` and runs behind the middleware. Every meaningful action is written to `audit_logs` through `recordAction` — who did it, on which target, and what.

### `/admin/dashboard`

- **Reads:** `tournaments` (upcoming events), the admin's Nexus profile (through the cache), `notifications` (unread count).
- **Writes:** the admin's Nexus token link.
- **Actions:** `linkNexusToken` (validates the token against Nexus, stores it in `admins.nexus_token` and creates the player session too), `unlinkNexusToken`.
- **Why it exists:** automatic duel verification needs *some* valid token to query Nexus. That shared token is what it uses.

### `/admin/tournaments` and `/admin/tournaments/new`

- **Reads:** `tournaments`.
- **Writes:** `tournaments` (including the banner bytes).
- **Expects from the form:** name, markdown description, banner (image file ≤ 5 MB), date/time + timezone (converted to UTC on write), **banlist**, structure, rounds, top cut, seats, match format, engine, duration mode, round clocks, entry (free/paid with amount and currency), host, signup URL and the prizing flag.
- **Rules the server enforces** (never trust the form): rounds only mean anything for Swiss; the top cut size is **derived** from the seat count, never typed; each duration mode reads only the clock it uses; the slug is unique, generated from the name.
- **Actions:** `createTournamentAction`, `updateTournamentAction`, `cancelTournamentAction` (keeps the history, generates no placings and scores nothing), `deleteTournamentAction`.

### `/admin/tournaments/[slug]`

Tournament editing, the prizing panel (when enabled) and the destructive actions.

- **Reads:** `tournaments`, `tournament_prizes`.
- **Writes:** `tournaments`, `tournament_prizes`, `notifications` (when prizing is sent).
- **Actions:** the editing ones above, plus `addPrizesAction`, `removePrizeAction` and `sendPrizesAction`.

### `/admin/tournaments/[slug]/participants`

- **Reads:** `registrations` (joined with `tournaments`), bracket state.
- **Writes:** `registrations`, `notifications`, `audit_logs`.
- **Actions:** add a manual participant (name + deck uuid), change/override a deck, confirm or contest payment, remove, disqualify (notifies the player) and reinstate.
- **Detail:** a manual entry has no linked account — it gets no notification and no prize code, because there is no inbox to send to.

### `/admin/tournaments/[slug]/bracket`

- **Reads:** `tournament_brackets`, `registrations`, `match_deadlines`, `match_flags`, `match_reports`.
- **Writes:** the same, plus `tournament_placings` and `deck_snapshots` at completion.
- **Actions:** `startBracketAction` (closes signups, locks the deck lists, generates round 1), `enterResultAction` (moderator override), `dismissNoShowAdminAction`, `nextRoundAction`, `extendRoundAction`, `updateBracketStatusAction` (forces the Nexus check right now), `repairRoundAction` (see below), `completeBracketAction` (freezes placings, match records and ranking points; marks the tournament `finished`).

**Re-pairing a Swiss round.** When a round itself goes wrong — a result entered against the wrong match, someone in the pool who should not have been, pairings drawn from standings that were themselves wrong — `repairRound()` throws the current round away and draws it again from the standings as they stand now. It is Swiss-only and stage-one-only: an elimination bracket repairs through the match itself (`enterMatchResult` with `confirmRepair`), and once the top cut exists it was cut from these standings and cannot be unwound from here.

What it does: voids every match of the round, deletes what hung off them (deadlines and lobbies, player reports, open no-show/contest flags, duel slots — attempts cascade), re-pairs through the engine's own `nextRound()`, opens fresh lobbies, and notifies every player in the new round.

Two things worth knowing before using it:

- **Swiss pairing is not deterministic.** The same standings can pair differently from one draw to the next, so this re-draws the round rather than reproducing it — who plays whom will likely change even if nothing else did. Verified in `lib/round-repair.test.ts`.
- **The deck lock is left alone.** The round keeps the lists frozen when it was first paired; re-freezing would quietly adopt whatever a player edited since, which is the opposite of what the lock is for.

### `/admin/messages`

- **Reads:** `tournaments` (for the selector) and `players` (Nexus names for the autocomplete, 500 most recent).
- **Writes:** `notifications`.
- **Expects:** title, markdown body and the audience — every player, one tournament's field, or specific players picked by Nexus name.
- **Sends:** for "everyone", **one** global notification; otherwise one per player. Every message goes out signed with the sending admin's name. Names matching no account come back listed in the response instead of failing the whole send.

### `/admin/inbox`

The system's alert feed for moderation: deck changed mid-tournament, automatic disqualification, no-show, contested result. Reads `notifications` + `notification_reads`; opening a message is what marks it read.

### `/admin/logs`

Full audit trail, filterable by actor, action and target, paginated 25 at a time. Reads `audit_logs` and `admins`.

## Public site

### `/` — home

Static: what the format is, FAQ, featured event. No database access.

### `/events` — tournament list

- **Consumes:** `tournaments`, and, when signed in, the player's signups and saved events.
- **Side effect:** kicks off verification of active duels in the background (`after()`), respecting the 5-minute cache/lock per tournament.
- Filters by structure, date and seats, with pagination.

### `/events/[slug]` — tournament page

Renders in three variants depending on status: **upcoming**, **running** and **finished**.

- **Consumes:** `tournaments`, `registrations`, `tournament_brackets`, `tournament_placings`, `match_*`, `redo_requests`, `saved_tournaments` and the visitor's Nexus profile.
- **A signed-in player sees and does:** their current round, the duel room/hash, report a result, contest, call a no-show, request/accept/reject a redo of a disconnected duel.
- **Side effects:** closes overdue matches and runs duel verification, both in the background.
- Shows the event's banlist alongside the other facts.

### `/events/[slug]/signup` — signup

- **Consumes:** `tournaments`, `registrations` and the decks from the Nexus profile.
- **Validates:** deck size and legality **against that tournament's banlist**. Illegal decks appear disabled in the picker, with the reason spelled out.
- **Picker filters:** search by deck name and an "only decks legal for this event" toggle. A deck already selected stays selected even when the filter hides it — the page says so when that happens.
- **Writes:** `registrations` with the list snapshot taken at signup — that snapshot is what the deck-change check compares against later.
- Requires login: with no session, off to login and back.

### `/dashboard` — player dashboard

- **Consumes:** Nexus profile and decks, `tournaments`, `registrations`, `tournament_placings`, `notifications`, current round.
- Lists decks **always validated against the REDU banlist** (the format choice belongs to a tournament, not to the dashboard), signups, placing history and the round in progress.
- **Actions:** refresh profile (forced refetch from Nexus), sign out, undo "save event".

### `/inbox` — player inbox

Messages addressed to them plus global alerts. Body rendered as markdown. Opening marks it read (per reader).

### `/leaderboard`

Table paginated 20 at a time with rank, avatar, name, points, event count, total W/L and best placement. Reads `tournament_placings` aggregated per player — rebuilding no bracket at all, because the match record is frozen when the tournament completes.

### `/banlist`, `/rulings`

Static REDU Format content, served from `lib/`.

### `/login`, `/login/nexus`

See [Authentication and sessions](#authentication-and-sessions).

### What is stored about a player

| Data | Where | Note |
|---|---|---|
| Nexus token | encrypted cookie + `players.nexus_token` | A credential. Never rendered, never sent to the client in the clear, never included in a notification. |
| Nexus name, avatar, contributor | `players` + session snapshot | This is the identity shown everywhere on the site. |
| Discord username, display name and avatar | `discord_accounts` | Record only — nothing player-facing reads that table. |
| Deck lists | `registrations.deck_snapshot`, `deck_snapshots` | The basis of the mid-tournament deck-change check. |
| Results | `tournament_placings`, `tournament_brackets` | Permanent history. |

## HTTP routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/cron/round-deadlines` | GET | `Bearer $CRON_SECRET` | Closes overdue matches and resolves no-shows across every tournament. |
| `/api/auth/logout` | GET | session | Destroys the player session. |
| `/api/discord/interactions` | POST | Ed25519 signature (`DISCORD_BOT_PUBLIC_KEY`) | Bot interactions webhook (ping + slash commands). |
| `/events/[slug]/banner` | GET | public | Serves the banner bytes straight from the database. |
| `/login/discord`, `/login/callback` | GET | — | Player OAuth. |
| `/admin/login`, `/admin/callback` | GET | — | Admin OAuth. |
| `/admin/logout` | POST | admin session | Destroys the admin session (it is a form, not a link). |

## External integrations

### Dueling Nexus

There is no official API and no key: reads use the player's own token (or the shared token an admin linked) against the public endpoints.

- **Profile and decks** (`get-info.php`): Nexus answers HTTP 200 even for an invalid token, so only the body (`success: true`) decides. Two cache levels: process memory (1 min) and the `nexus_profile_cache` table.
- **Replays** (`get-replay-info.php`): used to verify duel results automatically. Each tournament has a 5-minute cache/lock in `nexus_fetch_log` — two simultaneous requests never fire two calls.
- **Duel rooms:** the room hash bit-packs the ruleset, so it is built from the tournament's banlist — REDU opens on DN banlist index 10 under Master Rule 2, TCG on index 0 under Master Rule 5 (`lib/backend/services/nexus-room.ts`). Those indices are positions in DN's own `/assets/data/banlists.json`, not stable ids.
- **Deck lock:** the registered list is frozen when the tournament starts; on every visit, round and login the deck is compared to what Nexus reports. A deck edited mid-tournament is disqualified automatically, and both the player and moderation are notified.

### Discord

- **OAuth2** (`identify`) for both logins.
- **Bot** to read the member's role and authorise admins.
- **Interactions webhook** at `/api/discord/interactions`, with signature verification.

### Rounds and deadlines

The round clock is computed from persisted deadlines (`match_deadlines`), not from an in-memory timer. That means a round closes on time even if nothing has swept the database yet. The sweep happens in three places: the daily cron, every time someone opens an active tournament page, and on every player report.

## Deck validation

Every tournament declares its banlist, and that is what decides validation at signup. The player dashboard is always REDU.

**REDU (2012.10 / Wind-Up)** — `lib/validateDecks.ts`, over the frozen library in `lib/cardLib.ts`:

- the format's card pool (a card outside it is illegal);
- the format's banlist, with every printing of a card counting together;
- errata: an errata'd card is only legal in its pre-errata printing.

**TCG (2026.05)** — `lib/tcg-decks.ts`, over `lib/cardinfo.json`:

- rarity stripped off the id (`id % 100000000000`) — this applies to both validators **and to deck snapshots**, on write and on read: buying the same card in another rarity must not read as a deck edit and disqualify a player mid-tournament;
- a card is legal if `misc_info[0].formats` contains `TCG`, **or** `misc_info[0].tcg_date` is a valid date, **or** any `card_sets[].set_code` is an English print code (`XXXX-EN000`) — a set can be out for weeks before the dump's format list and release date catch up with it;
- copies limited by `banlist_info.ban_tcg` (forbidden 0, limited 1, semi-limited 2, everything else 3);
- id not found: look in `card_images` first (that is where alternate art ids live), then walk down by 1, up to 5 times, for printings `card_images` does not list;
- ids that still match nothing are reported together on a single line, asking the player to check alternate arts and contact moderation;
- a card that exists but never came out in the TCG is named, rather than reported as an unknown id.

## Prizing

Enabled per tournament (`has_prizing`). Codes are entered as a batch — one `[code] [type]` row at a time, `+` adds another and one "Save codes" stores them all — while the tournament is scheduled or running, and freeze once it finishes. Clicking `+` also stashes what has been typed in `localStorage` (`redu:prize-codes:{slug}`), which is restored when the page is opened again and cleared once the codes are actually saved.

**Tiers:** Winner = 1st; Runner-up = 2nd; Top 4 = 3rd–4th; Top 8 = 5th–8th; Top 16 = 9th–16th; Top 32 = 17th–32nd; Participation = everyone else who finished.

**Sending** (the *Send prizing* button, only once the tournament is finished): each player receives **one** code — the one for their tier if any is left, otherwise a participation code. A tier code never leaks outside its tier; participation codes are dealt at random. Drops and disqualifications receive nothing, participation included. A manual entry with no account receives nothing either, having no inbox. The send happens once: a double click cannot send twice, because the operation is claimed on `prizes_sent_at` before anything is delivered.

## Messages to players

Delivered internally, through the site inbox (`/inbox`) — **there is no email**. The body accepts markdown, rendered the same way a tournament description is.

Markdown safety: raw HTML in the source is escaped before conversion, and links with executable schemes are neutralised. This applies to every inbox, because system alerts quote deck names and player names — text the player chooses themselves.

## Tests

```bash
pnpm test
```

Runs `node:test` directly over the TypeScript files. **Part of the suite needs a database** (`lib/tournaments.test.ts`, `lib/results.test.ts`, `lib/player.test.ts`, `lib/registration.test.ts`, among others): they use the `DATABASE_URL` from `.env.local` and clear the tables they touch. Point it at a throwaway database, never at production.

The pure tests — no database — can run on their own:

```bash
node --experimental-strip-types --test lib/prizing.test.ts lib/tcg-decks.test.ts lib/validateDecks.test.ts lib/rounds.test.ts lib/cards.test.ts lib/deck-diff.test.ts
```

## Folder structure

```
app/                      routes (App Router), pages and Server Actions
  admin/(protected)/      admin area, behind the middleware
  api/                    HTTP routes (cron, logout, Discord webhook)
  events/                 list, tournament page and signup
  login/                  player OAuth and Nexus token linking
components/
  admin/                  admin area components
  site/                   public site components
  ui/                     shared primitives (Button, Panel, Markdown...)
lib/
  auth.ts                 player session, Nexus profile, cache
  auth/                   admin session (JWT) and OAuth state
  backend/
    db/                   pool, migrations, runner
    repositories/         table access, SQL lives here
    services/             business rules, orchestrate repositories
  events.ts               tournament domain types and helpers
  validateDecks.ts        REDU validation
  tcg-decks.ts            TCG validation
  prizing.ts              prize tiers and code distribution
  cardLib.ts              REDU format card library (generated)
  cardinfo.json           full card dump, source of truth for TCG
docs/                     architecture and tournament flow documentation
proxy.ts                  Next 16 middleware, protects /admin
```

The layering rule: **page/action → service → repository → database**. SQL exists only in `lib/backend/repositories`. Pages never talk to a repository directly.

---

## Technical debt

Known open items, in order of structural impact.

### 1. Make the project product-agnostic ("white label")

Today REDU is welded into everything: the name, the copy, the default banlist, the home page, the FAQ, the banlist page, the scoring rules, even the domain vocabulary. It should be possible to run this same codebase for any community or game, swapping theme, content and format rules through configuration — with the tournament core (signup, bracket, results, ranking) not knowing which game it is running.

### 2. Better tournament creation and structural validation

The form accepts combinations that should not exist, and it validates field by field rather than the whole. Real structural validation is missing: coherence between structure, rounds, top cut and seat count; signup windows; a preview of what will be generated; and rules of its own per event type. Separating "draft" from "published" is missing too.

### 3. Database-agnostic backend

SQL is isolated in the repositories, which already helps, but it is explicitly MariaDB/MySQL (`INSERT IGNORE`, `ON DUPLICATE KEY UPDATE`, `JSON` columns that come back as text). Switching databases today means rewriting the whole repository directory. The way out is a persistence interface with per-database implementations, or a query layer that absorbs those differences.

### 4. New formats without depending on the giant JSON

`lib/cardinfo.json` is 24 MB and is loaded whole to become a small index. It works, but it does not scale to several formats: each new one would tend to bring its own dump. The right shape is an indexed card data source (a database, or a compact index generated at build time), with formats declared as data — pool + banlist + errata — instead of code.

### 5. General UI improvements

Spacing and typography consistency, hierarchy on the tournament pages, table density, empty states, responsiveness on the heaviest screens (bracket, participants) and accessibility. A design-system pass is missing as well: global CSS, CSS modules and utility classes currently coexist.

### 6. Better error handling

Any backend error today turns into Next's generic screen ("this page couldn't load"), with no explanation and no way forward. Missing: a per-route `error.tsx` with a useful message and a retry action, a distinction between our own failure and Nexus/Discord being unavailable, standardised Server Action messages in the interface, and structured server-side logging so the same incident is traceable.

### Other smaller items already identified

- The audit entry for admin login (`admin.login`) is commented out in `app/admin/callback/route.ts` — logins do not show up in the log.
- There is no "change my Nexus token" flow for a player outside the moment the token breaks.
- `pnpm db:seed` generates no sample data, which makes local onboarding slower than it needs to be.
- The database-backed tests have no isolation of their own: they run against the configured `DATABASE_URL` and clear tables.
