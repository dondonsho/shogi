const $ = (id) => document.getElementById(id);

const CASES = [
  { id: "case01", title: "局面1" },
  { id: "case02", title: "局面2" },
];

// Google Form
const FORM_ACTION =
  "https://docs.google.com/forms/d/e/1FAIpQLSfgKJORGMzF8J1E3uZXLLn80tkNMhhxfA5y4gGI33o3fOby-A/formResponse";

// entry IDs（あなたの「事前入力リンク」に出ている entry.xxxxx をそのまま使う）
const ENTRY = {
  studentId: "entry.83230582",
  grade: "entry.907422778",
  exp: "entry.884953881",

  // case1
  c1_q1: "entry.179074931",
  c1_q2: "entry.94393688",
  c1_q3: "entry.103223312",
  c1_q4: "entry.1462974134",
  c1_q5: "entry.965249262",

  // case2
  c2_q1: "entry.131585168",
  c2_q2: "entry.1860590575",
  c2_q3: "entry.927062088",
  c2_q4: "entry.1346505265",
  c2_q5: "entry.1951216814",
};

let caseIndex = 0;
let meta = null;
let lineKind = "bad"; // "bad" or "best"
let expKind = "A";    // "A" or "B"
let frameIdx = 0;

// 閲覧フラグ（Aは最初から表示されるのでtrue）
let viewedA = true;
let viewedB = false;

// 回答を最後にまとめて送信する
const answers = {
  studentId: "",
  grade: "",
  exp: "",
  case01: { q1: "", q2: "", q3: "", q4: "", q5: "" },
  case02: { q1: "", q2: "", q3: "", q4: "", q5: "" },
};

function showStep(stepId) {
  ["stepIntro","stepCase","stepSubmit","stepThanks"].forEach(id => {
    $(id).classList.toggle("hidden", id !== stepId);
  });
  window.scrollTo({ top: 0, behavior: "instant" });
}

function setActive(btnIds, activeId) {
  btnIds.forEach(id => $(id).classList.toggle("active", id === activeId));
}

function metaUrl() {
  const cid = CASES[caseIndex].id;
  return `./${cid}/meta.json`;
}
function caseDir() {
  const cid = CASES[caseIndex].id;
  return `./${cid}`;
}
function getFrames() {
  if (!meta?.frames) return [];
  return meta.frames[lineKind] || [];
}

function updatePills() {
  $("pillCase").textContent = CASES[caseIndex].id;
  $("pillA").textContent = viewedA ? "解説A：閲覧済" : "解説A：未閲覧";
  $("pillB").textContent = viewedB ? "解説B：閲覧済" : "解説B：未閲覧";
  $("pillA").classList.toggle("ok", viewedA);
  $("pillB").classList.toggle("ok", viewedB);
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

  updatePills();
}

async function loadCurrentCase() {
  const c = CASES[caseIndex];
  $("caseTitle").textContent = `${c.title}（${c.id}）`;

  // 初期状態
  lineKind = "bad";
  expKind = "A";
  frameIdx = 0;

  viewedA = true;     // ← ここが「最初からA表示なのに未閲覧になる」問題の対策
  viewedB = false;

  setActive(["btnBad","btnBest"], "btnBad");
  setActive(["btnExpA","btnExpB"], "btnExpA");

  // 回答欄を復元（途中戻り対策）
  restoreCaseInputs();

  const res = await fetch(metaUrl(), { cache: "no-store" });
  meta = await res.json();
  render();
}

function buildScale(el) {
  // 1..5（1=A寄り、5=B寄り）
  el.innerHTML = "";
  for (let v = 1; v <= 5; v++) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = el.dataset.q;
    input.value = String(v);
    label.appendChild(input);
    label.appendChild(document.createTextNode(` ${v}`));
    el.appendChild(label);
  }
}

function currentAnswerKey() {
  return CASES[caseIndex].id; // "case01" or "case02"
}

function saveCaseInputs() {
  const key = currentAnswerKey();
  const obj = answers[key];

  const getRadio = (name) => {
    const r = document.querySelector(`input[name="${name}"]:checked`);
    return r ? r.value : "";
  };

  obj.q1 = getRadio("q1");
  obj.q2 = getRadio("q2");
  obj.q3 = getRadio("q3");
  obj.q4 = getRadio("q4");
  obj.q5 = $("freeText").value || "";
}

