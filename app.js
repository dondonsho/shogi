const $ = (id) => document.getElementById(id);

// ================================
// 1) ここだけあなたが差し替える
// ================================
// GoogleフォームID（URLに入ってるやつ）
const FORM_ID = "1FAIpQLSfgKJORGMzF8J1E3uZXLLn80tkNMhhxfA5y4gGI33o3fOby-A";
const FORM_ACTION = `https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`;

// ★ここに「entry番号」を入れる（事前入力リンクで取ったやつ）
// 例: "entry.1234567890"
const ENTRY = {
  // --- 経験アンケート ---
  studentId: "entry.83230582",
  grade: "entry.907422778",
  expLevel: "entry.884953881",

  // 任意（今回のURLに出てないので一旦空でOK）
  expMode: "",
  expRating: "",
  expNote: "",

  // --- 局面1（セクション2） ---
  case01: {
    q1: "entry.179074931",
    q2: "entry.94393688",
    q3: "entry.103223312",
    q4: "entry.1462974134",
    q5: "entry.965249262",
  },

  // --- 局面2（セクション3） ---
  case02: {
    q1: "entry.131585168",
    q2: "entry.1860590575",
    q3: "entry.927062088",
    q4: "entry.1346505265",
    q5: "entry.1951216814",
  },
};


// ================================
// 2) ケース（フォルダ名は case01 / case02 固定）
// ================================
const CASES = [
  { id: "case01", title: "局面1" },
  { id: "case02", title: "局面2" },
];

let meta = null;
let caseIndex = 0;  // 0=>case01, 1=>case02
let lineKind = "bad"; // "bad" or "best"
let expKind = "A";    // "A" or "B"
let frameIdx = 0;

let unlockedB = false;

// 回答保持（最後にまとめてGoogleフォームへ送る）
const answers = {
  experience: {
    studentId: "",
    grade: "",
    expLevel: "",
    expMode: [],
    expRating: "",
    expNote: ""
  },
  cases: {
    case01: { q1:"", q2:"", q3:"", q4:"", q5:"" },
    case02: { q1:"", q2:"", q3:"", q4:"", q5:"" },
  }
};

function setActive(btnIds, activeId) {
  btnIds.forEach(id => $(id).classList.toggle("active", id === activeId));
}

function metaUrl(caseId) {
  return `./${caseId}/meta.json`;
}
function caseDir(caseId) {
  return `./${caseId}`;
}

function getFrames() {
  if (!meta?.frames) return [];
  return meta.frames[lineKind] || [];
}

// ================================
// UI: Likert（1-5）生成
// ================================
function buildLikert(containerId, name) {
  const root = $(containerId);
  root.innerHTML = "";
  for (let v = 1; v <= 5; v++) {
    const lab = document.createElement("label");
    lab.innerHTML = `<input type="radio" name="${name}" value="${v}"> ${v}`;
    root.appendChild(lab);
  }
}
function getRadio(name) {
  const el = document.querySelector(`input[type="radio"][name="${name}"]:checked`);
  return el ? el.value : "";
}
function setRadio(name, value) {
  const els = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
  els.forEach(e => e.checked = (String(e.value) === String(value)));
}
function getChecks(name) {
  return Array.from(document.querySelectorAll(`input[type="checkbox"][name="${name}"]:checked`))
    .map(el => el.value);
}

// ================================
// 描画
// ================================
function render() {
  const caseId = CASES[caseIndex].id;
  const frames = getFrames();

  $("caseTitle").textContent = `${CASES[caseIndex].title}（${caseId}）`;

  // metaの要約（あれば）
  const ply = meta?.ply ?? "";
  const side = meta?.side ?? "";
  const mk = meta?.move_kif ?? "";
  const best = meta?.best_kif ?? "";
  let metaLine = [];
  if (ply !== "") metaLine.push(`手数: ${ply}`);
  if (side) metaLine.push(`指した側: ${side}`);
  if (mk) metaLine.push(`悪手: ${mk}`);
  if (best) metaLine.push(`最善: ${best}`);
  $("caseMeta").textContent = metaLine.join(" / ");

  if (!frames.length) {
    $("frameLabel").textContent = "（framesが空です：meta.json を確認してください）";
    $("boardImg").removeAttribute("src");
    $("frameSlider").max = "0";
    $("frameSlider").value = "0";
    $("frameCount").textContent = "";
    return;
  }

  frameIdx = Math.max(0, Math.min(frameIdx, frames.length - 1));
  const fr = frames[frameIdx];

  // 画像（キャッシュ対策で v= を付ける）
  $("boardImg").src = `${caseDir(caseId)}/${fr.file}?v=${Date.now()}`;

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

  // Bロック
  $("btnExpB").disabled = !unlockedB;
  $("btnUnlockB").disabled = unlockedB;
  $("orderNotice").style.display = unlockedB ? "none" : "block";
}

