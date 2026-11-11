'use strict';
// ── 기출: 회차별 풀기 · 지문 OX 회독 ─────────────────────────────────
// 지문 회독 기록은 prog.ox[지문 id] = {r: [{p 회독(0=복습), v 'O'|'X'|'△', ms, t}], t}. 과목마다 지금 회독은 pref('pass.<과목>').
// 회독 하나 = 과목 지문을 한 번씩 다 보는 것. 최근 K번 연속 O 인 지문은 다음 회독부터 건너뛴다. X 가 2번 넘으면 상습 오답 ★.
async function loadGichulIndex(fresh) {
  if (!fresh && state.gidx) return state.gidx;
  return state.gidx = await readJSON('기출/index.json').catch(() => ({exams: []}));
}
async function loadExam(id) { return (state.exam ||= {})[id] ||= await readJSON(`기출/${id}.json`); }
const examLabel = (d, q) => d.gen ? `예상 지문 · ${d.title}` : `제${d.round}회 ${d.stage}차${q ? ` ${q.period ? q.period + '교시 ' : ''}${q.n}번` : ''}`;

// 과목 지문 전부 (최근 회차부터, 같은 회차는 문제 번호 순)
async function oxPool(sid, examIds, gen = !examIds && oxGenOn()) {
  const idx = await loadGichulIndex(), out = [];
  for (const e of idx.exams.filter(e => (!sid || e.subjects.includes(sid)) && (!examIds || examIds.includes(e.id)))) {
    let d;
    try { d = await loadExam(e.id); } catch { continue; }
    const qs = new Map(d.questions.map(q => [q.id, q]));
    for (const j of d.ox) if (!sid || j.sid === sid) out.push({...j, ex: d, qq: qs.get(j.q)});
  }
  if (gen) out.push(...genStubs(sid));
  return out;
}
// 단원 OX(생성기가 조문·판례로 만든 예상 지문)도 회독에 넣는다. 기출을 넣기 전에도 회독 엔진을 쓸 수 있게.
// 목록·통계는 index.json 의 단원별 ox 수로 id 만 만들고, 풀 때 hydrate 로 글을 채운다. id 에 단원 해시가 들어가 단원을 다시 만들면 새 지문이 된다.
const oxGenOn = () => pref('oxGen', true);
function genStubs(sid) {
  const out = [];
  for (const s of allSubjects()) if (!sid || s.id === sid) for (const u of s.units || []) for (let i = 0; i < (u.ox || 0); i++)
    out.push({id: `u:${u.id}:${u.h || ''}:${i}`, sid: s.id, uid: u.id, i, gen: true, ex: {id: 'gen', gen: true, title: u.title}});
  return out;
}
async function hydrate(list) {
  const need = new Map();
  for (const j of list) if (j.gen && j.t == null) (need.get(j.uid) || need.set(j.uid, []).get(j.uid)).push(j);
  for (const js of need.values()) {
    const s = subjById(js[0].sid), u = s?.units.find(x => x.id === js[0].uid);
    let d;
    try { d = await loadUnit(s, u); } catch { continue; }
    for (const j of js) { const o = d.ox?.[j.i]; if (o) Object.assign(j, {t: o.q, v: !!o.a, e: o.e}); }
  }
  return list.filter(j => j.t != null);
}
const OXK = () => pref('skipK', 3);
const oxRec = id => prog.ox[id]?.r || [];
const passOf = sid => pref('pass.' + sid, 1);
function oxSkip(id) { const k = OXK(), r = oxRec(id).filter(x => x.p); return k > 0 && r.length >= k && r.slice(-k).every(x => x.v === 'O'); }
const oxStar = id => oxRec(id).filter(x => x.v === 'X').length >= 2;
const oxDoneIn = (id, p) => oxRec(id).some(x => x.p === p);
const oxLast = id => oxRec(id).at(-1)?.v;
function passStats(list, p) {
  let done = 0, skip = 0;
  for (const j of list) { if (oxDoneIn(j.id, p)) done++; else if (oxSkip(j.id)) skip++; }
  return {done: done + skip, skip, total: list.length, pct: list.length ? (done + skip) / list.length * 100 : 0};
}
// 회독마다 O·X·△ 수
function passHistory(list) {
  const by = {};
  for (const j of list) for (const r of oxRec(j.id)) if (r.p) { const b = by[r.p] ||= {O: 0, X: 0, '△': 0, ms: 0, n: 0}; b[r.v]++; b.ms += r.ms || 0; b.n++; }
  return by;
}
function oxRecord(j, v, ms, p) {
  const o = prog.ox[j.id] ||= {r: []};
  o.r = [...o.r, {p, v, ms: Math.round(ms), t: Date.now()}].slice(-20); o.t = Date.now();
  srsReview(j.id, v === 'O' ? (ms < 12000 ? 4 : 3) : v === '△' ? 2 : 1);   // 지문도 FSRS 로 다시 볼 날을 잡는다
  saveProg(); logActivity();
}
// 기출 문제 → 문제 풀기 화면 모양
function examToQuiz(d, q) {
  const from = examLabel(d, q), oxs = d.ox.filter(j => j.q === q.id);
  const e = oxs.filter(j => j.e).map(j => `${j.id.split(':').pop().replace(/^c(\d)$/, (_, i) => '①②③④⑤'[i])} ${j.v ? '(O)' : '(X)'} ${j.e}`).join('\n');
  const stem = q.stem + (q.items?.length ? '\n' + q.items.map(it => `${it.k}. ${it.t}`).join('\n') : '');
  if (q.ask === 'essay' || !q.choices?.length) return {id: q.id, type: 'short', q: stem, a: q.outline || '모범 답안 뼈대는 PC 생성기의 해설 단계에서 만들어져요. Gemini 채점은 지금도 쓸 수 있어요.', k: q.refs || [], from, sid: q.sid, exam: true};
  return {id: q.id, type: 'mcq', q: stem, c: q.choices, a: q.answer[0] ?? 0, alt: q.answer, e: [q.e, e].filter(Boolean).join('\n\n') || (q.refs?.length ? '근거: ' + q.refs.join(', ') : ''), from, sid: q.sid, exam: true, revised: q.revisedBy || (q.revised ? '개정 주의' : '')};
}
async function examQuestionsById(ids) {
  const want = new Set(ids), out = [], idx = await loadGichulIndex();
  for (const e of idx.exams) {
    if (![...want].some(id => id.startsWith(e.id + ':'))) continue;
    try { const d = await loadExam(e.id); for (const q of d.questions) if (want.has(q.id)) out.push(examToQuiz(d, q)); } catch {}
  }
  return out;
}
const isOxId = id => /^\d+-\d:\d+:\d+:[^:]+$/.test(id) || id.startsWith('u:');
const isExamQId = id => /^\d+-\d:\d+:\d+$/.test(id);
async function dueOx() {
  const ids = Object.keys(prog.srs).filter(k => isOxId(k) && isDue(k));
  if (!ids.length) return [];
  const all = await oxPool(null, null, true), want = new Set(ids);
  return hydrate(all.filter(j => want.has(j.id)));
}

