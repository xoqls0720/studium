'use strict';
// ── 설정 ────────────────────────────────────────────────────────
function viewSettings() {
  frame('설정');
  const qn = Object.keys(prog.q).length, cn = Object.keys(prog.srs).filter(k => k.startsWith('c:')).length;
  const on = cfg.mode === 'drive' && GD.valid(), t = lastSync ? new Date(lastSync) : null;
  const acct = cfg.mode === 'drive'
    ? `<p class="muted" style="margin-top:0">${on ? `연결됨 · 진도·필기·Gemini 키가 기기끼리 저절로 맞춰져요${t ? ` · 마지막 ${pad2(t.getHours())}:${pad2(t.getMinutes())}` : ''}` : '로그인이 끊겼어요. 화면을 한 번 누르면 이어지고, 안 되면 아래 버튼을 눌러 주세요.'}</p>
      <div class="row">${on ? '<button class="btn" id="psync">지금 맞추기</button>' : '<button class="btn pri" id="gstart">다시 연결</button>'}<button class="btn ghost" id="gout">연결 끊기</button></div>`
    : `<p class="muted" style="margin-top:0">${cfg.mode === 'local' ? '지금은 내 컴퓨터 폴더로 보고 있어요. ' : cfg.mode === 'url' ? 'PC 바로 보기(' + esc(urlSrc) + ')로 보고 있어요. ' : ''}구글로 시작하면 PC가 정리한 자료가 들어오고 모든 기기가 저절로 맞춰져요.</p>
      <div class="row"><button class="btn pri" id="gstart">구글로 시작하기</button></div>`;
  render(`<div class="narrow"><section class="hero" style="margin-bottom:22px"><div class="eyebrow">설정</div><h2 class="display">설정</h2></section>
    <div class="card"><h2>구글 계정</h2>${acct}</div>
    <div class="card ai"><div class="ai-head"><div class="mark">${ic('spark', 18)}</div><div class="grow"><b>AI</b><div class="faint">자료 정리, 질문·튜터, 서술형 채점, 새 문제·카드, 팟캐스트, 마인드맵, 약점 분석</div></div>${aiOn() ? `<span class="tag ok">${aiName()} 켜짐</span>` : ''}</div>
      <label class="field"><span>어떤 AI를 쓸까요</span><div class="opt">${[['gemini', 'Gemini · 무료 한도'], ['groq', 'Groq · 무료 한도'], ['ollama', 'Ollama · 내 컴퓨터 공짜'], ['claude', 'Claude · 유료']].map(([v, t]) => `<label><input type="radio" name="prov" value="${v}" ${aiProv() === v ? 'checked' : ''}>${t}</label>`).join('')}</div></label>
      ${aiProv() === 'gemini' ? `<label class="field"><span>Gemini API 키 · 한 기기에서 넣으면 내 다른 기기에도 들어가요</span><div class="row"><input type="password" id="gk" class="grow" value="${esc(gemKey())}" placeholder="AIza…" autocomplete="off"></div></label>
        <p class="faint">Google AI Studio(aistudio.google.com)의 'Get API key'에서 무료로 받아요(하루 한도 안에서 공짜). 키는 내 구글 드라이브의 이 앱 전용 칸에 진도와 함께 두고, 다른 사람이나 다른 앱은 볼 수 없어요.</p>` : ''}
      ${aiProv() === 'claude' ? `<label class="field"><span>Claude API 키 · 이 기기에만 저장돼요</span><div class="row"><input type="password" id="ck" class="grow" value="${esc(aiKey('claude'))}" placeholder="sk-ant-…" autocomplete="off"></div></label>
        <label class="field"><span>모델 · 비워 두면 가장 싼 claude-haiku-5-5</span><div class="row"><input type="text" id="ckm" class="grow" value="${esc(store.get('ckModel', ''))}" placeholder="claude-haiku-5-5"></div></label>
        <p class="faint">console.anthropic.com → API Keys. Claude는 쓴 만큼 돈이 나가요 — 무료로 쓰려면 Gemini·Groq(무료 한도)나 Ollama(내 컴퓨터)를 고르세요.</p>` : ''}
      ${aiProv() === 'groq' ? `<label class="field"><span>Groq API 키 · 이 기기에만 저장돼요</span><div class="row"><input type="password" id="gr" class="grow" value="${esc(aiKey('groq'))}" placeholder="gsk_…" autocomplete="off"></div></label>
        <label class="field"><span>모델 · 비워 두면 llama-3.3-70b-versatile (사진은 llama-4-scout로 알아서)</span><div class="row"><input type="text" id="grm" class="grow" value="${esc(store.get('grModel', ''))}" placeholder="llama-3.3-70b-versatile"></div></label>
        <p class="faint">console.groq.com → API Keys에서 무료로 받아요. 무료 한도(분·하루 요청 제한) 안에서 공짜고, 속도가 아주 빨라요.</p>` : ''}
      ${aiProv() === 'ollama' ? `<label class="field"><span>주소 · 비워 두면 이 컴퓨터(localhost:11434)</span><div class="row"><input type="text" id="olu" class="grow" value="${esc(store.get('olUrl', ''))}" placeholder="http://localhost:11434"></div></label>
        <label class="field"><span>모델 · 비워 두면 exaone3.5:7.8b (한국어에 강해요)</span><div class="row"><input type="text" id="olm" class="grow" value="${esc(store.get('olModel', ''))}" placeholder="exaone3.5:7.8b"></div></label>
        <p class="faint">완전 공짜(내 컴퓨터에서 돌아요). ollama.com에서 설치하고 명령 창에서 <code>ollama pull exaone3.5:7.8b</code> 한 번. 폰·아이패드에서 쓰려면 PC 주소(예: http://192.168.0.x:11434)를 넣고, PC에서 OLLAMA_HOST=0.0.0.0, OLLAMA_ORIGINS=* 환경 변수를 켜 두세요.</p>` : ''}
      <div class="row"><button class="btn" id="gsave">저장</button><button class="btn gem" id="gtest">연결 확인</button></div>
      <p class="faint" style="margin:10px 0 0">파일 정리(자료 넣기)와 팟캐스트 음성은 Gemini에만 있는 기능이라, 다른 AI를 골라도 Gemini 키가 있으면 그 일만 Gemini로 해요.</p></div>
    <div class="card"><h2>공부 방식</h2>
      <label class="field"><span>하루 새 카드</span><div class="opt">${[10, 20, 30, 50].map(n => `<label><input type="radio" name="np" value="${n}" ${pref('newPerDay', 20) === n ? 'checked' : ''}>${n}장</label>`).join('')}</div></label>
      <label class="field"><span>목표 기억률 (높을수록 자주 복습)</span><div class="opt">${[[0, '자동 (시험 30일 전부터 93%)'], [.85, '85%'], [.9, '90%'], [.95, '95%']].map(([v, t]) => `<label><input type="radio" name="rt" value="${v}" ${pref('retention', 0) === v ? 'checked' : ''}>${t}</label>`).join('')}</div></label>
      <label class="field"><span>쉬는 요일 · 복습 날짜를 이 요일에 잡지 않아요 (복습은 덜 몰린 날로 고르게 나눠요)</span><div class="opt">${'일월화수목금토'.split('').map((t, i) => `<label><input type="checkbox" name="rd" value="${i}" ${pref('restDays', []).includes(i) ? 'checked' : ''}>${t}</label>`).join('')}</div></label>
      <div class="field"><span>복습 간격 맞추기 · 내 기록으로 '언제 잊는지'를 다시 계산해요 (Anki의 최적화)</span><div class="row"><span class="grow muted" id="fitst">${fitStatus()}</span><button class="btn" id="fitgo" ${fitCount() < FIT_MIN && !GD.valid() ? 'disabled' : ''}>맞추기</button>${prog.pref.fsrsW?.v ? '<button class="btn ghost" id="fitoff">기본값으로</button>' : ''}</div></div>
      <label class="field"><span>하루 목표 시간</span><div class="opt">${[60, 120, 180, 240, 360, 480].map(n => `<label><input type="radio" name="gm" value="${n}" ${pref('goalMin', 120) === n ? 'checked' : ''}>${fmtMin(n)}</label>`).join('')}</div></label>
      <label class="field" style="margin:0"><span>읽어 주기 빠르기</span><div class="opt">${[.9, 1.05, 1.25, 1.5].map(n => `<label><input type="radio" name="tr" value="${n}" ${pref('ttsRate', 1.05) === n ? 'checked' : ''}>${n}배</label>`).join('')}</div></label></div>
    <details class="card"${cfg.client ? '' : ' open'}><summary><b>고급</b></summary>
      <p class="muted">푼 문제 ${qn}개 · 외우는 카드 ${cn}장 · 읽은 강의 ${Object.values(prog.read).filter(r => r.on).length}개 · 앱에서 넣은 자료 ${Object.values(prog.my || {}).filter(m => !m.del).length}개</p>
      <div class="row"><button class="btn" id="pull">자료 전부 받아 두기(오프라인)</button><button class="btn ghost" id="pexp">진도 내보내기</button><button class="btn ghost" id="pimp">가져오기</button>${'showDirectoryPicker' in window ? '<button class="btn ghost" id="s-local">내 컴퓨터 폴더로 열기</button>' : ''}</div>
      <label class="field" style="margin:16px 0 0"><span>구글 클라이언트 ID${CLIENT_ID ? ' · 앱에 들어 있어요' : ' · 노벨리스트에 넣은 것과 같은 ID'}</span><div class="row"><input type="text" id="cid" class="grow" value="${esc(cfg.client)}" placeholder="…apps.googleusercontent.com"><button class="btn" id="csave">저장</button></div></label></details>
    <p class="faint" style="text-align:center;margin-top:24px">${APP} · 자료와 진도는 내 기기와 내 드라이브에만 있어요</p></div>`);
  main_.querySelectorAll('[name=np]').forEach(r => r.onchange = () => setPref('newPerDay', +r.value));
  main_.querySelectorAll('[name=rt]').forEach(r => r.onchange = () => setPref('retention', +r.value));
  main_.querySelectorAll('[name=rd]').forEach(r => r.onchange = () => { setPref('restDays', [...main_.querySelectorAll('[name=rd]:checked')].map(x => +x.value)); loadMap = null; });
  $('#fitgo').onclick = async () => {
    busy($('#fitgo'), '계산 중…');
    try {
      const r = await fitFsrs(p => { const el = $('#fitst'); if (el) el.textContent = `계산 중… ${Math.round(p * 100)}%`; });
      toast(r.used ? `내 기록에 맞췄어요 · 예측 오차 ${Math.round((1 - r.fit / r.base) * 100)}% 줄었어요` : '지금 값이 더 잘 맞아서 그대로 둬요');
      viewSettings();
    } catch (e) { toast(e.message); unbusy($('#fitgo')); $('#fitst') && ($('#fitst').textContent = fitStatus()); }
  };
  $('#fitoff') && ($('#fitoff').onclick = () => { setPref('fsrsW', null); toast('기본값으로 돌렸어요'); viewSettings(); });
  main_.querySelectorAll('[name=gm]').forEach(r => r.onchange = () => setPref('goalMin', +r.value));
  main_.querySelectorAll('[name=tr]').forEach(r => r.onchange = () => { setPref('ttsRate', +r.value); speak('이 빠르기로 읽어 드릴게요.'); });
  $('#s-local') && ($('#s-local').onclick = async () => { try { await Local.pick(); cfg.mode = 'local'; saveCfg(); state.units = {}; state.summ = {}; boot(); } catch (e) { if (e.name !== 'AbortError') toast(e.message); } });
  $('#gstart') && ($('#gstart').onclick = () => cfg.client ? startGoogle() : ($('#cid').focus(), toast('고급에 구글 클라이언트 ID를 먼저 넣어 주세요')));
  $('#gout') && ($('#gout').onclick = () => { cfg.mode = ''; saveCfg(); GD.tok = null; store.set('tok', null); state.offline = null; toast('연결을 끊었어요. 이 기기의 진도는 그대로 있어요'); boot(); viewSettings(); });
  $('#csave').onclick = () => { cfg.client = $('#cid').value.trim(); saveCfg(); toast('저장했어요'); viewSettings(); };
  const setKey = k => { store.set('gemKey', k); setPref('gemKey', k); };   // Gemini 키만 기기끼리 맞춘다
  const saveAi = () => {
    if ($('#gk')) setKey($('#gk').value.trim());
    for (const [id, k] of [['#ck', 'ckKey'], ['#ckm', 'ckModel'], ['#gr', 'grKey'], ['#grm', 'grModel'], ['#olu', 'olUrl'], ['#olm', 'olModel']]) if ($(id)) store.set(k, $(id).value.trim());
  };
  main_.querySelectorAll('[name=prov]').forEach(r => r.onchange = () => { saveAi(); store.set('aiProv', r.value); viewSettings(); });
  $('#gsave').onclick = () => { saveAi(); toast('저장했어요'); viewSettings(); };
  $('#gtest').onclick = async () => {
    saveAi();
    busy($('#gtest'), '확인 중…');
    try { const t = await gem('연결 확인이다. "연결됐어요"라고만 답해.', {temp: 0}); toast(aiName() + ': ' + String(t).trim().slice(0, 30)); viewSettings(); }
    catch (e) { toast(e.message); unbusy($('#gtest')); }
  };
  $('#psync') && ($('#psync').onclick = async () => { try { await syncNow(); toast('맞췄어요'); viewSettings(); } catch (e) { toast(e.message); } });
  $('#pexp').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({prog: {...prog, pref: Object.fromEntries(Object.entries(prog.pref).filter(([k]) => k !== 'gemKey'))}, ink})], {type: 'application/json'})); a.download = `studium-${todayKey()}.json`; a.click(); };
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
