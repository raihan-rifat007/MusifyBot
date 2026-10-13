"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const users = require("../src/state/users");

test.beforeEach(function () {
  users.reset();
});

test("touch records users, ignores bots and tracks activity windows", function () {
  const day = 86400000;
  users.touch({ id: 1, first_name: "A", username: "a" }, 1000 * day);
  users.touch({ id: 2, first_name: "B" }, 1000 * day - 3 * day);
  users.touch({ id: 3, is_bot: true, first_name: "Bot" }, 1000 * day);
  users.touch(null);
  const summary = users.summary(1000 * day + 1000);
  assert.equal(summary.total, 2);
  assert.equal(summary.active24h, 1);
  assert.equal(summary.active7d, 2);
  assert.equal(summary.new24h, 1);
});

test("blocked users are excluded from recipients and come back when they return", function () {
  users.touch({ id: 10, first_name: "X" });
  users.touch({ id: 11, first_name: "Y" });
  users.markBlocked(10);
  assert.deepEqual(users.listRecipientIds(), [11]);
  assert.equal(users.summary().blocked, 1);
  users.touch({ id: 10, first_name: "X" });
  assert.deepEqual(users.listRecipientIds().sort(), [10, 11]);
});

test("search and play counters feed the top query list", function () {
  users.recordSearch("Guzarish");
  users.recordSearch("guzarish ");
  users.recordSearch("shape of you");
  users.recordPlay();
  assert.deepEqual(users.topQueries(2), [{ query: "guzarish", count: 2 }, { query: "shape of you", count: 1 }]);
  assert.equal(users.summary().searches, 3);
  assert.equal(users.summary().plays, 1);
});

test("library is stored per user and sanitised", function () {
  users.setLibrary(5, { likes: [{ id: "1", name: "A" }, { id: "bad id" }] });
  assert.equal(users.getLibrary(5).likes.length, 1);
  assert.equal(users.getLibrary(6).likes.length, 0);
});

test("shares round trip and reject malformed codes", function () {
  const code = users.createShare(5, { name: "Mix", items: [{ id: "1", name: "A" }, { id: "x y" }] });
  assert.match(code, /^[a-f0-9]{10}$/);
  const share = users.getShare(code);
  assert.equal(share.name, "Mix");
  assert.equal(share.items.length, 1);
  assert.equal(users.getShare("nope"), null);
  assert.equal(users.getShare("0000000000"), null);
});

test("data persists to disk, reloads, and survives export and import", function () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "musify-"));
  const file = path.join(dir, "nested", "data.json");

  users.init(file);
  users.touch({ id: 7, first_name: "Persist" });
  users.recordSearch("lofi");
  assert.equal(users.flush(), true);

  users.init(file);
  assert.equal(users.userCount(), 1);
  assert.equal(users.topQueries(1)[0].query, "lofi");

  const backup = users.exportJson();
  users.reset();
  assert.equal(users.userCount(), 0);
  const summary = users.importJson(backup);
  assert.equal(summary.total, 1);
  assert.throws(function () { users.importJson("{\"nope\":true}"); });
  assert.throws(function () { users.importJson("not json"); });

  fs.rmSync(dir, { recursive: true, force: true });
});

test("a corrupt data file starts empty instead of crashing", function () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "musify-"));
  const file = path.join(dir, "data.json");
  fs.writeFileSync(file, "{broken");
  users.init(file);
  assert.equal(users.userCount(), 0);
  fs.rmSync(dir, { recursive: true, force: true });
});