// ── 기출 첫 화면 ───────────────────────────────────────────────────
async function viewGichul() {
  frame('기출');
  const head = `<section class="hero" style="margin-bottom:20px"><div class="eyebrow">기출</div><h2 class="display">지문 회독</h2>
    <p class="lede">기출 지문마다 O·X·△와 걸린 시간을 회독별로 남겨요. ${OXK() ? `${OXK()}번 연속 맞힌 지문은 다음 회독에서 건너뛰고` : '건너뛰기 없이'}, 두 번 넘게 틀린 지문은 ★로 모아요.</p></section>`;
  render(head + `<div class="card">${thinking('기출을 모으는 중…')}</div>`);
  const idx = await loadGichulIndex(true);
  const all = await oxPool(), subs = allSubjects();
  if (!idx.exams.length && !all.length) { render(head + gichulHowto()); bindGo(); return; }
  let h = head + (idx.exams.length ? '' : `<div class="card"><b>아직 기출이 없어서</b> 단원마다 만든 예상 지문(조문·판례 OX)으로 회독해요. 기출 PDF를 넣으면 기출 지문이 함께 들어와요. <a href="#/add">기출 넣는 법</a></div>`) + '<div class="grid">';
  for (const s of subs) {
    const list = all.filter(j => j.sid === s.id);
    if (!list.length) continue;
    const p = passOf(s.id), st = passStats(list, p), stars = list.filter(j => oxStar(j.id)).length;
    h += `<div class="card subj" style="--h:${hue(sha6(s.id))}" data-go="#/s/${s.id}/gichul"><div class="nm"><span class="dot"></span>${esc(s.name)}</div>
      <div class="faint">${p}회독 진행 중 · ${st.done}/${st.total} 지문${st.skip ? ` · 건너뜀 ${st.skip}` : ''}</div>
      <div class="bar"><i style="width:${st.pct}%"></i></div>
      <div class="tags">${stars ? `<span class="tag bad">★ ${stars}</span>` : ''}${p > 1 ? `<span class="tag ok">${p - 1}회독 끝</span>` : ''}</div></div>`;
  }
  h += '</div>' + (idx.exams.length ? '' : '<div class="row"><button class="btn" data-go="#/add">' + ic('plus', 18) + '기출 파일 넣기</button></div>');
  if (!idx.exams.length) { render(h); bindGo(); return; }
  h += `<div class="sect">회차별 풀기</div><div class="card" style="padding-top:8px;padding-bottom:8px"><ul class="list">${idx.exams.map(e => {
    const done = Object.keys(prog.q).filter(k => k.startsWith(e.id + ':')).length;
    return `<li data-go="#/gichul/${e.id}"><span class="num">${e.round}</span><span class="grow"><span class="tt">${esc(e.title)}</span><div class="faint">${e.year}년 · 문제 ${e.n} · 지문 ${e.ox}${e.explained ? ` · 해설 ${e.explained}` : ''}</div></span>${done ? `<span class="tag ok">${done}/${e.n} 풂</span>` : ''}<span class="chev">${ic('chev', 16)}</span></li>`;
  }).join('')}</ul></div>
    <div class="row"><button class="btn" data-go="#/trend">${ic('chart', 18)}출제 경향</button><button class="btn" data-go="#/add">${ic('plus', 18)}기출 파일 넣기</button></div>`;
  render(h);
}
const sha6 = id => [...String(id)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16).padStart(6, '0');
function gichulHowto() {
  return `<div class="card"><h2>기출을 넣어 주세요</h2>
    <ol class="md" style="margin:0;padding-left:20px;line-height:1.8">
      <li>대법원 법원시험정보(exam.scourt.go.kr) → 시험자료실 → 법무사시험에서 '제N회 법무사 제1차 시험 문제'의 hwp 파일과 '확정정답' 파일을 받아요.</li>
      <li>홈의 '자료 넣기' → '기출'에서 회차·차수를 고르고 파일을 넣거나, 드라이브 <code>${esc(FOLDER)}/${INBOX}/기출/제32회 1차/</code>에 넣어요.</li>
      <li>hwp가 '배포용 문서'(보호)면 한컴오피스 뷰어나 구글 드라이브 미리보기로 열어 PDF로 저장해 같은 폴더에 넣어요.</li>
      <li>PC 생성기가 문제와 지문으로 나누고, 정답으로 지문마다 O·X를 매겨요. 해설·근거 조문도 과목마다 조금씩 붙여요.</li></ol>
    <p class="faint" style="margin:12px 0 0">법원시험정보 사이트는 robots.txt로 자동 수집을 막아 두었어요. 수집기의 기출 받기는 기본으로 꺼져 있고, 켜면 하루 한 번 새 글만 받아 '받은 자료/기출'에 넣어요. 기출은 법원행정처가 공개한 자료라 개인 공부에는 출처를 밝혀 쓸 수 있어요.</p>
    <div class="row" style="margin-top:14px"><button class="btn pri" data-go="#/add">${ic('plus', 18)}기출 파일 넣기</button></div></div>`;
}

