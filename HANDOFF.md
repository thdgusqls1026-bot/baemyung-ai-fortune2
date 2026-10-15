# 배명고 AI연구반 ‘AI 운세 영수증’ — 타 AI/개발자 인수인계서

작성 기준: 2026-10-14 / 현재 저장된 프로젝트 파일과 테스트 결과를 직접 확인한 내용

## 0. 한눈에 보는 현재 상태

이 프로젝트는 **학교 축제용 모바일 웹사이트**다. 참가자가 영수증사진기 PRO+에서 사진을 찍어 출력한 뒤, 인쇄물의 **고정 URL QR**로 웹사이트에 접속한다. 휴대폰으로 출력물을 다시 촬영해 업로드하고 **연애운 / 친구 궁합 / 오늘의 행운** 중 하나를 고르면, 서버가 **Anthropic Claude 이미지 입력 API**에 사진과 선택 항목을 보내 짧은 한국어 **오락용 운세 텍스트**를 생성한다. 결과는 웹페이지에서 확인하고 공유한다.

**중요한 범위 제한**
- AI **이미지 생성·애니메이션·웹툰 변환은 최종 기획에서 삭제**했다. 다시 추가하지 말 것.
- 사진 업로드는 필요하지만 사진을 저장하지 않는다(프로젝트 자체의 디스크/DB 기준). 사진은 Claude 제공자로 전송된다.
- 일회용 QR·코드 인증/사진기 촬영별 자동 연동도 최종 기획에서 **삭제**했다. PRO+는 **고정 URL QR**만 사용한다.
- **진짜 영수증사진인지를 인증하지 않는다.** 일반 사진도 올릴 수 있으며, 웹사이트 주소를 아는 사람은 누구나 접속 가능하다. 이것을 인증된 시스템으로 소개하면 안 된다.
- 운세는 **미리 정한 랜덤 문구가 아니라 Claude가 매 요청마다 텍스트를 생성**한다. AI가 실제 미래나 성격을 판별한다는 홍보는 금지.
- **행운숫자 이벤트(2026-10-14 추가):** 같은 Claude 호출에서 사진의 창의성을 구도·아이디어·표현·재미 각 0~25점으로 채점하고 합계(0~100)가 **행운숫자**다. 기기당 첫 점수만 순위에 기록하고(재뽑기는 운세만 새로 나옴), 이벤트 종료 후 운영자 화면 `/admin`에서 순위를 보고 상품을 준다. 점수는 외모가 아니라 포즈·소품·구도·아이디어만 평가하도록 프롬프트로 제한했다. 순위에는 사진·이름을 저장하지 않는다. 결정 사항: 행운숫자 = 점수 자체(동점 구분과 수상 확인용으로 4자리 **확인 코드**를 함께 발급), 기기당 1회, 저장은 Railway Volume의 파일.
- 문구는 모두 **존댓말**(해요체/합니다체)이다. 새 문구와 Claude 프롬프트도 반말로 쓰지 말 것.

## 1. 사용자·기기·프로젝트 배경

- 학교 및 운영: **배명고등학교 AI연구반** / 학교 축제
- 기획 담당 학생: 현빈, 구현 작업 인수 지원: 효진 (대화에서 알려준 호칭)
- 사용 장비: **브리프컴퍼니 영수증사진기® PRO+**; 삼성 11인치 태블릿 및 브라더 300DPI/62mm 라벨 프린터
- 제조사 챗봇 답변에 따르면: PRO+는 자체 QR URL 연결이 가능하나, 촬영마다 다른 일회용 QR/코드 발급, 외부 API·웹훅·촬영 완료 이벤트 연동은 제공되지 않음. QR 원본 다운로드 기능은 별도 옵션이고 여기서는 사용하지 않음.
- PRO+ 고정 QR은 **프로젝트가 Railway에 배포된 뒤 받은 진짜 HTTPS 공개 URL**로 설정해야 함. 배포 전에는 접속 가능한 실사용 QR을 만들 수 없음.
- 축제까지 일정이 촉박하므로 유지보수·운영 간소화가 우선.

## 2. 확정된 서비스 플로우와 UI

