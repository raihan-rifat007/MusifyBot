"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const telegramAuth = require("../src/lib/telegramAuth");
const { createLimiter } = require("../src/lib/limiter");
const library = require("../src/lib/library");

const TOKEN = "123456:TEST-TOKEN";

function hmac(key, data) {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function makeInitData(user, token, authDate, tamper) {
  const fields = { auth_date: String(authDate), query_id: "AAHdF6IQ", user: JSON.stringify(user), start_param: "s_abc" };
  const check = Object.keys(fields).sort().map(function (key) { return key + "=" + fields[key]; }).join("\n");
  const hash = hmac(hmac("WebAppData", token), check).toString("hex");
  const params = new URLSearchParams(fields);
  params.set("hash", tamper ? hash.replace(/^./, hash[0] === "a" ? "b" : "a") : hash);
  return params.toString();
}

test("valid initData is accepted and yields the user", function () {
  const now = Math.floor(Date.now() / 1000);
  const result = telegramAuth.verifyInitData(makeInitData({ id: 42, first_name: "Raihan" }, TOKEN, now), TOKEN);
  assert.equal(result.ok, true);
  assert.equal(result.user.id, 42);
  assert.equal(result.startParam, "s_abc");
});

test("tampered, wrong-token, expired and empty initData are rejected", function () {
  const now = Math.floor(Date.now() / 1000);
  const user = { id: 42, first_name: "R" };
  assert.equal(telegramAuth.verifyInitData(makeInitData(user, TOKEN, now, true), TOKEN).reason, "bad_hash");
  assert.equal(telegramAuth.verifyInitData(makeInitData(user, "other:token", now), TOKEN).reason, "bad_hash");
  assert.equal(telegramAuth.verifyInitData(makeInitData(user, TOKEN, now - 200000), TOKEN).reason, "expired");
  assert.equal(telegramAuth.verifyInitData("", TOKEN).ok, false);
  assert.equal(telegramAuth.verifyInitData("a=b", TOKEN).reason, "no_hash");
});

test("session tokens verify, expire and resist tampering", function () {
  const token = telegramAuth.signToken(77, 1000, TOKEN, 5000);
  assert.equal(telegramAuth.verifyToken(token, TOKEN, 5500), 77);
  assert.equal(telegramAuth.verifyToken(token, TOKEN, 7000), null);
  assert.equal(telegramAuth.verifyToken(token, "other", 5500), null);
  assert.equal(telegramAuth.verifyToken(token.replace("77.", "78."), TOKEN, 5500), null);
  assert.equal(telegramAuth.verifyToken("junk", TOKEN), null);
  assert.equal(telegramAuth.verifyToken(undefined, TOKEN), null);
});

test("limiter blocks after max hits and recovers after the window", function () {
  let clock = 0;
  const limiter = createLimiter({ windowMs: 1000, max: 2, now: function () { return clock; } });
  assert.equal(limiter.hit("a").ok, true);
  assert.equal(limiter.hit("a").ok, true);
  const blocked = limiter.hit("a");
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterMs > 0);
  assert.equal(limiter.hit("b").ok, true);
  clock = 1500;
  assert.equal(limiter.hit("a").ok, true);
});

test("library sanitizer drops bad items, dedupes and caps sizes", function () {
  const clean = library.sanitizeLibrary({
    likes: [
      { id: "1", name: "A", artist: "B", thumbnail: "https://x.test/a.jpg", duration: "3:10" },
      { id: "1", name: "dup" },
      { id: "bad id with spaces", name: "x" },
      { id: "2", name: "N", thumbnail: "http://insecure.test/a.jpg" },
      null,
      "text"
    ],
    history: Array.from({ length: 80 }, function (_, i) { return { id: "h" + i, name: "H" + i }; }),
    playlists: [
      { id: "abcd1234", name: "Road trip", items: [{ id: "9", name: "Z" }] },
      { id: "BAD ID", name: "x", items: [] },
      { id: "efgh5678", name: "", items: [] }
    ]
  });
  assert.equal(clean.likes.length, 2);
  assert.equal(clean.likes[0].thumbnail, "https://x.test/a.jpg");
  assert.equal(clean.likes[1].thumbnail, null);
  assert.equal(clean.likes[1].artist, "Unknown artist");
  assert.equal(clean.history.length, library.LIMITS.HISTORY);
  assert.equal(clean.playlists.length, 1);
  assert.equal(clean.playlists[0].items.length, 1);
  assert.deepEqual(library.sanitizeLibrary(null), { likes: [], history: [], playlists: [] });
});
