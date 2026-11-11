'use strict';
// ── 자료 넣기: PDF·사진·문서·음성·영상·유튜브·글 → 바로 정리(Gemini) + 드라이브 '받은 자료'에 원본 ──
// 원본은 Studium/받은 자료/<서재>/<과목>/ 에 올라가 PC 생성기가 굿노트 PDF·NotebookLM 에 쓴다.
// 정리 결과는 Studium/<서재>/<과목>/<id>.json (PC 결과와 같은 자리·같은 모양)이고 진도(prog.my)로 기기끼리 보인다.
const UNIT_S = obj({title: S_, note: S_, points: arr(S_), terms: arr(obj({t: S_, d: S_})), emphasis: arr(S_), mcq: arr(MCQ_S), ox: arr(OX_S), short: arr(SHORT_S)});
const MATERIAL_PROMPT = (subject, title, kind) => `너는 학습서를 만드는 조교다. 함께 준 자료('${title}', 과목 '${subject}')로 공부 자료를 만든다.
${kind === 'image' ? '자료는 책·필기·칠판을 찍은 사진이다. 글자(손글씨 포함)를 정확히 읽고 쪽 순서대로 정리한다.' : kind === 'video' ? '자료는 강의·설명 영상이다. 말과 화면의 내용을 따라 정리한다.' : kind === 'audio' ? '자료는 강의 녹음이다. 말한 내용을 정리하고 잘못 들린 낱말은 맥락으로 바로잡는다.' : ''}
규칙: 자료에 있는 내용만 쓴다. 지어내지 않는다. 한국어, 학습서 문체(~다).
- title: 자료 제목(짧게)
- note: 기본서처럼 정리한 본문(마크다운). '## 소제목'으로 나누고 개념 정의 → 설명 → 예시. 비교는 표, 나열은 목록. ★자료에 표가 있으면 빼지 말고 마크다운 표로 그대로 옮긴다(머리글·수치 전부). 그래프·그림은 무엇이 어떻게 변하는지 글로 짚는다. 강조된 곳은 앞에 '★'. 자료 분량에 맞게 충분히 자세히.
- points: 핵심 6~10개 · terms: 주요 용어 6~15개(t, d) · emphasis: 자료에서 특히 강조한 것(없으면 빈 배열)
- mcq: 객관식 8문제(c 보기 5개, a 정답 순서 0부터, e 해설, 정답 위치 고르게) · ox: 5문제(a, e) · short: 서술형 3문제(a 모범 답안, k 핵심어 3~6개)`;
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

