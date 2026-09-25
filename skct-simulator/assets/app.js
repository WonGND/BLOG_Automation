/* SKCT 심층역량검사 시뮬레이터 — 애플리케이션 로직 */
(function () {
  "use strict";

  var DIMS = window.SKCT_DIMENSIONS;
  var BANK = window.SKCT_BANK;
  var SETS = window.SKCT_SETS;

  var DIM_BY_CODE = {};
  DIMS.forEach(function (d) { DIM_BY_CODE[d.code] = d; });

  var CORE_DIMS = ["INIT", "ACHV", "GRIT", "COOP", "RESP"];
  var SCALE_LABELS = ["전혀 그렇지 않다", "그렇지 않다", "보통이다", "그렇다", "매우 그렇다"];
  var MARKS = ["A", "B", "C"];

  /* 규준 파라미터 — 실제 SK 규준이 아니라 연습용 시뮬레이션 규준이다. */
  var NORM_MEAN = 3.35;
  var NORM_SD = 0.55;

  var COACH = {
    RESP: {
      gap: "기한과 절차를 지킨 근거가 약하게 잡혔다. 일정을 어떻게 쪼개고 언제 점검하는지 한 문장으로 정리해 두면 면접에서 바로 쓸 수 있다.",
      good: "약속한 기한과 기준을 지키는 성향이 뚜렷하다. '무엇을 언제 점검했는지'까지 말해야 근거로 인정된다.",
      q: "기한을 맞추기 어려웠던 일을 끝까지 마무리한 경험을 말해 보세요."
    },
    INIT: {
      gap: "지시 전에 먼저 움직인 흔적이 잘 드러나지 않았다. SK가 말하는 VWBE의 앞 절반에 해당하는 영역이라 비중이 크다.",
      good: "자발성(Voluntarily)이 강하게 잡혔다. 내가 먼저 제안해서 바뀐 것 한 가지를 결과까지 붙여 준비해 두자.",
      q: "누가 시키지 않았는데 먼저 나서서 한 일이 있다면 무엇인가요?"
    },
    ACHV: {
      gap: "목표 수준을 낮게 잡는 쪽으로 응답이 쏠렸다. 스스로 기준을 올려 본 경험을 숫자와 함께 준비하자.",
      good: "높은 기준을 스스로 세우는 성향이다. 목표치와 실제 결과를 숫자로 말할 수 있어야 설득력이 붙는다.",
      q: "스스로 세운 목표 가운데 가장 높았던 것은 무엇이고, 결과는 어땠나요?"
    },
    GRIT: {
      gap: "잘 풀리지 않을 때 방향을 빨리 트는 편으로 읽힌다. 오래 붙잡아 끝낸 경험을 기간과 함께 준비하자.",
      good: "SK가 말하는 '패기'에 직접 닿는 영역이 강하게 나왔다. 포기하고 싶었던 지점을 함께 말하면 더 진짜처럼 들린다.",
      q: "가장 오래 매달렸던 일과, 중간에 그만두고 싶었던 순간을 말해 보세요."
    },
    COOP: {
      gap: "팀 성과보다 개인 성과를 앞에 두는 응답이 많았다. 양보하거나 남의 몫을 대신 떠안은 사례가 필요하다.",
      good: "팀 전체를 먼저 보는 성향이다. 다만 '양보만 한 사람'으로 보이지 않게, 그 결과 팀이 무엇을 얻었는지 붙이자.",
      q: "팀을 위해 내 몫의 손해를 감수했던 경험이 있나요?"
    },
    COMM: {
      gap: "듣기와 전달 항목이 낮게 잡혔다. 하기 어려운 이야기를 상대가 상하지 않게 전한 사례를 준비하자.",
      good: "상대의 의도를 읽고 정확히 전달하는 힘이 있다. 갈등 상황을 말로 풀어낸 사례가 잘 맞는다.",
      q: "의견이 다른 상대를 설득했던 경험을 말해 보세요."
    },
    LEAD: {
      gap: "앞에 서는 역할을 피하는 응답 경향이 보인다. 규모가 작아도 방향을 정하고 역할을 나눈 경험이면 충분하다.",
      good: "방향을 제시하고 결정을 내리는 성향이다. 결정의 결과까지 책임진 부분을 말해야 리더십으로 읽힌다.",
      q: "팀을 이끌면서 내렸던 가장 어려운 결정은 무엇이었나요?"
    },
    INNO: {
      gap: "검증된 방식을 선호하는 쪽으로 치우쳤다. 기존 방식을 바꿔 본 작은 사례라도 하나 준비해 두자.",
      good: "익숙한 방식을 의심하고 바꿔 보는 성향이다. 다만 무모함이 아니라 근거 있는 시도였음을 함께 보여야 한다.",
      q: "늘 하던 방식을 바꿔 본 경험과 그 결과를 말해 보세요."
    },
    ANLY: {
      gap: "근거보다 직감으로 판단한다는 응답이 많았다. 자료나 수치로 원인을 짚어낸 경험을 정리해 두자.",
      good: "근거를 갖고 원인에 접근하는 성향이다. 인지역량 결과와 함께 읽힐 때 특히 강점으로 잡힌다.",
      q: "원인을 잘못 짚었다가 바로잡았던 경험이 있나요?"
    },
    STAB: {
      gap: "압박 상황에서 흔들린다는 응답이 누적됐다. 이 영역이 낮으면 조직적합 판단에서 특히 크게 걸린다.",
      good: "압박 상황에서 수행 수준을 유지하는 힘이 있다. 실제로 가장 급했던 순간을 사례로 준비해 두자.",
      q: "압박이 가장 컸던 순간에 어떻게 대처했는지 말해 보세요."
    },
    ADPT: {
      gap: "익숙한 틀 안에서 일할 때 편하다는 응답이 많았다. 환경이 바뀐 뒤 빠르게 익힌 사례가 필요하다.",
      good: "변화한 조건에 맞춰 방식을 바꾸는 성향이다. 무엇을 어떻게 새로 배웠는지가 핵심이다.",
      q: "완전히 새로운 환경에 적응해야 했던 경험을 말해 보세요."
    },
    ETHC: {
      gap: "결과를 위해 절차를 유연하게 봐도 된다는 응답이 섞였다. 인적성에서 이 영역의 낮은 점수는 가장 치명적으로 읽힌다.",
      good: "원칙과 절차를 지키는 성향이 분명하다. 손해를 감수하고 지킨 사례가 있으면 그대로 쓰면 된다.",
      q: "원칙과 성과가 충돌했던 상황에서 어떻게 판단했나요?"
    }
  };

  /* ---------------- 유틸 ---------------- */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") node.className = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else if (k === "html") node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function mmss(sec) {
    sec = Math.max(0, Math.round(sec));
    return pad2(Math.floor(sec / 60)) + ":" + pad2(sec % 60);
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function erf(x) {
    var s = x < 0 ? -1 : 1;
    x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  function percentileOf(raw) {
    var z = (raw - NORM_MEAN) / NORM_SD;
    return clamp(Math.round(50 * (1 + erf(z / Math.SQRT2))), 1, 99);
  }
  function bandOf(pct) {
    if (pct >= 85) return "매우 높음";
    if (pct >= 65) return "높음";
    if (pct >= 35) return "보통";
    if (pct >= 15) return "낮음";
    return "매우 낮음";
  }
  var storageOK = (function () {
    try {
      localStorage.setItem("skct.probe", "1");
      localStorage.removeItem("skct.probe");
      return true;
    } catch (e) { return false; }
  })();

  /* 값을 주면 쓰기(성공 여부를 boolean으로 돌려준다), 안 주면 읽기.
     사생활 보호 모드나 용량 초과로 실패해도 검사 자체는 계속 진행된다. */
  function store(key, val) {
    try {
      if (val === undefined) {
        var raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      }
      if (val === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      return val === undefined ? null : false;
    }
  }

  var BANK_VERSION = 1;
  var K_SESSION = "skct.v1.session";
  var K_HISTORY = "skct.v1.history";
  var K_THEME = "skct.v1.theme";
  var K_HOMETAB = "skct.v1.hometab";

  /* ---------------- 검사지 조립 ---------------- */

  function itemId(dim, idx) { return dim + pad2(idx); }

  function buildSet(def) {
    var rnd = mulberry32(def.seed);
    var buckets = {};
    def.pools.forEach(function (p) {
      var dim = p[0];
      buckets[dim] = buckets[dim] || [];
      for (var i = p[1]; i < p[2]; i++) {
        buckets[dim].push({
          id: itemId(dim, i),
          dim: dim,
          idx: i,
          text: BANK[dim][i][0],
          key: BANK[dim][i][1],
          isSD: dim === "SD"
        });
      }
    });
    Object.keys(buckets).forEach(function (dim) {
      var arr = buckets[dim];
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(rnd() * (i + 1));
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
    });

    /* 남은 문항이 많은 역량부터 3개씩 뽑아 문항군을 만든다 — 한 문항군 안에 같은 역량이 겹치지 않는다. */
    var groups = [];
    while (groups.length < def.groups) {
      var dims = Object.keys(buckets).filter(function (d) { return buckets[d].length > 0; });
      if (dims.length === 0) break;
      dims.sort(function (a, b) {
        var diff = buckets[b].length - buckets[a].length;
        return diff !== 0 ? diff : (rnd() - 0.5);
      });
      var picked = [];
      for (var k = 0; k < 3 && k < dims.length; k++) picked.push(buckets[dims[k]].pop());
      while (picked.length < 3 && dims.length) {
        var d2 = dims.find(function (d) { return buckets[d].length > 0; });
        if (!d2) break;
        picked.push(buckets[d2].pop());
      }
      if (picked.length < 3) break;
      for (var m = picked.length - 1; m > 0; m--) {
        var n = Math.floor(rnd() * (m + 1));
        var tmp = picked[m]; picked[m] = picked[n]; picked[n] = tmp;
      }
      groups.push(picked);
    }

    /* 유사 문항 쌍 — 은행에서 (00,01), (08,09) 위치가 서로 바꿔 쓴 표현이다. */
    var present = {};
    groups.forEach(function (g) { g.forEach(function (it) { present[it.id] = true; }); });
    var pairs = [];
    Object.keys(BANK).forEach(function (dim) {
      if (dim === "SD") return;
      [[0, 1], [8, 9]].forEach(function (p) {
        var a = itemId(dim, p[0]), b = itemId(dim, p[1]);
        if (present[a] && present[b]) pairs.push([a, b, dim]);
      });
    });
    return { groups: groups, pairs: pairs };
  }

  var SHEETS = {};
  function sheetFor(setId) {
    if (!SHEETS[setId]) {
      var def = SETS.filter(function (s) { return s.id === setId; })[0];
      SHEETS[setId] = buildSet(def);
    }
    return SHEETS[setId];
  }
  function setDef(setId) { return SETS.filter(function (s) { return s.id === setId; })[0]; }

  /* ---------------- 채점 ---------------- */

  function scored(item, rating) { return item.key > 0 ? rating : 6 - rating; }

  function computeResult(session) {
    var def = setDef(session.setId);
    var sheet = sheetFor(session.setId);
    var answers = session.answers || {};
    var picks = session.picks || {};

    var byDim = {}, fcAdj = {}, counts = [0, 0, 0, 0, 0];
    var totalStmts = 0, answered = 0, sdRatings = [];

    sheet.groups.forEach(function (group, gi) {
      var pick = picks[gi] || {};
      group.forEach(function (item) {
        totalStmts++;
        var r = answers[item.id];
        if (r) {
          answered++;
          counts[r - 1]++;
          if (item.isSD) sdRatings.push(r);
          else {
            byDim[item.dim] = byDim[item.dim] || [];
            byDim[item.dim].push(scored(item, r));
          }
        }
        if (!item.isSD) {
          fcAdj[item.dim] = fcAdj[item.dim] || 0;
          if (pick.most === item.id) fcAdj[item.dim] += 0.55;
          if (pick.least === item.id) fcAdj[item.dim] -= 0.55;
        }
      });
    });

    var pickedGroups = 0;
    sheet.groups.forEach(function (g, gi) {
      var p = picks[gi] || {};
      if (p.most && p.least) pickedGroups++;
    });

    var dimResults = DIMS.map(function (d) {
      var vals = byDim[d.code] || [];
      if (!vals.length) return null;
      var mean = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
      var raw = clamp(mean + (fcAdj[d.code] || 0) / vals.length, 1, 5);
      var pct = percentileOf(raw);
      return {
        code: d.code, name: d.name, short: d.short, desc: d.desc,
        n: vals.length, raw: Math.round(raw * 100) / 100,
        score: Math.round((raw - 1) / 4 * 1000) / 10,
        percentile: pct, band: bandOf(pct)
      };
    }).filter(Boolean);

    /* 신뢰도 1 — 과장응답(사회적 바람직성) */
    var sdMean = sdRatings.length
      ? sdRatings.reduce(function (a, b) { return a + b; }, 0) / sdRatings.length : null;
    var sdRisk = sdMean === null ? null : Math.round((sdMean - 1) / 4 * 100);
    var sdLevel = sdRisk === null ? "good" : (sdRisk > 62 ? "critical" : sdRisk >= 35 ? "warning" : "good");

    /* 신뢰도 2 — 유사 문항 응답 일관성 */
    var diffs = [], pairDetail = [];
    sheet.pairs.forEach(function (p) {
      var ra = answers[p[0]], rb = answers[p[1]];
      if (!ra || !rb) return;
      var d = Math.abs(ra - rb);
      diffs.push(d);
      pairDetail.push({ dim: p[2], a: p[0], b: p[1], ra: ra, rb: rb, diff: d });
    });
    var consistency = diffs.length
      ? Math.round((1 - (diffs.reduce(function (a, b) { return a + b; }, 0) / diffs.length) / 4) * 100) : null;
    var consLevel = consistency === null ? "good" : (consistency < 66 ? "critical" : consistency < 80 ? "warning" : "good");

    /* 신뢰도 3 — 응답 편향 */
    var extremePct = answered ? (counts[0] + counts[4]) / answered * 100 : 0;
    var middlePct = answered ? counts[2] / answered * 100 : 0;
    var balance = Math.round(clamp(100 - Math.max(0, extremePct - 50) * 1.6 - Math.max(0, middlePct - 40) * 1.8, 0, 100));
    var balLevel = balance < 55 ? "critical" : balance < 75 ? "warning" : "good";

    var completion = totalStmts ? Math.round(answered / totalStmts * 100) : 0;
    var pickCompletion = sheet.groups.length ? Math.round(pickedGroups / sheet.groups.length * 100) : 0;

    var verdict;
    if (completion < 95 || pickCompletion < 90) {
      verdict = {
        level: "critical", ico: "●",
        title: "미완료 응답 — 결과 해석 보류",
        text: "실제 검사에서는 미응답 문항이 그대로 결측으로 남고, 결측이 많으면 프로파일 자체를 신뢰하지 않는다. 시간 배분을 다시 잡고 전 문항을 채운 뒤 읽는 것이 맞다."
      };
    } else if (sdLevel === "critical" || consLevel === "critical") {
      verdict = {
        level: "critical", ico: "●",
        title: "신뢰도 지표 경고 — 응답 방식 점검 필요",
        text: sdLevel === "critical"
          ? "과장응답 지표가 임계치를 넘었다. 좋아 보이는 쪽으로 답을 몰면 실제 검사에서는 '왜곡 응답'으로 분류되어 역량 점수와 무관하게 불리해진다."
          : "유사 문항 쌍에서 응답이 크게 엇갈렸다. 문항을 꾸며서 답하거나 급하게 찍었을 때 나오는 전형적인 패턴이다."
      };
    } else if (sdLevel === "warning" || consLevel === "warning" || balLevel !== "good") {
      verdict = {
        level: "warning", ico: "▲",
        title: "대체로 양호 — 응답 습관만 다듬으면 된다",
        text: "역량 프로파일은 읽을 수 있는 수준이다. 다만 아래 신뢰도 지표 중 하나가 주의 구간에 있으니, 내일 실전에서는 해당 습관만 의식하면 된다."
      };
    } else {
      verdict = {
        level: "good", ico: "✓",
        title: "신뢰할 수 있는 응답",
        text: "세 가지 신뢰도 지표가 모두 양호 구간이다. 이 상태의 프로파일은 그대로 읽어도 된다. 아래 강점과 보완 영역을 면접 답변 준비의 기준으로 삼자."
      };
    }

    var sortedByPct = dimResults.slice().sort(function (a, b) { return b.percentile - a.percentile; });
    var coreVals = dimResults.filter(function (d) { return CORE_DIMS.indexOf(d.code) >= 0; });
    var coreAvg = coreVals.length
      ? Math.round(coreVals.reduce(function (a, b) { return a + b.percentile; }, 0) / coreVals.length) : null;

    return {
      version: 1,
      setId: session.setId,
      setName: def.name,
      setCode: def.code,
      finishedAt: session.finishedAt || Date.now(),
      elapsedSec: session.elapsedSec || 0,
      limitSec: def.minutes * 60,
      totalStatements: totalStmts,
      answeredStatements: answered,
      completion: completion,
      pickCompletion: pickCompletion,
      dimensions: dimResults,
      strengths: sortedByPct.slice(0, 3),
      gaps: sortedByPct.slice(-3).reverse(),
      coreAverage: coreAvg,
      reliability: {
        socialDesirability: { value: sdRisk, level: sdLevel, n: sdRatings.length },
        consistency: { value: consistency, level: consLevel, n: diffs.length, pairs: pairDetail },
        responseBalance: { value: balance, level: balLevel, extremePct: Math.round(extremePct), middlePct: Math.round(middlePct) }
      },
      distribution: counts,
      verdict: verdict,
      norm: { mean: NORM_MEAN, sd: NORM_SD, note: "연습용 시뮬레이션 규준 — 실제 SK 규준이 아니다" }
    };
  }

  /* ---------------- 상태 ---------------- */

  var state = { screen: "home", session: null, result: null, timerId: null, ui: null, submitting: false };

  function newSession(setId) {
    return {
      bankVersion: BANK_VERSION,
      setId: setId, index: 0, answers: {}, picks: {},
      startedAt: Date.now(), carryMs: 0, elapsedSec: 0, finishedAt: null
    };
  }

  /* 저장된 세션을 이어받아도 되는지 — 세트가 사라졌거나 문항 은행이 바뀌었으면 버린다. */
  function isResumable(saved) {
    return !!(saved && !saved.finishedAt && saved.setId && setDef(saved.setId) &&
      saved.bankVersion === BANK_VERSION && saved.index > 0);
  }
  function saveSession() {
    var s = state.session;
    if (!s) return;
    /* 저장할 때마다 경과 시간을 누적해 두면, 탭을 닫았다 다시 열어도 타이머가 튀지 않는다. */
    if (s.startedAt && !s.finishedAt) {
      s.carryMs = elapsedMs();
      s.startedAt = Date.now();
    }
    store(K_SESSION, s);
  }
  function history() { return store(K_HISTORY) || []; }
  function pushHistory(result) {
    var h = history() || [];
    h.unshift({
      id: "r" + result.finishedAt,
      setId: result.setId, setCode: result.setCode, setName: result.setName,
      finishedAt: result.finishedAt, elapsedSec: result.elapsedSec,
      completion: result.completion, coreAverage: result.coreAverage,
      verdictLevel: result.verdict.level, verdictTitle: result.verdict.title,
      full: result
    });
    h = h.slice(0, 30);
    /* 원자료까지 들고 있으면 금방 용량을 넘긴다. 최근 8건만 통째로 남긴다. */
    h.forEach(function (item, i) { if (i >= 8) delete item.full; });

    var ok = store(K_HISTORY, h);
    while (!ok && h.length > 1) {
      h = h.slice(0, Math.max(1, h.length - 4));
      h.forEach(function (item, i) { if (i >= 2) delete item.full; });
      ok = store(K_HISTORY, h);
    }
    if (!ok && storageOK) toast("저장 공간이 부족해 이번 결과를 기록에 남기지 못했다. 결과 데이터를 내려받아 두는 것이 좋다.");
  }

  /* ---------------- 공통 UI ---------------- */

  var root, toastEl;

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.classList.remove("show"); }, 2200);
  }

  function applyTheme(mode) {
    if (mode === "light" || mode === "dark") document.documentElement.setAttribute("data-theme", mode);
    else document.documentElement.removeAttribute("data-theme");
    var btn = $("#themeBtn");
    if (btn) btn.textContent = mode === "light" ? "라이트" : mode === "dark" ? "다크" : "시스템";
  }
  function cycleTheme() {
    var cur = store(K_THEME) || "auto";
    var next = cur === "auto" ? "light" : cur === "light" ? "dark" : "auto";
    store(K_THEME, next);
    applyTheme(next);
  }

  function appbar(extra) {
    var bar = el("div", { class: "appbar" }, [
      el("a", { class: "brand", href: "#", onclick: function (e) { e.preventDefault(); go("home"); } }, [
        el("span", { class: "mark", text: "SKCT" }),
        el("span", { class: "name", text: "SKCT 리허설" }),
        el("span", { class: "sub", text: "연습용" })
      ])
    ]);
    if (extra) extra.forEach(function (n) { bar.appendChild(n); });
    else bar.appendChild(el("div", { class: "appbar-spacer" }));
    bar.appendChild(el("button", { class: "iconbtn", id: "themeBtn", type: "button", onclick: cycleTheme, title: "화면 테마 전환" }));
    return bar;
  }

  function go(screen, fromPop) {
    state.screen = screen;
    if (!fromPop) {
      try { window.history.pushState({ skct: screen }, ""); } catch (e) { /* 히스토리 조작이 막힌 환경 */ }
    }
    render();
    window.scrollTo(0, 0);
  }

  /* 뒤로가기: 응시 중이면 진행 상황을 저장하고 홈으로 — 페이지를 벗어나지 않는다. */
  window.addEventListener("popstate", function () {
    if (state.screen === "test") { saveSession(); stopTimer(); }
    if (window.SKCT_COG) window.SKCT_COG.onLeave(state.screen);
    go("home", true);
  });

  /* 응시 중 새로고침·탭 닫기 경고. 진행 상황은 저장돼 있지만 실수로 나가는 것을 한 번 막는다. */
  window.addEventListener("beforeunload", function (e) {
    var busy = (state.screen === "test" && state.session && !state.submitting) ||
      (window.SKCT_COG && window.SKCT_COG.isBusy());
    if (busy) {
      e.preventDefault();
      e.returnValue = "";
      return "";
    }
  });

  /* ---------------- 확인창 ----------------
   * window.confirm은 샌드박스된 iframe(아티팩트 등)에서 막혀 아무 일도 일어나지 않는다.
   * 그래서 확인이 필요한 자리는 모두 이 창을 쓴다. */
  function confirmBox(opt) {
    var prev = document.activeElement;
    var noBtn = el("button", { class: "btn", type: "button", text: opt.no || "아니오" });
    var yesBtn = el("button", { class: "btn btn-primary", type: "button", text: opt.yes || "예" });
    var box = el("div", { class: "modal", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "modalttl" }, [
      el("h2", { id: "modalttl", text: opt.title }),
      opt.body ? el("p", { text: opt.body }) : null,
      el("div", { class: "modal-actions" }, [noBtn, yesBtn])
    ]);
    var back = el("div", { class: "modal-back" }, [box]);

    function close(fn) {
      document.removeEventListener("keydown", onKey, true);
      if (back.parentNode) back.parentNode.removeChild(back);
      if (prev && prev.focus) { try { prev.focus(); } catch (e) {} }
      if (fn) fn();
    }
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); close(opt.onNo); return; }
      if (e.key === "Tab") {                       /* 포커스를 창 안에 가둔다 */
        var f = [noBtn, yesBtn];
        var i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? f.length - 1 : 1) + f.length) % f.length].focus();
        return;
      }
      /* 응시 화면 단축키가 창 뒤에서 도는 것을 막는다 */
      e.stopPropagation();
    }
    noBtn.addEventListener("click", function () { close(opt.onNo); });
    yesBtn.addEventListener("click", function () { close(opt.onYes); });
    back.addEventListener("mousedown", function (e) { if (e.target === back) close(opt.onNo); });
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(back);
    noBtn.focus();                                  /* 실수로 나가지 않도록 '아니오'에 먼저 둔다 */
  }

  /* ---------------- 홈 ---------------- */

  function homeTabs() {
    var cur = store(K_HOMETAB) || "cog";
    function tab(id, label, sub) {
      return el("button", {
        class: "hometab" + (cur === id ? " is-on" : ""),
        type: "button", "aria-pressed": String(cur === id),
        onclick: function () { store(K_HOMETAB, id); render(); window.scrollTo(0, 0); }
      }, [
        el("span", { class: "t", text: label }),
        el("span", { class: "s", text: sub })
      ]);
    }
    return el("div", { class: "hometabs", role: "group", "aria-label": "검사 종류 선택" }, [
      tab("deep", "심층역량검사", "성격·역량 · 신뢰도 지표"),
      tab("cog", "인지역량검사", "5영역 · 개념 정리와 채점")
    ]);
  }

  function renderHome() {
    if ((store(K_HOMETAB) || "cog") === "cog" && window.SKCT_COG) {
      var f = document.createDocumentFragment();
      f.appendChild(appbar());
      var w = el("div", { class: "wrap" });
      w.appendChild(homeTabs());
      window.SKCT_COG.homeBody(w);
      f.appendChild(w);
      return f;
    }

    var frag = document.createDocumentFragment();
    frag.appendChild(appbar());

    var saved = store(K_SESSION);
    var hist = history();
    var doneSets = {};
    hist.forEach(function (h) { doneSets[h.setId] = doneSets[h.setId] || h; });

    var wrap = el("div", { class: "wrap" });
    wrap.appendChild(homeTabs());

    var hero = el("div", { class: "hero" }, [
      el("div", { class: "eyebrow", text: "SK그룹 종합역량검사 · 심층역량검사 대비" }),
      el("h1", { text: "실전과 같은 형식으로 풀고, 신뢰도 지표까지 받아 보는 연습 검사" }),
      el("p", {
        class: "lede",
        text: "한 문항군에 문장 세 개가 나오고, 각 문장에 ①~⑤로 답한 뒤 그중 나와 가장 가까운 문장과 가장 먼 문장을 고른다. 실제 심층역량검사와 같은 응답 방식이다. 제출하면 12개 역량 프로파일과 함께 과장응답·응답 일관성·응답 편향 세 가지 신뢰도 지표가 나온다."
      }),
      el("div", { class: "hero-facts" }, [
        el("span", { html: "문항 은행 <b>204문장</b>" }),
        el("span", { html: "역량 <b>12개</b>" }),
        el("span", { html: "검사 세트 <b>5종</b>" }),
        el("span", { html: "결과 데이터 <b>JSON · CSV 내보내기</b>" })
      ])
    ]);
    wrap.appendChild(hero);

    if (isResumable(saved)) {
      var sd = setDef(saved.setId);
      var sh = sheetFor(saved.setId);
      var resume = el("div", { class: "panel", style: "margin-bottom:32px; display:flex; align-items:center; gap:18px; flex-wrap:wrap;" }, [
        el("div", { style: "flex:1; min-width:240px;" }, [
          el("div", { class: "eyebrow", text: "진행 중인 검사" }),
          el("div", { style: "font-weight:600; margin-top:4px;", text: sd.code + " · " + sd.name }),
          el("div", { style: "font-size:12.5px; color:var(--ink-2); margin-top:2px;", text: sh.groups.length + "문항군 중 " + saved.index + "번까지 응답했다." })
        ]),
        el("button", {
          class: "btn btn-primary", type: "button", text: "이어서 응시",
          onclick: function () { state.session = saved; go("test"); }
        }),
        el("button", {
          class: "btn", type: "button", text: "버리기",
          onclick: function () { store(K_SESSION, null); render(); }
        })
      ]);
      wrap.appendChild(resume);
    }

    var grid = el("div", { class: "home-grid" });
    var left = el("div", {});

    left.appendChild(el("div", { class: "section-head" }, [
      el("h2", { text: "검사 세트 선택" }),
      el("span", { class: "hint", text: "세트를 고르면 바로 시작한다" })
    ]));

    var list = el("div", { class: "setlist" });
    SETS.forEach(function (s) {
      var sheet = sheetFor(s.id);
      var stmts = sheet.groups.length * 3;
      var pace = Math.round(s.minutes * 60 / sheet.groups.length);
      var done = doneSets[s.id];

      var meta = el("div", { class: "setrow-meta" }, [
        el("span", { text: sheet.groups.length + "문항군 · " + stmts + "문장" }),
        el("span", { text: s.minutes + "분" }),
        el("span", { class: "pace", text: "문항군당 " + pace + "초" })
      ]);

      var body = el("div", {}, [
        el("div", { class: "setrow-name", text: s.name }),
        el("div", { class: "setrow-sum", text: s.summary }),
        el("div", { class: "setrow-detail", text: s.detail })
      ]);
      if (done) {
        body.appendChild(el("div", { class: "setrow-done" }, [
          el("span", { text: "✓ 응시함 · 핵심역량 백분위 " + (done.coreAverage === null ? "—" : done.coreAverage) })
        ]));
      }

      list.appendChild(el("button", {
        class: "setrow", type: "button",
        onclick: function () { startSet(s.id); }
      }, [
        el("div", { class: "setrow-code" }, [
          el("span", { text: s.code }),
          el("span", { class: "tag", text: s.tag })
        ]),
        body,
        el("div", { style: "display:flex; align-items:flex-start; gap:16px;" }, [
          meta,
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
          el("td", { class: "num", text: mmss(h.elapsedSec) }),
          el("td", { class: "num", text: h.completion + "%" }),
          el("td", { class: "num", text: h.coreAverage === null ? "—" : String(h.coreAverage) }),
          el("td", {}, [el("span", { class: "chip " + h.verdictLevel, text: h.verdictLevel === "good" ? "양호" : h.verdictLevel === "warning" ? "주의" : "경고" })]),
          el("td", {}, [el("button", {
            class: "linkbtn", type: "button",
            text: h.full ? "결과 보기" : "원자료 없음",
            title: h.full ? "" : "저장 공간을 아끼려고 오래된 기록의 상세 데이터는 정리되었다",
            disabled: h.full ? null : "",
            onclick: function () { if (h.full) { state.result = h.full; go("result"); } }
          })])
        ]));
      });
      var table = el("table", { class: "histtable" }, [
        el("thead", {}, [el("tr", {}, [
          el("th", { text: "세트" }), el("th", { text: "응시 시각" }),
          el("th", { class: "num", text: "소요" }), el("th", { class: "num", text: "완료율" }),
          el("th", { class: "num", text: "핵심역량" }), el("th", { text: "신뢰도" }), el("th", { text: "" })
        ])]),
        tbody
      ]);
      left.appendChild(el("div", { class: "tablescroll" }, [table]));
    }

    var right = el("div", { class: "stack" }, [
      el("div", { class: "panel" }, [
        el("h3", { text: "응시 방법" }),
        el("ol", { class: "steps" }, [
          el("li", {}, [el("span", { html: "문장 세 개에 각각 <b>①~⑤</b>로 답한다. 키보드 <b>1~5</b>가 그대로 먹는다." })]),
          el("li", {}, [el("span", { html: "세 문장 중 나와 <b>가장 가까운 것</b>과 <b>가장 먼 것</b>을 하나씩 고른다." })]),
          el("li", {}, [el("span", { html: "제한 시간이 끝나면 <b>자동 제출</b>된다. 남은 문항은 미응답으로 채점된다." })]),
          el("li", {}, [el("span", { html: "결과에서 역량 프로파일과 <b>신뢰도 3지표</b>를 확인하고 데이터를 내려받는다." })])
        ])
      ]),
      el("div", { class: "panel" }, [
        el("h3", { text: "무엇을 보면 되나" }),
        el("p", { style: "font-size:13px; color:var(--ink-2);", text: "심층역량검사는 점수를 높이는 시험이 아니라 걸러지지 않는 것이 목표인 검사다. 그래서 역량 막대보다 신뢰도 3지표를 먼저 보는 편이 낫다." }),
        el("div", { class: "notice", style: "margin-top:14px;", html: "좋아 보이는 쪽으로 답을 몰면 <b>과장응답</b> 지표가 오르고, 그걸 감추려고 답을 섞으면 <b>응답 일관성</b>이 떨어진다. 두 지표는 같이 올릴 수 없게 설계돼 있다. 결국 실제 자기 모습으로 일관되게 답하는 것이 가장 안전하다." })
      ])
    ]);

    grid.appendChild(left);
    grid.appendChild(right);
    wrap.appendChild(grid);

    wrap.appendChild(el("div", { class: "foot", text: "이 시뮬레이터의 문항과 규준은 실제 SKCT 기출이 아니라 공개된 검사 형식을 참고해 연습용으로 자체 제작한 것이다. 백분위는 평균 " + NORM_MEAN + ", 표준편차 " + NORM_SD + "의 시뮬레이션 규준으로 환산한 값이므로 실제 응시자 집단 대비 순위가 아니다. 응답 데이터는 서버로 전송되지 않고 이 브라우저에만 저장된다." }));

    frag.appendChild(wrap);
    return frag;
  }

  function startSet(setId) {
    state.session = newSession(setId);
    saveSession();
    go("test");
  }

  /* ---------------- 응시 화면 ---------------- */

  function remainingSec() {
    var def = setDef(state.session.setId);
    return def.minutes * 60 - elapsed();
  }
  function elapsedMs() {
    return (Date.now() - state.session.startedAt) + (state.session.carryMs || 0);
  }
  function elapsed() { return Math.round(elapsedMs() / 1000); }

  function renderTest() {
    var s = state.session;
    var def = setDef(s.setId);
    var sheet = sheetFor(s.setId);
    var total = sheet.groups.length;
    var gi = clamp(s.index, 0, total - 1);
    s.index = gi;
    var group = sheet.groups[gi];
    var pick = s.picks[gi] = s.picks[gi] || {};

    /* 응답할 때마다 화면을 통째로 다시 그리면 포커스가 날아가고 화면이 깜빡인다.
       필요한 버튼만 고쳐 쓰기 위해 참조를 모아 둔다. */
    var ui = { gi: gi, group: group, scaleBtns: {}, pickBtns: { most: [], least: [] }, statusEl: null };

    var frag = document.createDocumentFragment();

    var timer = el("span", { class: "timer", id: "timer", text: mmss(remainingSec()) });
    frag.appendChild(appbar([
      el("div", { class: "appbar-spacer" }),
      el("span", { class: "setcode", text: def.code }),
      timer,
      el("button", {
        class: "iconbtn", type: "button", text: "나가기",
        onclick: function () {
          confirmBox({
            title: "정말 나가시겠습니까?",
            body: "지금까지 응답한 내용과 남은 시간은 저장된다. 홈에서 '이어서 응시'를 누르면 멈춘 지점부터 다시 시작한다.",
            yes: "예, 나갑니다", no: "아니오, 계속 풉니다",
            onYes: function () { saveSession(); stopTimer(); go("home"); }
          });
        }
      })
    ]));

    frag.appendChild(el("div", { class: "progressbar" }, [
      el("span", { style: "width:" + (gi / total * 100) + "%" })
    ]));

    var wrap = el("div", { class: "wrap narrow" });

    wrap.appendChild(el("div", { class: "testhead" }, [
      el("div", { class: "pos" }, [
        el("b", { text: String(gi + 1) }),
        el("span", { text: " / " + total + " 문항군" })
      ]),
      el("div", { class: "setname", text: def.name })
    ]));

    var card = el("div", { class: "qcard" });
    card.appendChild(el("div", { class: "scalelegend" }, [
      el("span", { text: "각 문장이 나에게 얼마나 맞는지 고른다" }),
      el("div", { class: "ends" }, [
        el("span", { text: "전혀" }), el("span", { text: "아니다" }), el("span", { text: "보통" }),
        el("span", { text: "그렇다" }), el("span", { text: "매우" })
      ])
    ]));

    group.forEach(function (item, si) {
      var scale = el("div", { class: "scale", role: "group", "aria-label": MARKS[si] + " 문장 응답" });
      var btns = [];
      for (var v = 1; v <= 5; v++) {
        (function (val) {
          var b = el("button", {
            type: "button",
            text: "①②③④⑤"[val - 1],
            title: val + " — " + SCALE_LABELS[val - 1],
            "aria-label": SCALE_LABELS[val - 1],
            "aria-pressed": String(s.answers[item.id] === val),
            onclick: function () { setAnswer(item.id, val); }
          });
          btns.push(b);
          scale.appendChild(b);
        })(v);
      }
      ui.scaleBtns[item.id] = btns;
      card.appendChild(el("div", { class: "stmt" }, [
        el("div", { class: "stmt-text" }, [
          el("span", { class: "stmt-tag", text: MARKS[si] }),
          el("span", { text: item.text })
        ]),
        scale
      ]));
    });

    function pickRow(kind) {
      var row = el("div", { class: "pickrow " + kind });
      group.forEach(function (item, si) {
        var b = el("button", {
          type: "button",
          text: MARKS[si],
          "aria-pressed": String(pick[kind] === item.id),
          onclick: function () { setPick(gi, kind, item.id); }
        });
        ui.pickBtns[kind].push(b);
        row.appendChild(b);
      });
      return row;
    }

    card.appendChild(el("div", { class: "forced" }, [
      el("div", { class: "forced-group" }, [
        el("div", { class: "label", html: "셋 중 나와 가장 <em>가깝다</em>" }),
        pickRow("most")
      ]),
      el("div", { class: "forced-group" }, [
        el("div", { class: "label", html: "셋 중 나와 가장 <em>멀다</em>" }),
        pickRow("least")
      ])
    ]));
    wrap.appendChild(card);

    var isLast = gi === total - 1;
    ui.statusEl = el("span", { class: "status" });

    wrap.appendChild(el("div", { class: "navrow" }, [
      el("button", {
        class: "btn", type: "button", text: "← 이전", disabled: gi === 0 ? "" : null,
        onclick: function () { if (gi > 0) { s.index = gi - 1; saveSession(); render(); } }
      }),
      ui.statusEl,
      el("div", { class: "spacer" }),
      isLast
        ? el("button", { class: "btn btn-primary", type: "button", text: "제출하고 결과 보기", onclick: function () { submit(false); } })
        : el("button", { class: "btn btn-primary", type: "button", text: "다음 →", onclick: function () { next(); } })
    ]));

    wrap.appendChild(el("div", { class: "kbdhint", html:
      "<kbd>1</kbd>~<kbd>5</kbd> 문장 응답(A→B→C 순서로 채워진다) · " +
      "<kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 가장 가깝다 · <kbd>Z</kbd><kbd>X</kbd><kbd>C</kbd> 가장 멀다 · " +
      "<kbd>Enter</kbd> 다음 문항군"
    }));

    frag.appendChild(wrap);
    state.ui = ui;
    refreshStatus();
    return frag;
  }

  /* ---------- 응시 화면 부분 갱신 ---------- */

  function refreshStatus() {
    var ui = state.ui;
    if (!ui || !ui.statusEl) return;
    var s = state.session;
    var group = ui.group;
    var pick = s.picks[ui.gi] || {};
    var unanswered = group.filter(function (i) { return !s.answers[i.id]; }).length;
    var msg, incomplete = true;
    if (unanswered) msg = "문장 " + unanswered + "개가 남았다";
    else if (!pick.most && !pick.least) msg = "가장 가까운 것과 가장 먼 것을 고르면 된다";
    else if (!pick.most) msg = "가장 가까운 것이 남았다";
    else if (!pick.least) msg = "가장 먼 것이 남았다";
    else { msg = "응답 완료"; incomplete = false; }
    ui.statusEl.textContent = msg;
    ui.statusEl.className = "status" + (incomplete ? " incomplete" : "");
  }

  function setAnswer(id, val) {
    var s = state.session;
    if (!s) return;
    s.answers[id] = val;
    saveSession();
    var btns = state.ui && state.ui.scaleBtns[id];
    if (btns) {
      btns.forEach(function (b, i) { b.setAttribute("aria-pressed", String(i + 1 === val)); });
      refreshStatus();
    } else render();
  }

  function setPick(gi, kind, id) {
    var s = state.session;
    if (!s) return;
    var p = s.picks[gi] = s.picks[gi] || {};
    var other = kind === "most" ? "least" : "most";
    if (p[kind] === id) delete p[kind];
    else {
      p[kind] = id;
      if (p[other] === id) delete p[other];
    }
    saveSession();
    var ui = state.ui;
    if (ui && ui.gi === gi) {
      ["most", "least"].forEach(function (k) {
        ui.pickBtns[k].forEach(function (b, i) {
          b.setAttribute("aria-pressed", String(p[k] === ui.group[i].id));
        });
      });
      refreshStatus();
    } else render();
  }

  function next() {
    var sheet = sheetFor(state.session.setId);
    if (state.session.index < sheet.groups.length - 1) {
      state.session.index++;
      saveSession();
      render();
      window.scrollTo(0, 0);
    }
  }

  function submit(auto) {
    var s = state.session;
    if (!s || state.submitting) return;   /* 연타·타이머 동시 제출로 결과가 두 번 쌓이는 것을 막는다 */
    state.submitting = true;
    stopTimer();
    s.elapsedSec = elapsed();
    s.finishedAt = Date.now();
    var result;
    try {
      result = computeResult(s);
    } catch (err) {
      state.submitting = false;
      toast("채점 중 문제가 생겼다. 응답은 그대로 남아 있으니 다시 제출해 보면 된다.");
      startTimer();
      return;
    }
    result.autoSubmitted = !!auto;
    pushHistory(result);
    store(K_SESSION, null);
    state.result = result;
    state.session = null;
    state.ui = null;
    state.submitting = false;
    go("result");
    if (auto) toast("제한 시간이 끝나 자동 제출되었다.");
  }

  function startTimer() {
    stopTimer();
    state.timerId = setInterval(function () {
      if (state.screen !== "test" || !state.session || state.submitting) return;
      var left = remainingSec();
      var t = $("#timer");
      if (t) {
        t.textContent = mmss(left);
        t.className = "timer" + (left <= 60 ? " danger" : left <= 180 ? " warn" : "");
      }
      if (left <= 0) submit(true);
    }, 1000);
  }
  function stopTimer() { if (state.timerId) { clearInterval(state.timerId); state.timerId = null; } }

  document.addEventListener("keydown", function (e) {
    if (state.screen !== "test" || !state.session || state.submitting) return;
    if (e.metaKey || e.ctrlKey || e.altKey || !e.key) return;
    var tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;
    /* 버튼에 포커스가 있을 때의 Enter·Space는 버튼이 처리한다.
       여기서 또 처리하면 문항군이 두 칸씩 넘어간다. */
    if (tag === "button" && (e.key === "Enter" || e.key === " ")) return;

    var s = state.session;
    var sheet = sheetFor(s.setId);
    var group = sheet.groups[s.index];
    var key = e.key.toLowerCase();

    if (key >= "1" && key <= "5") {
      var target = group.filter(function (i) { return !s.answers[i.id]; })[0];
      e.preventDefault();
      /* 세 문장을 다 답한 뒤의 숫자 키는 무시한다 — 마지막 응답을 덮어쓰지 않도록. */
      if (target) setAnswer(target.id, Number(key));
      return;
    }
    var mostKeys = ["a", "s", "d"], leastKeys = ["z", "x", "c"];
    if (mostKeys.indexOf(key) >= 0) { e.preventDefault(); setPick(s.index, "most", group[mostKeys.indexOf(key)].id); return; }
    if (leastKeys.indexOf(key) >= 0) { e.preventDefault(); setPick(s.index, "least", group[leastKeys.indexOf(key)].id); return; }
    if (e.key === "Enter" || e.key === "ArrowRight") {
      e.preventDefault();
      if (s.index === sheet.groups.length - 1) submit(false); else next();
      return;
    }
    if (e.key === "ArrowLeft" && s.index > 0) {
      e.preventDefault();
      s.index--; saveSession(); render();
    }
  });

  /* ---------------- 결과: 차트 ---------------- */

  function barsChart(dims) {
    var sorted = dims.slice().sort(function (a, b) { return b.percentile - a.percentile; });
    var box = el("div", { class: "bars" });
    sorted.forEach(function (d) {
      var low = d.percentile < 35;
      box.appendChild(el("div", {
        class: "bar-row" + (low ? " is-low" : ""),
        title: d.name + " — 백분위 " + d.percentile + " (" + d.band + ") · 원점수 " + d.raw.toFixed(2) + "/5 · 문항 " + d.n + "개"
      }, [
        el("div", { class: "bar-name", text: d.name }),
        el("div", { class: "bar-track" }, [
          el("div", { class: "bar-fill", style: "width:" + d.percentile + "%" }),
          el("div", { class: "bar-mid" })
        ]),
        el("div", { class: "bar-tag", text: low ? "보완" : "" }),
        el("div", { class: "bar-val num", text: String(d.percentile) })
      ]));
    });
    box.appendChild(el("div", { class: "bar-axis" }, [
      el("span", { text: "0" }), el("span", { text: "50 (규준 중앙)" }), el("span", { text: "100" })
    ]));
    return box;
  }

  function radarChart(dims) {
    var W = 460, H = 420, cx = 230, cy = 208, R = 132;
    var order = DIMS.map(function (d) {
      return dims.filter(function (x) { return x.code === d.code; })[0];
    }).filter(Boolean);
    var n = order.length;
    var ns = "http://www.w3.org/2000/svg";

    function node(name, attrs, text) {
      var e2 = document.createElementNS(ns, name);
      Object.keys(attrs).forEach(function (k) { e2.setAttribute(k, attrs[k]); });
      if (text !== undefined) e2.textContent = text;
      return e2;
    }
    function pt(i, r) {
      var a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    }

    var svg = node("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "12개 역량 백분위 프로파일 레이더 차트" });

    [25, 50, 75, 100].forEach(function (lv) {
      var pts = [];
      for (var i = 0; i < n; i++) pts.push(pt(i, R * lv / 100).map(function (v) { return v.toFixed(1); }).join(","));
      svg.appendChild(node("polygon", {
        points: pts.join(" "), fill: "none",
        stroke: "var(--line)", "stroke-width": lv === 100 ? 1 : 1,
        "stroke-dasharray": lv === 100 ? "none" : "2 3"
      }));
    });
    for (var i = 0; i < n; i++) {
      var p = pt(i, R);
      svg.appendChild(node("line", { x1: cx, y1: cy, x2: p[0].toFixed(1), y2: p[1].toFixed(1), stroke: "var(--line)", "stroke-width": 1 }));
    }

    var normPts = [], myPts = [];
    for (var j = 0; j < n; j++) {
      normPts.push(pt(j, R * 0.5).map(function (v) { return v.toFixed(1); }).join(","));
      myPts.push(pt(j, R * order[j].percentile / 100).map(function (v) { return v.toFixed(1); }).join(","));
    }
    svg.appendChild(node("polygon", {
      points: normPts.join(" "), fill: "none",
      stroke: "var(--series-2)", "stroke-width": 2, "stroke-dasharray": "5 4"
    }));
    svg.appendChild(node("polygon", {
      points: myPts.join(" "),
      fill: "color-mix(in srgb, var(--accent) 16%, transparent)",
      stroke: "var(--accent)", "stroke-width": 2, "stroke-linejoin": "round"
    }));
    for (var k = 0; k < n; k++) {
      var mp = pt(k, R * order[k].percentile / 100);
      svg.appendChild(node("circle", { cx: mp[0].toFixed(1), cy: mp[1].toFixed(1), r: 3.5, fill: "var(--accent)", stroke: "var(--surface)", "stroke-width": 2 }));
    }
    for (var m = 0; m < n; m++) {
      var lp = pt(m, R + 20);
      var ang = -Math.PI / 2 + (m / n) * Math.PI * 2;
      var cos = Math.cos(ang);
      var anchor = Math.abs(cos) < 0.25 ? "middle" : (cos > 0 ? "start" : "end");
      var label = node("text", {
        x: lp[0].toFixed(1), y: lp[1].toFixed(1),
        "text-anchor": anchor, "dominant-baseline": "middle",
        fill: "var(--ink-2)", "font-size": "11.5", "font-family": "var(--sans)"
      }, order[m].short);
      svg.appendChild(label);
      var vlab = node("text", {
        x: lp[0].toFixed(1), y: (lp[1] + 13).toFixed(1),
        "text-anchor": anchor, "dominant-baseline": "middle",
        fill: "var(--ink-3)", "font-size": "10", "font-family": "var(--mono)"
      }, String(order[m].percentile));
      svg.appendChild(vlab);
    }

    return el("div", { class: "radar-wrap" }, [
      svg,
      el("div", { class: "legend" }, [
        el("span", { html: '<i style="background:var(--accent)"></i>내 백분위' }),
        el("span", { html: '<i style="background:var(--series-2)"></i>규준 중앙(50)' })
      ])
    ]);
  }

  function meterBlock(name, value, level, unit, note) {
    var color = level === "good" ? "var(--good)" : level === "warning" ? "var(--warning)" : "var(--critical)";
    var chipText = level === "good" ? "양호" : level === "warning" ? "주의" : "경고";
    var ico = level === "good" ? "✓" : level === "warning" ? "▲" : "●";
    return el("div", {}, [
      el("div", { class: "meter-head" }, [
        el("span", { class: "meter-name", text: name }),
        el("span", { style: "display:flex; align-items:center; gap:9px;" }, [
          el("span", { class: "chip " + level }, [el("span", { text: ico }), el("span", { text: chipText })]),
          el("span", { class: "meter-val", text: value === null ? "—" : value + unit })
        ])
      ]),
      el("div", { class: "meter-track" }, [
        el("div", { class: "meter-fill", style: "width:" + (value === null ? 0 : value) + "%; background:" + color + ";" })
      ]),
      el("div", { class: "meter-note", text: note })
    ]);
  }

  function distChart(counts) {
    var total = counts.reduce(function (a, b) { return a + b; }, 0) || 1;
    var max = Math.max.apply(null, counts) || 1;
    var box = el("div", { class: "dist" });
    counts.forEach(function (c, i) {
      var pct = Math.round(c / total * 100);
      box.appendChild(el("div", { class: "dist-col", title: SCALE_LABELS[i] + " — " + c + "회 (" + pct + "%)" }, [
        el("div", { class: "dist-pct num", text: pct + "%" }),
        el("div", { class: "dist-bar", style: "height:" + Math.max(2, Math.round(c / max * 54)) + "px" }),
        el("div", { class: "dist-lab", text: "①②③④⑤"[i] })
      ]));
    });
    return box;
  }

  /* ---------------- 결과 화면 ---------------- */

  function renderResult() {
    var r = state.result;
    var frag = document.createDocumentFragment();

    frag.appendChild(appbar([
      el("div", { class: "appbar-spacer" }),
      el("button", { class: "iconbtn", type: "button", text: "← 세트 목록", onclick: function () { go("home"); } })
    ]));

    var wrap = el("div", { class: "wrap" });
    var d = new Date(r.finishedAt);

    wrap.appendChild(el("div", { class: "hero", style: "margin-bottom:22px; gap:8px;" }, [
      el("div", { class: "eyebrow", text: "검사 결과 · " + r.setCode + " " + r.setName }),
      el("h1", { style: "font-size:clamp(22px,3vw,28px);", text: "심층역량 프로파일 리포트" })
    ]));

    var rel = r.reliability;
    wrap.appendChild(el("div", { class: "verdict is-" + r.verdict.level }, [
      el("div", { class: "stripe" }),
      el("div", { class: "verdict-body" }, [
        el("div", { class: "verdict-title" }, [
          el("span", { class: "ico", text: r.verdict.ico }),
          el("span", { text: r.verdict.title })
        ]),
        el("p", { text: r.verdict.text }),
        el("div", { class: "verdict-meta" }, [
          el("span", { text: "응시 " + d.getFullYear() + "." + pad2(d.getMonth() + 1) + "." + pad2(d.getDate()) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) }),
          el("span", { text: "소요 " + mmss(r.elapsedSec) + " / 제한 " + mmss(r.limitSec) }),
          el("span", { text: "응답 " + r.answeredStatements + "/" + r.totalStatements + "문장 (" + r.completion + "%)" }),
          el("span", { text: "가깝다·멀다 선택 " + r.pickCompletion + "%" }),
          el("span", { text: "핵심역량 평균 백분위 " + (r.coreAverage === null ? "—" : r.coreAverage) }),
          r.autoSubmitted ? el("span", { text: "시간 초과 자동 제출" }) : null
        ])
      ])
    ]));

    if (!r.dimensions.length) {
      wrap.appendChild(el("div", { class: "card" }, [
        el("div", { class: "card-head" }, [el("h2", { text: "채점할 응답이 없다" })]),
        el("div", { class: "card-body" }, [
          el("p", { style: "color:var(--ink-2); font-size:14.5px; max-width:44em;", text: "문항에 응답한 기록이 없어 역량 프로파일을 계산할 수 없다. 세트를 다시 골라 응시하면 된다." })
        ])
      ]));
      wrap.appendChild(el("div", { class: "actions" }, [
        el("button", { class: "btn btn-primary", type: "button", text: "같은 세트 다시 응시", onclick: function () { startSet(r.setId); } }),
        el("button", { class: "btn", type: "button", text: "세트 목록", onclick: function () { go("home"); } })
      ]));
      frag.appendChild(wrap);
      return frag;
    }

    var grid = el("div", { class: "resgrid" });
    var main = el("div", { class: "stack" });
    var side = el("div", { class: "stack" });

    /* 역량 막대 */
    main.appendChild(el("div", { class: "card" }, [
      el("div", { class: "card-head" }, [
        el("h2", { text: "역량별 백분위" }),
        el("span", { class: "note", text: "높은 순 정렬 · 시뮬레이션 규준" })
      ]),
      el("div", { class: "card-body" }, [barsChart(r.dimensions)])
    ]));

    /* 강점 / 보완 */
    var picks = el("div", { class: "picks" });
    r.strengths.forEach(function (dm) {
      picks.appendChild(el("div", { class: "pick" }, [
        el("div", { class: "rail" }),
        el("div", {}, [
          el("div", { class: "pick-name" }, [
            el("span", { text: dm.name }),
            el("span", { class: "pct num", text: "백분위 " + dm.percentile + " · " + dm.band })
          ]),
          el("div", { class: "pick-desc", text: dm.desc }),
          el("div", { class: "pick-tip", html: "<b>활용</b> " + COACH[dm.code].good })
        ])
      ]));
    });
    main.appendChild(el("div", { class: "card" }, [
      el("div", { class: "card-head" }, [
        el("h2", { text: "강점 상위 3개" }),
        el("span", { class: "note", text: "면접 답변의 축으로 쓸 영역" })
      ]),
      el("div", { class: "card-body" }, [picks])
    ]));

    var gaps = el("div", { class: "picks" });
    r.gaps.forEach(function (dm) {
      gaps.appendChild(el("div", { class: "pick is-gap" }, [
        el("div", { class: "rail" }),
        el("div", {}, [
          el("div", { class: "pick-name" }, [
            el("span", { text: dm.name }),
            el("span", { class: "pct num", text: "백분위 " + dm.percentile + " · " + dm.band })
          ]),
          el("div", { class: "pick-desc", text: dm.desc }),
          el("div", { class: "pick-tip", html: "<b>보완</b> " + COACH[dm.code].gap })
        ])
      ]));
    });
    main.appendChild(el("div", { class: "card" }, [
      el("div", { class: "card-head" }, [
        el("h2", { text: "보완이 필요한 3개" }),
        el("span", { class: "note", text: "낮은 순" })
      ]),
      el("div", { class: "card-body" }, [gaps])
    ]));

    /* 예상 질문 */
    var qs = el("ul", { class: "qlist" });
    r.gaps.concat(r.strengths.slice(0, 2)).forEach(function (dm) {
      var isGap = r.gaps.indexOf(dm) >= 0;
      qs.appendChild(el("li", {}, [
        el("div", { class: "q", text: COACH[dm.code].q }),
        el("div", { class: "why", html: "<b>" + dm.code + "</b> " + dm.name + " · 백분위 " + dm.percentile + " — " + (isGap ? "낮게 나온 영역이라 근거를 요구받기 쉽다" : "강점으로 잡힌 영역이라 구체적 사례가 필요하다") })
      ]));
    });
    main.appendChild(el("div", { class: "card" }, [
      el("div", { class: "card-head" }, [
        el("h2", { text: "이 프로파일에서 나오기 쉬운 면접 질문" }),
        el("span", { class: "note", text: "5문항" })
      ]),
      el("div", { class: "card-body" }, [qs])
    ]));

    /* 문항별 리뷰 */
    main.appendChild(reviewCard(r));

    /* --- 사이드 --- */
    var sdNote = rel.socialDesirability.value === null
      ? "이 세트에는 과장응답 문항이 없다."
      : rel.socialDesirability.level === "good"
        ? "과장 없이 답했다. 실제 검사에서도 이 수준을 유지하면 된다."
        : rel.socialDesirability.level === "warning"
          ? "좋아 보이는 쪽으로 살짝 기울었다. '한 번도 없다' 류의 문장에 ④~⑤로 답한 곳을 다시 보자."
          : "누구에게나 있는 일까지 부정했다. 실제 검사에서는 왜곡 응답으로 분류될 수 있는 구간이다.";
    var consNote = rel.consistency.value === null
      ? "일관성 산출에 필요한 유사 문항 쌍이 없다."
      : rel.consistency.level === "good"
        ? "표현만 바꾼 같은 내용의 문항에 비슷하게 답했다."
        : rel.consistency.level === "warning"
          ? "일부 유사 문항에서 응답이 엇갈렸다. 속도를 조금 늦추면 대부분 해결된다."
          : "같은 내용의 문항에 반대로 답한 경우가 많다. 꾸며서 답하거나 급하게 찍었을 때 나오는 패턴이다.";
    var balNote = rel.responseBalance.level === "good"
      ? "①~⑤를 고르게 썼다."
      : rel.responseBalance.extremePct > 50
        ? "①과 ⑤에 " + rel.responseBalance.extremePct + "%가 몰렸다. 극단으로만 답하면 프로파일이 과장되게 잡힌다."
        : "③(보통)에 " + rel.responseBalance.middlePct + "%가 몰렸다. 중간으로만 답하면 변별이 안 되어 '판단 보류'로 처리되기 쉽다.";

    side.appendChild(el("div", { class: "card" }, [
      el("div", { class: "card-head" }, [
        el("h2", { text: "신뢰도 3지표" }),
        el("span", { class: "note", text: "먼저 볼 것" })
      ]),
      el("div", { class: "card-body" }, [
        el("div", { class: "meters" }, [
          meterBlock("과장응답 위험", rel.socialDesirability.value, rel.socialDesirability.level, "", sdNote + (rel.socialDesirability.n ? " (문항 " + rel.socialDesirability.n + "개)" : "")),
          meterBlock("응답 일관성", rel.consistency.value, rel.consistency.level, "", consNote + (rel.consistency.n ? " (유사 문항 " + rel.consistency.n + "쌍)" : "")),
          meterBlock("응답 균형", rel.responseBalance.value, rel.responseBalance.level, "", balNote)
        ])
      ])
    ]));

    side.appendChild(el("div", { class: "card" }, [
      el("div", { class: "card-head" }, [
        el("h2", { text: "프로파일 형태" }),
        el("span", { class: "note", text: "12축" })
      ]),
      el("div", { class: "card-body" }, [radarChart(r.dimensions)])
    ]));

    side.appendChild(el("div", { class: "card" }, [
      el("div", { class: "card-head" }, [
        el("h2", { text: "응답 분포" }),
        el("span", { class: "note", text: "선택지별 비율" })
      ]),
      el("div", { class: "card-body" }, [
        distChart(r.distribution),
        el("p", { style: "margin-top:12px; font-size:12px; color:var(--ink-2);", text: "극단(①⑤) " + rel.responseBalance.extremePct + "% · 중앙(③) " + rel.responseBalance.middlePct + "%. 실전에서는 극단 45% 이하, 중앙 35% 이하가 무난하다." })
      ])
    ]));

    grid.appendChild(main);
    grid.appendChild(side);
    wrap.appendChild(grid);

    wrap.appendChild(el("div", { class: "actions" }, [
      el("button", { class: "btn btn-primary", type: "button", text: "같은 세트 다시 응시", onclick: function () { startSet(r.setId); } }),
      el("button", { class: "btn", type: "button", text: "다른 세트 고르기", onclick: function () { go("home"); } }),
      el("button", { class: "btn", type: "button", text: "결과 JSON 내려받기", onclick: function () { download(r.setId + "-" + r.finishedAt + ".json", JSON.stringify(r, null, 2), "application/json"); } }),
      el("button", { class: "btn", type: "button", text: "응답 CSV 내려받기", onclick: function () { download(r.setId + "-" + r.finishedAt + ".csv", buildCSV(r), "text/csv"); } }),
      el("button", { class: "btn", type: "button", text: "JSON 클립보드 복사", onclick: function () { copyText(JSON.stringify(r, null, 2)); } })
    ]));

    wrap.appendChild(el("div", { class: "foot", text: "백분위는 원점수를 평균 " + r.norm.mean + " / 표준편차 " + r.norm.sd + "의 정규분포로 환산한 값이다. " + r.norm.note + ". 내려받기가 막힌 환경(임베드된 미리보기 등)에서는 'JSON 클립보드 복사'를 쓰면 된다." }));

    frag.appendChild(wrap);
    return frag;
  }

  function reviewCard(r) {
    var rows = r.responses || [];
    var tbody = el("tbody", {});
    rows.forEach(function (row) {
      tbody.appendChild(el("tr", {}, [
        el("td", { class: "num", text: row.group + row.mark }),
        el("td", { class: "stmt-col", text: row.text }),
        el("td", { class: "rev", text: DIM_BY_CODE[row.dim] ? DIM_BY_CODE[row.dim].short : "과장" }),
        el("td", { class: "rev", text: row.reverse ? "역채점" : "정" }),
        el("td", { class: "num", text: row.rating || "—" }),
        el("td", { class: "num", text: row.rating ? row.scored : "—" }),
        el("td", { class: "num", text: row.most ? "가깝다" : row.least ? "멀다" : "" })
      ]));
    });
    var table = el("table", { class: "reviewtable" }, [
      el("thead", {}, [el("tr", {}, [
        el("th", { text: "문항" }), el("th", { text: "문장" }), el("th", { text: "역량" }),
        el("th", { text: "채점" }), el("th", { text: "응답" }), el("th", { text: "환산" }), el("th", { text: "선택" })
      ])]),
      tbody
    ]);
    var det = el("details", { class: "review" }, [
      el("summary", {}, [
        el("span", { text: "문항별 응답 다시 보기 (" + rows.length + "문장)" }),
        el("span", { class: "caret", text: "펼치기 ▾" })
      ]),
      el("div", { style: "padding:0 20px 20px;" }, [el("div", { class: "tablescroll" }, [table])])
    ]);
    return el("div", { class: "card" }, [
      el("div", { class: "card-head" }, [
        el("h2", { text: "응답 원자료" }),
        el("span", { class: "note", text: "역채점 문항 포함" })
      ]),
      el("div", { style: "padding:0 0 0;" }, [det])
    ]);
  }

  /* 채점 시점에 원자료 표를 함께 만들어 결과 객체에 싣는다. */
  var _compute = computeResult;
  computeResult = function (session) {
    var r = _compute(session);
    var sheet = sheetFor(session.setId);
    var rows = [];
    sheet.groups.forEach(function (g, gi) {
      var pick = session.picks[gi] || {};
      g.forEach(function (item, si) {
        var rating = session.answers[item.id] || null;
        rows.push({
          group: gi + 1, mark: MARKS[si], id: item.id, dim: item.dim,
          text: item.text, reverse: item.key < 0,
          rating: rating, scored: rating ? scored(item, rating) : null,
          most: pick.most === item.id, least: pick.least === item.id
        });
      });
    });
    r.responses = rows;
    return r;
  };

  /* ---------------- 내보내기 ---------------- */

  function buildCSV(r) {
    var head = ["문항군", "문장기호", "문항ID", "역량코드", "역량명", "문항", "채점방향", "응답", "환산점수", "가장가깝다", "가장멀다"];
    var lines = [head.join(",")];
    r.responses.forEach(function (row) {
      var dim = DIM_BY_CODE[row.dim];
      lines.push([
        row.group, row.mark, row.id, row.dim,
        dim ? dim.name : "과장응답",
        '"' + row.text.replace(/"/g, '""') + '"',
        row.reverse ? "역채점" : "정채점",
        row.rating || "", row.scored === null ? "" : row.scored,
        row.most ? 1 : 0, row.least ? 1 : 0
      ].join(","));
    });
    lines.push("");
    lines.push("역량코드,역량명,문항수,원점수(1-5),환산점수(0-100),백분위,구간");
    r.dimensions.forEach(function (d) {
      lines.push([d.code, d.name, d.n, d.raw, d.score, d.percentile, d.band].join(","));
    });
    lines.push("");
    lines.push("지표,값,판정");
    lines.push(["과장응답위험", r.reliability.socialDesirability.value, r.reliability.socialDesirability.level].join(","));
    lines.push(["응답일관성", r.reliability.consistency.value, r.reliability.consistency.level].join(","));
    lines.push(["응답균형", r.reliability.responseBalance.value, r.reliability.responseBalance.level].join(","));
    return "﻿" + lines.join("\n");
  }

  function download(name, text, mime) {
    try {
      var blob = new Blob([text], { type: mime + ";charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = el("a", { href: url, download: name });
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 400);
      toast(name + " 내려받기를 시작했다.");
    } catch (e) {
      copyText(text);
    }
  }

  function copyText(text) {
    function fallback() {
      var ta = el("textarea", { style: "position:fixed;opacity:0;top:0;left:0;" });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); toast("클립보드에 복사했다."); }
      catch (e2) { toast("복사에 실패했다. 결과 화면을 직접 선택해 복사해야 한다."); }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast("클립보드에 복사했다."); }, fallback);
    } else fallback();
  }

  /* ---------------- 렌더 루프 ---------------- */

  function render() {
    var frag;
    var isCog = state.screen.indexOf("cog-") === 0;
    if (state.screen === "test" && state.session) frag = renderTest();
    else if (state.screen === "result" && state.result) { state.ui = null; frag = renderResult(); }
    else if (isCog && window.SKCT_COG) { state.ui = null; frag = window.SKCT_COG.render(state.screen); }
    else { state.screen = "home"; state.ui = null; frag = renderHome(); }

    root.innerHTML = "";
    root.appendChild(frag);
    applyTheme(store(K_THEME) || "auto");

    if (state.screen === "test") startTimer(); else stopTimer();
    if (window.SKCT_COG) window.SKCT_COG.afterRender(state.screen);
  }

  function init() {
    root = el("div", { id: "app" });
    toastEl = el("div", { class: "toast", role: "status", "aria-live": "polite" });
    document.body.appendChild(root);
    document.body.appendChild(toastEl);
    applyTheme(store(K_THEME) || "auto");
    render();
    if (!storageOK) {
      setTimeout(function () {
        toast("이 브라우저에서는 응시 기록을 저장할 수 없다(사생활 보호 모드). 결과는 제출 직후 화면에서만 볼 수 있으니 데이터를 내려받아 두면 된다.");
      }, 900);
    }
  }

  /* 인지역량 모듈이 같은 셸·유틸리티를 쓰도록 노출한다. */
  window.SKCT = {
    el: el, $: $, clamp: clamp, pad2: pad2, mmss: mmss,
    store: store, storageOK: function () { return storageOK; },
    toast: toast, appbar: appbar, go: go, render: render,
    download: download, copyText: copyText, buildCSVLine: null,
    confirmBox: confirmBox,
    percentileOf: percentileOf, erf: erf,
    state: state
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
