// 생성 결과를 프롬프트 규칙에 맞춰 자동 검사한다.
// severity "error" 인 항목이 하나라도 있으면 서버가 자동 재작성(repair)을 요청한다.

const MIN_CHARS = 1500;
const MAX_CHARS = 2200;

/** 공백 포함 글자 수(줄바꿈 포함). 이모지 등 서로게이트 쌍은 1자로 센다. */
export function countChars(text) {
  return [...String(text ?? "")].length;
}

/** 줄바꿈을 뺀 글자 수. 네이버 에디터 표시 글자 수와 더 가깝다. */
export function countCharsNoNewline(text) {
  return [...String(text ?? "").replace(/\n/g, "")].length;
}

/** 본문을 빈 줄 기준으로 문단 블록으로 나눈다. */
export function splitBlocks(text) {
  return String(text ?? "")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
}

/** 소제목으로 보이는 블록을 추정한다(문장 종결어미가 없는 짧은 한 줄). */
export function estimateSections(text) {
  // 본문 문단은 3~5문장이라 길고 마침표로 끝난다.
  // 마침표 없이 끝나는 짧은 한 줄 블록만 소제목으로 본다.
  return splitBlocks(text).filter(
    (b) => !b.includes("\n") && countChars(b) <= 45 && !/[.!?]$/.test(b),
  );
}

