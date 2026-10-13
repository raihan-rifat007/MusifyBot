"use strict";

process.env.ADMIN_IDS = "1001, 1002";
process.env.PUBLIC_URL = "https://musify.test";

const test = require("node:test");
const assert = require("node:assert/strict");
const stubs = require("./support/stubs");
const createMockBot = require("./support/mockBot");

const routes = [];
const axiosStub = stubs.createAxiosStub(routes);
stubs.installStubs({ axios: axiosStub.module });

const users = require("../src/state/users");
const broadcast = require("../src/services/broadcast");
const admin = require("../src/handlers/commands/admin");
const general = require("../src/handlers/commands/general");

function telegramError(code, extra) {
  const err = new Error("ETELEGRAM " + code);
  err.response = { body: Object.assign({ error_code: code }, extra || {}) };
  return err;
}

function adminMsg(text, extra) {
  return Object.assign({ chat: { id: 1001, type: "private" }, from: { id: 1001 }, text: text }, extra || {});
}

test.beforeEach(function () {
  users.reset();
  users.touch({ id: 11, first_name: "A" });
  users.touch({ id: 12, first_name: "B" });
  users.touch({ id: 13, first_name: "C" });
});

test("broadcast.run counts sent, blocked and failed and marks blocked users", async function () {
  const bot = createMockBot();
  bot.sendMessage = async function (chatId) {
    if (chatId === 12) throw telegramError(403);
    if (chatId === 13) throw new Error("network");
    return { message_id: 1 };
  };
  const result = await broadcast.run(bot, [11, 12, 13], { kind: "text", text: "hi" }, { gapMs: 0, sleep: async function () {} });
  assert.equal(result.sent, 1);
  assert.equal(result.blocked, 1);
  assert.equal(result.failed, 1);
  assert.deepEqual(users.listRecipientIds().sort(), [11, 13]);
});

test("broadcast.run waits and retries once on 429", async function () {
  const bot = createMockBot();
  let calls = 0;
  const waits = [];
  bot.sendMessage = async function () {
    calls += 1;
    if (calls === 1) throw telegramError(429, { parameters: { retry_after: 2 } });
    return { message_id: 1 };
  };
  const result = await broadcast.run(bot, [11], { kind: "text", text: "hi" }, { gapMs: 0, sleep: async function (ms) { waits.push(ms); } });
  assert.equal(result.sent, 1);
  assert.equal(calls, 2);
  assert.ok(waits[0] >= 2000);
});

test("broadcast.run copies a message for copy payloads and honours cancellation", async function () {
  const bot = createMockBot();
  const control = { cancelled: false };
  const result = await broadcast.run(bot, [11, 12, 13], { kind: "copy", fromChatId: 1001, messageId: 55 }, {
    gapMs: 1,
    control: control,
    sleep: async function () { control.cancelled = true; }
  });
  assert.equal(bot.named("copyMessage").length, 1);
  assert.deepEqual(bot.named("copyMessage")[0].args, [11, 1001, 55]);
  assert.equal(result.cancelled, true);
  assert.equal(result.sent, 1);
});

test("non admins cannot broadcast, see stats or take backups", async function () {
  const bot = createMockBot();
  const stranger = { chat: { id: 5 }, from: { id: 5 }, text: "/broadcast hi" };
  await admin.handleBroadcast(bot, stranger, "hi");
  await admin.handleStats(bot, stranger);
  await admin.handleBackup(bot, stranger);
  assert.equal(bot.named("sendMessage").length, 3);
  assert.equal(bot.named("sendDocument").length, 0);
  assert.equal(bot.named("copyMessage").length, 0);
});

test("broadcast without text shows usage and with no users refuses", async function () {
  const bot = createMockBot();
  await admin.handleBroadcast(bot, adminMsg("/broadcast"), "");
  assert.ok(bot.named("sendMessage")[0].args[1].indexOf("/broadcast <message>") !== -1);
  users.reset();
  await admin.handleBroadcast(bot, adminMsg("/broadcast hi"), "hi");
  assert.ok(bot.named("sendMessage")[1].args[1].indexOf("kono user") !== -1);
});

test("full broadcast flow: preview, confirm button, send to everyone, summary", async function () {
  const bot = createMockBot();
  await admin.handleBroadcast(bot, adminMsg("/broadcast New features coming soon"), "New features coming soon");

  const sent = bot.named("sendMessage");
  assert.equal(sent[0].args[1], "New features coming soon");
  const confirm = sent[1];
  const keyboard = confirm.args[2].reply_markup.inline_keyboard[0];
  assert.equal(keyboard.length, 2);
  assert.ok(confirm.args[1].indexOf("3 jon") !== -1);

  const goData = keyboard[0].callback_data;
  assert.match(goData, /^bc:go:[a-f0-9]{8}$/);

  const recipients = [];
  const realSend = bot.sendMessage;
  bot.sendMessage = async function (chatId, text) {
    recipients.push(chatId);
    return realSend.apply(bot, arguments);
  };

  const query = { id: "q1", data: goData, from: { id: 1001 }, message: { chat: { id: 1001 }, message_id: 900 } };
  await admin.handleBroadcastCallback(bot, query);

  assert.deepEqual(recipients.sort(), [11, 12, 13]);
  const edits = bot.named("editMessageText");
  const last = edits[edits.length - 1].args[0];
  assert.ok(last.indexOf("Broadcast shesh") !== -1);
  assert.ok(last.indexOf("Pathano hoyeche: 3") !== -1);

  await admin.handleBroadcastCallback(bot, query);
  assert.ok(bot.named("answerCallbackQuery").pop().args[1].text.indexOf("expire") !== -1);
});

