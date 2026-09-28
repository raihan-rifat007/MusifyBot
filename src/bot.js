"use strict";

const TelegramBot = require("node-telegram-bot-api");
const config = require("./config");
const commandHandlers = require("./handlers/commands");
const callbackHandlers = require("./handlers/callback");
const messageHandlers = require("./handlers/messages");

function createBot() {
  const bot = new TelegramBot(config.botToken, { webHook: false });

  bot.onText(/^\/start/, function (msg) {
    commandHandlers.handleStart(bot, msg);
  });

  bot.onText(/^\/help/, function (msg) {
    commandHandlers.handleHelp(bot, msg);
  });

  bot.onText(/^\/play(?:@\S+)?(?:\s+([\s\S]+))?$/, function (msg, match) {
    const query = match && match[1] ? match[1].trim() : "";
    commandHandlers.handlePlay(bot, msg, query);
  });

  bot.onText(/^\/search(?:@\S+)?(?:\s+([\s\S]+))?$/, function (msg, match) {
    const query = match && match[1] ? match[1].trim() : "";
    commandHandlers.handleSearch(bot, msg, query);
  });

  bot.onText(/^\/lyrics(?:@\S+)?(?:\s+([\s\S]+))?$/, function (msg, match) {
    const query = match && match[1] ? match[1].trim() : "";
    commandHandlers.handleLyrics(bot, msg, query);
  });

  bot.onText(/^\/app/, function (msg) {
    commandHandlers.handleApp(bot, msg);
  });

  bot.on("callback_query", function (query) {
    callbackHandlers.handleCallbackQuery(bot, query);
  });

  bot.on("message", function (msg) {
    if (!msg.text || msg.text.indexOf("/") === 0) {
      return;
    }
    messageHandlers.handlePlainMessage(bot, msg);
  });

  bot.on("polling_error", function (err) {
    console.error("[musicbot] polling_error", err.message);
  });

  bot.on("webhook_error", function (err) {
    console.error("[musicbot] webhook_error", err.message);
  });

  return bot;
}

module.exports = createBot;
