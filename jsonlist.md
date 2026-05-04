# JSON 파일별 변수 영향 정리

## 범위

이 문서는 저장소에 있는 모든 JSON을 전부 나열하지 않고, 앱이 실제로 읽거나 저장하면서 변수값에 영향을 주는 핵심 JSON만 정리합니다.

포함 대상:

- `config/asrs.json`
- `config/dsm-5.json`
- `config/report.json`
- `game/test1/test1.json`
- `game/test2/test2.json`
- `game/test3/test3.json`
- `game/scripts/opening.json`
- `game/scripts/100.json` ~ `800.json`
- `game/scripts/plan.json`
- 런타임 저장 레코드 `database/*.json`

현재 구현 기준으로 이 문서에서 가장 중요한 구분은 아래 두 가지입니다.

1. 질문/튜토리얼/스토리 JSON이 어떤 문구와 연출을 바꾸는가
2. `database/*.json`이 어떤 계산, 리포트, 계획, DTx 상태를 다시 살리는가

제외:

- `package.json` 같은 앱 설정 파일
- 과거 테스트용/샘플용 DB 파일 개별 내용

## 공통 기준

앱은 설정 JSON을 먼저 [public/app.js](/home/sqmini/soulai/public/app.js:175) `loadConfigs()`에서 읽습니다.

- `state.configs.asrs`
- `state.configs.dsm`
- `state.configs.report`

이후 각 화면과 분석 함수가 이 값을 사용합니다.

## 파생 변수 사전

아래 값들은 JSON 파일 안의 키가 아니라, JSON 응답을 읽은 뒤 코드가 계산해서 만드는 파생 변수입니다. `jsonlist.md`를 볼 때 함께 알아야 하는 핵심 스키마입니다.

### ASRS 계열

- `totalPositive`
  - 위치: [public/app.js](/home/sqmini/soulai/public/app.js:380)
  - 의미: ASRS 6문항 중 기준 이상으로 잡힌 문항 개수
  - 계산:
    - 1~3번은 `2점 이상`
    - 4~6번은 `3점 이상`
  - 용도:
    - SELF 요약 문장 분기
    - `severity` 계산
    - 저장 시 `positive_count`

- `attentionPositive`
  - 위치: [public/app.js](/home/sqmini/soulai/public/app.js:381)
  - 의미: ASRS 앞 4문항 중 기준 이상 개수
  - 용도:
    - SELF 화면의 `주의력 결핍 n / 4`
    - `attentionMessage`
    - 주관 영역 판단 보조

- `hyperPositive`
  - 위치: [public/app.js](/home/sqmini/soulai/public/app.js:382)
  - 의미: ASRS 뒤 2문항 중 기준 이상 개수
  - 용도:
    - SELF 화면의 `과잉행동·충동성 n / 2`
    - `hyperMessage`
    - 주관 영역 판단 보조

- `severity`
  - 위치: [public/app.js](/home/sqmini/soulai/public/app.js:384)
  - 의미: SELF 화면용 간단 강도 라벨
  - 계산:
    - `totalPositive >= 4`면 `비교적 높음`
    - 아니면 `관찰 필요`
  - 주의:
    - RESULT 리포트의 `severity`와는 별도 개념입니다.

- `asrsPositiveCount`
  - 위치: [server.js](/home/sqmini/soulai/server.js:288)
  - 의미: 서버가 다시 계산한 ASRS 유의미 문항 수
  - 용도:
    - 최종 `severity` 계산
    - metrics 생성

- `attentionPositiveCount`
  - 위치: [server.js](/home/sqmini/soulai/server.js:292)
  - 의미: 서버 기준 ASRS 부주의 유의미 개수
  - 용도:
    - `scores.attention`
    - `scores.executive`
    - `scores.structure`
    - `subjectiveDomain`

