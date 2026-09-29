"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const constants = require("../src/constants");
const sessions = require("../src/state/sessions");

test("recent history is newest first, deduplicated and capped", function () {
  sessions.clearAll();
  for (let i = 1; i <= 12; i++) {
    sessions.pushRecent(1, { id: i, name: "Song " + i, artist: "Artist" });
  }
  let recent = sessions.getRecent(1);
  assert.equal(recent.length, constants.LIMITS.RECENT_HISTORY);
  assert.equal(recent[0].id, "12");
  sessions.pushRecent(1, { id: 5, name: "Song 5", artist: "Artist" });
  recent = sessions.getRecent(1);
  assert.equal(recent[0].id, "5");
  assert.equal(recent.filter(function (entry) {
    return entry.id === "5";
  }).length, 1);
  assert.equal(recent.length, constants.LIMITS.RECENT_HISTORY);
});

test("recent history ignores tracks without an id and returns copies", function () {
  sessions.clearAll();
  sessions.pushRecent(2, { id: null, name: "No id", artist: "Nobody" });
  assert.equal(sessions.getRecent(2).length, 0);
  sessions.pushRecent(2, { id: 1, name: "One", artist: "A" });
  const copy = sessions.getRecent(2);
  copy.length = 0;
  assert.equal(sessions.getRecent(2).length, 1);
});

test("histories are isolated per chat", function () {
  sessions.clearAll();
  sessions.pushRecent(10, { id: 1, name: "One", artist: "A" });
  assert.equal(sessions.getRecent(11).length, 0);
});

test("track-per-message memory is capped", function () {
  sessions.clearAll();
  const total = constants.LIMITS.TRACK_MESSAGE_MEMORY + 5;
  for (let i = 1; i <= total; i++) {
    sessions.rememberTrackMessage(3, i, { id: String(i), name: "T" + i, artist: "A" });
  }
  assert.equal(sessions.getTrackForMessage(3, 1), null);
  assert.equal(sessions.getTrackForMessage(3, 5), null);
  assert.equal(sessions.getTrackForMessage(3, 6).id, "6");
  assert.equal(sessions.getTrackForMessage(3, total).id, String(total));
});

test("download lock expires when stale", function () {
  sessions.clearAll();
  sessions.lock(4, 1000);
  assert.equal(sessions.isLocked(4, 1000), true);
  assert.equal(sessions.isLocked(4, 1000 + constants.LIMITS.LOCK_STALE_MS - 1), true);
  assert.equal(sessions.isLocked(4, 1000 + constants.LIMITS.LOCK_STALE_MS), false);
  sessions.lock(4, 5000);
  sessions.unlock(4);
  assert.equal(sessions.isLocked(4, 5001), false);
});

test("awaiting intent and active list round-trip", function () {
  sessions.clearAll();
  sessions.setAwaitingIntent(5, "play");
  assert.equal(sessions.getAwaitingIntent(5), "play");
  sessions.setActiveList(5, { items: [1], page: 0, meta: {} });
  assert.equal(sessions.getActiveList(5).items.length, 1);
  sessions.clearActiveList(5);
  assert.equal(sessions.getActiveList(5), null);
});

test("idle sessions are pruned", function () {
  sessions.clearAll();
  sessions.getSession(6);
  sessions.getSession(7);
  assert.equal(sessions.sessionCount(), 2);
  assert.equal(sessions.pruneIdle(Date.now(), 60000), 0);
  assert.equal(sessions.pruneIdle(Date.now() + 120000, 60000), 2);
  assert.equal(sessions.sessionCount(), 0);
});

test("pick callbacks build and parse safely", function () {
  assert.equal(constants.buildPickCallback(5), "pick:5");
  assert.equal(constants.parsePickCallback("pick:3"), 3);
  assert.equal(constants.parsePickCallback("pick:0"), 0);
  assert.equal(constants.parsePickCallback("pick:x"), null);
  assert.equal(constants.parsePickCallback("pick:-1"), null);
  assert.equal(constants.parsePickCallback("lyrics"), null);
  assert.equal(constants.parsePickCallback(undefined), null);
});

test("bot profile texts respect Telegram limits", function () {
  assert.ok(constants.BOT_PROFILE.SHORT_DESCRIPTION.length <= constants.LIMITS.PROFILE_SHORT_DESCRIPTION_MAX);
  assert.ok(constants.BOT_PROFILE.DESCRIPTION.length <= constants.LIMITS.PROFILE_DESCRIPTION_MAX);
});

test("bot commands are valid menu entries", function () {
  constants.BOT_COMMANDS.forEach(function (entry) {
    assert.match(entry.command, /^[a-z0-9_]{1,32}$/);
    assert.ok(entry.description.length >= 3 && entry.description.length <= 256);
  });
});
