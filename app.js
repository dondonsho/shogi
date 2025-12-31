const $ = (id) => document.getElementById(id);

const CASES = [
  { id: "case01", title: "case01" },
  { id: "case02", title: "case02" },
  { id: "case03", title: "case03" },
  { id: "case04", title: "case04" },
  { id: "case05", title: "case05" },
  { id: "case06", title: "case06" },
];

let meta = null;
let caseId = "case01";
let lineKind = "bad"; // "bad" or "best"
let expKind = "A";    // "A" or "B"
let frameIdx = 0;

function setActive(btnIds, activeId) {
  btnIds.forEach(id => $(id).classList.toggle("active", id === activeId));
}

function metaUrl() {
  return `./${caseId}/meta.json`;
}

function caseDir() {
  return `./${caseId}`;
}

function getFrames() {
  if (!meta?.frames) return [];
  return meta.frames[lineKind] || [];
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
  $("boardImg").src = `${caseDir()}/${fr.file}`;

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

async function loadCase(newCaseId) {
  caseId = newCaseId;

  // 読み込みのたびに先頭へ戻す
  lineKind = "bad";
  expKind = "A";
  frameIdx = 0;

  setActive(["btnBad","btnBest"], "btnBad");
  setActive(["btnExpA","btnExpB"], "btnExpA");

  const res = await fetch(metaUrl(), { cache: "no-store" });
  meta = await res.json();
  render();
}

function initCaseSelect() {
  const sel = $("caseSelect");
  sel.innerHTML = "";

  for (const c of CASES) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.title;
    sel.appendChild(opt);
  }

  sel.value = caseId;

  sel.addEventListener("change", async (e) => {
    await loadCase(e.target.value);
  });
}

async function init() {
  initCaseSelect();

  // ボタンイベント
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
    setActive(["btnExpA","btnExpB"], "btnExpA");
    render();
  });

  $("btnExpB").addEventListener("click", () => {
    expKind = "B";
    setActive(["btnExpA","btnExpB"], "btnExpB");
    render();
  });

  $("prevBtn").addEventListener("click", () => { frameIdx--; render(); });
  $("nextBtn").addEventListener("click", () => { frameIdx++; render(); });
  $("frameSlider").addEventListener("input", (e) => {
    frameIdx = Number(e.target.value);
    render();
  });

  // 初期ロード
  await loadCase(caseId);
}

init();
