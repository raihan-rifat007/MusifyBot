"use strict";

const messages = require("../messages");
const helpers = require("../helpers");
const sessions = require("../sessions");
const commands = require("./commands");
const config = require("../config");

function isBareNumber(text) {
  return /^\s*\d+\s*$/.test(text);
}

async function handlePlainMessage(bot, msg) {
  const chatId = msg.chat.id;
  const text = msg.text || "";

  try {
    if (isBareNumber(text)) {
      const activeList = sessions.getActiveList(chatId);
      if (!activeList) {
        await bot.sendMessage(chatId, messages.noActiveList());
        return;
      }

      const number = parseInt(text.trim(), 10);
      const pageStart = activeList.page * config.pageSize;
      const localIndex = number - 1;

      if (localIndex < pageStart || localIndex >= pageStart + config.pageSize || !activeList.items[localIndex]) {
        await bot.sendMessage(chatId, messages.invalidNumber());
        return;
      }

      await commands.playTrack(bot, chatId, activeList.items[localIndex]);
      return;
    }

    const parsed = helpers.parsePlainCommand(text);
    if (parsed) {
      sessions.setAwaitingIntent(chatId, null);
      if (parsed.intent === "play") {
        await commands.handlePlay(bot, msg, parsed.query);
      } else {
        await commands.handleSearch(bot, msg, parsed.query);
      }
      return;
    }

    const pendingIntent = sessions.getAwaitingIntent(chatId);
    if (pendingIntent) {
      sessions.setAwaitingIntent(chatId, null);
      if (pendingIntent === "play") {
        await commands.handlePlay(bot, msg, text.trim());
      } else {
        await commands.handleSearch(bot, msg, text.trim());
      }
      return;
    }

    await bot.sendMessage(chatId, messages.noPrefixHint());
  } catch (err) {
    console.error("[musicbot] handlePlainMessage failed", err.message);
    await bot.sendMessage(chatId, messages.genericError());
  }
}

module.exports = {
  handlePlainMessage
};
