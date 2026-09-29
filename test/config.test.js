"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const KEYS = [
  "PORT",
  "PUBLIC_URL",
  "BOT_USERNAME",
  "MINI_APP_PATH",
  "DOCS_PATH",
  "MUSIC_API_BASE",
  "COOLDOWN_MS",
  "MAX_CONCURRENT_DOWNLOADS",
  "MAX_AUDIO_MB",
  "SYNC_BOT_PROFILE"
];

function loadConfig(env) {
  const saved = {};
  KEYS.forEach(function (key) {
    saved[key] = process.env[key];
    delete process.env[key];
  });
  Object.keys(env || {}).forEach(function (key) {
    process.env[key] = env[key];
  });
  delete require.cache[require.resolve("../src/config")];
  try {
    return require("../src/config");
  } finally {
    KEYS.forEach(function (key) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    });
    delete require.cache[require.resolve("../src/config")];
  }
}

test("defaults apply when nothing is set", function () {
  const config = loadConfig({});
  assert.equal(config.port, 10000);
  assert.equal(config.miniAppPath, "/app");
  assert.equal(config.docsPath, "/docs");
  assert.equal(config.apiBase, "https://raihan07-musicapi.vercel.app");
  assert.equal(config.cooldownMs, 3000);
  assert.equal(config.maxConcurrentDownloads, 3);
  assert.equal(config.maxAudioBytes, 20 * 1048576);
  assert.equal(config.syncBotProfile, true);
  assert.equal(config.webhookPath, "/webhook/changeme");
});

test("route paths accept simple values and drop trailing slashes", function () {
  assert.equal(loadConfig({ MINI_APP_PATH: "/my-app/" }).miniAppPath, "/my-app");
  assert.equal(loadConfig({ MINI_APP_PATH: "/tools/music_app" }).miniAppPath, "/tools/music_app");
  assert.equal(loadConfig({ DOCS_PATH: "/help" }).docsPath, "/help");
});

test("unsafe or unusable route paths fall back to the defaults", function () {
  ["/", "//evil", "app", "/a b", '/x"><script>', "/a?b=1", ""].forEach(function (value) {
    assert.equal(loadConfig({ MINI_APP_PATH: value }).miniAppPath, "/app", JSON.stringify(value));
    assert.equal(loadConfig({ DOCS_PATH: value }).docsPath, "/docs", JSON.stringify(value));
  });
});

test("numeric settings respect zero, reject junk and enforce minimums", function () {
  assert.equal(loadConfig({ COOLDOWN_MS: "0" }).cooldownMs, 0);
  assert.equal(loadConfig({ COOLDOWN_MS: "abc" }).cooldownMs, 3000);
  assert.equal(loadConfig({ COOLDOWN_MS: "-50" }).cooldownMs, 0);
  assert.equal(loadConfig({ MAX_CONCURRENT_DOWNLOADS: "0" }).maxConcurrentDownloads, 1);
  assert.equal(loadConfig({ MAX_CONCURRENT_DOWNLOADS: "5" }).maxConcurrentDownloads, 5);
  assert.equal(loadConfig({ MAX_AUDIO_MB: "5" }).maxAudioBytes, 5 * 1048576);
  assert.equal(loadConfig({ PORT: "8080" }).port, 8080);
  assert.equal(loadConfig({ PORT: "nope" }).port, 10000);
});

test("urls and usernames are normalised", function () {
  assert.equal(loadConfig({ MUSIC_API_BASE: "https://api.test///" }).apiBase, "https://api.test");
  assert.equal(loadConfig({ PUBLIC_URL: "https://bot.test/" }).publicUrl, "https://bot.test");
  assert.equal(loadConfig({ BOT_USERNAME: "@abc_bot" }).botUsername, "abc_bot");
});

test("the profile sync switch understands common truthy and falsy values", function () {
  assert.equal(loadConfig({ SYNC_BOT_PROFILE: "false" }).syncBotProfile, false);
  assert.equal(loadConfig({ SYNC_BOT_PROFILE: "0" }).syncBotProfile, false);
  assert.equal(loadConfig({ SYNC_BOT_PROFILE: "yes" }).syncBotProfile, true);
  assert.equal(loadConfig({ SYNC_BOT_PROFILE: "TRUE" }).syncBotProfile, true);
  assert.equal(loadConfig({ SYNC_BOT_PROFILE: "" }).syncBotProfile, true);
});
