"use strict";

const express = require("express");
const api = require("../api");
const helpers = require("../helpers");

const router = express.Router();

function serializeItem(item) {
  return {
    id: helpers.pickId(item),
    name: helpers.pickName(item),
    artist: helpers.pickArtist(item)
  };
}

router.get("/search", async function (req, res) {
  try {
    const q = req.query.q || "";
    if (!q) {
      res.json({ items: [] });
      return;
    }
    const results = await api.search(q);
    res.json({ items: results.map(serializeItem) });
  } catch (err) {
    console.error("[musicbot-mini] search proxy failed", err.message);
    res.status(500).json({ items: [], error: "search_failed" });
  }
});

router.get("/lyrics", async function (req, res) {
  try {
    const artistName = req.query.artist || "";
    const title = req.query.title || "";
    const lyricsText = await api.lyrics(artistName, title);
    res.json({ lyrics: lyricsText || null });
  } catch (err) {
    console.error("[musicbot-mini] lyrics proxy failed", err.message);
    res.status(500).json({ lyrics: null, error: "lyrics_failed" });
  }
});

router.get("/download-url", function (req, res) {
  const songId = req.query.id || "";
  if (!songId) {
    res.json({ url: null });
    return;
  }
  res.json({ url: api.buildDownloadUrl(songId) });
});

module.exports = router;
