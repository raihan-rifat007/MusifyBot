"use strict";

process.env.COOLDOWN_MS = "0";
process.env.BOT_USERNAME = "@MusifyTestBot";

const test = require("node:test");
const assert = require("node:assert/strict");
const stubs = require("./support/stubs");
const createMockBot = require("./support/mockBot");

const routes = [];
const axiosStub = stubs.createAxiosStub(routes);
stubs.installStubs({ axios: axiosStub.module });

const sessions = require("../src/state/sessions");
const catalog = require("../src/services/catalog");
const commands = require("../src/handlers/commands");
const callbacks = require("../src/handlers/callbacks");
const plainText = require("../src/handlers/plainText");

const SONGS = Array.from({ length: 12 }, function (_, i) {
  return { id: i + 1, name: "Song " + (i + 1), artist: "Artist " + (i + 1) };
});

function isSearch(url) {
  return url === "/api/search";
}

function isDownload(url) {
  return url.indexOf("/api/download/") !== -1;
}

function isLyrics(url) {
  return url === "/api/lyrics";
}

function audioResponse() {
  return { data: Buffer.from("audio-bytes"), headers: { "content-type": "audio/mpeg" } };
}

async function filteringSearch(url, options) {
  const query = String(options.params.query || "").toLowerCase();
  return {
    data: SONGS.filter(function (song) {
      return song.name.toLowerCase().indexOf(query) !== -1;
    })
  };
}

function useRoutes(overrides) {
  const config = overrides || {};
  routes.length = 0;
  routes.push({ match: isSearch, respond: config.search || filteringSearch });
  routes.push({ match: isDownload, respond: config.download || (async function () { return audioResponse(); }) });
  routes.push({ match: isLyrics, respond: config.lyrics || (async function () { return { data: { lyrics: "line one\nline two" } }; }) });
}

function reset(overrides) {
  sessions.clearAll();
  catalog.clearCache();
  axiosStub.calls.length = 0;
  useRoutes(overrides);
}

function privateMsg(chatId, text) {
  return { chat: { id: chatId, type: "private" }, from: { first_name: "Rahim" }, text: text };
}

function groupMsg(chatId, text) {
  return { chat: { id: chatId, type: "supergroup" }, from: { first_name: "Rahim" }, text: text };
}

function callbackQuery(chatId, messageId, data) {
  return { id: "cb-" + data, data: data, message: { chat: { id: chatId }, message_id: messageId } };
}

function textsOf(bot, name) {
  return bot.named(name).map(function (call) {
    return call.args[1];
  });
}

test("play sends exactly one audio message with clean metadata and no list", async function () {
  reset();
  const bot = createMockBot();
  await commands.handlePlay(bot, privateMsg(1, "play"), "song 1");
  assert.equal(bot.named("sendAudio").length, 1);
  assert.equal(bot.named("sendMessage").length, 0);
  assert.equal(bot.named("editMessageText").length, 0);
  const audio = bot.named("sendAudio")[0];
  assert.equal(audio.args[2].title, "Song 1");
  assert.equal(audio.args[2].performer, "Artist 1");
  assert.equal(audio.args[3].filename, "Artist 1 - Song 1.mp3");
  assert.equal(bot.named("sendChatAction")[0].args[1], "upload_audio");
  assert.equal(sessions.getRecent(1)[0].id, "1");
});

