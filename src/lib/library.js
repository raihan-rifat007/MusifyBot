"use strict";

const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,80}$/;
const LIMITS = Object.freeze({
  LIKES: 200,
  HISTORY: 30,
  PLAYLISTS: 20,
  PLAYLIST_ITEMS: 100,
  NAME: 150,
  PLAYLIST_NAME: 40
});

function clip(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanItem(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const id = typeof raw.id === "string" || typeof raw.id === "number" ? String(raw.id).trim() : "";
  if (!ID_PATTERN.test(id)) {
    return null;
  }
  const thumbnail = clip(raw.thumbnail, 500);
  return {
    id: id,
    name: clip(raw.name, LIMITS.NAME) || "Unknown title",
    artist: clip(raw.artist, LIMITS.NAME) || "Unknown artist",
    thumbnail: /^https:\/\//i.test(thumbnail) ? thumbnail : null,
    duration: clip(raw.duration, 12) || null
  };
}

function cleanItems(list, max) {
  const out = [];
  const seen = new Set();
  const source = Array.isArray(list) ? list : [];
  for (let i = 0; i < source.length && out.length < max; i++) {
    const item = cleanItem(source[i]);
    if (item && !seen.has(item.id)) {
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

function cleanPlaylists(list) {
  const out = [];
  const seen = new Set();
  const source = Array.isArray(list) ? list : [];
  for (let i = 0; i < source.length && out.length < LIMITS.PLAYLISTS; i++) {
    const raw = source[i];
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const id = typeof raw.id === "string" && /^[a-z0-9]{4,24}$/.test(raw.id) ? raw.id : "";
    const name = clip(raw.name, LIMITS.PLAYLIST_NAME);
    if (!id || !name || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push({ id: id, name: name, items: cleanItems(raw.items, LIMITS.PLAYLIST_ITEMS) });
  }
  return out;
}

function sanitizeLibrary(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    likes: cleanItems(source.likes, LIMITS.LIKES),
    history: cleanItems(source.history, LIMITS.HISTORY),
    playlists: cleanPlaylists(source.playlists)
  };
}

module.exports = {
  LIMITS,
  ID_PATTERN,
  cleanItem,
  cleanItems,
  sanitizeLibrary
};
