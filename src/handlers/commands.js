"use strict";

const config = require("../config");
const messages = require("../messages");
const helpers = require("../helpers");
const api = require("../api");
const sessions = require("../sessions");

function buildListKeyboard(pageItems, startIndex, hasNext, hasPrev) {
  const rows = pageItems.map(function (item, i) {
    const label = String(startIndex + i) + ". " + helpers.pickName(item) + " — " + helpers.pickArtist(item);
    return [{ text: helpers.truncate(label, 60), callback_data: "pick:" + (startIndex + i - 1) }];
  });
  const navRow = [];
  if (hasPrev) {
    navRow.push({ text: "◀ Previous", callback_data: "page:prev" });
  }
  if (hasNext) {
    navRow.push({ text: "Next ▶", callback_data: "page:next" });
  }
  if (navRow.length > 0) {
    rows.push(navRow);
  }
  rows.push([{ text: "🗑 Delete list", callback_data: "delete" }]);
  return { inline_keyboard: rows };
}

function buildListPage(allItems, pageIndex, meta) {
  const page = helpers.paginate(allItems, pageIndex, config.pageSize);
  return {
    text: messages.searchHeader(meta.query, page.start, page.end, page.total),
    keyboard: buildListKeyboard(page.slice, page.start, page.hasNext, page.hasPrev),
    page: page
  };
}

function startChatActionLoop(bot, chatId) {
  const fire = function () {
    bot.sendChatAction(chatId, "upload_audio").catch(function (err) {
      console.error("[musicbot] sendChatAction failed", err.message);
    });
  };
  fire();
  const intervalId = setInterval(fire, 4000);
  return function stop() {
    clearInterval(intervalId);
  };
}

async function playTrack(bot, chatId, item) {
  const name = helpers.pickName(item);
  const artistName = helpers.pickArtist(item);
  const songId = helpers.pickId(item);

  sessions.setLastTrack(chatId, { name: name, artist: artistName, id: songId });

  if (!songId) {
    await bot.sendMessage(chatId, messages.audioUnavailable(name));
    return;
  }

  const stopChatAction = startChatActionLoop(bot, chatId);

  let downloaded;
  try {
    downloaded = await api.downloadAudioBuffer(songId);
  } finally {
    stopChatAction();
  }

  if (!downloaded) {
    await bot.sendMessage(chatId, messages.downloadFailed(name));
    return;
  }

  const filename = helpers.buildTrackFilename(name, artistName);
  const actionKeyboard = {
    inline_keyboard: [[{ text: "Lyrics", callback_data: "lyrics" }]]
  };

  try {
    await bot.sendAudio(
      chatId,
      downloaded.buffer,
      {
        title: name,
        performer: artistName,
        caption: messages.audioCaption(name, artistName),
        reply_markup: actionKeyboard
      },
      {
        filename: filename,
        contentType: downloaded.contentType
      }
    );
  } catch (err) {
    console.error("[musicbot] sendAudio failed", err.message);
    await bot.sendMessage(chatId, messages.audioCaption(name, artistName) + "\n\n" + api.buildDownloadUrl(songId));
  }
}

async function handleStart(bot, msg) {
  try {
    sessions.setAwaitingSearch(msg.chat.id, false);
    const firstName = msg.from && msg.from.first_name ? msg.from.first_name : null;
    await bot.sendMessage(msg.chat.id, messages.welcome(firstName));
  } catch (err) {
    console.error("[musicbot] handleStart failed", err.message);
  }
}

async function handleHelp(bot, msg) {
  try {
    await bot.sendMessage(msg.chat.id, messages.help());
  } catch (err) {
    console.error("[musicbot] handleHelp failed", err.message);
  }
}

async function handlePlay(bot, msg, query) {
  const chatId = msg.chat.id;
  if (!query) {
    sessions.setAwaitingIntent(chatId, "play");
    await bot.sendMessage(chatId, messages.missingQueryPlain("play"));
    return;
  }
  sessions.setAwaitingIntent(chatId, null);
  try {
    const results = await api.search(query);
    if (results.length === 0) {
      await bot.sendMessage(chatId, messages.noResults(query));
      return;
    }
    await playTrack(bot, chatId, results[0]);
  } catch (err) {
    console.error("[musicbot] handlePlay failed", err.message);
    await bot.sendMessage(chatId, messages.genericError());
  }
}

async function handleSearch(bot, msg, query) {
  const chatId = msg.chat.id;
  if (!query) {
    sessions.setAwaitingIntent(chatId, "search");
    await bot.sendMessage(chatId, messages.missingQueryPlain("search"));
    return;
  }
  sessions.setAwaitingIntent(chatId, null);

  let searchingMsg;
  try {
    searchingMsg = await bot.sendMessage(chatId, messages.searching(query));
  } catch (err) {
    console.error("[musicbot] failed to send searching message", err.message);
    return;
  }

  try {
    const results = await api.search(query);

    if (results.length === 0) {
      await bot.editMessageText(messages.noResults(query), {
        chat_id: chatId,
        message_id: searchingMsg.message_id
      });
      return;
    }

    const meta = { query: query };
    const rendered = buildListPage(results, 0, meta);

    sessions.setActiveList(chatId, {
      items: results,
      page: 0,
      meta: meta
    });

    await bot.editMessageText(rendered.text, {
      chat_id: chatId,
      message_id: searchingMsg.message_id,
      reply_markup: rendered.keyboard
    });
  } catch (err) {
    console.error("[musicbot] handleSearch failed", err.message);
    try {
      await bot.editMessageText(messages.genericError(), {
        chat_id: chatId,
        message_id: searchingMsg.message_id
      });
    } catch (editErr) {
      console.error("[musicbot] failed to edit in error state", editErr.message);
    }
  }
}

async function handleLyrics(bot, msg, rawQuery) {
  const chatId = msg.chat.id;
  try {
    if (!rawQuery || rawQuery.indexOf(" - ") === -1) {
      await bot.sendMessage(chatId, messages.lyricsFormatHint());
      return;
    }
    const parts = rawQuery.split(/\s*-\s*/);
    const artistName = parts[0];
    const title = parts.slice(1).join(" - ");
    const lyricsText = await api.lyrics(artistName, title);
    if (!lyricsText) {
      await bot.sendMessage(chatId, messages.lyricsNotFound());
      return;
    }
    await bot.sendMessage(chatId, messages.lyricsHeader(title, artistName) + "\n\n" + lyricsText);
  } catch (err) {
    console.error("[musicbot] handleLyrics failed", err.message);
    await bot.sendMessage(chatId, messages.genericError());
  }
}

async function handleApp(bot, msg) {
  const chatId = msg.chat.id;
  try {
    if (!config.publicUrl) {
      await bot.sendMessage(chatId, messages.appUnavailable());
      return;
    }
    const appUrl = config.publicUrl + config.miniAppPath;
    await bot.sendMessage(chatId, messages.openingApp(), {
      reply_markup: {
        inline_keyboard: [[{ text: "Open App", web_app: { url: appUrl } }]]
      }
    });
  } catch (err) {
    console.error("[musicbot] handleApp failed", err.message);
    await bot.sendMessage(chatId, messages.genericError());
  }
}

module.exports = {
  handleStart,
  handleHelp,
  handlePlay,
  handleSearch,
  handleLyrics,
  handleApp,
  playTrack,
  buildListPage
};