- `hyperactivityPositiveCount`
  - 위치: [server.js](/home/sqmini/soulai/server.js:353)
  - 의미: 서버 기준 ASRS 충동/과잉행동 유의미 개수
  - 내부 원천: `impulsePositiveCount`
  - 용도:
    - `subjectiveDomain`
    - 리포트 해석 보조

- `asrsAttentionScore`
  - 위치: [server.js](/home/sqmini/soulai/server.js:304)
  - 의미: ASRS 앞 4문항 점수 합
  - 용도:
    - 리포트 `inattentionSummary`
    - 배지/계획 경향 판정

- `asrsImpulseScore`
  - 위치: [server.js](/home/sqmini/soulai/server.js:305)
  - 의미: ASRS 뒤 2문항 점수 합
  - 용도:
    - 리포트 `impulsivitySummary`
    - 배지/계획 경향 판정

### DSM 계열

- `inattentionYes`
  - 위치: [public/app.js](/home/sqmini/soulai/public/app.js:419)
  - 의미: DSM `부주의` 문항 중 Yes 개수
  - 용도:
    - subtype 판정
    - DSM 요약 문장

- `hyperactivityYes`
  - 위치: [public/app.js](/home/sqmini/soulai/public/app.js:422)
  - 의미: DSM `과잉행동/충동성` 문항 중 Yes 개수
  - 용도:
    - subtype 판정
    - DSM 요약 문장

- `contextualYes`
  - 위치: [public/app.js](/home/sqmini/soulai/public/app.js:425)
  - 의미: DSM `추가 확인` 문항 중 Yes 개수
  - 용도:
    - subtype 직접 판정에는 안 쓰임
    - 생활 영향도와 맥락 보강에 사용

- `subtype`
  - 위치: [public/app.js](/home/sqmini/soulai/public/app.js:432)
  - 의미: DSM 집계 결과를 사람이 읽기 쉬운 분류 문자열로 만든 값
  - 값:
    - `복합형 가능성`
    - `부주의형 가능성`
    - `과잉행동·충동형 가능성`
    - `무증상 범위`
    - `판정 보류`

- `contextualYesCount`
  - 위치: [server.js](/home/sqmini/soulai/server.js:252)
  - 의미: 서버가 다시 계산한 `추가 확인` Yes 개수
  - 용도:
    - `dailyImpactLevel`
    - 최종 metrics

- `dsmSubtype`
  - 위치: [server.js](/home/sqmini/soulai/server.js:358)
  - 의미: 서버 metrics에 들어가는 DSM 분류 결과
  - 용도:
    - 계획 경향 판정
    - 리포트 해석

- `dsmYesCount`
  - 위치: [server.js](/home/sqmini/soulai/server.js:297)
  - 의미: DSM 전체 Yes 개수
  - 용도:
    - 최종 severity
    - emotion/impulse score 계산

- `dailyImpactLevel`
  - 위치: [server.js](/home/sqmini/soulai/server.js:341)
  - 의미: DSM 응답으로 추정한 일상 부담 수준
  - 계산 기반:
    - `dsmImpactScore = totalYesCount + contextualYesCount * 2`
    - 이를 1~5 범위로 보정
  - 용도:
    - `가벼운 피로` ~ `상당한 에너지 소모` 라벨
    - 공감 문장 강도

### 반응성 테스트 계열

- `omissionRate`
  - 위치: [server.js](/home/sqmini/soulai/server.js:306)
  - 출처 테스트:
    - Test1 `signal_detection`
  - 의미: 목표 자극을 놓친 비율
  - 해석:
    - 높을수록 부주의 신호가 강한 쪽
  - 용도:
    - objectiveDomain
    - inattentionSummary
    - 계획 경향 판정

- `commissionRate`
  - 위치: [server.js](/home/sqmini/soulai/server.js:311)
  - 출처 테스트:
    - Test2 `go_nogo`
  - 의미: 누르면 안 되는 자극에 반응한 비율
  - 해석:
    - 높을수록 충동성/억제 실패 신호
  - 용도:
    - objectiveDomain
    - impulsivitySummary
    - 계획 경향 판정

