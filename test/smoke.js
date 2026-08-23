// 실제 API 호출 없이 파이프라인 전체를 점검한다.
//   node --test test/smoke.js
import assert from "node:assert/strict";
import test, { before, after } from "node:test";

import { startMock } from "./mock-anthropic.js";
import { validateWrite, validateSuggest, countChars, findMarkdown, estimateSections } from "../server/validate.js";

let mock;
let engine;

before(async () => {
  mock = await startMock();
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${mock.port}`;
  process.env.NO_PROXY = "127.0.0.1,localhost";
  process.env.MAX_REPAIR = "1";
  engine = await import("../server/engine.js");
});

after(() => mock.server.close());

test("마크다운 기호를 잡아낸다", () => {
  const hits = findMarkdown("## 제목\n\n- 항목 하나\n\n표 | 구분\n\n정상 문장이에요.");
  const symbols = new Set(hits.map((h) => h.symbol));
  assert.ok(symbols.has("#"));
  assert.ok(symbols.has("불릿"));
  assert.ok(symbols.has("|"));
  assert.equal(findMarkdown("정상 문장이에요.\n\n두 번째 문단입니다.").length, 0);
});

test("소제목을 문장형 블록으로 추정한다", () => {
  const body = "도입 문단이에요.\n\n주방 가전을 관리하는 방법\n\n본문 내용이 이어져요.";
  assert.deepEqual(estimateSections(body), ["주방 가전을 관리하는 방법"]);
});

test("분량과 마무리 질문을 검사한다", () => {
  const short = validateWrite({ body_plain: "짧아요.", char_count: 4, thumbnail_text: {} });
  const codes = short.issues.map((i) => i.code);
  assert.ok(codes.includes("too_short"));
  assert.ok(codes.includes("no_closing_question"));
});

test("제휴 모드에서 첫 줄 대가성 표시를 확인한다", () => {
  const noNotice = validateWrite(
    { body_plain: "안녕하세요.\n\n오늘은 무엇을 해보시겠어요?", char_count: 10, thumbnail_text: {} },
    { affiliate: true },
  );
  assert.ok(noNotice.issues.some((i) => i.code === "no_affiliate_notice"));

  const withNotice = validateWrite(
    { body_plain: "이 글에는 제휴 링크가 포함되어 일정액의 수수료를 받을 수 있어요.\n\n오늘은 무엇을 해보시겠어요?", char_count: 10, thumbnail_text: {} },
    { affiliate: true },
  );
  assert.ok(!withNotice.issues.some((i) => i.code === "no_affiliate_notice"));
});

test("SUGGEST 결과의 recommended_id가 후보에 있는지 본다", () => {
  const bad = validateSuggest({ candidates: [{ id: "c1" }], recommended_id: "c9", recommend_reason: "" });
  const codes = bad.issues.map((i) => i.code);
  assert.ok(codes.includes("candidate_count"));
  assert.ok(codes.includes("bad_recommended_id"));
  assert.ok(codes.includes("no_reason"));
});

test("SUGGEST: 후보 5개와 추천 사유를 받아온다", async () => {
  const out = await engine.suggest({ seed: "여름 전기요금", today: "2026-08-23" });
  assert.equal(out.result.mode, "suggest");
  assert.equal(out.result.candidates.length, 5);
  assert.equal(out.attempts, 1);
  assert.deepEqual(out.issues, []);

  const req = mock.seen.at(-1);
  assert.equal(req.output_config.format.type, "json_schema");
  assert.equal(req.system[0].cache_control.type, "ephemeral");
  assert.match(req.messages[0].content, /MODE=SUGGEST/);
  assert.match(req.messages[0].content, /SEED=여름 전기요금/);
});

test("WRITE: 규칙 위반이면 한 번 더 생성해 고친다", async () => {
  const out = await engine.write({ topic: "여름철 실내 온도 관리", seriesIndex: 2, prevSummary: "1편에서는 선풍기를 다뤘어요." });

  assert.equal(out.attempts, 2, "첫 응답이 규칙을 어겼으므로 재작성이 일어나야 한다");
  assert.equal(out.issues.filter((i) => i.severity === "error").length, 0);

  const body = out.result.body_plain;
  assert.equal(findMarkdown(body).length, 0, "본문에 마크다운 기호가 없어야 한다");
  assert.ok(countChars(body) >= 1500 && countChars(body) <= 2200, `분량 ${countChars(body)}자`);
  assert.ok(body.trimEnd().endsWith("?"), "질문형으로 끝나야 한다");
  assert.equal(out.result.char_count, countChars(body), "char_count가 실제 길이로 교정돼야 한다");
  assert.equal(out.result.series_index, 2);

  const repairReq = mock.seen.at(-1);
  assert.equal(repairReq.messages.length, 3, "assistant 응답 + 수정 요청이 이어져야 한다");
  assert.match(repairReq.messages[2].content, /markdown|too_short/);
  assert.match(repairReq.messages[0].content, /PREV_SUMMARY=1편에서는/);
});
