'use strict';
// ── 오늘 복습 · 카드 ─────────────────────────────────────────────
async function viewReview() {
  frame('복습');
  const head = `<section class="hero" style="margin-bottom:22px"><div class="eyebrow">복습</div><h2 class="display">오늘 복습</h2>
    <p class="lede">잊어 갈 때쯤 다시 보여 줘요. 읽은 단원의 조문 빈칸·판례·용어 카드가 하루 ${pref('newPerDay', 20)}장씩 새로 들어오고, 때가 된 기출 지문도 함께 나와요.</p></section>`;
  render(head + `<div class="card">${thinking('모으는 중…')}</div>`);
  const [q, dq, wrong, dox] = await Promise.all([todayQueue(), dueQuestions(), wrongList(allSubjects()), dueOx()]);
  const cards = [...q.due, ...q.fresh], mins = Math.max(1, Math.round(cards.length * .15 + dq.length * .7 + dox.length * .25));
  let h = head + `<div class="stats" style="margin:0 0 18px"><div class="stat"><b>${q.due.length}</b><span>다시 볼 카드</span></div><div class="stat"><b>${q.fresh.length}</b><span>${q.stopNew ? '새 카드 · 시험 2주 전이라 멈췄어요' : `새 카드 (남은 ${q.freshTotal})`}</span></div><div class="stat"><b>${dox.length}</b><span>다시 볼 기출 지문</span></div><div class="stat"><b>${dq.length}</b><span>다시 풀 문제</span></div></div>`;
  if (dox.length) h += `<div class="card callout"><div class="mark">${ic('flag')}</div><div class="grow"><b>기출 지문 ${dox.length}개</b><div class="faint">잊을 때가 된 지문 · 회독 기록과 따로 세요</div></div><button class="btn" id="rv-ox">지문 OX</button></div>`;
  h += cards.length || dq.length ? `<div class="card callout"><div class="mark">${ic('cards')}</div><div class="grow"><b>한 번에 끝내기</b><div class="faint">카드 ${cards.length}장 → 문제 ${dq.length}개 · 약 ${mins}분</div></div><button class="btn pri" id="rv-all">시작</button></div>`
    : `<div class="card callout"><div class="mark">${ic('check')}</div><div class="grow"><b>오늘 복습을 다 했어요</b><div class="faint">새 단원을 읽으면 그 단원의 카드가 내일부터 들어와요</div></div></div>`;
  h += `<div class="row" style="margin-bottom:8px">${cards.length ? `<button class="btn" id="rv-cards">${ic('cards', 18)}카드만 ${cards.length}</button>` : ''}${dq.length ? `<button class="btn" id="rv-q">문제만 ${dq.length}</button>` : ''}${cards.length || dox.length || dq.some(x => x.type === 'ox') ? `<button class="btn" id="rv-listen">${ic('sound', 18)}듣기로 복습</button>` : ''}<button class="btn ghost" id="rv-more">새 카드 10장 더</button></div>`;
  const leech = wrong.filter(x => isLeech(x.id));
  if (wrong.length) h += `<div class="sect">틀린 문제 ${wrong.length}</div><div class="row" style="margin-bottom:14px"><button class="btn" id="rw">다시 풀기</button>${leech.length ? `<button class="btn" id="rleech">★ 상습 오답만 ${leech.length}</button>` : ''}<button class="btn gem" id="weak">${ic('spark', 18)}${aiName()} 약점 분석</button></div><div id="weakout"></div>
    <div class="card" style="padding-top:6px;padding-bottom:6px"><ul class="list">${wrong.slice(0, 40).map(x => `<li class="off" style="cursor:default;align-items:flex-start"><span class="tag bad" style="margin-top:3px">${isLeech(x.id) ? '★ ' : ''}${prog.q[x.id].wrong}회</span><span class="grow"><span class="tt" style="color:var(--ink)">${esc(x.q.length > 110 ? x.q.slice(0, 110) + '…' : x.q)}</span><div class="faint">${esc(subjById(x.sid)?.name)} · ${esc(x.from)}</div></span></li>`).join('')}</ul></div>`;
  render(h);
  $('#rv-all') && ($('#rv-all').onclick = () => startCards(cards, '오늘 복습', '#/review', dq));
  $('#rv-cards') && ($('#rv-cards').onclick = () => startCards(cards, '카드 복습', '#/review'));
  $('#rv-q') && ($('#rv-q').onclick = () => startQuiz(interleave(dq), '다시 풀 문제', '#/review'));
  $('#rv-ox') && ($('#rv-ox').onclick = () => startOx(interleave(dox), '기출 지문 복습', '#/review', 0));
  // 듣기로 복습: 기출 지문 → 정답·해설, 카드는 앞면 → 뒷면, OX 문제는 지문 → 정답. 이동하면서. 지문은 걸린 시간을 모르니 '알맞음'(12초)으로 남긴다
  $('#rv-listen') && ($('#rv-listen').onclick = () => startListen([
    ...interleave(dox).map(j => ({kind: 'ox', ask: j.t, v: j.v, e: j.e || store.get('oxe.' + j.id, ''), from: examLabel(j.ex, j.qq), sid: j.sid, j})),
    ...cards.map(c => ({kind: 'card', ask: c.f, answer: c.full && c.kind !== '판례' ? c.full : c.b, from: c.from, sid: c.sid, c})),
    ...interleave(dq.filter(x => x.type === 'ox')).map(q => ({kind: 'ox', ask: q.q, v: !!q.a, e: q.e, from: q.from, sid: q.sid, q}))],
    '듣기 복습', '#/review', (it, ok) => { if (it.j) oxRecord(it.j, ok ? 'O' : 'X', 12000, 0); else if (it.c) { srsReview(it.c.id, ok ? 3 : 1); saveProg(); logActivity(); } else record(it.q.id, ok); }));
  $('#rleech') && ($('#rleech').onclick = () => startQuiz(shuffle(leech), '상습 오답', '#/review'));
  $('#rv-more').onclick = () => { if (q.stopNew) return toast('시험 2주 전이라 새 카드를 멈췄어요 · 설정에서 끌 수 있어요'); setPref('newPerDay', pref('newPerDay', 20) + 10); viewReview(); };
  $('#rw') && ($('#rw').onclick = () => startQuiz(shuffle(wrong).slice(0, 30), '오답 복습', '#/review'));
  $('#weak') && ($('#weak').onclick = () => weakAnalysis($('#weak'), wrong));
}

