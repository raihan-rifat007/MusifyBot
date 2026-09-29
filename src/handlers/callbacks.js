"use strict";

const constants = require("../constants");
const messages = require("../copy/messages");
const listing = require("../services/listing");
const playback = require("../services/playback");
const lyricsService = require("../services/lyrics");
const sessions = require("../state/sessions");

async function answerSafely(bot, callbackQueryId, options) {
  try {
    await bot.answerCallbackQuery(callbackQueryId, options);
  } catch (err) {
    console.error("[musicbot] answerCallbackQuery failed", err.message);
  }
}

async function handlePick(bot, query, index) {
  const chatId = query.message.chat.id;
  const activeList = sessions.getActiveList(chatId);
  if (!activeList || !activeList.items[index]) {
    await answerSafely(bot, query.id, { text: messages.invalidNumber() });
    return;
  }
  await answerSafely(bot, query.id);
  await playback.playTrack(bot, chatId, activeList.items[index]);
}

async function handlePage(bot, query, direction) {
  const chatId = query.message.chat.id;
  const activeList = sessions.getActiveList(chatId);
  if (!activeList) {
    await answerSafely(bot, query.id, { text: messages.noActiveList() });
    return;
  }
  const nextPage = direction === "next" ? activeList.page + 1 : activeList.page - 1;
  const rendered = listing.buildListPage(activeList.items, nextPage, activeList.meta);
  if (rendered.page.slice.length === 0) {
    await answerSafely(bot, query.id, { text: "No more results." });
    return;
  }
  await answerSafely(bot, query.id);
  sessions.setActiveList(chatId, { items: activeList.items, page: nextPage, meta: activeList.meta });
  try {
    await bot.editMessageText(rendered.text, {
      chat_id: chatId,
      message_id: query.message.message_id,
      reply_markup: rendered.keyboard
    });
  } catch (err) {
    console.error("[musicbot] page edit failed", err.message);
  }
}

async function handleLyricsButton(bot, query) {
  const chatId = query.message.chat.id;
  const track = sessions.getTrackForMessage(chatId, query.message.message_id) || sessions.getLastTrack(chatId);
  if (!track) {
    await answerSafely(bot, query.id, { text: messages.noActiveTrack() });
    return;
  }
  await answerSafely(bot, query.id);
  try {
    await lyricsService.deliverLyrics(bot, chatId, track.artist, track.name);
  } catch (err) {
    console.error("[musicbot] lyrics button failed", err.message);
    try {
      await bot.sendMessage(chatId, messages.genericError());
    } catch (sendErr) {
      console.error("[musicbot] lyrics button could not report failure", sendErr.message);
    }
  }
}

async function handleDeleteButton(bot, query) {
  const chatId = query.message.chat.id;
  await answerSafely(bot, query.id);
  sessions.clearActiveList(chatId);
  try {
    await bot.deleteMessage(chatId, query.message.message_id);
  } catch (err) {
    console.error("[musicbot] failed to delete list message", err.message);
  }
}

async function handleCallbackQuery(bot, query) {
  try {
    if (!query.message) {
      await answerSafely(bot, query.id);
      return;
    }
    const data = query.data || "";
    const pickIndex = constants.parsePickCallback(data);
    if (pickIndex !== null) {
      await handlePick(bot, query, pickIndex);
      return;
    }
    if (data === constants.CALLBACK.PAGE_NEXT) {
      await handlePage(bot, query, "next");
      return;
    }
    if (data === constants.CALLBACK.PAGE_PREV) {
      await handlePage(bot, query, "prev");
      return;
    }
    if (data === constants.CALLBACK.LYRICS) {
      await handleLyricsButton(bot, query);
      return;
    }
    if (data === constants.CALLBACK.DELETE) {
      await handleDeleteButton(bot, query);
      return;
    }
    await answerSafely(bot, query.id);
  } catch (err) {
    console.error("[musicbot] handleCallbackQuery failed", err.message);
    await answerSafely(bot, query.id, { text: messages.genericError() });
  }
}

module.exports = {
  handleCallbackQuery
};
