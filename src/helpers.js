"use strict";

function pickName(item) {
  if (!item || typeof item !== "object") {
    return "Unknown title";
  }
  return item.name || "Unknown title";
}

function pickArtist(item) {
  if (!item || typeof item !== "object") {
    return "Unknown artist";
  }
  return item.artist || "Unknown artist";
}

function pickId(item) {
  if (!item || typeof item !== "object") {
    return null;
  }
  return item.id != null ? String(item.id) : null;
}

function sanitizeFilename(text) {
  if (typeof text !== "string" || text.length === 0) {
    return "track";
  }
  return text
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "track";
}

function buildTrackFilename(name, artist) {
  const cleanName = sanitizeFilename(name);
  const cleanArtist = sanitizeFilename(artist);
  if (cleanArtist && cleanArtist !== "Unknown artist" && cleanArtist !== "track") {
    return cleanArtist + " - " + cleanName + ".mp3";
  }
  return cleanName + ".mp3";
}

function paginate(items, page, pageSize) {
  const start = page * pageSize;
  const end = Math.min(start + pageSize, items.length);
  return {
    slice: items.slice(start, end),
    start: items.length === 0 ? 0 : start + 1,
    end: end,
    total: items.length,
    hasNext: end < items.length,
    hasPrev: page > 0
  };
}

function formatUptime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return days + "d " + hours + "h " + minutes + "m " + seconds + "s";
}

function truncate(text, max) {
  if (typeof text !== "string") {
    return "";
  }
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

const PLAIN_PREFIXES = {
  play: "play",
  p: "play",
  search: "search",
  find: "search"
};

function parsePlainCommand(text) {
  if (typeof text !== "string") {
    return null;
  }
  const match = text.match(/^\s*([a-zA-Z]+)\s+(\S[\s\S]*)$/);
  if (!match) {
    return null;
  }
  const word = match[1].toLowerCase();
  const intent = PLAIN_PREFIXES[word];
  if (!intent) {
    return null;
  }
  return { intent: intent, query: match[2].trim() };
}

module.exports = {
  pickName,
  pickArtist,
  pickId,
  sanitizeFilename,
  buildTrackFilename,
  paginate,
  formatUptime,
  truncate,
  parsePlainCommand
};
