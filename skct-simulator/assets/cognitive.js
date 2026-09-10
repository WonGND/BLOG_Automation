/* SKCT 인지역량검사 시뮬레이터 — 응시·채점·결과
 * app.js가 노출한 window.SKCT의 셸과 유틸리티를 함께 쓴다.
 */
(function () {
  "use strict";

  var S = window.SKCT;
  if (!S) return;

  var el = S.el, clamp = S.clamp, pad2 = S.pad2, mmss = S.mmss;
  var store = S.store, toast = S.toast, appbar = S.appbar, go = S.go, render = S.render;

  var SECTIONS = window.SKCT_COG_SECTIONS;
  var MATERIALS = window.SKCT_COG_MATERIALS;
  var BANK = window.SKCT_COG_BANK;
  var SETS = window.SKCT_COG_SETS;

  var SEC_BY_CODE = {};
  SECTIONS.forEach(function (s) { SEC_BY_CODE[s.code] = s; });

  var CIRCLED = "①②③④⑤";
  var BANK_VERSION = 1;
  var K_SESSION = "skct.cog.v1.session";
  var K_HISTORY = "skct.cog.v1.history";

  /* 연습용 시뮬레이션 규준 — 정답률 기준 (실제 SK 규준이 아니다) */
  var NORM_RATE = 0.58, NORM_SD = 0.17;

  var Q_BY_ID = {};
  Object.keys(BANK).forEach(function (sec) {
    BANK[sec].forEach(function (q) { q.sec = sec; Q_BY_ID[q.id] = q; });
  });

  /* 세부 유형은 문항 수가 적어 정답률이 0%/100%로만 나온다.
     약점을 읽으려면 유형군 단위로 묶어야 한다. */
  var TYPE_GROUP = {
    "어휘관계": "어휘·어법", "유의어": "어휘·어법", "반의어": "어휘·어법", "다의어": "어휘·어법",
    "속담": "어휘·어법", "어법": "어휘·어법", "중의성": "어휘·어법",
    "빈칸추론": "독해·문맥", "문장배열": "독해·문맥", "주제파악": "독해·문맥",
    "내용일치": "독해·문맥", "접속어": "독해·문맥",
    "추론": "언어추론", "논지약화": "언어추론", "논리오류": "언어추론", "적용": "언어추론",
    "농도": "응용계산", "일률": "응용계산", "거리속도": "응용계산", "원가할인": "응용계산",
    "경우의수": "응용계산", "확률": "응용계산", "나이": "응용계산", "비례": "응용계산",
    "집합": "응용계산", "평균": "응용계산", "시계각": "응용계산",
    "자료해석": "자료해석",
    "명제·대우": "명제·논리", "삼단논법": "명제·논리", "명제연쇄": "명제·논리",
    "명제추론": "명제·논리", "집합추리": "명제·논리",
    "조건추리": "조건·순서추리", "순서추리": "조건·순서추리", "배치추리": "조건·순서추리",
    "참거짓": "조건·순서추리",
    "문자규칙": "규칙·도식", "수규칙": "규칙·도식", "대응규칙": "규칙·도식",
    "도식추리": "규칙·도식", "어휘추리": "규칙·도식"
  };
  function groupOf(q) {
    return TYPE_GROUP[q.type] || (SEC_BY_CODE[q.sec] ? SEC_BY_CODE[q.sec].name : "기타");
  }

  var cog = { session: null, result: null, timerId: null, submitting: false, ui: null };

  function setDef(id) { return SETS.filter(function (s) { return s.id === id; })[0]; }

  /* ---------------- 세션 ---------------- */

  function buildParts(def) {
    return def.parts.map(function (p) {
      var items = [];
      p.pick.forEach(function (spec) {
        for (var i = spec[1]; i < spec[2]; i++) items.push(BANK[spec[0]][i].id);
      });
      return { title: p.title, sec: p.sec, minutes: p.minutes, items: items };
    });
  }

  function newSession(setId) {
    var def = setDef(setId);
    return {
      bankVersion: BANK_VERSION,
      setId: setId,
      parts: buildParts(def),
      partIdx: 0,
      idx: 0,
      answers: {}, flags: {}, times: {},
      startedAt: null, carryMs: 0, paused: false, pausedMs: 0,
      qEnteredAt: null,
      partLog: [],
      finishedAt: null
    };
  }

  function curPart() { return cog.session.parts[cog.session.partIdx]; }
  function curItems() { return curPart().items; }
  function curQid() { return curItems()[cog.session.idx]; }

  function partElapsedMs() {
    var s = cog.session;
    if (!s || !s.startedAt) return s ? s.carryMs : 0;
    return s.paused ? s.carryMs : (Date.now() - s.startedAt) + s.carryMs;
  }
  function partRemainingSec() {
    return curPart().minutes * 60 - Math.round(partElapsedMs() / 1000);
  }

  function saveSession() {
    var s = cog.session;
    if (!s) return;
    if (s.startedAt && !s.paused && !s.finishedAt) {
      s.carryMs = partElapsedMs();
      s.startedAt = Date.now();
    }
    store(K_SESSION, s);
  }

  function isResumable(saved) {
    return !!(saved && !saved.finishedAt && saved.setId && setDef(saved.setId) &&
      saved.bankVersion === BANK_VERSION && saved.parts && saved.parts.length);
  }

  function histList() { return store(K_HISTORY) || []; }

  /* 현재 문항에 머문 시간을 누적하고 타이머를 끊는다. */
  function flushQuestionTime() {
    var s = cog.session;
    if (!s || !s.qEnteredAt) return;
    var qid = curQid();
    s.times[qid] = (s.times[qid] || 0) + (Date.now() - s.qEnteredAt);
    s.qEnteredAt = null;
  }
  function markQuestionEnter() {
    if (cog.session && !cog.session.paused) cog.session.qEnteredAt = Date.now();
  }

  /* ---------------- 일시정지 ---------------- */

  function pause() {
    var s = cog.session;
    if (!s || s.paused || cog.submitting) return;
    flushQuestionTime();
    s.carryMs = partElapsedMs();
    s.paused = true;
    s.startedAt = null;
    saveSession();
    render();
  }

  function resume() {
    var s = cog.session;
    if (!s || !s.paused) return;
    s.paused = false;
    s.startedAt = Date.now();
    saveSession();
    render();
  }

  function togglePause() { if (cog.session && cog.session.paused) resume(); else pause(); }

  /* ---------------- 홈(인지역량 탭) ---------------- */

  function homeBody(wrap) {
    var saved = store(K_SESSION);
    var hist = histList();
    var doneSets = {};
    hist.forEach(function (h) { doneSets[h.setId] = doneSets[h.setId] || h; });

    wrap.appendChild(el("div", { class: "hero" }, [
      el("div", { class: "eyebrow", text: "SK그룹 종합역량검사 · 인지역량검사 대비" }),
      el("h1", { text: "정답이 있는 검사. 시간을 멈춰 가며 풀 수도 있다" }),
      el("p", {
        class: "lede",
        text: "언어이해·수리·추리 세 영역을 실제 시험과 같은 형식으로 푼다. 심층역량검사와 달리 정답이 있으므로 채점되고, 모든 문항에 해설이 붙는다. 응시 중 언제든 시간을 멈췄다가 다시 시작할 수 있어, 실전 연습과 학습용 풀이 어느 쪽으로도 쓸 수 있다."
      }),
      el("div", { class: "hero-facts" }, [
        el("span", { html: "문항 <b>60개</b>" }),
        el("span", { html: "영역 <b>언어·수리·추리</b>" }),
        el("span", { html: "검사 세트 <b>5종</b>" }),
        el("span", { html: "전 문항 <b>해설 제공</b>" })
      ])
    ]));

    if (isResumable(saved)) {
      var sd = setDef(saved.setId);
      var part = saved.parts[saved.partIdx];
      wrap.appendChild(el("div", { class: "panel", style: "margin-bottom:32px; display:flex; align-items:center; gap:18px; flex-wrap:wrap;" }, [
        el("div", { style: "flex:1; min-width:240px;" }, [
          el("div", { class: "eyebrow", text: "진행 중인 검사" }),
          el("div", { style: "font-weight:700; margin-top:4px;", text: sd.code + " · " + sd.name }),
          el("div", { style: "font-size:13.5px; color:var(--ink-2); margin-top:2px;",
            text: part.title + " · " + part.items.length + "문항 중 " + (saved.idx + 1) + "번, 남은 시간 " +
              mmss(part.minutes * 60 - Math.round(saved.carryMs / 1000)) + (saved.paused ? " (일시정지됨)" : "") })
        ]),
        el("button", {
          class: "btn btn-primary", type: "button", text: "이어서 응시",
          onclick: function () {
            cog.session = saved;
            cog.session.paused = true;
            cog.session.startedAt = null;
            go("cog-test");
          }
        }),
        el("button", {
          class: "btn", type: "button", text: "버리기",
          onclick: function () { store(K_SESSION, null); render(); }
        })
      ]));
    }

    var grid = el("div", { class: "home-grid" });
    var left = el("div", {});

    left.appendChild(el("div", { class: "section-head" }, [
      el("h2", { text: "검사 세트 선택" }),
      el("span", { class: "hint", text: "시작 전에 준비 화면이 한 번 뜬다" })
    ]));

    var list = el("div", { class: "setlist" });
    SETS.forEach(function (st) {
      var parts = buildParts(st);
      var total = parts.reduce(function (a, p) { return a + p.items.length; }, 0);
      var mins = parts.reduce(function (a, p) { return a + p.minutes; }, 0);
      var pace = Math.round(mins * 60 / total);
      var done = doneSets[st.id];

      var body = el("div", {}, [
        el("div", { class: "setrow-name", text: st.name }),
        el("div", { class: "setrow-sum", text: st.summary }),
        el("div", { class: "setrow-detail", text: st.detail })
      ]);
      if (done) {
        body.appendChild(el("div", { class: "setrow-done" }, [
          el("span", { text: "✓ 응시함 · 정답 " + done.correct + "/" + done.total + " (" + done.rate + "%)" })
        ]));
      }

      list.appendChild(el("button", {
        class: "setrow", type: "button",
        onclick: function () { startSet(st.id); }
      }, [
        el("div", { class: "setrow-code" }, [
          el("span", { text: st.code }),
          el("span", { class: "tag", text: st.tag })
        ]),
        body,
        el("div", { style: "display:flex; align-items:flex-start; gap:16px;" }, [
          el("div", { class: "setrow-meta" }, [
            el("span", { text: total + "문항" }),
            el("span", { text: mins + "분" }),
            el("span", { class: "pace", text: "문항당 " + pace + "초" })
          ]),
          el("span", { class: "setrow-go", text: "→" })
        ])
      ]));
    });
    left.appendChild(list);

    left.appendChild(el("div", { class: "section-head", style: "margin-top:40px;" }, [
      el("h2", { text: "응시 기록" }),
      hist.length ? el("button", {
        class: "linkbtn", type: "button", text: "기록 전체 삭제",
        onclick: function () { store(K_HISTORY, null); render(); }
      }) : el("span", { class: "hint", text: "이 브라우저에만 저장된다" })
    ]));

    if (!hist.length) {
      left.appendChild(el("div", { class: "empty", text: "아직 응시 기록이 없다. 위에서 세트를 하나 골라 시작하면 결과가 여기에 쌓인다." }));
    } else {
      var tbody = el("tbody", {});
      hist.forEach(function (h) {
        var d = new Date(h.finishedAt);
        tbody.appendChild(el("tr", {}, [
          el("td", { text: h.setCode + " " + h.setName }),
          el("td", { text: d.getFullYear() + "." + pad2(d.getMonth() + 1) + "." + pad2(d.getDate()) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) }),
          el("td", { class: "num", text: h.correct + "/" + h.total }),
          el("td", { class: "num", text: h.rate + "%" }),
          el("td", { class: "num", text: mmss(h.elapsedSec) }),
          el("td", {}, [el("button", {
            class: "linkbtn", type: "button",
            text: h.full ? "결과 보기" : "원자료 없음",
            disabled: h.full ? null : "",
            onclick: function () { if (h.full) { cog.result = h.full; go("cog-result"); } }
          })])
        ]));
      });
      left.appendChild(el("div", { class: "tablescroll" }, [
        el("table", { class: "histtable" }, [
          el("thead", {}, [el("tr", {}, [
            el("th", { text: "세트" }), el("th", { text: "응시 시각" }),
            el("th", { class: "num", text: "정답" }), el("th", { class: "num", text: "정답률" }),
            el("th", { class: "num", text: "소요" }), el("th", { text: "" })
          ])]),
          tbody
        ])
      ]));
    }

    var right = el("div", { class: "stack" }, [
      el("div", { class: "panel" }, [
        el("h3", { text: "시간 멈추기" }),
        el("p", { style: "font-size:13.5px; color:var(--ink-2);", text: "응시 화면 오른쪽 위의 일시정지 버튼이나 키보드 P를 누르면 타이머가 멈추고 문제가 가려진다. 다시 누르면 멈춘 지점부터 이어진다." }),
        el("div", { class: "notice", style: "margin-top:14px;", html: "실전 감각을 보려면 <b>멈추지 않고</b> 한 번 끝까지 풀고, 복습할 때는 <b>자유롭게 멈춰 가며</b> 푸는 편이 낫다. 멈춘 시간은 문항별 소요 시간에 포함되지 않으므로 결과의 시간 분석은 그대로 믿어도 된다." })
      ]),
      el("div", { class: "panel" }, [
        el("h3", { text: "영역 구성" }),
        el("div", { class: "seclist" }, SECTIONS.map(function (sec) {
          return el("div", { class: "secitem" }, [
            el("div", { class: "secitem-name" }, [
              el("span", { text: sec.name }),
              el("span", { class: "secitem-min", text: sec.minutes + "분 · 20문항" })
            ]),
            el("p", { class: "secitem-desc", text: sec.desc })
          ]);
        }))
      ])
    ]);

    grid.appendChild(left);
    grid.appendChild(right);
    wrap.appendChild(grid);

    wrap.appendChild(el("div", { class: "foot", text: "문항은 공개된 검사 형식을 참고해 자체 제작한 연습 문항이며 SKCT 기출이 아니다. 영역 구성과 제한 시간은 최근 공개된 형식을 기준으로 잡았으므로 실제 시험과 다를 수 있다. 추정 백분위는 정답률을 평균 " + Math.round(NORM_RATE * 100) + "%, 표준편차 " + Math.round(NORM_SD * 100) + "%p의 정규분포로 환산한 값으로, 실제 응시자 집단 대비 순위가 아니다. 응답은 서버로 전송되지 않고 이 브라우저에만 저장된다." }));
  }

  function startSet(id) {
    cog.session = newSession(id);
    cog.result = null;
    saveSession();
    go("cog-break");
  }

  /* ---------------- 준비·쉬는 화면 ---------------- */

  function renderBreak() {
    var s = cog.session;
    var def = setDef(s.setId);
    var part = s.parts[s.partIdx];
    var isFirst = s.partIdx === 0;

    var frag = document.createDocumentFragment();
    frag.appendChild(appbar([
      el("div", { class: "appbar-spacer" }),
      el("button", {
        class: "iconbtn", type: "button", text: "나가기",
        onclick: function () {
          if (confirm("검사를 나간다. 진행 상황은 저장되어 나중에 이어서 응시할 수 있다.")) {
            saveSession(); stopTimer(); go("home");
          }
        }
      })
    ]));

    var wrap = el("div", { class: "wrap narrow" });
    var prev = s.partLog[s.partLog.length - 1];

    wrap.appendChild(el("div", { class: "readyscreen" }, [
      el("div", { class: "eyebrow", text: def.code + " · " + def.name }),
      el("h1", { text: part.title }),
      el("div", { class: "readymeta" }, [
        el("div", { class: "readystat" }, [
          el("span", { class: "k", text: "문항 수" }),
          el("span", { class: "v num", text: part.items.length + "문항" })
        ]),
        el("div", { class: "readystat" }, [
          el("span", { class: "k", text: "제한 시간" }),
          el("span", { class: "v num", text: part.minutes + "분" })
        ]),
        el("div", { class: "readystat" }, [
          el("span", { class: "k", text: "문항당" }),
          el("span", { class: "v num", text: Math.round(part.minutes * 60 / part.items.length) + "초" })
        ])
      ]),
      prev ? el("div", { class: "prevresult" }, [
        el("span", { text: "직전 " + prev.title + " 소요 " + mmss(prev.elapsedSec) + " · 응답 " + prev.answered + "/" + prev.total + "문항" }),
        el("span", { class: "muted", text: "채점 결과는 마지막 교시가 끝난 뒤 한 번에 나온다" })
      ]) : null,
      el("p", { class: "readydesc", text: isFirst
        ? "시작 버튼을 누르면 타이머가 돌기 시작한다. 응시 중 언제든 일시정지할 수 있고, 멈춘 시간은 기록에 포함되지 않는다."
        : "이전 교시에서 남은 시간은 넘어오지 않는다. 준비가 되면 시작 버튼을 누르면 된다." }),
      el("div", { class: "readyactions" }, [
        el("button", {
          class: "btn btn-primary", type: "button",
          text: (isFirst ? "시작하기" : "이 교시 시작하기"),
          onclick: function () {
            s.idx = 0;
            s.carryMs = 0;
            s.paused = false;
            s.startedAt = Date.now();
            saveSession();
            go("cog-test");
          }
        }),
        el("button", { class: "btn", type: "button", text: "나중에 하기", onclick: function () { saveSession(); go("home"); } })
      ]),
      el("div", { class: "kbdhint", html:
        "<kbd>1</kbd>~<kbd>5</kbd> 선택지 · <kbd>←</kbd><kbd>→</kbd> 문항 이동 · <kbd>F</kbd> 나중에 볼 문항 표시 · <kbd>P</kbd> 일시정지" })
    ]));

    frag.appendChild(wrap);
    return frag;
  }

  /* ---------------- 응시 화면 ---------------- */

  function materialNode(mat) {
    if (!mat) return null;
    var box = el("div", { class: "material" });
    box.appendChild(el("div", { class: "material-label", text: mat.label }));
    if (mat.kind === "passage") {
      box.appendChild(el("p", { class: "material-text", text: mat.text }));
    } else if (mat.kind === "table") {
      if (mat.unit) box.appendChild(el("div", { class: "material-unit", text: mat.unit }));
      box.appendChild(el("div", { class: "tablescroll" }, [
        el("table", { class: "datatable" }, [
          el("thead", {}, [el("tr", {}, mat.head.map(function (h, i) {
            return el("th", { class: i ? "num" : "", text: h });
          }))]),
          el("tbody", {}, mat.rows.map(function (r) {
            return el("tr", {}, r.map(function (c, i) { return el("td", { class: i ? "num" : "", text: c }); }));
          }))
        ])
      ]));
    }
    return box;
  }

  function renderTest() {
    var s = cog.session;
    var def = setDef(s.setId);
    var part = curPart();
    var items = part.items;
    s.idx = clamp(s.idx, 0, items.length - 1);
    var qid = items[s.idx];
    var q = Q_BY_ID[qid];

    var ui = { choiceBtns: [], flagBtn: null, navBtns: [], statusEl: null };

    var frag = document.createDocumentFragment();
    var timer = el("span", { class: "timer", id: "cogtimer", text: mmss(Math.max(0, partRemainingSec())) });

    frag.appendChild(appbar([
      el("div", { class: "appbar-spacer" }),
      el("span", { class: "setcode", text: part.title }),
      timer,
      el("button", {
        class: "iconbtn" + (s.paused ? " is-on" : ""), type: "button",
        text: s.paused ? "▶ 계속" : "⏸ 정지",
        title: "일시정지 / 계속 (P)",
        onclick: togglePause
      }),
      el("button", {
        class: "iconbtn", type: "button", text: "나가기",
        onclick: function () {
          if (confirm("검사를 나간다. 진행 상황은 저장되어 나중에 이어서 응시할 수 있다.")) {
            flushQuestionTime();
            if (!s.paused) { s.carryMs = partElapsedMs(); s.paused = true; s.startedAt = null; }
            saveSession(); stopTimer(); go("home");
          }
        }
      })
    ]));

    frag.appendChild(el("div", { class: "progressbar" }, [
      el("span", { style: "width:" + ((s.idx) / items.length * 100) + "%" })
    ]));

    var wrap = el("div", { class: "wrap narrow" });

    if (s.paused) {
      wrap.appendChild(el("div", { class: "pausepanel" }, [
        el("div", { class: "pause-ico", text: "⏸" }),
        el("h2", { text: "시간이 멈춰 있다" }),
        el("p", { text: "문제는 잠시 가려 두었다. 계속 누르면 멈춘 지점에서 그대로 이어진다. 멈춰 있는 동안은 소요 시간에 잡히지 않는다." }),
        el("div", { class: "pausestats" }, [
          el("div", {}, [el("span", { class: "k", text: "남은 시간" }), el("span", { class: "v num", text: mmss(Math.max(0, partRemainingSec())) })]),
          el("div", {}, [el("span", { class: "k", text: "진행" }), el("span", { class: "v num", text: (s.idx + 1) + " / " + items.length + "문항" })]),
          el("div", {}, [el("span", { class: "k", text: "응답 완료" }), el("span", { class: "v num", text: answeredCount() + "문항" })])
        ]),
        el("div", { class: "readyactions" }, [
          el("button", { class: "btn btn-primary", type: "button", text: "▶ 계속 풀기", onclick: resume }),
          el("button", { class: "btn", type: "button", text: "나중에 하기", onclick: function () { saveSession(); go("home"); } })
        ])
      ]));
      frag.appendChild(wrap);
      cog.ui = null;
      return frag;
    }

    wrap.appendChild(el("div", { class: "testhead" }, [
      el("div", { class: "pos" }, [
        el("b", { text: String(s.idx + 1) }),
        el("span", { text: " / " + items.length + " 문항" })
      ]),
      el("div", { class: "setname", text: (SEC_BY_CODE[q.sec] ? SEC_BY_CODE[q.sec].name : part.title) + " · " + q.type })
    ]));

    var card = el("div", { class: "qcard" });
    var mat = q.material ? MATERIALS[q.material] : null;
    if (mat) card.appendChild(materialNode(mat));

    card.appendChild(el("div", { class: "stembox" }, [
      el("p", { class: "stem", text: q.stem })
    ]));

    var list = el("div", { class: "choicelist" });
    q.choices.forEach(function (c, i) {
      var b = el("button", {
        class: "choice", type: "button",
        "aria-pressed": String(s.answers[qid] === i),
        onclick: function () { pick(i); }
      }, [
        el("span", { class: "choice-no", text: CIRCLED[i] }),
        el("span", { class: "choice-text", text: c })
      ]);
      ui.choiceBtns.push(b);
      list.appendChild(b);
    });
    card.appendChild(list);

    ui.flagBtn = el("button", {
      class: "flagbtn" + (s.flags[qid] ? " is-on" : ""), type: "button",
      onclick: toggleFlag,
      text: (s.flags[qid] ? "★ 표시함" : "☆ 나중에 다시 보기")
    });
    card.appendChild(el("div", { class: "qfoot" }, [
      ui.flagBtn,
      el("span", { class: "qfoot-hint", text: "확신이 없으면 표시해 두고 넘어가는 편이 낫다" })
    ]));

    wrap.appendChild(card);

    ui.statusEl = el("span", { class: "status" });
    wrap.appendChild(el("div", { class: "navrow" }, [
      el("button", {
        class: "btn", type: "button", text: "← 이전", disabled: s.idx === 0 ? "" : null,
        onclick: function () { move(-1); }
      }),
      ui.statusEl,
      el("div", { class: "spacer" }),
      s.idx === items.length - 1
        ? el("button", { class: "btn btn-primary", type: "button", text: "이 교시 마치기", onclick: function () { finishPart(false); } })
        : el("button", { class: "btn btn-primary", type: "button", text: "다음 →", onclick: function () { move(1); } })
    ]));

    var nav = el("div", { class: "qnav" });
    items.forEach(function (id, i) {
      var b = el("button", {
        class: "qnav-btn" + (i === s.idx ? " is-cur" : "") +
          (s.answers[id] !== undefined ? " is-done" : "") + (s.flags[id] ? " is-flag" : ""),
        type: "button",
        title: (i + 1) + "번" + (s.answers[id] !== undefined ? " · 응답함" : " · 미응답") + (s.flags[id] ? " · 표시함" : ""),
        text: String(i + 1),
        onclick: function () { goTo(i); }
      });
      ui.navBtns.push(b);
      nav.appendChild(b);
    });
    wrap.appendChild(el("div", { class: "qnav-wrap" }, [
      el("div", { class: "qnav-head" }, [
        el("span", { text: "문항 이동" }),
        el("span", { class: "qnav-legend" }, [
          el("span", { class: "lg lg-done" }), el("span", { text: "응답" }),
          el("span", { class: "lg lg-flag" }), el("span", { text: "표시" })
        ])
      ]),
      nav,
      el("div", { class: "navtail" }, [
        el("button", { class: "btn", type: "button", text: "이 교시 마치기", onclick: function () { finishPart(false); } })
      ])
    ]));

    wrap.appendChild(el("div", { class: "kbdhint", html:
      "<kbd>1</kbd>~<kbd>5</kbd> 선택지 · <kbd>←</kbd><kbd>→</kbd> 문항 이동 · <kbd>F</kbd> 표시 · <kbd>P</kbd> 일시정지" }));

    frag.appendChild(wrap);
    cog.ui = ui;
    refreshStatus();
    return frag;
  }

  function answeredCount() {
    var s = cog.session;
    return curItems().filter(function (id) { return s.answers[id] !== undefined; }).length;
  }

  function refreshStatus() {
    var ui = cog.ui;
    if (!ui || !ui.statusEl) return;
    var items = curItems();
    var done = answeredCount();
    var flagged = items.filter(function (id) { return cog.session.flags[id]; }).length;
    var left = items.length - done;
    ui.statusEl.textContent = left
      ? "미응답 " + left + "문항" + (flagged ? " · 표시 " + flagged + "개" : "")
      : "전 문항 응답 완료" + (flagged ? " · 표시 " + flagged + "개" : "");
    ui.statusEl.className = "status" + (left ? " incomplete" : "");
  }

  function pick(i) {
    var s = cog.session;
    if (!s || s.paused) return;
    var qid = curQid();
    s.answers[qid] = i;
    saveSession();
    if (cog.ui) {
      cog.ui.choiceBtns.forEach(function (b, n) { b.setAttribute("aria-pressed", String(n === i)); });
      var nb = cog.ui.navBtns[s.idx];
      if (nb && nb.className.indexOf("is-done") < 0) nb.className += " is-done";
      refreshStatus();
    } else render();
  }

  function toggleFlag() {
    var s = cog.session;
    if (!s || s.paused) return;
    var qid = curQid();
    if (s.flags[qid]) delete s.flags[qid]; else s.flags[qid] = true;
    saveSession();
    if (cog.ui) {
      var on = !!s.flags[qid];
      cog.ui.flagBtn.className = "flagbtn" + (on ? " is-on" : "");
      cog.ui.flagBtn.textContent = on ? "★ 표시함" : "☆ 나중에 다시 보기";
      var nb = cog.ui.navBtns[s.idx];
      if (nb) nb.className = nb.className.replace(" is-flag", "") + (on ? " is-flag" : "");
      refreshStatus();
    } else render();
  }

  function goTo(i) {
    var s = cog.session;
    if (!s || s.paused) return;
    var items = curItems();
    i = clamp(i, 0, items.length - 1);
    if (i === s.idx) return;
    flushQuestionTime();
    s.idx = i;
    saveSession();
    render();
    window.scrollTo(0, 0);
  }
  function move(d) { goTo(cog.session.idx + d); }

  /* ---------------- 교시 종료·채점 ---------------- */

  function finishPart(auto) {
    var s = cog.session;
    if (!s || cog.submitting) return;
    cog.submitting = true;
    stopTimer();
    flushQuestionTime();
    var part = curPart();
    s.partLog.push({
      title: part.title,
      elapsedSec: Math.min(part.minutes * 60, Math.round(partElapsedMs() / 1000)),
      limitSec: part.minutes * 60,
      total: part.items.length,
      answered: part.items.filter(function (id) { return s.answers[id] !== undefined; }).length,
      autoSubmitted: !!auto
    });

    if (s.partIdx < s.parts.length - 1) {
      s.partIdx++;
      s.idx = 0;
      s.carryMs = 0;
      s.paused = false;
      s.startedAt = null;
      cog.submitting = false;
      saveSession();
      go("cog-break");
      if (auto) toast("제한 시간이 끝나 다음 교시로 넘어간다.");
      return;
    }

    s.finishedAt = Date.now();
    var result;
    try {
      result = grade(s);
    } catch (err) {
      cog.submitting = false;
      toast("채점 중 문제가 생겼다. 응답은 그대로 남아 있으니 다시 시도하면 된다.");
      startTimer();
      return;
    }
    pushHistory(result);
    store(K_SESSION, null);
    cog.result = result;
    cog.session = null;
    cog.ui = null;
    cog.submitting = false;
    go("cog-result");
    if (auto) toast("제한 시간이 끝나 자동 제출되었다.");
  }

  function grade(s) {
    var def = setDef(s.setId);
    var rows = [], bySec = {}, byGroup = {};
    var n = 0;

    s.parts.forEach(function (part, pi) {
      part.items.forEach(function (qid, qi) {
        var q = Q_BY_ID[qid];
        var picked = s.answers[qid];
        var ok = picked === q.answer;
        n++;
        rows.push({
          no: n, part: part.title, partIdx: pi, order: qi + 1,
          id: qid, sec: q.sec, secName: SEC_BY_CODE[q.sec] ? SEC_BY_CODE[q.sec].name : q.sec,
          type: q.type, group: groupOf(q), level: q.level,
          picked: picked === undefined ? null : picked,
          answer: q.answer, correct: ok,
          flagged: !!s.flags[qid],
          timeSec: Math.round((s.times[qid] || 0) / 1000)
        });
        bySec[q.sec] = bySec[q.sec] || { code: q.sec, name: SEC_BY_CODE[q.sec].name, total: 0, correct: 0, answered: 0, timeSec: 0 };
        bySec[q.sec].total++;
        if (ok) bySec[q.sec].correct++;
        if (picked !== undefined) bySec[q.sec].answered++;
        bySec[q.sec].timeSec += Math.round((s.times[qid] || 0) / 1000);

        var g = groupOf(q);
        byGroup[g] = byGroup[g] || { group: g, sec: q.sec, secName: SEC_BY_CODE[q.sec].name, total: 0, correct: 0 };
        byGroup[g].total++;
        if (ok) byGroup[g].correct++;
      });
    });

    var correct = rows.filter(function (r) { return r.correct; }).length;
    var answered = rows.filter(function (r) { return r.picked !== null; }).length;
    var rate = rows.length ? Math.round(correct / rows.length * 1000) / 10 : 0;
    var z = (correct / (rows.length || 1) - NORM_RATE) / NORM_SD;
    var pct = clamp(Math.round(50 * (1 + S.erf(z / Math.SQRT2))), 1, 99);

    var secList = Object.keys(bySec).map(function (k) {
      var b = bySec[k];
      b.rate = b.total ? Math.round(b.correct / b.total * 1000) / 10 : 0;
      b.avgSec = b.total ? Math.round(b.timeSec / b.total) : 0;
      return b;
    }).sort(function (a, b) {
      return SECTIONS.map(function (x) { return x.code; }).indexOf(a.code) -
             SECTIONS.map(function (x) { return x.code; }).indexOf(b.code);
    });

    var groupList = Object.keys(byGroup).map(function (k) {
      var t = byGroup[k];
      t.rate = Math.round(t.correct / t.total * 100);
      return t;
    }).sort(function (a, b) { return a.rate - b.rate || b.total - a.total; });

    var totalElapsed = s.partLog.reduce(function (a, p) { return a + p.elapsedSec; }, 0);
    var totalLimit = s.partLog.reduce(function (a, p) { return a + p.limitSec; }, 0);

    return {
      version: 1, kind: "cognitive",
      setId: s.setId, setCode: def.code, setName: def.name,
      finishedAt: s.finishedAt, elapsedSec: totalElapsed, limitSec: totalLimit,
      total: rows.length, correct: correct, answered: answered, rate: rate,
      percentile: pct,
      sections: secList, groups: groupList, parts: s.partLog, rows: rows,
      norm: { rate: NORM_RATE, sd: NORM_SD, note: "연습용 시뮬레이션 규준 — 실제 SK 규준이 아니다" }
    };
  }

  function pushHistory(r) {
    var h = histList();
    h.unshift({
      id: "c" + r.finishedAt, setId: r.setId, setCode: r.setCode, setName: r.setName,
      finishedAt: r.finishedAt, elapsedSec: r.elapsedSec,
      total: r.total, correct: r.correct, rate: r.rate, percentile: r.percentile,
      full: r
    });
    h = h.slice(0, 30);
    h.forEach(function (item, i) { if (i >= 8) delete item.full; });
    var ok = store(K_HISTORY, h);
    while (!ok && h.length > 1) {
      h = h.slice(0, Math.max(1, h.length - 4));
      h.forEach(function (item, i) { if (i >= 2) delete item.full; });
      ok = store(K_HISTORY, h);
    }
    if (!ok && S.storageOK()) toast("저장 공간이 부족해 이번 결과를 기록에 남기지 못했다. 결과 데이터를 내려받아 두는 것이 좋다.");
  }

  /* ---------------- 타이머 ---------------- */

  function startTimer() {
    stopTimer();
    cog.timerId = setInterval(function () {
      var s = cog.session;
      if (!s || cog.submitting || S.state.screen !== "cog-test") return;
      if (s.paused) return;
      var left = partRemainingSec();
      var t = document.getElementById("cogtimer");
      if (t) {
        t.textContent = mmss(Math.max(0, left));
        t.className = "timer" + (left <= 60 ? " danger" : left <= 180 ? " warn" : "");
      }
      if (left <= 0) finishPart(true);
    }, 1000);
  }
  function stopTimer() { if (cog.timerId) { clearInterval(cog.timerId); cog.timerId = null; } }

  /* ---------------- 결과 ---------------- */

  function rateBar(label, rate, sub, tone) {
    return el("div", { class: "bar-row" + (tone === "low" ? " is-low" : "") }, [
      el("div", { class: "bar-name", text: label }),
      el("div", { class: "bar-track" }, [
        el("div", { class: "bar-fill", style: "width:" + rate + "%" }),
        el("div", { class: "bar-mid" })
      ]),
      el("div", { class: "bar-tag", text: tone === "low" ? "보완" : "" }),
      el("div", { class: "bar-val num", text: Math.round(rate) })
    ]);
  }

  function renderResult() {
    var r = cog.result;
    var frag = document.createDocumentFragment();
    frag.appendChild(appbar([
      el("div", { class: "appbar-spacer" }),
      el("button", { class: "iconbtn", type: "button", text: "← 세트 목록", onclick: function () { go("home"); } })
    ]));

    var wrap = el("div", { class: "wrap" });
    var d = new Date(r.finishedAt);

    wrap.appendChild(el("div", { class: "hero", style: "margin-bottom:22px; gap:8px;" }, [
      el("div", { class: "eyebrow", text: "검사 결과 · " + r.setName }),
      el("h1", { style: "font-size:clamp(22px,3vw,28px);", text: "인지역량 채점 리포트" })
    ]));

    var tone = r.rate >= 70 ? "good" : r.rate >= 50 ? "warning" : "critical";
    wrap.appendChild(el("div", { class: "verdict is-" + tone }, [
      el("div", { class: "stripe" }),
      el("div", { class: "verdict-body" }, [
        el("div", { class: "scoreline" }, [
          el("div", { class: "bigscore" }, [
            el("span", { class: "n num", text: String(r.correct) }),
            el("span", { class: "d num", text: "/ " + r.total })
          ]),
          el("div", { class: "scoremeta" }, [
            el("div", { class: "scorerate num", text: "정답률 " + r.rate + "%" }),
            el("div", { class: "scorepct num", text: "추정 백분위 " + r.percentile })
          ])
        ]),
        el("p", { text: r.rate >= 70
          ? "안정적인 정답률이다. 이 상태를 유지하면서 아래 유형별 정답률에서 낮은 칸만 메우면 된다."
          : r.rate >= 50
            ? "절반은 넘겼다. 아래 유형별 정답률에서 낮은 두세 유형만 잡아도 총점이 눈에 띄게 올라간다."
            : "지금은 유형별 약점보다 시간 배분과 기본 유형 정리가 먼저다. 오답 노트의 해설을 유형 단위로 묶어 보는 편이 빠르다." }),
        el("div", { class: "verdict-meta" }, [
          el("span", { text: "응시 " + d.getFullYear() + "." + pad2(d.getMonth() + 1) + "." + pad2(d.getDate()) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) }),
          el("span", { text: "소요 " + mmss(r.elapsedSec) + " / 제한 " + mmss(r.limitSec) }),
          el("span", { text: "응답 " + r.answered + "/" + r.total + "문항" }),
          r.parts.some(function (p) { return p.autoSubmitted; }) ? el("span", { text: "시간 초과 교시 있음" }) : null
        ])
      ])
    ]));

    var grid = el("div", { class: "resgrid" });
    var main = el("div", { class: "stack" });
    var side = el("div", { class: "stack" });

    /* 영역별 */
    var secBars = el("div", { class: "bars" });
    r.sections.forEach(function (s2) {
      secBars.appendChild(rateBar(s2.name, s2.rate, null, s2.rate < 50 ? "low" : null));
    });
    secBars.appendChild(el("div", { class: "bar-axis" }, [
      el("span", { text: "0" }), el("span", { text: "50" }), el("span", { text: "100 (%)" })
    ]));
    var secTable = el("table", { class: "reviewtable", style: "margin-top:16px;" }, [
      el("thead", {}, [el("tr", {}, [
        el("th", { text: "영역" }), el("th", { class: "num", text: "정답" }),
        el("th", { class: "num", text: "정답률" }), el("th", { class: "num", text: "소요" }),
        el("th", { class: "num", text: "문항당" })
      ])]),
      el("tbody", {}, r.sections.map(function (s2) {
        return el("tr", {}, [
          el("td", { class: "stmt-col", text: s2.name }),
          el("td", { class: "num", text: s2.correct + "/" + s2.total }),
          el("td", { class: "num", text: s2.rate + "%" }),
          el("td", { class: "num", text: mmss(s2.timeSec) }),
          el("td", { class: "num", text: s2.avgSec + "초" })
        ]);
      }))
    ]);
    main.appendChild(el("div", { class: "card" }, [
      el("div", { class: "card-head" }, [
        el("h2", { text: "영역별 정답률" }),
        el("span", { class: "note", text: "소요 시간 포함" })
      ]),
      el("div", { class: "card-body" }, [secBars, el("div", { class: "tablescroll" }, [secTable])])
    ]));

    /* 유형군별 */
    var groups = (r.groups || []).filter(function (t) { return t.total >= 2; });
    var groupBody = el("div", { class: "card-body" });
    if (groups.length >= 2) {
      var gBars = el("div", { class: "bars" });
      groups.forEach(function (t) {
        gBars.appendChild(rateBar(t.group + " (" + t.correct + "/" + t.total + ")", t.rate, null, t.rate < 50 ? "low" : null));
      });
      gBars.appendChild(el("div", { class: "bar-axis" }, [
        el("span", { text: "0" }), el("span", { text: "50" }), el("span", { text: "100 (%)" })
      ]));
      groupBody.appendChild(gBars);
      groupBody.appendChild(el("p", { style: "margin-top:14px; font-size:13px; color:var(--ink-2);", text: "괄호 안은 맞힌 수와 문항 수다. 문항 수가 적은 유형군은 한 문제 차이로 비율이 크게 흔들리니 순위만 참고하면 된다." }));
    } else {
      groupBody.appendChild(el("p", { style: "font-size:14px; line-height:1.75; color:var(--ink-2); max-width:44em;", text: "이 세트는 유형군마다 문항이 한두 개뿐이라 유형별 정답률을 계산해도 의미가 없다. 유형별 약점을 보려면 영역 집중 세트나 실전 모의를 풀어야 한다. 지금은 아래 오답 노트의 해설을 유형 단위로 읽는 편이 낫다." }));
    }
    main.appendChild(el("div", { class: "card" }, [
      el("div", { class: "card-head" }, [
        el("h2", { text: "유형군별 정답률" }),
        el("span", { class: "note", text: groups.length >= 2 ? "낮은 순 — 위쪽부터 잡으면 된다" : "문항 수 부족" })
      ]),
      groupBody
    ]));

    /* 오답 노트 */
    var wrongs = r.rows.filter(function (x) { return !x.correct; });
    var noteBody = el("div", { class: "card-body" });
    if (!wrongs.length) {
      noteBody.appendChild(el("p", { style: "color:var(--ink-2); font-size:14.5px;", text: "틀린 문항이 없다. 아래 '전체 문항 다시 보기'에서 해설을 확인하면 된다." }));
    } else {
      var notes = el("div", { class: "wrongnotes" });
      wrongs.forEach(function (x) {
        var q = Q_BY_ID[x.id];
        var mat = q.material ? MATERIALS[q.material] : null;
        notes.appendChild(el("details", { class: "wrongnote" }, [
          el("summary", {}, [
            el("span", { class: "wn-no num", text: x.no + "번" }),
            el("span", { class: "wn-meta", text: x.secName + " · " + x.type }),
            el("span", { class: "wn-mark", text: x.picked === null ? "미응답" : "오답" }),
            el("span", { class: "wn-time num", text: x.timeSec + "초" })
          ]),
          el("div", { class: "wn-body" }, [
            mat ? materialNode(mat) : null,
            el("p", { class: "stem", text: q.stem }),
            el("div", { class: "wn-choices" }, q.choices.map(function (c, i) {
              return el("div", {
                class: "wn-choice" + (i === q.answer ? " is-answer" : "") + (i === x.picked ? " is-picked" : "")
              }, [
                el("span", { class: "choice-no", text: CIRCLED[i] }),
                el("span", { class: "choice-text", text: c }),
                el("span", { class: "wn-badge", text: i === q.answer ? "정답" : (i === x.picked ? "내 답" : "") })
              ]);
            })),
            el("div", { class: "wn-explain" }, [
              el("b", { text: "해설" }),
              el("p", { text: q.explain })
            ])
          ])
        ]));
      });
      noteBody.appendChild(notes);
    }
    main.appendChild(el("div", { class: "card" }, [
      el("div", { class: "card-head" }, [
        el("h2", { text: "오답 노트" }),
        el("span", { class: "note", text: wrongs.length + "문항" })
      ]),
      noteBody
    ]));

    /* 전체 문항 표 */
    main.appendChild(el("div", { class: "card" }, [
      el("div", { class: "card-head" }, [
        el("h2", { text: "전체 문항 기록" }),
        el("span", { class: "note", text: "소요 시간·표시 여부" })
      ]),
      el("div", { style: "padding:0;" }, [
        el("details", { class: "review" }, [
          el("summary", {}, [
            el("span", { text: "문항별 결과 펼쳐 보기 (" + r.rows.length + "문항)" }),
            el("span", { class: "caret", text: "펼치기 ▾" })
          ]),
          el("div", { style: "padding:0 22px 22px;" }, [
            el("div", { class: "tablescroll" }, [
              el("table", { class: "reviewtable" }, [
                el("thead", {}, [el("tr", {}, [
                  el("th", { text: "번호" }), el("th", { text: "영역" }), el("th", { text: "유형" }),
                  el("th", { class: "num", text: "내 답" }), el("th", { class: "num", text: "정답" }),
                  el("th", { class: "num", text: "정오" }), el("th", { class: "num", text: "소요" }),
                  el("th", { class: "num", text: "표시" })
                ])]),
                el("tbody", {}, r.rows.map(function (x) {
                  return el("tr", {}, [
                    el("td", { class: "num", text: String(x.no) }),
                    el("td", { class: "rev", text: x.secName }),
                    el("td", { class: "rev", text: x.type }),
                    el("td", { class: "num", text: x.picked === null ? "—" : CIRCLED[x.picked] }),
                    el("td", { class: "num", text: CIRCLED[x.answer] }),
                    el("td", { class: "num " + (x.correct ? "ok" : "no"), text: x.correct ? "O" : "X" }),
                    el("td", { class: "num", text: x.timeSec + "초" }),
                    el("td", { class: "num", text: x.flagged ? "★" : "" })
                  ]);
                }))
              ])
            ])
          ])
        ])
      ])
    ]));

    /* 사이드 — 교시별 시간 / 시간을 많이 쓴 문항 */
    side.appendChild(el("div", { class: "card" }, [
      el("div", { class: "card-head" }, [el("h2", { text: "교시별 시간" })]),
      el("div", { class: "card-body" }, [
        el("div", { class: "meters" }, r.parts.map(function (p) {
          var used = Math.min(100, Math.round(p.elapsedSec / p.limitSec * 100));
          return el("div", {}, [
            el("div", { class: "meter-head" }, [
              el("span", { class: "meter-name", text: p.title }),
              el("span", { class: "meter-val", text: mmss(p.elapsedSec) + " / " + mmss(p.limitSec) })
            ]),
            el("div", { class: "meter-track" }, [
              el("div", { class: "meter-fill", style: "width:" + used + "%; background:" + (p.autoSubmitted ? "var(--critical)" : "var(--accent)") + ";" })
            ]),
            el("div", { class: "meter-note", text: p.autoSubmitted
              ? "시간이 모자라 자동으로 넘어갔다. 응답 " + p.answered + "/" + p.total + "문항."
              : "응답 " + p.answered + "/" + p.total + "문항 · 제한 시간의 " + used + "%를 썼다." })
          ]);
        }))
      ])
    ]));

    var slow = r.rows.slice().sort(function (a, b) { return b.timeSec - a.timeSec; }).slice(0, 6);
    side.appendChild(el("div", { class: "card" }, [
      el("div", { class: "card-head" }, [
        el("h2", { text: "시간을 많이 쓴 문항" }),
        el("span", { class: "note", text: "상위 6개" })
      ]),
      el("div", { class: "card-body" }, [
        el("ul", { class: "qlist" }, slow.map(function (x) {
          return el("li", {}, [
            el("div", { class: "q", text: x.no + "번 · " + x.type + " — " + x.timeSec + "초" }),
            el("div", { class: "why", html: "<b>" + x.secName + "</b> " + (x.correct ? "정답" : (x.picked === null ? "미응답" : "오답")) + (x.flagged ? " · 표시함" : "") })
          ]);
        }))
      ]),
      el("div", { style: "padding:0 22px 20px;" }, [
        el("p", { style: "font-size:13px; color:var(--ink-2);", text: "오래 붙잡았는데 틀린 문항이 실전에서 가장 손해가 크다. 그 유형은 다음 응시에서 먼저 넘기는 연습을 해 보자." })
      ])
    ]));

    grid.appendChild(main);
    grid.appendChild(side);
    wrap.appendChild(grid);

    wrap.appendChild(el("div", { class: "actions" }, [
      el("button", { class: "btn btn-primary", type: "button", text: "같은 세트 다시 응시", onclick: function () { startSet(r.setId); } }),
      el("button", { class: "btn", type: "button", text: "다른 세트 고르기", onclick: function () { go("home"); } }),
      el("button", { class: "btn", type: "button", text: "결과 JSON 내려받기", onclick: function () { S.download("cog-" + r.setId + "-" + r.finishedAt + ".json", JSON.stringify(r, null, 2), "application/json"); } }),
      el("button", { class: "btn", type: "button", text: "문항 CSV 내려받기", onclick: function () { S.download("cog-" + r.setId + "-" + r.finishedAt + ".csv", buildCSV(r), "text/csv"); } }),
      el("button", { class: "btn", type: "button", text: "JSON 클립보드 복사", onclick: function () { S.copyText(JSON.stringify(r, null, 2)); } })
    ]));

    wrap.appendChild(el("div", { class: "foot", text: "추정 백분위는 정답률을 평균 " + Math.round(r.norm.rate * 100) + "%, 표준편차 " + Math.round(r.norm.sd * 100) + "%p의 정규분포로 환산한 값이다. " + r.norm.note + ". 소요 시간에는 일시정지한 시간이 포함되지 않는다." }));

    frag.appendChild(wrap);
    return frag;
  }

  function buildCSV(r) {
    var lines = ["번호,교시,영역,유형군,유형,난이도,문항ID,내 답,정답,정오,소요(초),표시"];
    r.rows.forEach(function (x) {
      lines.push([
        x.no, '"' + x.part + '"', x.secName, x.group, x.type, x.level, x.id,
        x.picked === null ? "" : (x.picked + 1), x.answer + 1,
        x.correct ? "O" : "X", x.timeSec, x.flagged ? 1 : 0
      ].join(","));
    });
    lines.push("");
    lines.push("영역,문항수,정답,정답률(%),소요(초),문항당(초)");
    r.sections.forEach(function (s2) {
      lines.push([s2.name, s2.total, s2.correct, s2.rate, s2.timeSec, s2.avgSec].join(","));
    });
    lines.push("");
    lines.push("유형군,영역,문항수,정답,정답률(%)");
    (r.groups || []).forEach(function (t) { lines.push([t.group, t.secName, t.total, t.correct, t.rate].join(",")); });
    lines.push("");
    lines.push("총계,문항수," + r.total + ",정답," + r.correct + ",정답률," + r.rate + ",추정백분위," + r.percentile);
    return "﻿" + lines.join("\n");
  }

  /* ---------------- 키보드 ---------------- */

  document.addEventListener("keydown", function (e) {
    if (S.state.screen !== "cog-test" || !cog.session || cog.submitting) return;
    if (e.metaKey || e.ctrlKey || e.altKey || !e.key) return;
    var tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;

    var key = e.key.toLowerCase();
    if (key === "p") { e.preventDefault(); togglePause(); return; }
    if (cog.session.paused) {
      if (e.key === "Enter") { e.preventDefault(); resume(); }
      return;
    }
    if (tag === "button" && (e.key === "Enter" || e.key === " ")) return;

    if (key >= "1" && key <= "5") { e.preventDefault(); pick(Number(key) - 1); return; }
    if (key === "f") { e.preventDefault(); toggleFlag(); return; }
    if (e.key === "ArrowRight") { e.preventDefault(); move(1); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); move(-1); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      if (cog.session.idx === curItems().length - 1) finishPart(false); else move(1);
    }
  });

  /* ---------------- 셸 연결 ---------------- */

  window.SKCT_COG = {
    homeBody: homeBody,
    render: function (screen) {
      if (screen === "cog-break" && cog.session) return renderBreak();
      if (screen === "cog-test" && cog.session) return renderTest();
      if (screen === "cog-result" && cog.result) return renderResult();
      S.state.screen = "home";
      return null;
    },
    afterRender: function (screen) {
      if (screen === "cog-test" && cog.session && !cog.session.paused) {
        markQuestionEnter();
        startTimer();
      } else {
        stopTimer();
      }
    },
    isBusy: function () {
      return !!(cog.session && !cog.session.paused && S.state.screen === "cog-test" && !cog.submitting);
    },
    onLeave: function (screen) {
      if (screen === "cog-test" && cog.session) {
        flushQuestionTime();
        if (!cog.session.paused) {
          cog.session.carryMs = partElapsedMs();
          cog.session.paused = true;
          cog.session.startedAt = null;
        }
        saveSession();
        stopTimer();
      }
    }
  };
})();
