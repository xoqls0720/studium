// 굿노트 필기용 PDF 만들기 — 화면의 글(HTML)을 A4 쪽 그림으로 그려 PDF 로 묶고, 공유 창(굿노트)으로 보낸다.
// 쓰는 곳: Studium · 생각과 글 · 토익 · 법무사. 서버 없이 기기 안에서만 만든다.
//   NotePDF.send(btn, () => html문자열 또는 요소, '파일이름.pdf', {margin:true})
// 꾸밈: <h1> <h2> <h3> <p> <ul>/<ol> <table> <blockquote> <pre> <img> <hr>
//       <div class="q"> 문제 상자(아래에 답 쓰는 빈칸) · <div class="page"> 새 쪽 · <div class="ans"> 회색 정답
(function () {
  "use strict";
  const PW = 1240, PH = 1754, M = 90;
  const FONT = '"Gowun Batang","MaruBuri","Nanum Myeongjo","AppleMyungjo","Apple SD Gothic Neo",serif';
  async function make(src, opt) {
    opt = opt || {};
    try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) {}
    const root = typeof src === "string" ? Object.assign(document.createElement("div"), { innerHTML: src }) : src;
    const NOTE = opt.margin === false ? 0 : 300;              // 오른쪽 필기 여백
    const CW = PW - M * 2 - NOTE, pages = [];
    let cx, y;
    function newPage() {
      const cv = document.createElement("canvas"); cv.width = PW; cv.height = PH; cx = cv.getContext("2d");
      cx.fillStyle = "#fff"; cx.fillRect(0, 0, PW, PH); cx.textBaseline = "top"; pages.push(cv); y = M;
      if (NOTE) { cx.strokeStyle = "#e3e3e3"; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(PW - M - NOTE + 30, M); cx.lineTo(PW - M - NOTE + 30, PH - M); cx.stroke();
        cx.fillStyle = "#b5b5b5"; cx.font = "18px " + FONT; cx.fillText("필기", PW - M - NOTE + 46, M - 4); }
      cx.fillStyle = "#999"; cx.font = "18px " + FONT; cx.fillText(String(pages.length), PW / 2, PH - M / 2 - 10);
      if (opt.title && pages.length > 1) cx.fillText(String(opt.title).slice(0, 40), M, M / 2 - 10);
      cx.fillStyle = "#000"; cx.strokeStyle = "#000";
    }
    const font = (sz, b) => { cx.font = (b ? "700 " : "") + sz + "px " + FONT; };
    function wrap(t, w) {
      const out = [];
      String(t).split("\n").forEach(par => {
        let line = "";
        (par.match(/\S+\s*/g) || [""]).forEach(tok => {
          if (cx.measureText(line + tok).width <= w) { line += tok; return; }
          if (line.trim()) { out.push(line.trimEnd()); line = ""; }
          if (cx.measureText(tok).width <= w) { line = tok; return; }
          let cur = ""; for (const ch of tok) { if (cx.measureText(cur + ch).width > w && cur) { out.push(cur); cur = ch; } else cur += ch; } line = cur;
        });
        out.push(line.trimEnd());
      });
      return out;
    }
    const ensure = h => { if (y + h > PH - M) newPage(); };
    function text(t, sz, b, ind, color) {
      ind = ind || 0; font(sz, b); const lh = Math.round(sz * 1.6);
      wrap(t, CW - ind).forEach(l => { ensure(lh); if (color) cx.fillStyle = color; cx.fillText(l, M + ind, y); cx.fillStyle = "#000"; y += lh; });
    }
    function tx(el) { const c = el.cloneNode(true); c.querySelectorAll("br").forEach(b => b.replaceWith("\n")); return c.textContent.replace(/ /g, " ").replace(/[ \t]+/g, " ").replace(/\n /g, "\n").trim(); }
    function table(tb) {
      const rows = Array.from(tb.querySelectorAll("tr")).map(r => Array.from(r.children).map(c => ({ t: tx(c), h: c.tagName === "TH" })));
      if (!rows.length) return; const n = Math.max(...rows.map(r => r.length)); font(22);
      const nat = Array.from({ length: n }, (_, c) => Math.max(60, ...rows.map(r => r[c] ? Math.min(CW * .6, cx.measureText(r[c].t).width + 26) : 0)));
      const sum = nat.reduce((a, b) => a + b, 0), cw = nat.map(v => v / sum * CW), lh = 33, head = rows[0].every(c => c.h) ? rows[0] : null;
      function row(r) {
        const ls = r.map((c, k) => { font(22, c.h); return wrap(c.t, cw[k] - 18); }), h = Math.max(...ls.map(l => l.length)) * lh + 14;
        if (y + h > PH - M) { newPage(); if (head && r !== head) row(head); }
        let x = M; r.forEach((c, k) => { if (c.h) { cx.fillStyle = "#eee"; cx.fillRect(x, y, cw[k], h); cx.fillStyle = "#000"; } cx.lineWidth = 1.5; cx.strokeRect(x, y, cw[k], h); font(22, c.h); ls[k].forEach((l, j) => cx.fillText(l, x + 9, y + 7 + j * lh)); x += cw[k]; });
        y += h;
      }
      rows.forEach(row); y += 14;
    }
    async function img(el) {
      const im = el.tagName === "IMG" ? el : el.querySelector("img"); if (!im) return;
      if (!im.complete) await new Promise(r => { im.onload = im.onerror = r; });
      if (!im.naturalWidth) return;
      const full = el.classList && el.classList.contains("full");
      const w = full ? PW - M * 2 : Math.min(CW, im.naturalWidth), h = im.naturalHeight * w / im.naturalWidth;
      if (full) { if (y > M) newPage(); cx.drawImage(im, M, M, w, Math.min(h, PH - M * 2)); y = PH; return; }
      ensure(Math.min(h, PH - M * 2)); cx.drawImage(im, M, y, w, Math.min(h, PH - M * 2)); y += Math.min(h, PH - M * 2) + 12;
    }
    async function walk(el) {
      for (const c of Array.from(el.children)) {
        const t = c.tagName;
        if (c.classList.contains("page")) { if (y > M) newPage(); await walk(c); continue; }
        if (t === "H1") { text(tx(c), 42, true); y += 12; }
        else if (t === "H2") { y += 16; ensure(90); text(tx(c), 31, true); cx.fillRect(M, y, CW, 3); y += 14; }
        else if (t === "H3") { y += 8; ensure(60); text(tx(c), 26, true); y += 4; }
        else if (t === "P") { text(tx(c), 24, false, 0, c.classList.contains("ans") ? "#666" : null); y += 8; }
        else if (t === "UL" || t === "OL") { Array.from(c.children).forEach((li, k) => { font(24); ensure(38); cx.fillText(t === "OL" ? (k + 1) + "." : "•", M + 4, y); text(tx(li), 24, false, 36); y += 3; }); y += 8; }
        else if (t === "TABLE") table(c);
        else if (t === "IMG" || (t === "FIGURE")) await img(c);
        else if (t === "HR") { y += 10; ensure(20); cx.fillStyle = "#bbb"; cx.fillRect(M, y, CW, 2); cx.fillStyle = "#000"; y += 14; }
        else if (t === "PRE") { text(c.textContent, 21, false, 10); y += 8; }
        else if (t === "BLOCKQUOTE") { const y0 = y; text(tx(c), 23, false, 22); cx.fillStyle = "#999"; cx.fillRect(M, y0, 4, y - y0); cx.fillStyle = "#000"; y += 10; }
        else if (t === "DIV" && c.classList.contains("q")) {
          y += 8; ensure(80); cx.fillStyle = "#999"; cx.fillRect(M, y, CW, 2); cx.fillStyle = "#000"; y += 14; await walk(c);
          const sp = +(c.dataset.space || 70); if (sp) { ensure(sp); cx.strokeStyle = "#ddd"; for (let k = 34; k <= sp; k += 34) { cx.beginPath(); cx.moveTo(M, y + k); cx.lineTo(M + CW, y + k); cx.stroke(); } cx.strokeStyle = "#000"; y += sp; }
          y += 6;
        }
        else if (t === "DIV" || t === "SECTION" || t === "ARTICLE" || t === "DETAILS") await walk(c);
        else { const s = tx(c); if (s) { text(s, 24, false); y += 6; } }
      }
    }
    newPage(); if (opt.title) { text(opt.title, 42, true); y += 18; } await walk(root);
    // PDF 로 묶기 (쪽마다 JPEG 한 장)
    const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
    const push = x => { const b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); len += b.length; };
    const n = pages.length, pw = 595.28, ph = 841.89;
    push("%PDF-1.4\n");
    const obj = (id, body) => { offs[id] = len; push(id + " 0 obj\n" + body + "\nendobj\n"); };
    obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
    obj(2, "<< /Type /Pages /Kids [" + pages.map((_, k) => (3 + 3 * k) + " 0 R").join(" ") + "] /Count " + n + " >>");
    pages.forEach((cv, k) => {
      const p = 3 + 3 * k, im = p + 1, ct = p + 2;
      const u = cv.toDataURL("image/jpeg", .86), bs = atob(u.slice(u.indexOf(",") + 1)), j = new Uint8Array(bs.length); for (let q = 0; q < bs.length; q++) j[q] = bs.charCodeAt(q);
      obj(p, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + pw + " " + ph + "] /Resources << /XObject << /Im0 " + im + " 0 R >> >> /Contents " + ct + " 0 R >>");
      offs[im] = len; push(im + " 0 obj\n<< /Type /XObject /Subtype /Image /Width " + PW + " /Height " + PH + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + j.length + " >>\nstream\n"); push(j); push("\nendstream\nendobj\n");
      const cs = "q " + pw + " 0 0 " + ph + " 0 0 cm /Im0 Do Q"; obj(ct, "<< /Length " + cs.length + " >>\nstream\n" + cs + "\nendstream");
    });
    const total = 3 + 3 * n, xref = len; let x = "xref\n0 " + total + "\n0000000000 65535 f \n";
    for (let q = 1; q < total; q++) x += String(offs[q]).padStart(10, "0") + " 00000 n \n";
    push(x); push("trailer\n<< /Size " + total + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
    return new Blob(parts, { type: "application/pdf" });
  }
  const ready = new WeakMap();
  // 버튼 하나로: PDF 만들기 → 공유 창(굿노트 고르기). 만드는 사이 터치 허락이 끊기면 버튼이 '한 번 더'로 바뀐다.
  async function send(btn, build, filename, opt) {
    filename = String(filename || "노트.pdf").replace(/[\\/:*?"<>|]/g, "_"); if (!/\.pdf$/i.test(filename)) filename += ".pdf";
    let file = btn && ready.get(btn);
    const label = btn ? btn.innerHTML : "";
    if (!file) {
      if (btn) { btn.disabled = true; btn.textContent = "PDF 만드는 중…"; }
      try { const src = await build(); file = new File([await make(src, Object.assign({ title: filename.replace(/\.pdf$/i, "") }, opt))], filename, { type: "application/pdf" }); }
      catch (e) { if (btn) { btn.disabled = false; btn.innerHTML = label; } alert("PDF를 만들지 못했어요: " + (e && e.message || e)); return; }
      if (btn) { btn.disabled = false; btn.innerHTML = label; ready.set(btn, file); }
    }
    try {
      if (window.claude && window.claude.use && !window.claude.outside) { const dl = await window.claude.use("downloads"); if (dl && dl.save) { await dl.save({ filename, data: file }); return; } }
    } catch (e) {}
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: filename }); return; }
      catch (e) { if (e.name === "AbortError") return; if (e.name === "NotAllowedError" && btn) { btn.textContent = "준비됐어요 · 눌러서 굿노트로"; return; } }
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = filename; a.style.display = "none"; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 3000);
  }
  window.NotePDF = { make, send };
})();
