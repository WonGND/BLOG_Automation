/* SKCT 인지역량검사 — 영역 정의 및 문항 은행 조립
 * 기술사무직 유형 5영역: 언어이해 · 자료해석 · 창의수리 · 언어추리 · 수열추리
 * exam1~5.js(기본)와 exam1-b~5-b.js(보충)가 먼저 로드된 뒤 이 파일이 실행된다.
 * 공개된 검사 형식을 참고해 자체 제작한 연습 문항이며 기출이 아니다.
 */
(function () {
  "use strict";

  window.SKCT_COG_SECTIONS = [
    { code: "verbal", name: "언어이해", short: "언어", minutes: 15,
      desc: "어휘 관계와 어법, 문장 배열, 독해와 논리적 추론을 다룬다. 지문을 두 번 읽을 시간이 없으므로 첫 독해에서 구조를 잡아야 한다." },
    { code: "data", name: "자료해석", short: "자료", minutes: 15,
      desc: "표에서 비중·증감률·순위를 읽어 낸다. %와 %p를 구분하고, 합계끼리 나눠야 하는 문항을 단순 평균으로 풀지 않는 것이 관건이다." },
    { code: "calc", name: "창의수리", short: "수리", minutes: 15,
      desc: "방정식, 농도, 일률, 거리속도, 확률, 경우의 수 등 응용계산. 계산이 무거운 문항을 뒤로 미루는 판단이 점수를 가른다." },
    { code: "lreason", name: "언어추리", short: "언어추리", minutes: 15,
      desc: "명제와 대우, 삼단논법, 조건추리, 참·거짓, 배치와 순서. 조건을 표로 옮기는 습관이 속도를 만든다." },
    { code: "nreason", name: "수열추리", short: "수열추리", minutes: 15,
      desc: "수열과 문자열 규칙, 도식추리, 대응규칙. 문자는 숫자로 바꿔 놓고, 차이가 불규칙하면 차이의 차이를 본다." }
  ];

  /* 기본 문항의 세부 유형을 실제 5영역으로 분류한다. */
  var AREA_BY_TYPE = {
    "유의어":"verbal","반의어":"verbal","어휘관계":"verbal","다의어":"verbal","어법":"verbal",
    "속담":"verbal","한자성어":"verbal","빈칸추론":"verbal","문장배열":"verbal","접속어":"verbal",
    "주제파악":"verbal","내용일치":"verbal","추론":"verbal","논지약화":"verbal","적용":"verbal",
    "중의성":"verbal","요약":"verbal","논리오류":"verbal","어휘추리":"verbal",
    "자료해석":"data",
    "농도":"calc","일률":"calc","거리속도":"calc","원가할인":"calc","경우의수":"calc","확률":"calc",
    "나이":"calc","비례":"calc","집합":"calc","평균":"calc","시계각":"calc","톱니바퀴":"calc",
    "방정식":"calc","부등식":"calc","도형":"calc","비율":"calc","최적화":"calc","응용계산":"calc",
    "시간계산":"calc","날짜":"calc","수열":"calc","집합추리":"calc",
    "명제·대우":"lreason","삼단논법":"lreason","명제연쇄":"lreason","명제추론":"lreason",
    "조건추리":"lreason","순서추리":"lreason","배치추리":"lreason","참거짓":"lreason","매칭추리":"lreason",
    "수리추리":"lreason",
    "문자규칙":"nreason","수규칙":"nreason","대응규칙":"nreason","도식추리":"nreason"
  };

  var AREAS = ["verbal", "data", "calc", "lreason", "nreason"];
  var MATERIALS = {};
  var BANK = { verbal: [], data: [], calc: [], lreason: [], nreason: [] };

  function addMaterials(src) {
    Object.keys(src || {}).forEach(function (k) { MATERIALS[k] = src[k]; });
  }

  /* 1) 기본 회차 파일 — verbal/quant/reason로 묶여 있던 문항을 유형에 따라 5영역으로 나눈다. */
  (window.SKCT_COG_EXAMS || []).slice().sort(function (a, b) { return a.exam - b.exam; })
    .forEach(function (ex) {
      addMaterials(ex.materials);
      ["verbal", "quant", "reason"].forEach(function (legacy) {
        (ex[legacy] || []).forEach(function (q) {
          var area = AREA_BY_TYPE[q.type];
          if (!area) area = legacy === "quant" ? "calc" : legacy === "reason" ? "lreason" : "verbal";
          q.exam = ex.exam;
          BANK[area].push(q);
        });
      });
    });

  /* 2) 보충 파일 — 영역이 이미 정해져 있다. */
  (window.SKCT_COG_EXT || []).slice().sort(function (a, b) { return a.exam - b.exam; })
    .forEach(function (ex) {
      addMaterials(ex.materials);
      AREAS.forEach(function (area) {
        (ex[area] || []).forEach(function (q) { q.exam = ex.exam; BANK[area].push(q); });
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
    "논지 약화와 %p·% 구분처럼 함정이 한 겹 더 있는 문항을 넣었다.",
    "원탁 배치와 계차수열 등 형태가 한 번 꺾인 문항이 섞여 있다.",
    "이차식 최적화, 세 집합, 자리별 연산 도식 등 자주 틀리는 유형을 모았다. 난도가 가장 높다.",
    "왕복 평균 속력, 복리 증가율, 최소 교집합처럼 직관이 어긋나기 쉬운 문항 위주다. 마무리 점검용."
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
