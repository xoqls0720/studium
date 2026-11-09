'use strict';
// ── 법령 개정 알림 · 조문 보기 · 판례 ───────────────────────────────────
// 수집기(GitHub Actions)가 매일 받은 것을 PC 생성기가 '수집/'에 옮겨 둔다.
async function loadUpdates() { return state.upd ||= await readJSON('수집/law_updates.json').catch(() => ({updates: []})); }
async function loadLaw(id) { return (state.laws ||= {})[id] ||= await readJSON(`수집/laws/${id}.json`); }
async function loadCases() { return state.cases ||= await readJSON('수집/cases/recent.json').catch(() => ({cases: []})); }
const artNo = k => { const [a, b] = String(k).split('-'); return `제${a}조${b ? '의' + b : ''}`; };
const recentDays = 365;
// 아직 안 본 개정(최근 1년). 본 것은 prog.seen[법령] = {d: 공포일}
async function unseenUpdates() {
  const u = (await loadUpdates()).updates || [], cut = todayKey(new Date(Date.now() - recentDays * DAY));
  return u.filter(x => x.date >= cut && prog.seen[x.law]?.d !== x.date);
}

async function viewLaws() {
  frame('법령 개정', '#/');
  render(`<div class="card">${thinking()}</div>`);
  const d = await loadUpdates(), ups = d.updates || [], cut = todayKey(new Date(Date.now() - recentDays * DAY));
  const idx = state.index || {}, units = allSubjects().flatMap(s => s.units.filter(u => u.revised).map(u => ({s, u})));
  const recent = ups.filter(x => x.date >= cut), older = ups.filter(x => x.date < cut);
  const row = x => {
    const eff = x.effective && ddays(x.effective);
    const subs = (x.subjects || []).map(id => subjById(id)?.name).filter(Boolean).join(' · ');
    return `<div class="card" style="padding:18px 20px"><div class="row" style="align-items:flex-start"><div class="grow"><b style="font-family:var(--serif);font-size:18px">${esc(x.name)}</b>${prog.seen[x.law]?.d !== x.date && x.date >= cut ? ' <span class="tag bad">새 개정</span>' : ''}
        <div class="faint">${esc(x.kind || '개정')} · 공포 ${esc(x.date)}${x.effective ? ` · 시행 ${esc(x.effective)}${eff > 0 ? ` (${ddayText(eff)})` : ''}` : ''}${subs ? ' · ' + esc(subs) : ''}</div></div>
        <a class="btn sm ghost" href="${esc(x.diff)}" target="_blank" rel="noopener">신구법 비교</a></div>
      ${x.articles?.length ? `<div class="chips" style="margin-top:10px">${x.articles.slice(0, 40).map(k => `<button data-go="#/law/${encodeURIComponent(x.law)}?k=${encodeURIComponent(k)}">${artNo(k)}</button>`).join('')}</div>` : '<div class="faint" style="margin-top:8px">바뀐 조문은 다음 수집 때 비교해서 보여 줘요</div>'}
      ${x.history?.length ? `<div class="faint" style="margin-top:8px">그 전: ${x.history.map(h => `${h.date} ${h.kind}`).join(' · ')}</div>` : ''}
      <div class="row" style="margin-top:10px"><button class="btn sm" data-go="#/law/${encodeURIComponent(x.law)}">조문 보기</button></div></div>`;
  };
  render(`<section class="hero" style="margin-bottom:18px"><div class="eyebrow">법령 개정 알림</div><h2 class="display">바뀐 조문</h2>
    <p class="lede">시험 과목 법령·대법원규칙을 매일 확인해요. 개정되면 그 조문이 든 단원을 다시 만들고, 시험 뒤 개정된 기출 지문에 '개정 주의'를 붙여요.</p></section>
    ${units.length ? `<div class="sect">개정 영향을 받은 단원</div><div class="card" style="padding-top:6px;padding-bottom:6px"><ul class="list">${units.map(({s, u}) => `<li data-go="#/s/${s.id}/u/${u.id}"><span class="tag warn">개정</span><span class="grow"><span class="tt">${esc(u.title)}</span><div class="faint">${esc(s.name)} · ${esc(u.revised.date)} · ${esc((u.revised.arts || []).join(', '))}</div></span><span class="chev">${ic('chev', 16)}</span></li>`).join('')}</ul></div>` : ''}
    <div class="sect">최근 1년 ${recent.length}건</div>${recent.map(row).join('') || '<div class="card muted">최근 1년 안에 바뀐 시험 법령이 없어요.</div>'}
    ${older.length ? `<div class="sect">그 전</div>${older.map(row).join('')}` : ''}
    <p class="faint" style="text-align:center">출처: 국가법령정보센터(legalize-kr 저장소 경유) · ${esc((d.updated || '').replace('T', ' ').slice(0, 16))} 확인${idx.updated ? '' : ''}</p>`);
  for (const x of recent) prog.seen[x.law] = {d: x.date, t: Date.now()};
  saveProg();
}

