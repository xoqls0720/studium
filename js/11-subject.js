'use strict';
// ── 과목 ────────────────────────────────────────────────────────
const TABS = [['book', '기본서'], ['cards', '카드'], ['quiz', '문제'], ['summary', '요약·맵'], ['exam', '시험 대비'], ['wrong', '오답'], ['nlm', 'NotebookLM']];
function tabsHtml(s, on) {
  const st = subjStats(s);
  return `<section class="shead noprint" style="--h:${hue(s.id)}"><div class="eyebrow">${esc(s.libName || '과목')}</div><h2 class="display">${esc(s.name)}</h2>
    <p class="lede">${st.ready}/${st.total} 정리 · 읽음 ${st.read}${st.n ? ` · 정답률 ${Math.round(st.ok / st.n * 100)}%` : ''}${st.wrong ? ` · 오답 ${st.wrong}` : ''}</p></section>
    <div class="seg noprint">${TABS.map(([k, t]) => `<button class="${k === on ? 'on' : ''}" data-go="#/s/${s.id}/${k}">${t}</button>`).join('')}</div>`;
}

function viewBook(s) {
  frame(s.name, '#/');
  const rc = s.units.filter(u => u.ready).map(u => readCount(u.id)), pass = rc.length ? Math.min(...rc) : 0, inPass = rc.filter(n => n > pass).length;
  render(tabsHtml(s, 'book') + `${rc.length ? `<div class="card callout"><div class="mark">${ic('book')}</div><div class="grow"><b>${pass + 1}회독 진행 중 · ${inPass}/${rc.length}</b><div class="faint">끝까지 읽으면 읽음, 6시간 뒤 다시 끝까지 읽으면 회독이 하나 늘어요</div><div class="bar" style="margin:8px 0 0"><i style="width:${inPass / rc.length * 100}%"></i></div></div></div>` : ''}
  <div class="card" style="padding-top:8px;padding-bottom:8px"><ul class="list">${s.units.map((u, i) => `<li class="${u.ready ? '' : 'off'}" ${u.ready ? `data-go="#/s/${s.id}/u/${u.id}"` : ''}><span class="num">${pad2(i + 1)}</span><span class="grow"><span class="tt">${esc(u.title)}</span>${memoOf(u.id) ? `<span class="faint"> · ${ic('memo', 13)} 메모</span>` : ''}</span>${isMarked(u.id) ? `<span style="color:var(--gold)">${ic('mark', 16)}</span>` : ''}${u.ready ? `${readCount(u.id) ? `<span class="tag ok">${readCount(u.id)}회독</span>` : `<span class="faint">${u.n}문제</span>`}<span class="chev">${ic('chev', 16)}</span>` : '<span class="tag warn">정리 중</span>'}</li>`).join('')}</ul></div>
  <div class="row noprint"><button class="btn" data-go="#/s/${s.id}/print">${ic('print', 18)}기본서 전체 인쇄·PDF</button><button class="btn" data-go="#/add">${ic('plus', 18)}이 과목에 자료 넣기</button></div>
  ${s.pdf && Object.keys(s.pdf).length ? `<div class="sect">굿노트</div><div class="card callout noprint"><div class="mark">${ic('share')}</div><div class="grow"><b>굿노트로 보내기</b><div class="faint">아이패드 공유 창에서 굿노트를 고르면 바로 열려요. 쪽마다 오른쪽에 필기 칸이 있어요.</div></div></div>
    <div class="row noprint">${[['book', '기본서'], ['summary', '요약집'], ['quiz', '문제지 + 정답']].filter(([k]) => s.pdf[k]).map(([k, t]) => `<button class="btn" data-gn="${k}">${ic('share', 18)}${t}</button>`).join('')}</div>` : ''}`);
  store.set('addTo', {lib: s.lib, libName: s.libName, subject: s.name});
  main_.querySelectorAll('[data-gn]').forEach(b => b.onclick = () => toGoodnotes(b, `${s.folder}/${s.pdf[b.dataset.gn]}`, s.pdf[b.dataset.gn].split('/').pop()));
}

