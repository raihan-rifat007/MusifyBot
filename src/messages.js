"use strict";

function welcome(firstName) {
  const name = firstName || "there";
  return [
    "🎵 Hey, " + name + "! Welcome to the Music Bot!",
    "",
    "I can search and download music for you directly in Telegram.",
    "",
    "Just type a song name — no slash needed!",
    "▶️ play shape of you or p shape of you — plays it instantly",
    "🔍 search shape of you or find shape of you — shows a pick-list",
    "",
    "📋 Use /help to see all commands",
    "",
    "Let's play some music! 🎶"
  ].join("\n");
}

function help() {
  return [
    "🎵 Music Bot — Commands",
    "",
    "▶️ /play <song name> — Instantly downloads the best match",
    "🔍 /search <song name> — Shows a list of results to pick from",
    "🚀 /start — Welcome message & getting started",
    "📋 /help — Shows this help menu",
    "",
    "💬 Shortcuts (no slash needed here):",
    "play <song> or p <song> — same as /play",
    "search <song> or find <song> — same as /search",
    "",
    "Tip: After searching, tap a song to download it, or delete the list with the button below."
  ].join("\n");
}

function searching(query) {
  return "🔍 Searching " + query + " on the music library...";
}

function searchHeader(query, start, end, total) {
  return [
    'Results for "' + query + '"',
    start + "-" + end + " of " + total,
    "",
    "Tap a track to download it, or reply with its number."
  ].join("\n");
}

function missingQueryPlain(exampleVerb) {
  return "Send a song name with that, like:\n" + exampleVerb + " shape of you";
}

function noPrefixHint() {
  return "Type play <song> to download instantly, or search <song> to see a list of matches.";
}

function audioCaption(name, artistName) {
  return name + "\n" + artistName;
}

function audioUnavailable(name) {
  return "Couldn't fetch a playable file for " + name + ". Try another track.";
}

function lyricsHeader(title, artistName) {
  return title + " - " + artistName;
}

function noResults(query) {
  return 'No results found for "' + query + '". Try a different search.';
}

function genericError() {
  return "Something went wrong on that request. Please try again in a moment.";
}

function noActiveList() {
  return "That list has expired. Start a new search with /search.";
}

function lyricsFormatHint() {
  return "Use this format:\n/lyrics <artist> - <title>\n\nExample:\n/lyrics Ed Sheeran - Perfect";
}

function lyricsNotFound() {
  return "Couldn't find lyrics for that song. Double-check the artist and title.";
}

function openingApp() {
  return "Opening the mini app.";
}

function appUnavailable() {
  return "The mini app link isn't configured yet. Set PUBLIC_URL and try again.";
}

function invalidNumber() {
  return "That number isn't in the current list. Reply with a number from the list above.";
}

function downloadFailed(name) {
  return "Download failed for " + name + ". Try again in a moment.";
}

module.exports = {
  welcome,
  help,
  searching,
  searchHeader,
  missingQueryPlain,
  noPrefixHint,
  audioCaption,
  audioUnavailable,
  lyricsHeader,
  noResults,
  genericError,
  noActiveList,
  lyricsFormatHint,
  lyricsNotFound,
  openingApp,
  appUnavailable,
  invalidNumber,
  downloadFailed
};
