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
    "🕘 recent — replay something you played before",
    "",
    "📋 Use /help to see all commands",
    "",
    "Let's play some music! 🎶"
  ].join("\n");
}

function help(botUsername) {
  const lines = [
    "🎵 Music Bot — Commands",
    "",
    "▶️ /play <song name> — Instantly downloads the best match",
    "🔍 /search <song name> — Shows a list of results to pick from",
    "🕘 /recent — Your last played tracks, ready to replay",
    "📝 /lyrics <artist> - <title> — Fetch lyrics",
    "📱 /app — Open the mini app",
    "🚀 /start — Welcome message & getting started",
    "📋 /help — Shows this help menu",
    "",
    "💬 Shortcuts (no slash needed here):",
    "play <song> or p <song> — same as /play",
    "search <song> or find <song> — same as /search",
    "recent or history — same as /recent"
  ];
  if (botUsername) {
    lines.push("");
    lines.push("🌐 Inline: type @" + botUsername + " <song> in any chat to send a track");
  }
  lines.push("");
  lines.push("Tip: After searching, tap a song to download it, or delete the list with the button below.");
  return lines.join("\n");
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

function recentHeader(start, end, total) {
  return [
    "🕘 Recently played",
    start + "-" + end + " of " + total,
    "",
    "Tap a track to play it again, or reply with its number."
  ].join("\n");
}

function recentEmpty() {
  return "Nothing played yet. Try: play shape of you";
}

function typoNotice(word) {
  return 'Assuming you meant "' + word + '".';
}

function missingQueryPlain(exampleVerb) {
  return "Send a song name with that, like:\n" + exampleVerb + " shape of you";
}

function noPrefixHint() {
  return "Type play <song> to download instantly, or search <song> to see a list of matches.";
}

function audioCaption(name, artistName, duration) {
  const lines = [name, artistName];
  if (duration) {
    lines.push("⏱ " + duration);
  }
  return lines.join("\n");
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

function serviceUnavailable() {
  return "The music service isn't responding right now. Try again in a moment.";
}

function genericError() {
  return "Something went wrong on that request. Please try again in a moment.";
}

function noActiveList() {
  return "That list has expired. Start a new search with /search.";
}

function noActiveTrack() {
  return "No active track. Play a song first.";
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

function fileTooLarge(limitMb) {
  return "That track is bigger than the " + limitMb + " MB limit this bot allows.";
}

function uploadFailed(name, url) {
  return "Couldn't send " + name + " through Telegram.\n\nDirect link:\n" + url;
}

function cooldown(seconds) {
  return "⏳ Easy there — try again in " + seconds + "s.";
}

function busy() {
  return "⏳ Still sending your last track. One at a time!";
}

function serverBusy() {
  return "🔥 The bot is busy with other downloads right now. Try again in a few seconds.";
}

module.exports = {
  welcome,
  help,
  searching,
  searchHeader,
  recentHeader,
  recentEmpty,
  typoNotice,
  missingQueryPlain,
  noPrefixHint,
  audioCaption,
  audioUnavailable,
  lyricsHeader,
  noResults,
  serviceUnavailable,
  genericError,
  noActiveList,
  noActiveTrack,
  lyricsFormatHint,
  lyricsNotFound,
  openingApp,
  appUnavailable,
  invalidNumber,
  downloadFailed,
  fileTooLarge,
  uploadFailed,
  cooldown,
  busy,
  serverBusy
};