1. **영수증사진기에서 촬영 → 종이 영수증사진 출력** (PRO+ 기기 기능)
2. 출력된 종이의 **고정 QR 스캔 → 자체 모바일 사이트 진입**
3. **STEP 01: 사진 올리기** — 카메라 촬영 또는 앨범에서 선택, 미리보기, 다른 사진으로 교체
4. **STEP 02: 운세 고르기** — 연애운(`love`), 친구 궁합(`friend`), 오늘의 행운(`luck`); 사진 처리 동의 체크. 사진이 없거나 미동의면 AI 운세 버튼 비활성화
5. **STEP 03: 결과 확인** — Claude가 업로드 사진의 **가시적인 구도/연출 분위기만** 참고한 짧은 오락용 한국어 문구 생성; 재뽑기 및 결과 공유

시각 스타일: 모바일 우선, 어두운 보라 계열과 분홍/노랑 포인트, 영수증 모양 결과 카드, 배명고등학교 AI연구반 명칭.

## 3. 실제 프로젝트 파일 — 이 문서와 같은 폴더

```text
baemyung-ai-fortune/
├── public/
│   ├── index.html        # 3단계 UI, 동의 안내, 결과 카드
│   ├── style.css         # 반응형 스타일 (행운숫자 블록·관리자 표 포함)
│   ├── app.js            # 이미지 리사이즈/압축, API 호출, 결과·행운숫자 표시·공유, 기기 ID(localStorage)
│   ├── admin.html        # 운영자 순위 화면 (/admin)
│   └── admin.js          # 비밀번호 로그인, 순위 표, CSV 저장, 저장소 경고
├── server.mjs            # Node.js 22+ HTTP 서버, Claude API 프록시, 요청 검증·한도, 관리자 API
├── ranking.mjs           # 점수 줄 파싱(extractScore), 순위 정렬(동점 규칙), JSONL 파일 저장소
├── package.json          # npm start, npm test / 외부 npm 패키지 없음
├── .env.example          # 환경변수 이름만 제공; 진짜 키 입력 금지
├── .gitignore            # .env 등 제외
├── scripts/make_qr.py    # 실제 배포 URL로 고정 QR 생성
├── scripts/make_package.ps1  # 원터치 Windows 압축 파일 빌드 → dist/AI운세영수증-원터치.zip (README 7장)
├── scripts/package/      # 압축에 들어가는 런처: 시작하기.bat(ASCII), start.ps1, 읽어주세요.txt
├── dist/                 # 빌드 결과(gitignore). 포터블 Node(node.exe) 포함 약 32MB
├── test/
│   ├── app.test.mjs      # 서버 API mock 테스트 13개 (행운숫자·기기당 1회·동시 요청·관리자·재시작 후 유지 포함)
│   └── fixture.jpg       # 테스트용 작은 JPEG
├── README.md             # 설치/배포 설명
├── HANDOFF.md            # 현재 인수인계 문서
└── PROMPT_FOR_NEXT_AI.md # 다음 AI에 복사해 붙여넣을 작업 지시문
```

**다른 AI는 반드시 추측으로 새 프로젝트를 재작성하지 말고, 위 실제 파일들을 먼저 읽어야 한다.**

## 4. 기술 구조 및 API 계약

### 환경·기술
- Node.js **22 이상**, 네이티브 `node:http` 기반 `server.mjs`
- 별도 npm 런타임 라이브러리 **없음** (`npm install` 불필요)
- 브라우저 HTML/CSS/JS, 반응형 모바일 UI
- Claude Messages API: `POST https://api.anthropic.com/v1/messages`
- 모델 기본값: `claude-haiku-5-5` (실제 API 계정에서 지원·권한·가격 확인 필요)
- 서버는 키를 `ANTHROPIC_API_KEY` 환경변수에서만 읽음. 프런트엔드에 키를 넣지 말 것.

### 엔드포인트
- `GET /` — 사이트
- `GET /api/health` — `{ok:true, apiConfigured:boolean}`; `true`라도 실제 API 호출 성공을 뜻하지 않음
- `POST /api/fortune` — 사진+동의+유형+기기 ID를 받고 Claude에 요청
- `GET /admin` — 운영자 순위 화면 (`ADMIN_PASSWORD`가 8자 미만이면 API가 503)
- `POST /api/admin/ranking` — 본문 `{"password": "..."}`; 맞으면 순위·저장소 상태 반환, 틀리면 401, 같은 IP에서 15분에 10회 틀리면 429

요청(JSON) 예시:
```json
{
  "imageData": "data:image/jpeg;base64,<BASE64_JPEG>",
  "fortuneType": "love",
  "consent": true,
  "deviceId": "<브라우저가 만든 16~64자 [A-Za-z0-9_-] 무작위 값>"
}
```

