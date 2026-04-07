const state = {
  route: "intro",
  configs: {
    asrs: null,
    dsm: null,
    report: null
  },
  aiStatus: null,
  records: [],
  currentRecord: null,
  asrsIndex: 0,
  dsmIndex: 0,
  isGeneratingInsights: false,
  isGeneratingAsrsAnalysis: false,
  loadUserId: "",
  showExistingIdForm: false,
  showAdminModal: false,
  statusMessage: ""
};

const routes = [
  { key: "intro", label: "Intro", icon: "info" },
  { key: "asrs", label: "ASRS", icon: "quiz" },
  { key: "dsm", label: "DSM", icon: "checklist" },
  { key: "game", label: "Game", icon: "neurology" },
  { key: "report", label: "Report", icon: "analytics" },
  { key: "plan", label: "Plan", icon: "event_note" }
];

const app = document.querySelector("#app");
const bottomNav = document.querySelector("#bottom-nav");

init();

async function init() {
  await Promise.all([loadConfigs(), loadRecords(), loadAiStatus()]);
  render();
}

async function loadConfigs() {
  const [asrs, dsm, report] = await Promise.all([
    api(`/api/config/asrs.json`),
    api(`/api/config/dsm-5.json`),
    api(`/api/config/report.json`)
  ]);
  state.configs = { asrs, dsm, report };
}

async function loadRecords() {
  state.records = await api("/api/records");
}

async function loadAiStatus() {
  state.aiStatus = await api("/api/ai/status");
}

async function api(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Request failed");
  }
  return response.json();
}

function formatDate(dateLike) {
  return new Date(dateLike).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function makeTimestamp(now) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join("") + "-" + [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join("");
}

function normalizeUserId(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .toLowerCase();
}

function createEmptyRecord(userId) {
  const createdAt = new Date().toISOString();
  const safeId = normalizeUserId(userId) || "guest";
  const fileName = `${safeId}-${makeTimestamp(new Date())}.json`;
  return {
    id: safeId,
    createdAt,
    updatedAt: createdAt,
    fileName,
    currentStep: "id",
    tests: {
      asrs: [],
      dsm5: [],
      game: { status: "pending" }
    },
    report: null,
    plan: {
      suggestions: [],
      chat: []
    }
  };
}

function getAsrsAnswers(record = state.currentRecord) {
  return record?.tests?.asrs || record?.tests?.asar || [];
}

function normalizeCurrentStep(step) {
  return step === "asar" ? "asrs" : step;
}

function findLatestRecordById(userId) {
  const normalizedId = normalizeUserId(userId);
  return state.records.find((record) => record.id === normalizedId) || null;
}

async function syncCurrentStep(route) {
  if (!state.currentRecord) {
    return;
  }

  const flowSteps = new Set(["asrs", "asrs-result", "dsm", "game", "report", "plan"]);
  if (!flowSteps.has(route)) {
    return;
  }

  state.currentRecord.currentStep = route;
  await persistRecord();
}

function analyzeAsrs(record = state.currentRecord) {
  const answers = getAsrsAnswers(record)
    .map((item) => Number(item.answer))
    .filter((value) => Number.isFinite(value));
  const thresholds = [2, 2, 2, 3, 3, 3];
  const positiveFlags = answers.map((answer, index) => answer >= thresholds[index]);
  const totalPositive = positiveFlags.filter(Boolean).length;
  const attentionPositive = positiveFlags.slice(0, 4).filter(Boolean).length;
  const hyperPositive = positiveFlags.slice(4).filter(Boolean).length;
  const isComplete = answers.length === 6;
  const severity = totalPositive >= 4 ? "비교적 높음" : "관찰 필요";

  let summary = "현재 응답만으로는 뚜렷한 ASRS 양상이 많지 않습니다.";
  if (totalPositive >= 4) {
    summary = "ASRS에서 유의미한 문항이 4개 이상으로 나타나 추가 평가를 고려할 만한 패턴입니다.";
  } else if (totalPositive >= 2) {
    summary = "ASRS에서 일부 주의집중 또는 실행기능 관련 어려움이 관찰되어 맥락을 함께 볼 필요가 있습니다.";
  }

  const attentionMessage = attentionPositive
    ? `주의력 결핍 관련 문항 4개 중 ${attentionPositive}개가 기준 이상입니다. 집중 유지, 마감 관리, 시작 지연에서 어려움이 나타날 수 있습니다.`
    : "주의력 결핍 관련 문항은 현재 기준 이상 응답이 많지 않습니다.";
  const hyperMessage = hyperPositive
    ? `과잉행동·충동성 관련 문항 2개 중 ${hyperPositive}개가 기준 이상입니다. 오래 앉아 있기 어렵거나 대화 중 끼어드는 양상이 함께 있을 수 있습니다.`
    : "과잉행동·충동성 관련 문항은 현재 기준 이상 응답이 많지 않습니다.";
  const guidance = totalPositive >= 4
    ? "이 검사는 선별 도구이며 확진 검사가 아닙니다. 다만 현재 패턴은 비교적 뚜렷하므로 필요하면 CAT, DIVA-5, 임상 면담 같은 정밀 평가를 받아보는 것이 도움이 될 수 있습니다."
    : "이 검사는 선별 도구이며 확진 검사가 아닙니다. 현재 어려움은 스트레스, 수면 부족, 불안·우울 같은 다른 요인과도 겹칠 수 있으니 지속되면 전문가 상담을 고려해 보세요.";

  return {
    answers,
    isComplete,
    totalPositive,
    attentionPositive,
    hyperPositive,
    severity,
    summary,
    attentionMessage,
    hyperMessage,
    guidance
  };
}

async function persistRecord() {
  if (!state.currentRecord) {
    return;
  }

  state.currentRecord.updatedAt = new Date().toISOString();
  await api("/api/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: state.currentRecord.fileName,
      data: state.currentRecord
    })
  });
  await loadRecords();
}

