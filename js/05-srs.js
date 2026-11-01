'use strict';
// ── 간격 반복 (FSRS-6 기본 가중치) ──────────────────────────────────
// 카드와 문제 모두 '다음에 볼 날'을 기억 안정도(s)·난이도(d)로 잡는다. 목표 기억률은 90%, 시험 30일 전부터 93%.
const W = [0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542];
const DECAY = -W[20], FACTOR = Math.pow(0.9, 1 / DECAY) - 1, LEARN_MIN = 10;
const pad2 = n => String(n).padStart(2, '0');
const todayKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return +d; };
const clampD = d => Math.min(10, Math.max(1, d));
const retrievability = (days, s) => Math.pow(1 + FACTOR * days / s, DECAY);
// 시험이 30일 안에 있으면 기억률을 올려 더 자주 보게 한다
const targetR = () => pref('retention', 0) || (Object.values(prog.exams).some(e => e.date && ddays(e.date) >= 0 && ddays(e.date) <= 30) ? .93 : .9);
const ivlDays = s => Math.max(1, Math.round(s / FACTOR * (Math.pow(targetR(), 1 / DECAY) - 1)));
const d0 = g => clampD(W[4] - Math.exp(W[5] * (g - 1)) + 1);

// g: 1 다시 · 2 어려움 · 3 알맞음 · 4 쉬움
function srsNext(c, g, now = Date.now()) {
  let s, d;
  if (!c?.s) { s = W[g - 1]; d = d0(g); }
  else {
    const days = Math.max(0, (now - c.last) / DAY), r = retrievability(days, c.s);
    if (days < 1) s = c.s * Math.exp(W[17] * (g - 3 + W[18])) * Math.pow(c.s, -W[19]);   // 같은 날 다시 본 경우
    else if (g === 1) s = Math.min(c.s / Math.exp(W[17] * W[18]), W[11] * Math.pow(c.d, -W[12]) * (Math.pow(c.s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)));
    else s = c.s * (1 + Math.exp(W[8]) * (11 - c.d) * Math.pow(c.s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * (g === 2 ? W[15] : 1) * (g === 4 ? W[16] : 1));
    const dd = -W[6] * (g - 3);
    d = clampD(W[7] * d0(4) + (1 - W[7]) * (c.d + dd * (10 - c.d) / 9));
  }
  let days = ivlDays(s);
  if (days > 3) days = Math.round(days * (0.95 + Math.random() * 0.1));
  const due = g === 1 ? now + LEARN_MIN * 6e4 : now + days * DAY;
  return {s: Math.max(.1, s), d, due, last: now, reps: (c?.reps || 0) + 1, lapses: (c?.lapses || 0) + (g === 1 && c?.s ? 1 : 0), first: c?.first || todayKey()};
}
function srsReview(id, g) { prog.srs[id] = srsNext(prog.srs[id], g); }
// 단추 위에 보여 줄 다음 간격
function srsPreview(id) {
  return [1, 2, 3, 4].map(g => { const n = srsNext(prog.srs[id], g); const m = (n.due - Date.now()) / 6e4; return m < 60 ? `${Math.round(m)}분` : m < 1440 ? `${Math.round(m / 60)}시간` : m < 43200 ? `${Math.round(m / 1440)}일` : `${(m / 43200).toFixed(1)}달`; });
}
const isDue = id => { const c = prog.srs[id]; return c && c.due <= endOfToday(); };
const introducedToday = () => Object.entries(prog.srs).filter(([k, c]) => k.startsWith('c:') && c.first === todayKey() && c.reps).length;   // 새 카드만(문제는 세지 않는다)

// ── 카드 만들기: 용어 카드 + 핵심 문장 빈칸 카드 + 내가 만든 카드 ──
function cardsOf(s, u, d) {
  const out = [], base = {from: u.title, sid: s.id, uid: u.id};
  (d.terms || []).forEach((t, i) => out.push({id: `c:${u.id}:t${i}`, kind: '용어', f: t.t, b: t.d, ...base}));
  const terms = (d.terms || []).map(t => t.t.replace(/\s*[(（].*?[)）]/g, '').trim()).filter(t => t.length >= 2).sort((a, b) => b.length - a.length);
  (d.points || []).forEach((p, i) => {
    const t = terms.find(t => p.includes(t));
    if (t) out.push({id: `c:${u.id}:z${i}`, kind: '빈칸', f: p.replace(t, '［　？　］'), b: t, full: p, ...base});
  });
  for (const c of prog.cards[s.id] || []) if (c.uid === u.id) out.push({id: `c:${s.id}:${c.cid}`, kind: c.by === 'gem' ? 'Gemini' : '내 카드', f: c.f, b: c.b, ...base});
  return out;
}
function looseCards(s) {  // 강의에 묶이지 않은 내 카드
  return (prog.cards[s.id] || []).filter(c => !c.uid).map(c => ({id: `c:${s.id}:${c.cid}`, kind: c.by === 'gem' ? 'Gemini' : '내 카드', f: c.f, b: c.b, from: s.name, sid: s.id}));
}
async function deckOf(s, {onlyRead = false} = {}) {
  const out = [];
  for (const u of s.units.filter(u => u.ready && (!onlyRead || isRead(u.id) || hasSrs(u.id)))) {
    try { out.push(...cardsOf(s, u, await loadUnit(s, u))); } catch {}
  }
  return [...out, ...looseCards(s)];
}
const hasSrs = uid => Object.keys(prog.srs).some(k => k.startsWith(`c:${uid}:`));

// 오늘 볼 것: 때가 된 카드·문제 + 새 카드(읽은 강의에서, 하루 한도까지). 과목을 섞어 번갈아 낸다.
async function todayQueue() {
  const subs = allSubjects(), due = [], fresh = [];
  for (const s of subs) {
    for (const c of await deckOf(s, {onlyRead: true})) (prog.srs[c.id] ? (isDue(c.id) && due.push(c)) : fresh.push(c));
  }
  const left = Math.max(0, pref('newPerDay', 20) - introducedToday());
  due.sort((a, b) => prog.srs[a.id].due - prog.srs[b.id].due);
  return {due, fresh: interleave(fresh).slice(0, left), freshTotal: fresh.length};
}
function interleave(list) {
  const by = new Map();
  for (const x of list) (by.get(x.sid) || by.set(x.sid, []).get(x.sid)).push(x);
  const qs = [...by.values()], out = [];
  for (let i = 0; qs.some(q => q.length); i++) { const q = qs[i % qs.length]; if (q.length) out.push(q.shift()); }
  return out;
}
async function dueQuestions() {
  const out = [];
  for (const s of allSubjects()) {
    const ids = new Set(Object.keys(prog.srs).filter(k => !k.startsWith('c:') && isDue(k)));
    if (!ids.size) continue;
    const uids = s.units.filter(u => [...ids].some(k => k.startsWith(u.id + ':'))).map(u => u.id);
    const mine = [...ids].some(k => k.startsWith(s.id + ':'));
    if (!uids.length && !mine) continue;
    out.push(...[...(await poolOf(s, uids, {summary: mine, extra: false})), ...extraQuestions(s, null)].filter(q => ids.has(q.id)));
  }
  return out;
}
