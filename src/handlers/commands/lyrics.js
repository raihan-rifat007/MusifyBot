"use strict";

const messages = require("../../copy/messages");
const commandParser = require("../../lib/commandParser");
const lyricsService = require("../../services/lyrics");

async function handleLyrics(bot, msg, rawQuery) {
  const chatId = msg.chat.id;
  try {
    const parsed = commandParser.parseLyricsQuery(rawQuery);
    if (!parsed) {
      await bot.sendMessage(chatId, messages.lyricsFormatHint());
      return;
    }
    await lyricsService.deliverLyrics(bot, chatId, parsed.artist, parsed.title);
  } catch (err) {
    console.error("[musicbot] handleLyrics failed", err.message);
    try {
      await bot.sendMessage(chatId, messages.genericError());
    } catch (sendErr) {
      console.error("[musicbot] handleLyrics could not report failure", sendErr.message);
    }
  }
}

module.exports = {
  handleLyrics
};
