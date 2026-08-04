const storeKey = "kakeibo-morph-v2";
const features = [
  ["summary", "予算サマリー"],
  ["input", "すぐ記録"],
  ["chart", "カテゴリグラフ"],
  ["records", "最近の記録"],
  ["goals", "ちいさな目標"]
];

const helpContent = {
  summary: ["予算サマリー", "今月の予算、使った金額、残りのお金を一目で見る場所です。細かい数字より、今どれくらい余裕があるかをすぐ分かるようにしています。", "#2d7d75"],
  input: ["すぐ記録", "買ったあとに金額とカテゴリを入れて記録します。メモは空でも大丈夫です。小学生でも迷いにくいよう、入力欄を少なくしています。", "#c85f40"],
  chart: ["カテゴリ", "食べもの、交通、遊びなど、どこにお金を使ったかを棒グラフで見ます。多く使ったものほど長く表示されます。", "#3f5f9b"],
  records: ["最近の記録", "新しい記録から順に並びます。間違えた記録は右側の×で消せます。", "#d0a029"],
  goals: ["ちいさな目標", "節約を大きな努力にしないための小さなチェックです。できたらチェックするだけで続けやすくします。", "#7b609e"]
};

const defaultMorph = {
  title: "かけいぼ変形",
  eyebrow: "budget morph",
  theme: "green",
  labels: {
    summary: "予算サマリー",
    input: "すぐ記録",
    chart: "カテゴリ",
    records: "最近の記録",
    goals: "ちいさな目標",
    budget: "今月の予算",
    spent: "使った",
    left: "残り"
  },
  message: ""
};

const defaultState = {
  budget: 30000,
  expenses: [],
  goals: [
    { id: "noSnack", label: "お菓子を買わない日を作る", done: false },
    { id: "receipt", label: "レシートをすぐ記録", done: false },
    { id: "save500", label: "500円残す", done: false }
  ],
  enabled: Object.fromEntries(features.map(([id]) => [id, false])),
  order: features.map(([id]) => id),
  morph: defaultMorph
};

