"use strict";

process.env.MINI_APP_PATH = "/my-app";
process.env.BOT_USERNAME = "@MusifyTestBot";

const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const config = require("../src/config");
const docsPage = require("../src/services/docsPage");

function extractForwardingScript(html) {
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  return match ? match[1] : "";
}

function runForwardingScript(html, hash) {
  const replaced = [];
  const sandbox = {
    window: {
      location: {
        hash: hash,
        replace: function (url) {
          replaced.push(url);
        }
      }
    }
  };
  vm.runInNewContext(extractForwardingScript(html), sandbox);
  return replaced;
}

test("the docs page fills in the bot button and the configured Mini App path", function () {
  const html = docsPage.renderDocs();
  assert.equal(html.indexOf("{{"), -1);
  assert.ok(html.indexOf('href="https://t.me/MusifyTestBot"') !== -1);
  assert.ok(html.indexOf('href="/my-app"') !== -1);
  assert.ok(html.indexOf("Type a song name.") !== -1);
});

test("without a bot username the Open in Telegram button is left out", function () {
  const original = config.botUsername;
  config.botUsername = "";
  try {
    const html = docsPage.renderDocs();
    assert.equal(html.indexOf("t.me"), -1);
    assert.equal(html.indexOf("{{"), -1);
  } finally {
    config.botUsername = original;
  }
});

test("the bot username is URL-encoded inside the link", function () {
  const original = config.botUsername;
  config.botUsername = 'a"b<c';
  try {
    const html = docsPage.renderDocs();
    assert.ok(html.indexOf("https://t.me/a%22b%3Cc") !== -1);
    assert.equal(html.indexOf('a"b<c'), -1);
  } finally {
    config.botUsername = original;
  }
});

test("a root URL opened as a Mini App forwards to the app and keeps the launch parameters", function () {
  const html = docsPage.renderDocs();
  const hash = "#tgWebAppData=query_id%3DAAH&tgWebAppVersion=7.0&tgWebAppPlatform=android";
  assert.deepEqual(runForwardingScript(html, hash), ["/my-app" + hash]);
  assert.deepEqual(runForwardingScript(html, "#tgWebAppVersion=7.0"), ["/my-app#tgWebAppVersion=7.0"]);
});

test("ordinary visits to the docs page are not forwarded", function () {
  const html = docsPage.renderDocs();
  assert.deepEqual(runForwardingScript(html, ""), []);
  assert.deepEqual(runForwardingScript(html, "#commands"), []);
  assert.deepEqual(runForwardingScript(html, "#inline"), []);
});
