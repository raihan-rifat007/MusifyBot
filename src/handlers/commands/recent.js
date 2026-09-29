"use strict";

const constants = require("../../constants");
const messages = require("../../copy/messages");
const listing = require("../../services/listing");
const sessions = require("../../state/sessions");

async function handleRecent(bot, msg) {
  const chatId = msg.chat.id;
  try {
    const recent = sessions.getRecent(chatId);
    if (recent.length === 0) {
      await bot.sendMessage(chatId, messages.recentEmpty());
      return;
    }
    await listing.presentList(bot, chatId, recent, { kind: constants.LIST_KIND.RECENT });
  } catch (err) {
    console.error("[musicbot] handleRecent failed", err.message);
  }
}

module.exports = {
  handleRecent
};