let state = load();
const yen = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0
});
const $ = (id) => document.getElementById(id);

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(storeKey));
    return {
      ...defaultState,
      ...saved,
      enabled: {
        ...defaultState.enabled,
        ...(saved?.enabled || {})
      },
      order: normalizeOrder(saved?.order),
      goals: Array.isArray(saved?.goals) ? saved.goals : defaultState.goals,
      expenses: Array.isArray(saved?.expenses) ? saved.expenses : [],
      morph: {
        ...defaultMorph,
        ...(saved?.morph || {}),
        labels: {
          ...defaultMorph.labels,
          ...(saved?.morph?.labels || {})
        }
      }
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function normalizeOrder(order) {
  const allowedIds = features.map(([id]) => id);
  if (!Array.isArray(order)) return [...allowedIds];
  const validOrder = order.filter((id) => allowedIds.includes(id));
  return [...new Set(validOrder), ...allowedIds.filter((id) => !validOrder.includes(id))];
}

function save() {
  localStorage.setItem(storeKey, JSON.stringify(state));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function render() {
  applySavedAppearance();
  renderStack();
  renderFeatureToggles();
  renderSummary();
  renderChart();
  renderExpenses();
  renderGoals();
}

function applySavedAppearance() {
  const morph = state.morph || defaultMorph;
  $("appShell").dataset.theme = morph.theme || defaultMorph.theme;
  $("appTitle").textContent = morph.title || defaultMorph.title;
  $("appEyebrow").textContent = morph.eyebrow || defaultMorph.eyebrow;
  $("summaryBudgetLabel").textContent = morph.labels?.budget || defaultMorph.labels.budget;
  $("summarySpentLabel").textContent = morph.labels?.spent || defaultMorph.labels.spent;
  $("summaryLeftLabel").textContent = morph.labels?.left || defaultMorph.labels.left;

  document.querySelectorAll("[data-feature-title]").forEach((node) => {
    const id = node.dataset.featureTitle;
    node.textContent = morph.labels?.[id] || defaultMorph.labels[id];
  });
}

function renderStack() {
  const stack = $("featureStack");
  state.order.forEach((featureId) => {
    const node = document.querySelector(`[data-feature="${featureId}"]`);
    if (node) stack.appendChild(node);
  });

  const hasVisible = Object.values(state.enabled).some(Boolean);
  $("emptyState").classList.toggle("is-hidden", hasVisible);
  stack.classList.toggle("is-empty", !hasVisible);

  document.querySelectorAll(".movable").forEach((node) => {
    node.classList.toggle("is-hidden", !state.enabled[node.dataset.feature]);
  });
}

function renderFeatureToggles() {
  $("featureToggles").innerHTML = features.map(([id, label]) => `
    <label class="switch">
      <input type="checkbox" data-feature-toggle="${id}" ${state.enabled[id] ? "checked" : ""}>
      <span>${state.morph?.labels?.[id] || label}</span>
    </label>
  `).join("");
}

function showHelp(id) {
  const item = helpContent[id];
  if (!item) return;
  const [title, text, color] = item;
  $("helpTitle").textContent = title;
  $("helpText").textContent = text;
  $("helpImage").src = createHelpImage(title, color);
  $("helpImage").alt = `${title}の説明画像`;
  $("helpDialog").showModal();
}

function createHelpImage(title, color) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
      <rect width="640" height="360" rx="28" fill="#fffdf8"/>
      <rect x="44" y="44" width="552" height="272" rx="22" fill="#f4f6ef" stroke="#d7dccd" stroke-width="4"/>
      <circle cx="150" cy="168" r="62" fill="${color}"/>
      <path d="M126 168h48M150 144v48" stroke="#fff" stroke-width="18" stroke-linecap="round"/>
      <rect x="252" y="106" width="242" height="28" rx="14" fill="#1f2933"/>
      <rect x="252" y="158" width="300" height="24" rx="12" fill="${color}" opacity=".82"/>
      <rect x="252" y="206" width="214" height="24" rx="12" fill="#d7dccd"/>
      <text x="320" y="292" text-anchor="middle" font-family="system-ui, sans-serif" font-size="28" font-weight="800" fill="#1f2933">${title}</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function renderSummary() {
  const spent = state.expenses.reduce((sum, item) => sum + item.amount, 0);
  $("monthlyBudget").value = state.budget;
  $("budgetTotal").textContent = yen.format(state.budget);
  $("budgetSpent").textContent = yen.format(spent);
  $("budgetLeft").textContent = yen.format(state.budget - spent);
  $("budgetLeft").style.color = state.budget - spent < 0 ? "#ffc1ad" : "#fff";
}

function renderExpenses() {
  $("expenseList").innerHTML = state.expenses.length
    ? state.expenses.slice(0, 10).map((item) => `
      <div class="row">
        <div>
          <strong>${escapeHtml(item.memo || item.category)}</strong>
          <small>${escapeHtml(item.category)}・${new Date(item.createdAt).toLocaleDateString("ja-JP")}</small>
        </div>
        <div class="row-actions">
          <span class="amount">${yen.format(item.amount)}</span>
          <button class="mini" data-delete-expense="${item.id}" aria-label="削除">×</button>
        </div>
      </div>
    `).join("")
    : '<p class="muted">まだ記録はありません。</p>';
}

function renderGoals() {
  $("goalList").innerHTML = state.goals.map((goal) => `
    <label class="switch">
      <input type="checkbox" data-goal="${goal.id}" ${goal.done ? "checked" : ""}>
      <span>${escapeHtml(goal.label)}</span>
    </label>
  `).join("");
}

function renderChart() {
  const canvas = $("chart");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const totals = state.expenses.reduce((map, item) => {
    map[item.category] = (map[item.category] || 0) + item.amount;
    return map;
  }, {});
  const rows = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...rows.map(([, amount]) => amount), 1);
  const colors = ["#2d7d75", "#c85f40", "#3f5f9b", "#d0a029", "#7b609e"];
  ctx.font = "15px system-ui";

  if (!rows.length) {
    ctx.fillStyle = "#64707d";
    ctx.fillText("記録すると、ここにグラフが出ます。", 20, 112);
    return;
  }

  rows.forEach(([category, amount], index) => {
    const y = 24 + index * 38;
    const width = Math.max(18, (amount / max) * 172);
    ctx.fillStyle = colors[index % colors.length];
    roundRect(ctx, 112, y, width, 18, 9);
    ctx.fillStyle = "#1f2933";
    ctx.fillText(category, 12, y + 14);
    ctx.fillText(yen.format(amount), 112 + width + 10, y + 14);
  });
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
  ctx.fill();
}

$("budgetForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = Number($("expenseAmount").value);
  state.budget = Number($("monthlyBudget").value) || 0;
  if (amount <= 0) return;

  state.expenses.unshift({
    id: crypto.randomUUID(),
    amount,
    category: $("expenseCategory").value,
    memo: $("expenseMemo").value.trim(),
    createdAt: new Date().toISOString()
  });

  $("expenseAmount").value = "";
  $("expenseMemo").value = "";
  save();
  render();
});

$("monthlyBudget").addEventListener("change", () => {
  state.budget = Number($("monthlyBudget").value) || 0;
  save();
  renderSummary();
});

$("resetButton").addEventListener("click", () => {
  state.expenses = [];
  save();
  render();
});

$("settingsButton").addEventListener("click", () => $("settingsDialog").showModal());
$("emptySettingsButton").addEventListener("click", () => $("settingsDialog").showModal());

document.addEventListener("click", (event) => {
  const id = event.target.dataset.help;
  if (id) showHelp(id);
});

$("expenseList").addEventListener("click", (event) => {
  const id = event.target.dataset.deleteExpense;
  if (!id) return;
  state.expenses = state.expenses.filter((item) => item.id !== id);
  save();
  render();
});

$("goalList").addEventListener("change", (event) => {
  const goal = state.goals.find((item) => item.id === event.target.dataset.goal);
  if (!goal) return;
  goal.done = event.target.checked;
  save();
});

$("featureToggles").addEventListener("change", (event) => {
  const id = event.target.dataset.featureToggle;
  if (!id) return;
  state.enabled[id] = event.target.checked;
  save();
  renderStack();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

render();
