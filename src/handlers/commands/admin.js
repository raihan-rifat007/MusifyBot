"use strict";

const crypto = require("crypto");
const axios = require("axios");
const config = require("../../config");
const format = require("../../lib/format");
const users = require("../../state/users");
const broadcast = require("../../services/broadcast");
const streamCache = require("../../services/streamCache");
const musicApi = require("../../clients/musicApi");
const msgs = require("../../copy/adminMessages");

const PENDING_TTL_MS = 10 * 60 * 1000;
const MAX_TEXT = 4000;
const MAX_BACKUP_BYTES = 5 * 1048576;

const pending = new Map();
let active = null;

function isAdmin(userId) {
  return typeof userId === "number" && config.adminIds.indexOf(userId) !== -1;
}

async function safe(label, task) {
  try {
    return await task();
  } catch (err) {
    console.error("[musicbot] " + label + " failed", err.message);
    return null;
  }
}

function pruneExpired(now) {
  pending.forEach(function (entry, adminId) {
    if (now - entry.createdAt > PENDING_TTL_MS) {
      pending.delete(adminId);
    }
  });
}

async function handleBroadcast(bot, msg, text) {
  const chatId = msg.chat.id;
  const fromId = msg.from ? msg.from.id : 0;
  if (!isAdmin(fromId)) {
    await safe("broadcast deny", function () { return bot.sendMessage(chatId, msgs.notAdmin()); });
    return;
  }
  if (active) {
    await safe("broadcast busy", function () { return bot.sendMessage(chatId, msgs.broadcastBusy()); });
    return;
  }

  let payload = null;
  if (msg.reply_to_message && typeof bot.copyMessage === "function") {
    payload = { kind: "copy", fromChatId: chatId, messageId: msg.reply_to_message.message_id };
  } else if (text) {
    payload = { kind: "text", text: text.slice(0, MAX_TEXT) };
  }
  if (!payload) {
    await safe("broadcast usage", function () { return bot.sendMessage(chatId, msgs.broadcastUsage()); });
    return;
  }

  const total = users.listRecipientIds().length;
  if (total === 0) {
    await safe("broadcast empty", function () { return bot.sendMessage(chatId, msgs.noRecipients()); });
    return;
  }

  const now = Date.now();
  pruneExpired(now);
  const token = crypto.randomBytes(4).toString("hex");
  pending.set(fromId, { token: token, payload: payload, createdAt: now });

  if (payload.kind === "copy") {
    await safe("broadcast preview", function () { return bot.copyMessage(chatId, payload.fromChatId, payload.messageId); });
  } else {
    await safe("broadcast preview", function () { return bot.sendMessage(chatId, payload.text, { disable_web_page_preview: true }); });
  }

  await safe("broadcast confirm", function () {
    return bot.sendMessage(chatId, msgs.broadcastConfirm(total), {
      reply_markup: {
        inline_keyboard: [[
          { text: "Pathao (" + total + " jon)", callback_data: "bc:go:" + token },
          { text: "Batil", callback_data: "bc:no:" + token }
        ]]
      }
    });
  });
}

async function answer(bot, query, text) {
  await safe("answerCallbackQuery", function () {
    return bot.answerCallbackQuery(query.id, text ? { text: text } : undefined);
  });
}

async function editMessage(bot, query, text, keyboard) {
  await safe("edit broadcast message", function () {
    const options = { chat_id: query.message.chat.id, message_id: query.message.message_id };
    if (keyboard) {
      options.reply_markup = keyboard;
    }
    return bot.editMessageText(text, options);
  });
}

