"use strict";

const constants = require("../constants");
const musicApi = require("../clients/musicApi");
const TtlCache = require("../lib/ttlCache");
const trackLib = require("../lib/track");

const cache = new TtlCache({
  ttlMs: constants.LIMITS.SEARCH_CACHE_TTL_MS,
  maxEntries: constants.LIMITS.SEARCH_CACHE_MAX_ENTRIES
});

let warnedAboutMissingId = false;

function normalizeQuery(query) {
  return typeof query === "string" ? query.trim().toLowerCase().replace(/\s+/g, " ") : "";
}

function isObject(item) {
  return item !== null && typeof item === "object";
}

function warnIfIdsMissing(items) {
  if (warnedAboutMissingId || items.length === 0) {
    return;
  }
  if (trackLib.pickId(items[0]) === null) {
    warnedAboutMissingId = true;
    console.error("[musicbot] first search result has no usable id, keys present: " + Object.keys(items[0]).join(", "));
  }
}

async function searchTracks(query) {
  const key = normalizeQuery(query);
  if (!key) {
    return { ok: true, items: [] };
  }
  const cached = cache.get(key);
  if (cached) {
    return { ok: true, items: cached.slice() };
  }
  const result = await musicApi.search(query.trim());
  if (!result.ok) {
    return { ok: false, items: [] };
  }
  const items = result.items.filter(isObject);
  warnIfIdsMissing(items);
  cache.set(key, items);
  return { ok: true, items: items.slice() };
}

function clearCache() {
  cache.clear();
}

module.exports = {
  searchTracks,
  clearCache
};
