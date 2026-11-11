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
  state.openFig = null;
  if (!GD.valid() && (cfg.mode === 'drive' || store.get('gdLinked'))) {
    box.innerHTML = `<div class="card callout"><div class="mark">${ic('camera')}</div><div class="grow muted">강의 화면·원본 PDF(표·그래프)를 보려면 구글 로그인이 필요해요.</div><button class="btn sm" id="sl-login">다시 로그인</button></div>`;
    box.querySelector('#sl-login').onclick = async e => { busy(e.target, ''); try { await GD.login(); } catch (err) { toast(err.message); } hydrateSlides(box, u, d); };
    return;
  }
  const [imgs, pdf] = await Promise.all([slideList(u), findSourcePdf(u, d)]);
  let pdfN = 0;
  if (pdf) { try { pdfN = (await openPdfDoc(pdf)).numPages; } catch (e) { console.warn(e); } }
  const modes = [];
  if (pdfN) modes.push(['pdf', '자료 PDF']);
  if (imgs) modes.push(['img', '강의 화면']);
  if (!modes.length) { box.remove(); return; }
  let mode = modes[0][0], i = 0;
  const count = () => mode === 'pdf' ? pdfN : imgs.length;
  const label = k => mode === 'pdf' ? `${k + 1} / ${pdfN}쪽` : `${k + 1} / ${imgs.length} · ${esc(imgs[k].name.replace(/\.[a-z]+$/i, ''))}`;
  function shell() {
    box.innerHTML = `<div class="sect">표·그래프 원본 보기</div><div class="card" style="padding:14px">
      ${modes.length > 1 ? `<div class="seg" style="margin-bottom:10px">${modes.map(([m, nm]) => `<button data-m="${m}" class="${m === mode ? 'on' : ''}">${nm}</button>`).join('')}</div>` : ''}
      <div class="row" style="margin-bottom:10px"><button class="btn sm" id="sl-p" aria-label="앞">${ic('back', 16)}</button>
        <select id="sl-sel" class="grow">${Array.from({length: count()}, (_, k) => `<option value="${k}">${label(k)}</option>`).join('')}</select>
        <button class="btn sm" id="sl-n" aria-label="다음">${ic('chev', 16)}</button></div>
      <div id="sl-img" style="min-height:160px;display:flex;align-items:center;justify-content:center;background:#15161a;border-radius:12px;overflow:hidden;cursor:zoom-in"><span class="spin"></span></div>
      <p class="faint" style="margin:8px 0 0">${mode === 'pdf' ? `원본 자료(${esc(pdf.name)})를 그대로 보여 줘요 — 표와 그래프가 제자리에 있어요. 본문의 '그림 p.○' 표시를 눌러도 그 쪽이 열려요.` : '강의 영상에서 뽑은 화면이라 교수님 판서·그래프·표가 그대로예요.'} 화면을 누르면 크게 보여요.</p></div>`;
    const img = box.querySelector('#sl-img'), sel = box.querySelector('#sl-sel');
    async function show(k) {
      i = (k + count()) % count(); sel.value = i; store.set('slide.' + mode + '.' + u.id, i);
      img.innerHTML = '<span class="spin"></span>';
      try {
        const url = mode === 'pdf' ? await pdfPageUrl(pdf, i + 1) : await slideUrl(imgs[i]);
        img.innerHTML = `<img src="${url}" style="width:100%;display:block" alt="">`;
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
    if (pdfN) state.openFig = n => { if (mode !== 'pdf') { mode = 'pdf'; shell(); } box.scrollIntoView({behavior: 'smooth', block: 'center'}); show(n - 1); };
    show(Math.min(store.get('slide.' + mode + '.' + u.id, 0), count() - 1));
  }
  shell();
}
