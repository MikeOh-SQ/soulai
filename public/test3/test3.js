const BASE = "/test3/images";
const EVENT_URL = "/test3/events/test3.json";
const BACKGROUND_IMAGE = "test3.gif";
const {
  resolveCharacterImage,
  showSpeakerImage
} = window.DtxCommon;

const DURATION_MS = 20000;
const TICK_MS = 100;
const STABLE_RADIUS = 0.28;

const app = document.getElementById("app");
const bg = document.getElementById("bg");
const progress = document.getElementById("progress");
const statusText = document.getElementById("status");
const hint = document.getElementById("hint");
const result = document.getElementById("result");
const score = document.getElementById("score");
const judge = document.getElementById("judge");
const ball = document.getElementById("ball");
const arena = document.getElementById("arena");
const holdWrap = document.querySelector(".hold-wrap");
const holdButton = document.getElementById("hold-button");

const startButton = document.getElementById("start-button");
const guideButton = document.getElementById("guide-button");
const tutorial = document.getElementById("tutorial");
const tutorialSpeaker = document.getElementById("tutorial-speaker");
const tutorialText = document.getElementById("tutorial-text");
const addCharacter = document.getElementById("add-character");
const lumenCharacter = document.getElementById("lumen-character");

const searchParams = new URLSearchParams(window.location.search);
const isStartMode = searchParams.get("start") === "1";

let mode = isStartMode ? "running" : "idle";
let timers = [];
let tutorialLines = [];
let tutorialIndex = -1;

let holdActive = false;
let x = 0;
let y = 0;
let vx = 0;
let vy = 0;
let centerSeconds = 0;
let startedAt = 0;

function scheduleTimeout(fn, ms) {
  const id = setTimeout(fn, ms);
  timers.push(id);
  return id;
}

