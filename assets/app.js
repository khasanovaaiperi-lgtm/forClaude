/* Тренажёр медицинской статистики в R — логика приложения.
   Содержание курса лежит в content.js, вопросы — в questions.js. */
(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = window.UTIL.esc;

  /* ---------------- progress (localStorage, optional) ---------------- */
  const KEY = "rmed-progress-v1";
  let P = { done: {}, q: {} };
  try { const raw = localStorage.getItem(KEY); if (raw) P = Object.assign(P, JSON.parse(raw)); } catch (e) { /* storage unavailable */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* ignore */ } };
  function recordAnswer(qid, ok) {
    const r = P.q[qid] || { c: 0, w: 0 };
    ok ? r.c++ : r.w++;
    r.last = ok ? "ok" : "no";
    P.q[qid] = r; save();
  }

  const MODULES = window.COURSE.modules;
  const PARTS = window.COURSE.parts;
  const QUESTIONS = window.QUESTIONS;
  const QMAP = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

  const hlR = window.UTIL.hlR;

  /* ---------------- copy ---------------- */
  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast"; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), 1800);
  }
  function copyText(text, el) {
    const fallback = () => {
      if (!el) return toast("Выделите текст и скопируйте вручную");
      const r = document.createRange(); r.selectNodeContents(el);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      toast("Текст выделен — нажмите Ctrl+C");
    };
    try {
      navigator.clipboard.writeText(text).then(() => toast("Скопировано"), fallback);
    } catch (e) { fallback(); }
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-copy]");
    if (!b) return;
    const target = document.getElementById(b.dataset.copy);
    if (target) copyText(target.dataset.raw || target.innerText, target);
  });

  /* annotation highlighting: number badge <-> mark in console */
  document.addEventListener("click", (e) => {
    const n = e.target.closest(".anns .n, mark.ann");
    if (!n) return;
    const box = n.closest(".annot");
    if (!box) return;
    const num = n.dataset.n;
    $$("mark.ann", box).forEach((m) => m.classList.toggle("flash", m.dataset.n === num));
    const li = $(`.anns li[data-n="${num}"]`, box);
    if (li && n.tagName === "MARK") li.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  /* ---------------- nav ---------------- */
  function navHTML() {
    let h = `<a class="brand" href="#home"><span class="brand-mark">R</span><span><b>Медстат на R</b><small>курс и тренажёр</small></span></a>`;
    h += `<div class="nav-group">
      <a class="nav-link" href="#home" data-route="home">Главная</a>
      <a class="nav-link" href="#claude" data-route="claude">Как работать с Claude</a>
      <a class="nav-link" href="#trainer" data-route="trainer">Тренажёр</a>
      <a class="nav-link" href="#wizard" data-route="wizard">Какой метод выбрать?</a>
      <a class="nav-link" href="#labs" data-route="labs">Симуляторы</a>
      <a class="nav-link" href="#glossary" data-route="glossary">Словарь терминов</a>
    </div>`;
    PARTS.forEach((p) => {
      h += `<div class="nav-group"><div class="nav-label">${esc(p.title)}</div>`;
      MODULES.filter((m) => m.part === p.id).forEach((m) => {
        h += `<a class="nav-link" href="#${m.id}" data-route="${m.id}"><span class="nav-num">${m.num}</span><span>${esc(m.title)}</span>${P.done[m.id] ? '<span class="nav-done" title="Модуль пройден">✓</span>' : ""}</a>`;
      });
      h += `</div>`;
    });
    h += `<div class="nav-foot"><button class="btn small ghost" id="themeBtn" type="button">Тема: авто</button></div>`;
    return h;
  }
  function renderNav(route) {
    const nav = $("#nav");
    nav.innerHTML = navHTML();
    $$(".nav-link", nav).forEach((a) => { if (a.dataset.route === route) a.setAttribute("aria-current", "page"); });
    setupTheme();
  }
  function setupTheme() {
    const btn = $("#themeBtn"); if (!btn) return;
    const labels = { auto: "Тема: авто", light: "Тема: светлая", dark: "Тема: тёмная" };
    let cur = "auto";
    try { cur = localStorage.getItem("rmed-theme") || "auto"; } catch (e) {}
    btn.textContent = labels[cur];
    btn.onclick = () => {
      cur = cur === "auto" ? "light" : cur === "light" ? "dark" : "auto";
      applyTheme(cur); btn.textContent = labels[cur];
      try { localStorage.setItem("rmed-theme", cur); } catch (e) {}
    };
  }
  function applyTheme(t) {
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }
  try { applyTheme(localStorage.getItem("rmed-theme") || "auto"); } catch (e) {}

  function closeNav() { $("#nav").classList.remove("open"); const s = $(".scrim"); if (s) s.remove(); }
  $("#menuBtn").addEventListener("click", () => {
    $("#nav").classList.add("open");
    const s = document.createElement("div"); s.className = "scrim"; s.onclick = closeNav; document.body.appendChild(s);
  });

  /* ---------------- pages ---------------- */
  function pageHome() {
    const done = MODULES.filter((m) => P.done[m.id]).length;
    const answered = Object.keys(P.q).length;
    const right = Object.values(P.q).filter((r) => r.last === "ok").length;
    const next = MODULES.find((m) => !P.done[m.id]) || MODULES[0];
    let path = "";
    PARTS.forEach((p) => {
      path += `<div class="part">${esc(p.title)}</div>`;
      MODULES.filter((m) => m.part === p.id).forEach((m) => {
        path += `<a href="#${m.id}"><span class="pn">${m.num}</span><span class="pt"><b>${esc(m.title)}</b><span>${esc(m.sub)}</span></span>${P.done[m.id] ? '<span class="chip ok">пройден</span>' : `<span class="chip">${m.min} мин</span>`}</a>`;
      });
    });
    return `<div class="page wide">
      <div class="hero">
        <div class="prose">
          <span class="eyebrow">Для врачей и исследователей без статистического образования</span>
          <h1>Медицинская статистика в R — <em>без программирования</em></h1>
          <p class="lede">Вы учитесь понимать методы и читать результаты. Код на R для ваших данных пишет Claude, а вы запускаете его и проверяете, правильно ли выбран анализ.</p>
          <div class="row"><a class="btn primary" href="#${next.id}">${done ? "Продолжить: " : "Начать: "}${esc(next.title)}</a><a class="btn" href="#trainer">Открыть тренажёр</a></div>
        </div>
        <div class="stats">
          <div class="stat"><b>${done}/${MODULES.length}</b><span>модулей пройдено</span></div>
          <div class="stat"><b>${answered}</b><span>вопросов решено</span></div>
          <div class="stat"><b>${answered ? Math.round((100 * right) / answered) + "%" : "—"}</b><span>верных ответов</span></div>
        </div>
      </div>

      <h2>Как устроена работа</h2>
      <div class="flow">
        <div class="flow-step"><span class="who">Вы</span><b>Описываете задачу</b><p>Дизайн исследования, переменные, гипотезу. Данные — без персональной информации.</p></div>
        <div class="flow-step"><span class="who me">Claude</span><b>Пишет код на R</b><p>С комментариями на русском и проверкой допущений метода.</p></div>
        <div class="flow-step"><span class="who">Вы</span><b>Запускаете в RStudio</b><p>Копируете код, нажимаете Ctrl+Enter, копируете вывод обратно.</p></div>
        <div class="flow-step"><span class="who me">Claude</span><b>Объясняет результат</b><p>Что значат цифры и как это написать в статье.</p></div>
      </div>
      <p class="muted">Ваша задача на курсе — научиться задавать правильные вопросы и замечать ошибки. Для этого на сайте есть уроки, тренажёр, помощник выбора метода и симуляторы. <a href="#claude">Подробнее о работе с Claude →</a></p>

      <h2>Программа курса</h2>
      <div class="path">${path}</div>

      <h2>Инструменты</h2>
      <div class="cards">
        <a class="card" href="#trainer"><b>Тренажёр</b><p>${QUESTIONS.length} вопросов: выбор метода, чтение вывода R, поиск ошибок в статьях.</p></a>
        <a class="card" href="#wizard"><b>Какой метод выбрать?</b><p>Пошаговый помощник: отвечаете на 3–4 вопроса о данных и получаете метод, функцию R и готовый запрос для Claude.</p></a>
        <a class="card" href="#labs"><b>Симуляторы</b><p>Посмотрите своими глазами, как ведут себя p-value, доверительные интервалы и чувствительность теста.</p></a>
        <a class="card" href="#glossary"><b>Словарь</b><p>Русские и английские термины с объяснением простыми словами.</p></a>
      </div>
      <p class="small muted">Все данные в примерах вымышленные и смоделированы случайным образом. Результаты R получены настоящим запуском кода на этих данных.</p>
    </div>`;
  }

  function pageModule(m) {
    const idx = MODULES.indexOf(m);
    const prev = MODULES[idx - 1], next = MODULES[idx + 1];
    const qs = (m.quiz || []).map((id) => QMAP[id]).filter(Boolean);
    return `<article class="page">
      <header class="mod-head">
        <span class="eyebrow">Модуль ${m.num} · ${esc(PARTS.find((p) => p.id === m.part).title)}</span>
        <h1>${esc(m.title)}</h1>
        <p class="lede">${esc(m.sub)}</p>
        <div class="mod-meta"><span class="chip">${m.min} минут</span>${P.done[m.id] ? '<span class="chip ok">пройден</span>' : ""}${qs.length ? `<span class="chip acc">${qs.length} вопросов для самопроверки</span>` : ""}</div>
        <nav class="toc" id="toc" aria-label="Содержание модуля"></nav>
      </header>
      <div class="mod-body" id="modBody">${m.body}</div>
      ${m.ask ? askBlock(m.ask, "ask-" + m.id) : ""}
      ${qs.length ? `<section class="sec" id="check"><h2>Проверьте себя</h2><div class="mini-quiz">${qs.map((q, i) => questionHTML(q, i, "mq")).join("")}</div></section>` : ""}
      <div class="mod-foot">
        ${prev ? `<a class="btn ghost" href="#${prev.id}">← ${esc(prev.title)}</a>` : "<span></span>"}
        <button class="btn ${P.done[m.id] ? "" : "primary"}" id="doneBtn" type="button">${P.done[m.id] ? "Отметка «пройден» стоит — снять" : "Отметить модуль пройденным"}</button>
        ${next ? `<a class="btn ghost" href="#${next.id}">${esc(next.title)} →</a>` : `<a class="btn ghost" href="#trainer">В тренажёр →</a>`}
      </div>
    </article>`;
  }

  function askBlock(text, id) {
    return `<section class="ask"><div class="ask-h"><b>Запрос для Claude — шаблон</b><button class="btn small" type="button" data-copy="${id}">Скопировать</button></div>
      <blockquote id="${id}">${esc(text)}</blockquote>
      <p class="small muted">Замените текст в [квадратных скобках] на своё и отправьте Claude.</p></section>`;
  }

  /* ---------------- questions ---------------- */
  const LETTERS = "АБВГДЕ";
  function questionHTML(q, i, prefix) {
    const order = q.opts.map((_, k) => k);
    if (!q.fixed) shuffle(order);
    const typeLabel = { concept: "Понятие", choose: "Выбор метода", output: "Вывод R", error: "Найдите ошибку", calc: "Посчитайте" }[q.type] || "Вопрос";
    return `<div class="q" data-qid="${q.id}" data-prefix="${prefix}">
      <div class="q-top"><span class="chip acc">${typeLabel}</span>${q.mod ? `<a class="small" href="#${q.mod}">Модуль ${(MODULES.find((m) => m.id === q.mod) || {}).num || ""}</a>` : ""}</div>
      <div class="q-text">${q.q}</div>
      <div class="opts">${order.map((k, j) => `<button type="button" class="opt" data-k="${k}"><span class="l">${LETTERS[j]}</span><span>${q.opts[k]}</span></button>`).join("")}</div>
      <div class="why-slot"></div>
    </div>`;
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function bindQuestions(root, onAnswer) {
    $$(".q", root).forEach((box) => {
      const q = QMAP[box.dataset.qid];
      $$(".opt", box).forEach((b) => {
        b.addEventListener("click", () => {
          if (box.dataset.answered) return;
          box.dataset.answered = "1";
          const k = +b.dataset.k, ok = k === q.a;
          $$(".opt", box).forEach((o) => {
            o.disabled = true;
            if (+o.dataset.k === q.a) o.classList.add("right");
          });
          if (!ok) b.classList.add("wrong");
          const optNote = q.optWhy && q.optWhy[k] && !ok ? `<p>${q.optWhy[k]}</p>` : "";
          $(".why-slot", box).innerHTML = `<div class="why ${ok ? "ok" : "no"}"><b class="v">${ok ? "Верно" : "Не совсем"}</b>${optNote}<p>${q.why}</p></div>`;
          recordAnswer(q.id, ok);
          if (onAnswer) onAnswer(ok);
        });
      });
    });
  }

  /* ---------------- trainer ---------------- */
  let session = null;
  function trainerModes() {
    const by = (f) => QUESTIONS.filter(f);
    const wrong = by((q) => P.q[q.id] && P.q[q.id].last === "no");
    const fresh = by((q) => !P.q[q.id]);
    return [
      { id: "mix", title: "Смешанная тренировка", desc: "10 случайных вопросов из всего курса, сначала нерешённые.", pool: fresh.length >= 10 ? fresh : QUESTIONS, n: 10 },
      { id: "choose", title: "Какой метод выбрать?", desc: "Описание исследования — выберите статистический тест.", pool: by((q) => q.type === "choose"), n: 10 },
      { id: "output", title: "Прочитайте вывод R", desc: "Фрагменты вывода консоли R: что означают эти цифры.", pool: by((q) => q.type === "output"), n: 10 },
      { id: "error", title: "Найдите ошибку", desc: "Фразы из «статей» и рассуждения коллег. Где подвох?", pool: by((q) => q.type === "error"), n: 10 },
      { id: "concept", title: "Понятия и расчёты", desc: "p-value, доверительные интервалы, мощность, риски.", pool: by((q) => q.type === "concept" || q.type === "calc"), n: 10 },
      { id: "wrong", title: "Работа над ошибками", desc: wrong.length ? "Вопросы, на которые вы в последний раз ответили неверно." : "Пока пусто — здесь появятся вопросы, где вы ошиблись.", pool: wrong, n: 15 },
      { id: "exam", title: "Итоговый экзамен", desc: "20 вопросов из всех модулей. Порог — 80 %.", pool: QUESTIONS, n: 20 },
    ];
  }
  function pageTrainer() {
    const modes = trainerModes();
    const modOpts = MODULES.filter((m) => QUESTIONS.some((q) => q.mod === m.id))
      .map((m) => `<option value="${m.id}">${m.num}. ${esc(m.title)}</option>`).join("");
    return `<div class="page">
      <span class="eyebrow">Тренажёр</span>
      <h1>Тренируйтесь на ситуациях из практики</h1>
      <p class="lede">Код писать не нужно. Нужно понять, какой метод подходит, и правильно прочитать результат. После каждого ответа вы увидите объяснение.</p>
      <div class="modes">${modes.map((m) => `<button type="button" class="card mode" data-mode="${m.id}" ${m.pool.length ? "" : "disabled"}><b>${esc(m.title)}</b><p>${esc(m.desc)}</p><span class="cnt">в банке: ${m.pool.length}</span></button>`).join("")}</div>
      <div class="lab"><b>Вопросы по одному модулю</b>
        <div class="row"><select class="inp" id="modSel" aria-label="Модуль">${modOpts}</select><button class="btn primary" type="button" id="modGo">Начать</button></div>
      </div>
    </div>`;
  }
  function startSession(title, pool, n) {
    const qs = shuffle(pool.slice()).slice(0, Math.min(n, pool.length));
    session = { title, qs, i: 0, right: 0 };
    renderSession();
  }
  function renderSession() {
    const s = session, main = $("#main");
    if (s.i >= s.qs.length) {
      const pct = Math.round((100 * s.right) / s.qs.length);
      main.innerHTML = `<div class="page"><div class="q result">
        <span class="eyebrow">${esc(s.title)} — итог</span>
        <span class="big">${s.right} из ${s.qs.length}</span>
        <p>${pct >= 80 ? "Отличный результат. Можно переходить дальше." : pct >= 50 ? "Неплохо. Загляните в «Работу над ошибками» — там вопросы, где вы ошиблись." : "Есть пробелы. Перечитайте модули, на которые ссылаются вопросы, и повторите."}</p>
        <div class="row"><a class="btn primary" href="#trainer">К режимам тренажёра</a><button class="btn" type="button" id="again">Ещё раз</button></div>
      </div></div>`;
      $("#again").onclick = () => { const t = s.title; const pool = s.qs; startSession(t, pool, pool.length); };
      return;
    }
    const q = s.qs[s.i];
    main.innerHTML = `<div class="page">
      <div class="row" style="justify-content:space-between"><span class="eyebrow">${esc(s.title)}</span><span class="small muted">Вопрос ${s.i + 1} из ${s.qs.length} · верно ${s.right}</span></div>
      <div class="progressbar"><i style="width:${(100 * s.i) / s.qs.length}%"></i></div>
      ${questionHTML(q, s.i, "s")}
      <div class="row" style="justify-content:space-between"><a class="btn ghost" href="#trainer">Выйти</a><button class="btn primary" type="button" id="nextQ" disabled>Дальше →</button></div>
    </div>`;
    bindQuestions(main, (ok) => { if (ok) s.right++; $("#nextQ").disabled = false; $("#nextQ").focus({ preventScroll: true }); });
    $("#nextQ").onclick = () => { s.i++; renderSession(); window.scrollTo(0, 0); };
  }

  /* ---------------- glossary / claude / setup pages ---------------- */
  function pageGlossary() {
    const items = window.COURSE.glossary.slice().sort((a, b) => a[0].localeCompare(b[0], "ru"));
    return `<div class="page"><span class="eyebrow">Словарь</span><h1>Термины простыми словами</h1>
      <p class="lede">В статьях термины встречаются на английском, поэтому рядом указан оригинал.</p>
      <input class="inp" id="gq" type="search" placeholder="Найти термин…" aria-label="Поиск по словарю">
      <div class="gloss" id="glist">${items.map((t) => `<div class="item" data-s="${esc((t[0] + " " + t[1]).toLowerCase())}"><dt>${esc(t[0])}<small>${esc(t[1])}</small></dt><dd>${t[2]}</dd></div>`).join("")}</div></div>`;
  }

  /* ---------------- router ---------------- */
  function route() {
    const r = (location.hash || "#home").slice(1) || "home";
    closeNav();
    const main = $("#main");
    const mod = MODULES.find((m) => m.id === r);
    let key = r;
    if (mod) {
      main.innerHTML = pageModule(mod);
      const toc = $("#toc");
      const heads = $$(".mod-body h2", main);
      heads.forEach((h, i) => { const sec = h.closest(".sec") || h; if (!sec.id) sec.id = "s" + i; });
      toc.innerHTML = heads.map((h) => `<a href="#" data-goto="${(h.closest(".sec") || h).id}">${esc(h.textContent)}</a>`).join("") + ($("#check") ? `<a href="#" data-goto="check">Проверьте себя</a>` : "");
      bindQuestions(main);
      $("#doneBtn").onclick = () => { if (P.done[mod.id]) delete P.done[mod.id]; else P.done[mod.id] = Date.now(); save(); route(); };
      if (mod.after) mod.after(main);
    } else if (r === "trainer") {
      main.innerHTML = pageTrainer();
      const modes = trainerModes();
      $$(".mode", main).forEach((b) => b.onclick = () => { const m = modes.find((x) => x.id === b.dataset.mode); startSession(m.title, m.pool, m.n); window.scrollTo(0, 0); });
      $("#modGo").onclick = () => { const id = $("#modSel").value; const m = MODULES.find((x) => x.id === id); startSession("Модуль " + m.num + ": " + m.title, QUESTIONS.filter((q) => q.mod === id), 12); };
    } else if (r === "wizard") {
      window.WIZARD.mount(main);
    } else if (r === "labs" || r.startsWith("lab-")) {
      key = "labs";
      window.LABS.mount(main, r);
    } else if (r === "glossary") {
      main.innerHTML = pageGlossary();
      $("#gq").addEventListener("input", (e) => { const v = e.target.value.toLowerCase().trim(); $$("#glist .item").forEach((it) => { it.hidden = v && !it.dataset.s.includes(v); }); });
    } else if (r === "claude") {
      main.innerHTML = window.COURSE.claudePage;
    } else {
      key = "home";
      main.innerHTML = pageHome();
    }
    renderNav(key);
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }
  document.addEventListener("click", (e) => {
    const g = e.target.closest("[data-goto]");
    if (!g) return;
    e.preventDefault();
    const t = document.getElementById(g.dataset.goto);
    if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  window.addEventListener("hashchange", route);
  window.APP = { esc, hlR, askBlock, bindQuestions, questionHTML, QMAP };
  route();
})();
