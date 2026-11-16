'use strict';
// ── 강의 화면(슬라이드)·원본 PDF 보기 ────────────────────────────────
// 표·그래프는 글로 다 옮겨지지 않는다. 그래서 단원 화면에서
//  ① PC가 강의 영상에서 추출해 드라이브 '강의/<과목>/slides_<영상 이름>'에 둔 화면(PNG)과
//  ② 그 단원의 원본 자료 PDF(생성기 단원은 d.slides의 파일 이름으로 드라이브에서 찾고,
//     앱에서 넣은 단원은 '받은 자료'에 올린 원본)를 한 장씩 넘겨 본다.
// 본문의 [[그림 pN: …]] 표시를 누르면 원본 PDF의 그 쪽이 열린다(state.openFig).
// 한 장씩 받아 보고, 받은 것은 기기에 저장해 두 번째부터는 바로 뜬다.

async function slidesFolderId(u) {
  const f = String(u.file || '').replace(/'/g, "\\'");
  if (!f) return null;
  const r = await GD.list(`(name = 'slides_${f}' or name = 'slides_${f}.part') and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const hit = Object.values(r)[0];
  return hit ? hit.id : null;
}
async function slideList(u) {
  state.slides ||= {};
  if (state.slides[u.id] !== undefined) return state.slides[u.id];
  try {
    if (!GD.valid()) return state.slides[u.id] = null;
    const id = await slidesFolderId(u);
    if (!id) return state.slides[u.id] = null;
    const r = await GD.list(`'${id}' in parents and trashed = false and mimeType contains 'image/'`);
    const files = Object.values(r).sort((a, b) => a.name < b.name ? -1 : 1);
    return state.slides[u.id] = files.length ? files : null;
  } catch { return state.slides[u.id] = null; }
}
const slideUrls = {};
async function slideUrl(f) {
  if (slideUrls[f.id]) return slideUrls[f.id];
  let c = await cacheGet('img:' + f.id), blob = c && c.stamp === f.modifiedTime ? c.blob : null;
  if (!blob) {
    blob = await (await GD.fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`)).blob();
    cachePut('img:' + f.id, {stamp: f.modifiedTime, blob});
  }
  return slideUrls[f.id] = URL.createObjectURL(blob);
}