function unitHtml(u, d) {
  return `<div class="md">${md(d.note)}</div>
    ${d.emphasis?.length ? `<div class="box emph"><h3>★ 강조</h3><ul>${d.emphasis.map(x => `<li>${inline(x)}</li>`).join('')}</ul></div>` : ''}
    <div class="box"><h3>핵심 정리</h3><ol>${(d.points || []).map(x => `<li>${inline(x)}</li>`).join('')}</ol></div>`;
}
async function viewUnit(s, uid) {
  const i = s.units.findIndex(u => u.id === uid), u = s.units[i];
  if (!u) return viewBook(s);
  frame(s.name, `#/s/${s.id}/book`);
  render(`<div class="narrow card">${thinking('불러오는 중…')}</div>`);
  let d;
  try { d = await loadUnit(s, u); } catch (e) { render(`<div class="narrow card">못 불러왔어요: ${esc(e.message)}</div>`); return; }
  store.set('last', {sid: s.id, uid: u.id});
  const prev = s.units.slice(0, i).reverse().find(x => x.ready), next = s.units.slice(i + 1).find(x => x.ready);
  const ready = s.units.filter(x => x.ready), pos = ready.indexOf(u) + 1, cards = cardsOf(s, u, d);
  const qn = questionsOf(s, u, d).length + extraQuestions(s, [u.id]).filter(q => q.uids?.length === 1).length;
  render(`<div class="narrow">
    <section class="hero" style="margin-bottom:16px"><div class="eyebrow">${esc(s.name)} · ${pos} / ${ready.length}${readCount(u.id) ? ` · ${readCount(u.id)}회독` : ''}</div><h2 class="display">${esc(u.title)}</h2>
      <p class="faint" style="margin:0">${esc(u.file)}${d.slides?.length ? ' · 슬라이드 ' + esc(d.slides.join(', ')) + ' 참고' : ''}</p></section>
    <div class="row noprint" style="margin-bottom:14px">
      <button class="btn sm" id="u-listen">${ic('sound', 16)}듣기</button><button class="btn sm gem" id="u-pod">${ic('spark', 16)}팟캐스트</button>
      <button class="btn sm" id="u-mark" style="${isMarked(u.id) ? 'color:var(--gold);border-color:var(--gold-line)' : ''}">${ic('mark', 16)}책갈피</button>
      <button class="btn sm" id="u-memo">${ic('memo', 16)}메모${memoOf(u.id) ? ' ·' : ''}</button></div>
    <div id="u-podbox" class="card" hidden></div>
    <div id="u-memobox" class="card" ${memoOf(u.id) ? '' : 'hidden'}><label class="field" style="margin:0"><span>내 메모 · 기기끼리 맞춰져요</span><textarea id="u-memotext" style="min-height:90px" placeholder="이해한 것, 헷갈리는 것, 교수님 말씀…">${esc(memoOf(u.id))}</textarea></label></div>
    <div id="pw"><div class="card paper" id="paper" style="padding:28px">${unitHtml(u, d)}<canvas id="ink" hidden></canvas></div></div>
    ${d.terms?.length ? `<div class="sect">용어 · 눌러서 뜻 보기</div><div class="terms">${d.terms.map(t => `<div class="term"><b>${esc(t.t)}</b><span>${esc(t.d)}</span></div>`).join('')}</div>` : ''}
    <div class="row noprint" style="margin:22px 0">
      <button class="btn pri" id="u-quiz">문제 풀기 · ${qn}</button>
      <button class="btn" id="u-cards">${ic('cards', 18)}카드 ${cards.length}</button>
      <button class="btn" data-go="#/s/${s.id}/blank/${u.id}">${ic('pen', 18)}백지 복습</button>
      <button class="btn" id="u-read">${isRead(u.id) ? ic('check', 18, 2.2) + '읽음' : '읽음 표시'}</button>
      ${u.pdf ? `<button class="btn" id="u-gn">${ic('share', 18)}굿노트로</button>` : ''}
      <button class="btn ghost" id="u-print">${ic('print', 18)}필기 포함 인쇄</button>
    </div>
    ${aiCard()}
    <div class="row noprint" style="margin-top:22px">
      ${prev ? `<button class="btn ghost" data-go="#/s/${s.id}/u/${prev.id}">${ic('back', 18)}앞</button>` : ''}<span class="grow"></span>
      ${next ? `<button class="btn" data-go="#/s/${s.id}/u/${next.id}">다음${ic('chev', 18)}</button>` : ''}
    </div></div>`);
  main_.querySelectorAll('.term').forEach(t => t.onclick = () => t.classList.toggle('open'));
  const readBtn = $('#u-read');
  const paintRead = () => readBtn.innerHTML = isRead(u.id) ? ic('check', 18, 2.2) + '읽음' : '읽음 표시';
  readBtn.onclick = () => { setRead(u.id, !isRead(u.id)); paintRead(); };
  $('#u-quiz').onclick = () => startQuiz(shuffle([...questionsOf(s, u, d), ...extraQuestions(s, [u.id]).filter(q => q.uids?.length === 1)]), u.title, `#/s/${s.id}/u/${u.id}`);
  $('#u-cards').onclick = () => startCards(cards, u.title + ' 카드', `#/s/${s.id}/u/${u.id}`);
  // 끝까지 읽으면 읽음(회독) 표시
  const mark = () => {
    if (!readBtn.isConnected) return removeEventListener('scroll', mark);
    if (scrollY + innerHeight > document.body.scrollHeight - 600) {
      const r = prog.read[u.id];
      if (!r?.on || Date.now() - (r.at || r.t || 0) > 6 * 36e5) { setRead(u.id, true); paintRead(); toast(`${readCount(u.id)}회독 했어요`); }
      removeEventListener('scroll', mark);
    }
  };
  addEventListener('scroll', mark, {passive: true});
  let listening = false;
  $('#u-listen').onclick = () => {
    if (listening) { speakStop(); listening = false; $('#u-listen').innerHTML = ic('sound', 16) + '듣기'; return; }
    listening = true; $('#u-listen').innerHTML = ic('pause', 16) + '멈춤';
    speak(`${u.title}. ${d.note}. 핵심 정리. ${(d.points || []).join('. ')}`, {onend: () => { listening = false; $('#u-listen') && ($('#u-listen').innerHTML = ic('sound', 16) + '듣기'); }});
  };
  $('#u-pod').onclick = () => { const b = $('#u-podbox'); b.hidden = false; podcastPanel(b, 'u:' + u.id, u.title, `${d.note}\n핵심: ${(d.points || []).join('\n')}`); };
  $('#u-mark').onclick = () => { const on = toggleMark(u.id); $('#u-mark').style.cssText = on ? 'color:var(--gold);border-color:var(--gold-line)' : ''; toast(on ? '책갈피에 넣었어요' : '책갈피를 뺐어요'); };
  $('#u-memo').onclick = () => { $('#u-memobox').hidden = false; $('#u-memotext').focus(); };
  $('#u-memotext').oninput = e => setMemo(u.id, e.target.value);
  $('#u-gn') && ($('#u-gn').onclick = () => toGoodnotes($('#u-gn'), `${s.folder}/${u.pdf}`, `${s.name} - ${u.title}.pdf`));
  // 굿노트 바로 열기: 강의를 여는 순간 PDF를 미리 받아 둬서, '굿노트로'를 누르면 기다림 없이 공유 창이 바로 뜬다
  if (u.pdf && !pdfCache.has(`${s.folder}/${u.pdf}`)) (async () => {
    try { const path = `${s.folder}/${u.pdf}`; pdfCache.set(path, new File([await (await src().file(path)).blob()], `${s.name} - ${u.title}.pdf`, {type: 'application/pdf'})); } catch {}
  })();
  $('#u-print').onclick = () => { state.inkPrint?.(); setTimeout(print, 80); };
  setupInk(u.id);
  selCard($('#paper'), s, u.id);
  bindAi(`unit:${u.id}`, `너는 '${s.name}' 과목의 친절하고 정확한 조교다. 학생이 지금 '${u.title}' 정리 노트를 보고 있다.
아래 노트를 근거로 한국어로 답한다. 노트에 없는 내용을 보탤 때는 '자료 밖 일반 지식'이라고 밝힌다. 답은 간결한 마크다운으로, 필요하면 표·목록을 쓴다.
학생이 '튜터 모드'를 부탁하면 답을 바로 말하지 말고 질문을 하나씩 던져 스스로 설명하게 이끈다. 틀리면 힌트를 한 단계씩 준다. 끝나면 학생이 약했던 부분을 정리한다.

[정리 노트]
${d.note}

[핵심]
${(d.points || []).join('\n')}

[용어]
${(d.terms || []).map(t => `${t.t}: ${t.d}`).join('\n')}

[학생 메모]
${memoOf(u.id) || '(없음)'}`, [
    ['튜터 모드', '튜터 모드로 해 줘. 이 강의 핵심을 내가 스스로 설명할 수 있게 질문을 하나씩 던져 줘. 답은 먼저 말하지 마.'],
    ['쉽게 설명', '이 내용을 처음 듣는 사람도 이해하게 쉬운 말로 다시 설명해 줘.'],
    ['예시 더 보기', '핵심 개념마다 일상생활 예시를 하나씩 들어 줘.'],
    ['시험 포인트', '시험에 나올 만한 부분과 그 이유, 헷갈리기 쉬운 점을 짚어 줘.'],
    ['암기 요령', '핵심 내용을 외우기 쉽게 두문자·비유·이야기로 정리해 줘.'],
    ['한 장 요약', '시험 직전에 볼 한 장짜리 요약표로 만들어 줘.'],
    ['비교표', '이 강의에서 헷갈리기 쉬운 개념들을 골라 비교표로 정리해 줘.'],
  ]);
}


