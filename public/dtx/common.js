window.DtxCommon = (() => {
  const STAGE_THRESHOLDS = [
    { minScore: 800, stage: "stage5", image: "/game/images/stage5.png" },
    { minScore: 600, stage: "stage4", image: "/game/images/stage4.png" },
    { minScore: 400, stage: "stage3", image: "/game/images/stage3.png" },
    { minScore: 200, stage: "stage2", image: "/game/images/stage2.png" },
    { minScore: 0, stage: "stage1", image: "/game/images/stage1.png" }
  ];

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

  async function persistRecord(record) {
    record.updatedAt = new Date().toISOString();
    ensureDtx(record);
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

  return {
    STAGE_THRESHOLDS,
    api,
    getUserIdFromUrl,
    loadLatestRecordById,
    computeStageByScore,
    ensureDtx,
    persistRecord,
    addScore,
    buildUrl,
    escapeHtml
  };
})();
