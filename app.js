const $ = (id) => document.getElementById(id);

const CASES = [
  // ★ いまは2局面で運用してる前提（6に増やす時はここに追加）
  {
    id: "case01",
    title: "局面1",
    folder: "case01",
    entry: { q1: "entry.179074931", q2: "entry.94393688", q3: "entry.103223312", q4: "entry.1462974134", q5: "entry.965249262" }
  },
  {
    id: "case02",
    title: "局面2",
    folder: "case02",
    entry: { q1: "entry.131585168", q2: "entry.1860590575", q3: "entry.927062088", q4: "entry.1346505265", q5: "entry.1951216814" }
  }
];

// Google Form（formResponse）
const FORM_ACTION = "https://docs.google.com/forms/d/e/1FAIpQLSfgKJORGMzF8J1E3uZXLLn80tkNMhhxfA5y4gGI33o3fOby-A/formResponse";

// 事前アンケートの entry
const ENTRY_PRE = {
  studentId: "entry.83230582",
  grade: "entry.907422778",
  exp: "entry.884953881"
};

let currentCaseIdx = -1;
let meta = null;

let lineKind = "bad"; // bad / best
let expKind = "A";    // A / B
let frameIdx = 0;

const metaCache = new Map();

// 回答データを保持（最後にまとめて1回だけ送信）
const answers = {
  pre: { studentId: "", grade: "", exp: "" },
  cases: {} // caseId -> {q1..q5}
};

// 解説閲覧（Aは最初から表示＝閲覧扱い、Bはクリック必須）
let seenA = false;
let seenB = false;

function setActive(btnIds, activeId) {
  btnIds.forEach(id => $(id).classList.toggle("active", id === activeId));
}

function metaUrl(caseObj) {
  return `./${caseObj.folder}/meta.json`;
}
function caseDir(caseObj) {
  return `./${caseObj.folder}`;
}
function getFrames() {
  if (!meta?.frames) return [];
  return meta.frames[lineKind] || [];
}

function updateSeenBadges() {
  $("seenA").textContent = `A：${seenA ? "✓" : "未"}`;
  $("seenB").textContent = `B：${seenB ? "✓" : "未"}`;
}

function render() {
  const frames = getFrames();
  if (!frames.length) {
    $("frameLabel").textContent = "（framesが空です：meta.json を確認してください）";
    return;
  }

  frameIdx = Math.max(0, Math.min(frameIdx, frames.length - 1));
  const fr = frames[frameIdx];

  // 画像
  $("boardImg").src = `${caseDir(CASES[currentCaseIdx])}/${fr.file}`;

  // ラベル
  $("frameLabel").textContent = fr.label || "";

  // スライダー
  $("frameSlider").max = String(frames.length - 1);
  $("frameSlider").value = String(frameIdx);
  $("frameCount").textContent = `${frameIdx + 1} / ${frames.length}`;

  // 解説
  const txt = meta?.llm_text?.[expKind] ?? "";
  $("expTitle").textContent = `解説${expKind}`;
  $("expText").textContent = txt || "（meta.json の llm_text に A/B を入れるとここに表示されます）";
}

async function loadCaseByIndex(idx) {
  currentCaseIdx = idx;
  const c = CASES[currentCaseIdx];

  $("caseTitle").textContent = c.title;
  $("caseTitleInline").textContent = c.title;
  $("caseProgress").textContent = `${currentCaseIdx + 1} / ${CASES.length}`;

  // 初期化
  lineKind = "bad";
  expKind = "A";
  frameIdx = 0;

  setActive(["btnBad", "btnBest"], "btnBad");
  setActive(["btnExpA", "btnExpB"], "btnExpA");

  // ★Aは最初から表示されるので閲覧扱い
  seenA = true;
  seenB = false;
  updateSeenBadges();

  // アンケUI初期化
  clearCaseInputs();

  // meta 読み込み（キャッシュ）
  if (metaCache.has(c.id)) {
    meta = metaCache.get(c.id);
  } else {
    const res = await fetch(metaUrl(c), { cache: "no-store" });
    meta = await res.json();
    metaCache.set(c.id, meta);
  }

  // 最後のボタン文言
  $("btnNextCase").textContent = (currentCaseIdx === CASES.length - 1) ? "送信して終了" : "回答して次へ";
  $("caseErr").textContent = "";

  render();
}

function showPage(which) {
  $("pagePre").style.display = (which === "pre") ? "" : "none";
  $("pageCase").style.display = (which === "case") ? "" : "none";
  $("pageThanks").style.display = (which === "thanks") ? "" : "none";
}

function getPreValue() {
  const studentId = $("studentId").value.trim();
  const grade = $("grade").value;
  const exp = document.querySelector('input[name="exp"]:checked')?.value || "";
  return { studentId, grade, exp };
}