// ── 백지 복습: 자료 제목만 보고 기억나는 것을 쏟아낸 뒤 기본서와 대조한다 (free recall — 다시 읽기보다 오래 남는다) ──
const BLANK_S = obj({score: {type: 'INTEGER'}, got: arr(S_), missing: arr(S_), wrong: arr(S_), tip: S_});
async function viewBlank(s, uid) {
  const u = s.units.find(x => x.id === uid);
  if (!u) return viewBook(s);
  frame('백지 복습', `#/s/${s.id}/u/${u.id}`);
  render(`<div class="narrow card">${thinking('불러오는 중…')}</div>`);
  let d;
  try { d = await loadUnit(s, u); } catch (e) { render(`<div class="narrow card">못 불러왔어요: ${esc(e.message)}</div>`); return; }
  const saved = store.get('blank.' + u.id, '');
  render(`<div class="narrow">
    <section class="hero" style="margin-bottom:14px"><div class="eyebrow">백지 복습 · ${esc(s.name)}</div><h2 class="display">${esc(u.title)}</h2>
      <p class="lede">아무것도 보지 않고, 이 자료에서 기억나는 것을 전부 써 보세요. 핵심 개념·정의·예시처럼 시험에 나올 말로요. 다 쓰면 기본서와 대조해 빠진 것을 짚어 줘요.</p></section>
    <div class="card"><textarea id="bl-text" style="min-height:260px" placeholder="기억나는 대로… (쓰다 막히면 그게 복습할 곳이에요)">${esc(saved)}</textarea>
      <div class="row" style="margin-top:12px"><button class="btn pri gem" id="bl-check">${ic('spark', 18)}기본서와 대조</button><span class="grow faint" id="bl-n"></span><button class="btn ghost" data-go="#/s/${s.id}/u/${u.id}">자료으로</button></div></div>
    <div id="bl-out"></div></div>`);
  const ta = $('#bl-text');
  ta.oninput = () => { $('#bl-n').textContent = ta.value.trim() ? ta.value.trim().length + '자' : ''; store.set('blank.' + u.id, ta.value.slice(0, 20000)); };
  ta.oninput();
  $('#bl-check').onclick = async () => {
    const mine = ta.value.trim();
    if (mine.length < 20) return toast('조금 더 써 보세요 (20자부터)');
    if (!aiOn()) { location.hash = '#/set'; return toast('설정에서 AI를 켜 주세요'); }
    busy($('#bl-check'), '대조하는 중…');
    try {
      const base = `제목: ${u.title}\n핵심: ${(d.points || []).join('\n')}\n용어: ${(d.terms || []).map(t => `${t.t}=${t.d}`).join(' / ')}\n시험 포인트: ${(d.emphasis || []).join(' / ')}`.slice(0, 30000);
      const g = await gem(`학생이 '${u.title}' 자료을 백지 복습했다. 아래 [기본서]와 대조해서 채점한다.
score: 기본서 핵심 중 몇 %를 담았는지(0~100 정수). got: 제대로 기억한 핵심(짧게). missing: 빠뜨린 핵심 — 중요한 순서로, 시험에 나올 말로. wrong: 틀리게 기억한 것("학생 표현 → 바른 내용" 꼴, 없으면 빈 배열). tip: 다음 백지 복습 전에 외울 한 줄 요령.\n\n[기본서]\n${base}\n\n[학생이 쓴 것]\n${mine}`, {schema: BLANK_S, temp: .2});
      const sc = Math.max(0, Math.min(100, g.score | 0));
      logActivity(); saveProg();
      $('#bl-out').innerHTML = `<div class="card ai"><div class="ai-head"><div class="mark">${ic('spark', 18)}</div><div class="grade grow"><b>${sc}</b><span class="faint">/ 100</span></div><span class="tag ${sc >= 70 ? 'ok' : sc >= 40 ? 'warn' : 'bad'}">${sc >= 70 ? '잘 잡혀 있어요' : sc >= 40 ? '빠진 곳을 채워요' : '다시 읽고 또 해 봐요'}</span></div>
        ${g.got?.length ? `<div class="md"><b>기억한 것</b><ul>${g.got.map(x => `<li>${inline(x)}</li>`).join('')}</ul></div>` : ''}
        ${g.missing?.length ? `<div class="box emph"><h3>빠뜨린 것</h3><ul>${g.missing.map(x => `<li>${inline(x)}</li>`).join('')}</ul></div>` : ''}
        ${g.wrong?.length ? `<div class="box"><h3>틀리게 기억한 것</h3><ul>${g.wrong.map(x => `<li>${inline(x)}</li>`).join('')}</ul></div>` : ''}
        ${g.tip ? `<p class="muted" style="margin:10px 0 0">${inline(g.tip)}</p>` : ''}
        <div class="row noprint" style="margin-top:12px"><button class="btn" id="bl-again">지우고 한 번 더</button><button class="btn" data-go="#/s/${s.id}/u/${u.id}">자료 다시 읽기</button></div></div>`;
      unbusy($('#bl-check'));
      $('#bl-again').onclick = () => { ta.value = ''; store.set('blank.' + u.id, ''); ta.oninput(); $('#bl-out').innerHTML = ''; ta.focus(); };
      $('#bl-out').scrollIntoView({behavior: 'smooth', block: 'start'});
    } catch (e) { toast(e.message); unbusy($('#bl-check')); }
  };
}

