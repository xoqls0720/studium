'use strict';
// ── 듣기 (기기 음성) ─────────────────────────────────────────────
const plain = t => String(t || '').replace(/[#*`>|★]/g, ' ').replace(/-{3,}/g, ' ').replace(/\s+/g, ' ').trim();
function speak(text, {rate = pref('ttsRate', 1.05), onend} = {}) {
  if (!('speechSynthesis' in window)) return toast('이 기기는 읽어 주기를 지원하지 않아요');
  speechSynthesis.cancel();
  // 긴 글은 문장 단위로 끊어 읽는다(사파리가 긴 글을 중간에 멈추는 문제)
  const parts = plain(text).match(/[^.!?。\n]{1,180}[.!?。]?/g) || [];
  const voice = speechSynthesis.getVoices().find(v => /^ko/i.test(v.lang));
  parts.forEach((p, i) => { const u = new SpeechSynthesisUtterance(p); u.lang = 'ko-KR'; u.rate = rate; if (voice) u.voice = voice; if (i === parts.length - 1 && onend) u.onend = onend; speechSynthesis.speak(u); });
}
const speakStop = () => window.speechSynthesis?.cancel();

// ── 팟캐스트: Gemini 가 두 사람 대화 대본을 쓰고, Gemini 음성(TTS)으로 만든다. 안 되면 기기 음성으로 읽는다. ──
const TTS_MODELS = ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts', 'gemini-flash-tts-latest'];
function pcmToWav(b64data, rate = 24000) {
  const pcm = Uint8Array.from(atob(b64data), c => c.charCodeAt(0)), buf = new ArrayBuffer(44 + pcm.length), v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, pcm.length, true);
  new Uint8Array(buf, 44).set(pcm);
  return new Blob([buf], {type: 'audio/wav'});
}
async function makePodcast(title, source) {
  const script = await gem(`다음 학습 자료로 5분 남짓 한국어 팟캐스트 대본을 쓴다. 진행자 '민지'와 설명하는 '준호' 두 사람의 대화. 핵심 개념을 쉬운 예시로 풀고, 시험에 나올 부분을 짚고, 끝에 3줄 요약.
형식: 줄마다 '민지: …' 또는 '준호: …'만. 지문·효과음·괄호 설명 없이. 2500자 안쪽.

[${title}]
${source.slice(0, 30000)}`, {temp: .8});
  const key = gemKey();
  for (const m of TTS_MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {method: 'POST', headers: {'Content-Type': 'application/json', 'x-goog-api-key': key}, body: JSON.stringify({
        contents: [{parts: [{text: `다음 대화를 자연스러운 한국어 팟캐스트처럼 읽어 줘:\n${script}`}]}],
        generationConfig: {responseModalities: ['AUDIO'], speechConfig: {multiSpeakerVoiceConfig: {speakerVoiceConfigs: [
          {speaker: '민지', voiceConfig: {prebuiltVoiceConfig: {voiceName: 'Kore'}}}, {speaker: '준호', voiceConfig: {prebuiltVoiceConfig: {voiceName: 'Puck'}}}]}}}})});
      if (!r.ok) continue;
      const p = (await r.json()).candidates?.[0]?.content?.parts?.find(x => x.inlineData || x.inline_data);
      const data = p?.inlineData || p?.inline_data;
      if (data?.data) return {script, audio: pcmToWav(data.data, +(data.mimeType || data.mime_type || '').match(/rate=(\d+)/)?.[1] || 24000)};
    } catch {}
  }
  return {script, audio: null};
}
async function podcastPanel(box, key, title, source) {
  const cached = await kvGet('pod:' + key);
  const paint = c => {
    box.innerHTML = c.audio ? `<audio controls src="${URL.createObjectURL(c.audio)}" style="width:100%"></audio>` : `<div class="row"><button class="btn" id="pod-play">${ic('play', 18)}기기 음성으로 듣기</button><span class="faint">Gemini 음성을 쓸 수 없어 기기 음성으로 읽어요</span></div>`;
    box.insertAdjacentHTML('beforeend', `<details style="margin-top:10px"><summary class="faint">대본 보기</summary><div class="md" style="font-size:15px;white-space:pre-wrap">${esc(c.script)}</div></details><button class="btn ghost sm" id="pod-re" style="margin-top:8px">다시 만들기</button>`);
    box.querySelector('#pod-play') && (box.querySelector('#pod-play').onclick = () => speak(c.script.replace(/^(민지|준호):/gm, '')));
    box.querySelector('#pod-re').onclick = () => make();
  };
  async function make() {
    if (!gemKey()) { location.hash = '#/set'; return toast('설정에 Gemini 키를 넣어 주세요'); }
    box.innerHTML = thinking('Gemini가 대본을 쓰고 녹음하는 중… (1~2분)');
    try { const c = await makePodcast(title, source); await kvPut('pod:' + key, c); paint(c); }
    catch (e) { box.innerHTML = ''; toast(e.message); }
  }
  if (cached) paint(cached); else make();
}