- `reactionVariability`
  - 위치: [server.js](/home/sqmini/soulai/server.js:317)
  - 출처 테스트:
    - Test1 `signal_detection`
  - 의미: 반응시간 흔들림 정도
  - 해석:
    - 높을수록 집중 일관성이 흔들리는 편

- `tau`
  - 위치: [server.js](/home/sqmini/soulai/server.js:318)
  - 출처 테스트:
    - Test1 `signal_detection`
  - 의미: 느리게 처지는 반응 꼬리 폭
  - 해석:
    - 클수록 일부 반응이 많이 늦어지는 패턴

- `latePhaseDrop`
  - 위치: [server.js](/home/sqmini/soulai/server.js:319)
  - 출처 테스트:
    - Test1 `signal_detection`
  - 의미: 검사 후반부 집중 저하 정도
  - 해석:
    - 높을수록 후반 유지력이 떨어짐

- `fastErrorRate`
  - 위치: [server.js](/home/sqmini/soulai/server.js:320)
  - 출처 테스트:
    - Test2 `go_nogo`
  - 의미: 너무 빠르게 잘못 반응한 비율
  - 해석:
    - 충동성/성급 반응 보조 지표

- `meanGoReactionTime`
  - 위치: [server.js](/home/sqmini/soulai/server.js:321)
  - 출처 테스트:
    - Test2 `go_nogo`
  - 의미: Go 자극 평균 반응시간
  - 해석:
    - 너무 빠르거나 너무 느린 패턴을 같이 봄

- `stableDurationPct`
  - 위치: [server.js](/home/sqmini/soulai/server.js:322)
  - 출처 테스트:
    - Test3 `balance_hold`
  - 의미: 균형 유지 테스트에서 안정 구간에 머문 비율
  - 해석:
    - 낮을수록 흔들림이 큰 편

- `spikeCount`
  - 위치: [server.js](/home/sqmini/soulai/server.js:323)
  - 출처 테스트:
    - Test3 `balance_hold`
  - 의미: 큰 흔들림 횟수
  - 해석:
    - 높을수록 활동성/자기조절 보조 신호가 큼

### 통합 해석 계열

- `subjectiveDomain`
  - 위치: [server.js](/home/sqmini/soulai/server.js:334)
  - 의미: 자가보고 기준으로 더 두드러진 영역
  - 값:
    - `부주의`
    - `충동성`

- `objectiveDomain`
  - 위치: [server.js](/home/sqmini/soulai/server.js:333)
  - 의미: 반응성 테스트 기준으로 더 두드러진 영역
  - 계산:
    - `omissionRate >= commissionRate`면 `부주의`
    - 아니면 `충동성`

- `alignment`
  - 위치: [server.js](/home/sqmini/soulai/server.js:335)
  - 의미: 주관적 체감과 객관적 측정이 같은 방향인지
  - 값:
    - `일치`
    - `불일치`
    - `혼합`
  - 용도:
    - `alignmentLabel`
    - `alignmentSummary`
    - 리포트 hero/crossCheck 문장

- `severity`
  - 위치: [server.js](/home/sqmini/soulai/server.js:343)
  - 의미: 최종 리포트용 전체 강도 레벨
  - 값:
    - `높음`
    - `중간`
    - `낮음`
  - 계산 기준:
    - ASRS 유의미 문항 수
    - DSM 부주의/과잉행동 Yes 수
    - DSM 전체 Yes 수

### 점수 축 계열

- `scores.attention`
  - 의미: 집중 유지 축 점수
- `scores.executive`
  - 의미: 실행 기능 축 점수
- `scores.impulse`
  - 의미: 충동 조절 축 점수
- `scores.emotion`
  - 의미: 정서 안정 축 점수
- `scores.structure`
  - 의미: 일상 구조화 축 점수