// ── 회차 하나 ───────────────────────────────────────────────────────
async function viewExamRound(id) {
  frame('기출', '#/gichul');
  render(`<div class="card">${thinking()}</div>`);
  let d;
  try { d = await loadExam(id); } catch (e) {
    if (state.refetchedEx !== id) {   // 자료 정리 직후일 수 있다 — 기출 목록을 새로 받아 한 번 다시
      state.refetchedEx = id; GD.lists = {}; state.gidx = null; state.exam = {};
      return viewExamRound(id);
    }
    render(`<div class="card">이 회차를 불러오지 못했어요: ${esc(e.message)}<div class="row noprint" style="margin-top:12px"><button class="btn pri" data-go="#/gichul">기출 목록으로</button></div></div>`);
    return;
  }
  const bySub = new Map();
  for (const q of d.questions) (bySub.get(q.sid) || bySub.set(q.sid, []).get(q.sid)).push(q);
  const ok = q => prog.q[q.id], rate = qs => { const a = qs.filter(ok); return a.length ? Math.round(a.filter(q => prog.q[q.id].streak > 0).length / a.length * 100) : null; };
  render(`<section class="hero" style="margin-bottom:18px"><div class="eyebrow">${d.year}년 시행</div><h2 class="display">${esc(d.title)}</h2>
    <p class="lede">문제 ${d.questions.length}개 · 지문 ${d.ox.length}개. 실제 시험처럼 풀거나, 과목별로 풀어요.</p></section>
    <div class="row" style="margin-bottom:14px"><button class="btn pri" id="er-all">전체 풀기 ${d.questions.length}</button>${(() => {
      // 실전 모드: 1차는 교시당 120분에 100문제(문제당 72초). 교시 정보가 없으면 문제 수 × 72초.
      if (+d.stage !== 1) return '';
      const ps = [...new Set(d.questions.map(q => q.period).filter(Boolean))].sort();
      return ps.length ? ps.map(p => { const n = d.questions.filter(q => q.period === p).length; return `<button class="btn" data-live="${p}">${p}교시 실전 ${n}문제 · ${Math.round(n * 1.2)}분</button>`; }).join('') : `<button class="btn" data-live="all">실전 풀기 · ${Math.round(d.questions.length * 1.2)}분</button>`;
    })()}<button class="btn" id="er-ox">이 회차 지문 OX</button></div>
    <div class="card" style="padding-top:8px;padding-bottom:8px"><ul class="list">${[...bySub].map(([sid, qs]) => {
      const s = subjById(sid), r = rate(qs);
      return `<li data-sid="${esc(sid)}"><span class="grow"><span class="tt">${esc(s?.name || qs[0].subj || sid)}</span><div class="faint">${qs[0].n}~${qs.at(-1).n}번 · ${qs.length}문제${qs.some(q => q.revisedBy || q.revised) ? ' · 개정 영향 있음' : ''}</div></span>${r != null ? `<span class="tag ${r >= 70 ? 'ok' : r >= 40 ? 'warn' : 'bad'}">${r}%</span>` : ''}<span class="chev">${ic('chev', 16)}</span></li>`;
    }).join('')}</ul></div><p class="faint">출처: ${esc(d.source || '법원행정처')}</p>`);
  main_.querySelectorAll('[data-sid]').forEach(li => li.onclick = () => startQuiz(bySub.get(li.dataset.sid).map(q => examToQuiz(d, q)), `${examLabel(d)} ${subjById(li.dataset.sid)?.name || ''}`, `#/gichul/${id}`));
  $('#er-all').onclick = () => startQuiz(d.questions.map(q => examToQuiz(d, q)), d.title, `#/gichul/${id}`);
  main_.querySelectorAll('[data-live]').forEach(b => b.onclick = () => {
    const p = b.dataset.live, qs = p === 'all' ? d.questions : d.questions.filter(q => q.period === +p);
    startQuiz(qs.map(q => examToQuiz(d, q)), `${d.title}${p === 'all' ? '' : ` ${p}교시`} 실전`, `#/gichul/${id}`, {limitMin: Math.round(qs.length * 1.2)});
  });
  $('#er-ox').onclick = async () => { const list = await oxPool(null, [id]); startOx(list, `${examLabel(d)} 지문`, `#/gichul/${id}`, 0); };
}

