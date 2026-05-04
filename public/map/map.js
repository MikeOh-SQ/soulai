const nodes = [
  {
    id: "asrs-json",
    kind: "source",
    flowChannels: ["asrs"],
    x: 70,
    y: 90,
    title: "config/asrs.json",
    short: "SELF 문항, 선택지, 설명의 원본",
    summary: "자가보고 선별 6문항의 질문 본문과 scale을 정의합니다. 점수 기준 자체는 JSON이 아니라 코드에 있습니다.",
    bullets: [
      "state.configs.asrs로 로드됩니다.",
      "questions가 화면 질문 수와 진행률 분모를 결정합니다.",
      "scale.value가 record.tests.asrs[*].answer의 실제 숫자값이 됩니다."
    ],
    schema: [
      ["title", "SELF 단계 제목"],
      ["description", "최근 6개월 기준 안내 문구"],
      ["scale[]", "선택지 값과 라벨"],
      ["questions[]", "prompt, examples로 구성된 문항 목록"]
    ],
    links: [
      "analyzeAsrs()가 이 응답을 totalPositive, attentionPositive, hyperPositive로 집계합니다.",
      "POST /api/ai/asrs-analysis 프롬프트에 record와 analysis가 함께 들어갑니다."
    ]
  },
  {
    id: "dsm-json",
    kind: "source",
    flowChannels: ["dsm"],
    x: 70,
    y: 360,
    title: "config/dsm-5.json",
    short: "SYM 문항과 section 분류의 원본",
    summary: "증상 기준 체크 23문항의 질문 본문과 section 분류를 정의합니다. section 문자열이 subtype 집계에 직접 연결됩니다.",
    bullets: [
      "부주의 9문항, 과잉행동/충동성 9문항, 추가 확인 5문항 구조입니다.",
      "section 값은 문자열 비교로 집계되므로 이름을 바꾸면 로직이 깨질 수 있습니다.",
      "추가 확인 문항은 subtype보다 맥락과 dailyImpactLevel에 더 큰 영향을 줍니다."
    ],
    schema: [
      ["title", "SYM 단계 제목"],
      ["description", "응답 기준 안내"],
      ["questions[].section", "부주의 / 과잉행동/충동성 / 추가 확인"],
      ["questions[].prompt", "문항 본문"],
      ["questions[].hint", "설명 보조 문구"]
    ],
    links: [
      "analyzeDsm()가 inattentionYes, hyperactivityYes, contextualYes, subtype을 만듭니다.",
      "POST /api/ai/dsm-analysis 프롬프트에 record와 analysis가 들어갑니다."
    ]
  },
  {
    id: "report-json",
    kind: "source",
    flowChannels: [],
    x: 70,
    y: 900,
    title: "config/report.json",
    short: "리포트 메타 구조 선언",
    summary: "report.json은 로드되지만 현재 핵심 계산이나 렌더링에는 직접 연결되지 않습니다. 선언형 메타에 가깝습니다.",
    bullets: [
      "state.configs.report에 적재됩니다.",
      "radarAxes와 sections 메타를 담고 있습니다.",
      "실제 RESULT 본문은 buildDeterministicReport()와 record.report가 담당합니다."
    ],
    schema: [
      ["radarAxes[]", "리포트 축 라벨 후보"],
      ["sections[]", "key, title, description 메타"]
    ],
    links: [
      "현재 런타임 영향은 낮습니다.",
      "향후 선언형 리포트 렌더링으로 바꾸면 이 파일의 비중이 커질 수 있습니다."
    ]
  },
  {
    id: "tutorial-jsons",
    kind: "source",
    flowChannels: ["react"],
    x: 70,
    y: 630,
    title: "config/react.json",
    short: "일반 진단 REACT 3종 정의 원본",
    summary: "REACT 3종인 신호 찾기, 멈춤 버튼, 균형 유지를 정의합니다. 점수 계산 로직 자체는 바꾸지 않습니다.",
    bullets: [
      "신호 찾기는 목표 자극만 클릭하는 규칙을 안내합니다.",
      "멈춤 버튼은 Go / No-Go 억제 반응 규칙을 담습니다.",
      "균형 유지는 중앙 유지와 입력 방식을 담습니다."
    ],
    schema: [
      ["signalFind", "신호 찾기 규칙 안내 정의"],
      ["stopButton", "멈춤 버튼 규칙 안내 정의"],
      ["balanceHold", "균형 유지 규칙 안내 정의"],
      ["lines[].text", "화면에 노출되는 테스트 안내 문구"]
    ],
    links: [
      "public/test1/test1.js, public/test2/test2.js, public/test3/test3.js가 각 테스트 시작 안내와 규칙 문구를 읽습니다.",
      "REACT 완료 후 summarizeReactivity()와 computeAssessmentMetrics(record)가 결과 해석과 점수 집계에 연결됩니다."
    ]
  },
  {
    id: "local-self",
    kind: "derived",
    flowChannels: ["asrs"],
    x: 520,
    y: 120,
    title: "SELF local schema",
    short: "analyzeAsrs() 파생 변수",
    summary: "ASRS 응답을 기반으로 프런트가 먼저 만드는 로컬 요약 스키마입니다. AI 결과가 오기 전 임시 해석이자 fallback입니다.",
    bullets: [
      "totalPositive는 기준 이상 문항 수입니다.",
      "attentionPositive는 앞 4문항, hyperPositive는 뒤 2문항 기준 이상 개수입니다.",
      "summary, attentionMessage, hyperMessage, guidance가 화면 fallback 문장입니다."
    ],
    schema: [
      ["totalPositive", "유의미 문항 총 개수"],
      ["attentionPositive", "주의력 결핍 관련 유의미 개수"],
      ["hyperPositive", "과잉행동·충동성 관련 유의미 개수"],
      ["severity", "비교적 높음 / 관찰 필요"],
      ["summary", "상단 hero용 기본 요약"],
      ["attentionMessage", "주의력 결핍 설명"],
      ["hyperMessage", "과잉행동/충동성 설명"],
      ["guidance", "다음 단계 권고"]
    ],
    links: [
      "SELF 결과 화면이 AI 응답 전 이 스키마를 먼저 보여줍니다.",
      "SELF AI 해석의 직접 입력 스키마 중 하나입니다.",
      "RESULT 화면 fallback 조립에도 참여합니다."
    ]
  },
  {
    id: "local-sym",
    kind: "derived",
    flowChannels: ["dsm"],
    x: 520,
    y: 390,
    title: "SYM local schema",
    short: "analyzeDsm() + buildLocalDsmQuickAnalysis()",
    summary: "DSM 응답을 프런트가 2단계로 요약합니다. 1차 집계(analyzeDsm) 후, 화면 표시용 quick analysis 스키마로 다시 가공합니다.",
    bullets: [
      "inattentionYes, hyperactivityYes, contextualYes를 먼저 집계합니다.",
      "subtype은 부주의형/과잉행동형/복합형/무증상 범위로 분기합니다.",
      "quickAnalysis는 AI와 동일한 필드명(summary, subtype, inattention, hyperactivity, guidance)을 사용합니다."
    ],
    schema: [
      ["inattentionYes", "DSM 부주의 Yes 개수"],
      ["hyperactivityYes", "DSM 과잉행동/충동성 Yes 개수"],
      ["contextualYes", "추가 확인 Yes 개수"],
      ["subtype", "현재 분류 문자열"],
      ["summary", "상단 hero 요약"],
      ["detail", "세부 해석 문장"],
      ["guidance", "현재 상태 참고용 안내"]
    ],
    links: [
      "SYM AI 해석의 직접 입력 스키마 중 하나입니다.",
      "RESULT 화면 fallback 조립에도 참여합니다."
    ]
  },
  {
    id: "reactivity-summary",
    kind: "derived",
    flowChannels: ["react"],
    x: 520,
    y: 660,
    title: "Reactivity summary schema",
    short: "summarizeReactivity() 누적 요약",
    summary: "반응성 테스트가 끝날 때마다 갱신되는 중간 요약입니다. Test1, Test2, Test3 점수와 highlight를 사람이 읽기 쉬운 형태로 정리합니다.",
    bullets: [
      "inattention_signal.score는 Test1 signal_detection 점수입니다.",
      "impulsivity_signal.score는 Test2 go_nogo 점수입니다.",
      "activity_signal.score는 Test3 balance_hold 점수입니다."
    ],
    schema: [
      ["summary", "가장 높은 영역을 한 줄로 설명"],
      ["highlights[]", "핵심 지표 카드 목록"],
      ["inattention_signal", "Test1 점수"],
      ["impulsivity_signal", "Test2 점수"],
      ["activity_signal", "Test3 점수"]
    ],
    links: [
      "REACT 완료 화면의 핵심 한 줄과 metric 카드에 쓰입니다.",
      "POST /api/ai/react-analysis의 직접 입력 analysis 스키마입니다.",
      "RESULT 화면 fallback과 배지 계산의 보조 근거로 쓰입니다."
    ]
  },
  {
    id: "metrics",
    kind: "derived",
    flowChannels: ["asrs", "dsm", "react"],
    x: 520,
    y: 930,
    title: "Server metrics schema",
    short: "computeAssessmentMetrics(record)",
    summary: "이 사이트의 핵심 통합 스키마입니다. ASRS 응답, DSM 응답, 반응성 테스트 결과를 하나의 metrics 객체로 합칩니다.",
    bullets: [
      "omissionRate, reactionVariability, tau, latePhaseDrop는 Test1 signal_detection 출처입니다.",
      "commissionRate, fastErrorRate, meanGoReactionTime는 Test2 go_nogo 출처입니다.",
      "stableDurationPct, spikeCount는 Test3 balance_hold 출처입니다.",
      "alignment, subjectiveDomain, objectiveDomain, dailyImpactLevel이 최종 리포트 해석의 핵심 축입니다."
    ],
    schema: [
      ["asrsPositiveCount", "서버 기준 ASRS 유의미 문항 수"],
      ["dsmSubtype", "서버 기준 DSM 분류"],
      ["omissionRate", "Test1 목표 놓침 비율"],
      ["commissionRate", "Test2 잘못된 반응 비율"],
      ["reactionVariability", "Test1 반응시간 변동성"],
      ["tau", "Test1 느리게 처지는 반응 폭"],
      ["latePhaseDrop", "Test1 후반 저하"],
      ["fastErrorRate", "Test2 성급 반응 비율"],
      ["stableDurationPct", "Test3 안정 유지 비율"],
      ["spikeCount", "Test3 큰 흔들림 횟수"],
      ["alignment", "일치 / 불일치 / 혼합"],
      ["dailyImpactLevel", "1~5 부담 수준"]
    ],
    links: [
      "buildDeterministicReport(), buildPlanForMetrics(), 모든 AI 프롬프트의 공통 입력입니다.",
      "jsonlist.md의 파생 변수 사전과 가장 직접적으로 대응합니다.",
      "개념적으로는 SELF/SYM/REACT 원본 입력을 한 번 더 압축한 통합 해석 계층입니다."
    ]
  },
  {
    id: "ai-self",
    kind: "ai",
    flowChannels: ["asrs"],
    x: 980,
    y: 160,
    title: "POST /api/ai/asrs-analysis",
    short: "SELF AI 해석",
    summary: "SELF 원본 응답과 local SELF analysis, 통합 metrics를 받아 summary, attention, hyperactivity, guidance를 JSON으로 돌려주는 AI 엔드포인트입니다.",
    bullets: [
      "프롬프트는 buildAsrsAnalysisPrompt()가 만듭니다.",
      "RAG 검색 없이 SELF 응답 맥락, analysis, metrics를 그대로 주입합니다.",
      "응답이 비어도 서버 fallback 문구가 채워집니다."
    ],
    schema: [
      ["입력", "{ record, analysis }"],
      ["프롬프트 입력", "record + analysis + metrics"],
      ["출력.summary", "SELF 상단 요약"],
      ["출력.attention", "주의력 결핍 해석"],
      ["출력.hyperactivity", "과잉행동/충동성 해석"],
      ["출력.guidance", "권고 문구"]
    ],
    promptText: `서비스: ADHDQQ.COM ADHD 선별/감별 보조 모바일 웹 앱
역할: 자가보고 선별 결과를 짧고 공감적으로 해석하는 한국어 선별 보조 AI
중요: 진단 확정 표현 금지, 선별 결과와 추가 평가 권고 수준으로만 작성
자가보고 선별 기준:
- 1, 2, 3번 문항은 가끔(2) 이상이면 유의미
- 4, 5, 6번 문항은 자주(3) 이상이면 유의미
- 유의미 문항 4개 이상이면 추가 평가를 적극 고려할 수 있는 수준
기록 JSON:
{record}
계산된 자가보고 선별 해석용 지표:
{analysis}
보조 점수:
{metrics}
요청:
1. summary는 전체 경향을 2문장 이내로 요약
2. attention는 주의력 결핍 관련 강도를 2문장 이내로 설명
3. hyperactivity는 과잉행동/충동성 관련 강도를 2문장 이내로 설명
4. guidance는 선별 도구 한계와 다음 단계 권고를 2문장 이내로 설명
5. 한국어로만 작성`,
    links: [
      "SELF 화면이 AI 응답 우선, 로컬 fallback 후순위로 표시합니다.",
      "입력 의미 기준으로 보면 SELF 로컬 스키마와 통합 metrics가 AI 해석으로 이어지는 구조입니다."
    ]
  },
  {
    id: "ai-sym",
    kind: "ai",
    flowChannels: ["dsm"],
    x: 980,
    y: 430,
    title: "POST /api/ai/dsm-analysis",
    short: "SYM AI 해석",
    summary: "SYM 원본 응답과 DSM local analysis, 통합 metrics를 받아 summary, subtype, inattention, hyperactivity, guidance를 JSON으로 돌려줍니다.",
    bullets: [
      "프롬프트는 buildDsmAnalysisPrompt()가 만듭니다.",
      "Gemini 미설정 시 이 단계는 로컬 quickAnalysis로 대체됩니다.",
      "AI와 로컬이 같은 스키마를 써서 화면 우선순위가 단순합니다."
    ],
    schema: [
      ["입력", "{ record, analysis }"],
      ["출력.summary", "SYM 상단 요약"],
      ["출력.subtype", "현재 분류 해석"],
      ["출력.inattention", "부주의 설명"],
      ["출력.hyperactivity", "과잉행동/충동성 설명"],
      ["출력.guidance", "권고 문구"]
    ],
    promptText: `서비스: ADHDQQ.COM ADHD 선별/감별 보조 모바일 웹 앱
역할: 증상 기준 체크 결과를 짧고 공감적으로 해석하는 한국어 선별 보조 AI
중요: 진단 확정 표현 금지, 선별 결과와 추가 평가 권고 수준으로만 작성
증상 기준 체크 판정 기준:
- 부주의 9문항 중 6개 이상 Yes면 부주의형 가능성
- 과잉행동/충동성 9문항 중 6개 이상 Yes면 과잉행동/충동형 가능성
- 두 영역이 모두 6개 이상 Yes면 복합형 가능성
- 두 영역 모두 6개 미만 Yes면 무증상 범위
- 본 결과는 진단이 아니라 현재 상태를 참고하기 위한 것입니다.
기록 JSON:
{record}
계산된 증상 기준 체크 해석용 지표:
{analysis}
보조 점수:
{metrics}
요청:
1. summary는 전체 경향을 2문장 이내로 요약
2. subtype는 현재 분류를 공감적으로 2문장 이내로 설명
3. inattention는 부주의 영역 해석을 2문장 이내로 설명
4. hyperactivity는 과잉행동/충동성 영역 해석을 2문장 이내로 설명
5. guidance는 선별 도구 한계와 다음 단계 권고를 2문장 이내로 설명
6. 한국어로만 작성`,
    links: [
      "SYM 화면은 quickAnalysis 스키마를 그대로 렌더링합니다.",
      "입력 의미 기준으로 보면 SYM 로컬 스키마와 통합 metrics가 AI 해석으로 이어집니다."
    ]
  },
  {
    id: "ai-react",
    kind: "ai",
    flowChannels: ["react"],
    x: 980,
    y: 690,
    title: "POST /api/ai/react-analysis",
    short: "REACT AI 해석",
    summary: "반응성 테스트 로컬 요약과 통합 metrics를 받아 summary, inattention, impulsivity, hyperactivity, guidance를 JSON으로 돌려주는 AI 엔드포인트입니다.",
    bullets: [
      "프롬프트는 buildReactivityAnalysisPrompt()가 만듭니다.",
      "입력 analysis는 buildLocalReactivityAnalysis()/summarizeReactivity() 기반 요약입니다.",
      "Gemini가 설정되지 않으면 로컬 reactivityAnalysis가 그대로 fallback으로 저장됩니다."
    ],
    schema: [
      ["입력", "{ record, analysis }"],
      ["프롬프트 입력", "record + analysis + metrics"],
      ["출력.summary", "REACT 상단 요약"],
      ["출력.inattention", "부주의 해석"],
      ["출력.impulsivity", "충동성 해석"],
      ["출력.hyperactivity", "활동성/자기조절 해석"],
      ["출력.guidance", "다음 단계 권고"]
    ],
    promptText: `서비스: ADHDQQ.COM ADHD 선별/감별 보조 모바일 웹 앱
역할: 반응성 테스트 결과를 짧고 공감적으로 해석하는 한국어 선별 보조 AI
중요: 진단 확정 표현 금지, 수행 기반 참고 결과와 추가 평가 권고 수준으로만 작성
표현 지침:
- omission/commission/tau 같은 용어는 그대로 나열하지 말고 쉬운 한국어로 풀어 설명
- 수치를 과도하게 나열하지 말고, 이미 계산된 결과를 자연어로 풀어 설명
기록 JSON:
{record}
로컬 반응성 요약:
{analysis}
보조 점수:
{metrics}
요청:
1. summary는 전체 경향을 2문장 이내로 요약
2. inattention는 부주의 영역 해석을 2문장 이내로 설명
3. impulsivity는 충동성 영역 해석을 2문장 이내로 설명
4. hyperactivity는 활동성/자기조절 영역 해석을 2문장 이내로 설명
5. guidance는 수행 과제 한계와 다음 단계 권고를 2문장 이내로 설명
6. 한국어로만 작성`,
    links: [
      "REACT 완료 화면은 AI 결과가 있으면 reactivityAnalysis.source === 'ai' 값을 우선 사용합니다.",
      "ensureInsights()는 RESULT 생성 전에 이 AI 해석이 먼저 채워지도록 보장합니다."
    ]
  },
  {
    id: "ai-insights",
    kind: "ai",
    flowChannels: ["asrs", "dsm", "react"],
    x: 980,
    y: 820,
    title: "POST /api/ai/insights",
    short: "RESULT + PLAN 생성",
    summary: "SELF/SYM/REACT에서 모인 입력과 통합 metrics를 바탕으로 통합 리포트와 계획을 만드는 엔드포인트입니다. 다만 최종 report 본문은 결정론 값이 우선입니다.",
    bullets: [
      "프롬프트는 buildInsightsPrompt()가 만듭니다.",
      "개념적으로는 SELF, SYM, REACT 결과와 server metrics를 함께 받는 구조입니다.",
      "최종 report.hero.summary, sections.summary, alignmentSummary 등은 deterministic report가 우선합니다."
    ],
    schema: [
      ["입력", "SELF + SYM + REACT 결과"],
      ["프롬프트 입력", "입력 결과 묶음 + metrics"],
      ["출력.report", "schemaVersion 2 report"],
      ["출력.plan.suggestions", "3개 실행 계획"],
      ["출력.plan.chat[0].text", "openingMessage"]
    ],
    promptText: `서비스: ADHDQQ.COM ADHD 선별/감별 보조 모바일 웹 앱
중요: 진단 확정 표현 금지, 선별 결과와 권고 수준으로 작성
어조: 따뜻하고 전문적인 임상심리사처럼, 부드러운 경어체 한국어 사용
표현 지침: '목표 놓침(부주의)', '잘못된 반응(충동성)'처럼 쉬운 말로 설명
교차 분석 지침: 자가보고 선별과 게임 기반 객관 지표가 일치하는지 분명히 짚기
수치 사용 지침: JSON에 실제 존재하는 숫자만 인용, 없는 수치 추정 금지
자가보고 선별 판정 기준:
- 1, 2, 3번 문항은 가끔(2) 이상이면 유의미한 증상
- 4, 5, 6번 문항은 자주(3) 이상이면 유의미한 증상
- 유의미한 문항이 4개 이상이면 성인 ADHD 가능성이 비교적 높은 편
증상 기준 체크 판정 기준:
- 부주의 6개 이상 Yes, 과잉행동/충동성 6개 미만 Yes면 부주의형 가능성
- 과잉행동/충동성 6개 이상 Yes, 부주의 6개 미만 Yes면 과잉행동/충동형 가능성
- 두 영역 모두 6개 이상 Yes면 복합형 가능성
실행계획 작성 기준:
- plan.suggestions는 반드시 3개
- 각 제안은 20자 이내의 아주 짧은 한국어 문장
- 시간 또는 타이밍, 장소, 하나의 구체적 행동 단위가 드러나야 함
- 의료적 처방처럼 쓰지 말고 일상 코칭 언어로 작성
대상 기록 JSON:
{record}
계산된 핵심 지표:
{metrics}
요청:
1. report.severity는 낮음/중간/높음
2. report.hero.badges는 짧은 해시태그 2~3개
3. report.hero.summary는 1~2문장 핵심 요약
4. report.crossCheck.*는 주관적 보고 vs 객관적 반응 해석
5. report.profile.*는 부주의/충동성 프로필 설명
6. report.dailyImpact.empathy는 일상 피로도 공감 메시지
7. plan.suggestions는 3개 실행 계획
8. plan.openingMessage는 계획 수정을 유도하는 1~2문장`,
    links: [
      "RESULT 화면과 PLAN 초기 메시지의 시작점입니다.",
      "rag.md의 핵심 결론인 로컬 데이터 주입형 프롬프트 구조를 가장 잘 보여주는 노드입니다.",
      "구조도에서는 저장 레코드가 아니라 실제 의미 입력 흐름 기준으로 이해하는 것이 맞습니다."
    ]
  },
  {
    id: "ai-chat",
    kind: "ai",
    flowChannels: ["asrs", "dsm", "react"],
    x: 980,
    y: 1110,
    title: "POST /api/ai/chat",
    short: "PLAN 조정 채팅",
    summary: "사용자 메시지와 현재 계획 맥락, 통합 metrics를 받아 더 작은 다음 행동 단위로 계획을 조정하는 reply와 additionalSuggestion을 돌려줍니다.",
    bullets: [
      "프롬프트는 buildChatPrompt()가 만듭니다.",
      "현재 계획 맥락, 기존 chat, metrics, 현재 message가 모두 문맥으로 들어갑니다.",
      "additionalSuggestion은 20자 이내로 제한됩니다."
    ],
    schema: [
      ["입력", "{ record, message }"],
      ["출력.reply", "2~4문장 코칭 응답"],
      ["출력.additionalSuggestion", "짧은 추가 제안 1개"]
    ],
    promptText: `서비스: ADHDQQ.COM ADHD 선별/감별 보조 모바일 웹 앱
역할: 성인 ADHD 선별 결과와 현재 실행계획을 바탕으로 사용자의 계획을 현실적으로 조정하는 한국어 행동 코치
중요: 진단 확정 표현 금지, 의료행위처럼 말하지 말 것
응답 기준:
- 실제 생활 조건에 맞춰 시간, 장소, 행동 단위를 더 작게 조정
- 한 번에 여러 행동을 시키지 말고 가장 작은 다음 행동 1개를 우선 제안
- additionalSuggestion은 20자 이내의 아주 짧은 한국어 문장 1개만 허용
- 부주의 경향은 과제 분할, 시각적 단서, 환경 통제 중심으로 조정
- 충동성 경향은 지연 행동, 자기 점검, 심호흡, 행동 전 메모 중심으로 조정
현재 기록:
{record}
계산된 핵심 지표:
{metrics}
사용자 메시지:
{message}
요청:
reply는 사용자의 요청을 반영한 짧고 구체적인 답변 2~4문장
additionalSuggestion은 꼭 필요할 때만 한 문장으로 제안`,
    links: [
      "결과는 record.plan.chat과 record.plan.suggestions에 반영됩니다.",
      "sumlogic.md에서 PLAN 실시간 요약형 응답으로 정리된 구간입니다."
    ]
  },
  {
    id: "ui-self",
    kind: "ui",
    flowChannels: ["asrs"],
    x: 1450,
    y: 120,
    title: "SELF 결과 화면",
    short: "로컬 요약 -> AI 요약 순서",
    summary: "SELF 결과 화면은 AI 응답 전에는 로컬 analysis.summary와 세부 메시지를 먼저 보여주고, AI 결과가 오면 그것으로 덮습니다.",
    bullets: [
      "상단 hero는 AI summary > 로컬 summary > 미완료 안내 순입니다.",
      "세부 3문단은 AI attention/hyperactivity/guidance가 우선입니다.",
      "사용자는 totalPositive, attentionPositive, hyperPositive를 시각적으로 확인합니다."
    ],
    schema: [
      ["hero", "summary 표시 우선순위 존재"],
      ["signal chip", "totalPositive / 6"],
      ["domain split", "attentionPositive / 4, hyperPositive / 2"]
    ],
    links: [
      "sumlogic.md의 SELF 표시 우선순위 구간과 대응합니다."
    ]
  },
  {
    id: "ui-sym",
    kind: "ui",
    flowChannels: ["dsm"],
    x: 1450,
    y: 410,
    title: "SYM 결과 화면",
    short: "quickAnalysis 스키마 중심",
    summary: "SYM 결과 화면은 quickAnalysis 스키마를 중심으로 렌더링합니다. AI가 있으면 AI quickAnalysis, 없으면 로컬 quickAnalysis가 그대로 들어옵니다.",
    bullets: [
      "상단 hero는 quickAnalysis.summary를 사용합니다.",
      "subtype, inattention, hyperactivity가 동일 필드명으로 출력됩니다.",
      "contextualYes는 직접 드러나지 않지만 daily impact와 후속 해석에 반영됩니다."
    ],
    schema: [
      ["hero", "quickAnalysis.summary"],
      ["subtype signal", "analysis.subtype + yes 합계"],
      ["summary block", "subtype / inattention / hyperactivity"]
    ],
    links: [
      "로컬과 AI가 같은 스키마를 공유한다는 점이 핵심입니다."
    ]
  },
  {
    id: "ui-react",
    kind: "ui",
    flowChannels: ["react"],
    x: 1450,
    y: 690,
    title: "REACT 완료 화면",
    short: "로컬 요약 -> REACT AI 요약 순서",
    summary: "REACT 완료 화면은 먼저 로컬 reactivity summary와 highlights를 보여주고, AI 결과가 오면 summary/inattention/impulsivity/hyperactivity/guidance를 그 값으로 덮습니다. 여기서 나온 결과가 RESULT 해석의 객관 지표 재료가 됩니다.",
    bullets: [
      "summary는 AI 결과 우선, 없으면 로컬 summary fallback 순서입니다.",
      "highlights가 omission, commission, stable duration 같은 세부 값을 카드로 보여줍니다.",
      "세부 4문단은 AI inattention / impulsivity / hyperactivity / guidance를 우선 사용합니다."
    ],
    schema: [
      ["summary", "AI 또는 로컬 한 줄 요약"],
      ["highlights[]", "지표 카드"],
      ["signal scores", "부주의 / 충동성 / 활동성"],
      ["reactivityAnalysis.*", "AI 세부 해석 4문단"]
    ],
    links: [
      "public/app.js의 renderGamePage()가 showReactivityAiPending과 reactivityAnalysis.source === 'ai'를 기준으로 렌더링합니다."
    ]
  },
  {
    id: "ui-result",
    kind: "ui",
    flowChannels: ["asrs", "dsm", "react"],
    x: 1450,
    y: 950,
    title: "RESULT 리포트",
    short: "deterministic report 우선",
    summary: "RESULT는 AI 사이트처럼 보이지만 실제 핵심 문장은 deterministic report가 우선합니다. 프런트는 report가 비어도 fallback으로 다시 조립합니다.",
    bullets: [
      "hero.summary와 sections.summary는 결정론 값이 본체입니다.",
      "alignmentSummary, inattentionSummary, impulsivitySummary도 deterministic 우선입니다.",
      "report가 비거나 부족하면 analyzeAsrs(), analyzeDsm(), summarizeReactivity()로 fallback 조립합니다.",
      "dailyImpact.empathy는 report 없으면 dsm.detail로 fallback합니다."
    ],
    schema: [
      ["hero.summary", "핵심 요약"],
      ["crossCheck.alignmentSummary", "주관-객관 일치 해석"],
      ["profile.*", "부주의/충동성 상세 해석"],
      ["dailyImpact", "부담도 라벨과 공감 문장"]
    ],
    links: [
      "rag.md의 'AI가 전부 판단하지 않는다'는 결론과 바로 연결됩니다.",
      "sumlogic.md 기준으로는 deterministic report가 본체이고, local-self/local-sym/reactivity-summary는 fallback 계층입니다."
    ]
  },
  {
    id: "ui-plan",
    kind: "ui",
    flowChannels: ["asrs", "dsm", "react"],
    x: 1450,
    y: 1190,
    title: "PLAN 화면",
    short: "AI 채팅과 plan suggestions 소비",
    summary: "PLAN 화면은 AI openingMessage와 chat reply를 보여주고, plan.suggestions를 사용자의 실행 계획 목록으로 소비합니다.",
    bullets: [
      "plan.suggestions는 기본 실행 계획 3개의 source입니다.",
      "plan.chat은 사용자/AI 대화 이력입니다.",
      "여기서 만들어진 plan.suggestions가 뒤쪽 plangame 목표 카드의 기본 source가 됩니다."
    ],
    schema: [
      ["plan.suggestions", "실행 계획 3개"],
      ["plan.chat", "대화 히스토리"],
      ["openingMessage", "초기 AI 안내 메시지"],
      ["reply", "후속 조정 답변"]
    ],
    links: [
      "ai/chat 응답이 suggestions와 chat을 갱신합니다.",
      "ai/insights가 초기 plan을 만들고, ai/chat이 후속 조정을 담당합니다."
    ]
  },
  {
    id: "ui-dtx",
    kind: "ui",
    flowChannels: ["asrs", "dsm", "react"],
    x: 1760,
    y: 1190,
    title: "DTx / plangame",
    short: "PLAN 이후의 소비 화면",
    summary: "DTx 숲 허브와 plangame은 새 AI 요약을 만들지 않고, 이미 저장된 plan/record/dtx 상태를 사용해 후속 행동 루프를 만듭니다.",
    bullets: [
      "plangame 기본 목표는 plan.suggestions에서 시작합니다.",
      "record.dtx.scores와 totalScore가 숲 점수와 stage 배경을 결정합니다.",
      "plan.json은 플랜 튜토리얼 대사만 바꾸고, 점수 규칙은 코드가 담당합니다."
    ],
    schema: [
      ["plan.suggestions", "플랜 목표 기본 source"],
      ["planGame.goals", "수정된 목표 카드 상태"],
      ["dtx.scores.*", "미니게임/플랜 누적 점수"],
      ["dtx.stage", "stage1~stage5 배경 단계"],
      ["tutorials.*", "튜토리얼 재생 여부"]
    ],
    links: [
      "AI는 여기서 새로 호출되지 않습니다.",
      "PLAN 단계 산출물이 후속 실천 루프로 넘어간다는 점을 보여줍니다."
    ]
  }
];

