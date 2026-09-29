"use strict";

process.env.COOLDOWN_MS = "3000";

const test = require("node:test");
const assert = require("node:assert/strict");
const stubs = require("./support/stubs");
const createMockBot = require("./support/mockBot");

const routes = [
  { match: function (u) { return u === "/api/search"; }, respond: async function () { return { data: [{ id: 1, name: "One", artist: "A" }, { id: 2, name: "Two", artist: "B" }] }; } },
  { match: function (u) { return u.indexOf("/api/download/") !== -1; }, respond: async function () { return { data: Buffer.from("audio"), headers: { "content-type": "audio/mpeg" } }; } }
];
const axiosStub = stubs.createAxiosStub(routes);
stubs.installStubs({ axios: axiosStub.module });

const sessions = require("../src/state/sessions");
const catalog = require("../src/services/catalog");
const playback = require("../src/services/playback");
const commands = require("../src/handlers/commands");

test("the gate allows a first download and blocks inside the cooldown window", function () {
  sessions.clearAll();
  assert.deepEqual(playback.evaluateGate(1, 10000), { ok: true });
  sessions.stampDownload(1, 10000);
  const blocked = playback.evaluateGate(1, 11000);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "cooldown");
  assert.equal(blocked.retryIn, 2);
  assert.deepEqual(playback.evaluateGate(1, 13000), { ok: true });
});

test("the gate reports busy before cooldown while a download holds the lock", function () {
  sessions.clearAll();
  sessions.lock(2, 10000);
  sessions.stampDownload(2, 10000);
  assert.equal(playback.evaluateGate(2, 10500).reason, "busy");
});

test("a stale lock does not block forever", function () {
  sessions.clearAll();
  sessions.lock(3, 1000);
  assert.deepEqual(playback.evaluateGate(3, 1000 + 130000), { ok: true });
});

test("cooldowns are tracked per chat", function () {
  sessions.clearAll();
  sessions.stampDownload(4, 10000);
  assert.deepEqual(playback.evaluateGate(5, 10500), { ok: true });
});

test("back-to-back plays get a friendly cooldown message and no second download", async function () {
  sessions.clearAll();
  catalog.clearCache();
  const bot = createMockBot();
  const msg = { chat: { id: 6, type: "private" }, from: { first_name: "R" } };
  await commands.handlePlay(bot, msg, "one");
  await commands.handlePlay(bot, msg, "two");
  assert.equal(bot.named("sendAudio").length, 1);
  const messages = bot.named("sendMessage").map(function (call) {
    return call.args[1];
  });
  assert.equal(messages.length, 1);
  assert.match(messages[0], /Easy there — try again in \d+s\./);
  assert.equal(playback.getActiveDownloads(), 0);
});
