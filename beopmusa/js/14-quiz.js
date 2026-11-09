'use strict';
// ── 문제 풀기 ───────────────────────────────────────────────────
// opts.limitMin: 실전 제한 시간(분). 1차 기준 문제당 72초(교시 120분/100문항)로 페이스를 잰다.
function startQuiz(qs, title, back, opts = {}) {
  if (!qs.length) return toast('풀 문제가 없어요');
  if (state.quiz?.tick) clearInterval(state.quiz.tick);
  state.quiz = {qs: qs.map(q => q.type === 'mcq' ? {...q, order: q.exam ? q.c.map((_, i) => i) : shuffle(q.c.map((_, i) => i))} : q), i: 0, res: [], title, back, t0: Date.now(), limit: (opts.limitMin || 0) * 60000, tick: 0, timeUp: false};
  if (location.hash === '#/quiz') viewQuiz(); else location.hash = '#/quiz';
}
const fmtClock = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${pad2(s % 60)}`; };
const norm = s => String(s).replace(/\s+/g, '').replace(/[()（）·,.]/g, '').toLowerCase();
const answerText = q => q.type === 'mcq' ? q.c[q.a] : q.type === 'ox' ? (q.a ? 'O' : 'X') : q.a;
const HAND_S = obj({transcript: S_, score: {type: 'INTEGER'}, good: arr(S_), missing: arr(S_), improved: S_, comment: S_});
// 폰 사진은 커서 긴 변 1800px JPEG 로 줄여 보낸다(빠르고 무료 한도도 덜 쓴다). 못 여는 형식이면 그대로.
async function shrinkPhoto(f, max = 1800) {
  try {
    const bmp = await createImageBitmap(f), k = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(ok => c.toBlob(b => ok(b || f), 'image/jpeg', .85));
  } catch { return f; }
}
function viewQuiz() {
  const z = state.quiz;
  if (!z) return location.replace('#/');
  frame(z.title, z.back);
  if (z.i >= z.qs.length) return quizEnd();
  const q = z.qs[z.i];
  let h = `<div class="qwrap"><div class="qtop"><span class="cnt">${String(z.i + 1).padStart(2, '0')} <span class="faint">/ ${z.qs.length}</span></span><span class="grow faint">${esc(q.from)}</span>${z.limit ? '<span class="tag" id="qtime"></span>' : ''}${isLeech(q.id) ? '<span class="tag bad">★ 상습</span>' : ''}<span class="tag">${{mcq: '객관식', ox: 'OX', short: '서술형'}[q.type]}</span></div>
    <div class="prog"><i style="width:${z.i / z.qs.length * 100}%"></i></div><div class="card" style="padding:26px">${q.revised ? `<div class="tag warn" style="margin-bottom:10px">${ic('alert', 14)} ${esc(q.revised)}</div>` : ''}<div class="q" style="white-space:pre-line">${esc(q.q)}</div>`;
  if (q.type === 'mcq') h += q.order.map((ci, n) => `<button class="choice" data-c="${ci}"><span class="badge">${n + 1}</span><span>${esc(q.c[ci])}</span></button>`).join('');
  if (q.type === 'ox') h += `<div class="oxrow"><button class="choice" data-c="1">O</button><button class="choice" data-c="0">X</button></div>`;
  if (q.type === 'short') h += `<textarea id="ans" placeholder="답을 써 보세요. 비워 두고 '모범 답안 보기'를 눌러도 돼요."></textarea>
    <div class="row" style="margin-top:12px">${aiOn() ? `<button class="btn gem" id="grade">${ic('spark', 18)}${aiName()} 채점</button><button class="btn gem" id="photob">${ic('camera', 18)}손글씨 사진 채점</button><input type="file" accept="image/*" id="photo" hidden>` : ''}<button class="btn ${aiOn() ? '' : 'pri'}" id="show">모범 답안 보기</button></div>`;
  h += '<div id="fb"></div></div></div>';
  render(h);
  // 실전 제한 시간: 남은 시간을 보여 주고, 다 되면 그때까지 푼 것으로 결과를 낸다
  if (z.limit && !z.tick) {
    const show = () => {
      const el = $('#qtime');
      if (!el) return;
      const left = z.limit - (Date.now() - z.t0);
      if (left <= 0) { clearInterval(z.tick); z.tick = 0; z.timeUp = true; z.i = z.qs.length; toast('시간이 다 됐어요'); viewQuiz(); return; }
      el.textContent = fmtClock(left);
      el.style.color = left < 5 * 60000 ? 'var(--bad)' : '';
    };
    z.tick = setInterval(() => { if (location.hash !== '#/quiz') { clearInterval(z.tick); z.tick = 0; return; } show(); }, 500);
    show();
  }
  const tq0 = performance.now();
  const next = () => { z.i++; viewQuiz(); scrollTo(0, 0); };
  const after = (ok, mine) => {
    record(q.id, ok); z.res.push({q, ok, ms: performance.now() - tq0});
    $('#fb').innerHTML = `<div class="fb ${ok ? 'ok' : 'bad'}"><div class="ttl">${ic(ok ? 'check' : 'x', 18, 2.2)}${ok ? '맞았어요' : '틀렸어요'}${q.type === 'ox' ? ` · 정답 ${q.a ? 'O' : 'X'}` : ''}</div>${q.e ? `<div style="white-space:pre-line">${inline(q.e)}</div>` : ''}</div>
      <div id="why"></div><div class="row">${!ok && aiOn() ? `<button class="btn gem" id="whyb">${ic('spark', 18)}왜 틀렸는지 묻기</button>` : ''}<span class="grow"></span><button class="btn pri" id="next">${z.i + 1 < z.qs.length ? '다음 문제' : '결과 보기'}</button></div>`;
    $('#next').onclick = next; $('#next').focus({preventScroll: true});
    $('#whyb') && ($('#whyb').onclick = async () => {
      busy($('#whyb'), '설명 받는 중…');
      try {
        const t = await gem(`법무사 시험 문제를 틀렸다. 내가 고른 답이 왜 틀렸고 정답이 왜 맞는지(근거 조문·판례), 다음에 헷갈리지 않을 기억법 한 줄까지 짧게(마크다운 6줄 안팎) 설명해 줘.\n문제: ${q.q}\n${q.type === 'mcq' ? '보기: ' + q.c.map((c, i) => `${i + 1}) ${c}`).join(' / ') + '\n' : ''}내 답: ${mine}\n정답: ${answerText(q)}\n해설: ${q.e || ''}`);
        $('#why').innerHTML = `<div class="card ai" style="box-shadow:none"><div class="md">${md(t)}</div></div>`;
        $('#whyb').remove();
      } catch (e) { toast(e.message); unbusy($('#whyb')); }
    });
  };
  main_.querySelectorAll('.choice').forEach(b => b.onclick = () => {
    if (main_.querySelector('.choice:disabled')) return;
    const c = +b.dataset.c, right = q.type === 'mcq' ? q.a : (q.a ? 1 : 0), rights = q.alt?.length ? q.alt : [right];   // 복수 정답
    main_.querySelectorAll('.choice').forEach(x => { x.disabled = true; if (rights.includes(+x.dataset.c)) x.classList.add('ok'); });
    if (!rights.includes(c)) b.classList.add('bad');
    after(rights.includes(c), q.type === 'mcq' ? q.c[c] : c ? 'O' : 'X');
  });
  if (q.type !== 'short') return;
  const reveal = (extra = '', rec = null) => {
    const mine = norm($('#ans').value), hits = q.k.filter(k => mine.includes(norm(k)));
    $('#ans').readOnly = true;
    main_.querySelectorAll('#grade,#show,#photob').forEach(b => b.remove());
    $('#fb').innerHTML = `${extra}<div class="box"><h3>모범 답안</h3><div>${inline(q.a)}</div><div style="margin-top:10px">${q.k.map(k => `<span class="kw ${hits.includes(k) ? 'hit' : ''}">${esc(k)}</span>`).join('')}</div>
      ${mine ? `<div class="faint" style="margin-top:8px">핵심어 ${hits.length}/${q.k.length}개를 썼어요</div>` : ''}</div>
      <div class="row"><span class="grow muted">스스로 채점</span><button class="btn ${rec === false ? 'pri' : ''}" id="sb">몰랐어요</button><button class="btn ${rec === false ? '' : 'pri'}" id="sg">맞혔어요</button></div>`;
    $('#sg').onclick = () => { z.res.push({q, ok: true}); record(q.id, true); next(); };
    $('#sb').onclick = () => { z.res.push({q, ok: false}); record(q.id, false); next(); };
  };
  $('#show').onclick = () => reveal();
  const rubric = `너는 법무사 2차 시험 채점위원이다. 쟁점 파악·법리(조문·판례)·사안 적용·결론을 기준으로 10점 만점으로 엄정하지만 친절하게 채점한다.\n문제: ${q.q}\n모범 답안: ${q.a}\n채점 핵심어: ${q.k.join(', ')}`;
  const ask = '\n\nscore(0~10 정수), good(잘 쓴 점), missing(빠졌거나 틀린 점), improved(학생 답의 표현을 살려 고쳐 쓴 답안), comment(한 줄 총평)';
  const shown = g => {
    const sc = Math.max(0, Math.min(10, g.score | 0));
    reveal(`<div class="card ai" style="box-shadow:none;margin-top:16px"><div class="ai-head"><div class="mark">${ic('spark', 18)}</div><div class="grade grow"><b>${sc}</b><span class="faint">/ 10</span></div><span class="tag ${sc >= 7 ? 'ok' : sc >= 4 ? 'warn' : 'bad'}">${esc(g.comment)}</span></div>
      ${g.good?.length ? `<div class="md"><b>잘 쓴 점</b><ul>${g.good.map(x => `<li>${inline(x)}</li>`).join('')}</ul></div>` : ''}
      ${g.missing?.length ? `<div class="md"><b>빠진 점</b><ul>${g.missing.map(x => `<li>${inline(x)}</li>`).join('')}</ul></div>` : ''}
      <div class="box" style="margin-bottom:0"><h3>고쳐 쓴 답안</h3>${inline(g.improved)}</div></div>`, sc >= 7);
  };
  const busyAll = (btn, t) => { busy(btn, t); main_.querySelectorAll('#grade,#photob,#show').forEach(b => b.disabled = true); };
  const freeAll = btn => { unbusy(btn); main_.querySelectorAll('#grade,#photob,#show').forEach(b => b.disabled = false); };
  $('#grade') && ($('#grade').onclick = async () => {
    const mine = $('#ans').value.trim();
    if (!mine) return toast('답을 먼저 써 주세요');
    busyAll($('#grade'), '채점하는 중…');
    try { shown(await gem(`${rubric}\n학생 답안: ${mine}${ask}`, {schema: GRADE_S, temp: .2})); }
    catch (e) { toast(e.message); freeAll($('#grade')); }
  });
  // 손으로 쓴 답안 사진: Gemini 가 글을 옮겨 적고 같은 기준으로 채점한다(시험은 손으로 쓰니까)
  $('#photob') && ($('#photob').onclick = () => $('#photo').click());
  $('#photo') && ($('#photo').onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    busyAll($('#photob'), '사진 읽고 채점하는 중…');
    try {
      const img = await shrinkPhoto(f);
      const g = await gem({parts: [{inline_data: {mime_type: img.type || mimeOf(f), data: await b64(img)}}, {text: `${rubric}\n학생 답안: 사진 속 손글씨. 먼저 transcript 에 보이는 그대로 옮겨 적고(못 읽는 글자는 [?]), 그 글로 채점한다. 글씨를 못 알아봐서 깎지는 않는다.${ask}`}]}, {schema: HAND_S, temp: .2});
      $('#ans').value = g.transcript || '';
      shown(g);
    } catch (err) { toast(err.message); freeAll($('#photob')); }
    e.target.value = '';
  });
}
// 1차 합격 기준: 매 과목(시험 과목 묶음) 40점 이상 + 전 과목 총득점 고득점순(법무사규칙 제13조).
// 최근 합격선(400점 만점을 평균 100점으로 환산): 제29회 59.5 · 제30회 60.0 · 제31회 64.5
const EXAM_CUTS = [[29, 59.5], [30, 60.0], [31, 64.5]];
function examGroupOf(sid) {
  for (const st of ['1', '2']) for (const g of state.cfgStages?.[st] || []) if (g.parts.some(([id]) => id === sid)) return {st, no: g.no, name: g.name, parts: g.parts};
  return null;
}
// 기출을 풀었으면 과목별 환산 점수(정답률×100)와 과락(40점 미만)을 보여 준다
function examScoreHtml(res) {
  const ex = res.filter(r => r.q.exam && r.q.sid);
  if (ex.length < 5) return '';
  const by = new Map();
  for (const r of ex) { const b = by.get(r.q.sid) || by.set(r.q.sid, {n: 0, ok: 0}).get(r.q.sid); b.n++; if (r.ok) b.ok++; }
  const groups = new Map();
  for (const [sid, b] of by) {
    const g = examGroupOf(sid), key = g ? `${g.st}-${g.no}` : sid;
    const G = groups.get(key) || groups.set(key, {name: g ? `제${g.st}차 ${g.name}` : (subjById(sid)?.name || sid), parts: []}).get(key);
    G.parts.push({sid, ...b, w: g ? (g.parts.find(p => p[0] === sid)?.[1] || 50) : 100});
  }
  const rows = [...groups.values()].map(G => {
    const wSum = G.parts.reduce((a, p) => a + p.w, 0);
    const score = Math.round(G.parts.reduce((a, p) => a + p.ok / p.n * p.w, 0) / wSum * 100);
    return {...G, score, detail: G.parts.map(p => `${esc(subjById(p.sid)?.name || p.sid)} ${p.ok}/${p.n}`).join(' · ')};
  });
  const avg = Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length);
  const cut = EXAM_CUTS.at(-1)[1];
  return `<div class="sect">과목별 환산 점수 (100점 만점 기준)</div><div class="card"><table class="plan">
    ${rows.map(r => `<tr><td>${r.name}</td><td><b style="color:${r.score < 40 ? 'var(--bad)' : 'var(--ink)'}">${r.score}점</b>${r.score < 40 ? ' <span class="tag bad">과락</span>' : ''}<span class="faint"> · ${r.detail}</span></td></tr>`).join('')}
    <tr class="today"><td>평균</td><td><b>${avg}점</b><span class="faint"> · 최근 합격선 ${EXAM_CUTS.map(([r, c]) => `${r}회 ${c}`).join(' → ')}점 — 목표 70점</span></td></tr></table>
    <p class="faint" style="margin:10px 0 0">1차 합격은 '매 과목 40점 이상 + 전 과목 총득점 고득점순'(상대평가)이에요. 과목 일부만 풀었으면 정답률로 환산한 추정 점수예요.</p></div>`;
}
function quizEnd() {
  const z = state.quiz, ok = z.res.filter(r => r.ok).length, bad = z.res.filter(r => !r.ok), pct = z.res.length ? Math.round(ok / z.res.length * 100) : 0;
  if (z.tick) { clearInterval(z.tick); z.tick = 0; }
  const withMs = z.res.filter(r => r.ms), avgS = withMs.length ? withMs.reduce((a, r) => a + r.ms, 0) / withMs.length / 1000 : 0;
  render(`<div class="qwrap"><div class="card" style="text-align:center;padding:32px 24px"><div class="eyebrow">결과${z.timeUp ? ' · 시간 끝' : ''}</div>
    <div class="ring" style="--p:${pct}"><div><div><b>${pct}%</b><div class="faint">${ok} / ${z.res.length}${z.timeUp ? ` · ${z.qs.length - z.res.length}문제 못 풂` : ''}</div></div></div></div>
    <p class="muted" style="margin:0">${pct >= 90 ? '아주 좋아요. 이 범위는 거의 잡혔어요.' : pct >= 70 ? '좋아요. 틀린 것만 한 번 더 보면 돼요.' : pct >= 50 ? '절반은 넘었어요. 오답을 노트와 함께 다시 봐요.' : '이 범위는 정리 노트부터 다시 읽고 풀어 봐요.'}${avgS && z.res.some(r => r.q.exam) ? ` 문제당 평균 ${avgS.toFixed(0)}초예요 — 실전 페이스는 72초(교시 120분에 100문제).` : ''}</p></div>
    ${examScoreHtml(z.res)}
    ${bad.length ? `<div class="sect">틀린 문제 ${bad.length}</div>${bad.map(({q}) => `<div class="card" style="padding:18px 20px"><b style="font-family:var(--serif)">${esc(q.q)}</b><div class="faint" style="margin:2px 0 8px">${esc(q.from)}</div><div><span class="tag ok">정답</span> ${q.type === 'short' ? inline(q.a) : esc(answerText(q))}</div>${q.e ? `<div class="muted" style="margin-top:6px">${inline(q.e)}</div>` : ''}</div>`).join('')}` : ''}
    <div class="row" style="margin-top:16px">${bad.length ? '<button class="btn pri" id="badonly">틀린 것만 다시</button>' : ''}<button class="btn ${bad.length ? '' : 'pri'}" id="again">처음부터 다시</button><span class="grow"></span><button class="btn ghost" data-go="${z.back}">끝내기</button></div></div>`);
  $('#again').onclick = () => startQuiz(shuffle(z.qs), z.title, z.back, {limitMin: z.limit / 60000});
  $('#badonly') && ($('#badonly').onclick = () => startQuiz(shuffle(bad.map(r => r.q)), z.title.replace(/ \(오답\)$/, '') + ' (오답)', z.back));
}
