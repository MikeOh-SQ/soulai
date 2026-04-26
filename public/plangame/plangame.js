const {
  getUserIdFromUrl,
  loadLatestRecordById,
  ensureDtx,
  persistRecord,
  buildUrl,
  escapeHtml,
  computeStageByScore
} = window.DtxCommon;

const GOAL_COUNT = 3;
const COOLDOWN_MS = 60 * 60 * 1000;
const EVENT_URL = "/game/scripts/plan.json";

const app = document.getElementById("app");
const bg = document.getElementById("bg");
const userChip = document.getElementById("user-chip");
const scoreChip = document.getElementById("score-chip");
const localScoreChip = document.getElementById("local-score-chip");
const guideButton = document.getElementById("guide-button");
const forestButton = document.getElementById("forest-button");
const guideModal = document.getElementById("guide-modal");
const loadingView = document.getElementById("loading-view");
const emptyView = document.getElementById("empty-view");
const gameView = document.getElementById("game-view");
const goalList = document.getElementById("goal-list");
const idForm = document.getElementById("id-form");
const userIdInput = document.getElementById("user-id-input");
const tutorialOverlay = document.getElementById("tutorial-overlay");
const tutorial = document.getElementById("tutorial");
const tutorialSpeaker = document.getElementById("tutorial-speaker");
const tutorialText = document.getElementById("tutorial-text");
const addCharacter = document.getElementById("add-character");
const lumenCharacter = document.getElementById("lumen-character");

const state = {
  record: null,
  goals: [],
  openGoalIndex: null,
  userId: getUserIdFromUrl(),
  tickTimer: null,
  mode: "idle",
  tutorialLines: [],
  tutorialIndex: -1
};

function createDefaultGoals(record) {
  const suggestions = Array.isArray(record?.plan?.suggestions) ? record.plan.suggestions : [];
  const goals = [];
  for (let index = 0; index < GOAL_COUNT; index += 1) {
    goals.push({
      text: suggestions[index] || `목표 ${index + 1}을 입력하세요.`,
      completedAt: null,
      cooldownUntil: null,
      updatedAt: null
    });
  }
  return goals;
}

function ensurePlanGame(record) {
  if (!record.planGame || typeof record.planGame !== "object") {
    record.planGame = {
      stage: "stage1",
      score: 0,
      goals: createDefaultGoals(record)
    };
  }

  const dtx = ensureDtx(record);
  const existingGoals = Array.isArray(record.planGame.goals) ? record.planGame.goals : [];
  const fallbackGoals = createDefaultGoals(record);
  record.planGame.goals = Array.from({ length: GOAL_COUNT }, (_, index) => ({
    ...fallbackGoals[index],
    ...(existingGoals[index] || {})
  }));
  record.planGame.score = Number(dtx.scores.plangame || 0);
  record.planGame.stage = dtx.stage;
}

function getCooldownRemaining(goal) {
  const until = new Date(goal.cooldownUntil || 0).getTime();
  return Math.max(0, until - Date.now());
}