function setStatus(message) {
  state.statusMessage = message;
  render();
  window.clearTimeout(setStatus.timer);
  setStatus.timer = window.setTimeout(() => {
    state.statusMessage = "";
    render();
  }, 2200);
}

function requireRecord(nextRoute) {
  if (!state.currentRecord) {
    setStatus("먼저 ID를 생성하거나 불러와 주세요.");
    state.route = "id";
    render();
    return false;
  }
  state.route = nextRoute;
  render();
  return true;
}

function navTo(route) {
  if (["asrs", "asrs-result", "dsm", "game", "report", "plan"].includes(route) && !state.currentRecord) {
    requireRecord(route);
    return;
  }
  state.route = route;
  render();
}

async function handleCreateId(event) {
  event.preventDefault();
  const userId = new FormData(event.currentTarget).get("userId");
  state.currentRecord = createEmptyRecord(String(userId || ""));
  await persistRecord();
  setStatus(`${state.currentRecord.fileName} 생성 완료`);
  navTo("asrs");
}

async function handleLoadRecord(fileName) {
  state.currentRecord = await api(`/api/records/${fileName}`);
  if (!state.currentRecord.tests.asrs && state.currentRecord.tests.asar) {
    state.currentRecord.tests.asrs = state.currentRecord.tests.asar;
  }
  state.asrsIndex = Math.min(getAsrsAnswers(state.currentRecord).length, state.configs.asrs.questions.length - 1);
  state.dsmIndex = Math.min(state.currentRecord.tests.dsm5.length, state.configs.dsm.questions.length - 1);
  setStatus(`${fileName} 불러오기 완료`);
  navTo(normalizeCurrentStep(state.currentRecord.currentStep || "id"));
}

async function submitManualLoad(event) {
  event.preventDefault();
  if (!state.loadUserId) {
    setStatus("불러올 ID를 입력해 주세요.");
    return;
  }

  const record = findLatestRecordById(state.loadUserId);
  if (!record) {
    setStatus("해당 ID의 저장 기록을 찾지 못했습니다.");
    return;
  }

  await handleLoadRecord(record.fileName);
}

function toggleExistingIdForm() {
  state.showExistingIdForm = !state.showExistingIdForm;
  render();
}

function openAdminModal() {
  state.showAdminModal = true;
  render();
}

function closeAdminModal() {
  state.showAdminModal = false;
  render();
}

