/* =========================================================
   Lịch sử Đảng — 700 câu trắc nghiệm
   Core: data, storage, routing, home screen
   ========================================================= */
(function () {
  "use strict";

  var DATA = window.QUIZ_DATA;
  var app = document.getElementById("app");
  var LETTERS = ["A", "B", "C", "D"];
  var STORE_KEY = "lsdang700:v1";

  if (!DATA || !Array.isArray(DATA.units)) {
    app.innerHTML =
      '<div class="container" style="padding:60px 0"><h1>Không tải được dữ liệu</h1><p>Kiểm tra tệp assets/data.js.</p></div>';
    return;
  }

  var TOTAL = DATA.stats.total;
  var ALL_QUESTIONS = [];
  var QUESTION_BY_GID = {};
  DATA.units.forEach(function (unit) {
    unit.questions.forEach(function (q) {
      q.unitId = unit.id;
      ALL_QUESTIONS.push(q);
      QUESTION_BY_GID[q.gid] = q;
    });
  });
  var UNIT_BY_ID = {};
  DATA.units.forEach(function (unit) {
    UNIT_BY_ID[unit.id] = unit;
  });

  /* ---------------- utils ---------------- */

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function pct(part, whole) {
    if (!whole) return 0;
    return Math.round((part / whole) * 100);
  }

  function shuffle(list) {
    var arr = list.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function formatDate(ts) {
    try {
      return new Date(ts).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch (err) {
      return "";
    }
  }

  function icon(name, extraClass) {
    var paths = ICONS[name] || "";
    return (
      '<span class="icon' +
      (extraClass ? " " + extraClass : "") +
      '" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      paths +
      "</svg></span>"
    );
  }

  var ICONS = {
    arrowRight: '<path d="M4 12h15"/><path d="M13 6l6 6-6 6"/>',
    arrowLeft: '<path d="M20 12H5"/><path d="M11 6l-6 6 6 6"/>',
    chevronRight: '<path d="M9 5l7 7-7 7"/>',
    check: '<path d="M4.5 12.5l4.5 4.5L19.5 6.5"/>',
    x: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
    flag: '<path d="M5 21V4"/><path d="M5 5h11l-1.6 3.4L16 12H5"/>',
    flagFill: '<path d="M5 21V4"/><path d="M5 5h11l-1.6 3.4L16 12H5z" fill="currentColor"/>',
    shuffle: '<path d="M3 7h3.2c1.4 0 2.6.7 3.4 1.9l4.8 7.2c.8 1.2 2 1.9 3.4 1.9H21"/><path d="M3 17h3.2c1.4 0 2.6-.7 3.4-1.9l4.8-7.2C15.2 6.7 16.4 6 17.8 6H21"/><path d="M18 3l3 3-3 3"/><path d="M18 15l3 3-3 3"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 6.3"/><path d="M20 4v7h-7"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
    alert: '<path d="M12 3l9.5 17H2.5L12 3z"/><path d="M12 9v5"/><path d="M12 17h.01"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 5.5V20.5"/><path d="M8 7h8"/>',
    close: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
    home: '<path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
    play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/>',
    list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3.5 6h.01"/><path d="M3.5 12h.01"/><path d="M3.5 18h.01"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6.5 7l1 13h9l1-13"/><path d="M10 11v5"/><path d="M14 11v5"/>',
  };

  /* ---------------- storage ---------------- */

  function defaultStore() {
    return {
      version: 1,
      units: {},
      practice: {},
      random: null,
      updatedAt: Date.now(),
    };
  }

  function loadStore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultStore();
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return defaultStore();
      parsed.units = parsed.units && typeof parsed.units === "object" ? parsed.units : {};
      parsed.practice =
        parsed.practice && typeof parsed.practice === "object" ? parsed.practice : {};
      if (!("random" in parsed)) parsed.random = null;
      return parsed;
    } catch (err) {
      return defaultStore();
    }
  }

  var state = loadStore();
  var saveTimer = null;

  function saveStore() {
    state.updatedAt = Date.now();
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (err) {
      /* storage might be full or disabled; app still works in-memory */
    }
  }

  function saveStoreSoon() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveStore, 250);
  }

  function ensureUnitSession(unitId) {
    var id = String(unitId);
    var session = state.units[id];
    if (!session || typeof session !== "object") {
      session = state.units[id] = {
        answers: {},
        marked: {},
        index: 0,
        startedAt: Date.now(),
        best: null,
      };
    }
    session.answers = session.answers && typeof session.answers === "object" ? session.answers : {};
    session.marked = session.marked && typeof session.marked === "object" ? session.marked : {};
    session.index = clamp(Number(session.index) || 0, 0, UNIT_BY_ID[unitId].questions.length - 1);
    return session;
  }

  /* ---------------- derived stats ---------------- */

  function answeredCount(session) {
    return session ? Object.keys(session.answers || {}).length : 0;
  }

  function sessionStats(session, questions) {
    var stats = { total: questions.length, correct: 0, wrong: 0, unscored: 0, answered: 0, skipped: 0 };
    questions.forEach(function (q) {
      var picked = session.answers ? session.answers[q.gid] : null;
      if (!picked) return;
      stats.answered++;
      if (!q.answer) stats.unscored++;
      else if (picked === q.answer) stats.correct++;
      else stats.wrong++;
    });
    stats.skipped = stats.total - stats.answered;
    stats.scored = stats.correct + stats.wrong;
    stats.accuracy = stats.scored ? Math.round((stats.correct / stats.scored) * 100) : null;
    return stats;
  }

  function unitStatus(unit) {
    var session = state.units[String(unit.id)];
    var answered = answeredCount(session);
    if (answered >= unit.questions.length) return "done";
    if (answered > 0 || (session && session.index > 0)) return "doing";
    return "new";
  }

  function overallStats() {
    var practiced = 0;
    var correct = 0;
    var wrong = 0;
    var unscored = 0;
    Object.keys(state.practice).forEach(function (gid) {
      var q = QUESTION_BY_GID[gid];
      if (!q) return;
      practiced++;
      var value = state.practice[gid];
      if (value === "correct") correct++;
      else if (value === "wrong") wrong++;
      else unscored++;
    });
    return { practiced: practiced, correct: correct, wrong: wrong, unscored: unscored, total: TOTAL };
  }

  function nextUnitSuggestion() {
    for (var i = 0; i < DATA.units.length; i++) {
      var status = unitStatus(DATA.units[i]);
      if (status === "doing") return { unit: DATA.units[i], resume: true };
    }
    for (var j = 0; j < DATA.units.length; j++) {
      if (unitStatus(DATA.units[j]) !== "done") return { unit: DATA.units[j], resume: false };
    }
    return { unit: DATA.units[0], resume: false, allDone: true };
  }

  /* ---------------- routing ---------------- */

  function parseRoute() {
    var raw = location.hash.replace(/^#\/?/, "");
    var parts = raw.split("/").filter(Boolean);
    if (!parts.length) return { name: "home" };
    if (parts[0] === "unit" && parts[1]) {
      var unitId = parseInt(parts[1], 10);
      if (UNIT_BY_ID[unitId]) {
        return { name: "unit", unitId: unitId, result: parts[2] === "result" };
      }
    }
    if (parts[0] === "random") {
      return { name: "random", result: parts[1] === "result" };
    }
    return { name: "home" };
  }

  function go(hash) {
    if (location.hash === hash) {
      renderRoute();
    } else {
      location.hash = hash;
    }
  }

  function goHome() {
    go("#/");
  }

  /* ---------------- question context ---------------- */

  function getContext(route) {
    if (route.name === "unit") {
      var unit = UNIT_BY_ID[route.unitId];
      if (!unit) return null;
      var session = ensureUnitSession(unit.id);
      session.index = clamp(Number(session.index) || 0, 0, unit.questions.length - 1);
      return {
        mode: "unit",
        unit: unit,
        questions: unit.questions,
        session: session,
        index: session.index,
        title: unit.name,
        subtitle: unit.chapterLabel + " · " + unit.periodLabel,
        resultHash: "#/unit/" + unit.id + "/result",
        quizHash: "#/unit/" + unit.id,
      };
    }
    if (route.name === "random") {
      var sessionRandom = state.random;
      if (!sessionRandom || !Array.isArray(sessionRandom.ids) || !sessionRandom.ids.length) return null;
      var questions = sessionRandom.ids
        .map(function (gid) {
          return QUESTION_BY_GID[gid];
        })
        .filter(Boolean);
      if (!questions.length) return null;
      sessionRandom.index = clamp(Number(sessionRandom.index) || 0, 0, questions.length - 1);
      sessionRandom.answers = sessionRandom.answers || {};
      sessionRandom.marked = sessionRandom.marked || {};
      return {
        mode: "random",
        unit: null,
        questions: questions,
        session: sessionRandom,
        index: sessionRandom.index,
        title: "Đề ngẫu nhiên",
        subtitle: questions.length + " câu · " + (sessionRandom.size === 700 ? "toàn bộ ngân hàng" : "chọn ngẫu nhiên từ 700 câu"),
        resultHash: "#/random/result",
        quizHash: "#/random",
      };
    }
    return null;
  }

  function currentQuestion(ctx) {
    return ctx.questions[ctx.index];
  }

  function isAnswered(ctx, question) {
    return Boolean(ctx.session.answers && ctx.session.answers[question.gid]);
  }

  function optionState(ctx, question, letter) {
    var picked = ctx.session.answers ? ctx.session.answers[question.gid] : null;
    if (!picked) return "";
    if (!question.answer) {
      if (picked === letter) return "is-unscored";
      return "is-dim";
    }
    if (letter === question.answer) return "is-correct";
    if (picked === letter) return "is-wrong";
    return "is-dim";
  }

  function chapterShort(q) {
    return "Chương " + q.chapterNumber;
  }

  /* ---------------- header ---------------- */

  function renderHeader() {
    var stats = overallStats();
    var value = document.getElementById("header-progress-value");
    var fill = document.getElementById("header-progress-fill");
    if (value) value.textContent = stats.practiced + "/" + TOTAL;
    if (fill) fill.style.width = pct(stats.practiced, TOTAL) + "%";
  }

  /* ---------------- toast ---------------- */

  function toast(message, tone) {
    var root = document.getElementById("toast-root");
    if (!root) return;
    var el = document.createElement("div");
    el.className = "toast" + (tone ? " toast--" + tone : "");
    var iconName = tone === "error" ? "alert" : tone === "success" ? "check" : "info";
    el.innerHTML = icon(iconName) + "<span>" + esc(message) + "</span>";
    root.appendChild(el);
    setTimeout(function () {
      el.classList.add("is-hiding");
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 260);
    }, 2200);
  }

  /* ---------------- home ---------------- */

  var ui = { filter: "all" };

  var FILTERS = [
    { id: "all", label: "Tất cả" },
    { id: "new", label: "Chưa làm" },
    { id: "doing", label: "Đang làm" },
    { id: "done", label: "Hoàn thành" },
  ];

  function renderHome() {
    var stats = overallStats();
    var suggestion = nextUnitSuggestion();
    var heroUnit = suggestion.unit;
    var heroAnswered = answeredCount(state.units[String(heroUnit.id)]);
    var heroActionLabel = suggestion.resume
      ? "Tiếp tục " + heroUnit.name
      : suggestion.allDone
      ? "Ôn lại " + heroUnit.name
      : "Bắt đầu " + heroUnit.name;
    var ringPct = pct(stats.practiced, TOTAL);
    var circumference = 326.73;

    var cards = DATA.units
      .filter(function (unit) {
        if (ui.filter === "all") return true;
        return unitStatus(unit) === ui.filter;
      })
      .map(unitCardHtml)
      .join("");

    if (!cards) {
      cards =
        '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">' +
        icon("check") +
        '</div><p class="empty-title">Không có Unit nào ở trạng thái này</p><p class="empty-text">Chọn bộ lọc khác để xem danh sách.</p></div>';
    }

    var random = state.random;
    var randomActive = random && Array.isArray(random.ids) && random.ids.length;
    var randomAnswered = randomActive ? answeredCount(random) : 0;
    var randomTotal = randomActive ? random.ids.length : 0;

    app.innerHTML =
      '<div class="screen">' +
      '<section class="hero container">' +
      '<div class="hero-copy">' +
      '<span class="eyebrow"><span class="dot"></span>Lịch sử Đảng Cộng sản Việt Nam</span>' +
      '<h1 class="hero-title">700 câu hỏi.<br>14 Unit.<br><em>Một lộ trình.</em></h1>' +
      '<p class="hero-desc">Ôn tập theo từng Unit 50 câu với phản hồi tức thì, hoặc thử sức với đề ngẫu nhiên. Tiến độ được lưu ngay trên trình duyệt để bạn tiếp tục bất cứ lúc nào.</p>' +
      '<div class="hero-actions">' +
      '<button class="btn btn-primary btn-lg" type="button" data-action="start-unit" data-unit="' +
      heroUnit.id +
      '">' +
      icon("play") +
      esc(heroActionLabel) +
      "</button>" +
      '<button class="btn btn-secondary btn-lg" type="button" data-action="random-modal">' +
      icon("shuffle") +
      "Luyện ngẫu nhiên</button>" +
      "</div>" +
      '<div class="hero-meta"><span>700 câu · 14 Unit</span><span>660 câu có đáp án</span><span>Tự lưu tiến độ</span></div>' +
      "</div>" +
      '<div class="hero-visual" aria-hidden="true">' +
      '<div class="hero-card-back hero-card-back--1"></div>' +
      '<div class="hero-card-back hero-card-back--2"></div>' +
      '<div class="hero-card">' +
      '<div class="hero-card-top"><span class="hero-card-label">Tiến độ tổng</span><span class="hero-card-year">2024</span></div>' +
      '<div class="hero-ring">' +
      '<svg viewBox="0 0 120 120"><circle class="ring-track" cx="60" cy="60" r="52"/><circle class="ring-value" cx="60" cy="60" r="52" stroke-dasharray="' +
      circumference +
      '" stroke-dashoffset="' +
      (circumference * (1 - ringPct / 100)).toFixed(1) +
      '"' +
      (ringPct === 0 ? ' style="opacity:0"' : "") +
      "/></svg>" +
      '<div class="hero-ring-label"><strong>' +
      ringPct +
      '%</strong><span>đã chạm</span></div>' +
      "</div>" +
      '<div class="hero-card-stats">' +
      '<div class="hero-stat"><span>Đã làm</span><strong>' +
      stats.practiced +
      "</strong><small>/ " +
      TOTAL +
      " câu</small></div>" +
      '<div class="hero-stat"><span>Trả lời đúng</span><strong>' +
      stats.correct +
      "</strong><small>câu</small></div>" +
      '<div class="hero-stat"><span>Còn lại</span><strong>' +
      (TOTAL - stats.practiced) +
      "</strong><small>câu</small></div>" +
      "</div>" +
      '<div class="hero-card-next"><div><div class="hero-card-next-label">' +
      (suggestion.resume ? "Đang học" : suggestion.allDone ? "Gợi ý ôn tập" : "Gợi ý tiếp theo") +
      '</div><div class="hero-card-next-title">' +
      esc(heroUnit.name + " · " + heroUnit.chapterLabel + " · " + heroAnswered + "/50") +
      "</div></div>" +
      icon("chevronRight") +
      "</div>" +
      "</div>" +
      "</div>" +
      "</section>" +

      '<section class="container">' +
      '<div class="random-banner">' +
      '<div class="random-copy">' +
      '<span class="eyebrow random-eyebrow"><span class="dot"></span>Chế độ ngẫu nhiên</span>' +
      '<h2 class="random-title">Một đề mới,<br>không đoán trước.</h2>' +
      '<p class="random-desc">Trộn ngẫu nhiên 50 câu từ toàn bộ 700 câu, hoặc lấy toàn bộ ngân hàng câu hỏi để làm một lượt xuyên suốt 3 chương.</p>' +
      '<div class="random-actions">' +
      '<button class="btn btn-primary" type="button" data-action="random-modal">' +
      icon("shuffle") +
      "Tạo đề 50 câu</button>" +
      '<button class="btn btn-ghost" type="button" data-action="random-modal" data-size="700">Toàn bộ 700 câu</button>' +
      (randomActive
        ? '<button class="btn btn-ghost" type="button" data-action="resume-random">Tiếp tục đề đang làm</button>'
        : "") +
      "</div>" +
      '<p class="random-note">Đáp án đúng hiện ngay sau mỗi lựa chọn · Câu chưa có đáp án sẽ không tính điểm.</p>' +
      "</div>" +
      '<div class="random-visual">' +
      '<div class="random-number">' +
      (randomActive ? randomAnswered : "50") +
      "<small>" +
      (randomActive ? "câu đã làm / " + randomTotal : "câu mỗi đề") +
      "</small></div>" +
      '<div class="random-progress">' +
      '<div class="random-progress-bar"><span style="width:' +
      (randomActive ? pct(randomAnswered, randomTotal) : 0) +
      '%"></span></div>' +
      '<div class="random-progress-text"><span>' +
      (randomActive ? "Đề đang làm" : "Sẵn sàng tạo đề") +
      "</span><span>" +
      (randomActive ? randomAnswered + "/" + randomTotal : "50 hoặc 700 câu") +
      "</span></div>" +
      "</div>" +
      "</div>" +
      "</div>" +
      "</section>" +

      '<section class="container units-section">' +
      '<div class="units-head">' +
      '<div><span class="eyebrow"><span class="dot"></span>Lộ trình 14 Unit</span>' +
      '<h2 class="section-title">Chọn Unit để bắt đầu</h2>' +
      '<p class="section-desc">Mỗi Unit gồm 50 câu liên tiếp theo đúng thứ tự của file gốc. Chọn đáp án để nhận phản hồi ngay và xem lại câu sai khi kết thúc.</p></div>' +
      '<div class="filter-pills" role="tablist" aria-label="Lọc Unit">' +
      FILTERS.map(function (f) {
        return (
          '<button class="filter-pill' +
          (ui.filter === f.id ? " is-active" : "") +
          '" type="button" role="tab" aria-selected="' +
          (ui.filter === f.id) +
          '" data-action="filter" data-filter="' +
          f.id +
          '">' +
          f.label +
          "</button>"
        );
      }).join("") +
      "</div>" +
      "</div>" +
      '<div class="unit-grid">' +
      cards +
      "</div>" +
      '<details class="source-note">' +
      '<summary>' +
      icon("info") +
      "Về nguồn dữ liệu và cách tính điểm" +
      "</summary>" +
      '<div class="source-note-content">' +
      '<div class="source-note-grid">' +
      '<div class="source-stat"><strong>700</strong><span>Câu hỏi · 14 Unit</span></div>' +
      '<div class="source-stat"><strong>660</strong><span>Câu có đáp án</span></div>' +
      '<div class="source-stat"><strong>40</strong><span>Câu chưa có đáp án</span></div>' +
      "</div>" +
      "<p>Toàn bộ câu hỏi và phương án được giữ nguyên từ file <strong>700 câu hỏi trắc nghiệm Lịch sử Đảng Cộng sản Việt Nam</strong>. File gốc không kèm giải thích chi tiết.</p>" +
      "<p>Phần gợi ý đáp án của Chương 3 bị cắt ở câu 112. 12 câu trùng khớp hoàn toàn với câu đã có đáp án đã được phục hồi; <strong>40 câu còn lại chưa có đáp án trong nguồn</strong> nên được hiển thị riêng và không tính vào điểm số. Độ chính xác được tính trên số câu đã trả lời và có đáp án.</p>" +
      "</div>" +
      "</details>" +
      "</section>" +
      "</div>";

    renderHeader();
  }

  function unitCardHtml(unit) {
    var session = state.units[String(unit.id)];
    var answered = answeredCount(session);
    var status = unitStatus(unit);
    var best = session && session.best;
    var statusLabel = status === "done" ? "Hoàn thành" : status === "doing" ? "Đang làm" : "Chưa bắt đầu";
    var statusClass = status === "done" ? "is-done" : status === "doing" ? "is-doing" : "";
    var cardClass =
      "unit-card" +
      (status === "done" ? " is-complete" : "") +
      (status === "doing" ? " is-doing" : "") +
      (unit.missingCount ? " is-missing" : "");

    return (
      '<button class="' +
      cardClass +
      '" type="button" data-action="start-unit" data-unit="' +
      unit.id +
      '">' +
      '<span class="unit-watermark">' +
      String(unit.id).padStart(2, "0") +
      "</span>" +
      '<span class="unit-card-top"><span class="unit-kicker">' +
      esc(unit.chapterLabel) +
      '</span><span class="unit-status ' +
      statusClass +
      '">' +
      statusLabel +
      "</span></span>" +
      '<span class="unit-title">' +
      esc(unit.name) +
      "</span>" +
      '<span class="unit-sub">' +
      esc(unit.periodLabel) +
      " · " +
      esc(unit.rangeLabel) +
      "</span>" +
      '<span class="unit-meta"><span>' +
      unit.questionCount +
      " câu</span><span class=\"dot-sep\"></span><span>" +
      answered +
      " đã trả lời</span>" +
      (unit.missingCount
        ? '<span class="dot-sep"></span><span class="unit-missing">' + unit.missingCount + " câu chưa có đáp án</span>"
        : "") +
      "</span>" +
      '<span class="unit-progress"><span class="unit-progress-bar"><span style="width:' +
      pct(answered, unit.questionCount) +
      '%"></span></span><span class="unit-progress-text"><span><strong>' +
      answered +
      "</strong> / " +
      unit.questionCount +
      " câu</span><span>" +
      pct(answered, unit.questionCount) +
      "%</span></span></span>" +
      '<span class="unit-footer"><span class="unit-best">' +
      (best ? "Tốt nhất: " + best.accuracy + "% · " + formatDate(best.at) : "50 câu hỏi") +
      '</span><span class="unit-arrow">' +
      icon(status === "doing" ? "play" : "arrowRight") +
      "</span></span>" +
      "</button>"
    );
  }

  /* ---------------- quiz ---------------- */

  function renderQuiz(route) {
    var ctx = getContext(route);
    if (!ctx) {
      toast("Chưa có đề ngẫu nhiên. Hãy tạo đề mới.", "error");
      goHome();
      return;
    }
    renderQuizScreen(ctx);
  }

  function renderQuizScreen(ctx) {
    var q = currentQuestion(ctx);
    var picked = ctx.session.answers[q.gid] || null;
    var answered = Boolean(picked);
    var marked = Boolean(ctx.session.marked[q.gid]);
    var stats = sessionStats(ctx.session, ctx.questions);
    var progress = pct(ctx.index + 1, ctx.questions.length);
    var isLast = ctx.index === ctx.questions.length - 1;
    var missingInUnit = ctx.mode === "unit" && ctx.unit.missingCount > 0;

    var optionsHtml = q.options
      .map(function (option, i) {
        var letter = LETTERS[i];
        var cls = optionState(ctx, q, letter);
        var markIcon = cls === "is-correct" ? "check" : cls === "is-wrong" ? "x" : cls === "is-unscored" ? "info" : "check";
        return (
          '<button class="option ' +
          cls +
          '" type="button" data-action="answer" data-letter="' +
          letter +
          '"' +
          (answered ? " disabled" : "") +
          ">" +
          '<span class="option-letter">' +
          letter +
          "</span>" +
          '<span class="option-text">' +
          esc(option) +
          "</span>" +
          '<span class="option-mark">' +
          icon(markIcon) +
          "</span>" +
          "</button>"
        );
      })
      .join("");

    var navHtml;
    if (ctx.questions.length <= 100) {
      navHtml =
        '<div class="nav-grid">' +
        ctx.questions.map(function (item, i) {
          var itemAnswer = ctx.session.answers[item.gid];
          var classes = ["nav-dot"];
          if (itemAnswer) {
            if (!item.answer) classes.push("is-unscored");
            else if (itemAnswer === item.answer) classes.push("is-correct");
            else classes.push("is-wrong");
          }
          if (i === ctx.index) classes.push("is-current");
          if (ctx.session.marked[item.gid]) classes.push("is-marked");
          return (
            '<button class="' +
            classes.join(" ") +
            '" type="button" data-action="goto" data-index="' +
            i +
            '" title="Câu ' +
            (i + 1) +
            '" aria-label="Đến câu ' +
            (i + 1) +
            '">' +
            (i + 1) +
            "</button>"
          );
        }).join("") +
        "</div>" +
        '<div class="nav-legend">' +
        '<span class="legend-item"><span class="legend-swatch is-correct"></span>Đúng</span>' +
        '<span class="legend-item"><span class="legend-swatch is-wrong"></span>Sai</span>' +
        '<span class="legend-item"><span class="legend-swatch is-unscored"></span>Chưa có ĐA</span>' +
        '<span class="legend-item"><span class="legend-swatch"></span>Chưa làm</span>' +
        "</div>";
    } else {
      navHtml =
        '<div class="jump-row"><input id="jump-input" type="number" min="1" max="' +
        ctx.questions.length +
        '" placeholder="Số câu" aria-label="Đi đến câu số" /><button class="btn btn-secondary btn-sm" type="button" data-action="jump">Đi</button></div>' +
        '<p class="jump-hint">Nhập số từ 1 đến ' +
        ctx.questions.length +
        " để chuyển nhanh.</p>";
    }

    var feedbackHtml = "";
    if (answered) {
      if (!q.answer) {
        feedbackHtml =
          '<div class="feedback feedback--unscored" role="status">' +
          '<div class="feedback-icon">' +
          icon("info") +
          "</div>" +
          '<div class="feedback-body"><p class="feedback-title">Chưa có đáp án trong nguồn</p>' +
          '<p class="feedback-text">Câu hỏi này không có đáp án trong file gốc nên <strong>không được tính điểm</strong>. Lựa chọn của bạn vẫn được ghi nhận.</p>' +
          '<span class="feedback-note">Bạn đã chọn ' +
          picked +
          "</span></div></div>";
      } else if (picked === q.answer) {
        feedbackHtml =
          '<div class="feedback feedback--correct" role="status">' +
          '<div class="feedback-icon">' +
          icon("check") +
          "</div>" +
          '<div class="feedback-body"><p class="feedback-title">Chính xác!</p>' +
          '<p class="feedback-text">Đáp án đúng: <strong>' +
          q.answer +
          ". " +
          esc(q.options[LETTERS.indexOf(q.answer)]) +
          "</strong></p>" +
          (q.answerSource === "duplicate"
            ? '<span class="feedback-note">Đáp án được phục hồi từ câu trùng trong file gốc.</span>'
            : "") +
          "</div></div>";
      } else {
        feedbackHtml =
          '<div class="feedback feedback--wrong" role="status">' +
          '<div class="feedback-icon">' +
          icon("x") +
          "</div>" +
          '<div class="feedback-body"><p class="feedback-title">Chưa chính xác</p>' +
          '<p class="feedback-text">Bạn chọn <strong>' +
          picked +
          "</strong>. Đáp án đúng là <strong>" +
          q.answer +
          ". " +
          esc(q.options[LETTERS.indexOf(q.answer)]) +
          "</strong>.</p>" +
          (q.answerSource === "duplicate"
            ? '<span class="feedback-note">Đáp án được phục hồi từ câu trùng trong file gốc.</span>'
            : "") +
          "</div></div>";
      }
    }

    app.innerHTML =
      '<div class="screen quiz-screen"><div class="container">' +
      '<div class="quiz-top">' +
      '<div class="quiz-top-left">' +
      '<button class="quiz-back" type="button" data-action="home" aria-label="Về trang chủ">' +
      icon("arrowLeft") +
      "<span>Trang chủ</span></button>" +
      '<div class="quiz-heading"><h1 class="quiz-title">' +
      esc(ctx.title) +
      '</h1><p class="quiz-sub">' +
      esc(ctx.subtitle) +
      "</p></div>" +
      "</div>" +
      '<div class="quiz-top-right"><span class="quiz-counter">Câu ' +
      (ctx.index + 1) +
      " / " +
      ctx.questions.length +
      '</span><button class="btn btn-secondary btn-sm quiz-nav-btn" type="button" data-action="finish">Kết quả</button></div>' +
      "</div>" +
      '<div class="quiz-progress" role="progressbar" aria-valuemin="1" aria-valuemax="' +
      ctx.questions.length +
      '" aria-valuenow="' +
      (ctx.index + 1) +
      '"><span style="width:' +
      progress +
      '%"></span></div>' +

      '<div class="quiz-mobile-stats">' +
      '<div class="mobile-stat mobile-stat--correct"><strong>' +
      stats.correct +
      "</strong><span>Đúng</span></div>" +
      '<div class="mobile-stat mobile-stat--wrong"><strong>' +
      stats.wrong +
      "</strong><span>Sai</span></div>" +
      '<div class="mobile-stat mobile-stat--unscored"><strong>' +
      stats.unscored +
      "</strong><span>Chưa có ĐA</span></div>" +
      "</div>" +

      '<div class="quiz-layout">' +
      '<div class="quiz-main">' +
      (missingInUnit
        ? '<div class="missing-banner">' +
          icon("alert") +
          "<span>Unit này có <strong>" +
          ctx.unit.missingCount +
          " câu chưa có đáp án trong file gốc</strong>. Những câu đó vẫn hiển thị để bạn ôn tập nhưng không được tính vào điểm số.</span></div>"
        : "") +
      '<article class="question-card">' +
      '<div class="question-top">' +
      '<div class="question-tags"><span class="question-kicker">Câu ' +
      (ctx.index + 1) +
      "</span>" +
      '<span class="chapter-tag">' +
      chapterShort(q) +
      " · Câu gốc " +
      q.chapterQuestionNumber +
      "</span>" +
      (!q.answer
        ? '<span class="source-tag">Chưa có đáp án</span>'
        : q.answerSource === "duplicate"
        ? '<span class="source-tag">Đáp án phục hồi</span>'
        : "") +
      "</div>" +
      '<button class="mark-btn' +
      (marked ? " is-marked" : "") +
      '" type="button" data-action="mark" aria-pressed="' +
      marked +
      '">' +
      icon(marked ? "flagFill" : "flag") +
      (marked ? "Đã đánh dấu" : "Đánh dấu") +
      "</button>" +
      "</div>" +
      '<h2 class="question-text">' +
      esc(q.text) +
      "</h2>" +
      (!q.answer
        ? '<p class="question-hint">' +
          icon("info") +
          "Câu này chưa có đáp án trong nguồn — không tính điểm.</p>"
        : "") +
      '<div class="options" role="group" aria-label="Các phương án trả lời">' +
      optionsHtml +
      "</div>" +
      feedbackHtml +
      '<div class="quiz-actions">' +
      '<div class="quiz-actions-left">' +
      '<button class="btn btn-ghost btn-sm" type="button" data-action="prev"' +
      (ctx.index === 0 ? " disabled" : "") +
      ">" +
      icon("arrowLeft") +
      "Câu trước</button>" +
      '<span class="keyboard-hint"><kbd>A</kbd><kbd>B</kbd><kbd>C</kbd><kbd>D</kbd> chọn · <kbd>←</kbd><kbd>→</kbd> chuyển · <kbd>M</kbd> đánh dấu</span>' +
      "</div>" +
      '<div class="quiz-actions-right">' +
      '<button class="btn btn-primary" type="button" data-action="next">' +
      (isLast ? "Xem kết quả" : "Câu tiếp") +
      icon(isLast ? "check" : "arrowRight") +
      "</button>" +
      "</div>" +
      "</div>" +
      "</article>" +
      "</div>" +

      '<aside class="quiz-sidebar">' +
      '<section class="sidebar-card">' +
      '<div class="sidebar-title">Tiến độ <span>' +
      stats.answered +
      "/" +
      ctx.questions.length +
      "</span></div>" +
      '<div class="sidebar-progress"><div class="sidebar-progress-bar"><span style="width:' +
      pct(stats.answered, ctx.questions.length) +
      '%"></span></div>' +
      '<div class="sidebar-progress-text"><span>Đã trả lời</span><span>' +
      pct(stats.answered, ctx.questions.length) +
      "%</span></div></div>" +
      '<div class="sidebar-stats">' +
      '<div class="sidebar-stat sidebar-stat--correct"><strong>' +
      stats.correct +
      "</strong><span>Đúng</span></div>" +
      '<div class="sidebar-stat sidebar-stat--wrong"><strong>' +
      stats.wrong +
      "</strong><span>Sai</span></div>" +
      '<div class="sidebar-stat sidebar-stat--unscored"><strong>' +
      stats.unscored +
      "</strong><span>Chưa có ĐA</span></div>" +
      "</div></section>" +
      '<section class="sidebar-card">' +
      '<div class="sidebar-title">Danh sách câu <span>' +
      (ctx.questions.length <= 100 ? ctx.questions.length + " câu" : "Đi đến câu") +
      "</span></div>" +
      navHtml +
      "</section>" +
      '<button class="btn btn-secondary btn-block" type="button" data-action="finish">' +
      icon("list") +
      "Xem kết quả</button>" +
      "</aside>" +
      "</div>" +
      "</div></div>";

    renderHeader();
  }

  function answerLetter(ctx, letter) {
    var q = currentQuestion(ctx);
    if (ctx.session.answers[q.gid]) return;
    if (LETTERS.indexOf(letter) < 0) return;
    ctx.session.answers[q.gid] = letter;
    state.practice[q.gid] = !q.answer ? "unscored" : letter === q.answer ? "correct" : "wrong";
    saveStore();
    renderQuizScreen(ctx);
  }

  function moveTo(ctx, index) {
    var next = clamp(index, 0, ctx.questions.length - 1);
    if (next === ctx.index) return;
    ctx.session.index = next;
    ctx.index = next;
    saveStore();
    renderQuizScreen(ctx);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function nextQuestion(ctx) {
    if (ctx.index >= ctx.questions.length - 1) {
      requestFinish(ctx);
      return;
    }
    moveTo(ctx, ctx.index + 1);
  }

  function prevQuestion(ctx) {
    moveTo(ctx, ctx.index - 1);
  }

  function toggleMark(ctx) {
    var q = currentQuestion(ctx);
    if (ctx.session.marked[q.gid]) delete ctx.session.marked[q.gid];
    else ctx.session.marked[q.gid] = true;
    saveStore();
    renderQuizScreen(ctx);
  }

  function requestFinish(ctx) {
    var stats = sessionStats(ctx.session, ctx.questions);
    if (stats.skipped > 0) {
      openModal({
        title: "Xem kết quả?",
        body:
          '<p class="modal-message">Bạn còn <strong>' +
          stats.skipped +
          " câu chưa trả lời</strong> trong " +
          (ctx.mode === "unit" ? "Unit này" : "đề này") +
          ". Những câu đó sẽ được tính là chưa làm.</p>",
        actions: [
          { label: "Tiếp tục làm", variant: "secondary" },
          {
            label: "Xem kết quả",
            variant: "primary",
            onClick: function () {
              go(ctx.resultHash);
            },
          },
        ],
      });
    } else {
      go(ctx.resultHash);
    }
  }

  function resetSession(session) {
    session.answers = {};
    session.marked = {};
    session.index = 0;
    session.startedAt = Date.now();
    saveStore();
  }

  function startUnit(unitId) {
    var unit = UNIT_BY_ID[unitId];
    if (!unit) return;
    var session = ensureUnitSession(unitId);
    if (unitStatus(unit) === "done") {
      go("#/unit/" + unitId + "/result");
      return;
    }
    if (session.index >= unit.questions.length) session.index = 0;
    go("#/unit/" + unitId);
  }

  function startRandom(size) {
    var ids = shuffle(ALL_QUESTIONS.map(function (q) {
      return q.gid;
    })).slice(0, size);
    state.random = {
      ids: ids,
      answers: {},
      marked: {},
      index: 0,
      size: size,
      startedAt: Date.now(),
    };
    saveStore();
    go("#/random");
    toast("Đã tạo đề " + size + " câu ngẫu nhiên.", "success");
  }

  function restartRandom() {
    if (!state.random) return;
    var ids = shuffle(state.random.ids);
    state.random = {
      ids: ids,
      answers: {},
      marked: {},
      index: 0,
      size: ids.length,
      startedAt: Date.now(),
    };
    saveStore();
    go("#/random");
  }

  function openRandomModal(preselect) {
    var active = state.random && state.random.ids && state.random.ids.length;
    var selected = preselect === 700 ? 700 : 50;
    openModal({
      title: "Tạo đề ngẫu nhiên",
      wide: true,
      body:
        '<p class="modal-message">Chọn độ dài đề. Câu hỏi được trộn ngẫu nhiên từ toàn bộ 700 câu của cả 3 chương.</p>' +
        '<div class="random-options">' +
        '<label class="random-option' +
        (selected === 50 ? " is-selected" : "") +
        '"><input type="radio" name="random-size" value="50"' +
        (selected === 50 ? " checked" : "") +
        ' /><span class="random-option-body"><span class="random-option-title">50 câu <span class="random-option-badge">Khuyến nghị</span></span><span class="random-option-desc">Một đề ngắn, phù hợp để ôn nhanh mỗi ngày. Khoảng 10–15 phút.</span></span></label>' +
        '<label class="random-option' +
        (selected === 700 ? " is-selected" : "") +
        '"><input type="radio" name="random-size" value="700"' +
        (selected === 700 ? " checked" : "") +
        ' /><span class="random-option-body"><span class="random-option-title">700 câu</span><span class="random-option-desc">Toàn bộ ngân hàng câu hỏi, thứ tự ngẫu nhiên. Phù hợp cho một lượt ôn dài.</span></span></label>' +
        "</div>" +
        (active
          ? '<div class="random-warning">Bạn đang có một đề chưa hoàn thành. Tạo đề mới sẽ thay thế đề hiện tại.</div>'
          : ""),
      actions: [
        { label: "Hủy", variant: "secondary" },
        {
          label: "Bắt đầu",
          variant: "primary",
          onClick: function () {
            var input = document.querySelector('input[name="random-size"]:checked');
            var size = input ? parseInt(input.value, 10) : 50;
            startRandom(size);
          },
        },
      ],
    });
  }

  function openRetryModal(ctx) {
    openModal({
      title: "Làm lại từ đầu?",
      body:
        '<p class="modal-message">Toàn bộ câu trả lời và đánh dấu của ' +
        (ctx.mode === "unit" ? ctx.unit.name : "đề ngẫu nhiên này") +
        " sẽ được đặt lại. Kỷ lục tốt nhất vẫn được giữ.</p>",
      actions: [
        { label: "Hủy", variant: "secondary" },
        {
          label: "Làm lại",
          variant: "primary",
          onClick: function () {
            resetSession(ctx.session);
            go(ctx.quizHash);
            toast("Đã đặt lại. Chúc bạn làm bài tốt!", "success");
          },
        },
      ],
    });
  }

  function openResetProgressModal() {
    openModal({
      title: "Xóa toàn bộ tiến độ?",
      body:
        '<p class="modal-message">Tất cả câu đã trả lời, đánh dấu, kết quả tốt nhất và đề ngẫu nhiên đang làm sẽ bị xóa khỏi trình duyệt. Hành động này không thể hoàn tác.</p>',
      actions: [
        { label: "Hủy", variant: "secondary" },
        {
          label: "Xóa tiến độ",
          variant: "danger",
          onClick: function () {
            try {
              localStorage.removeItem(STORE_KEY);
            } catch (err) {
              /* ignore */
            }
            state = defaultStore();
            ui.filter = "all";
            goHome();
            renderHeader();
            toast("Đã xóa tiến độ.", "success");
          },
        },
      ],
    });
  }

  /* ---------------- delegated events ---------------- */

  document.addEventListener("click", function (event) {
    var target = event.target.closest("[data-action]");
    if (!target) return;
    var action = target.getAttribute("data-action");
    var route = parseRoute();

    if (action === "home") {
      goHome();
      return;
    }
    if (action === "start-unit") {
      startUnit(parseInt(target.getAttribute("data-unit"), 10));
      return;
    }
    if (action === "random-modal") {
      var size = target.getAttribute("data-size");
      openRandomModal(size ? parseInt(size, 10) : null);
      return;
    }
    if (action === "resume-random") {
      go("#/random");
      return;
    }
    if (action === "filter") {
      ui.filter = target.getAttribute("data-filter") || "all";
      renderHome();
      return;
    }
    if (action === "reset-progress") {
      openResetProgressModal();
      return;
    }

    var ctx = getContext(route);
    if (!ctx) return;

    if (action === "answer") {
      answerLetter(ctx, target.getAttribute("data-letter"));
    } else if (action === "next") {
      nextQuestion(ctx);
    } else if (action === "prev") {
      prevQuestion(ctx);
    } else if (action === "mark") {
      toggleMark(ctx);
    } else if (action === "goto") {
      moveTo(ctx, parseInt(target.getAttribute("data-index"), 10));
    } else if (action === "finish") {
      requestFinish(ctx);
    } else if (action === "jump") {
      var input = document.getElementById("jump-input");
      if (input && input.value) {
        moveTo(ctx, parseInt(input.value, 10) - 1);
        input.value = "";
      }
    } else if (action === "retry") {
      openRetryModal(ctx);
    } else if (action === "restart-random") {
      restartRandom();
    } else if (action === "review-wrong") {
      var section = document.getElementById("review-wrong");
      if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  document.addEventListener("change", function (event) {
    var input = event.target;
    if (input && input.name === "random-size") {
      var options = document.querySelectorAll(".random-option");
      for (var i = 0; i < options.length; i++) options[i].classList.remove("is-selected");
      var label = input.closest(".random-option");
      if (label) label.classList.add("is-selected");
    }
  });

  document.addEventListener("keydown", function (event) {
    var modalRoot = document.getElementById("modal-root");
    if (modalRoot && modalRoot.children.length) return;
    var route = parseRoute();
    if (route.result) return;
    if (route.name !== "unit" && route.name !== "random") return;
    var tag = (event.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    var ctx = getContext(route);
    if (!ctx) return;
    var key = event.key;
    if (/^[a-dA-D]$/.test(key)) {
      event.preventDefault();
      answerLetter(ctx, key.toUpperCase());
    } else if (key === "ArrowRight") {
      event.preventDefault();
      nextQuestion(ctx);
    } else if (key === "ArrowLeft") {
      event.preventDefault();
      prevQuestion(ctx);
    } else if (key === "m" || key === "M") {
      event.preventDefault();
      toggleMark(ctx);
    }
  });

  /* ---------------- results ---------------- */

  function renderResults(route) {
    var ctx = getContext(route);
    if (!ctx) {
      toast("Không tìm thấy kết quả. Hãy tạo đề mới.", "error");
      goHome();
      return;
    }
    var stats = sessionStats(ctx.session, ctx.questions);

    if (ctx.mode === "unit" && stats.answered > 0) {
      var best = ctx.session.best;
      var better =
        !best ||
        stats.accuracy > best.accuracy ||
        (stats.accuracy === best.accuracy && stats.correct > best.correct);
      if (better) {
        ctx.session.best = {
          accuracy: stats.accuracy == null ? 0 : stats.accuracy,
          correct: stats.correct,
          wrong: stats.wrong,
          unscored: stats.unscored,
          answered: stats.answered,
          total: stats.total,
          at: Date.now(),
        };
        saveStore();
      }
    }

    renderResultsScreen(ctx, stats);
  }

  function resultsTitle(stats) {
    if (!stats.scored) return "Chưa có câu nào được chấm";
    var acc = stats.accuracy;
    if (acc >= 85) return "Xuất sắc!";
    if (acc >= 70) return "Làm tốt lắm";
    if (acc >= 50) return "Ổn, nhưng còn tiến bộ";
    return "Cần ôn lại thêm";
  }

  function resultsSubtitle(ctx, stats) {
    var target = ctx.mode === "unit" ? ctx.unit.name : "đề ngẫu nhiên";
    if (!stats.scored) {
      return (
        "Chưa có câu nào trong " +
        target +
        " được chấm điểm. Hãy trả lời thêm rồi quay lại xem kết quả."
      );
    }
    var text =
      "Bạn trả lời đúng " +
      stats.correct +
      "/" +
      stats.scored +
      " câu đã chấm (" +
      stats.accuracy +
      "%). ";
    if (stats.unscored) {
      text += stats.unscored + " câu chưa có đáp án trong nguồn được loại khỏi điểm số. ";
    }
    if (stats.skipped) {
      text += stats.skipped + " câu chưa trả lời.";
    }
    return text.trim();
  }

  function renderResultsScreen(ctx, stats) {
    var accuracy = stats.accuracy == null ? 0 : stats.accuracy;
    var circumference = 326.73;
    var ringClass = accuracy < 50 ? " is-low" : accuracy < 80 ? " is-ok" : "";
    if (accuracy === 0) ringClass += " is-zero";

    var wrongItems = ctx.questions
      .map(function (q, i) {
        return { q: q, i: i, picked: ctx.session.answers[q.gid] };
      })
      .filter(function (item) {
        return item.picked && item.q.answer && item.picked !== item.q.answer;
      });

    var wrongHtml = wrongItems.length
      ? '<div class="wrong-list">' +
        wrongItems.map(function (item) {
          var q = item.q;
          var correctText = q.options[LETTERS.indexOf(q.answer)];
          var pickedText = q.options[LETTERS.indexOf(item.picked)];
          var options = q.options
            .map(function (option, oi) {
              var letter = LETTERS[oi];
              var cls =
                letter === q.answer ? "is-correct" : letter === item.picked ? "is-wrong" : "is-dim";
              return (
                '<div class="preview-option ' +
                cls +
                '"><span class="preview-letter">' +
                letter +
                "</span><span>" +
                esc(option) +
                "</span></div>"
              );
            })
            .join("");
          return (
            '<details class="wrong-item">' +
            "<summary>" +
            '<span class="wrong-index">' +
            (item.i + 1) +
            "</span>" +
            '<span class="wrong-text">' +
            esc(q.text) +
            "</span>" +
            '<span class="wrong-answer-pair"><span class="is-wrong-letter">Bạn: ' +
            item.picked +
            '</span> · <span class="is-correct-letter">Đúng: ' +
            q.answer +
            "</span></span>" +
            "</summary>" +
            '<div class="wrong-detail">' +
            "<p><strong>Đáp án đúng:</strong> " +
            q.answer +
            ". " +
            esc(correctText) +
            "</p>" +
            "<p><strong>Bạn chọn:</strong> " +
            item.picked +
            ". " +
            esc(pickedText) +
            "</p>" +
            '<div class="preview-options" style="margin-top:10px">' +
            options +
            "</div>" +
            '<p style="margin-top:10px">' +
            chapterShort(q) +
            " · Câu gốc " +
            q.chapterQuestionNumber +
            "</p>" +
            '<button class="btn btn-secondary btn-sm" type="button" data-action="goto" data-index="' +
            item.i +
            '">Xem lại câu này</button>' +
            "</div></details>"
          );
        }).join("") +
        "</div>"
      : '<div class="empty-state"><div class="empty-icon">' +
        icon("check") +
        '</div><p class="empty-title">Không có câu trả lời sai</p><p class="empty-text">' +
        (stats.scored
          ? "Bạn đã trả lời đúng tất cả các câu đã chấm."
          : "Chưa có câu nào được chấm điểm.") +
        "</p></div>";

    var markedItems = ctx.questions
      .map(function (q, i) {
        return { q: q, i: i };
      })
      .filter(function (item) {
        return ctx.session.marked[item.q.gid];
      });

    var markedHtml = markedItems.length
      ? '<section class="review-section" id="review-marked"><div class="review-head"><h2 class="review-title">Câu đã đánh dấu</h2><span class="review-count">' +
        markedItems.length +
        ' câu</span></div><div class="marked-list">' +
        markedItems
          .map(function (item) {
            return (
              '<button class="marked-chip" type="button" data-action="goto" data-index="' +
              item.i +
              '">' +
              icon("flag") +
              "Câu " +
              (item.i + 1) +
              "</button>"
            );
          })
          .join("") +
        "</div></section>"
      : "";

    var actionsHtml =
      ctx.mode === "unit"
        ? '<button class="btn btn-primary" type="button" data-action="retry">' +
          icon("refresh") +
          "Làm lại " +
          esc(ctx.unit.name) +
          "</button>" +
          '<button class="btn btn-secondary" type="button" data-action="review-wrong"' +
          (wrongItems.length ? "" : " disabled") +
          ">" +
          icon("list") +
          "Ôn câu sai (" +
          wrongItems.length +
          ")</button>" +
          '<button class="btn btn-ghost" type="button" data-action="home">' +
          icon("home") +
          "Trang chủ</button>"
        : '<button class="btn btn-primary" type="button" data-action="random-modal">' +
          icon("shuffle") +
          "Tạo đề mới</button>" +
          '<button class="btn btn-secondary" type="button" data-action="restart-random">' +
          icon("refresh") +
          "Làm lại đề này</button>" +
          '<button class="btn btn-ghost" type="button" data-action="review-wrong"' +
          (wrongItems.length ? "" : " disabled") +
          ">" +
          icon("list") +
          "Ôn câu sai (" +
          wrongItems.length +
          ")</button>" +
          '<button class="btn btn-ghost" type="button" data-action="home">' +
          icon("home") +
          "Trang chủ</button>";

    app.innerHTML =
      '<div class="screen results-screen"><div class="container">' +
      '<div class="results-hero">' +
      '<div class="results-copy">' +
      '<span class="eyebrow"><span class="dot"></span>Kết quả · ' +
      esc(ctx.mode === "unit" ? ctx.unit.name : "Đề ngẫu nhiên") +
      "</span>" +
      '<h1 class="results-title">' +
      esc(resultsTitle(stats)) +
      "</h1>" +
      '<p class="results-sub">' +
      esc(resultsSubtitle(ctx, stats)) +
      "</p>" +
      '<div class="results-actions">' +
      actionsHtml +
      "</div>" +
      "</div>" +
      '<div class="results-ring' +
      ringClass +
      '">' +
      '<svg viewBox="0 0 120 120"><circle class="ring-track" cx="60" cy="60" r="52"/><circle class="ring-value" cx="60" cy="60" r="52" stroke-dasharray="' +
      circumference +
      '" stroke-dashoffset="' +
      (circumference * (1 - accuracy / 100)).toFixed(1) +
      '"/></svg>' +
      '<div class="results-ring-label"><strong>' +
      (stats.scored ? accuracy + "%" : "—") +
      "</strong><span>chính xác</span></div>" +
      "</div>" +
      "</div>" +

      '<div class="result-stats">' +
      '<div class="result-stat result-stat--correct"><span class="result-stat-value">' +
      stats.correct +
      '</span><span class="result-stat-label">Trả lời đúng</span></div>' +
      '<div class="result-stat result-stat--wrong"><span class="result-stat-value">' +
      stats.wrong +
      '</span><span class="result-stat-label">Trả lời sai</span></div>' +
      '<div class="result-stat result-stat--unscored"><span class="result-stat-value">' +
      stats.unscored +
      '</span><span class="result-stat-label">Chưa có đáp án</span></div>' +
      '<div class="result-stat result-stat--skipped"><span class="result-stat-value">' +
      stats.skipped +
      '</span><span class="result-stat-label">Chưa trả lời</span></div>' +
      "</div>" +
      (stats.unscored
        ? '<div class="result-note">' +
          icon("info") +
          "<span><strong>" +
          stats.unscored +
          " câu chưa có đáp án trong file gốc</strong> đã được loại khỏi điểm số. Độ chính xác chỉ tính trên " +
          stats.scored +
          " câu đã chấm.</span></div>"
        : "") +

      '<section class="review-section" id="review-wrong">' +
      '<div class="review-head"><h2 class="review-title">Câu trả lời sai</h2><span class="review-count">' +
      wrongItems.length +
      " câu</span></div>" +
      wrongHtml +
      "</section>" +
      markedHtml +
      "</div></div>";

    renderHeader();
  }

  /* ---------------- modals ---------------- */

  var modalCloser = null;

  function openModal(options) {
    var root = document.getElementById("modal-root");
    if (!root) return function () {};
    if (modalCloser) modalCloser();

    var actions = options.actions || [];
    var actionsHtml = actions
      .map(function (action, index) {
        var variant =
          action.variant === "primary"
            ? "btn-primary"
            : action.variant === "danger"
            ? "btn-danger"
            : "btn-secondary";
        return (
          '<button class="btn ' +
          variant +
          '" type="button" data-modal-action="' +
          index +
          '">' +
          esc(action.label) +
          "</button>"
        );
      })
      .join("");

    root.innerHTML =
      '<div class="modal-backdrop" data-modal-backdrop>' +
      '<div class="modal' +
      (options.wide ? " modal--wide" : "") +
      '" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
      '<div class="modal-head"><h2 class="modal-title" id="modal-title">' +
      esc(options.title) +
      '</h2><button class="modal-close" type="button" data-modal-close aria-label="Đóng">' +
      icon("close") +
      "</button></div>" +
      '<div class="modal-body">' +
      options.body +
      (actionsHtml ? '<div class="modal-actions">' + actionsHtml + "</div>" : "") +
      "</div></div></div>";

    var previousFocus = document.activeElement;
    var backdrop = root.querySelector("[data-modal-backdrop]");
    var closeBtn = root.querySelector("[data-modal-close]");
    var actionButtons = root.querySelectorAll("[data-modal-action]");
    document.body.style.overflow = "hidden";

    function close() {
      root.innerHTML = "";
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
      modalCloser = null;
      if (previousFocus && previousFocus.focus && document.contains(previousFocus)) {
        previousFocus.focus();
      }
    }

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    }

    modalCloser = close;
    document.addEventListener("keydown", onKeyDown);

    if (backdrop) {
      backdrop.addEventListener("mousedown", function (event) {
        if (event.target === backdrop) close();
      });
    }
    if (closeBtn) closeBtn.addEventListener("click", close);

    for (var i = 0; i < actionButtons.length; i++) {
      (function (button, index) {
        button.addEventListener("click", function () {
          var action = actions[index];
          if (action && typeof action.onClick === "function") {
            action.onClick();
          }
          close();
        });
      })(actionButtons[i], i);
    }

    setTimeout(function () {
      var primary = root.querySelector(".modal-actions .btn-primary, .modal-actions .btn-danger");
      if (primary) primary.focus();
    }, 30);

    return close;
  }

  /* ---------------- router / boot ---------------- */

  function renderRoute() {
    var route = parseRoute();
    if (route.name === "home") {
      renderHome();
    } else if (route.result) {
      renderResults(route);
    } else {
      renderQuiz(route);
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  window.addEventListener("hashchange", renderRoute);

  if (!location.hash) {
    try {
      history.replaceState(null, "", "#/");
    } catch (err) {
      location.hash = "#/";
    }
  }

  renderRoute();
  renderHeader();
})();