const LAYOUT_STORAGE_KEY = "adhdqq-map-layout-v1";
const LAYOUT_SAVE_CODE = "0907";
const LAYOUT_API_URL = "/api/map-layout";

const edges = [
  { from: "asrs-json", to: "local-self", type: "direct", channels: ["asrs"] },
  { from: "dsm-json", to: "local-sym", type: "direct", channels: ["dsm"] },
  { from: "tutorial-jsons", to: "reactivity-summary", type: "direct", channels: ["react"] },
  { from: "tutorial-jsons", to: "metrics", type: "direct", channels: ["react"] },
  { from: "asrs-json", to: "metrics", type: "direct", channels: ["asrs"] },
  { from: "dsm-json", to: "metrics", type: "direct", channels: ["dsm"] },
  { from: "local-self", to: "ai-self", type: "direct", channels: ["asrs"] },
  { from: "metrics", to: "ai-self", type: "direct", channels: ["asrs"] },
  { from: "local-sym", to: "ai-sym", type: "direct", channels: ["dsm"] },
  { from: "metrics", to: "ai-sym", type: "direct", channels: ["dsm"] },
  { from: "reactivity-summary", to: "ai-react", type: "direct", channels: ["react"] },
  { from: "metrics", to: "ai-react", type: "direct", channels: ["react"] },
  { from: "local-self", to: "ai-insights", type: "meta", channels: ["asrs"] },
  { from: "local-sym", to: "ai-insights", type: "meta", channels: ["dsm"] },
  { from: "reactivity-summary", to: "ai-insights", type: "meta", channels: ["react"] },
  { from: "metrics", to: "ai-insights", type: "direct", channels: ["asrs", "dsm", "react"] },
  { from: "metrics", to: "ai-chat", type: "direct", channels: ["asrs", "dsm", "react"] },
  { from: "local-self", to: "ui-self", type: "fallback", channels: ["asrs"] },
  { from: "ai-self", to: "ui-self", type: "direct", channels: ["asrs"] },
  { from: "local-sym", to: "ui-sym", type: "fallback", channels: ["dsm"] },
  { from: "ai-sym", to: "ui-sym", type: "direct", channels: ["dsm"] },
  { from: "reactivity-summary", to: "ui-react", type: "fallback", channels: ["react"] },
  { from: "ai-react", to: "ui-react", type: "direct", channels: ["react"] },
  { from: "ai-insights", to: "ui-result", type: "direct", channels: ["asrs", "dsm", "react"] },
  { from: "local-self", to: "ui-result", type: "fallback", channels: ["asrs"] },
  { from: "local-sym", to: "ui-result", type: "fallback", channels: ["dsm"] },
  { from: "reactivity-summary", to: "ui-result", type: "fallback", channels: ["react"] },
  { from: "ai-insights", to: "ui-plan", type: "direct", channels: ["asrs", "dsm", "react"] },
  { from: "ai-chat", to: "ui-plan", type: "direct", channels: ["asrs", "dsm", "react"] },
  { from: "ui-plan", to: "ui-dtx", type: "meta", channels: ["asrs", "dsm", "react"] }
];

