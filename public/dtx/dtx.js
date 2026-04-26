const {
  getUserIdFromUrl,
  loadLatestRecordById,
  ensureDtx,
  computeStageByScore,
  buildUrl,
  persistRecord,
  api
} = window.DtxCommon;

const EVENT_SEQUENCE = [
  { key: "opening", threshold: 0, url: "/game/scripts/opening.json", label: "OPENING" },
  { key: "100", threshold: 100, url: "/game/scripts/100.json", label: "100" },
  { key: "200", threshold: 200, url: "/game/scripts/200.json", label: "200" },
  { key: "300", threshold: 300, url: "/game/scripts/300.json", label: "300" },
  { key: "400", threshold: 400, url: "/game/scripts/400.json", label: "400" },
  { key: "500", threshold: 500, url: "/game/scripts/500.json", label: "500" },
  { key: "600", threshold: 600, url: "/game/scripts/600.json", label: "600" },
  { key: "700", threshold: 700, url: "/game/scripts/700.json", label: "700" },
  { key: "800", threshold: 800, url: "/game/scripts/800.json", label: "800" }
];

const bg = document.getElementById("bg");
const userChip = document.getElementById("user-chip");
const scoreChip = document.getElementById("score-chip");
const stageChip = document.getElementById("stage-chip");
const loadingView = document.getElementById("loading-view");
const emptyView = document.getElementById("empty-view");
const menuView = document.getElementById("menu-view");
const idForm = document.getElementById("id-form");
const userIdInput = document.getElementById("user-id-input");
const guestButton = document.getElementById("guest-button");
const eventOverlay = document.getElementById("event-overlay");
const eventAdd = document.getElementById("event-add");
const eventLumen = document.getElementById("event-lumen");
const eventBubble = document.getElementById("event-bubble");
const eventMeta = document.getElementById("event-meta");
const eventText = document.getElementById("event-text");
const eventHint = document.getElementById("event-hint");

const state = {
  userId: getUserIdFromUrl(),
  record: null,
  activeEventFrames: [],
  activeEventCursor: -1
};

function makeTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

async function createGuestRecord() {
  const createdAt = new Date().toISOString();
  const guestId = `guest-${Date.now().toString().slice(-6)}`;
  const fileName = `${guestId}-${makeTimestamp(new Date())}.json`;
  const record = {
    id: guestId,
    createdAt,
    updatedAt: createdAt,
    fileName,
    currentStep: "dtx",
    tests: {
      asrs: [],
      dsm5: [],
      game: {
        status: "pending",
        mode: "assessment",
        currentTestIndex: 0,
        currentTestKey: "signal_detection",
        tests: {
          signal_detection: null,
          go_nogo: null,
          balance_hold: null
        },
        summary: {
          inattention_signal_score: null,
          impulsivity_signal_score: null,
          activity_signal_score: null
        },
        startedAt: null,
        completedAt: null
      }
    },
    dsm5Analysis: null,
    dsm5QuickAnalysis: null,
    report: null,
    plan: {
      suggestions: ["plan1", "plan2", "plan3"],
      chat: []
    }
  };
  ensureDtx(record);
  await api("/api/records", {
    method: "POST",
    body: JSON.stringify({
      fileName,
      data: record
    })
  });
  return guestId;
}

function renderHeader() {
  if (!state.record) {
    userChip.textContent = "사용자 없음";
    scoreChip.textContent = "0점";
    stageChip.textContent = "stage1";
    bg.src = computeStageByScore(0).image;
    return;
  }
  const dtx = ensureDtx(state.record);
  userChip.textContent = state.record.id;
  scoreChip.textContent = `${dtx.totalScore}점`;
  stageChip.textContent = dtx.stage;
  bg.src = computeStageByScore(dtx.totalScore).image;
}

function ensureEventState(record) {
  const dtx = ensureDtx(record);
  if (!Array.isArray(dtx.seenEvents)) {
    dtx.seenEvents = [];
  }
  return dtx.seenEvents;
}

