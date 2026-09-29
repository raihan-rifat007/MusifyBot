"use strict";

const CALLBACK = Object.freeze({
  PICK_PREFIX: "pick:",
  PAGE_NEXT: "page:next",
  PAGE_PREV: "page:prev",
  LYRICS: "lyrics",
  DELETE: "delete"
});

const INTENT = Object.freeze({
  PLAY: "play",
  SEARCH: "search",
  RECENT: "recent"
});

const LIST_KIND = Object.freeze({
  SEARCH: "search",
  RECENT: "recent"
});

const LIMITS = Object.freeze({
  PAGE_SIZE: 10,
  RECENT_HISTORY: 10,
  TRACK_MESSAGE_MEMORY: 30,
  COOLDOWN_MS: 3000,
  LOCK_STALE_MS: 120000,
  MAX_CONCURRENT_DOWNLOADS: 3,
  MAX_AUDIO_MB: 20,
  CHAT_ACTION_INTERVAL_MS: 4000,
  SESSION_IDLE_MS: 86400000,
  SESSION_PRUNE_INTERVAL_MS: 3600000,
  SEARCH_CACHE_TTL_MS: 60000,
  SEARCH_CACHE_MAX_ENTRIES: 200,
  MESSAGE_CHUNK_SIZE: 4000,
  INLINE_RESULTS_MAX: 20,
  INLINE_MIN_QUERY_LENGTH: 2,
  INLINE_CACHE_SECONDS: 300,
  INLINE_ERROR_CACHE_SECONDS: 5,
  PROFILE_SHORT_DESCRIPTION_MAX: 120,
  PROFILE_DESCRIPTION_MAX: 512
});

const BOT_COMMANDS = Object.freeze([
  { command: "play", description: "Instantly download the best match" },
  { command: "search", description: "Pick from a list of results" },
  { command: "recent", description: "Replay your recently played tracks" },
  { command: "lyrics", description: "Get lyrics: /lyrics artist - title" },
  { command: "app", description: "Open the mini app" },
  { command: "help", description: "Show all commands" },
  { command: "start", description: "Welcome message" }
]);

const BOT_PROFILE = Object.freeze({
  SHORT_DESCRIPTION: "Play, search and download music in Telegram. Try: play shape of you",
  DESCRIPTION: [
    "Finds songs, sends the audio straight to your chat, and pulls up lyrics.",
    "",
    "Just type a song name, no slash needed:",
    "▶️ play shape of you",
    "🔍 search shape of you",
    "🕘 recent",
    "",
    "Tap Start to begin, or use /help to see every command."
  ].join("\n")
});

function buildPickCallback(index) {
  return CALLBACK.PICK_PREFIX + index;
}

function parsePickCallback(data) {
  if (typeof data !== "string" || data.indexOf(CALLBACK.PICK_PREFIX) !== 0) {
    return null;
  }
  const index = parseInt(data.slice(CALLBACK.PICK_PREFIX.length), 10);
  return Number.isNaN(index) || index < 0 ? null : index;
}

module.exports = {
  CALLBACK,
  INTENT,
  LIST_KIND,
  LIMITS,
  BOT_COMMANDS,
  BOT_PROFILE,
  buildPickCallback,
  parsePickCallback
};
