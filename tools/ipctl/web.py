# -*- coding: utf-8 -*-
"""브라우저에서 아이폰·아이패드를 조작하는 작은 웹 서버 (이 PC 안에서만: 127.0.0.1:8765).

GET  /                 화면 + 조작 페이지
GET  /screen.mjpg      화면 영상 (WDA MJPEG 중계)
POST /api/tap          {"x":0~1,"y":0~1,"hold":ms}
POST /api/swipe        {"x1","y1","x2","y2","ms"}
POST /api/type         {"text":"..."}
POST /api/button       {"name":"home|lock|volumeUp|volumeDown|switcher|cc|nc"}
GET  /api/state        연결 상태·화면 크기
POST /api/ios          {"args":[...]}  go-ios 명령 실행 결과
GET  /api/file?name=   데이터 폴더의 파일 읽기 (이름만)
POST /api/file?name=   데이터 폴더에 파일 쓰기
/api/* 는 페이지에 들어 있는 토큰(X-Token)이 있어야 한다 — 다른 사이트가 몰래 부르지 못하게.
"""
import json, os, re, secrets, subprocess, threading, urllib.request
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = 8765
TOKEN = secrets.token_hex(16)

PAGE = r"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>아이폰 조작 (브라우저)</title>
<style>
body{margin:0;background:#111;color:#ddd;font-family:'Malgun Gothic',sans-serif;display:flex;flex-direction:column;align-items:center}
#wrap{position:relative;margin:8px 0}#scr{max-height:calc(100vh - 110px);max-width:100vw;display:block;user-select:none;-webkit-user-drag:none;cursor:pointer;background:#000}
.bar{display:flex;gap:4px;flex-wrap:wrap;justify-content:center}.bar button{background:#333;color:#eee;border:0;padding:6px 10px;border-radius:6px;cursor:pointer}
#txt{width:min(600px,90vw);padding:6px;font-size:15px}#st{font-size:12px;color:#888;margin:4px}
</style></head><body>
<div id="st">연결 확인 중…</div>
<div id="wrap"><img id="scr" src="/screen.mjpg" alt="화면" draggable="false"></div>
<div class="bar">
<button data-b="home">홈</button><button data-b="switcher">앱 전환</button><button data-b="cc">제어센터</button><button data-b="nc">알림</button>
<button data-b="lock">잠금</button><button data-b="volumeDown">🔉</button><button data-b="volumeUp">🔊</button>
<input id="txt" placeholder="글자 입력 후 Enter (한글 가능)">
</div>
<script>
const T="__TOKEN__";const img=document.getElementById('scr');
const api=(p,b)=>fetch(p,{method:b===undefined?'GET':'POST',headers:{'X-Token':T,'Content-Type':'application/json'},body:b===undefined?undefined:JSON.stringify(b)}).then(r=>r.json());
window.ipc={api,tap:(x,y,hold)=>api('/api/tap',{x,y,hold}),swipe:(x1,y1,x2,y2,ms)=>api('/api/swipe',{x1,y1,x2,y2,ms}),type:t=>api('/api/type',{text:t}),button:n=>api('/api/button',{name:n}),ios:(...a)=>api('/api/ios',{args:a})};
let d=null;const pos=e=>{const r=img.getBoundingClientRect();return[(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height]};
img.addEventListener('mousedown',e=>{e.preventDefault();d={p:pos(e),t:Date.now()}});
window.addEventListener('mouseup',e=>{if(!d)return;const q=pos(e),dt=Date.now()-d.t,[x,y]=d.p;d=null;
 if(Math.hypot((q[0]-x)*img.width,(q[1]-y)*img.height)>8)ipc.swipe(x,y,Math.min(1,Math.max(0,q[0])),Math.min(1,Math.max(0,q[1])),Math.max(120,Math.min(1200,dt)));else ipc.tap(x,y,dt>500?600:40)});
img.addEventListener('wheel',e=>{e.preventDefault();const[x,y]=pos(e);ipc.swipe(x,y,x,Math.min(.98,Math.max(.02,y+(e.deltaY<0?.18:-.18))),150)},{passive:false});
document.querySelectorAll('[data-b]').forEach(b=>b.onclick=()=>ipc.button(b.dataset.b));
const tx=document.getElementById('txt');tx.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){ipc.type(tx.value);tx.value=''}});
document.addEventListener('keydown',e=>{if(e.target===tx)return;if(e.key==='Backspace')ipc.type('\b');else if(e.key==='Enter')ipc.type('\n');else if(e.key.length===1&&!e.ctrlKey)ipc.type(e.key)});
img.onerror=()=>setTimeout(()=>img.src='/screen.mjpg?'+Date.now(),1500);
setInterval(()=>api('/api/state').then(s=>document.getElementById('st').textContent=(s.ready?'연결됨':'준비 중')+' · 화면 '+s.size.join('×')+' 포인트').catch(()=>{}),3000);
</script></body></html>"""

def start(app, ios_path, data_dir, mjpeg_port=9100):
    class H(BaseHTTPRequestHandler):
        def log_message(self, *a): pass
        def _json(self, obj, code=200):
            b = json.dumps(obj, ensure_ascii=False).encode()
            self.send_response(code); self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
        def _ok(self):
            if self.headers.get("X-Token") != TOKEN: self._json({"error": "token"}, 403); return False
            host = (self.headers.get("Host") or "").split(":")[0]
            if host not in ("127.0.0.1", "localhost"): self._json({"error": "host"}, 403); return False
            return True
        def _body(self):
            n = int(self.headers.get("Content-Length") or 0)
            return self.rfile.read(n) if n else b""
        def _name(self):
            n = os.path.basename(parse_qs(urlparse(self.path).query).get("name", [""])[0])
            return os.path.join(data_dir, n) if re.fullmatch(r"[\w.\-가-힣 ]+", n or "") else None
        def do_GET(self):
            u = urlparse(self.path).path
            if u == "/":
                b = PAGE.replace("__TOKEN__", TOKEN).encode()
                self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b); return
            if u == "/screen.mjpg":
                try: src = urllib.request.urlopen(f"http://127.0.0.1:{mjpeg_port}", timeout=10)
                except Exception: self.send_error(503); return
                self.send_response(200)
                self.send_header("Content-Type", src.headers.get("Content-Type", "multipart/x-mixed-replace; boundary=--BoundaryString"))
                self.send_header("Cache-Control", "no-cache"); self.end_headers()
                try:
                    while True:
                        c = src.read(32768)
                        if not c: break
                        self.wfile.write(c)
                except Exception: pass
                return
            if not u.startswith("/api/") or not self._ok(): return
            if u == "/api/state": return self._json({"ready": bool(app.sid), "size": list(app.size)})
            if u == "/api/file":
                p = self._name()
                if not p or not os.path.exists(p): return self._json({"error": "없음"}, 404)
                return self._json({"text": open(p, encoding="utf-8", errors="replace").read()})
            self._json({"error": "?"}, 404)
        def do_POST(self):
            u = urlparse(self.path).path
            if not u.startswith("/api/") or not self._ok(): return
            raw = self._body()
            if u == "/api/file":
                p = self._name()
                if not p: return self._json({"error": "이름"}, 400)
                open(p, "wb").write(raw); return self._json({"ok": True, "bytes": len(raw)})
            try: b = json.loads(raw or b"{}")
            except Exception: b = {}
            W, Hh = app.size
            P = lambda x, y: (round(float(x) * W), round(float(y) * Hh))
            if u == "/api/tap":
                p = P(b["x"], b["y"]); app.touch([("move", p[0], p[1], 0), ("down",), ("wait", int(b.get("hold") or 40)), ("up",)]); return self._json({"ok": True, "pt": p})
            if u == "/api/swipe":
                a, c = P(b["x1"], b["y1"]), P(b["x2"], b["y2"]); app.swipe(a, c, ms=int(b.get("ms") or 300)); return self._json({"ok": True})
            if u == "/api/type": app.type(str(b.get("text", ""))); return self._json({"ok": True})
            if u == "/api/button":
                n = b.get("name"); f = {"home": app.home, "lock": app.lock, "switcher": app.switcher, "cc": app.cc, "nc": app.nc}.get(n)
                f() if f else app.btn(n); return self._json({"ok": True})
            if u == "/api/ios":
                args = [str(a) for a in b.get("args", [])]
                try:
                    r = subprocess.run([ios_path, *args], capture_output=True, text=True, encoding="utf-8", errors="replace",
                                       timeout=int(b.get("timeout") or 120), creationflags=0x08000000 if os.name == "nt" else 0, cwd=data_dir)
                    return self._json({"code": r.returncode, "out": r.stdout, "err": r.stderr})
                except Exception as e: return self._json({"error": str(e)}, 500)
            self._json({"error": "?"}, 404)
    class S(ThreadingHTTPServer):
        allow_reuse_address = False  # 윈도우에서 True 면 이미 쓰는 포트를 겹쳐 잡아 다른 프로그램이 응답한다
        def server_bind(self):
            import socket
            if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
                self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            super().server_bind()
    srv, err = None, None
    for port in [PORT] + list(range(18765, 18800)):
        try: srv = S(("127.0.0.1", port), H); break
        except OSError as e: err = e
    if not srv: raise err
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{srv.server_address[1]}/"
    try: open(os.path.join(data_dir, "주소.txt"), "w", encoding="utf-8").write(url)
    except Exception: pass
    return url
