import re, sys, json, subprocess, os
sys.path.insert(0, "/home/claude/beopmusa/collector")
from hwp_text import hwp_text
L = "/mnt/user-data/uploads/내 드라이브/LEET 기출"
CIR = "①②③④⑤"
NOISE = [r"^\d{1,2}$", r"^(언어이해|추리논증|홀수형|짝수형|논술)(\s*(홀수형|짝수형))?$", r"학년도\s*법학적성시험", r"^제\s*\d\s*교시", r"^(성명|수험\s*번호)$",
         r"^◦", r"^\d+\s*/\s*\d+$", r"이 문제지에 관한 저작권", r"^\*?\s*확인\s*사항", r"^-\s*\d+\s*-$", r"^(언어이해|추리논증)\s+(홀수형|짝수형)$",
         r"한국교육과정평가원", r"법학전문대학원협의회", r"^.{0,14}(홀수형|짝수형).{0,8}$", r"^(추\s*리|논\s*증|언\s*어|이\s*해)$"]
NZ = [re.compile(x) for x in NOISE]
def clean(lines):
    out = []
    for l in lines:
        l = re.sub(r"\s+", " ", l.replace("　", " ")).strip()
        if not l or any(z.search(l) for z in NZ): continue
        out.append(l)
    return out

def pdf_lines(path, ocr=False):
    import pdfplumber
    out = []
    with pdfplumber.open(path) as pdf:
        for pi, pg in enumerate(pdf.pages):
            W, H = pg.width, pg.height
            for x0, x1 in ((0, W / 2), (W / 2, W)):
                if not ocr:
                    t = pg.crop((x0, H * 0.06, x1, H * 0.95)).extract_text(x_tolerance=1.2) or ""
                else:
                    im = pg.crop((x0, H * 0.06, x1, H * 0.95)).to_image(resolution=300).original
                    fn = f"/tmp/lt/ocr_{os.getpid()}.png"; im.save(fn)
                    t = subprocess.run(["tesseract", fn, "-", "-l", "kor+eng", "--psm", "6"], capture_output=True, text=True).stdout
                out += [(pi + 1, l) for l in t.split("\n")]
    return out

JK = re.compile(r"(법학적성시험|험\s*번호|확인하십시오|홀수형|짝수형)")
JW = {"법학적성시험","논","증","험번호","홀수형","짝수형","확인하십시오.","이해","언어이해","추리논증","추리논","논증","언어이","추","리","성명","수험"}
def junk5(s):
    m = JK.search(s)
    if m: s = s[:m.start()]
    w = s.split()
    while w and w[-1] in JW and len(w) > 1: w.pop()
    return " ".join(w)
GARB = re.compile(r"[^\u0000-\u00ff\u0370-\u03ff\u2000-\u2bff\u3000-\u303f\u3130-\u318f\u3200-\u32ff\u3400-\u9fff\uac00-\ud7af\uff00-\uffef\t\n]+")
def reflow(ls):
    if not ls: return ""
    import statistics
    med = statistics.median(len(x) for x in ls)
    out = ""
    for x in ls:
        out += x
        out += "\n" if (len(x) < med * 0.75 and re.search(r"[.?!다]\.?$", x)) or x.startswith("<보") or re.match(r"^\s*[ㄱ-ㅎ]\.", x) is None and False else " "
    return out.strip()
def split_opts(s):
    s = " ".join(s.split())
    idx = [s.find(c) for c in CIR]
    if any(i < 0 for i in idx) or idx != sorted(idx): return None
    return [s[idx[k] + 1: idx[k + 1] if k < 4 else None].strip() for k in range(5)]

