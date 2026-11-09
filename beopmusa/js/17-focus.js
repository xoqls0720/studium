'use strict';
// ── 공부 시간 ────────────────────────────────────────────────────
// prog.time[기기][날짜][과목id] = 분. 기기마다 따로 쌓아 더한다(02-sync 의 mergeProg).
function addMinutes(sid, min) {
  if (min < .2) return;
  const t = (prog.time[DEVICE] ||= {})[todayKey()] ||= {};
  t[sid || '_'] = Math.round(((t[sid || '_'] || 0) + min) * 10) / 10;
  saveProg();
}
function dayTotals(day) {
  let m = 0, act = false; const by = {};
  for (const dev of Object.values(prog.time || {})) {
    const x = dev?.[day]; if (!x) continue;
    for (const [k, v] of Object.entries(x)) { if (k === '_a') { act = true; continue; } m += v; by[k] = (by[k] || 0) + v; }
  }
  return {m, by, act};
}
const studyMinutes = day => Math.round(dayTotals(day).m);
const dayActive = day => { const t = dayTotals(day); return t.m >= 1 || t.act; };
function streakDays() {
  // 7일 공부할 때마다 '쉬는 날 보호권' 하나: 하루 빈 날은 보호권으로 메워 스트릭이 끊기지 않는다(듀오링고의 스트릭 프리즈)
  const d = new Date(); let n = 0, credit = 0;
  if (!dayActive(todayKey(d))) d.setDate(d.getDate() - 1);   // 오늘은 아직 안 했어도 어제까지 이어지면 센다
  for (let g = 0; g < 3650; g++) {
    if (dayActive(todayKey(d))) { n++; if (n % 7 === 0) credit++; }
    else if (credit > 0 && dayActive(todayKey(new Date(d.getTime() - DAY)))) credit--;
    else break;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
const fmtMin = m => { m = Math.round(m); return m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ' ' + (m % 60) + '분' : ''}` : `${m}분`; };
const mmss = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${s >= 3600 ? Math.floor(s / 3600) + ':' : ''}${pad2(Math.floor(s / 60) % 60)}:${pad2(s % 60)}`; };

// ── 집중 타이머 (뽀모도로·자유) ─────────────────────────────────────
// 시각으로 계산해서 화면이 꺼지거나 앱을 닫아도 이어진다. 자유 모드는 3시간에서 저절로 멈춘다.
const PRESETS = {p25: {t: '25 · 5', f: 25, b: 5}, p50: {t: '50 · 10', f: 50, b: 10}, free: {t: '자유', f: 0, b: 0}};
let T = Object.assign({preset: 'p25', sid: '', phase: 'focus', running: false, start: 0, acc: 0, round: 0}, store.get('timer', {}));
const saveT = () => store.set('timer', T);
const tElapsed = () => T.acc + (T.running ? Date.now() - T.start : 0);
const tLen = () => (T.phase === 'focus' ? PRESETS[T.preset].f : PRESETS[T.preset].b) * 6e4;
function tStart() { if (T.running) return; T.running = true; T.start = Date.now(); saveT(); wake(true); tick(); }
function tPause() { if (!T.running) return; T.acc = tElapsed(); T.running = false; saveT(); commit(); wake(false); tick(); }
function tStop() { if (T.running) { T.acc = tElapsed(); T.running = false; } commit(); T.acc = 0; committed = 0; store.set('timerCommitted', 0); T.phase = 'focus'; T.round = 0; saveT(); wake(false); tick(); }
let committed = store.get('timerCommitted', 0);   // 이미 기록한 집중 시간(ms) — 중복 기록 방지
function commit() {
  if (T.phase !== 'focus') return;
  const el = tElapsed(), ms = el - committed;
  if (ms > 0) addMinutes(T.sid, ms / 6e4);
  committed = el; store.set('timerCommitted', committed);
}
function phaseDone() {
  T.acc = tLen(); T.running = false; commit();
  beep(); navigator.vibrate?.([200, 100, 200]);
  const wasFocus = T.phase === 'focus';
  T.phase = wasFocus ? 'break' : 'focus'; T.acc = 0; committed = 0; store.set('timerCommitted', 0);
  if (wasFocus) T.round++;
  toast(wasFocus ? `${PRESETS[T.preset].f}분 집중 끝! ${PRESETS[T.preset].b}분 쉬어요` : '쉬는 시간 끝, 다시 집중해요');
  T.running = true; T.start = Date.now(); saveT();
}
function tick() {
  if (T.running) {
    const len = tLen();
    if (len && tElapsed() >= len) phaseDone();
    else if (!len && tElapsed() >= 3 * 36e5) { T.running = false; T.acc = 3 * 36e5; tStop(); toast('자유 타이머를 3시간에서 멈췄어요'); }
  }
  const el = $('#tpill');
  if (el) { el.hidden = !T.running && !T.acc; el.innerHTML = `${ic('timer', 14, 2)}${mmss(tLen() ? tLen() - tElapsed() : tElapsed())}`; el.classList.toggle('brk', T.phase === 'break'); }
  state.onTick?.();
}
setInterval(tick, 1000);
// 엄격 모드: 다른 앱으로 가면 멈춘다(열품타처럼)
document.addEventListener('visibilitychange', () => { if (document.hidden && T.running && T.phase === 'focus' && pref('strict', false)) { tPause(); store.set('strictPaused', 1); } else if (document.hidden && T.running) commit(); });
let lock = null;
async function wake(on) { try { if (on && location.hash === '#/focus') lock = await navigator.wakeLock?.request('screen'); else { await lock?.release(); lock = null; } } catch {} }
function beep() {
  try { const a = new (window.AudioContext || window.webkitAudioContext)(); [0, .25, .5].forEach(t => { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(.18, a.currentTime + t); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + t + .2); o.connect(g).connect(a.destination); o.start(a.currentTime + t); o.stop(a.currentTime + t + .22); }); } catch {}
}
(() => { const p = document.createElement('button'); p.id = 'tpill'; p.className = 'tpill'; p.hidden = true; p.onclick = () => location.hash = '#/focus'; $('#sync').before(p); })();

