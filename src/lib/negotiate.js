"use strict";

function parseAccept(header) {
  return header
    .split(",")
    .map(function (part) {
      const pieces = part.trim().split(";");
      let quality = 1;
      for (let i = 1; i < pieces.length; i++) {
        const param = pieces[i].trim().toLowerCase();
        if (param.indexOf("q=") === 0) {
          const parsed = parseFloat(param.slice(2));
          quality = Number.isNaN(parsed) ? 0 : parsed;
        }
      }
      return { type: pieces[0].trim().toLowerCase(), quality: quality };
    })
    .filter(function (entry) {
      return entry.type.length > 0;
    });
}

function explicitQuality(entries, type) {
  let best = 0;
  entries.forEach(function (entry) {
    if (entry.type === type && entry.quality > best) {
      best = entry.quality;
    }
  });
  return best;
}

function prefersHtml(acceptHeader) {
  if (typeof acceptHeader !== "string" || acceptHeader.length === 0) {
    return false;
  }
  const entries = parseAccept(acceptHeader);
  const html = explicitQuality(entries, "text/html");
  const json = explicitQuality(entries, "application/json");
  return html > 0 && html >= json;
}

module.exports = {
  prefersHtml
};
