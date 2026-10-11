/* Помощник выбора метода: дерево вопросов -> рекомендация, код R и запрос для Claude. */
(function () {
  "use strict";
  const { esc, R } = window.UTIL;

  /* Узлы: { q, opts: [{ label, hint, next | res }] }. Результаты: { title, why, alt, code, mod }. */
  const N = {
    start: { q: "Что вы хотите узнать?", opts: [
      { label: "Различаются ли группы", hint: "препарат и плацебо, больные и здоровые, до и после", next: "cmpOutcome" },
      { label: "Связаны ли два показателя", hint: "например, PHQ-9 и уровень кортизола", next: "assoc" },
      { label: "Влияние фактора с поправкой на другие", hint: "конфаундеры, несколько предикторов одновременно", next: "model" },
      { label: "Время до события", hint: "рецидив, госпитализация, отмена препарата", res: "tte" },
      { label: "Точность диагностической шкалы или теста", hint: "чувствительность, специфичность, порог", res: "roc" },
      { label: "Надёжность шкалы или согласие экспертов", hint: "α Кронбаха, ICC, каппа", next: "rel" },
      { label: "Сколько пациентов нужно", hint: "расчёт размера выборки до исследования", res: "ss" },
    ]},
    cmpOutcome: { q: "Какой у вас исход?", opts: [
      { label: "Количественный, распределение примерно симметричное", hint: "балл шкалы с широким диапазоном, давление, ИМТ", next: "cmpQ" },
      { label: "Порядковый, сильно асимметричный или с выбросами", hint: "CGI, длительность госпитализации, CRP", next: "cmpO" },
      { label: "Бинарный или категориальный", hint: "ответ да/нет, ремиссия, диагноз", next: "cmpB" },
      { label: "Время до события", hint: "с цензурированием", res: "tte" },
    ]},
    cmpQ: { q: "Как устроены группы?", opts: [
      { label: "Две независимые группы", res: "welch" },
      { label: "Одни и те же пациенты: до и после", res: "pairedt" },
      { label: "Три и более независимых групп", res: "anova" },
      { label: "Много визитов у каждого пациента", res: "mixed" },
    ]},
    cmpO: { q: "Как устроены группы?", opts: [
      { label: "Две независимые группы", res: "mw" },
      { label: "Одни и те же пациенты: до и после", res: "wsr" },
      { label: "Три и более независимых групп", res: "kw" },
      { label: "Много визитов у каждого пациента", res: "friedman" },
    ]},
    cmpB: { q: "Как устроены группы?", opts: [
      { label: "Независимые группы (две или больше)", next: "cmpBsize" },
      { label: "Одни и те же пациенты: до и после", res: "mcnemar" },
      { label: "Много визитов у каждого пациента", res: "glmm" },
    ]},
    cmpBsize: { q: "Много ли событий в каждой группе?", opts: [
      { label: "Да, ожидаемые частоты 5 и больше во всех ячейках", res: "chisq" },
      { label: "Нет, событий мало (редкие нежелательные явления)", res: "fisher" },
      { label: "Не знаю", hint: "R покажет ожидаемые частоты", res: "chisq" },
    ]},
    assoc: { q: "Какие это переменные?", opts: [
      { label: "Обе количественные, без сильной асимметрии и выбросов", res: "pearson" },
      { label: "Хотя бы одна порядковая или асимметричная", res: "spearman" },
      { label: "Обе категориальные", res: "chisq" },
      { label: "Два метода измерения одного и того же", hint: "можно ли заменить один другим", res: "ba" },
    ]},
    model: { q: "Какой исход?", opts: [
      { label: "Количественный", res: "lm" },
      { label: "Бинарный (да/нет)", res: "logit" },
      { label: "Число событий (госпитализаций, приступов)", res: "count" },
      { label: "Порядковый (CGI-I: 1–7)", res: "ordinal" },
      { label: "Время до события", res: "tte" },
    ]},
    rel: { q: "Что именно проверяете?", opts: [
      { label: "Согласованность пунктов одной шкалы", res: "alpha" },
      { label: "Согласие экспертов: баллы", res: "icc" },
      { label: "Согласие экспертов: категории (диагноз)", res: "kappa" },
      { label: "Повторное заполнение через время (ретест)", res: "icc" },
    ]},
  };

  const RES = {
    welch: { title: "t-критерий Уэлча", mod: "twogroups", why: "Две независимые группы, количественный исход без сильной асимметрии.", alt: "При сильной асимметрии или малых группах — критерий Манна — Уитни. С поправкой на ковариаты — линейная регрессия.", code: `t.test(outcome ~ group, data = df)` },
    pairedt: { title: "Парный t-критерий", mod: "twogroups", why: "Одни и те же пациенты в двух точках, разности распределены примерно нормально.", alt: "Чтобы доказать эффект лечения, нужна контрольная группа: изменение внутри одной группы включает плацебо-эффект и регрессию к среднему.", code: `t.test(df$after, df$before, paired = TRUE)` },
    anova: { title: "Однофакторный ANOVA + тест Тьюки", mod: "anova", why: "Три и более независимых группы, количественный исход.", alt: "При асимметрии — Краскел — Уоллис и тест Данна. С ковариатами — линейная регрессия (ANCOVA).", code: `fit <- aov(outcome ~ group, data = df)\nsummary(fit)\nTukeyHSD(fit)` },
    mixed: { title: "Смешанная модель для повторных измерений", mod: "repeated", why: "Несколько визитов у каждого пациента. Модель учитывает зависимость измерений и использует пациентов с пропусками.", alt: "В регистрационных РКИ часто используют MMRM (пакет mmrm), где время — категориальная переменная.", code: `library(lmerTest)\nmm <- lmer(outcome ~ week * group + (1 | id), data = long)\nsummary(mm)\nanova(mm)` },
    mw: { title: "Критерий Манна — Уитни", mod: "twogroups", why: "Две независимые группы, порядковый или асимметричный исход.", alt: "Описывайте группы медианой [Q1; Q3]. Для оценки величины различия — оценка Ходжеса — Лемана: wilcox.test(..., conf.int = TRUE).", code: `wilcox.test(outcome ~ group, data = df)` },
    wsr: { title: "Критерий Уилкоксона для парных выборок", mod: "twogroups", why: "Одни и те же пациенты в двух точках, разности распределены ненормально.", alt: "Нужна контрольная группа, чтобы говорить об эффекте лечения.", code: `wilcox.test(df$after, df$before, paired = TRUE)` },
    kw: { title: "Критерий Краскела — Уоллиса + тест Данна", mod: "anova", why: "Три и более независимых групп, порядковый или асимметричный исход.", alt: "Попарные сравнения — тест Данна с поправкой Холма.", code: `kruskal.test(outcome ~ group, data = df)\nFSA::dunnTest(outcome ~ group, data = df, method = "holm")` },
    friedman: { title: "Критерий Фридмана или смешанная модель", mod: "repeated", why: "Повторные измерения порядкового исхода. Критерий Фридмана требует полных данных по всем визитам.", alt: "При пропусках и для сравнения групп во времени — смешанные модели (для порядкового исхода — ordinal::clmm).", code: `friedman.test(outcome ~ visit | id, data = long)` },
    mcnemar: { title: "Критерий Мак-Немара", mod: "categorical", why: "Бинарный исход у одних и тех же пациентов в двух точках.", alt: "Для нескольких визитов — смешанная логистическая модель или GEE.", code: `mcnemar.test(table(df$before, df$after))` },
    glmm: { title: "Смешанная логистическая модель или GEE", mod: "repeated", why: "Бинарный исход на нескольких визитах у каждого пациента.", alt: "Это продвинутый анализ: опишите Claude дизайн и цель подробно.", code: `library(lme4)\ng <- glmer(outcome ~ week * group + (1 | id), data = long, family = binomial)\nsummary(g)` },
    chisq: { title: "Критерий χ² Пирсона", mod: "categorical", why: "Независимые группы, категориальный исход, достаточные ожидаемые частоты.", alt: "Проверьте ожидаемые частоты. Если они малы, используйте точный критерий Фишера. Приведите n (%), RR и разность рисков.", code: `tab <- table(df$group, df$outcome)\nchisq.test(tab)\nchisq.test(tab)$expected` },
    fisher: { title: "Точный критерий Фишера", mod: "categorical", why: "Малые ожидаемые частоты, например редкие нежелательные явления.", alt: "Сообщайте доли в группах и разность рисков. При нулевой ячейке OR не определён.", code: `fisher.test(table(df$group, df$outcome))` },
    pearson: { title: "Корреляция Пирсона", mod: "correlation", why: "Две количественные переменные, линейная связь, без сильных выбросов.", alt: "Сначала диаграмма рассеяния. При выбросах или асимметрии — Спирмен.", code: `cor.test(df$x, df$y)` },
    spearman: { title: "Корреляция Спирмена", mod: "correlation", why: "Порядковые или асимметричные данные, монотонная связь.", alt: "Для поправки на другие факторы — регрессия.", code: `cor.test(df$x, df$y, method = "spearman", exact = FALSE)` },
    ba: { title: "Анализ Бленда — Альтмана", mod: "correlation", why: "Согласие двух методов измерения. Корреляция для этого не подходит.", alt: "Для надёжности одного метода между экспертами — ICC.", code: `d <- df$method1 - df$method2\nm <- (df$method1 + df$method2) / 2\nmean(d); mean(d) + c(-1.96, 1.96) * sd(d)   # смещение и пределы согласия\nplot(m, d); abline(h = mean(d) + c(-1.96, 0, 1.96) * sd(d), lty = c(2, 1, 2))` },
    lm: { title: "Множественная линейная регрессия", mod: "regression", why: "Количественный исход и несколько факторов.", alt: "Проверьте остатки: plot(model). Ковариаты выбирайте заранее, а не по p-значениям.", code: `m <- lm(outcome ~ exposure + age + sex, data = df)\nsummary(m)\nconfint(m)` },
    logit: { title: "Логистическая регрессия", mod: "regression", why: "Бинарный исход и несколько факторов. Результат — скорректированные отношения шансов.", alt: "Ориентир — около 10 событий более редкого исхода на один параметр модели.", code: `g <- glm(outcome ~ exposure + age + sex, data = df, family = binomial)\nexp(cbind(OR = coef(g), confint(g)))` },
    count: { title: "Пуассоновская или отрицательная биномиальная регрессия", mod: "regression", why: "Исход — число событий. Результат — отношение частот (IRR).", alt: "Если разное время наблюдения, добавьте offset(log(time)). При избыточном разбросе — отрицательная биномиальная модель.", code: `library(MASS)\nnb <- glm.nb(n_hosp ~ treatment + age + offset(log(years)), data = df)\nexp(cbind(IRR = coef(nb), confint(nb)))` },
    ordinal: { title: "Порядковая логистическая регрессия", mod: "regression", why: "Исход — упорядоченные категории.", alt: "Модель предполагает пропорциональность шансов, это нужно проверить.", code: `library(ordinal)\nm <- clm(factor(cgi_i, ordered = TRUE) ~ group + age, data = df)\nsummary(m)` },
    tte: { title: "Каплан — Мейер, лог-ранговый тест и регрессия Кокса", mod: "survival", why: "Время до события с цензурированием.", alt: "Проверьте пропорциональность рисков: cox.zph(). При её нарушении обсудите с Claude альтернативы (RMST, взаимодействие со временем).", code: `library(survival)\nkm <- survfit(Surv(time, event) ~ group, data = df); km\nsurvdiff(Surv(time, event) ~ group, data = df)\ncx <- coxph(Surv(time, event) ~ group + age, data = df)\nsummary(cx); cox.zph(cx)` },
    roc: { title: "ROC-анализ, чувствительность и специфичность", mod: "diagnostic", why: "Оценка точности шкалы относительно референсного стандарта.", alt: "Не подбирайте порог и не оценивайте его точность на одних данных. Отчитывайтесь по STARD.", code: `library(pROC)\nr <- roc(df$diagnosis, df$score)\nauc(r); ci.auc(r)\ncoords(r, "best", ret = c("threshold", "sensitivity", "specificity"))` },
    alpha: { title: "α Кронбаха (и ω МакДональда)", mod: "reliability", why: "Внутренняя согласованность пунктов шкалы.", alt: "Одномерность проверяют факторным анализом.", code: `library(psych)\nalpha(df[, c("item1", "item2", "item3")])\nomega(df[, c("item1", "item2", "item3")])` },
    icc: { title: "Коэффициент внутриклассовой корреляции (ICC)", mod: "reliability", why: "Согласие количественных оценок (эксперты или повторные измерения).", alt: "Укажите форму ICC: модель, тип (абсолютное согласие или согласованность), единицу.", code: `library(psych)\nICC(df[, c("rater1", "rater2")])` },
    kappa: { title: "Каппа Коэна", mod: "reliability", why: "Согласие двух экспертов по категориям.", alt: "Для порядковых категорий — взвешенная каппа, для трёх и более экспертов — каппа Флейсса (irr::kappam.fleiss).", code: `library(psych)\ncohen.kappa(table(df$rater1, df$rater2))` },
    ss: { title: "Расчёт размера выборки", mod: "samplesize", why: "Считается до начала исследования по ожидаемому клинически значимому эффекту.", alt: "Учтите выбывание: n / (1 − доля выбывших).", code: `power.t.test(delta = 3, sd = 6, power = 0.80)        # количественный исход\npower.prop.test(p1 = 0.30, p2 = 0.50, power = 0.80)  # доли` },
  };

  let path = [];
  function render(main) {
    const cur = path.length ? path[path.length - 1] : { node: "start" };
    const trail = path.map((p, i) => `<button type="button" data-back="${i}">${esc(p.label)}</button>`).join(" → ");
    let body;
    if (cur.res) {
      const r = RES[cur.res];
      const ask = `Мне нужно: ${path.map((p) => p.label.toLowerCase()).join(" → ")}.\nПо подсказке сайта подходит метод «${r.title}».\nМои данные: [опишите переменные или вставьте вывод str(data)].\nПроверь, подходит ли этот метод, проверь его допущения, напиши код на R с комментариями и объясни результат.`;
      body = `<div class="verdict"><span class="eyebrow">Рекомендуемый метод</span><h2>${esc(r.title)}</h2>
        <p>${esc(r.why)}</p>
        <p class="muted">${esc(r.alt)}</p>
        ${R(r.code, "R — шаблон; Claude подставит ваши переменные")}
        <div class="row"><a class="btn" href="#${r.mod}">Открыть урок по методу</a><button class="btn ghost" type="button" id="wzRestart">Начать заново</button></div></div>
        ${window.APP.askBlock(ask, "wz-ask")}
        <p class="small muted">Помощник даёт типичный выбор для типичной ситуации. Реальные данные часто сложнее: кластеры, пропуски, необычный дизайн. Опишите их Claude полностью.</p>`;
    } else {
      const n = N[cur.node];
      body = `<p class="wiz-q">${esc(n.q)}</p><div class="wiz-opts">${n.opts.map((o, i) => `<button type="button" class="wiz-opt" data-i="${i}"><b>${esc(o.label)}</b>${o.hint ? `<span>${esc(o.hint)}</span>` : ""}</button>`).join("")}</div>`;
    }
    main.innerHTML = `<div class="page"><span class="eyebrow">Помощник</span><h1>Какой метод выбрать?</h1>
      <p class="lede">Ответьте на несколько вопросов о данных. В конце вы получите название метода, шаблон кода и готовый запрос для Claude.</p>
      ${path.length ? `<div class="wiz-trail"><button type="button" data-back="-1">Начало</button> → ${trail}</div>` : ""}
      ${body}</div>`;
    main.querySelectorAll(".wiz-opt").forEach((b) => b.onclick = () => {
      const o = N[cur.node].opts[+b.dataset.i];
      path.push(o.res ? { label: o.label, res: o.res } : { label: o.label, node: o.next });
      render(main); window.scrollTo(0, 0);
    });
    main.querySelectorAll("[data-back]").forEach((b) => b.onclick = () => { path = path.slice(0, +b.dataset.back + 1); render(main); });
    const rs = main.querySelector("#wzRestart"); if (rs) rs.onclick = () => { path = []; render(main); };
  }
  window.WIZARD = { mount: (main) => { path = []; render(main); } };
})();