function clearTimers() {
  timers.forEach((id) => clearTimeout(id));
  timers = [];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setGuideButtonVisible(visible) {
  guideButton.style.display = visible ? "inline-flex" : "none";
}

function setStartButtonVisible(visible) {
  startButton.style.display = visible ? "inline-flex" : "none";
}

function setArenaVisible(visible) {
  arena.classList.toggle("hidden", !visible);
  holdWrap.classList.toggle("hidden", !visible);
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

function showLandingScreen() {
  clearTimers();
  mode = "idle";
  tutorial.classList.add("hidden");
  result.classList.add("hidden");
  progress.textContent = "준비";
  statusText.textContent = "가운데 유지";
  hint.textContent = "시작하기를 누르면 새 화면에서 검사 시작";
  setStartButtonVisible(true);
  setGuideButtonVisible(true);
  setArenaVisible(false);
  hideCharacters();
}

function endTutorial() {
  tutorial.classList.add("hidden");
  tutorialSpeaker.textContent = "";
  tutorialText.textContent = "";
  hideCharacters();
  tutorialLines = [];
  tutorialIndex = -1;
  showLandingScreen();
}

async function startTutorial() {
  clearTimers();
  mode = "tutorial";
  tutorial.classList.add("hidden");
  result.classList.add("hidden");
  progress.textContent = "튜토리얼";
  statusText.textContent = "규칙 안내";
  hint.textContent = "클릭해서 다음";
  setStartButtonVisible(false);
  setGuideButtonVisible(false);
  setArenaVisible(false);
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

function renderBall() {
  const pxX = (x * 88).toFixed(1);
  const pxY = (y * 88).toFixed(1);
  ball.style.transform = `translate(calc(-50% + ${pxX}px), calc(-50% + ${pxY}px))`;
}

function resetPhysics() {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  centerSeconds = 0;
  holdActive = false;
  holdButton.classList.remove("active");
  renderBall();
}

function getJudgeText(points) {
  if (points >= 16) return "아주 안정적";
  if (points >= 12) return "양호";
  if (points >= 8) return "통과";
  return "재시도 권장";
}

function finishTest() {
  mode = "finished";
  clearTimers();
  const keptSeconds = Number(centerSeconds.toFixed(1));
  const points = Number(Math.min(20, keptSeconds).toFixed(1));
  result.classList.remove("hidden");
  score.textContent = `${keptSeconds}초 유지 · ${points} / 20점`;
  judge.textContent = getJudgeText(points);
  progress.textContent = "종료";
  statusText.textContent = "클릭해서 다시 시작";
  hint.textContent = "클릭하면 첫 화면으로 이동";
}

function gameTick() {
  if (mode !== "running") {
    return;
  }

  const elapsed = performance.now() - startedAt;
  const dt = TICK_MS / 1000;

  if (holdActive) {
    x += (0 - x) * 0.24;
    y += (0 - y) * 0.24;
    vx *= 0.7;
    vy *= 0.7;
  } else {
    vx += (Math.random() - 0.5) * 0.7 * dt;
    vy += (Math.random() - 0.5) * 0.7 * dt;
    vx *= 0.98;
    vy *= 0.98;
    x += vx;
    y += vy;
  }

  x = clamp(x, -1.05, 1.05);
  y = clamp(y, -1.05, 1.05);

  const distance = Math.sqrt((x ** 2) + (y ** 2));
  const inside = distance <= STABLE_RADIUS;
  if (inside) {
    centerSeconds += dt;
  }

  renderBall();

  const remainingMs = Math.max(DURATION_MS - elapsed, 0);
  progress.textContent = `${Math.ceil(remainingMs / 1000)}s`;
  statusText.textContent = inside ? "중앙 유지 중" : "중앙 이탈";
  hint.textContent = holdActive ? "버튼 유지 중" : "가운데 유지 버튼을 길게 누르세요";

  if (elapsed >= DURATION_MS) {
    finishTest();
    return;
  }

  scheduleTimeout(gameTick, TICK_MS);
}

function startTest() {
  clearTimers();
  mode = "running";
  result.classList.add("hidden");
  tutorial.classList.add("hidden");
  hideCharacters();
  setStartButtonVisible(false);
  setGuideButtonVisible(false);
  setArenaVisible(true);
  resetPhysics();
  startedAt = performance.now();
  progress.textContent = "20s";
  statusText.textContent = "시작";
  hint.textContent = "가운데 유지 버튼을 길게 누르세요";
  scheduleTimeout(gameTick, TICK_MS);
}

function goToStartMode() {
  const url = new URL(window.location.href);
  url.searchParams.set("start", "1");
  url.searchParams.set("v", String(Date.now()));
  window.location.href = url.toString();
}

function goToLandingMode() {
  const url = new URL(window.location.href);
  url.searchParams.delete("start");
  url.searchParams.set("v", String(Date.now()));
  window.location.href = url.pathname + url.search;
}

function onUserClick(event) {
  const target = event?.target;
  if (target?.closest?.("#start-button") || target?.closest?.("#guide-button") || target?.closest?.("#hold-button")) {
    return;
  }

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
    goToLandingMode();
  }
}

function bindHoldButton() {
  const activate = (event) => {
    event.preventDefault();
    event.stopPropagation();
    holdActive = true;
    holdButton.classList.add("active");
  };
  const deactivate = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    holdActive = false;
    holdButton.classList.remove("active");
  };

  holdButton.addEventListener("mousedown", activate);
  holdButton.addEventListener("touchstart", activate, { passive: false });
  holdButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  window.addEventListener("mouseup", deactivate);
  window.addEventListener("touchend", deactivate, { passive: false });
  window.addEventListener("touchcancel", deactivate, { passive: false });
}

function init() {
  bg.src = `${BASE}/${BACKGROUND_IMAGE}`;
  app.addEventListener("click", onUserClick);
  const handleStartButton = (event) => {
    event.preventDefault();
    event.stopPropagation();
    goToStartMode();
  };
  const handleGuideButton = (event) => {
    event.preventDefault();
    event.stopPropagation();
    startTutorial();
  };
  startButton.addEventListener("click", handleStartButton);
  startButton.addEventListener("pointerup", handleStartButton);
  startButton.addEventListener("touchend", handleStartButton, { passive: false });
  guideButton.addEventListener("click", handleGuideButton);
  guideButton.addEventListener("pointerup", handleGuideButton);
  guideButton.addEventListener("touchend", handleGuideButton, { passive: false });
  app.addEventListener("keydown", (event) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (mode === "tutorial") {
        onUserClick();
        return;
      }
      if (mode === "idle") {
        goToStartMode();
        return;
      }
      if (mode === "finished") {
        goToLandingMode();
      }
    }
  });
  bindHoldButton();

  if (isStartMode) {
    startTest();
    return;
  }

  showLandingScreen();
}

init();
