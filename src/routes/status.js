"use strict";

const express = require("express");
const config = require("../config");
const helpers = require("../helpers");
const sessions = require("../sessions");

const router = express.Router();

router.get("/", function (req, res) {
  res.json({
    status: "ok",
    bot: config.botUsername || "unconfigured",
    time: new Date().toISOString()
  });
});

router.get("/health", function (req, res) {
  const uptimeMs = Date.now() - config.startTime;
  res.json({
    uptime: helpers.formatUptime(uptimeMs),
    uptimeMs: uptimeMs
  });
});

router.get("/api/status", function (req, res) {
  const uptimeMs = Date.now() - config.startTime;
  const mem = process.memoryUsage();
  res.json({
    status: "ok",
    bot: config.botUsername || "unconfigured",
    uptime: helpers.formatUptime(uptimeMs),
    uptimeMs: uptimeMs,
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal
    },
    sessions: sessions.sessionCount(),
    apiBase: config.apiBase
  });
});

module.exports = router;
