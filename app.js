const $ = (id) => document.getElementById(id);

const FORM_ID = "1FAIpQLSfgKJORGMzF8J1E3uZXLLn80tkNMhhxfA5y4gGI33o3fOby-A";
const FORM_ACTION = `https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`;

// ===== entry番号（あなたのURLから取得済み） =====
const ENTRY = {
  // 経験（セクション1）
  studentId: "entry.83230582",
  grade: "entry.907422778",
  expLevel: "entry.884953881",

  // 局面1（セクション2）
  case01: {
    q1: "entry.179074931",
    q2: "entry.94393688",
    q3: "entry.103223312",
    q4: "entry.1462974134",
    q5: "entry.965249262",
  },
  // 局面2（セクション3）
  case02: {
    q1: "entry.131585168",
    q2: "entry.1860590575",
    q3: "entry.927062088",
    q4: "entry.1346505265",
    q5: "entry.1951216814",
  },
};

const CASES = [
  { id: "case01", title: "局面1" },
  { id: "case02", title: "局面2" },
];

let step = "exp";         // "exp" or "case"
let caseIndex = 0;        // 0..CASES.length-1

let meta = null;
let lineKind = "bad";     // "bad" or "best"
let expKind = "A";        // "A" or "B"
let frameIdx = 0;

const seen = {};          // { case01: {A:true,B:true}, ... }
const answers = {
  exp: { studentId: "", grade: "", expLevel: "" },
  cases: {
    case01: { q1:"", q2:"", q3:"", q4:"", q5:"" },
    case02: { q1:"", q2:"", q3:"", q4:"", q5:"" },
  }
};

function curCaseId() {
  return CASES[caseIndex].id;
}
function metaUrl() {
  return `./${curCaseId()}/meta.json`;
}
function caseDir() {
  return `./${curCaseId()}`;
}
function getFrames() {
  if (!meta?.frames) return [];
  return meta.frames[lineKind] || [];
}

function setActive(btnIds, activeId) {
  btnIds.forEach(id => $(id).classList.toggle("active", id === activeId));
}

function showStep() {
  $("stepExp").style.display = (step === "exp") ? "" : "none";
  $("stepCase").style.display = (step === "case") ? "" : "none";
}

function renderHeader() {
  if (step === "exp") {
    $("pageTitle").textContent = "将棋 悪手アンケート（経験アンケート）";
    return;
  }
  const c = CASES[caseIndex];
  const s = meta ? `（${c.title} / ${caseIndex + 1} / ${CASES.length}）` : `（${c.title}）`;
  $("pageTitle").textContent = `将棋 悪手アンケート ${s}`;
}

function renderCaseInfo() {
  if (!meta) {
    $("caseInfo").textContent = "";
    return;
  }
  const ply = meta.ply ?? "";
  const side = meta.side ?? "";
  const move = meta.move_kif ?? "";
  $("caseInfo").textContent = `手数: ${ply}　指した側: ${side}　手: ${move}`;
}

function renderSeen() {
  const cid = curCaseId();
  const a = !!(seen[cid]?.A);
  const b = !!(seen[cid]?.B);
  $("seenBadge").textContent = `解説閲覧：A ${a ? "✓" : "×"} / B ${b ? "✓" : "×"}`;
}

function render() {
  renderHeader();
  showStep();

  if (step !== "case") return;

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

  renderCaseInfo();
  renderSeen();

  // 進むボタンの状態
  updateNextButtonState();
}

async function loadCase(idx) {
  caseIndex = idx;
  const cid = curCaseId();
  if (!seen[cid]) seen[cid] = { A:false, B:false };

  // リセット
  lineKind = "bad";
  expKind = "A";
  frameIdx = 0;
  setActive(["btnBad","btnBest"], "btnBad");
  setActive(["btnExpA","btnExpB"], "btnExpA");

  // 回答UIに前回値を復元
  restoreCaseForm(cid);

  const res = await fetch(metaUrl(), { cache: "no-store" });
  meta = await res.json();
  render();
}

function getRadioVal(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : "";
}

function setRadioVal(name, value) {
  const els = document.querySelectorAll(`input[name="${name}"]`);
  els.forEach(r => r.checked = (r.value === value));
}

function restoreCaseForm(cid) {
  const a = answers.cases[cid] || {q1:"",q2:"",q3:"",q4:"",q5:""};
  setRadioVal("c_q1", a.q1);
  setRadioVal("c_q2", a.q2);
  setRadioVal("c_q3", a.q3);
  setRadioVal("c_q4", a.q4);
  $("c_q5").value = a.q5 || "";
}

