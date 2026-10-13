"use strict";

const crypto = require("crypto");

function hmac(key, data) {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function safeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch (err) {
    return false;
  }
}

function verifyInitData(initData, botToken, options) {
  const opts = options || {};
  const maxAgeSec = opts.maxAgeSec || 86400;
  const nowSec = opts.nowSec || Math.floor(Date.now() / 1000);

  if (typeof initData !== "string" || initData.length === 0 || initData.length > 4096 || !botToken) {
    return { ok: false, reason: "missing" };
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    return { ok: false, reason: "no_hash" };
  }
  params.delete("hash");

  const pairs = [];
  params.forEach(function (value, key) {
    pairs.push(key + "=" + value);
  });
  pairs.sort();

  const secret = hmac("WebAppData", botToken);
  const computed = hmac(secret, pairs.join("\n")).toString("hex");
  if (!safeEqualHex(computed, hash)) {
    return { ok: false, reason: "bad_hash" };
  }

  const authDate = parseInt(params.get("auth_date"), 10);
  if (!Number.isFinite(authDate) || nowSec - authDate > maxAgeSec || authDate - nowSec > 300) {
    return { ok: false, reason: "expired" };
  }

  let user = null;
  try {
    user = JSON.parse(params.get("user") || "null");
  } catch (err) {
    user = null;
  }
  if (!user || typeof user.id !== "number") {
    return { ok: false, reason: "no_user" };
  }

  return { ok: true, user: user, startParam: params.get("start_param") || null };
}

function tokenKey(botToken) {
  return hmac("musify-mini-session", botToken);
}

function signToken(userId, ttlMs, botToken, nowMs) {
  const expires = (nowMs || Date.now()) + ttlMs;
  const body = String(userId) + "." + expires;
  const sig = hmac(tokenKey(botToken), body).toString("hex");
  return body + "." + sig;
}

function verifyToken(token, botToken, nowMs) {
  if (typeof token !== "string" || token.length > 200 || !botToken) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const userId = parseInt(parts[0], 10);
  const expires = parseInt(parts[1], 10);
  if (!Number.isFinite(userId) || !Number.isFinite(expires) || expires < (nowMs || Date.now())) {
    return null;
  }
  const expected = hmac(tokenKey(botToken), parts[0] + "." + parts[1]).toString("hex");
  return safeEqualHex(expected, parts[2]) ? userId : null;
}

module.exports = {
  verifyInitData,
  signToken,
  verifyToken
};