const nodesRoot = document.getElementById("nodes");
const edgesRoot = document.getElementById("edges");
const canvas = document.getElementById("canvas");
const viewport = document.getElementById("viewport");
const detailEmpty = document.getElementById("detail-empty");
const detailContent = document.getElementById("detail-content");
const detailType = document.getElementById("detail-type");
const detailTitle = document.getElementById("detail-title");
const detailSummary = document.getElementById("detail-summary");
const detailBullets = document.getElementById("detail-bullets");
const detailSchema = document.getElementById("detail-schema");
const detailLinks = document.getElementById("detail-links");
const detailPromptSection = document.getElementById("detail-prompt-section");
const detailPrompt = document.getElementById("detail-prompt");
const saveLayoutButton = document.querySelector("[data-save-layout]");
const edgeFilterInputs = Array.from(document.querySelectorAll("[data-edge-filter]"));

const nodeMap = new Map(nodes.map((node) => [node.id, node]));
const viewportState = { scale: 0.62, x: 40, y: 40 };
const edgeFilters = {
  direct: true,
  fallback: true,
  meta: true
};

let activeNodeId = null;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let originX = 0;
let originY = 0;
let draggedNodeId = null;
let draggedNodeOriginX = 0;
let draggedNodeOriginY = 0;
let nodeDragMoved = false;