test("cancel button drops the pending broadcast and a stranger cannot confirm", async function () {
  const bot = createMockBot();
  await admin.handleBroadcast(bot, adminMsg("/broadcast hello"), "hello");
  const keyboard = bot.named("sendMessage")[1].args[2].reply_markup.inline_keyboard[0];

  const stranger = { id: "q0", data: keyboard[0].callback_data, from: { id: 999 }, message: { chat: { id: 999 }, message_id: 1 } };
  await admin.handleBroadcastCallback(bot, stranger);
  assert.equal(bot.named("answerCallbackQuery")[0].args[1].text, "Ei command ta shudhu admin der jonno.");

  const cancel = { id: "q2", data: keyboard[1].callback_data, from: { id: 1001 }, message: { chat: { id: 1001 }, message_id: 900 } };
  await admin.handleBroadcastCallback(bot, cancel);
  assert.ok(bot.named("editMessageText").pop().args[0].indexOf("batil") !== -1);

  const late = { id: "q3", data: keyboard[0].callback_data, from: { id: 1001 }, message: { chat: { id: 1001 }, message_id: 900 } };
  await admin.handleBroadcastCallback(bot, late);
  assert.equal(bot.named("copyMessage").length, 0);
});

test("replying to a message broadcasts that message as a copy", async function () {
  const bot = createMockBot();
  await admin.handleBroadcast(bot, adminMsg("/broadcast", { reply_to_message: { message_id: 321 } }), "");
  assert.equal(bot.named("copyMessage").length, 1);
  const keyboard = bot.named("sendMessage")[0].args[2].reply_markup.inline_keyboard[0];
  const query = { id: "q", data: keyboard[0].callback_data, from: { id: 1001 }, message: { chat: { id: 1001 }, message_id: 7 } };
  await admin.handleBroadcastCallback(bot, query);
  assert.equal(bot.named("copyMessage").length, 4);
});

test("stats and backup are sent to admins", async function () {
  const bot = createMockBot();
  users.recordSearch("lofi");
  await admin.handleStats(bot, adminMsg("/stats"));
  const text = bot.named("sendMessage")[0].args[1];
  assert.ok(text.indexOf("Total user: 3") !== -1);
  assert.ok(text.indexOf("1. lofi (1)") !== -1);

  await admin.handleBackup(bot, adminMsg("/backup"));
  const doc = bot.named("sendDocument")[0];
  assert.equal(doc.args[0], 1001);
  assert.ok(Buffer.isBuffer(doc.args[1]));
  assert.match(doc.args[3].filename, /^musify-backup-\d{4}-\d{2}-\d{2}\.json$/);
});

test("restore replaces the store from an uploaded backup and ignores other documents", async function () {
  const bot = createMockBot();
  const backup = users.exportJson();
  users.reset();
  routes.push({
    match: function (url) { return url === "https://files.test/backup.json"; },
    respond: async function () { return { data: backup }; }
  });

  await admin.handleRestoreDocument(bot, adminMsg("", { caption: "random", document: { file_id: "f", file_size: 100 } }));
  assert.equal(users.userCount(), 0);
  assert.equal(bot.named("sendMessage").length, 0);

  await admin.handleRestoreDocument(bot, adminMsg("", { caption: "/restore", document: { file_id: "f", file_size: 100 } }));
  assert.equal(users.userCount(), 3);
  assert.ok(bot.named("sendMessage")[0].args[1].indexOf("Restore hoye geche") !== -1);

  await admin.handleRestoreDocument(bot, adminMsg("", { caption: "/restore", document: { file_id: "f", file_size: 99999999 } }));
  assert.ok(bot.named("sendMessage")[1].args[1].indexOf("Restore hoyni") !== -1);
});

test("start with a share payload offers a web app button and plain start still welcomes", async function () {
  const code = users.createShare(11, { name: "Road trip", items: [{ id: "1", name: "A" }] });
  const bot = createMockBot();
  await general.handleStart(bot, { chat: { id: 77 }, from: { id: 77, first_name: "Z" }, text: "/start s_" + code });
  const shared = bot.named("sendMessage")[0];
  assert.ok(shared.args[1].indexOf("Road trip") !== -1);
  assert.equal(shared.args[2].reply_markup.inline_keyboard[0][0].web_app.url, "https://musify.test/app?share=" + code);

  await general.handleStart(bot, { chat: { id: 77 }, from: { id: 77, first_name: "Z" }, text: "/start" });
  assert.ok(bot.named("sendMessage")[1].args[1].indexOf("Welcome") !== -1);
});