이 값들은 [server.js](/home/sqmini/soulai/server.js:299)~[server.js](/home/sqmini/soulai/server.js:303)에서 계산되며, 리포트 점수축과 내부 해석 기준으로 쓰입니다.

---

## 1. `config/asrs.json`

파일: [config/asrs.json](/home/sqmini/soulai/config/asrs.json)

### 주요 키와 의미

- `title`
  - 의미: ASRS 단계 화면 제목
  - 영향 변수: `state.configs.asrs.title`
  - 반영: 화면 헤더/질문 카드 문맥

- `description`
  - 의미: 응답 기준 설명
  - 영향 변수: `state.configs.asrs.description`
  - 반영: 최근 6개월 기준 안내 문구

- `scale`
  - 의미: 선택지 값과 라벨
  - 구조: `{ value, label }[]`
  - 영향 변수: `state.configs.asrs.scale`
  - 반영:
    - ASRS 선택 버튼 개수
    - 각 버튼의 숫자와 라벨
  - 중요한 점:
    - 실제 의미 점수는 `value`
    - 사용자에게 보이는 텍스트는 `label`

- `questions`
  - 의미: 문항 목록
  - 구조: `{ prompt, examples[] }[]`
  - 영향 변수: `state.configs.asrs.questions`
  - 반영:
    - 질문 수
    - 질문 본문
    - 예시 문장
    - 진행률 계산의 분모

### 값이 미치는 계산 영향

- `questions.length`
  - ASRS 완료 기준에 영향
  - 현재 로컬 분석은 6문항을 전제로 함

- `scale[].value`
  - `record.tests.asrs[*].answer`로 저장되는 실제 숫자값
  - 이후 [public/app.js](/home/sqmini/soulai/public/app.js:374) `analyzeAsrs()`에 들어감
  - 파생 변수:
    - `totalPositive`
    - `attentionPositive`
    - `hyperPositive`
    - `severity`
    - `summary`
    - `attentionMessage`
    - `hyperMessage`
    - `guidance`

### 주의

- ASRS의 기준치는 JSON 안에 있지 않고 코드에 하드코딩되어 있습니다.
  - 기준: `[2, 2, 2, 3, 3, 3]` [public/app.js](/home/sqmini/soulai/public/app.js:380)
- 즉 질문 문구를 바꾸는 것은 JSON에서 가능하지만, 판정 기준을 바꾸려면 코드도 수정해야 합니다.

---

## 2. `config/dsm-5.json`

파일: [config/dsm-5.json](/home/sqmini/soulai/config/dsm-5.json)

### 주요 키와 의미

- `title`
  - 의미: DSM 단계 제목
  - 영향 변수: `state.configs.dsm.title`

- `description`
  - 의미: 응답 기준 설명
  - 영향 변수: `state.configs.dsm.description`

- `questions`
  - 의미: DSM 문항 목록
  - 구조: `{ section, prompt, hint }[]`
  - 영향 변수: `state.configs.dsm.questions`
  - 반영:
    - 질문 수
    - 질문 본문
    - 힌트
    - `section`별 집계 로직

### `section` 값의 의미

- `부주의`
  - 앱 변수 영향:
    - `inattentionYes`
    - `inattention_true_count`
  - 의미:
    - 집중 유지, 정리, 기억, 시작/마무리 관련 신호

- `과잉행동/충동성`
  - 앱 변수 영향:
    - `hyperactivityYes`
    - `hyperactivity_true_count`
  - 의미:
    - 안절부절, 즉각 반응, 기다리기 어려움 관련 신호

- `추가 확인`
  - 앱 변수 영향:
    - `contextualYes`
    - `contextual_true_count`
    - `dailyImpactLevel` 계산 보조
  - 의미:
    - 지속 기간, 아동기 시작, 다중 환경, 기능 저하, 다른 원인 배제 같은 맥락 확인

### 값이 미치는 계산 영향

