/* 응시 중 쓰는 도구 — 메모장 · 그림판 · 계산기
 * 실제 SKCT 응시 화면에서 제공되는 세 가지를 같은 형태로 올린다.
 * 창은 #app 바깥(document.body)에 붙는다. 문항을 넘길 때마다 화면을 다시 그리는데,
 * 창이 #app 안에 있으면 그때마다 적어 둔 메모와 그림이 날아가기 때문이다.
 */
(function () {
  "use strict";

  var S = window.SKCT;
  if (!S) return;
  var el = S.el, store = S.store;

  var K_NOTE = "skct.tools.v1.note";
  var K_DRAW = "skct.tools.v1.draw";

  var dock = null, wins = {}, z = 60, built = false;

  function narrow() { return window.innerWidth <= 720; }

  /* ---------------- 창 ---------------- */

  function makeWin(key, title, bodyNode, pos) {
    var head = el("div", { class: "toolwin-head" }, [
      el("span", { class: "toolwin-title", text: title }),
      el("button", { class: "toolwin-x", type: "button", "aria-label": title + " 닫기", text: "✕",
        onclick: function () { toggle(key, false); } })
    ]);
    var win = el("div", {
      class: "toolwin toolwin-" + key, tabindex: "-1",
      role: "dialog", "aria-label": title,
      style: "left:" + pos[0] + "px; top:" + pos[1] + "px;"
    }, [head, el("div", { class: "toolwin-body" }, [bodyNode])]);
    win.hidden = true;

    /* 머리글을 잡아 옮긴다 */
    var drag = null;
    head.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".toolwin-x") || narrow()) return;
      var r = win.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      head.setPointerCapture(e.pointerId);
      raise(win);
    });
    head.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var w = win.offsetWidth, h = win.offsetHeight;
      var x = Math.min(Math.max(0, e.clientX - drag.dx), window.innerWidth - w);
      var y = Math.min(Math.max(0, e.clientY - drag.dy), window.innerHeight - 40);
      win.style.left = x + "px";
      win.style.top = y + "px";
    });
    head.addEventListener("pointerup", function () { drag = null; });
    head.addEventListener("pointercancel", function () { drag = null; });
    win.addEventListener("pointerdown", function () { raise(win); });
    return win;
  }
  function raise(win) { z++; win.style.zIndex = String(z); }

  function toggle(key, on) {
    var win = wins[key];
    if (!win) return;
    var show = on === undefined ? win.hidden : on;
    /* 좁은 화면에서는 창이 화면을 다 덮으므로 한 번에 하나만 연다 */
    if (show && narrow()) Object.keys(wins).forEach(function (k) { if (k !== key) toggle(k, false); });
    win.hidden = !show;
    if (show) {
      raise(win);
      var inner = win.querySelector(".toolcalc, .toolnote") || win;
      inner.focus();
      if (key === "draw") fitCanvas();
    }
    dockBtns[key].classList.toggle("is-on", show);
    dockBtns[key].setAttribute("aria-pressed", String(show));
  }

  /* ---------------- 메모장 ---------------- */

  function buildNote() {
    var ta = el("textarea", {
      class: "toolnote", spellcheck: "false", "aria-label": "메모장",
      placeholder: "조건을 옮겨 적거나 계산 과정을 남겨 둔다. 이 브라우저에만 저장된다."
    });
    ta.value = store(K_NOTE) || "";
    var timer = null;
    ta.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () { store(K_NOTE, ta.value); }, 400);
    });
    return el("div", { class: "toolnote-wrap" }, [
      ta,
      el("div", { class: "toolbar-row" }, [
        el("button", { class: "toolbtn", type: "button", text: "전체 지우기",
          onclick: function () { ta.value = ""; store(K_NOTE, ""); ta.focus(); } })
      ])
    ]);
  }

  /* ---------------- 그림판 ---------------- */

  var canvas = null, ctx = null, sized = false, pen = { color: "#111111", size: 2, erase: false };

  /* 캔버스는 만들 때 크기를 주고, 준비는 한 번만 한다.
     canvas.width는 지정하지 않아도 300이라 그 값으로 '이미 준비됐는지'를 판단할 수 없다.
     또 width를 다시 대입하면 그려 둔 그림이 지워진다. */
  function fitCanvas() {
    if (!canvas || sized) return;
    sized = true;
    ctx = canvas.getContext("2d");
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    var saved = store(K_DRAW);
    if (saved) {
      var img = new Image();
      img.onload = function () { ctx.drawImage(img, 0, 0); };
      img.src = saved;
    }
  }
  function saveDraw() {
    try { store(K_DRAW, canvas.toDataURL("image/png")); } catch (e) { /* 저장 공간이 없으면 그냥 둔다 */ }
  }
  function buildDraw() {
    canvas = el("canvas", { class: "tooldraw", width: "560", height: "360", "aria-label": "그림판" });
    var drawing = false, last = null;
    function at(e) {
      var r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (canvas.width / r.width),
               y: (e.clientY - r.top) * (canvas.height / r.height) };
    }
    function stroke(p) {
      ctx.strokeStyle = pen.erase ? "#ffffff" : pen.color;
      ctx.lineWidth = pen.erase ? pen.size * 6 : pen.size;
      ctx.globalCompositeOperation = pen.erase ? "destination-out" : "source-over";
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
    }
    canvas.addEventListener("pointerdown", function (e) {
      fitCanvas();
      drawing = true; last = at(e);
      canvas.setPointerCapture(e.pointerId);
      stroke(at(e));
      e.preventDefault();
    });
    canvas.addEventListener("pointermove", function (e) { if (drawing) { stroke(at(e)); e.preventDefault(); } });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (t) {
      canvas.addEventListener(t, function () { if (drawing) { drawing = false; saveDraw(); } });
    });

    function swatch(color) {
      return el("button", {
        class: "toolsw" + (pen.color === color && !pen.erase ? " is-on" : ""),
        type: "button", "aria-label": "색 " + color, style: "background:" + color + ";",
        onclick: function (e) {
          pen.color = color; pen.erase = false;
          syncDrawBar(e.target.closest(".toolbar-row"));
        }
      });
    }
    function sizeBtn(n, label) {
      return el("button", { class: "toolbtn tool-size" + (pen.size === n ? " is-on" : ""), type: "button",
        "data-size": String(n), text: label,
        onclick: function (e) { pen.size = n; syncDrawBar(e.target.closest(".toolbar-row")); } });
    }
    var eraseBtn = el("button", { class: "toolbtn tool-erase", type: "button", text: "지우개",
      onclick: function (e) { pen.erase = !pen.erase; syncDrawBar(e.target.closest(".toolbar-row")); } });

    var bar = el("div", { class: "toolbar-row" }, [
      swatch("#111111"), swatch("#2a78d6"), swatch("#c9541f"),
      el("span", { class: "toolbar-sep" }),
      sizeBtn(2, "가늘게"), sizeBtn(4, "보통"), sizeBtn(8, "굵게"),
      el("span", { class: "toolbar-sep" }),
      eraseBtn,
      el("button", { class: "toolbtn", type: "button", text: "전체 지우기",
        onclick: function () {
          fitCanvas();
          ctx.globalCompositeOperation = "source-over";
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          saveDraw();
        } })
    ]);
    return el("div", { class: "tooldraw-wrap" }, [canvas, bar]);
  }
  function syncDrawBar(bar) {
    if (!bar) return;
    [].forEach.call(bar.querySelectorAll(".toolsw"), function (b) {
      b.classList.toggle("is-on", !pen.erase && b.style.background.indexOf(hexToRgb(pen.color)) >= 0);
    });
    [].forEach.call(bar.querySelectorAll(".tool-size"), function (b) {
      b.classList.toggle("is-on", Number(b.dataset.size) === pen.size);
    });
    var er = bar.querySelector(".tool-erase");
    if (er) { er.classList.toggle("is-on", pen.erase); er.setAttribute("aria-pressed", String(pen.erase)); }
  }
  function hexToRgb(h) {
    var n = parseInt(h.slice(1), 16);
    return "rgb(" + ((n >> 16) & 255) + ", " + ((n >> 8) & 255) + ", " + (n & 255) + ")";
  }

  /* ---------------- 계산기 ---------------- */

  var calc = { cur: "0", acc: null, op: null, fresh: true }, calcOut = null;

  function calcShow() { if (calcOut) calcOut.textContent = calc.cur; }
  function calcDigit(d) {
    if (calc.fresh) { calc.cur = d === "." ? "0." : d; calc.fresh = false; }
    else if (d === "." ) { if (calc.cur.indexOf(".") < 0) calc.cur += "."; }
    else if (calc.cur === "0") calc.cur = d;
    else if (calc.cur.replace(/[^0-9]/g, "").length < 12) calc.cur += d;
    calcShow();
  }
  function apply(a, b, op) {
    if (op === "+") return a + b;
    if (op === "−") return a - b;
    if (op === "×") return a * b;
    if (op === "÷") return b === 0 ? NaN : a / b;
    return b;
  }
  function fmt(v) {
    if (!isFinite(v)) return "오류";
    var r = Math.round(v * 1e10) / 1e10;
    return String(r).length > 14 ? r.toPrecision(10).replace(/\.?0+e/, "e") : String(r);
  }
  function calcOp(op) {
    var v = parseFloat(calc.cur);
    if (calc.op !== null && !calc.fresh) { v = apply(calc.acc, v, calc.op); calc.cur = fmt(v); calcShow(); }
    calc.acc = isFinite(v) ? v : 0;
    calc.op = op; calc.fresh = true;
  }
  function calcEq() {
    if (calc.op === null) { calc.fresh = true; return; }
    var v = apply(calc.acc, parseFloat(calc.cur), calc.op);
    calc.cur = fmt(v); calc.acc = null; calc.op = null; calc.fresh = true;
    calcShow();
  }
  function calcClear() { calc = { cur: "0", acc: null, op: null, fresh: true }; calcShow(); }
  function calcBack() {
    if (calc.fresh) return;
    calc.cur = calc.cur.length > 1 ? calc.cur.slice(0, -1) : "0";
    if (calc.cur === "-" ) calc.cur = "0";
    calcShow();
  }
  function calcSign() {
    calc.cur = calc.cur.charAt(0) === "-" ? calc.cur.slice(1) : "-" + calc.cur;
    calcShow();
  }
  function calcPct() { calc.cur = fmt(parseFloat(calc.cur) / 100); calc.fresh = false; calcShow(); }

  function buildCalc() {
    calcOut = el("div", { class: "toolcalc-out num", role: "status", "aria-live": "polite", text: "0" });
    var keys = [
      ["C", calcClear, "fn"], ["⌫", calcBack, "fn"], ["%", calcPct, "fn"], ["÷", function () { calcOp("÷"); }, "op"],
      ["7", null], ["8", null], ["9", null], ["×", function () { calcOp("×"); }, "op"],
      ["4", null], ["5", null], ["6", null], ["−", function () { calcOp("−"); }, "op"],
      ["1", null], ["2", null], ["3", null], ["+", function () { calcOp("+"); }, "op"],
      ["±", calcSign, "fn"], ["0", null], [".", null], ["=", calcEq, "eq"]
    ];
    var pad = el("div", { class: "toolcalc-pad" }, keys.map(function (k) {
      return el("button", {
        class: "toolkey" + (k[2] ? " is-" + k[2] : ""), type: "button", text: k[0],
        onclick: k[1] || function () { calcDigit(k[0]); }
      });
    }));
    /* 키보드로 두드리려면 포커스를 받을 수 있어야 한다. 창을 열 때 여기로 포커스를 준다. */
    var wrap = el("div", { class: "toolcalc", tabindex: "0", "aria-label": "계산기" }, [calcOut, pad]);
    /* 창 안에서는 키보드로도 두드릴 수 있게 한다 */
    wrap.addEventListener("keydown", function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var k = e.key;
      if (/^[0-9.]$/.test(k)) { calcDigit(k); }
      else if (k === "+" || k === "-" || k === "*" || k === "/") {
        calcOp({ "+": "+", "-": "−", "*": "×", "/": "÷" }[k]);
      }
      else if (k === "Enter" || k === "=") calcEq();
      else if (k === "Backspace") calcBack();
      else if (k === "Escape" || k === "c" || k === "C") calcClear();
      else return;
      e.preventDefault();
      e.stopPropagation();
    });
    return wrap;
  }

  /* ---------------- 도크 ---------------- */

  var dockBtns = {};
  var DEFS = [
    { key: "note", title: "메모장", icon: "✎", build: buildNote, pos: [null, 90] },
    { key: "draw", title: "그림판", icon: "✐", build: buildDraw, pos: [null, 150] },
    { key: "calc", title: "계산기", icon: "＋", build: buildCalc, pos: [null, 210] }
  ];

  function build() {
    if (built) return;
    built = true;
    var right = 24;
    DEFS.forEach(function (d, i) {
      var x = Math.max(16, window.innerWidth - 360 - right - i * 28);
      wins[d.key] = makeWin(d.key, d.title, d.build(), [x, d.pos[1]]);
      document.body.appendChild(wins[d.key]);
    });
    dock = el("div", { class: "tooldock", role: "group", "aria-label": "응시 도구" },
      DEFS.map(function (d) {
        var b = el("button", {
          class: "tooldock-btn", type: "button", "aria-pressed": "false",
          title: d.title, onclick: function () { toggle(d.key); }
        }, [
          el("span", { class: "tooldock-ico", "aria-hidden": "true", text: d.icon }),
          el("span", { class: "tooldock-t", text: d.title })
        ]);
        dockBtns[d.key] = b;
        return b;
      }));
    dock.hidden = true;
    document.body.appendChild(dock);
  }

  /* 응시 화면에서만, 그리고 시간이 흐르는 동안에만 쓸 수 있다.
     멈춰 놓고 계산기를 두드릴 수 있으면 일시정지가 공짜 시간이 된다. */
  function setActive(on) {
    build();
    if (dock.hidden === !on) return;
    dock.hidden = !on;
    if (!on) Object.keys(wins).forEach(function (k) { toggle(k, false); });
  }

  window.SKCT_TOOLS = { setActive: setActive };
})();
