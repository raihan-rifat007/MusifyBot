"use strict";

const constants = require("../constants");

const store = new Map();
let prunerHandle = null;

function createSession(now) {
  return {
    activeList: null,
    lastTrack: null,
    awaitingIntent: null,
    recent: [],
    trackByMessage: new Map(),
    lastDownloadAt: 0,
    busySince: 0,
    lastSeenAt: now,
    createdAt: now
  };
}

function getSession(chatId) {
  const now = Date.now();
  let session = store.get(chatId);
  if (!session) {
    session = createSession(now);
    store.set(chatId, session);
  }
  session.lastSeenAt = now;
  return session;
}

function setActiveList(chatId, list) {
  getSession(chatId).activeList = list;
}

function getActiveList(chatId) {
  return getSession(chatId).activeList;
}

function clearActiveList(chatId) {
  getSession(chatId).activeList = null;
}

function setLastTrack(chatId, track) {
  getSession(chatId).lastTrack = track;
}

function getLastTrack(chatId) {
  return getSession(chatId).lastTrack;
}

function setAwaitingIntent(chatId, intent) {
  getSession(chatId).awaitingIntent = intent;
}

function getAwaitingIntent(chatId) {
  return getSession(chatId).awaitingIntent;
}

function pushRecent(chatId, track) {
  if (!track || !track.id) {
    return getRecent(chatId);
  }
  const session = getSession(chatId);
  const id = String(track.id);
  session.recent = session.recent.filter(function (entry) {
    return String(entry.id) !== id;
  });
  session.recent.unshift({ id: id, name: track.name, artist: track.artist, duration: track.duration || null });
  if (session.recent.length > constants.LIMITS.RECENT_HISTORY) {
    session.recent.length = constants.LIMITS.RECENT_HISTORY;
  }
  return session.recent.slice();
}

function getRecent(chatId) {
  return getSession(chatId).recent.slice();
}

function rememberTrackMessage(chatId, messageId, track) {
  const memory = getSession(chatId).trackByMessage;
  memory.set(messageId, track);
  while (memory.size > constants.LIMITS.TRACK_MESSAGE_MEMORY) {
    memory.delete(memory.keys().next().value);
  }
}

function getTrackForMessage(chatId, messageId) {
  return getSession(chatId).trackByMessage.get(messageId) || null;
}

function isLocked(chatId, now) {
  const at = typeof now === "number" ? now : Date.now();
  const session = getSession(chatId);
  return session.busySince > 0 && at - session.busySince < constants.LIMITS.LOCK_STALE_MS;
}

function lock(chatId, now) {
  getSession(chatId).busySince = typeof now === "number" ? now : Date.now();
}

function unlock(chatId) {
  getSession(chatId).busySince = 0;
}

function getLastDownloadAt(chatId) {
  return getSession(chatId).lastDownloadAt;
}

function stampDownload(chatId, now) {
  getSession(chatId).lastDownloadAt = typeof now === "number" ? now : Date.now();
}

function sessionCount() {
  return store.size;
}

function pruneIdle(now, maxIdleMs) {
  const at = typeof now === "number" ? now : Date.now();
  const limit = typeof maxIdleMs === "number" ? maxIdleMs : constants.LIMITS.SESSION_IDLE_MS;
  let removed = 0;
  store.forEach(function (session, chatId) {
    if (at - session.lastSeenAt > limit) {
      store.delete(chatId);
      removed++;
    }
  });
  return removed;
}

function startPruner() {
  if (prunerHandle) {
    return;
  }
  prunerHandle = setInterval(function () {
    const removed = pruneIdle();
    if (removed > 0) {
      console.log("[musicbot] pruned " + removed + " idle sessions");
    }
  }, constants.LIMITS.SESSION_PRUNE_INTERVAL_MS);
  prunerHandle.unref();
}

function stopPruner() {
  if (prunerHandle) {
    clearInterval(prunerHandle);
    prunerHandle = null;
  }
}

function clearAll() {
  store.clear();
}

module.exports = {
  getSession,
  setActiveList,
  getActiveList,
  clearActiveList,
  setLastTrack,
  getLastTrack,
  setAwaitingIntent,
  getAwaitingIntent,
  pushRecent,
  getRecent,
  rememberTrackMessage,
  getTrackForMessage,
  isLocked,
  lock,
  unlock,
  getLastDownloadAt,
  stampDownload,
  sessionCount,
  pruneIdle,
  startPruner,
  stopPruner,
  clearAll
};
