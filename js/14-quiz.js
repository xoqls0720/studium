'use strict';
// ── 문제 풀기 ───────────────────────────────────────────────────
function startQuiz(qs, title, back) {
  if (!qs.length) return toast('풀 문제가 없어요');
  state.quiz = {qs: qs.map(q => q.type === 'mcq' ? {...q, order: shuffle(q.c.map((_, i) => i))} : q), i: 0, res: [], title, back};
  if (location.hash === '#/quiz') viewQuiz(); else location.hash = '#/quiz';
}
const norm = s => String(s).replace(/\s+/g, '').replace(/[()（）·,.]/g, '').toLowerCase();
const answerText = q => q.type === 'mcq' ? q.c[q.a] : q.type === 'ox' ? (q.a ? 'O' : 'X') : q.a;
function viewQuiz() {
  const z = state.quiz;
  if (!z) return location.replace('#/');
  frame(z.title, z.back);
  if (z.i >= z.qs.length) return quizEnd();
  const q = z.qs[z.i];
  let h = `<div class="qwrap"><div class="qtop"><span class="cnt">${String(z.i + 1).padStart(2, '0')} <span class="faint">/ ${z.qs.length}</span></span><span class="grow faint">${esc(q.from)}</span><span class="tag">${{mcq: '객관식', ox: 'OX', short: '서술형'}[q.type]}</span></div>
    <div class="prog"><i style="width:${z.i / z.qs.length * 100}%"></i></div><div class="card" style="padding:26px"><div class="q">${esc(q.q)}</div>`;
  if (q.type === 'mcq') h += q.order.map((ci, n) => `<button class="choice" data-c="${ci}"><span class="badge">${n + 1}</span><span>${esc(q.c[ci])}</span></button>`).join('');
  if (q.type === 'ox') h += `<div class="oxrow"><button class="choice" data-c="1">O</button><button class="choice" data-c="0">X</button></div>`;
  if (q.type === 'short') h += `<textarea id="ans" placeholder="답을 써 보세요. 비워 두고 '모범 답안 보기'를 눌러도 돼요."></textarea>
    <div class="row" style="margin-top:12px">${gemKey() ? `<button class="btn gem" id="grade">${ic('spark', 18)}Gemini 채점</button>` : ''}<button class="btn ${gemKey() ? '' : 'pri'}" id="show">모범 답안 보기</button></div>`;
  h += '<div id="fb"></div></div></div>';
  render(h);
  const next = () => { z.i++; viewQuiz(); scrollTo(0, 0); };
  const after = (ok, mine) => {
    record(q.id, ok); z.res.push({q, ok});
    $('#fb').innerHTML = `<div class="fb ${ok ? 'ok' : 'bad'}"><div class="ttl">${ic(ok ? 'check' : 'x', 18, 2.2)}${ok ? '맞았어요' : '틀렸어요'}${q.type === 'ox' ? ` · 정답 ${q.a ? 'O' : 'X'}` : ''}</div>${q.e ? `<div>${inline(q.e)}</div>` : ''}</div>
      <div id="why"></div><div class="row">${!ok && gemKey() ? `<button class="btn gem" id="whyb">${ic('spark', 18)}왜 틀렸는지 묻기</button>` : ''}<span class="grow"></span><button class="btn pri" id="next">${z.i + 1 < z.qs.length ? '다음 문제' : '결과 보기'}</button></div>`;
    $('#next').onclick = next; $('#next').focus({preventScroll: true});
    $('#whyb') && ($('#whyb').onclick = async () => {
      busy($('#whyb'), '설명 받는 중…');
      try {
        const t = await gem(`대학 시험 문제를 틀렸다. 내가 고른 답이 왜 틀렸고 정답이 왜 맞는지, 다음에 헷갈리지 않을 기억법 한 줄까지 짧게(마크다운 6줄 안팎) 설명해 줘.\n문제: ${q.q}\n${q.type === 'mcq' ? '보기: ' + q.c.map((c, i) => `${i + 1}) ${c}`).join(' / ') + '\n' : ''}내 답: ${mine}\n정답: ${answerText(q)}\n해설: ${q.e || ''}`);
        $('#why').innerHTML = `<div class="card ai" style="box-shadow:none"><div class="md">${md(t)}</div></div>`;
        $('#whyb').remove();
      } catch (e) { toast(e.message); unbusy($('#whyb')); }
    });
  };
  main_.querySelectorAll('.choice').forEach(b => b.onclick = () => {
    if (main_.querySelector('.choice:disabled')) return;
    const c = +b.dataset.c, right = q.type === 'mcq' ? q.a : (q.a ? 1 : 0);
    main_.querySelectorAll('.choice').forEach(x => { x.disabled = true; if (+x.dataset.c === right) x.classList.add('ok'); });
    if (c !== right) b.classList.add('bad');
    after(c === right, q.type === 'mcq' ? q.c[c] : c ? 'O' : 'X');
  });
  if (q.type !== 'short') return;
  const reveal = (extra = '', rec = null) => {
    const mine = norm($('#ans').value), hits = q.k.filter(k => mine.includes(norm(k)));
    $('#ans').readOnly = true;
    main_.querySelectorAll('#grade,#show').forEach(b => b.remove());
    $('#fb').innerHTML = `${extra}<div class="box"><h3>모범 답안</h3><div>${inline(q.a)}</div><div style="margin-top:10px">${q.k.map(k => `<span class="kw ${hits.includes(k) ? 'hit' : ''}">${esc(k)}</span>`).join('')}</div>
      ${mine ? `<div class="faint" style="margin-top:8px">핵심어 ${hits.length}/${q.k.length}개를 썼어요</div>` : ''}</div>
      <div class="row"><span class="grow muted">스스로 채점</span><button class="btn ${rec === false ? 'pri' : ''}" id="sb">몰랐어요</button><button class="btn ${rec === false ? '' : 'pri'}" id="sg">맞혔어요</button></div>`;
    $('#sg').onclick = () => { z.res.push({q, ok: true}); record(q.id, true); next(); };
    $('#sb').onclick = () => { z.res.push({q, ok: false}); record(q.id, false); next(); };
  };
  $('#show').onclick = () => reveal();
  $('#grade') && ($('#grade').onclick = async () => {
    const mine = $('#ans').value.trim();
    if (!mine) return toast('답을 먼저 써 주세요');
    busy($('#grade'), '채점하는 중…'); $('#show').disabled = true;
    try {
      const g = await gem(`너는 대학 시험 서술형 채점자다. 10점 만점으로 엄정하지만 친절하게 채점한다.\n문제: ${q.q}\n모범 답안: ${q.a}\n채점 핵심어: ${q.k.join(', ')}\n학생 답안: ${mine}\n\nscore(0~10 정수), good(잘 쓴 점), missing(빠졌거나 틀린 점), improved(학생 답의 표현을 살려 고쳐 쓴 답안), comment(한 줄 총평)`, {schema: GRADE_S, temp: .2});
      const sc = Math.max(0, Math.min(10, g.score | 0));
      reveal(`<div class="card ai" style="box-shadow:none;margin-top:16px"><div class="ai-head"><div class="mark">${ic('spark', 18)}</div><div class="grade grow"><b>${sc}</b><span class="faint">/ 10</span></div><span class="tag ${sc >= 7 ? 'ok' : sc >= 4 ? 'warn' : 'bad'}">${esc(g.comment)}</span></div>
        ${g.good?.length ? `<div class="md"><b>잘 쓴 점</b><ul>${g.good.map(x => `<li>${inline(x)}</li>`).join('')}</ul></div>` : ''}
        ${g.missing?.length ? `<div class="md"><b>빠진 점</b><ul>${g.missing.map(x => `<li>${inline(x)}</li>`).join('')}</ul></div>` : ''}
        <div class="box" style="margin-bottom:0"><h3>고쳐 쓴 답안</h3>${inline(g.improved)}</div></div>`, sc >= 7);
    } catch (e) { toast(e.message); unbusy($('#grade')); $('#show').disabled = false; }
  });
}
function quizEnd() {
  const z = state.quiz, ok = z.res.filter(r => r.ok).length, bad = z.res.filter(r => !r.ok), pct = z.res.length ? Math.round(ok / z.res.length * 100) : 0;
  render(`<div class="qwrap"><div class="card" style="text-align:center;padding:32px 24px"><div class="eyebrow">결과</div>
    <div class="ring" style="--p:${pct}"><div><div><b>${pct}%</b><div class="faint">${ok} / ${z.res.length}</div></div></div></div>
    <p class="muted" style="margin:0">${pct >= 90 ? '아주 좋아요. 이 범위는 거의 잡혔어요.' : pct >= 70 ? '좋아요. 틀린 것만 한 번 더 보면 돼요.' : pct >= 50 ? '절반은 넘었어요. 오답을 노트와 함께 다시 봐요.' : '이 범위는 정리 노트부터 다시 읽고 풀어 봐요.'}</p></div>
    ${bad.length ? `<div class="sect">틀린 문제 ${bad.length}</div>${bad.map(({q}) => `<div class="card" style="padding:18px 20px"><b style="font-family:var(--serif)">${esc(q.q)}</b><div class="faint" style="margin:2px 0 8px">${esc(q.from)}</div><div><span class="tag ok">정답</span> ${q.type === 'short' ? inline(q.a) : esc(answerText(q))}</div>${q.e ? `<div class="muted" style="margin-top:6px">${inline(q.e)}</div>` : ''}</div>`).join('')}` : ''}
    <div class="row" style="margin-top:16px">${bad.length ? '<button class="btn pri" id="badonly">틀린 것만 다시</button>' : ''}<button class="btn ${bad.length ? '' : 'pri'}" id="again">처음부터 다시</button><span class="grow"></span><button class="btn ghost" data-go="${z.back}">끝내기</button></div></div>`);
  $('#again').onclick = () => startQuiz(shuffle(z.qs), z.title, z.back);
  $('#badonly') && ($('#badonly').onclick = () => startQuiz(shuffle(bad.map(r => r.q)), z.title.replace(/ \(오답\)$/, '') + ' (오답)', z.back));
}