async function viewLaw(id, k) {
  frame('조문', '#/laws');
  render(`<div class="card">${thinking('조문을 불러오는 중…')}</div>`);
  let L;
  try { L = await loadLaw(id); } catch (e) { render(`<div class="card">못 불러왔어요: ${esc(e.message)}</div>`); return; }
  const ch = new Set(L.changed || []), arts = L.articles.filter(a => !a.deleted);
  const unitOf = new Map(); L.units.forEach(u => u.arts.forEach(a => unitOf.set(a, u)));
  let last = null, h = '';
  for (const a of arts) {
    const u = unitOf.get(a.k);
    if (u && u !== last) { h += `<h2 style="margin-top:28px">${esc(u.title)}</h2>`; last = u; }
    h += `<div class="art${ch.has(a.k) ? ' changed' : ''}" id="a-${esc(a.k)}"><div class="row"><b class="grow">${esc(a.no)}${a.title ? ` (${esc(a.title)})` : ''}${ch.has(a.k) ? ` <span class="tag warn">${esc(L.changedAt)} 개정</span>` : ''}</b><button class="btn ghost sm noprint" data-cz="${esc(a.k)}">${ic('cards', 14)}빈칸 카드</button></div><div class="atext">${esc(a.text)}</div></div>`;
  }
  render(`<div class="narrow"><section class="hero" style="margin-bottom:14px"><div class="eyebrow">${esc(L.meta?.법령구분 || '')} · 시행 ${esc(L.meta?.시행일자 || '')}</div><h2 class="display">${esc(L.name)}</h2>
    <p class="faint" style="margin:0">조문 ${arts.length}개 · 최근 개정 ${esc(L.meta?.공포일자 || '')}${ch.size ? ` · 바뀐 조문 ${ch.size}개` : ''} · <a href="${esc(L.meta?.출처 || '#')}" target="_blank" rel="noopener">국가법령정보센터</a></p></section>
    <div class="row noprint" style="margin-bottom:12px"><select id="l-jump" class="grow">${L.units.map(u => `<option value="${esc(u.arts[0])}">${esc(u.title)} (${esc(u.range)})</option>`).join('')}</select>${ch.size ? '<button class="btn sm" id="l-ch">바뀐 조문만</button>' : ''}</div>
    <div class="card paper" style="padding:24px">${h}</div></div>`);
  $('#l-jump').onchange = e => document.getElementById('a-' + e.target.value)?.scrollIntoView({behavior: 'smooth'});
  $('#l-ch') && ($('#l-ch').onclick = () => main_.querySelectorAll('.art:not(.changed)').forEach(x => x.hidden = !x.hidden));
  main_.querySelectorAll('[data-cz]').forEach(b => b.onclick = () => clozeCard(b, L, arts.find(a => a.k === b.dataset.cz)));
  if (k) setTimeout(() => { const el = document.getElementById('a-' + k); el?.scrollIntoView({block: 'center'}); el?.classList.add('flashy'); }, 60);
}
// 조문 빈칸 카드: Gemini 가 요건·기간·주체 낱말을 고르고, 키가 없으면 숫자·기간·주체 낱말을 규칙으로 고른다
const CLOZE_S = obj({blanks: arr(S_)});
function ruleBlanks(t) {
  const pats = [/\d+\s*(?:일|개월|월|년|주|시간)\s*(?:이내|안에|전|후|이상|이하|내)?/g, /\d+(?:만|천|백)?\s*원\s*(?:이하|이상|초과|미만)?/g, /지체\s*없이|즉시|미리|상당한 기간/g,
    /(?:등기관|등기권리자|등기의무자|공탁관|공탁자|피공탁자|집행법원|집행관|채권자|채무자|법원행정처장|대법원장|지방법원장|소유자|가족관계등록관서의 장|시ㆍ읍ㆍ면의 장|등기소)/g];
  const hits = [];
  for (const p of pats) for (const m of t.matchAll(p)) if (!hits.includes(m[0].trim())) hits.push(m[0].trim());
  return hits.slice(0, 3);
}
async function clozeCard(btn, L, a) {
  const s = allSubjects().find(x => (L.subjects || []).includes(x.id));
  if (!s) return toast('이 법령의 과목을 찾지 못했어요');
  busy(btn, '');
  let bl = [];
  if (aiOn()) {
    try { bl = (await gem(`법무사 시험 암기 카드용으로, 아래 조문에서 시험에 잘 나오는 핵심 낱말 1~3개(요건·기간·주체·효과)를 조문 글자 그대로 골라 줘.\n${L.name} ${a.no}(${a.title})\n${a.text}`, {schema: CLOZE_S, temp: .2})).blanks.filter(b => b && a.text.includes(b)).slice(0, 3); } catch (e) { toast(e.message); }
  }
  if (!bl.length) bl = ruleBlanks(a.text);
  unbusy(btn);
  if (!bl.length) return toast('가릴 낱말을 찾지 못했어요');
  addCards(s, [{f: `${L.name} ${a.no}${a.title ? `(${a.title})` : ''}\n${blankOut(a.text, bl)}`, b: bl.join(' · '), full: a.text, blanks: bl, kind: '조문', from: `${L.name} ${a.no}`}], aiOn() ? 'gem' : 'rule');
  btn.innerHTML = ic('check', 14, 2.2) + '카드 됨'; btn.disabled = true;
  toast(`빈칸 카드: ${bl.join(', ')}`);
}

