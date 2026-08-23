"use strict";

const $ = (id) => document.getElementById(id);
const state = { write: null };

/* ── 공통 유틸 ───────────────────────────────── */

function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

let toastTimer;
function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 1800);
}

async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${label}을(를) 복사했어요`);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); toast(`${label}을(를) 복사했어요`); }
    catch { toast("복사에 실패했어요. 직접 선택해 주세요."); }
    ta.remove();
  }
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ error: "서버 응답을 읽지 못했어요." }));
  if (!res.ok) throw new Error(data.error || `요청이 실패했어요 (${res.status})`);
  return data;
}

function showError(el, message) {
  el.textContent = message;
  el.hidden = false;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ── 탭 ─────────────────────────────────────── */

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

function switchTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("is-active", t.dataset.tab === name));
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("is-active", p.id === `panel-${name}`));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ── 상태 확인 ───────────────────────────────── */

async function checkHealth() {
  const box = $("status");
  const text = $("statusText");
  try {
    const res = await fetch("./api/health");
    const data = await res.json();
    if (data.hasApiKey) {
      box.className = "status ok";
      text.textContent = `준비됨 · ${data.model}`;
    } else {
      box.className = "status bad";
      text.textContent = "API 키 없음 — .env 설정 필요";
    }
  } catch {
    box.className = "status bad";
    text.textContent = "서버에 연결하지 못했어요";
  }
}

/* ── 주제 추천 ───────────────────────────────── */

$("suggestForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("suggestBtn");
  $("suggestError").hidden = true;
  $("suggestResult").hidden = true;
  $("suggestLoading").hidden = false;
  btn.disabled = true;

  try {
    const data = await postJSON("./api/suggest", {
      seed: $("seed").value,
      today: $("suggestToday").value,
    });
    renderSuggest(data);
  } catch (err) {
    showError($("suggestError"), err.message);
  } finally {
    $("suggestLoading").hidden = true;
    btn.disabled = false;
  }
});

function renderSuggest(data) {
  const r = data.result ?? {};
  const list = $("candidates");
  list.innerHTML = "";

  if ((r.needs_input ?? []).length > 0) {
    showError($("suggestError"), `진행하려면 더 필요한 정보가 있어요: ${r.needs_input.join(", ")}`);
    return;
  }

  $("suggestMeta").textContent =
    `기준 날짜 ${data.input?.TODAY ?? ""}${data.input?.SEED ? ` · 범주 "${data.input.SEED}"` : " · 시즌 기반"}` +
    ` · 생성 ${data.attempts}회`;

  (r.candidates ?? []).forEach((c) => {
    const isRec = c.id === r.recommended_id;
    const card = el("article", `cand${isRec ? " is-rec" : ""}`);

    const top = el("div", "cand-top");
    top.append(el("span", "pill", c.timeliness || "상시"));
    if (isRec) top.append(el("span", "pill pill-rec", "추천"));
    card.append(top);

    card.append(el("h3", null, c.title));
    card.append(el("p", null, `검색 의도 · ${c.intent}`));
    card.append(el("p", null, `대표 키워드 · ${c.primary_keyword}`));
    card.append(el("p", null, c.reason));
    if (isRec && r.recommend_reason) {
      card.append(el("p", null, `추천 이유 · ${r.recommend_reason}`));
    }

    const btn = el("button", "btn btn-ghost", "이 주제로 원고 쓰기");
    btn.type = "button";
    btn.addEventListener("click", () => {
      $("topic").value = c.title;
      $("seriesIndex").value = "1";
      $("prevSummary").value = "";
      togglePrev();
      switchTab("write");
      $("topic").focus();
    });
    card.append(btn);
    list.append(card);
  });

  const notes = [...(r.assumptions ?? [])];
  const notesBox = $("suggestNotes");
  if (notes.length > 0) {
    notesBox.innerHTML = "";
    notesBox.append(el("h3", null, "엔진이 세운 가정"));
    const ul = el("ul", "list");
    notes.forEach((n) => ul.append(el("li", null, n)));
    notesBox.append(ul);
    notesBox.hidden = false;
  } else {
    notesBox.hidden = true;
  }

  $("suggestResult").hidden = false;
}

/* ── 원고 작성 ───────────────────────────────── */

function togglePrev() {
  $("prevWrap").hidden = Number($("seriesIndex").value) < 2;
}
$("seriesIndex").addEventListener("input", togglePrev);

$("writeForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!$("topic").value.trim()) {
    showError($("writeError"), "주제를 입력해 주세요.");
    return;
  }
  const btn = $("writeBtn");
  $("writeError").hidden = true;
  $("writeResult").hidden = true;
  $("writeLoading").hidden = false;
  btn.disabled = true;

  try {
    const data = await postJSON("./api/write", {
      topic: $("topic").value,
      seriesIndex: Number($("seriesIndex").value) || 1,
      prevSummary: $("prevSummary").value,
      affiliate: $("affiliate").checked,
      today: $("writeToday").value,
      extra: $("extra").value,
    });
    state.write = data;
    renderWrite(data);
    loadHistory();
  } catch (err) {
    showError($("writeError"), err.message);
  } finally {
    $("writeLoading").hidden = true;
    btn.disabled = false;
  }
});

function renderWrite(data) {
  const r = data.result ?? {};

  if ((r.needs_input ?? []).length > 0) {
    showError($("writeError"), `진행하려면 더 필요한 정보가 있어요: ${r.needs_input.join(", ")}`);
    return;
  }

  $("resultTitle").textContent = r.title ?? "";
  $("bodyText").textContent = r.body_plain ?? "";
  $("primaryKeyword").textContent = r.primary_keyword ?? "";

  renderChips($("relatedKeywords"), r.related_keywords ?? []);
  renderChips($("tags"), (r.tags ?? []).map((t) => (t.startsWith("#") ? t : `#${t}`)));

  $("thumbMain").textContent = r.thumbnail_text?.main ?? "";
  $("thumbSub").textContent = r.thumbnail_text?.sub ?? "";

  renderBadges(data);
  renderIssues(data.issues ?? []);
  renderListCard($("verifyCard"), $("verifyList"), r.verify_required ?? []);
  renderListCard($("assumeCard"), $("assumeList"), r.assumptions ?? []);

  if (r.next_episode_hint) {
    $("nextHint").textContent = r.next_episode_hint;
    $("nextCard").hidden = false;
  } else {
    $("nextCard").hidden = true;
  }

  $("writeResult").hidden = false;
}

