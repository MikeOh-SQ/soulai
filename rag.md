# AI 개입 지점 및 입력 자료 정리

## 요약

이 기본 서비스에는 전통적인 의미의 RAG가 없습니다.

- `embedding`, `vector`, 검색 인덱스, 외부 문서 검색 단계가 없습니다.
- 대신 저장된 사용자 기록 JSON과 서버가 계산한 지표를 그대로 프롬프트에 넣어 Gemini에 전달합니다.
- 즉 현재 구조는 `검색형 RAG`보다 `로컬 데이터 주입형 프롬프트 구성`에 가깝습니다.

AI가 실제로 개입하는 시점은 총 4곳입니다.

1. `SELF` 완료 직후: 자가보고 선별 해석
2. `SYM` 완료 직후: 증상 기준 체크 해석
3. `RESULT` 진입 시: 통합 리포트 + 기본 계획 문구 보조
4. `PLAN` 채팅 전송 시: 계획 조정 답변

참고로 `GET /api/ai/status`는 AI 생성이 아니라 Gemini 설정 여부 확인용입니다.

중요:

- 현재 `DTx`, `plangame`, `/game`, `/map` 자체에는 별도 AI 호출이 없습니다.
- AI 개입은 메인 검사 앱의 `SELF`, `SYM`, `RESULT`, `PLAN`에 한정됩니다.

## 공통 구조

실제 Gemini 호출은 [server.js](/home/sqmini/soulai/server.js:601) `callGeminiJson()` 하나로 모입니다.

- 모델: `GEMINI_MODEL` 기본값 `gemini-2.5-flash`
- 전달 형식:
  - `systemInstruction`
  - `prompt`
  - `schemaHint`
- 응답 강제:
  - `responseMimeType: "application/json"`
  - 프롬프트 끝에 `Return JSON only.`

즉 AI는 자유 텍스트가 아니라, 서버가 정한 JSON 스키마 안에서만 답하게 설계되어 있습니다.

## 공통 입력 자료

AI 프롬프트에 들어가는 기본 자료는 아래 묶음입니다.

1. 사용자 기록 전체 `record`
   - 프런트에서 각 AI API 호출 시 `record: state.currentRecord`를 그대로 전송합니다.
   - 포함 항목: `tests.asrs`, `tests.dsm5`, `tests.game`, 기존 `report`, `plan` 등
2. 화면/로컬 분석 결과
   - ASRS는 [public/app.js](/home/sqmini/soulai/public/app.js:374) `analyzeAsrs()`
   - DSM은 [public/app.js](/home/sqmini/soulai/public/app.js:417) `analyzeDsm()`
3. 서버 계산 지표 `metrics`
   - [server.js](/home/sqmini/soulai/server.js:277) `computeAssessmentMetrics(record)`
   - 핵심값: `asrsPositiveCount`, `dsmSubtype`, `omissionRate`, `commissionRate`, `reactionVariability`, `tau`, `latePhaseDrop`, `fastErrorRate`, `stableDurationPct`, `alignment`, `dailyImpactLevel` 등
4. 질문 원본
   - ASRS: [config/asrs.json](/home/sqmini/soulai/config/asrs.json)
   - DSM-5: [config/dsm-5.json](/home/sqmini/soulai/config/dsm-5.json)
5. 반응성 테스트 결과
   - 직접 질문 텍스트를 넣지는 않지만 `record.tests.game`의 측정값이 `metrics.signal`, `metrics.goNogo`, `metrics.balance`로 프롬프트에 포함됩니다.

## 1. SELF 완료 직후

- 호출 위치: [public/app.js](/home/sqmini/soulai/public/app.js:2311)
- API: `POST /api/ai/asrs-analysis`
- 서버 처리: [server.js](/home/sqmini/soulai/server.js:918), [server.js](/home/sqmini/soulai/server.js:1050)

### 언제 호출되나

- 자가보고 선별 결과 화면에서 `ensureAsrsAnalysis()`가 필요 시 호출합니다.
- 입력은 `record`와 프런트의 `analysis = analyzeAsrs()`입니다.

### 기본 입력 자료

- 질문 원본: `config/asrs.json` 6문항
- 사용자 응답: `record.tests.asrs`
- 로컬 분석:
  - `answers`
  - `totalPositive`
  - `attentionPositive`
  - `hyperPositive`
  - `severity`
  - `summary`
  - `attentionMessage`
  - `hyperMessage`
  - `guidance`
- 서버 보조 지표: `computeAssessmentMetrics(record)` 결과 전체

### 실제 프롬프트 핵심

프롬프트 생성 함수는 [server.js](/home/sqmini/soulai/server.js:754) `buildAsrsAnalysisPrompt()`입니다.

- 역할: `자가보고 선별 결과를 짧고 공감적으로 해석하는 한국어 선별 보조 AI`
- 규칙:
  - 진단 확정 표현 금지
  - 1~3번은 `2` 이상, 4~6번은 `3` 이상을 유의미로 해석
  - 유의미 문항 4개 이상이면 추가 평가 적극 고려 수준
