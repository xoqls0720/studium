'use strict';
// ── 상태·자료 ─────────────────────────────────────────────────────
const state = {index: null, units: {}, summ: {}, offline: null, quiz: null, chat: {}, subs: null};
const hue = id => parseInt(String(id).slice(0, 6), 16) % 360;
async function loadIndex(fresh = true) {
  state.offline = null;
  state.index = await readJSON('index.json', {fresh});
  state.subs = null;
  return state.index;
}
// 과목 id: 동서대 강의는 과목 이름, 나머지는 '서재/과목'의 sha1 앞 12자리 (PC 생성기와 같은 규칙)
const sha12 = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s)))].slice(0, 6).map(b => b.toString(16).padStart(2, '0')).join('');
const subjKey = (lib, name) => lib === 'dongseo' ? name : `${lib}/${name}`;

// PC 가 만든 과목(index.json) + 앱에서 넣어 바로 만든 자료(prog.my)를 합친 서재
function allSubjects() {
  if (state.subs) return state.subs;
  const subs = (state.index?.subjects || []).map(s => ({...s, lib: s.lib || 'dongseo', libName: s.libName || '동서대', units: s.units.slice()}));
  for (const [id, m] of Object.entries(prog.my || {}).sort((a, b) => a[1].t - b[1].t)) {
    if (m.del) continue;
    let s = subs.find(x => x.id === m.sid);
    if (!s) subs.push(s = {id: m.sid, lib: m.lib, libName: m.libName, name: m.subject, folder: m.folder, units: [], pdf: {}, summary: false, mine: true});
    if (!s.units.some(u => u.id === id)) s.units.push({id, title: m.title, file: m.file, order: [999, m.t], ready: true, n: m.n || 0, mine: true});
  }
  return state.subs = subs;
}
const libsOf = () => { const m = new Map(); for (const s of allSubjects()) if (!m.has(s.lib)) m.set(s.lib, {id: s.lib, name: s.libName}); return [...m.values()]; };
const subjById = id => allSubjects().find(s => s.id === id);
async function loadUnit(s, u) { return state.units[u.id] ||= await readJSON(`${s.folder}/${u.id}.json`); }
async function loadSummary(s) {
  if (!s.summary) return null;
  return state.summ[s.id] ||= await readJSON(`${s.folder}/_요약집.json`).catch(() => null);
}
function questionsOf(s, u, d) {
  const qs = [];
  (d.mcq || []).forEach((q, i) => qs.push({id: `${u.id}:m${i}`, type: 'mcq', q: q.q, c: q.c, a: q.a, e: q.e, from: u.title, sid: s.id, uid: u.id}));
  (d.ox || []).forEach((q, i) => qs.push({id: `${u.id}:o${i}`, type: 'ox', q: q.q, a: q.a, e: q.e, from: u.title, sid: s.id, uid: u.id}));
  (d.short || []).forEach((q, i) => qs.push({id: `${u.id}:s${i}`, type: 'short', q: q.q, a: q.a, k: q.k || [], from: u.title, sid: s.id, uid: u.id}));
  return qs;
}
function summaryQuestions(s, d) {
  const qs = [];
  (d.mcq || []).forEach((q, i) => qs.push({id: `${s.id}:S:m${i}`, type: 'mcq', q: q.q, c: q.c, a: q.a, e: q.e, from: '요약집 종합', sid: s.id}));
  (d.short || []).forEach((q, i) => qs.push({id: `${s.id}:S:s${i}`, type: 'short', q: q.q, a: q.a, k: q.k || [], from: '요약집 종합', sid: s.id}));
  return qs;
}
function extraQuestions(s, unitIds) {
  return (prog.extra?.[s.id] || []).filter(q => !unitIds || !q.uids?.length || q.uids.some(u => unitIds.includes(u)))
    .map(q => ({...q, id: `${s.id}:X:${q.xid}`, sid: s.id}));
}
async function poolOf(s, unitIds, {summary = false, extra = true} = {}) {
  const qs = [];
  for (const u of s.units.filter(u => u.ready && (!unitIds || unitIds.includes(u.id)))) {
    try { qs.push(...questionsOf(s, u, await loadUnit(s, u))); } catch {}
  }
  if (summary) { const d = await loadSummary(s); if (d) qs.push(...summaryQuestions(s, d)); }
  if (extra) qs.push(...extraQuestions(s, unitIds));
  return qs;
}
function subjStats(s) {
  const ids = new Set(s.units.map(u => u.id));
  let n = 0, ok = 0, wrong = 0;
  for (const [k, r] of Object.entries(prog.q)) {
    const uid = k.split(':')[0];
    if (!ids.has(uid) && uid !== s.id) continue;
    n += r.n; ok += r.ok; if (isWrong(k)) wrong++;
  }
  return {ready: s.units.filter(u => u.ready).length, total: s.units.length, read: s.units.filter(u => isRead(u.id)).length, n, ok, wrong};
}