function applyLayout(layout) {
  if (!layout || typeof layout !== "object") {
    return;
  }
  nodes.forEach((node) => {
    const saved = layout[node.id];
    if (!saved) {
      return;
    }
    if (Number.isFinite(saved.x)) {
      node.x = saved.x;
    }
    if (Number.isFinite(saved.y)) {
      node.y = saved.y;
    }
  });
}

function loadSavedLayoutFromLocal() {
  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) {
      return false;
    }
    applyLayout(JSON.parse(raw));
    return true;
  } catch (error) {
    console.error("Failed to load map layout", error);
    return false;
  }
}

async function loadSavedLayout() {
  try {
    const response = await fetch(`${LAYOUT_API_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load map layout: ${response.status}`);
    }
    const payload = await response.json();
    if (payload?.nodes && typeof payload.nodes === "object") {
      applyLayout(payload.nodes);
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(payload.nodes));
      return true;
    }
  } catch (error) {
    console.error("Failed to load server map layout", error);
  }
  return loadSavedLayoutFromLocal();
}

function collectLayout() {
  const layout = {};
  nodes.forEach((node) => {
    layout[node.id] = { x: node.x, y: node.y };
  });
  return layout;
}

async function saveLayout() {
  const code = window.prompt("위치 저장 코드를 입력하세요.");
  if (code === null) {
    return;
  }
  if (code !== LAYOUT_SAVE_CODE) {
    window.alert("코드가 일치하지 않습니다.");
    return;
  }

  const layout = collectLayout();

  try {
    const response = await fetch(LAYOUT_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodes: layout })
    });
    if (!response.ok) {
      throw new Error(`Failed to save map layout: ${response.status}`);
    }
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    window.alert("노드 위치를 서버에 저장했습니다.");
  } catch (error) {
    console.error("Failed to save map layout", error);
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    window.alert("서버 저장에 실패해 현재 브라우저에만 저장했습니다.");
  }
}

