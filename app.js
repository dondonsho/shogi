const $ = (id) => document.getElementById(id);

const CASES = [
  { id: "case01", title: "局面1" },
  { id: "case02", title: "局面2" },
];

// ===== Google Form 送信先 =====
// viewform の末尾を /formResponse にしたURL
const FORM_ACTION = "https://docs.google.com/forms/d/e/1FAIpQLSfgKJORGMzF8J1E3uZXLLn80tkNMhhxfA5y4gGI33o3fOby-A/formResponse";

// ===== entry ID（あなたのURLから読み取ったもの）=====
// ※フォームを編集して entry 番号が変わったらここだけ直す
const ENTRY = {
  studentId: "entry.83230582",
  grade:     "entry.907422778",
  expLevel:  "entry.884953881",

  case01: { q1:"entry.179074931", q2:"entry.94393688", q3:"entry.103223312", q4:"entry.1462974134", free:"entry.965249262" },
  case02: { q1:"entry.131585168", q2:"entry.1860590575", q3:"entry.927062088", q4:"entry.1346505265", free:"entry.1951216814" },
};

let meta = null;

// 進行状態
let step = "intro";           // intro | case | done
let caseIndex = 0;            // 0..CASES.length-1
let lineKind = "bad";         // bad / best
let expKind  = "A";           // A / B
let frameIdx = 0;

// 閲覧状態（「Aは最初から表示＝閲覧済み」）
let seenA = false;
let seenB = false;

// 回答の蓄積（最後にまとめて送る）
const answers = {
  exp: { studentId:"", grade:"", expLevel:"" },
  cases: {
    // case01: { q1..q4, free }
  }
};

function showStep(next) {
  step = next;
  $("stepIntro").classList.toggle("hidden", next !== "intro");
  $("stepCase").classList.toggle("hidden",  next !== "case");
  $("stepDone").classList.toggle("hidden",  next !== "done");
  window.scrollTo({ top: 0, behavior: "auto" });
}