- 요청 출력:
  - `summary`
  - `attention`
  - `hyperactivity`
  - `guidance`

### 비고

- 이 단계는 사실상 "질문 원본 + 응답 요약 + 서버 지표"를 즉시 주입하는 형태입니다.
- 외부 자료 검색은 없습니다.

## 2. SYM 완료 직후

- 호출 위치: [public/app.js](/home/sqmini/soulai/public/app.js:2337)
- API: `POST /api/ai/dsm-analysis`
- 서버 처리: [server.js](/home/sqmini/soulai/server.js:941), [server.js](/home/sqmini/soulai/server.js:1064)

### 언제 호출되나

- 증상 기준 체크 결과 화면에서 `ensureDsmAnalysis()`가 필요 시 호출합니다.
- 입력은 `record`와 프런트의 `analysis = analyzeDsm()`입니다.

### 기본 입력 자료

- 질문 원본: `config/dsm-5.json` 23문항
- 사용자 응답: `record.tests.dsm5`
- 로컬 분석:
  - `inattentionYes`
  - `hyperactivityYes`
  - `contextualYes`
  - `subtype`
  - `summary`
  - `detail`
  - `isComplete`
- 서버 보조 지표: `computeAssessmentMetrics(record)` 결과 전체

### 실제 프롬프트 핵심

프롬프트 생성 함수는 [server.js](/home/sqmini/soulai/server.js:775) `buildDsmAnalysisPrompt()`입니다.

- 역할: `증상 기준 체크 결과를 짧고 공감적으로 해석하는 한국어 선별 보조 AI`
- 규칙:
  - 진단 확정 표현 금지
  - 부주의 9문항 중 6개 이상 Yes면 부주의형 가능성
  - 과잉행동/충동성 9문항 중 6개 이상 Yes면 과잉행동/충동형 가능성
  - 둘 다 6개 이상이면 복합형 가능성
  - 둘 다 6개 미만이면 무증상 범위
- 요청 출력:
  - `summary`
  - `subtype`
  - `inattention`
  - `hyperactivity`
  - `guidance`

### 비고

- Gemini 미설정 시 이 단계는 AI를 생략하고 로컬 quick analysis를 저장합니다.
- 즉 이 지점은 "AI 가능하면 호출, 아니면 로컬 대체" 구조입니다.

## 3. RESULT 진입 시 통합 리포트 + 기본 계획

- 호출 위치: [public/app.js](/home/sqmini/soulai/public/app.js:2271)
- API: `POST /api/ai/insights`
- 서버 처리: [server.js](/home/sqmini/soulai/server.js:797), [server.js](/home/sqmini/soulai/server.js:1022)

### 언제 호출되나

- `ensureInsights()`에서 리포트가 없거나 구버전이면 호출합니다.
- 이 호출 한 번으로 `report`와 `plan`을 함께 만듭니다.

### 기본 입력 자료

- 사용자 전체 기록 `record`
- 서버 계산 지표 `metrics = computeAssessmentMetrics(record)`
- 내부적으로 이미 포함되는 데이터:
  - ASRS 응답/점수
  - DSM 응답/유형
  - signal detection 결과
  - go/no-go 결과
  - balance hold 결과
  - 주관-객관 일치 여부
  - 일상 부담 수준

### 실제 프롬프트 핵심

프롬프트 생성 함수는 [server.js](/home/sqmini/soulai/server.js:663) `buildInsightsPrompt()`입니다.

- 역할/톤:
  - `따뜻하고 전문적인 임상심리사`
  - 쉬운 한국어
  - 진단 확정 금지
- 해석 규칙:
  - ASRS 기준, DSM 기준을 프롬프트 안에 명시
  - `목표 놓침(부주의)`, `잘못된 반응(충동성)`처럼 순화된 용어 사용
  - 자가보고와 게임 기반 객관 지표의 일치/불일치를 반드시 짚기
  - JSON에 없는 수치는 추정 금지
- 계획 작성 규칙:
  - `plan.suggestions`는 반드시 3개
  - 각 문장은 20자 이내
  - 시간/장소/행동 단위가 드러나야 함
  - 의료적 지시 대신 일상 코칭 언어 사용

### 요청 출력 스키마

- `report.severity`
- `report.hero.badges`
- `report.hero.summary`
- `report.crossCheck.*`
- `report.profile.inattentionSummary`
- `report.profile.impulsivitySummary`
- `report.dailyImpact.empathy`
- `report.sections.strength`
- `report.sections.watchout`
- `plan.suggestions`
- `plan.openingMessage`

### 중요한 구현 포인트

- 실제 최종 리포트는 AI가 전부 쓰지 않습니다.
- [server.js](/home/sqmini/soulai/server.js:797) `generateInsights()`는 먼저 `buildDeterministicReport(metrics)`를 만듭니다.
- 그 뒤 AI가 있더라도 최종 반환 시 다음은 결정론 값이 우선입니다.
  - `report.severity`
  - `scores`
  - 핵심 섹션 다수
