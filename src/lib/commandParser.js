"use strict";

const constants = require("../constants");
const typoTolerance = require("./typoTolerance");

const WORD_TO_INTENT = new Map([
  ["play", constants.INTENT.PLAY],
  ["p", constants.INTENT.PLAY],
  ["search", constants.INTENT.SEARCH],
  ["find", constants.INTENT.SEARCH]
]);

const BARE_WORD_TO_INTENT = new Map([
  ["recent", constants.INTENT.RECENT],
  ["history", constants.INTENT.RECENT]
]);

function parsePlainCommand(text) {
  if (typeof text !== "string") {
    return null;
  }
  const match = text.match(/^\s*([a-zA-Z]+)\s+(\S[\s\S]*)$/);
  if (!match) {
    return null;
  }
  const typed = match[1].toLowerCase();
  let word = WORD_TO_INTENT.has(typed) ? typed : null;
  let corrected = false;
  if (!word) {
    const fixed = typoTolerance.correctPrefix(typed);
    if (fixed && WORD_TO_INTENT.has(fixed)) {
      word = fixed;
      corrected = true;
    }
  }
  if (!word) {
    return null;
  }
  return {
    intent: WORD_TO_INTENT.get(word),
    query: match[2].trim(),
    word: word,
    corrected: corrected
  };
}

function parseBareCommand(text) {
  if (typeof text !== "string") {
    return null;
  }
  return BARE_WORD_TO_INTENT.get(text.trim().toLowerCase()) || null;
}

function parseLyricsQuery(raw) {
  if (typeof raw !== "string") {
    return null;
  }
  const separatorIndex = raw.indexOf(" - ");
  if (separatorIndex === -1) {
    return null;
  }
  const artist = raw.slice(0, separatorIndex).trim();
  const title = raw.slice(separatorIndex + 3).trim();
  if (!artist || !title) {
    return null;
  }
  return { artist: artist, title: title };
}

function isBareNumber(text) {
  return typeof text === "string" && /^\s*\d+\s*$/.test(text);
}

module.exports = {
  parsePlainCommand,
  parseBareCommand,
  parseLyricsQuery,
  isBareNumber
};
