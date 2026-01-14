const $ = (id) => document.getElementById(id);

/**
 * ============================
 * 表示順の出し分け（URLパラメータ）
 *  - ?order=AB で A→B 開始（デフォルト）
 *  - ?order=BA で B→A 開始
 * ※ A=タグ無し / B=タグあり の意味は固定。変わるのは「最初に見せる順番」だけ。
 * ============================
 */
function getOrderFromUrl() {
  const v = new URLSearchParams(location.search).get("order");
  return String(v || "")
    .trim()
    .toUpperCase() === "BA"
    ? "BA"
    : "AB";
}
let ORDER = getOrderFromUrl();

function firstExpKind() {
  return ORDER === "BA" ? "B" : "A";
}
function orderLabelText() {
  return ORDER === "BA" ? "提示順：B→A" : "提示順：A→B";
}

function updateOrderUI() {
  // 事前ページの表示
  const pre = $("orderLabelPre");
  if (pre) pre.textContent = orderLabelText();

  // 局面ページの表示
  const ol = $("orderLabel");
  if (ol) ol.textContent = orderLabelText();

  // 回答方法の「まず読む順番」文
  const oh = $("orderHint");
  if (oh) {
    oh.innerHTML =
      ORDER === "BA"
        ? '① まず <b>解説B → 解説A</b> の順に読んでください。その後は、必要に応じてA/Bを読み直してOKです。'
        : '① まず <b>解説A → 解説B</b> の順に読んでください。その後は、必要に応じてA/Bを読み直してOKです。';
  }
}

/**
 * ============================
 * 6局面ぶんの設定
 * - folder: case01 ... case06 のフォルダ名
 * - entry: Google Form の entry ID（あなたのURLに入っていた値を転記）
 * ============================
 */
const CASES = [
  {
    id: "case01",
    title: "局面1",
    folder: "case01",
    entry: {
      q1: "entry.179074931",
      q2: "entry.94393688",
      q3: "entry.103223312",
      q4: "entry.1462974134",
      q5: "entry.965249262",
    },
  },
  {
    id: "case02",
    title: "局面2",
    folder: "case02",
    entry: {
      q1: "entry.131585168",
      q2: "entry.1860590575",
      q3: "entry.927062088",
      q4: "entry.1346505265",
      q5: "entry.1951216814",
    },
  },
  {
    id: "case03",
    title: "局面3",
    folder: "case03",
    entry: {
      q1: "entry.921567182",
      q2: "entry.1107087899",
      q3: "entry.169646057",
      q4: "entry.2127821720",
      q5: "entry.1789844425",
    },
  },
  {
    id: "case04",
    title: "局面4",
    folder: "case04",
    entry: {
      q1: "entry.1544748679",
      q2: "entry.2054195806",
      q3: "entry.1351258754",
      q4: "entry.2141137530",
      q5: "entry.763245396",
    },
  },
  {
    id: "case05",
    title: "局面5",
    folder: "case05",
    entry: {
      q1: "entry.102699849",
      q2: "entry.2092186421",
      q3: "entry.1572806328",
      q4: "entry.1119128466",
      q5: "entry.1077736227",
    },
  },
  {
    id: "case06",
    title: "局面6",
    folder: "case06",
    entry: {
      q1: "entry.1063470756",
      q2: "entry.894430216",
      q3: "entry.1703357107",
      q4: "entry.1959257455",
      q5: "entry.1469017175",
    },
  },
];

// Google Form（formResponse）
const FORM_ACTION =
  "https://docs.google.com/forms/d/e/1FAIpQLSfgKJORGMzF8J1E3uZXLLn80tkNMhhxfA5y4gGI33o3fOby-A/formResponse";

// 事前アンケートの entry
const ENTRY_PRE = {
  studentId: "entry.83230582",
  grade: "entry.907422778",
  exp: "entry.884953881",
};

/**
 * （任意）提示順もGoogle Formに保存したい場合：
 *  1) Google Formに「提示順（AB/BA）」の短文設問を1つ追加
 *  2) その entry.xxxxx をここに入れる
 *
 * 例: const ENTRY_ORDER = "entry.1234567890";
 *
 * ※ 入れなくてもアンケートは動く（集計で順序群を分けたいなら入れるのがおすすめ）
 */
const ENTRY_ORDER = ""; // ←必要ならセット