각 문항의 `answer`는 boolean으로 저장되고, [public/app.js](/home/sqmini/soulai/public/app.js:417) `analyzeDsm()`에서 아래 변수로 집계됩니다.

- `inattentionYes`
- `hyperactivityYes`
- `contextualYes`
- `subtype`
- `summary`
- `detail`

subtype 판정 기준:

- `inattentionYes >= 6 && hyperactivityYes >= 6`
  - `복합형 가능성`
- `inattentionYes >= 6`
  - `부주의형 가능성`
- `hyperactivityYes >= 6`
  - `과잉행동·충동형 가능성`
- 그 외
  - `무증상 범위`

### 추가 확인 문항의 실제 영향

`추가 확인`은 subtype을 직접 바꾸지 않습니다. 대신 서버에서 아래 값에 영향을 줍니다.

- `contextualYesCount` [server.js](/home/sqmini/soulai/server.js:252)
- `dsmImpactScore = totalYesCount + contextualYesCount * 2` [server.js](/home/sqmini/soulai/server.js:340)
- `dailyImpactLevel` [server.js](/home/sqmini/soulai/server.js:341)

즉 의미는:

- 본문 증상 수치 자체보다
- "이 신호가 실제 ADHD 맥락으로 볼 만한가"
- "생활 영향이 어느 정도인가"

를 보강하는 값입니다.

### 주의

- DSM 질문 수는 현재 23개지만, subtype 핵심 판정은 앞 18개가 중심입니다.
- `section` 이름을 바꾸면 집계가 깨질 수 있습니다. 현재 코드는 문자열 비교로 집계합니다. [public/app.js](/home/sqmini/soulai/public/app.js:420)

---

## 3. `config/report.json`

파일: [config/report.json](/home/sqmini/soulai/config/report.json)

### 주요 키와 의미

- `radarAxes`
  - 의미: 리포트 축 라벨 후보
  - 구조: 문자열 배열

- `sections`
  - 의미: 리포트 섹션 메타 정보
  - 구조: `{ key, title, description }[]`

### 현재 영향도

이 파일은 [public/app.js](/home/sqmini/soulai/public/app.js:175)에서 로드되지만, 현재 렌더링/계산 코드에서 직접 참조되지 않습니다.

즉 현재 상태 기준으로는:

- `state.configs.report`에 저장되지만
- 실제 변수 계산값이나 화면 문장에는 직접 영향이 거의 없습니다.

### 의미

이 파일은 현재는 "리포트 구조의 선언적 메타"에 가깝고, 런타임 본체는 아닙니다.

실제 리포트 문장 본체는:

- 서버의 `buildDeterministicReport()`
- 저장된 `record.report`

가 담당합니다.

---

## 4. `game/test1/test1.json`

파일: [game/test1/test1.json](/home/sqmini/soulai/game/test1/test1.json)

### 주요 키와 의미

- `script_id`
  - 의미: 튜토리얼 스크립트 식별자
  - 현재 영향: 메타 성격, 런타임 직접 사용 없음

- `title`
  - 의미: 튜토리얼 제목
  - 현재 영향: 직접 사용 없음

- `game_type`
  - 의미: 어떤 테스트용 스크립트인지 설명
  - 현재 영향: 직접 사용 없음

- `tutorial_rules`
  - 의미: 튜토리얼 규칙 설명 메타
  - 현재 영향: 현재 JS는 직접 사용하지 않음

- `lines`
  - 의미: 실제 튜토리얼 대사 배열
  - 영향 변수: `tutorialLines`
  - 반영: [public/test1/test1.js](/home/sqmini/soulai/public/test1/test1.js:150)

### `lines[*]` 각 키 영향

- `speaker`
  - 영향 변수:
    - `tutorialSpeaker.textContent`
    - 캐릭터 이미지 선택
  - 의미:
    - 누가 말하는지

- `expression`
  - 영향 변수:
    - `resolveCharacterImage()`
  - 의미:
    - 어떤 표정 PNG를 보여줄지

