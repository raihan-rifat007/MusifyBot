"use strict";

const config = require("../../config");
const messages = require("../../copy/messages");
const sessions = require("../../state/sessions");
const users = require("../../state/users");
const adminMessages = require("../../copy/adminMessages");

async function handleStart(bot, msg) {
  try {
    sessions.setAwaitingIntent(msg.chat.id, null);
    const shareMatch = /^\/start(?:@\S+)?\s+s_([a-f0-9]{10})\s*$/.exec(typeof msg.text === "string" ? msg.text : "");
    if (shareMatch && config.publicUrl) {
      const share = users.getShare(shareMatch[1]);
      if (share) {
        await bot.sendMessage(msg.chat.id, adminMessages.sharedOpen(share.name, share.items.length), {
          reply_markup: {
            inline_keyboard: [[{ text: "Mini app e kholo", web_app: { url: config.publicUrl + config.miniAppPath + "?share=" + shareMatch[1] } }]]
          }
        });
        return;
      }
    }
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
