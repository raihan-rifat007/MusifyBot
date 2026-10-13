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
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>',
    repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
    lyrics: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h12M3 12h12M3 18h8M18 14v6M15 17h6"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
    auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.2 8a4 4 0 1 0 0 8c2.6 0 4-4 4-4s-1.4-4-4-4zM5.8 8a4 4 0 1 1 0 8c-2.6 0-4-4-4-4s1.4-4 4-4zM8 12h8"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>'
  };

  var player = {
    audio: null,
    item: null,
    playlist: [],
    index: -1,
    dom: null,
    seeking: false,
    loading: false,
    token: 0,
    repeat: false,
    autoplay: true
  };

  var auth = { token: null, ready: null, guest: false };
  var lib = { likes: [], history: [], playlists: [] };
  var libSaveTimer = null;
  var viewItems = [];
  var lastResults = [];
  var currentTab = "results";
  var openPlaylistId = null;
  var sharedInfo = null;
  var autoplayBusy = false;

  var MOODS = [
    { label: "Trending", query: "trending hits" },
    { label: "Romance", query: "romantic hindi songs" },
    { label: "Party", query: "party songs" },
    { label: "Chill and Lo-Fi", query: "lofi chill" },
    { label: "Workout", query: "workout songs" },
    { label: "Devotional", query: "bhajan" },
    { label: "Sad and Soulful", query: "sad songs" },
    { label: "Bangla", query: "bangla hits" },
    { label: "English", query: "english pop hits" }
  ];

  var TABS = [
    { key: "results", label: "Results" },
    { key: "liked", label: "Liked" },
    { key: "recent", label: "Recent" },
    { key: "playlists", label: "Playlists" }
  ];

  var RESULT_LIMIT = 5;
  var PREPARE_POLL_MS = 1500;
  var PREPARE_MAX_POLLS = 80;
  var prepareRun = 0;
  var cardStates = {};

  var STATE_LABELS = {
    loading: "Preparing",
    ready: "Ready",
    failed: "Unavailable"
  };

  function openSession() {
    if (auth.ready) return auth.ready;
    auth.ready = (async function () {
      var initData = tg && tg.initData ? tg.initData : "";
      try {
        var res = await fetch("/api/mini/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: initData })
        });
        if (res.ok) {
          var data = await res.json();
          auth.token = data.token || null;
          auth.guest = !data.token;
          return true;
        }
      } catch (_) {}
      auth.token = null;
      auth.guest = true;
      return false;
    })();
    return auth.ready;
  }

  async function api(path, options, retried) {
    await openSession();
    var opts = options || {};
    var headers = {};
    if (auth.token) headers["X-Mini-Token"] = auth.token;
    var init = { method: opts.method || "GET", headers: headers };
    if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }
    var res = await fetch("/api/mini" + path, init);
    if (res.status === 401 && !retried) {
      auth.ready = null;
      auth.token = null;
      await openSession();
      return api(path, options, true);
    }
    return res;
  }

  function tokenQuery() {
    return auth.token ? "t=" + encodeURIComponent(auth.token) : "";
  }

  function compactItem(item) {
    return {
      id: String(item.id),
      name: item.name || "Unknown title",
      artist: item.artist || "Unknown artist",
      thumbnail: item.thumbnail || null,
      duration: item.duration || null
    };
  }

  function loadPrefs() {
    try {
      if (window.localStorage.getItem("musify_autoplay") === "off") player.autoplay = false;
    } catch (_) {}
  }

  function savePrefs() {
    try {
      window.localStorage.setItem("musify_autoplay", player.autoplay ? "on" : "off");
    } catch (_) {}
  }

  async function loadLibrary() {
    try {
      var res = await api("/library");
      if (!res.ok) return;
      var data = await res.json();
      lib = {
        likes: Array.isArray(data.likes) ? data.likes : [],
        history: Array.isArray(data.history) ? data.history : [],
        playlists: Array.isArray(data.playlists) ? data.playlists : []
      };
      renderTabs();
      if (currentTab !== "results") showTab();
      updateLikeButton();
    } catch (_) {}
  }

  function scheduleLibrarySave() {
    if (auth.guest) return;
    window.clearTimeout(libSaveTimer);
    libSaveTimer = window.setTimeout(async function () {
      try {
        await api("/library", { method: "PUT", body: lib });
      } catch (_) {}
    }, 900);
  }

  function isLiked(item) {
    if (!item) return false;
    var id = String(item.id);
    return lib.likes.some(function (x) { return x.id === id; });
  }

  function toggleLike(item) {
    if (!item || !item.id) return;
    if (auth.guest) {
      showToast("Open from Telegram to save songs");
      return;
    }
    var id = String(item.id);
    if (isLiked(item)) {
      lib.likes = lib.likes.filter(function (x) { return x.id !== id; });
      showToast("Removed from Liked");
    } else {
      lib.likes.unshift(compactItem(item));
      lib.likes = lib.likes.slice(0, 200);
      showToast("Added to Liked");
    }
    scheduleLibrarySave();
    updateLikeButton();
    renderTabs();
    if (currentTab === "liked") showTab();
  }

  function pushHistory(item) {
    if (!item || !item.id || auth.guest) return;
    var id = String(item.id);
    lib.history = [compactItem(item)].concat(lib.history.filter(function (x) { return x.id !== id; })).slice(0, 30);
    scheduleLibrarySave();
    if (currentTab === "recent") showTab();
  }

  function updateLikeButton() {
    if (!player.dom || !player.dom.pillLike) return;
    player.dom.pillLike.classList.toggle("active", isLiked(player.item));
  }

  function makeId() {
    return (Math.random().toString(36) + "00000000").replace(/[^a-z0-9]/g, "").slice(0, 8);
  }

  function findPlaylist(id) {
    for (var i = 0; i < lib.playlists.length; i++) {
      if (lib.playlists[i].id === id) return lib.playlists[i];
    }
    return null;
  }

  function createPlaylist(name, firstItem) {
    var clean = (name || "").trim().slice(0, 40);
    if (!clean) {
      showToast("Give the playlist a name");
      return null;
    }
    if (auth.guest) {
      showToast("Open from Telegram to save playlists");
      return null;
    }
    if (lib.playlists.length >= 20) {
      showToast("Playlist limit reached");
      return null;
    }
    var playlist = { id: makeId(), name: clean, items: firstItem ? [compactItem(firstItem)] : [] };
    lib.playlists.push(playlist);
    scheduleLibrarySave();
    renderTabs();
    return playlist;
  }

  function closeSheet() {
    var existing = document.getElementById("sheetBackdrop");
    if (existing) existing.remove();
  }

  function openSheet(title, build) {
    closeSheet();
    var backdrop = document.createElement("div");
    backdrop.className = "sheet-backdrop";
    backdrop.id = "sheetBackdrop";

    var sheet = document.createElement("div");
    sheet.className = "sheet";

    var head = document.createElement("div");
    head.className = "sheet-head";
    var heading = document.createElement("div");
    heading.className = "sheet-title";
    heading.textContent = title;
    var close = document.createElement("button");
    close.type = "button";
    close.className = "sheet-close";
    close.setAttribute("aria-label", "Close");
    close.innerHTML = ICONS.close;
    close.addEventListener("click", closeSheet);
    head.appendChild(heading);
    head.appendChild(close);

    var body = document.createElement("div");
    body.className = "sheet-body";

    sheet.appendChild(head);
    sheet.appendChild(body);
    backdrop.appendChild(sheet);
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) closeSheet();
    });
    document.body.appendChild(backdrop);
    window.requestAnimationFrame(function () { backdrop.classList.add("open"); });
    build(body);
  }

  function buildNameForm(placeholder, buttonLabel, onSubmit) {
    var form = document.createElement("div");
    form.className = "sheet-form";
    var input = document.createElement("input");
    input.type = "text";
    input.maxLength = 40;
    input.placeholder = placeholder;
    input.className = "sheet-input";
    var button = document.createElement("button");
    button.type = "button";
    button.className = "sheet-action";
    button.textContent = buttonLabel;
    function submit() {
      onSubmit(input.value);
    }
    button.addEventListener("click", submit);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") submit();
    });
    form.appendChild(input);
    form.appendChild(button);
    return form;
  }

  function openPlaylistSheet(item) {
    if (!item || !item.id) return;
    openSheet("Save to playlist", function (body) {
      function paint() {
        body.innerHTML = "";
        body.appendChild(buildNameForm("New playlist name", "Create", function (value) {
          var created = createPlaylist(value, item);
          if (created) {
            showToast("Saved to " + created.name);
            closeSheet();
          }
        }));
        lib.playlists.forEach(function (playlist) {
          var has = playlist.items.some(function (x) { return x.id === String(item.id); });
          var row = document.createElement("button");
          row.type = "button";
          row.className = "sheet-row" + (has ? " active" : "");
          var label = document.createElement("span");
          label.textContent = playlist.name;
          var meta = document.createElement("span");
          meta.className = "sheet-row-meta";
          meta.textContent = has ? "Added" : playlist.items.length + " songs";
          row.appendChild(label);
          row.appendChild(meta);
          row.addEventListener("click", function () {
            if (has) {
              playlist.items = playlist.items.filter(function (x) { return x.id !== String(item.id); });
            } else {
              if (playlist.items.length >= 100) {
                showToast("Playlist is full");
                return;
              }
              playlist.items.push(compactItem(item));
            }
            scheduleLibrarySave();
            renderTabs();
            if (currentTab === "playlists") showTab();
            paint();
          });
          body.appendChild(row);
        });
        if (lib.playlists.length === 0) {
          var hint = document.createElement("div");
          hint.className = "sheet-empty";
          hint.textContent = "No playlists yet. Create your first one above.";
          body.appendChild(hint);
        }
      }
      paint();
    });
  }

  async function openLyrics(item) {
    if (!item) return;
    openSheet((item.name || "Lyrics"), function (body) {
      var text = document.createElement("pre");
      text.className = "lyrics-text";
      text.textContent = "Loading lyrics...";
      body.appendChild(text);
      (async function () {
        try {
          var res = await api("/lyrics?artist=" + encodeURIComponent(item.artist || "") + "&title=" + encodeURIComponent(item.name || ""));
          var data = res.ok ? await res.json() : null;
          text.textContent = data && data.lyrics ? data.lyrics : "Lyrics not found for this track.";
        } catch (_) {
          text.textContent = "Could not load lyrics.";
        }
      })();
    });
  }

  async function sendToChat(item) {
    if (!item || !item.id) return;
    showToast("Sending to your chat...");
    try {
      var res = await api("/send", { method: "POST", body: compactItem(item) });
      if (res.ok) {
        showToast("Sent to your chat");
      } else if (res.status === 409) {
        showToast("Start the bot in chat first");
      } else if (res.status === 429) {
        showToast("Too fast, try again in a minute");
      } else if (res.status === 403) {
        showToast("Open from Telegram to use this");
      } else if (res.status === 413) {
        showToast("File is too large to send");
      } else {
        showToast("Could not send the track");
      }
    } catch (_) {
      showToast("Could not send the track");
    }
  }

  async function shareItems(name, items) {
    if (!items || items.length === 0) {
      showToast("Nothing to share");
      return;
    }
    try {
      var res = await api("/share", { method: "POST", body: { name: name, items: items.map(compactItem) } });
      if (!res.ok) {
        showToast(res.status === 403 ? "Open from Telegram to share" : "Could not create link");
        return;
      }
      var data = await res.json();
      if (!data.link) {
        showToast("Share link is not available");
        return;
      }
      var text = "Listen on Musify: " + name;
      if (tg && typeof tg.openTelegramLink === "function") {
        tg.openTelegramLink("https://t.me/share/url?url=" + encodeURIComponent(data.link) + "&text=" + encodeURIComponent(text));
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: name, text: text, url: data.link });
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(data.link);
        showToast("Link copied");
        return;
      }
      showToast(data.link);
    } catch (_) {
      showToast("Could not share");
    }
  }

  function renderMoods() {
    var host = document.getElementById("moodChips");
    if (!host) return;
    host.innerHTML = "";
    MOODS.forEach(function (mood) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = mood.label;
      chip.addEventListener("click", function () {
        document.getElementById("searchInput").value = mood.query;
        runSearch();
      });
      host.appendChild(chip);
    });
  }

  function renderTabs() {
    var host = document.getElementById("libTabs");
    if (!host) return;
    host.innerHTML = "";
    TABS.forEach(function (tab) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "tab" + (currentTab === tab.key ? " active" : "");
      var count = tab.key === "liked" ? lib.likes.length : tab.key === "playlists" ? lib.playlists.length : 0;
      button.textContent = tab.label + (count > 0 ? " " + count : "");
      button.addEventListener("click", function () {
        setTab(tab.key);
      });
      host.appendChild(button);
    });
  }

  function setTab(key) {
    currentTab = key;
    openPlaylistId = null;
    renderTabs();
    showTab();
  }

  function renderSharedBanner() {
    var host = document.getElementById("sharedBanner");
    if (!host) return;
    host.innerHTML = "";
    if (!sharedInfo || currentTab !== "results") {
      host.classList.add("hidden");
      return;
    }
    host.classList.remove("hidden");
    var label = document.createElement("div");
    label.className = "banner-text";
    label.textContent = "Shared with you: " + sharedInfo.name + " (" + sharedInfo.items.length + " songs)";
    var save = document.createElement("button");
    save.type = "button";
    save.className = "chip chip-dark";
    save.textContent = "Save playlist";
    save.addEventListener("click", function () {
      var playlist = createPlaylist(sharedInfo.name, null);
      if (!playlist) return;
      playlist.items = sharedInfo.items.slice(0, 100).map(compactItem);
      scheduleLibrarySave();
      renderTabs();
      showToast("Playlist saved");
    });
    host.appendChild(label);
    host.appendChild(save);
  }

  function renderPlaylistHeader(playlist) {
    var container = document.getElementById("searchResults");
    var bar = document.createElement("div");
    bar.className = "pl-bar";
    var back = document.createElement("button");
    back.type = "button";
    back.className = "chip";
    back.textContent = "All playlists";
    back.addEventListener("click", function () {
      openPlaylistId = null;
      showTab();
    });
    var title = document.createElement("div");
    title.className = "pl-bar-title";
    title.textContent = playlist.name;
    var share = document.createElement("button");
    share.type = "button";
    share.className = "chip";
    share.textContent = "Share";
    share.addEventListener("click", function () {
      shareItems(playlist.name, playlist.items);
    });
    var del = document.createElement("button");
    del.type = "button";
    del.className = "chip";
    del.textContent = "Delete";
    del.addEventListener("click", function () {
      lib.playlists = lib.playlists.filter(function (x) { return x.id !== playlist.id; });
      openPlaylistId = null;
      scheduleLibrarySave();
      renderTabs();
      showTab();
      showToast("Playlist deleted");
    });
    bar.appendChild(back);
    bar.appendChild(title);
    bar.appendChild(share);
    bar.appendChild(del);
    container.appendChild(bar);
  }

  function renderPlaylistList() {
    var container = document.getElementById("searchResults");
    container.innerHTML = "";
    viewItems = [];
    container.appendChild(buildNameForm("New playlist name", "Create", function (value) {
      var created = createPlaylist(value, null);
      if (created) {
        openPlaylistId = created.id;
        showTab();
      }
    }));
    if (lib.playlists.length === 0) {
      var empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No playlists yet. Create one, then add songs from the player.";
      container.appendChild(empty);
      return;
    }
    lib.playlists.forEach(function (playlist, index) {
      var shell = document.createElement("div");
      shell.className = "result-shell";
      shell.style.setProperty("--i", String(index));
      var core = document.createElement("div");
      core.className = "result-core";
      var thumb = document.createElement("div");
      thumb.className = "result-thumb";
      fillThumb(thumb, { name: playlist.name, thumbnail: playlist.items[0] ? playlist.items[0].thumbnail : null });
      var main = document.createElement("div");
      main.className = "result-main";
      var name = document.createElement("div");
      name.className = "result-title";
      name.textContent = playlist.name;
      var count = document.createElement("div");
      count.className = "result-artist";
      count.textContent = playlist.items.length + (playlist.items.length === 1 ? " song" : " songs");
      main.appendChild(name);
      main.appendChild(count);
      var arrow = document.createElement("div");
      arrow.className = "result-arrow";
      arrow.innerHTML = ICONS.arrow;
      core.appendChild(thumb);
      core.appendChild(main);
      core.appendChild(arrow);
      shell.appendChild(core);
      shell.addEventListener("click", function () {
        openPlaylistId = playlist.id;
        showTab();
      });
      container.appendChild(shell);
    });
  }

  function showTab() {
    renderSharedBanner();
    if (currentTab === "results") {
      renderResults(lastResults, { badges: true, emptyText: "Search for a song or pick a mood above." });
      return;
    }
    if (currentTab === "liked") {
      renderResults(lib.likes, { badges: false, emptyText: "Nothing liked yet. Tap Like in the player." });
      return;
    }
    if (currentTab === "recent") {
      renderResults(lib.history, { badges: false, emptyText: "Songs you play will show up here." });
      return;
    }
    var playlist = openPlaylistId ? findPlaylist(openPlaylistId) : null;
    if (!playlist) {
      renderPlaylistList();
      return;
    }
    renderResults(playlist.items, {
      badges: false,
      emptyText: "This playlist is empty. Add songs from the player.",
      header: function () { renderPlaylistHeader(playlist); },
      onRemove: function (item) {
        playlist.items = playlist.items.filter(function (x) { return x.id !== String(item.id); });
        scheduleLibrarySave();
        renderTabs();
        showTab();
      }
    });
  }

  async function openSharedFromUrl() {
    var code = new URLSearchParams(window.location.search).get("share");
    var start = tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param ? tg.initDataUnsafe.start_param : "";
    if (!code && /^s_[a-f0-9]{10}$/.test(start)) code = start.slice(2);
    if (!code || !/^[a-f0-9]{10}$/.test(code)) return;
    try {
      var res = await api("/share/" + code);
      if (!res.ok) {
        showToast("This shared link has expired");
        return;
      }
      var data = await res.json();
      sharedInfo = { name: data.name || "Shared", items: Array.isArray(data.items) ? data.items : [] };
      lastResults = sharedInfo.items;
      currentTab = "results";
      navigate("search");
      renderTabs();
      showTab();
    } catch (_) {
      showToast("Could not open the shared link");
    }
  }

  async function autoplayMore() {
    if (!player.autoplay || !player.item || autoplayBusy) return;
    autoplayBusy = true;
    var seed = player.item.artist || player.item.name;
    var token = player.token;
    try {
      var res = await api("/search?q=" + encodeURIComponent(seed));
      if (!res.ok || token !== player.token) return;
      var data = await res.json();
      var seen = {};
      lib.history.forEach(function (x) { seen[x.id] = true; });
      player.playlist.forEach(function (x) { seen[String(x.id)] = true; });
      var fresh = (Array.isArray(data.items) ? data.items : []).filter(function (x) {
        return x && x.id && !seen[String(x.id)];
      }).slice(0, RESULT_LIMIT);
      if (fresh.length === 0) return;
      lastResults = fresh;
      sharedInfo = null;
      currentTab = "results";
      renderTabs();
      showTab();
      prepareTracks(fresh);
      player.playlist = fresh.slice();
      showToast("Autoplay: more like " + seed);
      playIndex(0);
    } catch (_) {
    } finally {
      autoplayBusy = false;
    }
  }

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

  function fillThumb(box, item) {
    box.innerHTML = "";
    box.classList.remove("has-image");

    var initial = document.createElement("span");
    initial.className = "thumb-initial";
    initial.textContent = ((item && item.name) || "?").trim().charAt(0).toUpperCase() || "?";
    box.appendChild(initial);

    if (item && item.thumbnail) {
      var img = document.createElement("img");
      img.alt = "";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.addEventListener("load", function () { box.classList.add("has-image"); });
      img.addEventListener("error", function () { img.remove(); });
      img.src = item.thumbnail;
      box.appendChild(img);
    }
  }

  function buildResultCard(item, index, opts) {
    var options = opts || {};
    var shell = document.createElement("div");
    shell.className = "result-shell";
    shell.style.setProperty("--i", String(index));
    shell.setAttribute("data-index", String(index));
    if (item.id) shell.setAttribute("data-id", String(item.id));

    var core = document.createElement("div");
    core.className = "result-core";

    var thumb = document.createElement("div");
    thumb.className = "result-thumb";
    fillThumb(thumb, item);

    var main = document.createElement("div");
    main.className = "result-main";

    var name = document.createElement("div");
    name.className = "result-title";
    name.textContent = item.name || "Unknown title";

    var artist = document.createElement("div");
    artist.className = "result-artist";
    artist.textContent = item.artist || "Unknown artist";

    var meta = document.createElement("div");
    meta.className = "result-meta";

    var badge = document.createElement("div");
    badge.className = "result-badge";
    meta.appendChild(badge);

    if (item.duration) {
      var dur = document.createElement("span");
      dur.className = "result-duration";
      dur.textContent = item.duration;
      meta.appendChild(dur);
    }

    var actions = document.createElement("div");
    actions.className = "result-actions";

    var dl = document.createElement("button");
    dl.type = "button";
    dl.className = "result-dl";
    dl.setAttribute("aria-label", "Download " + (item.name || "track"));
    dl.innerHTML = ICONS.download;
    dl.addEventListener("click", function (e) {
      e.stopPropagation();
      downloadTrack(item);
    });

    var arrow = document.createElement("div");
    arrow.className = "result-arrow";
    arrow.innerHTML = ICONS.arrow + ICONS.play + ICONS.pause;

    main.appendChild(name);
    main.appendChild(artist);
    main.appendChild(meta);
    if (options.onRemove) {
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "result-dl";
      remove.setAttribute("aria-label", "Remove from playlist");
      remove.innerHTML = ICONS.trash;
      remove.addEventListener("click", function (e) {
        e.stopPropagation();
        options.onRemove(item);
      });
      actions.appendChild(remove);
    }
    actions.appendChild(dl);
    actions.appendChild(arrow);
    core.appendChild(thumb);
    core.appendChild(main);
    core.appendChild(actions);
    shell.appendChild(core);

    shell.addEventListener("click", function () {
      onResultClick(item, index);
    });

    applyCardState(shell, options.badges === false ? "none" : (cardStates[String(item.id)] || "loading"));

    return shell;
  }

  function downloadTrack(item) {
    if (!item || !item.id) {
      showToast("Not downloadable");
      return;
    }
    var fileName = ((item.artist ? item.artist + " - " : "") + (item.name || "track")).replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 80) + ".mp3";
    var url = window.location.origin + buildStreamUrl(item.id, "download=1&name=" + encodeURIComponent(item.name || "") + "&artist=" + encodeURIComponent(item.artist || ""));

    if (tg && typeof tg.downloadFile === "function" && (typeof tg.isVersionAtLeast !== "function" || tg.isVersionAtLeast("8.0"))) {
      try {
        tg.downloadFile({ url: url, file_name: fileName }, function (accepted) {
          showToast(accepted ? "Download started" : "Download cancelled");
        });
        return;
      } catch (_) {}
    }

    if (tg && typeof tg.openLink === "function") {
      tg.openLink(url);
      showToast("Opening download");
      return;
    }

    var a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast("Download started");
  }

  function applyCardState(shell, state) {
    shell.setAttribute("data-state", state);
    var badge = shell.querySelector(".result-badge");
    if (badge) badge.textContent = STATE_LABELS[state] || "";
    if (state === "none") shell.removeAttribute("data-state");
    if (state === "none") shell.setAttribute("data-badge", "off");
  }

  function applyStates(states) {
    var cards = document.querySelectorAll(".result-shell");
    for (var i = 0; i < cards.length; i++) {
      var id = cards[i].getAttribute("data-id");
      if (id && states[id]) {
        cardStates[id] = states[id];
        applyCardState(cards[i], states[id]);
      }
    }
  }

  function delay(ms) {
    return new Promise(function (resolve) { window.setTimeout(resolve, ms); });
  }

  async function prepareTracks(items) {
    var run = ++prepareRun;
    cardStates = {};
    var ids = [];
    items.forEach(function (item) {
      if (item && item.id) ids.push(String(item.id));
    });
    if (ids.length === 0) return;

    for (var attempt = 0; attempt < PREPARE_MAX_POLLS; attempt++) {
      var states = null;
      try {
        var res = await api("/prepare?ids=" + encodeURIComponent(ids.join(",")));
        if (res.ok) {
          var data = await res.json();
          states = data && data.states ? data.states : null;
        }
      } catch (_) {}

      if (run !== prepareRun) return;

      if (states) {
        applyStates(states);
        var pending = ids.some(function (id) { return states[id] === "loading"; });
        if (!pending) return;
      }

      await delay(PREPARE_POLL_MS);
      if (run !== prepareRun) return;
    }
  }

  function renderResults(items, opts) {
    var options = opts || {};
    var container = document.getElementById("searchResults");
    container.innerHTML = "";
    var list = Array.isArray(items) ? items : [];
    viewItems = list.slice();

    if (typeof options.header === "function") options.header();

    if (list.length === 0) {
      var empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = options.emptyText || "No results found.";
      container.appendChild(empty);
      return;
    }

    list.forEach(function (item, index) {
      container.appendChild(buildResultCard(item, index, options));
    });

    highlightPlaying();
  }

  function renderSkeleton() {
    var container = document.getElementById("searchResults");
    container.innerHTML = "";
    for (var i = 0; i < RESULT_LIMIT; i++) {
      var sk = document.createElement("div");
      sk.className = "skeleton";
      sk.style.setProperty("--i", String(i));
      container.appendChild(sk);
    }
  }

  function highlightPlaying() {
    var cards = document.querySelectorAll(".result-shell[data-id]");
    var activeId = player.item && player.audio ? String(player.item.id) : null;
    for (var i = 0; i < cards.length; i++) {
      if (activeId && cards[i].getAttribute("data-id") === activeId) {
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
          '<div class="player-art" id="playerArt"></div>' +
          '<div class="player-info">' +
            '<div class="player-title" id="playerTitle">—</div>' +
            '<div class="player-artist" id="playerArtist">—</div>' +
          '</div>' +
          '<button class="player-close" id="playerClose" aria-label="Close player">' + ICONS.close + '</button>' +
        '</div>' +
        '<div class="player-progress">' +
          '<span class="player-time" id="playerCurrent">0:00</span>' +
          '<div class="player-bar" id="playerBar">' +
            '<div class="player-bar-buffer" id="playerBarBuffer"></div>' +
            '<div class="player-bar-fill" id="playerBarFill"></div>' +
          '</div>' +
          '<span class="player-time right" id="playerDuration">0:00</span>' +
        '</div>' +
        '<div class="player-controls">' +
          '<button class="player-btn player-btn-ghost" id="playerRepeat" aria-label="Repeat track" aria-pressed="false">' + ICONS.repeat + '</button>' +
          '<button class="player-btn" id="playerPrev" aria-label="Previous">' + ICONS.prev + '</button>' +
          '<button class="player-btn player-btn-main" id="playerToggle" aria-label="Play or pause">' + ICONS.play + ICONS.pause + '</button>' +
          '<button class="player-btn" id="playerNext" aria-label="Next">' + ICONS.next + '</button>' +
          '<button class="player-btn player-btn-ghost" id="playerDownload" aria-label="Download track">' + ICONS.download + '</button>' +
        '</div>' +
        '<div class="player-pills">' +
          '<button class="pill" id="pillLike" aria-label="Like">' + ICONS.heart + '<span>Like</span></button>' +
          '<button class="pill" id="pillLyrics" aria-label="Lyrics">' + ICONS.lyrics + '<span>Lyrics</span></button>' +
          '<button class="pill" id="pillList" aria-label="Add to playlist">' + ICONS.plus + '<span>Playlist</span></button>' +
          '<button class="pill" id="pillSend" aria-label="Send to chat">' + ICONS.send + '<span>Send</span></button>' +
          '<button class="pill" id="pillShare" aria-label="Share">' + ICONS.share + '<span>Share</span></button>' +
          '<button class="pill" id="pillAuto" aria-label="Autoplay">' + ICONS.auto + '<span>Auto</span></button>' +
        '</div>' +
      '</div>';

    slot.appendChild(el);

    player.dom = {
      root: el,
      art: el.querySelector("#playerArt"),
      title: el.querySelector("#playerTitle"),
      artist: el.querySelector("#playerArtist"),
      close: el.querySelector("#playerClose"),
      current: el.querySelector("#playerCurrent"),
      duration: el.querySelector("#playerDuration"),
      bar: el.querySelector("#playerBar"),
      buffer: el.querySelector("#playerBarBuffer"),
      fill: el.querySelector("#playerBarFill"),
      repeat: el.querySelector("#playerRepeat"),
      prev: el.querySelector("#playerPrev"),
      toggle: el.querySelector("#playerToggle"),
      next: el.querySelector("#playerNext"),
      download: el.querySelector("#playerDownload"),
      pillLike: el.querySelector("#pillLike"),
      pillAuto: el.querySelector("#pillAuto")
    };

    player.dom.pillAuto.classList.toggle("active", player.autoplay);
    player.dom.pillLike.addEventListener("click", function () { toggleLike(player.item); });
    el.querySelector("#pillLyrics").addEventListener("click", function () { openLyrics(player.item); });
    el.querySelector("#pillList").addEventListener("click", function () { openPlaylistSheet(player.item); });
    el.querySelector("#pillSend").addEventListener("click", function () { sendToChat(player.item); });
    el.querySelector("#pillShare").addEventListener("click", function () {
      if (player.item) shareItems(player.item.name || "a song", [player.item]);
    });
    player.dom.pillAuto.addEventListener("click", function () {
      player.autoplay = !player.autoplay;
      player.dom.pillAuto.classList.toggle("active", player.autoplay);
      savePrefs();
      showToast(player.autoplay ? "Autoplay on" : "Autoplay off");
    });

    player.dom.close.addEventListener("click", closePlayer);
    player.dom.toggle.addEventListener("click", togglePlay);
    player.dom.prev.addEventListener("click", function () { playStep(-1); });
    player.dom.next.addEventListener("click", function () { playStep(1); });
    player.dom.repeat.addEventListener("click", function () {
      player.repeat = !player.repeat;
      player.dom.repeat.classList.toggle("active", player.repeat);
      player.dom.repeat.setAttribute("aria-pressed", player.repeat ? "true" : "false");
      showToast(player.repeat ? "Repeat on" : "Repeat off");
    });
    player.dom.download.addEventListener("click", function () {
      if (player.item) downloadTrack(player.item);
    });

    wireSeek();
    bindMediaSession();

    return player.dom;
  }

  function bindMediaSession() {
    if (!("mediaSession" in navigator)) return;
    function bind(action, handler) {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch (_) {}
    }
    bind("play", function () { if (player.audio && player.audio.paused) togglePlay(); });
    bind("pause", function () { if (player.audio && !player.audio.paused) togglePlay(); });
    bind("previoustrack", function () { playStep(-1); });
    bind("nexttrack", function () { playStep(1); });
    bind("seekto", function (details) {
      if (player.audio && details && Number.isFinite(details.seekTime)) {
        player.audio.currentTime = details.seekTime;
      }
    });
  }

  function updateMediaSession(item) {
    if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: item.name || "Unknown title",
        artist: item.artist || "Unknown artist",
        artwork: item.thumbnail ? [{ src: item.thumbnail, sizes: "512x512" }] : []
      });
    } catch (_) {}
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
    player.dom.duration.textContent = item.duration || "0:00";
    player.dom.fill.style.width = "0%";
    player.dom.buffer.style.width = "0%";
    fillThumb(player.dom.art, item);
    updateMediaSession(item);
    updateLikeButton();
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

  function buildStreamUrl(id, extra) {
    var parts = [];
    var tokenPart = tokenQuery();
    if (tokenPart) parts.push(tokenPart);
    if (extra) parts.push(extra);
    return "/api/mini/stream/" + encodeURIComponent(id) + (parts.length ? "?" + parts.join("&") : "");
  }

  async function playIndex(index, autoplay) {
    if (index < 0 || index >= player.playlist.length) return;
    var item = player.playlist[index];
    if (!item || !item.id) {
      showToast("Not playable");
      return;
    }

    ensurePlayer();

    player.token++;
    if (player.audio) {
      try { player.audio.pause(); } catch (_) {}
      player.audio.removeAttribute("src");
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

    var token = ++player.token;
    var audio = new Audio();

    try {
      audio.preload = "auto";
      audio.src = buildStreamUrl(item.id);
      player.audio = audio;

      audio.addEventListener("loadedmetadata", function () {
        if (token !== player.token || !player.dom) return;
        player.dom.duration.textContent = formatTime(audio.duration);
      });

      audio.addEventListener("timeupdate", function () {
        if (token !== player.token || !player.dom || player.seeking) return;
        if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
        var pct = audio.currentTime / audio.duration;
        player.dom.fill.style.width = (pct * 100) + "%";
        player.dom.current.textContent = formatTime(audio.currentTime);
      });

      audio.addEventListener("play", function () {
        if (token !== player.token) return;
        updatePlayButtons();
      });

      audio.addEventListener("pause", function () {
        if (token !== player.token) return;
        updatePlayButtons();
      });

      audio.addEventListener("progress", function () {
        if (token !== player.token || !player.dom) return;
        if (!Number.isFinite(audio.duration) || audio.duration <= 0 || audio.buffered.length === 0) return;
        var end = audio.buffered.end(audio.buffered.length - 1);
        player.dom.buffer.style.width = Math.min(100, (end / audio.duration) * 100) + "%";
      });

      audio.addEventListener("ended", function () {
        if (token !== player.token) return;
        if (player.repeat) {
          audio.currentTime = 0;
          audio.play().catch(function () {});
          return;
        }
        updatePlayButtons();
        if (player.index + 1 < player.playlist.length) {
          playIndex(player.index + 1);
        } else {
          autoplayMore();
        }
      });

      audio.addEventListener("error", function () {
        if (token !== player.token) return;
        setLoading(false);
        updatePlayButtons();
        showToast("Playback failed");
      });

      if (autoplay !== false) {
        await audio.play();
      }

      if (token !== player.token) return;
      setLoading(false);
      updatePlayButtons();
      highlightPlaying();
      pushHistory(item);
    } catch (err) {
      if (token !== player.token) return;
      setLoading(false);
      if (player.dom) player.dom.root.classList.remove("playing");
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
    player.token++;
    if (player.audio) {
      try { player.audio.pause(); } catch (_) {}
      player.audio.removeAttribute("src");
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
    if (player.item && player.audio && String(player.item.id) === String(item.id)) {
      togglePlay();
      return;
    }
    player.playlist = viewItems.slice();
    playIndex(index);
  }

  async function runSearch() {
    var input = document.getElementById("searchInput");
    var query = input.value.trim();
    if (!query) return;

    sharedInfo = null;
    currentTab = "results";
    openPlaylistId = null;
    renderTabs();
    renderSharedBanner();
    renderSkeleton();

    try {
      var res = await api("/search?q=" + encodeURIComponent(query));
      if (res.status === 429) {
        showToast("Too many searches, slow down");
        showTab();
        return;
      }
      if (!res.ok) {
        showToast(res.status === 401 ? "Open this app from Telegram" : "Music service unavailable");
        prepareRun++;
        lastResults = [];
        showTab();
        return;
      }
      var data = await res.json();
      var found = Array.isArray(data.items) ? data.items.slice(0, RESULT_LIMIT) : [];
      lastResults = found;
      showTab();
      prepareTracks(found);
    } catch (err) {
      showToast("Search failed");
      lastResults = [];
      showTab();
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
        var target = tile.getAttribute("data-nav");
        if (target === "library") {
          navigate("search");
          setTab("liked");
          return;
        }
        navigate(target);
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
    loadPrefs();
    wireNav();
    renderMoods();
    renderTabs();
    showTab();
    openSession().then(function () {
      loadLibrary();
      openSharedFromUrl();
    });
    pollUptime();
    window.setInterval(pollUptime, 10000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();