async function handleBroadcastCallback(bot, query) {
  const parts = String(query.data || "").split(":");
  const action = parts[1];
  const token = parts[2];
  const adminId = query.from ? query.from.id : 0;

  if (!isAdmin(adminId)) {
    await answer(bot, query, msgs.notAdmin());
    return;
  }

  if (action === "stop") {
    if (active && active.token === token) {
      active.control.cancelled = true;
      await answer(bot, query, "Bondho korchi...");
    } else {
      await answer(bot, query);
    }
    return;
  }

  const entry = pending.get(adminId);
  if (!entry || entry.token !== token || Date.now() - entry.createdAt > PENDING_TTL_MS) {
    pending.delete(adminId);
    await answer(bot, query, msgs.broadcastExpired());
    await editMessage(bot, query, msgs.broadcastExpired());
    return;
  }

  if (action === "no") {
    pending.delete(adminId);
    await answer(bot, query);
    await editMessage(bot, query, msgs.broadcastCancelled());
    return;
  }

  if (action !== "go") {
    await answer(bot, query);
    return;
  }

  if (active) {
    await answer(bot, query, msgs.broadcastBusy());
    return;
  }

  pending.delete(adminId);
  await answer(bot, query);

  const recipients = users.listRecipientIds();
  const control = { cancelled: false };
  active = { token: token, control: control };
  const stopKeyboard = { inline_keyboard: [[{ text: "Stop", callback_data: "bc:stop:" + token }]] };

  try {
    await editMessage(bot, query, msgs.broadcastStarted(0, recipients.length), stopKeyboard);
    const result = await broadcast.run(bot, recipients, entry.payload, {
      control: control,
      onProgress: function (done) {
        return editMessage(bot, query, msgs.broadcastStarted(done, recipients.length), stopKeyboard);
      }
    });
    users.flush();
    await editMessage(bot, query, msgs.broadcastDone(result));
  } finally {
    active = null;
  }
}

async function handleStats(bot, msg) {
  const chatId = msg.chat.id;
  if (!isAdmin(msg.from ? msg.from.id : 0)) {
    await safe("stats deny", function () { return bot.sendMessage(chatId, msgs.notAdmin()); });
    return;
  }
  const cache = streamCache.stats();
  const text = msgs.stats({
    users: users.summary(),
    top: users.topQueries(5),
    cache: { entries: cache.entries, mb: (cache.bytes / 1048576).toFixed(1) },
    apiStatus: musicApi.getHealth().status,
    uptime: format.formatUptime(Date.now() - config.startTime)
  });
  await safe("stats send", function () { return bot.sendMessage(chatId, text); });
}

async function sendBackup(bot, chatId) {
  const body = Buffer.from(users.exportJson(), "utf8");
  const stamp = new Date().toISOString().slice(0, 10);
  return bot.sendDocument(
    chatId,
    body,
    { caption: msgs.backupCaption(users.userCount()) },
    { filename: "musify-backup-" + stamp + ".json", contentType: "application/json" }
  );
}

async function handleBackup(bot, msg) {
  const chatId = msg.chat.id;
  if (!isAdmin(msg.from ? msg.from.id : 0)) {
    await safe("backup deny", function () { return bot.sendMessage(chatId, msgs.notAdmin()); });
    return;
  }
  users.flush();
  await safe("backup send", function () { return sendBackup(bot, chatId); });
}

async function handleRestoreDocument(bot, msg) {
  const chatId = msg.chat.id;
  const caption = typeof msg.caption === "string" ? msg.caption.trim() : "";
  if (!/^\/restore(?:@\S+)?$/i.test(caption)) {
    return;
  }
  if (!isAdmin(msg.from ? msg.from.id : 0)) {
    await safe("restore deny", function () { return bot.sendMessage(chatId, msgs.notAdmin()); });
    return;
  }
  const doc = msg.document;
  if (!doc || (doc.file_size && doc.file_size > MAX_BACKUP_BYTES)) {
    await safe("restore reject", function () { return bot.sendMessage(chatId, msgs.restoreFailed()); });
    return;
  }
  try {
    const link = await bot.getFileLink(doc.file_id);
    const res = await axios.get(link, {
      responseType: "text",
      transformResponse: function (raw) { return raw; },
      timeout: 30000,
      maxContentLength: MAX_BACKUP_BYTES
    });
    const summary = users.importJson(res.data);
    await bot.sendMessage(chatId, msgs.restoreDone(summary));
  } catch (err) {
    console.error("[musicbot] restore failed", err.message);
    await safe("restore failed notice", function () { return bot.sendMessage(chatId, msgs.restoreFailed()); });
  }
}

module.exports = {
  isAdmin,
  handleBroadcast,
  handleBroadcastCallback,
  handleStats,
  handleBackup,
  handleRestoreDocument,
  sendBackup
};
