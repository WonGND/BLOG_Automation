// API 키 없이 화면을 눌러보는 데모 모드.
//   npm run demo
//
// 가짜 Anthropic 엔드포인트를 띄우고 서버를 거기에 연결한다.
// 실제 요금이 나가지 않고, 본문 내용은 고정된 더미 원고다.
// 화면 흐름과 복사·저장·검사 배지 동작을 확인하는 용도로만 쓴다.
import { startMock } from "../test/mock-anthropic.js";

const mock = await startMock();

// server/index.js 의 .env 로딩은 이미 설정된 환경변수를 덮어쓰지 않으므로
// 여기서 먼저 지정해 두면 실제 키가 있어도 데모가 그쪽으로 새지 않는다.
process.env.ANTHROPIC_API_KEY = "sk-ant-demo-not-a-real-key";
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${mock.port}`;
process.env.NO_PROXY = "127.0.0.1,localhost";
process.env.no_proxy = "127.0.0.1,localhost";
process.env.HTTP_PROXY = "";
process.env.HTTPS_PROXY = "";
process.env.http_proxy = "";
process.env.https_proxy = "";
process.env.SAVE_OUTPUT = process.env.SAVE_OUTPUT ?? "false";
process.env.PORT = process.env.PORT ?? "3000";

console.log("\n  ⚠ 데모 모드입니다. 실제 Claude 호출이 아니라 고정된 더미 원고를 보여줘요.");
console.log("     화면 흐름과 검사 배지 확인용이고, 글 품질은 여기서 판단할 수 없어요.");

await import("../server/index.js");

process.on("SIGINT", () => {
  mock.server.close();
  process.exit(0);
});
