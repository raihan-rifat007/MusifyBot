"use strict";

const config = require("./config");
const constants = require("./constants");
const createBot = require("./bot");
const createApp = require("./app");
const path = require("path");
const sessions = require("./state/sessions");
const users = require("./state/users");
const admin = require("./handlers/commands/admin");

async function registerWebhook(bot) {
  if (!config.publicUrl) {
    console.error("[musicbot] PUBLIC_URL is not set. Webhook was not registered.");
    return;
  }
  try {
    const webhookUrl = config.publicUrl + config.webhookPath;
    await bot.setWebHook(webhookUrl, { max_connections: 40, drop_pending_updates: true });
    console.log("[musicbot] webhook registered at " + webhookUrl);
    console.log("[musicbot-mini] mini app available at " + config.publicUrl + config.miniAppPath);
    console.log("[musicbot-docs] docs page available at " + config.publicUrl + config.docsPath);
  } catch (err) {
    console.error("[musicbot] setWebHook failed", err.message);
  }
}

async function syncBotProfile(bot) {
  if (!config.syncBotProfile) {
    return;
  }
  const tasks = [
    { label: "command menu", method: "setMyCommands", args: [constants.BOT_COMMANDS] },
    { label: "short description", method: "setMyShortDescription", args: [{ short_description: constants.BOT_PROFILE.SHORT_DESCRIPTION }] },
    { label: "description", method: "setMyDescription", args: [{ description: constants.BOT_PROFILE.DESCRIPTION }] }
  ];
  for (let i = 0; i < config.adminIds.length; i++) {
    if (typeof bot.setMyCommands !== "function") {
      break;
    }
    try {
      await bot.setMyCommands(constants.BOT_COMMANDS.concat(constants.ADMIN_COMMANDS), { scope: { type: "chat", chat_id: config.adminIds[i] } });
    } catch (err) {
      console.error("[musicbot] could not set admin commands", err.message);
    }
  }
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (typeof bot[task.method] !== "function") {
      console.error("[musicbot] " + task.method + " is not available in this library version, skipping " + task.label);
      continue;
    }
    try {
      await bot[task.method].apply(bot, task.args);
      console.log("[musicbot] synced " + task.label);
    } catch (err) {
      console.error("[musicbot] could not sync " + task.label, err.message);
    }
  }
}

function installShutdown(server) {
  const shutdown = function (signal) {
    console.log("[musicbot] " + signal + " received, shutting down");
    sessions.stopPruner();
    users.flush();
    const forceExit = setTimeout(function () {
      process.exit(1);
    }, 10000);
    forceExit.unref();
    server.close(function () {
      process.exit(0);
    });
  };
  process.on("SIGTERM", function () {
    shutdown("SIGTERM");
  });
  process.on("SIGINT", function () {
    shutdown("SIGINT");
  });
}

function startAutoBackup(bot) {
  if (config.adminIds.length === 0 || config.autoBackupHours <= 0) {
    return;
  }
  const timer = setInterval(function () {
    if (users.userCount() === 0) {
      return;
    }
    users.flush();
    admin.sendBackup(bot, config.adminIds[0]).catch(function (err) {
      console.error("[musicbot] auto backup failed", err.message);
    });
  }, config.autoBackupHours * 3600000);
  timer.unref();
}

async function bootstrap() {
  if (!config.botToken) {
    console.error("[musicbot] BOT_TOKEN is not set. Exiting.");
    process.exit(1);
    return;
  }

  process.on("unhandledRejection", function (reason) {
    console.error("[musicbot] unhandled rejection", reason && reason.message ? reason.message : reason);
  });

  users.init(path.join(config.dataDir, "musify-data.json"));
  console.log("[musicbot] user store ready, " + users.userCount() + " users loaded");

  const bot = createBot();
  const app = createApp(bot);
  startAutoBackup(bot);
  sessions.startPruner();

  const server = app.listen(config.port, "0.0.0.0", function () {
    console.log("[musicbot] server listening on port " + config.port);
  });
  installShutdown(server);

  await registerWebhook(bot);
  await syncBotProfile(bot);
}

bootstrap().catch(function (err) {
  console.error("[musicbot] bootstrap failed", err.message);
  process.exit(1);
});
