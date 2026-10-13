"use strict";

process.env.BOT_TOKEN = "123456:TEST-TOKEN";
process.env.BOT_USERNAME = "musify_test_bot";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const stubs = require("./support/stubs");
const createMockBot = require("./support/mockBot");

function fakeRouter() {
  const router = { routes: [], middleware: [] };
  ["get", "post", "put"].forEach(function (method) {
    router[method] = function (path) {
      router.routes.push({ method: method, path: path, handlers: Array.prototype.slice.call(arguments, 1) });
    };
  });
  router.use = function (fn) { router.middleware.push(fn); };
  return router;
}

function fakeExpress() {
  return {};
}
fakeExpress.Router = fakeRouter;
fakeExpress.json = function () { return function () {}; };

const routes = [
  { match: function (url) { return url === "/api/search"; }, respond: async function () {
    return { data: [{ id: 1, name: "Guzarish &quot;X&quot;", artist: "Javed Ali", image: "http://c.test/a-150x150.jpg" }] };
  } },
  { match: function (url) { return url.indexOf("/api/download/") !== -1; }, respond: async function () {
    return { data: Buffer.from("0123456789"), headers: { "content-type": "audio/mpeg" } };
  } }
];
const axiosStub = stubs.createAxiosStub(routes);
stubs.installStubs({ axios: axiosStub.module, express: fakeExpress });

const createMiniRouter = require("../src/routes/mini");
const users = require("../src/state/users");
const telegramAuth = require("../src/lib/telegramAuth");
const config = require("../src/config");

function hmac(key, data) {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function makeInitData(user) {
  const fields = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(user) };
  const check = Object.keys(fields).sort().map(function (key) { return key + "=" + fields[key]; }).join("\n");
  const params = new URLSearchParams(fields);
  params.set("hash", hmac(hmac("WebAppData", config.botToken), check).toString("hex"));
  return params.toString();
}

function fakeRes() {
  const res = { statusCode: 200, headers: {}, body: undefined, ended: false };
  res.status = function (code) { res.statusCode = code; return res; };
  res.set = function (k, v) { res.headers[k.toLowerCase()] = v; return res; };
  res.setHeader = res.set;
  res.json = function (body) { res.body = body; res.ended = true; return res; };
  res.end = function (body) { res.body = body; res.ended = true; return res; };
  return res;
}

async function invoke(router, method, path, input) {
  const req = Object.assign({ headers: {}, query: {}, params: {}, body: {}, ip: "1.1.1.1" }, input || {});
  req.get = function (name) { return req.headers[name.toLowerCase()]; };
  const res = fakeRes();
  const route = router.routes.filter(function (entry) { return entry.method === method && entry.path === path; })[0];
  assert.ok(route, method + " " + path);
  const isPublic = path === "/config" || path === "/session";
  const chain = (isPublic ? [] : router.middleware).concat(route.handlers);
  for (let i = 0; i < chain.length && !res.ended; i++) {
    let advanced = false;
    await chain[i](req, res, function () { advanced = true; });
    if (!advanced) break;
  }
  return res;
}

async function login(router, user) {
  const res = await invoke(router, "post", "/session", { body: { initData: makeInitData(user) } });
  assert.equal(res.statusCode, 200);
  return { "x-mini-token": res.body.token };
}

test.beforeEach(function () {
  users.reset();
  config.miniRequireAuth = true;
});

test("config is public and tells the client auth is required", async function () {
  const router = createMiniRouter(createMockBot());
  const res = await invoke(router, "get", "/config");
  assert.deepEqual(res.body, { authRequired: true, botUsername: "musify_test_bot" });
});

test("session rejects forged initData and issues a token for a valid one", async function () {
  const router = createMiniRouter(createMockBot());
  const forged = await invoke(router, "post", "/session", { body: { initData: "user=%7B%22id%22%3A1%7D&hash=abc" } });
  assert.equal(forged.statusCode, 401);

  const ok = await invoke(router, "post", "/session", { body: { initData: makeInitData({ id: 42, first_name: "Raihan" }) } });
  assert.equal(ok.statusCode, 200);
  assert.equal(telegramAuth.verifyToken(ok.body.token, config.botToken), 42);
  assert.equal(users.userCount(), 1);
});

test("protected routes need a token, via header or query", async function () {
  const router = createMiniRouter(createMockBot());
  const denied = await invoke(router, "get", "/search", { query: { q: "x" } });
  assert.equal(denied.statusCode, 401);

  const headers = await login(router, { id: 42, first_name: "R" });
  const viaHeader = await invoke(router, "get", "/search", { headers: headers, query: { q: "guzarish" } });
  assert.equal(viaHeader.statusCode, 200);
  assert.equal(viaHeader.body.items[0].name, "Guzarish \"X\"");
  assert.equal(viaHeader.body.items[0].thumbnail, "https://c.test/a-500x500.jpg");

  const viaQuery = await invoke(router, "get", "/prepare", { query: { t: headers["x-mini-token"], ids: "1" } });
  assert.equal(viaQuery.statusCode, 200);
});

