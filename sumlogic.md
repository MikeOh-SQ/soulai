# 응답 요약 생성 로직 정리

## 요약

이 서비스에서 "응답 요약"은 한 종류가 아닙니다. 실제로는 아래 4계층으로 나뉩니다.

1. 프런트 로컬 요약
2. 서버 AI 요약
3. 서버 결정론 리포트 요약
4. 화면 표시용 fallback 합성 요약

즉 어떤 화면에서 보이는 요약 문장은 "AI가 바로 쓴 문장"일 수도 있고, "프런트에서 먼저 만든 임시 요약"일 수도 있고, "서버가 규칙으로 만든 고정 요약"일 수도 있습니다.

## 전체 흐름

요약이 들어오는 대표 시점은 5곳입니다.

1. `SELF` 결과 화면
2. `SYM` 결과 화면
3. `REACT` 테스트 완료 후
4. `RESULT` 리포트 생성 후
5. `PLAN` 기본 메시지/채팅 응답

아래부터 각 시점의 생성 로직을 정리합니다.

## 1. SELF 결과 요약

관련 위치:

- 로컬 분석: [public/app.js](/home/sqmini/soulai/public/app.js:374)
- AI 호출: [public/app.js](/home/sqmini/soulai/public/app.js:2311)
- 서버 AI 응답: [server.js](/home/sqmini/soulai/server.js:920)
- 화면 출력: [public/app.js](/home/sqmini/soulai/public/app.js:3064)

### 1-1. 로컬 요약 생성

`analyzeAsrs()`가 먼저 요약을 만듭니다.

입력:

- `record.tests.asrs`
- 응답 6개

핵심 계산:

- 기준치: `[2, 2, 2, 3, 3, 3]`
- `positiveFlags = answer >= threshold`
- `totalPositive`
- `attentionPositive`
- `hyperPositive`

로컬 `summary` 분기:

- 기본:
  - `현재 응답만으로는 뚜렷한 자가보고 선별 신호가 많지 않습니다.`
- `totalPositive >= 4`
  - `자가보고 선별에서 유의미한 문항이 4개 이상으로 나타나 추가 평가를 고려할 만한 패턴입니다.`
- `totalPositive >= 2`
  - `자가보고 선별에서 일부 주의집중 또는 실행기능 관련 어려움이 관찰되어 맥락을 함께 볼 필요가 있습니다.`

같이 생성되는 세부 요약:

- `attentionMessage`
  - `attentionPositive > 0`이면 `주의력 결핍 관련 문항 4개 중 n개가 기준 이상입니다...`
  - 아니면 `현재 기준 이상 응답이 많지 않습니다.`
- `hyperMessage`
  - `hyperPositive > 0`이면 `과잉행동·충동성 관련 문항 2개 중 n개가 기준 이상입니다...`
  - 아니면 `현재 기준 이상 응답이 많지 않습니다.`
- `guidance`
  - `totalPositive >= 4`이면 정밀 평가 권고 문구
  - 아니면 스트레스/수면/불안·우울 등 다른 요인 고려 문구

### 1-2. AI 요약 생성

`generateAsrsAnalysis()`가 Gemini를 호출해 아래 4개 필드를 받습니다.

- `summary`
- `attention`
- `hyperactivity`
- `guidance`

서버 fallback:

- AI가 비거나 실패해도 서버는 기본 문구를 채워 반환합니다.
- 예:
  - `summary`: `자가보고 응답에서 현재 주의집중 관련 어려움의 강도를 함께 살펴볼 필요가 있습니다.`

### 1-3. 화면 표시 우선순위

ASRS 결과 화면의 우선순위는 아래와 같습니다.

상단 hero 요약:

1. AI 진행 중이면 `AI가 현재 점수 강도를 바탕으로 자가보고 선별 결과를 해석하고 있습니다.`
2. `state.currentRecord.asrsAnalysis.summary`
3. 로컬 `analysis.summary`
4. 미완료면 `아직 6문항이 모두 입력되지는 않았습니다...`

하단 세부 요약:

1. AI 진행 중이면 각 대기 문구
2. `asrsAnalysis.attention` / `asrsAnalysis.hyperactivity` / `asrsAnalysis.guidance`
3. 로컬 `attentionMessage` / `hyperMessage` / `guidance`

즉 SELF는 "로컬 요약 선표시 후 AI 요약으로 덮는 구조"입니다.

## 2. SYM 결과 요약

관련 위치:

- 로컬 분석: [public/app.js](/home/sqmini/soulai/public/app.js:417)
- 로컬 quick analysis: [public/app.js](/home/sqmini/soulai/public/app.js:475)
- AI 호출: [public/app.js](/home/sqmini/soulai/public/app.js:2337)
- 서버 AI 응답: [server.js](/home/sqmini/soulai/server.js:944)
- 화면 출력: [public/app.js](/home/sqmini/soulai/public/app.js:3130)

### 2-1. 1차 로컬 요약 생성

`analyzeDsm()`가 먼저 `summary`, `detail`, `subtype`을 만듭니다.

입력:

- `record.tests.dsm5`
- 문항의 `section`

핵심 계산:

- `inattentionYes`
- `hyperactivityYes`
- `contextualYes`
- `completedCount`
- `isComplete`

로컬 `summary` 분기:

- 미완료 기본:
  - `아직 증상 기준 체크 응답이 충분하지 않아 임시 집계만 표시합니다.`
- 완료 + 복합형:
  - `부주의와 과잉행동·충동성 영역이 모두 기준 이상으로 나타났습니다.`
- 완료 + 부주의형:
  - `부주의 영역 응답이 기준 이상으로 더 두드러집니다.`
- 완료 + 과잉행동·충동형:
  - `과잉행동·충동성 영역 응답이 기준 이상으로 더 두드러집니다.`
- 완료 + 무증상 범위:
  - `현재 증상 기준 체크에서는 뚜렷한 유형 신호는 크지 않습니다.`
- 미완료 진행형:
  - `현재까지 부주의 n개, 과잉행동·충동성 n개가 Yes입니다.`

`detail` 분기:

- 각 subtype별 설명 문장
- 미완료면 `기준까지는 부주의 x개, 과잉행동·충동성 y개의 Yes 응답이 더 필요합니다.`

### 2-2. 2차 로컬 quick analysis 생성

`buildLocalDsmQuickAnalysis()`가 `analyzeDsm()` 결과를 다시 풀어서 화면용 요약 묶음을 만듭니다.

생성 필드:

- `summary`
- `subtype`
- `inattention`
- `hyperactivity`
- `guidance`

특징:

- `summary`는 `analysis.summary`를 그대로 재사용
- `inattention`, `hyperactivity`는 각각 `n / 9`와 기준 초과 여부 문장으로 재구성
- `guidance`는 subtype별 설명 + `본 결과는 진단이 아니라...` 고정 문장을 합침

즉 DSM은 로컬 요약이 두 번 만들어집니다.

- 1차: `analyzeDsm()`
- 2차: `buildLocalDsmQuickAnalysis()`

### 2-3. AI 요약 생성

`generateDsmAnalysis()`는 Gemini에 아래 5개를 요청합니다.

- `summary`
- `subtype`
- `inattention`
- `hyperactivity`
- `guidance`

서버 fallback:

- `summary`: `증상 기준 체크 응답에서는 현재 부주의와 과잉행동·충동성 신호 분포를 함께 살펴볼 필요가 있습니다.`
- `subtype`: `현재 응답은 {analysis.subtype}로 정리됩니다.`
- 각 영역도 기본 집계 문장으로 채움

중요:

- Gemini가 설정되지 않은 경우 AI 호출을 건너뛰고 `buildLocalDsmQuickAnalysis()` 결과를 그대로 저장합니다.

### 2-4. 화면 표시 우선순위

DSM 결과 화면의 우선순위는 아래와 같습니다.

상단 hero 요약:

1. AI 진행 중 대기 문구
2. `quickAnalysis.summary`

여기서 `quickAnalysis`는:

- AI 응답이 있으면 `state.currentRecord.dsm5QuickAnalysis`
- 없으면 `buildLocalDsmQuickAnalysis()`

하단 세부 요약:

1. AI 진행 중 대기 문구
2. `quickAnalysis.subtype`
3. `quickAnalysis.inattention`
4. `quickAnalysis.hyperactivity`

즉 SYM은 "AI 결과 저장 위치와 로컬 quick analysis의 스키마를 같게 맞춘 구조"입니다.

## 3. REACT 결과 요약

관련 위치:

- 생성: [public/app.js](/home/sqmini/soulai/public/app.js:1191)
- 저장 갱신: [public/app.js](/home/sqmini/soulai/public/app.js:1168)
- 화면 출력: [public/app.js](/home/sqmini/soulai/public/app.js:2897)

### 3-1. 요약 생성 함수

`summarizeReactivity()`가 반응성 테스트 전체 요약을 만듭니다.

