'use strict';
// ── 설정 ────────────────────────────────────────────────────────
function viewSettings() {
  frame('설정');
  const qn = Object.keys(prog.q).length, cn = Object.keys(prog.srs).filter(k => k.startsWith('c:')).length;
  render(`<div class="narrow"><section class="hero" style="margin-bottom:22px"><div class="eyebrow">설정</div><h2 class="display">연결과 공부 방식</h2></section>
    <div class="card"><h2>자료 연결</h2><p class="muted" style="margin-top:0">지금: ${{local: '내 컴퓨터 폴더', drive: '구글 드라이브', url: 'PC 바로 보기(' + esc(urlSrc) + ')'}[cfg.mode] || '연결 안 함 (앱에서 넣은 자료만)'}</p>
      <div class="row">${'showDirectoryPicker' in window ? '<button class="btn" id="s-local">내 컴퓨터 폴더 고르기</button>' : ''}<button class="btn" id="s-drive">구글 드라이브로 연결</button></div>
      <p class="faint" style="margin:10px 0 0">구글 드라이브의 '${FOLDER}' 폴더를 읽고, 앱에서 넣은 자료는 '${FOLDER}/${INBOX}'에 올려요. 진도·필기는 드라이브 앱 전용 칸에서 기기끼리 맞춰요.</p></div>
    <div class="card ai"><div class="ai-head"><div class="mark">${ic('spark', 18)}</div><div class="grow"><b>Gemini</b><div class="faint">자료 정리, 질문·튜터, 서술형 채점, 새 문제·카드, 팟캐스트, 마인드맵, 약점 분석</div></div>${gemKey() ? '<span class="tag ok">켜짐</span>' : ''}</div>
      <label class="field"><span>API 키 · 이 기기에만 저장돼요</span><div class="row"><input type="password" id="gk" class="grow" value="${esc(gemKey())}" placeholder="AIza…" autocomplete="off"><button class="btn" id="gsave">저장</button><button class="btn gem" id="gtest">연결 확인</button></div></label>
      <p class="faint" style="margin:0">Google AI Studio(aistudio.google.com)의 'Get API key'에서 무료로 받을 수 있어요. PC 생성기에 등록한 키와 같은 것을 써도 돼요.</p></div>
    <div class="card"><h2>공부 방식</h2>
      <label class="field"><span>하루 새 카드</span><div class="opt">${[10, 20, 30, 50].map(n => `<label><input type="radio" name="np" value="${n}" ${pref('newPerDay', 20) === n ? 'checked' : ''}>${n}장</label>`).join('')}</div></label>
      <label class="field"><span>목표 기억률 (높을수록 자주 복습)</span><div class="opt">${[[0, '자동 (시험 30일 전부터 93%)'], [.85, '85%'], [.9, '90%'], [.95, '95%']].map(([v, t]) => `<label><input type="radio" name="rt" value="${v}" ${pref('retention', 0) === v ? 'checked' : ''}>${t}</label>`).join('')}</div></label>
      <label class="field"><span>하루 목표 시간</span><div class="opt">${[60, 120, 180, 240, 360, 480].map(n => `<label><input type="radio" name="gm" value="${n}" ${pref('goalMin', 120) === n ? 'checked' : ''}>${fmtMin(n)}</label>`).join('')}</div></label>
      <label class="field" style="margin:0"><span>읽어 주기 빠르기</span><div class="opt">${[.9, 1.05, 1.25, 1.5].map(n => `<label><input type="radio" name="tr" value="${n}" ${pref('ttsRate', 1.05) === n ? 'checked' : ''}>${n}배</label>`).join('')}</div></label></div>
    <div class="card"><h2>구글 클라이언트 ID</h2><p class="muted" style="margin-top:0">노벨리스트 설정에 넣은 것과 같은 ID를 쓰면 돼요(같은 주소 xoqls0720.github.io).</p>
      <div class="row"><input type="text" id="cid" class="grow" value="${esc(cfg.client)}" placeholder="…apps.googleusercontent.com"><button class="btn" id="csave">저장</button></div></div>
    <div class="card"><h2>진도</h2><p class="muted" style="margin-top:0">푼 문제 ${qn}개 · 외우는 카드 ${cn}장 · 읽은 강의 ${Object.values(prog.read).filter(r => r.on).length}개 · 앱에서 넣은 자료 ${Object.values(prog.my || {}).filter(m => !m.del).length}개</p>
      <div class="row"><button class="btn" id="psync" ${cfg.client ? '' : 'disabled'}>지금 기기끼리 맞추기</button><button class="btn" id="pull">자료 전부 받아 두기(오프라인)</button><button class="btn ghost" id="pexp">진도 내보내기</button><button class="btn ghost" id="pimp">가져오기</button></div></div>
    <p class="faint" style="text-align:center;margin-top:24px">${APP} · 자료와 진도는 내 기기와 내 드라이브에만 있어요</p></div>`);
  main_.querySelectorAll('[name=np]').forEach(r => r.onchange = () => setPref('newPerDay', +r.value));
  main_.querySelectorAll('[name=rt]').forEach(r => r.onchange = () => setPref('retention', +r.value));
  main_.querySelectorAll('[name=gm]').forEach(r => r.onchange = () => setPref('goalMin', +r.value));
  main_.querySelectorAll('[name=tr]').forEach(r => r.onchange = () => { setPref('ttsRate', +r.value); speak('이 빠르기로 읽어 드릴게요.'); });
  $('#s-local') && ($('#s-local').onclick = async () => { try { await Local.pick(); cfg.mode = 'local'; saveCfg(); state.units = {}; state.summ = {}; boot(); } catch (e) { if (e.name !== 'AbortError') toast(e.message); } });
  $('#s-drive').onclick = async () => {
    if (!cfg.client) return toast('구글 클라이언트 ID를 먼저 넣어 주세요');
    try { await GD.login(); cfg.mode = 'drive'; saveCfg(); GD.lists = {}; state.units = {}; state.summ = {}; await syncNow().catch(() => {}); boot(); } catch (e) { toast(e.message); }
  };
  $('#csave').onclick = () => { cfg.client = $('#cid').value.trim(); saveCfg(); toast('저장했어요'); viewSettings(); };
  $('#gsave').onclick = () => { store.set('gemKey', $('#gk').value.trim()); toast($('#gk').value.trim() ? 'Gemini 키를 저장했어요' : 'Gemini 키를 지웠어요'); viewSettings(); };
  $('#gtest').onclick = async () => {
    store.set('gemKey', $('#gk').value.trim());
    busy($('#gtest'), '확인 중…');
    try { const t = await gem('연결 확인이다. "연결됐어요"라고만 답해.', {temp: 0}); toast('Gemini: ' + t.trim().slice(0, 30)); viewSettings(); }
    catch (e) { toast(e.message); unbusy($('#gtest')); }
  };
  $('#psync').onclick = async () => { try { if (!GD.valid()) await GD.login(); await syncNow(); toast('맞췄어요'); viewSettings(); } catch (e) { toast(e.message); } };
  $('#pexp').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({prog, ink})], {type: 'application/json'})); a.download = `studium-${todayKey()}.json`; a.click(); };
  $('#pimp').onclick = () => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = '.json';
    i.onchange = async () => { try { const j = JSON.parse(await i.files[0].text()); prog = mergeProg(prog, j.prog || j); ink = mergeInk(ink, j.ink || {}); kvPut('ink', ink); state.subs = null; saveProg(); toast('가져왔어요'); viewSettings(); } catch { toast('파일을 읽지 못했어요'); } };
    i.click();
  };
  $('#pull').onclick = async () => {
    let n = 0; const all = allSubjects().flatMap(s => s.units.filter(u => u.ready).map(u => [s, u]));
    for (const [s, u] of all) { try { await loadUnit(s, u); } catch {} setSync(`받는 중 ${++n}/${all.length}`, true); }
    for (const s of allSubjects()) await loadSummary(s);
    setSync(''); toast(`${n}개 자료를 기기에 받아 뒀어요`);
  };
}
