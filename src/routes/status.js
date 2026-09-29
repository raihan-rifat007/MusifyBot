"use strict";

const express = require("express");
const config = require("../config");
const format = require("../lib/format");
const sessions = require("../state/sessions");
const musicApi = require("../clients/musicApi");
const pkg = require("../../package.json");

const router = express.Router();

router.get("/", function (req, res) {
  res.json({
    status: "ok",
    bot: config.botUsername || "unconfigured",
    version: pkg.version,
    time: new Date().toISOString()
  });
});

router.get("/health", function (req, res) {
  const uptimeMs = Date.now() - config.startTime;
  res.json({
    uptime: format.formatUptime(uptimeMs),
    uptimeMs: uptimeMs
  });
});

router.get("/api/status", function (req, res) {
  const uptimeMs = Date.now() - config.startTime;
  const mem = process.memoryUsage();
  res.json({
    status: "ok",
    bot: config.botUsername || "unconfigured",
    version: pkg.version,
    uptime: format.formatUptime(uptimeMs),
    uptimeMs: uptimeMs,
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal
    },
    sessions: sessions.sessionCount(),
    upstream: musicApi.getHealth()
  });
});

module.exports = router;