function syncEdgeFiltersFromInputs() {
  edgeFilterInputs.forEach((input) => {
    edgeFilters[input.dataset.edgeFilter] = input.checked;
  });
}

function isEdgeVisible(edge) {
  return Boolean(edgeFilters[edge.type]);
}

function getDownstreamPath(startId) {
  if (!startId) {
    return { nodes: new Set(), edges: new Set() };
  }

  const startNode = nodeMap.get(startId);
  const startChannels = Array.isArray(startNode?.flowChannels) && startNode.flowChannels.length
    ? startNode.flowChannels
    : ["asrs", "dsm", "react"];
  const visited = new Set([startId]);
  const highlightedEdges = new Set();
  const queue = [{ nodeId: startId, channels: startChannels }];

  const intersectChannels = (left, right) => left.filter((channel) => right.includes(channel));

  while (queue.length) {
    const current = queue.shift();
    edges.forEach((edge) => {
      if (!isEdgeVisible(edge)) {
        return;
      }
      const { from, to, channels = [] } = edge;
      const fromId = from;
      const toId = to;
      if (fromId !== current.nodeId) {
        return;
      }
      const matchedChannels = intersectChannels(current.channels, channels);
      if (!matchedChannels.length) {
        return;
      }
      const edgeKey = `${fromId}->${toId}`;
      highlightedEdges.add(edgeKey);
      if (!visited.has(toId)) {
        visited.add(toId);
        queue.push({ nodeId: toId, channels: matchedChannels });
      }
    });
  }

  return { nodes: visited, edges: highlightedEdges };
}

