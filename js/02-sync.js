'use strict';
// ── 진도 (기기에 저장 + 구글 드라이브 앱 전용 칸으로 기기끼리 맞추기) ──
// q 문제 기록 · srs 카드·문제 복습 일정 · read 회독 · memo 메모 · mark 책갈피 · my 앱에서 넣은 자료
// extra/cards Gemini·내가 만든 문제·카드 · time 기기별 공부 시간(분) · pref 같이 쓰는 설정
const DEVICE = store.get('device') || (() => { const d = Math.random().toString(36).slice(2, 10); store.set('device', d); return d; })();
const PROG0 = {q: {}, read: {}, exams: {}, extra: {}, extraCut: {}, srs: {}, time: {}, memo: {}, mark: {}, cards: {}, my: {}, pref: {}};
let prog = Object.assign(structuredClone(PROG0), store.get('prog', {}));
const newer = (a = {}, b = {}, k = 't') => { const o = {...a}; for (const [id, v] of Object.entries(b)) { const m = o[id]; if (!m || (v?.[k] || 0) > (m?.[k] || 0)) o[id] = v; } return o; };
function unionBy(a = {}, b = {}, idk, cut = {}, pre = '') {
  const o = {};
  for (const sid of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const m = new Map();
    for (const x of [...(a[sid] || []), ...(b[sid] || [])]) if (x.t > (cut[pre + sid] || 0)) m.set(x[idk], x);
    o[sid] = [...m.values()];
  }
  return o;
}
function mergeProg(a, b) {
  const o = {...structuredClone(PROG0), ...a};
  o.q = newer(a.q, b.q, 'last'); o.srs = newer(a.srs, b.srs, 'last');
  o.read = newer(a.read, b.read); o.memo = newer(a.memo, b.memo); o.mark = newer(a.mark, b.mark);
  o.my = newer(a.my, b.my); o.pref = newer(a.pref, b.pref); o.exams = newer(a.exams, b.exams, 'ts');
  o.extraCut = {...(a.extraCut || {})};
  for (const [k, v] of Object.entries(b.extraCut || {})) o.extraCut[k] = Math.max(o.extraCut[k] || 0, v);
  o.extra = unionBy(a.extra, b.extra, 'xid', o.extraCut);
  o.cards = unionBy(a.cards, b.cards, 'cid', o.extraCut, 'cards:');
  // 공부 시간은 기기마다 따로 쌓고 더해서 본다(같은 시간을 두 번 세지 않게). 이 기기 것은 이 기기가 맞다.
  o.time = {...(a.time || {})};
  for (const [dev, days] of Object.entries(b.time || {})) {
    if (dev === DEVICE) continue;
    const mine = o.time[dev] = {...(o.time[dev] || {})};
    for (const [day, subs] of Object.entries(days)) { mine[day] = {...(mine[day] || {})}; for (const [sid, m] of Object.entries(subs)) mine[day][sid] = Math.max(mine[day][sid] || 0, m); }
  }
  return o;
}
const pref = (k, d) => prog.pref?.[k]?.v ?? d;
function setPref(k, v) { prog.pref[k] = {v, t: Date.now()}; saveProg(); }
// 예전에 이 기기에만 넣어 둔 Gemini 키도 같이 맞춘다. t=1 이라 다른 기기에서 새로 넣은 키가 이긴다.
if (store.get('gemKey', '') && !prog.pref.gemKey) prog.pref.gemKey = {v: store.get('gemKey'), t: 1};
// 손글씨: 강의마다 {t, strokes}. 기기끼리는 강의 단위로 나중에 쓴 쪽이 이긴다.
const INK_FILE = 'dongseo-ink.json';
let ink = {};
const mergeInk = (a, b) => { const o = {...a}; for (const [k, v] of Object.entries(b || {})) if (!o[k] || v.t > o[k].t) o[k] = v; return o; };
function saveInk(uid, strokes) { ink[uid] = {t: Date.now(), strokes}; kvPut('ink', ink); dirty.ink = true; queueSync(); }

