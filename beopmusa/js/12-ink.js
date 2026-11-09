'use strict';
// ── 굿노트로 보내기: PC 생성기가 만든 PDF 를 공유 창으로 넘긴다(공유 창에서 굿노트를 고르면 바로 열림) ──
// 필기는 앱에서 하지 않고 굿노트에서 한다(단원을 열면 PDF를 미리 받아 둬서 한 번에 열린다).
const pdfCache = new Map();
async function toGoodnotes(btn, path, name) {
  let file = pdfCache.get(path);
  if (!file) {
    busy(btn, 'PDF 준비 중');
    try { file = new File([await (await src().file(path)).blob()], name, {type: 'application/pdf'}); pdfCache.set(path, file); }
    catch (e) { unbusy(btn); return toast('PDF를 받지 못했어요: ' + e.message); }
    unbusy(btn);
  }
  if (navigator.canShare?.({files: [file]})) {
    try { await navigator.share({files: [file], title: name}); return; }
    catch (e) {
      if (e.name === 'AbortError') return;
      if (e.name === 'NotAllowedError') { btn.innerHTML = ic('share', 18) + '눌러서 굿노트로'; return toast('준비됐어요. 한 번 더 누르면 공유 창이 열려요'); }
    }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; a.click();
  toast('PDF를 저장했어요. 굿노트에서 가져오기로 열어 주세요');
}
