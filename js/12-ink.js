'use strict';
// ── 굿노트로 보내기: PC 생성기가 만든 PDF 를 공유 창으로 넘긴다(공유 창에서 굿노트를 고르면 바로 열림) ──
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

// ── 손글씨(애플 펜슬): 노트를 고정 폭 종이(740px)로 펴고 그 위에 그린다. 손가락은 넘기기, 펜슬은 쓰기. ──
const PAPER_W = 740, PENS = ['#1b1d22', '#1f3473', '#c0392b', '#2b7650'], HLS = ['#ffd84d', '#8fe3c4', '#ffb3c7'];
function setupInk(uid) {
  const paper = $('#paper'), wrap = $('#pw'), cv = $('#ink');
  if (!paper) return;
  const ctx = cv.getContext('2d');
  let strokes = (ink[uid]?.strokes || []).slice(), on = false, force = false, cur = null, erasing = false, undo = [], changed = false, H = 0, raf = 0;
  let tool = store.get('inkTool', 'pen'), pen = store.get('inkPen', PENS[0]), hl = store.get('inkHl', HLS[0]), finger = store.get('inkFinger', false);
  // 펜 끝으로 같은 자리 두 번 톡 → 펜 ⇄ 지우개 (사파리는 펜슬 옆면 두 번 탭을 웹에 알려 주지 않아서, 가장 가까운 길)
  let prevTool = store.get('inkPrev', 'pen'), tapped = null, lastTap = null, tft = null, ecur = null;
  // 폰처럼 좁은 화면은 평소엔 글만 크게 보이고, 필기를 켜거나 인쇄할 때 종이로 편다(필기 위치가 어긋나지 않게)
  const fixed = () => on || force || (strokes.length > 0 && wrap.clientWidth >= PAPER_W * .8);
  function layout() {
    const f = fixed();
    paper.classList.toggle('fixed', f); paper.classList.toggle('lightvars', f); paper.classList.toggle('inking', on);
    paper.style.zoom = f ? Math.min(1, wrap.clientWidth / PAPER_W) : '';
    cv.hidden = !f;
    if (!f) return;
    const r = paper.getBoundingClientRect();
    H = Math.round(r.height * PAPER_W / r.width);
    let dpr = Math.min(2, devicePixelRatio || 1);
    while (PAPER_W * H * dpr * dpr > 16e6 && dpr > .6) dpr -= .2;  // 아이패드 캔버스 한도
    cv.width = PAPER_W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }
  function line(s, from = 1) {
    const p = s.p;
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.strokeStyle = s.c;
    if (s.k === 'hl') {
      ctx.globalAlpha = .45; ctx.lineWidth = 16;
      ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
      if (p.length === 1) ctx.lineTo(p[0][0] + .1, p[0][1]);
      ctx.stroke(); ctx.globalAlpha = 1;
      return;
    }
    if (p.length === 1) { ctx.fillStyle = s.c; ctx.beginPath(); ctx.arc(p[0][0], p[0][1], 1.4, 0, 7); ctx.fill(); return; }
    for (let i = Math.max(1, from); i < p.length; i++) {
      const a = p[i - 1], b = p[i];
      ctx.lineWidth = 2.2 * (.55 + (b[2] ?? .5) * .9);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
  }
  function draw() { ctx.clearRect(0, 0, PAPER_W, H); for (const s of strokes) line(s); if (cur) line(cur); }
  const pt = e => { const r = paper.getBoundingClientRect(), k = PAPER_W / r.width; return [Math.round((e.clientX - r.left) * k * 10) / 10, Math.round((e.clientY - r.top) * k * 10) / 10, Math.round((e.pressure || .5) * 100) / 100]; };
  const snap = () => { undo.push(strokes.slice()); if (undo.length > 40) undo.shift(); };
  function eraseAt(q) {
    const before = strokes.length;
    const hit = s => s.p.some(([x, y]) => (x - q[0]) ** 2 + (y - q[1]) ** 2 < (s.k === 'hl' ? 196 : 100));
    if (strokes.some(hit)) { if (!changed) snap(); strokes = strokes.filter(s => !hit(s)); }
    if (strokes.length !== before) { changed = true; draw(); }
  }
  const save = () => { saveInk(uid, strokes); };
  const allow = e => on && (e.pointerType !== 'touch' || finger) && e.button <= 0;
  // 지우개 동그라미를 펜슬·마우스 자리에 보여 준다(펜슬을 띄워도 보이는 기기에서는 하버에서도)
  function eCursor(e) {
    if (!on || tool !== 'eraser' || e.pointerType === 'touch') { if (ecur) ecur.hidden = true; return; }
    if (!ecur) { ecur = document.createElement('div'); ecur.style.cssText = 'position:fixed;border:1.5px solid rgba(120,120,130,.9);background:rgba(120,120,130,.12);border-radius:50%;pointer-events:none;z-index:70'; document.body.append(ecur); }
    const d = 20 * paper.getBoundingClientRect().width / PAPER_W;
    ecur.hidden = false; ecur.style.width = ecur.style.height = d + 'px'; ecur.style.left = (e.clientX - d / 2) + 'px'; ecur.style.top = (e.clientY - d / 2) + 'px';
  }
  cv.onpointerdown = e => {
    if (!allow(e)) return;
    e.preventDefault(); cv.setPointerCapture(e.pointerId); state.inking = true;
    const p = pt(e);
    tapped = {t0: performance.now(), x: p[0], y: p[1], u0: undo.length};
    if (tool === 'eraser') { erasing = true; changed = false; eraseAt(p); return; }
    cur = {k: tool, c: tool === 'hl' ? hl : pen, p: [p]};
  };
  cv.onpointermove = e => {
    eCursor(e);
    if (!cur && !erasing) return;
    e.preventDefault();
    for (const ev of e.getCoalescedEvents?.() || [e]) {
      const p = pt(ev);
      if (tapped && (p[0] - tapped.x) ** 2 + (p[1] - tapped.y) ** 2 > 9) tapped = null;
      if (erasing) { eraseAt(p); continue; }
      const l = cur.p.at(-1);
      if ((p[0] - l[0]) ** 2 + (p[1] - l[1]) ** 2 > .4) cur.p.push(p);
    }
    if (cur?.k === 'hl') { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }
    else if (cur) line(cur, cur.p.length - 3);
  };
  cv.onpointerleave = () => { if (ecur) ecur.hidden = true; };
  cv.onpointerup = cv.onpointercancel = e => {
    state.inking = false;
    const tap = tapped && performance.now() - tapped.t0 < 240 ? tapped : null;
    tapped = null;
    if (erasing) { erasing = false; if (changed) save(); }
    else if (cur) { snap(); strokes.push(cur); cur = null; draw(); save(); }
    else { lastTap = null; return; }
    if (!tap || e.type === 'pointercancel') { lastTap = null; return; }
    tap.u1 = undo.length; tap.t1 = performance.now();
    // 같은 자리 두 번 톡(0.45초 안) → 톡으로 생긴 점·지움을 되돌리고 펜 ⇄ 지우개
    if (lastTap && tap.t1 - lastTap.t1 < 450 && (tap.x - lastTap.x) ** 2 + (tap.y - lastTap.y) ** 2 < 256) {
      let n = (tap.u1 - tap.u0) + (lastTap.u1 - lastTap.u0);
      while (n-- > 0 && undo.length) strokes = undo.pop();
      draw(); save();
      if (tool === 'eraser') tool = prevTool === 'eraser' ? 'pen' : prevTool;
      else { prevTool = tool; tool = 'eraser'; }
      store.set('inkTool', tool); store.set('inkPrev', prevTool); bar();
      if (ecur) ecur.hidden = true;
      toast(tool === 'eraser' ? '지우개로 바꿨어요 · 한 번 더 두 번 톡 하면 펜' : '펜으로 돌아왔어요');
      lastTap = null;
    } else lastTap = tap;
  };
  // 두 손가락 톡 → 되돌리기 (굿노트처럼)
  cv.addEventListener('touchstart', e => {
    if (!on || cur || erasing) { tft = null; return; }
    if (e.touches.length === 2) tft = {t: performance.now(), x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2};
    else if (e.touches.length > 2) tft = null;
  }, {passive: true});
  cv.addEventListener('touchmove', e => {
    if (tft && e.touches.length === 2 && Math.hypot((e.touches[0].clientX + e.touches[1].clientX) / 2 - tft.x, (e.touches[0].clientY + e.touches[1].clientY) / 2 - tft.y) > 18) tft = null;
  }, {passive: true});
  cv.addEventListener('touchend', e => {
    if (tft && !e.touches.length) {
      if (performance.now() - tft.t < 320 && undo.length) { strokes = undo.pop(); draw(); save(); toast('되돌렸어요'); }
      tft = null;
    }
  }, {passive: true});
  // 펜슬로 그을 때는 화면이 끌려가지 않게, 손가락은 그대로 넘기게
  const stopStylus = e => { if (on && ([...e.touches].some(t => t.touchType === 'stylus') || finger)) e.preventDefault(); };
  cv.addEventListener('touchstart', stopStylus, {passive: false});
  cv.addEventListener('touchmove', stopStylus, {passive: false});

  function bar() {
    document.querySelector('.inkbar')?.remove();
    const b = document.createElement('div');
    if (!on) {
      b.className = 'inkbar inkfab noprint'; b.style.left = 'auto'; b.style.transform = 'none';
      b.innerHTML = `<button class="done" id="ink-on" style="display:flex;gap:6px;align-items:center">${ic('pen', 18)}필기</button>`;
      document.body.append(b);
      $('#ink-on').onclick = () => { on = true; layout(); bar(); paper.scrollIntoView({behavior: 'smooth', block: 'start'}); toast(finger ? '손가락·펜슬로 쓸 수 있어요 · 같은 자리 두 번 톡=지우개' : '펜슬로 쓰고 손가락으로 넘겨요 · 펜 끝 두 번 톡=지우개 · 두 손가락 톡=되돌리기'); };
      return;
    }
    b.className = 'inkbar noprint';
    b.innerHTML = `${PENS.map(c => `<button data-pen="${c}" class="${tool === 'pen' && pen === c ? 'on' : ''}" aria-label="펜"><span class="sw" style="background:${c}"></span></button>`).join('')}
      <span class="sep"></span>${HLS.map(c => `<button data-hl="${c}" class="${tool === 'hl' && hl === c ? 'on' : ''}" aria-label="형광펜"><span class="sw" style="background:${c};border-radius:4px;width:16px;height:12px"></span></button>`).join('')}
      <span class="sep"></span><button data-t="eraser" class="${tool === 'eraser' ? 'on' : ''}" aria-label="지우개">${ic('eraser', 20)}</button>
      <button id="ink-undo" aria-label="되돌리기">${ic('undo', 20)}</button>
      <button id="ink-finger" class="${finger ? 'on' : ''}" aria-label="손가락으로 쓰기">${ic('hand', 20)}</button>
      <button id="ink-clear" aria-label="모두 지우기">${ic('trash', 20)}</button>
      <span class="sep"></span><button class="done" id="ink-off">완료</button>`;
    document.body.append(b);
    b.querySelectorAll('[data-pen]').forEach(x => x.onclick = () => { tool = 'pen'; pen = x.dataset.pen; store.set('inkTool', tool); store.set('inkPen', pen); bar(); });
    b.querySelectorAll('[data-hl]').forEach(x => x.onclick = () => { tool = 'hl'; hl = x.dataset.hl; store.set('inkTool', tool); store.set('inkHl', hl); bar(); });
    b.querySelector('[data-t=eraser]').onclick = () => { tool = 'eraser'; store.set('inkTool', tool); bar(); };
    $('#ink-undo').onclick = () => { if (!undo.length) return; strokes = undo.pop(); draw(); save(); };
    $('#ink-finger').onclick = () => { finger = !finger; store.set('inkFinger', finger); cv.style.touchAction = finger ? 'none' : 'pan-y pinch-zoom'; bar(); toast(finger ? '손가락으로도 써요' : '손가락은 넘기기, 펜슬은 쓰기'); };
    $('#ink-clear').onclick = () => { if (!strokes.length || !confirm('이 강의의 필기를 모두 지울까요?')) return; snap(); strokes = []; draw(); save(); };
    $('#ink-off').onclick = () => { on = false; layout(); bar(); };
  }
  cv.style.touchAction = finger ? 'none' : 'pan-y pinch-zoom';
  state.onResize = layout;
  state.onInk = () => { if (cur || erasing) return; strokes = (ink[uid]?.strokes || []).slice(); layout(); };
  state.inkPrint = () => { if (strokes.length && !fixed()) { force = true; layout(); addEventListener('afterprint', () => { force = false; layout(); }, {once: true}); } };
  if (document.fonts?.ready) document.fonts.ready.then(() => paper.isConnected && layout());
  layout(); bar();
}