async function answerAsrs(value) {
  const question = state.configs.asrs.questions[state.asrsIndex];
  if (!state.currentRecord.tests.asrs) {
    state.currentRecord.tests.asrs = getAsrsAnswers();
  }
  state.currentRecord.tests.asrs[state.asrsIndex] = {
    prompt: question.prompt,
    examples: question.examples,
    answer: value
  };
  state.currentRecord.currentStep = "asrs";
  await persistRecord();
  render();
}

async function goToNextAsrsQuestion() {
  const currentAnswer = getAsrsAnswers()?.[state.asrsIndex]?.answer;
  if (!Number.isFinite(Number(currentAnswer))) {
    setStatus("척도를 선택한 뒤 다음으로 진행해 주세요.");
    return;
  }

  if (state.asrsIndex < state.configs.asrs.questions.length - 1) {
    state.asrsIndex += 1;
    state.currentRecord.currentStep = "asrs";
    await persistRecord();
  } else {
    state.currentRecord.currentStep = "asrs-result";
    await persistRecord();
    state.route = "asrs-result";
    await ensureAsrsAnalysis();
  }
  render();
}

async function answerDsm(value) {
  const current = state.configs.dsm.questions[state.dsmIndex];
  state.currentRecord.tests.dsm5[state.dsmIndex] = {
    section: current.section,
    prompt: current.prompt,
    answer: value
  };
  state.currentRecord.currentStep = "dsm";
  await persistRecord();

  if (state.dsmIndex < state.configs.dsm.questions.length - 1) {
    state.dsmIndex += 1;
  } else {
    state.route = "game";
  }
  render();
}

async function completeGamePlaceholder() {
  state.currentRecord.tests.game = {
    status: "placeholder-complete",
    completedAt: new Date().toISOString()
  };
  state.currentRecord.currentStep = "game";
  await persistRecord();
  navTo("report");
  setStatus("Gemini로 리포트를 생성하는 중입니다.");
  await ensureInsights();
}

async function generateReportAndPlan() {
  if (!state.currentRecord) {
    return;
  }

  state.isGeneratingInsights = true;
  render();

  try {
    const insights = await api("/api/ai/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        record: state.currentRecord
      })
    });

    state.currentRecord.report = insights.report;
    state.currentRecord.plan = insights.plan;
    state.currentRecord.currentStep = "report";
    await persistRecord();
  } finally {
    state.isGeneratingInsights = false;
    render();
  }
}

async function generateAsrsAnalysis() {
  if (!state.currentRecord) {
    return;
  }

  state.isGeneratingAsrsAnalysis = true;
  render();

  try {
    const analysis = analyzeAsrs();
    const result = await api("/api/ai/asrs-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        record: state.currentRecord,
        analysis
      })
    });

    state.currentRecord.asrsAnalysis = result;
    await persistRecord();
  } finally {
    state.isGeneratingAsrsAnalysis = false;
    render();
  }
}

async function ensureAsrsAnalysis() {
  if (!state.currentRecord?.asrsAnalysis?.summary && !state.isGeneratingAsrsAnalysis) {
    await generateAsrsAnalysis();
  }
}

async function ensureInsights() {
  if (!state.currentRecord?.report || !state.currentRecord?.plan?.suggestions?.length) {
    setStatus("Gemini로 리포트와 계획을 생성하는 중입니다.");
    await generateReportAndPlan();
  }
}

async function sendPlanChat(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = new FormData(form).get("message");
  const text = String(message || "").trim();
  if (!text) {
    return;
  }

  await ensureInsights();
  state.currentRecord.plan.chat.push({ role: "user", text });

  const result = await api("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      record: state.currentRecord,
      message: text
    })
  });

  state.currentRecord.plan.chat.push({
    role: "assistant",
    text: result.reply
  });

  if (result.additionalSuggestion) {
    const nextSuggestions = [...state.currentRecord.plan.suggestions, result.additionalSuggestion];
    state.currentRecord.plan.suggestions = nextSuggestions.slice(-3);
  }

  state.currentRecord.currentStep = "plan";
  await persistRecord();
  form.reset();
  render();
}