- `expression_kr`
  - 현재 영향:
    - 설명용 메타
    - 런타임 직접 사용 없음

- `text`
  - 영향 변수:
    - `tutorialText.textContent`
  - 의미:
    - 실제 화면 대사

### 주의

- 이 JSON은 테스트 로직 자체를 바꾸지 않습니다.
- 오직 튜토리얼 대화만 바꿉니다.
- 실제 점수/판정은 JS 상수와 로직이 담당합니다.

---

## 5. `game/test2/test2.json`

파일: [game/test2/test2.json](/home/sqmini/soulai/game/test2/test2.json)

구조와 영향은 `test1.json`과 거의 같습니다.

### 실제 영향

- 사용되는 핵심 키: `lines`
- 연결 변수: `tutorialLines`
- 반영:
  - 화자 이름
  - 표정 이미지
  - 튜토리얼 텍스트

### 의미

- `tutorial_rules.goal`
  - 통나무를 타이밍 맞춰 클릭해야 함
- `avoid_targets`
  - 폭탄/당근 회피

하지만 현재 런타임은 이 규칙 설명을 읽어 점수 계산을 바꾸지 않습니다. 실제 판정은 코드가 직접 합니다.

예:

- `activeType === "log"`일 때 늦은 클릭 인정 [public/test2/test2.js](/home/sqmini/soulai/public/test2/test2.js:206)
- `bomb`, `carot`는 클릭하지 않아야 정답

즉 JSON은 "설명", 코드는 "판정"입니다.

---

## 6. `game/test3/test3.json`

파일: [game/test3/test3.json](/home/sqmini/soulai/game/test3/test3.json)

구조와 영향은 역시 튜토리얼 중심입니다.

### 실제 영향

- 사용되는 핵심 키: `lines`
- 연결 변수: `tutorialLines`
- 화면 변수:
  - `tutorialSpeaker`
  - `tutorialText`
  - 캐릭터 이미지

### 의미

- `tutorial_rules.input_mode.gyro_supported`
  - 자이로 가능 시 손으로 균형
- `tutorial_rules.input_mode.gyro_not_supported`
  - 자이로 불가 시 버튼 유지

하지만 현재 JS는 이 키를 직접 읽지 않고, 설명용 대사만 표시합니다.

실제 테스트 로직은 코드 상수로 움직입니다.

- `DURATION_MS = 20000`
- `TICK_MS = 100`
- `STABLE_RADIUS = 0.28`

즉 이 JSON은 "검사 설명용", 점수 계산은 "코드 고정"입니다.

---

## 7. `game/scripts/opening.json`

파일: [game/scripts/opening.json](/home/sqmini/soulai/game/scripts/opening.json)

### 주요 키와 의미

- `script_id`
  - 메타 식별자
  - 현재 직접 사용 없음

- `title`
  - 제목 메타
  - 현재 직접 사용 없음

- `stage`
  - 의미: 기본 배경 스테이지
  - 영향 변수:
    - `frame.stage`
    - `stageToBackground()`
  - 반영:
    - `/game/images/stage1.png` 같은 배경 선택 [public/game/game.js](/home/sqmini/soulai/public/game/game.js:21)

- `characters`
  - 의미: 캐릭터/표정 설명 사전
  - 현재 직접 사용 없음

- `lines`
  - 의미: 실제 스토리 프레임
  - 영향 변수: `timeline`

### `lines[*]` 각 키 영향

- `speaker`
  - 누가 말하는지
  - `meta.textContent`와 캐릭터 표시 결정

- `expression`
  - 어떤 표정 이미지를 띄울지 결정

- `text`
  - 말풍선 본문

- `stage`
  - line별로 있으면 해당 프레임 배경 스테이지 override
  - 없으면 `json.stage` 또는 sequence의 기본 stage 사용 [public/game/game.js](/home/sqmini/soulai/public/game/game.js:110)

