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
  showJsonModal: false,
  jsonModalContent: "",
  statusMessage: "",
  gameUi: null
};

const routes = [
  { key: "intro", label: "Intro", icon: "info" },
  { key: "asrs", label: "ASRS", icon: "quiz" },
  { key: "dsm", label: "DSM", icon: "checklist" },
  { key: "game", label: "React", icon: "neurology" },
  { key: "report", label: "Report", icon: "analytics" },
  { key: "plan", label: "Plan", icon: "event_note" }
];

const app = document.querySelector("#app");
const bottomNav = document.querySelector("#bottom-nav");
const topbarActions = document.querySelector("#topbar-actions");
const GAME_ORDER = ["signal_detection", "go_nogo", "balance_hold"];
const GAME_META = {
  signal_detection: {
    title: "신호 찾기",
    eyebrow: "signal detection",
    domain: "부주의 측정",
    description: "파란 별이 나오면 탭하고, 다른 도형은 누르지 않습니다.",
    practiceTrials: 5,
    mainTrials: 40
  },
  go_nogo: {
    title: "멈춤 버튼",
    eyebrow: "go / no-go",
    domain: "충동성 측정",
    description: "동그라미는 바닥 직전에 누르고, 엑스는 누르지 않습니다.",
    practiceTrials: 8,
    mainTrials: 50
  },
  balance_hold: {
    title: "균형 유지",
    eyebrow: "balance hold",
    domain: "과잉행동 / 자기조절 측정",
    description: "기기를 안정적으로 유지해 중앙 영역 안에 공을 머물게 합니다.",
    durationMs: 30000
  }
};
const SIGNAL_IMAGE_BASE_PATH = "/react1";
const SIGNAL_TARGET_IMAGE = `${SIGNAL_IMAGE_BASE_PATH}/0.gif`;
const SIGNAL_FEEDBACK_IMAGES = {
  idle: `${SIGNAL_IMAGE_BASE_PATH}/idle.png`,
  success: `${SIGNAL_IMAGE_BASE_PATH}/true.png`,
  fail: `${SIGNAL_IMAGE_BASE_PATH}/fail.png`
};
const GO_NOGO_IMAGE_BASE_PATH = "/react2";
const GO_NOGO_TRIAL_DURATION_MS = 1200;
const GO_NOGO_SUCCESS_WINDOW_MS = 250;
const GO_NOGO_INTER_TRIAL_MS = 450;
const GO_NOGO_BACKGROUND_IMAGE = `${GO_NOGO_IMAGE_BASE_PATH}/back.gif`;
const GO_NOGO_FEEDBACK_IMAGES = {
  idle: `${GO_NOGO_IMAGE_BASE_PATH}/idle.png`,
  success: `${GO_NOGO_IMAGE_BASE_PATH}/true.png`,
  fail: `${GO_NOGO_IMAGE_BASE_PATH}/fail.png`
};
const GO_NOGO_STIMULUS_IMAGES = {
  go: `${GO_NOGO_IMAGE_BASE_PATH}/o.gif`,
  nogo: `${GO_NOGO_IMAGE_BASE_PATH}/x.gif`
};
const SIGNAL_DISTRACTOR_IMAGES = [1, 2, 3, 4, 5].map((index) => ({
  stimulusType: "non-target",
  variant: index,
  imageSrc: `${SIGNAL_IMAGE_BASE_PATH}/${index}.gif`
}));
const gameRuntime = {
  timeouts: new Set(),
  intervalId: null,
  frameId: null,
  listeners: [],
  activeTrial: null,
  pointerControl: { x: 0, y: 0 },
  balanceSamples: [],
  lastBalanceSampleAt: 0,
  currentPhase: null,
  currentTestKey: null,
  liveDomUpdater: null
};

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
      game: createEmptyGameState()
    },
    dsm5Analysis: null,
    report: null,
    plan: {
      suggestions: [],
      chat: []
    }
  };
}

function createEmptyGameState() {
  return {
    status: "pending",
    mode: "assessment",
    currentTestIndex: 0,
    currentTestKey: GAME_ORDER[0],
    tests: {
      signal_detection: null,
      go_nogo: null,
      balance_hold: null
    },
    summary: null,
    rawEventLog: [],
    startedAt: null,
    completedAt: null
  };
}

function ensureGameState(record = state.currentRecord) {
  if (!record) {
    return null;
  }

  if (!record.tests) {
    record.tests = {};
  }

  if (!record.tests.game || typeof record.tests.game !== "object") {
    record.tests.game = createEmptyGameState();
  }

  if (!record.tests.game.tests) {
    record.tests.game.tests = createEmptyGameState().tests;
  }

  if (!Array.isArray(record.tests.game.rawEventLog)) {
    record.tests.game.rawEventLog = [];
  }

  if (!Number.isInteger(record.tests.game.currentTestIndex)) {
    record.tests.game.currentTestIndex = 0;
  }

  record.tests.game.currentTestKey = record.tests.game.currentTestKey || GAME_ORDER[record.tests.game.currentTestIndex] || GAME_ORDER[0];
  record.tests.game.mode = record.tests.game.mode || "assessment";
  return record.tests.game;
}

function ensureGuestGameRecord() {
  if (state.currentRecord) {
    return;
  }

  const guestId = `reactivity-${makeTimestamp(new Date())}`;
  state.currentRecord = createEmptyRecord(guestId);
  state.currentRecord.currentStep = "game";
  ensureGameState();
  persistRecord().catch((error) => setStatus(error.message));
}

function getGameState(record = state.currentRecord) {
  return ensureGameState(record);
}

function getAsrsAnswers(record = state.currentRecord) {
  const raw = record?.tests?.asrs || record?.tests?.asar || [];
  if (Array.isArray(raw)) {
    return raw.map((item) => (typeof item === "number" ? { answer: item } : item));
  }
  if (Array.isArray(raw?.responses)) {
    return raw.responses.map((answer) => ({ answer }));
  }
  return [];
}