function renderChips(container, items) {
  container.innerHTML = "";
  items.forEach((t) => container.append(el("span", "chip", t)));
}

function renderListCard(card, list, items) {
  list.innerHTML = "";
  if (items.length === 0) { card.hidden = true; return; }
  items.forEach((t) => list.append(el("li", null, t)));
  card.hidden = false;
}

function renderBadges(data) {
  const box = $("badges");
  box.innerHTML = "";
  const s = data.stats ?? {};
  const r = data.result ?? {};
  const codes = new Set((data.issues ?? []).map((i) => i.code));
  const inRange = s.chars >= 1500 && s.chars <= 2200;

  const add = (text, level) => box.append(el("span", `badge ${level}`, text));

  add(`${s.chars ?? r.char_count}자 (공백 포함)`, inRange ? "good" : "bad");
  add(`줄바꿈 제외 ${s.charsNoNewline ?? "-"}자`, "");
  add(
    (s.markdown?.length ?? 0) === 0 ? "마크다운 기호 없음" : `마크다운 기호 ${s.markdown.length}곳`,
    (s.markdown?.length ?? 0) === 0 ? "good" : "bad",
  );
  add(
    codes.has("no_closing_question") ? "마무리 질문 없음" : "질문형 마무리",
    codes.has("no_closing_question") ? "bad" : "good",
  );
  add(`소제목 ${s.headings?.length ?? 0}개(추정)`, codes.has("section_count") ? "mid" : "good");
  add(`${data.attempts}회 생성`, data.attempts > 1 ? "mid" : "");
  if (data.saved_id) add("output/ 에 저장됨", "");
}

