"use strict";

const express = require("express");
const config = require("../config");

function createWebhookRouter(bot) {
  const router = express.Router();

  router.post("/" + config.webhookSecret, function (req, res) {
    try {
      bot.processUpdate(req.body);
      res.sendStatus(200);
    } catch (err) {
      console.error("[musicbot] webhook processing failed", err.message);
      res.sendStatus(200);
    }
  });

  return router;
}

module.exports = createWebhookRouter;
