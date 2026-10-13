"use strict";

function parseRange(header, total) {
  if (typeof header !== "string" || header.length === 0 || total <= 0) {
    return { type: "none" };
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === "" && match[2] === "")) {
    return { type: "none" };
  }
  if (match[1] === "") {
    const suffix = parseInt(match[2], 10);
    if (!(suffix > 0)) {
      return { type: "unsatisfiable" };
    }
    return { type: "ok", start: Math.max(0, total - suffix), end: total - 1 };
  }
  const start = parseInt(match[1], 10);
  const requestedEnd = match[2] === "" ? total - 1 : parseInt(match[2], 10);
  const end = Math.min(requestedEnd, total - 1);
  if (start >= total || start > end) {
    return { type: "unsatisfiable" };
  }
  return { type: "ok", start: start, end: end };
}

function buildContentDisposition(filename) {
  const fallback = String(filename).replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return "attachment; filename=\"" + fallback + "\"; filename*=UTF-8''" + encodeURIComponent(filename);
}

function sendBuffer(req, res, buffer, contentType, filename) {
  const total = buffer.length;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "private, max-age=900");
  if (filename) {
    res.setHeader("Content-Disposition", buildContentDisposition(filename));
  }

  const range = parseRange(req.headers.range, total);

  if (range.type === "unsatisfiable") {
    res.status(416);
    res.setHeader("Content-Range", "bytes */" + total);
    res.end();
    return;
  }

  if (range.type === "ok") {
    res.status(206);
    res.setHeader("Content-Range", "bytes " + range.start + "-" + range.end + "/" + total);
    res.setHeader("Content-Length", String(range.end - range.start + 1));
    res.end(buffer.subarray(range.start, range.end + 1));
    return;
  }

  res.status(200);
  res.setHeader("Content-Length", String(total));
  res.end(buffer);
}

module.exports = {
  parseRange,
  buildContentDisposition,
  sendBuffer
};
