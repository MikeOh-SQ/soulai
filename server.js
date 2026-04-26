const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

loadEnvFile(path.join(__dirname, ".env"));

const rootDir = __dirname;
const publicDir = path.join(rootDir, "public");
const imagesDir = path.join(rootDir, "images");
const dsmImagesDir = path.join(rootDir, "dsmimages");
const gameImagesDir = path.join(rootDir, "game", "images");
const gameScriptsDir = path.join(rootDir, "game", "scripts");
const test1ImagesDir = path.join(rootDir, "game", "test1");
const test2ImagesDir = path.join(rootDir, "game", "test2");
const test3ImagesDir = path.join(rootDir, "game", "test3");
const configDir = path.join(rootDir, "config");
const databaseDir = path.join(rootDir, "database");
const geminiApiKey = process.env.GEMINI_API_KEY || "";
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

fs.mkdirSync(databaseDir, { recursive: true });

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function safeJoin(base, target) {
  const resolved = path.normalize(path.join(base, target));
  if (!resolved.startsWith(base)) {
    throw new Error("Invalid path");
  }
  return resolved;
}

function serveStatic(reqPath, res) {
  const baseDir = reqPath.startsWith("/images/")
    ? imagesDir
    : reqPath.startsWith("/dsmimages/")
      ? dsmImagesDir
      : reqPath.startsWith("/game/images/")
        ? gameImagesDir
        : reqPath.startsWith("/game/scripts/")
          ? gameScriptsDir
          : reqPath.startsWith("/test1/images/")
            ? test1ImagesDir
            : reqPath.startsWith("/test1/events/")
              ? test1ImagesDir
            : reqPath.startsWith("/test2/images/")
              ? test2ImagesDir
              : reqPath.startsWith("/test2/events/")
                ? test2ImagesDir
                : reqPath.startsWith("/test3/images/")
                  ? test3ImagesDir
                  : reqPath.startsWith("/test3/events/")
                    ? test3ImagesDir
      : publicDir;
  const relativePath = reqPath === "/"
    ? "index.html"
    : reqPath.startsWith("/images/")
      ? reqPath.replace("/images/", "")
      : reqPath.startsWith("/dsmimages/")
        ? reqPath.replace("/dsmimages/", "")
      : reqPath.startsWith("/game/images/")
        ? reqPath.replace("/game/images/", "")
      : reqPath.startsWith("/game/scripts/")
        ? reqPath.replace("/game/scripts/", "")
      : reqPath.startsWith("/test1/images/")
        ? reqPath.replace("/test1/images/", "")
      : reqPath.startsWith("/test1/events/")
        ? reqPath.replace("/test1/events/", "")
      : reqPath.startsWith("/test2/images/")
        ? reqPath.replace("/test2/images/", "")
      : reqPath.startsWith("/test2/events/")
        ? reqPath.replace("/test2/events/", "")
      : reqPath.startsWith("/test3/images/")
        ? reqPath.replace("/test3/images/", "")
      : reqPath.startsWith("/test3/events/")
        ? reqPath.replace("/test3/events/", "")
      : reqPath.slice(1);
  let filePath;

  try {
    filePath = safeJoin(baseDir, relativePath);
  } catch (error) {
    sendJson(res, 400, { error: error.message });
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const headers = {
    "Content-Type": mimeTypes[ext] || "application/octet-stream"
  };
  if ((reqPath.startsWith("/test1") || reqPath.startsWith("/test2") || reqPath.startsWith("/test3") || reqPath.startsWith("/plangame") || reqPath.startsWith("/dtx"))
    && [".html", ".js", ".css"].includes(ext)) {
    headers["Cache-Control"] = "no-store";
  }
  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
}

function getRecordMeta(fileName) {
  const filePath = path.join(databaseDir, fileName);
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw);
  return {
    fileName,
    id: parsed.id,
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
    currentStep: parsed.currentStep || "intro"
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function toRatio(value, total) {
  if (!total) {
    return 0;
  }
  return Number((value / total).toFixed(2));
}

function formatPercent(ratio) {
  return `${Math.round((Number(ratio) || 0) * 100)}%`;
}

function formatCount(value) {
  return Number.isFinite(Number(value)) ? `${Number(value)}회` : null;
}

function roundTo(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function getAsrsResponses(record) {
  const raw = record.tests?.asrs || record.tests?.asar || [];
  if (Array.isArray(raw)) {
    return raw.map((item) => (typeof item === "number" ? item : Number(item?.answer))).filter((value) => Number.isFinite(value));
  }
  if (Array.isArray(raw?.responses)) {
    return raw.responses.map((item) => Number(item)).filter((value) => Number.isFinite(value));
  }
  return [];
}

function getDsmResponses(record) {
  const raw = record.tests?.dsm5 || [];
  if (Array.isArray(raw)) {
    return raw.map((item) => (typeof item === "boolean" ? item : item?.answer)).filter((value) => typeof value === "boolean");
  }
  if (Array.isArray(raw?.responses)) {
    return raw.responses.filter((value) => typeof value === "boolean");
  }
  return [];
}

function analyzeDsmRecord(record) {
  const raw = record.tests?.dsm5;
  if (raw && !Array.isArray(raw) && typeof raw === "object") {
    const answeredCount = Array.isArray(raw.responses)
      ? raw.responses.filter((value) => typeof value === "boolean").length
      : Number(raw.inattention_true_count || 0) + Number(raw.hyperactivity_true_count || 0);
    return {
      answeredCount,
      inattentionYesCount: Number(raw.inattention_true_count || 0),
      hyperactivityYesCount: Number(raw.hyperactivity_true_count || 0),
      contextualYesCount: Number(raw.contextual_true_count || 0),
      totalYesCount: Number(raw.total_true_count || 0),
      subtype: raw.subtype || "판정 보류"
    };
  }

  const dsmAnswers = record.tests?.dsm5 || [];
  const answered = dsmAnswers.filter((item) => typeof item?.answer === "boolean");
  const inattentionYesCount = answered.slice(0, 9).filter((item) => item.answer).length;
  const hyperactivityYesCount = answered.slice(9).filter((item) => item.answer).length;
  const contextualYesCount = answered.slice(18).filter((item) => item.answer).length;

  let subtype = "판정 보류";
  if (answered.length >= 18) {
    if (inattentionYesCount >= 6 && hyperactivityYesCount >= 6) {
      subtype = "복합형 가능성";
    } else if (inattentionYesCount >= 6) {
      subtype = "부주의형 가능성";
    } else if (hyperactivityYesCount >= 6) {
      subtype = "과잉행동/충동형 가능성";
    } else {
      subtype = "무증상 범위";
    }
  }

  return {
    answeredCount: answered.length,
    inattentionYesCount,
    hyperactivityYesCount,
    contextualYesCount,
    totalYesCount: answered.filter((item) => item.answer).length,
    subtype
  };
}

function computeAssessmentMetrics(record) {
  const asrsAnswers = getAsrsResponses(record);
  const dsm = analyzeDsmRecord(record);
  const game = record.tests?.game || {};
  const signal = game.tests?.signal_detection || {};
  const goNogo = game.tests?.go_nogo || {};
  const balance = game.tests?.balance_hold || {};

  const asrsAverage = asrsAnswers.length
    ? asrsAnswers.reduce((sum, value) => sum + value, 0) / asrsAnswers.length
    : 0;
  const asrsPositiveCount = asrsAnswers.filter((answer, index) => {
    const threshold = index < 3 ? 2 : 3;
    return answer >= threshold;
  }).length;
  const attentionPositiveCount = asrsAnswers.slice(0, 4).filter((answer, index) => {
    const threshold = index < 3 ? 2 : 3;
    return answer >= threshold;
  }).length;
  const impulsePositiveCount = asrsAnswers.slice(4).filter((answer) => answer >= 3).length;
  const dsmYesCount = dsm.totalYesCount;

  const attention = clamp(92 - attentionPositiveCount * 14 - asrsAverage * 6, 20, 95);
  const executive = clamp(90 - attentionPositiveCount * 15 - asrsAverage * 7, 18, 92);
  const impulse = clamp(88 - impulsePositiveCount * 18 - dsm.hyperactivityYesCount * 7 - dsmYesCount * 2, 20, 90);
  const emotion = clamp(84 - dsmYesCount * 4 - impulsePositiveCount * 8 - asrsAverage * 3, 18, 88);
  const structure = clamp(88 - attentionPositiveCount * 12 - asrsAverage * 6, 20, 90);
  const asrsAttentionScore = asrsAnswers.slice(0, 4).reduce((sum, value) => sum + value, 0);
  const asrsImpulseScore = asrsAnswers.slice(4).reduce((sum, value) => sum + value, 0);
  const omissionRate = Number(
    (signal.omission_rate
      ?? toRatio(signal.omission_errors || 0, signal.target_count || 0))
      .toFixed(2)
  );
  const commissionRate = Number(
    (goNogo.commission_rate
      ?? goNogo.inhibition_failure_rate
      ?? toRatio(goNogo.commission_errors || 0, goNogo.nogo_count || 0))
      .toFixed(2)
  );
  const reactionVariability = Number(signal.reaction_time_variability || 0);
  const tau = Number(signal.tau || 0);
  const latePhaseDrop = Number(signal.late_phase_drop || signal.sustained_attention_drop || 0);
  const fastErrorRate = Number(goNogo.fast_error_rate || 0);
  const meanGoReactionTime = Number(goNogo.mean_go_reaction_time || 0);
  const stableDurationPct = Number(balance.stable_duration_pct || 0);
  const spikeCount = Number(balance.spike_count ?? balance.large_motion_count ?? 0);
  const signalHasDetail = Number.isFinite(Number(signal.target_count))
    || Number.isFinite(Number(signal.hit_count))
    || Number.isFinite(Number(signal.omission_errors));
  const goNogoHasDetail = Number.isFinite(Number(goNogo.go_count))
    || Number.isFinite(Number(goNogo.commission_errors))
    || Number.isFinite(Number(goNogo.premature_response_count));
  const balanceHasDetail = Number.isFinite(Number(balance.stable_duration_pct))
    || Number.isFinite(Number(balance.spike_count))
    || Number.isFinite(Number(balance.large_motion_count));
  const objectiveDomain = omissionRate >= commissionRate ? "부주의" : "충동성";
  const subjectiveDomain = attentionPositiveCount >= impulsePositiveCount ? "부주의" : "충동성";
  const alignment = Math.abs(omissionRate - commissionRate) < 0.12 && attentionPositiveCount === impulsePositiveCount
    ? "혼합"
    : subjectiveDomain === objectiveDomain
      ? "일치"
      : "불일치";
  const dsmImpactScore = dsm.totalYesCount + dsm.contextualYesCount * 2;
  const dailyImpactLevel = Math.max(1, Math.min(5, Math.ceil(dsmImpactScore / 4) || 1));

  const severity = asrsPositiveCount >= 4 || dsm.inattentionYesCount >= 6 || dsm.hyperactivityYesCount >= 6 || dsmYesCount >= 8
    ? "높음"
    : asrsPositiveCount >= 2 || dsmYesCount >= 4
      ? "중간"
      : "낮음";

  return {
    asrsAverage: Number(asrsAverage.toFixed(2)),
    asrsPositiveCount,
    attentionPositiveCount,
    hyperactivityPositiveCount: impulsePositiveCount,
    dsmYesCount,
    dsmInattentionYesCount: dsm.inattentionYesCount,
    dsmHyperactivityYesCount: dsm.hyperactivityYesCount,
    dsmContextualYesCount: dsm.contextualYesCount || 0,
    dsmSubtype: dsm.subtype,
    severity,
    asrsAttentionScore,
    asrsImpulseScore,
    omissionRate,
    commissionRate,
    reactionVariability,
    tau,
    latePhaseDrop,
    fastErrorRate,
    meanGoReactionTime,
    stableDurationPct,
    spikeCount,
    subjectiveDomain,
    objectiveDomain,
    alignment,
    dailyImpactLevel,
    signalHasDetail,
    goNogoHasDetail,
    balanceHasDetail,
    signal,
    goNogo,
    balance,
    scores: {
      attention,
      executive,
      impulse,
      emotion,
      structure
    }
  };
}

function buildProfileBadges(metrics) {
  const badges = [];

  if (metrics.asrsAttentionScore >= 10 || metrics.omissionRate >= 0.2) {
    badges.push("#주의력충전필요");
  }
  if (metrics.asrsImpulseScore >= 5 || metrics.commissionRate >= 0.2) {
    badges.push("#반응속도조절중");
  }
  if (metrics.reactionVariability >= 180 || metrics.tau >= 250) {
    badges.push("#집중변동체크");
  }
  if (metrics.scores.executive >= 65) {
    badges.push("#구조화하면강해요");
  }
  if (metrics.scores.attention >= 60 && metrics.reactionVariability < 180 && metrics.commissionRate < 0.2) {
    badges.push("#몰입잠재력있음");
  }
  if (!badges.length) {
    badges.push("#기본안정패턴");
  }

  return badges.slice(0, 3);
}

function buildAlignmentLabel(alignment) {
  if (alignment === "일치") {
    return "주관-객관 결과가 비슷해요";
  }
  if (alignment === "불일치") {
    return "느낌과 측정값이 조금 달라요";
  }
  return "두 신호가 함께 섞여 보여요";
}

function buildDailyImpactLabel(level) {
  const labels = {
    1: "가벼운 피로",
    2: "조금 누적된 피로",
    3: "중간 수준의 부담",
    4: "지속적 소모가 큰 편",
    5: "상당한 에너지 소모"
  };
  return labels[level] || labels[3];
}

function determinePlanTendency(metrics) {
  const inattentionSignals = [
    metrics.asrsAttentionScore >= 10,
    metrics.dsmInattentionYesCount >= 6,
    metrics.omissionRate >= 0.18,
    metrics.reactionVariability >= 180,
    metrics.tau >= 250,
    metrics.latePhaseDrop >= 0.15
  ].filter(Boolean).length;
  const impulsivitySignals = [
    metrics.asrsImpulseScore >= 5,
    metrics.dsmHyperactivityYesCount >= 6,
    metrics.commissionRate >= 0.18,
    metrics.fastErrorRate >= 0.12,
    metrics.spikeCount >= 4,
    metrics.stableDurationPct > 0 && metrics.stableDurationPct < 60
  ].filter(Boolean).length;

  if (metrics.severity === "낮음" && inattentionSignals === 0 && impulsivitySignals === 0) {
    return "very_low";
  }
  if (inattentionSignals >= 2 && impulsivitySignals >= 2) {
    return "combined";
  }
  if (impulsivitySignals > inattentionSignals) {
    return "impulsivity";
  }
  if (inattentionSignals > impulsivitySignals) {
    return "inattention";
  }
  if (metrics.dsmSubtype === "복합형") {
    return "combined";
  }
  return metrics.subjectiveDomain === "충동성" || metrics.objectiveDomain === "충동성"
    ? "impulsivity"
    : "inattention";
}

function buildPlanForMetrics(metrics) {
  const tendency = determinePlanTendency(metrics);
  const plans = {
    inattention: {
      suggestions: [
        "아침에 책상에 앉자마자 오늘 할 일을 A(필수), B(선택)로 나누어 딱 3가지만 포스트잇에 적고 모니터 옆에 붙이세요.",
        "집중이 필요한 작업을 시작하기 직전, 스마트폰을 뒤집어 다른 방에 두거나 보이지 않는 서랍 안에 넣으세요.",
        "업무 중 딴생각이 나면 즉시 행동하지 말고, 책상 위 생각 노트에 단어 하나만 적어둔 뒤 바로 하던 일로 시선을 돌리세요."
      ],
      openingMessage: "생활 패턴이나 업무 환경에 맞춰 계획을 더 현실적으로 바꿀 수 있어요. 주로 집중력이 가장 많이 떨어지는 시간대나 일하는 장소를 알려 주세요."
    },
    impulsivity: {
      suggestions: [
        "불안하거나 충동적인 행동을 하고 싶어질 때 즉각 반응하지 말고, 제자리에 서서 3번 크게 심호흡하세요.",
        "충동적인 결정을 내리기 직전, 스마트폰 메모장을 열어 머릿속을 스쳐 지나간 자동적인 생각을 한 줄로 적어보세요.",
        "매일 저녁 5분 동안 다이어리를 펴고, 오늘 하루 겪었던 감정 기복과 충동적인 행동을 한 줄씩 기록하며 점검하세요."
      ],
      openingMessage: "지금 제안이 너무 답답하거나 일상에 안 맞으면, 가장 참기 힘든 충동이 일어나는 상황에 맞춰 다시 조정해 드릴게요."
    },
    combined: {
      suggestions: [
        "일과를 시작하기 전, 가장 중요한 과제 1개를 골라 15분 안에 끝낼 수 있는 아주 작은 행동 단위 3가지로 쪼개어 적으세요.",
        "작업 중 다른 일을 하고 싶은 충동이 들 때 즉각 일어서지 말고, 제자리에서 3번 심호흡한 뒤 책상 옆 메모장에 그 충동을 단어로 짧게 적고 하던 일로 돌아가세요.",
        "잠들기 전 침대에서 5분 동안, 오늘 일을 미루게 한 생각 옆에 내일 바로 할 수 있는 현실적인 행동 문장 1개를 적으며 하루를 마무리하세요."
      ],
      openingMessage: "지금 제안한 행동 단위가 너무 부담스럽거나 안 맞으면, 시간이나 실제 생활 패턴에 맞게 계획을 다시 조정해 드릴게요."
    },
    very_low: {
      suggestions: [
        "하루를 시작할 때 오늘 꼭 지키고 싶은 작은 루틴 1개를 정하고, 끝나면 달력에 짧게 표시하세요.",
        "집중이 잘 되는 시간대를 하루에 한 번만 기록해서, 중요한 일은 가능한 그 시간 앞쪽에 배치하세요.",
        "잠들기 전 3분 동안 오늘 잘 유지한 행동 1개와 내일 반복할 행동 1개를 메모장에 적어두세요."
      ],
      openingMessage: "현재 결과가 비교적 안정적으로 보여도 수면, 피로, 일정 변화에 따라 체감은 달라질 수 있어요. 유지하고 싶은 생활 루틴이나 흔들리는 상황을 알려 주면 더 맞게 조정해 드릴게요."
    }
  };

  return plans[tendency] || plans.inattention;
}

function buildDeterministicReport(metrics) {
  const badges = buildProfileBadges(metrics);
  const plan = buildPlanForMetrics(metrics);
  const heroSummary = metrics.severity === "높음"
    ? "설문과 반응성 검사에서 목표를 놓치거나 멈춰야 할 때 반응하는 패턴이 함께 보여요. 다만 이는 진단이 아니라 현재 반응 경향을 정리한 선별 결과예요."
    : metrics.severity === "중간"
      ? "몇몇 상황에서 집중 유지나 멈추는 조절이 흔들릴 수 있는 신호가 보여요. 생활 맥락과 함께 보면 더 정확한 이해에 도움이 됩니다."
      : "현재 선별 결과만 보면 전반적 반응 패턴은 비교적 안정적으로 보여요. 그래도 피로, 수면, 환경 변화에 따라 체감은 달라질 수 있어요.";
  const subjectiveText = metrics.subjectiveDomain === "부주의"
    ? `자가보고 선별에서는 부주의 쪽 신호가 조금 더 두드러졌어요. 특히 시작 지연이나 마감 직전까지 집중을 붙잡는 과정에서 부담이 있을 수 있어요.`
    : `자가보고 선별에서는 충동성 또는 빠른 반응 쪽 신호가 조금 더 강조됐어요. 기다리기 어렵거나 반응을 먼저 내보내는 순간이 있을 수 있어요.`;
  const objectiveText = metrics.signalHasDetail || metrics.goNogoHasDetail
    ? [
      metrics.signalHasDetail
        ? `신호 찾기에서는 목표 놓침 비율 ${formatPercent(metrics.omissionRate)}, 반응시간 변동성 ${reactionVariabilityOrZero(metrics)}ms, 느리게 처지는 반응 폭 ${Number(metrics.tau || 0)}ms 수준이었어요.`
        : `신호 찾기 점수는 ${Number(metrics.signal.score || 0)}점이었어요.`,
      metrics.goNogoHasDetail
        ? `Go/No-Go에서는 잘못된 반응 비율 ${formatPercent(metrics.commissionRate)}, 성급 반응 비율 ${formatPercent(metrics.fastErrorRate)}로 기록됐어요.`
        : `Go/No-Go 점수는 ${Number(metrics.goNogo.score || 0)}점이었어요.`
    ].join(" ")
    : metrics.objectiveDomain === "부주의"
      ? `반응성 테스트에서는 부주의 쪽 점수가 상대적으로 더 낮게 나타났어요. 순간 집중의 일관성을 확인해 볼 필요가 있어요.`
      : `반응성 테스트에서는 충동성보다 멈추는 조절은 비교적 안정적이었어요.`;
  const alignmentSummary = metrics.alignment === "일치"
    ? "스스로 느끼는 어려움과 측정된 반응 패턴이 비슷한 방향을 보여줘요."
    : metrics.alignment === "불일치"
      ? "평소 체감과 검사 상황의 반응이 다르게 나타났어요. 환경, 긴장도, 과제 유형 차이의 영향을 함께 볼 필요가 있어요."
      : "부주의와 충동성 신호가 함께 섞여 보여서 한쪽으로 단정하기보다 상황별 차이를 함께 보는 편이 좋아요.";
  const inattentionSummary = metrics.signalHasDetail
    ? `부주의 영역에서는 자가보고 부주의 점수 ${metrics.asrsAttentionScore}/16과 함께 목표 놓침 비율 ${formatPercent(metrics.omissionRate)}, 반응시간 변동성 ${reactionVariabilityOrZero(metrics)}ms, 후반부 정확도 저하 ${formatPercent(metrics.latePhaseDrop)}를 함께 보고 있어요. 저장된 수치만 보면 ${metrics.omissionRate >= 0.18 || metrics.reactionVariability >= 180 || metrics.tau >= 250 ? "집중 유지의 일관성을 점검할 필요가 있어 보여요." : "객관 지표는 비교적 안정적이지만 체감 부담은 높을 수 있어요."}`
    : `부주의 영역에서는 자가보고 부주의 점수 ${metrics.asrsAttentionScore}/16과 신호 찾기 점수 ${Number(metrics.signal.score || 0)}점을 함께 참고하고 있어요. 현재 JSON에는 세부 오류 수치가 없어 점수 수준 중심으로 해석하고 있어요.`;
  const impulsivitySummary = metrics.goNogoHasDetail
    ? `충동성 영역에서는 자가보고 충동성 점수 ${metrics.asrsImpulseScore}/8과 함께 잘못된 반응 비율 ${formatPercent(metrics.commissionRate)}, 성급 반응 비율 ${formatPercent(metrics.fastErrorRate)}가 저장돼 있어요. 저장된 수치만 보면 ${metrics.commissionRate >= 0.18 ? "속도보다 멈추는 조절을 더 신경 쓸 필요가 있어 보여요." : "억제 조절은 비교적 안정적으로 보입니다."}`
    : `충동성 영역에서는 자가보고 충동성 점수 ${metrics.asrsImpulseScore}/8과 Go/No-Go 점수 ${Number(metrics.goNogo.score || 0)}점을 함께 보고 있어요. 현재 JSON에는 세부 오류 수치가 없어 점수 수준 중심으로 해석하고 있어요.`;
  const hyperactivitySummary = metrics.balanceHasDetail
    ? `균형 유지 테스트에서는 안정 유지 시간 ${roundTo(metrics.stableDurationPct, 1)}%, 큰 흔들림 ${Number(metrics.spikeCount || 0)}회로 기록됐어요. 이 영역은 보조 참고 정보로만 활용하는 것이 적절해요.`
    : "";
  const empathy = metrics.dailyImpactLevel >= 4
    ? "이 정도 패턴이면 일상에서 해야 할 일을 따라가는 것만으로도 꽤 많은 에너지가 들었을 수 있어요. 스스로를 탓하기보다 부담이 커지는 상황을 먼저 알아차리는 것이 중요해요."
    : metrics.dailyImpactLevel >= 3
      ? "일상에서는 집중 유지와 감정 소모가 번갈아 부담으로 느껴졌을 수 있어요. 잘 안 되는 날이 반복됐다면 의지 부족보다 환경과 피로의 영향을 함께 보는 편이 더 정확해요."
      : "현재 결과만 보면 일상 부담은 아주 높게 보이지 않지만, 특정 일정이나 관계 맥락에서는 체감이 달라질 수 있어요. 무리가 시작되는 조건을 미리 파악해 두면 도움이 됩니다.";

  return {
    report: {
      severity: metrics.severity,
      scores: metrics.scores,
      sections: {
        summary: heroSummary,
        strength: "구조를 만들면 수행이 안정될 여지가 보이고, 관심이 생기는 과제에서는 몰입이 보호 요인으로 작동할 수 있어요.",
        watchout: "선별 결과만으로 단정할 수는 없고 수면, 스트레스, 불안·우울 같은 다른 요인도 함께 살펴봐야 해요."
      },
      hero: {
        badges,
        summary: heroSummary
      },
      crossCheck: {
        subjectiveTitle: `주관적 보고는 ${metrics.subjectiveDomain} 쪽이 더 크게 느껴져요`,
        subjectiveText,
        objectiveTitle: `객관적 반응은 ${metrics.objectiveDomain} 신호가 더 보여요`,
        objectiveText,
        alignmentLabel: buildAlignmentLabel(metrics.alignment),
        alignmentSummary
      },
      profile: {
        inattentionSummary,
        impulsivitySummary,
        hyperactivitySummary
      },
      dailyImpact: {
        level: metrics.dailyImpactLevel,
        label: buildDailyImpactLabel(metrics.dailyImpactLevel),
        empathy
      },
      bridge: {
        cta: "나만의 맞춤 훈련 설계하기"
      }
    },
    plan
  };
}

function reactionVariabilityOrZero(metrics) {
  return Number(metrics.signal?.reaction_time_variability || 0);
}

async function callGeminiJson({ systemInstruction, prompt, schemaHint }) {
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY is missing. Add it to .env and restart the server.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": geminiApiKey
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: `${prompt}\n\nReturn JSON only.\n${schemaHint}` }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${errorText}`);
  }

  const payload = await response.json();
  const text = extractGeminiText(payload);
  return parseJsonLoose(text);
}

function extractGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((part) => part.text || "").join("").trim();
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }
  return text;
}

function parseJsonLoose(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```([\s\S]*?)```/i);
    if (fenced) {
      return JSON.parse(fenced[1].trim());
    }
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw error;
  }
}

function buildInsightsPrompt(record, metrics) {
  return [
    "서비스: ADHDQQ.COM ADHD 선별/감별 보조 모바일 웹 앱",
    "중요: 진단 확정 표현 금지, 선별 결과와 권고 수준으로 작성",
    "어조: 따뜻하고 전문적인 임상심리사처럼, 부드러운 경어체 한국어 사용",
    "표현 지침: '목표 놓침(부주의)', '잘못된 반응(충동성)'처럼 쉬운 말로 설명",
    "교차 분석 지침: 사용자가 느끼는 결과(자가보고 선별)와 게임 기반 객관 지표(반응성 테스트)가 일치하는지 분명히 짚기",
    "수치 사용 지침: JSON에 실제 존재하는 숫자만 인용하고, 없는 오류 횟수나 반응시간은 추정해서 쓰지 말 것",
    "자가보고 선별 판정 기준:",
    "- 1, 2, 3번 문항은 가끔(2) 이상이면 유의미한 증상",
    "- 4, 5, 6번 문항은 자주(3) 이상이면 유의미한 증상",
    "- 유의미한 문항이 4개 이상이면 성인 ADHD 가능성이 비교적 높은 편으로 해석",
    "- 주의력 결핍 관련 문항: 1, 2, 3, 4번",
    "- 과잉행동/충동성 관련 문항: 5, 6번",
    "증상 기준 체크 판정 기준:",
    "- 총 18문항, 부주의 9문항과 과잉행동/충동성 9문항으로 구성",
    "- 부주의 6개 이상 Yes, 과잉행동/충동성 6개 미만 Yes면 부주의형 가능성",
    "- 과잉행동/충동성 6개 이상 Yes, 부주의 6개 미만 Yes면 과잉행동/충동형 가능성",
    "- 두 영역 모두 6개 이상 Yes면 복합형 가능성",
    "- 본 결과는 진단이 아니라 참고용 선별 결과로만 설명",
    "실행계획 작성 기준:",
    "- 대상은 성인 사용자로 가정하고, 아동/청소년용 표현이나 보호자 지시는 쓰지 말 것",
    "- plan.suggestions는 반드시 3개만 작성",
    "- 각 제안은 시간 또는 타이밍, 장소, 하나의 구체적 행동 단위가 드러나야 함",
    "- 의료적 처방, 진단, 치료 지시처럼 쓰지 말고 일상 코칭 언어로 작성",
    "- 부주의 경향이 두드러지면 과제 분할, 시각적 단서, 환경 통제, 시작 장벽 낮추기 전략을 사용",
    "- 과잉행동/충동성 경향이 두드러지면 지연 행동, 자기 점검, 심호흡, 행동 전 메모 전략을 사용",
    "- 복합형이면 부주의 보완 전략과 충동 조절 전략을 섞어서 제안",
    "- 낮음 또는 안정 범위이면 현재 상태를 유지하는 작고 반복 가능한 생활 루틴을 제안",
    "- '인지행동치료', '작업 기억력', 'MBSR' 같은 학술 용어는 사용자 문장에 직접 쓰지 말고 쉬운 말로 풀어 쓸 것",
    "대상 기록 JSON:",
    JSON.stringify(record, null, 2),
    "계산된 핵심 지표:",
    JSON.stringify(metrics, null, 2),
    "요청:",
    "1. report.severity는 낮음/중간/높음 중 하나",
    "2. report.hero.badges는 짧은 해시태그 2~3개",
    "3. report.hero.summary는 전체 결과를 아우르는 1~2문장 핵심 요약",
    "4. report.crossCheck.subjectiveTitle, subjectiveText는 자가보고 선별 기준의 체감 증상 설명",
    "5. report.crossCheck.objectiveTitle, objectiveText는 반응성 테스트 기준의 객관 반응 설명",
    "6. report.crossCheck.alignmentLabel은 일치 여부를 보여주는 짧은 뱃지 문구",
    "7. report.crossCheck.alignmentSummary는 두 결과의 일치/불일치를 해석하는 1~2문장",
    "8. report.profile.inattentionSummary는 자가보고 부주의 점수와 목표 놓침/반응시간 변동성 지표를 종합한 설명",
    "9. report.profile.impulsivitySummary는 자가보고 충동성 점수와 잘못된 반응 지표를 종합한 설명",
    "10. report.dailyImpact.empathy는 증상 기준 체크 결과를 바탕으로 한 일상 피로도 공감 메시지",
    "11. report.sections.strength는 보호 요인과 강점 신호",
    "12. report.sections.watchout는 선별 도구 한계와 추가 평가 필요성",
    "13. plan.suggestions는 위 실행계획 기준을 지킨 한국어 문장 3개",
    "14. plan.openingMessage는 사용자가 생활 패턴에 맞춰 계획 수정을 요청할 수 있게 유도하는 1~2문장"
  ].join("\n");
}

function buildChatPrompt(record, message, metrics) {
  return [
    "서비스: ADHDQQ.COM ADHD 선별/감별 보조 모바일 웹 앱",
    "역할: 성인 ADHD 선별 결과와 현재 실행계획을 바탕으로 사용자의 계획을 현실적으로 조정하는 한국어 행동 코치",
    "중요: 진단 확정 표현 금지, 의료행위처럼 말하지 말 것",
    "응답 기준:",
    "- 사용자의 실제 생활 조건에 맞춰 시간, 장소, 행동 단위를 더 작게 조정",
    "- 한 번에 여러 행동을 시키지 말고 가장 작은 다음 행동 1개를 우선 제안",
    "- 부주의 경향은 과제 분할, 시각적 단서, 환경 통제 중심으로 조정",
    "- 충동성 경향은 지연 행동, 자기 점검, 심호흡, 행동 전 메모 중심으로 조정",
    "현재 기록:",
    JSON.stringify(record, null, 2),
    "계산된 핵심 지표:",
    JSON.stringify(metrics, null, 2),
    "사용자 메시지:",
    message,
    "요청:",
    "reply는 사용자의 요청을 반영한 짧고 구체적인 답변 2~4문장",
    "additionalSuggestion은 선택값이며, 꼭 필요할 때만 한 문장으로 제안"
  ].join("\n");
}

function buildAsrsAnalysisPrompt(record, analysis, metrics) {
  return [
    "서비스: ADHDQQ.COM ADHD 선별/감별 보조 모바일 웹 앱",
    "역할: 자가보고 선별 결과를 짧고 공감적으로 해석하는 한국어 선별 보조 AI",
    "중요: 진단 확정 표현 금지, 선별 결과와 추가 평가 권고 수준으로만 작성",
    "자가보고 선별 기준:",
    "- 1, 2, 3번 문항은 가끔(2) 이상이면 유의미",
    "- 4, 5, 6번 문항은 자주(3) 이상이면 유의미",
    "- 유의미 문항 4개 이상이면 추가 평가를 적극 고려할 수 있는 수준",
    "기록 JSON:",
    JSON.stringify(record, null, 2),
    "계산된 자가보고 선별 해석용 지표:",
    JSON.stringify(analysis, null, 2),
    "보조 점수:",
    JSON.stringify(metrics, null, 2),
    "요청:",
    "1. summary는 전체 경향을 2문장 이내로 요약",
    "2. attention는 주의력 결핍 관련 강도를 2문장 이내로 설명",
    "3. hyperactivity는 과잉행동/충동성 관련 강도를 2문장 이내로 설명",
    "4. guidance는 선별 도구 한계와 다음 단계 권고를 2문장 이내로 설명",
    "5. 한국어로만 작성"
  ].join("\n");
}

function buildDsmAnalysisPrompt(record, analysis, metrics) {
  return [
    "서비스: ADHDQQ.COM ADHD 선별/감별 보조 모바일 웹 앱",
    "역할: 증상 기준 체크 결과를 짧고 공감적으로 해석하는 한국어 선별 보조 AI",
    "중요: 진단 확정 표현 금지, 선별 결과와 추가 평가 권고 수준으로만 작성",
    "증상 기준 체크 판정 기준:",
    "- 부주의 9문항 중 6개 이상 Yes면 부주의형 가능성",
    "- 과잉행동/충동성 9문항 중 6개 이상 Yes면 과잉행동/충동형 가능성",
    "- 두 영역이 모두 6개 이상 Yes면 복합형 가능성",
    "- 두 영역 모두 6개 미만 Yes면 무증상 범위로 설명",
    "- 본 결과는 진단이 아니라 현재 상태를 참고하기 위한 것입니다.",
    "기록 JSON:",
    JSON.stringify(record, null, 2),
    "계산된 증상 기준 체크 해석용 지표:",
    JSON.stringify(analysis, null, 2),
    "보조 점수:",
    JSON.stringify(metrics, null, 2),
    "요청:",
    "1. summary는 전체 경향을 2문장 이내로 요약",
    "2. subtype는 현재 분류를 공감적으로 2문장 이내로 설명",
    "3. inattention는 부주의 영역 해석을 2문장 이내로 설명",
    "4. hyperactivity는 과잉행동/충동성 영역 해석을 2문장 이내로 설명",
    "5. guidance는 선별 도구 한계와 다음 단계 권고를 2문장 이내로 설명",
    "6. 한국어로만 작성"
  ].join("\n");
}

async function generateInsights(record) {
  const metrics = computeAssessmentMetrics(record);
  const deterministic = buildDeterministicReport(metrics);
  let payload = {};

  if (geminiApiKey) {
    payload = await callGeminiJson({
      systemInstruction: "You are a warm, professional, non-diagnostic Korean ADHD screening assistant. Return concise Korean JSON only.",
      prompt: buildInsightsPrompt(record, metrics),
      schemaHint: [
        "Schema:",
        "{",
        '  "report": {',
        '    "severity": "낮음|중간|높음",',
        '    "hero": {',
        '      "badges": ["string", "string"],',
        '      "summary": "string"',
        "    },",
        '    "crossCheck": {',
        '      "subjectiveTitle": "string",',
        '      "subjectiveText": "string",',
        '      "objectiveTitle": "string",',
        '      "objectiveText": "string",',
        '      "alignmentLabel": "string",',
        '      "alignmentSummary": "string"',
        "    },",
        '    "profile": {',
        '      "inattentionSummary": "string",',
        '      "impulsivitySummary": "string"',
        "    },",
        '    "dailyImpact": {',
        '      "empathy": "string"',
        "    },",
        '    "sections": {',
        '      "strength": "string",',
        '      "watchout": "string"',
        "    }",
        "  },",
        '  "plan": {',
        '    "suggestions": ["string", "string", "string"],',
        '    "openingMessage": "string"',
        "  }",
        "}"
      ].join("\n")
    });
  }

  return {
    report: {
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      severity: deterministic.report.severity,
      scores: metrics.scores,
      sections: {
        summary: deterministic.report.sections.summary,
        strength: deterministic.report.sections.strength,
        watchout: deterministic.report.sections.watchout
      },
      hero: {
        badges: deterministic.report.hero.badges,
        summary: deterministic.report.hero.summary
      },
      crossCheck: {
        subjectiveTitle: deterministic.report.crossCheck.subjectiveTitle,
        subjectiveText: deterministic.report.crossCheck.subjectiveText,
        objectiveTitle: deterministic.report.crossCheck.objectiveTitle,
        objectiveText: deterministic.report.crossCheck.objectiveText,
        alignmentLabel: deterministic.report.crossCheck.alignmentLabel,
        alignmentSummary: deterministic.report.crossCheck.alignmentSummary
      },
      profile: {
        inattentionSummary: deterministic.report.profile.inattentionSummary,
        impulsivitySummary: deterministic.report.profile.impulsivitySummary
      },
      dailyImpact: {
        level: metrics.dailyImpactLevel,
        label: buildDailyImpactLabel(metrics.dailyImpactLevel),
        empathy: deterministic.report.dailyImpact.empathy
      },
      bridge: deterministic.report.bridge
    },
    plan: {
      suggestions: Array.isArray(payload.plan?.suggestions) && payload.plan.suggestions.length
        ? payload.plan.suggestions.slice(0, 3)
        : deterministic.plan.suggestions,
      chat: [
        {
          role: "assistant",
          text: payload.plan?.openingMessage || deterministic.plan.openingMessage
        }
      ]
    }
  };
}

async function generateChatReply(record, message) {
  const metrics = computeAssessmentMetrics(record);
  const payload = await callGeminiJson({
    systemInstruction: "You are a concise Korean AI coach for an ADHD screening support app. Return JSON only.",
    prompt: buildChatPrompt(record, message, metrics),
    schemaHint: [
      "Schema:",
      "{",
      '  "reply": "string",',
      '  "additionalSuggestion": "string or empty string"',
      "}"
    ].join("\n")
  });

  return {
    reply: payload.reply || "요청 내용을 반영해 시작 장벽을 낮추는 쪽으로 계획을 조정해 보겠습니다.",
    additionalSuggestion: payload.additionalSuggestion || ""
  };
}

async function generateAsrsAnalysis(record, analysis) {
  const metrics = computeAssessmentMetrics(record);
  const payload = await callGeminiJson({
    systemInstruction: "You are a concise Korean assistant for interpreting self-report screening results. Return JSON only.",
    prompt: buildAsrsAnalysisPrompt(record, analysis, metrics),
    schemaHint: [
      "Schema:",
      "{",
      '  "summary": "string",',
      '  "attention": "string",',
      '  "hyperactivity": "string",',
      '  "guidance": "string"',
      "}"
    ].join("\n")
  });

  return {
    summary: payload.summary || "자가보고 응답에서 현재 주의집중 관련 어려움의 강도를 함께 살펴볼 필요가 있습니다.",
    attention: payload.attention || "주의력 결핍 관련 응답 강도를 기준으로 일상 집중 유지와 시작 지연 패턴을 확인할 수 있습니다.",
    hyperactivity: payload.hyperactivity || "과잉행동·충동성 관련 응답 강도를 기준으로 몸의 안절부절함이나 끼어들기 양상을 참고할 수 있습니다.",
    guidance: payload.guidance || "이 검사는 선별 도구이므로 어려움이 지속되면 추가 평가와 상담을 고려하는 것이 좋습니다."
  };
}

async function generateDsmAnalysis(record, analysis) {
  const metrics = computeAssessmentMetrics(record);
  const payload = await callGeminiJson({
    systemInstruction: "You are a concise Korean assistant for interpreting symptom checklist results. Return JSON only.",
    prompt: buildDsmAnalysisPrompt(record, analysis, metrics),
    schemaHint: [
      "Schema:",
      "{",
      '  "summary": "string",',
      '  "subtype": "string",',
      '  "inattention": "string",',
      '  "hyperactivity": "string",',
      '  "guidance": "string"',
      "}"
    ].join("\n")
  });

  return {
    summary: payload.summary || "증상 기준 체크 응답에서는 현재 부주의와 과잉행동·충동성 신호 분포를 함께 살펴볼 필요가 있습니다.",
    subtype: payload.subtype || `현재 응답은 ${analysis.subtype || "판정 보류"}로 정리됩니다.`,
    inattention: payload.inattention || `부주의 문항은 ${analysis.inattentionYes || 0} / 9개 Yes로 집계되었습니다.`,
    hyperactivity: payload.hyperactivity || `과잉행동·충동성 문항은 ${analysis.hyperactivityYes || 0} / 9개 Yes로 집계되었습니다.`,
    guidance: payload.guidance || "본 결과는 진단이 아니라 참고용 선별 결과이므로 어려움이 지속되면 추가 평가를 고려하는 것이 좋습니다."
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;

  try {
    if (req.method === "GET" && pathname.startsWith("/api/config/")) {
      const fileName = pathname.replace("/api/config/", "");
      const filePath = safeJoin(configDir, fileName);
      const raw = fs.readFileSync(filePath, "utf-8");
      sendJson(res, 200, JSON.parse(raw));
      return;
    }

    if (req.method === "GET" && pathname === "/api/records") {
      const files = fs.readdirSync(databaseDir).filter((file) => file.endsWith(".json"));
      const records = files.map(getRecordMeta).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      sendJson(res, 200, records);
      return;
    }

    if (req.method === "GET" && pathname === "/api/ai/status") {
      sendJson(res, 200, {
        configured: Boolean(geminiApiKey),
        model: geminiModel
      });
      return;
    }

    if (req.method === "GET" && pathname.startsWith("/api/records/")) {
      const fileName = pathname.replace("/api/records/", "");
      const filePath = safeJoin(databaseDir, fileName);
      const raw = fs.readFileSync(filePath, "utf-8");
      sendJson(res, 200, JSON.parse(raw));
      return;
    }

    if (req.method === "POST" && pathname === "/api/records") {
      const body = await readBody(req);
      const payload = JSON.parse(body || "{}");

      if (!payload.fileName || !payload.data) {
        sendJson(res, 400, { error: "fileName and data are required" });
        return;
      }

      const filePath = safeJoin(databaseDir, payload.fileName);
      fs.writeFileSync(filePath, JSON.stringify(payload.data, null, 2));
      sendJson(res, 200, { ok: true, fileName: payload.fileName });
      return;
    }

    if (req.method === "POST" && pathname === "/api/ai/insights") {
      const body = await readBody(req);
      const payload = JSON.parse(body || "{}");

      if (!payload.record) {
        sendJson(res, 400, { error: "record is required" });
        return;
      }

      const insights = await generateInsights(payload.record);
      sendJson(res, 200, insights);
      return;
    }

    if (req.method === "POST" && pathname === "/api/ai/chat") {
      const body = await readBody(req);
      const payload = JSON.parse(body || "{}");

      if (!payload.record || !payload.message) {
        sendJson(res, 400, { error: "record and message are required" });
        return;
      }

      const reply = await generateChatReply(payload.record, String(payload.message));
      sendJson(res, 200, reply);
      return;
    }

    if (req.method === "POST" && pathname === "/api/ai/asrs-analysis") {
      const body = await readBody(req);
      const payload = JSON.parse(body || "{}");

      if (!payload.record || !payload.analysis) {
        sendJson(res, 400, { error: "record and analysis are required" });
        return;
      }

      const analysis = await generateAsrsAnalysis(payload.record, payload.analysis);
      sendJson(res, 200, analysis);
      return;
    }

    if (req.method === "POST" && pathname === "/api/ai/dsm-analysis") {
      const body = await readBody(req);
      const payload = JSON.parse(body || "{}");

      if (!payload.record || !payload.analysis) {
        sendJson(res, 400, { error: "record and analysis are required" });
        return;
      }

      const analysis = await generateDsmAnalysis(payload.record, payload.analysis);
      sendJson(res, 200, analysis);
      return;
    }

    serveStatic(pathname, res);
  } catch (error) {
    const status = error.code === "ENOENT" ? 404 : 500;
    sendJson(res, status, { error: error.message });
  }
});

const port = process.env.PORT || 3333;
const host = process.env.HOST || "127.0.0.1";
server.listen(port, host, () => {
  console.log(`ADHDQQ.COM app listening on http://${host}:${port}`);
});