function caseId() {
  return CASES[caseIndex].id;
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
function setActive(btnIds, activeId) {
  btnIds.forEach(id => $(id).classList.toggle("active", id === activeId));
}

// ===== 画面描画 =====
function render() {
  // ヘッダ表示
  $("caseTitle").textContent = `${CASES[caseIndex].title}（${caseIndex+1} / ${CASES.length}）`;

  // 解説閲覧状況
  $("seenA").textContent = seenA ? "✅" : "□";
  $("seenB").textContent = seenB ? "✅" : "□";

  // 画像
  const frames = getFrames();
  if (!frames.length) {
    $("frameLabel").textContent = "（framesが空です：meta.json を確認してください）";
    $("boardImg").removeAttribute("src");
    return;
  }

  frameIdx = Math.max(0, Math.min(frameIdx, frames.length - 1));
  const fr = frames[frameIdx];

  $("boardImg").src = `${caseDir()}/${fr.file}`;
  $("frameLabel").textContent = fr.label || "";

  $("frameSlider").max = String(frames.length - 1);
  $("frameSlider").value = String(frameIdx);
  $("frameCount").textContent = `${frameIdx + 1} / ${frames.length}`;

  // 解説
  const txt = meta?.llm_text?.[expKind] ?? "";
  $("expTitle").textContent = `解説${expKind}`;
  $("expText").textContent = txt || "（meta.json の llm_text に A/B を入れるとここに表示されます）";

  // 次へボタンの文言
  $("nextCaseBtn").textContent = (caseIndex === CASES.length - 1) ? "回答して送信" : "回答して次へ";
}

// ===== 局面ロード =====
async function loadCase(idx) {
  caseIndex = idx;

  // 初期化
  lineKind = "bad";
  expKind = "A";
  frameIdx = 0;

  // “Aは最初から表示されてる”ので閲覧済みにする
  seenA = true;
  seenB = false;

  setActive(["btnBad","btnBest"], "btnBad");
  setActive(["btnExpA","btnExpB"], "btnExpA");

  // meta.json 取得
  const res = await fetch(metaUrl(), { cache: "no-store" });
  meta = await res.json();

  // 評価フォーム入力を初期化
  clearEvalInputs();

  render();
}

// ===== 評価フォーム（局面ごとのQ1-4 + 自由記述）=====
function clearEvalInputs() {
  // ラジオを全部外す
  document.querySelectorAll('input[name="eval_q1"], input[name="eval_q2"], input[name="eval_q3"], input[name="eval_q4"]').forEach(el => {
    el.checked = false;
  });
  $("evalFree").value = "";
  $("evalErr").textContent = "";
}

function getRadioValue(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : "";
}

function validateBeforeNext() {
  // A→Bの順に読んでほしいので B を押したかを必須にする
  if (!seenB) {
    $("evalErr").textContent = "解説は A→B の順に読んでください（解説Bを一度開いてください）。";
    return false;
  }

  const q1 = getRadioValue("eval_q1");
  const q2 = getRadioValue("eval_q2");
  const q3 = getRadioValue("eval_q3");
  const q4 = getRadioValue("eval_q4");

  if (!q1 || !q2 || !q3 || !q4) {
    $("evalErr").textContent = "Q1〜Q4（1〜5）の選択をすべて回答してください。";
    return false;
  }
  $("evalErr").textContent = "";
  return true;
}

function saveCaseAnswers() {
  const cid = caseId();
  answers.cases[cid] = {
    q1: getRadioValue("eval_q1"),
    q2: getRadioValue("eval_q2"),
    q3: getRadioValue("eval_q3"),
    q4: getRadioValue("eval_q4"),
    free: ($("evalFree").value || "").trim(),
  };
}

// ===== 経験アンケート（最初）=====
function validateExp() {
  const sid = ($("studentId").value || "").trim();
  const grade = $("grade").value || "";
  const exp = $("expLevel").value || "";

  if (!sid || !grade || !exp) {
    $("expErr").textContent = "学籍番号・学年・将棋経験（Q1）を入力してください。";
    return false;
  }
  $("expErr").textContent = "";

  answers.exp.studentId = sid;
  answers.exp.grade = grade;
  answers.exp.expLevel = exp;
  return true;
}

// ===== Google Form にまとめて送信 =====
function ensureHiddenInput(form, name) {
  let el = form.querySelector(`input[name="${name}"]`);
  if (!el) {
    el = document.createElement("input");
    el.type = "hidden";
    el.name = name;
    form.appendChild(el);
  }
  return el;
}

function submitAllToGoogleForm() {
  const form = $("gform");
  form.action = FORM_ACTION;

  // 送信値をセット（経験）
  ensureHiddenInput(form, ENTRY.studentId).value = answers.exp.studentId;
  ensureHiddenInput(form, ENTRY.grade).value     = answers.exp.grade;
  ensureHiddenInput(form, ENTRY.expLevel).value  = answers.exp.expLevel;

  // 送信値をセット（case01/case02）
  for (const c of CASES) {
    const cid = c.id;
    const map = ENTRY[cid];
    const a = answers.cases[cid] || {};
    ensureHiddenInput(form, map.q1).value   = a.q1 || "";
    ensureHiddenInput(form, map.q2).value   = a.q2 || "";
    ensureHiddenInput(form, map.q3).value   = a.q3 || "";
    ensureHiddenInput(form, map.q4).value   = a.q4 || "";
    ensureHiddenInput(form, map.free).value = a.free || "";
  }

  // 送信完了検知（iframe load）＋保険タイマー
  return new Promise((resolve) => {
    const iframe = $("hidden_iframe");
    let done = false;

    function finish() {
      if (done) return;
      done = true;
      resolve();
    }

    const onload = () => finish();
    iframe.addEventListener("load", onload, { once: true });

    // 保険：ネット等で load が来ない環境でも画面は進める
    setTimeout(finish, 2500);

    form.submit();
  });
}

// ===== 初期化 =====
async function init() {
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

  // 解説切替（seen管理）
  $("btnExpA").addEventListener("click", () => {
    expKind = "A";
    seenA = true;
    setActive(["btnExpA","btnExpB"], "btnExpA");
    render();
  });
  $("btnExpB").addEventListener("click", () => {
    expKind = "B";
    seenB = true;
    setActive(["btnExpA","btnExpB"], "btnExpB");
    render();
  });

  // コマ送り
  $("prevBtn").addEventListener("click", () => { frameIdx--; render(); });
  $("nextBtn").addEventListener("click", () => { frameIdx++; render(); });
  $("frameSlider").addEventListener("input", (e) => {
    frameIdx = Number(e.target.value);
    render();
  });

  // スタート（経験アンケート送信→局面へ）
  $("startBtn").addEventListener("click", async () => {
    if (!validateExp()) return;
    showStep("case");
    await loadCase(0);
  });

  // 次へ（局面回答→次へ or 最終送信）
  $("nextCaseBtn").addEventListener("click", async () => {
    if (!validateBeforeNext()) return;
    saveCaseAnswers();

    // 次の局面へ
    if (caseIndex < CASES.length - 1) {
      await loadCase(caseIndex + 1);
      return;
    }

    // 最終：送信
    $("nextCaseBtn").disabled = true;
    $("evalErr").textContent = "";
    $("sendingMsg").textContent = "送信中…（数秒かかる場合があります）";

    try {
      await submitAllToGoogleForm();
    } catch (e) {
      // ここに来ることは少ないが、保険で表示は進める
      console.error(e);
    }

    showStep("done");
  });

  // 初期表示
  showStep("intro");
}

init();