// 카드 넘기기: 앞면 → (눌러서) 뒷면 → 다시·어려움·알맞음·쉬움. 문제가 이어지면 카드 뒤에 문제를 푼다.
function startCards(cards, title, back, thenQuestions) {
  if (!cards.length) return thenQuestions?.length ? startQuiz(interleave(thenQuestions), title, back) : toast('볼 카드가 없어요');
  state.cards = {list: cards.slice(), i: 0, done: 0, again: 0, title, back, then: thenQuestions};
  if (location.hash === '#/cards') viewCards(); else location.hash = '#/cards';
}
function viewCards() {
  const z = state.cards;
  if (!z) return location.replace('#/review');
  frame(z.title, z.back);
  if (z.i >= z.list.length) {
    if (z.then?.length) { const t = z.then; z.then = null; return startQuiz(interleave(t), z.title + ' · 문제', z.back); }
    render(`<div class="qwrap"><div class="card" style="text-align:center;padding:34px 24px"><div class="eyebrow">끝</div><h2 class="display">카드 ${z.done}장 복습</h2>
      <p class="muted">${z.again ? `${z.again}장은 10분 뒤에 다시 나와요.` : '모두 기억했어요.'}</p><div class="row" style="justify-content:center;margin-top:12px"><button class="btn pri" data-go="${z.back}">돌아가기</button></div></div></div>`);
    return;
  }
  const c = z.list[z.i], pv = srsPreview(c.id), isNew = !prog.srs[c.id];
  render(`<div class="qwrap"><div class="qtop"><span class="cnt">${pad2(z.i + 1)} <span class="faint">/ ${z.list.length}</span></span><span class="grow faint">${esc(subjById(c.sid)?.name || '')} · ${esc(c.from)}</span>${isLeech(c.id) ? '<span class="tag bad">★ 상습</span>' : ''}<span class="tag ${isNew ? 'warn' : ''}">${isNew ? '새 카드' : c.kind}</span></div>
    <div class="prog"><i style="width:${z.i / z.list.length * 100}%"></i></div>
    <div class="card flash" id="flash"><div class="q" style="margin:0;white-space:pre-line">${esc(c.f)}</div><div id="cback" hidden><hr style="border:0;height:1px;background:var(--line);margin:18px 0"><div class="md" style="font-size:16.5px">${c.blanks ? c.blanks.reduce((h, b) => h.split(esc(b)).join(`<b class="star">${esc(b)}</b>`), esc(c.full)).replace(/\n/g, '<br>') : inline(c.kind === '빈칸' ? c.full.replace(c.b, '**' + c.b + '**') : c.b)}</div></div>
      <p class="faint" id="tap" style="margin:18px 0 0">눌러서 뒷면 보기 · Space</p></div>
    <div class="grades" id="grades" hidden>${['다시', '어려움', '알맞음', '쉬움'].map((t, i) => `<button class="btn ${i === 2 ? 'pri' : ''}" data-g="${i + 1}"><b>${t}</b><span>${pv[i]}</span></button>`).join('')}</div>
    <div class="row noprint" style="margin-top:12px"><button class="btn ghost sm" id="c-tts">${ic('sound', 16)}읽어 주기</button><span class="grow"></span><button class="btn ghost sm" id="c-skip">건너뛰기</button></div></div>`);
  const flip = () => { if (!$('#cback').hidden) return; $('#cback').hidden = false; $('#tap').hidden = true; $('#grades').hidden = false; };
  $('#flash').onclick = flip;
  const grade = g => {
    srsReview(c.id, g); saveProg(); logActivity();
    z.done++;
    if (g === 1) { z.again++; z.list.push(c); }   // 다시: 이번 판 끝에 한 번 더
    z.i++; viewCards();
  };
  main_.querySelectorAll('[data-g]').forEach(b => b.onclick = () => grade(+b.dataset.g));
  $('#c-skip').onclick = () => { z.i++; viewCards(); };
  $('#c-tts').onclick = () => speak($('#cback').hidden ? c.f : `${c.f}. ${c.kind === '빈칸' ? c.b : c.b}`);
  state.keys = e => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); $('#cback').hidden ? flip() : grade(3); }
    else if (!$('#cback').hidden && /^[1-4]$/.test(e.key)) grade(+e.key);
  };
}
addEventListener('keydown', e => { if (!e.target.matches?.('input,textarea') && location.hash === '#/cards') state.keys?.(e); });