// Gemini 대화 판: 노트를 근거로 묻고 답한다. 대화는 이 화면을 떠나도 기기에 남는다.
function aiCard(title = aiName() + '에게 묻기', sub = '이 강의 노트를 근거로 답해요') {
  return `<div class="card ai noprint" id="aicard"><div class="ai-head"><div class="mark">${ic('spark', 18)}</div><div class="grow"><b>${title}</b><div class="faint">${sub}</div></div><button class="btn ghost sm" id="aiclear" hidden>지우기</button></div>
    ${aiOn() ? '<div class="chips" id="chips"></div><div class="chat" id="chat"></div><div class="ask"><textarea id="askq" placeholder="궁금한 것을 물어보세요"></textarea><button class="btn pri" id="askb">묻기</button></div>'
      : `<div class="row"><span class="grow muted">설정에서 AI를 켜면 쓸 수 있어요 (Gemini·Groq 무료 한도 · Ollama 공짜 · Claude 유료).</span><button class="btn gem sm" data-go="#/set">키 넣기</button></div>`}</div>`;
}
function bindAi(key, sys, chips) {
  if (!aiOn() || !$('#chat')) return;
  const hist = state.chat[key] ||= store.get('chat.' + key, []);
  const chat = $('#chat'), q = $('#askq'), btn = $('#askb'), clr = $('#aiclear');
  const paint = () => {
    chat.innerHTML = hist.map(m => m.role === 'user' ? `<div class="msg me">${esc(m.text)}</div>` : `<div class="msg ai"><div class="md">${md(m.text)}</div></div>`).join('');
    clr.hidden = !hist.length;
  };
  $('#chips').innerHTML = chips.map(([t, p], i) => `<button data-i="${i}">${esc(t)}</button>`).join('');
  $('#chips').querySelectorAll('button').forEach(b => b.onclick = () => ask(chips[b.dataset.i][1], chips[b.dataset.i][0]));
  async function ask(text, shown) {
    text = text.trim();
    if (!text || btn.disabled) return;
    hist.push({role: 'user', text, shown});
    paint(); chat.insertAdjacentHTML('beforeend', `<div class="msg ai">${thinking()}</div>`);
    q.value = ''; busy(btn, '');
    try { hist.push({role: 'model', text: await gem(hist.slice(-12), {sys})}); }
    catch (e) { hist.pop(); toast(e.message); }
    store.set('chat.' + key, hist.slice(-20)); unbusy(btn); paint();
    chat.lastElementChild?.scrollIntoView({behavior: 'smooth', block: 'nearest'});
  }
  btn.onclick = () => ask(q.value);
  q.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(q.value); } };
  clr.onclick = () => { hist.length = 0; store.set('chat.' + key, []); paint(); };
  paint();
}

