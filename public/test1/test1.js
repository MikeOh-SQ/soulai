const TOTAL_TRIALS = 20;
const CUE_MS = 450;
const STIMULUS_MS = 1000;
const BETWEEN_MS = 220;
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

const BASE = "/test1/images";
const EVENT_URL = "/test1/events/test1.json";
const OBJECTS = ["o0.gif", "o1.gif", "o2.gif", "o3.gif", "o4.gif"];
const CUE_IMAGE = "oq.gif";
const BACKGROUND_CANDIDATES = ["test1back.gif", "test1.gif"];
const SHOULD_AUTO_TUTORIAL = new URLSearchParams(window.location.search).get("tutorial") === "1";

const app = document.getElementById("app");
const bg = document.getElementById("bg");
const progress = document.getElementById("progress");
const objectImage = document.getElementById("object");
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
let activeStimulus = "";
let clickedInWindow = false;
let tutorialLines = [];
let tutorialIndex = -1;
let trialSequence = [];
let awardedForCurrentRun = false;

const userId = getUserIdFromUrl();
let record = null;

function setBackground() {
  let index = 0;
  const tryNext = () => {
    if (index >= BACKGROUND_CANDIDATES.length) {
      return;
    }
    const fileName = BACKGROUND_CANDIDATES[index];
    index += 1;
    bg.onerror = tryNext;
    bg.src = `${BASE}/${fileName}`;
  };
  tryNext();
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
  syncModeUI();
}

async function startTutorial() {
  clearTimers();
  mode = "tutorial";
  syncModeUI();
  trial = 0;
  correct = 0;
  activeStimulus = "";
  clickedInWindow = false;
  hideImage();
  result.classList.add("hidden");
  progress.textContent = "튜토리얼";
  hint.textContent = "클릭해서 다음";
  setGuideButtonVisible(false);
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

function showImage(fileName) {
  objectImage.src = `${BASE}/${fileName}`;
  objectImage.classList.remove("hidden");
}

function hideImage() {
  objectImage.classList.add("hidden");
}

function randomStimulus() {
  const targetChance = 1 / 11;
  if (Math.random() < targetChance) {
    return "o0.gif";
  }
  const bricks = ["o1.gif", "o2.gif", "o3.gif", "o4.gif"];
  return bricks[Math.floor(Math.random() * bricks.length)];
}

function shuffle(array) {
  for (let index = array.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = array[index];
    array[index] = array[swapIndex];
    array[swapIndex] = temp;
  }
  return array;
}

function buildTrialSequence(totalTrials, minimumTargets) {
  const sequence = [];
  for (let count = 0; count < minimumTargets; count += 1) {
    sequence.push("o0.gif");
  }
  while (sequence.length < totalTrials) {
    sequence.push(randomStimulus());
  }
  return shuffle(sequence);
}

function evaluateTrial() {
  const isTarget = activeStimulus === "o0.gif";
  const isCorrect = (isTarget && clickedInWindow) || (!isTarget && !clickedInWindow);
  if (isCorrect) {
    correct += 1;
  }
}

function getRelaxedJudgeText(scoreValue) {
  if (scoreValue >= 16) return "아주 안정적";
  if (scoreValue >= 12) return "양호";
  if (scoreValue >= 8) return "통과 (완화 기준)";
  return "재시도 권장";
}

function renderResult() {
  mode = "finished";
  syncModeUI();
  hideImage();
  result.classList.remove("hidden");
  score.textContent = `${correct} / ${TOTAL_TRIALS} 정답`;
  judge.textContent = getRelaxedJudgeText(correct);
  if (record && !awardedForCurrentRun) {
    addScore(record, "test1", correct);
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
  activeStimulus = "";
  clickedInWindow = false;
  progress.textContent = `${trial} / ${TOTAL_TRIALS}`;
  showImage(CUE_IMAGE);

  timers.push(setTimeout(() => {
    activeStimulus = trialSequence[trial - 1] || randomStimulus();
    showImage(activeStimulus);

    timers.push(setTimeout(() => {
      evaluateTrial();
      hideImage();
      timers.push(setTimeout(nextTrial, BETWEEN_MS));
    }, STIMULUS_MS));
  }, CUE_MS));
}

function resetState() {
  clearTimers();
  mode = "running";
  syncModeUI();
  trial = 0;
  correct = 0;
  trialSequence = buildTrialSequence(TOTAL_TRIALS, 5);
  activeStimulus = "";
  clickedInWindow = false;
  awardedForCurrentRun = false;
  tutorial.classList.add("hidden");
  hideCharacters();
  result.classList.add("hidden");
  hint.textContent = "진행 중";
  setGuideButtonVisible(false);
  nextTrial();
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
  if (!activeStimulus) {
    return;
  }
  clickedInWindow = true;
}

async function init() {
  setBackground();
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
  if (SHOULD_AUTO_TUTORIAL && record && !hasSeenTutorial(record, "build")) {
    await startTutorial();
    await markTutorialSeen(record, "build");
  }
}

init().catch(() => {
  updateScoreboard();
});
