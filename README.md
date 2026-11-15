# Studium — 태빈의 공부 앱 모음

혼자 공부하는 데 쓰는 웹 앱들. 전부 로그인 서버 없이 정적 파일로 돌고, 자료는 구글 드라이브(또는 PC 폴더)에서 읽는다.

| 앱 | 폴더 | 무엇을 하나 |
|---|---|---|
| **Studium** | `/` (저장소 뿌리) | 대학 공부 서재. 강의·책·영상·사진을 넣으면 기본서 노트·카드·문제·시험 대비가 만들어진다. 과목·마감·집중 타이머·간격 반복 복습. |
| **법무사 회독** | `beopmusa/` | Studium의 법무사 시험 특화판. 기출 지문 O·X·△ 회독, 조문 빈칸·판례 카드, 법령 개정 알림, D-day 역산 계획, 합격 로드맵. |
| **토익 990** | `toeic/` | 토익 독학 앱. claude.ai 아티팩트로 돌아가는 단일 페이지(이 폴더는 소스 보관용). 문제 생성·모의고사·오답노트·굿노트 내보내기. |

## 구조 (Studium · 법무사 회독)

- **앱**: 순수 HTML+JS (PWA, 서비스 워커 오프라인 캐시). 프레임워크 없음.
- **자료**: PC의 생성기가 강의·기출 파일을 정리해 구글 드라이브 폴더(`Studium` / `법무사 회독`)에 JSON으로 둔다. 앱은 그 폴더를 읽기만 한다.
  - `index.json` 과목·단원 목록 → `자료/<과목>/<단원>.json` 본문·카드·문제
  - 법무사: `기출/index.json`·`기출/<회차>.json`(문제·지문), `수집/`(법령 개정·판례·공고 — GitHub Actions 수집기가 채움)
- **진도**: 기기(localStorage·IndexedDB)에 저장하고, 구글 드라이브 앱 전용 칸(appDataFolder)으로 기기끼리 맞춘다. 손글씨·복습 기록 포함.
- **AI(선택)**: Gemini(무료 한도)·Claude·Groq·Ollama 키를 설정에 넣으면 해설·채점·새 문제·카드가 열린다. 키는 그 기기에만 저장된다.
- **자료 연결 방식 셋**: 구글 드라이브 / PC 폴더 직접 열기(File System Access) / `?src=주소` (serve.py 같은 정적 서버).

## 개발 메모

- 셸 파일을 바꾸면 `sw.js`의 `CACHE` 이름을 올린다 (Studium `studium-N`, 법무사 `beopmusa-N`).
- 로컬 점검: 저장소를 정적 서버로 띄우고 `index.html?src=<가짜 자료 주소>#/`로 연다. 가짜 자료는 위 JSON 구조만 맞추면 된다.
- `toeic/`은 `build.py`가 `src/app.html + src/data.js → index.html`로 합친다. 자세한 것은 `toeic/README.md`.

## 휴대폰·아이패드에 앱으로 깔기

| 앱 | 주소 |
|---|---|
| Studium (대학 공부) | https://xoqls0720.github.io/studium/ |
| 생각과 글 (LEET·논리·심리·서재·글쓰기·소설) | https://xoqls0720.github.io/studium/geul/ |
| 토익 990 | https://xoqls0720.github.io/studium/toeic/ |
| 법무사 | https://xoqls0720.github.io/studium/beopmusa/ |

- 아이폰·아이패드: Safari로 주소 열기 → 공유 → **홈 화면에 추가**. 안드로이드: Chrome → ⋮ → **앱 설치**.
- 오른쪽 아래 **구글에 저장 켜기**로 로그인하면 진도가 구글 드라이브 '앱 전용 칸'에 저장돼 기기끼리 이어진다(Studium과 같은 로그인).
- 문제 생성·첨삭 AI: **Claude · Gemini · Groq · OpenRouter · Ollama** 중에서 고른다(생각과 글·토익은 오른쪽 아래 **✦ AI**, Studium·법무사는 설정). 키는 같은 주소의 앱끼리 같이 쓰고, Studium에 키가 없으면 **노벨리스트에 넣어 둔 키**(nv.apiKey·gemKey·grKey·orKey)를 그대로 쓴다. claude.ai 아티팩트로 열면 Claude가 대신한다.
- LEET 기출·ETS 샘플은 저장소에 없다. 앱이 내 구글 드라이브의 `LEET기출_앱용.json`, 시험지 PDF, `ETS_LR_샘플시험지.pdf`를 직접 읽는다.
- `shim/claude.js`: claude.ai 밖에서 `window.claude`(저장·생성·내보내기)를 드라이브와 Gemini로 대신한다. 각 앱의 `artifact.html`은 claude.ai용, `index.html`은 홈 화면 앱용.

## 진짜 앱 (아이폰·아이패드·안드로이드) — `app/`

네 앱(Studium·생각과 글·토익·법무사)을 하나로 묶은 **Studium** 앱. 아래쪽 탭으로 오가고, 웹 파일을 앱 안에 담아 인터넷 없이도 바로 열린다.

- `main`에 올리면 깃허브 Actions(`.github/workflows/app.yml`)가 맥 서버에서 **Studium.ipa**(서명 없음), 리눅스에서 **Studium.apk**를 만들어 릴리스에 올리고 `altstore.json`을 갱신한다.
- **아이폰·아이패드(무료)**: 윈도우 PC에 AltServer(+애플 iTunes·iCloud) 설치 → AltStore를 기기에 설치 → AltStore › Sources › `https://xoqls0720.github.io/studium/altstore.json` 추가 → Studium 설치. 무료 애플 ID는 7일마다 다시 서명해야 하는데, PC에서 AltServer가 켜져 있고 같은 와이파이면 AltStore가 백그라운드에서 알아서 갱신한다. 새 빌드가 나오면 AltStore에 업데이트가 뜬다.
- **안드로이드**: 릴리스의 Studium.apk를 받아 설치.
- **구글 로그인(한 번만 설정)**: 구글이 앱 속 화면 로그인을 막아서, 앱은 시스템 브라우저로 로그인한 뒤 `auth.html`을 거쳐 `studium://auth`로 돌아온다. Google Cloud 콘솔 › API 및 서비스 › 사용자 인증 정보 › (웹 클라이언트 ID) › **승인된 리디렉션 URI**에 `https://xoqls0720.github.io/studium/auth.html` 을 추가해야 한다.
- 로컬에서: `cd app && npm install && npm run sync` 후 `npx cap open ios`(맥) / `npx cap open android`.
