"use strict";

const path = require("path");
const express = require("express");
const config = require("./config");
const negotiate = require("./lib/negotiate");
const docsPage = require("./services/docsPage");
const createWebhookRouter = require("./routes/webhook");
const statusRouter = require("./routes/status");
const miniRouter = require("./routes/mini");
const docsRouter = require("./routes/docs");

const PUBLIC_DIR = path.join(__dirname, "..", "public");

function createApp(bot) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use(express.static(PUBLIC_DIR, { index: false }));

  app.get("/", function (req, res, next) {
    res.vary("Accept");
    if (!negotiate.prefersHtml(req.headers.accept)) {
      next();
      return;
    }
    try {
      res.type("html").send(docsPage.renderDocs());
    } catch (err) {
      console.error("[musicbot-docs] failed to render docs page", err.message);
      next();
    }
  });

  app.use("/", statusRouter);
  app.use(config.webhookPrefix, createWebhookRouter(bot));
  app.use("/api/mini", miniRouter);
  app.use(config.docsPath, docsRouter);

  app.get(config.miniAppPath, function (req, res) {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
  });

  app.use(function (req, res) {
    res.status(404).json({ error: "not_found" });
  });

  app.use(function (err, req, res, next) {
    console.error("[musicbot] express error", err.message);
    if (res.headersSent) {
      next(err);
      return;
    }
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}

module.exports = createApp;