STEM = re.compile(r"(것은|것만을.{0,30}것은|무엇인가|옳은가|적절한가|몇\s*개인가|누구인가|어느 것인가)\s*\?$")
def isstem(t): return len(t) < 220 and bool(STEM.search(t))
GRP = re.compile(r"^\[\s*(\d{1,2})\s*[～~∼〜\-–]\s*(\d{1,2})\s*\]\s*(.*)$")
QN = re.compile(r"^(\d{1,2})\s*\.\s+(.*)$")
def parse(pl, numbered):
    # pl: [(page, line)]
    lines = [(p, l) for p, l in pl if l]
    items, passages = [], {}
    i, n = 0, len(lines)
    grp = None
    pre, prepg = [], None
    while i < n:
        p, l = lines[i]
        if l.startswith("①"):
            opt = [l]; i += 1
            if numbered:
                while i < n and not QN.match(lines[i][1]) and not GRP.match(lines[i][1]):
                    if "⑤" in " ".join(opt) and (lines[i][1].endswith("?") ): break
                    opt.append(lines[i][1]); i += 1
            else:
                while i < n and "⑤" not in " ".join(opt) and not GRP.match(lines[i][1]):
                    opt.append(lines[i][1]); i += 1
            # block = pre
            q, mat, pas = [], [], None
            blk = pre; pre = []
            j = 0
            gm = None; gstart = None
            for k, (bp, bl) in enumerate(blk):
                m = GRP.match(bl)
                if m: gm = (k, m)
            if gm:
                k, m = gm; a, b = int(m[1]), int(m[2])
                # passage = after marker until stem start
                rest = blk[k + 1:]
                s = next((x for x, (_, t) in enumerate(rest) if (numbered and QN.match(t)) or (not numbered and isstem(t))), None)
                if s is None and not numbered: s = next((x for x, (_, t) in enumerate(rest) if t.endswith("?")), None)
                if numbered and s is not None:
                    pass
                elif s is not None:
                    # hwp: stem is the line ending with ?, passage lines before it
                    pass
                body = rest[:s] if s is not None else rest
                grp = f"{a}~{b}"
                passages[grp] = {"a": a, "b": b, "t": (reflow([t for _, t in body]) if numbered else "\n".join(t for _, t in body)), "pg": blk[k][0]}
                blk = rest[s:] if s is not None else []
                gstart = a
            # stem + material
            st = blk
            if numbered:
                lastq = max((x for x, (_, t) in enumerate(blk) if QN.match(t)), default=0)
                blk = blk[lastq:]
                st = [(bp, re.sub(r"^\d{1,2}\s*\.\s+", "", bl, count=1) if x == 0 else bl) for x, (bp, bl) in enumerate(blk)]
            # stem = lines up to the first ending with ?
            e = next((x for x, (_, t) in enumerate(st) if (isstem(t) if not numbered else t.endswith("?"))), None)
            if e is None: e = next((x for x, (_, t) in enumerate(st) if t.endswith("?")), None)
            if e is None: e = 0
            stem = GARB.sub("", re.sub(r"^\d{1,2}\s*\.\s*", "", " ".join(t for _, t in st[:e + 1]))).strip()
            ml = [t for _, t in st[e + 1:]]
            mat = reflow(ml) if numbered else "\n".join(ml)
            o = split_opts(" ".join(opt))
            if o: o[4] = junk5(o[4])
            items.append({"stem": stem, "mat": mat, "o": o, "pg": (blk[0][0] if blk else p), "rawopt": None if o else " ".join(opt), "gstart": gstart})
            continue
        pre.append((p, l)); i += 1
    BRK = re.compile(r"\s*(<보\s*기>|<[^<>]{1,12}>(?=\s)|\[[^\[\]]{1,14}\](?=\s)|(?<=\s)[ㄱ-ㅇ]\.\s|(?<=\s)[갑을병정]\s?:\s|\(\d\)\s)")
    def brk(s): return BRK.sub(lambda m: "\n" + m.group(1), s).strip() if numbered else s
    for it in items:
        it["mat"] = brk(it["mat"])
        it["fig"] = 1 if (re.search(r"(그림|<표>|\[표\]|그래프|다음 표)", it["stem"] + it["mat"]) or re.search(r"\S {2,}\S", it["mat"])) else 0
    for g in passages.values(): g["t"] = brk(g["t"])
    # assign numbers (resync at group markers; fill gaps with placeholders)
    out = []
    for it in items:
        if it.get("gstart") and len(out) + 1 < it["gstart"]:
            while len(out) + 1 < it["gstart"]:
                out.append({"stem": "(이 문항은 글자로 정리하지 못했어요 — 원본 시험지를 함께 보세요)", "mat": "", "o": None, "pg": it["pg"], "miss": 1, "fig": 1})
        out.append(it)
    items = out
    for it in items:
        if it.get("o"): it["o"] = [GARB.sub("", x).strip() for x in it["o"]]
        it["stem"] = GARB.sub("", it["stem"]).strip(); it["mat"] = GARB.sub("", it["mat"]).strip()
        it.pop("gstart", None)
    for g in passages.values(): g["t"] = GARB.sub("", g["t"])
    for k, it in enumerate(items):
        it["n"] = k + 1
        it["grp"] = next((g for g, v in passages.items() if v["a"] <= k + 1 <= v["b"]), None)
    return items, passages

def keys(text, N):
    t = text
    a = t.find("홀수형")
    if a >= 0:
        e = t.find("짝수형", a)
        t = t[a: e if e > 0 else None]
    pairs = re.findall(r"(\d{1,2})\s*([①②③④⑤])", " ".join(t.split()))
    d = {}
    for nn, c in pairs:
        nn = int(nn)
        if 1 <= nn <= N and nn not in d: d[nn] = CIR.index(c)
    return [d.get(k) for k in range(1, N + 1)]

def build(year, area):
    nm = "언어이해" if area == "lang" else "추리논증"
    d = f"{L}/{year}"
    cands = [f"{d}/{year}_{nm}(홀수형).hwp", f"{d}/{year}_{nm}(홀수형).pdf", f"{d}/{year}_{nm}.pdf"]
    src = next(c for c in cands if os.path.exists(c))
    if src.endswith(".hwp"):
        pl = [(0, l) for l in clean(hwp_text(src).split("\n"))]
        numbered = False
    else:
        import pdfplumber
        with pdfplumber.open(src) as pdf: has = bool((pdf.pages[1].extract_text(x_tolerance=1.2) or "").strip())
        raw = pdf_lines(src, ocr=not has)
        cl = clean([l for _, l in raw]); it = iter(cl)
        pl = []; 
        for p, l in raw:
            c = re.sub(r"\s+", " ", l).strip()
            if c and not any(z.search(c) for z in NZ): pl.append((p, c))
        numbered = True
    items, passages = parse(pl, numbered)
    kf = [f"{d}/{year}_{nm}_정답표.hwp", f"{d}/{year}_{nm}_정답표.pdf"]
    k = next((c for c in kf if os.path.exists(c)), None)
    N = len(items)
    ans = [None] * N
    if k:
        if k.endswith(".hwp"): kt = hwp_text(k)
        else:
            import pdfplumber
            with pdfplumber.open(k) as pdf: kt = "\n".join((pg.extract_text(x_tolerance=1.2) or "") for pg in pdf.pages)
        ans = keys(kt, N)
    return {"src": os.path.basename(src), "items": items, "passages": passages, "ans": ans}

if __name__ == "__main__":
    y, a = sys.argv[1], sys.argv[2]
    r = build(y, a)
    json.dump(r, open(f"/home/claude/leetx/{y}-{a}.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    bad = sum(1 for x in r["items"] if not x["o"])
    print(y, a, "items", len(r["items"]), "passages", len(r["passages"]), "badopt", bad, "keys", sum(1 for x in r["ans"] if x is not None))
