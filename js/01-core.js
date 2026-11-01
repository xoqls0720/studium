'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAY = 864e5;
const APP = 'Studium';
const FOLDER = 'Studium';          // 구글 드라이브의 공부 자료 폴더 (PC 생성기가 채운다)
const INBOX = '받은 자료';          // 여기에 넣은 파일은 PC 생성기가 정리한다
// drive: 자료 폴더 읽기 + 앱에서 넣은 자료 올리기, appdata: 진도·필기 맞추기
const SC = 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.appdata';
const PROG_FILE = 'dongseo-progress.json';

const I = {
  home: '<path d="M3.5 10.2 12 3.5l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-4.3v-6h-5.4v6H5A1.5 1.5 0 0 1 3.5 19z"/>',
  review: '<path d="M20 11.5a8 8 0 1 1-2.4-5.7"/><path d="M20 4v5h-5"/>',
  set: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  spark: '<path d="M12 3.5l1.7 5L19 10.2l-5.3 1.7L12 17l-1.7-5.1L5 10.2l5.3-1.7z"/><path d="M18.5 15.5l.7 1.9 1.8.6-1.8.7-.7 1.8-.6-1.8-1.9-.7 1.9-.6z"/>',
  chev: '<path d="M9.5 6l6 6-6 6"/>',
  print: '<path d="M7 8.5V3.5h10v5"/><rect x="3.5" y="8.5" width="17" height="8" rx="2"/><path d="M7 14h10v6.5H7z"/>',
  bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  book: '<path d="M12 6.5C10.2 5 7.6 4.5 4 5v13.5c3.6-.5 6.2 0 8 1.5 1.8-1.5 4.4-2 8-1.5V5c-3.6-.5-6.2 0-8 1.5z"/><path d="M12 6.5V20"/>',
  pen: '<path d="M4 20l4.5-1 10.3-10.3a2.1 2.1 0 0 0-3-3L5.5 16z"/><path d="M14 7l3 3"/>',
  hl: '<path d="M14.5 4.5l5 5-7.5 7.5-5-5z"/><path d="M7 12l-2.5 5.5 2 2L12 17"/><path d="M4 20.5h5"/>',
  eraser: '<path d="M8.5 19.5h11"/><path d="M5 15.2l9.4-9.4a2 2 0 0 1 2.8 0l2 2a2 2 0 0 1 0 2.8L12 17.8 9.7 19.5H8.4z"/><path d="M9.5 10.7l4.8 4.8"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  hand: '<path d="M8 13V6a1.5 1.5 0 0 1 3 0v6"/><path d="M11 11.5V4.5a1.5 1.5 0 0 1 3 0V12"/><path d="M14 11.5V7a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-.6a5.4 5.4 0 0 1-4.6-2.6L4 15.3a1.6 1.6 0 0 1 2.7-1.7L8 15.5"/>',
  share: '<path d="M12 3.5v11"/><path d="M7.5 8L12 3.5 16.5 8"/><path d="M5 12.5V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6.5"/>',
  nb: '<rect x="4" y="3.5" width="14" height="17" rx="2.5"/><path d="M8 3.5v17M11 8h4M11 11.5h4"/><path d="M20 7v10"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  timer: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 2M9.5 2.5h5M12 2.5v3"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  cards: '<rect x="3.5" y="6.5" width="13" height="14" rx="2"/><path d="M7.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h10A1.5 1.5 0 0 1 20.5 5v11a1.5 1.5 0 0 1-1.5 1.5h-2.5"/>',
  sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  map: '<circle cx="12" cy="12" r="2.5"/><circle cx="4.5" cy="6" r="1.8"/><circle cx="19.5" cy="6" r="1.8"/><circle cx="4.5" cy="18" r="1.8"/><circle cx="19.5" cy="18" r="1.8"/><path d="M6 7l4 3.5M18 7l-4 3.5M6 17l4-3.5M18 17l-4-3.5"/>',
  mark: '<path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/>',
  memo: '<path d="M5 4.5h14v15H5z"/><path d="M8.5 9h7M8.5 12.5h7M8.5 16h4"/>',
  flame: '<path d="M12 21c-4 0-6.5-2.6-6.5-6.2 0-3.7 3-5.6 3.7-9.3 2.3 1.2 3.4 3.3 3.4 5.3 1-.6 1.7-1.7 2-3 2 1.6 3.9 4.2 3.9 7 0 3.6-2.5 6.2-6.5 6.2z"/>',
  upload: '<path d="M12 15.5v-11"/><path d="M7.5 9L12 4.5 16.5 9"/><path d="M4.5 15v3.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15"/>',
  camera: '<path d="M4 8h3l1.5-2.5h7L17 8h3a.5.5 0 0 1 .5.5V19a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V8.5A.5.5 0 0 1 4 8z"/><circle cx="12" cy="13.5" r="3.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  lib: '<path d="M5 4v16M9.5 4v16M14 5l4.5 15M3.5 20h17"/>',
};
const ic = (n, s = 20, w = 1.7) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;
document.querySelectorAll('[data-i]').forEach(e => e.outerHTML = ic(e.dataset.i, 21));
$('#back').innerHTML = ic('back', 22, 2);

