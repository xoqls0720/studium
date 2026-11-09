'use strict';
// ── 간격 반복 (FSRS-6 기본 가중치) ──────────────────────────────────
// 카드와 문제 모두 '다음에 볼 날'을 기억 안정도(s)·난이도(d)로 잡는다. 목표 기억률은 90%, 시험 30일 전부터 93%.
const W0 = [0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542];
// 내 복습 기록으로 맞춘 가중치(설정 → 복습 간격 맞추기)가 있으면 그것을 쓴다. 기기끼리 pref 로 맞춰진다.
let W = W0, DECAY = -W0[20], FACTOR = Math.pow(0.9, 1 / DECAY) - 1, wSeen;
const LEARN_MIN = 10;
function useW() {
  const p = prog.pref?.fsrsW?.v;
  if (p === wSeen) return;
  wSeen = p; W = Array.isArray(p) && p.length === 21 && p.every(Number.isFinite) ? p : W0;
  DECAY = -W[20]; FACTOR = Math.pow(0.9, 1 / DECAY) - 1;
}
const pad2 = n => String(n).padStart(2, '0');
const todayKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return +d; };
const clampD = d => Math.min(10, Math.max(1, d));
const retrievability = (days, s) => (useW(), Math.pow(1 + FACTOR * days / s, DECAY));
// 시험(직접 넣은 날짜 + 공고·예상 시험일)이 며칠 안에 있는지
const nearExam = days => {
  const ds = Object.values(prog.exams).map(e => e.date);
  if (typeof stageExam === 'function') for (const st of [1, 2]) { try { ds.push(stageExam(st)); } catch {} }
  return ds.some(d => d && ddays(d) >= 0 && ddays(d) <= days);
};
// 시험이 30일 안에 있으면 기억률을 올려 더 자주 보게 한다
const targetR = () => pref('retention', 0) || (nearExam(30) ? .93 : .9);
const ivlDays = s => Math.max(1, Math.round(s / FACTOR * (Math.pow(targetR(), 1 / DECAY) - 1)));
const d0 = g => clampD(W[4] - Math.exp(W[5] * (g - 1)) + 1);

