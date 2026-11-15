// claude.ai 밖(깃허브 페이지·홈 화면 앱)에서 열 때 window.claude 를 대신한다.
// 저장 = 구글 드라이브 '앱 전용 칸'(Studium 과 같은 로그인), 문제 생성·첨삭 = Gemini(Studium 설정의 키), 소리 = 브라우저 음성.
(function () {
  "use strict";
  if (window.claude && window.claude.use) return;
  const CLIENT = "652688327379-6ldakpv06ne7oclhbsopqvbolj5us7qk.apps.googleusercontent.com";
  const SC = "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.appdata";
  const APP = (location.pathname.match(/\/(geul|toeic)\//) || [, "app"])[1];
  const ls = k => { try { return JSON.parse(localStorage.getItem("ds." + k)); } catch (e) { return null; } };
  const lset = (k, v) => { try { localStorage.setItem("ds." + k, JSON.stringify(v)); } catch (e) {} };
  const tok = () => { const t = ls("tok"); return t && t.exp > Date.now() + 60e3 ? t.t : null; };
  const gemKey = () => { const p = ls("prog"); return (p && p.pref && p.pref.gemKey && p.pref.gemKey.v) || ls("gemKey") || ""; };

  // ── 구글 로그인 ─────────────────────────────
  function gis() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    return new Promise((ok, no) => { const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.onload = ok; s.onerror = () => no(new Error("구글 로그인 창을 받지 못했어요")); document.head.appendChild(s); });
  }
  async function login() {
    await gis();
    await new Promise((ok, no) => {
      google.accounts.oauth2.initTokenClient({ client_id: (ls("cfg") || {}).client || CLIENT, scope: SC, callback: r => {
        if (r.error) return no(new Error(r.error));
        lset("tok", { t: r.access_token, exp: Date.now() + (r.expires_in || 3600) * 1000 }); lset("gdLinked", true); ok();
      }, error_callback: e => no(new Error((e && e.message) || "로그인을 닫았어요")) }).requestAccessToken({ prompt: "" });
    });
  }
  async function gfetch(url, opt) {
    const t = tok(); if (!t) throw { code: "auth" };
    opt = opt || {}; const r = await fetch(url, Object.assign({}, opt, { headers: Object.assign({}, opt.headers || {}, { Authorization: "Bearer " + t }) }));
    if (r.status === 401) { lset("tok", null); throw { code: "auth" }; }
    if (!r.ok) throw new Error("드라이브 " + r.status);
    return r;
  }
  // ── 저장: 앱 전용 칸의 JSON 파일 ───────────────
  const ids = {};
  async function appFile(name) {
    if (ids[name]) return ids[name];
    const q = encodeURIComponent(`name='${name}'`);
    const j = await (await gfetch("https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name)&q=" + q)).json();
    return ids[name] = ((j.files || [])[0] || {}).id || null;
  }
  async function appGet(name) { const id = await appFile(name); if (!id) return null; return (await gfetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`)).json(); }
  async function appSet(name, data) {
    const id = await appFile(name), body = JSON.stringify(data);
    if (id) { await gfetch(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body }); return; }
    const fd = new FormData();
    fd.append("metadata", new Blob([JSON.stringify({ name, parents: ["appDataFolder"] })], { type: "application/json" }));
    fd.append("file", new Blob([body], { type: "application/json" }));
    const j = await (await gfetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", { method: "POST", body: fd })).json();
    ids[name] = j.id;
  }
  const db = { collection: path => ({ doc: name => {
    const fn = `${APP}-${name}.json`;
    return { get: async () => { const d = await appGet(fn); return d ? { exists: true, data: d } : null; }, set: data => appSet(fn, data) };
  } }) };
  // 내 드라이브에서 이름으로 파일 찾아 받기(LEET 기출 묶음, 스캔본 시험지, ETS 샘플)
  async function driveFile(name) {
    const q = encodeURIComponent(`name='${name.replace(/'/g, "\\'")}' and trashed=false`);
    const j = await (await gfetch("https://www.googleapis.com/drive/v3/files?pageSize=5&orderBy=modifiedTime desc&fields=files(id,name,mimeType)&q=" + q)).json();
    const f = (j.files || [])[0]; if (!f) throw new Error(`드라이브에서 '${name}'을 찾지 못했어요`);
    const b = await (await gfetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`)).blob();
    return new File([b], name, { type: f.mimeType || b.type });
  }
  // ── 문제 생성·첨삭: Gemini ─────────────────────
  const MODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-flash-latest", "gemini-3.5-flash-lite", "gemini-flash-lite-latest"];
  async function gem(prompt, json) {
    const key = gemKey(); let last;
    const body = { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: Object.assign({ temperature: .6 }, json ? { responseMimeType: "application/json" } : {}) };
    for (const m of MODELS) {
      let r; try { r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body) }); }
      catch (e) { throw new Error("Gemini에 연결하지 못했어요"); }
      if (r.ok) {
        const d = await r.json(), t = ((d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || []).map(p => p.text || "").join("");
        if (!t) { last = new Error("답이 비었어요"); continue; }
        if (!json) return t;
        try { const s = t.replace(/```json|```/g, ""); return JSON.parse(s.slice(s.search(/[{[]/), Math.max(s.lastIndexOf("}"), s.lastIndexOf("]")) + 1)); } catch (e) { last = { code: "empty" }; continue; }
      }
      if (r.status === 429) { last = { code: "rate_limited" }; continue; }
      if (r.status === 403 || r.status === 400) throw { code: "not_granted" };
      last = new Error("Gemini 오류 " + r.status);
    }
    throw last;
  }
  function sample() {
    if (!gemKey()) return null;
    const f = async (p) => ({ text: await gem(typeof p === "string" ? p : JSON.stringify(p), false) });
    f.json = async (p) => gem(typeof p === "string" ? p : JSON.stringify(p), true);
    return f;
  }
  // ── 파일 내보내기: 공유 시트(굿노트로 보내기) ────────
  const downloads = { save: async ({ filename, data }) => {
    const f = data instanceof File ? data : new File([data], filename, { type: (data && data.type) || "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: filename }); return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  } };

  window.claude = { outside: true, login, driveFile: n => driveFile(n), use: async n => {
    if (n === "sample") return sample();
    if (n === "downloads") return downloads;
    if (n === "db") return tok() ? db : null;
    if (n === "user") return tok() ? { id: async () => "me" } : null;
    return null;   // tts → 브라우저 음성
  } };

  // 구글에 저장이 꺼져 있으면 오른쪽 아래에 작은 버튼
  window.addEventListener("DOMContentLoaded", () => {
    if (tok()) return;
    const b = document.createElement("button");
    b.textContent = "☁ 구글에 저장 켜기"; b.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:50;border:1px solid #1d5a66;background:#fff;color:#1d5a66;border-radius:999px;padding:8px 14px;font:inherit;font-size:.85rem";
    b.onclick = async () => { try { await login(); location.reload(); } catch (e) { b.textContent = "로그인 실패 · 다시"; } };
    document.body.appendChild(b);
  });
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
})();