- AI는 주로 `plan.suggestions`와 `openingMessage`를 더 자연스럽게 만드는 보조 역할입니다.

### 기본 계획 원본

AI 이전의 기본 계획 문구는 [server.js](/home/sqmini/soulai/server.js:475) `buildPlanForMetrics()`에 하드코딩되어 있습니다.

- `inattention`
- `impulsivity`
- `combined`
- `very_low`

즉 PLAN의 바탕 자료는 별도 검색 결과가 아니라 서버 내부 기본 템플릿입니다.

## 4. PLAN 채팅 전송 시

- 호출 위치: [public/app.js](/home/sqmini/soulai/public/app.js:2542)
- API: `POST /api/ai/chat`
- 서버 처리: [server.js](/home/sqmini/soulai/server.js:902), [server.js](/home/sqmini/soulai/server.js:1036)

### 언제 호출되나

- 사용자가 계획 화면 채팅에 메시지를 입력해 전송할 때마다 호출됩니다.

### 기본 입력 자료

- 사용자 전체 기록 `record`
- 현재 계획 `record.plan`
- 기존 채팅 이력 `record.plan.chat`
- 서버 계산 지표 `computeAssessmentMetrics(record)`
- 현재 사용자 메시지 `message`

### 실제 프롬프트 핵심

프롬프트 생성 함수는 [server.js](/home/sqmini/soulai/server.js:717) `buildChatPrompt()`입니다.

- 역할: `성인 ADHD 선별 결과와 현재 실행계획을 바탕으로 사용자의 계획을 현실적으로 조정하는 한국어 행동 코치`
- 규칙:
  - 진단 확정 표현 금지
  - 시간, 장소, 행동 단위를 더 작게 조정
  - 한 번에 여러 행동 대신 가장 작은 다음 행동 1개 우선
  - `additionalSuggestion`은 20자 이내 1개만 허용
  - 부주의 경향은 과제 분할/시각 단서/환경 통제 중심
  - 충동성 경향은 지연 행동/자기 점검/심호흡/메모 중심
- 요청 출력:
  - `reply`
  - `additionalSuggestion`

### 비고

- 이 단계는 별도 지식 검색 없이, 이미 만들어진 `record`와 `metrics`만으로 후속 코칭을 합니다.

## 현재 서비스에서 AI가 개입하지 않는 구간

아래 구간은 AI 호출이 없습니다.

- 질문 로딩: `config/asrs.json`, `config/dsm-5.json` 정적 파일
- 반응성 테스트 실행 자체
- 점수 계산과 유형 집계
- 핵심 리포트 수치 계산
- 기본 계획 분기 생성
- `/dtx`, `/plangame`, `/game`, `/map` 보조 화면 동작 자체

즉 현재 서비스는 `측정/집계/판정 골격은 규칙 기반`, `설명 문장과 계획 조정은 AI 보조` 구조입니다.

## 런타임 프롬프트와 기획 문서의 차이

아래 문서는 참고 자료이지만 런타임에서 직접 읽히지는 않습니다.

- [report/[5-2] 통합 리포트 프롬프트.txt](/home/sqmini/soulai/report/%5B5-2%5D%20%ED%86%B5%ED%95%A9%20%EB%A6%AC%ED%8F%AC%ED%8A%B8%20%ED%94%84%EB%A1%AC%ED%94%84%ED%8A%B8.txt)
- [plan/6-1 plan.txt](/home/sqmini/soulai/plan/6-1%20plan.txt)
- [plan/6-2 plan prompt.txt](/home/sqmini/soulai/plan/6-2%20plan%20prompt.txt)
- [plan.txt](/home/sqmini/soulai/plan.txt)

실제 서비스가 쓰는 프롬프트는 전부 `server.js` 안의 아래 함수들입니다.

- `buildInsightsPrompt()`
- `buildChatPrompt()`
- `buildAsrsAnalysisPrompt()`
- `buildDsmAnalysisPrompt()`

즉 참고용 기획 문서가 저장소에 남아 있더라도, 런타임 관점에서 중요한 것은 `server.js` 안 프롬프트 함수와 그 입력 데이터(`record`, `analysis`, `metrics`)입니다.

## 결론

현재 기본 서비스에서 AI는 "자료를 검색해서 답하는 RAG"가 아니라, 아래 자료를 직접 주입받아 문장을 생성합니다.

- 질문 원본 JSON
- 사용자 응답이 저장된 `record`
- 프런트 로컬 분석 결과
- 서버 계산 지표 `metrics`
- 서버 내부 기본 계획 템플릿

따라서 이 서비스의 `rag.md` 관점 핵심은 "어디서 AI가 호출되는가"보다 "호출 시 어떤 로컬 데이터 묶음이 프롬프트에 들어가는가"입니다.

최근 구조를 한 줄로 정리하면 아래와 같습니다.

- 메인 앱: AI 호출이 있는 검사/해석/계획 흐름
- `DTx`/`plangame`/`game`: AI 없이 record를 소비하는 후속 실험/연출 흐름
- `/map`: 위 구조를 문서화한 시각화 도구
