"use strict";

const TelegramBot = require("node-telegram-bot-api");
const config = require("./config");
const commands = require("./handlers/commands");
const callbacks = require("./handlers/callbacks");
const plainText = require("./handlers/plainText");
const inline = require("./handlers/inline");

function guard(handler) {
  return function () {
    const args = arguments;
    Promise.resolve()
      .then(function () {
        return handler.apply(null, args);
      })
      .catch(function (err) {
        console.error("[musicbot] handler crashed", err.message);
      });
  };
}

function queryFrom(match) {
  return match && match[1] ? match[1].trim() : "";
}

function createBot() {
  const bot = new TelegramBot(config.botToken, { webHook: false });

  bot.onText(/^\/start(?:@\S+)?(?:\s|$)/, guard(function (msg) {
    return commands.handleStart(bot, msg);
  }));

  bot.onText(/^\/help(?:@\S+)?(?:\s|$)/, guard(function (msg) {
    return commands.handleHelp(bot, msg);
  }));

  bot.onText(/^\/play(?:@\S+)?(?:\s+([\s\S]+))?$/, guard(function (msg, match) {
    return commands.handlePlay(bot, msg, queryFrom(match));
  }));

  bot.onText(/^\/search(?:@\S+)?(?:\s+([\s\S]+))?$/, guard(function (msg, match) {
    return commands.handleSearch(bot, msg, queryFrom(match));
  }));

  bot.onText(/^\/recent(?:@\S+)?\s*$/, guard(function (msg) {
    return commands.handleRecent(bot, msg);
  }));

  bot.onText(/^\/lyrics(?:@\S+)?(?:\s+([\s\S]+))?$/, guard(function (msg, match) {
    return commands.handleLyrics(bot, msg, queryFrom(match));
  }));

  bot.onText(/^\/app(?:@\S+)?(?:\s|$)/, guard(function (msg) {
    return commands.handleApp(bot, msg);
  }));

  bot.on("message", guard(function (msg) {
    if (typeof msg.text !== "string" || msg.text.indexOf("/") === 0) {
      return undefined;
    }
    return plainText.handlePlainMessage(bot, msg);
  }));

  bot.on("callback_query", guard(function (query) {
    return callbacks.handleCallbackQuery(bot, query);
  }));

  bot.on("inline_query", guard(function (query) {
    return inline.handleInlineQuery(bot, query);
  }));

  bot.on("webhook_error", function (err) {
    console.error("[musicbot] webhook_error", err.message);
  });

  return bot;
}

module.exports = createBot;
