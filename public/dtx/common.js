window.DtxCommon = (() => {
  const STAGE_THRESHOLDS = [
    { minScore: 800, stage: "stage5", image: "/game/images/stage5.png" },
    { minScore: 600, stage: "stage4", image: "/game/images/stage4.png" },
    { minScore: 400, stage: "stage3", image: "/game/images/stage3.png" },
    { minScore: 200, stage: "stage2", image: "/game/images/stage2.png" },
    { minScore: 0, stage: "stage1", image: "/game/images/stage1.png" }
  ];
  const sanitizedImageCache = new Map();

  async function api(url, options) {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "요청 처리 중 오류가 발생했습니다.");
    }
    return response.json();
  }

  function getUserIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id")?.trim() || "";
  }

  async function loadLatestRecordById(userId) {
    if (!userId) {
      return null;
    }
    const records = await api("/api/records");
    const matched = records
      .filter((item) => item.id === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!matched.length) {
      return null;
    }
    return api(`/api/records/${matched[0].fileName}`);
  }

  function computeStageByScore(score) {
    return STAGE_THRESHOLDS.find((item) => score >= item.minScore) || STAGE_THRESHOLDS[STAGE_THRESHOLDS.length - 1];
  }

  function ensureDtx(record) {
    if (!record.dtx || typeof record.dtx !== "object") {
      record.dtx = {
        stage: "stage1",
        totalScore: 0,
        scores: {
          plangame: Number(record.planGame?.score || 0),
          test1: 0,
          test2: 0
        }
      };
    }

    const scores = record.dtx.scores || {};
    record.dtx.scores = {
      plangame: Number(scores.plangame ?? record.planGame?.score ?? 0),
      test1: Number(scores.test1 || 0),
      test2: Number(scores.test2 || 0)
    };

    record.dtx.totalScore = Object.values(record.dtx.scores).reduce((sum, value) => sum + Number(value || 0), 0);
    record.dtx.stage = computeStageByScore(record.dtx.totalScore).stage;
    return record.dtx;
  }

  function ensureTutorialState(record) {
    if (!record || typeof record !== "object") {
      return {
        plan: false,
        build: false,
        chop: false
      };
    }
    if (!record.tutorials || typeof record.tutorials !== "object") {
      record.tutorials = {};
    }
    record.tutorials = {
      plan: Boolean(record.tutorials.plan),
      build: Boolean(record.tutorials.build),
      chop: Boolean(record.tutorials.chop)
    };
    return record.tutorials;
  }

  function hasSeenTutorial(record, key) {
    const tutorials = ensureTutorialState(record);
    return Boolean(tutorials[key]);
  }

  async function markTutorialSeen(record, key) {
    const tutorials = ensureTutorialState(record);
    if (tutorials[key]) {
      return;
    }
    tutorials[key] = true;
    await persistRecord(record);
  }

  async function persistRecord(record) {
    record.updatedAt = new Date().toISOString();
    ensureDtx(record);
    ensureTutorialState(record);
    if (record.planGame?.score != null) {
      record.planGame.score = record.dtx.scores.plangame;
      record.planGame.stage = record.dtx.stage;
    }
    await api("/api/records", {
      method: "POST",
      body: JSON.stringify({
        fileName: record.fileName,
        data: record
      })
    });
  }

  function addScore(record, key, points) {
    const dtx = ensureDtx(record);
    dtx.scores[key] = Number(dtx.scores[key] || 0) + Number(points || 0);
    dtx.totalScore = Object.values(dtx.scores).reduce((sum, value) => sum + Number(value || 0), 0);
    dtx.stage = computeStageByScore(dtx.totalScore).stage;
    return dtx;
  }

  function buildUrl(pathname, userId) {
    return userId ? `${pathname}?id=${encodeURIComponent(userId)}` : pathname;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
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

  function isBackgroundLikePixel(data, offset) {
    const alpha = data[offset + 3];
    if (alpha <= 16) {
      return true;
    }
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    return alpha >= 200 && red <= 36 && green <= 36 && blue <= 36;
  }

  function shouldSanitizeBlackMatte(data, width, height) {
    let sampled = 0;
    let matched = 0;
    const samplePixel = (x, y) => {
      const offset = (y * width + x) * 4;
      sampled += 1;
      if (isBackgroundLikePixel(data, offset)) {
        matched += 1;
      }
    };

    for (let x = 0; x < width; x += 1) {
      samplePixel(x, 0);
      if (height > 1) {
        samplePixel(x, height - 1);
      }
    }
    for (let y = 1; y < height - 1; y += 1) {
      samplePixel(0, y);
      if (width > 1) {
        samplePixel(width - 1, y);
      }
    }

    return sampled > 0 && matched / sampled >= 0.72;
  }

  async function sanitizeCharacterImage(src) {
    if (!src) {
      return src;
    }
    if (sanitizedImageCache.has(src)) {
      return sanitizedImageCache.get(src);
    }

    const sanitizedPromise = new Promise((resolve) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth || image.width;
          canvas.height = image.naturalHeight || image.height;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          if (!context || !canvas.width || !canvas.height) {
            resolve(src);
            return;
          }

          context.drawImage(image, 0, 0);
          const bitmap = context.getImageData(0, 0, canvas.width, canvas.height);
          const { data, width, height } = bitmap;
          if (!shouldSanitizeBlackMatte(data, width, height)) {
            resolve(src);
            return;
          }

          const visited = new Uint8Array(width * height);
          const queue = new Uint32Array(width * height);
          let head = 0;
          let tail = 0;

          const enqueue = (x, y) => {
            const index = y * width + x;
            if (visited[index]) {
              return;
            }
            const offset = index * 4;
            if (!isBackgroundLikePixel(data, offset)) {
              return;
            }
            visited[index] = 1;
            queue[tail] = index;
            tail += 1;
          };

          for (let x = 0; x < width; x += 1) {
            enqueue(x, 0);
            if (height > 1) {
              enqueue(x, height - 1);
            }
          }
          for (let y = 1; y < height - 1; y += 1) {
            enqueue(0, y);
            if (width > 1) {
              enqueue(width - 1, y);
            }
          }

          while (head < tail) {
            const index = queue[head];
            head += 1;
            const offset = index * 4;
            data[offset + 3] = 0;
            const x = index % width;
            const y = Math.floor(index / width);
            if (x > 0) enqueue(x - 1, y);
            if (x + 1 < width) enqueue(x + 1, y);
            if (y > 0) enqueue(x, y - 1);
            if (y + 1 < height) enqueue(x, y + 1);
          }

          context.putImageData(bitmap, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(src);
        }
      };
      image.onerror = () => resolve(src);
      image.src = src;
    });

    sanitizedImageCache.set(src, sanitizedPromise);
    return sanitizedPromise;
  }

  async function showSpeakerImage(element, mainSrc, fallbackSrc) {
    const requestKey = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    element.dataset.requestKey = requestKey;

    const applySrc = async (src, isFallback = false) => {
      const nextSrc = await sanitizeCharacterImage(src);
      if (element.dataset.requestKey !== requestKey) {
        return false;
      }
      element.src = nextSrc;
      element.onerror = () => {
        if (isFallback || element.dataset.requestKey !== requestKey) {
          return;
        }
        applySrc(fallbackSrc, true).catch(() => {});
      };
      return true;
    };

    await applySrc(mainSrc);
  }

  function ensureScaleFitStyle() {
    if (document.getElementById("dtx-scale-fit-style")) {
      return;
    }
    const style = document.createElement("style");
    style.id = "dtx-scale-fit-style";
    style.textContent = `
      html.dtx-scale-fit-html,
      body.dtx-scale-fit-body {
        width: 100%;
        height: 100%;
        min-height: 100%;
        margin: 0;
        overflow: hidden;
      }

      body.dtx-scale-fit-body {
        position: relative;
        background: #090704;
      }

      .dtx-scale-fit-root {
        position: absolute !important;
        left: 50%;
        top: 50%;
        margin: 0 !important;
        width: var(--scale-fit-base-width-px) !important;
        height: var(--scale-fit-base-height-px) !important;
        min-height: 0 !important;
        max-width: none !important;
        max-height: none !important;
        transform: translate(-50%, -50%) scale(var(--scale-fit-scale, 1));
        transform-origin: center center;
        overflow: hidden;
      }

      .dtx-scale-fit-root .bg,
      .dtx-scale-fit-root .tutorial-overlay,
      .dtx-scale-fit-root .event-overlay {
        position: absolute !important;
        inset: 0 !important;
      }
    `;
    document.head.appendChild(style);
  }

  function parseScaleFitSpec(spec) {
    const text = String(spec || "").trim().toLowerCase();
    const matched = text.match(/^(\d+)\s*[x:/]\s*(\d+)$/);
    if (!matched) {
      return { width: 720, height: 1080 };
    }
    return {
      width: Number(matched[1]) || 720,
      height: Number(matched[2]) || 1080
    };
  }

  function mountScaleFit(root, options = {}) {
    if (!root || root.__scaleFitMounted) {
      return root;
    }

    const baseWidth = Number(options.width || options.baseWidth || 720);
    const baseHeight = Number(options.height || options.baseHeight || 1080);
    ensureScaleFitStyle();
    document.documentElement.classList.add("dtx-scale-fit-html");
    document.body.classList.add("dtx-scale-fit-body");
    root.classList.add("dtx-scale-fit-root");
    root.style.setProperty("--scale-fit-base-width-px", `${baseWidth}px`);
    root.style.setProperty("--scale-fit-base-height-px", `${baseHeight}px`);

    const update = () => {
      const viewportWidth = Math.max(window.innerWidth || 0, 1);
      const viewportHeight = Math.max(window.innerHeight || 0, 1);
      const scale = Math.min(viewportWidth / baseWidth, viewportHeight / baseHeight);
      root.style.setProperty("--scale-fit-scale", String(scale));
    };

    let resizeFrame = 0;
    const scheduleUpdate = () => {
      if (resizeFrame) {
        cancelAnimationFrame(resizeFrame);
      }
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        update();
      });
    };

    window.addEventListener("resize", scheduleUpdate, { passive: true });
    window.addEventListener("orientationchange", scheduleUpdate, { passive: true });
    root.__scaleFitMounted = true;
    update();
    return root;
  }

  function initScaleFitRoots() {
    const roots = document.querySelectorAll("[data-scale-fit]");
    roots.forEach((root) => {
      const spec = parseScaleFitSpec(root.getAttribute("data-scale-fit"));
      mountScaleFit(root, spec);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initScaleFitRoots, { once: true });
  } else {
    initScaleFitRoots();
  }

  return {
    STAGE_THRESHOLDS,
    api,
    getUserIdFromUrl,
    loadLatestRecordById,
    computeStageByScore,
    ensureDtx,
    ensureTutorialState,
    hasSeenTutorial,
    markTutorialSeen,
    persistRecord,
    addScore,
    buildUrl,
    escapeHtml,
    resolveCharacterImage,
    showSpeakerImage,
    mountScaleFit
  };
})();
