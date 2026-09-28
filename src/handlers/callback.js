"use strict";

const messages = require("../messages");
const api = require("../api");
const sessions = require("../sessions");
const commands = require("./commands");

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
  await commands.playTrack(bot, chatId, activeList.items[index]);
}

async function handlePage(bot, query, direction) {
  const chatId = query.message.chat.id;
  const activeList = sessions.getActiveList(chatId);
  if (!activeList) {
    await answerSafely(bot, query.id, { text: messages.noActiveList() });
    return;
  }
  const nextPage = direction === "next" ? activeList.page + 1 : activeList.page - 1;
  const rendered = commands.buildListPage(activeList.items, nextPage, activeList.meta);

  if (rendered.page.slice.length === 0) {
    await answerSafely(bot, query.id, { text: "No more results." });
    return;
  }

  await answerSafely(bot, query.id);

  sessions.setActiveList(chatId, {
    items: activeList.items,
    page: nextPage,
    meta: activeList.meta
  });

  try {
    await bot.editMessageText(rendered.text, {
      chat_id: chatId,
      message_id: query.message.message_id,
      reply_markup: rendered.keyboard
    });
  } catch (err) {
    console.error("[musicbot] editMessageText failed", err.message);
  }
}

async function handleLyricsButton(bot, query) {
  const chatId = query.message.chat.id;
  const track = sessions.getLastTrack(chatId);
  if (!track) {
    await answerSafely(bot, query.id, { text: "No active track. Search for a song first." });
    return;
  }
  await answerSafely(bot, query.id);
  try {
    const lyricsText = await api.lyrics(track.artist, track.name);
    if (!lyricsText) {
      await bot.sendMessage(chatId, messages.lyricsNotFound());
      return;
    }
    await bot.sendMessage(chatId, messages.lyricsHeader(track.name, track.artist) + "\n\n" + lyricsText);
  } catch (err) {
    console.error("[musicbot] handleLyricsButton failed", err.message);
    await bot.sendMessage(chatId, messages.genericError());
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
    const data = query.data || "";
    if (data.indexOf("pick:") === 0) {
      const index = parseInt(data.slice(5), 10);
      await handlePick(bot, query, index);
      return;
    }
    if (data === "page:next") {
      await handlePage(bot, query, "next");
      return;
    }
    if (data === "page:prev") {
      await handlePage(bot, query, "prev");
      return;
    }
    if (data === "lyrics") {
      await handleLyricsButton(bot, query);
      return;
    }
    if (data === "delete") {
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
