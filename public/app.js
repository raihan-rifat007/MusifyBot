(function () {
  "use strict";

  var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

  var HELP_COMMANDS = [
    { command: "/play <query>", desc: "instantly downloads the best match" },
    { command: "/search <query>", desc: "shows a list of results to pick from" },
    { command: "/recent", desc: "replay your recently played tracks" },
    { command: "/lyrics <artist> - <title>", desc: "get lyrics" },
    { command: "/app", desc: "open the mini app" },
    { command: "/help", desc: "show the command list" }
  ];

  function applyTheme() {
    var scheme = tg && tg.colorScheme ? tg.colorScheme : "light";
    document.documentElement.setAttribute("data-theme", scheme);
  }

  function showToast(text) {
    var toast = document.getElementById("toast");
    toast.textContent = text;
    toast.classList.remove("hidden");
    window.setTimeout(function () {
      toast.classList.add("hidden");
    }, 1600);
  }

  function navigate(viewName) {
    var views = document.querySelectorAll(".view");
    for (var i = 0; i < views.length; i++) {
      if (views[i].getAttribute("data-view") === viewName) {
        views[i].classList.remove("hidden");
      } else {
        views[i].classList.add("hidden");
      }
    }

    var backBar = document.getElementById("backBar");
    if (viewName === "home") {
      backBar.classList.add("hidden");
    } else {
      backBar.classList.remove("hidden");
    }

    if (viewName === "help") renderHelp();
    if (viewName === "status") refreshStatus();

    if (viewName === "search") {
      var input = document.getElementById("searchInput");
      window.setTimeout(function () {
        input.focus();
      }, 300);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderHelp() {
    var list = document.getElementById("helpList");
    list.innerHTML = "";

    HELP_COMMANDS.forEach(function (item) {
      var shell = document.createElement("div");
      shell.className = "help-shell";

      var core = document.createElement("div");
      core.className = "help-core";

      var cmd = document.createElement("div");
      cmd.className = "help-command";
      cmd.textContent = item.command;

      var desc = document.createElement("div");
      desc.className = "help-desc";
      desc.textContent = item.desc;

      core.appendChild(cmd);
      core.appendChild(desc);
      shell.appendChild(core);

      shell.addEventListener("click", function () {
        var plain = item.command.split(" ")[0];
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(plain).then(function () {
            showToast("Copied " + plain);
          }).catch(function () {
            showToast("Couldn't copy");
          });
        } else {
          showToast("Copy not supported");
        }
      });

      list.appendChild(shell);
    });
  }

  function renderResults(items) {
    var container = document.getElementById("searchResults");
    container.innerHTML = "";

    if (!items || items.length === 0) {
      var empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No results found.";
      container.appendChild(empty);
      return;
    }

    items.forEach(function (item) {
      var shell = document.createElement("div");
      shell.className = "result-shell";

      var core = document.createElement("div");
      core.className = "result-core";

      var main = document.createElement("div");
      main.className = "result-main";

      var name = document.createElement("div");
      name.className = "result-title";
      name.textContent = item.name || "Unknown title";

      var artist = document.createElement("div");
      artist.className = "result-artist";
      artist.textContent = item.artist || "Unknown artist";

      var arrow = document.createElement("div");
      arrow.className = "result-arrow";
      arrow.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';

      main.appendChild(name);
      main.appendChild(artist);
      core.appendChild(main);
      core.appendChild(arrow);
      shell.appendChild(core);

      shell.addEventListener("click", function () {
        openTrack(item);
      });

      container.appendChild(shell);
    });
  }

  function renderSkeleton() {
    var container = document.getElementById("searchResults");
    container.innerHTML = "";
    for (var i = 0; i < 3; i++) {
      var sk = document.createElement("div");
      sk.className = "skeleton";
      container.appendChild(sk);
    }
  }

  async function openTrack(item) {
    try {
      if (!item.id) {
        showToast("Not playable");
        return;
      }
      var url = "/api/mini/download-url?id=" + encodeURIComponent(item.id);
      var res = await fetch(url);
      var data = await res.json();
      if (!data.url) {
        showToast("Not playable");
        return;
      }
      if (tg && tg.openLink) {
        tg.openLink(data.url);
      } else {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      showToast("Couldn't open track");
    }
  }

  async function runSearch() {
    var input = document.getElementById("searchInput");
    var query = input.value.trim();
    if (!query) return;

    renderSkeleton();

    try {
      var res = await fetch("/api/mini/search?q=" + encodeURIComponent(query));
      if (!res.ok) {
        showToast("Music service unavailable");
        renderResults([]);
        return;
      }
      var data = await res.json();
      renderResults(data.items || []);
    } catch (err) {
      showToast("Search failed");
      renderResults([]);
    }
  }

  async function refreshStatus() {
    try {
      var res = await fetch("/api/status");
      var data = await res.json();
      document.getElementById("statUptime").textContent = data.uptime || "--";
      document.getElementById("statMemory").textContent = data.memory ? formatBytes(data.memory.heapUsed) : "--";
      document.getElementById("statApi").textContent = describeUpstream(data.upstream);
      document.getElementById("statSessions").textContent = String(data.sessions != null ? data.sessions : "--");
    } catch (err) {
      document.getElementById("statApi").textContent = "Server unreachable";
    }
  }

  function describeUpstream(upstream) {
    var status = upstream && upstream.status ? upstream.status : "unknown";
    if (status === "ok") return "Online";
    if (status === "degraded") return "Degraded";
    return "Not checked yet";
  }

  function formatBytes(bytes) {
    if (typeof bytes !== "number") return "--";
    var mb = bytes / 1048576;
    return mb.toFixed(1) + " MB";
  }

  async function pollUptime() {
    try {
      var res = await fetch("/api/status");
      var data = await res.json();
      document.getElementById("uptimeDisplay").textContent = data.uptime || "--";
      document.getElementById("brandName").textContent = data.bot && data.bot !== "unconfigured" ? data.bot : "Music Bot";
      var dot = document.getElementById("statusDot");
      dot.classList.add("online");
    } catch (err) {
      var dot2 = document.getElementById("statusDot");
      dot2.classList.remove("online");
    }
  }

  function wireNav() {
    var tiles = document.querySelectorAll("[data-nav]");
    tiles.forEach(function (tile) {
      tile.addEventListener("click", function () {
        navigate(tile.getAttribute("data-nav"));
      });
    });

    document.getElementById("backButton").addEventListener("click", function () {
      navigate("home");
    });

    document.getElementById("searchButton").addEventListener("click", runSearch);
    document.getElementById("searchInput").addEventListener("keydown", function (e) {
      if (e.key === "Enter") runSearch();
    });
  }

  function init() {
    if (tg) {
      tg.ready();
      tg.expand();
    }
    applyTheme();
    wireNav();
    pollUptime();
    window.setInterval(pollUptime, 10000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
