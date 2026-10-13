"use strict";

const config = require("../config");
const musicApi = require("../clients/musicApi");

function createStreamCache(options) {
  const opts = options || {};
  const download = opts.download || musicApi.downloadAudioBuffer;
  const now = opts.now || Date.now;
  const ttlMs = opts.ttlMs || 15 * 60 * 1000;
  const failTtlMs = opts.failTtlMs || 30 * 1000;
  const retryAfterMs = opts.retryAfterMs === undefined ? 5000 : opts.retryAfterMs;
  const maxEntries = opts.maxEntries || 12;
  const maxTotalBytes = opts.maxTotalBytes || 120 * 1048576;
  const maxParallel = opts.maxParallel || Math.max(1, Math.min(2, config.maxConcurrentDownloads));

  const entries = new Map();
  const queue = [];
  let active = 0;
  let totalBytes = 0;

  function dropEntry(id, entry) {
    if (entries.get(id) === entry) {
      entries.delete(id);
      if (entry.buffer) {
        totalBytes -= entry.buffer.length;
      }
    }
  }

  function evict() {
    const ids = Array.from(entries.keys());
    for (let i = 0; i < ids.length; i++) {
      if (entries.size <= maxEntries && totalBytes <= maxTotalBytes) {
        return;
      }
      const entry = entries.get(ids[i]);
      if (entry && entry.state !== "loading") {
        dropEntry(ids[i], entry);
      }
    }
  }

  function pump() {
    while (active < maxParallel && queue.length > 0) {
      const job = queue.shift();
      active += 1;
      job().then(function () {
        active -= 1;
        pump();
      });
    }
  }

  function schedule(task) {
    return new Promise(function (resolve) {
      queue.push(function () {
        return task().then(resolve, resolve);
      });
      pump();
    });
  }

  function start(id) {
    const entry = { state: "loading", buffer: null, contentType: null, reason: null, expiresAt: 0, failedAt: 0, promise: null };
    entries.set(id, entry);
    entry.promise = schedule(async function () {
      let result;
      try {
        result = await download(id);
      } catch (err) {
        result = { ok: false, reason: "failed" };
      }
      if (entries.get(id) !== entry) {
        return;
      }
      if (result && result.ok) {
        entry.state = "ready";
        entry.buffer = result.buffer;
        entry.contentType = result.contentType;
        entry.expiresAt = now() + ttlMs;
        totalBytes += result.buffer.length;
        evict();
      } else {
        entry.state = "failed";
        entry.reason = result && result.reason ? result.reason : "failed";
        entry.failedAt = now();
        entry.expiresAt = now() + failTtlMs;
      }
    });
    return entry;
  }

  function lookup(id) {
    const entry = entries.get(id);
    if (!entry) {
      return null;
    }
    if (entry.state !== "loading" && entry.expiresAt <= now()) {
      dropEntry(id, entry);
      return null;
    }
    entries.delete(id);
    entries.set(id, entry);
    return entry;
  }

  function prepare(id) {
    const entry = lookup(id) || start(id);
    return entry.state;
  }

  async function getAudio(id) {
    let entry = lookup(id);
    if (entry && entry.state === "failed" && now() - entry.failedAt >= retryAfterMs) {
      dropEntry(id, entry);
      entry = null;
    }
    if (!entry) {
      entry = start(id);
    }
    await entry.promise;
    if (entry.state === "ready") {
      return { ok: true, buffer: entry.buffer, contentType: entry.contentType };
    }
    return { ok: false, reason: entry.reason || "failed" };
  }

  function stats() {
    return { entries: entries.size, bytes: totalBytes, active: active, queued: queue.length };
  }

  function clear() {
    entries.clear();
    totalBytes = 0;
  }

  return { prepare, getAudio, stats, clear };
}

const shared = createStreamCache();

module.exports = shared;
module.exports.createStreamCache = createStreamCache;
