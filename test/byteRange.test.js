"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const byteRange = require("../src/lib/byteRange");

test("no header means full body", function () {
  assert.deepEqual(byteRange.parseRange(undefined, 100), { type: "none" });
  assert.deepEqual(byteRange.parseRange("garbage", 100), { type: "none" });
  assert.deepEqual(byteRange.parseRange("bytes=0-1,5-6", 100), { type: "none" });
});

test("explicit, open ended and suffix ranges", function () {
  assert.deepEqual(byteRange.parseRange("bytes=0-9", 100), { type: "ok", start: 0, end: 9 });
  assert.deepEqual(byteRange.parseRange("bytes=90-", 100), { type: "ok", start: 90, end: 99 });
  assert.deepEqual(byteRange.parseRange("bytes=-10", 100), { type: "ok", start: 90, end: 99 });
  assert.deepEqual(byteRange.parseRange("bytes=50-500", 100), { type: "ok", start: 50, end: 99 });
  assert.deepEqual(byteRange.parseRange("bytes=-500", 100), { type: "ok", start: 0, end: 99 });
});

test("unsatisfiable ranges", function () {
  assert.deepEqual(byteRange.parseRange("bytes=100-", 100), { type: "unsatisfiable" });
  assert.deepEqual(byteRange.parseRange("bytes=20-10", 100), { type: "unsatisfiable" });
  assert.deepEqual(byteRange.parseRange("bytes=-0", 100), { type: "unsatisfiable" });
});

function fakeRes() {
  const state = { status: 200, headers: {}, body: null };
  return {
    state: state,
    status: function (code) { state.status = code; return this; },
    setHeader: function (k, v) { state.headers[k.toLowerCase()] = v; },
    end: function (body) { state.body = body === undefined ? null : body; }
  };
}

test("sendBuffer serves 200, 206 and 416", function () {
  const buffer = Buffer.from("0123456789");

  const full = fakeRes();
  byteRange.sendBuffer({ headers: {} }, full, buffer, "audio/mpeg");
  assert.equal(full.state.status, 200);
  assert.equal(full.state.headers["content-length"], "10");
  assert.equal(full.state.headers["accept-ranges"], "bytes");
  assert.equal(full.state.body.length, 10);

  const part = fakeRes();
  byteRange.sendBuffer({ headers: { range: "bytes=2-4" } }, part, buffer, "audio/mpeg");
  assert.equal(part.state.status, 206);
  assert.equal(part.state.headers["content-range"], "bytes 2-4/10");
  assert.equal(part.state.body.toString(), "234");

  const bad = fakeRes();
  byteRange.sendBuffer({ headers: { range: "bytes=50-" } }, bad, buffer, "audio/mpeg");
  assert.equal(bad.state.status, 416);
  assert.equal(bad.state.headers["content-range"], "bytes */10");
});