입력:

- `game.tests.signal_detection`
- `game.tests.go_nogo`
- `game.tests.balance_hold`

핵심 점수:

- `inattentionScore = signal.score`
- `impulsivityScore = nogo.score`
- `activityScore = balance.score`

문장 생성 방식:

- 세 점수 중 존재하는 값만 `parts` 배열에 넣음
  - `부주의 신호 62점`
  - `충동성 신호 48점`
  - `활동성 신호 70점`
- 존재하는 점수만 내림차순 정렬
- 기본 요약:
  - `반응성 테스트 3종 결과가 저장되었습니다.`
- 점수가 하나라도 있으면:
  - `가장 높은 영역 + parts.join(", ")`
  - 예: `활동성 관련 신호가 상대적으로 더 높게 관찰되며, 부주의 신호 62점, 충동성 신호 48점, 활동성 신호 70점 수준입니다.`

### 3-2. 세부 highlight 생성

같은 함수에서 `highlights`도 함께 만듭니다.

- Test1:
  - `신호 찾기 목표 놓침`
  - `후반부 집중 유지`
- Test2:
  - `잘못된 반응`
  - `Go 반응시간`
- Test3:
  - `안정 유지 시간`
  - `총 움직임`

각 카드에는 `label`, `value`, `note`, `sourceTests`가 들어갑니다.

### 3-3. 갱신 시점

`completeCurrentGameTest()`에서 각 테스트가 끝날 때마다:

1. `game.tests[currentTestKey] = result`
2. `game.summary = summarizeReactivity()`
3. 저장

즉 REACT 요약은 검사 3종이 다 끝난 뒤 한 번만 생기는 게 아니라, 각 테스트가 끝날 때마다 누적 갱신됩니다.

## 4. RESULT 리포트 요약

관련 위치:

- 결정론 리포트 생성: [server.js](/home/sqmini/soulai/server.js:515)
- AI와 결합: [server.js](/home/sqmini/soulai/server.js:850)
- 프런트 fallback 합성: [public/app.js](/home/sqmini/soulai/public/app.js:2461)

### 4-1. 서버 결정론 요약 생성

`buildDeterministicReport(metrics)`가 기본 리포트 요약을 만듭니다.

핵심 입력:

- `metrics.severity`
- `metrics.alignment`
- `metrics.subjectiveDomain`
- `metrics.objectiveDomain`
- `metrics.omissionRate`
- `metrics.commissionRate`
- `metrics.reactionVariability`
- `metrics.tau`
- `metrics.fastErrorRate`
- `metrics.dailyImpactLevel`

생성되는 주요 요약 필드:

- `report.sections.summary`
- `report.hero.summary`
- `report.crossCheck.alignmentSummary`
- `report.profile.inattentionSummary`
- `report.profile.impulsivitySummary`
- `report.dailyImpact.empathy`

`heroSummary` 분기:

- `severity === "높음"`
  - 목표 놓침/멈춰야 할 때 반응 패턴이 함께 보인다는 문장
- `severity === "중간"`
  - 집중 유지나 멈추는 조절이 흔들릴 수 있다는 문장
- 나머지
  - 전반적 반응 패턴이 비교적 안정적이라는 문장

`alignmentSummary` 분기:

- `일치`
- `불일치`
- `혼합`

`inattentionSummary` 분기:

- signal 세부 수치가 있으면:
  - `asrsAttentionScore/16`, `omissionRate`, `reactionVariability`, `latePhaseDrop`를 함께 서술
- 없으면:
  - 신호 찾기 점수 기반 설명

`impulsivitySummary` 분기:

- go/no-go 세부 수치가 있으면:
  - `asrsImpulseScore/8`, `commissionRate`, `fastErrorRate`
- 없으면:
  - go/no-go 점수 기반 설명

### 4-2. AI 결합 방식

`generateInsights()`는 AI를 호출하더라도 최종 리포트 문장을 AI 응답으로 덮지 않습니다.

실제 반환 구조:

- `report.sections.summary = deterministic.report.sections.summary`
- `report.hero.summary = deterministic.report.hero.summary`
- `report.crossCheck.alignmentSummary = deterministic.report.crossCheck.alignmentSummary`
- `report.profile.* = deterministic.report.profile.*`
- `report.dailyImpact.empathy = deterministic.report.dailyImpact.empathy`

즉 RESULT 핵심 요약은 현재 구현 기준으로 AI 보조가 아니라 서버 결정론 고정값입니다.

AI가 실제 반영되는 쪽은 주로:

