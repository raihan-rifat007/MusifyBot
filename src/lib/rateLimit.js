"use strict";

const constants = require("../constants");

function resolveLimit(cooldownMs) {
  return typeof cooldownMs === "number" ? cooldownMs : constants.LIMITS.COOLDOWN_MS;
}

function isOnCooldown(lastActionAt, now, cooldownMs) {
  if (!lastActionAt) {
    return false;
  }
  return now - lastActionAt < resolveLimit(cooldownMs);
}

function remainingCooldownSeconds(lastActionAt, now, cooldownMs) {
  const remainingMs = resolveLimit(cooldownMs) - (now - lastActionAt);
  return Math.max(1, Math.ceil(remainingMs / 1000));
}

module.exports = {
  isOnCooldown,
  remainingCooldownSeconds
};