test("play distinguishes an unreachable service from an empty result", async function () {
  reset({ search: async function () { throw new Error("connect ECONNREFUSED"); } });
  let bot = createMockBot();
  await commands.handlePlay(bot, privateMsg(1, "x"), "anything");
  assert.match(textsOf(bot, "sendMessage")[0], /isn't responding/);
  reset({ search: async function () { return { data: [] }; } });
  bot = createMockBot();
  await commands.handlePlay(bot, privateMsg(1, "x"), "anything");
  assert.match(textsOf(bot, "sendMessage")[0], /No results found/);
  assert.equal(bot.named("sendAudio").length, 0);
});

test("search edits the searching message into a ten item list", async function () {
  reset();
  const bot = createMockBot();
  await commands.handleSearch(bot, privateMsg(2, "search"), "song");
  assert.equal(bot.named("sendMessage").length, 1);
  assert.match(textsOf(bot, "sendMessage")[0], /Searching song/);
  const edit = bot.named("editMessageText")[0];
  assert.equal(edit.args[1].message_id, bot.named("sendMessage")[0].result.message_id);
  assert.match(edit.args[0], /1-10 of 12/);
  const rows = edit.args[1].reply_markup.inline_keyboard;
  assert.equal(rows.length, 12);
  assert.equal(rows[0][0].callback_data, "pick:0");
  assert.equal(rows[9][0].callback_data, "pick:9");
  assert.equal(rows[10][0].callback_data, "page:next");
  assert.equal(rows[11][0].callback_data, "delete");
});

test("search reports an unreachable service by editing the searching message", async function () {
  reset({ search: async function () { throw new Error("boom"); } });
  const bot = createMockBot();
  await commands.handleSearch(bot, privateMsg(2, "search"), "song");
  assert.match(bot.named("editMessageText")[0].args[0], /isn't responding/);
});

test("list buttons paginate, download and delete", async function () {
  reset();
  const bot = createMockBot();
  await commands.handleSearch(bot, privateMsg(3, "search"), "song");
  const listMessageId = bot.named("sendMessage")[0].result.message_id;

  await callbacks.handleCallbackQuery(bot, callbackQuery(3, listMessageId, "page:next"));
  const pageEdit = bot.named("editMessageText")[1];
  assert.match(pageEdit.args[0], /11-12 of 12/);
  assert.equal(pageEdit.args[1].reply_markup.inline_keyboard[0][0].callback_data, "pick:10");

  await callbacks.handleCallbackQuery(bot, callbackQuery(3, listMessageId, "pick:11"));
  assert.equal(bot.named("sendAudio").length, 1);
  assert.equal(bot.named("sendAudio")[0].args[2].title, "Song 12");

  await callbacks.handleCallbackQuery(bot, callbackQuery(3, listMessageId, "delete"));
  assert.equal(bot.named("deleteMessage")[0].args[1], listMessageId);
  assert.equal(sessions.getActiveList(3), null);
});

test("replying with a number plays that item, and stays quiet in groups", async function () {
  reset();
  const bot = createMockBot();
  await commands.handleSearch(bot, privateMsg(4, "search"), "song");
  await plainText.handlePlainMessage(bot, privateMsg(4, "3"));
  assert.equal(bot.named("sendAudio")[0].args[2].title, "Song 3");

  const quietBot = createMockBot();
  await plainText.handlePlainMessage(quietBot, groupMsg(-50, "3"));
  await plainText.handlePlainMessage(quietBot, groupMsg(-50, "just chatting"));
  assert.equal(quietBot.calls.length, 0);

  const privateBot = createMockBot();
  await plainText.handlePlainMessage(privateBot, privateMsg(99, "7"));
  assert.match(textsOf(privateBot, "sendMessage")[0], /expired/);
});

test("numbers outside the visible page are rejected", async function () {
  reset();
  const bot = createMockBot();
  await commands.handleSearch(bot, privateMsg(5, "search"), "song");
  await plainText.handlePlainMessage(bot, privateMsg(5, "11"));
  assert.equal(bot.named("sendAudio").length, 0);
  assert.match(textsOf(bot, "sendMessage")[1], /isn't in the current list/);
});

test("recent lists newest first and replays through the list", async function () {
  reset();
  const bot = createMockBot();
  await commands.handlePlay(bot, privateMsg(6, "play"), "song 1");
  sessions.setActiveList(6, { items: SONGS, page: 0, meta: { kind: "search", query: "song" } });
  await callbacks.handleCallbackQuery(bot, callbackQuery(6, 1, "pick:4"));
  await commands.handleRecent(bot, privateMsg(6, "/recent"));
  const listMessage = bot.named("sendMessage").pop();
  assert.match(listMessage.args[1], /Recently played/);
  const rows = listMessage.args[2].reply_markup.inline_keyboard;
  assert.match(rows[0][0].text, /^1\. Song 5/);
  assert.match(rows[1][0].text, /^2\. Song 1/);
  await callbacks.handleCallbackQuery(bot, callbackQuery(6, listMessage.result.message_id, "pick:1"));
  const audio = bot.named("sendAudio");
  assert.equal(audio[audio.length - 1].args[2].title, "Song 1");
  assert.equal(sessions.getRecent(6)[0].id, "1");
});

test("recent works without a slash and reports an empty history", async function () {
  reset();
  let bot = createMockBot();
  await plainText.handlePlainMessage(bot, privateMsg(7, "recent"));
  assert.match(textsOf(bot, "sendMessage")[0], /Nothing played yet/);
  await commands.handlePlay(bot, privateMsg(7, "play"), "song 2");
  bot = createMockBot();
  await plainText.handlePlainMessage(bot, privateMsg(7, "History"));
  assert.match(textsOf(bot, "sendMessage")[0], /Recently played/);
});

test("typos in shortcuts are corrected with a visible notice", async function () {
  reset();
  const bot = createMockBot();
  await plainText.handlePlainMessage(bot, privateMsg(8, "plya song 1"));
  assert.equal(textsOf(bot, "sendMessage")[0], 'Assuming you meant "play".');
  assert.equal(bot.named("sendAudio").length, 1);

  const searchBot = createMockBot();
  await plainText.handlePlainMessage(searchBot, privateMsg(8, "serach song"));
  assert.equal(textsOf(searchBot, "sendMessage")[0], 'Assuming you meant "search".');
  assert.equal(searchBot.named("editMessageText").length, 1);
});

test("shortcuts route to play and search without a slash", async function () {
  reset();
  const bot = createMockBot();
  await plainText.handlePlainMessage(bot, privateMsg(9, "p song 3"));
  assert.equal(bot.named("sendAudio")[0].args[2].title, "Song 3");
  await plainText.handlePlainMessage(bot, privateMsg(9, "find song"));
  assert.equal(bot.named("editMessageText").length, 1);
});

test("unrecognised chatter gets a hint in private chats only", async function () {
  reset();
  const privateBot = createMockBot();
  await plainText.handlePlainMessage(privateBot, privateMsg(10, "hello there"));
  assert.match(textsOf(privateBot, "sendMessage")[0], /Type play/);
  const groupBot = createMockBot();
  await plainText.handlePlainMessage(groupBot, groupMsg(-10, "hello there"));
  assert.equal(groupBot.calls.length, 0);
});

test("a bare play command remembers what the next plain message means", async function () {
  reset();
  const bot = createMockBot();
  await commands.handlePlay(bot, privateMsg(11, "/play"), "");
  assert.match(textsOf(bot, "sendMessage")[0], /Send a song name/);
  await plainText.handlePlainMessage(bot, privateMsg(11, "song 4"));
  assert.equal(bot.named("sendAudio")[0].args[2].title, "Song 4");
  assert.equal(sessions.getAwaitingIntent(11), null);
});

test("the lyrics button resolves the track belonging to the tapped message", async function () {
  reset();
  const bot = createMockBot();
  await commands.handlePlay(bot, privateMsg(12, "play"), "song 1");
  await commands.handlePlay(bot, privateMsg(12, "play"), "song 2");
  const audio = bot.named("sendAudio");
  const firstAudioMessageId = audio[0].result.message_id;
  axiosStub.calls.length = 0;
  await callbacks.handleCallbackQuery(bot, callbackQuery(12, firstAudioMessageId, "lyrics"));
  const lyricsCall = axiosStub.calls.filter(function (call) {
    return call.url === "/api/lyrics";
  })[0];
  assert.equal(lyricsCall.options.params.title, "Song 1");
  assert.equal(lyricsCall.options.params.artist, "Artist 1");
});

test("long lyrics are split into several Telegram-sized messages", async function () {
  const lines = Array.from({ length: 900 }, function (_, i) {
    return "lyric line number " + i;
  }).join("\n");
  reset({ lyrics: async function () { return { data: { lyrics: lines } }; } });
  const bot = createMockBot();
  await commands.handleLyrics(bot, privateMsg(13, "/lyrics"), "Ed Sheeran - Perfect");
  const messages = textsOf(bot, "sendMessage");
  assert.ok(messages.length >= 3);
  messages.forEach(function (text) {
    assert.ok(text.length <= 4000);
  });
  assert.match(messages[0], /^Perfect - Ed Sheeran/);
});

test("lyrics keep hyphenated artist names intact and validate the format", async function () {
  reset();
  const bot = createMockBot();
  await commands.handleLyrics(bot, privateMsg(14, "/lyrics"), "Jay-Z - 99 Problems");
  const call = axiosStub.calls.filter(function (entry) {
    return entry.url === "/api/lyrics";
  })[0];
  assert.equal(call.options.params.artist, "Jay-Z");
  assert.equal(call.options.params.title, "99 Problems");
  const hintBot = createMockBot();
  await commands.handleLyrics(hintBot, privateMsg(14, "/lyrics"), "missing separator");
  assert.match(textsOf(hintBot, "sendMessage")[0], /Use this format/);
});

test("lyrics that cannot be found are reported once", async function () {
  reset({ lyrics: async function () { return { data: {} }; } });
  const bot = createMockBot();
  await commands.handleLyrics(bot, privateMsg(15, "/lyrics"), "A - B");
  assert.equal(bot.named("sendMessage").length, 1);
  assert.match(textsOf(bot, "sendMessage")[0], /Couldn't find lyrics/);
});

test("captions include the duration only when the API provides one", async function () {
  reset({ search: async function () { return { data: [{ id: 1, name: "Timed", artist: "A", duration: 225 }] }; } });
  let bot = createMockBot();
  await commands.handlePlay(bot, privateMsg(16, "play"), "timed");
  assert.equal(bot.named("sendAudio")[0].args[2].caption, "Timed\nA\n⏱ 3:45");
  reset({ search: async function () { return { data: [{ id: 2, name: "Plain", artist: "A" }] }; } });
  bot = createMockBot();
  await commands.handlePlay(bot, privateMsg(16, "play"), "plain");
  assert.equal(bot.named("sendAudio")[0].args[2].caption, "Plain\nA");
});

test("oversized and invalid downloads produce specific messages", async function () {
  reset({ download: async function () { throw new Error("maxContentLength size of 20971520 exceeded"); } });
  let bot = createMockBot();
  await commands.handlePlay(bot, privateMsg(17, "play"), "song 1");
  assert.match(textsOf(bot, "sendMessage")[0], /20 MB limit/);
  reset({ download: async function () { return { data: Buffer.from("{}"), headers: { "content-type": "application/json" } }; } });
  bot = createMockBot();
  await commands.handlePlay(bot, privateMsg(17, "play"), "song 1");
  assert.match(textsOf(bot, "sendMessage")[0], /Download failed/);
  assert.equal(sessions.getRecent(17).length, 0);
});

test("a failed Telegram upload falls back to a direct link and frees the lock", async function () {
  reset();
  const bot = createMockBot();
  bot.sendAudio = async function () {
    throw new Error("wrong file identifier");
  };
  await commands.handlePlay(bot, privateMsg(18, "play"), "song 1");
  assert.match(textsOf(bot, "sendMessage")[0], /Direct link/);
  assert.equal(sessions.isLocked(18), false);
  assert.equal(sessions.getRecent(18).length, 0);
});

test("a second request while a download is running is refused as busy", async function () {
  let release;
  const blocker = new Promise(function (resolve) {
    release = resolve;
  });
  reset({ download: async function () {
    await blocker;
    return audioResponse();
  } });
  const bot = createMockBot();
  const first = commands.handlePlay(bot, privateMsg(19, "play"), "song 1");
  await new Promise(function (resolve) {
    setTimeout(resolve, 30);
  });
  await commands.handlePlay(bot, privateMsg(19, "play"), "song 2");
  const busy = textsOf(bot, "sendMessage").filter(function (text) {
    return text.indexOf("Still sending") !== -1;
  });
  assert.equal(busy.length, 1);
  release();
  await first;
  assert.equal(bot.named("sendAudio").length, 1);
  assert.equal(sessions.isLocked(19), false);
});

test("start greets by first name and help lists the inline hint", async function () {
  reset();
  const bot = createMockBot();
  await commands.handleStart(bot, privateMsg(20, "/start"));
  assert.match(textsOf(bot, "sendMessage")[0], /Hey, Rahim!/);
  await commands.handleHelp(bot, privateMsg(20, "/help"));
  const help = textsOf(bot, "sendMessage")[1];
  assert.match(help, /\/recent/);
  assert.match(help, /@MusifyTestBot/);
});
