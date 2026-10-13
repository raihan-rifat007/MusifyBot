"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { decodeEntities } = require("../src/lib/entities");
const trackLib = require("../src/lib/track");
const byteRange = require("../src/lib/byteRange");

test("decodes named, decimal and hex entities", function () {
  assert.equal(decodeEntities("Guzarish (From &quot;Ghajini&quot;)"), "Guzarish (From \"Ghajini\")");
  assert.equal(decodeEntities("Tom &amp; Jerry &#39;s &#x27;x&#x27;"), "Tom & Jerry 's 'x'");
  assert.equal(decodeEntities("&amp;quot;"), "\"");
  assert.equal(decodeEntities("plain"), "plain");
  assert.equal(decodeEntities("&unknown; &#0;"), "&unknown; &#0;");
  assert.equal(decodeEntities(42), 42);
});

test("track names and artists come out decoded", function () {
  assert.equal(trackLib.pickName({ name: "A &quot;B&quot;" }), "A \"B\"");
  assert.equal(trackLib.pickArtist({ artist: ["X &amp; Y", "Z"] }), "X & Y, Z");
});

test("thumbnail is picked from common shapes and upgraded", function () {
  assert.equal(trackLib.pickThumbnail({ image: "http://c.test/a-150x150.jpg" }), "https://c.test/a-500x500.jpg");
  assert.equal(trackLib.pickThumbnail({ images: [{ url: "https://c.test/s.jpg" }, { url: "https://c.test/l.jpg" }] }), "https://c.test/l.jpg");
  assert.equal(trackLib.pickThumbnail({ cover: "//c.test/c.png" }), "https://c.test/c.png");
  assert.equal(trackLib.pickThumbnail({ album: { image: "https://c.test/al.jpg" } }), "https://c.test/al.jpg");
  assert.equal(trackLib.pickThumbnail({ image: "javascript:alert(1)" }), null);
  assert.equal(trackLib.pickThumbnail({ id: 1 }), null);
  assert.equal(trackLib.toTrack({ id: 1, name: "N", image: "https://c.test/i.jpg" }).thumbnail, "https://c.test/i.jpg");
});

test("content disposition is header safe and keeps the unicode name", function () {
  const header = byteRange.buildContentDisposition("A \"q\" - song \u2713.mp3");
  assert.ok(/^attachment; filename="[\x20-\x7e]+"; filename\*=UTF-8''/.test(header));
  assert.ok(header.indexOf("%E2%9C%93") !== -1);
  assert.equal(header.split("filename=\"")[1].split("\"; filename*")[0].indexOf("\""), -1);
});