async function viewPrint(s, unitIds, title) {
  frame(title || s.name + ' 기본서', `#/s/${s.id}/book`);
  render(`<div class="narrow card">${thinking('엮는 중…')}</div>`);
  const us = s.units.filter(u => u.ready && (!unitIds || unitIds.includes(u.id)));
  let h = `<div class="card" style="padding:32px"><div class="eyebrow">기본서</div><h1 class="display">${esc(title || s.name)}</h1><ol>${us.map(u => `<li>${esc(u.title)}</li>`).join('')}</ol></div>`;
  for (const u of us) { try { const d = await loadUnit(s, u); h += `<div class="card" style="break-before:page;padding:32px"><h1 class="display" style="font-size:26px">${esc(u.title)}</h1>${unitHtml(u, d)}</div>`; } catch {} }
  render(`<div class="narrow"><div class="row noprint" style="margin-bottom:16px"><button class="btn pri" onclick="print()">${ic('print', 18)}인쇄·PDF로 저장</button></div>${h}</div>`);
}

async function viewSummary(s) {
  frame(s.name, '#/');
  const d = await loadSummary(s);
  const tools = `<div class="sect">마인드맵</div><div class="card" id="mmbox"></div>
    <div class="sect">과목 팟캐스트</div><div class="card" id="podbox"><div class="row"><span class="grow muted">과목 전체를 두 사람이 대화로 풀어 주는 오디오를 만들어요.</span><button class="btn gem" id="podgo">${ic('spark', 18)}만들기</button></div></div>`;
  render(tabsHtml(s, 'summary') + (d ? `<div class="narrow" style="margin-left:0"><div class="card" style="padding:28px" id="sumbox"><div class="md"><h2>과목 흐름</h2><p>${inline(d.overview)}</p></div>
    <div class="box emph"><h3>시험에 나올 핵심</h3><ol>${(d.top || []).map(x => `<li>${inline(x)}</li>`).join('')}</ol></div>
    <div class="md">${(d.chapters || []).map(c => `<h3>${inline(c.title)}</h3><p>${inline(c.gist)}</p><ul>${(c.must || []).map(x => `<li>${inline(x)}</li>`).join('')}</ul>`).join('')}</div></div>
    <div class="row noprint"><button class="btn pri" id="sq">종합 문제 풀기 · ${summaryQuestions(s, d).length}</button><button class="btn" onclick="print()">${ic('print', 18)}인쇄·PDF</button></div></div>`
    : '<div class="card muted">요약집은 이 과목 자료가 모두 정리된 뒤 PC 생성기가 만들어요.</div>') + tools);
  $('#sumbox') && selCard($('#sumbox'), s, null);
  $('#sq') && ($('#sq').onclick = () => startQuiz(shuffle(summaryQuestions(s, d)), s.name + ' 종합', `#/s/${s.id}/summary`));
  const mmbox = $('#mmbox');   // 그새 다른 화면으로 넘어갔으면 손대지 않는다
  kvGet('mm:' + s.id).then(c => !mmbox.isConnected ? 0 : c ? mindmapPanel(mmbox, s) : (mmbox.innerHTML = `<div class="row"><span class="grow muted">과목 전체 개념 관계를 한 장으로 그려요.</span><button class="btn gem" id="mmgo">${ic('map', 18)}그리기</button></div>`, $('#mmgo').onclick = () => mindmapPanel($('#mmbox'), s)));
  const podSrc = async () => d ? `${d.overview}\n${(d.top || []).join('\n')}\n${(d.chapters || []).map(c => c.title + ': ' + c.gist).join('\n')}` : (await Promise.all(s.units.filter(u => u.ready).slice(0, 20).map(u => loadUnit(s, u).then(x => u.title + ': ' + (x.points || []).join(' / ')).catch(() => '')))).join('\n');
  kvGet('pod:s:' + s.id).then(c => { if (c && $('#podbox')) podcastPanel($('#podbox'), 's:' + s.id, s.name, podSrc); });   // 다시 만들 때 쓸 글은 그때 모은다
  $('#podgo').onclick = () => podcastPanel($('#podbox'), 's:' + s.id, s.name, podSrc);
}

