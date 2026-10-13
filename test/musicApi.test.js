"use strict";

process.env.MUSIC_API_BASE = "https://api.example.test/";

const test = require("node:test");
const assert = require("node:assert/strict");
const stubs = require("./support/stubs");

const routes = [];
const axiosStub = stubs.createAxiosStub(routes);
stubs.installStubs({ axios: axiosStub.module });

const musicApi = require("../src/clients/musicApi");

function setRoutes() {
  routes.length = 0;
  Array.prototype.push.apply(routes, arguments);
}

test("download URLs use the configured base and encode ids", function () {
  assert.equal(musicApi.buildDownloadUrl("42"), "https://api.example.test/api/download/42");
  assert.equal(musicApi.buildDownloadUrl("a/b"), "https://api.example.test/api/download/a%2Fb");
});

test("health starts unknown", function () {
  assert.equal(musicApi.getHealth().status, "unknown");
});

test("search returns the bare array as items", async function () {
  setRoutes({ match: function (u) { return u === "/api/search"; }, respond: async function () { return { data: [{ id: 1, name: "A" }] }; } });
  const result = await musicApi.search("a");
  assert.equal(result.ok, true);
  assert.equal(result.items.length, 1);
});

test("search treats a non-array body as no results", async function () {
  setRoutes({ match: function () { return true; }, respond: async function () { return { data: { message: "nothing" } }; } });
  const result = await musicApi.search("a");
  assert.deepEqual(result, { ok: true, items: [] });
});

test("search maps a 404 to an empty successful result", async function () {
  setRoutes({ match: function () { return true; }, respond: async function () { throw stubs.httpError(404); } });
  const result = await musicApi.search("zzzz");
  assert.deepEqual(result, { ok: true, items: [] });
});

test("search reports failure on network errors and health degrades", async function () {
  setRoutes({ match: function () { return true; }, respond: async function () { throw new Error("socket hang up"); } });
  const result = await musicApi.search("a");
  assert.deepEqual(result, { ok: false, items: [] });
  assert.equal(musicApi.getHealth().status, "degraded");
});

test("health recovers after a success", async function () {
  setRoutes({ match: function () { return true; }, respond: async function () { return { data: [] }; } });
  await musicApi.search("a");
  assert.equal(musicApi.getHealth().status, "ok");
});

test("lyrics returns text, and null for blank or failing responses", async function () {
  setRoutes({ match: function () { return true; }, respond: async function () { return { data: { lyrics: "la la" } }; } });
  assert.equal(await musicApi.lyrics("A", "B"), "la la");
  setRoutes({ match: function () { return true; }, respond: async function () { return { data: { lyrics: "   " } }; } });
  assert.equal(await musicApi.lyrics("A", "B"), null);
  setRoutes({ match: function () { return true; }, respond: async function () { throw stubs.httpError(404); } });
  assert.equal(await musicApi.lyrics("A", "B"), null);
});

test("download returns the audio buffer and content type", async function () {
  setRoutes({ match: function () { return true; }, respond: async function () { return { data: Buffer.from("audio"), headers: { "content-type": "audio/mpeg" } }; } });
  const result = await musicApi.downloadAudioBuffer("1");
  assert.equal(result.ok, true);
  assert.equal(result.buffer.toString(), "audio");
  assert.equal(result.contentType, "audio/mpeg");
});

test("download rejects JSON, HTML and empty payloads that only look like audio", async function () {
  setRoutes({ match: function () { return true; }, respond: async function () { return { data: Buffer.from("{}"), headers: { "content-type": "application/json" } }; } });
  assert.deepEqual(await musicApi.downloadAudioBuffer("1"), { ok: false, reason: "failed" });
  setRoutes({ match: function () { return true; }, respond: async function () { return { data: Buffer.from("<html>"), headers: { "content-type": "text/html; charset=utf-8" } }; } });
  assert.deepEqual(await musicApi.downloadAudioBuffer("1"), { ok: false, reason: "failed" });
  setRoutes({ match: function () { return true; }, respond: async function () { return { data: Buffer.alloc(0), headers: { "content-type": "audio/mpeg" } }; } });
  assert.deepEqual(await musicApi.downloadAudioBuffer("1"), { ok: false, reason: "failed" });
});

test("download distinguishes oversized files from other failures", async function () {
  setRoutes({ match: function () { return true; }, respond: async function () { throw new Error("maxContentLength size of 20971520 exceeded"); } });
  assert.deepEqual(await musicApi.downloadAudioBuffer("1"), { ok: false, reason: "too_large" });
  setRoutes({ match: function () { return true; }, respond: async function () { throw new Error("timeout of 60000ms exceeded"); } });
  assert.deepEqual(await musicApi.downloadAudioBuffer("1"), { ok: false, reason: "failed" });
});

test("download enforces the configured size cap through axios options", async function () {
  setRoutes({ match: function () { return true; }, respond: async function () { return { data: Buffer.from("x"), headers: { "content-type": "audio/mpeg" } }; } });
  await musicApi.downloadAudioBuffer("9");
  const last = axiosStub.calls[axiosStub.calls.length - 1];
  assert.equal(last.options.maxContentLength, 20 * 1048576);
  assert.equal(last.options.responseType, "arraybuffer");
});
