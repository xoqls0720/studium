// 저장소의 웹 앱(Studium·생각과 글·토익·법무사)을 www/ 로 모으고, 각 화면에 앱 연결 코드(native.js)를 넣는다.
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const APP = dirname(dirname(fileURLToPath(import.meta.url))), ROOT = dirname(APP), WWW = join(APP, "www");
rmSync(WWW, { recursive: true, force: true }); mkdirSync(WWW, { recursive: true });
const copy = p => existsSync(join(ROOT, p)) && cpSync(join(ROOT, p), join(WWW, p), { recursive: true });
["index.html", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png", "css", "js", "vendor", "shim", "beopmusa"].forEach(copy);
for (const d of ["geul", "toeic"]) {
  mkdirSync(join(WWW, d), { recursive: true });
  for (const f of ["index.html", "icon.png", "icon-192.png", "icon-512.png", "manifest.webmanifest", "pdf.min.js", "pdf.worker.min.js"]) copy(`${d}/${f}`);
}
cpSync(join(APP, "native.js"), join(WWW, "native.js"));
cpSync(join(APP, "node_modules/@capacitor/core/dist/capacitor.js"), join(WWW, "capacitor.js"));
const inject = (rel, up) => {
  const p = join(WWW, rel); if (!existsSync(p)) return;
  let h = readFileSync(p, "utf8");
  if (!h.includes("native.js")) h = h.replace(/<head>/i, `<head>\n<script src="${up}capacitor.js"></script><script src="${up}native.js"></script>`);
  h = h.replace(/<link rel="manifest"[^>]*>/i, "");   // 앱 안에서는 웹 앱 설치 안내가 필요 없다
  writeFileSync(p, h);
};
inject("index.html", ""); inject("geul/index.html", "../"); inject("toeic/index.html", "../"); inject("beopmusa/index.html", "../");
const v = JSON.parse(readFileSync(join(APP, "package.json"), "utf8")).version;
writeFileSync(join(WWW, "app-version.json"), JSON.stringify({ version: v, built: new Date().toISOString() }));
console.log("www 준비 끝 —", v);
