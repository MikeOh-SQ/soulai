# soul.ai.kr

ADHD 선별/감별 보조를 위한 모바일 웹 앱 프로토타입입니다. 현재 흐름은 `intro -> id -> ASRS -> ASRS quick analysis -> DSM-5 -> reactivity tests -> report -> plan` 이며, 각 단계 결과는 사용자별 JSON 파일로 저장됩니다.

## Features

- 모바일 우선 단일 페이지 UI
- 신규 ID 생성 및 기존 기록 불러오기
- ASRS Part A 6문항 0~4 척도 평가
- Gemini 기반 ASRS quick analysis
- DSM-5 기반 yes/no 질문 흐름
- 반응성 테스트 3종
- 테스트 1: 파란 별만 누르는 signal detection
- 테스트 2: 낙하하는 동그라미는 누르고 엑스는 누르지 않는 go/no-go
- 테스트 3: 센서 기반 균형 유지, 마우스/터치 fallback에서는 움직이는 목표 추적
- 반응성 테스트 3종 완료 후 통합 수치와 통합 해석 제공
- 방사형 그래프 기반 리포트와 계획 생성
- `database/*.json` 파일 기반 로컬 저장

## Reactivity Tests

### Test 1. Signal Detection

- `react1/back.gif` 배경 위에 `0.gif`~`5.gif` 자극을 사용합니다.
- `0.gif`는 정답 자극이며 나머지는 오답 자극입니다.
- `idle.png`, `true.png`, `fail.png` 오버레이로 문제별 판정을 표시합니다.
- 안내 화면에서 파란 별 예시를 보여준 뒤 연습 없이 바로 본검사를 시작합니다.

### Test 2. Go / No-Go

- `react2/back.gif` 배경 위에 `o.gif`, `x.gif` 낙하 자극을 사용합니다.
- 동그라미는 바닥 직전 성공 구간에 `TAP` 버튼을 눌러야 하고, 엑스는 끝까지 누르지 않아야 합니다.
- `idle.png`, `true.png`, `fail.png` 오버레이로 문제별 판정을 표시합니다.
- 자극 GIF는 문항마다 재생 토큰을 붙여 매번 처음부터 다시 재생합니다.

### Test 3. Balance Hold / Tracking

- 센서가 있으면 기존처럼 중심 유지 기반으로 측정합니다.
- 센서가 없으면 마우스/터치 fallback에서 목표 원이 검사 내내 부드럽게 이동합니다.
- fallback 모드에서는 포인터가 움직이는 목표 원 안에 얼마나 안정적으로 머무는지 추적 안정성 관점으로 측정합니다.

## Project Structure

```text
.
├── asrs/
├── config/
│   ├── asrs.json
│   ├── dsm-5.json
│   └── report.json
├── database/
├── images/
├── public/
│   ├── app.js
│   ├── index.html
│   ├── intro.png
│   ├── react1/
│   ├── react2/
│   └── styles.css
├── react1/
├── react2/
├── uiexample/
├── server.js
├── run.sh
├── end.sh
└── package.json
```

`react1/`, `react2/`는 작업용 원본 자산 폴더이고, 실제 서빙은 `public/react1/`, `public/react2/`에서 이뤄집니다.

## Environment

루트에 `.env` 파일을 만들고 아래 값을 설정합니다.

```env
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-2.5-flash
HOST=0.0.0.0
PORT=3333
```

`GEMINI_API_KEY`가 없더라도 기본 흐름과 로컬 저장은 동작하지만, AI 분석/리포트 생성 기능은 제한됩니다.

## Run

의존성 설치:

```bash
npm install
```

개발 서버 실행:

```bash
npm start
```

네트워크에서 접속 가능한 백그라운드 실행:

```bash
./run.sh
```

서버 중단:

```bash
./end.sh
```

## Data Storage

- 사용자 기록은 `database/<id>.json` 형태로 저장됩니다.
- 기록에는 현재 단계, ASRS 응답, DSM-5 응답, 반응성 테스트 결과, 분석 결과, 리포트/계획 초안이 함께 저장됩니다.
- 반응성 테스트는 개별 결과 대신 통합 summary와 핵심 수치를 함께 저장합니다.
- `.env`, `server.log`, `.server.pid`, `database/*.json` 같은 개인 데이터는 Git에 포함되지 않도록 설정되어 있습니다.

## Notes

- 이 앱은 진단 확정 도구가 아니라 선별/감별 보조용 프로토타입입니다.
- 서버는 이전 `asar` 키를 읽어 `asrs` 데이터로 호환 처리합니다.
- 리포트와 계획 문장은 Gemini 응답 또는 서버 계산 결과를 기반으로 생성됩니다.
- 반응성 테스트 자산을 바꾼 경우 `public/react1/`, `public/react2/`에도 반영해야 실제 앱에 적용됩니다.
