const SCRIPT_SEQUENCE = [
  { key: "opening", url: "/game/scripts/opening.json", stage: 1, label: "OPENING" },
  { key: "100", url: "/game/scripts/100.json", stage: 1, label: "100" },
  { key: "200", url: "/game/scripts/200.json", stage: 2, label: "200" },
  { key: "300", url: "/game/scripts/300.json", stage: 2, label: "300" },
  { key: "400", url: "/game/scripts/400.json", stage: 3, label: "400" },
  { key: "500", url: "/game/scripts/500.json", stage: 3, label: "500" },
  { key: "600", url: "/game/scripts/600.json", stage: 4, label: "600" },
  { key: "700", url: "/game/scripts/700.json", stage: 4, label: "700" },
  { key: "800", url: "/game/scripts/800.json", stage: 5, label: "800" }
];
const {
  resolveCharacterImage,
  showSpeakerImage
} = window.DtxCommon;

const app = document.getElementById("app");
const bg = document.getElementById("bg");
const addImage = document.getElementById("add");
const lumenImage = document.getElementById("lumen");
const bubble = document.getElementById("bubble");
const meta = document.getElementById("meta");
const text = document.getElementById("text");
const hint = document.getElementById("hint");

let timeline = [];
let cursor = -1;
let started = false;

function stageToBackground(stage) {
  const stageText = String(stage || "").trim();
  const extracted = stageText.match(/stage\s*([1-5])/i);
  const numeric = extracted ? Number(extracted[1]) : Number(stage);
  if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 5) {
    return `/game/images/stage${numeric}.png`;
  }
  return "/game/images/stage1.png";
}

function speakerToKorean(speaker) {
  if (speaker === "add") return "애드";
  if (speaker === "lumen") return "루멘";
  return "";
}

function hideCharacters() {
  addImage.classList.remove("visible");
  lumenImage.classList.remove("visible");
}

function render() {
  if (cursor < 0) {
    bg.src = stageToBackground(1);
    bubble.classList.add("hidden");
    hideCharacters();
    hint.textContent = "클릭해서 시작";
    return;
  }

  if (cursor >= timeline.length) {
    bg.src = stageToBackground(5);
    bubble.classList.remove("hidden");
    meta.textContent = "END";
    text.textContent = "스토리 재생 완료";
    hideCharacters();
    hint.textContent = "완료";
    return;
  }

  const frame = timeline[cursor];
  bg.src = stageToBackground(frame.stage);
  bubble.classList.remove("hidden");
  meta.textContent = `${frame.label} · ${speakerToKorean(frame.speaker)}`;
  text.textContent = frame.text || "";

  const imagePath = resolveCharacterImage(frame.speaker, frame.expression);
  hideCharacters();
  if (frame.speaker === "add") {
    showSpeakerImage(addImage, imagePath, "/game/images/add.png");
    addImage.classList.add("visible");
  } else if (frame.speaker === "lumen") {
    showSpeakerImage(lumenImage, imagePath, "/game/images/lumen1.png");
    lumenImage.classList.add("visible");
  }

  hint.textContent = cursor === timeline.length - 1 ? "클릭해서 종료" : "클릭해서 다음";
}

function advance() {
  if (!started) {
    started = true;
  }
  cursor += 1;
  render();
}

async function loadTimeline() {
  const loaded = await Promise.all(
    SCRIPT_SEQUENCE.map(async (entry) => {
      const response = await fetch(entry.url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`script load failed: ${entry.url}`);
      }
      const json = await response.json();
      return { entry, json };
    })
  );

  timeline = loaded.flatMap(({ entry, json }) => {
    const lines = Array.isArray(json.lines) ? json.lines : [];
    return lines.map((line) => ({
      stage: line.stage || json.stage || entry.stage,
      speaker: line.speaker || "",
      expression: line.expression || "",
      text: line.text || "",
      label: entry.label
    }));
  });
}

function bindInput() {
  app.addEventListener("click", advance);
  app.addEventListener("keydown", (event) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      advance();
    }
  });
}

async function init() {
  try {
    await loadTimeline();
    bindInput();
    render();
  } catch (error) {
    bubble.classList.remove("hidden");
    meta.textContent = "ERROR";
    text.textContent = "스크립트를 불러오지 못했습니다.";
    hint.textContent = "오류";
  }
}

init();