정상 응답 형태:
```json
{
  "fortuneType": "love",
  "fortuneLabel": "연애운",
  "result": "제목: 🍀 ...\n운세: 문장1\n문장2\n문장3\n행운의 아이템: 🎧 ...\n오늘의 미션: ...",
  "luckyNumber": 79,
  "entryCode": "K7M2",
  "counted": true
}
```
- Claude는 마지막에 `창의성: 구도=NN, 아이디어=NN, 표현=NN, 재미=NN` 줄을 출력하고, 서버가 이 줄을 `result`에서 **제거**한 뒤 합산한다. 줄이 없거나 숫자가 0~25를 벗어나면 `luckyNumber`/`entryCode`는 `null`이고 그 기기의 참가 기회는 소모되지 않는다.
- 결과 카드(인스타 감성, 2026-10-14): 프런트(`public/app.js`의 `parseFortune`/`renderFortune`)가 위 라벨 줄을 파싱해 제목·3줄 본문·행운의 아이템(앞의 이모지 추출)·미션으로 그린다. 라벨이 없거나 파싱에 실패하면 원문을 그대로 보여 주고, 구버전 라벨 `행운 포인트`도 받아 준다. 공유 문구(`buildShareText`)도 같은 구조로 만들며 확인 코드는 넣지 않는다. 모든 표시는 `textContent`라 HTML이 섞여도 실행되지 않는다.
- **`max_tokens`는 4000이어야 한다.** Haiku 5.5는 기본으로 thinking이 켜져 있고 그 토큰이 `max_tokens`에 포함된다. 850일 때는 10번 중 6~7번이 잘리거나 빈 응답이었다(`stop_reason: "max_tokens"`). 4000으로 올린 뒤 16번 모두 정상이었고 thinking은 최대 약 730토큰이었다. 서버는 `stop_reason === "max_tokens"`이면 화면에 내보내지 않고 502로 처리하며 그 기기의 참가 기회는 소모하지 않는다. 프롬프트를 길게 바꾸면 thinking도 늘 수 있으니 바꾼 뒤에는 실제 호출로 `stop_reason`을 확인할 것.
- `counted`: 이번 요청이 순위에 기록되었는지. 이미 참가한 기기는 `false`이며 첫 기록의 `luckyNumber`/`entryCode`가 그대로 돌아온다.
- 순위 저장: `DATA_DIR/entries.jsonl`(추가 전용). 항목은 `code, device(해시), score, parts, type, at`만 저장. 순위 정렬은 점수 → 아이디어 → 표현 → 구도 → 재미 → 먼저 제출한 순.
- 같은 기기의 동시 요청은 `reserve()`로 막아 한 건만 기록된다.

오류는 HTTP 4xx/5xx 및 `{ "error": "사용자에게 표시할 문구" }` 형식.

### 요청 및 보안 한계
- 클라이언트가 이미지를 최대 변 1000px JPEG로 바꿔 보내고, 서버는 JPEG 시그니처와 요청 크기 제한을 적용한다.
- `Content-Security-Policy` 등 기본 헤더, `Origin` 검사, 사진 처리 동의, 요청 한도 적용.
- `DAILY_API_LIMIT` 및 `IP_LIMIT_PER_15MIN`은 **프로세스 메모리 기반**. 서버 재시작·멀티 인스턴스 배포 시 한도가 초기화/분산됨. 확실한 지출 상한이 아님.
- 이미지 디코딩을 통한 완전한 안전성 검사는 구현하지 않았다. 사용자 사진을 외부 Claude 서비스로 전달하므로 개인정보·업체 보관 정책을 학교 운영진과 검토할 것.
- 학교 Wi-Fi/NAT 환경에서는 여러 학생이 같은 네트워크 IP를 공유할 수 있다. 현장 호출 제한 테스트가 필요하다.
- API 비용이 발생하므로 요금·사용 가능 계정·크레딧 잔액을 확인해야 한다. **Claude 유료 앱 구독은 API 키/크레딧과 별도일 수 있다.**

## 5. 재현 방법

```bash
# 이 프로젝트 폴더에서
node --version             # >=22
cp .env.example .env       # Windows에서는 파일 복사 방식 사용
# .env 파일의 ANTHROPIC_API_KEY에 본인의 유효한 키 입력 (공개 금지)
npm start
# http://localhost:3000 접속
# http://localhost:3000/api/health 확인
npm test
```

실제로 지정해야 할 환경변수:

| 이름 | 값/용도 |
|---|---|
| `ANTHROPIC_API_KEY` | 필수, Railway Variables의 비밀 값 |
| `ANTHROPIC_MODEL` | 기본 `claude-haiku-5-5` |
| `PORT` | 로컬 기본 3000, Railway에서 주입하는 값 사용 |
| `DAILY_API_LIMIT` | 단일 인스턴스/메모리 기준 예: 200 |
| `IP_LIMIT_PER_15MIN` | 단일 인스턴스 IP별 15분 기준 예: 200 |
| `DATA_DIR` | 순위 저장 폴더(선택). 미설정이면 Railway가 주는 `RAILWAY_VOLUME_MOUNT_PATH`를, 그것도 없으면 `./data`를 쓴다(재배포하면 사라질 수 있어 `/admin`에 경고 표시) |
| `TRUST_PROXY_HEADER` | `x-real-ip`로 두면 `X-Real-IP` 헤더를 접속자 IP로 신뢰. Railway에서는 `RAILWAY_ENVIRONMENT_NAME`/`RAILWAY_PROJECT_ID`가 있으면 자동으로 켜짐. 로컬에서는 꺼져 있어 헤더 조작이 통하지 않음 |
| `ADMIN_PASSWORD` | `/admin` 비밀번호, 8자 이상. 비우면 관리자 기능 비활성 |

API 키를 이 문서나 대화, GitHub에 직접 적지 않는다.

## 6. 테스트한 것과 **아직 안 한 것**

- **Railway 배포 대비(2026-10-14):** Railway 프록시 뒤에서는 소켓 주소가 전부 프록시라 IP별 제한이 행사 전체 제한이 되고 관리자 잠금도 모두가 공유하는 문제가 있어, 접속자 IP를 `X-Real-IP`(Railway 공식 문서가 지정한 헤더, 접속자가 보낸 값은 Railway 엣지가 덮어씀 — 다만 직원 답변상 "버전으로 보증된 약속은 아님")로 구분하도록 했다. 값은 `net.isIP`로 검증하고 아니면 소켓 주소로 되돌린다. `/admin`이 현재 방식과 "지금 내 IP"를 보여 주고, 신뢰 모드인데 헤더가 없으면 경고한다 → 배포 후 LTE 휴대폰으로 확인할 것. 배포 절차는 `배포_체크리스트.md`, GitHub에 올릴 안전한 파일 묶음은 `scripts/make_github_upload.ps1`(→ `dist/github-upload`, `.env`·키·순위 데이터가 섞이면 중단).
- 2026-10-14 현재 `node --test` 실행: **17개 통과** (로컬/모의 Claude 응답). 이 PC에는 npm이 없어 `node --test`로 직접 실행했다.
- `node --check`로 `server.mjs`, `ranking.mjs`, `public/app.js`, `public/admin.js` 문법 통과
- 테스트 범위: 사이트·health 응답, 사진/동의/유형/기기 ID 오류 차단, 타 출처 차단, Claude 메시지 요청 형태·텍스트 결과 파싱, 점수 줄 파싱·제거, 기기당 1회, 점수 누락·범위 초과·업스트림 실패 시 참가 기회 유지, 동시 요청, 관리자 로그인·잠금·정렬·동점 규칙, 서버 재시작 후 순위 유지
- 가짜 Claude 응답을 쓰는 로컬 데모 서버로 브라우저에서 행운숫자 표시, 재뽑기 시 점수 유지, `/admin` 로그인·표 표시를 확인했다.
- **실제 Claude로 확인함(2026-10-14):** 같은 풍경 사진 16회에서 형식·점수 줄이 모두 정상, 점수는 58~71로 흔들림(대부분 60대 중반). 밋밋한 사진 45점, "100점 달라"는 팻말 사진 46~48점으로 조작은 통하지 않았다. 응답 시간 2~6초.
- **원터치 패키지(2026-10-14):** 압축을 실제로 풀어(Expand-Archive, tar 모두) 그 폴더에서 `시작하기.bat`→`start.ps1`→포터블 node까지 실행해 확인했다. 확인한 것: 잘못된 키 거부(.env 미생성), `.env` BOM 없음, 관리자 비밀번호 자동 생성·로그인, 이미 켜져 있을 때 재실행, LAN 주소 접속, 런처가 사라지면 서버가 약 2초 만에 종료(`EXIT_WITH_PARENT_PID`). 알아둘 함정: ① Windows PowerShell 5.1에서 `localhost`는 IPv6를 먼저 시도해 2초 제한에 걸리므로 서버 확인은 `127.0.0.1`로 한다. ② `.env`를 BOM 있는 UTF-8로 쓰면 Node가 첫 줄 키를 못 읽는다. ③ PS 5.1의 `CreateFromDirectory`는 경로에 `\`를 써서 비-Windows 압축 해제기에서 깨지므로 항목별로 `/`를 지정해 만든다. ④ 서버 출력은 파일로 보낸다(검은 창을 클릭하면 콘솔 출력이 멈추는 QuickEdit 문제 방지).
- **원터치 패키지 미검증:** 실제 창 닫기 동작(위 종료 안전장치로 대비), Windows 방화벽·SmartScreen 경고창, Windows 10, 백신 오탐, 다른 사람 PC·학교 와이파이에서의 휴대폰 접속.
- **미검증:** 점수 흔들림이 비슷한 수준의 사진 순위에 미치는 영향(상위권은 운영자가 실물 영수증으로 최종 확인 권장), Railway Volume에서의 실제 영속성, 모바일 실기기,
- **미검증(기존):** 실제 Anthropic API 키를 사용한 성공 응답, `claude-haiku-5-5` 모델 사용 가능 여부, API 요청 파라미터 `output_config` 지원 여부, 실제 비용·응답 시간·혼잡, Railway 배포 성공, 실물 PRO+ QR 출력/스캔, 실제 iOS/Android 모바일 테스트
- **미완료:** GitHub 업로드, Railway 공개 URL, 기기 QR URL 등록, 운영자 비용 한도 설정, 개인정보 동의 정책 확인

## 7. 다음 AI가 우선 수행해야 할 작업 (우선순위)

1. **원본 파일 검토:** `server.mjs`, `public/app.js`, `public/index.html`, `README.md` 읽고 기획 범위 확인. AI 이미지 생성/일회용 인증을 다시 넣지 말 것.
2. **실제 Anthropic 연동 검증:** 계정에 접근 권한이 생기면 `claude-haiku-5-5`, `output_config`, 메시지 이미지 payload 등 공식 API 호환성을 검증하고 필요한 경우 최소한만 수정. 키는 서버 환경변수에만 저장.
3. **오류·비용·프라이버시 개선:** 현장 사용량 한도, 오류 재시도, 동시 요청, 이미지 로딩 실패, 저사양 모바일 지원 점검. 영수증사진을 영구 저장하지 말 것.
4. **배포:** GitHub 업로드 → Railway GitHub Deploy → Variables 설정 → Public Networking에서 HTTPS 도메인 생성 → `/api/health` 확인.
5. **QR 제작:** *그때* `python scripts/make_qr.py https://실제-도메인` 실행. 결과 `site-qr.png`를 PRO+ 앱의 QR URL 연결 설정과 비교 검증. 샘플 URL을 실제 QR로 착각하지 말 것.
6. **현장 QA:** 카메라 업로드, 친구 2인 이상 사진, 동의 체크, 연애/친구/행운 결과, 재뽑기, 복사/공유, 사진 변경, 동시 접속, 학교 Wi-Fi 속도, 출력 62mm QR 인쇄·스캔.