function hideEventCharacters() {
  eventAdd.classList.remove("visible");
  eventLumen.classList.remove("visible");
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

function speakerToKorean(speaker) {
  if (speaker === "add") return "애드";
  if (speaker === "lumen") return "루멘";
  return "";
}

function renderActiveEventFrame() {
  const frame = state.activeEventFrames[state.activeEventCursor];
  if (!frame) {
    return;
  }
  menuView.classList.add("is-hidden");
  eventOverlay.classList.remove("hidden");
  eventBubble.classList.remove("hidden");
  eventMeta.textContent = `${frame.label} · ${speakerToKorean(frame.speaker)}`;
  eventText.textContent = frame.text || "";
  hideEventCharacters();
  const imagePath = resolveCharacterImage(frame.speaker, frame.expression);
  if (frame.speaker === "add") {
    showSpeakerImage(eventAdd, imagePath, "/game/images/add.png");
    eventAdd.classList.add("visible");
  } else if (frame.speaker === "lumen") {
    showSpeakerImage(eventLumen, imagePath, "/game/images/lumen1.png");
    eventLumen.classList.add("visible");
  }
  eventHint.textContent = state.activeEventCursor >= state.activeEventFrames.length - 1 ? "클릭해서 닫기" : "클릭해서 다음";
}

async function closeEvent() {
  eventOverlay.classList.add("hidden");
  eventBubble.classList.add("hidden");
  hideEventCharacters();
  menuView.classList.remove("is-hidden");
  state.activeEventFrames = [];
  state.activeEventCursor = -1;
  renderHeader();
  if (state.record) {
    await persistRecord(state.record);
  }
}

async function advanceEvent() {
  if (!state.activeEventFrames.length) {
    return;
  }
  if (state.activeEventCursor >= state.activeEventFrames.length - 1) {
    await closeEvent();
    return;
  }
  state.activeEventCursor += 1;
  renderActiveEventFrame();
}

async function maybeStartScoreEvent() {
  if (!state.record) {
    return;
  }
  const dtx = ensureDtx(state.record);
  const seenEvents = ensureEventState(state.record);
  const nextEvent = EVENT_SEQUENCE.find((item) => {
    if (seenEvents.includes(item.key)) {
      return false;
    }
    if (item.key === "opening") {
      return dtx.totalScore === 0;
    }
    return dtx.totalScore >= item.threshold;
  });
  if (!nextEvent) {
    return;
  }
  const response = await fetch(nextEvent.url, { cache: "no-store" });
  if (!response.ok) {
    return;
  }
  const json = await response.json();
  const lines = Array.isArray(json.lines) ? json.lines : [];
  if (!lines.length) {
    seenEvents.push(nextEvent.key);
    await persistRecord(state.record);
    return;
  }
  seenEvents.push(nextEvent.key);
  state.activeEventFrames = lines.map((line) => ({
    speaker: line.speaker || "",
    expression: line.expression || "",
    text: line.text || "",
    label: nextEvent.label
  }));
  state.activeEventCursor = 0;
  renderActiveEventFrame();
}

async function init() {
  renderHeader();

  idForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const nextId = userIdInput.value.trim();
    if (!nextId) {
      return;
    }
    window.location.href = buildUrl("/dtx", nextId);
  });

  guestButton?.addEventListener("click", async () => {
    guestButton.disabled = true;
    try {
      const guestId = await createGuestRecord();
      window.location.href = buildUrl("/dtx", guestId);
    } finally {
      guestButton.disabled = false;
    }
  });

  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!eventOverlay.classList.contains("hidden")) {
        return;
      }
      const target = button.getAttribute("data-nav");
      window.location.href = buildUrl(`/${target}`, state.userId);
    });
  });

  eventOverlay.addEventListener("click", () => {
    advanceEvent().catch(() => {});
  });

  if (!state.userId) {
    loadingView.classList.add("hidden");
    emptyView.classList.remove("hidden");
    userIdInput.focus();
    return;
  }

  const record = await loadLatestRecordById(state.userId);
  loadingView.classList.add("hidden");
  if (!record) {
    emptyView.classList.remove("hidden");
    userIdInput.value = state.userId;
    return;
  }

  state.record = record;
  renderHeader();
  menuView.classList.remove("hidden");
  ensureEventState(state.record);
  await maybeStartScoreEvent();
}

init().catch(() => {
  loadingView.classList.remove("hidden");
});
