const $ = (id) => document.getElementById(id);

// ★ meta.json の場所（今回 fixed：case01）
const META_URL = "./case01/meta.json";
const CASE_DIR = "./case01";

let meta = null;
let lineKind = "bad"; // "bad" or "best"
let expKind = "A";    // "A" or "B"
let frameIdx = 0;

function setActive(btnIds, activeId) {
  btnIds.forEach(id => $(id).classList.toggle("active", id === activeId));
}

function getFrames() {
  if (!meta?.frames) return [];
  return meta.frames[lineKind] || [];
}

function render() {
  const frames = getFrames();
  if (!frames.length) return;

  frameIdx = Math.max(0, Math.min(frameIdx, frames.length - 1));
  const fr = frames[frameIdx];

  // 画像
  $("boardImg").src = `${CASE_DIR}/${fr.file}`;

  // ラベル（meta.jsonのlabelをそのまま表示）
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

async function init() {
  const res = await fetch(META_URL, { cache: "no-store" });
  meta = await res.json();

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

  render();
}

init();
