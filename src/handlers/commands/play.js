"use strict";

const constants = require("../../constants");
const messages = require("../../copy/messages");
const catalog = require("../../services/catalog");
const playback = require("../../services/playback");
const sessions = require("../../state/sessions");

async function handlePlay(bot, msg, query) {
  const chatId = msg.chat.id;
  try {
    if (!query) {
      sessions.setAwaitingIntent(chatId, constants.INTENT.PLAY);
      await bot.sendMessage(chatId, messages.missingQueryPlain("play"));
      return;
    }
    sessions.setAwaitingIntent(chatId, null);

    const gate = playback.evaluateGate(chatId);
    if (!gate.ok) {
      await playback.denyDownload(bot, chatId, gate);
      return;
    }

    const result = await catalog.searchTracks(query);
    if (!result.ok) {
      await bot.sendMessage(chatId, messages.serviceUnavailable());
      return;
    }
    if (result.items.length === 0) {
      await bot.sendMessage(chatId, messages.noResults(query));
      return;
    }
    await playback.playTrack(bot, chatId, result.items[0]);
  } catch (err) {
    console.error("[musicbot] handlePlay failed", err.message);
    try {
      await bot.sendMessage(chatId, messages.genericError());
    } catch (sendErr) {
      console.error("[musicbot] handlePlay could not report failure", sendErr.message);
    }
  }
}

module.exports = {
  handlePlay
};