/**
 * ============================
 * 途中再開用（localStorage）
 * ============================
 */
const STORAGE_KEY = "shogi_survey_state_v2"; // v2に更新（order保存対応）

function saveState(phase) {
  try {
    const payload = {
      phase, // "pre" | "case" | "thanks"
      currentCaseIdx,
      answers,
      order: ORDER, // ★提示順を保存
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    // 保存できなくても致命ではないので黙って続行
  }
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}
function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
}

let currentCaseIdx = -1;
let meta = null;

let lineKind = "bad"; // bad / best
let expKind = "A"; // A / B
let frameIdx = 0;

const metaCache = new Map();

// 回答データ（最後にまとめて1回だけ送信）
const answers = {
  pre: { studentId: "", grade: "", exp: "" },
  cases: {}, // caseId -> {q1..q5}
};

// 解説閲覧（最初に表示された方は閲覧扱い、もう片方はクリック必須）
let seenA = false;
let seenB = false;

function setActive(btnIds, activeId) {
  btnIds.forEach((id) => $(id).classList.toggle("active", id === activeId));
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
    $("frameLabel").textContent =
      "（framesが空です：meta.json を確認してください）";
    $("boardImg").removeAttribute("src");
    $("frameCount").textContent = "";
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
  $("expText").textContent =
    txt || "（meta.json の llm_text に A/B を入れるとここに表示されます）";
}

async function loadCaseByIndex(idx) {
  currentCaseIdx = idx;
  const c = CASES[currentCaseIdx];

  $("caseTitle").textContent = c.title;
  $("caseTitleInline").textContent = c.title;
  $("caseProgress").textContent = `${currentCaseIdx + 1} / ${CASES.length}`;

  // 初期化
  lineKind = "bad";
  expKind = firstExpKind(); // ★順序に応じて初期表示
  frameIdx = 0;

  setActive(["btnBad", "btnBest"], "btnBad");
  setActive(["btnExpA", "btnExpB"], expKind === "A" ? "btnExpA" : "btnExpB");

  // ★最初に表示される方は閲覧扱い、もう片方は未
  seenA = expKind === "A";
  seenB = expKind === "B";
  updateSeenBadges();

  // UI初期化
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
  $("btnNextCase").textContent =
    currentCaseIdx === CASES.length - 1 ? "送信して終了" : "回答して次へ";
  $("caseErr").textContent = "";

  // もし途中再開で「既にこの局面の回答がある」なら復元
  restoreCaseInputsIfExists(c.id);

  render();

  // 状態保存
  saveState("case");
}

function showPage(which) {
  $("pagePre").style.display = which === "pre" ? "" : "none";
  $("pageCase").style.display = which === "case" ? "" : "none";
  $("pageThanks").style.display = which === "thanks" ? "" : "none";
  saveState(which);
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
  ["case_q1", "case_q2", "case_q3", "case_q4"].forEach((n) => {
    document
      .querySelectorAll(`input[name="${n}"]`)
      .forEach((el) => (el.checked = false));
  });
  $("q5Text").value = "";
}

function restoreCaseInputsIfExists(caseId) {
  const a = answers.cases[caseId];
  if (!a) return;

  const setRadio = (name, v) => {
    if (!v) return;
    const el = document.querySelector(`input[name="${name}"][value="${v}"]`);
    if (el) el.checked = true;
  };
  setRadio("case_q1", a.q1);
  setRadio("case_q2", a.q2);
  setRadio("case_q3", a.q3);
  setRadio("case_q4", a.q4);
  $("q5Text").value = a.q5 || "";
}

function getScaleVal(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value || "";
}

function validateCase() {
  // ★順序がAB/BAどちらでも、両方読んでから回答してほしい
  if (!seenA || !seenB)
    return "解説Aと解説Bの両方を開いてから回答してください。（上の「解説A / 解説B」を押してください）";

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
    q5: $("q5Text").value.trim(),
  };
  saveState("case");
}

