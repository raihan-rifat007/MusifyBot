"use strict";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function pickName(item) {
  if (!item || typeof item !== "object") {
    return "Unknown title";
  }
  return cleanString(item.name) || "Unknown title";
}

function pickArtist(item) {
  if (!item || typeof item !== "object") {
    return "Unknown artist";
  }
  if (Array.isArray(item.artist)) {
    const joined = item.artist.map(cleanString).filter(Boolean).join(", ");
    return joined || "Unknown artist";
  }
  return cleanString(item.artist) || "Unknown artist";
}

function pickId(item) {
  if (!item || typeof item !== "object" || item.id === null || item.id === undefined) {
    return null;
  }
  const id = String(item.id).trim();
  return id.length > 0 ? id : null;
}

function formatDuration(totalSeconds) {
  const seconds = Math.round(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = function (value) {
    return String(value).padStart(2, "0");
  };
  return hours > 0 ? hours + ":" + pad(minutes) + ":" + pad(rest) : minutes + ":" + pad(rest);
}

function pickDuration(item) {
  if (!item || typeof item !== "object") {
    return null;
  }
  const raw = item.duration;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return formatDuration(raw);
  }
  if (typeof raw === "string" && /^\d{1,2}(:\d{2}){1,2}$/.test(raw.trim())) {
    return raw.trim();
  }
  return null;
}

function sanitizeFilename(value) {
  const cleaned = cleanString(value)
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return cleaned || "track";
}

function extensionForContentType(contentType) {
  if (typeof contentType !== "string") {
    return "mp3";
  }
  const lower = contentType.toLowerCase();
  if (lower.indexOf("mp4") !== -1 || lower.indexOf("m4a") !== -1 || lower.indexOf("aac") !== -1) {
    return "m4a";
  }
  return "mp3";
}

function buildTrackFilename(name, artist, extension) {
  const cleanName = sanitizeFilename(name);
  const cleanArtist = sanitizeFilename(artist);
  const ext = extension || "mp3";
  if (cleanArtist !== "track" && cleanArtist !== "Unknown artist") {
    return cleanArtist + " - " + cleanName + "." + ext;
  }
  return cleanName + "." + ext;
}

function toTrack(item) {
  return {
    id: pickId(item),
    name: pickName(item),
    artist: pickArtist(item),
    duration: pickDuration(item)
  };
}

module.exports = {
  pickName,
  pickArtist,
  pickId,
  pickDuration,
  formatDuration,
  sanitizeFilename,
  extensionForContentType,
  buildTrackFilename,
  toTrack
};
