'use strict';
// ── 강의 화면(슬라이드) 보기 ─────────────────────────────────────────
// 표·그래프는 글로 다 옮겨지지 않아서, PC가 강의 영상에서 추출해 드라이브 '강의/<과목>/slides_<영상 이름>'
// 폴더에 둔 화면(PNG)을 단원에서 바로 보여 준다. 폴더는 이름으로 찾으므로 자료 폴더(Studium) 밖이어도 된다.
// 한 장씩 받아 보고(다음 장은 미리 받기), 받은 장은 기기에 저장해 두 번째부터는 바로 뜬다.

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
// 단원 화면의 자리(box)에 슬라이드 넘겨보기를 채운다. 찾는 폴더가 없으면 조용히 치운다.
async function hydrateSlides(box, u) {
  if (!box) return;
  if (!u.file) { box.remove(); return; }
  if (!GD.valid()) {   // 드라이브를 쓰는데 로그인이 풀렸으면 숨기지 말고 다시 로그인을 권한다
    if (cfg.mode === 'drive' || store.get('gdLinked')) box.innerHTML = `<div class="card callout"><div class="mark">${ic('camera')}</div><div class="grow muted">강의 화면(표·그래프)을 보려면 구글 로그인이 필요해요.</div><button class="btn sm" id="sl-login">다시 로그인</button></div>`,
      box.querySelector('#sl-login').onclick = async e => { busy(e.target, ''); try { await GD.login(); hydrateSlides(box, u); } catch (err) { toast(err.message); hydrateSlides(box, u); } };
    else box.remove();
    return;
  }
  const list = await slideList(u);
  if (!list) { box.remove(); return; }
  let i = Math.min(store.get('slide.' + u.id, 0), list.length - 1);
  box.innerHTML = `<div class="sect">강의 화면 · 표와 그래프 그대로</div><div class="card" style="padding:14px">
    <div class="row" style="margin-bottom:10px"><button class="btn sm" id="sl-p" aria-label="앞 화면">${ic('back', 16)}</button>
      <select id="sl-sel" class="grow">${list.map((f, k) => `<option value="${k}">${k + 1} / ${list.length} · ${esc(f.name.replace(/\.[a-z]+$/i, ''))}</option>`).join('')}</select>
      <button class="btn sm" id="sl-n" aria-label="다음 화면">${ic('chev', 16)}</button></div>
    <div id="sl-img" style="min-height:160px;display:flex;align-items:center;justify-content:center;background:#15161a;border-radius:12px;overflow:hidden;cursor:zoom-in"><span class="spin"></span></div>
    <p class="faint" style="margin:8px 0 0">강의 영상에서 뽑은 화면이라 교수님 판서·그래프·표가 그대로예요. 화면을 누르면 크게 보여요.</p></div>`;
  const img = box.querySelector('#sl-img'), sel = box.querySelector('#sl-sel');
  async function show(k) {
    i = (k + list.length) % list.length; store.set('slide.' + u.id, i); sel.value = i;
    img.innerHTML = '<span class="spin"></span>';
    try {
      const src_ = await slideUrl(list[i]);
      img.innerHTML = `<img src="${src_}" style="width:100%;display:block" alt="슬라이드 ${i + 1}">`;
      slideUrl(list[(i + 1) % list.length]).catch(() => {});   // 다음 장 미리 받아 두기
    } catch (e) { img.innerHTML = `<span class="muted" style="padding:20px">${esc(e instanceof NeedAuth ? '구글 로그인이 풀렸어요. 설정에서 다시 로그인해 주세요.' : e.message)}</span>`; }
  }
  box.querySelector('#sl-p').onclick = () => show(i - 1);
  box.querySelector('#sl-n').onclick = () => show(i + 1);
  sel.onchange = e => show(+e.target.value);
  img.onclick = () => {
    const im = img.querySelector('img'); if (!im) return;
    const o = document.createElement('div');
    o.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,12,.94);z-index:99;overflow:auto;cursor:zoom-out;display:flex';
    o.innerHTML = `<img src="${im.src}" style="width:170%;max-width:none;margin:auto" alt="">`;
    o.onclick = () => o.remove(); document.body.append(o);
  };
  show(i);
}
