"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const librarySanitizer = require("../lib/library");

const DAY_MS = 86400000;
const MAX_QUERIES = 500;
const MAX_SHARES = 500;
const SAVE_DELAY_MS = 3000;

let filePath = null;
let saveTimer = null;
let data = emptyData();

function emptyData() {
  return {
    version: 1,
    users: {},
    library: {},
    shares: {},
    stats: { searches: 0, plays: 0, queries: {} }
  };
}

function normalizeLoaded(raw) {
  const base = emptyData();
  if (!raw || typeof raw !== "object") {
    return base;
  }
  if (raw.users && typeof raw.users === "object") {
    base.users = raw.users;
  }
  if (raw.library && typeof raw.library === "object") {
    base.library = raw.library;
  }
  if (raw.shares && typeof raw.shares === "object") {
    base.shares = raw.shares;
  }
  if (raw.stats && typeof raw.stats === "object") {
    base.stats.searches = Number(raw.stats.searches) || 0;
    base.stats.plays = Number(raw.stats.plays) || 0;
    base.stats.queries = raw.stats.queries && typeof raw.stats.queries === "object" ? raw.stats.queries : {};
  }
  return base;
}

function scheduleSave() {
  if (!filePath || saveTimer) {
    return;
  }
  saveTimer = setTimeout(function () {
    saveTimer = null;
    flush();
  }, SAVE_DELAY_MS);
  if (typeof saveTimer.unref === "function") {
    saveTimer.unref();
  }
}

function flush() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (!filePath) {
    return false;
  }
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = filePath + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, filePath);
    return true;
  } catch (err) {
    console.error("[musicbot] could not save user data", err.message);
    return false;
  }
}

function init(file) {
  filePath = file || null;
  data = emptyData();
  if (!filePath) {
    return;
  }
  try {
    if (fs.existsSync(filePath)) {
      data = normalizeLoaded(JSON.parse(fs.readFileSync(filePath, "utf8")));
    }
  } catch (err) {
    console.error("[musicbot] could not read user data, starting empty", err.message);
    data = emptyData();
  }
}

function touch(from, now) {
  if (!from || typeof from.id !== "number" || from.is_bot) {
    return null;
  }
  const stamp = now || Date.now();
  const key = String(from.id);
  let user = data.users[key];
  if (!user) {
    user = { id: from.id, firstName: "", username: "", firstSeen: stamp, lastSeen: stamp, blocked: false };
    data.users[key] = user;
  }
  user.firstName = typeof from.first_name === "string" ? from.first_name.slice(0, 64) : user.firstName;
  user.username = typeof from.username === "string" ? from.username.slice(0, 64) : "";
  user.lastSeen = stamp;
  user.blocked = false;
  scheduleSave();
  return user;
}

function markBlocked(id) {
  const user = data.users[String(id)];
  if (user && !user.blocked) {
    user.blocked = true;
    scheduleSave();
  }
}

function listRecipientIds() {
  return Object.keys(data.users).map(function (key) {
    return data.users[key];
  }).filter(function (user) {
    return user && !user.blocked && user.id > 0;
  }).map(function (user) {
    return user.id;
  });
}

function summary(now) {
  const current = now || Date.now();
  const all = Object.keys(data.users).map(function (key) { return data.users[key]; });
  return {
    total: all.length,
    blocked: all.filter(function (u) { return u.blocked; }).length,
    active24h: all.filter(function (u) { return current - u.lastSeen < DAY_MS; }).length,
    active7d: all.filter(function (u) { return current - u.lastSeen < 7 * DAY_MS; }).length,
    new24h: all.filter(function (u) { return current - u.firstSeen < DAY_MS; }).length,
    searches: data.stats.searches,
    plays: data.stats.plays
  };
}

function recordSearch(query) {
  data.stats.searches += 1;
  const key = typeof query === "string" ? query.trim().toLowerCase().slice(0, 60) : "";
  if (key) {
    data.stats.queries[key] = (data.stats.queries[key] || 0) + 1;
    const keys = Object.keys(data.stats.queries);
    if (keys.length > MAX_QUERIES) {
      keys.sort(function (a, b) { return data.stats.queries[a] - data.stats.queries[b]; });
      for (let i = 0; i < keys.length - MAX_QUERIES; i++) {
        delete data.stats.queries[keys[i]];
      }
    }
  }
  scheduleSave();
}

function recordPlay() {
  data.stats.plays += 1;
  scheduleSave();
}

function topQueries(limit) {
  return Object.keys(data.stats.queries).map(function (key) {
    return { query: key, count: data.stats.queries[key] };
  }).sort(function (a, b) {
    return b.count - a.count;
  }).slice(0, limit);
}

function getLibrary(userId) {
  return librarySanitizer.sanitizeLibrary(data.library[String(userId)]);
}

function setLibrary(userId, raw) {
  const clean = librarySanitizer.sanitizeLibrary(raw);
  data.library[String(userId)] = clean;
  scheduleSave();
  return clean;
}

function createShare(ownerId, payload) {
  const keys = Object.keys(data.shares);
  if (keys.length >= MAX_SHARES) {
    keys.sort(function (a, b) { return data.shares[a].createdAt - data.shares[b].createdAt; });
    for (let i = 0; i <= keys.length - MAX_SHARES; i++) {
      delete data.shares[keys[i]];
    }
  }
  const code = crypto.randomBytes(5).toString("hex");
  const items = librarySanitizer.cleanItems(payload.items, librarySanitizer.LIMITS.PLAYLIST_ITEMS);
  data.shares[code] = {
    owner: ownerId,
    name: typeof payload.name === "string" ? payload.name.trim().slice(0, 40) : "Shared",
    items: items,
    createdAt: Date.now()
  };
  scheduleSave();
  return code;
}

function getShare(code) {
  if (typeof code !== "string" || !/^[a-f0-9]{10}$/.test(code)) {
    return null;
  }
  const share = data.shares[code];
  return share ? { name: share.name, items: share.items } : null;
}

function exportJson() {
  return JSON.stringify(data);
}

function importJson(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || typeof parsed.users !== "object") {
    throw new Error("invalid backup file");
  }
  data = normalizeLoaded(parsed);
  flush();
  return summary();
}

function userCount() {
  return Object.keys(data.users).length;
}

function reset() {
  filePath = null;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  data = emptyData();
}

module.exports = {
  init,
  flush,
  touch,
  markBlocked,
  listRecipientIds,
  summary,
  recordSearch,
  recordPlay,
  topQueries,
  getLibrary,
  setLibrary,
  createShare,
  getShare,
  exportJson,
  importJson,
  userCount,
  reset
};
