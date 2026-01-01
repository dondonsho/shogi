const $ = (id) => document.getElementById(id);

// ===============================
// 設定（あなたのフォーム）
// ===============================
const FORM_ACTION =
  "https://docs.google.com/forms/d/e/1FAIpQLSfgKJORGMzF8J1E3uZXLLn80tkNMhhxfA5y4gGI33o3fOby-A/formResponse";

// あなたが貼ってくれた prefill URL から読み取れる entry 番号（2局面ぶん）
const ENTRY = {
  // 経験セクション
  studentId: "entry.83230582",
  grade:     "entry.907422778",
  expQ1:     "entry.884953881",

  // 局面1（case01）
  c1_q1: "entry.179074931",
  c1_q2: "entry.94393688",
  c1_q3: "entry.103223312",
  c1_q4: "entry.1462974134",
  c1_free: "entry.965249262",

  // 局面2（case02）
  c2_q1: "entry.131585168",
  c2_q2: "entry.1860590575",
  c2_q3: "entry.927062088",
  c2_q4: "entry.1346505265",
  c2_free: "entry.1951216814",
};

// expQ1（将棋経験）の選択肢は「フォームの選択肢の文字列と完全一致」が必要
const EXP_CHOICES = [
  "将棋はほとんど指したことがない（ルールもあいまい／対局経験がほぼない）",
  "将棋は少し指したことがある（たまに指す程度、継続的ではない）",
  "将棋を継続的に指している、または過去に継続的に指していた時期がある（オンライン／対面は問わない）",
  "将棋部・道場・大会参加など、継続的な活動経験がある（現在／過去を含む）",
];

// 2局面の順番（将来的に 6 個に増やすならここを増やすだけ）
const CASES = [
  { id: "case01", title: "局面1" },
  { id: "case02", title: "局面2" },
];

// localStorage（同じ端末での二重送信を減らす）
const LS_KEY = "shogi_survey_v1_state";
const LS_SUBMITTED = "shogi_survey_v1_submitted";

// ===============================
// 状態
// ===============================
let step = 0;            // 0=経験, 1=case01, 2=case02, 3=完了
let meta = null;
let lineKind = "bad";    // bad / best
let expKind = "A";       // A / B
let frameIdx = 0;

let state = {
  profile: {
    studentId: "",
    grade: "",
    expQ1: "", // EXP_CHOICES のどれか（文字列）
  },
  cases: {
    case01: { q: ["", "", "", ""], free: "", seenB: false },
    case02: { q: ["", "", "", ""], free: "", seenB: false },
  },
};

// ===============================
// 永続化
// ===============================
function loadState() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) state = JSON.parse(saved);
  } catch {}
}
function saveState() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {}
}

// ===============================
// PVビューア
// ===============================
function caseDir() {
  return `./${CASES[step - 1].id}`;
}
function getFrames() {
  if (!meta?.frames) return [];
  return meta.frames[lineKind] || [];
}

function renderViewer() {
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

  // 解説（Aは最初から表示＝閲覧済み扱い）
  const txt = meta?.llm_text?.[expKind] ?? "";
  $("expTitle").textContent = `解説${expKind}`;
  $("expText").textContent = txt || "（meta.json の llm_text に A/B を入れるとここに表示されます）";

  // B を見たかどうか
  const cId = CASES[step - 1].id;
  $("seenB").textContent = state.cases[cId].seenB ? "OK" : "未";
  $("btnNextCase").disabled = !canGoNextFromCase();
}

async function loadCaseMeta(caseId) {
  // 読み込み時は先頭へ
  lineKind = "bad";
  expKind = "A";
  frameIdx = 0;
  setActive(["btnBad", "btnBest"], "btnBad");
  setActive(["btnExpA", "btnExpB"], "btnExpA");

  const res = await fetch(`./${caseId}/meta.json`, { cache: "no-store" });
  meta = await res.json();
  renderViewer();
}

