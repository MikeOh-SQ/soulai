const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

loadEnvFile(path.join(__dirname, ".env"));

const rootDir = __dirname;
const publicDir = path.join(rootDir, "public");
const imagesDir = path.join(rootDir, "images");
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
  const baseDir = reqPath.startsWith("/images/") ? imagesDir : publicDir;
  const relativePath = reqPath === "/"
    ? "index.html"
    : reqPath.startsWith("/images/")
      ? reqPath.replace("/images/", "")
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
  res.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream"
  });
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

function getAsrsResponses(record) {
  return record.tests?.asrs || record.tests?.asar || [];
}

function computeAssessmentMetrics(record) {
  const asrsAnswers = getAsrsResponses(record)
    .map((item) => Number(item.answer))
    .filter((value) => Number.isFinite(value));
  const dsmAnswers = (record.tests?.dsm5 || [])
    .map((item) => Boolean(item.answer));

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
  const dsmYesCount = dsmAnswers.filter(Boolean).length;

  const attention = clamp(92 - attentionPositiveCount * 14 - asrsAverage * 6, 20, 95);
  const executive = clamp(90 - attentionPositiveCount * 15 - asrsAverage * 7, 18, 92);
  const impulse = clamp(88 - impulsePositiveCount * 18 - dsmYesCount * 5, 20, 90);
  const emotion = clamp(84 - dsmYesCount * 5 - impulsePositiveCount * 8 - asrsAverage * 3, 18, 88);
  const structure = clamp(88 - attentionPositiveCount * 12 - asrsAverage * 6, 20, 90);

  const severity = asrsPositiveCount >= 4 || dsmYesCount >= 5
    ? "높음"
    : asrsPositiveCount >= 2 || dsmYesCount >= 3
      ? "중간"
      : "낮음";

  return {
    asrsAverage: Number(asrsAverage.toFixed(2)),
    asrsPositiveCount,
    attentionPositiveCount,
    hyperactivityPositiveCount: impulsePositiveCount,
    dsmYesCount,
    severity,
    scores: {
      attention,
      executive,
      impulse,
      emotion,
      structure
    }
  };
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
    "서비스: soul.ai.kr ADHD 선별/감별 보조 모바일 웹 앱",
    "중요: 진단 확정 표현 금지, 선별 결과와 권고 수준으로 작성",
    "ASRS Part A 판정 기준:",
    "- 1, 2, 3번 문항은 가끔(2) 이상이면 유의미한 증상",
    "- 4, 5, 6번 문항은 자주(3) 이상이면 유의미한 증상",
    "- 유의미한 문항이 4개 이상이면 성인 ADHD 가능성이 비교적 높은 편으로 해석",
    "- 주의력 결핍 관련 문항: 1, 2, 3, 4번",
    "- 과잉행동/충동성 관련 문항: 5, 6번",
    "대상 기록 JSON:",
    JSON.stringify(record, null, 2),
    "계산된 핵심 지표:",
    JSON.stringify(metrics, null, 2),
    "요청:",
    "1. report.severity는 낮음/중간/높음 중 하나",
    "2. report.sections.summary는 주의력 결핍과 과잉행동/충동성 경향을 자연스러운 한국어 2문장 이내로 요약",
    "3. report.sections.strength는 정상화 메시지와 보호 요인을 담은 2문장 이내",
    "4. report.sections.watchout는 선별 도구 한계와 추가 평가 필요성을 포함한 2문장 이내",
    "5. plan.suggestions는 CBT/실행기능 보완 전략 기반 한국어 문장 3개, 각각 구체적이고 실행 가능하게 작성",
    "6. plan.openingMessage는 사용자가 생활 패턴에 맞춰 계획 수정을 요청할 수 있게 유도하는 1~2문장"
  ].join("\n");
}

function buildChatPrompt(record, message) {
  return [
    "서비스: soul.ai.kr ADHD 선별/감별 보조 모바일 웹 앱",
    "역할: ASRS Part A 결과를 바탕으로 사용자의 기존 계획을 현실적으로 조정하는 한국어 AI 코치",
    "중요: 진단 확정 표현 금지, 의료행위처럼 말하지 말 것",
    "현재 기록:",
    JSON.stringify(record, null, 2),
    "사용자 메시지:",
    message,
    "요청:",
    "reply는 사용자의 요청을 반영한 짧고 구체적인 답변 2~4문장",
    "additionalSuggestion은 선택값이며, 꼭 필요할 때만 한 문장으로 제안"
  ].join("\n");
}

