"""src/app.html 의 /*DATA*/ 자리에 src/data.js 를 넣어 index.html 한 파일로 합칩니다.
실행: python3 build.py"""
from pathlib import Path
root = Path(__file__).parent
app = (root / "src" / "app.html").read_text(encoding="utf-8")
data = (root / "src" / "data.js").read_text(encoding="utf-8")
(root / "index.html").write_text(app.replace("/*DATA*/", data), encoding="utf-8")
print("index.html 생성 완료")
