"use strict";

const axios = require("axios");
const config = require("../config");

const http = axios.create({
  baseURL: config.apiBase,
  timeout: 15000
});

const health = { lastOkAt: 0, lastErrorAt: 0, lastOutcome: null };

function markOk() {
  health.lastOkAt = Date.now();
  health.lastOutcome = "ok";
}

function markFailure(err) {
  if (err && err.response && err.response.status < 500) {
    markOk();
    return;
  }
  health.lastErrorAt = Date.now();
  health.lastOutcome = "error";
}

function getHealth() {
  let status = "unknown";
  if (health.lastOutcome === "ok") {
    status = "ok";
  } else if (health.lastOutcome === "error") {
    status = "degraded";
  }
  return {
    status: status,
    lastOkAt: health.lastOkAt || null,
    lastErrorAt: health.lastErrorAt || null
  };
}

async function search(query) {
  try {
    const res = await http.get("/api/search", { params: { query: query } });
    markOk();
    return { ok: true, items: Array.isArray(res.data) ? res.data : [] };
  } catch (err) {
    if (err && err.response && err.response.status === 404) {
      markOk();
      return { ok: true, items: [] };
    }
    markFailure(err);
    console.error("[musicbot] search failed", err.message);
    return { ok: false, items: [] };
  }
}

async function lyrics(artistName, title) {
  try {
    const res = await http.get("/api/lyrics", { params: { artist: artistName, title: title } });
    markOk();
    const data = res.data;
    if (data && typeof data.lyrics === "string" && data.lyrics.trim().length > 0) {
      return data.lyrics;
    }
    return null;
  } catch (err) {
    markFailure(err);
    console.error("[musicbot] lyrics failed", err.message);
    return null;
  }
}

function buildDownloadUrl(songId) {
  return config.apiBase + "/api/download/" + encodeURIComponent(songId);
}

async function downloadAudioBuffer(songId) {
  try {
    const res = await axios.get(buildDownloadUrl(songId), {
      responseType: "arraybuffer",
      timeout: 60000,
      maxContentLength: config.maxAudioBytes,
      maxBodyLength: config.maxAudioBytes
    });
    const contentType = res.headers && res.headers["content-type"] ? res.headers["content-type"] : "audio/mpeg";
    const buffer = Buffer.isBuffer(res.data) ? res.data : Buffer.from(res.data);
    if (buffer.length === 0 || /json|html|text/i.test(contentType)) {
      markFailure(null);
      console.error("[musicbot] download returned a non-audio payload", contentType);
      return { ok: false, reason: "failed" };
    }
    markOk();
    return { ok: true, buffer: buffer, contentType: contentType };
  } catch (err) {
    markFailure(err);
    const tooLarge = typeof err.message === "string" && err.message.indexOf("maxContentLength") !== -1;
    console.error("[musicbot] download failed", err.message);
    return { ok: false, reason: tooLarge ? "too_large" : "failed" };
  }
}

module.exports = {
  search,
  lyrics,
  buildDownloadUrl,
  downloadAudioBuffer,
  getHealth
};
