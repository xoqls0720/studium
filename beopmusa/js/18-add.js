'use strict';
// ── 자료 넣기: 기출 파일(PC 가 정리) · 내가 산 책·강의 자료(바로 정리 + 드라이브 '받은 자료'에 원본) ──
// 원본은 '법무사 회독/받은 자료/<과목>/', 기출은 '받은 자료/기출/제N회 N차/'. 정리 결과는 '과목/<과목>/<id>.json'(PC 결과와 같은 모양).
const UNIT_S = obj({title: S_, note: S_, points: arr(S_), terms: arr(obj({t: S_, d: S_})), emphasis: arr(S_), mcq: arr(MCQ_S), ox: arr(OX_S), short: arr(SHORT_S)});
const MATERIAL_PROMPT = (subject, title, kind) => `너는 법무사 시험 수험서를 정리하는 조교다. 함께 준 자료('${title}', 과목 '${subject}')는 수험생이 산 책·강의 자료다.
${kind === 'image' ? '자료는 책·필기를 찍은 사진이다. 글자(손글씨 포함)를 정확히 읽고 쪽 순서대로 정리한다.' : ''}
규칙: 자료에 있는 내용만 쓴다. 지어내지 않는다. 조문은 '제N조 제M항'처럼 정확히. 한국어, 수험서 문체(~다).
- title: 자료 제목(짧게)
- note: 기본서처럼 정리한 본문(마크다운). '## 소제목'으로 나누고 조문 요건 → 효과 → 예외 → 판례. 기간·주체·요건은 표로. 빈출·강조는 앞에 '★'.
- points: 핵심 8~12개(근거 조문) · terms: 용어 6~15개(t, d) · emphasis: 시험 함정(없으면 빈 배열)
- mcq: 법무사 1차형 5지선다 8문제('옳지 않은 것은?' 등, c 보기 5개, a 정답 순서 0부터, e 해설과 근거) · ox: 8문제(a, e) · short: 2차형 서술 2문제(a 모범 답안, k 핵심어)`;
const MIME = {pdf: 'application/pdf', txt: 'text/plain', md: 'text/plain', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', aac: 'audio/aac', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm'};
const extOf = n => (n.match(/\.([^.]+)$/)?.[1] || '').toLowerCase();
const mimeOf = f => f.type || MIME[extOf(f.name)] || 'application/octet-stream';
const kindOf = m => m.startsWith('image/') ? 'image' : m.startsWith('audio/') ? 'audio' : m.startsWith('video/') ? 'video' : 'doc';
const ytId = u => u.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/)?.[1];
const safeName = s => s.replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 80) || '자료';
const b64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });

// docx·pptx·hwpx 는 압축을 풀어 글만 꺼낸다
let JSZipP;
async function officeText(file) {
  JSZipP ||= new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'; s.onload = () => res(window.JSZip); s.onerror = rej; document.head.append(s); });
  const zip = await (await JSZipP).loadAsync(file), out = [];
  const names = Object.keys(zip.files).filter(n => /^(word\/document|ppt\/slides\/slide\d+|Contents\/section\d+)\.xml$/.test(n)).sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
  for (const n of names) out.push((await zip.file(n).async('string')).replace(/<\/(w:p|a:p|hp:p)>/g, '\n').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
  return out.join('\n\n').trim();
}
// Gemini 에 넘길 조각: 작은 파일은 그대로, 큰 파일(14MB 넘음)은 Gemini 파일 저장소에 올린 뒤 주소로.
// 그대로 보내면 base64 로 4/3 배가 되니 14MB 여야 요청 한도(20MB) 안에 든다.
async function gemFilePart(blob, mime, name) {
  if (blob.size <= 14 * 2 ** 20) return {inline_data: {mime_type: mime, data: await b64(blob)}};
  const key = gemKey();
  const st = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', {method: 'POST', headers: {'x-goog-api-key': key, 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start',
    'X-Goog-Upload-Header-Content-Length': String(blob.size), 'X-Goog-Upload-Header-Content-Type': mime, 'Content-Type': 'application/json'}, body: JSON.stringify({file: {display_name: name.slice(0, 100)}})});
  const up = st.headers.get('x-goog-upload-url');
  if (!up) throw new Error('큰 파일을 Gemini에 올리지 못했어요(18MB 넘는 파일은 PC 생성기로 넣어 주세요)');
  let f = (await (await fetch(up, {method: 'POST', headers: {'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize'}, body: blob})).json()).file;
  for (let i = 0; f.state === 'PROCESSING' && i < 120; i++) { await new Promise(r => setTimeout(r, 5000)); f = await (await fetch(`https://generativelanguage.googleapis.com/v1beta/${f.name}`, {headers: {'x-goog-api-key': key}})).json(); }
  if (f.state === 'FAILED') throw new Error('Gemini가 파일을 읽지 못했어요');
  return {file_data: {mime_type: mime, file_uri: f.uri}};
}

