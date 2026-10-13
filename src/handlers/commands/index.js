"use strict";

const general = require("./general");
const play = require("./play");
const search = require("./search");
const recent = require("./recent");
const lyrics = require("./lyrics");
const admin = require("./admin");

module.exports = {
  handleStart: general.handleStart,
  handleHelp: general.handleHelp,
  handleApp: general.handleApp,
  handlePlay: play.handlePlay,
  handleSearch: search.handleSearch,
  handleRecent: recent.handleRecent,
  handleLyrics: lyrics.handleLyrics,
  handleBroadcast: admin.handleBroadcast,
  handleStats: admin.handleStats,
  handleBackup: admin.handleBackup,
  handleRestoreDocument: admin.handleRestoreDocument
};
