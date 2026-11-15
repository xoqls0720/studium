# -*- coding: utf-8 -*-
"""아이폰·아이패드 조작 (선 연결) — 윈도우 PC 에서 화면을 보고 마우스·키보드로 조작한다.

원리: 아이폰에 WebDriverAgent(애플의 UI 테스트 도구로 만든 작은 앱)를 깔아 두면
      PC 가 USB 선으로 화면을 받아 오고(초당 최대 30장) 누르기·밀기·글자 입력을 보낼 수 있다.
      go-ios 가 USB 연결·터널·포트 연결을 맡는다.

조작: 클릭 = 누르기 · 끌기 = 밀기 · 0.5초 이상 누르고 있기 = 길게 누르기 · 휠 = 스크롤
      창에서 바로 타자 = 아이폰에 입력(한글 포함) · Backspace/Enter 그대로
      F1 홈 · F2 앱 전환 · F3 제어 센터 · F4 알림 센터 · F5 잠금 · F6/F7 볼륨
"""
import io, json, os, re, shutil, subprocess, sys, threading, time, urllib.request
import tkinter as tk
from tkinter import messagebox

try:
    from PIL import Image, ImageTk
except ImportError:
    messagebox.showerror("아이폰 조작", "pillow 가 없어요: pip install pillow"); raise

BUNDLE = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
HERE = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "아이폰조작")
os.makedirs(HERE, exist_ok=True)
LOG = os.path.join(HERE, "실행기록.txt")
WDA, MJ = 8100, 9100
NOWIN = 0x08000000 if os.name == "nt" else 0
os.environ.setdefault("ENABLE_GO_IOS_AGENT", "user")  # go-ios 1.3+: iOS 17 이상 터널을 관리자 권한 없이 자동으로
procs = []

def log(*a):
    s = time.strftime("%H:%M:%S ") + " ".join(str(x) for x in a)
    print(s)
    with open(LOG, "a", encoding="utf-8") as f: f.write(s + "\n")

def ios_bin():
    b = os.path.join(BUNDLE, "ios.exe")
    if os.path.exists(b): return b
    for c in ("ios.cmd", "ios.exe", "ios", "go-ios.exe"):
        p = shutil.which(c)
        if p: return p
    p = os.path.join(os.environ.get("APPDATA", ""), "npm", "ios.cmd")
    return p if os.path.exists(p) else None

def ios(*args, timeout=40):
    r = subprocess.run([IOS, *args], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout, creationflags=NOWIN, cwd=HERE)
    out = (r.stdout or "") + (r.stderr or "")
    log("ios", *args, "→", out.strip()[:400])
    return out

def ios_bg(*args):
    f = open(os.path.join(HERE, "ios_" + args[0] + ".log"), "a", encoding="utf-8")
    p = subprocess.Popen([IOS, *args], stdout=f, stderr=subprocess.STDOUT, creationflags=NOWIN, cwd=HERE)
    procs.append(p); log("시작:", "ios", *args); return p

def http(method, path, body=None, port=WDA, timeout=15):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"http://127.0.0.1:{port}{path}", data=data, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        t = r.read()
    try: return json.loads(t)
    except Exception: return {}

def up(port=WDA):
    try: http("GET", "/status", timeout=2, port=port); return True
    except Exception: return False

def ios_version():
    out = ios("info")
    m = re.search(r'"ProductVersion"\s*:\s*"(\d+)', out)
    return int(m.group(1)) if m else 0

def find_wda():
    out = ios("apps", "--list")
    ids = re.findall(r"([\w.\-]*WebDriverAgentRunner[\w.\-]*)", out)
    if not ids:
        out = ios("apps"); ids = re.findall(r'"CFBundleIdentifier"\s*:\s*"([^"]*WebDriverAgent[^"]*)"', out)
    return ids[0] if ids else None

def apple_driver():
    try:
        out = subprocess.run(["sc", "query", "Apple Mobile Device Service"], capture_output=True, text=True, creationflags=NOWIN).stdout
        if "SERVICE_NAME" in out: return True
        out = subprocess.run(["powershell", "-NoProfile", "-Command", "Get-AppxPackage *AppleDevices*"], capture_output=True, text=True, creationflags=NOWIN).stdout
        return "AppleDevices" in out or "AppleInc" in out
    except Exception: return True