function kindLabel(kind) {
  const labels = {
    source: "JSON Source",
    derived: "Derived Schema",
    ai: "AI Prompt / Output",
    ui: "UI Surface"
  };
  return labels[kind] || kind;
}

function renderNodes() {
  const path = getDownstreamPath(activeNodeId);
  nodesRoot.innerHTML = nodes.map((node) => `
    <article
      class="node ${node.id === activeNodeId ? "is-active" : ""} ${activeNodeId && path.nodes.has(node.id) ? "is-related" : ""} ${activeNodeId && !path.nodes.has(node.id) ? "is-dimmed" : ""} ${draggedNodeId === node.id ? "is-dragging" : ""}"
      data-node-id="${node.id}"
      data-kind="${node.kind}"
      style="left:${node.x}px; top:${node.y}px"
    >
      <div class="node-kind">${kindLabel(node.kind)}</div>
      <h3>${node.title}</h3>
      <p>${node.short}</p>
      <div class="node-body">
        <p>${node.summary}</p>
      </div>
    </article>
  `).join("");

  nodesRoot.querySelectorAll("[data-node-id]").forEach((element) => {
    element.addEventListener("click", (event) => {
      if (nodeDragMoved) {
        return;
      }
      event.stopPropagation();
      setActiveNode(element.dataset.nodeId);
    });

    element.addEventListener("mousedown", (event) => {
      if (event.button !== 0) {
        return;
      }
      event.stopPropagation();
      const node = nodeMap.get(element.dataset.nodeId);
      draggedNodeId = node.id;
      draggedNodeOriginX = node.x;
      draggedNodeOriginY = node.y;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      nodeDragMoved = false;
    });
  });
}