function render() {
  renderNav();
  const page = pages[state.route] ? pages[state.route]() : pages.intro();
  app.innerHTML = page;
  bindPageEvents();
}

function renderNav() {
  const activeRoute = state.route === "asrs-result" ? "asrs" : state.route;
  bottomNav.innerHTML = routes
    .map((route) => {
      const active = activeRoute === route.key ? "active" : "";
      return `
        <a href="#" class="nav-item ${active}" data-route="${route.key}">
          <span class="material-symbols-outlined">${route.icon}</span>
          <span class="label">${route.label}</span>
        </a>
      `;
    })
    .join("");

  bottomNav.querySelectorAll("[data-route]").forEach((node) => {
    node.addEventListener("click", (event) => {
      event.preventDefault();
      const route = event.currentTarget.getAttribute("data-route");
      if (route === "report" || route === "plan") {
        ensureInsights().then(() => navTo(route)).catch((error) => setStatus(error.message));
        return;
      }
      navTo(route);
    });
  });
}

const pages = {
  intro() {
    return `
      <section class="page">
        <div class="hero-card stack-lg">
          <div class="flex items-center justify-end">
            <button class="button-ghost" type="button" id="open-admin-modal" style="padding:0.55rem 0.9rem;font-size:0.8rem">ADMIN</button>
          </div>
          <div class="stack-md">
            <h2 class="title-xl">ADHD 선별과 감별 <span style="color:#ffacea">soul.ai.kr</span></h2>
            <p class="muted">ASRS, DSM-5, 반응성 테스트를 통해 ADHD유형을 분석합니다.</p>
          </div>
          <div class="panel" style="padding:0;overflow:hidden">
            <img
              src="/intro.png"
              alt="soul.ai.kr intro"
              style="display:block;width:100%;height:auto;max-height:52vh;object-fit:contain;background:#1b1b1b"
            />
          </div>
          <button class="button-secondary" data-route-next="id">평가 시작하기</button>
        </div>
        ${state.showAdminModal ? renderAdminModal() : ""}
      </section>
    `;
  },

  id() {
    return `
      <section class="page">
        <div class="hero-card stack-lg">
          <div class="stack-sm">
            <h2 class="title-lg">평가를 시작할 ID를 선택하세요.</h2>
            <p class="muted">새 ID를 만들거나, 기존 ID의 가장 최근 기록을 불러올 수 있습니다.</p>
          </div>

          ${state.statusMessage ? `<div class="panel">${state.statusMessage}</div>` : ""}

          <form id="create-id-form" class="panel stack-md">
            <div class="stack-sm">
              <div class="eyebrow">new soul id</div>
              <h3 class="title-lg">새 ID 만들기</h3>
            </div>
            <div class="field">
              <label for="user-id">사용자 ID</label>
              <input id="user-id" name="userId" class="text-input" placeholder="예: minsu01" required />
            </div>
            <button class="button-secondary" type="submit">새 ID 만들기</button>
          </form>

          <div class="panel stack-md">
            <div class="stack-sm">
              <div class="eyebrow">resume</div>
              <h3 class="title-lg">기존 기록 불러오기</h3>
            </div>
            <button class="button-ghost" type="button" id="toggle-existing-id-form">기존 기록 불러오기</button>
            ${state.showExistingIdForm ? `
              <form id="manual-load-form" class="stack-sm">
                <div class="field">
                  <label for="existing-user-id">기존 ID 입력</label>
                  <input id="existing-user-id" name="userId" class="text-input" value="${escapeHtml(state.loadUserId)}" placeholder="예: minsu01" />
                </div>
                <button class="button-secondary" type="submit">이 ID로 이동</button>
              </form>
            ` : ""}
          </div>
        </div>
      </section>
    `;
  },

  asrs() {
    const config = state.configs.asrs;
    const progress = ((state.asrsIndex + 1) / config.questions.length) * 100;
    const currentQuestion = config.questions[state.asrsIndex];
    const currentAnswer = getAsrsAnswers()?.[state.asrsIndex]?.answer;
    const currentImage = `/asrs${String(state.asrsIndex + 1).padStart(2, "0")}.png`;
    return `
      <section class="page">
        <div class="panel stack-md">
          <div class="stack-sm">
            <div class="flex items-end justify-between gap-4">
              <div>
                <h2 class="title-lg asrs-title">${config.title}<span class="muted asrs-title-sub">(Adult ADHD Self-Report Scale)</span></h2>
                <p class="muted">${config.description}</p>
              </div>
            </div>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
        </div>

        <div class="hero-card stack-lg">
          <p class="asrs-question">${currentQuestion.prompt}</p>
          <div class="panel asrs-image-panel">
            <img class="asrs-image" src="${currentImage}" alt="ASRS question ${state.asrsIndex + 1}" />
          </div>
          <div class="panel stack-sm">
            <div class="eyebrow">예시</div>
            <ul class="stack-sm">
              ${currentQuestion.examples.map((example) => `<li class="muted">- ${example}</li>`).join("")}
            </ul>
          </div>
          <div class="question-scale continuous">
            ${config.scale.map((item) => `
              <button class="choice-button ${currentAnswer === item.value ? "selected" : ""}" data-asrs-answer="${item.value}">
                <div class="choice-dot"><strong>${item.value}</strong></div>
                <span class="choice-label">${item.label}</span>
              </button>
            `).join("")}
          </div>
          <button class="button-secondary safe-bottom-actions" id="asrs-next-button">${state.asrsIndex === config.questions.length - 1 ? "결과 보기" : "다음"}</button>
        </div>
      </section>
    `;
  },

  "asrs-result"() {
    const analysis = analyzeAsrs();
    if (!state.currentRecord?.asrsAnalysis?.summary && !state.isGeneratingAsrsAnalysis && state.aiStatus?.configured) {
      window.setTimeout(() => {
        ensureAsrsAnalysis().catch((error) => setStatus(error.message));
      }, 0);
    }
    return `
      <section class="page">
        <div class="hero-card stack-lg">
          <div class="eyebrow">asrs quick analysis</div>
          <p class="muted">${
            state.isGeneratingAsrsAnalysis
              ? "AI가 현재 점수 강도를 바탕으로 ASRS 결과를 해석하고 있습니다."
              : state.currentRecord?.asrsAnalysis?.summary
                ? state.currentRecord.asrsAnalysis.summary
                : analysis.isComplete
                  ? analysis.summary
                  : "아직 6문항이 모두 입력되지는 않았습니다. 현재까지 입력된 응답을 기준으로 임시 해석을 보여드립니다."
          }</p>
        </div>

        <div class="grid-2">
          <div class="panel stack-md">
            <div class="eyebrow">screening signal</div>
            <div class="flex items-end justify-between gap-4">
              <strong style="font-size:1.8rem">${analysis.totalPositive} / 6</strong>
              <span class="chip">${analysis.severity}</span>
            </div>
            <p class="muted">유의미 문항 기준: 1~3번은 2점 이상, 4~6번은 3점 이상</p>
          </div>
          <div class="panel stack-md">
            <div class="eyebrow">domain split</div>
            <div class="report-item">
              <div class="flex items-center justify-between gap-4">
                <strong>주의력 결핍</strong>
                <span class="chip">${analysis.attentionPositive} / 4</span>
              </div>
              <div class="progress-bar"><div class="progress-fill" style="width:${analysis.attentionPositive * 25}%"></div></div>
            </div>
            <div class="report-item">
              <div class="flex items-center justify-between gap-4">
                <strong>과잉행동·충동성</strong>
                <span class="chip">${analysis.hyperPositive} / 2</span>
              </div>
              <div class="progress-bar"><div class="progress-fill" style="width:${analysis.hyperPositive * 50}%"></div></div>
            </div>
          </div>
        </div>

        <div class="panel stack-md">
          <div class="eyebrow">summary</div>
          <p class="muted">${state.currentRecord?.asrsAnalysis?.attention || analysis.attentionMessage}</p>
          <p class="muted">${state.currentRecord?.asrsAnalysis?.hyperactivity || analysis.hyperMessage}</p>
          <p class="muted">${state.currentRecord?.asrsAnalysis?.guidance || analysis.guidance}</p>
        </div>

        <div class="two-actions safe-bottom-actions">
          <button class="button-secondary" data-route-next="dsm">DSM-5 계속하기</button>
        </div>
      </section>
    `;
  },

  dsm() {
    const config = state.configs.dsm;
    const progress = ((state.dsmIndex + 1) / config.questions.length) * 100;
    const question = config.questions[state.dsmIndex];
    const currentAnswer = state.currentRecord?.tests.dsm5?.[state.dsmIndex]?.answer;
    return `
      <section class="page">
        <div class="panel stack-md">
          <div class="stack-sm">
            <div class="eyebrow">dsm-5</div>
            <div class="flex items-end justify-between gap-4">
              <div>
                <h2 class="title-lg">${question.section}</h2>
                <p class="muted">${config.description}</p>
              </div>
              <div class="eyebrow">${state.dsmIndex + 1} / ${config.questions.length}</div>
            </div>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
        </div>

        <div class="hero-card stack-lg">
          <p class="title-lg" style="font-size:clamp(1.5rem,5vw,2.3rem)">${question.prompt}</p>
          <p class="muted">${question.hint}</p>
          <div class="binary-grid">
            <button class="binary-button ${currentAnswer === false ? "selected-no" : ""}" data-dsm-answer="false">No</button>
            <button class="binary-button ${currentAnswer === true ? "selected-yes" : ""}" data-dsm-answer="true">Yes</button>
          </div>
          <div class="two-actions">
            <button class="button-ghost" ${state.dsmIndex === 0 ? "disabled" : ""} data-dsm-prev="true">이전 문항</button>
            <button class="button-secondary" data-route-next="game">건너뛰고 미니 게임</button>
          </div>
        </div>
      </section>
    `;
  },

  game() {
    return `
      <section class="page">
        <div class="hero-card stack-lg">
          <div class="eyebrow">mini game</div>
          <div class="stack-sm">
            <h2 class="title-lg">미니 게임형 측정은 다음 단계에서 구현 예정입니다.</h2>
            <p class="muted">현재는 자리만 잡아 두고, 다음 버튼으로 리포트 생성 흐름을 확인할 수 있게 해 두었습니다.</p>
          </div>
        </div>

        <div class="mini-game-placeholder">
          <div class="stack-md" style="max-width:320px;padding:1.5rem;">
            <div class="eyebrow">coming soon</div>
            <h3 class="title-lg">반응속도/주의 전환 게임 슬롯</h3>
            <p class="muted">추후 구현 시 이 영역에 게임 캔버스와 측정 로직을 추가하면 됩니다.</p>
          </div>
        </div>

        <button class="button-secondary" id="complete-game">다음으로 이동</button>
      </section>
    `;
  },

  report() {
    const report = state.currentRecord?.report;
    if (state.isGeneratingInsights || !report) {
      return `
        <section class="page">
          <div class="panel stack-md">
            <div class="eyebrow">report</div>
            <h2 class="title-lg">리포트를 생성하는 중입니다.</h2>
            <p class="muted">Gemini가 응답 내용을 바탕으로 요약과 권고안을 만들고 있습니다. 몇 초 정도 걸릴 수 있습니다.</p>
          </div>
        </section>
      `;
    }
    return `
      <section class="page">
        <div class="hero-card stack-lg">
          <div class="eyebrow">analysis report</div>
          <div class="stack-sm">
            <h2 class="title-lg">${state.currentRecord.id}의 현재 선별 결과는 <span style="color:#ffacea">${report.severity}</span> 관심군입니다.</h2>
            <p class="muted">${report.sections.summary}</p>
          </div>
        </div>

        <div class="grid-2">
          <div class="panel stack-md">
            <div class="eyebrow">radar graph</div>
            <div class="radar-wrap">${renderRadar(report.scores, state.configs.report.radarAxes)}</div>
          </div>
          <div class="stack-md">
            <div class="metric-card stack-sm">
              <span class="eyebrow">강점 신호</span>
              <p class="muted">${report.sections.strength}</p>
            </div>
            <div class="metric-card stack-sm">
              <span class="eyebrow">주의할 점</span>
              <p class="muted">${report.sections.watchout}</p>
            </div>
          </div>
        </div>

        <div class="panel report-list">
          ${Object.entries(report.scores).map(([key, value]) => `
            <div class="report-item">
              <div class="flex items-center justify-between gap-4">
                <strong>${scoreLabel(key)}</strong>
                <span class="chip">${value} / 100</span>
              </div>
              <div class="progress-bar"><div class="progress-fill" style="width:${value}%"></div></div>
            </div>
          `).join("")}
        </div>

        <button class="button-secondary" data-route-next="plan">개선 계획 보기</button>
      </section>
    `;
  },

  plan() {
    const plan = state.currentRecord?.plan;
    if (state.isGeneratingInsights || !plan) {
      return `
        <section class="page">
          <div class="panel stack-md">
            <div class="eyebrow">plan</div>
            <h2 class="title-lg">계획을 생성하는 중입니다.</h2>
            <p class="muted">리포트 생성과 함께 Gemini가 실행 가능한 계획 3가지를 정리하고 있습니다.</p>
          </div>
        </section>
      `;
    }
    return `
      <section class="page">
        <div class="hero-card stack-lg">
          <div class="eyebrow">action plan</div>
          <div class="stack-sm">
            <h2 class="title-lg">${state.currentRecord.id}에게 맞춘 3가지 제안</h2>
            <p class="muted">리포트 결과를 바탕으로 바로 실행 가능한 개선 방향을 정리했습니다.</p>
          </div>
        </div>

        <div class="tips-list">
          ${plan.suggestions.map((suggestion, index) => `
            <div class="tip-item">
              <strong>${index + 1}. 실행 제안</strong>
              <p class="muted">${suggestion}</p>
            </div>
          `).join("")}
        </div>

        <div class="chat-card panel stack-md">
          <div class="eyebrow">ai assistant</div>
          <div class="chat-log">
            ${plan.chat.map((item) => `
              <div class="chat-bubble ${item.role === "user" ? "user" : ""}">
                <strong>${item.role === "user" ? "사용자" : "AI"}</strong>
                <p class="muted">${item.text}</p>
              </div>
            `).join("")}
          </div>
          <form id="plan-chat-form" class="stack-sm">
            <input class="chat-input" name="message" placeholder="예: 회사 일정에 맞게 오전 루틴으로 바꿔줘" />
            <button class="button-secondary" type="submit">계획 수정 요청</button>
          </form>
        </div>
      </section>
    `;
  }
};

