import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(here, "..");

// .env 를 읽어 환경변수로 올린다 (없어도 조용히 넘어간다).
// process.loadEnvFile 은 Node 20.12 이상에만 있어서 직접 파싱하는 경로를 함께 둔다.
function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return;
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envPath);
    return;
  }
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || line.trimStart().startsWith("#")) continue;
    const value = m[2].trim().replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

try {
  loadEnv(path.join(rootDir, ".env"));
} catch (err) {
  console.warn(".env 를 읽지 못했어요:", err.message);
}

// engine 은 환경변수를 읽으므로 .env 로딩 이후에 불러온다.
const { suggest, write, config, hasApiKey } = await import("./engine.js");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(rootDir, "public")));

const OUTPUT_DIR = path.join(rootDir, "output");
const SAVE_OUTPUT = String(process.env.SAVE_OUTPUT ?? "true") !== "false";

function slugify(text) {
  return String(text ?? "post")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 40) || "post";
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function saveWrite(payload) {
  if (!SAVE_OUTPUT || !payload?.result?.body_plain) return null;
  try {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const id = `${stamp()}-${slugify(payload.result.title)}`;
    fs.writeFileSync(
      path.join(OUTPUT_DIR, `${id}.json`),
      JSON.stringify({ id, created_at: new Date().toISOString(), ...payload }, null, 2),
      "utf8",
    );
    fs.writeFileSync(
      path.join(OUTPUT_DIR, `${id}.txt`),
      `${payload.result.title}\n\n${payload.result.body_plain}\n\n태그: ${(payload.result.tags ?? []).join(", ")}\n`,
      "utf8",
    );
    return id;
  } catch (err) {
    console.warn("결과 저장 실패:", err.message);
    return null;
  }
}

function sendError(res, err) {
  const status = err?.status && Number.isInteger(err.status) ? err.status : 500;
  const known = {
    401: "API 키가 올바르지 않아요. .env 의 ANTHROPIC_API_KEY 를 확인해 주세요.",
    429: "요청이 몰렸어요(rate limit). 잠시 뒤 다시 시도해 주세요.",
    529: "Anthropic 서버가 혼잡해요. 잠시 뒤 다시 시도해 주세요.",
  };
  const message = known[status] || err?.message || "알 수 없는 오류가 발생했어요.";
  console.error(`[${status}]`, err?.message ?? err);
  res.status(status >= 400 && status < 600 ? status : 500).json({ error: message, raw: err?.raw });
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ...config() });
});

app.post("/api/suggest", async (req, res) => {
  if (!hasApiKey()) {
    return res.status(401).json({ error: "ANTHROPIC_API_KEY 가 설정되지 않았어요. .env 파일을 만들어 주세요." });
  }
  try {
    const { seed = "", today = "" } = req.body ?? {};
    const out = await suggest({ seed, today });
    res.json(out);
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/write", async (req, res) => {
  if (!hasApiKey()) {
    return res.status(401).json({ error: "ANTHROPIC_API_KEY 가 설정되지 않았어요. .env 파일을 만들어 주세요." });
  }
  try {
    const { topic = "", seriesIndex = 1, prevSummary = "", affiliate = false, today = "", extra = "" } = req.body ?? {};
    if (!String(topic).trim()) {
      return res.status(400).json({ error: "주제(TOPIC)를 입력해 주세요." });
    }
    const out = await write({ topic, seriesIndex, prevSummary, affiliate, today, extra });
    const savedId = saveWrite(out);
    res.json({ ...out, saved_id: savedId });
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/history", (_req, res) => {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) return res.json({ items: [] });
    const items = fs
      .readdirSync(OUTPUT_DIR)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse()
      .slice(0, 30)
      .map((f) => {
        try {
          const j = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, f), "utf8"));
          return {
            id: j.id,
            created_at: j.created_at,
            title: j.result?.title ?? "",
            primary_keyword: j.result?.primary_keyword ?? "",
            series_index: j.result?.series_index ?? 1,
            next_episode_hint: j.result?.next_episode_hint ?? "",
            summary: String(j.result?.body_plain ?? "").slice(0, 160),
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    res.json({ items });
  } catch (err) {
    sendError(res, err);
  }
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  const cfg = config();
  console.log(`\n  한국어 생활정보 블로그 생성 엔진`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  모델: ${cfg.model} / 자동 재작성: ${cfg.maxRepair}회`);
  if (!cfg.hasApiKey) {
    console.log(`  ⚠ ANTHROPIC_API_KEY 가 없어요. .env.example 을 .env 로 복사해 키를 넣어 주세요.\n`);
  } else {
    console.log("");
  }
});