function renderEdges() {
  const path = getDownstreamPath(activeNodeId);
  edgesRoot.innerHTML = edges.filter(isEdgeVisible).map(({ from, to, type }) => {
    const fromId = from;
    const toId = to;
    const fromNode = nodeMap.get(fromId);
    const toNode = nodeMap.get(toId);
    const startX = fromNode.x + 250;
    const startY = fromNode.y + 74;
    const endX = toNode.x;
    const endY = toNode.y + 74;
    const midX = (startX + endX) / 2;
    const edgeKey = `${fromId}->${toId}`;
    const classes = activeNodeId
      ? path.edges.has(edgeKey)
        ? `edge-${type} is-highlighted`
        : `edge-${type} is-dimmed`
      : `edge-${type}`;
    return `<path class="${classes}" d="M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}" />`;
  }).join("");
}

function renderDetail(node) {
  if (!node) {
    detailEmpty.classList.remove("hidden");
    detailContent.classList.add("hidden");
    return;
  }

  detailEmpty.classList.add("hidden");
  detailContent.classList.remove("hidden");
  detailType.textContent = kindLabel(node.kind);
  detailTitle.textContent = node.title;
  detailSummary.textContent = node.summary;

  detailBullets.innerHTML = node.bullets.map((item) => `<li>${item}</li>`).join("");
  detailSchema.innerHTML = node.schema.map(([key, value]) => `
    <div class="schema-row">
      <strong>${key}</strong>
      <span>${value}</span>
    </div>
  `).join("");
  detailLinks.innerHTML = node.links.map((item) => `<li>${item}</li>`).join("");

  if (node.kind === "ai" && node.promptText) {
    detailPromptSection.classList.remove("hidden");
    detailPrompt.textContent = node.promptText;
  } else {
    detailPromptSection.classList.add("hidden");
    detailPrompt.textContent = "";
  }
}