// ── 메모 · 책갈피 ────────────────────────────────────────────────
const memoOf = uid => prog.memo[uid]?.text || '';
let memoTimer;
function setMemo(uid, text) { prog.memo[uid] = {t: Date.now(), text}; clearTimeout(memoTimer); memoTimer = setTimeout(saveProg, 800); store.set('prog', prog); }
const isMarked = uid => prog.mark[uid]?.on;
function toggleMark(uid) { prog.mark[uid] = {t: Date.now(), on: !isMarked(uid)}; saveProg(); return isMarked(uid); }

// ── 검색: 모든 서재의 노트·핵심·용어·메모에서 찾는다 ───────────────────
async function viewSearch() {
  frame('찾기', '#/');
  const q0 = store.get('lastSearch', '');
  render(`<div class="narrow"><section class="hero" style="margin-bottom:16px"><div class="eyebrow">찾기</div><h2 class="display">모든 노트에서 찾기</h2></section>
    <div class="row" style="margin-bottom:16px"><input type="text" id="sq" class="grow" placeholder="개념, 용어, 문장…" value="${esc(q0)}" autofocus><button class="btn pri" id="sgo">${ic('search', 18)}찾기</button></div><div id="sres"></div></div>`);
  const go = async () => {
    const q = $('#sq').value.trim(); store.set('lastSearch', q);
    if (q.length < 2) return;
    $('#sres').innerHTML = thinking('찾는 중…');
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), hits = [];
    const all = allSubjects().flatMap(s => s.units.filter(u => u.ready).map(u => [s, u]));
    let next = 0, done = 0;
    const worker = async () => {   // 여러 개를 같이 읽어 빨리 찾는다
      while (next < all.length) {
        const [s, u] = all[next++];
        let d; try { d = await loadUnit(s, u); } catch { continue; } finally { $('#sres') && ($('#sres').innerHTML = thinking(`찾는 중… ${++done}/${all.length}`)); }
        const fields = [['제목', u.title], ['메모', memoOf(u.id)], ['핵심', (d.points || []).join(' · ')], ['용어', (d.terms || []).map(t => `${t.t}: ${t.d}`).join(' · ')], ['노트', plain(d.note)]];
        for (const [k, t] of fields) { const m = t ? t.search(re) : -1; if (m >= 0) { hits.push({s, u, k, snip: t.slice(Math.max(0, m - 50), m + 90), score: k === '제목' ? 3 : k === '용어' ? 2 : 1}); break; } }
      }
    };
    await Promise.all([...Array(8)].map(worker));
    hits.sort((a, b) => b.score - a.score);
    $('#sres').innerHTML = hits.length ? `<p class="faint">${hits.length}곳</p>` + hits.slice(0, 80).map(h => `<div class="card" style="cursor:pointer;padding:16px 18px" data-go="#/s/${h.s.id}/u/${h.u.id}"><div class="faint">${esc(h.s.name)} · ${h.k}</div><b>${esc(h.u.title)}</b><div class="muted" style="margin-top:4px">…${esc(h.snip).replace(re, m => `<mark>${m}</mark>`)}…</div></div>`).join('')
      : '<div class="card muted">찾지 못했어요. 아직 기기에 받지 않은 강의는 설정의 \'자료 전부 받아 두기\' 뒤에 찾을 수 있어요.</div>';
    bindGo($('#sres'));
  };
  $('#sgo').onclick = go;
  $('#sq').onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) go(); };
  if (q0) go();
}

