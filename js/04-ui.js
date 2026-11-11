'use strict';
// ── 글 보기(마크다운 일부) ──────────────────────────────────────────
function inline(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<i>$2</i>')
    .replace(/`([^`]+)`/g, '<code>$1</code>').replace(/★([^<\n]*)/g, '<span class="star">★$1</span>')
    .replace(/\[\[그림\s*p?\.?\s*(\d+)\s*[::]?\s*([^\]]*)\]\]/g, (_, n, cap) => `<button class="figchip" data-fig="${n}">그림 p.${n}${cap.trim() ? ' · ' + cap.trim() : ''}</button>`);
}
function md(src_) {
  const lines = String(src_ || '').replace(/\r/g, '').split('\n'), out = [];
  let i = 0;
  const isTable = l => /^\s*\|.*\|\s*$/.test(l);
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)/))) { const h = Math.min(4, m[1].length + 1); out.push(`<h${h}>${inline(m[2])}</h${h}>`); i++; continue; }
    if (/^\s*(---+|\*\*\*+)\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
    if (isTable(l) && isTable(lines[i + 1] || '') && /^[\s|:-]+$/.test(lines[i + 1])) {
      const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => inline(c.trim()));
      let h = `<table><thead><tr>${cells(l).map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>`;
      i += 2;
      while (i < lines.length && isTable(lines[i])) { h += `<tr>${cells(lines[i]).map(c => `<td>${c}</td>`).join('')}</tr>`; i++; }
      out.push(h + '</tbody></table>'); continue;
    }
    if (/^\s*>/.test(l)) { const b = []; while (i < lines.length && /^\s*>/.test(lines[i])) b.push(lines[i++].replace(/^\s*>\s?/, '')); out.push(`<blockquote>${md(b.join('\n'))}</blockquote>`); continue; }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) {
      const stack = [];
      while (i < lines.length && (m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)/))) {
        const ind = m[1].replace(/\t/g, '  ').length, tag = /\d/.test(m[2]) ? 'ol' : 'ul';
        while (stack.length && ind < stack.at(-1).ind) out.push(`</li></${stack.pop().tag}>`);
        if (!stack.length || ind > stack.at(-1).ind) { stack.push({ind, tag}); out.push(`<${tag}><li>`); }
        else out.push('</li><li>');
        out.push(inline(m[3])); i++;
      }
      while (stack.length) out.push(`</li></${stack.pop().tag}>`);
      continue;
    }
    const p = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*([-*+]|\d+[.)])\s|\s*>|\s*\|)/.test(lines[i])) p.push(lines[i++]);
    if (!p.length) p.push(lines[i++]);
    out.push(`<p>${p.map(inline).join('<br>')}</p>`);
  }
  return out.join('');
}

// ── 화면 공통 ─────────────────────────────────────────────────────
const main_ = $('#main');
function frame(title, back) {
  $('#title').textContent = title;
  $('#back').hidden = !back;
  $('#logo').hidden = !!back;
  $('#back').onclick = () => back === true ? history.back() : (location.hash = back);
  document.title = title === APP ? title : title + ' · ' + APP;
  for (const b of document.querySelectorAll('nav button')) b.classList.toggle('on', b.dataset.go === (location.hash || '#/').split('?')[0]);
}
function render(h) { main_.innerHTML = h; bindGo(); }
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.append(d); setTimeout(() => d.remove(), 2800); }
function setSync(t, busy) { $('#sync').innerHTML = t ? (busy ? '<span class="spin"></span>' : '') + esc(t) : ''; }
const WD = '일월화수목금토';
const fmtDate = d => `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})`;
const fmtLong = d => `${d.getMonth() + 1}월 ${d.getDate()}일 ${WD[d.getDay()]}요일`;
const dayStart = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const ddays = iso => Math.round((dayStart(iso) - dayStart(new Date())) / DAY);
const ddayText = n => n > 0 ? `D-${n}` : n === 0 ? 'D-day' : `D+${-n}`;
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
function bindGo(root = main_) { root.querySelectorAll('[data-go]').forEach(el => el.onclick = () => location.hash = el.dataset.go); }
document.querySelectorAll('nav button').forEach(b => b.onclick = () => location.hash = b.dataset.go);
const busy = (btn, t) => { btn.disabled = true; btn.dataset.t = btn.innerHTML; btn.innerHTML = `<span class="spin"></span>${esc(t)}`; };
const unbusy = btn => { btn.disabled = false; if (btn.dataset.t) btn.innerHTML = btn.dataset.t; };

function needConnect() {
  frame(APP);
  render(`<div class="narrow"><section class="hero"><div class="eyebrow">시작하기</div><h2 class="display">구글로 시작하기</h2>
    <p class="lede">로그인 한 번이면 끝이에요. 강의별 기본서·문제·시험 대비가 들어오고, 어느 기기에서 열어도 읽던 곳과 필기가 그대로예요.</p></section>
    <div class="card" style="margin-top:22px"><button class="btn pri" id="c-drive">${ic('link', 18)}구글로 시작하기</button>
      <p class="faint" style="margin:14px 0 0">자료와 진도는 내 구글 드라이브에만 있어요. 내 컴퓨터 폴더로 여는 방법은 설정 › 고급에 있어요.</p></div></div>`);
  $('#c-drive').onclick = () => cfg.client ? startGoogle() : (location.hash = '#/set');
}

