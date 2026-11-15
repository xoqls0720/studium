// 깃허브 페이지의 네 앱(Studium·생각과 글·토익·법무사)을 아래쪽 탭으로 잇는다. 진짜 앱(native.js)에서는 그쪽 탭을 쓴다.
(function () {
  "use strict";
  if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) return;
  if (window.self !== window.top) return;   // claude.ai 미리보기 등 다른 화면 안에서는 띄우지 않는다
  const TABS = [["", "Studium", "M4 5h7v14H4zM13 5h7v14h-7z"], ["geul/", "생각과 글", "M5 4h11l3 3v13H5zM8 9h8M8 13h8M8 17h5"], ["toeic/", "토익", "M4 6h16M4 12h10M4 18h7"], ["beopmusa/", "법무사", "M12 3l8 4v2H4V7zM6 10v7M10 10v7M14 10v7M18 10v7M4 19h16"]];
  const m = location.pathname.match(/^(.*?\/)(?:(geul|toeic|beopmusa)\/)?[^/]*$/);
  const base = location.origin + (m ? m[1] : "/"), cur = m && m[2] ? m[2] + "/" : "";
  function bar() {
    if (document.getElementById("app-tabs")) return;
    document.documentElement.classList.add("has-tabs");
    const st = document.createElement("style");
    st.textContent = `body{padding-bottom:calc(64px + env(safe-area-inset-bottom))!important}
      #app-tabs{position:fixed!important;left:0!important;right:0!important;bottom:0!important;top:auto!important;transform:none!important;width:auto!important;max-width:none!important;height:auto!important;margin:0!important;border-radius:0!important;box-shadow:none!important;z-index:2147483000;display:flex!important;flex-direction:row!important;background:rgba(252,252,250,.97);border-top:1px solid #d8dcdc;padding-bottom:env(safe-area-inset-bottom);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
      #app-tabs a{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:7px 0 6px;color:#4a4f52;text-decoration:none;font:500 11px/1.2 -apple-system,"Apple SD Gothic Neo",sans-serif}
      #app-tabs a.on{color:#1d5a66;font-weight:700}#app-tabs svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
      html.has-tabs .app-float{bottom:calc(76px + env(safe-area-inset-bottom))!important}html.has-tabs .app-float2{bottom:calc(120px + env(safe-area-inset-bottom))!important}
      html.has-tabs body>nav:not(#app-tabs){bottom:calc(env(safe-area-inset-bottom) + 72px)!important}html.has-tabs .inkbar,html.has-tabs .inkfab{bottom:calc(env(safe-area-inset-bottom) + 142px)!important}html.has-tabs .toast{bottom:calc(env(safe-area-inset-bottom) + 150px)!important}
      @media print{#app-tabs{display:none!important}body{padding-bottom:0!important}}`;
    document.head.appendChild(st);
    const nav = document.createElement("nav"); nav.id = "app-tabs";
    nav.innerHTML = TABS.map(t => `<a href="${base + t[0]}" class="${t[0] === cur ? "on" : ""}"><svg viewBox="0 0 24 24"><path d="${t[2]}"/></svg>${t[1]}</a>`).join("");
    nav.addEventListener("click", e => { const a = e.target.closest("a"); if (a && a.classList.contains("on")) e.preventDefault(); });
    document.body.appendChild(nav);
  }
  if (document.body) bar(); else document.addEventListener("DOMContentLoaded", bar);
})();
