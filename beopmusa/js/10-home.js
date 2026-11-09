'use strict';
// ── 홈 ──────────────────────────────────────────────────────────
async function viewHome() {
  if (!state.site) await loadSite();
  frame(APP);
  const idx = state.index || {}, subs = allSubjects();
  const last = store.get('last', null), lastS = last && subjById(last.sid), lastU = lastS?.units.find(u => u.id === last.uid);
  const mins = studyMinutes(todayKey()), goal = pref('goalMin', 480), streak = streakDays();
  const st = nextStage(), ex = stageExam(st);
  let h = `<section class="hero"><div class="row" style="align-items:flex-end"><div class="grow"><div class="eyebrow">${fmtLong(new Date())}</div><h2 class="display">오늘의 회독</h2></div>
      <button class="btn noprint" data-go="#/search" aria-label="찾기">${ic('search', 18)}</button><button class="btn pri noprint" data-go="#/add">${ic('plus', 18, 2)}자료 넣기</button></div>
    <div class="stats">
      <div class="stat" style="cursor:pointer" data-go="#/plan"><b class="dday">${ex ? ddayText(ddays(ex)) : 'D-?'}</b><span>제${st}차 시험${ex ? ' · ' + fmtDate(new Date(ex)) + (examNote(st).includes('예상') ? ' (예상)' : '') : ' · 날짜 넣기'}</span></div>
      <div class="stat" style="cursor:pointer" data-go="#/focus"><b>${fmtMin(mins)}</b><span>오늘 공부 · 목표 ${fmtMin(goal)}</span><div class="bar" style="margin:8px 0 0"><i style="width:${Math.min(100, mins / goal * 100)}%;background:var(--pri)"></i></div></div>
      <div class="stat" style="cursor:pointer" data-go="#/stats"><b style="display:flex;align-items:center;gap:6px">${streak}<span style="color:var(--gold)">${ic('flame', 22)}</span></b><span>연속 공부한 날</span></div>
      <div class="stat" style="cursor:pointer" data-go="#/review"><b id="h-due">·</b><span>오늘 복습</span></div></div></section>`;
  if (!cfg.mode) h += `<div class="card callout" style="margin-top:16px"><div class="mark">${ic('link')}</div><div class="grow"><b>구글 드라이브를 연결하면</b><div class="faint">PC가 정리한 기본서·기출을 받고, 폰·아이패드·노트북과 회독·필기가 맞춰져요</div></div><button class="btn sm" data-go="#/set">연결하기</button></div>`;
  if (state.offline) h += `<div class="card callout" style="margin-top:16px"><div class="mark">${ic('bolt')}</div><div class="grow muted">지금은 기기에 받아 둔 자료로 보여 주고 있어요.</div>${state.offline instanceof NeedAuth ? '<button class="btn sm" id="relogin">구글 다시 로그인</button>' : cfg.mode === 'local' ? '<button class="btn sm" id="regrant">폴더 다시 열기</button>' : ''}</div>`;
  h += `<div class="sect">오늘</div><div id="h-plan"></div><div id="h-quest"></div><div id="h-law"></div>
    <div class="card callout"><div class="mark">${ic('cards')}</div><div class="grow"><b id="h-q">오늘 복습을 모으는 중…</b><div class="faint">조문 빈칸·판례 카드와 때가 된 기출 지문 · 잊을 때쯤 다시</div></div><button class="btn pri" data-go="#/review">복습 시작</button></div>`;
  if (lastU) h += `<div class="card callout" style="cursor:pointer" data-go="#/s/${lastS.id}/u/${lastU.id}"><div class="mark">${ic('book')}</div><div class="grow"><div class="faint">이어 읽기 · ${esc(lastS.name)}</div><b>${esc(lastU.title)}</b></div>${ic('chev', 18)}</div>`;
  if (!aiOn() && !store.get('gemHintOff')) h += `<div class="card callout gold"><div class="mark">${ic('spark')}</div><div class="grow"><b>AI를 켜 보세요</b><div class="faint">지문 해설·2차 채점·튜터 — Gemini·Groq 무료 한도, Ollama 공짜, Claude 유료</div></div><button class="btn gem sm" data-go="#/set">키 넣기</button><button class="btn ghost sm" id="gemoff" aria-label="닫기">${ic('x', 16)}</button></div>`;
  for (const stg of [1, 2]) {
    const ss = subs.filter(s => (s.stage || [1, 2]).includes(stg));
    if (!ss.length) continue;
    h += `<div class="sect">제${stg}차 과목</div><div class="grid">${ss.map(subjCard).join('')}</div>`;
  }
  if (!subs.length) h += `<div class="card muted" style="margin-top:16px">아직 과목이 없어요. PC에서 생성기를 한 번 돌리거나 드라이브를 연결해 주세요.</div>`;
  h += `<div class="row" style="margin-top:20px"><button class="btn" data-go="#/gichul">${ic('flag', 18)}기출 회독</button><button class="btn" data-go="#/laws">${ic('scale', 18)}법령 개정</button><button class="btn" data-go="#/cases">${ic('gavel', 18)}최신 판례</button><button class="btn" data-go="#/trend">${ic('chart', 18)}출제 경향</button><button class="btn" data-go="#/plan">${ic('cal', 18)}D-day 계획</button></div>`;
  if (idx.updated) h += `<p class="faint" style="text-align:center;margin-top:28px">자료 ${esc(idx.updated.replace('T', ' ').slice(0, 16))} 기준</p>`;
  render(h);
  $('#relogin') && ($('#relogin').onclick = async () => { try { await GD.login(); boot(); } catch (e) { toast(e.message); } });
  $('#regrant') && ($('#regrant').onclick = async () => { if (await Local.ready(true)) boot(); });
  $('#gemoff') && ($('#gemoff').onclick = () => { store.set('gemHintOff', true); viewHome(); });
  (async () => {
    const [q, dq, dox] = await Promise.all([todayQueue(), dueQuestions(), dueOx()]);
    const n = q.due.length + q.fresh.length + dq.length + dox.length;
    if (!$('#h-due')) return;
    $('#h-due').textContent = n;
    $('#h-q').textContent = n ? `카드 ${q.due.length + q.fresh.length}장 · 지문 ${dox.length}개 · 문제 ${dq.length}개` : '오늘 복습을 다 했어요';
  })().catch(() => {});
  (async () => {
    const ups = await unseenUpdates();
    if (ups.length && $('#h-law')) { $('#h-law').innerHTML = `<div class="card callout gold" style="cursor:pointer" data-go="#/laws"><div class="mark">${ic('scale')}</div><div class="grow"><b>법령 개정 ${ups.length}건</b><div class="faint">${esc(ups.slice(0, 3).map(u => `${u.name} ${u.date}`).join(' · '))}</div></div>${ic('chev', 18)}</div>`; bindGo($('#h-law')); }
    const P = await planOf(st);
    if (!$('#h-plan')) return;
    const top = P.rows.filter(r => r.oxToday || r.bookToday).sort((a, b) => b.oxToday - a.oxToday).slice(0, 3);
    // 오늘의 퀘스트 (듀오링고식 작은 목표 3개): 양이 아니라 그날 할 몫을 눈에 보이게
    if ($('#h-quest')) {
      const t0 = dayStart(new Date()).getTime();
      const cN = rlog.filter(r => r[1] * 1000 >= t0 && String(r[0]).startsWith('c:')).length;
      const xN = rlog.filter(r => r[1] * 1000 >= t0 && isOxId(String(r[0]))).length;
      const qs = [
        ['카드 복습', cN, Math.max(10, Math.min(60, pref('newPerDay', 20) + 10)), '장', '#/review'],
        ['기출 지문', xN, Math.max(10, Math.min(120, P.oxDay || 30)), '개', '#/gichul'],
        ['집중 공부', mins, goal, '분', '#/focus'],
      ];
      const doneAll = qs.every(([, v, g]) => v >= g);
      $('#h-quest').innerHTML = `<div class="card" style="padding-top:14px;padding-bottom:10px"><div class="row" style="margin-bottom:4px"><b class="grow">오늘의 퀘스트</b>${doneAll ? '<span class="tag ok">오늘 몫 끝!</span>' : ''}</div>
        ${qs.map(([t, v, g, u, go]) => `<div class="row" style="padding:7px 0;cursor:pointer" data-go="${go}"><span style="color:${v >= g ? 'var(--ok, #2b7650)' : 'var(--line)'}">${ic('check', 19, 2.4)}</span><span class="grow">${t}</span><div class="bar" style="width:90px;margin:0 10px 0 0"><i style="width:${Math.min(100, v / g * 100)}%"></i></div><span class="faint">${v >= g ? g : v} / ${g}${u}</span></div>`).join('')}</div>`;
      bindGo($('#h-quest'));
    }
    $('#h-plan').innerHTML = `<div class="card callout" style="cursor:pointer" data-go="#/plan"><div class="mark">${ic('cal')}</div><div class="grow"><b>${P.date ? `하루 기출 지문 ${P.oxDay}개 · 기본서 ${P.bookDay}단원` : '시험 날짜를 넣으면 하루 할 양을 나눠 줘요'}</b><div class="faint">${esc(top.map(r => `${r.s.name} ${r.oxToday ? '지문 ' + r.oxToday : ''}${r.bookToday ? ' 단원 ' + r.bookToday : ''}`).join(' · ') || 'D-day 역산 계획')}</div></div>${ic('chev', 18)}</div>`;
    bindGo($('#h-plan'));
  })().catch(() => {});
}

function subjCard(s) {
  const st = subjStats(s);
  const rc = s.units.filter(u => u.ready).map(u => readCount(u.id)), minR = rc.length ? Math.min(...rc) : 0;
  const p = passOf(s.id), rev = s.units.some(u => u.revised);
  return `<div class="card subj" style="--h:${hue(sha6(s.id))}" data-go="#/s/${s.id}/book"><div class="nm"><span class="dot"></span>${esc(s.name)}</div>
    <div class="faint">${st.ready}/${st.total} 단원 정리 · 읽음 ${st.read}</div>
    <div class="bar"><i style="width:${st.total ? st.read / st.total * 100 : 0}%"></i></div>
    <div class="tags"><span class="tag">기출 ${p}회독</span>${minR ? `<span class="tag">기본서 ${minR}회독</span>` : ''}${st.n ? `<span class="tag ok">정답률 ${Math.round(st.ok / st.n * 100)}%</span>` : ''}${st.wrong ? `<span class="tag bad">오답 ${st.wrong}</span>` : ''}${rev ? '<span class="tag warn">개정</span>' : ''}</div></div>`;
}