function buildAsrsAnalysisPrompt(record, analysis, metrics) {
  return [
    "서비스: soul.ai.kr ADHD 선별/감별 보조 모바일 웹 앱",
    "역할: ASRS 결과를 짧고 공감적으로 해석하는 한국어 선별 보조 AI",
    "중요: 진단 확정 표현 금지, 선별 결과와 추가 평가 권고 수준으로만 작성",
    "ASRS 기준:",
    "- 1, 2, 3번 문항은 가끔(2) 이상이면 유의미",
    "- 4, 5, 6번 문항은 자주(3) 이상이면 유의미",
    "- 유의미 문항 4개 이상이면 추가 평가를 적극 고려할 수 있는 수준",
    "기록 JSON:",
    JSON.stringify(record, null, 2),
    "계산된 ASRS 해석용 지표:",
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

async function generateInsights(record) {
  const metrics = computeAssessmentMetrics(record);
  const payload = await callGeminiJson({
    systemInstruction: "You are a clinical-style but non-diagnostic ADHD screening assistant for a Korean mobile web app focused on ASRS Part A. Return concise Korean JSON only.",
    prompt: buildInsightsPrompt(record, metrics),
    schemaHint: [
      "Schema:",
      "{",
      '  "report": {',
      '    "severity": "낮음|중간|높음",',
      '    "sections": {',
      '      "summary": "string",',
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

  return {
    report: {
      generatedAt: new Date().toISOString(),
      severity: payload.report?.severity || metrics.severity,
      scores: metrics.scores,
      sections: {
        summary: payload.report?.sections?.summary || "ASRS Part A 응답에서 주의 조절과 과제 시작 지연의 어려움이 관찰됩니다.",
        strength: payload.report?.sections?.strength || "흥미 기반 몰입과 패턴 인식은 보호 요인이 될 수 있습니다.",
        watchout: payload.report?.sections?.watchout || "이 결과는 선별용이므로, 어려움이 지속되면 추가 평가와 상담을 고려하는 것이 좋습니다."
      }
    },
    plan: {
      suggestions: Array.isArray(payload.plan?.suggestions) ? payload.plan.suggestions.slice(0, 3) : [],
      chat: [
        {
          role: "assistant",
          text: payload.plan?.openingMessage || "결과를 바탕으로 계획을 조정할 수 있습니다. 생활 패턴이나 시간대를 입력해 주세요."
        }
      ]
    }
  };
}

async function generateChatReply(record, message) {
  const payload = await callGeminiJson({
    systemInstruction: "You are a concise Korean AI coach for an ADHD screening support app. Return JSON only.",
    prompt: buildChatPrompt(record, message),
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
    systemInstruction: "You are a concise Korean assistant for interpreting ASRS screening results. Return JSON only.",
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
    summary: payload.summary || "ASRS 응답에서 현재 주의집중 관련 어려움의 강도를 함께 살펴볼 필요가 있습니다.",
    attention: payload.attention || "주의력 결핍 관련 응답 강도를 기준으로 일상 집중 유지와 시작 지연 패턴을 확인할 수 있습니다.",
    hyperactivity: payload.hyperactivity || "과잉행동·충동성 관련 응답 강도를 기준으로 몸의 안절부절함이나 끼어들기 양상을 참고할 수 있습니다.",
    guidance: payload.guidance || "이 검사는 선별 도구이므로 어려움이 지속되면 추가 평가와 상담을 고려하는 것이 좋습니다."
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

    serveStatic(pathname, res);
  } catch (error) {
    const status = error.code === "ENOENT" ? 404 : 500;
    sendJson(res, status, { error: error.message });
  }
});

const port = process.env.PORT || 3333;
const host = process.env.HOST || "127.0.0.1";
server.listen(port, host, () => {
  console.log(`soul.ai.kr app listening on http://${host}:${port}`);
});