function setActive(btnIds, activeId) {
  btnIds.forEach((id) => $(id).classList.toggle("active", id === activeId));
}

// ===============================
// 画面レンダリング
// ===============================
function renderScreen() {
  $("screenProfile").classList.toggle("hide", step !== 0);
  $("screenCase").classList.toggle("hide", step === 0 || step >= 3);
  $("screenThanks").classList.toggle("hide", step !== 3);

  // ヘッダ進捗
  if (step === 0) {
    $("progress").textContent = "経験アンケート";
  } else if (step >= 1 && step <= CASES.length) {
    $("progress").textContent = `${CASES[step - 1].title}（${step} / ${CASES.length}）`;
  } else {
    $("progress").textContent = "完了";
  }

  // プロフィール画面の値復元
  if (step === 0) {
    $("studentId").value = state.profile.studentId || "";
    $("grade").value = state.profile.grade || "";
    // exp radio
    for (let i = 0; i < EXP_CHOICES.length; i++) {
      const r = $(`exp_${i}`);
      r.checked = (state.profile.expQ1 === EXP_CHOICES[i]);
    }
    $("btnToCase1").disabled = !canGoNextFromProfile();
  }

  // ケース画面の値復元
  if (step >= 1 && step <= CASES.length) {
    const cId = CASES[step - 1].id;
    const ans = state.cases[cId];

    // 評価ラジオ
    for (let qi = 0; qi < 4; qi++) {
      const v = ans.q[qi];
      for (let s = 1; s <= 5; s++) {
        const el = $(`q${qi + 1}_${s}`);
        el.checked = (String(v) === String(s));
      }
    }
    $("freeText").value = ans.free || "";

    // B既読表示
    $("seenB").textContent = ans.seenB ? "OK" : "未";
    $("btnNextCase").disabled = !canGoNextFromCase();
  }
}

// ===============================
// バリデーション
// ===============================
function canGoNextFromProfile() {
  const p = state.profile;
  return !!(p.studentId && p.grade && p.expQ1);
}

function canGoNextFromCase() {
  const cId = CASES[step - 1].id;
  const ans = state.cases[cId];

  // 4問の評価が全部埋まっている + 解説Bを1回見た
  const allRated = ans.q.every((x) => ["1","2","3","4","5"].includes(String(x)));
  return allRated && ans.seenB;
}

// ===============================
// state更新（入力イベント）
// ===============================
function wireProfileInputs() {
  $("studentId").addEventListener("input", (e) => {
    state.profile.studentId = e.target.value.trim();
    saveState();
    $("btnToCase1").disabled = !canGoNextFromProfile();
  });

  $("grade").addEventListener("change", (e) => {
    state.profile.grade = e.target.value;
    saveState();
    $("btnToCase1").disabled = !canGoNextFromProfile();
  });

  for (let i = 0; i < EXP_CHOICES.length; i++) {
    $(`exp_${i}`).addEventListener("change", (e) => {
      if (e.target.checked) {
        state.profile.expQ1 = EXP_CHOICES[i];
        saveState();
        $("btnToCase1").disabled = !canGoNextFromProfile();
      }
    });
  }
}

function wireCaseInputs() {
  // 評価4問
  for (let qi = 0; qi < 4; qi++) {
    for (let s = 1; s <= 5; s++) {
      $(`q${qi + 1}_${s}`).addEventListener("change", (e) => {
        const cId = CASES[step - 1].id;
        state.cases[cId].q[qi] = String(s);
        saveState();
        $("btnNextCase").disabled = !canGoNextFromCase();
      });
    }
  }

  $("freeText").addEventListener("input", (e) => {
    const cId = CASES[step - 1].id;
    state.cases[cId].free = e.target.value;
    saveState();
  });
}

