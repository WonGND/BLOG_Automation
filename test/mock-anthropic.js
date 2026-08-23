// 테스트용 가짜 Anthropic /v1/messages 엔드포인트.
// 실제 API 키 없이 스트리밍 파싱 → JSON 파싱 → 규칙 검사 → 자동 재작성 경로를 확인한다.
import http from "node:http";

const HEADING = [
  "여름철 실내 온도를 어떻게 맞추면 좋을까요",
  "에어컨 필터를 직접 관리하는 방법",
  "선풍기와 함께 쓰면 달라지는 점",
  "외출할 때 챙기면 좋은 습관",
];

function paragraph(seed) {
  return (
    `${seed} 저는 처음에는 온도만 낮추면 시원해진다고 생각했어요. ` +
    "그런데 막상 며칠 지내보니 공기가 도는 방향이 더 중요하더라고요. " +
    "그래서 커튼을 반쯤 내리고 바람 길을 만들어 두는 쪽으로 습관을 바꿨습니다. " +
    "그렇게 하니 같은 설정에서도 훨씬 덜 답답하게 느껴졌어요."
  );
}

function goodBody() {
  const blocks = ["여름이 되면 실내를 어떻게 관리해야 할지 고민이 많아지죠. 오늘은 집에서 바로 해볼 수 있는 방법을 정리해 볼게요. 특별한 장비 없이도 충분히 달라지는 부분이 있더라고요."];
  HEADING.forEach((h, i) => {
    blocks.push(h);
    blocks.push(paragraph(`${i + 1}번째로 신경 쓴 부분이에요.`));
  });
  blocks.push("정리하면 이렇게 해볼 수 있어요");
  blocks.push(
    "오늘 이야기한 방법들은 모두 돈이 들지 않는 것들이에요. " +
    "하나씩 바꿔보면서 우리 집에 맞는 방식을 찾아가는 게 가장 좋습니다. " +
    "오늘 저녁에는 어떤 것부터 한번 바꿔보시겠어요?",
  );
  let body = blocks.join("\n\n");
  // 1,500자 이상이 되도록 채운다.
  while ([...body].length < 1550) {
    body = body.replace(
      "정리하면 이렇게 해볼 수 있어요",
      "잠깐 더 살펴볼 부분이 있어요\n\n" + paragraph("추가로 확인해 두면 좋아요.") + "\n\n정리하면 이렇게 해볼 수 있어요",
    );
  }
  return body;
}

function badBody() {
  return "## 시작하며\n\n- 첫 번째 항목\n- 두 번째 항목\n\n너무 짧은 본문이에요.";
}

function writePayload(good) {
  const body = good ? goodBody() : badBody();
  return {
    mode: "write",
    title: "여름철 실내 온도 관리로 시원하게 지내기",
    primary_keyword: "여름철 실내 온도",
    related_keywords: ["에어컨 관리", "선풍기 활용"],
    series_index: 1,
    body_plain: body,
    char_count: 9999, // 일부러 틀린 값 → 서버가 실제 값으로 덮어써야 한다
    closing_question: "오늘 저녁에는 어떤 것부터 한번 바꿔보시겠어요?",
    tags: ["여름", "실내온도", "생활정보"],
    thumbnail_text: { main: "여름 실내온도", sub: "오늘부터 바꾸는 습관" },
    verify_required: ["권장 실내 온도 수치"],
    next_episode_hint: "여름철 제습기 활용법",
    assumptions: ["아파트 거주 기준으로 작성했어요"],
    needs_input: [],
  };
}

function suggestPayload() {
  return {
    mode: "suggest",
    candidates: Array.from({ length: 5 }, (_, i) => ({
      id: `c${i + 1}`,
      title: `여름철 생활정보 주제 ${i + 1}`,
      primary_keyword: `키워드${i + 1}`,
      intent: "방법을 알고 싶은 검색 의도",
      timeliness: "시즌",
      reason: "지금 검색량이 늘어나는 시기예요.",
    })),
    recommended_id: "c2",
    recommend_reason: "지금 시기에 검색 수요가 가장 뚜렷해요.",
    assumptions: [],
    needs_input: [],
  };
}

function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function startMock(port = 0) {
  const seen = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      const body = JSON.parse(raw || "{}");
      seen.push(body);

      const isWrite = body.output_config?.format?.schema?.properties?.body_plain != null;
      const isRepair = body.messages.length > 1;
      const payload = isWrite ? writePayload(isRepair) : suggestPayload();
      const text = JSON.stringify(payload);

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      sse(res, "message_start", {
        type: "message_start",
        message: {
          id: "msg_mock", type: "message", role: "assistant", model: body.model,
          content: [], stop_reason: null, stop_sequence: null,
          usage: { input_tokens: 100, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        },
      });
      sse(res, "content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
      for (let i = 0; i < text.length; i += 400) {
        sse(res, "content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: text.slice(i, i + 400) } });
      }
      sse(res, "content_block_stop", { type: "content_block_stop", index: 0 });
      sse(res, "message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 500 } });
      sse(res, "message_stop", { type: "message_stop" });
      res.end();
    });
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      resolve({ server, port: server.address().port, seen });
    });
  });
}
