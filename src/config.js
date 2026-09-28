"use strict";

const config = {
  botToken: process.env.BOT_TOKEN || "",
  botUsername: process.env.BOT_USERNAME || "",
  webhookSecret: process.env.WEBHOOK_SECRET || "changeme",
  publicUrl: (process.env.PUBLIC_URL || "").replace(/\/+$/, ""),
  port: parseInt(process.env.PORT, 10) || 10000,
  miniAppPath: process.env.MINI_APP_PATH || "/app",
  docsPath: process.env.DOCS_PATH || "/docs",
  apiBase: "https://raihan07-musicapi.vercel.app",
  pageSize: 10,
  maxAudioBytes: 20 * 1024 * 1024,
  startTime: Date.now()
};

config.webhookPath = "/webhook/" + config.webhookSecret;

module.exports = config;
