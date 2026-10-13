"use strict";

process.env.MUSIC_API_BASE = "https://api.example.test/";

const test = require("node:test");
const assert = require("node:assert/strict");
const stubs = require("./support/stubs");
const createMockBot = require("./support/mockBot");

const routes = [];
const axiosStub = stubs.createAxiosStub(routes);
stubs.installStubs({ axios: axiosStub.module });

const catalog = require("../src/services/catalog");
const inline = require("../src/handlers/inline");

function useSearch(respond) {
  axiosStub.calls.length = 0;
  routes.length = 0;
  routes.push({ match: function (u) { return u === "/api/search"; }, respond: respond });
  catalog.clearCache();
}

test("inline results are audio entries pointing at the configured download URL", async function () {
  useSearch(async function () {
    return { data: [{ id: 1, name: "Shape of You", artist: "Ed Sheeran" }, { id: 2, name: "Perfect", artist: "Ed Sheeran" }] };
  });
  const bot = createMockBot();
  await inline.handleInlineQuery(bot, { id: "q1", query: "  ed sheeran " });
  const answer = bot.named("answerInlineQuery")[0];
  assert.equal(answer.args[0], "q1");
  assert.deepEqual(answer.args[1][0], {
    type: "audio",
    id: "1",
    audio_url: "https://api.example.test/api/download/1",
    title: "Shape of You",
    performer: "Ed Sheeran"
  });
  assert.equal(answer.args[1].length, 2);
  assert.equal(answer.args[2].cache_time, 300);
});

test("inline queries that are too short are answered empty without calling the API", async function () {
  useSearch(async function () {
    throw new Error("should not be called");
  });
  const bot = createMockBot();
  await inline.handleInlineQuery(bot, { id: "q2", query: "a" });
  await inline.handleInlineQuery(bot, { id: "q3", query: "" });
  assert.equal(bot.named("answerInlineQuery").length, 2);
  bot.named("answerInlineQuery").forEach(function (call) {
    assert.deepEqual(call.args[1], []);
  });
  assert.equal(axiosStub.calls.filter(function (call) {
    return call.url === "/api/search";
  }).length, 0);
});

test("inline results are capped, deduplicated and skip entries without an id", async function () {
  const songs = Array.from({ length: 30 }, function (_, i) {
    return { id: i + 1, name: "Song " + i, artist: "A" };
  });
  songs.push({ id: 1, name: "Duplicate", artist: "A" });
  songs.unshift({ name: "No id", artist: "A" });
  useSearch(async function () {
    return { data: songs };
  });
  const bot = createMockBot();
  await inline.handleInlineQuery(bot, { id: "q4", query: "song" });
  const results = bot.named("answerInlineQuery")[0].args[1];
  assert.equal(results.length, 20);
  assert.equal(new Set(results.map(function (r) {
    return r.id;
  })).size, 20);
  assert.equal(results[0].id, "1");
});

test("an unreachable API produces an empty answer with a short cache time", async function () {
  useSearch(async function () {
    throw new Error("ECONNRESET");
  });
  const bot = createMockBot();
  await inline.handleInlineQuery(bot, { id: "q5", query: "anything" });
  const answer = bot.named("answerInlineQuery")[0];
  assert.deepEqual(answer.args[1], []);
  assert.equal(answer.args[2].cache_time, 5);
});

test("repeat inline queries are served from the search cache", async function () {
  useSearch(async function () {
    return { data: [{ id: 1, name: "One", artist: "A" }] };
  });
  const bot = createMockBot();
  await inline.handleInlineQuery(bot, { id: "q6", query: "same query" });
  await inline.handleInlineQuery(bot, { id: "q7", query: "Same   Query" });
  assert.equal(axiosStub.calls.filter(function (call) {
    return call.url === "/api/search";
  }).length, 1);
});

test("a failing answerInlineQuery call never throws", async function () {
  useSearch(async function () {
    return { data: [{ id: 1, name: "One", artist: "A" }] };
  });
  const bot = createMockBot();
  bot.answerInlineQuery = async function () {
    throw new Error("QUERY_ID_INVALID");
  };
  await inline.handleInlineQuery(bot, { id: "q8", query: "one two" });
});
