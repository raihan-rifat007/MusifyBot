"use strict";

const config = require("../../config");
const messages = require("../../copy/messages");
const sessions = require("../../state/sessions");

async function handleStart(bot, msg) {
  try {
    sessions.setAwaitingIntent(msg.chat.id, null);
    const firstName = msg.from && msg.from.first_name ? msg.from.first_name : null;
    await bot.sendMessage(msg.chat.id, messages.welcome(firstName));
  } catch (err) {
    console.error("[musicbot] handleStart failed", err.message);
  }
}

async function handleHelp(bot, msg) {
  try {
    await bot.sendMessage(msg.chat.id, messages.help(config.botUsername));
  } catch (err) {
    console.error("[musicbot] handleHelp failed", err.message);
  }
}

async function handleApp(bot, msg) {
  const chatId = msg.chat.id;
  try {
    if (!config.publicUrl) {
      await bot.sendMessage(chatId, messages.appUnavailable());
      return;
    }
    await bot.sendMessage(chatId, messages.openingApp(), {
      reply_markup: {
        inline_keyboard: [[{ text: "Open App", web_app: { url: config.publicUrl + config.miniAppPath } }]]
      }
    });
  } catch (err) {
    console.error("[musicbot] handleApp failed", err.message);
  }
}

module.exports = {
  handleStart,
  handleHelp,
  handleApp
};
