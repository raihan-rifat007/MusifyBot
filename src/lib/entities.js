"use strict";

const NAMED = {
  quot: "\"",
  amp: "&",
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " "
};

function decodeEntities(value) {
  if (typeof value !== "string" || value.indexOf("&") === -1) {
    return value;
  }
  let current = value;
  for (let pass = 0; pass < 2; pass++) {
    const next = current.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, function (whole, body) {
      if (body.charAt(0) === "#") {
        const isHex = body.charAt(1) === "x" || body.charAt(1) === "X";
        const code = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
        if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) {
          return whole;
        }
        try {
          return String.fromCodePoint(code);
        } catch (err) {
          return whole;
        }
      }
      const named = NAMED[body.toLowerCase()];
      return named === undefined ? whole : named;
    });
    if (next === current) {
      break;
    }
    current = next;
  }
  return current;
}

module.exports = {
  decodeEntities
};
