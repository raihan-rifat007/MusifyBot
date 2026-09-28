"use strict";

const axios = require("axios");
const config = require("./config");

const client = axios.create({
  baseURL: config.apiBase,
  timeout: 15000
});

async function search(query) {
  try {
    const res = await client.get("/api/search", { params: { query: query } });
    return Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    console.error("[musicbot] search failed", err.message);
    return [];
  }
}

async function lyrics(artistName, title) {
  try {
    const res = await client.get("/api/lyrics", { params: { artist: artistName, title: title } });
    const data = res.data;
    return data && typeof data.lyrics === "string" ? data.lyrics : null;
  } catch (err) {
    console.error("[musicbot] lyrics failed", err.message);
    return null;
  }
}

function buildDownloadUrl(songId) {
  return config.apiBase + "/api/download/" + encodeURIComponent(songId);
}

async function downloadAudioBuffer(songId, onProgress) {
  try {
    const res = await axios.get(buildDownloadUrl(songId), {
      responseType: "arraybuffer",
      timeout: 60000,
      maxContentLength: config.maxAudioBytes,
      maxBodyLength: config.maxAudioBytes,
      onDownloadProgress: typeof onProgress === "function" ? onProgress : undefined
    });
    const contentType = res.headers && res.headers["content-type"] ? res.headers["content-type"] : "audio/mpeg";
    return { buffer: Buffer.from(res.data), contentType: contentType };
  } catch (err) {
    console.error("[musicbot] downloadAudioBuffer failed", err.message);
    return null;
  }
}

module.exports = {
  search,
  lyrics,
  buildDownloadUrl,
  downloadAudioBuffer
};
