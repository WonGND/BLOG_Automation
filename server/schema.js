// 프롬프트의 <output_format>을 그대로 옮긴 JSON 스키마.
// Structured Outputs(output_config.format)로 넘겨 모델이 JSON 외 텍스트를
// 절대 섞지 못하게 강제한다.

export const SUGGEST_SCHEMA = {
  type: "object",
  properties: {
    mode: { type: "string", enum: ["suggest"] },
    candidates: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          primary_keyword: { type: "string" },
          intent: { type: "string" },
          timeliness: { type: "string", enum: ["상시", "시즌", "단기이슈"] },
          reason: { type: "string" },
        },
        required: ["id", "title", "primary_keyword", "intent", "timeliness", "reason"],
        additionalProperties: false,
      },
    },
    recommended_id: { type: "string" },
    recommend_reason: { type: "string" },
    assumptions: { type: "array", items: { type: "string" } },
    needs_input: { type: "array", items: { type: "string" } },
  },
  required: [
    "mode",
    "candidates",
    "recommended_id",
    "recommend_reason",
    "assumptions",
    "needs_input",
  ],
  additionalProperties: false,
};

export const WRITE_SCHEMA = {
  type: "object",
  properties: {
    mode: { type: "string", enum: ["write"] },
    title: { type: "string" },
    primary_keyword: { type: "string" },
    related_keywords: { type: "array", items: { type: "string" } },
    series_index: { type: "integer", minimum: 1 },
    body_plain: { type: "string" },
    char_count: { type: "integer" },
    closing_question: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    thumbnail_text: {
      type: "object",
      properties: {
        main: { type: "string" },
        sub: { type: "string" },
      },
      required: ["main", "sub"],
      additionalProperties: false,
    },
    verify_required: { type: "array", items: { type: "string" } },
    next_episode_hint: { type: "string" },
    assumptions: { type: "array", items: { type: "string" } },
    needs_input: { type: "array", items: { type: "string" } },
  },
  required: [
    "mode",
    "title",
    "primary_keyword",
    "related_keywords",
    "series_index",
    "body_plain",
    "char_count",
    "closing_question",
    "tags",
    "thumbnail_text",
    "verify_required",
    "next_episode_hint",
    "assumptions",
    "needs_input",
  ],
  additionalProperties: false,
};