function saveCaseForm(cid) {
  answers.cases[cid] = {
    q1: getRadioVal("c_q1"),
    q2: getRadioVal("c_q2"),
    q3: getRadioVal("c_q3"),
    q4: getRadioVal("c_q4"),
    q5: ($("c_q5").value || "").trim(),
  };
}

function validateCaseReady(cid) {
  const a = answers.cases[cid];
  if (!a) return false;
  const seenA = !!seen[cid]?.A;
  const seenB = !!seen[cid]?.B;
  const hasScale =
    a.q1 && a.q2 && a.q3 && a.q4;
  return seenA && seenB && hasScale;
}

function updateNextButtonState() {
  const cid = curCaseId();
  saveCaseForm(cid);
  const ok = validateCaseReady(cid);

  const isLast = (caseIndex === CASES.length - 1);
  $("nextCaseBtn").disabled = !ok;

  $("nextCaseBtn").textContent = isLast ? "送信して終了" : "次の局面へ";
}

function collectExp() {
  answers.exp.studentId = ($("studentId").value || "").trim();
  answers.exp.grade = $("grade").value || "";
  answers.exp.expLevel = getRadioVal("expLevel");

  return answers.exp;
}

function validateExp() {
  const e = collectExp();
  return !!(e.studentId && e.grade && e.expLevel);
}

function buildFormDataAll() {
  const fd = new FormData();

  // 経験
  fd.append(ENTRY.studentId, answers.exp.studentId);
  fd.append(ENTRY.grade, answers.exp.grade);
  fd.append(ENTRY.expLevel, answers.exp.expLevel);

  // 局面1/2
  for (const c of CASES) {
    const cid = c.id;
    const ent = ENTRY[cid];
    const a = answers.cases[cid];

    fd.append(ent.q1, a.q1);
    fd.append(ent.q2, a.q2);
    fd.append(ent.q3, a.q3);
    fd.append(ent.q4, a.q4);
    if (a.q5) fd.append(ent.q5, a.q5);
  }

  return fd;
}

async function submitAll() {
  const fd = buildFormDataAll();

  // 送信（no-corsなので成功判定はできない。回答タブで確認）
  await fetch(FORM_ACTION, {
    method: "POST",
    mode: "no-cors",
    body: fd
  });

  // 二重送信を軽く抑止
  localStorage.setItem("shogi_survey_submitted", String(Date.now()));

  $("doneBox").style.display = "";
  $("nextCaseBtn").disabled = true;
  $("nextCaseBtn").textContent = "送信済み";
}

function bindEvents() {
  // 経験→次へ
  $("toCaseBtn").addEventListener("click", async () => {
    $("expErr").textContent = "";
    if (!validateExp()) {
      $("expErr").textContent = "学籍番号・学年・経験Q1 を入力してください。";
      return;
    }
    step = "case";
    await loadCase(0);
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

  // 解説切替（閲覧チェックもここで付ける）
  $("btnExpA").addEventListener("click", () => {
    expKind = "A";
    seen[curCaseId()].A = true;
    setActive(["btnExpA","btnExpB"], "btnExpA");
    render();
  });
  $("btnExpB").addEventListener("click", () => {
    expKind = "B";
    seen[curCaseId()].B = true;
    setActive(["btnExpA","btnExpB"], "btnExpB");
    render();
  });

  // 盤面操作
  $("prevBtn").addEventListener("click", () => { frameIdx--; render(); });
  $("nextBtn").addEventListener("click", () => { frameIdx++; render(); });
  $("frameSlider").addEventListener("input", (e) => {
    frameIdx = Number(e.target.value);
    render();
  });

  // アンケート入力でボタン更新
  ["c_q5"].forEach(id => $(id).addEventListener("input", updateNextButtonState));
  document.querySelectorAll('input[name="c_q1"],input[name="c_q2"],input[name="c_q3"],input[name="c_q4"]')
    .forEach(el => el.addEventListener("change", updateNextButtonState));

  // 次の局面へ（最後は送信）
  $("nextCaseBtn").addEventListener("click", async () => {
    const cid = curCaseId();
    saveCaseForm(cid);

    if (!validateCaseReady(cid)) {
      $("caseErr").textContent = "解説A→解説Bを読んだ上で、Q1〜Q4を回答してください。";
      return;
    }
    $("caseErr").textContent = "";

    const isLast = (caseIndex === CASES.length - 1);
    if (isLast) {
      await submitAll();
      return;
    }
    await loadCase(caseIndex + 1);
  });
}

async function init() {
  // 送信済みならロック（軽い抑止）
  const already = localStorage.getItem("shogi_survey_submitted");
  if (already) {
    $("alreadyBox").style.display = "";
  }

  bindEvents();
  renderHeader();
  showStep();
}

init();