function renderIssues(issues) {
  const box = $("issueBox");
  if (issues.length === 0) { box.hidden = true; return; }
  box.innerHTML = "";
  const errs = issues.filter((i) => i.severity === "error");
  box.className = `alert ${errs.length > 0 ? "alert-error" : "alert-warn"}`;
  box.append(el("strong", null, errs.length > 0 ? "규칙 위반이 남아 있어요" : "발행 전에 확인해 보세요"));
  const ul = el("ul");
  issues.forEach((i) => ul.append(el("li", null, i.message)));
  box.append(ul);
  box.hidden = false;
}

/* ── 복사 / 저장 ─────────────────────────────── */

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-copy]");
  if (!btn || !state.write) return;
  const r = state.write.result ?? {};
  const map = {
    title: [r.title ?? "", "제목"],
    body: [r.body_plain ?? "", "본문"],
    all: [`${r.title ?? ""}\n\n${r.body_plain ?? ""}`, "제목과 본문"],
    tags: [(r.tags ?? []).map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" "), "태그"],
  };
  const [text, label] = map[btn.dataset.copy] ?? [];
  if (text !== undefined) copyText(text, label);
});

$("downloadBtn").addEventListener("click", () => {
  const r = state.write?.result;
  if (!r) return;
  const tags = (r.tags ?? []).map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ");
  const content = `${r.title}\n\n${r.body_plain}\n\n${tags}\n`;
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(r.title || "원고").replace(/[\\/:*?"<>|]/g, "")}.txt`;
  a.click();
  URL.revokeObjectURL(url);
});

$("nextBtn").addEventListener("click", () => {
  const r = state.write?.result;
  if (!r) return;
  $("topic").value = r.next_episode_hint || "";
  $("seriesIndex").value = String((Number(r.series_index) || 1) + 1);
  $("prevSummary").value = `${r.title} — ${String(r.body_plain).slice(0, 200)}`;
  togglePrev();
  window.scrollTo({ top: 0, behavior: "smooth" });
  $("topic").focus();
});

/* ── 이력 ───────────────────────────────────── */

async function loadHistory() {
  try {
    const res = await fetch("./api/history");
    const { items = [] } = await res.json();
    const card = $("historyCard");
    const list = $("historyList");
    if (items.length === 0) { card.hidden = true; return; }
    list.innerHTML = "";
    items.forEach((it) => {
      const li = document.createElement("li");
      const left = el("div");
      left.append(el("div", "h-title", it.title));
      left.append(el("div", "h-meta", `${(it.created_at || "").slice(0, 16).replace("T", " ")} · ${it.series_index}회차 · ${it.primary_keyword}`));
      li.append(left);

      const btn = el("button", "btn btn-ghost btn-sm", "이어서 다음 편 쓰기");
      btn.type = "button";
      btn.addEventListener("click", () => {
        $("topic").value = it.next_episode_hint || "";
        $("seriesIndex").value = String((Number(it.series_index) || 1) + 1);
        $("prevSummary").value = `${it.title} — ${it.summary}`;
        togglePrev();
        window.scrollTo({ top: 0, behavior: "smooth" });
        $("topic").focus();
      });
      li.append(btn);
      list.append(li);
    });
    card.hidden = false;
  } catch {
    /* 이력은 없어도 그만 */
  }
}

$("reloadHistory").addEventListener("click", loadHistory);

/* ── 초기화 ─────────────────────────────────── */

$("suggestToday").value = todayISO();
$("writeToday").value = todayISO();
togglePrev();
checkHealth();
loadHistory();
