"use strict";

const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

const rootDir = path.join(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const outputPath = path.join(distDir, "music-bot.zip");

const EXCLUDES = ["node_modules", ".git", ".env", "dist", "cache"];

function shouldExclude(entryPath) {
  const parts = entryPath.split(path.sep);
  for (let i = 0; i < parts.length; i++) {
    if (EXCLUDES.indexOf(parts[i]) >= 0) {
      return true;
    }
  }
  return false;
}

function collectFiles(dir, base, acc) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const fullPath = path.join(dir, entry.name);
    const relPath = path.join(base, entry.name);
    if (shouldExclude(relPath)) {
      continue;
    }
    if (entry.isDirectory()) {
      collectFiles(fullPath, relPath, acc);
    } else {
      acc.push({ fullPath: fullPath, relPath: relPath });
    }
  }
  return acc;
}

function run() {
  try {
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }

    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", function () {
      const sizeMb = (archive.pointer() / 1048576).toFixed(2);
      console.log("[musicbot] zip created at " + outputPath + " (" + sizeMb + " MB)");
    });

    archive.on("error", function (err) {
      console.error("[musicbot] archive error", err.message);
      process.exit(1);
    });

    archive.pipe(output);

    const files = collectFiles(rootDir, "", []);
    files.forEach(function (file) {
      archive.file(file.fullPath, { name: file.relPath });
    });

    archive.finalize();
  } catch (err) {
    console.error("[musicbot] zip script failed", err.message);
    process.exit(1);
  }
}

run();