// ================================
// ケース読み込み
// ================================
async function loadCaseByIndex(newIndex) {
  caseIndex = newIndex;
  const caseId = CASES[caseIndex].id;

  // リセット
  lineKind = "bad";
  expKind = "A";
  frameIdx = 0;
  unlockedB = false;

  setActive(["btnBad","btnBest"], "btnBad");
  setActive(["btnExpA","btnExpB"], "btnExpA");
  $("btnExpB").disabled = true;

  // UI（回答欄）初期化
  setRadio("case_q1", "");
  setRadio("case_q2", "");
  setRadio("case_q3", "");
  setRadio("case_q4", "");
  $("caseComment").value = "";

  $("caseWarn").textContent = "";

  // metaロード
  let res;
  try {
    res = await fetch(metaUrl(caseId), { cache: "no-store" });
  } catch (e) {
    $("caseWarn").textContent = "meta.json の読み込みに失敗しました（ネットワーク or パス確認）";
    throw e;
  }
  if (!res.ok) {
    $("caseWarn").textContent = `meta.json が見つかりません: ./${caseId}/meta.json （HTTP ${res.status}）`;
    throw new Error("meta.json not found");
  }
  meta = await res.json();

  // 次へボタン文言
  $("btnNext").textContent = (caseIndex === CASES.length - 1)
    ? "回答して送信"
    : "回答して次へ（次の局面へ）";

  render();
}

// ================================
// Step切り替え
// ================================
function showExperienceStep() {
  $("stepText").textContent = "Step 1 / 3（将棋経験）";
  $("experiencePanel").hidden = false;
  $("viewerPanel").hidden = true;
  $("answerPanel").hidden = true;
  $("thanksPanel").hidden = true;
}

function showCaseStep() {
  $("stepText").textContent = `Step ${2 + caseIndex} / 3（${CASES[caseIndex].title}）`;
  $("experiencePanel").hidden = true;
  $("viewerPanel").hidden = false;
  $("answerPanel").hidden = false;
  $("thanksPanel").hidden = true;
}

function showThanks() {
  $("stepText").textContent = "完了";
  $("experiencePanel").hidden = true;
  $("viewerPanel").hidden = true;
  $("answerPanel").hidden = true;
  $("thanksPanel").hidden = false;
}

// ================================
// 経験アンケート：取得/検証
// ================================
function validateAndSaveExperience() {
  $("expWarn").textContent = "";

  const studentId = $("expStudentId").value.trim();
  const grade = $("expGrade").value;
  const expLevel = getRadio("expLevel");
  const expMode = getChecks("expMode");
  const expRating = $("expRating").value.trim();
  const expNote = $("expNote").value.trim();

  if (!grade) {
    $("expWarn").textContent = "学年（必須）を選択してください。";
    return false;
  }
  if (!expLevel) {
    $("expWarn").textContent = "Q1（必須）を選択してください。";
    return false;
  }

  answers.experience = { studentId, grade, expLevel, expMode, expRating, expNote };
  return true;
}

