"use strict";

const { decodeEntities } = require("./entities");

function cleanString(value) {
  return typeof value === "string" ? decodeEntities(value).trim() : "";
}

const THUMBNAIL_KEYS = ["thumbnail", "thumb", "image", "images", "cover", "coverUrl", "cover_url", "artwork", "albumArt", "album_art", "poster", "picture", "img", "icon"];

function readImageCandidate(value, depth) {
  if (typeof value === "string") {
    return value.trim();
  }
  if (depth > 2 || value === null || value === undefined) {
    return "";
  }
  if (Array.isArray(value)) {
    for (let i = value.length - 1; i >= 0; i--) {
      const found = readImageCandidate(value[i], depth + 1);
      if (found) {
        return found;
      }
    }
    return "";
  }
  if (typeof value === "object") {
    const keys = ["url", "link", "src", "large", "medium", "small"];
    for (let i = 0; i < keys.length; i++) {
      const found = readImageCandidate(value[keys[i]], depth + 1);
      if (found) {
        return found;
      }
    }
  }
  return "";
}

function normalizeImageUrl(raw) {
  if (typeof raw !== "string" || raw.length === 0) {
    return null;
  }
  let url = raw.trim();
  if (url.indexOf("//") === 0) {
    url = "https:" + url;
  }
  if (!/^https?:\/\//i.test(url)) {
    return null;
  }
  url = url.replace(/^http:\/\//i, "https://");
  url = url.replace(/(\d{2,4})x(\d{2,4})(\.(?:jpe?g|png|webp))/i, function (whole, w, h, ext) {
    return w === h && parseInt(w, 10) < 500 ? "500x500" + ext : whole;
  });
  return url;
}

function pickThumbnail(item) {
  if (!item || typeof item !== "object") {
    return null;
  }
  for (let i = 0; i < THUMBNAIL_KEYS.length; i++) {
    const normalized = normalizeImageUrl(readImageCandidate(item[THUMBNAIL_KEYS[i]], 0));
    if (normalized) {
      return normalized;
    }
  }
  if (item.album && typeof item.album === "object") {
    const fromAlbum = normalizeImageUrl(readImageCandidate(item.album.image || item.album.cover || item.album.thumbnail, 0));
    if (fromAlbum) {
      return fromAlbum;
    }
  }
  return null;
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
    duration: pickDuration(item),
    thumbnail: pickThumbnail(item)
  };
}

module.exports = {
  pickName,
  pickArtist,
  pickId,
  pickDuration,
  pickThumbnail,
  formatDuration,
  sanitizeFilename,
  extensionForContentType,
  buildTrackFilename,
  toTrack
};