function submitAllToGoogleForm() {
  const form = $("gForm");
  form.action = FORM_ACTION;
  form.innerHTML = ""; // いったん全消し

  const add = (name, value, { allowEmpty = false } = {}) => {
    if (!name) return; // ★nameが空なら何もしない
    if (value == null) return;
    const v = String(value);
    if (!allowEmpty && !v.trim()) return;
    const inp = document.createElement("input");
    inp.type = "hidden";
    inp.name = name;
    inp.value = v;
    form.appendChild(inp);
  };

  // （任意）提示順
  if (ENTRY_ORDER) add(ENTRY_ORDER, ORDER);

  // 事前（必須）
  add(ENTRY_PRE.studentId, answers.pre.studentId);
  add(ENTRY_PRE.grade, answers.pre.grade);
  add(ENTRY_PRE.exp, answers.pre.exp);

  // 各局面（Q1-4は必須前提、Q5は任意）
  for (const c of CASES) {
    const a = answers.cases[c.id] || {};
    add(c.entry.q1, a.q1 || "");
    add(c.entry.q2, a.q2 || "");
    add(c.entry.q3, a.q3 || "");
    add(c.entry.q4, a.q4 || "");
    // 任意なので空でも送ってOK
    add(c.entry.q5, a.q5 || "", { allowEmpty: true });
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

  // 途中再開（あれば）
  const st = loadState();

  // ★再開データがあれば、その人の提示順を固定（途中でURL変えても揺れない）
  if (st?.order) {
    ORDER = st.order;
  }
  updateOrderUI();

  // リセット（あれば）
  if ($("btnReset")) {
    $("btnReset").addEventListener("click", () => {
      const ok = confirm("入力済みの内容を消して、最初からやり直しますか？");
      if (!ok) return;
      clearState();
      location.reload();
    });
  }

  if (st?.answers?.pre?.studentId) {
    // pre入力欄も復元
    try {
      $("studentId").value = st.answers.pre.studentId || "";
      $("grade").value = st.answers.pre.grade || "";
      const expVal = st.answers.pre.exp || "";
      if (expVal) {
        const expRadio = document.querySelector(
          `input[name="exp"][value="${CSS.escape(expVal)}"]`
        );
        if (expRadio) expRadio.checked = true;
      }
    } catch (e) {}

    if ($("btnResume")) {
      $("btnResume").style.display = "";
      $("btnResume").addEventListener("click", async () => {
        // answers を復元
        answers.pre = st.answers.pre || { studentId: "", grade: "", exp: "" };
        answers.cases = st.answers.cases || {};
        if (st.order) ORDER = st.order; // 念のため
        updateOrderUI();

        showPage("case");
        const idx =
          typeof st.currentCaseIdx === "number" && st.currentCaseIdx >= 0
            ? Math.min(st.currentCaseIdx, CASES.length - 1)
            : 0;
        await loadCaseByIndex(idx);
        window.scrollTo({ top: 0, behavior: "auto" });
      });
    }
  }

  // 事前 → 局面へ
  $("btnStart").addEventListener("click", async () => {
    const msg = validatePre();
    $("preErr").textContent = msg;
    if (msg) return;

    answers.pre = getPreValue();
    saveState("case");

    showPage("case");
    updateOrderUI();
    await loadCaseByIndex(0);
    window.scrollTo({ top: 0, behavior: "auto" });
  });

  // PV切替
  $("btnBad").addEventListener("click", () => {
    lineKind = "bad";
    setActive(["btnBad", "btnBest"], "btnBad");
    frameIdx = 0;
    render();
  });
  $("btnBest").addEventListener("click", () => {
    lineKind = "best";
    setActive(["btnBad", "btnBest"], "btnBest");
    frameIdx = 0;
    render();
  });

  // 解説切替（閲覧管理）
  $("btnExpA").addEventListener("click", () => {
    expKind = "A";
    setActive(["btnExpA", "btnExpB"], "btnExpA");
    seenA = true;
    updateSeenBadges();
    render();
  });
  $("btnExpB").addEventListener("click", () => {
    expKind = "B";
    setActive(["btnExpA", "btnExpB"], "btnExpB");
    seenB = true;
    updateSeenBadges();
    render();
  });

  // フレーム移動
  $("prevBtn").addEventListener("click", () => {
    frameIdx--;
    render();
  });
  $("nextBtn").addEventListener("click", () => {
    frameIdx++;
    render();
  });
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
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }

    // 最後：送信して完了画面へ
    submitAllToGoogleForm();
    clearState();
    showPage("thanks");
    window.scrollTo({ top: 0, behavior: "auto" });
  });

  // 初期表示：事前アンケート
  showPage("pre");
  $("preErr").textContent = "";
}

init();
