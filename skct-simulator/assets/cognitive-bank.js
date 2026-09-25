/* SKCT 인지역량검사 — 영역 정의 및 문항 은행 조립
 * 기술사무직 유형 5영역: 언어이해 · 자료해석 · 창의수리 · 언어추리 · 수열추리
 * exam1~5.js가 먼저 로드된 뒤 이 파일이 실행된다. 회차 파일은 이미 영역별로 나뉘어 있다.
 * 공개된 검사 형식을 참고해 자체 제작한 연습 문항이며 기출이 아니다.
 */
(function () {
  "use strict";

  window.SKCT_COG_SECTIONS = [
    { code: "verbal", name: "언어이해", short: "언어", minutes: 15,
      desc: "배열·빈칸으로 글의 뼈대를 잡고, 주제와 제목, 내용 일치, 요약, 추론, 보기 사례 적용, 서술 방식을 묻는다. 지문을 두 번 읽을 시간이 없으므로 첫 독해에서 구조를 잡아야 한다." },
    { code: "data", name: "자료해석", short: "자료", minutes: 15,
      desc: "표와 그래프에서 비중·증감률·순위를 읽어 낸다. %와 %p를 구분하고, 'ㄱ·ㄴ·ㄷ 중 옳은 것을 모두 고르는' 형식에서는 세 진술을 각각 따로 판정해야 한다." },
    { code: "calc", name: "창의수리", short: "수리", minutes: 15,
      desc: "방정식, 비례, 평균, 농도, 일률, 거리·속도·시간, 확률, 경우의 수, 원가·할인·이익. 계산이 무거운 문항을 뒤로 미루는 판단이 점수를 가른다." },
    { code: "lreason", name: "언어추리", short: "언어추리", minutes: 15,
      desc: "명제와 대우, 삼단논법, 조건·순서·배치추리, 진실게임. 조건을 표나 화살표로 옮기는 습관이 속도를 만든다." },
    { code: "nreason", name: "수열추리", short: "수열추리", minutes: 15,
      desc: "수 규칙 한 가지다. 차 → 계차 → 비 → 앞 두 항의 연산 → 홀짝 교대 순으로 훑는 순서를 정해 두면 대부분 20초 안에 끝난다." }
  ];

  /* 기술사무직 5영역에서 실제로 출제되는 세부 유형만 남긴다.
     회차 파일에 그 밖의 유형이 섞여 들어오면 조립 단계에서 걸러진다. */
  var ALLOWED = {
    verbal: ["문장배열", "빈칸추론", "주제파악", "제목", "내용일치", "요약", "추론", "적용", "서술방식"],
    data: ["자료해석", "표분석", "모두고르시오", "그래프분석"],
    calc: ["방정식", "비례", "평균", "농도", "일률", "거리속도", "확률", "경우의수", "원가할인"],
    lreason: ["명제·대우", "삼단논법", "명제연쇄", "명제추론", "조건추리", "순서추리", "배치추리", "참거짓"],
    nreason: ["수규칙"]
  };

  var AREAS = ["verbal", "data", "calc", "lreason", "nreason"];
  var MATERIALS = {};
  var BANK = { verbal: [], data: [], calc: [], lreason: [], nreason: [] };

  (window.SKCT_COG_EXAMS || []).slice().sort(function (a, b) { return a.exam - b.exam; })
    .forEach(function (ex) {
      Object.keys(ex.materials || {}).forEach(function (k) { MATERIALS[k] = ex.materials[k]; });
      AREAS.forEach(function (area) {
        (ex[area] || []).forEach(function (q) {
          if (ALLOWED[area].indexOf(q.type) < 0) return;
          q.exam = ex.exam;
          BANK[area].push(q);
        });
      });
    });

  window.SKCT_COG_MATERIALS = MATERIALS;
  window.SKCT_COG_BANK = BANK;

  var EXAM_NOS = [];
  AREAS.forEach(function (a) {
    BANK[a].forEach(function (q) { if (EXAM_NOS.indexOf(q.exam) < 0) EXAM_NOS.push(q.exam); });
  });
  EXAM_NOS.sort(function (a, b) { return a - b; });

  function itemsOf(area, exam) {
    return BANK[area].filter(function (q) { return q.exam === exam; }).map(function (q) { return q.id; });
  }

  var MOCK_NOTE = [
    "표준 난도로 구성했다. 처음 응시한다면 여기서 시작하는 편이 좋다.",
    "%p와 %를 가르는 자료해석, 노출 경로를 되묻는 독해처럼 함정이 한 겹 더 있는 문항을 넣었다.",
    "원탁 배치와 계차수열, 동점이 나오는 그래프 문항처럼 형태가 한 번 꺾인 문항이 섞여 있다.",
    "기차 길이와 시간 차, 가중평균, 모두 고르시오 세 진술 판정 등 자주 틀리는 유형을 모았다. 난도가 가장 높다.",
    "왕복 평균 속력, 이익률과 할인율의 기준 차이, 비율이 뒤집히는 그래프처럼 직관이 어긋나기 쉬운 문항 위주다. 마무리 점검용."
  ];

  var SETS = EXAM_NOS.map(function (n, i) {
    return {
      id: "mock" + n,
      code: n + "회",
      name: "실전 모의고사 " + n + "회",
      tag: "실전",
      summary: "언어이해·자료해석·창의수리·언어추리·수열추리 다섯 영역을 각 20문항씩, 모두 100문항을 실전 순서대로 푼다.",
      detail: MOCK_NOTE[i % MOCK_NOTE.length] + " 영역이 끝나면 남은 시간이 다음 영역으로 넘어가지 않는다.",
      parts: window.SKCT_COG_SECTIONS.map(function (sec, k) {
        return {
          title: (k + 1) + "교시 · " + sec.name,
          sec: sec.code,
          minutes: sec.minutes,
          items: itemsOf(sec.code, n)
        };
      })
    };
  });

  /* 영역별 집중 — 다섯 회차에서 겹치지 않게 네 문항씩 뽑아 유형을 고르게 담는다. */
  window.SKCT_COG_SECTIONS.forEach(function (sec) {
    var items = [];
    EXAM_NOS.forEach(function (n, i) {
      var pool = itemsOf(sec.code, n);
      [0, 5, 10, 15].forEach(function (base) {
        var id = pool[(base + i) % (pool.length || 1)];
        if (id && items.indexOf(id) < 0) items.push(id);
      });
    });
    SETS.push({
      id: "focus-" + sec.code,
      code: sec.short,
      name: sec.name + " 집중",
      tag: "영역",
      summary: "다섯 회차의 " + sec.name + " 문항에서 " + items.length + "개를 뽑아 한 번에 푼다.",
      detail: sec.desc,
      parts: [{ title: sec.name + " 집중", sec: sec.code, minutes: sec.minutes, items: items }]
    });
  });

  window.SKCT_COG_SETS = SETS;
})();