### 의미

이 파일은 숲 스토리의 "연출 타임라인"을 정의합니다.

---

## 8. `game/scripts/100.json` ~ `800.json`

대표 파일:

- [game/scripts/100.json](/home/sqmini/soulai/game/scripts/100.json)
- [game/scripts/200.json](/home/sqmini/soulai/game/scripts/200.json)
- ...
- [game/scripts/800.json](/home/sqmini/soulai/game/scripts/800.json)

### 공통 구조

이 파일들은 `opening.json`과 동일하게 `lines` 중심으로 읽힙니다.

실제 영향:

- `SCRIPT_SEQUENCE`에 따라 순서대로 로드 [public/game/game.js](/home/sqmini/soulai/public/game/game.js:1)
- 각 `lines[*]`가 `timeline` 프레임으로 합쳐짐
- `entry.label`이 각 프레임의 라벨이 됨

### 변수 영향

- `lines[*].speaker`
  - 현재 보이는 발화자
- `lines[*].expression`
  - 현재 캐릭터 표정
- `lines[*].text`
  - 현재 대사
- `lines[*].stage`
  - 배경 단계 override

### 의미

이 JSON들은 점수 계산과는 무관하고, 숲 스토리 연출과 캐릭터 상태 전환만 담당합니다.

---

## 9. `game/scripts/plan.json`

파일: [game/scripts/plan.json](/home/sqmini/soulai/game/scripts/plan.json)

### 주요 키와 의미

- `script_id`, `title`, `game_type`
  - 메타
  - 현재 직접 사용 없음

- `plan_rules`
  - 계획 게임 규칙 설명 메타
  - 현재 JS는 직접 읽지 않음

- `lines`
  - 실제 튜토리얼 대사
  - 영향 변수: `state.tutorialLines` [public/plangame/plangame.js](/home/sqmini/soulai/public/plangame/plangame.js:213)

### `plan_rules`가 의미하는 실제 앱 규칙

비록 JSON을 직접 읽지는 않지만, 아래 규칙은 코드에 대응됩니다.

- `goal_count: 3`
  - 대응 코드: `GOAL_COUNT = 3` [public/plangame/plangame.js](/home/sqmini/soulai/public/plangame/plangame.js:11)

- `score_per_completed_goal: 10`
  - 대응 코드: 완료 시 `+10점`

- `cooldown`
  - 대응 코드: `COOLDOWN_MS = 60 * 60 * 1000`

- `goal_source`
  - 대응 코드: `record.plan.suggestions`를 기본 목표로 사용 [public/plangame/plangame.js](/home/sqmini/soulai/public/plangame/plangame.js:40)

즉 `plan_rules`는 현재 "설명과 코드가 같은 내용을 각각 가진 상태"입니다.

---

## 10. `database/*.json` 저장 레코드

이건 수동 설정 JSON이 아니라 런타임 결과물입니다. 하지만 앱 변수에 가장 큰 영향을 주는 JSON이기도 합니다.

### 핵심 구조

- `id`
  - 사용자 식별자
- `currentStep`
  - 현재 진행 단계
- `tests.asrs`
  - ASRS 원본 응답 또는 요약
- `tests.dsm5`
  - DSM 원본 응답 또는 요약
- `tests.game`
  - 반응성 테스트 결과
- `asrsAnalysis`
  - SELF용 AI/로컬 요약
- `dsm5QuickAnalysis`
  - SYM용 AI/로컬 요약
- `report`
  - RESULT용 리포트
- `plan`
  - PLAN 제안과 채팅
- `planGame`
  - 플랜 게임 진행 상태
- `dtx`
  - 숲 stage와 누적 점수 상태
- `tutorials`
  - plan/build/chop 튜토리얼 시청 여부

### 각 필드 의미

- `tests.asrs[*].answer`
  - 자가보고 점수 원본
  - 영향:
    - `analyzeAsrs()`
    - `computeAssessmentMetrics()`