// ── 마인드맵: Gemini 가 과목 구조를 나무로 만들고 SVG 로 그린다 ─────────────
const TREE_S = {type: 'OBJECT', properties: {name: S_, children: arr({type: 'OBJECT', properties: {name: S_, children: arr({type: 'OBJECT', properties: {name: S_, children: arr({type: 'OBJECT', properties: {name: S_}, required: ['name']})}, required: ['name']})}, required: ['name']})}, required: ['name', 'children']};
async function mindmapOf(s, force) {
  const k = 'mm:' + s.id, c = await kvGet(k);
  if (c && !force) return c;
  const ctx = [];
  for (const u of s.units.filter(u => u.ready).slice(0, 40)) { try { const d = await loadUnit(s, u); ctx.push(`## ${u.title}\n${(d.points || []).join('\n')}`); } catch {} }
  const tree = await gem(`'${s.name}' 과목 전체를 마인드맵 나무로 정리한다. 뿌리는 과목 이름, 1단계는 큰 주제 4~8개, 2단계는 개념, 3단계는 핵심 사실(짧게, 12자 안팎). 강의 순서보다 개념 관계를 따른다.\n\n${ctx.join('\n\n').slice(0, 60000)}`, {schema: TREE_S, temp: .3});
  await kvPut(k, tree);
  return tree;
}
function treeSvg(tree) {
  // 왼쪽에서 오른쪽으로 펼치는 나무. 잎 순서대로 세로 자리를 잡는다.
  const nodes = [], links = [], colW = [0, 170, 190, 200], X = [10, 190, 380, 590];
  let leaf = 0;
  const walk = (n, depth, hueN) => {
    const kids = (n.children || []).slice(0, 12), me = {n, depth, hue: hueN};
    nodes.push(me);
    if (!kids.length || depth >= 3) { me.y = leaf++ * 30 + 20; return me; }
    const ys = kids.map((k, i) => { const c = walk(k, depth + 1, depth === 0 ? (i * 47) % 360 : hueN); links.push([me, c]); return c.y; });
    me.y = (ys[0] + ys.at(-1)) / 2;
    return me;
  };
  walk(tree, 0, 220);
  const H = leaf * 30 + 30, Wd = 820;
  const txt = (s, max) => s.length > max ? s.slice(0, max - 1) + '…' : s;
  return `<svg viewBox="0 0 ${Wd} ${H}" width="${Wd}" height="${H}" class="mm" role="img" aria-label="마인드맵">
    ${links.map(([a, b]) => `<path d="M${X[a.depth] + (a.depth ? colW[a.depth] - 20 : 150)},${a.y} C${X[b.depth] - 30},${a.y} ${X[b.depth] - 40},${b.y} ${X[b.depth]},${b.y}" fill="none" stroke="hsl(${b.hue} 35% 60%)" stroke-width="${3 - b.depth * .6}" opacity=".7"/>`).join('')}
    ${nodes.map(m => m.depth === 0 ? `<g><rect x="${X[0]}" y="${m.y - 18}" width="150" height="36" rx="12" fill="var(--pri)"/><text x="${X[0] + 75}" y="${m.y + 5}" text-anchor="middle" fill="var(--on-pri)" font-weight="700" font-size="14">${esc(txt(m.n.name, 11))}</text></g>`
      : `<g><circle cx="${X[m.depth]}" cy="${m.y}" r="${m.depth === 1 ? 5 : 3.5}" fill="hsl(${m.hue} 40% 50%)"/><text x="${X[m.depth] + 9}" y="${m.y + 4.5}" font-size="${m.depth === 1 ? 14 : 12.5}" font-weight="${m.depth === 1 ? 700 : 500}" fill="var(--ink${m.depth === 3 ? '-2' : ''})">${esc(txt(m.n.name, m.depth === 3 ? 18 : 14))}</text></g>`).join('')}
  </svg>`;
}
async function mindmapPanel(box, s, force) {
  if (!gemKey() && !(await kvGet('mm:' + s.id))) { box.innerHTML = `<div class="row"><span class="grow muted">설정에 Gemini 키를 넣으면 과목 마인드맵을 만들어요.</span><button class="btn gem sm" data-go="#/set">키 넣기</button></div>`; bindGo(box); return; }
  box.innerHTML = thinking('Gemini가 마인드맵을 그리는 중…');
  try { const t = await mindmapOf(s, force); box.innerHTML = `<div class="mmwrap">${treeSvg(t)}</div><div class="row" style="margin-top:8px"><button class="btn ghost sm" id="mm-re">다시 그리기</button><button class="btn ghost sm" onclick="print()">${ic('print', 16)}인쇄</button></div>`; box.querySelector('#mm-re').onclick = () => mindmapPanel(box, s, true); }
  catch (e) { box.innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
}

// ── NotebookLM: PC 가 노트북을 만들고 소스를 넣고, 오디오·학습 가이드·카드·퀴즈·마인드맵을 받아 둔 것 ──
async function readBlob(path) { const f = await src().file(path); return f.blob(); }
function nlmCards(j) {   // 받은 플래시카드 JSON 을 {f, b} 로 (모양이 달라도 읽게)
  const list = Array.isArray(j) ? j : j?.cards || j?.flashcards || j?.items || [];
  return list.map(c => ({f: c.front || c.question || c.term || c.q || c.f, b: c.back || c.answer || c.definition || c.a || c.b})).filter(c => c.f && c.b);
}
function nlmQuiz(j) {
  const list = Array.isArray(j) ? j : j?.questions || j?.quiz || j?.items || [];
  return list.map(q => {
    const opts = q.options || q.choices || q.answers || [];
    const texts = opts.map(o => typeof o === 'string' ? o : o.text || o.answer || o.option);
    let a = typeof q.correct === 'number' ? q.correct : typeof q.answerIndex === 'number' ? q.answerIndex : opts.findIndex(o => o?.isCorrect || o?.correct);
    if (a < 0 && q.answer) a = texts.indexOf(q.answer);
    return {q: q.question || q.q, c: texts, a, e: q.explanation || q.rationale || q.hint || ''};
  }).filter(q => q.q && q.c.length >= 2 && q.a >= 0);
}
async function viewNlm(s) {
  frame(s.name, '#/');
  const nb = s.nb, base = `${s.folder}/NotebookLM`;
  if (!nb) {
    render(tabsHtml(s, 'nlm') + `<div class="card callout"><div class="mark">${ic('nb')}</div><div class="grow"><b>NotebookLM 노트북이 아직 없어요</b><div class="faint">PC에서 NotebookLM 연결을 한 번 해 두면, 이 과목 노트북을 저절로 만들고 새 자료를 소스로 넣어요. 오디오 개요·학습 가이드·카드·퀴즈·마인드맵도 받아 와요.</div></div><button class="btn" id="nblm">NotebookLM 열기</button></div>`);
    $('#nblm').onclick = () => window.open('https://notebooklm.google.com/', '_blank', 'noopener');
    return;
  }
  const has = k => (nb.files || []).includes(k);
  render(tabsHtml(s, 'nlm') + `<div class="card callout"><div class="mark">${ic('nb')}</div><div class="grow"><b>${esc(nb.title || s.name)}</b><div class="faint">소스 ${nb.sources_n || Object.keys(nb.sources || {}).length}개 ·${esc((nb.synced || '').replace('T', ' ').slice(0, 16))} 맞춤</div></div>${nb.url ? `<a class="btn" href="${esc(nb.url)}" target="_blank" rel="noopener">NotebookLM에서 열기</a>` : ''}</div>
    ${has('audio.m4a') || has('audio.mp3') ? `<div class="sect">오디오 개요</div><div class="card" id="nl-audio">${thinking('받는 중…')}</div>` : ''}
    ${has('flashcards.json') || has('quiz.json') ? `<div class="sect">카드 · 퀴즈</div><div class="row" style="margin-bottom:8px">${has('flashcards.json') ? '<button class="btn" id="nl-cards">카드 덱에 넣기</button>' : ''}${has('quiz.json') ? '<button class="btn pri" id="nl-quiz">NotebookLM 퀴즈 풀기</button>' : ''}</div>` : ''}
    ${has('mindmap.json') ? `<div class="sect">마인드맵</div><div class="card" id="nl-mm">${thinking('받는 중…')}</div>` : ''}
    ${has('study_guide.md') ? `<div class="sect">학습 가이드</div><div class="card md" id="nl-guide">${thinking('받는 중…')}</div>` : ''}`);
  if ($('#nl-audio')) readBlob(`${base}/${has('audio.m4a') ? 'audio.m4a' : 'audio.mp3'}`).then(b => $('#nl-audio').innerHTML = `<audio controls src="${URL.createObjectURL(b)}" style="width:100%"></audio>`).catch(e => $('#nl-audio').textContent = e.message);
  if ($('#nl-guide')) readJSON(`${base}/study_guide.json`).then(d => $('#nl-guide').innerHTML = md(d.text)).catch(() => readBlob(`${base}/study_guide.md`).then(b => b.text()).then(t => $('#nl-guide').innerHTML = md(t)).catch(e => $('#nl-guide').textContent = e.message));
  if ($('#nl-mm')) readJSON(`${base}/mindmap.json`).then(j => {
    const conv = n => ({name: n.name || n.title || n.label || n.text || '', children: (n.children || n.nodes || []).map(conv)});
    $('#nl-mm').innerHTML = `<div class="mmwrap">${treeSvg(conv(j.root || j.mindmap || j))}</div>`;
  }).catch(e => $('#nl-mm').textContent = e.message);
  $('#nl-cards') && ($('#nl-cards').onclick = async () => {
    const list = nlmCards(await readJSON(`${base}/flashcards.json`)), have = new Set((prog.cards[s.id] || []).map(c => c.f));
    const add = list.filter(c => !have.has(c.f));
    addCards(s, add, 'nlm'); toast(`카드 ${add.length}장을 덱에 넣었어요`);
  });
  $('#nl-quiz') && ($('#nl-quiz').onclick = async () => {
    const qs = nlmQuiz(await readJSON(`${base}/quiz.json`)).map((q, i) => ({...q, id: `${s.id}:N:${i}`, type: 'mcq', from: 'NotebookLM 퀴즈', sid: s.id}));
    if (!qs.length) return toast('퀴즈를 읽지 못했어요');
    startQuiz(shuffle(qs), s.name + ' · NotebookLM 퀴즈', `#/s/${s.id}/nlm`);
  });
}
