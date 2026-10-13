"use strict";

const fs = require("fs");
const path = require("path");
const config = require("../config");

const TEMPLATE_PATH = path.join(__dirname, "..", "views", "docs.html");

let template = null;

function loadTemplate() {
  if (template === null) {
    template = fs.readFileSync(TEMPLATE_PATH, "utf8");
  }
  return template;
}

function buildBotButton() {
  if (!config.botUsername) {
    return "";
  }
  return '<a class="btn btn-accent" href="https://t.me/' + encodeURIComponent(config.botUsername) + '">Open in Telegram</a>';
}

function renderDocs() {
  return loadTemplate()
    .split("{{BOT_BUTTON}}")
    .join(buildBotButton())
    .split("{{MINI_APP_PATH}}")
    .join(config.miniAppPath);
}

module.exports = {
  renderDocs
};