function unitChecks(s, sel) {
  return `<div class="checks">${s.units.filter(u => u.ready).map(u => `<label><input type="checkbox" value="${u.id}" ${!sel || sel.includes(u.id) ? 'checked' : ''}><span>${esc(u.title)}</span></label>`).join('')}</div>`;
}
const checked = root => [...root.querySelectorAll('.checks input:checked')].map(i => i.value);
function bindAllNone() {
  $('#all') && ($('#all').onclick = () => main_.querySelectorAll('.checks input').forEach(i => i.checked = true));
  $('#none') && ($('#none').onclick = () => main_.querySelectorAll('.checks input').forEach(i => i.checked = false));
}

function viewQuizSetup(s) {
  frame(s.name, '#/');
  const last = store.get('qset.' + s.id, {types: ['mcq', 'ox', 'short'], n: 20, focus: false, units: null});
  const ex = (prog.extra?.[s.id] || []).length;
  render(tabsHtml(s, 'quiz') + `<div class="card">
    <label class="field"><span>종류</span><div class="opt">${[['mcq', '객관식'], ['ox', 'OX'], ['short', '서술형']].map(([k, t]) => `<label><input type="checkbox" name="ty" value="${k}" ${last.types.includes(k) ? 'checked' : ''}>${t}</label>`).join('')}</div></label>
    <div class="field"><span>방식</span><div class="opt"><label>문제 수 <select id="qn" style="min-height:30px;padding:2px 8px;border:0;background:none">${[10, 20, 30, 50, 9999].map(n => `<option value="${n}" ${n === last.n ? 'selected' : ''}>${n === 9999 ? '전부' : n + '개'}</option>`).join('')}</select></label>
      <label><input type="checkbox" id="qf" ${last.focus ? 'checked' : ''}>틀린 것·안 푼 것 먼저</label>
      <label><input type="checkbox" id="qs" ${s.summary ? 'checked' : 'disabled'}>요약집 종합 문제</label>
      <label><input type="checkbox" id="qx" ${ex ? 'checked' : 'disabled'}>Gemini 문제 ${ex}개</label></div></div>
    <div class="field" style="margin:0"><span class="row"><span class="grow">범위</span><button class="btn sm ghost" id="all">전체</button><button class="btn sm ghost" id="none">해제</button></span>${unitChecks(s, last.units)}</div></div>
    <div class="row"><button class="btn pri" id="go">시작하기</button><span class="grow"></span>
      <button class="btn gem" id="gen">${ic('spark', 18)}Gemini로 새 문제 10개</button>${ex ? '<button class="btn ghost sm" id="xclear">Gemini 문제 지우기</button>' : ''}</div>`);
  bindAllNone();
  const opts = () => ({types: [...main_.querySelectorAll('[name=ty]:checked')].map(i => i.value), units: checked(main_), n: +$('#qn').value, focus: $('#qf').checked});
  $('#go').onclick = async () => {
    const o = opts();
    if (!o.types.length || !o.units.length) return toast('종류와 범위를 하나 이상 골라 주세요');
    store.set('qset.' + s.id, {...o, units: o.units.length === s.units.filter(u => u.ready).length ? null : o.units});
    busy($('#go'), '불러오는 중');
    const pool = (await poolOf(s, o.units, {summary: $('#qs').checked, extra: $('#qx').checked})).filter(q => o.types.includes(q.type));
    unbusy($('#go'));
    if (!pool.length) return toast('고른 범위에 문제가 없어요');
    startQuiz(pick(pool, o.n, o.focus), s.name + ' 문제', `#/s/${s.id}/quiz`);
  };
  $('#gen').onclick = async () => {
    if (!aiOn()) { location.hash = '#/set'; return toast('설정에서 AI를 켜 주세요'); }
    const o = opts();
    if (!o.units.length) return toast('범위를 골라 주세요');
    busy($('#gen'), 'Gemini가 문제를 만드는 중…');
    try {
      const pool = await poolOf(s, o.units);
      const qs = await makeQuestions(s, s.units.filter(u => o.units.includes(u.id)), {n: 10, wrong: pool.filter(q => isWrong(q.id))});
      toast(`새 문제 ${qs.length}개를 만들었어요`);
      startQuiz(qs, s.name + ' · Gemini 새 문제', `#/s/${s.id}/quiz`);
    } catch (e) { toast(e.message); unbusy($('#gen')); }
  };
  $('#xclear') && ($('#xclear').onclick = () => { if (!confirm('Gemini가 만든 이 과목 문제를 모두 지울까요?')) return; prog.extra[s.id] = []; prog.extraCut[s.id] = Date.now(); saveProg(); viewQuizSetup(s); });
}
// 틀린 것 → 안 푼 것 → 나머지(오래 전에 푼 것부터) 순서로 고른다.
function pick(pool, n, focus) {
  if (!focus) return shuffle(pool).slice(0, n);
  const w = q => isWrong(q.id) ? 0 : !prog.q[q.id] ? 1 : 2;
  return shuffle(shuffle(pool).sort((a, b) => w(a) - w(b) || (prog.q[a.id]?.last || 0) - (prog.q[b.id]?.last || 0)).slice(0, n));
}