// ── 강의 원고(자막 srt · 원고 txt) ───────────────────────────────────
// PC가 영상 옆에 만든 '<영상 이름>.srt'(시간 있음)·'<영상 이름>.txt'(글만)를 드라이브에서 찾는다.
// srt가 있으면 화면 파일 이름의 시각(001_00-03-18.png)과 맞춰 '이 화면에서 하신 말씀'을 붙인다.
const secOf = (h, m, s) => (+h) * 3600 + (+m) * 60 + (+s);
const clock = t => { t = Math.max(0, Math.floor(t)); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), x = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
function slideSec(name) { const m = String(name).match(/(\d{1,2})-(\d{2})-(\d{2})(?:\.\w+)?$/); return m ? secOf(m[1], m[2], m[3]) : null; }
function parseSrt(txt) {
  const out = [];
  for (const b of String(txt).replace(/\r/g, '').split(/\n\s*\n/)) {
    const m = b.match(/(\d+):(\d{2}):(\d{2})[,.](\d+)\s*-->\s*(\d+):(\d{2}):(\d{2})/);
    if (!m) continue;
    const text = b.split('\n').filter(l => l.trim() && !/^\d+$/.test(l.trim()) && !/-->/.test(l)).join(' ').trim();
    if (text) out.push({t: secOf(m[1], m[2], m[3]), e: secOf(m[5], m[6], m[7]), text});
  }
  return out;
}
async function transcriptOf(u) {
  state.trans ||= {};
  if (state.trans[u.id] !== undefined) return state.trans[u.id];
  const f = String(u.file || '').replace(/\.(mp4|mkv|webm|m4a|mp3)$/i, '');
  if (!f || !GD.valid()) return state.trans[u.id] = null;
  try {
    const q = f.replace(/'/g, "\\'");
    const r = await GD.list(`(name = '${q}.srt' or name = '${q}.txt') and trashed = false`);
    const hit = r[f + '.srt'] || r[f + '.txt'];
    if (!hit) return state.trans[u.id] = null;
    let c = await cacheGet('tr:' + hit.id), text = c && c.stamp === hit.modifiedTime ? c.text : null;
    if (text == null) {
      text = await (await GD.fetch(`https://www.googleapis.com/drive/v3/files/${hit.id}?alt=media`)).text();
      cachePut('tr:' + hit.id, {stamp: hit.modifiedTime, text});
    }
    const cues = /\.srt$/i.test(hit.name) ? parseSrt(text) : [];
    return state.trans[u.id] = {name: hit.name, cues, text: cues.length ? cues.map(c => c.text).join(' ') : text};
  } catch (e) { console.warn(e); return state.trans[u.id] = null; }
}
// k번째 화면이 떠 있던 동안의 말씀
function cuesFor(imgs, k, cues) {
  const a = slideSec(imgs[k].name); if (a == null) return [];
  let b = Infinity;
  for (let j = k + 1; j < imgs.length; j++) { const x = slideSec(imgs[j].name); if (x != null && x > a) { b = x; break; } }
  return cues.filter(c => c.t >= a - 1 && c.t < b - 1);
}
function slideAt(imgs, t) {
  let best = 0;
  imgs.forEach((f, k) => { const x = slideSec(f.name); if (x != null && x <= t + 1) best = k; });
  return best;
}

// ── 원본 PDF ────────────────────────────────────────────────────────
// 앱에서 넣은 단원: 받은 자료/<서재>/<과목>/<파일>. 생성기 단원: d.slides의 .pdf 이름을 드라이브 전체에서 찾는다.
async function findSourcePdf(u, d) {
  try {
    const m = u.mine && prog.my?.[u.id];
    if (m && m.file && /\.pdf$/i.test(m.file)) {
      const p = `받은 자료/${m.libName}/${m.subject}/${m.file}`;
      const f = await src().file(p);
      return {key: 'p:' + p, name: m.file, blob: () => f.blob()};
    }
  } catch {}
  try {
    const nm = (d.slides || []).map(String).find(x => /\.pdf$/i.test(x));
    if (nm && GD.valid()) {
      const r = await GD.list(`name = '${nm.replace(/'/g, "\\'")}' and mimeType = 'application/pdf' and trashed = false`);
      const hit = Object.values(r)[0];
      if (hit) return {key: 'g:' + hit.id, name: nm, blob: async () => (await GD.fetch(`https://www.googleapis.com/drive/v3/files/${hit.id}?alt=media`)).blob()};
    }
  } catch {}
  return null;
}
let pdfjsP;
const pdfjs = () => pdfjsP ||= new Promise((res, rej) => {
  if (window.pdfjsLib) return res(window.pdfjsLib);
  const s = document.createElement('script'); s.src = 'vendor/pdfjs/pdf.min.js';
  s.onload = () => { pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js'; res(pdfjsLib); };
  s.onerror = () => rej(new Error('PDF 읽기 도구를 받지 못했어요')); document.head.append(s);
});
async function openPdfDoc(srcPdf) {
  state.pdfDocs ||= {};
  if (state.pdfDocs[srcPdf.key]) return state.pdfDocs[srcPdf.key];
  const lib = await pdfjs();
  let c = await cacheGet('pdf:' + srcPdf.key), blob = c && c.blob;
  if (!blob) { blob = await srcPdf.blob(); cachePut('pdf:' + srcPdf.key, {blob}); }
  const doc = await lib.getDocument({data: await blob.arrayBuffer()}).promise;
  return state.pdfDocs[srcPdf.key] = doc;
}
async function pdfPageUrl(srcPdf, n) {   // n은 1부터
  const doc = await openPdfDoc(srcPdf);
  const page = await doc.getPage(Math.min(Math.max(1, n), doc.numPages));
  const vp = page.getViewport({scale: Math.min(2, 1600 / page.getViewport({scale: 1}).width)});
  const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
  await page.render({canvasContext: cv.getContext('2d'), viewport: vp}).promise;
  return cv.toDataURL('image/jpeg', .9);
}

// ── 단원 화면에 채우기 ───────────────────────────────────────────────
async function hydrateSlides(box, u, d) {
  if (!box) return;
  state.openFig = null; state.openAt = null;
  if (!GD.valid() && (cfg.mode === 'drive' || store.get('gdLinked'))) {
    box.innerHTML = `<div class="card callout"><div class="mark">${ic('camera')}</div><div class="grow muted">강의 화면·원본 PDF(표·그래프)를 보려면 구글 로그인이 필요해요.</div><button class="btn sm" id="sl-login">다시 로그인</button></div>`;
    box.querySelector('#sl-login').onclick = async e => { busy(e.target, ''); try { await GD.login(); } catch (err) { toast(err.message); } hydrateSlides(box, u, d); };
    return;
  }
  const [imgs, pdf, tr] = await Promise.all([slideList(u), findSourcePdf(u, d), transcriptOf(u)]);
  let pdfN = 0;
  if (pdf) { try { pdfN = (await openPdfDoc(pdf)).numPages; } catch (e) { console.warn(e); } }
  const modes = [];
  if (pdfN) modes.push(['pdf', '자료 PDF']);
  if (imgs) modes.push(['img', '강의 화면']);
  if (tr && (tr.cues.length || tr.text.trim())) modes.push(['txt', tr.cues.length ? '자막' : '강의 원고']);
  if (!modes.length) { box.remove(); return; }
  let mode = modes[0][0], i = 0, find = '';
  const count = () => mode === 'pdf' ? pdfN : mode === 'img' ? imgs.length : 1;
  const label = k => mode === 'pdf' ? `${k + 1} / ${pdfN}쪽` : `${k + 1} / ${imgs.length} · ${esc(imgs[k].name.replace(/\.[a-z]+$/i, ''))}`;
  function shell() {
    if (mode === 'txt') return shellTxt();
    box.innerHTML = `<div class="sect">표·그래프·강의 원본 보기</div><div class="card" style="padding:14px">
      ${modes.length > 1 ? `<div class="seg" style="margin-bottom:10px">${modes.map(([m, nm]) => `<button data-m="${m}" class="${m === mode ? 'on' : ''}">${nm}</button>`).join('')}</div>` : ''}
      <div class="row" style="margin-bottom:10px"><button class="btn sm" id="sl-p" aria-label="앞">${ic('back', 16)}</button>
        <select id="sl-sel" class="grow">${Array.from({length: count()}, (_, k) => `<option value="${k}">${label(k)}</option>`).join('')}</select>
        <button class="btn sm" id="sl-n" aria-label="다음">${ic('chev', 16)}</button></div>
      <div id="sl-img" style="min-height:160px;display:flex;align-items:center;justify-content:center;background:#15161a;border-radius:12px;overflow:hidden;cursor:zoom-in"><span class="spin"></span></div>
      ${mode === 'img' && tr && tr.cues.length ? '<div id="sl-say" style="margin-top:10px"></div>' : ''}
      <p class="faint" style="margin:8px 0 0">${mode === 'pdf' ? `원본 자료(${esc(pdf.name)})를 그대로 보여 줘요 — 표와 그래프가 제자리에 있어요. 본문의 '그림 p.○' 표시를 눌러도 그 쪽이 열려요.` : '강의 영상에서 뽑은 화면이라 교수님 판서·그래프·표가 그대로예요.'} 화면을 누르면 크게 보여요.</p></div>`;
    const img = box.querySelector('#sl-img'), sel = box.querySelector('#sl-sel');
    async function show(k) {
      i = (k + count()) % count(); sel.value = i; store.set('slide.' + mode + '.' + u.id, i);
      img.innerHTML = '<span class="spin"></span>';
      try {
        const url = mode === 'pdf' ? await pdfPageUrl(pdf, i + 1) : await slideUrl(imgs[i]);
        img.innerHTML = `<img src="${url}" style="width:100%;display:block" alt="">`;
        const say = box.querySelector('#sl-say');
        if (say) {
          const cs = cuesFor(imgs, i, tr.cues);
          say.innerHTML = cs.length ? `<div style="font-size:13px;font-weight:650;color:var(--sub);margin-bottom:4px">이 화면에서 하신 말씀 · ${clock(cs[0].t)}~</div><div style="max-height:220px;overflow:auto;line-height:1.7;font-size:15px">${esc(cs.map(c => c.text).join(' '))}</div>` : '<div class="faint">이 화면에서는 말씀이 거의 없었어요.</div>';
        }
        if (mode === 'pdf') { if (i + 2 <= pdfN) pdfPageUrl(pdf, i + 2).catch(() => {}); } else slideUrl(imgs[(i + 1) % imgs.length]).catch(() => {});
      } catch (e) { img.innerHTML = `<span class="muted" style="padding:20px">${esc(e instanceof NeedAuth ? '구글 로그인이 풀렸어요. 설정에서 다시 로그인해 주세요.' : e.message)}</span>`; }
    }
    box.querySelector('#sl-p').onclick = () => show(i - 1);
    box.querySelector('#sl-n').onclick = () => show(i + 1);
    sel.onchange = e => show(+e.target.value);
    box.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; shell(); });
    img.onclick = () => {
      const im = img.querySelector('img'); if (!im) return;
      const o = document.createElement('div');
      o.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,12,.94);z-index:99;overflow:auto;cursor:zoom-out;display:flex';
      o.innerHTML = `<img src="${im.src}" style="width:170%;max-width:none;margin:auto" alt="">`;
      o.onclick = () => o.remove(); document.body.append(o);
    };
    if (imgs) state.openAt = t => { if (mode !== 'img') { mode = 'img'; store.set('slide.img.' + u.id, slideAt(imgs, t)); shell(); box.scrollIntoView({behavior: 'smooth', block: 'center'}); return; } box.scrollIntoView({behavior: 'smooth', block: 'center'}); show(slideAt(imgs, t)); };
    if (pdfN) state.openFig = n => { if (mode !== 'pdf') { mode = 'pdf'; shell(); } box.scrollIntoView({behavior: 'smooth', block: 'center'}); show(n - 1); };
    show(Math.min(store.get('slide.' + mode + '.' + u.id, 0), count() - 1));
  }
  // 자막·원고: 시각을 누르면 그때의 강의 화면으로 넘어간다
  function shellTxt() {
    const seg = modes.length > 1 ? `<div class="seg" style="margin-bottom:10px">${modes.map(([m, nm]) => `<button data-m="${m}" class="${m === mode ? 'on' : ''}">${nm}</button>`).join('')}</div>` : '';
    box.innerHTML = `<div class="sect">표·그래프·강의 원본 보기</div><div class="card" style="padding:14px">${seg}
      <input id="tr-q" type="search" placeholder="원고에서 찾기 (예: 외부효과, 피구세)" value="${esc(find)}" style="margin-bottom:10px">
      <div id="tr-body" style="max-height:60vh;overflow:auto;line-height:1.8;font-size:15px"></div>
      <p class="faint" style="margin:8px 0 0">${esc(tr.name)}${tr.cues.length && imgs ? ' · 시각을 누르면 그때의 강의 화면이 열려요' : ''}</p></div>`;
    const body = box.querySelector('#tr-body');
    const hl = t => find ? esc(t).split(esc(find)).join(`<mark>${esc(find)}</mark>`) : esc(t);
    function paint() {
      if (tr.cues.length) {
        // 화면이 바뀌는 곳마다(없으면 1분마다) 한 문단으로 묶는다
        const cuts = imgs ? imgs.map(f => slideSec(f.name)).filter(x => x != null) : [];
        const groups = []; let cur = null;
        for (const c of tr.cues) {
          const k = cuts.length ? cuts.filter(x => x <= c.t + 1).length : Math.floor(c.t / 60);
          if (!cur || cur.k !== k) groups.push(cur = {k, t: c.t, text: []});
          cur.text.push(c.text);
        }
        const gs = find ? groups.filter(g => g.text.join(' ').includes(find)) : groups;
        body.innerHTML = gs.length ? gs.map(g => `<p style="margin:0 0 10px"><button class="btn ghost sm" data-t="${g.t}" style="margin-right:6px;font-variant-numeric:tabular-nums">${clock(g.t)}</button>${hl(g.text.join(' '))}</p>`).join('') : '<p class="muted">찾는 말이 없어요.</p>';
        if (imgs) body.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { mode = 'img'; store.set('slide.img.' + u.id, slideAt(imgs, +b.dataset.t)); shell(); });
      } else {
        const ps = tr.text.replace(/([.?!다요])\s+/g, '$1\n').split(/\n+/).reduce((a, x) => { const l = a.at(-1); if (l && l.length < 260) a[a.length - 1] = l + ' ' + x; else a.push(x); return a; }, []);
        const show_ = find ? ps.filter(x => x.includes(find)) : ps;
        body.innerHTML = show_.length ? show_.map(x => `<p style="margin:0 0 10px">${hl(x)}</p>`).join('') : '<p class="muted">찾는 말이 없어요.</p>';
      }
    }
    paint();
    const q = box.querySelector('#tr-q');
    q.oninput = () => { find = q.value.trim(); paint(); };
    box.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; shell(); });
  }
  shell();
}