function scoreLabel(key) {
  const map = {
    attention: "집중 유지",
    executive: "실행 기능",
    impulse: "충동 조절",
    emotion: "정서 안정",
    structure: "일상 구조화"
  };
  return map[key] || key;
}

function renderAdminModal() {
  return `
    <div class="panel" style="position:fixed;inset:0;background:rgba(0,0,0,0.58);display:flex;align-items:center;justify-content:center;padding:1rem;z-index:30">
      <div class="panel stack-md" style="width:min(720px,100%);max-height:80vh;overflow:auto;background:#1b1b1b">
        <div class="flex items-center justify-between gap-4">
          <div class="stack-sm">
            <div class="eyebrow">admin</div>
            <h3 class="title-lg">저장된 사용자 목록</h3>
          </div>
          <button class="button-ghost" type="button" id="close-admin-modal">닫기</button>
        </div>
        <div class="stack-sm">
          ${state.records.length
            ? state.records.map((record) => `
              <div class="record-item">
                <div class="stack-sm">
                  <strong>${record.id}</strong>
                  <span class="muted">${record.fileName}</span>
                  <span class="muted">생성 ${formatDate(record.createdAt)} · 현재 단계 ${normalizeCurrentStep(record.currentStep)}</span>
                </div>
                <button class="button-ghost load-record" data-file="${record.fileName}">불러오기</button>
              </div>
            `).join("")
            : `<div class="list-card"><span class="muted">아직 저장된 기록이 없습니다.</span></div>`}
        </div>
      </div>
    </div>
  `;
}