def give_wda():
    """WDA.ipa 를 문서 폴더로 꺼내고, 탐색기에서 보여 주고, Sideloadly 페이지를 연다"""
    src = os.path.join(BUNDLE, "WDA.ipa")
    dst = os.path.join(os.path.expanduser("~"), "Documents", "WDA.ipa")
    try:
        if os.path.exists(src): shutil.copyfile(src, dst)
        subprocess.Popen(["explorer", "/select,", dst])
    except Exception as e: log("WDA 복사 실패", e)
    os.startfile("https://sideloadly.io/#download")

class App:
    def __init__(self):
        self.sid = None; self.size = (390, 844); self.frame = None; self.box = (0, 0, 1, 1)
        self.press = None; self.stop = False; self.ime = ""
        r = self.root = tk.Tk(); r.title("아이폰 조작 (선 연결)"); r.geometry("460x900"); r.configure(bg="#111")
        self.cv = tk.Canvas(r, bg="#111", highlightthickness=0); self.cv.pack(fill="both", expand=True)
        self.msg = self.cv.create_text(230, 420, text="준비 중…", fill="#ddd", font=("Malgun Gothic", 12), width=400, justify="center")
        bar = tk.Frame(r, bg="#222"); bar.pack(fill="x")
        for t, f in [("홈", self.home), ("앱 전환", self.switcher), ("제어센터", self.cc), ("알림", self.nc), ("잠금", self.lock), ("🔉", lambda: self.btn("volumeDown")), ("🔊", lambda: self.btn("volumeUp"))]:
            tk.Button(bar, text=t, command=f, bg="#333", fg="#eee", relief="flat", padx=6).pack(side="left", padx=1, pady=3)
        self.ent = tk.Entry(r, font=("Malgun Gothic", 12)); self.ent.pack(fill="x")
        self.ent.insert(0, ""); self.ent.bind("<Return>", self.send_entry)
        tk.Label(r, text="↑ 한글 문장은 여기 쓰고 Enter (영문·숫자는 화면 클릭 후 바로 타자해도 돼요)", bg="#111", fg="#888", font=("Malgun Gothic", 9)).pack(fill="x")
        cv = self.cv
        cv.bind("<ButtonPress-1>", self.down); cv.bind("<ButtonRelease-1>", self.release)
        cv.bind("<MouseWheel>", self.wheel); cv.bind("<Configure>", lambda e: self.draw())
        r.bind("<Key>", self.key)
        for i, f in enumerate([self.home, self.switcher, self.cc, self.nc, self.lock, lambda: self.btn("volumeDown"), lambda: self.btn("volumeUp")], 1):
            r.bind(f"<F{i}>", lambda e, f=f: f())
        r.protocol("WM_DELETE_WINDOW", self.quit)
        threading.Thread(target=self.boot, daemon=True).start()

    def say(self, t): log(t); self.root.after(0, lambda: (self.cv.itemconfigure(self.msg, text=t), self.cv.tag_raise(self.msg)))

    # ── 연결 ─────────────────────────────────────
    def boot(self):
        try:
            if not up():
                if not IOS: return self.say("go-ios 가 없어요.\n'설치_한번만.bat' 을 먼저 실행해 주세요.")
                self.say("아이폰을 찾는 중… (선 연결, 아이폰 잠금 해제, '이 컴퓨터 신뢰' 누르기)")
                for _ in range(60):
                    if re.search(r"[0-9a-fA-F\-]{20,}", ios("list")): break
                    time.sleep(2)
                else:
                    if not apple_driver():
                        self.say("아이폰 USB 드라이버(Apple Devices 앱)를 설치하는 중…\nMicrosoft Store 창이 뜨면 '받기'를 눌러 주세요. 설치 후 이 앱을 다시 켜 주세요.")
                        subprocess.Popen(["winget", "install", "--id", "9NP83LWLPZ9K", "-s", "msstore", "--accept-source-agreements", "--accept-package-agreements"], creationflags=NOWIN)
                        return
                    return self.say("아이폰이 안 보여요.\n선을 다시 꽂고 아이폰 잠금을 푼 뒤 '이 컴퓨터를 신뢰' 를 눌러 주세요.\n그다음 이 앱을 다시 켜 주세요.")
                v = ios_version()
                if v >= 17:
                    self.say(f"iOS {v} — 연결 통로(터널) 여는 중…")
                    if "tunnel" not in ios("tunnel", "ls", timeout=10).lower() or "[]" in ios("tunnel", "ls", timeout=10):
                        ios_bg("tunnel", "start", "--userspace"); time.sleep(6)
                self.say("개발자 디스크 이미지 확인 중… (처음엔 내려받느라 1~2분)")
                ios("image", "auto", timeout=300)
                bid = find_wda()
                if not bid:
                    self.root.after(0, give_wda)
                    return self.say("처음 한 번: 아이폰에 조작 도구(WDA)를 깔아야 해요.\n\n"
                        "1. 열린 페이지에서 Sideloadly 를 받아 설치\n"
                        "2. Sideloadly 에 '문서\\WDA.ipa' 를 끌어다 놓고\n   내 Apple ID 로 로그인 → Start\n"
                        "3. 아이폰 설정 → 일반 → VPN 및 기기 관리 → 개발자 '신뢰'\n"
                        "4. 설정 → 개인정보 보호 및 보안 → 개발자 모드 켜기\n\n"
                        "다 하면 이 앱을 다시 켜 주세요.\n(무료 Apple ID 는 7일마다 2번을 다시 해요)")
                self.say(f"조작 도구 켜는 중… ({bid})\n아이폰 화면이 잠깐 하얗게 바뀌어도 정상이에요.")
                ios_bg("runwda", f"--bundleid={bid}", f"--testrunnerbundleid={bid}", "--xctestconfig=WebDriverAgentRunner.xctest")
                time.sleep(4); ios_bg("forward", str(WDA), str(WDA)); ios_bg("forward", str(MJ), str(MJ))
                for _ in range(60):
                    if up(): break
                    time.sleep(2)
                else: return self.say("조작 도구가 켜지지 않았어요.\n아이폰 설정 → 일반 → VPN 및 기기 관리에서 개발자를 '신뢰' 했는지,\n개인정보 보호 및 보안 → 개발자 모드가 켜져 있는지 확인해 주세요.\n(자세한 기록: %LOCALAPPDATA%\\아이폰조작)")
            self.session()
            self.say("")
            threading.Thread(target=self.stream, daemon=True).start()
        except Exception as e:
            self.say(f"오류: {e}\n(%LOCALAPPDATA%\\아이폰조작\\실행기록.txt 를 Claude 에게 보여 주세요)")

    def session(self):
        r = http("POST", "/session", {"capabilities": {"alwaysMatch": {}}})
        self.sid = r.get("sessionId") or (r.get("value") or {}).get("sessionId")
        try:
            http("POST", f"/session/{self.sid}/appium/settings", {"settings": {"mjpegServerFramerate": 30, "mjpegScalingFactor": 60, "mjpegServerScreenshotQuality": 60}})
        except Exception: pass
        self.refresh_size()

    def refresh_size(self):
        try:
            v = http("GET", f"/session/{self.sid}/window/size")["value"]; self.size = (v["width"], v["height"])
        except Exception: pass

    def S(self, p): return f"/session/{self.sid}{p}"

    def call(self, method, path, body=None):
        def go():
            try: http(method, path, body)
            except Exception as e:
                log("요청 실패", path, e)
                if "404" in str(e) or "session" in str(e).lower():
                    try: self.session(); http(method, path.replace(path.split('/')[2], self.sid) if path.startswith('/session/') else path, body)
                    except Exception as e2: log("재연결 실패", e2)
        threading.Thread(target=go, daemon=True).start()

    # ── 화면 ─────────────────────────────────────
    def stream(self):
        last = 0
        while not self.stop:
            try:
                s = urllib.request.urlopen(f"http://127.0.0.1:{MJ}", timeout=10); buf = b""
                while not self.stop:
                    chunk = s.read(65536)
                    if not chunk: break
                    buf += chunk
                    a = buf.find(b"\xff\xd8"); b = buf.find(b"\xff\xd9", a + 2)
                    while a != -1 and b != -1:
                        jpg, buf = buf[a:b + 2], buf[b + 2:]
                        img = Image.open(io.BytesIO(jpg)); img.load()
                        if (img.width > img.height) != (self.size[0] > self.size[1]) and time.time() - last > 1:
                            last = time.time(); self.refresh_size()
                        self.frame = img; self.root.after(0, self.draw)
                        a = buf.find(b"\xff\xd8"); b = buf.find(b"\xff\xd9", a + 2)
                    if len(buf) > 4_000_000: buf = b""
            except Exception as e:
                log("화면 끊김", e); time.sleep(1)

    def draw(self):
        if not self.frame: return
        W, H = self.cv.winfo_width(), self.cv.winfo_height()
        img = self.frame; k = min(W / img.width, H / img.height)
        w, h = max(1, int(img.width * k)), max(1, int(img.height * k)); x, y = (W - w) // 2, (H - h) // 2
        self.box = (x, y, w, h)
        self.tkimg = ImageTk.PhotoImage(img.resize((w, h), Image.BILINEAR))
        if not hasattr(self, "imgid"): self.imgid = self.cv.create_image(x, y, anchor="nw", image=self.tkimg)
        else: self.cv.coords(self.imgid, x, y); self.cv.itemconfigure(self.imgid, image=self.tkimg)

    def pt(self, ex, ey):
        x, y, w, h = self.box
        fx, fy = (ex - x) / w, (ey - y) / h
        if not (0 <= fx <= 1 and 0 <= fy <= 1): return None
        return (round(fx * self.size[0]), round(fy * self.size[1]))

    # ── 손가락 ───────────────────────────────────
    def touch(self, steps):
        acts = []
        for s in steps:
            if s[0] == "move": acts.append({"type": "pointerMove", "duration": s[3], "x": s[1], "y": s[2]})
            elif s[0] == "down": acts.append({"type": "pointerDown", "button": 0})
            elif s[0] == "up": acts.append({"type": "pointerUp", "button": 0})
            elif s[0] == "wait": acts.append({"type": "pause", "duration": s[1]})
        self.call("POST", self.S("/actions"), {"actions": [{"type": "pointer", "id": "finger", "parameters": {"pointerType": "touch"}, "actions": acts}]})

    def swipe(self, a, b, ms=250, hold=0):
        st = [("move", a[0], a[1], 0), ("down",)]
        if hold: st.append(("wait", hold))
        st += [("move", b[0], b[1], ms), ("up",)]
        self.touch(st)

    def down(self, e):
        self.cv.focus_set(); p = self.pt(e.x, e.y)
        self.press = (p, time.time(), e.x, e.y) if p else None
    def release(self, e):
        if not self.press or not self.sid: return
        p, t0, x0, y0 = self.press; self.press = None
        q = self.pt(e.x, e.y) or p; dt = time.time() - t0
        if abs(e.x - x0) + abs(e.y - y0) > 8:
            self.swipe(p, q, ms=max(120, min(1200, int(dt * 1000))))
        else:
            self.touch([("move", p[0], p[1], 0), ("down",), ("wait", 600 if dt > 0.5 else 40), ("up",)])
    def wheel(self, e):
        p = self.pt(e.x, e.y)
        if not p or not self.sid: return
        d = int(self.size[1] * 0.18) * (1 if e.delta > 0 else -1)
        q = (p[0], max(5, min(self.size[1] - 5, p[1] + d))); self.swipe(p, q, ms=150)

    # ── 글자 ─────────────────────────────────────
    def type(self, s):
        if s and self.sid: self.call("POST", self.S("/wda/keys"), {"value": list(s)})
    def key(self, e):
        if e.widget is self.ent: return
        if e.keysym == "BackSpace": self.type("\b")
        elif e.keysym in ("Return", "KP_Enter"): self.type("\n")
        elif e.keysym == "Tab": self.type("\t")
        elif e.char and (e.char.isprintable()): self.type(e.char)
    def send_entry(self, e=None):
        s = self.ent.get(); self.ent.delete(0, "end"); self.type(s); self.cv.focus_set()

    # ── 버튼 ─────────────────────────────────────
    def home(self): self.call("POST", "/wda/homescreen")
    def lock(self): self.call("POST", "/wda/lock")
    def btn(self, name): self.call("POST", self.S("/wda/pressButton"), {"name": name})
    def switcher(self):
        w, h = self.size
        self.touch([("move", w // 2, h - 3, 0), ("down",), ("move", w // 2, int(h * 0.6), 350), ("wait", 700), ("up",)])
    def cc(self): w, h = self.size; self.swipe((w - 30, 3), (w - 30, int(h * 0.5)), ms=300)
    def nc(self): w, h = self.size; self.swipe((w // 3, 3), (w // 3, int(h * 0.6)), ms=300)

    def quit(self):
        self.stop = True
        for p in procs:
            try: p.terminate()
            except Exception: pass
        self.root.destroy()

IOS = ios_bin()
if __name__ == "__main__":
    log("──── 시작 ────", "go-ios:", IOS)
    App().root.mainloop()