// 동기화: 바뀌면 1.5초 뒤 올리고, 앱으로 돌아올 때·1분마다 받아 온다. 드라이브 파일 시각이 그대로면 받지 않는다.
const dirty = {prog: false, ink: false}, seen = {};
let syncTimer, syncing = null, lastSync = 0;
function queueSync(ms = 1500) { clearTimeout(syncTimer); if (GD.valid()) syncTimer = setTimeout(() => syncNow().catch(() => {}), ms); else paintSync(); }
function saveProg() { store.set('prog', prog); dirty.prog = true; queueSync(); }
async function syncFile(name, local, merge, isDirty) {
  const f = await appList(`name='${name}'`);
  if (f && seen[name] === f.modifiedTime && !isDirty) return {data: local, changed: false};
  let data = local, remote = '';
  if (f) { remote = await (await GD.fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`)).text(); try { data = merge(local, JSON.parse(remote)); } catch {} }
  const body = JSON.stringify(data);
  let meta = f;
  if (body !== remote) {
    if (f) meta = await (await GD.fetch(`https://www.googleapis.com/upload/drive/v3/files/${f.id}?uploadType=media&fields=id,modifiedTime`, {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body})).json();
    else {
      const fd = new FormData();
      fd.append('metadata', new Blob([JSON.stringify({name, parents: ['appDataFolder']})], {type: 'application/json'}));
      fd.append('file', new Blob([body], {type: 'application/json'}));
      meta = await (await GD.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime', {method: 'POST', body: fd})).json();
    }
  }
  seen[name] = meta?.modifiedTime;
  return {data, changed: JSON.stringify(local) !== body};
}
async function syncNow() {
  if (!GD.valid()) { paintSync(); return false; }
  if (syncing) return syncing;
  const dp = dirty.prog, di = dirty.ink;
  syncing = (async () => {
    $('#sync').innerHTML = '<span class="spin"></span>맞추는 중';
    dirty.prog = dirty.ink = false;
    const p = await syncFile(PROG_FILE, prog, mergeProg, dp);
    // 올리는 동안 바뀐 것(채점 등)은 받은 것과 합쳐 잃지 않는다. dirty 가 다시 서 있어 다음에 또 올린다.
    prog = dirty.prog ? mergeProg(prog, p.data) : p.data; store.set('prog', prog);
    if (p.changed) state.subs = null;
    const k = await syncFile(INK_FILE, ink, mergeInk, di);
    ink = dirty.ink ? mergeInk(ink, k.data) : k.data; kvPut('ink', ink);
    lastSync = Date.now(); paintSync();
    if (p.changed && !state.inking && !/^#\/quiz/.test(location.hash) && !document.activeElement?.matches('textarea,input')) { const y = scrollY; state.onInk = null; await route(); scrollTo(0, y); }
    else if (k.changed) state.onInk?.();
    return true;
  })().catch(e => { dirty.prog ||= dp; dirty.ink ||= di; if (e instanceof NeedAuth) paintSync(); else $('#sync').textContent = '동기화 실패'; throw e; }).finally(() => syncing = null);
  return syncing;
}
const syncProg = syncNow;
function paintSync() {
  const el = $('#sync');
  el.onclick = null;
  if (!cfg.client) { el.innerHTML = ''; return; }
  if (!GD.valid()) { el.innerHTML = `<button class="btn sm gem" id="synclogin">${cfg.mode === 'drive' ? '다시 연결' : '구글로 시작하기'}</button>`; $('#synclogin').onclick = e => { e.stopPropagation(); startGoogle(); }; return; }
  const d = new Date(lastSync);
  el.innerHTML = lastSync ? `${ic('check', 14, 2.2)}동기화 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
  el.onclick = () => syncNow().catch(e => toast(e.message));
}
// 구글로 시작하기: 로그인 한 번이면 드라이브 자료를 읽고 진도·필기·Gemini 키를 기기끼리 맞춘다
async function startGoogle() {
  try {
    await GD.login();
    if (cfg.mode !== 'drive') { cfg.mode = 'drive'; saveCfg(); }
    GD.lists = {}; state.units = {}; state.summ = {}; state.offline = null;
    await syncNow().catch(() => {});
    await boot();
    toast('구글과 연결했어요. 이제 기기끼리 저절로 맞춰져요');
    return true;
  } catch (e) { toast(e.message); return false; }
}
// 로그인은 한 시간쯤 가므로, 끊겼거나 곧 끊길 때 아무 곳이나 누르면 조용히 이어 간다(팝업은 누를 때만 열 수 있다).
let reauthAt = 0;
document.addEventListener('pointerup', () => {
  if (cfg.mode !== 'drive' || !cfg.client || GD.logging || Date.now() - reauthAt < 60e3) return;
  if (GD.tok && GD.tok.exp - Date.now() > 10 * 60e3) return;
  reauthAt = Date.now();
  const wasOff = !GD.valid();
  GD.login().then(() => { if (wasOff) { state.offline = null; boot(); } else syncNow().catch(() => {}); })
    .catch(() => { reauthAt = Date.now() + 9 * 60e3; paintSync(); });   // 닫았으면 10분은 다시 묻지 않는다
}, true);
const isRead = uid => prog.read[uid]?.on;
const readCount = uid => prog.read[uid]?.on ? Math.max(1, prog.read[uid].n || 1) : 0;   // 회독 수
// 다 읽으면 1회독. 6시간 넘게 지나 다시 끝까지 읽으면 회독이 하나 는다.
function setRead(uid, on) {
  const r = prog.read[uid] || {}, now = Date.now();
  const again = now - (r.at || r.t || 0) > 6 * 36e5;   // 껐다 다시 켜도 6시간 안이면 회독이 늘지 않는다
  const n = on ? (r.on ? (again ? (r.n || 1) + 1 : (r.n || 1)) : r.n && !again ? r.n : (r.n || 0) + 1) : r.n || 0;
  prog.read[uid] = {on, t: now, at: on ? now : r.at, n};
  saveProg(); logActivity();
}
function record(id, ok, grade) {
  const r = prog.q[id] || {n: 0, ok: 0, wrong: 0, streak: 0};
  r.n++; r.last = Date.now();
  if (ok) { r.ok++; r.streak++; } else { r.wrong++; r.streak = 0; r.lastWrong = r.last; }
  prog.q[id] = r;
  srsReview(id, grade ?? (ok ? 3 : 1));   // 문제도 카드처럼 다시 볼 날을 잡는다
  saveProg(); logActivity();
}
// 오늘 공부한 날로 남긴다(연속 기록용). 시간은 집중 타이머가 따로 쌓는다.
function logActivity() { const d = todayKey(); (prog.time[DEVICE] ||= {})[d] ||= {}; prog.time[DEVICE][d]._a = 1; }
const isWrong = id => { const r = prog.q[id]; return r && r.wrong > 0 && r.streak < 2; };
