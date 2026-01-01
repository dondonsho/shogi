const $ = (id) => document.getElementById(id);

function show(id) {
  ["screenPre","screenCase","screenSending","screenThanks","fatalBox"].forEach(x => {
    const el = $(x);
    if (!el) return;
    el.classList.toggle("hidden", x !== id);
  });
}

function fatal(msg, err) {
  console.error(msg, err || "");
  $("fatalText").textContent = msg + (err ? ("\n\n" + String(err)) : "");
  show("fatalBox");
}

function setActive(btnIds, activeId) {
  btnIds.forEach(id => {
    const el = $(id);
    if (!el) return;
    el.classList.toggle("active", id === activeId);
  });
}

/** 2局面（必要なら増やせる） */
const CASES = [
  { id: "case01", title: "局面1" },
  { id: "case02", title: "局面2" },
];

/** Google Form */
const FORM_ID = "1FAIpQLSfgKJORGMzF8J1E3uZXLLn80tkNMhhxfA5y4gGI33o3fOby-A";
const FORM_POST_URL = `https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`;

// 事前（経験）
const ENTRY_PRE = {
  studentId: "entry.83230582",
  grade:     "entry.907422778",
  exp:       "entry.884953881",
};

// 局面1
const ENTRY_CASE01 = {
  q1: "entry.179074931",
  q2: "entry.94393688",
  q3: "entry.103223312",
  q4: "entry.1462974134",
  free: "entry.965249262",
};

// 局面2
const ENTRY_CASE02 = {
  q1: "entry.131585168",
  q2: "entry.1860590575",
  q3: "entry.927062088",
  q4: "entry.1346505265",
  free: "entry.1951216814",
};

function entryForCase(caseId) {
  if (caseId === "case01") return ENTRY_CASE01;
  if (caseId === "case02") return ENTRY_CASE02;
  return null;
}

/** 将棋ビュー用 state */
let meta = null;
let caseIndex = 0;
let lineKind = "bad";
let expKind = "A";
let frameIdx = 0;

let viewedA = false;
let viewedB = false;

/** 回答の蓄積（最後に1回送信） */
const answers = {
  pre: { studentId:"", grade:"", exp:"" },
  cases: {}
};

function caseId() {
  return CASES[caseIndex]?.id || "case01";
}
function caseDir() {
  return `./${caseId()}`;
}
function metaUrl() {
  return `${caseDir()}/meta.json`;
}
function getFrames() {
  if (!meta?.frames) return [];
  return meta.frames[lineKind] || [];
}

function updateProgress() {
  const total = CASES.length;
  $("progressText").textContent = `局面 ${Math.min(caseIndex+1, total)} / ${total}`;
}

function updateCaseTitle() {
  const title = CASES[caseIndex]?.title || caseId();
  $("caseTitle").textContent = title;
  $("caseSurveyTitle").textContent = `解説評価アンケート（${title}）`;
}

function render() {
  const frames = getFrames();
  if (!frames.length) {
    $("frameLabel").textContent = "（framesが空です：meta.json を確認してください）";
    return;
  }

  frameIdx = Math.max(0, Math.min(frameIdx, frames.length - 1));
  const fr = frames[frameIdx];

  $("boardImg").src = `${caseDir()}/${fr.file}`;
  $("frameLabel").textContent = fr.label || "";

  $("frameSlider").max = String(frames.length - 1);
  $("frameSlider").value = String(frameIdx);
  $("frameCount").textContent = `${frameIdx + 1} / ${frames.length}`;

  const txt = meta?.llm_text?.[expKind] ?? "";
  $("expTitle").textContent = `解説${expKind}`;
  $("expText").textContent = txt || "（meta.json の llm_text に A/B を入れるとここに表示されます）";

  $("btnExpA").textContent = viewedA ? "解説A ✓" : "解説A";
  $("btnExpB").textContent = viewedB ? "解説B ✓" : "解説B";

  const isLast = (caseIndex === CASES.length - 1);
  $("btnCaseNext").textContent = isLast ? "回答して送信" : "回答して次へ";

  updateViewWarn();
}

function updateViewWarn() {
  const need = [];
  if (!viewedA) need.push("解説A");
  if (!viewedB) need.push("解説B");

  const warn = $("viewWarn");
  if (need.length) {
    warn.textContent = `※ ${need.join(" と ")} を読んでから回答してください（A→Bの順）`;
    $("btnCaseNext").disabled = true;
  } else {
    warn.textContent = "";
    $("btnCaseNext").disabled = false;
  }
}

async function loadCase(idx) {
  caseIndex = idx;
  updateProgress();
  updateCaseTitle();

  lineKind = "bad";
  expKind = "A";
  frameIdx = 0;

  setActive(["btnBad","btnBest"], "btnBad");
  setActive(["btnExpA","btnExpB"], "btnExpA");

  viewedA = true;   // 初期表示はAなので「閲覧済み」扱い
  viewedB = false;

  restoreCaseAnswerUI();

  const res = await fetch(metaUrl(), { cache: "no-store" });
  meta = await res.json();
  render();
}

/** 1〜5 ラジオ */
function buildScale(node) {
  node.innerHTML = "";
  for (let v = 1; v <= 5; v++) {
    const lab = document.createElement("label");
    lab.innerHTML = `<input type="radio" name="${node.dataset.q}" value="${v}"> ${v}`;
    node.appendChild(lab);
  }
}
function initScales() {
  document.querySelectorAll(".scale").forEach(buildScale);
}

