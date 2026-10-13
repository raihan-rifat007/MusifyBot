"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const stubs = require("./support/stubs");

stubs.installStubs({ axios: { create: function () { return { get: async function () { return { data: [] }; } }; }, get: async function () { return { data: [] }; } } });
const { createStreamCache } = require("../src/services/streamCache");
stubs.restoreStubs();

function audio(size) {
  return { ok: true, buffer: Buffer.alloc(size, 1), contentType: "audio/mpeg" };
}

function deferred() {
  let resolve;
  const promise = new Promise(function (r) { resolve = r; });
  return { promise: promise, resolve: resolve };
}

test("prepare starts one download per id and reports state", async function () {
  let calls = 0;
  const gate = deferred();
  const cache = createStreamCache({
    maxParallel: 2,
    download: async function () { calls += 1; await gate.promise; return audio(10); }
  });

  assert.equal(cache.prepare("a"), "loading");
  assert.equal(cache.prepare("a"), "loading");
  assert.equal(calls, 1);

  gate.resolve();
  const result = await cache.getAudio("a");
  assert.equal(result.ok, true);
  assert.equal(result.buffer.length, 10);
  assert.equal(cache.prepare("a"), "ready");
  assert.equal(calls, 1);
});

test("getAudio waits for an in-flight prepare instead of downloading twice", async function () {
  let calls = 0;
  const gate = deferred();
  const cache = createStreamCache({
    download: async function () { calls += 1; await gate.promise; return audio(5); }
  });
  cache.prepare("x");
  const pending = cache.getAudio("x");
  gate.resolve();
  const result = await pending;
  assert.equal(result.ok, true);
  assert.equal(calls, 1);
});

test("parallel downloads are capped and the rest queue", async function () {
  let running = 0;
  let peak = 0;
  const gate = deferred();
  const cache = createStreamCache({
    maxParallel: 2,
    download: async function () {
      running += 1;
      peak = Math.max(peak, running);
      await gate.promise;
      running -= 1;
      return audio(1);
    }
  });
  ["1", "2", "3", "4", "5"].forEach(function (id) { cache.prepare(id); });
  await new Promise(function (r) { setImmediate(r); });
  assert.equal(peak, 2);
  gate.resolve();
  const all = await Promise.all(["1", "2", "3", "4", "5"].map(function (id) { return cache.getAudio(id); }));
  assert.ok(all.every(function (r) { return r.ok; }));
  assert.equal(peak, 2);
});

test("failures surface a reason and retry only after the cooldown", async function () {
  let clock = 1000;
  let calls = 0;
  const cache = createStreamCache({
    now: function () { return clock; },
    retryAfterMs: 5000,
    download: async function () { calls += 1; return calls === 1 ? { ok: false, reason: "too_large" } : audio(3); }
  });

  const first = await cache.getAudio("t");
  assert.deepEqual(first, { ok: false, reason: "too_large" });
  assert.equal(cache.prepare("t"), "failed");

  clock += 1000;
  const early = await cache.getAudio("t");
  assert.equal(early.ok, false);
  assert.equal(calls, 1);

  clock += 5000;
  const retried = await cache.getAudio("t");
  assert.equal(retried.ok, true);
  assert.equal(calls, 2);
});

test("a throwing download becomes a failed entry", async function () {
  const cache = createStreamCache({ download: async function () { throw new Error("boom"); } });
  const result = await cache.getAudio("z");
  assert.deepEqual(result, { ok: false, reason: "failed" });
});

test("entries expire and are evicted by count and bytes", async function () {
  let clock = 0;
  const cache = createStreamCache({
    now: function () { return clock; },
    ttlMs: 1000,
    maxEntries: 2,
    maxTotalBytes: 1000,
    download: async function () { return audio(400); }
  });

  await cache.getAudio("a");
  await cache.getAudio("b");
  await cache.getAudio("c");
  assert.ok(cache.stats().entries <= 2);
  assert.ok(cache.stats().bytes <= 1000);
  assert.equal(cache.prepare("c"), "ready");

  clock += 2000;
  assert.equal(cache.prepare("c"), "loading");
});
