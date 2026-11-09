'use strict';
// ── 시험 대비 ───────────────────────────────────────────────────
function examPlan(s, ex) {
  const range = s.units.filter(u => u.ready && (!ex.range || ex.range.includes(u.id)));
  const left = ddays(ex.date), unread = range.filter(u => !isRead(u.id));
  const studyDays = Math.max(1, left - 2), per = Math.ceil(unread.length / studyDays);
  const days = [];
  for (let d = 0; d <= Math.max(0, left); d++) {
    const date = new Date(dayStart(new Date()).getTime() + d * DAY), tasks = [];
    if (d < studyDays && left > 2) unread.slice(d * per, d * per + per).forEach(u => tasks.push({u}));
    if (left <= 2 || d >= studyDays) tasks.push({t: d === left ? '시험 당일 · 직전 요약만 훑기' : '모의고사 1회 · 오답 복습 · 직전 요약'});
    else if (d % 2 === 1 || !tasks.length) tasks.push({t: '오답 복습'});
    days.push({date, tasks});
  }
  return {range, left, unread, days};
}
function viewExam(s) {
  frame(s.name, '#/');
  const ex = prog.exams[s.id] || {};
  const hints = (state.index.events || []).filter(e => e.exam && e.subject === s.name && !e.done);
  let h = tabsHtml(s, 'exam');
  if (ex.date) {
    const p = examPlan(s, ex), todayT = p.days[0]?.tasks || [];
    h += `<div class="card"><div class="row" style="align-items:baseline;gap:14px"><span class="dday" style="font-size:40px">${ddayText(p.left)}</span><span class="grow muted">${fmtLong(new Date(ex.date))} · 범위 ${p.range.length}강 · 안 읽은 강의 ${p.unread.length}</span></div>
      <div class="sect" style="margin-top:18px">오늘 할 것</div><ul class="list">${todayT.map(t => t.u ? `<li data-go="#/s/${s.id}/u/${t.u.id}"><span class="${isRead(t.u.id) ? 'ok' : 'faint'}">${ic('check', 18, 2.2)}</span><span class="grow"><span class="tt">${esc(t.u.title)}</span><div class="faint">읽고 강의 문제 풀기</div></span><span class="chev">${ic('chev', 16)}</span></li>` : `<li class="off"><span class="faint">${ic('review', 18)}</span><span class="grow" style="color:var(--ink)">${esc(t.t)}</span></li>`).join('')}</ul>
      <div class="row noprint" style="margin-top:16px"><button class="btn pri" id="mock">모의고사 25문제</button><button class="btn gem" id="pred">${ic('spark', 18)}Gemini 예상 문제 15개</button><button class="btn" id="brief">시험 직전 요약</button><button class="btn" id="pbook">${ic('print', 18)}범위 기본서</button></div></div>
      ${aiCard(aiName() + ' 시험 코치', '범위 전체를 바탕으로 공부법과 질문에 답해요')}
      <div class="card"><h2>남은 날 계획</h2><table class="plan">${p.days.map((d, i) => `<tr class="${i ? '' : 'today'}"><td>${fmtDate(d.date)}</td><td>${d.tasks.map(t => t.u ? esc(t.u.title) : `<span class="muted">${esc(t.t)}</span>`).join('<br>')}</td></tr>`).join('')}</table></div>`;
  }
  h += `<div class="card"><h2>${ex.date ? '시험 정보 바꾸기' : '시험 정보'}</h2>
    <label class="field"><span>시험 날짜</span><div class="row"><input type="date" id="ed" value="${esc(ex.date || '')}">${hints.map(e => `<button class="btn sm" data-d="${e.date.slice(0, 10)}">${esc(e.title)} · ${fmtDate(new Date(e.date))}</button>`).join('')}</div></label>
    <div class="field"><span class="row"><span class="grow">시험 범위</span><button class="btn sm ghost" id="all">전체</button><button class="btn sm ghost" id="none">해제</button></span>${unitChecks(s, ex.range)}</div>
    <div class="row"><button class="btn pri" id="save">저장</button>${ex.date ? '<button class="btn ghost" id="clear">시험 지우기</button>' : ''}</div></div>`;
  render(h);
  bindAllNone();
  main_.querySelectorAll('[data-d]').forEach(b => b.onclick = () => $('#ed').value = b.dataset.d);
  $('#save').onclick = () => {
    const date = $('#ed').value, range = checked(main_);
    if (!date) return toast('시험 날짜를 넣어 주세요');
    prog.exams[s.id] = {date, range: range.length === s.units.filter(u => u.ready).length ? null : range, ts: Date.now()};
    saveProg(); viewExam(s); scrollTo(0, 0); toast('저장했어요');
  };
  $('#clear') && ($('#clear').onclick = () => { prog.exams[s.id] = {date: '', ts: Date.now()}; saveProg(); viewExam(s); });
  if (!ex.date) return;
  const p = examPlan(s, ex), ids = p.range.map(u => u.id);
  $('#mock').onclick = async () => {
    const pool = await poolOf(s, ids, {summary: true});
    startQuiz([...shuffle(pick(pool.filter(q => q.type !== 'short'), 22, true)), ...pick(pool.filter(q => q.type === 'short'), 3, true)], s.name + ' 모의고사', `#/s/${s.id}/exam`);
  };
  $('#pred').onclick = async () => {
    if (!aiOn()) { location.hash = '#/set'; return toast('설정에서 AI를 켜 주세요'); }
    busy($('#pred'), 'Gemini가 출제하는 중…');
    try { const qs = await makeQuestions(s, p.range, {n: 15, exam: true}); startQuiz(qs, s.name + ' · 예상 문제', `#/s/${s.id}/exam`); }
    catch (e) { toast(e.message); unbusy($('#pred')); }
  };
  $('#brief').onclick = () => viewBrief(s, ids);
  $('#pbook').onclick = () => viewPrint(s, ids, s.name + ' 시험 범위 기본서');
  (async () => {
    const ctx = [];
    for (const u of p.range) { try { const d = await loadUnit(s, u); ctx.push(`## ${u.title}\n${(d.points || []).join('\n')}${d.emphasis?.length ? '\n교수 강조: ' + d.emphasis.join(' / ') : ''}`); } catch {} }
    const st = subjStats(s);
    bindAi(`exam:${s.id}`, `너는 '${s.name}' 과목 시험을 앞둔 대학생의 공부 코치다. 시험은 ${fmtLong(new Date(ex.date))}(${ddayText(p.left)}), 범위는 아래 강의들이다. 지금까지 정답률 ${st.n ? Math.round(st.ok / st.n * 100) + '%' : '기록 없음'}, 오답 ${st.wrong}개, 안 읽은 강의 ${p.unread.length}개.
범위 자료를 근거로 한국어 마크다운으로 간결하게 답한다. 범위에 없는 내용은 그렇다고 밝힌다.

${ctx.join('\n\n').slice(0, 60000)}`, [
      ['남은 기간 전략', '남은 기간과 내 상황에 맞춰 공부 전략을 짜 줘.'],
      ['서술형 대비', '서술형으로 나올 만한 주제 5개와 각각의 답안 뼈대(서론-본론-결론 핵심어)를 만들어 줘.'],
      ['헷갈리는 개념 비교', '범위에서 헷갈리기 쉬운 개념 쌍을 골라 비교표로 정리해 줘.'],
      ['10분 총정리', '시험장 들어가기 전 10분 동안 볼 총정리를 만들어 줘.'],
    ]);
  })();
}
async function viewBrief(s, ids) {
  frame(s.name + ' 직전 요약', `#/s/${s.id}/exam`);
  render(`<div class="narrow card">${thinking('모으는 중…')}</div>`);
  let h = `<section class="hero noprint" style="margin-bottom:20px"><div class="eyebrow">시험 직전</div><h2 class="display">${esc(s.name)} 한눈에 보기</h2></section>`;
  const sm = await loadSummary(s);
  if (sm?.top?.length) h += `<div class="card"><div class="box emph" style="margin:0"><h3>시험에 나올 핵심</h3><ol>${sm.top.map(x => `<li>${inline(x)}</li>`).join('')}</ol></div></div>`;
  for (const u of s.units.filter(u => u.ready && ids.includes(u.id))) {
    try {
      const d = await loadUnit(s, u);
      h += `<div class="card md"><h3 style="margin-top:0;font-family:var(--serif)">${esc(u.title)}</h3>${d.emphasis?.length ? `<div class="box emph"><ul>${d.emphasis.map(x => `<li>${inline(x)}</li>`).join('')}</ul></div>` : ''}<ul>${(d.points || []).map(x => `<li>${inline(x)}</li>`).join('')}</ul><p class="faint">${(d.terms || []).map(t => `<b>${esc(t.t)}</b> ${esc(t.d)}`).join(' · ')}</p></div>`;
    } catch {}
  }
  render(`<div class="narrow"><div class="row noprint" style="margin-bottom:12px"><button class="btn pri" onclick="print()">${ic('print', 18)}인쇄·PDF</button></div>${h}</div>`);
}
