<div align="center">

# Music Bot for Telegram

**Type a song name — no slash needed. Play it instantly, or search a pick-list. A brutalist companion Mini App and a public docs page included.**

[Features](#features) · [Architecture](#architecture) · [Setup](#local-development) · [Deploy](#render-deployment) · [API Contract](#api-contract-reference) · [Troubleshooting](#troubleshooting)

![Node](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)
![Telegram](https://img.shields.io/badge/Telegram_Bot_API-Webhook-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)
![Render](https://img.shields.io/badge/Deploy-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

</div>

---

> [!IMPORTANT]
> This bot is trimmed to three endpoints only — **search, lyrics, download** — against `raihan07-musicapi.vercel.app`. See [API Contract Reference](#api-contract-reference) for the exact shape of each.

## Features

**Bot**
- **Play instantly**: `/play <query>`, or type `play <song>` / `p <song>` with no slash at all — downloads the top match immediately, no list, no intermediate messages
- **Search a pick-list**: `/search <query>`, or type `search <song>` / `find <song>` with no slash — sends "Searching..." then edits that same message into a numbered, tappable list once results arrive
- 10 numbered results per page, with page-forward, page-back, and a delete-list button
- If `/play` or `/search` is sent with no query, the bot remembers what you meant — your very next plain message becomes that query
- A personalized welcome (`/start`) greeting you by your actual Telegram first name
- Lyrics lookup by `artist - title`, or straight from whatever you just played
- Audio delivered with correct track title and artist metadata — never a raw filename
- One-tap Mini App launcher

**Mini App**
- Brutalist UI: thick black borders, hard offset shadows, one loud accent color, rounded corners
- Live uptime counter polling every 10 seconds
- In-app search and help

**Docs page**
- A standalone public page at `DOCS_PATH` (default `/docs`) explaining what the bot does, its commands, and how it works

**Infrastructure**
- Webhook-based delivery (no polling)
- Downloads audio into memory and re-uploads with real metadata (never hands Telegram a raw URL)
- Render-ready with Docker and Blueprint (`render.yaml`) support
- Zero external database — in-memory session store

## What Telegram actually supports here

A few things worth being direct about, since not every idea maps onto a real Bot API feature:

- **No custom message styling.** Telegram bot messages — including inline-keyboard lists — are rendered entirely by the Telegram client app. There is no CSS, no blur, and no way for a bot to restyle its own chat bubbles beyond a small preset-color option added in a recent Bot API version, which this bot doesn't currently use since the exact option name in the pinned library version couldn't be confirmed with certainty. The **Mini App** is the only surface where custom visual design is possible.
- **No download-progress messages, by design.** Earlier versions of this bot showed a live-updating progress message during download; that's been removed entirely in favor of a cleaner, quieter flow. The one thing that still runs during the download wait is Telegram's own native `sendChatAction("upload_audio")` indicator, re-fired every 4 seconds (since it self-clears after about 5) so it stays visible for the whole download without needing any message-editing.

## Architecture

```
                    ┌─────────────────────┐
                    │   Telegram Servers   │
                    └──────────┬───────────┘
                               │ webhook POST
                               ▼
                    ┌─────────────────────┐
                    │   Express Server     │
                    │   (src/index.js)     │
                    └──────────┬───────────┘
                               │
        ┌──────────────┬───────┴────────┬────────────────┐
        ▼              ▼                ▼                ▼
┌───────────────┐┌────────────┐┌─────────────────┐┌───────────────┐
│ routes/webhook ││routes/mini ││  routes/status   ││  routes/docs   │
└───────┬────────┘└─────┬──────┘└──────────────────┘└───────────────┘
        │                │
        ▼                ▼
┌────────────────┐┌─────────────────────┐
│ handlers/       ││   src/api.js         │
│  commands.js     ││  (search/lyrics/     │
│  callback.js      ││   download only)     │
│  messages.js       │└──────────┬───────────┘
└────────┬─────────┘             │
        │                       ▼
        ▼            ┌────────────────────────────┐
┌────────────────┐    │ raihan07-musicapi.vercel.app │
│ src/sessions.js │    └────────────────────────────┘
│ (active list,   │
│  last track,    │
│  awaiting intent)│
└─────────────────┘

Mini App (public/) served at MINI_APP_PATH.
Docs page (public/docs.html) served at DOCS_PATH.
```

`handlers/commands.js` and `handlers/callback.js` share one list-rendering function (`buildListPage`), so a search result page and every "Next page" tap produce identical output.

## How the no-slash shortcuts work

Telegram only auto-routes messages starting with `/` to a specific command. Everything else — `play shape of you`, `p perfect`, `search shape of you`, `find perfect` — is just a plain text message from Telegram's point of view, so this bot parses it manually in `helpers.parsePlainCommand`: the first word is checked case-insensitively against `play`/`p` (→ instant play) and `search`/`find` (→ pick-list), and everything after it becomes the query. A word that doesn't match either prefix is left alone, so a search for a song actually titled starting with one of these words (e.g. "Play That Funky Music") still works correctly as long as it's sent as `/play Play That Funky Music` or similar — the parser only strips a *recognized prefix followed by a space*, once.

If neither a prefix nor an active "awaiting intent" state applies, and the message isn't a bare number replying to a list, the bot sends a short hint pointing back to `play`/`search` rather than staying silent or guessing what was meant.

## API Contract Reference

The ground truth this bot is built against, traced from a working reference implementation's actual request/response handling.

| Endpoint | Method | Response shape | Notes |
|---|---|---|---|
| `/api/search?query=` | `GET` | Bare JSON array of song objects | Each song: `{ id, name, artist }` |
| `/api/lyrics?artist=&title=` | `GET` | `{ lyrics: "..." }` | No LRC timestamp stripping observed in the reference implementation |
| `/api/download/<songId>` | `GET` | **Raw audio bytes**, not JSON | This endpoint IS the audio stream |

> [!WARNING]
> **`song.id` is the one unverified assumption in this contract.** This bot has never made a live call against the real API from the environment it was built in. If downloads 404, check whether the `id` field search returns is the correct ID for the download endpoint.

## Bot Endpoint Reference

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | Basic status JSON |
| `GET` | `/health` | Uptime JSON |
| `GET` | `/api/status` | Full status: uptime, memory, session count |
| `POST` | `/webhook/<WEBHOOK_SECRET>` | Telegram webhook receiver |
| `GET` | `MINI_APP_PATH` (default `/app`) | Serves the Mini App |
| `GET` | `DOCS_PATH` (default `/docs`) | Serves the public docs page |

## Mini App Endpoint Reference

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/mini/search?q=` | Proxied song search |
| `GET` | `/api/mini/lyrics?artist=&title=` | Proxied lyrics lookup |
| `GET` | `/api/mini/download-url?id=` | Returns the direct audio URL for a track ID |

## Local Development

1. Clone or unzip the project and enter the directory:
   ```bash
   cd music-bot
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the environment template:
   ```bash
   cp .env.example .env
   ```
4. Fill in `BOT_TOKEN`, `BOT_USERNAME`, `WEBHOOK_SECRET`, and `PUBLIC_URL` in `.env`. For local testing, use a tunneling tool (ngrok, Cloudflare Tunnel) to obtain a public HTTPS URL and set it as `PUBLIC_URL`.
5. Start the server:
   ```bash
   npm start
   ```
6. Confirm the webhook registration log line shows your tunnel URL followed by `/webhook/<WEBHOOK_SECRET>`.
7. Message your bot on Telegram — try `/start`, then `play shape of you` with no slash.

> [!TIP]
> Test `play shape of you` and `search shape of you` both. If play downloads but search's tap-to-download fails (or vice versa), that's the `song.id` assumption above — check the raw search response.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `BOT_TOKEN` | Yes | — | Telegram bot token from BotFather |
| `BOT_USERNAME` | No | — | Bot's `@username`, shown in status output |
| `WEBHOOK_SECRET` | Yes | `changeme` | Secret path segment for the webhook URL |
| `PUBLIC_URL` | Yes | — | Publicly reachable HTTPS base URL (no trailing slash) |
| `PORT` | No | `10000` | Port the Express server binds to |
| `MINI_APP_PATH` | No | `/app` | Route path serving the Mini App |
| `DOCS_PATH` | No | `/docs` | Route path serving the public docs page |

## Render Deployment

1. Push this project to a GitHub or GitLab repository.
2. In the Render dashboard, select **New** → **Blueprint**.
3. Connect the repository containing `render.yaml`.
4. Render detects the web service automatically.
5. When prompted, fill in the environment variables marked `sync: false`: `BOT_TOKEN`, `BOT_USERNAME`, `WEBHOOK_SECRET`, `PUBLIC_URL`.
6. Click **Apply** to build and deploy.
7. Once live, check the deploy logs for the line `webhook registered at ...`.
8. Visit `PUBLIC_URL + MINI_APP_PATH` for the Mini App, and `PUBLIC_URL + DOCS_PATH` for the docs page.

> [!WARNING]
> Render's free tier spins down after inactivity. The first message after a period of silence will be slow while the instance wakes up. See [Troubleshooting #5](#troubleshooting).

## Command Reference

| Command | Arguments | No-slash equivalent | Description |
|---|---|---|---|
| `/start` | — | — | Personalized welcome message |
| `/help` | — | — | List all commands |
| `/play` | `<query>` | `play <query>`, `p <query>` | Instantly downloads the best match |
| `/search` | `<query>` | `search <query>`, `find <query>` | Shows a numbered list to pick from |
| `/lyrics` | `<artist> - <title>` | — | Fetch lyrics |
| `/app` | — | — | Open the Mini App |

## Project Layout

```
music-bot/
├── src/
│   ├── index.js
│   ├── bot.js
│   ├── config.js
│   ├── messages.js
│   ├── helpers.js
│   ├── api.js
│   ├── sessions.js
│   ├── routes/
│   │   ├── webhook.js
│   │   ├── mini.js
│   │   ├── status.js
│   │   └── docs.js
│   └── handlers/
│       ├── commands.js
│       ├── callback.js
│       └── messages.js
├── public/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── docs.html
├── package.json
├── .env.example
├── .gitignore
├── Dockerfile
├── render.yaml
├── README.md
└── scripts/
    └── zip.js
```

## Troubleshooting

<details>
<summary><strong>Click to expand — 9 common issues</strong></summary>

**1. Webhook registration fails on startup ("setWebHook failed" in logs)**
Confirm `PUBLIC_URL` is a valid HTTPS URL with no trailing slash, and that the deployed service is actually reachable at that URL before the bot tries to register.

**2. Bot doesn't respond to any messages**
Check that `BOT_TOKEN` is correct and that the webhook path logged on startup matches what's registered with Telegram. Use `https://api.telegram.org/bot<TOKEN>/getWebhookInfo` to inspect the current registration.

**3. Play or search works but tapping a result never sends audio**
Almost certainly the `song.id` assumption in the [API Contract Reference](#api-contract-reference). Log the raw response from `/api/search` and confirm the `id` field it returns is a valid ID for `/api/download/<id>`.

**4. Typing a plain song name always gets the "type play or search" hint, even after using /play once**
This is expected: the "awaiting intent" state only activates when `/play` or `/search` is sent with *no* query. Once a query is given, the bot doesn't assume every future plain message is a new search — otherwise normal chat would constantly get misread as song queries. Use the `play`/`search`/`find`/`p` prefix, or send the bare command again first.

**5. Render free tier service goes to sleep and webhook calls time out**
Free tier instances spin down after inactivity. The first request after a period of inactivity will be slow while the instance wakes up; Telegram will retry, so this typically self-resolves within seconds.

**6. Pagination, delete-list, or the awaiting-intent follow-up stops working after a while**
All of this is stored in memory and resets on server restart or redeploy. On Render's free tier, spun-down instances clear all session state.

**7. Lyrics come back empty for a song that should have them**
Confirm the artist and title are being split correctly on the ` - ` separator. If the song title itself contains a hyphen, the current split logic joins everything after the first dash back into the title.

**8. Sent audio shows a hash-like filename instead of the song title**
This bot downloads the audio into a buffer first and uploads that buffer with an explicit filename built from the track's real name and artist. If this regresses, check that `playTrack` in `src/handlers/commands.js` is still uploading a buffer, not a URL.

**9. The delete-list button doesn't actually remove the message**
The code calls `bot.deleteMessage(chatId, messageId)`, matching the raw Telegram API method name and this library's naming convention for every other method — but this specific method's presence in the pinned `node-telegram-bot-api` version was not independently confirmed. The call is wrapped in a try/catch, so a missing method fails silently rather than crashing the bot; the session's active-list state is still cleared either way, so a stale number-reply won't work even if the message itself lingers visually.

</details>

## Contributing

Issues and pull requests are welcome. Please keep changes scoped, avoid introducing new dependencies without discussion, and test webhook behavior against a real Telegram bot token before submitting.

## License

MIT

---

<div align="center">

Built with Node.js, Express, and the Telegram Bot API.

</div>
