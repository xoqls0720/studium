'use strict';
// ── D-day 역산 계획 · 출제 경향 ───────────────────────────────────────
// 시험일은 prog.exams['@1'](1차) · ['@2'](2차). 남은 날에서 마무리 기간을 빼고, 목표 회독까지 남은 지문·단원을 날마다 나눈다.
// 내가 넣은 날짜가 없으면 수집기가 공고에서 읽은 시험일(수집/exam_site.json dates). 지난 회차뿐이면 1년 뒤 같은 날을 '예상'으로.
async function loadSite() { return state.site ||= await readJSON('수집/exam_site.json').catch(() => ({})); }
function officialExam(st) {
  const ds = Object.entries(state.site?.dates || {}).filter(([k]) => k.endsWith('-' + st)).sort((a, b) => a[1] < b[1] ? -1 : 1);
  if (!ds.length) return null;
  const [k, d] = ds.at(-1), round = +k.split('-')[0];
  if (ddays(d) >= 0) return {date: d, round, est: false};
  return {date: todayKey(new Date(dayStart(d).getTime() + 364 * DAY)), round: round + 1, est: true, last: d};   // 52주 뒤: 같은 요일(보통 토요일)
}
const stageExam = st => prog.exams['@' + st]?.date || officialExam(st)?.date || '';
const examNote = st => { const o = !prog.exams['@' + st]?.date && officialExam(st); return o ? `제${o.round}회${o.est ? ' 예상' : ''}` : ''; };
function nextStage() {
  const c = [1, 2].filter(st => stageExam(st) && ddays(stageExam(st)) >= 0).sort((a, b) => stageExam(a) < stageExam(b) ? -1 : 1);
  return c[0] || store.get('planStage', 1);
}
const subjectsOf = st => allSubjects().filter(s => (s.stage || [1, 2]).includes(st));
function weightOf(sid, st) {   // 과목 안 배점 비율(subjects.json)
  for (const g of state.cfgStages?.[st] || []) for (const [id, w] of g.parts) if (id === sid) return w;
  return 50;
}
async function planOf(st) {
  if (!state.cfgStages) state.cfgStages = (await readJSON('수집/subjects.json').catch(() => null))?.stages || {};
  const date = stageExam(st), left = date ? ddays(date) : null;
  const T = pref('planPasses', 5), B = pref('planBook', 3), buffer = Math.min(pref('planBuffer', 10), Math.max(0, (left ?? 0) - 1));
  const days = Math.max(1, (left ?? 120) - buffer), all = await oxPool(), rows = [];
  for (const s of subjectsOf(st)) {
    const list = all.filter(j => j.sid === s.id), N = list.length, p = passOf(s.id), ps = passStats(list, p);
    const units = s.units.filter(u => u.ready), U = units.length;
    const rOx = Math.max(0, (T - p + 1) * N - ps.done), rBook = Math.max(0, B * U - units.reduce((a, u) => a + Math.min(B, readCount(u.id)), 0));
    rows.push({s, list, N, p, ps, U, rOx, rBook, w: weightOf(s.id, st), stars: list.filter(j => oxStar(j.id)).length});
  }
  const sumOx = rows.reduce((a, r) => a + r.rOx, 0), sumBook = rows.reduce((a, r) => a + r.rBook, 0);
  const oxDay = Math.ceil(sumOx / days), bookDay = Math.ceil(sumBook / days);
  // 배점이 큰 과목·많이 남은 과목에 더 나눠 준다(정수로, 큰 나머지 순)
  const ox = alloc(oxDay, rows.map(r => r.rOx * r.w)), bk = alloc(bookDay, rows.map(r => r.rBook * r.w));
  rows.forEach((r, i) => { r.oxToday = ox[i]; r.bookToday = bk[i]; });
  // 회독 끝 예상일
  const perPass = rows.reduce((a, r) => a + r.N, 0), miles = [];
  if (oxDay && perPass) {
    let acc = rows.reduce((a, r) => a + (r.N ? r.N - r.ps.done : 0), 0), k = Math.min(...rows.filter(r => r.N).map(r => r.p));
    for (; k <= T && miles.length < 8; k++) { miles.push({k, date: new Date(dayStart(new Date()).getTime() + Math.ceil(acc / oxDay) * DAY)}); acc += perPass; }
  }
  return {st, date, left, T, B, buffer, days, rows, sumOx, sumBook, oxDay, bookDay, miles};
}