// ================================
// 局面アンケート：取得/検証
// ================================
function validateAndSaveCaseAnswer() {
  $("caseWarn").textContent = "";

  // 解説Bを一度は見せたい（あなたの条件）
  if (!unlockedB) {
    $("caseWarn").textContent = "先に「解説Bへ」を押して、解説Bも読んでから回答してください。";
    return false;
  }

  const q1 = getRadio("case_q1");
  const q2 = getRadio("case_q2");
  const q3 = getRadio("case_q3");
  const q4 = getRadio("case_q4");
  const q5 = $("caseComment").value.trim();

  if (!q1 || !q2 || !q3 || !q4) {
    $("caseWarn").textContent = "Q1〜Q4（必須）をすべて回答してください。";
    return false;
  }

  const caseId = CASES[caseIndex].id;
  answers.cases[caseId] = { q1, q2, q3, q4, q5 };
  return true;
}

// ================================
// Googleフォームへ一括送信（最後に1回だけ）
// ================================
function appendIf(params, key, value) {
  if (!key) return;                 // entryが空なら送らない
  if (value === undefined || value === null) return;
  const s = String(value);
  if (!s) return;
  params.append(key, s);
}

async function submitAllToGoogleForm() {
  const params = new URLSearchParams();

  // 経験
  appendIf(params, ENTRY.studentId, answers.experience.studentId);
  appendIf(params, ENTRY.grade, answers.experience.grade);
  appendIf(params, ENTRY.expLevel, answers.experience.expLevel);
  appendIf(params, ENTRY.expRating, answers.experience.expRating);
  appendIf(params, ENTRY.expNote, answers.experience.expNote);

  // チェックボックス（複数append）
  if (ENTRY.expMode && Array.isArray(answers.experience.expMode)) {
    for (const v of answers.experience.expMode) {
      appendIf(params, ENTRY.expMode, v);
    }
  }

  // 局面1/2
  for (const c of CASES) {
    const cid = c.id;
    const map = ENTRY[cid];
    const a = answers.cases[cid];

    if (!map) continue;

    appendIf(params, map.q1, a.q1);
    appendIf(params, map.q2, a.q2);
    appendIf(params, map.q3, a.q3);
    appendIf(params, map.q4, a.q4);
    appendIf(params, map.q5, a.q5);
  }

  // 送信（CORS制約で結果は読めないので no-cors）
  await fetch(FORM_ACTION, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
}

// ================================
// 初期化
// ================================
function initLikerts() {
  buildLikert("q1Likert", "case_q1");
  buildLikert("q2Likert", "case_q2");
  buildLikert("q3Likert", "case_q3");
  buildLikert("q4Likert", "case_q4");
}

async function init() {
  initLikerts();
  showExperienceStep();

  // 経験→局面1へ
  $("btnStart").addEventListener("click", async () => {
    if (!validateAndSaveExperience()) return;
    showCaseStep();
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

  // 解説切替（Bはunlock後のみ）
  $("btnExpA").addEventListener("click", () => {
    expKind = "A";
    setActive(["btnExpA","btnExpB"], "btnExpA");
    render();
  });
  $("btnExpB").addEventListener("click", () => {
    if (!unlockedB) return;
    expKind = "B";
    setActive(["btnExpA","btnExpB"], "btnExpB");
    render();
  });
  $("btnUnlockB").addEventListener("click", () => {
    unlockedB = true;
    expKind = "B";
    setActive(["btnExpA","btnExpB"], "btnExpB");
    render();
  });

  // 局面操作
  $("prevBtn").addEventListener("click", () => { frameIdx--; render(); });
  $("nextBtn").addEventListener("click", () => { frameIdx++; render(); });
  $("frameSlider").addEventListener("input", (e) => {
    frameIdx = Number(e.target.value);
    render();
  });

  // 「回答して次へ / 送信」
  $("btnNext").addEventListener("click", async () => {
    if (!validateAndSaveCaseAnswer()) return;

    // 次の局面へ
    if (caseIndex < CASES.length - 1) {
      await loadCaseByIndex(caseIndex + 1);
      showCaseStep();
      return;
    }

    // 最後：Googleフォームへ一括送信
    $("btnNext").disabled = true;
    $("caseWarn").textContent = "送信中です…";

    try {
      await submitAllToGoogleForm();
      showThanks();
    } catch (e) {
      $("caseWarn").textContent = "送信に失敗しました。ネットワーク/フォーム設定/entry番号を確認してください。";
      $("btnNext").disabled = false;
      console.error(e);
    }
  });
}

init();
