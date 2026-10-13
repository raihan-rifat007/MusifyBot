"use strict";

function notAdmin() {
  return "Ei command ta shudhu admin der jonno.";
}

function broadcastUsage() {
  return [
    "Broadcast korar niyom:",
    "",
    "/broadcast <message> - sobai ke text pathabe",
    "Kono message e reply dye /broadcast likhle oi message ta (photo, audio, button shoho) copy hoye jabe",
    "",
    "Pathanor age preview ar confirm button ashbe."
  ].join("\n");
}

function noRecipients() {
  return "Ekhono kono user save hoyni, tai broadcast kora jabe na.";
}

function broadcastBusy() {
  return "Ekta broadcast already cholche. Shesh howar jonno wait koro ba stop button chap.";
}

function broadcastConfirm(total) {
  return "Upore preview dekhlen. Ei message ta " + total + " jon user ke pathabo. Confirm korbe?";
}

function broadcastExpired() {
  return "Ei confirm request ta expire hoye geche. Abar /broadcast dao.";
}

function broadcastStarted(done, total) {
  return "Pathano cholche: " + done + "/" + total;
}

function broadcastDone(result) {
  const seconds = Math.max(1, Math.round((result.durationMs || 0) / 1000));
  return [
    result.cancelled ? "Broadcast bondho kora hoyeche." : "Broadcast shesh.",
    "",
    "Total: " + result.total,
    "Pathano hoyeche: " + result.sent,
    "Block/inactive: " + result.blocked,
    "Failed: " + result.failed,
    "Shomoy: " + seconds + " second"
  ].join("\n");
}

function broadcastCancelled() {
  return "Broadcast batil kora hoyeche.";
}

function stats(info) {
  const lines = [
    "Musify stats",
    "",
    "Total user: " + info.users.total,
    "Active (24 ghonta): " + info.users.active24h,
    "Active (7 din): " + info.users.active7d,
    "Notun (24 ghonta): " + info.users.new24h,
    "Block korechhe: " + info.users.blocked,
    "",
    "Total search: " + info.users.searches,
    "Total play: " + info.users.plays,
    "",
    "Mini app cache: " + info.cache.entries + " track, " + info.cache.mb + " MB",
    "Music API: " + info.apiStatus,
    "Uptime: " + info.uptime
  ];
  if (info.top.length > 0) {
    lines.push("");
    lines.push("Top search:");
    info.top.forEach(function (row, index) {
      lines.push((index + 1) + ". " + row.query + " (" + row.count + ")");
    });
  }
  return lines.join("\n");
}

function backupCaption(count) {
  return "Musify backup. " + count + " jon user. Restore korte ei file ta pathiye caption e /restore likho.";
}

function restoreDone(summary) {
  return "Restore hoye geche. Total user: " + summary.total + ", search: " + summary.searches + ", play: " + summary.plays + ".";
}

function restoreFailed() {
  return "Restore hoyni. File ta Musify backup JSON kina check koro.";
}

function restoreHint() {
  return "Backup file er caption e /restore likhe pathao.";
}

function sharedOpen(name, count) {
  return "Tomake ekta playlist share kora hoyeche: " + name + " (" + count + " ti gaan). Niche button chaple mini app e khulbe.";
}

module.exports = {
  notAdmin,
  broadcastUsage,
  noRecipients,
  broadcastBusy,
  broadcastConfirm,
  broadcastExpired,
  broadcastStarted,
  broadcastDone,
  broadcastCancelled,
  stats,
  backupCaption,
  restoreDone,
  restoreFailed,
  restoreHint,
  sharedOpen
};
