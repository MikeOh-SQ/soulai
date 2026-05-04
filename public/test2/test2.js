const TOTAL_TRIALS = 20;
const STIMULUS_MS = 1000;
const BETWEEN_MS = 40;
const LATE_CLICK_RATIO = 0.5;
const {
  getUserIdFromUrl,
  loadLatestRecordById,
  ensureDtx,
  addScore,
  hasSeenTutorial,
  markTutorialSeen,
  persistRecord,
  buildUrl,
  resolveCharacterImage,
  showSpeakerImage
} = window.DtxCommon;
const SHOULD_AUTO_TUTORIAL = new URLSearchParams(window.location.search).get("tutorial") === "1";

const BASE = "/test2/images";
const EVENT_URL = "/test2/events/test2.json";
const BACKGROUND_IMAGE = "test2.gif";

const STIMULI = {
  log: {
    base: "test2log.gif",
    clicked: "test2logc.gif"
  },
  bomb: {
    base: "test2bomb.gif",
    clicked: "test2bombc.gif"
  },
  carot: {
    base: "test2carot.gif",
    clicked: "test2carrotc.gif"
  }
};

const app = document.getElementById("app");
const bg = document.getElementById("bg");
const progress = document.getElementById("progress");
const hint = document.getElementById("hint");
const result = document.getElementById("result");
const score = document.getElementById("score");
const judge = document.getElementById("judge");
const resultTotal = document.getElementById("result-total");
const userChip = document.getElementById("user-chip");
const totalScoreChip = document.getElementById("total-score-chip");
const forestButton = document.getElementById("forest-button");
const retryButton = document.getElementById("retry-button");
const forestButtonResult = document.getElementById("forest-button-result");
const guideButton = document.getElementById("guide-button");
const tutorial = document.getElementById("tutorial");
const tutorialSpeaker = document.getElementById("tutorial-speaker");
const tutorialText = document.getElementById("tutorial-text");
const addCharacter = document.getElementById("add-character");
const lumenCharacter = document.getElementById("lumen-character");

let timers = [];
let mode = "idle";
let trial = 0;
let correct = 0;
let activeType = "";
let stimulusStartedAt = 0;
let clicked = false;
let clickedMs = null;
let imagePool = [];
let tutorialLines = [];
let tutorialIndex = -1;
let awardedForCurrentRun = false;

const userId = getUserIdFromUrl();
let record = null;

function preloadImages() {
  const files = [
    BACKGROUND_IMAGE,
    STIMULI.log.base,
    STIMULI.log.clicked,
    STIMULI.bomb.base,
    STIMULI.bomb.clicked,
    STIMULI.carot.base,
    STIMULI.carot.clicked
  ];
  imagePool = files.map((fileName) => {
    const image = new Image();
    image.src = `${BASE}/${fileName}`;
    return image;
  });
}

function clearTimers() {
  timers.forEach((id) => clearTimeout(id));
  timers = [];
}

function syncModeUI() {
  app.classList.toggle("mode-idle", mode === "idle");
}

function setGuideButtonVisible(visible) {
  guideButton.style.display = visible ? "inline-flex" : "none";
}

function updateScoreboard() {
  if (!record) {
    userChip.textContent = "사용자 없음";
    totalScoreChip.textContent = "숲 점수 0점";
    return;
  }
  const dtx = ensureDtx(record);
  userChip.textContent = record.id;
  totalScoreChip.textContent = `숲 점수 ${dtx.totalScore}점`;
}

function goForest() {
  window.location.href = buildUrl("/dtx", userId);
}

function hideCharacters() {
  addCharacter.classList.remove("visible");
  lumenCharacter.classList.remove("visible");
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
  const line = tutorialLines[tutorialIndex];
  if (!line) {
    return;
  }
  tutorial.classList.remove("hidden");
  tutorialSpeaker.textContent = line.speaker || "";
  tutorialText.textContent = line.text || "";
  renderTutorialCharacter(line);
}

function endTutorial() {
  tutorial.classList.add("hidden");
  tutorialSpeaker.textContent = "";
  tutorialText.textContent = "";
  hideCharacters();
  tutorialLines = [];
  tutorialIndex = -1;
  mode = "idle";
  progress.textContent = "준비";
  hint.textContent = "클릭해서 시작";
  setGuideButtonVisible(true);
  hideImage();
  syncModeUI();
}

async function startTutorial() {
  clearTimers();
  mode = "tutorial";
  syncModeUI();
  trial = 0;
  correct = 0;
  activeType = "";
  stimulusStartedAt = 0;
  clicked = false;
  clickedMs = null;
  result.classList.add("hidden");
  progress.textContent = "튜토리얼";
  hint.textContent = "클릭해서 다음";
  setGuideButtonVisible(false);
  hideImage();
  try {
    const response = await fetch(`${EVENT_URL}?t=${Date.now()}`, { cache: "no-store" });
    const payload = await response.json();
    tutorialLines = Array.isArray(payload.lines) ? payload.lines : [];
    tutorialIndex = 0;
    if (!tutorialLines.length) {
      endTutorial();
      return;
    }
    showTutorialLine();
  } catch (error) {
    endTutorial();
  }
}