// ── 저장소 ─────────────────────────────────────────────────────────
const store = {
  get(k, d) { try { const v = localStorage.getItem('ds.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ds.' + k, JSON.stringify(v)); } catch {} },
};
let dbp;
function db() {
  return dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open('dongseo-study', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('files'); r.result.createObjectStore('kv'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function idb(store_, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => { const t = d.transaction(store_, mode); const q = fn(t.objectStore(store_)); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); });
}
const cacheGet = p => idb('files', 'readonly', s => s.get(p)).catch(() => null);
const cachePut = (p, v) => idb('files', 'readwrite', s => s.put(v, p)).catch(() => {});
const kvGet = k => idb('kv', 'readonly', s => s.get(k)).catch(() => null);
const kvPut = (k, v) => idb('kv', 'readwrite', s => s.put(v, k)).catch(() => {});

// ── 자료 읽기: 내 컴퓨터 폴더 · 구글 드라이브 · 주소(serve.py) ─────────
// 구글 로그인용 앱 ID(노벨리스트와 같은 주소라 같은 것을 쓴다). 비워 두면 설정 › 고급에서 넣는다.
const CLIENT_ID = '';
const cfg = Object.assign({mode: '', client: ''}, store.get('cfg', {}));
cfg.client ||= CLIENT_ID;
const saveCfg = () => store.set('cfg', cfg);
const urlSrc = new URLSearchParams(location.search).get('src');
if (urlSrc) cfg.mode = 'url';

class NeedAuth extends Error {}
const Local = {
  dir: null,
  async ready(ask) {
    this.dir ||= await kvGet('dir');
    if (!this.dir) return false;
    const opt = {mode: 'read'};
    if (await this.dir.queryPermission(opt) === 'granted') return true;
    return ask ? (await this.dir.requestPermission(opt)) === 'granted' : false;
  },
  async pick() {
    const d = await window.showDirectoryPicker({id: 'dongseo', mode: 'read'});
    this.dir = d; await kvPut('dir', d);
    return d;
  },
  async file(path) {
    let h = this.dir;
    const parts = path.split('/');
    for (const p of parts.slice(0, -1)) h = await h.getDirectoryHandle(p);
    const f = await (await h.getFileHandle(parts.at(-1))).getFile();
    return {stamp: f.lastModified + ':' + f.size, read: () => f.text(), blob: async () => f};
  },
};

const GD = {
  tok: store.get('tok', null), folders: {}, lists: {},
  valid() { return this.tok && this.tok.exp > Date.now() + 60e3; },
  async gis() {
    if (window.google?.accounts?.oauth2) return;
    await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.onload = res; s.onerror = () => rej(new Error('구글 로그인 스크립트를 받지 못했어요')); document.head.append(s); });
  },
  login() {
    if (!cfg.client) return Promise.reject(new Error('설정 › 고급에서 구글 클라이언트 ID를 먼저 넣어 주세요'));
    return this.logging ||= (async () => {
      await this.gis();
      await new Promise((res, rej) => {
        const c = google.accounts.oauth2.initTokenClient({client_id: cfg.client, scope: SC, callback: r => {
          if (r.error) return rej(new Error(r.error));
          this.tok = {t: r.access_token, exp: Date.now() + (r.expires_in || 3600) * 1000}; store.set('tok', this.tok); res();
        }, error_callback: e => rej(new Error(e?.message || '로그인을 닫았어요'))});
        c.requestAccessToken({prompt: ''});
      });
    })().finally(() => this.logging = null);
  },
  async fetch(url, opt = {}) {
    if (!this.valid()) throw new NeedAuth();
    const r = await fetch(url, {...opt, headers: {...(opt.headers || {}), Authorization: 'Bearer ' + this.tok.t}});
    if (r.status === 401) { this.tok = null; store.set('tok', null); throw new NeedAuth(); }
    if (!r.ok) throw new Error('드라이브 ' + r.status);
    return r;
  },
  async list(q) {
    const out = {}; let pt = '';
    do {
      const r = await (await this.fetch('https://www.googleapis.com/drive/v3/files?pageSize=1000&orderBy=modifiedTime desc&fields=nextPageToken,files(id,name,mimeType,modifiedTime)&q=' + encodeURIComponent(q) + (pt ? '&pageToken=' + pt : ''))).json();
      for (const f of r.files || []) out[f.name] ||= f;
      pt = r.nextPageToken || '';
    } while (pt);
    return out;
  },
  async root(create) {
    if (this.folders['']) return this.folders[''];
    const r = await this.list(`name='${FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    if (r[FOLDER]) return this.folders[''] = r[FOLDER].id;
    if (!create) throw new Error(`드라이브에서 '${FOLDER}' 폴더를 찾지 못했어요`);
    return this.folders[''] = (await this.mkdir(FOLDER, 'root')).id;
  },
  async mkdir(name, parent) {
    return (await this.fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,modifiedTime', {method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({name, mimeType: 'application/vnd.google-apps.folder', parents: [parent]})})).json();
  },
  // 'A/B/C' 폴더를 (없으면 만들어) id 를 돌려준다
  async ensureDir(dir) {
    if (!dir) return this.root(true);
    const i = dir.lastIndexOf('/'), up = i < 0 ? '' : dir.slice(0, i), name = dir.slice(i + 1);
    const pid = await this.ensureDir(up), kids = await this.children(up);
    return (kids[name] ||= await this.mkdir(name, pid)).id;
  },
  // 파일 올리기(같은 이름이 있으면 덮어쓰기). 큰 파일도 되게 이어 올리기(resumable)로.
  async put(path, blob, type = blob.type || 'application/octet-stream') {
    const i = path.lastIndexOf('/'), dir = i < 0 ? '' : path.slice(0, i), name = path.slice(i + 1);
    const pid = await this.ensureDir(dir), old = (await this.children(dir))[name];
    const r = await this.fetch(old ? `https://www.googleapis.com/upload/drive/v3/files/${old.id}?uploadType=resumable` : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
      {method: old ? 'PATCH' : 'POST', headers: {'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': type}, body: JSON.stringify(old ? {} : {name, parents: [pid]})});
    const loc = r.headers.get('location');
    if (!loc) throw new Error('드라이브 올리기 주소를 받지 못했어요');
    const f = await (await fetch(loc, {method: 'PUT', headers: {'Content-Type': type}, body: blob})).json();
    delete this.lists[dir];
    return f;
  },
  async children(dir) {
    if (this.lists[dir]) return this.lists[dir];
    let id;
    if (!dir) id = await this.root();
    else {
      const i = dir.lastIndexOf('/'), f = (await this.children(i < 0 ? '' : dir.slice(0, i)))[dir.slice(i + 1)];
      if (!f) throw new Error('드라이브에 ' + dir + ' 폴더가 없어요');
      id = f.id;
    }
    return this.lists[dir] = await this.list(`'${id}' in parents and trashed=false`);
  },
  async file(path) {
    const i = path.lastIndexOf('/'), dir = i < 0 ? '' : path.slice(0, i), name = path.slice(i + 1);
    const f = (await this.children(dir))[name];
    if (!f) throw new Error('없는 파일: ' + path);
    const get = () => this.fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`);
    return {stamp: f.modifiedTime, read: async () => (await get()).text(), blob: async () => (await get()).blob()};
  },
};
const appList = async q => {
  const r = await (await GD.fetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,modifiedTime)&q=' + encodeURIComponent(q))).json();
  return (r.files || [])[0];
};

const UrlSrc = {
  async file(path) {
    const r = await fetch(urlSrc.replace(/\/?$/, '/') + path.split('/').map(encodeURIComponent).join('/'), {cache: 'no-store'});
    if (!r.ok) throw new Error('없는 파일: ' + path);
    return {stamp: r.headers.get('last-modified') + ':' + r.headers.get('content-length'), read: () => r.text(), blob: () => r.blob()};
  },
};
const src = () => cfg.mode === 'drive' ? GD : cfg.mode === 'url' ? UrlSrc : Local;

// 새로 읽기에 실패하면(오프라인·로그인 만료) 기기에 받아 둔 것을 쓴다.
async function readJSON(path, {fresh = true} = {}) {
  const c = await cacheGet(path);
  if (!fresh && c) return c.data;
  try {
    const f = await src().file(path);
    if (c && c.stamp === f.stamp) return c.data;
    const data = JSON.parse(await f.read());
    cachePut(path, {stamp: f.stamp, data});
    return data;
  } catch (e) {
    if (c) { state.offline = e; return c.data; }
    throw e;
  }
}

// ── Gemini (키는 이 기기에만) ────────────────────────────────────────
const GEM_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest'];
// Gemini 키는 진도와 함께 드라이브 앱 전용 칸으로 기기끼리 맞춘다(한 기기에서 한 번만 넣으면 된다)
const gemKey = () => prog.pref?.gemKey ? prog.pref.gemKey.v : store.get('gemKey', '');
const S_ = {type: 'STRING'}, arr = items => ({type: 'ARRAY', items}), obj = p => ({type: 'OBJECT', properties: p, required: Object.keys(p)});
const MCQ_S = obj({q: S_, c: arr(S_), a: {type: 'INTEGER'}, e: S_}), OX_S = obj({q: S_, a: {type: 'BOOLEAN'}, e: S_}), SHORT_S = obj({q: S_, a: S_, k: arr(S_)});
const QSET_S = obj({mcq: arr(MCQ_S), ox: arr(OX_S), short: arr(SHORT_S)});
const GRADE_S = obj({score: {type: 'INTEGER'}, good: arr(S_), missing: arr(S_), improved: S_, comment: S_});

// input: 글 한 덩이, 또는 [{role:'user'|'model', text}] 대화
async function gem(input, {schema, sys, temp = .5} = {}) {
  const key = gemKey();
  if (!key) throw new Error('설정에서 Gemini 키를 넣어 주세요');
  const contents = typeof input === 'string' ? [{role: 'user', parts: [{text: input}]}]
    : Array.isArray(input) ? input.map(m => ({role: m.role, parts: [{text: m.text}]})) : [{role: 'user', parts: input.parts}];
  const body = {contents, generationConfig: {temperature: temp, ...(schema ? {responseMimeType: 'application/json', responseSchema: schema} : {})}};
  if (sys) body.systemInstruction = {parts: [{text: sys}]};
  let last;
  for (const m of GEM_MODELS) {
    let r;
    try { r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {method: 'POST', headers: {'Content-Type': 'application/json', 'x-goog-api-key': key}, body: JSON.stringify(body)}); }
    catch { throw new Error('Gemini에 연결하지 못했어요(인터넷 확인)'); }
    if (r.ok) {
      const d = await r.json();
      const t = (d.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
      if (!t) { last = new Error('Gemini가 답을 내지 않았어요'); continue; }
      try { return schema ? JSON.parse(t) : t; } catch { last = new Error('Gemini 답 형식이 어긋났어요'); continue; }
    }
    const msg = (await r.json().catch(() => ({})))?.error?.message || '';
    if (r.status === 403 || (r.status === 400 && /api key/i.test(msg))) throw new Error('Gemini 키를 확인해 주세요');
    last = new Error(r.status === 429 ? 'Gemini 무료 한도에 걸렸어요. 1분쯤 뒤에 다시 해 주세요' : `Gemini 오류 ${r.status}`);
  }
  throw last;
}
const thinking = t => `<div class="thinking"><span class="spin"></span>${esc(t || 'Gemini가 생각하는 중…')}</div>`;