function viewFocus() {
  frame('집중');
  const subs = allSubjects(), p = PRESETS[T.preset];
  const t = dayTotals(todayKey()), goal = pref('goalMin', 480);
  render(`<div class="narrow"><section class="hero" style="text-align:center"><div class="eyebrow">${T.phase === 'focus' ? '집중' : '쉬는 시간'}${T.round ? ` · ${T.round}번째 완료` : ''}</div></section>
    <div class="ring timer" id="tring"><div><div><b id="tclock">00:00</b><div class="faint" id="tsub"></div></div></div></div>
    <div class="row" style="justify-content:center;margin:6px 0 18px" id="tbtns"></div>
    <div class="card"><label class="field"><span>과목</span><div class="opt" id="tsubj"><label><input type="radio" name="ts" value="" ${!T.sid ? 'checked' : ''}>기타</label>${subs.map(s => `<label><input type="radio" name="ts" value="${s.id}" ${T.sid === s.id ? 'checked' : ''}>${esc(s.name)}</label>`).join('')}</div></label>
      <label class="field" style="margin:0"><span>방식</span><div class="opt">${Object.entries(PRESETS).map(([k, v]) => `<label><input type="radio" name="tp" value="${k}" ${T.preset === k ? 'checked' : ''}>${v.t}</label>`).join('')}
        <label><input type="checkbox" id="tstrict" ${pref('strict', false) ? 'checked' : ''}>엄격 모드(다른 앱 가면 멈춤)</label></div></label></div>
    <div class="card"><div class="row"><b class="grow">오늘 ${fmtMin(t.m)} <span class="faint">/ 목표 ${fmtMin(goal)}</span></b><button class="btn sm ghost" id="tgoal">목표 바꾸기</button></div>
      <div class="bar"><i style="width:${Math.min(100, t.m / goal * 100)}%;background:var(--pri)"></i></div>
      ${Object.entries(t.by).sort((a, b) => b[1] - a[1]).map(([sid, m]) => `<div class="row" style="padding:4px 0"><span class="dot" style="--h:${hue(sid)}"></span><span class="grow">${esc(subjById(sid)?.name || '기타')}</span><span class="faint">${fmtMin(m)}</span></div>`).join('') || '<p class="faint" style="margin:0">타이머를 켜면 과목별로 쌓여요.</p>'}</div>
    <p class="faint" style="text-align:center">화면이 꺼지지 않게 잡아 두고, 앱을 닫아도 시간은 이어져요.</p></div>`);
  const paint = () => {
    const len = tLen(), el = tElapsed();
    $('#tclock').textContent = mmss(len ? len - el : el);
    $('#tsub').textContent = len ? `${T.phase === 'focus' ? p.f : p.b}분 중` : '자유 측정';
    $('#tring').style.setProperty('--p', len ? Math.min(100, el / len * 100) : (el / 36e5 * 100) % 100);
    $('#tbtns').innerHTML = T.running ? `<button class="btn" id="tpause">${ic('pause', 18)}잠깐 멈춤</button><button class="btn ghost" id="tstop">끝내기</button>`
      : `<button class="btn pri" id="tgo" style="min-width:140px">${ic('play', 18)}${T.acc ? '이어서' : '시작'}</button>${T.acc ? '<button class="btn ghost" id="tstop">끝내기</button>' : ''}<button class="btn ghost" id="tfull">전체 화면</button>`;
    $('#tgo') && ($('#tgo').onclick = () => { tStart(); paint(); });
    $('#tpause') && ($('#tpause').onclick = () => { tPause(); paint(); });
    $('#tstop') && ($('#tstop').onclick = () => { tStop(); viewFocus(); });
    $('#tfull') && ($('#tfull').onclick = () => document.documentElement.requestFullscreen?.().catch(() => {}));
  };
  state.onTick = () => { if ($('#tclock')) paint(); else state.onTick = null; };
  paint();
  if (T.running) wake(true);
  if (store.get('strictPaused')) { store.set('strictPaused', 0); toast('다른 앱으로 가서 타이머를 멈췄어요'); }
  main_.querySelectorAll('[name=ts]').forEach(r => r.onchange = () => { commit(); T.sid = r.value; saveT(); });
  main_.querySelectorAll('[name=tp]').forEach(r => r.onchange = () => { tStop(); T.preset = r.value; saveT(); viewFocus(); });
  $('#tstrict').onchange = e => setPref('strict', e.target.checked);
  $('#tgoal').onclick = () => { const v = prompt('하루 목표(분)', goal); if (v && +v > 0) { setPref('goalMin', +v); viewFocus(); } };
}