function setActiveNode(nodeId) {
  activeNodeId = nodeId;
  renderEdges();
  renderNodes();
  renderDetail(nodeMap.get(nodeId));
}

function applyViewport() {
  viewport.style.transform = `translate(${viewportState.x}px, ${viewportState.y}px) scale(${viewportState.scale})`;
  const reset = document.querySelector("[data-zoom-reset]");
  if (reset) {
    reset.textContent = `${Math.round(viewportState.scale * 100)}%`;
  }
}

function zoomBy(delta, clientX = canvas.clientWidth / 2, clientY = canvas.clientHeight / 2) {
  const oldScale = viewportState.scale;
  const nextScale = Math.max(0.42, Math.min(1.55, Number((oldScale + delta).toFixed(2))));
  if (nextScale === oldScale) {
    return;
  }

  const anchorX = (clientX - viewportState.x) / oldScale;
  const anchorY = (clientY - viewportState.y) / oldScale;
  viewportState.scale = nextScale;
  viewportState.x = clientX - anchorX * nextScale;
  viewportState.y = clientY - anchorY * nextScale;
  applyViewport();
}

function bindPanZoom() {
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    zoomBy(event.deltaY < 0 ? 0.08 : -0.08, localX, localY);
  }, { passive: false });

  canvas.addEventListener("mousedown", (event) => {
    if (event.target.closest(".node")) {
      return;
    }
    isDragging = true;
    canvas.classList.add("is-dragging");
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    originX = viewportState.x;
    originY = viewportState.y;
  });

  window.addEventListener("mousemove", (event) => {
    if (draggedNodeId) {
      const node = nodeMap.get(draggedNodeId);
      const deltaX = (event.clientX - dragStartX) / viewportState.scale;
      const deltaY = (event.clientY - dragStartY) / viewportState.scale;
      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        nodeDragMoved = true;
      }
      node.x = Math.round(draggedNodeOriginX + deltaX);
      node.y = Math.round(draggedNodeOriginY + deltaY);
      renderEdges();
      renderNodes();
      return;
    }
    if (!isDragging) {
      return;
    }
    viewportState.x = originX + (event.clientX - dragStartX);
    viewportState.y = originY + (event.clientY - dragStartY);
    applyViewport();
  });

  window.addEventListener("mouseup", () => {
    if (draggedNodeId) {
      const moved = nodeDragMoved;
      draggedNodeId = null;
      if (moved) {
        renderNodes();
      }
      window.setTimeout(() => {
        nodeDragMoved = false;
      }, 0);
    }
    isDragging = false;
    canvas.classList.remove("is-dragging");
  });

  canvas.addEventListener("click", (event) => {
    if (!event.target.closest(".node")) {
      setActiveNode(null);
    }
  });

  document.querySelector("[data-zoom-in]").addEventListener("click", () => zoomBy(0.08));
  document.querySelector("[data-zoom-out]").addEventListener("click", () => zoomBy(-0.08));
  document.querySelector("[data-zoom-reset]").addEventListener("click", () => {
    viewportState.scale = 0.62;
    viewportState.x = 40;
    viewportState.y = 40;
    applyViewport();
  });
  saveLayoutButton.addEventListener("click", saveLayout);
  edgeFilterInputs.forEach((input) => {
    input.addEventListener("change", () => {
      syncEdgeFiltersFromInputs();
      renderEdges();
      renderNodes();
    });
  });
}

async function init() {
  await loadSavedLayout();
  syncEdgeFiltersFromInputs();
  renderEdges();
  renderNodes();
  renderDetail(null);
  applyViewport();
  bindPanZoom();
}

init();
