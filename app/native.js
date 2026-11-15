// 앱(아이폰·아이패드·안드로이드) 안에서만 도는 연결 코드. 웹(깃허브 페이지)에서는 아무것도 하지 않는다.
(function () {
  "use strict";
  const C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  // 번들러 없이 쓰므로 Capacitor 코어(capacitor.js)의 registerPlugin 으로 네이티브 플러그인을 이어 붙인다
  const reg = (window.capacitorExports && window.capacitorExports.registerPlugin) || null, P = {};
  ["App", "Browser", "Share", "Filesystem", "StatusBar", "SplashScreen"].forEach(n => { try { P[n] = (C.Plugins && C.Plugins[n]) || (reg ? reg(n) : null); } catch (e) {} });
  const CLIENT = "652688327379-6ldakpv06ne7oclhbsopqvbolj5us7qk.apps.googleusercontent.com";
  const REDIRECT = "https://xoqls0720.github.io/studium/auth.html";
  document.documentElement.classList.add("native-app");

  // ── 구글 로그인: 앱 속 화면(WebView)은 구글이 막으므로 시스템 브라우저로 열고, auth.html 이 studium:// 로 돌려보낸다
  let waiting = null;
  if (P.App) Promise.resolve().then(() => P.App.addListener("appUrlOpen", ev => {
    const u = ev.url || "";
    if (!u.startsWith("studium://auth") || !waiting) return;
    const q = new URLSearchParams(u.split("#")[1] || u.split("?")[1] || "");
    try { P.Browser && P.Browser.close(); } catch (e) {}
    const w = waiting; waiting = null;
    if (q.get("error") || !q.get("access_token")) return w.no(new Error(q.get("error") || "로그인하지 못했어요"));
    if (q.get("state") !== w.state) return w.no(new Error("로그인 확인 값이 맞지 않아요. 다시 해 주세요"));
    const tok = { t: q.get("access_token"), exp: Date.now() + (+q.get("expires_in") || 3600) * 1000 };
    try { localStorage.setItem("ds.tok", JSON.stringify(tok)); localStorage.setItem("bm.tok", JSON.stringify(tok)); localStorage.setItem("ds.gdLinked", "true"); } catch (e) {}
    w.ok(tok);
  })).catch(() => {});
  window.nativeGoogleLogin = scope => new Promise((ok, no) => {
    const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
    waiting = { ok, no, state };
    const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({ client_id: CLIENT, redirect_uri: REDIRECT, response_type: "token",
      scope: scope || "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.appdata", state, include_granted_scopes: "true", prompt: "select_account" });
    P.Browser.open({ url, presentationStyle: "popover" }).catch(no);
    if (P.Browser.addListener) P.Browser.addListener("browserFinished", () => setTimeout(() => { if (waiting && waiting.state === state) { waiting = null; no(new Error("로그인을 닫았어요")); } }, 800));
  });

  // ── 공유(굿노트로 보내기·PDF 저장): 파일을 임시 폴더에 쓰고 공유 시트를 연다
  const b64 = blob => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = no; r.readAsDataURL(blob); });
  const nativeShare = async data => {
    const files = data.files || [];
    if (!files.length) return P.Share.share({ title: data.title, text: data.text, url: data.url });
    const uris = [];
    for (const f of files) {
      const name = (f.name || "file").replace(/[\\/:*?"<>|]/g, "_");
      const w = await P.Filesystem.writeFile({ path: name, data: await b64(f), directory: "CACHE" });
      uris.push(w.uri);
    }
    return P.Share.share({ title: data.title || files[0].name, files: uris });
  };
  try { navigator.share = nativeShare; navigator.canShare = () => true; } catch (e) {
    Object.defineProperty(navigator, "share", { value: nativeShare }); Object.defineProperty(navigator, "canShare", { value: () => true });
  }

  // ── 아래쪽 탭: 네 공부를 한 앱 안에서 오간다
  const TABS = [["", "Studium", "M4 5h7v14H4zM13 5h7v14h-7z"], ["geul/", "생각과 글", "M5 4h11l3 3v13H5zM8 9h8M8 13h8M8 17h5"], ["toeic/", "토익", "M4 6h16M4 12h10M4 18h7"], ["beopmusa/", "법무사", "M12 3l8 4v2H4V7zM6 10v7M10 10v7M14 10v7M18 10v7M4 19h16"]];
  const base = location.href.replace(/(geul|toeic|beopmusa)\/.*$/, "").replace(/index\.html.*$/, "").replace(/[#?].*$/, "");
  const here = (location.pathname.match(/\/(geul|toeic|beopmusa)\//) || [, ""])[1];
  const cur = here ? here + "/" : "";
  try {
    const last = localStorage.getItem("app.tab");
    if (!sessionStorage.getItem("app.started")) { sessionStorage.setItem("app.started", "1"); if (last != null && last !== cur) { location.replace(base + last + "index.html"); return; } }
    localStorage.setItem("app.tab", cur);
  } catch (e) {}
  function bar() {
    const st = document.createElement("style");
    st.textContent = `body{padding-bottom:calc(64px + env(safe-area-inset-bottom))!important}
      #app-tabs{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;background:rgba(252,252,250,.97);border-top:1px solid #d8dcdc;padding-bottom:env(safe-area-inset-bottom);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
      #app-tabs a{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:7px 0 6px;color:#4a4f52;text-decoration:none;font:500 11px/1.2 -apple-system,"Apple SD Gothic Neo",sans-serif}
      #app-tabs a.on{color:#1d5a66;font-weight:700}#app-tabs svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
      html.native-app .app-float{bottom:calc(76px + env(safe-area-inset-bottom))!important}`;
    document.head.appendChild(st);
    const nav = document.createElement("nav"); nav.id = "app-tabs";
    nav.innerHTML = TABS.map(t => `<a href="${base + t[0]}index.html" class="${t[0] === cur ? "on" : ""}"><svg viewBox="0 0 24 24"><path d="${t[2]}"/></svg>${t[1]}</a>`).join("");
    nav.addEventListener("click", e => { const a = e.target.closest("a"); if (a && a.classList.contains("on")) e.preventDefault(); });
    document.body.appendChild(nav);
  }
  if (document.body) bar(); else document.addEventListener("DOMContentLoaded", bar);
  // 상태 표시줄
  try { P.StatusBar && Promise.resolve(P.StatusBar.setStyle({ style: "LIGHT" })).catch(() => {}); } catch (e) {}
})();