test("with auth disabled guests can search but cannot use per-user features", async function () {
  config.miniRequireAuth = false;
  const router = createMiniRouter(createMockBot());
  const search = await invoke(router, "get", "/search", { query: { q: "guzarish" } });
  assert.equal(search.statusCode, 200);
  const library = await invoke(router, "put", "/library", { body: { likes: [] } });
  assert.equal(library.statusCode, 403);
  const send = await invoke(router, "post", "/send", { body: { id: "1", name: "A" } });
  assert.equal(send.statusCode, 403);
});

test("stream serves ranges and attaches a filename when downloading", async function () {
  const router = createMiniRouter(createMockBot());
  const headers = await login(router, { id: 42, first_name: "R" });

  const full = await invoke(router, "get", "/stream/:id", { headers: headers, params: { id: "1" } });
  assert.equal(full.statusCode, 200);
  assert.equal(full.body.length, 10);

  const part = await invoke(router, "get", "/stream/:id", { headers: Object.assign({ range: "bytes=2-4" }, headers), params: { id: "1" } });
  assert.equal(part.statusCode, 206);
  assert.equal(part.body.toString(), "234");

  const dl = await invoke(router, "get", "/stream/:id", { headers: headers, params: { id: "1" }, query: { download: "1", name: "Guzarish", artist: "Javed Ali" } });
  assert.ok(dl.headers["content-disposition"].indexOf("Javed Ali - Guzarish.mp3") !== -1);

  const bad = await invoke(router, "get", "/stream/:id", { headers: headers, params: { id: "../etc" } });
  assert.equal(bad.statusCode, 400);
});

test("send delivers the audio to the caller's own chat only", async function () {
  const bot = createMockBot();
  const router = createMiniRouter(bot);
  const headers = await login(router, { id: 42, first_name: "R" });
  const res = await invoke(router, "post", "/send", { headers: headers, body: { id: "1", name: "Guzarish", artist: "Javed Ali", userId: 999 } });
  assert.equal(res.statusCode, 200);
  const call = bot.named("sendAudio")[0];
  assert.equal(call.args[0], 42);
  assert.equal(call.args[2].title, "Guzarish");
  assert.equal(users.summary().plays, 1);

  const bad = await invoke(router, "post", "/send", { headers: headers, body: { id: "bad id" } });
  assert.equal(bad.statusCode, 400);
});

test("send maps a blocked bot to 409 and rate limits bursts", async function () {
  const bot = createMockBot();
  bot.sendAudio = async function () {
    const err = new Error("forbidden");
    err.response = { body: { error_code: 403 } };
    throw err;
  };
  const router = createMiniRouter(bot);
  const headers = await login(router, { id: 43, first_name: "R" });
  const first = await invoke(router, "post", "/send", { headers: headers, body: { id: "1", name: "A" } });
  assert.equal(first.statusCode, 409);

  let last = null;
  for (let i = 0; i < 9; i++) {
    last = await invoke(router, "post", "/send", { headers: headers, body: { id: "1", name: "A" } });
  }
  assert.equal(last.statusCode, 429);
  assert.ok(last.headers["retry-after"]);
});

test("library and shares work per user", async function () {
  const router = createMiniRouter(createMockBot());
  const headers = await login(router, { id: 42, first_name: "R" });

  const empty = await invoke(router, "get", "/library", { headers: headers });
  assert.deepEqual(empty.body, { likes: [], history: [], playlists: [] });

  const saved = await invoke(router, "put", "/library", { headers: headers, body: { likes: [{ id: "1", name: "A", artist: "B" }] } });
  assert.equal(saved.body.likes.length, 1);
  const reread = await invoke(router, "get", "/library", { headers: headers });
  assert.equal(reread.body.likes[0].id, "1");

  const other = await login(router, { id: 77, first_name: "O" });
  const otherLib = await invoke(router, "get", "/library", { headers: other });
  assert.equal(otherLib.body.likes.length, 0);

  const none = await invoke(router, "post", "/share", { headers: headers, body: { name: "x", items: [] } });
  assert.equal(none.statusCode, 400);
  const share = await invoke(router, "post", "/share", { headers: headers, body: { name: "Mix", items: [{ id: "1", name: "A" }] } });
  assert.match(share.body.link, /^https:\/\/t\.me\/musify_test_bot\?start=s_[a-f0-9]{10}$/);

  const fetched = await invoke(router, "get", "/share/:code", { headers: other, params: { code: share.body.code } });
  assert.equal(fetched.body.items[0].id, "1");
  const missing = await invoke(router, "get", "/share/:code", { headers: other, params: { code: "zzzz" } });
  assert.equal(missing.statusCode, 404);
});
