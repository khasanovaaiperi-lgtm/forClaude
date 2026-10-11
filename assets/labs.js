/* Симуляторы: всё считается в браузере, без R. */
(function () {
  "use strict";
  const esc = window.UTIL.esc;

  /* ---------- математика ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let rnd = Math.random;
  function rnorm() { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function lgamma(x) {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015; for (let j = 0; j < 6; j++) ser += c[j] / ++y;
    return -tmp + Math.log((2.5066282746310005 * ser) / x);
  }
  function betacf(a, b, x) {
    const MAXIT = 200, EPS = 3e-14, FPMIN = 1e-300;
    let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - (qab * x) / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
    for (let m = 1; m <= MAXIT; m++) {
      const m2 = 2 * m;
      let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
      aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d;
      const del = d * c; h *= del; if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }
  function ibeta(x, a, b) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
  }
  const pt2 = (t, df) => ibeta(df / (df + t * t), df / 2, 0.5);             // двустороннее p
  function qt(p, df) {                                                         // квантиль t (p > 0.5)
    let lo = 0, hi = 50;
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; (1 - pt2(mid, df) / 2 < p) ? (lo = mid) : (hi = mid); }
    return (lo + hi) / 2;
  }
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const variance = (a) => { const m = mean(a); return a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1); };
  function welch(a, b) {
    const va = variance(a) / a.length, vb = variance(b) / b.length;
    const t = (mean(a) - mean(b)) / Math.sqrt(va + vb);
    const df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1));
    return { t, df, p: pt2(Math.abs(t), df) };
  }
  function pearson(x, y) {
    const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
    return sxy / Math.sqrt(sxx * syy);
  }
  function ranks(a) {
    const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]); const r = new Array(a.length);
    for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; const rk = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k][1]] = rk; i = j + 1; }
    return r;
  }
  const spearman = (x, y) => pearson(ranks(x), ranks(y));
  const fmtP = (p) => (p < 0.001 ? "< 0,001" : p.toFixed(3).replace(".", ","));
  const fmt = (x, d = 2) => (isFinite(x) ? x.toFixed(d).replace(".", ",") : "—");

  /* ---------- общий каркас ---------- */
  const LABS = [
    { id: "lab-pvalue", title: "Что такое p-value и мощность", desc: "Проводите «исследования» сотнями и смотрите, как часто p < 0,05 при наличии и при отсутствии эффекта." },
    { id: "lab-ci", title: "Что значит «95 % доверительный интервал»", desc: "50 повторений одного исследования: сколько интервалов накроют истинное значение?" },
    { id: "lab-diag", title: "Чувствительность, специфичность и PPV", desc: "Как распространённость болезни меняет смысл положительного результата скрининга." },
    { id: "lab-risk", title: "Калькулятор RR, OR и NNT", desc: "Введите числа из таблицы 2×2 — получите все меры эффекта с доверительными интервалами." },
    { id: "lab-corr", title: "Как выглядит корреляция", desc: "Подвигайте r и добавьте выброс: сравните коэффициенты Пирсона и Спирмена." },
  ];

  function mount(main, route) {
    const lab = LABS.find((l) => l.id === route);
    if (!lab) {
      main.innerHTML = `<div class="page"><span class="eyebrow">Симуляторы</span><h1>Посмотрите на статистику в движении</h1>
        <p class="lede">Здесь ничего не нужно программировать. Двигайте ползунки и нажимайте кнопки — понятия из уроков станут наглядными.</p>
        <div class="cards">${LABS.map((l) => `<a class="card" href="#${l.id}"><b>${esc(l.title)}</b><p>${esc(l.desc)}</p></a>`).join("")}</div></div>`;
      return;
    }
    main.innerHTML = `<div class="page"><a class="small" href="#labs">← Все симуляторы</a><span class="eyebrow">Симулятор</span><h1>${esc(lab.title)}</h1><div id="lab"></div></div>`;
    ({ "lab-pvalue": labP, "lab-ci": labCI, "lab-diag": labDiag, "lab-risk": labRisk, "lab-corr": labCorr })[lab.id]($("#lab", main));
  }
  const $ = (s, r = document) => r.querySelector(s);
  function slider(id, label, min, max, step, val, fmtv) {
    return `<div class="ctrl"><label for="${id}"><span>${label}</span><output id="${id}-o">${fmtv ? fmtv(val) : val}</output></label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></div>`;
  }
  function bindSlider(root, id, fmtv, cb) {
    const el = $("#" + id, root), o = $("#" + id + "-o", root);
    el.addEventListener("input", () => { o.textContent = fmtv ? fmtv(+el.value) : el.value; cb(+el.value); });
  }

  /* ---------- 1. p-value ---------- */
  function labP(root) {
    let d = 0, n = 30, ps = [], last = null;
    root.innerHTML = `<div class="lab">
      <p>Представьте РКИ: две группы по <b>n</b> пациентов, исход — изменение балла шкалы. Вы задаёте <b>истинный эффект</b> (d Коэна). При d = 0 препарат на самом деле не отличается от плацебо. Каждое нажатие — новое исследование на новых пациентах и t-критерий Уэлча.</p>
      <div class="controls">${slider("pv-d", "Истинный эффект d", 0, 1, 0.1, d, (v) => fmt(v, 1))}${slider("pv-n", "Пациентов в группе", 5, 200, 5, n)}</div>
      <div class="row"><button class="btn primary" type="button" id="pv-1">Провести 1 исследование</button><button class="btn" type="button" id="pv-100">Провести 100</button><button class="btn ghost" type="button" id="pv-0">Сбросить</button></div>
      <div class="readout" id="pv-read"></div>
      <div id="pv-last"></div>
      <div><b>Распределение p-значений всех проведённых исследований</b><div id="pv-hist"></div></div>
      <div class="note clin" id="pv-note"></div>
    </div>`;
    function study() {
      const a = [], b = [];
      for (let i = 0; i < n; i++) { a.push(rnorm() + d); b.push(rnorm()); }
      const r = welch(a, b); last = { a, b, ...r }; ps.push(r.p);
    }
    function draw() {
      const sig = ps.filter((p) => p < 0.05).length;
      $("#pv-read", root).innerHTML = `
        <div><b>${ps.length}</b><span>исследований проведено</span></div>
        <div><b>${ps.length ? Math.round((100 * sig) / ps.length) + " %" : "—"}</b><span>из них p &lt; 0,05</span></div>
        <div><b>${last ? fmtP(last.p) : "—"}</b><span>p в последнем исследовании</span></div>`;
      // последнее исследование: точки
      if (last) {
        const W = 640, H = 120, all = last.a.concat(last.b), lo = Math.min(...all, -3), hi = Math.max(...all, 3);
        const x = (v) => 30 + ((v - lo) / (hi - lo)) * (W - 60);
        const r2 = mulberry32(7);
        const dots = (arr, y, cls) => arr.map((v) => `<circle cx="${x(v).toFixed(1)}" cy="${(y + (r2() - 0.5) * 22).toFixed(1)}" r="3" class="${cls}"/>`).join("");
        $("#pv-last", root).innerHTML = `<svg class="plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="Значения пациентов в последнем исследовании">
          <text x="30" y="16">Препарат</text><text x="30" y="${H - 44}">Плацебо</text>
          ${dots(last.a, 38, "pt-a")}${dots(last.b, H - 26, "pt-b")}
          <line x1="${x(mean(last.a))}" x2="${x(mean(last.a))}" y1="22" y2="56" class="mean-l"/>
          <line x1="${x(mean(last.b))}" x2="${x(mean(last.b))}" y1="${H - 44}" y2="${H - 8}" class="mean-l"/>
        </svg><p class="small muted">Последнее исследование: вертикальные черты — средние групп. t = ${fmt(last.t)}, df = ${fmt(last.df, 1)}, p = ${fmtP(last.p)}.</p>`;
      } else $("#pv-last", root).innerHTML = "";
      // гистограмма p
      const bins = new Array(20).fill(0); ps.forEach((p) => bins[Math.min(19, Math.floor(p / 0.05))]++);
      const W = 640, H = 190, maxB = Math.max(5, ...bins), bw = (W - 50) / 20;
      let bars = bins.map((c, i) => { const h = (c / maxB) * (H - 50); return `<rect x="${(40 + i * bw + 1).toFixed(1)}" y="${(H - 30 - h).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${h.toFixed(1)}" class="${i === 0 ? "bar-hi" : "bar"}"><title>${c}</title></rect>`; }).join("");
      const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => `<text x="${40 + t * (W - 50)}" y="${H - 12}" text-anchor="middle">${String(t).replace(".", ",")}</text>`).join("");
      $("#pv-hist", root).innerHTML = `<svg class="plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="Гистограмма p-значений">
        <line x1="40" x2="${W - 10}" y1="${H - 30}" y2="${H - 30}" class="axis"/>${bars}${ticks}
        <text x="40" y="14">Красный столбик — p &lt; 0,05 («значимые»). Высота: ${maxB} максимум.</text></svg>`;
      $("#pv-note", root).innerHTML = d === 0
        ? `<span class="note-h">Эффекта нет</span><p>При d = 0 p-значения распределены равномерно от 0 до 1. Около 5 % исследований всё равно дают p &lt; 0,05 — это ложноположительные результаты (ошибка I рода). Проведите 100–300 исследований и проверьте.</p>`
        : `<span class="note-h">Эффект есть</span><p>При d = ${fmt(d, 1)} доля исследований с p &lt; 0,05 — это <b>мощность</b>. Уменьшите n и посмотрите, как часто маленькое исследование «не находит» реальный эффект. Для d = 0,5 мощность 80 % достигается примерно при 64 пациентах в группе.</p>`;
    }
    $("#pv-1", root).onclick = () => { study(); draw(); };
    $("#pv-100", root).onclick = () => { for (let i = 0; i < 100; i++) study(); draw(); };
    $("#pv-0", root).onclick = () => { ps = []; last = null; draw(); };
    bindSlider(root, "pv-d", (v) => fmt(v, 1), (v) => { d = v; ps = []; last = null; draw(); });
    bindSlider(root, "pv-n", null, (v) => { n = v; ps = []; last = null; draw(); });
    for (let i = 0; i < 100; i++) study();
    draw();
  }

  /* ---------- 2. доверительные интервалы ---------- */
  function labCI(root) {
    const MU = 20, SD = 6; let n = 20, level = 0.95, cis = [];
    root.innerHTML = `<div class="lab">
      <p>Истинный средний балл HAM-D в популяции — <b>${MU}</b> (SD ${SD}). В реальности мы его не знаем. Каждая линия — одно исследование из <b>n</b> пациентов и его доверительный интервал для среднего. Красные интервалы не накрыли истинное значение.</p>
      <div class="controls">${slider("ci-n", "Пациентов в исследовании", 5, 200, 5, n)}
        <div class="ctrl"><label for="ci-l"><span>Уровень доверия</span></label><select class="inp" id="ci-l"><option value="0.9">90 %</option><option value="0.95" selected>95 %</option><option value="0.99">99 %</option></select></div></div>
      <div class="row"><button class="btn primary" type="button" id="ci-go">Новые 50 исследований</button></div>
      <div class="readout" id="ci-read"></div><div id="ci-plot"></div>
      <div class="note clin"><span class="note-h">Что заметить</span><p>Примерно 95 % интервалов накрывают истинное значение, но про <i>конкретный</i> интервал мы не знаем, накрыл ли он его. Чем больше n, тем уже интервалы. 99 % интервалы шире 95 %: за большую уверенность платим точностью.</p></div>
    </div>`;
    function gen() {
      cis = []; const tc = qt(1 - (1 - level) / 2, n - 1);
      for (let k = 0; k < 50; k++) { const s = []; for (let i = 0; i < n; i++) s.push(MU + SD * rnorm()); const m = mean(s), se = Math.sqrt(variance(s) / n); cis.push([m - tc * se, m, m + tc * se]); }
      draw();
    }
    function draw() {
      const W = 640, H = 50 * 9 + 40, lo = MU - 12, hi = MU + 12, x = (v) => 30 + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (W - 60);
      const miss = cis.filter((c) => c[0] > MU || c[2] < MU).length;
      $("#ci-read", root).innerHTML = `<div><b>${50 - miss} из 50</b><span>накрыли истинное значение</span></div><div><b>${fmt(mean(cis.map((c) => c[2] - c[0])), 1)}</b><span>средняя ширина интервала, баллов</span></div>`;
      const lines = cis.map((c, i) => { const y = 20 + i * 9, cls = c[0] > MU || c[2] < MU ? "ci-miss" : "ci-ok"; return `<line x1="${x(c[0])}" x2="${x(c[2])}" y1="${y}" y2="${y}" class="${cls}"/><circle cx="${x(c[1])}" cy="${y}" r="2" class="${cls}-d"/>`; }).join("");
      const ticks = [8, 14, 20, 26, 32].map((t) => `<text x="${x(t)}" y="${H - 4}" text-anchor="middle">${t}</text>`).join("");
      $("#ci-plot", root).innerHTML = `<svg class="plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="50 доверительных интервалов"><line x1="${x(MU)}" x2="${x(MU)}" y1="10" y2="${H - 18}" class="truth"/>${lines}${ticks}</svg>`;
    }
    bindSlider(root, "ci-n", null, (v) => { n = v; gen(); });
    $("#ci-l", root).onchange = (e) => { level = +e.target.value; gen(); };
    $("#ci-go", root).onclick = gen;
    gen();
  }

  /* ---------- 3. диагностика ---------- */
  function labDiag(root) {
    let se = 0.88, sp = 0.85, prev = 0.1;
    const pct = (v) => Math.round(v * 100) + " %";
    root.innerHTML = `<div class="lab">
      <p>1000 человек проходят скрининговую шкалу. Задайте свойства теста и распространённость расстройства в той популяции, где тест применяется.</p>
      <div class="controls">${slider("dg-se", "Чувствительность", 0.5, 0.99, 0.01, se, pct)}${slider("dg-sp", "Специфичность", 0.5, 0.99, 0.01, sp, pct)}${slider("dg-pr", "Распространённость", 0.01, 0.6, 0.01, prev, pct)}</div>
      <div class="readout" id="dg-read"></div>
      <div id="dg-grid"></div>
      <div class="row small"><span class="chip"><svg width="10" height="10"><rect width="10" height="10" class="tp"/></svg>истинно +</span><span class="chip"><svg width="10" height="10"><rect width="10" height="10" class="fp"/></svg>ложно +</span><span class="chip"><svg width="10" height="10"><rect width="10" height="10" class="fn"/></svg>ложно −</span><span class="chip"><svg width="10" height="10"><rect width="10" height="10" class="tn"/></svg>истинно −</span></div>
      <div class="note clin"><span class="note-h">Попробуйте</span><p>Поставьте распространённость 2 % (общая популяция), а потом 40 % (специализированная клиника). Чувствительность и специфичность не меняются, а PPV меняется в разы.</p></div>
    </div>`;
    function draw() {
      const N = 1000, D = Math.round(N * prev), TP = Math.round(D * se), FN = D - TP, H = N - D, TN = Math.round(H * sp), FP = H - TN;
      const ppv = TP / (TP + FP), npv = TN / (TN + FN);
      $("#dg-read", root).innerHTML = `<div><b>${TP} / ${FP}</b><span>истинно / ложно положительных</span></div><div><b>${isFinite(ppv) ? pct(ppv) : "—"}</b><span>PPV: болен, если тест +</span></div><div><b>${isFinite(npv) ? pct(npv) : "—"}</b><span>NPV: здоров, если тест −</span></div><div><b>${FN}</b><span>пропущенных больных</span></div>`;
      const cells = [].concat(Array(TP).fill("tp"), Array(FN).fill("fn"), Array(FP).fill("fp"), Array(TN).fill("tn"));
      const cols = 50, s = 12.4;
      $("#dg-grid", root).innerHTML = `<svg class="plot" viewBox="0 0 ${cols * s} ${20 * s}" role="img" aria-label="1000 человек по результату теста">${cells.map((c, i) => `<rect x="${(i % cols) * s}" y="${Math.floor(i / cols) * s}" width="${s - 2}" height="${s - 2}" rx="2" class="${c}"/>`).join("")}</svg>`;
    }
    bindSlider(root, "dg-se", pct, (v) => { se = v; draw(); });
    bindSlider(root, "dg-sp", pct, (v) => { sp = v; draw(); });
    bindSlider(root, "dg-pr", pct, (v) => { prev = v; draw(); });
    draw();
  }

  /* ---------- 4. RR / OR / NNT ---------- */
  function labRisk(root) {
    root.innerHTML = `<div class="lab">
      <p>Введите число пациентов с исходом и общее число пациентов в каждой группе. Пример заполнен данными об ответе на терапию из модуля 7.</p>
      <div class="grid2x2">
        <span></span><span class="h">С исходом</span><span class="h">Всего в группе</span>
        <label for="rk-a">Лечение</label><input class="inp" id="rk-a" type="number" min="0" value="18"><input class="inp" id="rk-n1" type="number" min="1" value="40">
        <label for="rk-c">Контроль</label><input class="inp" id="rk-c" type="number" min="0" value="12"><input class="inp" id="rk-n2" type="number" min="1" value="40">
      </div>
      <div class="readout" id="rk-read"></div>
      <p class="small muted" id="rk-note"></p>
      <div class="note warn"><span class="note-h">Важно</span><p>Интервалы рассчитаны приближёнными формулами (лог-метод для RR, метод Вулфа для OR, Вальда для разности рисков). Для статьи пусть расчёт сделает R: <code>epitools</code>, <code>epiR</code> или логистическая регрессия.</p></div>
    </div>`;
    function calc() {
      const a = +$("#rk-a", root).value, n1 = +$("#rk-n1", root).value, c = +$("#rk-c", root).value, n2 = +$("#rk-n2", root).value;
      const out = $("#rk-read", root), note = $("#rk-note", root);
      if (!(n1 > 0 && n2 > 0) || a < 0 || c < 0 || a > n1 || c > n2) { out.innerHTML = ""; note.textContent = "Проверьте числа: число пациентов с исходом не может быть больше числа пациентов в группе."; return; }
      const b = n1 - a, d = n2 - c, p1 = a / n1, p2 = c / n2, z = 1.959964;
      const rr = p1 / p2, seRR = Math.sqrt(1 / a - 1 / n1 + 1 / c - 1 / n2);
      const or = (a * d) / (b * c), seOR = Math.sqrt(1 / a + 1 / b + 1 / c + 1 / d);
      const rd = p1 - p2, seRD = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2);
      const ci = (est, se) => (isFinite(est) && isFinite(se) && est > 0 ? `${fmt(est * Math.exp(-z * se))}–${fmt(est * Math.exp(z * se))}` : "не определён");
      const nnt = rd === 0 ? Infinity : 1 / Math.abs(rd);
      out.innerHTML = `
        <div><b>${fmt(p1 * 100, 1)} % / ${fmt(p2 * 100, 1)} %</b><span>риск в группах</span></div>
        <div><b>${fmt(rr)}</b><span>RR, 95 % ДИ ${ci(rr, seRR)}</span></div>
        <div><b>${fmt(or)}</b><span>OR, 95 % ДИ ${ci(or, seOR)}</span></div>
        <div><b>${fmt(rd * 100, 1)} п. п.</b><span>разность рисков, 95 % ДИ ${fmt((rd - z * seRD) * 100, 1)}…${fmt((rd + z * seRD) * 100, 1)}</span></div>
        <div><b>${isFinite(nnt) ? Math.ceil(nnt) : "—"}</b><span>${rd >= 0 ? "NNT (лечить, чтобы получить +1 исход)" : "NNH / NNT для снижения риска"}</span></div>`;
      note.textContent = a === 0 || b === 0 || c === 0 || d === 0
        ? "В таблице есть нулевая ячейка: OR и его интервал не определены. Сообщайте доли и разность рисков, а для проверки гипотезы используйте точный критерий Фишера."
        : (rd - z * seRD) * (rd + z * seRD) < 0 ? "ДИ разности рисков включает 0: различие незначимо, и NNT определён неточно (его интервал включал бы бесконечность)." : "";
    }
    ["rk-a", "rk-n1", "rk-c", "rk-n2"].forEach((id) => $("#" + id, root).addEventListener("input", calc));
    calc();
  }

  /* ---------- 5. корреляция ---------- */
  function labCorr(root) {
    let r = 0.5, outlier = false;
    const R0 = mulberry32(42), N = 60, z1 = [], z2 = [];
    const nrm = () => { let u = 0, v = 0; while (u === 0) u = R0(); while (v === 0) v = R0(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    for (let i = 0; i < N; i++) { z1.push(nrm()); z2.push(nrm()); }
    root.innerHTML = `<div class="lab">
      <p>60 пациентов, две переменные. Задайте силу связи и посмотрите, как выглядит облако точек.</p>
      <div class="controls">${slider("cr-r", "Заданная связь r", -1, 1, 0.05, r, (v) => fmt(v))}
        <div class="ctrl"><label for="cr-o"><span>Один выброс (ошибка ввода)</span></label><label><input type="checkbox" id="cr-o"> добавить точку далеко от облака</label></div></div>
      <div class="readout" id="cr-read"></div><div id="cr-plot"></div>
      <div class="note clin"><span class="note-h">Что заметить</span><p>При r = 0,3 облако выглядит почти бесформенным, хотя на 60 пациентах связь уже статистически значима. Один выброс может сильно сдвинуть r Пирсона, а r Спирмена (по рангам) меняется гораздо меньше.</p></div>
    </div>`;
    function draw() {
      const x = z1.slice(), y = z1.map((v, i) => r * v + Math.sqrt(Math.max(0, 1 - r * r)) * z2[i]);
      if (outlier) { x.push(4.2); y.push(r >= 0 ? -4.2 : 4.2); }
      const W = 420, H = 300, sx = (v) => 30 + ((v + 4.6) / 9.2) * (W - 40), sy = (v) => H - 20 - ((v + 4.6) / 9.2) * (H - 30);
      $("#cr-read", root).innerHTML = `<div><b>${fmt(pearson(x, y))}</b><span>r Пирсона</span></div><div><b>${fmt(spearman(x, y))}</b><span>ρ Спирмена</span></div><div><b>${fmt(pearson(x, y) ** 2 * 100, 0)} %</b><span>r² — доля общей изменчивости</span></div>`;
      $("#cr-plot", root).innerHTML = `<svg class="plot" viewBox="0 0 ${W} ${H}" style="max-width:520px" role="img" aria-label="Диаграмма рассеяния">
        <line x1="30" x2="${W - 10}" y1="${H - 20}" y2="${H - 20}" class="axis"/><line x1="30" x2="30" y1="10" y2="${H - 20}" class="axis"/>
        ${x.map((v, i) => `<circle cx="${sx(v).toFixed(1)}" cy="${sy(y[i]).toFixed(1)}" r="${outlier && i === x.length - 1 ? 6 : 3.5}" class="${outlier && i === x.length - 1 ? "pt-out" : "pt-a"}"/>`).join("")}
        <text x="${W - 10}" y="${H - 4}" text-anchor="end">переменная X</text><text x="34" y="20">переменная Y</text></svg>`;
    }
    bindSlider(root, "cr-r", (v) => fmt(v), (v) => { r = v; draw(); });
    $("#cr-o", root).onchange = (e) => { outlier = e.target.checked; draw(); };
    draw();
  }

  window.LABS = { mount };
})();
