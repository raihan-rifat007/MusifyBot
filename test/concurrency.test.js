"use strict";

process.env.COOLDOWN_MS = "0";
process.env.MAX_CONCURRENT_DOWNLOADS = "1";

const test = require("node:test");
const assert = require("node:assert/strict");
const stubs = require("./support/stubs");
const createMockBot = require("./support/mockBot");

let release;
const blocker = new Promise(function (resolve) {
  release = resolve;
});

const routes = [
  { match: function (u) { return u === "/api/search"; }, respond: async function () { return { data: [{ id: 1, name: "One", artist: "A" }] }; } },
  { match: function (u) { return u.indexOf("/api/download/") !== -1; }, respond: async function () {
    await blocker;
    return { data: Buffer.from("audio"), headers: { "content-type": "audio/mpeg" } };
  } }
];
const axiosStub = stubs.createAxiosStub(routes);
stubs.installStubs({ axios: axiosStub.module });

const sessions = require("../src/state/sessions");
const playback = require("../src/services/playback");
const commands = require("../src/handlers/commands");

test("downloads beyond the global cap are refused and the counter always returns to zero", async function () {
  sessions.clearAll();
  const bot = createMockBot();
  const first = commands.handlePlay(bot, { chat: { id: 1, type: "private" } }, "one");
  await new Promise(function (resolve) {
    setTimeout(resolve, 30);
  });
  assert.equal(playback.getActiveDownloads(), 1);

  const secondBot = createMockBot();
  await commands.handlePlay(secondBot, { chat: { id: 2, type: "private" } }, "one");
  const texts = secondBot.named("sendMessage").map(function (call) {
    return call.args[1];
  });
  assert.equal(texts.length, 1);
  assert.match(texts[0], /busy with other downloads/);
  assert.equal(secondBot.named("sendAudio").length, 0);

  release();
  await first;
  assert.equal(bot.named("sendAudio").length, 1);
  assert.equal(playback.getActiveDownloads(), 0);
});