- `plan.suggestions`
- `plan.chat[0].text`의 `openingMessage`

### 4-3. 프런트 fallback 합성

`computeLocalReportViewModel()`는 화면에서 마지막 방어선 역할을 합니다.

예:

- `heroSummary = report.hero?.summary || report.sections?.summary || 기본 문장`
- `alignmentSummary = report.crossCheck?.alignmentSummary || alignment 기반 기본 문장`
- `dailyImpact.empathy = report.dailyImpact?.empathy || dsm.detail`

즉 서버 report가 비어도 프런트는 요약 문장을 다시 조립해 화면을 유지합니다.

## 5. PLAN 기본 메시지와 채팅 응답

관련 위치:

- 기본 opening message: [server.js](/home/sqmini/soulai/server.js:475)
- AI 결합: [server.js](/home/sqmini/soulai/server.js:890)
- 채팅 응답: [server.js](/home/sqmini/soulai/server.js:900)

### 5-1. 기본 opening message

`buildPlanForMetrics()`는 각 경향별로 `suggestions`와 `openingMessage`를 함께 만듭니다.

경향:

- `inattention`
- `impulsivity`
- `combined`
- `very_low`

각 분기마다 기본 `openingMessage`가 하드코딩되어 있습니다.

### 5-2. AI opening message

`generateInsights()`는 AI가 만든 `payload.plan.openingMessage`가 있으면 그것을 쓰고, 없으면 결정론 `openingMessage`를 씁니다.

즉 우선순위는:

1. AI `openingMessage`
2. `buildPlanForMetrics()` 기본 문구

### 5-3. 채팅 응답 요약

`generateChatReply()`는 PLAN 화면 채팅의 응답 문장을 만듭니다.

출력:

- `reply`
- `additionalSuggestion`

서버 fallback:

- `reply`가 비면:
  - `요청 내용을 반영해 시작 장벽을 낮추는 쪽으로 계획을 조정해 보겠습니다.`

이 문장은 report summary는 아니지만, 사용자의 추가 응답에 대한 "실시간 요약형 코칭 응답"으로 볼 수 있습니다.

## 우선순위 정리

화면에 보이는 요약 문장의 우선순위는 대체로 아래 규칙을 따릅니다.

### SELF

1. AI 진행 중 대기 문구
2. AI 요약
3. 로컬 요약
4. 미완료 안내 문구

### SYM

1. AI 진행 중 대기 문구
2. AI와 동일 스키마로 저장된 `quickAnalysis`
3. 로컬 quick analysis

### REACT

1. `summarizeReactivity()` 누적 요약
2. 세부 `highlights`

### RESULT

1. 서버 결정론 report
2. 프런트 fallback 합성 문장

### PLAN

1. AI `openingMessage` 또는 `reply`
2. 서버 기본 계획 문구

## 결론

이 서비스에서 "응답 요약"은 단일 함수가 만드는 것이 아니라, 단계별로 다른 로직이 만듭니다.

- SELF: 점수 기준 기반 로컬 요약 후 AI 보강
- SYM: subtype 집계 기반 로컬 quick analysis 후 AI 보강
- REACT: 점수 비교 기반 누적 요약
- RESULT: 서버 결정론 요약이 본체
- PLAN: 기본 계획 메시지 위에 AI 코칭 응답 추가

따라서 요약 로직을 수정하려면 먼저 "어느 단계의 요약을 바꾸려는지"를 분리해서 봐야 합니다. `summary`라는 이름이 같아도 실제 생성 주체와 우선순위가 서로 다릅니다.

## 부록: DTx / plangame은 요약을 어떻게 쓰는가

최근 추가된 `DTx`/`plangame`은 새로운 AI 요약을 만들지 않습니다. 대신 이미 만들어진 `plan`과 `record` 상태를 다시 사용합니다.

- `plangame` 기본 목표 3개는 `record.plan.suggestions`에서 시작합니다.
- 사용자가 목표를 수정하면 이후 표시값은 `record.planGame.goals[*].text`가 됩니다.
- 완료/쿨다운은 `record.planGame.goals[*].completedAt`, `cooldownUntil`에 저장됩니다.
- 숲 점수와 배경 stage는 `record.dtx.scores.*`, `record.dtx.totalScore`, `record.dtx.stage`를 사용합니다.

즉 요약 생성 파이프라인은 `PLAN`까지이고, 그 다음 `DTx`/`plangame`은 결과를 행동 루프로 소비하는 단계라고 보면 됩니다.