// 기출 파일은 PC 생성기(exam_import)가 정리한다: 드라이브 '받은 자료/기출/제N회 N차/'에 올리기만
function viewAdd() {
  frame('자료 넣기', '#/');
  const cur = store.get('addTo', {subject: '', kind: 'book'}), subs = allSubjects();
  const y = new Date().getFullYear(), r0 = y - 1994;   // 2026년 = 제32회
  render(`<div class="narrow"><section class="hero" style="margin-bottom:20px"><div class="eyebrow">자료 넣기</div><h2 class="display">기출과 내 책을 넣어요</h2>
    <p class="lede">기출 hwp·pdf는 문제와 지문으로 나뉘어 회독에 들어가고, 산 책·강의 PDF는 단원 기본서와 문제로 정리돼요.</p></section>
    <div class="card"><div class="seg" style="margin-bottom:16px"><button class="${cur.kind === 'exam' ? '' : 'on'}" data-t="book">${ic('book', 16)} 내 책·자료</button><button class="${cur.kind === 'exam' ? 'on' : ''}" data-t="exam">${ic('flag', 16)} 기출</button></div>
      <div data-q="book" ${cur.kind === 'exam' ? 'hidden' : ''}><label class="field"><span>과목</span><select id="a-subj">${subs.map(s => `<option value="${esc(s.id)}" ${s.name === cur.subject ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
        <p class="faint" style="margin:0">출판사 기본서처럼 저작권이 있는 책은 내가 산 책의 PDF·사진만 넣어 주세요. 앱이 인터넷에서 책을 찾아 받지는 않아요.</p></div>
      <div data-q="exam" ${cur.kind === 'exam' ? '' : 'hidden'}><div class="row"><label class="field grow" style="margin:0"><span>회차</span><select id="a-round">${Array.from({length: 12}, (_, i) => r0 - i).map(r => `<option value="${r}">제${r}회 (${r + 1994}년)</option>`).join('')}</select></label>
        <label class="field grow" style="margin:0"><span>차수</span><select id="a-stage"><option value="1">제1차</option><option value="2">제2차</option></select></label></div>
        <p class="faint" style="margin:10px 0 0">대법원 법원시험정보(exam.scourt.go.kr) 시험자료실 → 법무사시험에서 받은 문제(교시별)와 확정정답 파일을 함께 넣어요. '배포용' 보호가 걸린 hwp는 한컴오피스 뷰어나 구글 드라이브 미리보기에서 PDF로 저장해 넣어 주세요. PC 생성기가 정리해요.</p></div></div>
    <div class="card"><label class="drop" id="a-drop"><input type="file" id="a-files" multiple accept=".pdf,.hwp,.hwpx,.txt,.md,.docx,image/*" hidden>${ic('upload', 28)}<b>눌러서 고르거나 여기에 끌어다 놓기</b><span class="faint">PDF · hwp · hwpx · docx · 사진</span></label>
      <div id="a-list" class="alist"></div></div>
    <div class="row"><button class="btn pri" id="a-go">${ic('upload', 18)}넣기</button><span class="grow faint" id="a-note">${GD.valid() ? '' : '구글 드라이브를 연결해야 PC 생성기에 전해져요.'}</span></div>
    <div id="a-out" style="margin-top:16px"></div></div>`);
  let tab = cur.kind === 'exam' ? 'exam' : 'book', picked = [];
  main_.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tab = b.dataset.t; main_.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('on', x === b)); main_.querySelectorAll('[data-q]').forEach(p => p.hidden = p.dataset.q !== tab); });
  const paintList = () => $('#a-list').innerHTML = picked.map((f, i) => `<div class="row"><span class="tag">${extOf(f.name).toUpperCase() || '파일'}</span><span class="grow">${esc(f.name)}</span><span class="faint">${(f.size / 2 ** 20).toFixed(1)}MB</span><button class="btn ghost sm" data-rm="${i}">${ic('x', 14)}</button></div>`).join('');
  $('#a-list').onclick = e => { const b = e.target.closest('[data-rm]'); if (b) { picked.splice(+b.dataset.rm, 1); paintList(); } };
  $('#a-files').onchange = e => { picked.push(...e.target.files); paintList(); };
  const drop = $('#a-drop');
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); picked.push(...e.dataTransfer.files); paintList(); };
  $('#a-go').onclick = async () => {
    if (!picked.length) return toast('파일을 골라 주세요');
    const out = $('#a-out');
    busy($('#a-go'), '넣는 중…');
    if (tab === 'exam') {
      const dir = `${INBOX}/기출/제${$('#a-round').value}회 ${$('#a-stage').value}차`;
      store.set('addTo', {...cur, kind: 'exam'});
      for (const f of picked) {
        const row = document.createElement('div'); row.className = 'card callout'; out.prepend(row);
        try {
          if (!GD.valid()) throw new Error('구글 드라이브를 먼저 연결해 주세요(설정)');
          await GD.put(`${dir}/${f.name}`, f);
          row.innerHTML = `<div class="mark" style="color:var(--ok)">${ic('check')}</div><div class="grow"><b>${esc(f.name)}</b><div class="faint">${esc(dir)}에 올렸어요 · PC 생성기가 정리하면 기출에 나타나요</div></div>`;
        } catch (e) { row.innerHTML = `<div class="mark" style="color:var(--bad)">${ic('x')}</div><div class="grow"><b>${esc(f.name)}</b><div class="faint">${esc(e.message)}</div></div>`; }
      }
    } else {
      const s = subjById($('#a-subj').value);
      store.set('addTo', {subject: s.name, kind: 'book'});
      for (const f of picked) {
        const row = document.createElement('div'); row.className = 'card callout'; out.prepend(row);
        row.innerHTML = `<div class="mark"><span class="spin"></span></div><div class="grow"><b>${esc(f.name)}</b><div class="faint" data-st>준비 중…</div></div>`;
        const st = t => row.querySelector('[data-st]').textContent = t;
        try {
          const r = await ingest(s, f, st);
          row.innerHTML = `<div class="mark" style="color:var(--ok)">${ic('check')}</div><div class="grow"><b>${esc(r.title)}</b><div class="faint">${r.ready ? `정리 완료 · 문제 ${r.n}개` : '드라이브에 올렸어요 · PC 생성기가 정리하면 나타나요'}</div></div>${r.ready ? `<button class="btn sm" data-go="#/s/${s.id}/u/${r.uid}">열기</button>` : ''}`;
          bindGo(row);
        } catch (e) { row.innerHTML = `<div class="mark" style="color:var(--bad)">${ic('x')}</div><div class="grow"><b>${esc(f.name)}</b><div class="faint">${esc(e.message)}</div></div>`; }
      }
    }
    picked = []; paintList(); unbusy($('#a-go'));
  };
}

// 내 책·자료: 원본은 드라이브 '받은 자료/<과목>/'로, Gemini 키가 있으면 그 자리에서 단원으로 정리
async function ingest(s, f, st) {
  const mime = mimeOf(f), kind = kindOf(mime);
  // 아이폰 카메라는 사진마다 'image.jpg' 라 이름이 같으면 앞 자료를 덮어쓴다 → 찍은 시각을 붙인다
  const fname = kind === 'image' && (/^image\.\w+$/i.test(f.name) || Object.values(prog.my).some(m => !m.del && m.sid === s.id && m.file === f.name))
    ? `사진_${new Date().toISOString().slice(0, 19).replace(/\D/g, '')}_${Math.random().toString(36).slice(2, 5)}.${extOf(f.name) || 'jpg'}` : f.name;
  const title = fname.replace(/\.[^.]+$/, ''), uid = await sha12(`inbox/${s.name}/${fname}`);
  if (GD.valid()) { st('드라이브에 원본 올리는 중…'); await GD.put(`${INBOX}/${s.name}/${fname}`, f).catch(e => console.warn(e)); }
  const ext = extOf(fname);
  if (!aiOn() || ext === 'hwp') {
    if (!GD.valid()) throw new Error('Gemini 키나 구글 연결 중 하나는 있어야 해요');
    return {title, ready: false};   // hwp 는 PC 생성기가 글을 꺼내 정리한다
  }
  let parts;
  if (/^(docx|hwpx)$/.test(ext)) { st('문서에서 글 꺼내는 중…'); parts = [{text: await officeText(f)}]; }
  else if (/^(txt|md)$/.test(ext)) parts = [{text: await f.text()}];
  else { st('파일 올리는 중…'); parts = [await gemFilePart(f, mime, f.name)]; }
  st('Gemini가 정리하는 중… (1~3분)');
  const d = await gem({parts: [...parts, {text: MATERIAL_PROMPT(s.name, title, kind)}]}, {schema: UNIT_S, temp: .4});
  d.mcq = (d.mcq || []).filter(q => Array.isArray(q.c) && q.a >= 0 && q.a < q.c.length);
  Object.assign(d, {id: uid, file: fname, subject: s.name, by: 'app', made: new Date().toISOString().slice(0, 19), hash: 'app:' + fname, cloze: [], cases: []});
  const path = `${s.folder}/${uid}.json`;
  await cachePut(path, {stamp: 'app', data: d});
  state.units[uid] = d;
  if (GD.valid()) { st('드라이브에 저장하는 중…'); await GD.put(path, new Blob([JSON.stringify(d)], {type: 'application/json'})).catch(e => { console.warn(e); toast('드라이브 저장에 실패했어요 — 이 기기에서만 보여요. 다시 넣어 주세요'); }); }
  const n = d.mcq.length + (d.ox || []).length + (d.short || []).length;
  prog.my[uid] = {t: Date.now(), lib: s.lib, libName: s.libName, subject: s.name, sid: s.id, folder: s.folder, title: d.title || title, file: fname, n};
  state.subs = null; saveProg();
  return {title: d.title || title, ready: true, n, uid};
}
