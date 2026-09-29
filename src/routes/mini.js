"use strict";

const express = require("express");
const musicApi = require("../clients/musicApi");
const catalog = require("../services/catalog");
const trackLib = require("../lib/track");

const router = express.Router();

function serializeItem(item) {
  return {
    id: trackLib.pickId(item),
    name: trackLib.pickName(item),
    artist: trackLib.pickArtist(item)
  };
}

router.get("/search", async function (req, res) {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q) {
      res.json({ items: [] });
      return;
    }
    const result = await catalog.searchTracks(q);
    if (!result.ok) {
      res.status(502).json({ items: [], error: "upstream_unavailable" });
      return;
    }
    res.json({ items: result.items.map(serializeItem) });
  } catch (err) {
    console.error("[musicbot-mini] search proxy failed", err.message);
    res.status(500).json({ items: [], error: "search_failed" });
  }
});

router.get("/lyrics", async function (req, res) {
  try {
    const artistName = typeof req.query.artist === "string" ? req.query.artist : "";
    const title = typeof req.query.title === "string" ? req.query.title : "";
    const lyricsText = await musicApi.lyrics(artistName, title);
    res.json({ lyrics: lyricsText || null });
  } catch (err) {
    console.error("[musicbot-mini] lyrics proxy failed", err.message);
    res.status(500).json({ lyrics: null, error: "lyrics_failed" });
  }
});

router.get("/download-url", function (req, res) {
  const songId = typeof req.query.id === "string" ? req.query.id : "";
  if (!songId) {
    res.json({ url: null });
    return;
  }
  res.json({ url: musicApi.buildDownloadUrl(songId) });
});

module.exports = router;