function viewAdd() {
  frame('자료 넣기', '#/');
  const libs = libsOf(), cur = store.get('addTo', {lib: 'my', libName: '내 공부', subject: ''});
  const subsOf = lib => allSubjects().filter(s => s.lib === lib);
  render(`<div class="narrow"><section class="hero" style="margin-bottom:20px"><div class="eyebrow">자료 넣기</div><h2 class="display">무엇이든 넣으면 정리돼요</h2>
    <p class="lede">PDF·사진·문서(docx·pptx·hwpx)·녹음·영상·유튜브·글을 넣으면 기본서 노트, 카드, 문제가 만들어져요.</p></section>
    <div class="card"><label class="field"><span>서재</span><div class="opt" id="a-lib">${[...new Map([['my', {id: 'my', name: '내 공부'}], ...libs.map(l => [l.id, l])]).values()].map(l => `<label><input type="radio" name="al" value="${esc(l.id)}" data-name="${esc(l.name)}" ${cur.lib === l.id ? 'checked' : ''}>${esc(l.name)}</label>`).join('')}<label><input type="radio" name="al" value="_new">+ 새 서재</label></div>
      <input type="text" id="a-newlib" placeholder="새 서재 이름 (예: 토익, 법무사, 자격증)" hidden style="margin-top:8px"></label>
      <label class="field"><span>과목</span><div class="row"><select id="a-subj" class="grow"></select><input type="text" id="a-newsubj" class="grow" placeholder="새 과목 이름" hidden></div></label></div>
    <div class="card"><div class="seg" style="margin-bottom:16px"><button class="on" data-k="file">${ic('upload', 16)} 파일</button><button data-k="cam">${ic('camera', 16)} 사진 찍기</button><button data-k="yt">${ic('link', 16)} 유튜브·링크</button><button data-k="text">${ic('memo', 16)} 글</button></div>
      <div data-p="file"><label class="drop" id="a-drop"><input type="file" id="a-files" multiple accept=".pdf,.txt,.md,.docx,.pptx,.hwpx,image/*,audio/*,video/*" hidden>${ic('upload', 28)}<b>눌러서 고르거나 여기에 끌어다 놓기</b><span class="faint">여러 개를 한 번에 넣어도 돼요</span></label></div>
      <div data-p="cam" hidden><label class="drop"><input type="file" id="a-cam" accept="image/*" capture="environment" multiple hidden>${ic('camera', 28)}<b>책·필기·칠판 찍기</b><span class="faint">여러 장 찍으면 한 자료로 묶어요</span></label></div>
      <div data-p="yt" hidden><input type="text" id="a-url" placeholder="https://youtu.be/…" style="width:100%"><p class="faint" style="margin:8px 0 0">유튜브 영상은 Gemini가 직접 보고 정리해요.</p></div>
      <div data-p="text" hidden><input type="text" id="a-ttl" placeholder="제목" style="width:100%;margin-bottom:8px"><textarea id="a-text" placeholder="필기, 기사, 정리하고 싶은 글을 붙여 넣으세요"></textarea></div>
      <div id="a-list" class="alist"></div>
      <label class="row faint" style="margin-top:10px"><input type="checkbox" id="a-group" checked>사진 여러 장은 한 자료로 묶기</label></div>
    <div class="row"><button class="btn pri" id="a-go">${ic('spark', 18)}정리하기</button><span class="grow faint" id="a-note">${aiOn() ? '' : 'Gemini 키가 없으면 원본만 드라이브에 올리고, PC 생성기가 정리해요.'}</span></div>
    <div id="a-out" style="margin-top:16px"></div></div>`);
  let tab = 'file', picked = [];
  const libSel = () => main_.querySelector('[name=al]:checked');
  const paintSubj = () => {
    const l = libSel()?.value, ss = l && l !== '_new' ? subsOf(l) : [];
    $('#a-newlib').hidden = l !== '_new';
    $('#a-subj').innerHTML = ss.map(s => `<option value="${esc(s.name)}" ${s.name === cur.subject ? 'selected' : ''}>${esc(s.name)}</option>`).join('') + '<option value="_new">+ 새 과목</option>';
    $('#a-newsubj').hidden = $('#a-subj').value !== '_new';
  };
  main_.querySelectorAll('[name=al]').forEach(r => r.onchange = paintSubj);
  $('#a-subj').onchange = () => { $('#a-newsubj').hidden = $('#a-subj').value !== '_new'; };
  paintSubj();
  main_.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { tab = b.dataset.k; main_.querySelectorAll('[data-k]').forEach(x => x.classList.toggle('on', x === b)); main_.querySelectorAll('[data-p]').forEach(p => p.hidden = p.dataset.p !== tab); });
  const paintList = () => $('#a-list').innerHTML = picked.map((f, i) => `<div class="row"><span class="tag">${kindOf(mimeOf(f)) === 'doc' ? extOf(f.name).toUpperCase() || '파일' : {image: '사진', audio: '녹음', video: '영상'}[kindOf(mimeOf(f))]}</span><span class="grow">${esc(f.name)}</span><span class="faint">${(f.size / 2 ** 20).toFixed(1)}MB</span><button class="btn ghost sm" data-rm="${i}">${ic('x', 14)}</button></div>`).join('');
  $('#a-list').onclick = e => { const b = e.target.closest('[data-rm]'); if (b) { picked.splice(+b.dataset.rm, 1); paintList(); } };
  const addFiles = fs => { picked.push(...fs); paintList(); };
  $('#a-files').onchange = e => addFiles([...e.target.files]);
  $('#a-cam').onchange = e => addFiles([...e.target.files]);
  const drop = $('#a-drop');
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); addFiles([...e.dataTransfer.files]); };
  $('#a-go').onclick = async () => {
    const l = libSel(); if (!l) return toast('서재를 골라 주세요');
    const libName = l.value === '_new' ? $('#a-newlib').value.trim() : l.dataset.name;
    const subject = $('#a-subj').value === '_new' ? $('#a-newsubj').value.trim() : $('#a-subj').value;
    if (!libName || !subject) return toast('서재와 과목 이름을 넣어 주세요');
    const lib = l.value === '_new' ? 'l' + (await sha12(libName)).slice(0, 8) : l.value;
    const items = [];
    if (tab === 'yt') { const u = $('#a-url').value.trim(); if (!u) return toast('주소를 넣어 주세요'); items.push({kind: 'link', url: u}); }
    else if (tab === 'text') { const t = $('#a-text').value.trim(); if (!t) return toast('글을 넣어 주세요'); items.push({kind: 'text', text: t, title: $('#a-ttl').value.trim() || t.slice(0, 24)}); }
    else {
      if (!picked.length) return toast('파일을 골라 주세요');
      const imgs = picked.filter(f => kindOf(mimeOf(f)) === 'image'), rest = picked.filter(f => kindOf(mimeOf(f)) !== 'image');
      if ($('#a-group').checked && imgs.length > 1) items.push({kind: 'images', files: imgs}); else items.push(...imgs.map(f => ({kind: 'file', file: f})));
      items.push(...rest.map(f => ({kind: 'file', file: f})));
    }
    store.set('addTo', {lib, libName, subject});
    busy($('#a-go'), '정리하는 중…');
    const out = $('#a-out');
    for (const it of items) {
      const row = document.createElement('div'); row.className = 'card callout'; out.prepend(row);
      const label = it.file?.name || it.files?.[0]?.name || it.url || it.title;
      row.innerHTML = `<div class="mark"><span class="spin"></span></div><div class="grow"><b>${esc(label)}</b><div class="faint" data-st>준비 중…</div></div>`;
      const st = t => row.querySelector('[data-st]').textContent = t;
      try {
        const r = await ingest({lib, libName, subject}, it, st);
        row.innerHTML = `<div class="mark" style="color:var(--ok)">${ic('check')}</div><div class="grow"><b>${esc(r.title)}</b><div class="faint">${r.ready ? `정리 완료 · 문제 ${r.n}개` : '드라이브에 올렸어요 · PC 생성기가 정리하면 나타나요'}</div></div>${r.ready ? `<button class="btn sm" data-go="#/s/${r.sid}/u/${r.uid}">열기</button>` : ''}`;
        bindGo(row);
      } catch (e) {
        row.innerHTML = `<div class="mark" style="color:var(--bad)">${ic('x')}</div><div class="grow"><b>${esc(label)}</b><div class="faint">${esc(e.message)}</div></div>`;
      }
    }
    picked = []; paintList(); unbusy($('#a-go'));
  };
}

