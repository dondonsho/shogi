const $ = (id) => document.getElementById(id);

/** ============ ここだけあなたが編集するゾーン ============ **/
const FORM_ACTION = "https://docs.google.com/forms/d/e/1FAIpQLSfgKJORGMzF8J1E3uZXLLn80tkNMhhxfA5y4gGI33o3fOby-A/formResponse";

/**
 * セクション（ページ）分割フォームでは pageHistory が重要。
 * 「経験 + 局面1 + 局面2」＝3セクションなら "0,1,2"
 * （6局面に増やしたら "0,1,2,3,4,5,6" にする）
 */
const PAGE_HISTORY = "0,1,2";

const ENTRY = {
  // 事前（経験）
  studentNo: "entry.83230582",
  grade:     "entry.907422778",
  expLevel:  "entry.884953881",

  // 局面1（あなたのURLに出ていた entry をそのまま）
  c1_q1:   "entry.179074931",
  c1_q2:   "entry.94393688",
  c1_q3:   "entry.103223312",
  c1_q4:   "entry.1462974134",
  c1_free: "entry.965249262",

  // 局面2
  c2_q1:   "entry.131585168",
  c2_q2:   "entry.1860590575",
  c2_q3:   "entry.927062088",
  c2_q4:   "entry.1346505265",
  c2_free: "entry.1951216814",
};

const CASES = [
  { id: "case01", title: "局面1", entries: { q1: ENTRY.c1_q1, q2: ENTRY.c1_q2, q3: ENTRY.c1_q3, q4: ENTRY.c1_q4, free: ENTRY.c1_free } },
  { id: "case02", title: "局面2", entries: { q1: ENTRY.c2_q1, q2: ENTRY.c2_q2, q3: ENTRY.c2_q3, q4: ENTRY.c2_q4, free: ENTRY.c2_free } },
];

/** ============ ここまで ============ **/

let meta = null;
let caseIndex = -1;         // -1 = intro
let lineKind = "bad";       // "bad" or "best"
let expKind  = "A";         // "A" or "B"
let frameIdx = 0;

let seenA = false;
let seenB = false;

// 回答データ（最後にまとめて送信）
const answers = {
  studentNo: "",
  grade: "",
  expLevel: "",
  cases: [] // [{ratings:[q1..q4], free:""}]
};

function setActive(btnIds, activeId) {
  btnIds.forEach(id => $(id).classList.toggle("active", id === activeId));
}

function showStep(stepId) {
  ["stepIntro","stepCase","stepDone"].forEach(id => $(id).classList.add("hidden"));
  $(stepId).classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "instant" });
}

function caseObj() {
  return CASES[caseIndex];
}
function metaUrl() {
  return `./${caseObj().id}/meta.json`;
}
function caseDir() {
  return `./${caseObj().id}`;
}
function getFrames() {
  if (!meta?.frames) return [];
  return meta.frames[lineKind] || [];
}

function updateSeenMarks() {
  // Aは最初から表示しているので true にする（「Aを押さないと閲覧扱いにならない問題」対策）
  $("seenA").classList.toggle("off", !seenA);
  $("seenB").classList.toggle("off", !seenB);
}