// ── 기록 (통계) ──────────────────────────────────────────────────
function viewStats() {
  frame('기록');
  const days = n => [...Array(n)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (n - 1 - i)); return d; });
  const week = days(7).map(d => ({d, m: studyMinutes(todayKey(d))})), wsum = week.reduce((a, x) => a + x.m, 0), wmax = Math.max(60, ...week.map(x => x.m));
  const qs = Object.values(prog.q), n = qs.reduce((a, r) => a + r.n, 0), ok = qs.reduce((a, r) => a + r.ok, 0);
  // 복습 예보: 앞으로 14일 동안 날마다 돌아올 카드·문제 수
  const fc = days(14).map((_, i) => { const d = new Date(); d.setHours(23, 59, 59, 999); d.setDate(d.getDate() + i); return d; });
  const due = fc.map((d, i) => Object.values(prog.srs).filter(c => c.due <= +d && (i === 0 || c.due > +fc[i - 1])).length), dmax = Math.max(5, ...due);
  const srsAll = Object.values(prog.srs), now = Date.now();
  const memNow = srsAll.length ? Math.round(srsAll.filter(c => retrievability((now - c.last) / DAY, c.s) >= .9).length / srsAll.length * 100) : 0;
  // 과목별: 이번 주 시간, 정답률, 시험 날 기억률 예측
  const subs = allSubjects().map(s => {
    const ids = new Set(s.units.map(u => u.id)), mine = k => ids.has(k.split(':')[0]) || k.split(':')[0] === s.id || k.split(':')[1] === s.id;
    const qq = Object.entries(prog.q).filter(([k]) => mine(k)).map(x => x[1]);
    const cards = Object.entries(prog.srs).filter(([k]) => mine(k.replace(/^c:/, ''))).map(x => x[1]);
    const ex = prog.exams[s.id]?.date, at = ex ? +new Date(ex) : now;
    return {s, min: week.reduce((a, x) => a + (dayTotals(todayKey(x.d)).by[s.id] || 0), 0), acc: qq.reduce((a, r) => a + r.n, 0) ? Math.round(qq.reduce((a, r) => a + r.ok, 0) / qq.reduce((a, r) => a + r.n, 0) * 100) : null,
      ready: cards.length ? Math.round(cards.filter(c => retrievability((at - c.last) / DAY, c.s) >= .9).length / cards.length * 100) : null, ex, cards: cards.length};
  }).filter(x => x.min || x.acc != null || x.cards);
  // 잔디: 20주
  const start = new Date(); start.setDate(start.getDate() - start.getDay() - 7 * 19);
  const cells = [...Array(140)].map((_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return {d, m: d > new Date() ? -1 : studyMinutes(todayKey(d)), a: dayActive(todayKey(d))}; });
  const lvl = c => c.m < 0 ? 'f' : c.m >= 240 ? 4 : c.m >= 120 ? 3 : c.m >= 45 ? 2 : c.m > 0 || c.a ? 1 : 0;
  render(`<section class="hero" style="margin-bottom:22px"><div class="eyebrow">기록</div><h2 class="display">공부 기록</h2></section>
    <div class="stats" style="margin:0 0 16px"><div class="stat"><b>${fmtMin(wsum)}</b><span>최근 7일</span></div><div class="stat"><b style="display:flex;gap:6px;align-items:center">${streakDays()}<span style="color:var(--gold)">${ic('flame', 22)}</span></b><span>연속 공부한 날 · 7일마다 하루 쉬어도 이어져요</span></div><div class="stat"><b>${n ? Math.round(ok / n * 100) + '%' : '—'}</b><span>전체 정답률 · ${n}문제</span></div></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">
      <div class="card"><h2>최근 7일</h2><div class="bars">${week.map(x => `<div class="b"><i style="height:${x.m / wmax * 100}%"></i><span>${WD[x.d.getDay()]}</span><em>${x.m ? fmtMin(x.m) : ''}</em></div>`).join('')}</div></div>
      <div class="card"><h2>복습 예보 · 14일</h2><div class="bars">${due.map((c, i) => `<div class="b"><i style="height:${c / dmax * 100}%;background:var(--gold)"></i><span>${i ? fc[i].getDate() : '오늘'}</span><em>${c || ''}</em></div>`).join('')}</div>
        <p class="faint" style="margin:8px 0 0">지금 90% 넘게 기억하는 카드·문제 ${memNow}% · 전체 ${srsAll.length}개</p></div>
    </div>
    <div class="card"><h2>잔디 · 20주</h2><div class="heat">${cells.map(c => `<i class="l${lvl(c)}" title="${todayKey(c.d)} ${c.m > 0 ? fmtMin(c.m) : ''}"></i>`).join('')}</div>
      <div class="row faint" style="justify-content:flex-end;gap:4px;margin-top:8px">적게 <i class="hl l1"></i><i class="hl l2"></i><i class="hl l3"></i><i class="hl l4"></i> 많이</div></div>
    ${subs.length ? `<div class="card"><h2>과목별</h2><table class="plan"><tr><td class="faint">과목</td><td class="faint">7일</td><td class="faint">정답률</td><td class="faint">${'시험 날 기억률'}</td></tr>${subs.map(x => `<tr><td style="color:var(--ink);width:auto"><span class="dot" style="--h:${hue(x.s.id)};display:inline-block;margin-right:6px"></span>${esc(x.s.name)}</td><td>${fmtMin(x.min)}</td><td>${x.acc == null ? '—' : x.acc + '%'}</td><td>${x.ready == null ? '—' : x.ready + '%'}${x.ex ? ` <span class="faint">(${fmtDate(new Date(x.ex))})</span>` : ''}</td></tr>`).join('')}</table>
      <p class="faint" style="margin:10px 0 0">시험 날 기억률: 지금까지 본 카드·문제 가운데 시험 날에도 90% 넘게 기억할 것으로 예상되는 비율(FSRS).</p></div>` : ''}`);
}
