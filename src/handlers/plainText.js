"use strict";

const constants = require("../constants");
const messages = require("../copy/messages");
const commandParser = require("../lib/commandParser");
const listing = require("../services/listing");
const playback = require("../services/playback");
const sessions = require("../state/sessions");
const commands = require("./commands");

function isPrivateChat(msg) {
  return !msg.chat.type || msg.chat.type === "private";
}

async function replyIfPrivate(bot, msg, text) {
  if (isPrivateChat(msg)) {
    await bot.sendMessage(msg.chat.id, text);
  }
}

async function handleNumberReply(bot, msg, text) {
  const chatId = msg.chat.id;
  const activeList = sessions.getActiveList(chatId);
  if (!activeList) {
    await replyIfPrivate(bot, msg, messages.noActiveList());
    return;
  }
  const item = listing.itemForNumber(activeList, parseInt(text.trim(), 10));
  if (!item) {
    await replyIfPrivate(bot, msg, messages.invalidNumber());
    return;
  }
  await playback.playTrack(bot, chatId, item);
}

async function runIntent(bot, msg, intent, query) {
  if (intent === constants.INTENT.PLAY) {
    await commands.handlePlay(bot, msg, query);
    return;
  }
  await commands.handleSearch(bot, msg, query);
}

async function handlePlainMessage(bot, msg) {
  const chatId = msg.chat.id;
  const text = typeof msg.text === "string" ? msg.text : "";

  try {
    if (commandParser.isBareNumber(text)) {
      await handleNumberReply(bot, msg, text);
      return;
    }

    const parsed = commandParser.parsePlainCommand(text);
    if (parsed) {
      sessions.setAwaitingIntent(chatId, null);
      if (parsed.corrected) {
        await bot.sendMessage(chatId, messages.typoNotice(parsed.word));
      }
      await runIntent(bot, msg, parsed.intent, parsed.query);
      return;
    }

    if (commandParser.parseBareCommand(text) === constants.INTENT.RECENT) {
      await commands.handleRecent(bot, msg);
      return;
    }

    const pendingIntent = sessions.getAwaitingIntent(chatId);
    if (pendingIntent) {
      sessions.setAwaitingIntent(chatId, null);
      await runIntent(bot, msg, pendingIntent, text.trim());
      return;
    }

    await replyIfPrivate(bot, msg, messages.noPrefixHint());
  } catch (err) {
    console.error("[musicbot] handlePlainMessage failed", err.message);
  }
}

module.exports = {
  handlePlainMessage,
  isPrivateChat
};
