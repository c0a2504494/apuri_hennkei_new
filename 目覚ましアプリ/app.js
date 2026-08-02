const storeKey = "mezamashi-morph-v1";
const features = [
  ["hero", "大きな時計"],
  ["quick", "すぐ追加"],
  ["alarms", "セット中"],
  ["routine", "朝のルーティン"],
  ["transform", "変形"]
];
const defaultState = {
  alarms: [],
  routine: [
    { id: "water", label: "水を飲む", done: false },
    { id: "curtain", label: "カーテンを開ける", done: false },
    { id: "bag", label: "持ち物を見る", done: false }
  ],
  enabled: Object.fromEntries(features.map(([id]) => [id, true])),
  order: features.map(([id]) => id)
};
let state = load();
let ringMission = null;
let audio = null;
const $ = (id) => document.getElementById(id);

function load() {
  try {
    const savedState = JSON.parse(localStorage.getItem(storeKey));
    if (!savedState || typeof savedState !== "object") return structuredClone(defaultState);

    const savedOrder = Array.isArray(savedState.order) ? savedState.order : [];
    const knownFeatureIds = features.map(([id]) => id);
    const validSavedOrder = savedOrder.filter((id, index) => knownFeatureIds.includes(id) && savedOrder.indexOf(id) === index);

    return {
      ...structuredClone(defaultState),
      ...savedState,
      alarms: Array.isArray(savedState.alarms) ? savedState.alarms : [],
      routine: Array.isArray(savedState.routine) ? savedState.routine : structuredClone(defaultState.routine),
      enabled: { ...defaultState.enabled, ...(savedState.enabled || {}) },
      order: [...validSavedOrder, ...knownFeatureIds.filter((id) => !validSavedOrder.includes(id))]
    };
  } catch {
    return structuredClone(defaultState);
  }
}
function save() { localStorage.setItem(storeKey, JSON.stringify(state)); }
function createId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}
function missionLabel(value) {
  return { tap: "ボタン", math: "計算", type: "合言葉" }[value] || "ボタン";
}
function toLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function render() {
  renderOrder();
  renderFeatureToggles();
  renderClock();
  renderAlarms();
  renderRoutine();
}
function renderOrder() {
  const app = document.querySelector(".app");
  state.order.forEach((featureId) => {
    const node = document.querySelector(`[data-feature="${featureId}"]`);
    if (node) app.appendChild(node);
  });
  document.querySelectorAll(".movable").forEach((node) => {
    node.classList.toggle("is-hidden", node.dataset.feature !== "transform" && !state.enabled[node.dataset.feature]);
  });
}
function renderFeatureToggles() {
  $("featureToggles").innerHTML = features.map(([id, label]) => `
    <label class="switch">
      <input type="checkbox" data-feature-toggle="${id}" ${state.enabled[id] ? "checked" : ""} ${id === "transform" ? "disabled" : ""}>
      <span>${label}</span>
    </label>
  `).join("");
}
function renderClock() {
  const now = new Date();
  $("nowClock").textContent = now.toTimeString().slice(0, 5);
  const active = state.alarms.filter((a) => a.enabled).sort((a, b) => a.time.localeCompare(b.time))[0];
  $("nextAlarmText").textContent = active ? `次は ${active.time} ${active.label || "目覚まし"}` : "アラームはまだありません";
}
function renderAlarms() {
  const sortedAlarms = [...state.alarms].sort((a, b) => a.time.localeCompare(b.time));
  $("alarmList").innerHTML = sortedAlarms.length ? sortedAlarms.map((alarm) => `
    <div class="row">
      <div><strong>${alarm.time}</strong><small>${escapeHtml(alarm.label || "目覚まし")}・${missionLabel(alarm.mission)}</small></div>
      <div class="row-actions">
        <label class="switch"><input type="checkbox" data-alarm-on="${alarm.id}" ${alarm.enabled ? "checked" : ""}><span>${alarm.enabled ? "ON" : "OFF"}</span></label>
        <button class="mini" data-delete-alarm="${alarm.id}" aria-label="削除">×</button>
      </div>
    </div>
  `).join("") : '<p class="muted">まだ目覚ましはありません。</p>';
}
function renderRoutine() {
  $("routineList").innerHTML = state.routine.map((item) => `
    <label class="switch"><input type="checkbox" data-routine="${item.id}" ${item.done ? "checked" : ""}><span>${escapeHtml(item.label)}</span></label>
  `).join("");
}
function checkAlarms() {
  const now = new Date();
  const time = now.toTimeString().slice(0, 5);
  const today = toLocalDateKey(now);
  state.alarms.forEach((alarm) => {
    if (alarm.enabled && alarm.time === time && alarm.lastRing !== today) {
      alarm.lastRing = today;
      save();
      startRing(alarm);
    }
  });
}
function startRing(alarm) {
  ringMission = createMission(alarm.mission);
  $("ringTitle").textContent = alarm.label || "時間です";
  $("missionText").textContent = ringMission.prompt;
  $("missionAnswer").style.display = ringMission.needsInput ? "block" : "none";
  $("missionAnswer").value = "";
  playSound();
  $("ringDialog").showModal();
  if (ringMission.needsInput) $("missionAnswer").focus();
}
function createMission(type) {
  if (type === "math") {
    const a = 2 + Math.floor(Math.random() * 8);
    const b = 2 + Math.floor(Math.random() * 8);
    return { prompt: `${a} + ${b} は？`, answer: String(a + b), needsInput: true };
  }
  if (type === "type") return { prompt: "「おきた」と入力してください。", answer: "おきた", needsInput: true };
  return { prompt: "大きなボタンを押してください。", answer: "", needsInput: false };
}
function playSound() {
  stopSound();
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    audio = new AudioContextClass();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = 720;
    gain.gain.value = .1;
    osc.connect(gain).connect(audio.destination);
    osc.start();
    audio.osc = osc;
  } catch {
    audio = null;
  }
}
function stopSound() {
  if (!audio) return;
  try { audio.osc?.stop(); } catch {}
  audio.close().catch(() => {});
  audio = null;
}

