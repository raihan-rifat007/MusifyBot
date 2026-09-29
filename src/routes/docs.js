"use strict";

const express = require("express");
const docsPage = require("../services/docsPage");

const router = express.Router();

router.get("/", function (req, res, next) {
  try {
    res.type("html").send(docsPage.renderDocs());
  } catch (err) {
    console.error("[musicbot-docs] failed to render docs page", err.message);
    next(err);
  }
});

module.exports = router;