function alloc(n, ws) {
  const sum = ws.reduce((a, w) => a + w, 0);
  if (!sum) return ws.map(() => 0);
  const raw = ws.map(w => n * w / sum), out = raw.map(Math.floor);
  raw.map((x, i) => [x - out[i], i]).sort((a, b) => b[0] - a[0]).slice(0, n - out.reduce((a, x) => a + x, 0)).forEach(([, i]) => out[i]++);
  return out;
}

async function viewPlan() {
  frame('D-day 계획', '#/');
  render(`<div class="card">${thinking('계획을 세우는 중…')}</div>`);
  await loadSite();
  const st = +(new URLSearchParams(location.hash.split('?')[1]).get('st') || nextStage()), P = await planOf(st);
  const today = P.rows.filter(r => r.oxToday || r.bookToday);
  let h = `<section class="hero" style="margin-bottom:18px"><div class="eyebrow">D-day 역산 계획</div><h2 class="display">제${st}차 시험${P.date ? ` <span class="dday">${ddayText(P.left)}</span>` : ''}</h2>${examNote(st) ? `<p class="faint" style="margin:4px 0 0">${(() => { const o = officialExam(st); return o.est ? `제${o.round - 1}회는 ${fmtDate(new Date(o.last))}에 치렀어요. 제${o.round}회 공고 전이라 1년 뒤 같은 때로 잡았어요 — 공고가 나오면 저절로 바뀌어요.` : `법원행정처 공고 기준 (제${o.round}회)`; })()}</p>` : ''}
    <p class="lede">${P.date ? `${fmtLong(new Date(P.date))}까지 기출 지문 ${P.T}회독 · 기본서 ${P.B}회독을 목표로, 마지막 ${P.buffer}일은 마무리로 비워 두고 남은 양을 날마다 나눠요.` : '시험 날짜를 넣으면 남은 날로 하루 할 양을 나눠 드려요.'}</p></section>
    <div class="seg noprint" style="margin-bottom:16px">${[1, 2].map(x => `<button class="${x === st ? 'on' : ''}" data-go="#/plan?st=${x}">제${x}차${stageExam(x) ? ' ' + ddayText(ddays(stageExam(x))) : ''}</button>`).join('')}</div>`;
  if (P.date && P.left >= 0) {
    h += `<div class="stats" style="margin:0 0 16px"><div class="stat"><b>${P.oxDay}</b><span>하루 기출 지문</span></div><div class="stat"><b>${P.bookDay}</b><span>하루 기본서 단원</span></div><div class="stat"><b>${P.days}</b><span>회독할 날 (마무리 ${P.buffer}일 따로)</span></div></div>
      <div class="sect">오늘 할 것</div><div class="card" style="padding-top:6px;padding-bottom:6px"><ul class="list">${today.map(r => `<li data-go="#/s/${r.s.id}/gichul"><span class="grow"><span class="tt">${esc(r.s.name)}</span><div class="faint">${r.oxToday ? `기출 지문 ${r.oxToday}개 (${r.p}회독 ${Math.round(r.ps.pct)}%)` : ''}${r.oxToday && r.bookToday ? ' · ' : ''}${r.bookToday ? `기본서 ${r.bookToday}단원` : ''}${r.stars ? ` · ★ ${r.stars}` : ''}</div></span><span class="chev">${ic('chev', 16)}</span></li>`).join('') || '<li class="off">남은 회독이 없어요. ★ 지문과 요약서로 마무리해요.</li>'}
        <li data-go="#/review"><span class="grow"><span class="tt">오늘 복습 (카드·때가 된 지문)</span><div class="faint">간격 반복 · 잊을 때쯤 다시</div></span><span class="chev">${ic('chev', 16)}</span></li></ul></div>
      ${P.miles.length ? `<div class="sect">회독 끝 예상</div><div class="card"><table class="plan">${P.miles.map(m => `<tr${m.date > new Date(P.date) ? ' style="color:var(--bad)"' : ''}><td>${m.k}회독</td><td>${fmtDate(m.date)}${m.date > new Date(new Date(P.date).getTime() - P.buffer * DAY) ? ' · 마무리 기간과 겹쳐요' : ''}</td></tr>`).join('')}
        <tr class="today"><td>마무리</td><td>${fmtDate(new Date(new Date(P.date).getTime() - P.buffer * DAY))}~ 최근 3개 회차 실전 · ★ 상습 오답 · 개정 조문 · 요약서</td></tr></table></div>` : ''}`;
  }
  h += `<div class="sect">과목별 남은 양</div><div class="card"><table class="plan"><tr><td><b>과목</b></td><td><b>기출 회독</b></td><td><b>기본서</b></td><td><b>배점</b></td></tr>${P.rows.map(r => `<tr><td><a href="#/s/${r.s.id}/gichul">${esc(r.s.name)}</a></td><td>${r.N ? `${r.p}회독 ${r.ps.done}/${r.N} · 남은 ${r.rOx}` : '<span class="faint">기출 없음</span>'}</td><td>${r.U ? `남은 ${r.rBook}단원` : '<span class="faint">정리 중</span>'}</td><td>${r.w}</td></tr>`).join('')}</table></div>
    <div class="card"><h2>시험 정보와 목표</h2>
      <label class="field"><span>제${st}차 시험 날짜</span><div class="row"><input type="date" id="pd" value="${esc(P.date)}"><button class="btn pri" id="psave">저장</button>${P.date ? '<button class="btn ghost" id="pclear">지우기</button>' : ''}</div></label>
      <label class="field"><span>기출 지문 목표 회독</span><div class="opt">${[3, 5, 7, 10].map(n => `<label><input type="radio" name="pt" value="${n}" ${P.T === n ? 'checked' : ''}>${n}회독</label>`).join('')}</div></label>
      <label class="field"><span>기본서 목표 회독</span><div class="opt">${[1, 2, 3, 5].map(n => `<label><input type="radio" name="pb" value="${n}" ${P.B === n ? 'checked' : ''}>${n}회독</label>`).join('')}</div></label>
      <label class="field" style="margin:0"><span>마무리 기간</span><div class="opt">${[0, 7, 10, 14, 21].map(n => `<label><input type="radio" name="pf" value="${n}" ${pref('planBuffer', 10) === n ? 'checked' : ''}>${n}일</label>`).join('')}</div></label>
      <p class="faint" style="margin:10px 0 0">날짜를 비워 두면 법원시험정보 공고의 시험일(공고 전이면 작년 날짜로 잡은 예상일)을 써요.${(state.site?.notices || []).length ? ` 최근 공고: ${state.site.notices.slice(0, 2).map(n => `${esc(n.date)} ${esc(n.title)}`).join(' · ')}` : ''} 30일 안으로 다가오면 카드 목표 기억률이 93%로 올라가고, 14일 전부터는 새 카드를 멈춰요(설정).</p>
      ${st === 1 ? `<p class="faint" style="margin:8px 0 0">1차 합격은 <b>매 과목 40점 이상 + 전 과목 총득점 고득점순</b>(상대평가)이에요. 최근 합격선(평균 환산)은 제29회 59.5 → 제30회 60.0 → 제31회 64.5 → 제32회 65.0점이라 평균 70점을 목표로 잡는 게 안전해요. 최근 시험에서 과락은 제3·4과목(민사집행·상업등기·부동산등기·공탁)에 몰렸어요 — 절차법에 시간을 더 줘요. <a href="#/guide">합격 로드맵</a>에 제도·전략을 모아 뒀어요.</p>` : `<p class="faint" style="margin:8px 0 0">2차 합격은 <b>매 과목 40점 이상 + 총득점 고득점순 140명</b> — 평균 과락이 없어서 한 과목만 무너져도 떨어져요. 최근 과락은 형법·형사소송법 과목(제32회 42.9%)에 몰렸으니 2차 전용 과목을 먼저 깔아요. 답안은 쟁점 → 법리(조문·판례) → 적용 → 결론 틀로, 배점만큼 분량을 줘요. <a href="#/guide">합격 로드맵</a> 참고.</p>`}</div>
    ${aiCard(aiName() + ' 플래너', '내 회독 기록과 남은 날로 전략을 짜 줘요')}`;
  render(h);
  store.set('planStage', st);
  $('#psave').onclick = () => { const d = $('#pd').value; if (!d) return toast('날짜를 넣어 주세요'); prog.exams['@' + st] = {date: d, ts: Date.now()}; saveProg(); viewPlan(); toast('저장했어요'); };
  $('#pclear') && ($('#pclear').onclick = () => { prog.exams['@' + st] = {date: '', ts: Date.now()}; saveProg(); viewPlan(); });
  main_.querySelectorAll('[name=pt]').forEach(r => r.onchange = () => { setPref('planPasses', +r.value); viewPlan(); });
  main_.querySelectorAll('[name=pb]').forEach(r => r.onchange = () => { setPref('planBook', +r.value); viewPlan(); });
  main_.querySelectorAll('[name=pf]').forEach(r => r.onchange = () => { setPref('planBuffer', +r.value); viewPlan(); });
  const ctx = P.rows.map(r => `- ${r.s.name}(배점 ${r.w}): 기출 지문 ${r.N}개 중 ${r.p}회독 ${Math.round(r.ps.pct)}%, ★상습오답 ${r.stars}, 기본서 남은 ${r.rBook}단원, 최근 정답률 ${(() => { const h = passHistory(r.list), last = h[r.p] || h[r.p - 1]; return last ? Math.round(last.O / last.n * 100) + '%' : '기록 없음'; })()}`).join('\n');
  bindAi(`plan:${st}`, `너는 법무사 시험 합격생 출신 학습 코치다. 수험생의 제${st}차 시험(${P.date ? fmtLong(new Date(P.date)) + ', ' + ddayText(P.left) : '날짜 미정'}) 계획을 돕는다. 하루 기출 지문 ${P.oxDay}개, 기본서 ${P.bookDay}단원이 기계적으로 나눈 양이다.
합격 기준: 매 과목 40점 이상(과락 탈락) + 전 과목 총득점 고득점순 상대평가. 최근 1차 합격선(평균 환산)은 59.5→60.0→64.5→65.0점으로 오르는 추세라 평균 70점이 안전 목표다. 최근 1차 과락은 제3·4과목(민사집행·상업등기·비송, 부동산등기·공탁)에 집중됐다(응시자 과반 과락). 1차는 8월 말 토요일, 2차는 10월 말이라 1차 발표 뒤 2차까지 5주뿐이므로, 2차 전용 과목(형법·형사소송법)은 1차 전에 미리 깔아 두는 것이 동차 합격 수기들의 공통점이다.
아래 과목별 상황을 근거로 현실적인 조언을 한국어 마크다운으로 간결하게 한다. 과목 배점과 약한 과목을 고려한다.
${ctx}`, [['이번 주 계획', '이번 주 7일 계획을 요일별 표로 짜 줘. 과목 배분과 회독·복습·쉬는 시간까지.'], ['약한 과목 처방', '지금 기록에서 가장 위험한 과목 2개와 처방을 알려 줘.'], ['마무리 전략', '마무리 기간에 무엇을 어떤 순서로 볼지 알려 줘.'], ['하루 시간표', '하루 10시간 공부 기준 시간표를 짜 줘.']]);
}

