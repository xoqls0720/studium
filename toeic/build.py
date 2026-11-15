"""src/app.html 의 /*DATA*/ 자리에 src/data.js 를 넣어 artifact.html(claude.ai용)과 index.html(깃허브 페이지·홈 화면 앱용)을 만든다."""
from pathlib import Path
root = Path(__file__).parent
a = (root / "src" / "app.html").read_text(encoding="utf-8").replace("/*DATA*/", (root / "src" / "data.js").read_text(encoding="utf-8"))
np = (root.parent / "shim" / "notepdf.js").read_text(encoding="utf-8")
a = a.replace("</head>", "<script>\n" + np + "\n</script>\n</head>", 1)
(root / "artifact.html").write_text(a, encoding="utf-8")
pwa = '<link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="#1d5a66">\n<script src="../shim/claude.js"></script>\n<script src="../shim/tabs.js"></script>\n'
(root / "index.html").write_text(a.replace("<title>", pwa + "<title>", 1), encoding="utf-8")
print("artifact.html, index.html")