// ── 과목의 카드 탭 ───────────────────────────────────────────────
async function viewDeck(s) {
  frame(s.name, '#/');
  render(tabsHtml(s, 'cards') + `<div class="card">${thinking('카드를 모으는 중…')}</div>`);
  const deck = await deckOf(s), now = Date.now();
  const st = {new: 0, learn: 0, due: 0, later: 0};
  for (const c of deck) { const r = prog.srs[c.id]; if (!r) st.new++; else if (r.due <= endOfToday()) st.due++; else if (r.s < 21) st.learn++; else st.later++; }
  const byUnit = new Map();
  for (const c of deck) (byUnit.get(c.uid || '') || byUnit.set(c.uid || '', []).get(c.uid || '')).push(c);
  render(tabsHtml(s, 'cards') + `<div class="stats" style="margin:0 0 16px"><div class="stat"><b>${st.due}</b><span>오늘 볼 카드</span></div><div class="stat"><b>${st.new}</b><span>아직 안 본 카드</span></div><div class="stat"><b>${st.learn + st.later}</b><span>익히는 중 · 외움 ${st.later}</span></div></div>
    <div class="row" style="margin-bottom:16px"><button class="btn pri" id="d-due">오늘 카드 ${st.due}</button><button class="btn" id="d-all">전부 넘겨 보기 ${deck.length}</button><button class="btn" id="d-add">${ic('plus', 18)}카드 만들기</button><button class="btn gem" id="d-gem">${ic('spark', 18)}Gemini 카드 15장</button></div>
    <div id="d-form"></div>
    ${[...byUnit].map(([uid, cs]) => { const u = s.units.find(x => x.id === uid); return `<div class="card" style="padding-top:12px;padding-bottom:12px"><div class="row"><b class="grow">${esc(u?.title || '내 카드')}</b><span class="faint">${cs.length}장</span><button class="btn sm ghost" data-unit="${esc(uid)}">이것만</button></div>
      <ul class="list">${cs.slice(0, 6).map(c => `<li class="off" style="cursor:default;padding:9px 2px"><span class="tag ${prog.srs[c.id] ? '' : 'warn'}">${prog.srs[c.id] ? c.kind : '새'}</span><span class="grow" style="color:var(--ink)">${esc(c.f.length > 70 ? c.f.slice(0, 70) + '…' : c.f)}</span></li>`).join('')}${cs.length > 6 ? `<li class="off faint" style="cursor:default;padding:8px 2px">… ${cs.length - 6}장 더</li>` : ''}</ul></div>`; }).join('')}`);
  $('#d-due').onclick = () => startCards(deck.filter(c => prog.srs[c.id] && isDue(c.id)), s.name + ' 카드', `#/s/${s.id}/cards`);
  $('#d-all').onclick = () => startCards(shuffle(deck), s.name + ' 카드 전부', `#/s/${s.id}/cards`);
  main_.querySelectorAll('[data-unit]').forEach(b => b.onclick = () => startCards(shuffle(byUnit.get(b.dataset.unit)), s.name + ' 카드', `#/s/${s.id}/cards`));
  $('#d-add').onclick = () => cardForm(s, null, () => viewDeck(s));
  $('#d-gem').onclick = async () => {
    if (!aiOn()) { location.hash = '#/set'; return toast('설정에서 AI를 켜 주세요'); }
    busy($('#d-gem'), 'Gemini가 카드를 만드는 중…');
    try { const n = await gemCards(s, s.units.filter(u => u.ready && (isRead(u.id) || !s.units.some(x => isRead(x.id))))); toast(`카드 ${n}장을 만들었어요`); viewDeck(s); }
    catch (e) { toast(e.message); unbusy($('#d-gem')); }
  };
}
function cardForm(s, uid, done) {
  $('#d-form').innerHTML = `<div class="card"><label class="field"><span>앞면 (질문)</span><textarea id="cf-f" style="min-height:70px"></textarea></label><label class="field"><span>뒷면 (답)</span><textarea id="cf-b" style="min-height:70px"></textarea></label><div class="row"><button class="btn pri" id="cf-save">저장</button><button class="btn ghost" id="cf-x">닫기</button></div></div>`;
  $('#cf-f').focus();
  $('#cf-x').onclick = () => $('#d-form').innerHTML = '';
  $('#cf-save').onclick = () => {
    const f = $('#cf-f').value.trim(), b = $('#cf-b').value.trim();
    if (!f || !b) return toast('앞뒤를 모두 써 주세요');
    addCards(s, [{f, b, uid}]); toast('카드를 만들었어요'); done();
  };
}
function addCards(s, list, by) {
  const t = Date.now();
  (prog.cards[s.id] ||= []).push(...list.map((c, i) => ({...c, cid: t.toString(36) + '_' + i, t, uid: c.uid || null, by})));
  saveProg();
}
// 읽다가 글을 고르면 '빈칸 카드' 단추가 뜬다. 고른 말을 가린 그 문장이 카드가 된다(RemNote·MarginNote 처럼 한 번에).
function selCard(box, s, uid) {
  document.querySelectorAll('.selcard').forEach(b => b.remove());
  const btn = document.createElement('button');
  btn.className = 'btn sm pri selcard noprint'; btn.hidden = true; btn.innerHTML = `${ic('cards', 16)}빈칸 카드`;
  document.body.append(btn);
  let pick = null;
  const hide = () => { btn.hidden = true; pick = null; };
  const check = () => {
    if (!box.isConnected) { btn.remove(); document.removeEventListener('selectionchange', onSel); removeEventListener('scroll', onSel); return; }
    const sel = getSelection(), word = sel.toString().replace(/\s+/g, ' ').replace(/^[\s:;,.·•\-–—"'“”‘’()（）[\]]+|[\s:;,.·•\-–—"'“”‘’()（）[\]]+$/g, '');   // 앞뒤 문장부호는 빼고
    if (sel.isCollapsed || !sel.rangeCount || word.length < 2 || word.length > 60 || !box.contains(sel.anchorNode) || !box.contains(sel.focusNode)) return hide();
    const r = sel.getRangeAt(0), block = (r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentElement).closest('li,p,td,th,h2,h3,h4,blockquote,.box') || box;
    const text = block.innerText.replace(/\s+/g, ' ').trim(), at = text.indexOf(word);
    if (at < 0) return hide();
    // 고른 말이 든 한 문장(길면 앞뒤 120자)
    let a = 0;
    for (const m of text.slice(0, at).matchAll(/[.?!。]\s/g)) a = m.index + 2;
    let e = text.slice(at + word.length).search(/[.?!。](\s|$)/);
    e = e < 0 ? text.length : at + word.length + e + 1;
    const from = Math.max(a, at - 120), to = Math.min(e, at + word.length + 120), full = text.slice(from, to).trim();
    pick = {word, full};
    const rc = r.getBoundingClientRect();
    btn.style.top = Math.min(innerHeight - 56, rc.bottom + 10) + 'px';   // 아이패드는 글 위에 복사 메뉴가 떠서 아래에 둔다
    btn.style.left = Math.max(12, Math.min(innerWidth - 140, rc.left + rc.width / 2 - 60)) + 'px';
    btn.hidden = false;
  };
  let tm;
  const onSel = () => { clearTimeout(tm); tm = setTimeout(check, 250); };
  document.addEventListener('selectionchange', onSel); addEventListener('scroll', onSel, {passive: true});
  btn.addEventListener('pointerdown', e => e.preventDefault());   // 단추를 눌러도 고른 글이 풀리지 않게
  btn.onclick = () => {
    if (!pick) return;
    const f = pick.full.replace(pick.word, '［　？　］');
    if ((prog.cards[s.id] || []).some(c => c.f === f)) { toast('이미 만든 카드예요'); return hide(); }
    addCards(s, [{f, b: pick.word, full: pick.full, uid}]);
    getSelection().removeAllRanges(); hide();
    toast('빈칸 카드를 만들었어요 · 오늘 복습에 먼저 나와요');
  };
}
const CARD_S = obj({cards: arr(obj({f: S_, b: S_, uid: S_}))});
async function gemCards(s, units) {
  const ctx = [];
  for (const u of units.slice(0, 25)) { try { const d = await loadUnit(s, u); ctx.push(`## [${u.id}] ${u.title}\n${(d.points || []).join('\n')}\n${(d.emphasis || []).join('\n')}\n용어: ${(d.terms || []).map(t => t.t).join(', ')}`); } catch {} }
  const have = (prog.cards[s.id] || []).map(c => c.f.slice(0, 40)).join(' / ');
  const d = await gem(`'${s.name}' 과목의 암기 카드 15장을 만든다. 아래 단원 핵심에서 법무사 시험에 나올 조문 요건·기간·주체·판례 결론을 골라, 앞면은 짧은 질문(빈칸이면 '［ ？ ］'), 뒷면은 한두 문장 답으로. uid 는 그 내용이 나온 단원의 [id] 값.
이미 있는 카드와 겹치지 않게: ${have}
${ctx.join('\n\n').slice(0, 50000)}`, {schema: CARD_S, temp: .6});
  const ids = new Set(s.units.map(u => u.id));
  const list = (d.cards || []).filter(c => c.f && c.b).map(c => ({...c, uid: ids.has(c.uid) ? c.uid : null}));
  addCards(s, list, 'gem');
  return list.length;
}
async function weakAnalysis(btn, qs) {
  if (!aiOn()) { location.hash = '#/set'; return toast('설정에서 AI를 켜 주세요'); }
  busy(btn, '분석하는 중…');
  const list = qs.slice(0, 40).map(q => `- [${subjById(q.sid)?.name} · ${q.from}] ${q.q} → 정답: ${answerText(q)} (틀린 횟수 ${prog.q[q.id].wrong})`).join('\n');
  try {
    const t = await gem(`학생이 자꾸 틀리는 문제 목록이다. 약점을 분석해 줘.\n형식(마크다운): ## 약한 개념 (개념별로 묶고 왜 헷갈리는지 한두 줄) / ## 다시 볼 단원·조문 (우선순위 순) / ## 오늘 할 복습 순서 (30분 기준) / ## 헷갈림 끊는 한 줄 정리\n\n${list}`);
    $('#weakout').innerHTML = `<div class="card ai"><div class="ai-head"><div class="mark">${ic('spark', 18)}</div><b>Gemini 약점 분석</b></div><div class="md">${md(t)}</div></div>`;
  } catch (e) { toast(e.message); }
  unbusy(btn);
}
