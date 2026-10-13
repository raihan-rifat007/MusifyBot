"use strict";

const users = require("../state/users");

const SEND_GAP_MS = 55;
const PROGRESS_EVERY = 40;

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function errorCode(err) {
  const body = err && err.response && err.response.body;
  if (body && typeof body.error_code === "number") {
    return body.error_code;
  }
  return err && err.response && err.response.statusCode ? err.response.statusCode : 0;
}

function retryAfterSeconds(err) {
  const body = err && err.response && err.response.body;
  const value = body && body.parameters ? body.parameters.retry_after : 0;
  return Number.isFinite(value) && value > 0 ? value : 3;
}

async function deliverOnce(bot, chatId, payload) {
  if (payload.kind === "copy") {
    await bot.copyMessage(chatId, payload.fromChatId, payload.messageId);
    return;
  }
  await bot.sendMessage(chatId, payload.text, { disable_web_page_preview: true });
}

async function sendTo(bot, chatId, payload, wait) {
  try {
    await deliverOnce(bot, chatId, payload);
    return "sent";
  } catch (err) {
    const code = errorCode(err);
    if (code === 429) {
      await wait(retryAfterSeconds(err) * 1000 + 250);
      try {
        await deliverOnce(bot, chatId, payload);
        return "sent";
      } catch (retryErr) {
        return errorCode(retryErr) === 403 ? "blocked" : "failed";
      }
    }
    if (code === 403 || code === 400) {
      return "blocked";
    }
    return "failed";
  }
}

async function run(bot, recipientIds, payload, options) {
  const opts = options || {};
  const wait = opts.sleep || sleep;
  const gap = opts.gapMs === undefined ? SEND_GAP_MS : opts.gapMs;
  const control = opts.control || { cancelled: false };
  const result = { total: recipientIds.length, sent: 0, blocked: 0, failed: 0, cancelled: false };
  const startedAt = Date.now();

  for (let i = 0; i < recipientIds.length; i++) {
    if (control.cancelled) {
      result.cancelled = true;
      break;
    }
    const outcome = await sendTo(bot, recipientIds[i], payload, wait);
    if (outcome === "sent") {
      result.sent += 1;
    } else if (outcome === "blocked") {
      result.blocked += 1;
      users.markBlocked(recipientIds[i]);
    } else {
      result.failed += 1;
    }
    const done = i + 1;
    if (typeof opts.onProgress === "function" && done % PROGRESS_EVERY === 0 && done < recipientIds.length) {
      try {
        await opts.onProgress(done, result);
      } catch (err) {
        console.error("[musicbot] broadcast progress failed", err.message);
      }
    }
    if (gap > 0) {
      await wait(gap);
    }
  }

  result.durationMs = Date.now() - startedAt;
  return result;
}

module.exports = {
  run
};
