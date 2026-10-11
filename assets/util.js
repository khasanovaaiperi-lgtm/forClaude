/* Общие помощники: экранирование HTML, подсветка R и сборка блоков кода и вывода консоли. */
(function () {
  "use strict";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function hlR(src) {
    return src.split("\n").map((line) => {
      let out = "", i = 0, inStr = null, buf = "";
      const flush = () => {
        out += esc(buf).replace(/\b([A-Za-z_.][A-Za-z0-9_.]*)(?=\()/g, '<span class="fn">$1</span>');
        buf = "";
      };
      while (i < line.length) {
        const ch = line[i];
        if (!inStr && ch === "#") { flush(); out += '<span class="cm">' + esc(line.slice(i)) + "</span>"; break; }
        if (!inStr && (ch === '"' || ch === "'")) { flush(); inStr = ch; buf = ch; i++; continue; }
        if (inStr) { buf += ch; if (ch === inStr) { out += '<span class="st">' + esc(buf) + "</span>"; buf = ""; inStr = null; } i++; continue; }
        buf += ch; i++;
      }
      if (inStr) out += '<span class="st">' + esc(buf) + "</span>"; else flush();
      return out;
    }).join("\n");
  }

  let uid = 0;
  /* Блок кода R с кнопкой «Скопировать». */
  function R(code, label) {
    const id = "code" + ++uid;
    code = code.replace(/^\n+|\s+$/g, "");
    return `<div class="codeblock"><div class="code-head"><span class="tag">${esc(label || "R — этот код напишет Claude")}</span><button class="btn small ghost" type="button" data-copy="${id}">Скопировать</button></div><pre id="${id}" data-raw="${esc(code)}">${hlR(code)}</pre></div>`;
  }
  /* Вывод консоли R с пометками ⟦n|текст⟧ и пояснениями к ним. */
  function OUT(text, notes, label) {
    text = text.replace(/^\n+|\s+$/g, "");
    const html = esc(text).replace(/⟦(\d+)\|([\s\S]*?)⟧/g, '<mark class="ann" data-n="$1">$2</mark>');
    const list = notes && notes.length
      ? `<ol class="anns">${notes.map((n, i) => `<li data-n="${i + 1}"><button type="button" class="n" data-n="${i + 1}" aria-label="Показать пометку ${i + 1}">${i + 1}</button><div>${n}</div></li>`).join("")}</ol>`
      : "";
    return `<div class="annot"><div class="console"><div class="code-head"><span class="tag">${esc(label || "Консоль R — что вы увидите")}</span></div><pre>${html}</pre></div>${list}</div>`;
  }
  const NOTE = (kind, head, html) => `<div class="note ${kind}"><span class="note-h">${esc(head)}</span>${html}</div>`;
  const IMG = (src, alt, cap) => `<figure class="fig"><img src="${src}" alt="${esc(alt)}" loading="lazy">${cap ? `<figcaption>${cap}</figcaption>` : ""}</figure>`;

  window.UTIL = { esc, hlR, R, OUT, NOTE, IMG };
})();