function validatePre() {
  const { studentId, grade, exp } = getPreValue();
  if (!studentId) return "学籍番号を入力してください。";
  if (!grade) return "学年を選択してください。";
  if (!exp) return "将棋経験を1つ選んでください。";
  return "";
}

function buildScale(containerId, name) {
  const host = $(containerId);
  host.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const lab = document.createElement("label");
    const inp = document.createElement("input");
    inp.type = "radio";
    inp.name = name;
    inp.value = String(i);
    const span = document.createElement("span");
    span.textContent = String(i);
    lab.appendChild(inp);
    lab.appendChild(span);
    host.appendChild(lab);
  }
}

function clearCaseInputs() {
  // ラジオは name でまとめてクリア
  ["case_q1", "case_q2", "case_q3", "case_q4"].forEach(n => {
    document.querySelectorAll(`input[name="${n}"]`).forEach(el => el.checked = false);
  });
  $("q5Text").value = "";
}

function getScaleVal(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value || "";
}

function validateCase() {
  // 解説Bを一度は開いてほしい
  if (!seenB) return "解説Bを開いてから回答してください。（上の「解説B」を押してください）";

  const q1 = getScaleVal("case_q1");
  const q2 = getScaleVal("case_q2");
  const q3 = getScaleVal("case_q3");
  const q4 = getScaleVal("case_q4");

  if (!q1 || !q2 || !q3 || !q4) return "Q1〜Q4 をすべて回答してください。";
  return "";
}

function saveCurrentCaseAnswers() {
  const c = CASES[currentCaseIdx];
  answers.cases[c.id] = {
    q1: getScaleVal("case_q1"),
    q2: getScaleVal("case_q2"),
    q3: getScaleVal("case_q3"),
    q4: getScaleVal("case_q4"),
    q5: $("q5Text").value.trim()
  };
}

function submitAllToGoogleForm() {
  const form = $("gForm");
  form.action = FORM_ACTION;
  form.innerHTML = ""; // いったん全消し

  const add = (name, value) => {
    if (value == null) return;
    const v = String(value).trim();
    if (!v) return;
    const inp = document.createElement("input");
    inp.type = "hidden";
    inp.name = name;
    inp.value = v;
    form.appendChild(inp);
  };

  // 事前
  add(ENTRY_PRE.studentId, answers.pre.studentId);
  add(ENTRY_PRE.grade, answers.pre.grade);
  add(ENTRY_PRE.exp, answers.pre.exp);

  // 各局面
  for (const c of CASES) {
    const a = answers.cases[c.id] || {};
    add(c.entry.q1, a.q1 || "");
    add(c.entry.q2, a.q2 || "");
    add(c.entry.q3, a.q3 || "");
    add(c.entry.q4, a.q4 || "");
    add(c.entry.q5, a.q5 || "");
  }

  // 送信（CORS回避：hidden iframe）
  form.submit();
}

async function init() {
  // スケール生成（毎回同じUIを使い回す）
  buildScale("q1Scale", "case_q1");
  buildScale("q2Scale", "case_q2");
  buildScale("q3Scale", "case_q3");
  buildScale("q4Scale", "case_q4");

  // 事前 → 局面へ
  $("btnStart").addEventListener("click", async () => {
    const msg = validatePre();
    $("preErr").textContent = msg;
    if (msg) return;

    answers.pre = getPreValue();
    showPage("case");
    await loadCaseByIndex(0);
  });

  // PV切替
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

  // 解説切替（閲覧管理）
  $("btnExpA").addEventListener("click", () => {
    expKind = "A";
    setActive(["btnExpA","btnExpB"], "btnExpA");
    seenA = true; // 念のため
    updateSeenBadges();
    render();
  });
  $("btnExpB").addEventListener("click", () => {
    expKind = "B";
    setActive(["btnExpA","btnExpB"], "btnExpB");
    seenB = true;
    updateSeenBadges();
    render();
  });

  // フレーム移動
  $("prevBtn").addEventListener("click", () => { frameIdx--; render(); });
  $("nextBtn").addEventListener("click", () => { frameIdx++; render(); });
  $("frameSlider").addEventListener("input", (e) => {
    frameIdx = Number(e.target.value);
    render();
  });

  // 次へ（または送信）
  $("btnNextCase").addEventListener("click", async () => {
    const msg = validateCase();
    $("caseErr").textContent = msg;
    if (msg) return;

    saveCurrentCaseAnswers();

    if (currentCaseIdx < CASES.length - 1) {
      await loadCaseByIndex(currentCaseIdx + 1);
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }

    // 最後：送信して完了画面へ
    submitAllToGoogleForm();
    showPage("thanks");
    window.scrollTo({ top: 0, behavior: "instant" });
  });

  // 初期表示：事前アンケート
  showPage("pre");
  $("preErr").textContent = "";
}

init();
