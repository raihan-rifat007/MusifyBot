"use strict";

const constants = require("./constants");

function readInt(name, fallback) {
  const parsed = parseInt(process.env[name], 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function readBool(name, fallback) {
  const raw = process.env[name];
  if (typeof raw !== "string" || raw.length === 0) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].indexOf(raw.toLowerCase()) !== -1;
}

function trimTrailingSlashes(value) {
  return value.replace(/\/+$/, "");
}

function readPath(name, fallback) {
  const raw = process.env[name];
  if (typeof raw !== "string" || !/^\/[A-Za-z0-9_-][A-Za-z0-9/_-]*$/.test(raw)) {
    return fallback;
  }
  return trimTrailingSlashes(raw);
}

const config = {
  botToken: process.env.BOT_TOKEN || "",
  botUsername: (process.env.BOT_USERNAME || "").replace(/^@/, ""),
  webhookSecret: process.env.WEBHOOK_SECRET || "changeme",
  publicUrl: trimTrailingSlashes(process.env.PUBLIC_URL || ""),
  port: readInt("PORT", 10000),
  miniAppPath: readPath("MINI_APP_PATH", "/app"),
  docsPath: readPath("DOCS_PATH", "/docs"),
  apiBase: trimTrailingSlashes(process.env.MUSIC_API_BASE || "https://musicapi-by-raihan.vercel.app"),
  pageSize: constants.LIMITS.PAGE_SIZE,
  cooldownMs: Math.max(0, readInt("COOLDOWN_MS", constants.LIMITS.COOLDOWN_MS)),
  maxConcurrentDownloads: Math.max(1, readInt("MAX_CONCURRENT_DOWNLOADS", constants.LIMITS.MAX_CONCURRENT_DOWNLOADS)),
  maxAudioBytes: Math.max(1, readInt("MAX_AUDIO_MB", constants.LIMITS.MAX_AUDIO_MB)) * 1048576,
  syncBotProfile: readBool("SYNC_BOT_PROFILE", true),
  webhookPrefix: "/webhook",
  startTime: Date.now()
};

config.webhookPath = config.webhookPrefix + "/" + config.webhookSecret;

module.exports = config;