function getDsmAnswers(record = state.currentRecord) {
  const raw = record?.tests?.dsm5 || [];
  if (Array.isArray(raw)) {
    return raw.map((item, index) => {
      if (typeof item?.answer === "boolean") {
        return item;
      }
      if (typeof item === "boolean") {
        return {
          section: state.configs.dsm?.questions?.[index]?.section,
          answer: item
        };
      }
      return item;
    });
  }
  if (Array.isArray(raw?.responses)) {
    return raw.responses.map((answer, index) => ({
      section: state.configs.dsm?.questions?.[index]?.section,
      answer
    }));
  }
  return [];
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

function analyzeDsm(record = state.currentRecord) {
  const answers = getDsmAnswers(record).filter((item) => typeof item?.answer === "boolean");
  const inattentionYes = answers
    .filter((item) => item.section === "부주의" && item.answer)
    .length;
  const hyperactivityYes = answers
    .filter((item) => item.section === "과잉행동/충동성" && item.answer)
    .length;
  const contextualYes = answers
    .filter((item) => item.section === "추가 확인" && item.answer)
    .length;
  const totalQuestions = state.configs.dsm?.questions?.length || 18;
  const completedCount = answers.length;
  const isComplete = completedCount === totalQuestions;

  let subtype = "판정 보류";
  let summary = "아직 DSM-5 문항 응답이 충분하지 않아 임시 집계만 표시합니다.";
  let detail = "최근 6개월 동안의 반복 패턴을 기준으로 끝까지 응답하면 유형 분류를 확인할 수 있습니다.";

  if (isComplete) {
    if (inattentionYes >= 6 && hyperactivityYes >= 6) {
      subtype = "복합형 가능성";
      summary = "부주의와 과잉행동·충동성 영역이 모두 기준 이상으로 나타났습니다.";
      detail = "집중 유지의 어려움과 빠른 반응/안절부절함이 함께 관찰되는 패턴입니다.";
    } else if (inattentionYes >= 6) {
      subtype = "부주의형 가능성";
      summary = "부주의 영역 응답이 기준 이상으로 더 두드러집니다.";
      detail = "집중, 정리, 기억, 과제 마무리와 관련된 어려움이 상대적으로 크게 보입니다.";
    } else if (hyperactivityYes >= 6) {
      subtype = "과잉행동·충동형 가능성";
      summary = "과잉행동·충동성 영역 응답이 기준 이상으로 더 두드러집니다.";
      detail = "안절부절함, 즉각 반응, 기다리기 어려움과 같은 패턴이 상대적으로 크게 보입니다.";
    } else {
      subtype = "무증상 범위";
      summary = "현재 DSM-5 선별 기준상 뚜렷한 유형 신호는 크지 않습니다.";
      detail = "지금 응답만으로는 특정 유형 가능성이 기준 이상으로 모이지 않았습니다.";
    }
  } else {
    const inattentionGap = Math.max(6 - inattentionYes, 0);
    const hyperactivityGap = Math.max(6 - hyperactivityYes, 0);
    summary = `현재까지 부주의 ${inattentionYes}개, 과잉행동·충동성 ${hyperactivityYes}개가 Yes입니다.`;
    detail = `기준까지는 부주의 ${inattentionGap}개, 과잉행동·충동성 ${hyperactivityGap}개의 Yes 응답이 더 필요합니다.`;
  }

  return {
    completedCount,
    totalQuestions,
    isComplete,
    inattentionYes,
    hyperactivityYes,
    contextualYes,
    subtype,
    summary,
    detail,
    guidance: "본 결과는 진단이 아니라 현재 상태를 참고하기 위한 선별 결과입니다."
  };
}

function summarizeAsrsForStorage(record = state.currentRecord) {
  const responses = getAsrsAnswers(record)
    .map((item) => Number(item.answer))
    .filter((value) => Number.isFinite(value));
  const attentionResponses = responses.slice(0, 4);
  const hyperactivityResponses = responses.slice(4, 6);
  const analysis = analyzeAsrs(record);

  return {
    responses,
    attention_score: attentionResponses.reduce((sum, value) => sum + value, 0),
    attention_max: 16,
    hyperactivity_score: hyperactivityResponses.reduce((sum, value) => sum + value, 0),
    hyperactivity_max: 8,
    total_score: responses.reduce((sum, value) => sum + value, 0),
    total_max: 24,
    positive_count: analysis.totalPositive
  };
}

function summarizeDsmForStorage(record = state.currentRecord) {
  const responses = getDsmAnswers(record)
    .map((item) => (typeof item?.answer === "boolean" ? item.answer : null));
  const analysis = analyzeDsm(record);

  return {
    responses,
    inattention_true_count: analysis.inattentionYes,
    hyperactivity_true_count: analysis.hyperactivityYes,
    contextual_true_count: analysis.contextualYes,
    total_true_count: analysis.inattentionYes + analysis.hyperactivityYes,
    subtype: analysis.subtype
  };
}

function summarizeGameForStorage(record = state.currentRecord) {
  const game = getGameState(record);
  if (!game) {
    return createEmptyGameState();
  }

  const compactTests = Object.fromEntries(
    Object.entries(game.tests || {}).map(([key, value]) => [
      key,
      value && Number.isFinite(value.score) ? { score: value.score } : null
    ])
  );

  return {
    status: game.status || "pending",
    currentTestIndex: game.currentTestIndex || 0,
    currentTestKey: game.currentTestKey || GAME_ORDER[0],
    tests: compactTests,
    summary: {
      inattention_signal_score: game.summary?.inattention_signal?.score ?? null,
      impulsivity_signal_score: game.summary?.impulsivity_signal?.score ?? null,
      activity_signal_score: game.summary?.activity_signal?.score ?? null
    }
  };
}

function buildPersistedRecord(record = state.currentRecord) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    fileName: record.fileName,
    currentStep: record.currentStep,
    tests: {
      asrs: summarizeAsrsForStorage(record),
      dsm5: summarizeDsmForStorage(record),
      game: summarizeGameForStorage(record)
    },
    report: record.report || null,
    plan: record.plan || { suggestions: [], chat: [] }
  };
}

function renderTopbarActions() {
  if (!topbarActions) {
    return;
  }

  topbarActions.innerHTML = `
    <button class="button-ghost topbar-button" type="button" id="open-json-modal">JSON 보기</button>
  `;

  topbarActions.querySelector("#open-json-modal")?.addEventListener("click", () => {
    openJsonModal().catch((error) => setStatus(error.message));
  });
}

async function openJsonModal() {
  if (!state.currentRecord?.fileName) {
    state.jsonModalContent = JSON.stringify({
      message: "아직 생성되거나 불러온 검사 기록이 없습니다."
    }, null, 2);
    state.showJsonModal = true;
    render();
    return;
  }

  const latestRecord = await api(`/api/records/${state.currentRecord.fileName}`);
  state.jsonModalContent = JSON.stringify(latestRecord, null, 2);
  state.showJsonModal = true;
  render();
}

function closeJsonModal() {
  state.showJsonModal = false;
  render();
}