// ===============================
// 送信（最後に1回だけ）
// ===============================
async function submitAll() {
  const fd = new FormData();

  // 経験
  fd.append(ENTRY.studentId, state.profile.studentId);
  fd.append(ENTRY.grade, state.profile.grade);
  fd.append(ENTRY.expQ1, state.profile.expQ1);

  // 局面1
  fd.append(ENTRY.c1_q1, state.cases.case01.q[0]);
  fd.append(ENTRY.c1_q2, state.cases.case01.q[1]);
  fd.append(ENTRY.c1_q3, state.cases.case01.q[2]);
  fd.append(ENTRY.c1_q4, state.cases.case01.q[3]);
  fd.append(ENTRY.c1_free, state.cases.case01.free || "");

  // 局面2
  fd.append(ENTRY.c2_q1, state.cases.case02.q[0]);
  fd.append(ENTRY.c2_q2, state.cases.case02.q[1]);
  fd.append(ENTRY.c2_q3, state.cases.case02.q[2]);
  fd.append(ENTRY.c2_q4, state.cases.case02.q[3]);
  fd.append(ENTRY.c2_free, state.cases.case02.free || "");

  // 念のため（なくても動くことが多いけど安全策）
  fd.append("submit", "Submit");

  // no-cors だと成功/失敗を読めない（Google Forms仕様）
  await fetch(FORM_ACTION, { method: "POST", mode: "no-cors", body: fd });
}

// ===============================
// 初期化
// ===============================
async function init() {
  // すでに送信済みなら完了画面
  if (localStorage.getItem(LS_SUBMITTED) === "1") {
    step = 3;
    renderScreen();
    return;
  }

  loadState();
  renderScreen();
  wireProfileInputs();
  wireCaseInputs();

  // PV操作
  $("btnBad").addEventListener("click", () => {
    lineKind = "bad";
    setActive(["btnBad", "btnBest"], "btnBad");
    frameIdx = 0;
    renderViewer();
  });
  $("btnBest").addEventListener("click", () => {
    lineKind = "best";
    setActive(["btnBad", "btnBest"], "btnBest");
    frameIdx = 0;
    renderViewer();
  });

  $("btnExpA").addEventListener("click", () => {
    expKind = "A";
    setActive(["btnExpA", "btnExpB"], "btnExpA");
    renderViewer();
  });

  $("btnExpB").addEventListener("click", () => {
    expKind = "B";
    setActive(["btnExpA", "btnExpB"], "btnExpB");

    // Bを見たフラグ
    const cId = CASES[step - 1].id;
    state.cases[cId].seenB = true;
    saveState();

    renderViewer();
  });

  $("prevBtn").addEventListener("click", () => { frameIdx--; renderViewer(); });
  $("nextBtn").addEventListener("click", () => { frameIdx++; renderViewer(); });
  $("frameSlider").addEventListener("input", (e) => {
    frameIdx = Number(e.target.value);
    renderViewer();
  });

  // 進行ボタン
  $("btnToCase1").addEventListener("click", async () => {
    if (!canGoNextFromProfile()) return;
    step = 1;
    renderScreen();
    await loadCaseMeta(CASES[0].id);
  });

  $("btnNextCase").addEventListener("click", async () => {
    if (!canGoNextFromCase()) return;

    // 次の局面へ
    if (step < CASES.length) {
      step++;
      renderScreen();
      await loadCaseMeta(CASES[step - 1].id);
      return;
    }

    // 最後なら送信
    $("btnNextCase").disabled = true;
    $("btnNextCase").textContent = "送信中…";

    try {
      await submitAll();
      localStorage.setItem(LS_SUBMITTED, "1");
      step = 3;
      renderScreen();
    } catch (e) {
      $("btnNextCase").disabled = false;
      $("btnNextCase").textContent = "送信して終了";
      alert("送信でエラーが起きました。ネット接続を確認してもう一度試してください。");
    }
  });

  // プロフィール画面の次へ状態
  $("btnToCase1").disabled = !canGoNextFromProfile();
}

init();
