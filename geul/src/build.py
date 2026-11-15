"""src/app.html + src/data.js (+ 토익 앱의 CSS·PDF 코드) → artifact.html(claude.ai용), index.html(깃허브 페이지·홈 화면 앱용)"""
from pathlib import Path
R = Path(__file__).resolve().parent; G = R.parent; T = G.parent / "toeic" / "src" / "app.html"
t = T.read_text(encoding="utf-8")
css = t[t.index("<style>") + 7:t.index("</style>")]
pdf = t[t.index("// ---------- 화면 문서 → PDF"):t.index("const VIEWS=")]
a = (R / "app.html").read_text(encoding="utf-8").replace("/*CSS*/", css, 1).replace("/*PDF*/", pdf, 1).replace("/*DATA*/", (R / "data.js").read_text(encoding="utf-8"), 1)
np = (G.parent / "shim" / "notepdf.js").read_text(encoding="utf-8")
a = a.replace("</head>", "<script>\n" + np + "\n</script>\n</head>", 1)
(G / "artifact.html").write_text(a, encoding="utf-8")
pwa = '<link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="#1d5a66">\n<script src="../shim/claude.js"></script>\n'
(G / "index.html").write_text(a.replace("<title>", pwa + "<title>", 1), encoding="utf-8")
print("artifact.html, index.html")