function formatRemaining(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}시간 ${String(minutes).padStart(2, "0")}분 ${String(seconds).padStart(2, "0")}초`;
}

function renderGoalMeta(goal) {
  const remaining = getCooldownRemaining(goal);
  if (remaining > 0) {
    return `재완료 가능까지 ${formatRemaining(remaining)}`;
  }
  if (goal.completedAt) {
    return "지금 다시 완료할 수 있습니다.";
  }
  return "아직 완료 기록이 없습니다.";
}

function updateHeader() {
  if (!state.record) {
    userChip.textContent = "사용자 없음";
    scoreChip.textContent = "숲 점수 0점";
    localScoreChip.textContent = "플랜 점수 0점";
    bg.src = computeStageByScore(0).image;
    return;
  }
  const dtx = ensureDtx(state.record);
  userChip.textContent = state.record.id;
  scoreChip.textContent = `숲 점수 ${dtx.totalScore}점`;
  localScoreChip.textContent = `플랜 점수 ${dtx.scores.plangame}점`;
  bg.src = computeStageByScore(dtx.totalScore).image;
}

function renderGoals() {
  goalList.innerHTML = state.goals.map((goal, index) => {
    const remaining = getCooldownRemaining(goal);
    const isReady = remaining <= 0;
    const isOpen = state.openGoalIndex === index;
    const completedText = goal.completedAt
      ? `마지막 완료: ${new Date(goal.completedAt).toLocaleString("ko-KR")}`
      : "아직 완료하지 않았습니다.";

    return `
      <article class="goal-row card">
        <div class="goal-header">
          <button class="goal-button ${isOpen ? "is-open" : ""}" type="button" data-goal-open="${index}">
            <span class="goal-title">${escapeHtml(goal.text)}</span>
            <span class="goal-meta">${escapeHtml(renderGoalMeta(goal))}</span>
          </button>
          <button class="edit-button" type="button" aria-label="목표 수정" data-goal-edit="${index}">...</button>
        </div>
        <section class="goal-panel ${isOpen ? "" : "hidden"}">
          <div class="panel-row">
            <span class="cooldown ${isReady ? "is-ready" : ""}">${escapeHtml(completedText)}</span>
            <button class="button" type="button" data-goal-complete="${index}" ${isReady ? "" : "disabled"}>
              완료 +10점
            </button>
          </div>
          <div class="panel-row" style="margin-top:10px">
            <span class="cooldown ${isReady ? "is-ready" : ""}">
              ${isReady ? "지금 완료할 수 있습니다." : `남은 쿨다운: ${escapeHtml(formatRemaining(remaining))}`}
            </span>
          </div>
        </section>
      </article>
    `;
  }).join("");
}

function render() {
  loadingView.classList.add("hidden");
  emptyView.classList.toggle("hidden", Boolean(state.record || state.userId));
  gameView.classList.toggle("hidden", !state.record);
  updateHeader();
  if (state.record) {
    renderGoals();
  }
}

function hideCharacters() {
  addCharacter.classList.remove("visible");
  lumenCharacter.classList.remove("visible");
}

function resolveCharacterImage(speaker, expression) {
  const cleanExpression = String(expression || "").trim();
  if (speaker === "add") {
    return cleanExpression ? `/game/images/${cleanExpression}.png` : "/game/images/add.png";
  }
  if (speaker === "lumen") {
    return cleanExpression ? `/game/images/${cleanExpression}.png` : "/game/images/lumen1.png";
  }
  return "";
}

function showSpeakerImage(element, mainSrc, fallbackSrc) {
  element.onerror = () => {
    if (element.src.endsWith(fallbackSrc)) {
      return;
    }
    element.src = fallbackSrc;
  };
  element.src = mainSrc;
}

function renderTutorialCharacter(line) {
  hideCharacters();
  const speaker = line?.speaker || "";
  const imagePath = resolveCharacterImage(speaker, line?.expression || "");
  if (speaker === "add") {
    showSpeakerImage(addCharacter, imagePath, "/game/images/add.png");
    addCharacter.classList.add("visible");
    return;
  }
  if (speaker === "lumen") {
    showSpeakerImage(lumenCharacter, imagePath, "/game/images/lumen1.png");
    lumenCharacter.classList.add("visible");
  }
}

function showTutorialLine() {
  const line = state.tutorialLines[state.tutorialIndex];
  if (!line) {
    return;
  }
  tutorialOverlay.classList.remove("hidden");
  tutorial.classList.remove("hidden");
  tutorialSpeaker.textContent = line.speaker || "";
  tutorialText.textContent = line.text || "";
  renderTutorialCharacter(line);
}

function endTutorial() {
  tutorialOverlay.classList.add("hidden");
  tutorial.classList.add("hidden");
  tutorialSpeaker.textContent = "";
  tutorialText.textContent = "";
  hideCharacters();
  state.tutorialLines = [];
  state.tutorialIndex = -1;
  state.mode = "idle";
}

async function startTutorial() {
  state.mode = "tutorial";
  tutorialOverlay.classList.remove("hidden");
  tutorial.classList.add("hidden");
  hideCharacters();
  try {
    const response = await fetch(`${EVENT_URL}?t=${Date.now()}`, { cache: "no-store" });
    const payload = await response.json();
    state.tutorialLines = Array.isArray(payload.lines) ? payload.lines : [];
    state.tutorialIndex = 0;
    if (!state.tutorialLines.length) {
      endTutorial();
      if (typeof guideModal.showModal === "function") {
        guideModal.showModal();
      }
      return;
    }
    showTutorialLine();
  } catch (error) {
    endTutorial();
    if (typeof guideModal.showModal === "function") {
      guideModal.showModal();
    }
  }
}

function advanceTutorial() {
  if (state.mode !== "tutorial") {
    return;
  }
  state.tutorialIndex += 1;
  if (state.tutorialIndex >= state.tutorialLines.length) {
    endTutorial();
    return;
  }
  showTutorialLine();
}

async function saveState() {
  if (!state.record) {
    return;
  }
  const dtx = ensureDtx(state.record);
  state.record.planGame = {
    stage: dtx.stage,
    score: dtx.scores.plangame,
    goals: state.goals
  };
  await persistRecord(state.record);
}

async function completeGoal(index) {
  const goal = state.goals[index];
  if (!goal || getCooldownRemaining(goal) > 0 || !state.record) {
    return;
  }
  const now = new Date();
  goal.completedAt = now.toISOString();
  goal.cooldownUntil = new Date(now.getTime() + COOLDOWN_MS).toISOString();
  ensureDtx(state.record).scores.plangame += 10;
  await saveState();
  render();
}

async function editGoal(index) {
  const current = state.goals[index];
  if (!current || !state.record) {
    return;
  }
  const nextText = window.prompt("목표를 수정하세요.", current.text);
  if (nextText == null) {
    return;
  }
  const trimmed = nextText.trim();
  if (!trimmed) {
    return;
  }
  current.text = trimmed;
  current.completedAt = null;
  current.cooldownUntil = null;
  current.updatedAt = new Date().toISOString();
  state.openGoalIndex = index;
  await saveState();
  render();
}

function bindEvents() {
  forestButton.addEventListener("click", () => {
    window.location.href = buildUrl("/dtx", state.userId);
  });

  guideButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    startTutorial().catch(() => {
      if (typeof guideModal.showModal === "function") {
        guideModal.showModal();
        return;
      }
      window.alert("목표를 누르면 완료 패널이 열립니다. 완료는 1시간마다 한 번 가능합니다. ... 버튼으로 목표를 수정하면 완료 기록이 초기화됩니다.");
    });
  });

  idForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const nextId = userIdInput.value.trim();
    if (!nextId) {
      return;
    }
    window.location.href = buildUrl("/plangame", nextId);
  });

  goalList.addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-goal-open]");
    if (openButton) {
      const index = Number(openButton.getAttribute("data-goal-open"));
      state.openGoalIndex = state.openGoalIndex === index ? null : index;
      render();
      return;
    }

    const editButton = event.target.closest("[data-goal-edit]");
    if (editButton) {
      editGoal(Number(editButton.getAttribute("data-goal-edit"))).catch((error) => window.alert(error.message));
      return;
    }

    const completeButton = event.target.closest("[data-goal-complete]");
    if (completeButton) {
      completeGoal(Number(completeButton.getAttribute("data-goal-complete"))).catch((error) => window.alert(error.message));
    }
  });

  tutorialOverlay.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    advanceTutorial();
  });

  app.addEventListener("keydown", (event) => {
    if (state.mode !== "tutorial") {
      return;
    }
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      advanceTutorial();
    }
  });
}

function startCooldownTicker() {
  if (state.tickTimer) {
    clearInterval(state.tickTimer);
  }
  state.tickTimer = setInterval(() => {
    if (state.record) {
      renderGoals();
    }
  }, 1000);
}

async function init() {
  bindEvents();
  startCooldownTicker();
  updateHeader();
  hideCharacters();

  if (!state.userId) {
    loadingView.classList.add("hidden");
    emptyView.classList.remove("hidden");
    userIdInput.focus();
    return;
  }

  const record = await loadLatestRecordById(state.userId);
  if (!record) {
    loadingView.classList.add("hidden");
    emptyView.classList.remove("hidden");
    userIdInput.value = state.userId;
    return;
  }

  ensurePlanGame(record);
  state.record = record;
  state.goals = record.planGame.goals;
  render();
}

init().catch((error) => {
  loadingView.classList.remove("hidden");
  loadingView.innerHTML = `
    <h1 class="title">플랜 게임</h1>
    <p class="muted">${escapeHtml(error.message)}</p>
  `;
});