- `tests.dsm5[*].answer`
  - Yes/No 원본
  - 영향:
    - `analyzeDsm()`
    - `analyzeDsmRecord()`
    - `dailyImpactLevel`

- `tests.game.tests.signal_detection`
  - 영향:
    - `omissionRate`
    - `reactionVariability`
    - `tau`
    - `latePhaseDrop`

- `tests.game.tests.go_nogo`
  - 영향:
    - `commissionRate`
    - `fastErrorRate`
    - `meanGoReactionTime`

- `tests.game.tests.balance_hold`
  - 영향:
    - `stableDurationPct`
    - `spikeCount`

- `asrsAnalysis.summary`
  - SELF 결과 상단 요약

- `dsm5QuickAnalysis.summary`
  - SYM 결과 상단 요약

- `report.hero.summary`
  - RESULT 메인 요약

- `report.crossCheck.alignmentSummary`
  - 주관/객관 일치 해석

- `plan.suggestions`
  - 플랜 게임 기본 목표 3개 source

- `plan.chat`
  - 채팅 히스토리

- `planGame.goals`
  - 플랜 게임 목표 카드의 실제 저장 상태

- `dtx.totalScore`
  - 숲 전체 누적 점수

- `dtx.stage`
  - 현재 stage (`stage1`~`stage5`)

- `dtx.scores.plangame`
  - 플랜 게임 점수

- `tutorials.plan`, `tutorials.build`, `tutorials.chop`
  - 각 튜토리얼 재생 여부

### 의미

설정 JSON이 "규칙과 질문"이라면, `database/*.json`은 "사용자별 실제 상태값"입니다. 최근 버전에서는 검사 본체뿐 아니라 `DTx`, `plangame`, 튜토리얼 상태도 이 레코드 하나로 이어집니다.

---

## 수정할 때의 기준

### JSON만 바꾸면 되는 경우

- 질문 문구 수정
- 힌트 문구 수정
- 튜토리얼 대사 수정
- 스토리 배경 stage 지정 수정

### 코드도 같이 바꿔야 하는 경우

- ASRS 기준치 변경
- DSM subtype 판정 규칙 변경
- 반응성 테스트 점수 규칙 변경
- plan goal 개수/쿨다운/점수 변경
- report.json 메타를 실제 렌더링에 연결하려는 경우

---

## 핵심 정리

이 저장소의 JSON은 크게 세 종류입니다.

1. 질문 정의형
   - `asrs.json`, `dsm-5.json`
   - 질문 수, 질문 문장, 섹션 분류에 영향

2. 연출/튜토리얼형
   - `test1.json`, `test2.json`, `test3.json`, `opening.json`, `100~800.json`, `plan.json`
   - 대사, 발화자, 표정, 배경에 영향

3. 상태 저장형
   - `database/*.json`
   - 실제 점수, 해석, 리포트, 계획, `DTx` stage, `plangame` 진행 상태에 영향

중요한 점은, JSON 안에 있어 보여도 실제로 계산에 안 쓰이는 메타 키가 많다는 것입니다. 특히 튜토리얼의 `tutorial_rules`, `plan_rules`, 스토리의 `characters`, 리포트의 `report.json` 메타는 현재 구현 기준으로 설명용 비중이 큽니다.

## 현재 상태 메모

- `config/report.json`은 로드되지만 현재 핵심 리포트 본문 계산의 주체는 아닙니다.
- `game/test1|2|3/*.json`, `game/scripts/*.json`은 주로 튜토리얼/스토리 연출을 담당합니다.
- 실제 점수 계산, subtype 판정, report/plan 생성은 대부분 `public/app.js`, `public/test*.js`, `public/game/game.js`, `public/plangame/plangame.js`, `server.js`가 담당합니다.
- `/map` 화면은 이 문서 내용을 시각적으로 압축한 구조도입니다.
