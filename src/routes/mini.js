"use strict";

const express = require("express");
const config = require("../config");
const musicApi = require("../clients/musicApi");
const catalog = require("../services/catalog");
const trackLib = require("../lib/track");
const streamCache = require("../services/streamCache");
const byteRange = require("../lib/byteRange");
const telegramAuth = require("../lib/telegramAuth");
const librarySanitizer = require("../lib/library");
const users = require("../state/users");
const TtlCache = require("../lib/ttlCache");
const { createLimiter } = require("../lib/limiter");

const ID_PATTERN = librarySanitizer.ID_PATTERN;
const MAX_PREPARE_IDS = 5;
const SESSION_TTL_MS = 12 * 3600 * 1000;

function serializeItem(item) {
  return {
    id: trackLib.pickId(item),
    name: trackLib.pickName(item),
    artist: trackLib.pickArtist(item),
    thumbnail: trackLib.pickThumbnail(item),
    duration: trackLib.pickDuration(item)
  };
}

function createMiniRouter(bot) {
  const router = express.Router();

  const sessionLimiter = createLimiter({ windowMs: 60000, max: 20 });
  const generalLimiter = createLimiter({ windowMs: 60000, max: 300 });
  const searchLimiter = createLimiter({ windowMs: 60000, max: 40 });
  const sendLimiter = createLimiter({ windowMs: 60000, max: 8 });
  const lyricsCache = new TtlCache({ ttlMs: 600000, maxEntries: 100 });

  function rateLimited(limiter) {
    return function (req, res, next) {
      const key = req.miniUser && req.miniUser.id ? "u" + req.miniUser.id : "ip" + req.ip;
      const verdict = limiter.hit(key);
      if (!verdict.ok) {
        res.set("Retry-After", String(Math.ceil(verdict.retryAfterMs / 1000)));
        res.status(429).json({ error: "rate_limited" });
        return;
      }
      next();
    };
  }

  function authenticate(req, res, next) {
    const header = req.get("x-mini-token");
    const token = header || (typeof req.query.t === "string" ? req.query.t : "");
    const userId = telegramAuth.verifyToken(token, config.botToken);
    if (userId) {
      req.miniUser = { id: userId, guest: false };
      next();
      return;
    }
    if (!config.miniRequireAuth) {
      req.miniUser = { id: 0, guest: true };
      next();
      return;
    }
    res.status(401).json({ error: "unauthorized" });
  }

  router.get("/config", function (req, res) {
    res.json({
      authRequired: config.miniRequireAuth,
      botUsername: config.botUsername || null
    });
  });

  router.post("/session", rateLimited(sessionLimiter), function (req, res) {
    const initData = req.body && typeof req.body.initData === "string" ? req.body.initData : "";
    const verified = telegramAuth.verifyInitData(initData, config.botToken);
    if (!verified.ok) {
      if (!config.miniRequireAuth) {
        res.json({ token: null, guest: true });
        return;
      }
      res.status(401).json({ error: "unauthorized", reason: verified.reason });
      return;
    }
    users.touch({ id: verified.user.id, first_name: verified.user.first_name, username: verified.user.username, is_bot: false });
    res.json({
      token: telegramAuth.signToken(verified.user.id, SESSION_TTL_MS, config.botToken),
      expiresAt: Date.now() + SESSION_TTL_MS,
      user: { id: verified.user.id, firstName: verified.user.first_name || "" },
      startParam: verified.startParam
    });
  });

  router.use(authenticate);
  router.use(rateLimited(generalLimiter));

  router.get("/search", rateLimited(searchLimiter), async function (req, res) {
    try {
      const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
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
      const artistName = typeof req.query.artist === "string" ? req.query.artist.slice(0, 150) : "";
      const title = typeof req.query.title === "string" ? req.query.title.slice(0, 150) : "";
      if (!title) {
        res.json({ lyrics: null });
        return;
      }
      const key = (artistName + "|" + title).toLowerCase();
      const cached = lyricsCache.get(key);
      if (cached !== undefined && cached !== null) {
        res.json({ lyrics: cached.text });
        return;
      }
      const lyricsText = await musicApi.lyrics(artistName, title);
      if (lyricsText) {
        lyricsCache.set(key, { text: lyricsText });
      }
      res.json({ lyrics: lyricsText || null });
    } catch (err) {
      console.error("[musicbot-mini] lyrics proxy failed", err.message);
      res.status(500).json({ lyrics: null, error: "lyrics_failed" });
    }
  });

  router.get("/prepare", function (req, res) {
    const raw = typeof req.query.ids === "string" ? req.query.ids : "";
    const ids = [];
    raw.split(",").forEach(function (part) {
      const id = part.trim();
      if (ID_PATTERN.test(id) && ids.indexOf(id) === -1 && ids.length < MAX_PREPARE_IDS) {
        ids.push(id);
      }
    });
    const states = {};
    ids.forEach(function (id) {
      states[id] = streamCache.prepare(id);
    });
    res.set("Cache-Control", "no-store");
    res.json({ states: states });
  });

  router.get("/stream/:id", async function (req, res) {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    if (!ID_PATTERN.test(id)) {
      res.status(400).json({ error: "bad_id" });
      return;
    }
    try {
      const audio = await streamCache.getAudio(id);
      if (!audio.ok) {
        res.status(audio.reason === "too_large" ? 413 : 502).json({ error: audio.reason });
        return;
      }
      let filename = null;
      if (req.query.download === "1") {
        const name = typeof req.query.name === "string" ? req.query.name.slice(0, 200) : "";
        const artist = typeof req.query.artist === "string" ? req.query.artist.slice(0, 200) : "";
        filename = trackLib.buildTrackFilename(name, artist, trackLib.extensionForContentType(audio.contentType));
      }
      byteRange.sendBuffer(req, res, audio.buffer, audio.contentType, filename);
    } catch (err) {
      console.error("[musicbot-mini] stream failed", err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: "stream_failed" });
      }
    }
  });

  router.post("/send", rateLimited(sendLimiter), async function (req, res) {
    if (!req.miniUser.id) {
      res.status(403).json({ error: "login_required" });
      return;
    }
    const item = librarySanitizer.cleanItem(req.body);
    if (!item) {
      res.status(400).json({ error: "bad_track" });
      return;
    }
    try {
      const audio = await streamCache.getAudio(item.id);
      if (!audio.ok) {
        res.status(audio.reason === "too_large" ? 413 : 502).json({ error: audio.reason });
        return;
      }
      const filename = trackLib.buildTrackFilename(item.name, item.artist, trackLib.extensionForContentType(audio.contentType));
      await bot.sendAudio(
        req.miniUser.id,
        audio.buffer,
        { title: item.name, performer: item.artist },
        { filename: filename, contentType: audio.contentType }
      );
      users.recordPlay();
      res.json({ ok: true });
    } catch (err) {
      const code = err && err.response && err.response.body ? err.response.body.error_code : 0;
      console.error("[musicbot-mini] send to chat failed", err.message);
      if (!res.headersSent) {
        res.status(code === 403 ? 409 : 502).json({ error: code === 403 ? "bot_blocked" : "send_failed" });
      }
    }
  });

  router.get("/library", function (req, res) {
    res.set("Cache-Control", "no-store");
    res.json(req.miniUser.id ? users.getLibrary(req.miniUser.id) : librarySanitizer.sanitizeLibrary(null));
  });

  router.put("/library", function (req, res) {
    if (!req.miniUser.id) {
      res.status(403).json({ error: "login_required" });
      return;
    }
    res.json(users.setLibrary(req.miniUser.id, req.body));
  });

  router.post("/share", function (req, res) {
    if (!req.miniUser.id) {
      res.status(403).json({ error: "login_required" });
      return;
    }
    const items = librarySanitizer.cleanItems(req.body && req.body.items, librarySanitizer.LIMITS.PLAYLIST_ITEMS);
    if (items.length === 0) {
      res.status(400).json({ error: "empty" });
      return;
    }
    const name = req.body && typeof req.body.name === "string" && req.body.name.trim() ? req.body.name : "Shared";
    const code = users.createShare(req.miniUser.id, { name: name, items: items });
    res.json({
      code: code,
      link: config.botUsername ? "https://t.me/" + config.botUsername + "?start=s_" + code : null
    });
  });

  router.get("/share/:code", function (req, res) {
    const share = users.getShare(req.params.code);
    if (!share) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(share);
  });

  return router;
}

module.exports = createMiniRouter;
module.exports.serializeItem = serializeItem;
