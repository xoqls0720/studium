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
    if (window.nativeGoogleLogin) { await window.nativeGoogleLogin(SC); return; }
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
  // ── 문제 생성·첨삭: Studium 설정에서 고른 AI (Claude·Gemini·Groq·OpenRouter·Ollama)
  // 키는 Studium(ds.*)에 넣은 것을 먼저 쓰고, 없으면 노벨리스트(nv.*, 같은 주소)에 넣어 둔 키를 쓴다.
  const nv = k => { try { const v = localStorage.getItem("nv." + k); return v ? JSON.parse(v) : ""; } catch (e) { return ""; } };
  const PROVS = { claude: "Claude", gemini: "Gemini", openrouter: "OpenRouter", groq: "Groq", ollama: "Ollama" };
  const keyOf = p => p === "gemini" ? gemKey() || nv("gemKey") : p === "claude" ? ls("ckKey") || nv("apiKey") : p === "groq" ? ls("grKey") || nv("grKey") : p === "openrouter" ? ls("orKey") || nv("orKey") : p === "ollama" ? "local" : "";
  function prov() {
    const p = ls("aiProv") || "gemini";
    if (PROVS[p] && keyOf(p)) return p;
    return ["claude", "gemini", "openrouter", "groq"].find(x => keyOf(x)) || null;
  }
  const strip = t => String(t).replace(/```json|```/g, "");
  const pick = t => { const s = strip(t); return JSON.parse(s.slice(s.search(/[{[]/), Math.max(s.lastIndexOf("}"), s.lastIndexOf("]")) + 1)); };
  const JSONSYS = "반드시 다른 말 없이 JSON 하나만 출력한다.";
  const GMODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-flash-latest", "gemini-3.5-flash-lite", "gemini-flash-lite-latest"];
  async function gemini(prompt, json) {
    const key = keyOf("gemini"); let last;
    const body = { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: Object.assign({ temperature: .6 }, json ? { responseMimeType: "application/json" } : {}) };
    for (const m of GMODELS) {
      let r; try { r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body) }); }
      catch (e) { throw new Error("Gemini에 연결하지 못했어요"); }
      if (r.ok) { const d = await r.json(), t = ((d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || []).map(p => p.text || "").join("");
        if (!t) { last = new Error("답이 비었어요"); continue; } if (!json) return t; try { return pick(t); } catch (e) { last = { code: "empty" }; continue; } }
      if (r.status === 429) { last = { code: "rate_limited" }; continue; }
      if (r.status === 403 || r.status === 400) throw { code: "not_granted" };
      last = new Error("Gemini 오류 " + r.status);
    }
    throw last;
  }
  async function claude(prompt, json, tier) {
    const model = ls("ckModel") || (tier === "complex" ? "claude-sonnet-5-5" : "claude-haiku-5-5");
    let r; try { r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": keyOf("claude"), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model, max_tokens: 8192, ...(json ? { system: JSONSYS } : {}), messages: [{ role: "user", content: prompt }] }) }); }
    catch (e) { throw new Error("Claude에 연결하지 못했어요"); }
    if (r.status === 429) throw { code: "rate_limited" };
    if (r.status === 401 || r.status === 403) throw { code: "not_granted" };
    if (!r.ok) throw new Error("Claude 오류 " + r.status);
    const t = ((await r.json()).content || []).filter(b => b.type === "text").map(b => b.text).join("");
    if (!json) return t; try { return pick(t); } catch (e) { throw { code: "empty" }; }
  }
  async function openai(p, prompt, json) {
    const url = p === "groq" ? "https://api.groq.com/openai/v1/chat/completions" : p === "openrouter" ? "https://openrouter.ai/api/v1/chat/completions" : (ls("olUrl") || "http://localhost:11434").replace(/\/+$/, "") + "/v1/chat/completions";
    const model = p === "groq" ? ls("grModel") || "llama-3.3-70b-versatile" : p === "openrouter" ? ls("orModel") || nv("set.orModel") || "meta-llama/llama-3.3-70b-instruct:free" : ls("olModel") || "exaone3.5:7.8b";
    const h = { "Content-Type": "application/json" }; if (p !== "ollama") h.Authorization = "Bearer " + keyOf(p); if (p === "openrouter") h["X-Title"] = "Studium";
    let r; try { r = await fetch(url, { method: "POST", headers: h, body: JSON.stringify({ model, temperature: .6, messages: [...(json ? [{ role: "system", content: JSONSYS }] : []), { role: "user", content: prompt }], ...(json && p !== "ollama" ? { response_format: { type: "json_object" } } : {}) }) }); }
    catch (e) { throw new Error(PROVS[p] + "에 연결하지 못했어요"); }
    if (r.status === 429) throw { code: "rate_limited" };
    if (r.status === 401 || r.status === 403) throw { code: "not_granted" };
    if (!r.ok) throw new Error(PROVS[p] + " 오류 " + r.status);
    const t = (((await r.json()).choices || [])[0] || {}).message?.content || "";
    if (!json) return t; try { return pick(t); } catch (e) { throw { code: "empty" }; }
  }
  const ask = (prompt, json, tier) => { const p = prov(); prompt = typeof prompt === "string" ? prompt : JSON.stringify(prompt);
    return p === "claude" ? claude(prompt, json, tier) : p === "gemini" ? gemini(prompt, json) : openai(p, prompt, json); };
  function sample() {
    if (!prov()) return null;
    const f = async (p, o) => ({ text: await ask(p, false, o && o.modelTier) });
    f.json = async (p, o) => ask(p, true, o && o.modelTier);
    return f;
  }
  // ── AI 고르기 창 (Studium 설정과 같은 칸에 저장 — 한 번 고르면 모든 앱이 같이 쓴다)
  function aiPanel() {
    const cur = ls("aiProv") || "gemini", d = document.createElement("div");
    d.style.cssText = "position:fixed;inset:0;z-index:2147483600;background:rgba(0,0,0,.35);display:flex;align-items:flex-end;justify-content:center";
    const KEY = { claude: ["ckKey", "sk-ant-…", "apiKey"], gemini: ["gemKey", "AIza…", "gemKey"], openrouter: ["orKey", "sk-or-…", "orKey"], groq: ["grKey", "gsk_…", "grKey"] };
    const MOD = { claude: ["ckModel", "비우면 첨삭은 Sonnet, 가벼운 일은 Haiku"], openrouter: ["orModel", "meta-llama/llama-3.3-70b-instruct:free"], groq: ["grModel", "llama-3.3-70b-versatile"], ollama: ["olModel", "exaone3.5:7.8b"] };
    function draw(p) {
      const k = KEY[p], m = MOD[p], fromNv = k && !ls(k[0]) && nv(k[2]);
      d.innerHTML = `<div style="background:#fff;color:#000;width:min(560px,100%);border-radius:18px 18px 0 0;padding:20px 20px calc(20px + env(safe-area-inset-bottom));font:16px/1.6 -apple-system,'Apple SD Gothic Neo',sans-serif">
        <b style="font-size:18px">문제 만들기·첨삭에 쓸 AI</b>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin:12px 0">${Object.entries(PROVS).map(([v, n]) => `<button data-p="${v}" style="border:1px solid #1d5a66;border-radius:999px;padding:6px 14px;background:${v === p ? "#1d5a66" : "#fff"};color:${v === p ? "#fff" : "#1d5a66"};font:inherit">${n}${keyOf(v) && v !== "ollama" ? " ✓" : ""}</button>`).join("")}</div>
        ${k ? `<label style="display:block;margin:8px 0">API 키${fromNv ? " · 노벨리스트에 넣은 키를 쓰는 중" : ""}<input id="ak" type="password" autocomplete="off" placeholder="${k[1]}" value="${ls(k[0]) || ""}" style="width:100%;padding:10px;border:1px solid #ccc;border-radius:10px;font:inherit"></label>` : ""}
        ${p === "ollama" ? `<label style="display:block;margin:8px 0">PC 주소<input id="au" placeholder="http://192.168.0.x:11434" value="${ls("olUrl") || ""}" style="width:100%;padding:10px;border:1px solid #ccc;border-radius:10px;font:inherit"></label>` : ""}
        ${m ? `<label style="display:block;margin:8px 0">모델<input id="am" placeholder="${m[1]}" value="${ls(m[0]) || ""}" style="width:100%;padding:10px;border:1px solid #ccc;border-radius:10px;font:inherit"></label>` : ""}
        <p style="color:#555;font-size:13px">키는 이 기기에만 저장되고 Studium·법무사 앱과 같이 써요. Claude는 유료(정확한 첨삭), Gemini·Groq·OpenRouter는 무료 한도가 있어요.</p>
        <div style="display:flex;gap:8px;justify-content:flex-end"><button id="ax" style="border:0;background:none;color:#555;font:inherit;padding:10px">닫기</button><button id="as" style="border:0;background:#1d5a66;color:#fff;border-radius:12px;padding:10px 18px;font:inherit">저장</button></div></div>`;
      d.querySelectorAll("[data-p]").forEach(b => b.onclick = () => draw(b.dataset.p));
      d.querySelector("#ax").onclick = () => d.remove();
      d.querySelector("#as").onclick = () => { lset("aiProv", p); const ak = d.querySelector("#ak"), am = d.querySelector("#am"), au = d.querySelector("#au");
        if (ak && ak.value.trim()) lset(k[0], ak.value.trim()); if (am) lset(m[0], am.value.trim()); if (au) lset("olUrl", au.value.trim()); d.remove(); location.reload(); };
    }
    draw(cur); d.addEventListener("click", e => { if (e.target === d) d.remove(); }); document.body.appendChild(d);
  }
  // ── 파일 내보내기: 공유 시트(굿노트로 보내기) ────────
  const downloads = { save: async ({ filename, data }) => {
    const f = data instanceof File ? data : new File([data], filename, { type: (data && data.type) || "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: filename }); return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  } };

  window.claude = { outside: true, login, aiPanel, aiName: () => PROVS[prov()] || "", driveFile: n => driveFile(n), use: async n => {
    if (n === "sample") return sample();
    if (n === "downloads") return downloads;
    if (n === "db") return tok() ? db : null;
    if (n === "user") return tok() ? { id: async () => "me" } : null;
    return null;   // tts → 브라우저 음성
  } };

  // 구글에 저장이 꺼져 있으면 오른쪽 아래에 작은 버튼
  window.addEventListener("DOMContentLoaded", () => {
    const g = document.createElement("button");
    g.textContent = "✦ AI" + (prov() ? " · " + PROVS[prov()] : " 고르기"); g.className = "app-float app-float2";
    g.style.cssText = "position:fixed;right:12px;bottom:56px;z-index:50;border:1px solid #1d5a66;background:#fff;color:#1d5a66;border-radius:999px;padding:8px 14px;font:inherit;font-size:.85rem";
    g.onclick = aiPanel; document.body.appendChild(g);
    if (tok()) { g.style.bottom = "12px"; return; }
    const b = document.createElement("button");
    b.textContent = "☁ 구글에 저장 켜기"; b.className = "app-float"; b.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:50;border:1px solid #1d5a66;background:#fff;color:#1d5a66;border-radius:999px;padding:8px 14px;font:inherit;font-size:.85rem";
    b.onclick = async () => { try { await login(); location.reload(); } catch (e) { b.textContent = "로그인 실패 · 다시"; } };
    document.body.appendChild(b);
  });
  if ("serviceWorker" in navigator && !(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
})();