// ── 과목의 기출 탭: 회독 현황 ─────────────────────────────────────────
async function viewSubjectGichul(s) {
  frame(s.name, '#/');
  render(tabsHtml(s, 'gichul') + `<div class="card">${thinking('지문을 모으는 중…')}</div>`);
  const list = await oxPool(s.id);
  if (!list.length) { render(tabsHtml(s, 'gichul') + gichulHowto()); bindGo(); return; }
  const p = passOf(s.id), st = passStats(list, p), hist = passHistory(list), stars = list.filter(j => oxStar(j.id));
  const exams = [...new Map(list.map(j => [j.ex.id, j.ex])).values()].filter(e => !e.gen), gens = list.filter(j => j.gen);
  const left = list.filter(j => !oxDoneIn(j.id, p) && !oxSkip(j.id));
  const lastX = list.filter(j => oxLast(j.id) === 'X' || oxLast(j.id) === '△');
  const revised = list.filter(j => j.revised || j.revisedBy);
  render(tabsHtml(s, 'gichul') + `<div class="card"><div class="row" style="align-items:baseline;gap:14px"><span class="dday" style="font-size:38px">${p}회독</span><span class="grow muted">${st.done}/${st.total} 지문 · ${Math.round(st.pct)}%${st.skip ? ` · ${OXK()}연속 O 건너뜀 ${st.skip}` : ''}</span></div>
      <div class="bar" style="height:10px;margin:12px 0 4px"><i style="width:${st.pct}%"></i></div>
      <div class="row" style="margin-top:14px"><button class="btn pri" id="g-go" ${left.length ? '' : 'disabled'}>${left.length ? `이어서 회독 · 남은 ${left.length}` : '이번 회독 끝'}</button>
        ${left.length ? `<button class="btn" id="g-listen">${ic('sound', 16)}듣기로 회독</button>` : ''}
        ${stars.length ? `<button class="btn" id="g-star">${ic('star', 16)}상습 오답 ★ ${stars.length}</button>` : ''}
        ${lastX.length ? `<button class="btn" id="g-x">최근 틀린·헷갈린 ${lastX.length}</button>` : ''}
        ${revised.length ? `<button class="btn" id="g-rev">${ic('alert', 16)}개정 영향 ${revised.length}</button>` : ''}</div></div>
    <div class="sect">회독 기록</div><div class="card"><table class="plan"><tr><td><b>회독</b></td><td><b>O · X · △</b></td><td><b>정답률</b></td><td><b>평균 시간</b></td></tr>${Object.entries(hist).map(([k, b]) => `<tr${+k === p ? ' class="today"' : ''}><td>${k}회독</td><td>${b.O} · ${b.X} · ${b['△']}</td><td>${Math.round(b.O / b.n * 100)}%</td><td>${(b.ms / b.n / 1000).toFixed(1)}초</td></tr>`).join('') || '<tr><td colspan="4" class="faint">아직 기록이 없어요</td></tr>'}</table></div>
    <div class="sect">회독 방식</div><div class="card"><div class="opt">
      <label>순서 <select id="g-ord" style="min-height:30px;padding:2px 8px;border:0;background:none">${[['exam', '최근 회차부터'], ['shuffle', '섞어서'], ['star', '★·틀린 것 먼저']].map(([v, t]) => `<option value="${v}" ${pref('oxOrder', 'exam') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label>건너뛰기 <select id="g-k" style="min-height:30px;padding:2px 8px;border:0;background:none">${[[0, '안 함'], [2, '2연속 O'], [3, '3연속 O'], [4, '4연속 O'], [5, '5연속 O']].map(([v, t]) => `<option value="${v}" ${OXK() === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label>한 번에 <select id="g-n" style="min-height:30px;padding:2px 8px;border:0;background:none">${[20, 40, 80, 9999].map(n => `<option value="${n}" ${pref('oxBatch', 40) === n ? 'selected' : ''}>${n === 9999 ? '전부' : n + '개'}</option>`).join('')}</select></label></div>
      <label class="row" style="margin-top:12px;gap:8px"><input type="checkbox" id="g-gen" ${oxGenOn() ? 'checked' : ''}> 단원 예상 지문(조문·판례 OX)도 회독에 넣기</label>
      <div class="row" style="margin-top:12px">${gens.length ? `<button class="btn sm" data-ex="gen">예상 지문 ${gens.length}</button>` : ''}${exams.map(e => `<button class="btn sm" data-ex="${e.id}">${esc(examLabel(e))} ${list.filter(j => j.ex.id === e.id).length}</button>`).join('')}</div>
      <div class="row" style="margin-top:12px"><button class="btn ghost sm" id="g-reset">${p}회독 처음부터</button><button class="btn ghost sm" id="g-next">${p + 1}회독 시작</button></div></div>`);
  $('#g-ord').onchange = e => setPref('oxOrder', e.target.value);
  $('#g-k').onchange = e => { setPref('skipK', +e.target.value); viewSubjectGichul(s); };
  $('#g-n').onchange = e => setPref('oxBatch', +e.target.value);
  $('#g-gen').onchange = e => { setPref('oxGen', e.target.checked); viewSubjectGichul(s); };
  const back = `#/s/${s.id}/gichul`;
  $('#g-go') && ($('#g-go').onclick = () => startOx(orderOx(left).slice(0, pref('oxBatch', 40)), `${s.name} ${p}회독`, back, p, s.id));
  // 듣기로 회독: 지문을 읽어 주고 생각할 시간 뒤 정답·해설. 답을 들려주기 전에 O·X 를 누른 지문만 이번 회독에 남는다
  $('#g-listen') && ($('#g-listen').onclick = async () => {
    const js = await hydrate(orderOx(left).slice(0, pref('oxBatch', 40)));
    startListen(js.map(j => ({kind: 'ox', ask: j.t, v: j.v, e: j.e || store.get('oxe.' + j.id, ''), from: examLabel(j.ex, j.qq), sid: j.sid, j})), `${s.name} ${p}회독 · 듣기`, back,
      (it, ok) => { oxRecord(it.j, ok ? 'O' : 'X', 12000, p); if (left.every(j => oxDoneIn(j.id, p) || oxSkip(j.id))) checkPassDone(s.id, p); });
  });
  $('#g-star') && ($('#g-star').onclick = () => startOx(shuffle(stars), `${s.name} ★ 상습 오답`, back, 0));
  $('#g-x') && ($('#g-x').onclick = () => startOx(shuffle(lastX), `${s.name} 틀린·헷갈린 지문`, back, 0));
  $('#g-rev') && ($('#g-rev').onclick = () => startOx(revised, `${s.name} 개정 영향 지문`, back, 0));
  main_.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => startOx(list.filter(j => j.ex.id === b.dataset.ex), `${s.name} ${b.textContent}`, back, 0));
  $('#g-reset').onclick = () => { if (!confirm(`${p}회독 기록을 지우고 처음부터 할까요? (다른 회독 기록은 남아요)`)) return; for (const j of list) if (prog.ox[j.id]) { prog.ox[j.id] = {r: prog.ox[j.id].r.filter(x => x.p !== p), t: Date.now()}; } saveProg(); viewSubjectGichul(s); };
  $('#g-next').onclick = () => { if (st.pct < 100 && !confirm(`${p}회독이 ${Math.round(st.pct)}%예요. 그래도 ${p + 1}회독을 시작할까요?`)) return; setPref('pass.' + s.id, p + 1); viewSubjectGichul(s); };
}
function orderOx(list) {
  const o = pref('oxOrder', 'exam');
  if (o === 'shuffle') return shuffle(list);
  if (o === 'star') return list.slice().sort((a, b) => (oxStar(b.id) - oxStar(a.id)) || ((oxLast(b.id) === 'X') - (oxLast(a.id) === 'X')));
  return list;
}

// ── 지문 OX 풀기 ────────────────────────────────────────────────────
// p: 회독 번호(0 이면 회독에 세지 않는 복습). sid 가 있으면 회독이 끝났을 때 다음 회독으로 넘긴다.
async function startOx(list, title, back, p = 0, sid = null) {
  list = await hydrate(list);
  if (!list.length) return toast('볼 지문이 없어요');
  state.oxs = {list, i: 0, p, sid, title, back, res: []};
  if (location.hash === '#/oxrun') viewOx(); else location.hash = '#/oxrun';
}
function viewOx() {
  const z = state.oxs;
  if (!z) return location.replace('#/gichul');
  frame(z.title, z.back);
  if (z.i >= z.list.length) return oxEnd();
  const j = z.list[z.i], q = j.qq || {}, rec = oxRec(j.id), star = oxStar(j.id);
  const askT = {true: '옳은 것 고르기', false: '옳지 않은 것 고르기', combo_true: '옳은 것 모두', combo_false: '옳지 않은 것 모두'}[q.ask] || '';
  render(`<div class="qwrap"><div class="qtop"><span class="cnt">${pad2(z.i + 1)} <span class="faint">/ ${z.list.length}</span></span><span class="grow faint">${esc(subjById(j.sid)?.name || '')} · ${esc(examLabel(j.ex, q))}</span>
      ${star ? `<span class="tag bad">★ 상습</span>` : ''}${j.revised || j.revisedBy ? '<span class="tag warn">개정 주의</span>' : ''}${rec.length ? `<span class="tag">${rec.map(r => r.v).slice(-5).join('')}</span>` : '<span class="tag warn">처음</span>'}</div>
    <div class="prog"><i style="width:${z.i / z.list.length * 100}%"></i></div>
    <div class="card" style="padding:26px"><div class="q" style="margin-bottom:14px">${esc(j.t)}</div>
      ${j.gen ? '' : `<details class="faint" style="margin-bottom:16px"><summary style="cursor:pointer">발문 보기${askT ? ' · ' + askT : ''}</summary><div style="margin-top:6px;white-space:pre-wrap">${esc(q.stem || '')}</div></details>`}
      <div class="oxrow"><button class="choice" data-v="1">O<span class="faint" style="font-size:13px;margin-left:8px">맞다</span></button><button class="choice" data-v="0">X<span class="faint" style="font-size:13px;margin-left:8px">틀리다</span></button></div>
      <div id="fb"></div><div class="faint" id="oxt" style="text-align:right;margin-top:10px"></div></div></div>`);
  const t0 = performance.now();
  const tick = setInterval(() => { const el = $('#oxt'); if (!el) return clearInterval(tick); el.textContent = ((performance.now() - t0) / 1000).toFixed(0) + '초'; }, 500);
  let ans = null;
  const commit = v => {
    if (ans == null) return;
    oxRecord(j, v, ans.ms, z.p);
    z.res.push({j, v, ms: ans.ms});
    // 회독이 끝났으면 다음 회독으로
    if (z.p && z.sid && z.i + 1 >= z.list.length) checkPassDone(z.sid, z.p);
    z.i++; viewOx(); scrollTo(0, 0);
  };
  const answer = mine => {
    if (ans) return;
    clearInterval(tick);
    const ms = performance.now() - t0, ok = mine === j.v;
    ans = {ms, ok};
    main_.querySelectorAll('.choice').forEach(x => { x.disabled = true; if ((+x.dataset.v === 1) === j.v) x.classList.add('ok'); });
    if (!ok) main_.querySelector(`.choice[data-v="${mine ? 1 : 0}"]`).classList.add('bad');
    const ex = j.e || store.get('oxe.' + j.id, '');
    $('#fb').innerHTML = `<div class="fb ${ok ? 'ok' : 'bad'}"><div class="ttl">${ic(ok ? 'check' : 'x', 18, 2.2)}${ok ? '맞았어요' : '틀렸어요'} · 이 지문은 ${j.v ? 'O (옳음)' : 'X (틀림)'} · ${(ms / 1000).toFixed(1)}초</div>
        ${ex ? `<div>${inline(ex)}</div>` : '<div class="faint">해설은 PC 생성기가 과목별로 조금씩 붙여요.</div>'}${j.refs?.length ? `<div class="faint" style="margin-top:6px">근거: ${esc(j.refs.join(' · '))}</div>` : ''}${j.revisedBy ? `<div style="margin-top:6px;color:var(--gold)">${ic('alert', 14)} ${esc(j.revisedBy)} — 지금 법으로는 답이 다를 수 있어요</div>` : ''}</div>
      <div id="why"></div>
      <div class="row">${!ex && aiOn() ? `<button class="btn gem sm" id="oxwhy">${ic('spark', 16)}${aiName()} 해설</button>` : ''}<span class="grow"></span>
        ${ok ? `<button class="btn" id="oxtri">△ 헷갈렸어요</button>` : ''}<button class="btn pri" id="oxnext">${z.i + 1 < z.list.length ? '다음' : '결과 보기'}</button></div>`;
    $('#oxnext').onclick = () => commit(ok ? 'O' : 'X');
    $('#oxtri') && ($('#oxtri').onclick = () => commit('△'));
    $('#oxnext').focus({preventScroll: true});
    $('#oxwhy') && ($('#oxwhy').onclick = async () => {
      busy($('#oxwhy'), '해설 받는 중…');
      try {
        const t = await gem(`법무사 시험 ${j.gen ? '예상' : '기출'} 지문이다. 이 지문이 ${j.v ? '옳은' : '틀린'} 이유를 근거 조문(법령명 제N조)과 판례 법리로 3~5문장 설명하고, 틀린 지문이면 바르게 고친 문장을 한 줄로 써 줘. 확실하지 않은 사건번호는 쓰지 마. 현행 법령 기준으로 답이 달라졌으면 그것도 밝혀.\n과목: ${subjById(j.sid)?.name}\n발문: ${q.stem || ''}\n지문: ${j.t}`);
        store.set('oxe.' + j.id, t); $('#why').innerHTML = `<div class="card ai" style="box-shadow:none"><div class="md">${md(t)}</div></div>`; $('#oxwhy').remove();
      } catch (e) { toast(e.message); unbusy($('#oxwhy')); }
    });
  };
  main_.querySelectorAll('.choice').forEach(b => b.onclick = () => answer(b.dataset.v === '1'));
  state.keys = e => {
    const k = e.key.toLowerCase();
    if (!ans && (k === 'o' || k === '1' || k === 'ㅐ')) answer(true);
    else if (!ans && (k === 'x' || k === '2' || k === 'ㅌ')) answer(false);
    else if (ans && (k === 'enter' || k === ' ')) { e.preventDefault(); commit(ans.ok ? 'O' : 'X'); }
    else if (ans && ans.ok && (k === '3' || k === 'd')) commit('△');
  };
}
addEventListener('keydown', e => { if (!e.target.matches?.('input,textarea,select') && location.hash === '#/oxrun') state.keys?.(e); });
async function checkPassDone(sid, p) {
  const list = await oxPool(sid);
  if (passStats(list, p).pct >= 100 && passOf(sid) === p) { setPref('pass.' + sid, p + 1); toast(`${subjById(sid)?.name} ${p}회독을 끝냈어요! 이제 ${p + 1}회독이에요`); }
}
function oxEnd() {
  const z = state.oxs, n = z.res.length, c = v => z.res.filter(r => r.v === v).length, pct = n ? Math.round(c('O') / n * 100) : 0;
  const avg = n ? z.res.reduce((a, r) => a + r.ms, 0) / n / 1000 : 0, bad = z.res.filter(r => r.v !== 'O');
  render(`<div class="qwrap"><div class="card" style="text-align:center;padding:32px 24px"><div class="eyebrow">${z.p ? z.p + '회독' : '복습'} 결과</div>
    <div class="ring" style="--p:${pct}"><div><div><b>${pct}%</b><div class="faint">O ${c('O')} · X ${c('X')} · △ ${c('△')}</div></div></div></div>
    <p class="muted" style="margin:0">지문 하나에 평균 ${avg.toFixed(1)}초${avg > 20 ? ' · 시험장에서는 지문당 15초 안쪽이 목표예요' : ''}</p></div>
    ${bad.length ? `<div class="sect">틀리거나 헷갈린 지문 ${bad.length}</div>${bad.map(({j, v}) => `<div class="card" style="padding:16px 20px"><div class="row" style="align-items:flex-start"><span class="tag ${v === 'X' ? 'bad' : 'warn'}">${v}</span><b class="grow" style="font-family:var(--serif);font-weight:500">${esc(j.t)}</b><span class="tag ok">${j.v ? 'O' : 'X'}</span></div>${j.e ? `<div class="muted" style="margin-top:6px">${inline(j.e)}</div>` : ''}<div class="faint">${esc(examLabel(j.ex, j.qq))}${oxStar(j.id) ? ' · ★ 상습 오답' : ''}</div></div>`).join('')}` : ''}
    <div class="row" style="margin-top:16px">${bad.length ? '<button class="btn pri" id="oxbad">틀린 것만 다시</button>' : ''}${z.sid ? '<button class="btn" id="oxmore">회독 이어 가기</button>' : ''}<span class="grow"></span><button class="btn ghost" data-go="${z.back}">끝내기</button></div></div>`);
  $('#oxbad') && ($('#oxbad').onclick = () => startOx(shuffle(bad.map(r => r.j)), z.title.replace(/ \(다시\)$/, '') + ' (다시)', z.back, 0));
  $('#oxmore') && ($('#oxmore').onclick = async () => {
    const list = await oxPool(z.sid), p = passOf(z.sid);
    const left = list.filter(j => !oxDoneIn(j.id, p) && !oxSkip(j.id));
    if (!left.length) { toast('이번 회독을 다 했어요'); location.hash = z.back; return; }
    startOx(orderOx(left).slice(0, pref('oxBatch', 40)), `${subjById(z.sid)?.name} ${p}회독`, z.back, p, z.sid);
  });
}
