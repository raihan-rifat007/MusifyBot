"use strict";

function createLimiter(options) {
  const windowMs = options.windowMs;
  const max = options.max;
  const now = options.now || Date.now;
  const hits = new Map();

  function prune(current) {
    hits.forEach(function (list, key) {
      const fresh = list.filter(function (stamp) {
        return current - stamp < windowMs;
      });
      if (fresh.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, fresh);
      }
    });
  }

  function hit(key) {
    const current = now();
    if (hits.size > 5000) {
      prune(current);
    }
    const list = (hits.get(key) || []).filter(function (stamp) {
      return current - stamp < windowMs;
    });
    if (list.length >= max) {
      hits.set(key, list);
      return { ok: false, retryAfterMs: windowMs - (current - list[0]) };
    }
    list.push(current);
    hits.set(key, list);
    return { ok: true, retryAfterMs: 0 };
  }

  return { hit };
}

module.exports = {
  createLimiter
};