function restoreCaseInputs() {
  const key = currentAnswerKey();
  const obj = answers[key];

  const setRadio = (name, val) => {
    document.querySelectorAll(`input[name="${name}"]`).forEach(r => {
      r.checked = (r.value === String(val));
    });
  };

  setRadio("q1", obj.q1);
  setRadio("q2", obj.q2);
  setRadio("q3", obj.q3);
  setRadio("q4", obj.q4);
  $("freeText").value = obj.q5 || "";
}

function validateIntro() {
  const sid = $("studentId").value.trim();
  const grade = $("grade").value;
  const exp = document.querySelector(`input[name="exp"]:checked`)?.value || "";

  if (!sid) return "学籍番号を入力してください。";
  if (!grade) return "学年を選択してください。";
  if (!exp) return "将棋経験（Q1）を選択してください。";

  answers.studentId = sid;
  answers.grade = grade;
  answers.exp = exp;
  return "";
}

function validateCase() {
  // 解説Bを一度は見てもらう（Aは最初から表示）
  if (!viewedB) return "解説Bを一度表示してから回答してください。";

  const req = ["q1","q2","q3","q4"];
  for (const q of req) {
    const v = document.querySelector(`input[name="${q}"]:checked`)?.value || "";
    if (!v) return `Q${q.slice(1)} を選択してください。`;
  }
  return "";
}

function buildGFormInputs() {
  const form = $("gform");
  form.action = FORM_ACTION;
  form.innerHTML = "";

  const add = (name, value) => {
    const inp = document.createElement("input");
    inp.type = "hidden";
    inp.name = name;
    inp.value = value ?? "";
    form.appendChild(inp);
  };

  // 事前アンケート
  add(ENTRY.studentId, answers.studentId);
  add(ENTRY.grade, answers.grade);
  add(ENTRY.exp, answers.exp);

  // case01
  add(ENTRY.c1_q1, answers.case01.q1);
  add(ENTRY.c1_q2, answers.case01.q2);
  add(ENTRY.c1_q3, answers.case01.q3);
  add(ENTRY.c1_q4, answers.case01.q4);
  add(ENTRY.c1_q5, answers.case01.q5);

  // case02
  add(ENTRY.c2_q1, answers.case02.q1);
  add(ENTRY.c2_q2, answers.case02.q2);
  add(ENTRY.c2_q3, answers.case02.q3);
  add(ENTRY.c2_q4, answers.case02.q4);
  add(ENTRY.c2_q5, answers.case02.q5);
}

function submitToGoogleForm() {
  $("submitMsg").textContent = "送信中…";
  $("submitBtn").disabled = true;

  buildGFormInputs();

  // iframeロードで「たぶん送れた」判定（保険でタイムアウトも用意）
  const iframe = $("hidden_iframe");
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    $("submitMsg").textContent = "";
    showStep("stepThanks");
  };

  const timer = setTimeout(finish, 2500); // 何かあっても止まらない保険

  iframe.onload = () => {
    clearTimeout(timer);
    finish();
  };

  $("gform").submit();
}

function init() {
  // 1..5スケールUIを生成
  document.querySelectorAll(".scale").forEach(buildScale);

  // Intro next
  $("startBtn").addEventListener("click", async () => {
    $("introErr").textContent = "";
    const err = validateIntro();
    if (err) { $("introErr").textContent = err; return; }

    showStep("stepCase");
    caseIndex = 0;
    await loadCurrentCase();
  });

  // PV / 解説切替
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

  // フレーム操作
  $("prevBtn").addEventListener("click", () => { frameIdx--; render(); });
  $("nextBtn").addEventListener("click", () => { frameIdx++; render(); });
  $("frameSlider").addEventListener("input", (e) => {
    frameIdx = Number(e.target.value);
    render();
  });

  // 次の局面へ
  $("nextCaseBtn").addEventListener("click", async () => {
    $("caseErr").textContent = "";

    const err = validateCase();
    if (err) { $("caseErr").textContent = err; return; }

    // いまの局面回答を保存
    saveCaseInputs();

    // 次へ
    caseIndex++;
    if (caseIndex < CASES.length) {
      await loadCurrentCase();
      window.scrollTo({ top: 0, behavior: "instant" });
    } else {
      showStep("stepSubmit");
    }
  });

  // 最終送信
  $("submitBtn").addEventListener("click", () => {
    submitToGoogleForm();
  });

  // 初期表示
  showStep("stepIntro");
}

document.addEventListener("DOMContentLoaded", init);
