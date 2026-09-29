"use strict";

process.env.BOT_TOKEN = "test-token";
process.env.MINI_APP_PATH = "/app";

const test = require("node:test");
const assert = require("node:assert/strict");
const stubs = require("./support/stubs");

const registrations = { onText: [], on: [] };
const staticCalls = [];
const useCalls = [];

class FakeTelegramBot {
  constructor(token, options) {
    this.token = token;
    this.options = options;
  }

  onText(pattern, handler) {
    registrations.onText.push({ pattern: pattern, handler: handler });
  }

  on(event, handler) {
    registrations.on.push({ event: event, handler: handler });
  }
}

function fakeExpress() {
  const app = {
    disable: function () {},
    use: function () {
      useCalls.push(Array.prototype.slice.call(arguments));
    },
    get: function () {}
  };
  return app;
}
fakeExpress.Router = function () {
  return { get: function () {}, post: function () {} };
};
fakeExpress.static = function (dir, options) {
  staticCalls.push({ dir: dir, options: options });
  return function () {};
};
fakeExpress.json = function () {
  return function () {};
};

stubs.installStubs({
  axios: { create: function () { return { get: async function () { return { data: [] }; } }; }, get: async function () { return { data: [] }; } },
  express: fakeExpress,
  "node-telegram-bot-api": FakeTelegramBot
});

const modules = [
  "../src/config",
  "../src/constants",
  "../src/clients/musicApi",
  "../src/copy/messages",
  "../src/lib/commandParser",
  "../src/lib/format",
  "../src/lib/rateLimit",
  "../src/lib/track",
  "../src/lib/ttlCache",
  "../src/lib/typoTolerance",
  "../src/services/catalog",
  "../src/services/listing",
  "../src/services/lyrics",
  "../src/services/playback",
  "../src/state/sessions",
  "../src/handlers/callbacks",
  "../src/handlers/commands",
  "../src/handlers/inline",
  "../src/handlers/plainText",
  "../src/routes/docs",
  "../src/routes/mini",
  "../src/routes/status",
  "../src/routes/webhook",
  "../src/app",
  "../src/bot"
];

test("every module loads without throwing", function () {
  modules.forEach(function (name) {
    assert.doesNotThrow(function () {
      require(name);
    }, name);
  });
});

test("the bot registers every command, message, callback and inline handler", function () {
  const createBot = require("../src/bot");
  const bot = createBot();
  assert.equal(bot.options.webHook, false);
  assert.equal(registrations.onText.length, 7);
  const events = registrations.on.map(function (entry) {
    return entry.event;
  });
  ["message", "callback_query", "inline_query", "webhook_error"].forEach(function (event) {
    assert.ok(events.indexOf(event) !== -1, event);
  });
});

test("command patterns match exactly the intended messages", function () {
  const patterns = registrations.onText.map(function (entry) {
    return entry.pattern;
  });
  function matching(text) {
    return patterns.filter(function (pattern) {
      return pattern.test(text);
    }).length;
  }
  assert.equal(matching("/start"), 1);
  assert.equal(matching("/start payload123"), 1);
  assert.equal(matching("/help@MyBot"), 1);
  assert.equal(matching("/play shape of you"), 1);
  assert.equal(matching("/play"), 1);
  assert.equal(matching("/play@MyBot shape of you"), 1);
  assert.equal(matching("/search shape of you"), 1);
  assert.equal(matching("/recent"), 1);
  assert.equal(matching("/lyrics Ed Sheeran - Perfect"), 1);
  assert.equal(matching("/app"), 1);
  assert.equal(matching("/playlist foo"), 0);
  assert.equal(matching("/recently"), 0);
  assert.equal(matching("/startup"), 0);
  assert.equal(matching("hello"), 0);
});

test("a crashing handler is contained instead of becoming an unhandled rejection", async function () {
  const playEntry = registrations.onText.filter(function (entry) {
    return entry.pattern.test("/play x");
  })[0];
  playEntry.handler({}, ["/play x", "x"]);
  await new Promise(function (resolve) {
    setTimeout(resolve, 20);
  });
});

test("the express app serves static files without shadowing the status route", function () {
  const createApp = require("../src/app");
  const app = createApp({ processUpdate: function () {} });
  assert.ok(app);
  assert.equal(staticCalls.length, 1);
  assert.equal(staticCalls[0].options.index, false);
  const mounted = useCalls.map(function (args) {
    return args[0];
  }).filter(function (first) {
    return typeof first === "string";
  });
  assert.ok(mounted.indexOf("/") !== -1);
  assert.ok(mounted.indexOf("/webhook") !== -1);
  assert.ok(mounted.indexOf("/api/mini") !== -1);
  assert.ok(mounted.indexOf("/docs") !== -1);
});
