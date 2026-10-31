'use strict';
// ── 홈 ──────────────────────────────────────────────────────────
function viewHome() {
  frame(APP);
  const idx = state.index || {}, now = Date.now(), subs = allSubjects();
  const evs = (idx.events || []).filter(e => !e.done && new Date(e.date) > now && new Date(e.date) - now < 14 * DAY).sort((a, b) => a.date < b.date ? -1 : 1);
  const exams = Object.entries(prog.exams).map(([sid, e]) => ({s: subjById(sid), ...e})).filter(e => e.s && e.date && ddays(e.date) >= 0).sort((a, b) => a.date < b.date ? -1 : 1);
  const last = store.get('last', null), lastS = last && subjById(last.sid), lastU = lastS?.units.find(u => u.id === last.uid);
  const mins = studyMinutes(todayKey()), goal = pref('goalMin', 120), streak = streakDays();
  const lib = store.get('homeLib', 'all'), libs = libsOf();
  const shown = subs.filter(s => lib === 'all' || s.lib === lib);
  let h = `<section class="hero"><div class="row" style="align-items:flex-end"><div class="grow"><div class="eyebrow">${fmtLong(new Date())}</div><h2 class="display">오늘의 공부</h2></div>
      <button class="btn noprint" data-go="#/search" aria-label="찾기">${ic('search', 18)}</button><button class="btn pri noprint" data-go="#/add">${ic('plus', 18, 2)}자료 넣기</button></div>
    <div class="stats">
      <div class="stat" style="cursor:pointer" data-go="#/focus"><b>${fmtMin(mins)}</b><span>오늘 공부 · 목표 ${fmtMin(goal)}</span><div class="bar" style="margin:8px 0 0"><i style="width:${Math.min(100, mins / goal * 100)}%;background:var(--pri)"></i></div></div>
      <div class="stat" style="cursor:pointer" data-go="#/stats"><b style="display:flex;align-items:center;gap:6px">${streak}<span style="color:var(--gold)">${ic('flame', 22)}</span></b><span>연속 공부한 날</span></div>
      <div class="stat" style="cursor:pointer" data-go="#/review"><b id="h-due">·</b><span>오늘 복습</span></div></div></section>`;
  if (!cfg.mode) h += `<div class="card callout" style="margin-top:16px"><div class="mark">${ic('link')}</div><div class="grow"><b>구글 드라이브를 연결하면</b><div class="faint">PC가 정리한 강의 자료를 받고, 폰·아이패드·노트북과 진도·필기가 맞춰져요</div></div><button class="btn sm" data-go="#/set">연결하기</button></div>`;
  if (state.offline) h += `<div class="card callout" style="margin-top:16px"><div class="mark">${ic('bolt')}</div><div class="grow muted">지금은 기기에 받아 둔 자료로 보여 주고 있어요.</div>${state.offline instanceof NeedAuth ? '<button class="btn sm" id="relogin">구글 다시 로그인</button>' : cfg.mode === 'local' ? '<button class="btn sm" id="regrant">폴더 다시 열기</button>' : ''}</div>`;
  const today = [`<div class="card callout"><div class="mark">${ic('cards')}</div><div class="grow"><b id="h-q">오늘 복습을 모으는 중…</b><div class="faint">간격 반복으로 잊을 때쯤 다시 보여 줘요</div></div><button class="btn pri" data-go="#/review">복습 시작</button></div>`];
  if (lastU) today.push(`<div class="card callout" style="cursor:pointer" data-go="#/s/${lastS.id}/u/${lastU.id}"><div class="mark">${ic('book')}</div><div class="grow"><div class="faint">이어 읽기 · ${esc(lastS.name)}</div><b>${esc(lastU.title)}</b></div>${ic('chev', 18)}</div>`);
  for (const e of exams.slice(0, 3)) today.push(`<div class="card callout gold" style="cursor:pointer" data-go="#/s/${e.s.id}/exam"><div class="mark">${ic('cal')}</div><div class="grow"><div class="faint">${fmtDate(new Date(e.date))} 시험</div><b>${esc(e.s.name)}</b></div><span class="dday" style="font-size:22px">${ddayText(ddays(e.date))}</span></div>`);
  if (!gemKey() && !store.get('gemHintOff')) today.push(`<div class="card callout gold"><div class="mark">${ic('spark')}</div><div class="grow"><b>Gemini를 켜 보세요</b><div class="faint">질문하기, 서술형 채점, 새 문제·카드, 사진·PDF 바로 정리</div></div><button class="btn gem sm" data-go="#/set">키 넣기</button><button class="btn ghost sm" id="gemoff" aria-label="닫기">${ic('x', 16)}</button></div>`);
  h += `<div class="sect">오늘</div>` + today.join('');
  h += `<div class="sect">서재</div>`;
  if (libs.length > 1) h += `<div class="seg noprint" style="margin-bottom:16px"><button class="${lib === 'all' ? 'on' : ''}" data-lib="all">전체</button>${libs.map(l => `<button class="${lib === l.id ? 'on' : ''}" data-lib="${esc(l.id)}">${esc(l.name)}</button>`).join('')}</div>`;
  h += shown.length ? `<div class="grid">${shown.map(subjCard).join('')}</div>`
    : `<div class="card muted">아직 과목이 없어요. '자료 넣기'로 PDF·사진·유튜브·글을 넣으면 과목이 생겨요.</div>`;
  if (evs.length) h += `<div class="sect">다가오는 마감 · 2주</div><div class="card" style="padding-top:8px;padding-bottom:8px"><ul class="list">${evs.map(e => `<li class="off" style="cursor:default"><span class="tag ${e.exam ? 'warn' : ''}" style="min-width:52px;justify-content:center">${ddayText(ddays(e.date))}</span><span class="grow"><span class="tt" style="color:var(--ink)">${esc(e.title)}</span><div class="faint">${esc(e.subject)}</div></span><span class="faint">${fmtDate(new Date(e.date))}</span></li>`).join('')}</ul></div>`;
  if (idx.updated) h += `<p class="faint" style="text-align:center;margin-top:28px">자료 ${esc(idx.updated.replace('T', ' ').slice(0, 16))} 기준</p>`;
  render(h);
  main_.querySelectorAll('[data-lib]').forEach(b => b.onclick = () => { store.set('homeLib', b.dataset.lib); viewHome(); });
  $('#relogin') && ($('#relogin').onclick = async () => { try { await GD.login(); boot(); } catch (e) { toast(e.message); } });
  $('#regrant') && ($('#regrant').onclick = async () => { if (await Local.ready(true)) boot(); });
  $('#gemoff') && ($('#gemoff').onclick = () => { store.set('gemHintOff', true); viewHome(); });
  (async () => {
    const [q, dq] = await Promise.all([todayQueue(), dueQuestions()]);
    const n = q.due.length + q.fresh.length + dq.length;
    if (!$('#h-due')) return;
    $('#h-due').textContent = n;
    $('#h-q').textContent = n ? `카드 ${q.due.length + q.fresh.length}장 · 다시 풀 문제 ${dq.length}개` : '오늘 복습을 다 했어요';
  })().catch(() => {});
}

function subjCard(s) {
  const st = subjStats(s), ex = prog.exams[s.id];
  const rc = s.units.filter(u => u.ready).map(u => readCount(u.id)), minR = rc.length ? Math.min(...rc) : 0;
  return `<div class="card subj" style="--h:${hue(s.id)}" data-go="#/s/${s.id}/book"><div class="nm"><span class="dot"></span>${esc(s.name)}</div>
    <div class="faint">${esc(s.libName || '')} · ${st.ready}/${st.total} 정리 · 읽음 ${st.read}</div>
    <div class="bar"><i style="width:${st.total ? st.read / st.total * 100 : 0}%"></i></div>
    <div class="tags">${minR ? `<span class="tag">${minR}회독</span>` : ''}${st.n ? `<span class="tag ok">정답률 ${Math.round(st.ok / st.n * 100)}%</span>` : ''}${st.wrong ? `<span class="tag bad">오답 ${st.wrong}</span>` : ''}${ex?.date && ddays(ex.date) >= 0 ? `<span class="tag warn">시험 ${ddayText(ddays(ex.date))}</span>` : ''}</div></div>`;
}
