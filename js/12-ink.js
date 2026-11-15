'use strict';
// ── 굿노트로 보내기: PC 생성기가 만든 PDF 를 공유 창으로 넘긴다(공유 창에서 굿노트를 고르면 바로 열림) ──
// 필기는 앱에서 하지 않고 굿노트에서 한다(단원을 열면 PDF를 미리 받아 둬서 한 번에 열린다).
const pdfCache = new Map();
async function toGoodnotes(btn, path, name) {
  let file = pdfCache.get(path);
  if (!file) {
    busy(btn, 'PDF 준비 중');
    try { file = new File([await (await src().file(path)).blob()], name, {type: 'application/pdf'}); pdfCache.set(path, file); }
    catch (e) { unbusy(btn); return toast('PDF를 받지 못했어요: ' + e.message); }
    unbusy(btn);
  }
  if (navigator.canShare?.({files: [file]})) {
    try { await navigator.share({files: [file], title: name}); return; }
    catch (e) {
      if (e.name === 'AbortError') return;
      if (e.name === 'NotAllowedError') { btn.innerHTML = ic('share', 18) + '눌러서 굿노트로'; return toast('준비됐어요. 한 번 더 누르면 공유 창이 열려요'); }
    }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; a.click();
  toast('PDF를 저장했어요. 굿노트에서 가져오기로 열어 주세요');
}

// ── 굿노트 필기 노트: PC 생성기 PDF 가 없어도 기기에서 바로 만든다(오른쪽 필기 여백 + 문제 빈칸 + 맨 뒤 정답) ──
function gnQs(qs) {
  if (!qs.length) return '';
  const C = '①②③④⑤⑥';
  return `<div class="page"><h2>문제</h2>${qs.map((q, i) => `<div class="q" data-space="${q.type === 'short' ? 170 : 40}"><p>${i + 1}. ${esc(q.q)}${q.type === 'ox' ? ' (O / X)' : ''}</p>${q.type === 'mcq' ? `<ul>${(q.c || []).map((c, k) => `<li>${C[k] || k + 1} ${esc(c)}</li>`).join('')}</ul>` : ''}</div>`).join('')}</div>
    <div class="page"><h2>정답과 해설</h2>${qs.map((q, i) => `<p class="ans">${i + 1}. ${q.type === 'mcq' ? C[q.a] || q.a + 1 : q.type === 'ox' ? (q.a ? 'O' : 'X') : esc(q.a)}${q.e ? ' — ' + esc(q.e) : ''}${q.k?.length ? ' [핵심어: ' + esc(q.k.join(', ')) + ']' : ''}</p>`).join('')}</div>`;
}
function gnUnit(s, u, d, withQs = true) {
  const terms = d.terms?.length ? `<h2>용어</h2><table><tr><th>용어</th><th>뜻</th></tr>${d.terms.map(t => `<tr><td>${esc(t.t)}</td><td>${esc(t.d)}</td></tr>`).join('')}</table>` : '';
  return `<p>${esc(s.name)}</p>${unitHtml(u, d)}${terms}${withQs ? gnQs(questionsOf(s, u, d)) : ''}`;
}
async function gnSubject(s) {
  let h = '';
  for (const u of s.units.filter(u => u.ready)) { try { const d = await loadUnit(s, u); h += `<div class="page"><h1>${esc(u.title)}</h1>${gnUnit(s, u, d, false)}</div>`; } catch {} }
  return h;
}
