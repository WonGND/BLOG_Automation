/* CSS와 JS를 index.html 안으로 합쳐 단일 파일 두 개를 만든다.
 *   dist/index.html    — GitHub Pages·로컬(file://)에서 그대로 열리는 완성본
 *   dist/artifact.html — <head>/<body> 없이 본문만 담은 Artifact 배포용
 * 실행: node build.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(resolve(here, p), "utf8");

const css = read("assets/style.css");
const bank = read("assets/bank.js");
const app = read("assets/app.js");
const cogExams = [1, 2, 3, 4, 5].map((n) => read(`assets/cog-exams/exam${n}.js`));
const cogBank = read("assets/cognitive-bank.js");
const cogGuide = read("assets/cog-guide.js");
const cog = read("assets/cognitive.js");
const html = read("index.html");

const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const title = head.match(/<title>([\s\S]*?)<\/title>/)[1];
const fontLinks = [...head.matchAll(/<link [^>]*fonts\.(?:googleapis|gstatic)[^>]*>/g)].map((m) => m[0]).join("\n");
const noscript = html.match(/<noscript>[\s\S]*?<\/noscript>/)[0];

const inlined = [
  `<title>${title}</title>`,
  fontLinks,
  `<style>\n${css}\n</style>`,
  noscript,
  `<script>\n${bank}\n</script>`,
  `<script>\n${app}\n</script>`,
  ...cogExams.map((src) => `<script>\n${src}\n</script>`),
  `<script>\n${cogBank}\n</script>`,
  `<script>\n${cogGuide}\n</script>`,
  `<script>\n${cog}\n</script>`
].join("\n");

mkdirSync(resolve(here, "dist"), { recursive: true });

writeFileSync(
  resolve(here, "dist/index.html"),
  `<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n${inlined}\n</head>\n<body>\n</body>\n</html>\n`
);
writeFileSync(resolve(here, "dist/artifact.html"), inlined + "\n");

const kb = (s) => (Buffer.byteLength(s, "utf8") / 1024).toFixed(1) + "KB";
console.log("dist/index.html    ", kb(read("dist/index.html")));
console.log("dist/artifact.html ", kb(read("dist/artifact.html")));
