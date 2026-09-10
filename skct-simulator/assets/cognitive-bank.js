/* SKCT 인지역량검사 — 영역 정의 및 문항 은행 조립
 * assets/cog-exams/exam1~5.js가 먼저 로드되어 window.SKCT_COG_EXAMS를 채운 뒤 이 파일이 실행된다.
 * 공개된 검사 형식을 참고해 자체 제작한 연습 문항이며 기출이 아니다.
 */
(function () {
  "use strict";

  window.SKCT_COG_SECTIONS = [
    { code: "verbal", name: "언어이해", short: "언어", minutes: 20,
      desc: "어휘 관계, 문장 배열, 독해와 논리적 추론을 다룬다. 지문을 두 번 읽을 시간이 없으므로 첫 독해에서 구조를 잡아야 한다." },
    { code: "quant", name: "수리", short: "수리", minutes: 22,
      desc: "응용계산과 자료해석. 계산이 무거운 문항을 뒤로 미루는 판단이 점수를 가른다." },
    { code: "reason", name: "추리", short: "추리", minutes: 20,
      desc: "명제와 조건추리, 참·거짓, 수·문자 규칙, 도식추리. 조건을 표로 옮기는 습관이 속도를 만든다." }
  ];

  var EXAMS = (window.SKCT_COG_EXAMS || []).slice().sort(function (a, b) { return a.exam - b.exam; });
  var SECS = ["verbal", "quant", "reason"];

  /* 회차별 자료와 문항을 하나로 합친다. 문항에는 출제 회차를 표시해 둔다. */
  var MATERIALS = {};
  var BANK = { verbal: [], quant: [], reason: [] };

  EXAMS.forEach(function (ex) {
    Object.keys(ex.materials || {}).forEach(function (k) { MATERIALS[k] = ex.materials[k]; });
    SECS.forEach(function (sec) {
      (ex[sec] || []).forEach(function (q) {
        q.exam = ex.exam;
        BANK[sec].push(q);
      });
    });
  });

  window.SKCT_COG_MATERIALS = MATERIALS;
  window.SKCT_COG_BANK = BANK;

  var MOCK_NOTE = [
    "1회는 표준 난도로 구성했다. 처음 응시한다면 여기서 시작하는 편이 좋다.",
    "독해 지문의 논지 약화 문항과 자료해석의 %p·% 구분 문항이 들어간다. 1회보다 함정이 한 겹 더 있다.",
    "원탁 배치와 계차수열 등 형태가 한 번 꺾인 문항을 넣었다. 조건을 그림으로 옮기는 연습에 적합하다.",
    "이차식 최적화, 세 집합 벤다이어그램, 이중 피동 등 자주 틀리는 유형을 모았다. 난도가 가장 높다.",
    "왕복 평균 속력, 복리 증가율, 최소 교집합처럼 직관이 어긋나기 쉬운 문항 위주다. 마무리 점검용."
  ];

  var SETS = EXAMS.map(function (ex, i) {
    var n = ex.exam;
    return {
      id: "mock" + n,
      code: n + "회",
      name: "실전 모의고사 " + n + "회",
      tag: "실전",
      summary: "언어 20 · 수리 20 · 추리 20, 총 60문항을 실전과 같은 순서와 시간으로 푼다.",
      detail: MOCK_NOTE[i] + " 교시가 끝나면 남은 시간이 다음 교시로 넘어가지 않는다.",
      parts: [
        { title: "1교시 · 언어이해", sec: "verbal", minutes: 20, items: ex.verbal.map(function (q) { return q.id; }) },
        { title: "2교시 · 수리", sec: "quant", minutes: 22, items: ex.quant.map(function (q) { return q.id; }) },
        { title: "3교시 · 추리", sec: "reason", minutes: 20, items: ex.reason.map(function (q) { return q.id; }) }
      ]
    };
  });

  /* 영역별 집중 — 다섯 회차에서 겹치지 않게 네 문항씩 뽑아 유형을 고르게 담는다. */
  function crossPick(sec) {
    var items = [];
    EXAMS.forEach(function (ex, i) {
      [0, 5, 10, 15].forEach(function (base) {
        var q = ex[sec][(base + i) % 20];
        if (q) items.push(q.id);
      });
    });
    return items;
  }

  var FOCUS = [
    { code: "언어", name: "언어이해 집중", sec: "verbal", minutes: 20,
      summary: "다섯 회차의 언어 문항에서 20개를 뽑아 한 번에 푼다.",
      detail: "어휘 관계부터 독해 추론, 논리 오류까지 한 세트에 모았다. 지문 문항이 섞여 있으므로 지문을 만나면 딸린 문항을 한꺼번에 처리하는 연습을 하면 좋다." },
    { code: "수리", name: "수리 집중", sec: "quant", minutes: 22,
      summary: "다섯 회차의 수리 문항에서 20개를 뽑아 한 번에 푼다.",
      detail: "농도·일률·거리속도·확률 같은 응용계산과 자료해석이 섞여 있다. 계산이 무거운 문항을 먼저 넘기는 판단을 연습하기 좋다." },
    { code: "추리", name: "추리 집중", sec: "reason", minutes: 20,
      summary: "다섯 회차의 추리 문항에서 20개를 뽑아 한 번에 푼다.",
      detail: "명제와 조건추리, 참·거짓, 수·문자 규칙, 도식추리를 고르게 담았다. 조건을 표로 옮기는 속도 자체를 연습하는 세트다." }
  ];

  FOCUS.forEach(function (f) {
    SETS.push({
      id: "focus-" + f.sec,
      code: f.code, name: f.name, tag: "영역",
      summary: f.summary, detail: f.detail,
      parts: [{ title: f.name, sec: f.sec, minutes: f.minutes, items: crossPick(f.sec) }]
    });
  });

  window.SKCT_COG_SETS = SETS;
})();