// g: 1 다시 · 2 어려움 · 3 알맞음 · 4 쉬움
function srsNext(c, g, now = Date.now()) {
  useW();
  let s, d;
  if (!c?.s) { s = W[g - 1]; d = d0(g); }
  else {
    const days = Math.max(0, (now - c.last) / DAY), r = retrievability(days, c.s);
    if (days < 1) s = c.s * Math.max(g >= 3 ? 1 : 0, Math.exp(W[17] * (g - 3 + W[18])) * Math.pow(c.s, -W[19]));   // 같은 날 다시 본 경우(알맞음·쉬움이면 줄지 않는다)
    else if (g === 1) s = Math.min(c.s / Math.exp(W[17] * W[18]), W[11] * Math.pow(c.d, -W[12]) * (Math.pow(c.s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)));
    else s = c.s * (1 + Math.exp(W[8]) * (11 - c.d) * Math.pow(c.s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * (g === 2 ? W[15] : 1) * (g === 4 ? W[16] : 1));
    const dd = -W[6] * (g - 3);
    d = clampD(W[7] * d0(4) + (1 - W[7]) * (c.d + dd * (10 - c.d) / 9));
  }
  const days = ivlDays(s);
  const due = g === 1 ? now + LEARN_MIN * 6e4 : now + (days > 2 ? balanceDay(days, now) : days) * DAY;
  return {s: Math.max(.1, s), d, due, last: now, reps: (c?.reps || 0) + 1, lapses: (c?.lapses || 0) + (g === 1 && c?.s ? 1 : 0), first: c?.first || todayKey()};
}
// 복습량 고르게: 간격의 앞뒤 며칠 가운데 복습이 덜 몰린 날로, 쉬는 요일(설정)은 피한다(Anki 의 load balance · Easy Days)
let loadMap = null;
function dueLoad() {
  if (loadMap) return loadMap;
  loadMap = new Map();
  for (const c of Object.values(prog.srs)) { const k = todayKey(new Date(c.due)); loadMap.set(k, (loadMap.get(k) || 0) + 1); }
  return loadMap;
}
function balanceDay(days, now) {
  const rest = pref('restDays', []), span = days < 7 ? 1 : days < 20 ? Math.max(1, Math.round(days * .1)) : Math.max(2, Math.round(days * .05));
  const at = n => new Date(now + n * DAY), load = dueLoad();
  let best = days, bestCost = Infinity;
  // 쉬는 요일이 범위를 다 덮으면 범위를 넓혀서라도 피한다(일주일이면 반드시 빈 요일이 있다)
  for (let w = span; w <= span + 7 && bestCost === Infinity; w++) {
    for (let n = Math.max(1, days - w); n <= days + w; n++) {
      if (rest.includes(at(n).getDay())) continue;
      const cost = (load.get(todayKey(at(n))) || 0) + Math.abs(n - days) * .01;   // 같으면 원래 간격에 가까운 날
      if (cost < bestCost) { bestCost = cost; best = n; }
    }
  }
  return best;
}
// 복습 기록: [id, 초, 단추 1~4, 이 복습 전 횟수]. 내 기록으로 간격을 맞출 때 쓴다(기기에 두고 10분마다 드라이브로 모은다).
let rlog = [];
function srsReview(id, g) {
  const c = prog.srs[id];
  rlog.push([id, Math.round(Date.now() / 1000), g, c?.reps || 0]);
  if (rlog.length > 40000) rlog = rlog.slice(-40000);
  kvPut('rlog', rlog); dirty.rlog = true;
  prog.srs[id] = srsNext(c, g); loadMap = null;
}
// 자주 틀리는 것(상습): 문제는 3번 넘게 틀림, 카드는 4번 넘게 잊음
const isLeech = id => (prog.q[id]?.wrong || 0) >= 3 || (prog.srs[id]?.lapses || 0) >= 4;
// 단추 위에 보여 줄 다음 간격
function srsPreview(id) {
  return [1, 2, 3, 4].map(g => { const n = srsNext(prog.srs[id], g); const m = (n.due - Date.now()) / 6e4; return m < 60 ? `${Math.round(m)}분` : m < 1440 ? `${Math.round(m / 60)}시간` : m < 43200 ? `${Math.round(m / 1440)}일` : `${(m / 43200).toFixed(1)}달`; });
}
const isDue = id => { const c = prog.srs[id]; return c && c.due <= endOfToday(); };
const introducedToday = () => Object.entries(prog.srs).filter(([k, c]) => k.startsWith('c:') && c.first === todayKey() && c.reps).length;   // 새 카드만(문제·지문은 세지 않는다)

// ── 카드 만들기: 용어 카드 + 핵심 문장 빈칸 카드 + 내가 만든 카드 ──
function cardsOf(s, u, d) {
  const out = [], base = {from: u.title, sid: s.id, uid: u.id};
  (d.terms || []).forEach((t, i) => out.push({id: `c:${u.id}:t${i}`, kind: '용어', f: t.t, b: t.d, ...base}));
  const terms = (d.terms || []).map(t => t.t.replace(/\s*[(（].*?[)）]/g, '').trim()).filter(t => t.length >= 2).sort((a, b) => b.length - a.length);
  (d.points || []).forEach((p, i) => {
    const t = terms.find(t => p.includes(t));
    if (t) out.push({id: `c:${u.id}:z${i}`, kind: '빈칸', f: p.replace(t, '［　？　］'), b: t, full: p, ...base});
  });
  // 조문 빈칸: 요건·기간·주체 낱말을 가린다
  (d.cloze || []).forEach(z => { if (z.blanks?.length) out.push({id: `c:${u.id}:a${z.k}`, kind: '조문', f: `${z.law || ''} ${z.no}${z.title ? `(${z.title})` : ''}
${blankOut(z.text, z.blanks)}`, b: z.blanks.join(' · '), full: z.text, blanks: z.blanks, ...base}); });
  // 판례: 사건번호·쟁점 → 결론, 그리고 요지 빈칸
  (d.cases || []).forEach(c => {
    const tag = {jeonhap: c.jeonhap, overrule: c.overrule, date: c.date};
    out.push({id: `c:${u.id}:p${c.id}`, kind: '판례', f: `대법원 ${c.date} ${c.no}${c.jeonhap ? ' (전원합의체)' : ''}
쟁점: ${c.issue}`, b: c.holding, ...tag, ...base});
    if (c.blanks?.length) out.push({id: `c:${u.id}:q${c.id}`, kind: '판례 빈칸', f: `${c.no} 요지
${blankOut(c.cloze, c.blanks)}`, b: c.blanks.join(' · '), full: c.cloze, blanks: c.blanks, ...tag, ...base});
  });
  for (const c of prog.cards[s.id] || []) if (c.uid === u.id) out.push(myCard(s, c, base));
  return out;
}
const blankOut = (t, bl) => bl.reduce((x, b, i) => x.split(b).join(`［ ${'①②③④⑤'[i] || '？'} ］`), String(t || ''));
// 내가 만든 카드. 글을 골라 만든 빈칸 카드는 full 이 있고 kind 가 없다.
const myCard = (s, c, base) => ({id: `c:${s.id}:${c.cid}`, mine: !c.by, kind: c.kind || (c.full ? '빈칸' : c.by === 'gem' ? 'Gemini' : '내 카드'), f: c.f, b: c.b, full: c.full, blanks: c.blanks, jeonhap: c.jeonhap, overrule: c.overrule, date: c.date, ...base});
function looseCards(s) {  // 단원에 묶이지 않은 내 카드
  return (prog.cards[s.id] || []).filter(c => !c.uid).map(c => myCard(s, c, {from: c.from || s.name, sid: s.id}));
}
async function deckOf(s, {onlyRead = false} = {}) {
  const out = [];
  for (const u of s.units.filter(u => u.ready)) {
    if (!onlyRead || isRead(u.id) || hasSrs(u.id)) { try { out.push(...cardsOf(s, u, await loadUnit(s, u))); } catch {} }
    else for (const c of prog.cards[s.id] || []) if (c.uid === u.id && !c.by) out.push(myCard(s, c, {from: u.title, sid: s.id, uid: u.id}));   // 아직 안 읽은 단원이라도 내가 만든 카드는
  }
  return [...out, ...looseCards(s)];
}
const hasSrs = uid => Object.keys(prog.srs).some(k => k.startsWith(`c:${uid}:`));

// 오늘 볼 것: 때가 된 카드·문제·기출 지문 + 새 카드(읽은 단원에서, 하루 한도까지). 과목을 섞어 번갈아 낸다.
async function todayQueue() {
  const subs = allSubjects(), due = [], fresh = [];
  for (const s of subs) {
    for (const c of await deckOf(s, {onlyRead: true})) (prog.srs[c.id] ? (isDue(c.id) && due.push(c)) : fresh.push(c));
  }
  // 시험 14일 전부터는 새 카드를 멈추고 복습만(막판에 외울 양이 불어나지 않게 — 설정에서 끌 수 있어요)
  const stopNew = pref('stopNewNear', true) && nearExam(14);
  const left = stopNew ? 0 : Math.max(0, pref('newPerDay', 20) - introducedToday());
  due.sort((a, b) => prog.srs[a.id].due - prog.srs[b.id].due);
  // 내가 직접 만든 카드는 먼저 들어온다(외우려고 고른 것이라)
  return {due, fresh: [...fresh.filter(c => c.mine), ...interleave(fresh.filter(c => !c.mine))].slice(0, left), freshTotal: fresh.length, stopNew};
}
function interleave(list) {
  const by = new Map();
  for (const x of list) (by.get(x.sid) || by.set(x.sid, []).get(x.sid)).push(x);
  const qs = [...by.values()], out = [];
  for (let i = 0; qs.some(q => q.length); i++) { const q = qs[i % qs.length]; if (q.length) out.push(q.shift()); }
  return out;
}
async function dueQuestions() {
  const out = await examQuestionsById(Object.keys(prog.srs).filter(k => isExamQId(k) && isDue(k)));
  for (const s of allSubjects()) {
    const ids = new Set(Object.keys(prog.srs).filter(k => !k.startsWith('c:') && !isOxId(k) && !isExamQId(k) && isDue(k)));
    if (!ids.size) continue;
    const uids = s.units.filter(u => [...ids].some(k => k.startsWith(u.id + ':'))).map(u => u.id);
    const mine = [...ids].some(k => k.startsWith(s.id + ':'));
    if (!uids.length && !mine) continue;
    out.push(...[...(await poolOf(s, uids, {summary: mine, extra: false})), ...extraQuestions(s, null)].filter(q => ids.has(q.id)));
  }
  return out;
}

// ── 내 기록으로 복습 간격 맞추기 (FSRS 매개변수 최적화, Anki 의 'Optimize' 와 같은 일) ──
// 처음 본 때부터 기록이 있는 카드·문제만 쓴다. 하루 넘게 지나 다시 볼 때마다 '기억할 확률'을 예측해 실제(다시 = 잊음)와 맞춘다.
// 화면이 멈추지 않게 Worker 에서 계산하고, 떼어 둔 20%에서 기본값·지금 값보다 나을 때만 쓴다.
const FIT_MIN = 1000;
const W_LO = [.001, .001, .001, .001, 1, .001, .001, .001, 0, 0, .001, .001, .001, .001, 0, 0, 1, 0, 0, 0, .1];
const W_HI = [100, 100, 100, 100, 10, 4, 4, .75, 4.5, .8, 3.5, 5, .25, .9, 4, 1, 6, 2, 2, .8, .8];
function fitSeqs(log = rlog) {
  const by = new Map();
  for (const [id, t, g, n] of log) (by.get(id) || by.set(id, []).get(id)).push([t / 86400, g, n]);
  const seqs = [];
  for (const rs of by.values()) { rs.sort((a, b) => a[0] - b[0]); if (rs[0][2] === 0 && rs.length > 1) seqs.push(rs.map(([t, g]) => [t, g])); }
  return seqs;
}
const fitCount = (seqs = fitSeqs()) => seqs.reduce((n, s) => n + s.filter((r, i) => i && r[0] - s[i - 1][0] >= 1).length, 0);
function fsrsFitWorker() {
  self.onmessage = e => {
    const {seqs, w0, cur, lo, hi} = e.data, train = [], test = [];
    seqs.forEach((s, i) => ((Math.imul(i + 1, 2654435761) >>> 0) % 5 ? train : test).push(s));
    const loss = (w, set) => {
      const decay = -w[20], factor = Math.pow(.9, 1 / decay) - 1, cl = d => Math.min(10, Math.max(1, d)), d0 = g => cl(w[4] - Math.exp(w[5] * (g - 1)) + 1);
      let sum = 0, n = 0;
      for (const seq of set) {
        let s = Math.max(.1, w[seq[0][1] - 1]), d = d0(seq[0][1]), last = seq[0][0];
        for (let i = 1; i < seq.length; i++) {
          const [t, g] = seq[i], days = t - last;
          if (days < 1) s = s * Math.max(g >= 3 ? 1 : 0, Math.exp(w[17] * (g - 3 + w[18])) * Math.pow(s, -w[19]));
          else {
            const r = Math.pow(1 + factor * days / s, decay), p = Math.min(1 - 1e-6, Math.max(1e-6, r));
            sum -= g > 1 ? Math.log(p) : Math.log(1 - p); n++;
            if (g === 1) s = Math.min(s / Math.exp(w[17] * w[18]), w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r)));
            else s = s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp(w[10] * (1 - r)) - 1) * (g === 2 ? w[15] : 1) * (g === 4 ? w[16] : 1));
          }
          s = Math.max(.1, s); d = cl(w[7] * d0(4) + (1 - w[7]) * (d - w[6] * (g - 3) * (10 - d) / 9)); last = t;
        }
      }
      return {l: n ? sum / n : 0, n};
    };
    const span = lo.map((l, i) => hi[i] - l), toW = x => x.map((v, i) => lo[i] + Math.min(1, Math.max(0, v)) * span[i]);
    const x0 = w0.map((v, i) => (v - lo[i]) / span[i]);
    const f = x => loss(toW(x), train).l + .02 * x.reduce((a, v, i) => a + (v - x0[i]) ** 2, 0);   // 기본값에서 너무 멀어지지 않게
    let x = x0.slice(), best = x.slice(), bestF = f(x);
    const m = x.map(() => 0), v = x.map(() => 0), IT = 80, h = 1e-3, lr = .02;
    for (let k = 1; k <= IT; k++) {
      const gr = x.map((_, i) => { const a = x.slice(), b = x.slice(); a[i] += h; b[i] -= h; return (f(a) - f(b)) / (2 * h); });
      x = x.map((xi, i) => { m[i] = .9 * m[i] + .1 * gr[i]; v[i] = .999 * v[i] + .001 * gr[i] ** 2; return Math.min(1, Math.max(0, xi - lr * (m[i] / (1 - .9 ** k)) / (Math.sqrt(v[i] / (1 - .999 ** k)) + 1e-8))); });
      const fx = f(x); if (fx < bestF) { bestF = fx; best = x.slice(); }
      self.postMessage({progress: k / IT});
    }
    const w = toW(best).map(v => +v.toFixed(4)), te = loss(w, test);
    self.postMessage({done: true, w, fit: te.l, base: loss(w0, test).l, cur: loss(cur, test).l, nTest: te.n, nTrain: loss(w, train).n});
  };
}
// onProgress(0~1). 결과: {used: 맞춘 값을 쓰는지, fit, base, n}
async function fitFsrs(onProgress) {
  const seqs = fitSeqs(await allRlog().catch(() => rlog)), n = fitCount(seqs);   // 다른 기기의 기록도 모아서
  if (n < FIT_MIN) throw new Error(`복습 기록이 ${n}개예요. ${FIT_MIN}개부터 맞출 수 있어요`);
  useW();
  const url = URL.createObjectURL(new Blob([`(${fsrsFitWorker})()`], {type: 'text/javascript'})), wk = new Worker(url);
  try {
    const r = await new Promise((ok, no) => {
      wk.onmessage = e => e.data.done ? ok(e.data) : onProgress?.(e.data.progress);
      wk.onerror = e => no(new Error('계산하다 멈췄어요: ' + (e.message || '')));
      wk.postMessage({seqs, w0: W0, cur: W, lo: W_LO, hi: W_HI});
    });
    // 떼어 둔 기록에서 예측이 기본값·지금 값보다 확실히 나을 때만 바꾼다
    const used = r.fit < Math.min(r.base, r.cur) - .002;
    if (used) setPref('fsrsW', r.w);
    setPref('fsrsFit', {at: Date.now(), n, used: used || W !== W0, fit: r.fit, base: r.base});
    return {used, fit: r.fit, base: r.base, n};
  } finally { wk.terminate(); URL.revokeObjectURL(url); }
}
function fitStatus() {
  const n = fitCount(), f = pref('fsrsFit', null);
  return `${prog.pref.fsrsW?.v ? `내 기록으로 맞춘 값을 써요${f?.at ? ` (${new Date(f.at).toLocaleDateString('ko-KR')})` : ''}` : '기본값을 써요'} · 이 기기의 쓸 수 있는 복습 기록 ${n}개 (모든 기기 합쳐 ${FIT_MIN}개부터)`;
}
