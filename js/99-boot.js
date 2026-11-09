'use strict';
// ── 길 찾기 ─────────────────────────────────────────────────────
async function route() {
  const h = location.hash || '#/';
  state.onInk = state.onResize = null;
  document.querySelector('.inkbar')?.remove();
  speakStop();
  if (h === '#/set') return viewSettings();
  if (h === '#/connect') return needConnect();
  if (!state.index) { state.index = {subjects: [], events: []}; state.subs = null; }   // 연결 전에도 앱에서 넣은 자료로 쓸 수 있다
  const simple = {'#/quiz': viewQuiz, '#/review': viewReview, '#/cards': viewCards, '#/focus': viewFocus, '#/stats': viewStats, '#/add': viewAdd, '#/search': viewSearch, '#/listen': viewListen};
  if (simple[h]) return simple[h]();
  const m = h.match(/^#\/s\/([^/]+)\/?([^/]*)\/?(.*)$/);
  if (m) {
    const s = subjById(m[1]);
    if (!s) return viewHome();
    const tab = m[2] || 'book';
    if (tab === 'u') return viewUnit(s, m[3]);
    if (tab === 'blank') return viewBlank(s, m[3]);
    if (tab === 'print') return viewPrint(s);
    return ({book: viewBook, cards: viewDeck, summary: viewSummary, quiz: viewQuizSetup, wrong: viewWrong, exam: viewExam, nlm: viewNlm}[tab] || viewBook)(s);
  }
  return viewHome();
}
addEventListener('hashchange', () => { route().catch(e => toast(e.message)); scrollTo(0, 0); });

let lastWake = 0;
async function onWake() {
  if (Date.now() - lastWake < 5000) return;
  lastWake = Date.now();
  syncNow().catch(() => {});
  if (!cfg.mode || Date.now() - (state.loadedAt || 0) < 120e3) return;
  const before = state.index?.updated;
  try {
    GD.lists = {};
    await loadIndex(true); state.loadedAt = Date.now();
    if (state.index.updated !== before) {
      state.units = {}; state.summ = {};
      if (!/^#\/(quiz|listen|s\/[^/]+\/u\/)/.test(location.hash)) { const y = scrollY; await route(); scrollTo(0, y); }
      toast('새 강의 자료가 들어왔어요');
    }
  } catch {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') onWake();
  else if (dirty.prog || dirty.ink) syncNow().catch(() => {});
});
addEventListener('focus', onWake);
addEventListener('online', onWake);
setInterval(() => { if (document.visibilityState === 'visible') syncNow().catch(() => {}); }, 60e3);
// 앱을 켜 둔 채로도 새 자료(생성 결과)를 5분마다 확인해 바로 반영한다
setInterval(() => { if (document.visibilityState === 'visible') { lastWake = 0; onWake(); } }, 300e3);
addEventListener('resize', () => state.onResize?.());

async function boot() {
  setSync('');
  if (cfg.client) GD.gis().catch(() => {});   // 첫 탭에서 바로 로그인 창이 뜨게 미리 받아 둔다
  ink = (await kvGet('ink')) || {};
  rlog = mergeRlog(rlog, (await kvGet('rlog')) || []);
  const cached = await cacheGet('index.json');
  if (cached) { state.index = cached.data; route(); }
  if (!cfg.mode) { if (!cached) route(); paintSync(); syncNow().catch(() => {}); return; }
  if (cfg.mode === 'local' && !(await Local.ready(false))) {
    state.offline = new Error('폴더 권한');
    if (!cached) route();
    return;
  }
  try {
    setSync('새로 확인 중', true);
    GD.lists = {};
    await loadIndex(true);
    state.loadedAt = Date.now();
    state.units = {}; state.summ = {};
    setSync(state.offline ? '받아 둔 자료' : '');
    paintSync();
    if (!/^#\/quiz/.test(location.hash)) route();
    syncNow().catch(() => {});
  } catch (e) {
    setSync('');
    if (!cached) { route(); toast(e instanceof NeedAuth ? '구글 로그인이 필요해요' : e.message); }
    paintSync();
  }
}
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
boot();