async function persistRecord() {
  if (!state.currentRecord) {
    return;
  }

  state.currentRecord.updatedAt = new Date().toISOString();
  const payload = buildPersistedRecord(state.currentRecord);
  await api("/api/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: state.currentRecord.fileName,
      data: payload
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
  if (route === "game" && !state.currentRecord) {
    ensureGuestGameRecord();
    resetGameUi();
  }

  if (["asrs", "asrs-result", "dsm", "report", "plan"].includes(route) && !state.currentRecord) {
    requireRecord(route);
    return;
  }

  if (route !== "game") {
    cleanupGameRuntime();
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
  if (!state.currentRecord.dsm5Analysis) {
    state.currentRecord.dsm5Analysis = analyzeDsm(state.currentRecord);
  }
  ensureGameState();
  resetGameUi();
  state.asrsIndex = Math.min(getAsrsAnswers(state.currentRecord).length, state.configs.asrs.questions.length - 1);
  state.dsmIndex = Math.min(getDsmAnswers(state.currentRecord).length, state.configs.dsm.questions.length - 1);
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

function scheduleTimeout(callback, delay) {
  const timeoutId = window.setTimeout(() => {
    gameRuntime.timeouts.delete(timeoutId);
    callback();
  }, delay);
  gameRuntime.timeouts.add(timeoutId);
  return timeoutId;
}

function cleanupGameRuntime() {
  gameRuntime.timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
  gameRuntime.timeouts.clear();

  if (gameRuntime.intervalId) {
    window.clearInterval(gameRuntime.intervalId);
    gameRuntime.intervalId = null;
  }

  if (gameRuntime.frameId) {
    window.cancelAnimationFrame(gameRuntime.frameId);
    gameRuntime.frameId = null;
  }

  gameRuntime.listeners.forEach(({ target, type, handler, options }) => {
    target.removeEventListener(type, handler, options);
  });
  gameRuntime.listeners = [];
  gameRuntime.activeTrial = null;
  gameRuntime.balanceSamples = [];
  gameRuntime.lastBalanceSampleAt = 0;
  gameRuntime.currentPhase = null;
  gameRuntime.currentTestKey = null;
  gameRuntime.tapHandler = null;
  gameRuntime.metrics = null;
  gameRuntime.liveDomUpdater = null;
}

function addGameListener(target, type, handler, options) {
  target.addEventListener(type, handler, options);
  gameRuntime.listeners.push({ target, type, handler, options });
}

function renderGameUi(nextUi) {
  const prevUi = state.gameUi;
  state.gameUi = {
    ...(state.gameUi || {}),
    ...nextUi
  };

  if (
    typeof gameRuntime.liveDomUpdater === "function" &&
    state.route === "game" &&
    state.gameUi?.phase === "running" &&
    state.gameUi?.activeTestKey === "balance_hold"
  ) {
    gameRuntime.liveDomUpdater(state.gameUi);
    return;
  }
  render();
}

function createOverviewUi() {
  const game = getGameState();
  const activeTestKey = game?.currentTestKey || GAME_ORDER[0];
  return {
    phase: "overview",
    activeTestKey,
    stage: "intro",
    prompt: "",
    message: "",
    countdown: null,
    progressPercent: ((game?.currentTestIndex || 0) / GAME_ORDER.length) * 100,
    signalFeedbackState: "idle",
    goNoGoFeedbackState: "idle"
  };
}

function resetGameUi() {
  state.gameUi = createOverviewUi();
}

function getCurrentGameMeta() {
  const game = getGameState();
  return GAME_META[game?.currentTestKey || GAME_ORDER[0]];
}

function pushGameEvent(event) {
  const game = getGameState();
  if (!game) {
    return;
  }
  game.rawEventLog.push({
    timestamp: Date.now(),
    test_type: game.currentTestKey,
    ...event
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function shuffle(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function mean(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length < 2) {
    return 0;
  }
  const average = mean(values);
  const variance = mean(values.map((value) => (value - average) ** 2));
  return Math.sqrt(variance);
}

function buildSignalTrials(count, targetRatio) {
  const targetCount = Math.round(count * targetRatio);
  const trials = [
    ...Array.from({ length: targetCount }, () => ({
      stimulusType: "target",
      variant: 0,
      imageSrc: SIGNAL_TARGET_IMAGE
    })),
    ...Array.from({ length: count - targetCount }, (_, index) => {
      const template = SIGNAL_DISTRACTOR_IMAGES[index % SIGNAL_DISTRACTOR_IMAGES.length];
      return {
        ...template
      };
    })
  ];
  return shuffle(trials);
}

function withReplayToken(src, token) {
  if (!src) {
    return src;
  }
  const separator = src.includes("?") ? "&" : "?";
  return `${src}${separator}v=${encodeURIComponent(token || "0")}`;
}

function buildGoNoGoTrials(count, goRatio) {
  const goCount = Math.round(count * goRatio);
  const trials = [
    ...Array.from({ length: goCount }, () => ({ stimulusType: "go", imageSrc: GO_NOGO_STIMULUS_IMAGES.go, label: "원" })),
    ...Array.from({ length: count - goCount }, () => ({ stimulusType: "nogo", imageSrc: GO_NOGO_STIMULUS_IMAGES.nogo, label: "엑스" }))
  ];
  return shuffle(trials);
}

async function startGameFlow() {
  ensureGuestGameRecord();
  const game = getGameState();
  if (game.status === "completed") {
    await syncCurrentStep("report");
    navTo("report");
    await ensureInsights();
    return;
  }
  game.status = "running";
  game.startedAt = game.startedAt || new Date().toISOString();
  game.currentTestKey = GAME_ORDER[game.currentTestIndex] || GAME_ORDER[0];
  state.currentRecord.currentStep = "game";
  await persistRecord();
  if (game.currentTestKey === "signal_detection") {
    showSignalDetectionInstruction();
    return;
  }
  await startCountdownForTest(game.currentTestKey);
}

async function selectGameTest(testKey) {
  ensureGuestGameRecord();
  const game = getGameState();
  const targetIndex = GAME_ORDER.indexOf(testKey);
  if (targetIndex === -1) {
    return;
  }

  cleanupGameRuntime();
  game.currentTestIndex = targetIndex;
  game.currentTestKey = testKey;
  game.status = "running";
  game.startedAt = game.startedAt || new Date().toISOString();
  state.currentRecord.currentStep = "game";
  state.gameUi = {
    ...createOverviewUi(),
    activeTestKey: testKey,
    progressPercent: (targetIndex / GAME_ORDER.length) * 100
  };
  await persistRecord();
  if (testKey === "signal_detection") {
    showSignalDetectionInstruction();
    return;
  }
  await startCountdownForTest(testKey);
}

function showSignalDetectionInstruction() {
  cleanupGameRuntime();
  const game = getGameState();
  renderGameUi({
    phase: "instruction",
    activeTestKey: "signal_detection",
    stage: "instruction",
    stimulus: {
      stimulusType: "target",
      variant: 0,
      imageSrc: SIGNAL_TARGET_IMAGE
    },
    stimulusVisible: true,
    signalFeedbackState: "idle",
    stimulusReplayToken: `signal-instruction-${Date.now()}`,
    progressPercent: (game.currentTestIndex / GAME_ORDER.length) * 100
  });
}

async function startCountdownForTest(testKey) {
  cleanupGameRuntime();
  const game = getGameState();
  game.currentTestKey = testKey;
  gameRuntime.currentTestKey = testKey;
  renderGameUi({
    phase: "countdown",
    activeTestKey: testKey,
    stage: "countdown",
    countdown: 3,
    message: "검사 시작 전 규칙을 다시 확인하세요.",
    progressPercent: (game.currentTestIndex / GAME_ORDER.length) * 100
  });

  for (let value = 3; value >= 1; value -= 1) {
    renderGameUi({ countdown: value });
    await new Promise((resolve) => scheduleTimeout(resolve, 800));
  }

  if (testKey === "signal_detection") {
    startSignalDetectionMain();
  } else if (testKey === "go_nogo") {
    startGoNoGoPractice();
  } else {
    startBalanceCalibration();
  }
}

function completeCurrentGameTest(result) {
  const game = getGameState();
  game.tests[game.currentTestKey] = result;
  game.status = "running";

  const nextIndex = GAME_ORDER.indexOf(game.currentTestKey) + 1;
  const nextTestKey = GAME_ORDER[nextIndex] || null;

  if (nextTestKey) {
    game.currentTestIndex = nextIndex;
    game.currentTestKey = nextTestKey;
    game.summary = summarizeReactivity();
    persistRecord().catch((error) => setStatus(error.message));
    startCountdownForTest(nextTestKey).catch((error) => setStatus(error.message));
    return;
  }

  game.currentTestIndex = GAME_ORDER.length - 1;
  game.currentTestKey = GAME_ORDER[GAME_ORDER.length - 1];
  game.status = "completed";
  game.completedAt = new Date().toISOString();
  game.summary = summarizeReactivity();
  persistRecord().catch((error) => setStatus(error.message));
  renderGameUi({
    phase: "completed",
    activeTestKey: result.test_type,
    result,
    progressPercent: 100
  });
}

async function goToNextGameTest() {
  const game = getGameState();
  if (game.status === "completed") {
    await syncCurrentStep("report");
    navTo("report");
    await ensureInsights();
    return;
  }

  await startCountdownForTest(game.currentTestKey);
}

function summarizeReactivity(record = state.currentRecord) {
  const game = getGameState(record);
  if (!game) {
    return null;
  }

  const signal = game.tests.signal_detection;
  const nogo = game.tests.go_nogo;
  const balance = game.tests.balance_hold;

  const inattentionScore = signal?.score ?? null;
  const impulsivityScore = nogo?.score ?? null;
  const activityScore = balance?.score ?? null;

  const parts = [];
  if (Number.isFinite(inattentionScore)) {
    parts.push(`부주의 신호 ${inattentionScore}점`);
  }
  if (Number.isFinite(impulsivityScore)) {
    parts.push(`충동성 신호 ${impulsivityScore}점`);
  }
  if (Number.isFinite(activityScore)) {
    parts.push(`활동성 신호 ${activityScore}점`);
  }

  const sorted = [
    { key: "부주의", value: inattentionScore },
    { key: "충동성", value: impulsivityScore },
    { key: "활동성", value: activityScore }
  ].filter((item) => Number.isFinite(item.value)).sort((a, b) => b.value - a.value);

  let summary = "반응성 테스트 3종 결과가 저장되었습니다.";
  if (sorted.length) {
    summary = `${sorted[0].key} 관련 신호가 상대적으로 더 높게 관찰되며, ${parts.join(", ")} 수준입니다.`;
  }

  const highlights = [];
  if (signal) {
    highlights.push({
      label: "신호 찾기 정확도",
      value: `${signal.hit_count || 0} / ${signal.target_count || 0}`,
      note: `누락 ${signal.omission_errors || 0}회, 오반응 ${signal.false_alarm_count || 0}회`
    });
    highlights.push({
      label: "신호 찾기 반응시간",
      value: `${signal.mean_reaction_time || 0}ms`,
      note: `변동성 ${signal.reaction_time_variability || 0}ms`
    });
  }
  if (nogo) {
    highlights.push({
      label: "억제 조절 성공",
      value: `${nogo.go_hit_count || 0} / ${nogo.go_count || 0}`,
      note: `금지 자극 오반응 ${nogo.commission_errors || 0}회`
    });
    highlights.push({
      label: "go/no-go 반응시간",
      value: `${nogo.mean_go_reaction_time || 0}ms`,
      note: `성급 반응 ${nogo.premature_response_count || 0}회`
    });
  }
  if (balance) {
    highlights.push({
      label: "추적 유지 시간",
      value: `${balance.stable_hold_time || 0}s`,
      note: `큰 흔들림 ${balance.large_motion_count || 0}회`
    });
    highlights.push({
      label: "움직임 안정성",
      value: `${balance.movement_variability || 0}`,
      note: `보정 ${balance.correction_count || 0}회`
    });
  }

  return {
    inattention_signal: {
      score: inattentionScore,
      source_test: "signal_detection"
    },
    impulsivity_signal: {
      score: impulsivityScore,
      source_test: "go_nogo"
    },
    activity_signal: {
      score: activityScore,
      source_test: "balance_hold"
    },
    summary,
    highlights
  };
}

function startSignalDetectionPractice() {
  const practiceTrials = buildSignalTrials(GAME_META.signal_detection.practiceTrials, 0.4);
  runSignalDetectionTrials(practiceTrials, "practice");
}

function startSignalDetectionMain() {
  const mainTrials = buildSignalTrials(GAME_META.signal_detection.mainTrials, 0.25);
  runSignalDetectionTrials(mainTrials, "main");
}

function runSignalDetectionTrials(trials, stage) {
  cleanupGameRuntime();
  const metrics = {
    targetCount: trials.filter((trial) => trial.stimulusType === "target").length,
    nonTargetCount: trials.filter((trial) => trial.stimulusType !== "target").length,
    hitCount: 0,
    omissionErrors: 0,
    falseAlarmCount: 0,
    lateResponseCount: 0,
    reactionTimes: [],
    firstHalfHits: 0,
    firstHalfTargets: 0,
    secondHalfHits: 0,
    secondHalfTargets: 0
  };
  gameRuntime.metrics = metrics;
  let trialIndex = 0;

  const nextTrial = () => {
    if (trialIndex >= trials.length) {
      if (stage === "practice") {
        renderGameUi({
          phase: "result",
          activeTestKey: "signal_detection",
          stage: "practice-complete",
          result: {
            title: "연습 완료",
            interpretation: "규칙을 확인했습니다. 이제 본 검사 40문항을 시작합니다."
          },
          progressPercent: (getGameState().currentTestIndex / GAME_ORDER.length) * 100
        });
        return;
      }

      const meanReactionTime = Math.round(mean(metrics.reactionTimes));
      const reactionTimeVariability = Math.round(standardDeviation(metrics.reactionTimes));
      const firstHalfAccuracy = metrics.firstHalfTargets ? metrics.firstHalfHits / metrics.firstHalfTargets : 0;
      const secondHalfAccuracy = metrics.secondHalfTargets ? metrics.secondHalfHits / metrics.secondHalfTargets : 0;
      const sustainedAttentionDrop = Number(clamp(firstHalfAccuracy - secondHalfAccuracy, 0, 1).toFixed(2));
      const omissionRate = metrics.targetCount ? metrics.omissionErrors / metrics.targetCount : 0;
      const variabilityPenalty = clamp(reactionTimeVariability / 4, 0, 35);
      const falseAlarmPenalty = metrics.nonTargetCount ? (metrics.falseAlarmCount / metrics.nonTargetCount) * 20 : 0;
      const score = Math.round(clamp(100 - omissionRate * 45 - variabilityPenalty - falseAlarmPenalty - sustainedAttentionDrop * 25, 5, 100));
      const interpretation = omissionRate > 0.25 || reactionTimeVariability > 220
        ? "누락 오류와 반응시간 변동성이 높아 지속주의 취약 가능성을 시사합니다."
        : "전반적으로 목표 자극 반응은 유지되었지만 후반부 안정성 변화를 함께 볼 필요가 있습니다.";

      completeCurrentGameTest({
        test_type: "signal_detection",
        mode: "assessment",
        target_count: metrics.targetCount,
        non_target_count: metrics.nonTargetCount,
        hit_count: metrics.hitCount,
        omission_errors: metrics.omissionErrors,
        false_alarm_count: metrics.falseAlarmCount,
        mean_reaction_time: meanReactionTime || 0,
        reaction_time_variability: reactionTimeVariability || 0,
        late_response_count: metrics.lateResponseCount,
        sustained_attention_drop: sustainedAttentionDrop,
        score,
        interpretation
      });
      return;
    }

    const trial = trials[trialIndex];
    const trialNumber = trialIndex + 1;
    const trialStart = performance.now();
    const trialMetrics = {
      responded: false,
      responseType: "none"
    };
    const isFirstHalf = trialIndex < Math.ceil(trials.length / 2);
    if (trial.stimulusType === "target") {
      if (isFirstHalf) {
        metrics.firstHalfTargets += 1;
      } else {
        metrics.secondHalfTargets += 1;
      }
    }

    gameRuntime.activeTrial = {
      ...trial,
      stage,
      trialIndex,
      trialStart,
      responseDeadline: trialStart + 2400,
      visibleUntil: trialStart + 1200,
      nextTrialAt: trialStart + 3000,
      metrics: trialMetrics
    };

    renderGameUi({
      phase: "running",
      activeTestKey: "signal_detection",
      stage,
      prompt: "",
      progressPercent: ((trialIndex + (stage === "main" ? 0 : 0)) / trials.length) * 100,
      trialIndex: trialNumber,
      totalTrials: trials.length,
      stimulus: trial,
      stimulusVisible: true,
      signalFeedbackState: "idle",
      stimulusReplayToken: `signal-${stage}-${trialIndex}-${Date.now()}`
    });

    scheduleTimeout(() => {
      if (state.gameUi?.activeTestKey === "signal_detection") {
        renderGameUi({ stimulusVisible: false });
      }
    }, 1200);

    scheduleTimeout(() => {
      let feedbackState = "success";
      if (trial.stimulusType === "target" && !trialMetrics.responded) {
        metrics.omissionErrors += 1;
        feedbackState = "fail";
      }
      if (trialMetrics.responseType === "false_alarm" || trialMetrics.responseType === "late") {
        feedbackState = "fail";
      }
      if (state.gameUi?.activeTestKey === "signal_detection") {
        renderGameUi({ signalFeedbackState: feedbackState });
      }
      pushGameEvent({
        trial_index: trialIndex,
        stimulus_type: trial.stimulusType,
        user_action: trialMetrics.responseType,
        reaction_time: trialMetrics.reactionTime || null
      });
    }, 2400);

    scheduleTimeout(() => {
      trialIndex += 1;
      nextTrial();
    }, 3000);
  };

  gameRuntime.currentPhase = "signal_detection";
  nextTrial();
}

function handleSignalDetectionTap() {
  const activeTrial = gameRuntime.activeTrial;
  if (!activeTrial || activeTrial.stage == null) {
    return;
  }

  const now = performance.now();
  const reactionTime = Math.round(now - activeTrial.trialStart);
  const trialMetrics = activeTrial.metrics;

  if (reactionTime <= 2400) {
    if (trialMetrics.responded) {
      return;
    }

    trialMetrics.responded = true;
    trialMetrics.reactionTime = reactionTime;

    if (activeTrial.stimulusType === "target") {
      trialMetrics.responseType = "tap";
      gameRuntime.metrics.hitCount += 1;
      gameRuntime.metrics.reactionTimes.push(reactionTime);
      renderGameUi({ signalFeedbackState: "success" });
      const isFirstHalf = activeTrial.trialIndex < Math.ceil((state.gameUi?.totalTrials || 1) / 2);
      if (isFirstHalf) {
        gameRuntime.metrics.firstHalfHits += 1;
      } else {
        gameRuntime.metrics.secondHalfHits += 1;
      }
    } else {
      trialMetrics.responseType = "false_alarm";
      gameRuntime.metrics.falseAlarmCount += 1;
      renderGameUi({ signalFeedbackState: "fail" });
    }
  } else if (reactionTime <= 3000) {
    if (!trialMetrics.responded) {
      trialMetrics.responded = true;
      trialMetrics.responseType = "late";
      gameRuntime.metrics.lateResponseCount += 1;
      renderGameUi({ signalFeedbackState: "fail" });
    }
  }
}

function startGoNoGoPractice() {
  const practiceTrials = buildGoNoGoTrials(GAME_META.go_nogo.practiceTrials, 0.75);
  runGoNoGoTrials(practiceTrials, "practice");
}

function startGoNoGoMain() {
  const mainTrials = buildGoNoGoTrials(GAME_META.go_nogo.mainTrials, 0.75);
  runGoNoGoTrials(mainTrials, "main");
}

function runGoNoGoTrials(trials, stage) {
  cleanupGameRuntime();
  const metrics = {
    goCount: trials.filter((trial) => trial.stimulusType === "go").length,
    nogoCount: trials.filter((trial) => trial.stimulusType === "nogo").length,
    goHitCount: 0,
    goOmissionCount: 0,
    commissionErrors: 0,
    prematureResponseCount: 0,
    falseStopCount: 0,
    successfulStopCount: 0,
    lateStopCount: 0,
    goReactionTimes: [],
    stopLatencies: [],
    postErrorDiffs: []
  };
  let trialIndex = 0;

  const nextTrial = () => {
    if (trialIndex >= trials.length) {
      if (stage === "practice") {
        renderGameUi({
          phase: "result",
          activeTestKey: "go_nogo",
          stage: "practice-complete",
          result: {
            title: "연습 완료",
            interpretation: "동그라미는 바닥 직전에 누르고, 엑스는 끝까지 누르지 않는 규칙을 확인했습니다."
          },
          progressPercent: (getGameState().currentTestIndex / GAME_ORDER.length) * 100
        });
        return;
      }

      const meanGoReactionTime = Math.round(mean(metrics.goReactionTimes));
      const inhibitionFailureRate = Number((metrics.commissionErrors / Math.max(metrics.nogoCount, 1)).toFixed(2));
      const goAccuracy = metrics.goHitCount / Math.max(metrics.goCount, 1);
      const holdSuccessRate = Number((metrics.successfulStopCount / Math.max(metrics.nogoCount, 1)).toFixed(2));
      const score = Math.round(clamp(100 - inhibitionFailureRate * 55 - metrics.prematureResponseCount * 4 - metrics.lateStopCount * 3 - (1 - goAccuracy) * 22, 5, 100));
      const interpretation = inhibitionFailureRate > 0.35 || metrics.prematureResponseCount >= 4
        ? "금지 자극 반응이나 너무 이른 반응이 비교적 많아 반응 억제의 어려움을 시사합니다."
        : "대체로 규칙은 유지되지만 빠른 예측 반응과 정확도 균형을 함께 볼 필요가 있습니다.";

      completeCurrentGameTest({
        test_type: "go_nogo",
        mode: "assessment",
        go_count: metrics.goCount,
        nogo_count: metrics.nogoCount,
        go_hit_count: metrics.goHitCount,
        go_omission_count: metrics.goOmissionCount,
        commission_errors: metrics.commissionErrors,
        successful_stop_count: metrics.successfulStopCount,
        false_stop_count: metrics.falseStopCount,
        late_stop_count: metrics.lateStopCount,
        mean_go_reaction_time: meanGoReactionTime || 0,
        mean_stop_latency: 0,
        premature_response_count: metrics.prematureResponseCount,
        post_error_slowing: 0,
        inhibition_failure_rate: inhibitionFailureRate,
        hold_success_rate: holdSuccessRate,
        score,
        interpretation
      });
      return;
    }

    const trial = trials[trialIndex];
    const trialStart = performance.now();
    const trialMetrics = {
      reactionTime: null,
      responseType: "none",
      eventLogged: false
    };
    const activeTrial = {
      ...trial,
      stage,
      trialIndex,
      trialStart,
      successWindowStart: trialStart + (GO_NOGO_TRIAL_DURATION_MS - GO_NOGO_SUCCESS_WINDOW_MS),
      responseDeadline: trialStart + GO_NOGO_TRIAL_DURATION_MS,
      nextTrialAt: trialStart + GO_NOGO_TRIAL_DURATION_MS + GO_NOGO_INTER_TRIAL_MS,
      metrics: trialMetrics
    };
    gameRuntime.activeTrial = activeTrial;

    renderGameUi({
      phase: "running",
      activeTestKey: "go_nogo",
      stage,
      prompt: "",
      progressPercent: (trialIndex / trials.length) * 100,
      trialIndex: trialIndex + 1,
      totalTrials: trials.length,
      stimulus: trial,
      stimulusVisible: true,
      goNoGoFeedbackState: "idle",
      stimulusReplayToken: `go-nogo-${stage}-${trialIndex}-${Date.now()}`
    });

    scheduleTimeout(() => {
      if (state.gameUi?.activeTestKey === "go_nogo") {
        let feedbackState = "success";
        if (trial.stimulusType === "go") {
          if (trialMetrics.responseType !== "hit") {
            feedbackState = "fail";
          }
        } else if (trialMetrics.responseType !== "none") {
          feedbackState = "fail";
        }
        renderGameUi({ stimulusVisible: false, goNoGoFeedbackState: feedbackState });
      }
      if (trial.stimulusType === "go") {
        if (trialMetrics.responseType !== "hit") {
          metrics.goOmissionCount += 1;
          if (trialMetrics.responseType === "premature") {
            metrics.falseStopCount += 1;
          }
        }
      } else if (trialMetrics.responseType === "none") {
        metrics.successfulStopCount += 1;
      }

      if (!trialMetrics.eventLogged) {
        trialMetrics.eventLogged = true;
        pushGameEvent({
          trial_index: trialIndex,
          stimulus_type: trial.stimulusType,
          user_action: trialMetrics.responseType,
          reaction_time: trialMetrics.reactionTime || null
        });
      }
    }, GO_NOGO_TRIAL_DURATION_MS);

    scheduleTimeout(() => {
      trialIndex += 1;
      nextTrial();
    }, GO_NOGO_TRIAL_DURATION_MS + GO_NOGO_INTER_TRIAL_MS);
  };

  gameRuntime.currentPhase = "go_nogo";
  nextTrial();

  gameRuntime.tapHandler = () => {
    const activeTrial = gameRuntime.activeTrial;
    const now = performance.now();
    if (!activeTrial) {
      return;
    }
    if (activeTrial.metrics.responseType !== "none" || now > activeTrial.responseDeadline) {
      return;
    }
    activeTrial.metrics.reactionTime = Math.round(now - activeTrial.trialStart);

    if (activeTrial.stimulusType === "nogo") {
      activeTrial.metrics.responseType = "false_alarm";
      metrics.commissionErrors += 1;
      renderGameUi({ goNoGoFeedbackState: "fail" });
      return;
    }

    if (now < activeTrial.successWindowStart) {
      activeTrial.metrics.responseType = "premature";
      metrics.prematureResponseCount += 1;
      renderGameUi({ goNoGoFeedbackState: "fail" });
      return;
    }

    if (now <= activeTrial.responseDeadline) {
      activeTrial.metrics.responseType = "hit";
      metrics.goHitCount += 1;
      metrics.goReactionTimes.push(activeTrial.metrics.reactionTime);
      renderGameUi({ goNoGoFeedbackState: "success" });
      return;
    }

    activeTrial.metrics.responseType = "late";
    metrics.lateStopCount += 1;
    renderGameUi({ goNoGoFeedbackState: "fail" });
  };
}

function handleGoNoGoTap() {
  if (typeof gameRuntime.tapHandler === "function") {
    gameRuntime.tapHandler();
  }
}

async function startBalanceCalibration() {
  cleanupGameRuntime();
  const supportsDeviceMotion = typeof window.DeviceMotionEvent !== "undefined" || typeof window.DeviceOrientationEvent !== "undefined";
  const usingPointerFallback = !supportsDeviceMotion;

  if (!usingPointerFallback && typeof DeviceMotionEvent?.requestPermission === "function") {
    const permission = await DeviceMotionEvent.requestPermission().catch(() => "denied");
    if (permission !== "granted") {
      setStatus("모션 센서 권한이 필요합니다. 권한 허용 후 다시 시도해 주세요.");
      resetGameUi();
      return;
    }
  }

  gameRuntime.pointerControl = { x: 0, y: 0 };
  gameRuntime.balanceSamples = [];
  renderGameUi({
    phase: "countdown",
    activeTestKey: "balance_hold",
    stage: "calibration",
    countdown: 2,
    message: usingPointerFallback ? "센서가 없어 마우스/터치 시뮬레이션으로 진행합니다." : "기기를 편안하게 잡고 2초간 기준점을 맞춥니다."
  });

  const handleOrientation = (event) => {
    const gamma = clamp((event.gamma || 0) / 20, -1.2, 1.2);
    const beta = clamp((event.beta || 0) / 20, -1.2, 1.2);
    gameRuntime.pointerControl = { x: gamma, y: beta };
  };

  const handlePointer = (event) => {
    const arena = document.querySelector(".balance-arena");
    if (!arena) {
      return;
    }
    const rect = arena.getBoundingClientRect();
    const point = event.touches?.[0] || event;
    const x = ((point.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((point.clientY - rect.top) / rect.height) * 2 - 1;
    gameRuntime.pointerControl = {
      x: clamp(x, -1.3, 1.3),
      y: clamp(y, -1.3, 1.3)
    };
  };

  if (usingPointerFallback) {
    addGameListener(window, "mousemove", handlePointer);
    addGameListener(window, "touchmove", handlePointer, { passive: true });
  } else {
    addGameListener(window, "deviceorientation", handleOrientation);
  }

  await new Promise((resolve) => scheduleTimeout(resolve, 2000));
  startBalanceHold(usingPointerFallback ? "pointer" : "sensor");
}

function startBalanceHold(inputSource) {
  const startAt = performance.now();
  let stableHoldTime = 0;
  let largeMotionCount = 0;
  let driftDistance = 0;
  let correctionCount = 0;
  let previousDistance = 0;
  let previousInside = true;
  let previousLarge = false;
  const isPointerMode = inputSource === "pointer";
  const pointerTarget = {
    currentX: 0,
    currentY: 0,
    fromX: 0,
    fromY: 0,
    toX: 0,
    toY: 0,
    moveStartAt: startAt,
    moveDurationMs: 1600
  };

  const pickNextPointerTarget = (now) => {
    pointerTarget.fromX = pointerTarget.currentX;
    pointerTarget.fromY = pointerTarget.currentY;
    pointerTarget.toX = randomBetween(-0.52, 0.52);
    pointerTarget.toY = randomBetween(-0.52, 0.52);
    pointerTarget.moveStartAt = now;
    pointerTarget.moveDurationMs = randomBetween(1300, 2200);
  };

  const updatePointerTarget = (now) => {
    if (!isPointerMode) {
      return { x: 0, y: 0 };
    }
    const progress = clamp((now - pointerTarget.moveStartAt) / pointerTarget.moveDurationMs, 0, 1);
    const eased = 0.5 - (Math.cos(Math.PI * progress) / 2);
    pointerTarget.currentX = pointerTarget.fromX + ((pointerTarget.toX - pointerTarget.fromX) * eased);
    pointerTarget.currentY = pointerTarget.fromY + ((pointerTarget.toY - pointerTarget.fromY) * eased);
    if (progress >= 1) {
      pickNextPointerTarget(now);
    }
    return { x: pointerTarget.currentX, y: pointerTarget.currentY };
  };

  if (isPointerMode) {
    pickNextPointerTarget(startAt);
  }

  renderGameUi({
    phase: "running",
    activeTestKey: "balance_hold",
    stage: "main",
    prompt: isPointerMode ? "움직이는 원을 따라가며 공을 안쪽에 유지하세요." : "중앙 원 안에 공을 오래 유지하세요.",
    progressPercent: 0,
    balance: { x: 0, y: 0, targetX: 0, targetY: 0, distance: 0, inside: true, inputSource }
  });
  gameRuntime.liveDomUpdater = updateLiveGameDom;

  gameRuntime.intervalId = window.setInterval(() => {
    const now = performance.now();
    const elapsed = now - startAt;
    const targetPosition = updatePointerTarget(now);
    const x = clamp(gameRuntime.pointerControl.x, -1.4, 1.4);
    const y = clamp(gameRuntime.pointerControl.y, -1.4, 1.4);
    const relativeX = x - targetPosition.x;
    const relativeY = y - targetPosition.y;
    const distance = Math.sqrt(relativeX ** 2 + relativeY ** 2);
    const inside = distance <= 0.48;
    const isLarge = distance >= 0.9;

    if (inside) {
      stableHoldTime += 0.1;
    }
    if (isLarge && !previousLarge) {
      largeMotionCount += 1;
    }
    if (inside && !previousInside) {
      correctionCount += 1;
    }

    driftDistance += Math.abs(distance - previousDistance);
    previousDistance = distance;
    previousInside = inside;
    previousLarge = isLarge;

    gameRuntime.balanceSamples.push(distance);
    pushGameEvent({
      trial_index: Math.floor(elapsed / 100),
      stimulus_type: "balance",
      user_action: inside ? "hold" : "drift",
      reaction_time: null
    });

    renderGameUi({
      phase: "running",
      activeTestKey: "balance_hold",
      stage: "main",
      prompt: isPointerMode ? "움직이는 원을 따라가며 공을 안쪽에 유지하세요." : "중앙 원 안에 공을 오래 유지하세요.",
      progressPercent: (elapsed / GAME_META.balance_hold.durationMs) * 100,
      balance: {
        x: relativeX,
        y: relativeY,
        targetX: targetPosition.x,
        targetY: targetPosition.y,
        distance,
        inside,
        inputSource,
        remainingMs: Math.max(GAME_META.balance_hold.durationMs - elapsed, 0)
      }
    });

    if (elapsed >= GAME_META.balance_hold.durationMs) {
      const movementAmplitude = Number(mean(gameRuntime.balanceSamples).toFixed(2));
      const movementVariability = Number(standardDeviation(gameRuntime.balanceSamples).toFixed(2));
      const stableHoldSeconds = Number(stableHoldTime.toFixed(1));
      const drift = Number(driftDistance.toFixed(1));
      const score = Math.round(clamp((stableHoldSeconds / 30) * 100 - movementAmplitude * 20 - movementVariability * 25 - largeMotionCount * 2, 5, 100));
      const interpretation = movementAmplitude > 0.7 || largeMotionCount >= 6
        ? "움직임 크기와 흔들림 빈도가 높아 활동성 및 자기조절의 어려움 가능성을 시사합니다."
        : "중심 유지 수행은 비교적 안정적이지만 미세한 보정 패턴을 함께 볼 필요가 있습니다.";

      cleanupGameRuntime();
      completeCurrentGameTest({
        test_type: "balance_hold",
        mode: "assessment",
        input_source: inputSource,
        movement_amplitude: movementAmplitude,
        movement_variability: movementVariability,
        stable_hold_time: stableHoldSeconds,
        large_motion_count: largeMotionCount,
        drift_distance: drift,
        correction_count: correctionCount,
        score,
        interpretation
      });
    }
  }, 100);
}

async function answerAsrs(value) {
  const question = state.configs.asrs.questions[state.asrsIndex];
  if (!Array.isArray(state.currentRecord.tests.asrs)) {
    state.currentRecord.tests.asrs = getAsrsAnswers(state.currentRecord);
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
  if (!Array.isArray(state.currentRecord.tests.dsm5)) {
    state.currentRecord.tests.dsm5 = getDsmAnswers(state.currentRecord);
  }
  state.currentRecord.tests.dsm5[state.dsmIndex] = {
    section: current.section,
    prompt: current.prompt,
    answer: value
  };
  state.currentRecord.dsm5Analysis = analyzeDsm(state.currentRecord);
  state.currentRecord.currentStep = "dsm";
  await persistRecord();

  if (state.dsmIndex < state.configs.dsm.questions.length - 1) {
    state.dsmIndex += 1;
  } else {
    state.currentRecord.currentStep = "game";
    await persistRecord();
    state.route = "game";
  }
  render();
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
  if (state.route !== "game") {
    cleanupGameRuntime();
  }
  renderTopbarActions();
  renderNav();
  const page = pages[state.route] ? pages[state.route]() : pages.intro();
  app.innerHTML = page + (state.showJsonModal ? renderJsonModal() : "");
  bindPageEvents();

  if (state.route === "game") {
    gameRuntime.liveDomUpdater = updateLiveGameDom;
  }
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

function renderSignalStimulus(stimulus, visible) {
  const imageSrc = withReplayToken(stimulus?.imageSrc || SIGNAL_TARGET_IMAGE, state.gameUi?.stimulusReplayToken);
  const feedbackState = state.gameUi?.signalFeedbackState || "idle";
  const feedbackSrc = SIGNAL_FEEDBACK_IMAGES[feedbackState] || SIGNAL_FEEDBACK_IMAGES.idle;
  return `
    <button class="stimulus-stage ${visible ? "active" : "ghost"}" data-game-tap="signal_detection" type="button">
      <div class="stimulus-stage-backdrop" aria-hidden="true"></div>
      <div class="stimulus-asset-shell">
        ${visible
          ? `<img class="stimulus-image" src="${imageSrc}" alt="" draggable="false">`
          : `<div class="stimulus-placeholder" aria-hidden="true">?</div>`
        }
      </div>
      <img class="stimulus-feedback-layer" src="${feedbackSrc}" alt="" aria-hidden="true" draggable="false">
    </button>
  `;
}

function renderGoNoGoStimulus(stimulus, visible) {
  const imageSrc = withReplayToken(stimulus?.imageSrc || GO_NOGO_STIMULUS_IMAGES.go, state.gameUi?.stimulusReplayToken);
  const feedbackState = state.gameUi?.goNoGoFeedbackState || "idle";
  const feedbackSrc = GO_NOGO_FEEDBACK_IMAGES[feedbackState] || GO_NOGO_FEEDBACK_IMAGES.idle;
  return `
    <div class="go-nogo-interaction-surface" data-go-nogo-surface>
      <div class="go-nogo-scene ${visible ? "active" : "ghost"}" data-go-nogo-scene>
        <div class="go-nogo-stage-backdrop" aria-hidden="true"></div>
        <div class="go-nogo-stimulus-shell">
          ${visible
            ? `<img class="go-nogo-stimulus-image" src="${imageSrc}" alt="" draggable="false">`
            : `<div class="go-nogo-placeholder" aria-hidden="true"></div>`
          }
        </div>
        <img class="go-nogo-feedback-layer" src="${feedbackSrc}" alt="" aria-hidden="true" draggable="false">
      </div>
      <div class="go-nogo-action-zone">
        <button class="go-nogo-action-button" data-go-nogo-action type="button">TAP</button>
        <div class="go-nogo-action-text">동그라미만 바닥 직전에 누르세요</div>
      </div>
    </div>
  `;
}

function renderBalanceArena(balance = {}) {
  const x = ((balance.x || 0) * 34).toFixed(1);
  const y = ((balance.y || 0) * 34).toFixed(1);
  const targetX = ((balance.targetX || 0) * 34).toFixed(1);
  const targetY = ((balance.targetY || 0) * 34).toFixed(1);
  return `
    <div class="balance-arena">
      <div data-live-balance-target class="balance-target ${balance.inside === false ? "outside" : ""}" style="transform:translate(${targetX}px, ${targetY}px)">
        <div data-live-balance-ball class="balance-ball" style="transform:translate(${x}px, ${y}px)"></div>
      </div>
    </div>
  `;
}

function renderGameMetrics(result) {
  const entries = Object.entries(result || {})
    .filter(([key]) => !["test_type", "mode", "interpretation", "title", "score", "input_source"].includes(key))
    .slice(0, 6);
  return `
    <div class="game-metrics">
      ${entries.map(([key, value]) => `
        <div class="metric-card stack-sm">
          <span class="eyebrow">${key.replaceAll("_", " ")}</span>
          <strong>${value}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderReactivityHighlights(summary) {
  const highlights = summary?.highlights || [];
  if (!highlights.length) {
    return "";
  }
  return `
    <div class="game-metrics">
      ${highlights.map((item) => `
        <div class="metric-card stack-sm">
          <span class="eyebrow">${item.label}</span>
          <strong>${item.value}</strong>
          <span class="muted">${item.note}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function updateLiveGameDom(ui) {
  if (ui.activeTestKey === "balance_hold") {
    const fill = document.querySelector("[data-live-progress='balance']");
    const countdown = document.querySelector("[data-live-countdown='balance']");
    const ball = document.querySelector("[data-live-balance-ball]");
    const target = document.querySelector("[data-live-balance-target]");

    if (fill) {
      fill.style.width = `${clamp(ui.progressPercent || 0, 0, 100)}%`;
    }
    if (countdown) {
      countdown.textContent = `${ui.balance?.remainingMs ? Math.ceil(ui.balance.remainingMs / 1000) : 0}s`;
    }
    if (ball) {
      const x = ((ui.balance?.x || 0) * 34).toFixed(1);
      const y = ((ui.balance?.y || 0) * 34).toFixed(1);
      ball.style.transform = `translate(${x}px, ${y}px)`;
    }
    if (target) {
      const targetX = ((ui.balance?.targetX || 0) * 34).toFixed(1);
      const targetY = ((ui.balance?.targetY || 0) * 34).toFixed(1);
      target.style.transform = `translate(${targetX}px, ${targetY}px)`;
      target.classList.toggle("outside", ui.balance?.inside === false);
    }
    return;
  }

  if (ui.activeTestKey === "go_nogo") {
    const fill = document.querySelector("[data-live-progress='go_nogo']");
    if (fill) {
      fill.style.width = `${clamp(ui.progressPercent || 0, 0, 100)}%`;
    }
    return;
  }

  if (ui.activeTestKey === "signal_detection") {
    const fill = document.querySelector(`[data-live-progress='${ui.activeTestKey}']`);
    if (fill) {
      fill.style.width = `${clamp(ui.progressPercent || 0, 0, 100)}%`;
    }
  }
}

function renderGamePage() {
  ensureGuestGameRecord();
  const game = getGameState();
  const ui = state.gameUi || createOverviewUi();
  const meta = GAME_META[ui.activeTestKey || game.currentTestKey];
  const completedCount = GAME_ORDER.filter((key) => game.tests[key]).length;
  const progressPercent = clamp(ui.progressPercent ?? ((completedCount / GAME_ORDER.length) * 100), 0, 100);

  if (ui.phase === "instruction" && ui.activeTestKey === "signal_detection") {
    return `
      <section class="page game-page">
        <div class="panel stack-md">
          <div class="flex items-end justify-between gap-4">
            <div>
              <div class="eyebrow">${meta.eyebrow}</div>
              <h2 class="title-lg">${meta.title}</h2>
              <p class="muted">파란색 별만 누르세요.</p>
            </div>
            <span class="chip">1 / ${GAME_ORDER.length}</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" data-live-progress="signal_detection" style="width:${progressPercent}%"></div></div>
        </div>
        <div class="hero-card stack-lg">
          ${renderSignalStimulus(ui.stimulus, true)}
          <p class="muted">다른 색이나 다른 모양은 누르지 않고 넘어가면 됩니다.</p>
          <button class="button-secondary safe-bottom-actions" id="signal-detection-begin-button">시작하기</button>
        </div>
      </section>
    `;
  }

  if (ui.phase === "running" && ui.activeTestKey === "signal_detection") {
    return `
      <section class="page game-page">
        <div class="panel stack-md">
          <div class="flex items-end justify-between gap-4">
            <div>
              <div class="eyebrow">${meta.eyebrow}</div>
              <h2 class="title-lg">${meta.title}</h2>
            </div>
            <span class="chip">${ui.trialIndex} / ${ui.totalTrials}</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" data-live-progress="signal_detection" style="width:${progressPercent}%"></div></div>
        </div>
        <div class="hero-card stack-lg">
          ${renderSignalStimulus(ui.stimulus, ui.stimulusVisible)}
          <p class="muted">목표: 파란 별만 탭. 다른 도형은 무반응.</p>
        </div>
      </section>
    `;
  }

  if (ui.phase === "running" && ui.activeTestKey === "go_nogo") {
    return `
      <section class="page game-page">
        <div class="panel stack-md">
          <div class="flex items-end justify-between gap-4">
            <div>
              <div class="eyebrow">${meta.eyebrow}</div>
              <h2 class="title-lg">${meta.title}</h2>
            </div>
            <span class="chip">${ui.trialIndex} / ${ui.totalTrials}</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" data-live-progress="go_nogo" style="width:${progressPercent}%"></div></div>
        </div>
        <div class="hero-card stack-lg">
          ${renderGoNoGoStimulus(ui.stimulus, ui.stimulusVisible)}
          <p class="muted">동그라미는 바닥 직전에 누르고, 엑스는 끝까지 누르지 않습니다.</p>
        </div>
      </section>
    `;
  }

  if (ui.activeTestKey === "balance_hold" && (ui.phase === "countdown" || ui.phase === "running")) {
    return `
      <section class="page game-page">
        <div class="panel stack-md">
          <div class="flex items-end justify-between gap-4">
            <div>
              <div class="eyebrow">${meta.eyebrow}</div>
              <h2 class="title-lg">${meta.title}</h2>
              <p class="muted">${ui.message || ui.prompt}</p>
            </div>
            <span class="chip" data-live-countdown="balance">${ui.balance?.remainingMs ? Math.ceil(ui.balance.remainingMs / 1000) : ui.countdown || 30}s</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" data-live-progress="balance" style="width:${progressPercent}%"></div></div>
        </div>
        <div class="hero-card stack-lg">
          ${renderBalanceArena(ui.balance)}
          <p class="muted">${ui.phase === "running" ? "중앙 원 안에 공을 오래 유지하세요." : "정렬 단계가 끝나면 30초 검사로 들어갑니다."}</p>
        </div>
      </section>
    `;
  }

  if (ui.phase === "result" || ui.phase === "completed") {
    const result = ui.result || {};
    const isPractice = ui.stage === "practice-complete";
    const nextLabel = ui.phase === "completed" ? "리포트로 이동" : isPractice ? "본 검사 시작" : "다음 테스트";
    return `
      <section class="page game-page">
        <div class="hero-card stack-lg">
          <div class="eyebrow">${isPractice ? "practice done" : ui.phase === "completed" ? "reactivity summary" : "test result"}</div>
          <div class="stack-sm">
            <h2 class="title-lg">${ui.phase === "completed" ? "반응성 테스트 통합 결과" : result.title || meta.title}</h2>
            <p class="muted">${ui.phase === "completed" ? game.summary?.summary || "" : result.interpretation || ""}</p>
          </div>
          ${ui.phase === "completed"
            ? `<div class="game-metrics">
                <div class="metric-card stack-sm"><span class="eyebrow">부주의</span><strong>${game.summary?.inattention_signal?.score ?? "-"}</strong></div>
                <div class="metric-card stack-sm"><span class="eyebrow">충동성</span><strong>${game.summary?.impulsivity_signal?.score ?? "-"}</strong></div>
                <div class="metric-card stack-sm"><span class="eyebrow">활동성</span><strong>${game.summary?.activity_signal?.score ?? "-"}</strong></div>
              </div>`
            : Number.isFinite(result.score) ? `<div class="panel stack-sm"><span class="eyebrow">score</span><strong style="font-size:2rem">${result.score}</strong></div>` : ""}
        </div>
        ${ui.phase === "completed" && game.summary ? renderReactivityHighlights(game.summary) : isPractice ? "" : renderGameMetrics(result)}
        <button class="button-secondary safe-bottom-actions" id="game-next-button">${nextLabel}</button>
      </section>
    `;
  }

  return `
    <section class="page game-page">
      <div class="hero-card stack-lg">
        <div class="eyebrow">reactivity assessment</div>
        <div class="stack-sm">
          <h2 class="title-lg">반응성 테스트 3종을 바로 시작합니다.</h2>
          <p class="muted">ID 입력 없이 현재 기기에서 바로 검사할 수 있으며, 결과는 게스트 기록으로 저장됩니다.</p>
        </div>
      </div>

      <div class="stack-md">
        ${GAME_ORDER.map((key, index) => {
          const item = GAME_META[key];
          const completed = Boolean(game.tests[key]);
          return `
            <div class="panel stack-sm">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <div class="eyebrow">${item.eyebrow}</div>
                  <h3 class="title-lg" style="font-size:1.2rem">${index + 1}. ${item.title}</h3>
                </div>
                <span class="chip ${completed ? "chip-success" : ""}">${completed ? "완료" : "대기"}</span>
              </div>
              <p class="muted">${item.description}</p>
            </div>
          `;
        }).join("")}
      </div>

      <div class="game-jump-grid">
        ${GAME_ORDER.map((key, index) => `
          <button class="button-ghost game-jump-button" type="button" data-game-select="${key}">
            ${index + 1}번 ${GAME_META[key].title}
          </button>
        `).join("")}
      </div>

      <button class="button-secondary safe-bottom-actions" id="game-start-button">${game.status === "completed" ? "리포트 보기" : completedCount ? "이어하기" : "첫 테스트 시작"}</button>
    </section>
  `;
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
    const currentAnswer = getDsmAnswers()?.[state.dsmIndex]?.answer;
    return `
      <section class="page">
        <div class="panel stack-md">
          <div class="eyebrow">dsm-5</div>
          <div class="flex items-end justify-between gap-4">
            <div>
              <h2 class="title-lg">${config.title}</h2>
              <p class="muted">${config.description}</p>
            </div>
            <div class="eyebrow">${state.dsmIndex + 1} / ${config.questions.length}</div>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
        </div>

        <div class="hero-card stack-lg">
          <div class="eyebrow">${question.section}</div>
          <p class="title-lg" style="font-size:clamp(1.5rem,5vw,2.3rem)">${question.prompt}</p>
          <p class="muted">${question.hint}</p>
          <div class="binary-grid">
            <button class="binary-button ${currentAnswer === false ? "selected-no" : ""}" data-dsm-answer="false">No</button>
            <button class="binary-button ${currentAnswer === true ? "selected-yes" : ""}" data-dsm-answer="true">Yes</button>
          </div>
        </div>
      </section>
    `;
  },

  game() {
    return renderGamePage();
  },

  report() {
    const report = state.currentRecord?.report;
    const dsm = analyzeDsm();
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

        <div class="panel stack-md">
          <div class="eyebrow">dsm-5 summary</div>
          <div class="flex items-center justify-between gap-4">
            <strong>${dsm.subtype}</strong>
            <span class="chip">부주의 ${dsm.inattentionYes} / 9 · 과잉행동 ${dsm.hyperactivityYes} / 9</span>
          </div>
          <p class="muted">${dsm.guidance}</p>
        </div>

        ${state.currentRecord?.tests?.game?.summary?.summary ? `
          <div class="panel stack-md">
            <div class="eyebrow">reactivity test</div>
            <p class="muted">${state.currentRecord.tests.game.summary.summary}</p>
          </div>
        ` : ""}

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

        <button class="button-secondary safe-bottom-actions" data-route-next="plan">개선 계획 보기</button>
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
            <button class="button-secondary safe-bottom-actions" type="submit">계획 수정 요청</button>
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

function renderJsonModal() {
  return `
    <div class="overlay-modal">
      <div class="panel stack-md overlay-dialog overlay-dialog-wide">
        <div class="flex items-center justify-between gap-4">
          <div class="stack-sm">
            <div class="eyebrow">live json</div>
            <h3 class="title-lg">진행 중 기록 JSON</h3>
          </div>
          <button class="button-ghost" type="button" id="close-json-modal">닫기</button>
        </div>
        <div class="panel json-meta-panel">
          <span class="muted">파일: ${escapeHtml(state.currentRecord?.fileName || "없음")}</span>
        </div>
        <pre class="json-viewer">${escapeHtml(state.jsonModalContent || "{}")}</pre>
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

  document.querySelector("#close-json-modal")?.addEventListener("click", () => {
    closeJsonModal();
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

  document.querySelector("#game-start-button")?.addEventListener("click", () => {
    startGameFlow().catch((error) => setStatus(error.message));
  });

  document.querySelector("#signal-detection-begin-button")?.addEventListener("click", () => {
    startSignalDetectionMain();
  });

  document.querySelectorAll("[data-game-select]").forEach((node) => {
    node.addEventListener("click", () => {
      selectGameTest(node.getAttribute("data-game-select")).catch((error) => setStatus(error.message));
    });
  });

  document.querySelector("#game-next-button")?.addEventListener("click", () => {
    if (state.gameUi?.stage === "practice-complete" && state.gameUi?.activeTestKey === "signal_detection") {
      startSignalDetectionMain();
      return;
    }
    if (state.gameUi?.stage === "practice-complete" && state.gameUi?.activeTestKey === "go_nogo") {
      startGoNoGoMain();
      return;
    }
    goToNextGameTest().catch((error) => setStatus(error.message));
  });

  document.querySelector("[data-game-tap='signal_detection']")?.addEventListener("click", () => {
    handleSignalDetectionTap();
  });

  const goNoGoAction = document.querySelector("[data-go-nogo-action]");
  if (goNoGoAction && state.route === "game" && state.gameUi?.activeTestKey === "go_nogo") {
    addGameListener(goNoGoAction, "click", (event) => {
      event.preventDefault();
      handleGoNoGoTap();
    });
  }

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