function getRadioVal(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : "";
}
function setRadioVal(name, value) {
  if (!value) return;
  const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (el) el.checked = true;
}

function clearRadios() {
  ["q1","q2","q3","q4"].forEach(q => {
    document.querySelectorAll(`input[name="${q}"]`).forEach(r => r.checked = false);
  });
  $("freeText").value = "";
}

function restoreCaseAnswerUI() {
  const cid = caseId();
  const a = answers.cases[cid];
  if (!a) { clearRadios(); return; }
  setRadioVal("q1", a.q1);
  setRadioVal("q2", a.q2);
  setRadioVal("q3", a.q3);
  setRadioVal("q4", a.q4);
  $("freeText").value = a.free || "";
}

function saveCaseAnswerFromUI() {
  const cid = caseId();
  answers.cases[cid] = {
    q1: getRadioVal("q1"),
    q2: getRadioVal("q2"),
    q3: getRadioVal("q3"),
    q4: getRadioVal("q4"),
    free: ($("freeText").value || "").trim(),
  };
}

function validateCaseAnswers() {
  const a = {
    q1: getRadioVal("q1"),
    q2: getRadioVal("q2"),
    q3: getRadioVal("q3"),
    q4: getRadioVal("q4"),
  };
  const miss = Object.entries(a).filter(([k,v]) => !v).map(([k]) => k.toUpperCase());
  if (miss.length) {
    $("caseWarn").classList.remove("hidden");
    $("caseWarn").textContent = `未回答があります：${miss.join(", ")}（1〜5を選んでください）`;
    return false;
  }
  $("caseWarn").classList.add("hidden");
  $("caseWarn").textContent = "";
  return true;
}

/** 事前アンケ */
function getPreExpVal() {
  const el = document.querySelector(`input[name="preExp"]:checked`);
  return el ? el.value : "";
}

function validatePre() {
  const sid = ($("preStudentId").value || "").trim();
  const grade = ($("preGrade").value || "").trim();
  const exp = getPreExpVal();

  const warn = $("preWarn");
  warn.classList.add("hidden");
  warn.textContent = "";

  const miss = [];
  if (!sid) miss.push("学籍番号");
  if (!grade) miss.push("学年");
  if (!exp) miss.push("将棋経験（Q1）");

  if (miss.length) {
    warn.classList.remove("hidden");
    warn.textContent = `未入力があります：${miss.join(" / ")}`;
    return false;
  }

  answers.pre.studentId = sid;
  answers.pre.grade = grade;
  answers.pre.exp = exp;
  return true;
}

/** 送信 */
function buildPostBody() {
  const p = new URLSearchParams();

  p.append(ENTRY_PRE.studentId, answers.pre.studentId);
  p.append(ENTRY_PRE.grade, answers.pre.grade);
  p.append(ENTRY_PRE.exp, answers.pre.exp);

  for (const c of CASES) {
    const ent = entryForCase(c.id);
    const a = answers.cases[c.id] || {};
    if (!ent) continue;
    p.append(ent.q1, a.q1 || "");
    p.append(ent.q2, a.q2 || "");
    p.append(ent.q3, a.q3 || "");
    p.append(ent.q4, a.q4 || "");
    p.append(ent.free, a.free || "");
  }

  p.append("submit", "Submit");
  return p;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))
  ]);
}

async function submitAll() {
  show("screenSending");
  const body = buildPostBody();

  await withTimeout(fetch(FORM_POST_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: body.toString(),
  }), 8000);

  show("screenThanks");
}

/** 初期化 */
async function init() {
  initScales();

  $("btnPreNext").addEventListener("click", async () => {
    if (!validatePre()) return;
    show("screenCase");
    await loadCase(0);
  });

  $("btnBad").addEventListener("click", () => {
    lineKind = "bad";
    setActive(["btnBad","btnBest"], "btnBad");
    frameIdx = 0;
    render();
  });

  $("btnBest").addEventListener("click", () => {
    lineKind = "best";
    setActive(["btnBad","btnBest"], "btnBest");
    frameIdx = 0;
    render();
  });

  $("btnExpA").addEventListener("click", () => {
    expKind = "A";
    viewedA = true;
    setActive(["btnExpA","btnExpB"], "btnExpA");
    render();
  });

  $("btnExpB").addEventListener("click", () => {
    expKind = "B";
    viewedB = true;
    setActive(["btnExpA","btnExpB"], "btnExpB");
    render();
  });

  $("prevBtn").addEventListener("click", () => { frameIdx--; render(); });
  $("nextBtn").addEventListener("click", () => { frameIdx++; render(); });
  $("frameSlider").addEventListener("input", (e) => {
    frameIdx = Number(e.target.value);
    render();
  });

  $("btnCaseNext").addEventListener("click", async () => {
    if (!viewedA || !viewedB) { updateViewWarn(); return; }
    if (!validateCaseAnswers()) return;

    saveCaseAnswerFromUI();

    const isLast = (caseIndex === CASES.length - 1);
    if (!isLast) {
      await loadCase(caseIndex + 1);
      return;
    }
    await submitAll();
  });

  show("screenPre");
  $("progressText").textContent = "";
}

init().catch(e => fatal("初期化に失敗しました（コピペ漏れの可能性）", e));
