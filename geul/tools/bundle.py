import json, glob, re
man = json.load(open("keys_manual.json"))
CIR="①②③④⑤"
exams = []; rep = []
for f in sorted(glob.glob("20??-*.json")):
    y, a = f[:-5].split("-"); r = json.load(open(f))
    ans = r["ans"]
    if f[:-5] in man:
        k = man[f[:-5]].replace(" ", ""); ans = [int(c) - 1 for c in k]
    N = len(r["items"])
    if len(ans) != N: rep.append(f"{f} items {N} keys {len(ans)}")
    items = []
    for i, it in enumerate(r["items"]):
        q = it["stem"] + ("\n\n" + it["mat"] if it.get("mat") else "")
        x = {"n": i + 1, "q": q, "o": it["o"], "a": ans[i] if i < len(ans) else None, "grp": it.get("grp"), "pg": it.get("pg", 0)}
        if not it["o"]: x["bad"] = q + "\n\n" + (it.get("rawopt") or "")
        if it.get("fig"): x["fig"] = 1
        if it.get("miss"): x["miss"] = 1
        items.append(x)
    area = "언어이해" if a == "lang" else "추리논증"
    exams.append({"id": f"{y}-{a}", "area": area, "year": int(y), "n": N, "items": items, "passages": r["passages"], "src": r.get("src", "")})
IMGK = {"2022-lang":"3554121433 4511244241 5533225532","2022-reason":"1224114215 2335445152 3441323232 2243515313",
 "2023-lang":"3152435534 1225411513 1224353553","2023-reason":"1542252424 3131413233 2354112115 5522442413",
 "2027-lang":"544334211232335253422154234314","2027-reason":"5334511331245512125421511123143324333141"}
for k, v in IMGK.items():
    y, ar = k.split("-"); v = v.replace(" ", "")
    exams.append({"id": k, "area": "언어이해" if ar == "lang" else "추리논증", "year": int(y), "n": len(v), "img": 1,
                  "src": f"{y}_{'언어이해' if ar=='lang' else '추리논증'}{'' if y=='2027' else '(홀수형)'}.pdf",
                  "items": [{"n": i + 1, "a": int(c) - 1} for i, c in enumerate(v)], "passages": {}})
exams.sort(key=lambda e: (e["year"], e["area"]))
json.dump({"v": 1, "kind": "leet-gichul", "exams": exams}, open("LEET기출_앱용.json", "w", encoding="utf-8"), ensure_ascii=False)
import os; print(len(exams), os.path.getsize("LEET기출_앱용.json")//1024, "KB"); print("\n".join(rep))
