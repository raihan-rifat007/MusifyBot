"use strict";

const constants = require("../constants");
const musicApi = require("../clients/musicApi");
const catalog = require("../services/catalog");
const trackLib = require("../lib/track");

function toInlineResult(item, seenIds) {
  const id = trackLib.pickId(item);
  if (!id) {
    return null;
  }
  const resultId = id.slice(0, 64);
  if (seenIds.has(resultId)) {
    return null;
  }
  seenIds.add(resultId);
  return {
    type: "audio",
    id: resultId,
    audio_url: musicApi.buildDownloadUrl(id),
    title: trackLib.pickName(item),
    performer: trackLib.pickArtist(item)
  };
}

function buildInlineResults(items) {
  const seenIds = new Set();
  const results = [];
  for (let i = 0; i < items.length && results.length < constants.LIMITS.INLINE_RESULTS_MAX; i++) {
    const entry = toInlineResult(items[i], seenIds);
    if (entry) {
      results.push(entry);
    }
  }
  return results;
}

async function handleInlineQuery(bot, inlineQuery) {
  const queryText = typeof inlineQuery.query === "string" ? inlineQuery.query.trim() : "";
  try {
    if (queryText.length < constants.LIMITS.INLINE_MIN_QUERY_LENGTH) {
      await bot.answerInlineQuery(inlineQuery.id, [], { cache_time: constants.LIMITS.INLINE_ERROR_CACHE_SECONDS });
      return;
    }
    const result = await catalog.searchTracks(queryText);
    const results = result.ok ? buildInlineResults(result.items) : [];
    const cacheTime = result.ok ? constants.LIMITS.INLINE_CACHE_SECONDS : constants.LIMITS.INLINE_ERROR_CACHE_SECONDS;
    await bot.answerInlineQuery(inlineQuery.id, results, { cache_time: cacheTime });
  } catch (err) {
    console.error("[musicbot] handleInlineQuery failed", err.message);
  }
}

module.exports = {
  handleInlineQuery
};
