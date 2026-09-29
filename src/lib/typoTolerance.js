"use strict";

const KNOWN_WORDS = Object.freeze(["play", "search", "find"]);
const MIN_TYPED_LENGTH = 4;

function isAdjacentTransposition(typed, candidate) {
  if (typed.length !== candidate.length) {
    return false;
  }
  let i = 0;
  while (i < typed.length && typed[i] === candidate[i]) {
    i++;
  }
  if (i >= typed.length - 1) {
    return false;
  }
  if (typed[i] !== candidate[i + 1] || typed[i + 1] !== candidate[i]) {
    return false;
  }
  return typed.slice(i + 2) === candidate.slice(i + 2);
}

function isSingleInsertionOrDeletion(typed, candidate) {
  if (Math.abs(typed.length - candidate.length) !== 1) {
    return false;
  }
  const longer = typed.length > candidate.length ? typed : candidate;
  const shorter = typed.length > candidate.length ? candidate : typed;
  let i = 0;
  while (i < shorter.length && longer[i] === shorter[i]) {
    i++;
  }
  return longer.slice(i + 1) === shorter.slice(i);
}

function correctPrefix(word) {
  if (typeof word !== "string") {
    return null;
  }
  const typed = word.toLowerCase();
  if (KNOWN_WORDS.indexOf(typed) !== -1) {
    return typed;
  }
  if (typed.length < MIN_TYPED_LENGTH) {
    return null;
  }
  for (let i = 0; i < KNOWN_WORDS.length; i++) {
    const candidate = KNOWN_WORDS[i];
    if (isAdjacentTransposition(typed, candidate) || isSingleInsertionOrDeletion(typed, candidate)) {
      return candidate;
    }
  }
  return null;
}

module.exports = {
  correctPrefix,
  KNOWN_WORDS,
  MIN_TYPED_LENGTH
};
