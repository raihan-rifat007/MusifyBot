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

  var ICONS = {
    play: '<svg class="icon-play" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20"/></svg>',
    pause: '<svg class="icon-pause" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4"/><rect x="5" y="4" width="2.5" height="16" rx="1"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20"/><rect x="16.5" y="4" width="2.5" height="16" rx="1"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    note: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>'
  };

  var player = {
    audio: null,
    item: null,
    playlist: [],
    index: -1,
    dom: null,
    seeking: false,
    loading: false
  };

  function applyTheme() {
    var scheme = tg && tg.colorScheme ? tg.colorScheme : "light";
    document.documentElement.setAttribute("data-theme", scheme);
  }

  function showToast(text) {
    var toast = document.getElementById("toast");
    toast.textContent = text;
    toast.classList.remove("hidden");
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(function () {
      toast.classList.add("hidden");
    }, 1800);
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    var total = Math.floor(seconds);
    var m = Math.floor(total / 60);
    var s = total % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
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
      window.setTimeout(function () { input.focus(); }, 300);
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

  function buildResultCard(item, index) {
    var shell = document.createElement("div");
    shell.className = "result-shell";
    shell.setAttribute("data-index", String(index));

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
    arrow.innerHTML = ICONS.arrow + ICONS.play + ICONS.pause;

    main.appendChild(name);
    main.appendChild(artist);
    core.appendChild(main);
    core.appendChild(arrow);
    shell.appendChild(core);

    shell.addEventListener("click", function () {
      onResultClick(item, index);
    });

    return shell;
  }

  function renderResults(items) {
    var container = document.getElementById("searchResults");
    container.innerHTML = "";
    player.playlist = items.slice();

    if (!items || items.length === 0) {
      var empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No results found.";
      container.appendChild(empty);
      return;
    }

    items.forEach(function (item, index) {
      container.appendChild(buildResultCard(item, index));
    });

    highlightPlaying();
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

  function highlightPlaying() {
    var cards = document.querySelectorAll(".result-shell");
    for (var i = 0; i < cards.length; i++) {
      var idx = Number(cards[i].getAttribute("data-index"));
      if (player.index === idx && player.item) {
        cards[i].classList.add("playing");
      } else {
        cards[i].classList.remove("playing");
      }
    }
  }

  function ensurePlayer() {
    if (player.dom) return player.dom;

    var slot = document.getElementById("playerSlot");
    slot.innerHTML = "";

    var el = document.createElement("div");
    el.className = "player";

    el.innerHTML =
      '<div class="player-core">' +
        '<div class="player-top">' +
          '<div class="player-art">' + ICONS.note + '</div>' +
          '<div class="player-info">' +
            '<div class="player-title" id="playerTitle">—</div>' +
            '<div class="player-artist" id="playerArtist">—</div>' +
          '</div>' +
          '<button class="player-close" id="playerClose" aria-label="Close player">' + ICONS.close + '</button>' +
        '</div>' +
        '<div class="player-progress">' +
          '<span class="player-time" id="playerCurrent">0:00</span>' +
          '<div class="player-bar" id="playerBar">' +
            '<div class="player-bar-fill" id="playerBarFill"></div>' +
          '</div>' +
          '<span class="player-time right" id="playerDuration">0:00</span>' +
        '</div>' +
        '<div class="player-controls">' +
          '<button class="player-btn" id="playerPrev" aria-label="Previous">' + ICONS.prev + '</button>' +
          '<button class="player-btn player-btn-main" id="playerToggle" aria-label="Play or pause">' + ICONS.play + ICONS.pause + '</button>' +
          '<button class="player-btn" id="playerNext" aria-label="Next">' + ICONS.next + '</button>' +
        '</div>' +
      '</div>';

    slot.appendChild(el);

    player.dom = {
      root: el,
      title: el.querySelector("#playerTitle"),
      artist: el.querySelector("#playerArtist"),
      close: el.querySelector("#playerClose"),
      current: el.querySelector("#playerCurrent"),
      duration: el.querySelector("#playerDuration"),
      bar: el.querySelector("#playerBar"),
      fill: el.querySelector("#playerBarFill"),
      prev: el.querySelector("#playerPrev"),
      toggle: el.querySelector("#playerToggle"),
      next: el.querySelector("#playerNext")
    };

    player.dom.close.addEventListener("click", closePlayer);
    player.dom.toggle.addEventListener("click", togglePlay);
    player.dom.prev.addEventListener("click", function () { playStep(-1); });
    player.dom.next.addEventListener("click", function () { playStep(1); });

    wireSeek();

    return player.dom;
  }

  function wireSeek() {
    var bar = player.dom.bar;

    function getPercent(clientX) {
      var rect = bar.getBoundingClientRect();
      var x = clientX - rect.left;
      var pct = x / rect.width;
      if (pct < 0) pct = 0;
      if (pct > 1) pct = 1;
      return pct;
    }

    function seekToPercent(pct) {
      if (!player.audio || !Number.isFinite(player.audio.duration)) return;
      player.audio.currentTime = player.audio.duration * pct;
      if (player.dom) {
        player.dom.fill.style.width = (pct * 100) + "%";
        player.dom.current.textContent = formatTime(player.audio.currentTime);
      }
    }

    bar.addEventListener("click", function (e) {
      seekToPercent(getPercent(e.clientX));
    });

    bar.addEventListener("mousedown", function (e) {
      player.seeking = true;
      player.dom.root.classList.add("seeking");
      seekToPercent(getPercent(e.clientX));
      e.preventDefault();
    });

    document.addEventListener("mousemove", function (e) {
      if (!player.seeking) return;
      seekToPercent(getPercent(e.clientX));
    });

    document.addEventListener("mouseup", function () {
      if (!player.seeking) return;
      player.seeking = false;
      if (player.dom) player.dom.root.classList.remove("seeking");
    });

    bar.addEventListener("touchstart", function (e) {
      player.seeking = true;
      player.dom.root.classList.add("seeking");
      seekToPercent(getPercent(e.touches[0].clientX));
    }, { passive: true });

    bar.addEventListener("touchmove", function (e) {
      if (!player.seeking) return;
      seekToPercent(getPercent(e.touches[0].clientX));
    }, { passive: true });

    bar.addEventListener("touchend", function () {
      player.seeking = false;
      if (player.dom) player.dom.root.classList.remove("seeking");
    });
  }

  function updatePlayerMeta(item) {
    if (!player.dom) return;
    player.dom.title.textContent = item.name || "Unknown title";
    player.dom.artist.textContent = item.artist || "Unknown artist";
    player.dom.current.textContent = "0:00";
    player.dom.duration.textContent = "0:00";
    player.dom.fill.style.width = "0%";
  }

  function setLoading(isLoading) {
    player.loading = isLoading;
    if (!player.dom) return;
    if (isLoading) {
      player.dom.toggle.classList.add("spinner");
      player.dom.toggle.disabled = true;
    } else {
      player.dom.toggle.classList.remove("spinner");
      player.dom.toggle.disabled = false;
    }
  }

  function updatePlayButtons() {
    if (!player.dom || !player.audio) return;
    if (player.audio.paused) {
      player.dom.root.classList.remove("playing");
    } else {
      player.dom.root.classList.add("playing");
    }
  }

  async function fetchStreamUrl(id) {
    var res = await fetch("/api/mini/download-url?id=" + encodeURIComponent(id));
    if (!res.ok) throw new Error("api " + res.status);
    var data = await res.json();
    if (!data || !data.url) throw new Error("no url");
    return data.url;
  }

  async function playIndex(index, autoplay) {
    if (index < 0 || index >= player.playlist.length) return;
    var item = player.playlist[index];
    if (!item || !item.id) {
      showToast("Not playable");
      return;
    }

    ensurePlayer();

    if (player.audio) {
      try { player.audio.pause(); } catch (_) {}
      player.audio.src = "";
      player.audio = null;
    }

    player.item = item;
    player.index = index;
    highlightPlaying();

    updatePlayerMeta(item);
    player.dom.root.classList.add("visible");
    document.body.classList.add("player-open");
    setLoading(true);

    if (autoplay !== false) {
      player.dom.root.classList.remove("playing");
    }

    try {
      var url = await fetchStreamUrl(item.id);

      var audio = new Audio();
      audio.preload = "metadata";
      audio.src = url;
      audio.crossOrigin = "anonymous";
      player.audio = audio;

      audio.addEventListener("loadedmetadata", function () {
        if (player.dom) {
          player.dom.duration.textContent = formatTime(audio.duration);
        }
      });

      audio.addEventListener("timeupdate", function () {
        if (!player.dom || player.seeking) return;
        if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
        var pct = audio.currentTime / audio.duration;
        player.dom.fill.style.width = (pct * 100) + "%";
        player.dom.current.textContent = formatTime(audio.currentTime);
      });

      audio.addEventListener("play", function () {
        updatePlayButtons();
      });

      audio.addEventListener("pause", function () {
        updatePlayButtons();
      });

      audio.addEventListener("ended", function () {
        updatePlayButtons();
        if (player.index + 1 < player.playlist.length) {
          playIndex(player.index + 1);
        }
      });

      audio.addEventListener("error", function () {
        setLoading(false);
        updatePlayButtons();
        showToast("Playback failed");
      });

      if (autoplay !== false) {
        await audio.play();
      }

      setLoading(false);
      updatePlayButtons();
    } catch (err) {
      setLoading(false);
      player.dom.root.classList.remove("playing");
      showToast("Couldn't load this track");
    }
  }

  function togglePlay() {
    if (!player.audio) return;
    if (player.audio.paused) {
      player.audio.play().catch(function () {
        showToast("Playback failed");
      });
    } else {
      player.audio.pause();
    }
  }

  function playStep(delta) {
    if (!player.playlist.length) return;
    var next = player.index + delta;
    if (next < 0) next = player.playlist.length - 1;
    if (next >= player.playlist.length) next = 0;
    playIndex(next);
  }

  function closePlayer() {
    if (player.audio) {
      try { player.audio.pause(); } catch (_) {}
      player.audio.src = "";
      player.audio = null;
    }
    player.item = null;
    player.index = -1;
    highlightPlaying();

    if (player.dom) {
      player.dom.root.classList.remove("visible");
      player.dom.root.classList.remove("playing");
    }

    document.body.classList.remove("player-open");
  }

  function onResultClick(item, index) {
    if (player.index === index && player.audio) {
      togglePlay();
      return;
    }
    playIndex(index);
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
      document.getElementById("statusDot").classList.add("online");
    } catch (err) {
      document.getElementById("statusDot").classList.remove("online");
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