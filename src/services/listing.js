"use strict";

const config = require("../config");
const constants = require("../constants");
const messages = require("../copy/messages");
const format = require("../lib/format");
const trackLib = require("../lib/track");
const sessions = require("../state/sessions");

function buildKeyboard(pageItems, startIndex, hasNext, hasPrev) {
  const rows = pageItems.map(function (item, i) {
    const label = String(startIndex + i) + ". " + trackLib.pickName(item) + " — " + trackLib.pickArtist(item);
    return [{ text: format.truncate(label, 60), callback_data: constants.buildPickCallback(startIndex + i - 1) }];
  });
  const navRow = [];
  if (hasPrev) {
    navRow.push({ text: "◀ Previous", callback_data: constants.CALLBACK.PAGE_PREV });
  }
  if (hasNext) {
    navRow.push({ text: "Next ▶", callback_data: constants.CALLBACK.PAGE_NEXT });
  }
  if (navRow.length > 0) {
    rows.push(navRow);
  }
  rows.push([{ text: "🗑 Delete list", callback_data: constants.CALLBACK.DELETE }]);
  return { inline_keyboard: rows };
}

function buildHeader(meta, page) {
  if (meta && meta.kind === constants.LIST_KIND.RECENT) {
    return messages.recentHeader(page.start, page.end, page.total);
  }
  return messages.searchHeader(meta.query, page.start, page.end, page.total);
}

function buildListPage(items, pageIndex, meta) {
  const page = format.paginate(items, pageIndex, config.pageSize);
  return {
    text: buildHeader(meta, page),
    keyboard: buildKeyboard(page.slice, page.start, page.hasNext, page.hasPrev),
    page: page
  };
}

async function presentList(bot, chatId, items, meta, existingMessageId) {
  const rendered = buildListPage(items, 0, meta);
  sessions.setActiveList(chatId, { items: items, page: 0, meta: meta });
  if (existingMessageId) {
    return bot.editMessageText(rendered.text, {
      chat_id: chatId,
      message_id: existingMessageId,
      reply_markup: rendered.keyboard
    });
  }
  return bot.sendMessage(chatId, rendered.text, { reply_markup: rendered.keyboard });
}

function itemForNumber(activeList, number) {
  const pageStart = activeList.page * config.pageSize;
  const index = number - 1;
  if (index < pageStart || index >= pageStart + config.pageSize) {
    return null;
  }
  return activeList.items[index] || null;
}

module.exports = {
  buildListPage,
  presentList,
  itemForNumber
};