function renderRadar(scores, labels) {
  const values = [
    scores.attention,
    scores.executive,
    scores.impulse,
    scores.emotion,
    scores.structure
  ];
  const center = 110;
  const radius = 84;
  const points = values.map((value, index) => {
    const angle = (-90 + index * (360 / values.length)) * (Math.PI / 180);
    const pointRadius = (radius * value) / 100;
    const x = center + pointRadius * Math.cos(angle);
    const y = center + pointRadius * Math.sin(angle);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");

  const labelNodes = labels.map((label, index) => {
    const angle = (-90 + index * (360 / labels.length)) * (Math.PI / 180);
    const labelRadius = radius + 22;
    const x = center + labelRadius * Math.cos(angle);
    const y = center + labelRadius * Math.sin(angle);
    return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" fill="#d7c0ce" font-size="10" text-anchor="middle">${label}</text>`;
  }).join("");

  return `
    <svg class="radar-svg" viewBox="0 0 220 240" aria-label="radar graph">
      <polygon points="110,26 189.87,84.02 159.39,177.98 60.61,177.98 30.13,84.02" fill="none" stroke="rgba(215,192,206,0.15)" />
      <polygon points="110,48 168.08,90.19 145.9,158.31 74.1,158.31 51.92,90.19" fill="none" stroke="rgba(215,192,206,0.10)" />
      <polygon points="110,68 152.32,98.76 136.16,148.49 83.84,148.49 67.68,98.76" fill="none" stroke="rgba(215,192,206,0.08)" />
      <polygon points="${points}" fill="rgba(246,122,223,0.16)" stroke="#ffacea" stroke-width="2"></polygon>
      ${values.map((value, index) => {
        const angle = (-90 + index * (360 / values.length)) * (Math.PI / 180);
        const pointRadius = (radius * value) / 100;
        const x = center + pointRadius * Math.cos(angle);
        const y = center + pointRadius * Math.sin(angle);
        return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3" fill="#ffacea"></circle>`;
      }).join("")}
      ${labelNodes}
    </svg>
  `;
}

function bindPageEvents() {
  document.querySelectorAll("[data-route-next]").forEach((node) => {
    node.addEventListener("click", async (event) => {
      const route = event.currentTarget.getAttribute("data-route-next");
      if (route === "report" || route === "plan") {
        await ensureInsights();
      }
      await syncCurrentStep(route);
      navTo(route);
    });
  });

  document.querySelector("#create-id-form")?.addEventListener("submit", (event) => {
    handleCreateId(event).catch((error) => setStatus(error.message));
  });

  document.querySelector("#manual-load-form")?.addEventListener("submit", (event) => {
    state.loadUserId = new FormData(event.currentTarget).get("userId");
    submitManualLoad(event).catch((error) => setStatus(error.message));
  });

  document.querySelector("#toggle-existing-id-form")?.addEventListener("click", () => {
    toggleExistingIdForm();
  });

  document.querySelector("#open-admin-modal")?.addEventListener("click", () => {
    openAdminModal();
  });

  document.querySelector("#close-admin-modal")?.addEventListener("click", () => {
    closeAdminModal();
  });

  document.querySelectorAll(".load-record").forEach((node) => {
    node.addEventListener("click", () => {
      closeAdminModal();
      handleLoadRecord(node.getAttribute("data-file")).catch((error) => setStatus(error.message));
    });
  });

  document.querySelectorAll("[data-asrs-answer]").forEach((node) => {
    node.addEventListener("click", () => {
      answerAsrs(Number(node.getAttribute("data-asrs-answer"))).catch((error) => setStatus(error.message));
    });
  });

  document.querySelector("#asrs-next-button")?.addEventListener("click", () => {
    goToNextAsrsQuestion().catch((error) => setStatus(error.message));
  });

  document.querySelectorAll("[data-dsm-answer]").forEach((node) => {
    node.addEventListener("click", () => {
      answerDsm(node.getAttribute("data-dsm-answer") === "true").catch((error) => setStatus(error.message));
    });
  });

  document.querySelector("[data-dsm-prev='true']")?.addEventListener("click", () => {
    state.dsmIndex = Math.max(0, state.dsmIndex - 1);
    render();
  });

  document.querySelector("#complete-game")?.addEventListener("click", () => {
    completeGamePlaceholder().catch((error) => setStatus(error.message));
  });

  document.querySelector("#plan-chat-form")?.addEventListener("submit", (event) => {
    sendPlanChat(event).catch((error) => setStatus(error.message));
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