$("alarmForm").addEventListener("submit", (event) => {
  event.preventDefault();
  state.alarms.push({ id: createId(), time: $("alarmTime").value, label: $("alarmLabel").value.trim(), mission: $("alarmMission").value, enabled: true, lastRing: "" });
  $("alarmLabel").value = "";
  save();
  render();
});
$("alarmList").addEventListener("change", (event) => {
  const id = event.target.dataset.alarmOn;
  if (!id) return;
  const alarm = state.alarms.find((item) => item.id === id);
  if (!alarm) return;
  alarm.enabled = event.target.checked;
  save();
  render();
});
$("alarmList").addEventListener("click", (event) => {
  const id = event.target.dataset.deleteAlarm;
  if (!id) return;
  state.alarms = state.alarms.filter((item) => item.id !== id);
  save();
  render();
});
$("routineList").addEventListener("change", (event) => {
  const item = state.routine.find((x) => x.id === event.target.dataset.routine);
  if (!item) return;
  item.done = event.target.checked;
  save();
});
$("featureToggles").addEventListener("change", (event) => {
  const id = event.target.dataset.featureToggle;
  if (!id) return;
  state.enabled[id] = event.target.checked;
  save();
  renderOrder();
});
$("clearDoneButton").addEventListener("click", () => {
  state.alarms.forEach((alarm) => alarm.lastRing = "");
  save();
});
$("editButton").addEventListener("click", () => {
  document.querySelector(".app").classList.toggle("is-editing");
  $("editButton").classList.toggle("is-on");
});
$("ringForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (ringMission?.needsInput && $("missionAnswer").value.trim() !== ringMission.answer) {
    $("missionText").textContent = "もう一回。ゆっくりで大丈夫です。";
    return;
  }
  stopSound();
  $("ringDialog").close();
});

let holdTimer = null;
let dragged = null;
document.addEventListener("pointerdown", (event) => {
  const panel = event.target.closest(".movable");
  if (!panel || !document.querySelector(".app").classList.contains("is-editing")) return;
  holdTimer = setTimeout(() => {
    dragged = panel;
    panel.classList.add("dragging");
    panel.setPointerCapture(event.pointerId);
  }, 420);
});
document.addEventListener("pointermove", (event) => {
  if (!dragged) return;
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".movable");
  if (target && target !== dragged) {
    const rect = target.getBoundingClientRect();
    target.before(dragged);
    if (event.clientY > rect.top + rect.height / 2) target.after(dragged);
  }
});
document.addEventListener("pointerup", () => {
  clearTimeout(holdTimer);
  if (!dragged) return;
  dragged.classList.remove("dragging");
  state.order = [...document.querySelectorAll(".movable")].map((node) => node.dataset.feature);
  dragged = null;
  save();
});

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
render();
setInterval(() => { renderClock(); checkAlarms(); }, 1000);
