"use strict";

const store = new Map();

function getSession(chatId) {
  if (!store.has(chatId)) {
    store.set(chatId, {
      activeList: null,
      lastTrack: null,
      awaitingIntent: null,
      createdAt: Date.now()
    });
  }
  return store.get(chatId);
}

function setActiveList(chatId, list) {
  const session = getSession(chatId);
  session.activeList = list;
  return session;
}

function getActiveList(chatId) {
  return getSession(chatId).activeList;
}

function clearActiveList(chatId) {
  const session = getSession(chatId);
  session.activeList = null;
  return session;
}

function setLastTrack(chatId, track) {
  const session = getSession(chatId);
  session.lastTrack = track;
  return session;
}

function getLastTrack(chatId) {
  return getSession(chatId).lastTrack;
}

function setAwaitingIntent(chatId, intent) {
  const session = getSession(chatId);
  session.awaitingIntent = intent;
  return session;
}

function getAwaitingIntent(chatId) {
  return getSession(chatId).awaitingIntent;
}

function sessionCount() {
  return store.size;
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
  sessionCount
};
