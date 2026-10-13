"use strict";

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

function chunkText(text, maxLength) {
  const limit = maxLength || 4000;
  if (typeof text !== "string" || text.length === 0) {
    return [];
  }
  const chunks = [];
  let current = "";
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > limit) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let offset = 0; offset < line.length; offset += limit) {
        chunks.push(line.slice(offset, offset + limit));
      }
      continue;
    }
    const candidate = current ? current + "\n" + line : line;
    if (candidate.length > limit) {
      chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) {
    chunks.push(current);
  }
  return chunks;
}

module.exports = {
  formatUptime,
  truncate,
  paginate,
  chunkText
};
