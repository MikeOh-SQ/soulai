const state = {
  route: "intro",
  configs: {
    asar: null,
    dsm: null,
    report: null
  },
  aiStatus: null,
  records: [],
  currentRecord: null,
  asarIndex: 0,
  dsmIndex: 0,
  isGeneratingInsights: false,
  manualFileName: "",
  statusMessage: ""
};

const routes = [
  { key: "intro", label: "Intro", icon: "info" },
  { key: "id", label: "ID", icon: "fingerprint" },
  { key: "asar", label: "ASAR", icon: "quiz" },
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
  const [asar, dsm, report] = await Promise.all([
    api(`/api/config/asar.json`),
    api(`/api/config/dsm-5.json`),
    api(`/api/config/report.json`)
  ]);
  state.configs = { asar, dsm, report };
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

function createEmptyRecord(userId) {
  const createdAt = new Date().toISOString();
  const safeId = userId.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-_]/g, "").toLowerCase() || "guest";
  const fileName = `${safeId}-${makeTimestamp(new Date())}.json`;
  return {
    id: safeId,
    createdAt,
    updatedAt: createdAt,
    fileName,
    currentStep: "id",
    tests: {
      asar: [],
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
  if (["asar", "dsm", "game", "report", "plan"].includes(route) && !state.currentRecord) {
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
  navTo("asar");
}

async function handleLoadRecord(fileName) {
  state.currentRecord = await api(`/api/records/${fileName}`);
  state.asarIndex = Math.min(state.currentRecord.tests.asar.length, state.configs.asar.questions.length - 1);
  state.dsmIndex = Math.min(state.currentRecord.tests.dsm5.length, state.configs.dsm.questions.length - 1);
  setStatus(`${fileName} 불러오기 완료`);
  navTo(state.currentRecord.currentStep || "id");
}

async function submitManualLoad(event) {
  event.preventDefault();
  if (!state.manualFileName) {
    setStatus("불러올 파일명을 입력해 주세요.");
    return;
  }
  await handleLoadRecord(state.manualFileName);
}

async function answerAsar(value) {
  const question = state.configs.asar.questions[state.asarIndex];
  state.currentRecord.tests.asar[state.asarIndex] = {
    question,
    answer: value
  };
  state.currentRecord.currentStep = "asar";
  await persistRecord();

  if (state.asarIndex < state.configs.asar.questions.length - 1) {
    state.asarIndex += 1;
  } else {
    state.route = "dsm";
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
  bottomNav.innerHTML = routes
    .map((route) => {
      const active = state.route === route.key ? "active" : "";
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
          <div class="eyebrow">focus screening</div>
          <div class="stack-md">
            <h2 class="title-xl">ADHD 선별과 감별을 위한 모바일 흐름을 <span style="color:#ffacea">soul.ai.kr</span>에서 시작합니다.</h2>
            <p class="muted">ASAR 5점 척도, DSM-5 예/아니오 문항, 추후 확장할 미니 게임, 분석 리포트, 개선 계획까지 한 흐름으로 연결됩니다.</p>
          </div>
          <div class="grid-2">
            <div class="list-card">
              <strong>저장 구조</strong>
              <span class="muted">각 사용자는 id-생성날짜.json 파일로 database 폴더에 저장됩니다.</span>
            </div>
            <div class="list-card">
              <strong>현재 구현</strong>
              <span class="muted">${state.aiStatus?.configured ? `Gemini ${escapeHtml(state.aiStatus.model)}가 연결되어 리포트와 계획 문장을 생성합니다.` : "Gemini API 키가 설정되지 않아 AI 생성이 비활성화되어 있습니다."}</span>
            </div>
          </div>
          <button class="button-secondary" data-route-next="id">평가 시작하기</button>
        </div>
      </section>
    `;
  },

  id() {
    return `
      <section class="page">
        <div class="hero-card stack-lg">
          <div class="eyebrow">identity</div>
          <div class="stack-sm">
            <h2 class="title-lg">새로운 ID를 만들거나 기존 JSON 기록을 불러오세요.</h2>
            <p class="muted">생성 즉시 database 폴더에 저장되며, 각 단계 결과가 같은 파일에 누적됩니다.</p>
          </div>
        </div>

        ${state.statusMessage ? `<div class="panel">${state.statusMessage}</div>` : ""}

        <div class="grid-2">
          <form id="create-id-form" class="panel stack-md">
            <div class="stack-sm">
              <div class="eyebrow">new soul id</div>
              <h3 class="title-lg">새 사용자 생성</h3>
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
            <form id="manual-load-form" class="stack-sm">
              <div class="field">
                <label for="file-name">파일명 직접 입력</label>
                <input id="file-name" name="fileName" class="text-input" value="${escapeHtml(state.manualFileName)}" placeholder="예: minsu01-20260402-081500.json" />
              </div>
              <button class="button-ghost" type="submit">파일명으로 불러오기</button>
            </form>
          </div>
        </div>

        <div class="panel stack-md">
          <div class="stack-sm">
            <div class="eyebrow">database</div>
            <h3 class="title-lg">저장된 사용자 목록</h3>
          </div>
          <div class="stack-sm">
            ${state.records.length
              ? state.records.map((record) => `
                <div class="record-item">
                  <div class="stack-sm">
                    <strong>${record.id}</strong>
                    <span class="muted">${record.fileName}</span>
                    <span class="muted">생성 ${formatDate(record.createdAt)} · 현재 단계 ${record.currentStep}</span>
                  </div>
                  <button class="button-ghost load-record" data-file="${record.fileName}">불러오기</button>
                </div>
              `).join("")
              : `<div class="list-card"><span class="muted">아직 저장된 기록이 없습니다.</span></div>`}
          </div>
        </div>
      </section>
    `;
  },

  asar() {
    const config = state.configs.asar;
    const progress = ((state.asarIndex + 1) / config.questions.length) * 100;
    const currentAnswer = state.currentRecord?.tests.asar?.[state.asarIndex]?.answer;
    return `
      <section class="page">
        <div class="panel stack-md">
          <div class="stack-sm">
            <div class="eyebrow">asar test</div>
            <div class="flex items-end justify-between gap-4">
              <div>
                <h2 class="title-lg">${config.title}</h2>
                <p class="muted">${config.description}</p>
              </div>
              <div class="eyebrow">${state.asarIndex + 1} / ${config.questions.length}</div>
            </div>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
        </div>

        <div class="hero-card stack-lg">
          <p class="title-lg" style="font-size:clamp(1.5rem,5vw,2.3rem)">${config.questions[state.asarIndex]}</p>
          <div class="question-scale">
            ${config.scale.map((item) => `
              <button class="choice-button ${currentAnswer === item.value ? "selected" : ""}" data-asar-answer="${item.value}">
                <div class="choice-dot"><strong>${item.value}</strong></div>
                <span class="choice-label">${item.label}</span>
              </button>
            `).join("")}
          </div>
          <div class="two-actions">
            <button class="button-ghost" ${state.asarIndex === 0 ? "disabled" : ""} data-asar-prev="true">이전 문항</button>
            <button class="button-secondary" data-route-next="dsm">건너뛰고 다음 단계</button>
          </div>
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
      navTo(route);
    });
  });

  document.querySelector("#create-id-form")?.addEventListener("submit", (event) => {
    handleCreateId(event).catch((error) => setStatus(error.message));
  });

  document.querySelector("#manual-load-form")?.addEventListener("submit", (event) => {
    state.manualFileName = new FormData(event.currentTarget).get("fileName");
    submitManualLoad(event).catch((error) => setStatus(error.message));
  });

  document.querySelectorAll(".load-record").forEach((node) => {
    node.addEventListener("click", () => {
      handleLoadRecord(node.getAttribute("data-file")).catch((error) => setStatus(error.message));
    });
  });

  document.querySelectorAll("[data-asar-answer]").forEach((node) => {
    node.addEventListener("click", () => {
      answerAsar(Number(node.getAttribute("data-asar-answer"))).catch((error) => setStatus(error.message));
    });
  });

  document.querySelector("[data-asar-prev='true']")?.addEventListener("click", () => {
    state.asarIndex = Math.max(0, state.asarIndex - 1);
    render();
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
