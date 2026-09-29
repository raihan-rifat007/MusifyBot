"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const typoTolerance = require("../src/lib/typoTolerance");
const commandParser = require("../src/lib/commandParser");
const rateLimit = require("../src/lib/rateLimit");
const trackLib = require("../src/lib/track");
const format = require("../src/lib/format");
const TtlCache = require("../src/lib/ttlCache");
const negotiate = require("../src/lib/negotiate");

test("typo tolerance corrects transpositions and single insertions", function () {
  assert.equal(typoTolerance.correctPrefix("plya"), "play");
  assert.equal(typoTolerance.correctPrefix("plays"), "play");
  assert.equal(typoTolerance.correctPrefix("serach"), "search");
  assert.equal(typoTolerance.correctPrefix("seach"), "search");
  assert.equal(typoTolerance.correctPrefix("sarch"), "search");
  assert.equal(typoTolerance.correctPrefix("fnid"), "find");
  assert.equal(typoTolerance.correctPrefix("PLYA"), "play");
});

test("typo tolerance never rewrites ordinary English words", function () {
  ["pay", "lay", "plan", "fine", "fond", "kind", "wind", "hello", "pla", "p", "constructor", ""].forEach(function (word) {
    assert.equal(typoTolerance.correctPrefix(word), null, word);
  });
});

test("plain command parser handles prefixes, shortcuts and casing", function () {
  assert.deepEqual(commandParser.parsePlainCommand("play shape of you"), { intent: "play", query: "shape of you", word: "play", corrected: false });
  assert.equal(commandParser.parsePlainCommand("p shape of you").intent, "play");
  assert.equal(commandParser.parsePlainCommand("find shape of you").intent, "search");
  assert.equal(commandParser.parsePlainCommand("SEARCH Shape Of You").query, "Shape Of You");
  assert.equal(commandParser.parsePlainCommand("Play That Funky Music").query, "That Funky Music");
});

test("plain command parser flags corrected typos", function () {
  const parsed = commandParser.parsePlainCommand("plya shape of you");
  assert.equal(parsed.intent, "play");
  assert.equal(parsed.word, "play");
  assert.equal(parsed.corrected, true);
  assert.equal(parsed.query, "shape of you");
});

test("plain command parser rejects non-commands and inherited object keys", function () {
  ["hello world", "play", "p", "3", "", "constructor foo", "toString bar", "valueOf x"].forEach(function (text) {
    assert.equal(commandParser.parsePlainCommand(text), null, text);
  });
  assert.equal(commandParser.parsePlainCommand(null), null);
  assert.equal(commandParser.parsePlainCommand(42), null);
});

test("bare command parser recognises recent and history only", function () {
  assert.equal(commandParser.parseBareCommand("recent"), "recent");
  assert.equal(commandParser.parseBareCommand("  History "), "recent");
  assert.equal(commandParser.parseBareCommand("recent tracks"), null);
  assert.equal(commandParser.parseBareCommand("constructor"), null);
  assert.equal(commandParser.parseBareCommand(undefined), null);
});

test("lyrics query splits on the first spaced dash only", function () {
  assert.deepEqual(commandParser.parseLyricsQuery("Ed Sheeran - Perfect"), { artist: "Ed Sheeran", title: "Perfect" });
  assert.deepEqual(commandParser.parseLyricsQuery("Jay-Z - 99 Problems"), { artist: "Jay-Z", title: "99 Problems" });
  assert.deepEqual(commandParser.parseLyricsQuery("Ed Sheeran - Perfect - Live"), { artist: "Ed Sheeran", title: "Perfect - Live" });
  assert.equal(commandParser.parseLyricsQuery("no separator"), null);
  assert.equal(commandParser.parseLyricsQuery(" - title"), null);
  assert.equal(commandParser.parseLyricsQuery("artist - "), null);
  assert.equal(commandParser.parseLyricsQuery(null), null);
});

test("bare number detection", function () {
  assert.equal(commandParser.isBareNumber("3"), true);
  assert.equal(commandParser.isBareNumber("  12 "), true);
  assert.equal(commandParser.isBareNumber("3rd"), false);
  assert.equal(commandParser.isBareNumber(""), false);
});

test("cooldown maths uses a strict boundary and rounds remaining time up", function () {
  const now = 100000;
  assert.equal(rateLimit.isOnCooldown(0, now, 3000), false);
  assert.equal(rateLimit.isOnCooldown(now - 1000, now, 3000), true);
  assert.equal(rateLimit.isOnCooldown(now - 3000, now, 3000), false);
  assert.equal(rateLimit.isOnCooldown(now - 1, now, 0), false);
  assert.equal(rateLimit.remainingCooldownSeconds(now - 1000, now, 3000), 2);
  assert.equal(rateLimit.remainingCooldownSeconds(now - 2900, now, 3000), 1);
});

test("track accessors fall back gracefully", function () {
  assert.equal(trackLib.pickName({ name: "  Perfect " }), "Perfect");
  assert.equal(trackLib.pickName({}), "Unknown title");
  assert.equal(trackLib.pickName(null), "Unknown title");
  assert.equal(trackLib.pickArtist({ artist: "Ed Sheeran" }), "Ed Sheeran");
  assert.equal(trackLib.pickArtist({ artist: ["A", "B"] }), "A, B");
  assert.equal(trackLib.pickArtist({}), "Unknown artist");
  assert.equal(trackLib.pickId({ id: 12 }), "12");
  assert.equal(trackLib.pickId({ id: 0 }), "0");
  assert.equal(trackLib.pickId({ id: "" }), null);
  assert.equal(trackLib.pickId({}), null);
});