/** 마크다운 기호 사용 위치를 찾는다. */
export function findMarkdown(text) {
  const hits = [];
  const lines = String(text ?? "").split("\n");
  lines.forEach((line, i) => {
    const n = i + 1;
    if (/^\s*#{1,6}\s?/.test(line)) hits.push({ line: n, symbol: "#", text: line.trim() });
    if (/^\s*[-*+•]\s+/.test(line)) hits.push({ line: n, symbol: "불릿", text: line.trim() });
    if (/^\s*(-{3,}|={3,}|\*{3,})\s*$/.test(line)) hits.push({ line: n, symbol: "구분선", text: line.trim() });
    if (/^\s*>\s?/.test(line)) hits.push({ line: n, symbol: ">", text: line.trim() });
    if (line.includes("|")) hits.push({ line: n, symbol: "|", text: line.trim() });
    if (line.includes("*")) hits.push({ line: n, symbol: "*", text: line.trim() });
    if (/#/.test(line) && !/^\s*#{1,6}\s?/.test(line)) hits.push({ line: n, symbol: "#", text: line.trim() });
    if (/^\s*\d+\.\s+/.test(line)) hits.push({ line: n, symbol: "번호목록", text: line.trim() });
    if (/`/.test(line)) hits.push({ line: n, symbol: "백틱", text: line.trim() });
  });
  // 같은 줄의 중복 신고 제거
  const seen = new Set();
  return hits.filter((h) => {
    const key = `${h.line}:${h.symbol}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const AFFILIATE_HINTS = ["대가", "수수료", "제휴", "광고", "협찬", "파트너스"];

/**
 * WRITE 결과 검사.
 * @returns {{issues: Array<{severity:'error'|'warn', code:string, message:string}>, stats: object}}
 */
export function validateWrite(result, { affiliate = false } = {}) {
  const issues = [];
  const body = String(result?.body_plain ?? "");
  const chars = countChars(body);
  const charsNoNewline = countCharsNoNewline(body);
  const blocks = splitBlocks(body);
  const headings = estimateSections(body);
  const markdown = findMarkdown(body);

  if (!body.trim()) {
    issues.push({ severity: "error", code: "empty_body", message: "본문이 비어 있어요." });
    return { issues, stats: { chars: 0, charsNoNewline: 0, blocks: 0, headings: [], markdown: [] } };
  }

  if (markdown.length > 0) {
    const list = markdown.slice(0, 5).map((h) => `${h.line}행 "${h.symbol}"`).join(", ");
    issues.push({
      severity: "error",
      code: "markdown",
      message: `마크다운 기호가 ${markdown.length}곳 남아 있어요 (${list}). 네이버 에디터는 마크다운을 지원하지 않아요.`,
    });
  }

  if (chars < MIN_CHARS) {
    issues.push({
      severity: "error",
      code: "too_short",
      message: `본문이 ${chars}자로 최소 ${MIN_CHARS}자에 ${MIN_CHARS - chars}자 모자라요.`,
    });
  } else if (chars > MAX_CHARS) {
    issues.push({
      severity: "error",
      code: "too_long",
      message: `본문이 ${chars}자로 최대 ${MAX_CHARS}자를 ${chars - MAX_CHARS}자 넘었어요.`,
    });
  }

  const trimmed = body.trimEnd();
  if (!trimmed.endsWith("?")) {
    issues.push({
      severity: "error",
      code: "no_closing_question",
      message: "마지막 문장이 물음표로 끝나지 않아요. 실행을 권하는 질문 1문장으로 마무리해야 해요.",
    });
  }

  if (affiliate) {
    const firstLine = body.split("\n").find((l) => l.trim()) ?? "";
    const ok = AFFILIATE_HINTS.some((w) => firstLine.includes(w));
    if (!ok) {
      issues.push({
        severity: "error",
        code: "no_affiliate_notice",
        message: "제휴 링크 모드인데 본문 첫 줄에 대가성 표시 문구가 없어요.",
      });
    }
  }

  if (headings.length < 3 || headings.length > 6) {
    issues.push({
      severity: "warn",
      code: "section_count",
      message: `소제목이 ${headings.length}개로 추정돼요. 소제목 섹션 3~4개 + 마무리 1개 구성이 맞는지 확인해 보세요. (자동 추정이라 실제와 다를 수 있어요)`,
    });
  }

  const declared = Number(result?.char_count);
  if (!Number.isFinite(declared) || Math.abs(declared - chars) > 30) {
    issues.push({
      severity: "warn",
      code: "char_count_mismatch",
      message: `모델이 보고한 글자 수(${result?.char_count})와 실제 글자 수(${chars})가 달라요. 실제 값으로 고쳤어요.`,
    });
  }

  const longParas = blocks.filter((b) => b.includes("\n") || countChars(b) > 400);
  if (longParas.length > 0) {
    issues.push({
      severity: "warn",
      code: "paragraph_shape",
      message: `문단 ${longParas.length}개가 지나치게 길거나 줄바꿈이 섞여 있어요. 문단 구분은 빈 줄 1개가 원칙이에요.`,
    });
  }

  const money = body.match(/[0-9][0-9,.]*\s*(원|만원|억원|퍼센트|%)/g);
  if (money) {
    issues.push({
      severity: "warn",
      code: "numeric_claim",
      message: `본문에 수치 표현이 있어요 (${[...new Set(money)].slice(0, 5).join(", ")}). 검증 가능한 값인지 확인하고, 아니라면 verify_required로 옮기세요.`,
    });
  }

  const main = String(result?.thumbnail_text?.main ?? "");
  const sub = String(result?.thumbnail_text?.sub ?? "");
  if (countChars(main) > 12) {
    issues.push({ severity: "warn", code: "thumb_main", message: `썸네일 메인 문구가 ${countChars(main)}자예요 (12자 이내 권장).` });
  }
  if (countChars(sub) > 18) {
    issues.push({ severity: "warn", code: "thumb_sub", message: `썸네일 서브 문구가 ${countChars(sub)}자예요 (18자 이내 권장).` });
  }

  if (result?.closing_question && !trimmed.endsWith(String(result.closing_question).trim())) {
    issues.push({
      severity: "warn",
      code: "closing_mismatch",
      message: "closing_question이 본문 마지막 문장과 정확히 일치하지 않아요.",
    });
  }

  return {
    issues,
    stats: { chars, charsNoNewline, blocks: blocks.length, headings, markdown },
  };
}

/** SUGGEST 결과 검사. */
export function validateSuggest(result) {
  const issues = [];
  const candidates = Array.isArray(result?.candidates) ? result.candidates : [];

  if (candidates.length !== 5) {
    issues.push({ severity: "error", code: "candidate_count", message: `주제 후보가 ${candidates.length}개예요. 5개여야 해요.` });
  }

  const ids = candidates.map((c) => c?.id);
  if (new Set(ids).size !== ids.length) {
    issues.push({ severity: "warn", code: "duplicate_id", message: "후보 id가 중복돼요." });
  }

  if (!ids.includes(result?.recommended_id)) {
    issues.push({
      severity: "error",
      code: "bad_recommended_id",
      message: `recommended_id "${result?.recommended_id}"가 후보 목록에 없어요.`,
    });
  }

  if (!String(result?.recommend_reason ?? "").trim()) {
    issues.push({ severity: "error", code: "no_reason", message: "추천 사유가 비어 있어요." });
  }

  return { issues, stats: { count: candidates.length } };
}

export { MIN_CHARS, MAX_CHARS };
