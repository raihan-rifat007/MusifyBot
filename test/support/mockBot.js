"use strict";

function createMockBot() {
  const calls = [];
  let nextId = 100;

  function record(name) {
    return async function () {
      const args = Array.prototype.slice.call(arguments);
      const result = { message_id: nextId++ };
      calls.push({ name: name, args: args, result: result });
      return result;
    };
  }

  return {
    calls: calls,
    sendMessage: record("sendMessage"),
    editMessageText: record("editMessageText"),
    sendAudio: record("sendAudio"),
    sendChatAction: record("sendChatAction"),
    deleteMessage: record("deleteMessage"),
    answerCallbackQuery: record("answerCallbackQuery"),
    answerInlineQuery: record("answerInlineQuery"),
    named: function (name) {
      return calls.filter(function (call) {
        return call.name === name;
      });
    }
  };
}

module.exports = createMockBot;