test("duration is only shown when the API supplies a usable value", function () {
  assert.equal(trackLib.pickDuration({ duration: 225 }), "3:45");
  assert.equal(trackLib.pickDuration({ duration: 3725 }), "1:02:05");
  assert.equal(trackLib.pickDuration({ duration: "4:03" }), "4:03");
  assert.equal(trackLib.pickDuration({ duration: "abc" }), null);
  assert.equal(trackLib.pickDuration({ duration: -5 }), null);
  assert.equal(trackLib.pickDuration({ duration: 0 }), null);
  assert.equal(trackLib.pickDuration({}), null);
  assert.equal(trackLib.pickDuration(null), null);
});

test("track filenames are clean and extension follows the content type", function () {
  assert.equal(trackLib.buildTrackFilename("Shape of You", "Ed Sheeran", "mp3"), "Ed Sheeran - Shape of You.mp3");
  assert.equal(trackLib.buildTrackFilename("Song", "Unknown artist"), "Song.mp3");
  assert.equal(trackLib.buildTrackFilename("Track/With:Bad*Chars?", 'Some"Artist', "m4a"), "SomeArtist - TrackWithBadChars.m4a");
  assert.equal(trackLib.extensionForContentType("audio/mpeg"), "mp3");
  assert.equal(trackLib.extensionForContentType("audio/mp4"), "m4a");
  assert.equal(trackLib.extensionForContentType("audio/x-m4a"), "m4a");
  assert.equal(trackLib.extensionForContentType(undefined), "mp3");
});

test("toTrack normalises an API item", function () {
  assert.deepEqual(trackLib.toTrack({ id: 7, name: "Perfect", artist: "Ed Sheeran", duration: 263 }), {
    id: "7",
    name: "Perfect",
    artist: "Ed Sheeran",
    duration: "4:23"
  });
});

test("pagination reports ranges and neighbours", function () {
  const items = Array.from({ length: 14 }, function (_, i) {
    return i;
  });
  const first = format.paginate(items, 0, 10);
  assert.equal(first.start, 1);
  assert.equal(first.end, 10);
  assert.equal(first.hasNext, true);
  assert.equal(first.hasPrev, false);
  const second = format.paginate(items, 1, 10);
  assert.equal(second.start, 11);
  assert.equal(second.end, 14);
  assert.equal(second.hasNext, false);
  assert.equal(second.hasPrev, true);
  assert.equal(format.paginate([], 0, 10).start, 0);
});

test("chunkText keeps every chunk within the limit without losing content", function () {
  assert.deepEqual(format.chunkText(""), []);
  const lines = Array.from({ length: 900 }, function (_, i) {
    return "lyric line number " + i;
  });
  const text = lines.join("\n");
  const chunks = format.chunkText(text, 4000);
  assert.ok(chunks.length > 1);
  chunks.forEach(function (chunk) {
    assert.ok(chunk.length <= 4000);
  });
  assert.equal(chunks.join("\n"), text);
  const longLine = "x".repeat(9000);
  const longChunks = format.chunkText(longLine, 4000);
  assert.equal(longChunks.length, 3);
  assert.equal(longChunks.join(""), longLine);
});

test("uptime and truncate formatting", function () {
  assert.equal(format.formatUptime(90061000), "1d 1h 1m 1s");
  assert.equal(format.truncate("abcdef", 4), "abc…");
  assert.equal(format.truncate("abc", 4), "abc");
  assert.equal(format.truncate(null, 4), "");
});

test("ttl cache expires entries and evicts the least recently used", function () {
  let clock = 1000;
  const cache = new TtlCache({ ttlMs: 100, maxEntries: 2, now: function () {
    return clock;
  } });
  cache.set("a", 1);
  cache.set("b", 2);
  assert.equal(cache.get("a"), 1);
  cache.set("c", 3);
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("a"), 1);
  assert.equal(cache.get("c"), 3);
  clock += 101;
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.size, 1);
  cache.clear();
  assert.equal(cache.size, 0);
});

test("browsers are recognised by an explicit text/html preference", function () {
  const chromeMobile = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7";
  assert.equal(negotiate.prefersHtml(chromeMobile), true);
  assert.equal(negotiate.prefersHtml("TEXT/HTML"), true);
  assert.equal(negotiate.prefersHtml("text/html, application/json"), true);
  assert.equal(negotiate.prefersHtml("application/json;q=0.5, text/html;q=0.9"), true);
});

test("API clients, monitors and missing headers keep getting JSON", function () {
  assert.equal(negotiate.prefersHtml("*/*"), false);
  assert.equal(negotiate.prefersHtml("application/json"), false);
  assert.equal(negotiate.prefersHtml("application/json, text/html;q=0.1"), false);
  assert.equal(negotiate.prefersHtml("text/html;q=0"), false);
  assert.equal(negotiate.prefersHtml(""), false);
  assert.equal(negotiate.prefersHtml(undefined), false);
  assert.equal(negotiate.prefersHtml(42), false);
});