function render() {
  const frames = getFrames();
  if (!frames.length) {
    $("frameLabel").textContent = "（frames が空です：meta.json を確認してください）";
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
}

async function loadCaseAt(index) {
  caseIndex = index;

  // 初期化
  lineKind = "bad";
  expKind  = "A";
  frameIdx = 0;

  setActive(["btnBad","btnBest"], "btnBad");
  setActive(["btnExpA","btnExpB"], "btnExpA");

  // 閲覧扱い：Aは最初から表示するので true
  seenA = true;
  seenB = false;
  updateSeenMarks();

  // タイトル
  $("caseTitle").textContent = `${caseObj().title}`;
  $("caseProgress").textContent = `${index + 1} / ${CASES.length}`;

  // meta 読み込み
  const res = await fetch(metaUrl(), { cache: "no-store" });
  meta = await res.json();

  // UI：評価入力をリセット
  buildRatingQuestions();
  $("freeText").value = "";
  $("caseHint").textContent = "";

  render();
  showStep("stepCase");
}

function buildRatingQuestions() {
  const wrap = $("ratingQuestions");
  wrap.innerHTML = "";

  const questions = [
    "Q1. 日本語として自然で読みやすいのはどちらですか。",
    "Q2. なぜ悪手なのかを理解しやすいのはどちらですか。",
    "Q3. 局面の状況を正しく説明していると感じるのはどちらですか。",
    "Q4. 将棋の振り返り・上達に役立つと感じるのはどちらですか。",
  ];

  questions.forEach((qt, qi) => {
    const block = document.createElement("div");
    block.className = "qBlock";

    const title = document.createElement("div");
    title.className = "qTitle";
    title.textContent = qt;
    block.appendChild(title);

    const row = document.createElement("div");
    row.className = "scaleRow";

    for (let v = 1; v <= 5; v++) {
      const lab = document.createElement("label");
      lab.className = "scaleBtn";

      const inp = document.createElement("input");
      inp.type = "radio";
      inp.name = `q${qi+1}`;
      inp.value = String(v);

      inp.addEventListener("change", () => {
        // active 表示
        [...row.querySelectorAll(".scaleBtn")].forEach(x => x.classList.remove("active"));
        lab.classList.add("active");
      });

      const num = document.createElement("div");
      num.className = "scaleNum";
      num.textContent = String(v);

      const cap = document.createElement("div");
      cap.className = "scaleCap";
      if (v === 1) cap.textContent = "Aが分かりやすい";
      else if (v === 3) cap.textContent = "どちらとも";
      else if (v === 5) cap.textContent = "Bが分かりやすい";
      else cap.textContent = "";

      lab.appendChild(inp);
      lab.appendChild(num);
      lab.appendChild(cap);
      row.appendChild(lab);
    }

    block.appendChild(row);
    wrap.appendChild(block);
  });
}

function getRatings() {
  const vals = [];
  for (let i = 1; i <= 4; i++) {
    const r = document.querySelector(`input[name="q${i}"]:checked`);
    vals.push(r ? Number(r.value) : null);
  }
  return vals;
}

function validateIntro() {
  const studentNo = $("studentNo").value.trim();
  const grade     = $("grade").value.trim();
  const expLevel  = $("expLevel").value.trim();

  if (!studentNo) return "学籍番号を入力してください。";
  if (!grade)     return "学年を選択してください。";
  if (!expLevel)  return "将棋経験（Q1）を選択してください。";
  return "";
}

function validateCase() {
  // Bを一回は見てほしい（Aは最初から表示しているのでOK）
  if (!seenB) return "解説Bを一度表示してから回答してください。";

  const ratings = getRatings();
  if (ratings.some(v => v == null)) return "Q1〜Q4 をすべて回答してください。";

  return "";
}

function setHidden(form, name, value) {
  let el = form.querySelector(`input[name="${name}"]`);
  if (!el) {
    el = document.createElement("input");
    el.type = "hidden";
    el.name = name;
    form.appendChild(el);
  }
  el.value = value ?? "";
}

function submitAllToGoogleForm() {
  const form = $("gform");
  form.action = FORM_ACTION;

  // hidden 必須系
  $("pageHistory").value = PAGE_HISTORY;
  $("fbzx").value = String(Date.now());

  // 事前
  setHidden(form, ENTRY.studentNo, answers.studentNo);
  setHidden(form, ENTRY.grade,     answers.grade);
  setHidden(form, ENTRY.expLevel,  answers.expLevel);

  // ケース
  answers.cases.forEach((cAns, idx) => {
    const c = CASES[idx];
    const [q1,q2,q3,q4] = cAns.ratings;

    setHidden(form, c.entries.q1, String(q1));
    setHidden(form, c.entries.q2, String(q2));
    setHidden(form, c.entries.q3, String(q3));
    setHidden(form, c.entries.q4, String(q4));
    setHidden(form, c.entries.free, cAns.free || "");
  });

  form.submit();
}

function finish() {
  showStep("stepDone");
}

async function init() {
  // Intro → 次へ
  $("introNext").addEventListener("click", async () => {
    const err = validateIntro();
    if (err) { alert(err); return; }

    answers.studentNo = $("studentNo").value.trim();
    answers.grade     = $("grade").value.trim();
    answers.expLevel  = $("expLevel").value.trim();

    // ケース回答配列を初期化（局面数ぶん）
    answers.cases = CASES.map(() => ({ ratings: [null,null,null,null], free: "" }));

    await loadCaseAt(0);
  });

  // Viewer buttons
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
    seenA = true;
    updateSeenMarks();
    setActive(["btnExpA","btnExpB"], "btnExpA");
    render();
  });

  $("btnExpB").addEventListener("click", () => {
    expKind = "B";
    seenB = true;
    updateSeenMarks();
    setActive(["btnExpA","btnExpB"], "btnExpB");
    render();
  });

  $("prevBtn").addEventListener("click", () => { frameIdx--; render(); });
  $("nextBtn").addEventListener("click", () => { frameIdx++; render(); });
  $("frameSlider").addEventListener("input", (e) => {
    frameIdx = Number(e.target.value);
    render();
  });

  // 回答して次へ
  $("caseNext").addEventListener("click", async () => {
    const err = validateCase();
    if (err) { alert(err); return; }

    const ratings = getRatings();
    const free = $("freeText").value.trim();

    answers.cases[caseIndex] = { ratings, free };

    // 次の局面へ / 最後なら送信
    const nextIndex = caseIndex + 1;
    if (nextIndex < CASES.length) {
      await loadCaseAt(nextIndex);
      return;
    }

    // 送信（1回だけ）
    $("caseNext").disabled = true;
    $("caseHint").textContent = "送信中…";

    submitAllToGoogleForm();

    // cross-origin なので成功判定はできない（UI上は完了に進める）
    setTimeout(() => finish(), 800);
  });

  // 初期はIntro表示
  showStep("stepIntro");
}

init();
