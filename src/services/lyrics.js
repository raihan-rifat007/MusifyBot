"use strict";

const constants = require("../constants");
const messages = require("../copy/messages");
const musicApi = require("../clients/musicApi");
const format = require("../lib/format");

async function deliverLyrics(bot, chatId, artistName, title) {
  const lyricsText = await musicApi.lyrics(artistName, title);
  if (!lyricsText) {
    await bot.sendMessage(chatId, messages.lyricsNotFound());
    return false;
  }
  const full = messages.lyricsHeader(title, artistName) + "\n\n" + lyricsText;
  const chunks = format.chunkText(full, constants.LIMITS.MESSAGE_CHUNK_SIZE);
  for (let i = 0; i < chunks.length; i++) {
    await bot.sendMessage(chatId, chunks[i]);
  }
  return true;
}

module.exports = {
  deliverLyrics
};