// ── 판례 ────────────────────────────────────────────────────────────
const CASE_CLOZE_S = obj({issue: S_, holding: S_, cloze: S_, blanks: arr(S_)});
async function viewCases(s) {
  frame(s ? s.name : '판례', s ? '#/' : '#/');
  const head = s ? tabsHtml(s, 'cases') : `<section class="hero" style="margin-bottom:18px"><div class="eyebrow">판례</div><h2 class="display">최신 판례</h2></section>`;
  render(head + `<div class="card">${thinking('판례를 모으는 중…')}</div>`);
  const all = (await loadCases()).cases || [];
  // 단원에 붙은 판례(생성기가 만든 요지 빈칸)도 함께
  const unitCases = new Map();
  if (s) for (const u of s.units.filter(u => u.ready)) { try { for (const c of (await loadUnit(s, u)).cases || []) unitCases.set(c.id, {...c, uid: u.id}); } catch {} }
  const f = store.get('caseFilter', {jh: false, recent: false, ov: false});
  const cut = todayKey(new Date(Date.now() - 365 * DAY));
  let list = all.filter(c => !s || c.subjects?.includes(s.id));
  if (f.jh) list = list.filter(c => c.jeonhap);
  if (f.ov) list = list.filter(c => c.overrule);
  if (f.recent) list = list.filter(c => c.date >= cut);
  const mine = new Set((s ? prog.cards[s.id] || [] : Object.values(prog.cards).flat()).map(c => c.caseId).filter(Boolean));
  render(head + `<div class="seg noprint" style="margin-bottom:14px"><button class="${f.jh ? 'on' : ''}" data-f="jh">전원합의체</button><button class="${f.recent ? 'on' : ''}" data-f="recent">최신 1년</button><button class="${f.ov ? 'on' : ''}" data-f="ov">변경 판례</button></div>
    <p class="faint" style="margin:-4px 0 14px">${list.length}건 · 시험 과목 법령을 참조한 대법원 판례 · 출처 국가법령정보센터(precedent-kr)</p>
    ${list.slice(0, 120).map(c => {
      const uc = unitCases.get(c.id);
      return `<div class="card case" style="padding:18px 20px"><div class="row" style="align-items:flex-start"><div class="grow"><b style="font-family:var(--serif);font-size:17px">대법원 ${esc(c.date)} ${esc(c.no)}</b>
        <div class="faint">${esc(c.name)}${s ? '' : ' · ' + (c.subjects || []).map(id => subjById(id)?.name).filter(Boolean).join(' · ')}</div></div>
        ${c.jeonhap ? '<span class="tag bad">전원합의체</span>' : ''}${c.overrule ? '<span class="tag warn">판례 변경</span>' : ''}${c.date >= cut ? '<span class="tag ok">최신</span>' : ''}</div>
        <div style="margin-top:10px">${(c.issues || []).slice(0, 4).map(i => `<div class="row" style="align-items:flex-start;margin:4px 0"><span class="tag ${i.a === '적극' ? 'ok' : i.a === '소극' ? 'bad' : ''}" style="min-width:44px;justify-content:center">${esc(i.a || '쟁점')}</span><span class="grow">${esc(i.q.length > 220 ? i.q.slice(0, 220) + '…' : i.q)}</span></div>`).join('')}</div>
        <details style="margin-top:8px"><summary class="faint" style="cursor:pointer">판결요지 · 참조조문</summary><div class="md" style="margin-top:8px;white-space:pre-line">${esc(c.gist)}</div><p class="faint">${esc(c.refs)}</p><a href="${esc(c.url)}" target="_blank" rel="noopener" class="faint">원문 보기</a></details>
        ${uc ? `<div class="box" style="margin:10px 0 0"><b>요지 빈칸</b> ${esc(blankOut(uc.cloze, uc.blanks || []))}</div>` : ''}
        <div class="row noprint" style="margin-top:10px">${mine.has(c.id) ? `<span class="tag ok">${ic('check', 14, 2.2)}카드에 있음</span>` : `<button class="btn sm" data-card="${esc(c.id)}">카드로</button>${aiOn() ? `<button class="btn sm gem" data-gcard="${esc(c.id)}">${ic('spark', 14)}${aiName()} 요지 빈칸</button>` : ''}`}</div></div>`;
    }).join('') || '<div class="card muted">조건에 맞는 판례가 없어요. 수집기는 최근 1년 대법원 판례 가운데 시험 법령을 참조한 것을 모아요.</div>'}`);
  main_.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { f[b.dataset.f] = !f[b.dataset.f]; store.set('caseFilter', f); viewCases(s); });
  const byId = new Map(all.map(c => [c.id, c]));
  const target = c => s || subjById((c.subjects || [])[0]);
  main_.querySelectorAll('[data-card]').forEach(b => b.onclick = () => {
    const c = byId.get(b.dataset.card), t = target(c);
    const issue = (c.issues || []).map(i => i.q).slice(0, 2).join(' / ');
    addCards(t, [{f: `대법원 ${c.date} ${c.no}${c.jeonhap ? ' (전원합의체)' : ''}\n쟁점: ${issue.slice(0, 300)}`, b: `${(c.issues || []).map(i => i.a).filter(Boolean).join(' · ') || '결론'}\n${c.gist.slice(0, 400)}`, kind: '판례', caseId: c.id, jeonhap: c.jeonhap, overrule: c.overrule, date: c.date, from: `대법원 ${c.no}`}]);
    b.outerHTML = `<span class="tag ok">${ic('check', 14, 2.2)}카드에 넣었어요</span>`;
  });
  main_.querySelectorAll('[data-gcard]').forEach(b => b.onclick = async () => {
    const c = byId.get(b.dataset.gcard), t = target(c);
    busy(b, '만드는 중…');
    try {
      const r = await gem(`법무사 시험 판례 암기 카드를 만든다. 아래 판례로 issue(쟁점 한 줄), holding(결론 한 줄, 적극·소극을 밝힘), cloze(판결요지의 핵심 문장 1~2개를 글자 그대로), blanks(cloze 안에서 가릴 핵심 낱말 1~3개, 글자 그대로)를 만든다.\n대법원 ${c.date} ${c.no} ${c.name}\n판시사항: ${(c.issues || []).map(i => i.q).join(' / ')}\n판결요지: ${c.gist.slice(0, 5000)}`, {schema: CASE_CLOZE_S, temp: .2});
      const bl = (r.blanks || []).filter(x => x && r.cloze.includes(x)).slice(0, 3);
      const base = {caseId: c.id, jeonhap: c.jeonhap, overrule: c.overrule, date: c.date, from: `대법원 ${c.no}`};
      const cards = [{f: `대법원 ${c.date} ${c.no}${c.jeonhap ? ' (전원합의체)' : ''}\n쟁점: ${r.issue}`, b: r.holding, kind: '판례', ...base}];
      if (bl.length) cards.push({f: `${c.no} 요지\n${blankOut(r.cloze, bl)}`, b: bl.join(' · '), full: r.cloze, blanks: bl, kind: '판례 빈칸', ...base});
      addCards(t, cards, 'gem');
      b.parentElement.innerHTML = `<span class="tag ok">${ic('check', 14, 2.2)}판례 카드 ${cards.length}장</span>`;
    } catch (e) { toast(e.message); unbusy(b); }
  });
}
