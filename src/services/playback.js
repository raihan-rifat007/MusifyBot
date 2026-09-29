"use strict";

const config = require("../config");
const constants = require("../constants");
const messages = require("../copy/messages");
const musicApi = require("../clients/musicApi");
const rateLimit = require("../lib/rateLimit");
const trackLib = require("../lib/track");
const sessions = require("../state/sessions");

let activeDownloads = 0;

function getActiveDownloads() {
  return activeDownloads;
}

function evaluateGate(chatId, now) {
  const at = typeof now === "number" ? now : Date.now();
  if (sessions.isLocked(chatId, at)) {
    return { ok: false, reason: "busy" };
  }
  const last = sessions.getLastDownloadAt(chatId);
  if (rateLimit.isOnCooldown(last, at, config.cooldownMs)) {
    return { ok: false, reason: "cooldown", retryIn: rateLimit.remainingCooldownSeconds(last, at, config.cooldownMs) };
  }
  if (activeDownloads >= config.maxConcurrentDownloads) {
    return { ok: false, reason: "server_busy" };
  }
  return { ok: true };
}

async function sendSafely(bot, chatId, text) {
  try {
    await bot.sendMessage(chatId, text);
  } catch (err) {
    console.error("[musicbot] sendMessage failed", err.message);
  }
}

async function denyDownload(bot, chatId, gate) {
  if (gate.reason === "cooldown") {
    await sendSafely(bot, chatId, messages.cooldown(gate.retryIn));
    return;
  }
  if (gate.reason === "busy") {
    await sendSafely(bot, chatId, messages.busy());
    return;
  }
  await sendSafely(bot, chatId, messages.serverBusy());
}

function startChatActionLoop(bot, chatId) {
  const fire = function () {
    Promise.resolve()
      .then(function () {
        return bot.sendChatAction(chatId, "upload_audio");
      })
      .catch(function (err) {
        console.error("[musicbot] sendChatAction failed", err.message);
      });
  };
  fire();
  const intervalId = setInterval(fire, constants.LIMITS.CHAT_ACTION_INTERVAL_MS);
  return function stop() {
    clearInterval(intervalId);
  };
}

async function playTrack(bot, chatId, item) {
  const track = trackLib.toTrack(item);

  if (!track.id) {
    await sendSafely(bot, chatId, messages.audioUnavailable(track.name));
    return;
  }

  const now = Date.now();
  const gate = evaluateGate(chatId, now);
  if (!gate.ok) {
    await denyDownload(bot, chatId, gate);
    return;
  }

  sessions.lock(chatId, now);
  sessions.stampDownload(chatId, now);
  activeDownloads += 1;
  const stopChatAction = startChatActionLoop(bot, chatId);

  try {
    const downloaded = await musicApi.downloadAudioBuffer(track.id);
    if (!downloaded.ok) {
      const limitMb = Math.round(config.maxAudioBytes / 1048576);
      await sendSafely(bot, chatId, downloaded.reason === "too_large" ? messages.fileTooLarge(limitMb) : messages.downloadFailed(track.name));
      return;
    }

    const filename = trackLib.buildTrackFilename(track.name, track.artist, trackLib.extensionForContentType(downloaded.contentType));
    const sent = await bot.sendAudio(
      chatId,
      downloaded.buffer,
      {
        title: track.name,
        performer: track.artist,
        caption: messages.audioCaption(track.name, track.artist, track.duration),
        reply_markup: { inline_keyboard: [[{ text: "📝 Lyrics", callback_data: constants.CALLBACK.LYRICS }]] }
      },
      {
        filename: filename,
        contentType: downloaded.contentType
      }
    );

    sessions.setLastTrack(chatId, track);
    sessions.pushRecent(chatId, track);
    if (sent && sent.message_id) {
      sessions.rememberTrackMessage(chatId, sent.message_id, track);
    }
  } catch (err) {
    console.error("[musicbot] playTrack failed", err.message);
    await sendSafely(bot, chatId, messages.uploadFailed(track.name, musicApi.buildDownloadUrl(track.id)));
  } finally {
    stopChatAction();
    activeDownloads -= 1;
    sessions.unlock(chatId);
  }
}

module.exports = {
  playTrack,
  evaluateGate,
  denyDownload,
  getActiveDownloads
};