// ── 출제 경향 ────────────────────────────────────────────────────────
async function loadTrend() { return state.trend ||= await readJSON('기출/경향.json').catch(() => ({subjects: {}})); }
function trendHtml(s, t) {
  if (!t) return `<div class="card muted">${esc(s.name)} 출제 경향은 기출을 넣고 PC 생성기가 해설·단원 분류를 하면 만들어져요.</div>`;
  const rows = Object.entries(t.byUnit || {}).sort((a, b) => b[1].n - a[1].n), max = Math.max(1, ...rows.map(([, v]) => v.n));
  return `<div class="card"><h2>${esc(s.name)} · 기출 ${t.n}문제 (${(t.rounds || []).length}회분)</h2>
    <table class="plan">${rows.map(([k, v]) => `<tr><td style="width:46%">${esc(v.title)}</td><td><div class="bar" style="margin:0"><i style="width:${v.n / max * 100}%"></i></div><span class="faint">${v.n}문제 · ${Object.entries(v.by).map(([e, n]) => `${esc(e.replace(/법무사 /, ''))} ${n}`).join(', ')}</span></td></tr>`).join('')}</table></div>
    ${t.text ? `<div class="card ai"><div class="ai-head"><div class="mark">${ic('spark', 18)}</div><b>Gemini 경향 분석</b></div><div class="md">${md(t.text)}</div>
      ${t.hot?.length ? `<div class="box emph"><h3>다음 시험에 나올 만한 것</h3><ul>${t.hot.map(x => `<li>${inline(x)}</li>`).join('')}</ul></div>` : ''}${t.next?.length ? `<div class="box"><h3>남은 기간에 할 일</h3><ul>${t.next.map(x => `<li>${inline(x)}</li>`).join('')}</ul></div>` : ''}</div>` : ''}`;
}
async function viewTrend() {
  frame('출제 경향', '#/gichul');
  const t = await loadTrend(), subs = allSubjects().filter(s => t.subjects?.[s.id]);
  render(`<section class="hero" style="margin-bottom:18px"><div class="eyebrow">출제 경향</div><h2 class="display">회차별 · 단원별</h2>
    <p class="lede">기출 문제를 단원으로 나눠 세고, Gemini가 흐름과 다음 시험 포인트를 짚어요. 최근 개정 조문도 함께 봐요.</p></section>
    ${subs.length ? subs.map(s => trendHtml(s, t.subjects[s.id])).join('') : '<div class="card muted">아직 경향을 만들 기출이 없어요. 기출 파일을 넣으면 PC 생성기가 만들어요.</div>'}`);
}