// Gemini 로 새 문제를 만들어 진도에 담는다(기기끼리 같이 맞춰진다).
async function makeQuestions(s, units, {n = 10, wrong = [], exam = false} = {}) {
  const ctx = [];
  for (const u of units) {
    try {
      const d = await loadUnit(s, u);
      ctx.push(`## ${u.title}\n핵심: ${(d.points || []).join(' / ')}\n용어: ${(d.terms || []).map(t => `${t.t}(${t.d})`).join(', ')}${d.emphasis?.length ? '\n교수 강조: ' + d.emphasis.join(' / ') : ''}`);
    } catch {}
  }
  const sm = await loadSummary(s);
  const have = (await poolOf(s, units.map(u => u.id))).map(q => q.q.slice(0, 45)).slice(0, 80);
  const nm = Math.round(n * .6), no = Math.round(n * .25), ns = Math.max(1, n - nm - no);
  const prompt = `'${s.name}' 대학 과목의 ${exam ? '기말고사 예상 문제' : '연습 문제'}를 만든다. 아래 강의 자료에 있는 내용만으로 풀 수 있어야 한다.
객관식 ${nm}개(c 보기 5개, a 정답 보기 순서 0부터, e 해설), OX ${no}개(a 참이면 true, e 해설), 서술형 ${ns}개(a 모범 답안 3~6문장, k 채점 핵심어 3~6개). 정답 위치는 고르게 섞는다.
${exam ? '실제 대학 시험처럼: 교수가 강조한 내용을 먼저, 개념 비교·적용·사례 판단 문제를 섞고 단순 암기만 묻지 않는다. 난이도는 중상.' : ''}
${wrong.length ? '학생이 아래 문제들을 틀렸다. 같은 개념을 다른 각도에서 묻는 문제를 절반 넘게 넣는다.\n' + wrong.slice(0, 15).map(q => '- ' + q.q).join('\n') : ''}
이미 있는 문제와 겹치지 않게 한다: ${have.join(' / ')}
${sm?.top?.length ? '[과목 핵심]\n' + sm.top.join('\n') : ''}
[강의 자료]
${ctx.join('\n\n').slice(0, 60000)}`;
  const d = await gem(prompt, {schema: QSET_S, temp: .7});
  const t = Date.now(), uids = units.map(u => u.id), from = exam ? 'Gemini 예상 문제' : 'Gemini 새 문제', out = [];
  let i = 0;
  const xid = () => t.toString(36) + '_' + i++;
  for (const q of d.mcq || []) if (Array.isArray(q.c) && q.c.length >= 2 && q.a >= 0 && q.a < q.c.length) out.push({xid: xid(), t, type: 'mcq', q: q.q, c: q.c, a: q.a, e: q.e, from, uids});
  for (const q of d.ox || []) out.push({xid: xid(), t, type: 'ox', q: q.q, a: !!q.a, e: q.e, from, uids});
  for (const q of d.short || []) out.push({xid: xid(), t, type: 'short', q: q.q, a: q.a, k: q.k || [], from, uids});
  (prog.extra[s.id] ||= []).push(...out); saveProg();
  return out.map(q => ({...q, id: `${s.id}:X:${q.xid}`, sid: s.id}));
}
