import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

import { SUGGEST_SCHEMA, WRITE_SCHEMA } from "./schema.js";
import { validateSuggest, validateWrite, countChars, countCharsNoNewline } from "./validate.js";

const here = path.dirname(fileURLToPath(import.meta.url));

/** 프롬프트 원문. 절대 수정하지 않고 그대로 system 프롬프트로 넣는다. */
export const SYSTEM_PROMPT = fs.readFileSync(
  path.join(here, "..", "prompts", "system.ko.txt"),
  "utf8",
);

const MODEL = process.env.MODEL || "claude-opus-5";
const MAX_REPAIR = Math.min(Number(process.env.MAX_REPAIR ?? 1) || 0, 3);

let client = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

export function hasApiKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export function config() {
  return { model: MODEL, maxRepair: MAX_REPAIR, hasApiKey: hasApiKey() };
}

function todayInSeoul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * 프롬프트의 {{MODE}}, {{SEED}} 같은 변수를 사용자 메시지로 전달한다.
 * system 프롬프트를 건드리지 않아야 프롬프트 캐시가 계속 적중한다.
 */
function buildUserMessage(vars) {
  const lines = Object.entries(vars)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
    .map(([k, v]) => `${k}=${String(v).trim()}`);
  return `입력 변수는 아래와 같다. 이 값들을 프롬프트의 동명 플레이스홀더에 대입해 처리하고, 정해진 JSON만 출력한다.\n\n${lines.join("\n")}`;
}

async function callModel({ messages, schema, effort }) {
  const stream = getClient().messages.stream({
    model: MODEL,
    max_tokens: 32000,
    system: [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    output_config: {
      effort,
      format: { type: "json_schema", schema },
    },
    messages,
  });

  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    const detail = message.stop_details?.explanation || message.stop_details?.category || "";
    throw Object.assign(new Error(`모델이 응답을 거절했어요. ${detail}`), { status: 422 });
  }

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw Object.assign(new Error("모델 응답을 JSON으로 읽지 못했어요."), {
      status: 502,
      raw: text.slice(0, 2000),
    });
  }

  return { parsed, text, usage: message.usage };
}

function repairMessage(issues) {
  const list = issues.map((i, n) => `${n + 1}. [${i.code}] ${i.message}`).join("\n");
  return (
    "직전 출력이 아래 규칙을 어겼다. 주제와 논지는 유지하되 해당 부분만 고쳐서 " +
    "같은 JSON 스키마로 전체를 다시 출력한다. 설명이나 사과 문장은 넣지 않는다.\n\n" +
    list
  );
}

function mergeUsage(a, b) {
  if (!a) return { ...b };
  const out = { ...a };
  for (const k of ["input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"]) {
    out[k] = (a[k] ?? 0) + (b?.[k] ?? 0);
  }
  return out;
}

/**
 * 규칙 위반이 error 등급이면 최대 MAX_REPAIR 회까지 모델에 재작성을 요청한다.
 */
async function runWithRepair({ vars, schema, effort, validate }) {
  const messages = [{ role: "user", content: buildUserMessage(vars) }];
  let attempts = 0;
  let usage = null;
  let last = null;
  const history = [];

  while (true) {
    const { parsed, text, usage: u } = await callModel({ messages, schema, effort });
    usage = mergeUsage(usage, u);
    attempts += 1;

    const needsInput = Array.isArray(parsed?.needs_input) ? parsed.needs_input : [];
    const { issues, stats } = needsInput.length > 0
      ? { issues: [], stats: {} }
      : validate(parsed);

    last = { result: parsed, issues, stats };
    history.push({ attempt: attempts, issues });

    const errors = issues.filter((i) => i.severity === "error");
    if (errors.length === 0 || attempts > MAX_REPAIR) break;

    messages.push({ role: "assistant", content: text });
    messages.push({ role: "user", content: repairMessage(errors) });
  }

  return { ...last, attempts, usage, history };
}

export async function suggest({ seed = "", today = "" } = {}) {
  const vars = {
    MODE: "SUGGEST",
    TODAY: today || todayInSeoul(),
    SEED: seed,
  };

  const run = await runWithRepair({
    vars,
    schema: SUGGEST_SCHEMA,
    effort: process.env.EFFORT_SUGGEST || "medium",
    validate: validateSuggest,
  });

  return { ...run, input: vars };
}

export async function write({
  topic = "",
  seriesIndex = 1,
  prevSummary = "",
  affiliate = false,
  today = "",
  extra = "",
} = {}) {
  const idx = Math.max(1, Number(seriesIndex) || 1);
  const vars = {
    MODE: "WRITE",
    TODAY: today || todayInSeoul(),
    TOPIC: topic,
    SERIES_INDEX: idx,
    PREV_SUMMARY: idx >= 2 ? prevSummary : "",
    AFFILIATE: affiliate ? "true" : "false",
  };
  if (extra.trim()) vars.NOTE = extra;

  const run = await runWithRepair({
    vars,
    schema: WRITE_SCHEMA,
    effort: process.env.EFFORT_WRITE || "high",
    validate: (r) => validateWrite(r, { affiliate }),
  });

  // 모델이 보고한 char_count는 신뢰하지 않고 실제 값으로 덮어쓴다.
  if (run.result && typeof run.result.body_plain === "string") {
    run.result.char_count = countChars(run.result.body_plain);
    run.result.series_index = idx;
    run.stats = {
      ...run.stats,
      charsNoNewline: countCharsNoNewline(run.result.body_plain),
    };
  }

  return { ...run, input: vars };
}
