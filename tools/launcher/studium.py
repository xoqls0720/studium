# -*- coding: utf-8 -*-
"""Studium 데스크톱 — 공부 앱(Studium·생각과 글·토익·법무사)을 자기 창을 가진 프로그램으로 연다.

Edge(없으면 Chrome)의 '앱 창' 모드로 띄워서 주소창·탭 없이 프로그램처럼 보이고,
평소 쓰는 브라우저 프로필을 그대로 써서 구글 로그인(드라이브 저장)이 그대로 된다.
처음 실행하면 바탕화면과 시작 메뉴에 바로가기를 만든다.
"""
import os, sys, subprocess, shutil, tkinter as tk
from tkinter import messagebox

BASE = "https://xoqls0720.github.io/studium/"
APPS = {"": "Studium", "geul/": "생각과 글", "toeic/": "토익", "beopmusa/": "법무사"}
NOWIN = 0x08000000

def browser():
    cands = [
        os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%LocalAppData%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
    ]
    for c in cands:
        if os.path.exists(c): return c
    return shutil.which("msedge") or shutil.which("chrome")

def open_app(path=""):
    b = browser()
    url = BASE + path
    if not b:
        os.startfile(url); return
    subprocess.Popen([b, f"--app={url}", "--window-size=1280,860"], creationflags=NOWIN)

def make_shortcuts():
    exe = sys.executable if getattr(sys, "frozen", False) else os.path.abspath(__file__)
    ps = r"""
$s = New-Object -ComObject WScript.Shell
$targets = @([Environment]::GetFolderPath('Desktop'), (Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs'))
foreach ($d in $targets) {
  $l = $s.CreateShortcut((Join-Path $d 'Studium.lnk'))
  $l.TargetPath = '%EXE%'
  $l.WorkingDirectory = Split-Path '%EXE%'
  $l.IconLocation = '%EXE%,0'
  $l.Description = '공부 앱 Studium (생각과 글 · 토익 · 법무사)'
  $l.Save()
}
""".replace("%EXE%", exe.replace("'", "''"))
    subprocess.run(["powershell", "-NoProfile", "-Command", ps], creationflags=NOWIN)

def chooser():
    r = tk.Tk(); r.title("Studium"); r.resizable(False, False)
    r.configure(bg="#ffffff")
    tk.Label(r, text="무엇을 공부할까요?", bg="#ffffff", fg="#000", font=("Malgun Gothic", 13, "bold")).pack(padx=30, pady=(22, 12))
    for path, name in APPS.items():
        tk.Button(r, text=name, width=22, font=("Malgun Gothic", 11), bg="#f3f3f0", fg="#000", relief="flat",
                  command=lambda p=path: (open_app(p), r.destroy())).pack(padx=30, pady=4)
    tk.Label(r, text="앱 안 아래쪽 탭으로도 서로 옮겨 갈 수 있어요", bg="#ffffff", fg="#555", font=("Malgun Gothic", 9)).pack(pady=(10, 18))
    r.mainloop()

if __name__ == "__main__":
    flag = os.path.join(os.environ.get("LOCALAPPDATA", "."), "Studium", "shortcut.done")
    if not os.path.exists(flag):
        try:
            make_shortcuts(); os.makedirs(os.path.dirname(flag), exist_ok=True); open(flag, "w").write("1")
        except Exception as e:
            messagebox.showwarning("Studium", f"바로가기를 만들지 못했어요: {e}")
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    if arg in APPS: open_app(arg)
    else: chooser()
