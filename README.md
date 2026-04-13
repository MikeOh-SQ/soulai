# soul.ai.kr

ADHD 선별/감별 보조를 위한 모바일 웹 앱 프로토타입입니다. 현재 흐름은 `intro -> id -> ASRS -> ASRS quick analysis -> DSM-5 -> reactivity tests -> report -> plan` 이며, 각 단계 결과는 사용자별 JSON 파일로 저장됩니다.

## Features

- 모바일 우선 단일 페이지 UI
- 신규 ID 생성 및 기존 기록 불러오기
- ASRS Part A 6문항 0~4 척도 평가
- ASRS 직후 Gemini 기반 quick analysis 생성
- DSM-5 23문항 yes/no 평가
- DSM-5 문항별 이미지 표시 (`dsmimages/d1.png` ~ `d23.png`)
- 반응성 테스트 3종
- 테스트 1: 파란 별만 누르는 signal detection
- 테스트 2: 낙하하는 동그라미는 누르고 엑스는 누르지 않는 go/no-go
- 테스트 3: 센서 기반 균형 유지, 마우스/터치 fallback에서는 움직이는 목표 추적
- 반응성 테스트 완료 후 통합 수치와 통합 해석 저장
- 저장 JSON 기반 deterministic report 생성
- 계획(plan)은 서버 계산 결과 + Gemini 문장 보조를 함께 사용
- `database/*.json` 파일 기반 로컬 저장

## Current Flow

1. `ID`를 만들거나 기존 기록을 불러옵니다.
2. `ASRS` 6문항에 응답합니다.
3. ASRS 응답을 바탕으로 간단 해석을 생성합니다.
4. `DSM-5` 23문항에 응답합니다.
5. `반응성 테스트 3종`을 진행합니다.
6. 저장된 JSON 수치만 기준으로 `report`를 생성합니다.
7. 보고서 결과를 바탕으로 실행 계획 `plan`을 보여주고, 추가 조정은 AI 채팅으로 요청할 수 있습니다.

## Report / AI Rules

- `report`는 저장된 JSON 수치만 사용해 서버에서 결정론적으로 생성합니다.
- JSON에 없는 반응성 테스트 상세 수치는 report 문장에 인용하지 않습니다.
- `plan.suggestions` 기본값은 서버 계산 결과를 사용합니다.
- `plan.chat` 첫 메시지와 이후 조정 답변은 Gemini를 사용할 수 있습니다.
- `ASRS quick analysis`는 Gemini를 사용해 `summary`, `attention`, `hyperactivity`, `guidance`를 생성합니다.

## Reactivity Tests

### Test 1. Signal Detection

- `react1/back.gif` 배경 위에 `0.gif`~`5.gif` 자극을 사용합니다.
- `0.gif`는 정답 자극이며 나머지는 오답 자극입니다.
- `idle.png`, `true.png`, `fail.png` 오버레이로 문제별 판정을 표시합니다.
- 저장 JSON에는 점수뿐 아니라 `target_count`, `hit_count`, `omission_errors`, `false_alarm_count`, `omission_rate`, `mean_reaction_time`, `reaction_time_variability`, `late_response_count`가 들어갑니다.

### Test 2. Go / No-Go

- `react2/back.gif` 배경 위에 `o.gif`, `x.gif` 낙하 자극을 사용합니다.
- 동그라미는 바닥 직전 성공 구간에 `TAP` 버튼을 눌러야 하고, 엑스는 끝까지 누르지 않아야 합니다.
- `idle.png`, `true.png`, `fail.png` 오버레이로 문제별 판정을 표시합니다.
- 저장 JSON에는 `go_count`, `nogo_count`, `go_hit_count`, `go_omission_count`, `commission_errors`, `successful_stop_count`, `false_stop_count`, `late_stop_count`, `mean_go_reaction_time`, `premature_response_count`, `inhibition_failure_rate`, `hold_success_rate` 등이 들어갑니다.

### Test 3. Balance Hold / Tracking

- 센서가 있으면 기존처럼 중심 유지 기반으로 측정합니다.
- 센서가 없으면 마우스/터치 fallback에서 목표 원이 검사 내내 부드럽게 이동합니다.
- 저장 JSON에는 `stable_hold_time`, `drift_distance`, `movement_variability`, `large_motion_count`, `correction_count`, `inside_target_ratio`, `input_source`가 들어갑니다.

## Project Structure

```text
.
├── asrs/
├── config/
│   ├── asrs.json
│   ├── dsm-5.json
│   └── report.json
├── database/
├── dsmimages/
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
├── report/
├── server.js
├── run.sh
├── end.sh
├── 질문과해석.md
├── 전체프로세스.md
└── package.json
```

- `react1/`, `react2/`는 작업용 원본 자산 폴더이고, 실제 서빙은 `public/react1/`, `public/react2/`에서 이뤄집니다.
- `dsmimages/`는 DSM-5 질문 상단에 노출되는 문항별 이미지 폴더입니다.
- `report/`는 통합 리포트 화면 구조와 프롬프트 참고자료 폴더입니다.

## Environment

루트에 `.env` 파일을 만들고 아래 값을 설정합니다.

```env
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-2.5-flash
HOST=0.0.0.0
PORT=3333
```

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

- 사용자 기록은 `database/<id>-<timestamp>.json` 형태로 저장됩니다.
- 기록에는 현재 단계, ASRS 응답, DSM-5 응답, 반응성 테스트 결과, 리포트, 계획이 함께 저장됩니다.
- 최신 리포트는 `report.schemaVersion = 2` 기준으로 관리합니다.
- 오래된 레코드를 `report` 또는 `plan` 단계에서 불러오면 새 스키마 report로 다시 생성합니다.
- `.env`, `server.log`, `.server.pid`, `database/*.json` 같은 개인 데이터는 Git에 포함되지 않도록 설정되어 있습니다.

## Related Docs

- [질문과해석.md](질문과해석.md): 저장 JSON 값과 해석 규칙
- [전체프로세스.md](전체프로세스.md): 질문/저장 변수/AI 프롬프트/출력 흐름 설명

## Notes

- 이 앱은 진단 확정 도구가 아니라 선별/감별 보조용 프로토타입입니다.
- 서버는 이전 `asar` 키를 읽어 `asrs` 데이터로 호환 처리합니다.
- ASRS quick analysis와 plan chat은 Gemini를 사용합니다.
- report는 저장된 JSON 수치와 서버 계산값을 우선 사용합니다.
- 반응성 테스트 자산을 바꾼 경우 `public/react1/`, `public/react2/`에도 반영해야 실제 앱에 적용됩니다.
