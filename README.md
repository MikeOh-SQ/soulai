# ADHDQQ.COM

ADHDQQ.COM은 성인 ADHD 관련 경향을 선별하고 설명하기 위한 모바일 웹 앱 프로토타입입니다. 진단 확정 도구가 아니라, 자가보고 선별, 증상 기준 체크, 반응성 테스트를 결합해 현재 패턴을 이해하기 쉽게 정리하는 보조 도구입니다.

## 현재 흐름

1. `ID`: 새 ID 생성 또는 기존 기록 불러오기
2. `SELF`: 자가보고 선별 6문항
3. `SYM`: 증상 기준 체크 23문항
4. `REACT`: 반응성 테스트 3종
5. `RESULT`: 통합 결과 리포트
6. `PLAN`: 유형별 실행 계획과 AI 조정 채팅

하단 네비게이션은 현재 단계 표시용이며, 사용자가 임의로 단계를 건너뛰는 이동 기능은 비활성화되어 있습니다.

## 주요 기능

- 모바일 우선 단일 페이지 UI
- 신규 ID 생성 및 기존 기록 불러오기
- 자가보고 선별 6문항 0~4 척도 평가
- 증상 기준 체크 23문항 Yes/No 평가
- 반응성 테스트 3종
- 저장 JSON 기반 결정론적 통합 리포트 생성
- 유형별 실행 계획 생성
- 계획 화면에서 Gemini 기반 조정 채팅 지원
- URL 쿼리 기반 단계/테스트 shortcut 진입 지원
- 진행 중 기록 JSON 확인 모달과 admin 기록 불러오기 모달
- `DTx` 숲 허브, `plangame` 목표 체크, 미니게임 점수 누적 실험 기능
- `/map` 구조도 화면으로 JSON, 파생 스키마, AI 입력 흐름 시각화
- `database/*.json` 파일 기반 로컬 저장

## 하이브리드 작동 방식

이 앱은 AI만으로 결과를 쓰지 않습니다.

- 측정과 집계: 브라우저에서 사용자의 응답과 반응성 테스트 raw 데이터를 수집합니다.
- 결정론적 계산: 서버가 저장 JSON의 수치만 읽어 핵심 지표와 통합 리포트를 계산합니다.
- AI 보조: Gemini는 자가보고/증상 체크의 짧은 문장 해석, 계획 제안, 계획 조정 대화에 사용됩니다.
- 안전장치: 리포트 본문은 저장된 수치와 서버 계산값을 우선 사용하며, JSON에 없는 값을 추정해 말하지 않습니다.

## 반응성 테스트

### 1. 신호 찾기

- 목적: 부주의, 지속주의, 반응시간 안정성 보조 측정
- 방식: 목표 자극에만 반응하고 비목표 자극에는 반응하지 않음
- 본 시행: 60회
- 자극 시간: 500ms
- ISI: 1000/1250/1500ms 랜덤
- 핵심 지표: `omission_rate`, `reaction_time_variability`, `tau`, `late_phase_drop`

### 2. 멈춤 버튼

- 목적: 반응 억제, 성급 반응, 충동성 보조 측정
- 방식: `o.gif`는 누르고 `x.gif`는 누르지 않음
- 본 시행: 50회
- 자극 시간: 500ms
- ISI: 800/1000/1200ms 랜덤
- 성공 기준: Go 자극 시작 후 220ms 이후부터 자극 종료 전까지의 반응
- iPhone/iPad 보정: 터치/시각 지연을 고려해 Apple touch device에서 380ms 보정 적용
- No-Go 배치: 최소 2회 이상 Go 뒤에 No-Go가 나오도록 완화
- 핵심 지표: `commission_rate`, `fast_error_rate`, `mean_go_reaction_time`, `premature_response_count`

### 3. 균형 유지

- 목적: 활동성/자기조절 보조 지표 측정
- 방식: 모바일 센서가 가능하면 기기 움직임을 사용하고, 불가능하면 중앙 원 롱터치 방식으로 진행
- PC/센서 없음: 포인터 fallback
- 본 검사: 30초
- 핵심 지표: `stable_duration_pct`, `spike_count`, `total_movement`, `input_source`
- 해석 원칙: 과잉행동을 직접 확정하지 않고 활동성/자기조절의 보조 참고값으로만 사용

## 결과 리포트

리포트는 점수 하나로 결론을 내리지 않고 다음 구조로 보여줍니다.