// 아이폰 카메라는 사진마다 'image.jpg' 라 이름이 같으면 앞 자료를 덮어쓴다 → 찍은 시각을 붙인 이름을 쓴다
const shotName = ext => `사진_${new Date().toISOString().slice(0, 19).replace(/\D/g, '')}_${Math.random().toString(36).slice(2, 5)}.${ext}`;
const takenName = (sid, file) => Object.values(prog.my || {}).some(m => !m.del && m.sid === sid && m.file === file);
async function ingest({lib, libName, subject}, it, st) {
  const sid = await sha12(subjKey(lib, subject)), folder = `${libName}/${subject}`;
  let fileName, blob, mime, parts = [], kind = 'doc', title;
  if (it.kind === 'link') {
    const id = ytId(it.url);
    title = id ? `유튜브 ${id}` : it.url.replace(/^https?:\/\//, '').slice(0, 40);
    fileName = safeName(title) + '.url';
    blob = new Blob([`[InternetShortcut]\r\nURL=${it.url}\r\n`], {type: 'text/plain'});
    if (!id) throw new Error('지금은 유튜브 주소만 바로 정리돼요');
    parts = [{file_data: {file_uri: `https://www.youtube.com/watch?v=${id}`, mime_type: 'video/*'}}]; kind = 'video';
  } else if (it.kind === 'text') {
    title = it.title; fileName = safeName(title) + '.txt'; blob = new Blob([it.text], {type: 'text/plain'});
    parts = [{text: it.text}];
  } else if (it.kind === 'images') {
    const f0 = it.files[0].name;
    title = (/^image\.\w+$/i.test(f0) ? shotName('').slice(0, -1) : f0.replace(/\.[^.]+$/, '')) + ` 외 ${it.files.length - 1}장`; fileName = safeName(title) + '.zip.txt'; kind = 'image';
    if (takenName(sid, fileName)) { title = shotName('').slice(0, -1) + ` 외 ${it.files.length - 1}장`; fileName = safeName(title) + '.zip.txt'; }
    st('사진 읽는 중…');
    for (const f of it.files) parts.push(await gemFilePart(f, mimeOf(f), f.name));
  } else {
    const f = it.file; mime = mimeOf(f); kind = kindOf(mime); fileName = f.name; blob = f;
    if (kind === 'image' && (/^image\.\w+$/i.test(f.name) || takenName(sid, f.name))) fileName = shotName(extOf(f.name) || 'jpg');
    title = fileName.replace(/\.[^.]+$/, '');
    if (/^(docx|pptx|hwpx)$/.test(extOf(f.name))) { st('문서에서 글 꺼내는 중…'); parts = [{text: await officeText(f)}]; }
    else if (/^(txt|md)$/.test(extOf(f.name))) parts = [{text: await f.text()}];
    else { st(kind === 'doc' ? 'PDF 올리는 중…' : '파일 올리는 중…'); parts = [await gemFilePart(f, mime, f.name)]; }
  }
  const uid = await sha12(`inbox/${libName}/${subject}/${fileName}`);
  // 원본은 드라이브 '받은 자료'로 (사진 묶음은 장마다)
  if (GD.valid()) {
    st('드라이브에 원본 올리는 중…');
    const base = `${INBOX}/${libName}/${subject}`;
    if (it.kind === 'images') {
      const dup = new Set(it.files.map(f => f.name)).size < it.files.length;   // 카메라 사진은 모두 image.jpg 라 번호를 붙인다
      for (const [i, f] of it.files.entries()) await GD.put(`${base}/${safeName(title)}/${dup ? `${i + 1}_` : ''}${f.name}`, f).catch(() => {});
    }
    else await GD.put(`${base}/${fileName}`, blob).catch(e => console.warn(e));
  }
  if (!aiOn()) {
    if (!GD.valid()) throw new Error('Gemini 키나 구글 연결 중 하나는 있어야 해요');
    return {title, ready: false};
  }
  st('Gemini가 정리하는 중… (1~3분)');
  const d = await gem({parts: [...parts, {text: MATERIAL_PROMPT(subject, title, kind)}]}, {schema: UNIT_S, temp: .4});
  d.mcq = (d.mcq || []).filter(q => Array.isArray(q.c) && q.a >= 0 && q.a < q.c.length);
  Object.assign(d, {id: uid, file: fileName, subject, by: 'app', made: new Date().toISOString().slice(0, 19), hash: 'app:' + fileName});
  const path = `${folder}/${uid}.json`, body = JSON.stringify(d);
  await cachePut(path, {stamp: 'app', data: d});
  state.units[uid] = d;
  if (GD.valid()) { st('드라이브에 저장하는 중…'); await GD.put(`${FOLDER === '' ? '' : ''}${path}`, new Blob([body], {type: 'application/json'})).catch(e => { console.warn(e); toast('드라이브 저장에 실패했어요 — 이 기기에서만 보여요. 다시 넣어 주세요'); }); }
  const n = d.mcq.length + (d.ox || []).length + (d.short || []).length;
  prog.my[uid] = {t: Date.now(), lib, libName, subject, sid, folder, title: d.title || title, file: fileName, n};
  state.subs = null; saveProg();
  return {title: d.title || title, ready: true, n, sid, uid};
}