function setFrame(fileName) {
  const src = `${BASE}/${fileName}`;
  if (bg.dataset.frame === src) {
    return;
  }
  bg.dataset.frame = src;
  bg.src = src;
}

function showImage(fileName) {
  setFrame(fileName);
}

function hideImage() {
  setFrame(BACKGROUND_IMAGE);
}

function randomStimulusType() {
  const roll = Math.random();
  if (roll < 0.7) {
    return "log";
  }
  return roll < 0.85 ? "bomb" : "carot";
}

function evaluateTrial() {
  const lateThreshold = STIMULUS_MS * LATE_CLICK_RATIO;
  if (activeType === "log") {
    if (clicked && Number.isFinite(clickedMs) && clickedMs >= lateThreshold) {
      correct += 1;
    }
    return;
  }

  if (!clicked) {
    correct += 1;
  }
}

function getJudgeText(scoreValue) {
  if (scoreValue >= 16) return "아주 안정적";
  if (scoreValue >= 12) return "양호";
  if (scoreValue >= 8) return "통과";
  return "재시도 권장";
}

function renderResult() {
  mode = "finished";
  syncModeUI();
  hideImage();
  result.classList.remove("hidden");
  score.textContent = `${correct} / ${TOTAL_TRIALS} 정답`;
  judge.textContent = getJudgeText(correct);
  if (record && !awardedForCurrentRun) {
    addScore(record, "test2", correct);
    awardedForCurrentRun = true;
    persistRecord(record).catch(() => {});
    updateScoreboard();
  }
  resultTotal.textContent = record
    ? `숲 누적 점수 ${ensureDtx(record).totalScore}점 · 이번 획득 ${correct}점`
    : `이번 획득 ${correct}점`;
  progress.textContent = "종료";
  hint.textContent = "다시하기 또는 숲으로 돌아가기";
  setGuideButtonVisible(false);
}

function nextTrial() {
  if (trial >= TOTAL_TRIALS) {
    renderResult();
    return;
  }

  trial += 1;
  activeType = randomStimulusType();
  stimulusStartedAt = performance.now();
  clicked = false;
  clickedMs = null;

  progress.textContent = `${trial} / ${TOTAL_TRIALS}`;
  showImage(STIMULI[activeType].base);

  timers.push(setTimeout(() => {
    evaluateTrial();
    timers.push(setTimeout(nextTrial, BETWEEN_MS));
  }, STIMULUS_MS));
}

function resetState() {
  clearTimers();
  mode = "running";
  syncModeUI();
  trial = 0;
  correct = 0;
  activeType = "";
  stimulusStartedAt = 0;
  clicked = false;
  clickedMs = null;
  awardedForCurrentRun = false;
  tutorial.classList.add("hidden");
  hideCharacters();
  result.classList.add("hidden");
  hint.textContent = "진행 중";
  setGuideButtonVisible(false);
  nextTrial();
}

function handleStimulusClick() {
  if (!activeType || clicked) {
    return;
  }

  clicked = true;
  clickedMs = performance.now() - stimulusStartedAt;

  if (activeType === "log" && clickedMs >= STIMULUS_MS * LATE_CLICK_RATIO) {
    showImage(STIMULI.log.clicked);
    return;
  }

  if (activeType === "bomb") {
    showImage(STIMULI.bomb.clicked);
    return;
  }

  if (activeType === "carot") {
    showImage(STIMULI.carot.clicked);
    return;
  }
}

function onUserClick() {
  if (mode === "tutorial") {
    tutorialIndex += 1;
    if (tutorialIndex >= tutorialLines.length) {
      endTutorial();
      return;
    }
    showTutorialLine();
    return;
  }

  if (mode === "finished") {
    return;
  }

  if (mode === "idle") {
    resetState();
    return;
  }
  if (mode !== "running") {
    return;
  }
  handleStimulusClick();
}

async function init() {
  preloadImages();
  hideImage();
  hideCharacters();
  setGuideButtonVisible(true);
  syncModeUI();
  updateScoreboard();
  record = await loadLatestRecordById(userId);
  updateScoreboard();
  app.addEventListener("click", onUserClick);
  guideButton.addEventListener("click", (event) => {
    event.stopPropagation();
    startTutorial();
  });
  forestButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    goForest();
  });
  retryButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    resetState();
  });
  forestButtonResult.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    goForest();
  });
  app.addEventListener("keydown", (event) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (mode === "finished") {
        return;
      }
      onUserClick();
    }
  });
  if (SHOULD_AUTO_TUTORIAL && record && !hasSeenTutorial(record, "chop")) {
    await startTutorial();
    await markTutorialSeen(record, "chop");
  }
}

init().catch(() => {
  updateScoreboard();
});
