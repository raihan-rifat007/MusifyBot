"use strict";

const path = require("path");
const express = require("express");
const config = require("./config");
const createBot = require("./bot");
const createWebhookRouter = require("./routes/webhook");
const statusRouter = require("./routes/status");
const miniRouter = require("./routes/mini");
const docsRouter = require("./routes/docs");

async function bootstrap() {
  if (!config.botToken) {
    console.error("[musicbot] BOT_TOKEN is not set. Exiting.");
    process.exit(1);
    return;
  }

  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "..", "public")));

  const bot = createBot();

  app.use("/", statusRouter);
  app.use(config.webhookPath.replace(/\/[^/]+$/, ""), createWebhookRouter(bot));
  app.use("/api/mini", miniRouter);
  app.use(config.docsPath, docsRouter);

  app.get(config.miniAppPath, function (req, res) {
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
  });

  app.listen(config.port, "0.0.0.0", function () {
    console.log("[musicbot] server listening on port " + config.port);
  });

  if (config.publicUrl) {
    try {
      const webhookUrl = config.publicUrl + config.webhookPath;
      await bot.setWebHook(webhookUrl, { max_connections: 40, drop_pending_updates: true });
      console.log("[musicbot] webhook registered at " + webhookUrl);
      console.log("[musicbot-mini] mini app available at " + config.publicUrl + config.miniAppPath);
      console.log("[musicbot-docs] docs page available at " + config.publicUrl + config.docsPath);
    } catch (err) {
      console.error("[musicbot] setWebHook failed", err.message);
    }
  } else {
    console.error("[musicbot] PUBLIC_URL is not set. Webhook was not registered.");
  }
}

bootstrap().catch(function (err) {
  console.error("[musicbot] bootstrap failed", err.message);
  process.exit(1);
});