- 주관적 보고: 자가보고 선별에서 사용자가 느낀 어려움
- 객관적 반응: 반응성 테스트에서 실제로 나타난 수행 패턴
- 일치/불일치: 두 결과가 비슷한지 다른지
- 부주의 탭: 목표 놓침, 반응시간 변동성, Tau, 후반부 정확도 저하
- 충동성 탭: 잘못된 반응 비율, 성급 반응 비율, Go 반응시간, 반응 패턴
- 활동성: 균형 유지 결과를 보조 참고 정보로 설명

## 계획 생성

`PLAN` 단계는 사용자의 두드러진 경향에 따라 3개 실행 계획을 제안합니다.

- 부주의형 경향: 과제 분할, 시각적 단서, 환경 통제, 시작 장벽 낮추기
- 과잉행동/충동형 경향: 지연 행동, 자기 점검, 심호흡, 행동 전 메모
- 복합형 경향: 부주의 보완 전략과 충동 조절 전략을 함께 제안
- 안정 범위: 현재 상태를 유지하는 작고 반복 가능한 루틴

## 프로젝트 구조

```text
.
├── config/
│   ├── asrs.json
│   ├── dsm-5.json
│   └── report.json
├── database/
├── dsmimages/
├── game/
│   ├── images/
│   └── scripts/
├── images/
├── public/
│   ├── app.js
│   ├── dtx/
│   ├── index.html
│   ├── intro.png
│   ├── map/
│   ├── plangame/
│   ├── react1/
│   ├── react2/
│   └── styles.css
├── server.js
├── run.sh
├── end.sh
├── jsonlist.md
├── rag.md
├── sumlogic.md
├── 질문과해석.md
├── 전체프로세스.md
├── 반응성게임사양서.md
├── 논문차용.md
├── 구조설명.md
└── 발표자료.md
```

## 환경 변수

루트에 `.env` 파일을 만들고 아래 값을 설정합니다.

```env
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-2.5-flash
HOST=0.0.0.0
PORT=3333
```

## 실행

```bash
npm install
npm start
```

네트워크 접속용 백그라운드 실행:

```bash
./run.sh
```

서버 중단:

```bash
./end.sh
```

## 저장 데이터

- 사용자 기록은 `database/<id>-<timestamp>.json` 형태로 저장됩니다.
- 기록에는 현재 단계, 자가보고 응답, 증상 기준 체크 응답, 반응성 테스트 결과, 리포트, 계획이 함께 저장됩니다.
- `DTx`/`plangame`을 사용하면 `record.dtx`, `record.tutorials`, `record.planGame` 같은 보조 상태도 함께 저장됩니다.
- 최신 리포트는 `report.schemaVersion = 2` 기준으로 관리합니다.
- 오래된 레코드를 `report` 또는 `plan` 단계에서 불러오면 새 스키마 리포트로 다시 생성합니다.

## 유용한 경로

- 메인 앱: `/`
- 특정 단계 shortcut: `/?route=report&id=test01`
- 반응성 overview shortcut: `/?shortcut=reactivity&test=go_nogo&id=test01`
- 반응성 완료 화면 shortcut: `/?shortcut=reactivity-result&test=balance_hold&id=test01`
- DTx 숲 허브: `/dtx?id=test01`
- 플랜 게임: `/plangame?id=test01`
- 구조도 맵: `/map`

## 관련 문서

- [전체프로세스.md](전체프로세스.md): 입력, 저장, 계산, AI 연결 흐름
- [질문과해석.md](질문과해석.md): 저장 JSON 값과 해석 규칙
- [jsonlist.md](jsonlist.md): 핵심 JSON과 파생 변수 영향 정리
- [rag.md](rag.md): AI 개입 지점과 프롬프트 입력 자료 정리
- [sumlogic.md](sumlogic.md): 화면별 요약 문장 생성 우선순위 정리
- [반응성게임사양서.md](반응성게임사양서.md): 반응성 테스트 상세 사양
- [구조설명.md](구조설명.md): 비전공자용 구조 설명
- [논문차용.md](논문차용.md): 논문/자료에서 차용한 개념
- [발표자료.md](발표자료.md): 프로젝트 발표용 슬라이드 원고

## 주의

- 이 앱은 진단 확정 도구가 아닙니다.
- 자가보고 선별과 증상 기준 체크 명칭은 UI에서 일반 명칭으로 표시하며, 내부 데이터 키는 기존 호환성을 위해 `asrs`, `dsm5`를 유지합니다.
- 반응성 테스트 자산을 바꾼 경우 `public/react1/`, `public/react2/`에 반영해야 실제 앱에 적용됩니다.