## 8. 합격 기준(Definition of Done)

- 참가자가 PRO+ 출력물의 QR을 스캔해 외부 휴대폰에서 HTTPS로 접속 가능.
- 사진 업로드/미리보기, 사진 없는 경우 운세 생성 차단, 동의 필수 동작 정상.
- 세 운세 모두 실제 Claude가 **사진을 참고해 한국어 텍스트**를 생성하고, 에러 시 학생에게 이해 가능한 안내 표시.
- **AI 그림 생성 기능·엄격한 인증 기능이 존재하지 않아야 함.**
- API 키가 브라우저/저장소/배포 로그에 노출되지 않음.
- 운영자와 학교가 학생 사진 처리·AI 외부 전송과 비용 정책을 승인.
- 실제 디바이스/인쇄물 QR과 Railway 사이트를 통합 테스트해 통과.

## 9. 공식 참고 링크

- Claude Haiku 모델: https://platform.claude.com/docs/en/models/overview
- Claude Vision: https://platform.claude.com/docs/en/build-with-claude/vision
- Claude API: https://platform.claude.com/docs/en/api/messages
- Railway Networking: https://docs.railway.com/networking/public-networking
- PRO+ 업체 제품: https://briefcompany.net/objet/pro-plus/

> 개발 작업을 이어받는 AI는 `PROMPT_FOR_NEXT_AI.md`를 첫 메시지로 받아도 되지만, **정확한 코드 분석에는 ZIP 프로젝트 파일 전체를 함께 전달**받아야 한다.