async function wrongList(subs) {
  const wrongIds = Object.keys(prog.q).filter(isWrong), qs = [];
  for (const x of subs) {
    const ids = new Set(wrongIds.map(k => k.split(':')[0]));
    const mine = wrongIds.some(k => k.startsWith(x.id + ':'));
    if (!mine && !x.units.some(u => ids.has(u.id))) continue;
    const us = x.units.filter(u => ids.has(u.id)).map(u => u.id);
    qs.push(...[...(await poolOf(x, us, {summary: mine, extra: false})), ...extraQuestions(x, null)].filter(q => isWrong(q.id)));
  }
  return [...new Map(qs.map(q => [q.id, q])).values()].sort((a, b) => (prog.q[b.id].lastWrong || 0) - (prog.q[a.id].lastWrong || 0));
}
async function viewWrong(s) {
  frame(s ? s.name : '복습', s ? '#/' : null);
  const head = s ? tabsHtml(s, 'wrong') : `<section class="hero" style="margin-bottom:22px"><div class="eyebrow">복습</div><h2 class="display">틀린 문제 모음</h2><p class="lede">두 번 연속 맞히면 목록에서 빠져요.</p></section>`;
  render(head + `<div class="card">${thinking('모으는 중…')}</div>`);
  const qs = await wrongList(s ? [s] : allSubjects());
  if (!qs.length) { render(head + '<div class="card muted">틀린 문제가 없어요. 문제를 풀면 틀린 것이 여기 모여요.</div>'); return; }
  render(head + `<div class="row" style="margin-bottom:14px"><button class="btn pri" id="rw">${qs.length}문제 다시 풀기</button><button class="btn gem" id="weak">${ic('spark', 18)}Gemini 약점 분석</button>${s ? '<button class="btn gem" id="like">비슷한 문제 만들기</button>' : ''}</div>
    <div id="weakout"></div>
    <div class="card" style="padding-top:6px;padding-bottom:6px"><ul class="list">${qs.map(q => `<li class="off" style="cursor:default;align-items:flex-start"><span class="tag bad" style="margin-top:3px">${prog.q[q.id].wrong}회</span><span class="grow"><span class="tt" style="color:var(--ink)">${esc(q.q.length > 110 ? q.q.slice(0, 110) + '…' : q.q)}</span><div class="faint">${s ? '' : esc(subjById(q.sid)?.name) + ' · '}${esc(q.from)}</div></span></li>`).join('')}</ul></div>`);
  $('#rw').onclick = () => startQuiz(shuffle(qs).slice(0, 30), '오답 복습', s ? `#/s/${s.id}/wrong` : '#/review');
  $('#weak').onclick = async () => {
    if (!aiOn()) { location.hash = '#/set'; return toast('설정에서 AI를 켜 주세요'); }
    busy($('#weak'), '분석하는 중…');
    const list = qs.slice(0, 40).map(q => `- [${subjById(q.sid)?.name} · ${q.from}] ${q.q} → 정답: ${q.type === 'mcq' ? q.c[q.a] : q.type === 'ox' ? (q.a ? 'O' : 'X') : q.a} (틀린 횟수 ${prog.q[q.id].wrong})`).join('\n');
    try {
      const t = await gem(`대학생이 자꾸 틀리는 문제 목록이다. 약점을 분석해 줘.\n형식(마크다운): ## 약한 개념 (개념별로 묶고, 왜 헷갈리는지 한두 줄) / ## 다시 볼 강의 (우선순위 순) / ## 오늘 할 복습 순서 (30분 기준) / ## 헷갈림 끊는 한 줄 정리\n\n${list}`);
      $('#weakout').innerHTML = `<div class="card ai"><div class="ai-head"><div class="mark">${ic('spark', 18)}</div><b>Gemini 약점 분석</b></div><div class="md">${md(t)}</div></div>`;
    } catch (e) { toast(e.message); }
    unbusy($('#weak'));
  };
  $('#like') && ($('#like').onclick = async () => {
    if (!aiOn()) { location.hash = '#/set'; return toast('설정에서 AI를 켜 주세요'); }
    busy($('#like'), '만드는 중…');
    try {
      const us = s.units.filter(u => qs.some(q => q.uid === u.id || q.uids?.includes(u.id)));
      const made = await makeQuestions(s, us.length ? us : s.units.filter(u => u.ready), {n: 10, wrong: qs});
      startQuiz(made, s.name + ' · 비슷한 문제', `#/s/${s.id}/wrong`);
    } catch (e) { toast(e.message); unbusy($('#like')); }
  });
}
