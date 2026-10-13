"use strict";

const constants = require("../../constants");
const messages = require("../../copy/messages");
const catalog = require("../../services/catalog");
const listing = require("../../services/listing");
const sessions = require("../../state/sessions");

async function editSafely(bot, chatId, messageId, text) {
  try {
    await bot.editMessageText(text, { chat_id: chatId, message_id: messageId });
  } catch (err) {
    console.error("[musicbot] failed to edit search message", err.message);
  }
}

async function handleSearch(bot, msg, query) {
  const chatId = msg.chat.id;
  if (!query) {
    sessions.setAwaitingIntent(chatId, constants.INTENT.SEARCH);
    try {
      await bot.sendMessage(chatId, messages.missingQueryPlain("search"));
    } catch (err) {
      console.error("[musicbot] handleSearch prompt failed", err.message);
    }
    return;
  }
  sessions.setAwaitingIntent(chatId, null);

  let searchingMessage;
  try {
    searchingMessage = await bot.sendMessage(chatId, messages.searching(query));
  } catch (err) {
    console.error("[musicbot] failed to send searching message", err.message);
    return;
  }

  try {
    const result = await catalog.searchTracks(query);
    if (!result.ok) {
      await editSafely(bot, chatId, searchingMessage.message_id, messages.serviceUnavailable());
      return;
    }
    if (result.items.length === 0) {
      await editSafely(bot, chatId, searchingMessage.message_id, messages.noResults(query));
      return;
    }
    await listing.presentList(bot, chatId, result.items, { kind: constants.LIST_KIND.SEARCH, query: query }, searchingMessage.message_id);
  } catch (err) {
    console.error("[musicbot] handleSearch failed", err.message);
    await editSafely(bot, chatId, searchingMessage.message_id, messages.genericError());
  }
}

module.exports = {
  handleSearch
};
