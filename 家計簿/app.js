const storeKey = "kakeibo-morph-v2";
const backupVersion = 1;

const features = [
  ["summary", "予算サマリー"],
  ["input", "すぐ記録"],
  ["chart", "カテゴリ別支出"],
  ["records", "記録一覧"],
  ["goals", "ちいさな目標"]
];

const categories = {
  expense: ["食べもの", "日用品", "交通", "住まい", "学校・仕事", "健康", "遊び", "その他"],
  income: ["給料", "仕送り", "臨時収入", "返金", "その他"]
};

const helpContent = {
  summary: ["予算サマリー", "選んだ月の予算・収入・支出・残りをまとめて表示します。残りは「予算 − 支出」です。", "#2d7d75"],
  input: ["すぐ記録", "支出だけでなく収入も記録できます。日付を変えれば、過去の記録も追加できます。", "#c85f40"],
  chart: ["カテゴリ別支出", "選んだ月の支出をカテゴリ別に集計します。収入はこのグラフには含みません。", "#3f5f9b"],
  records: ["記録一覧", "選んだ月の記録を検索・絞り込みできます。鉛筆ボタンで編集、×ボタンで削除できます。", "#d0a029"],
  goals: ["ちいさな目標", "節約を大きな努力にしないための小さなチェックです。達成状況は端末内に保存されます。", "#7b609e"]
};

const defaultAppearance = {
  title: "かけいぼ変形",
  eyebrow: "budget notebook",
  theme: "green",
  labels: {
    summary: "予算サマリー",
    input: "すぐ記録",
    chart: "カテゴリ別支出",
    records: "記録一覧",
    goals: "ちいさな目標",
    budget: "予算",
    spent: "支出",
    left: "残り"
  }
};

const defaultState = {
  budget: 30000,
  budgets: {},
  expenses: [],
  goals: [
    { id: "noSnack", label: "お菓子を買わない日を作る", done: false },
    { id: "receipt", label: "買ったらその日に記録", done: false },
    { id: "save500", label: "500円残す", done: false }
  ],
  enabled: Object.fromEntries(features.map(([id]) => [id, true])),
  order: features.map(([id]) => id),
  morph: defaultAppearance
};

const yen = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0
});

const $ = (id) => document.getElementById(id);
let selectedMonth = monthKey(new Date());
let toastTimer;
let state = load();

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthFromKey(key) {
  const [year, month] = String(key).split("-").map(Number);
  if (!year || !month) return new Date();
  return new Date(year, month - 1, 1);
}

function shiftMonth(key, offset) {
  const date = monthFromKey(key);
  date.setMonth(date.getMonth() + offset);
  return monthKey(date);
}

function transactionDate(item) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(item.date || "")) return item.date;
  const created = new Date(item.createdAt);
  if (!Number.isNaN(created.getTime())) {
    return `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}-${String(created.getDate()).padStart(2, "0")}`;
  }
  return todayKey();
}

function createId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(defaultState));
}

function normalizeOrder(order) {
  const allowedIds = features.map(([id]) => id);
  if (!Array.isArray(order)) return [...allowedIds];
  const validOrder = order.filter((id) => allowedIds.includes(id));
  return [...new Set(validOrder), ...allowedIds.filter((id) => !validOrder.includes(id))];
}

function normalizeTransaction(item) {
  const amount = Number(item?.amount);
  return {
    id: String(item?.id || createId()),
    type: item?.type === "income" ? "income" : "expense",
    amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
    category: String(item?.category || "その他").slice(0, 30),
    memo: String(item?.memo || "").slice(0, 48),
    date: transactionDate(item || {}),
    createdAt: item?.createdAt || new Date().toISOString()
  };
}

function normalizeState(source) {
  const saved = source && typeof source === "object" ? source : {};
  const normalizedExpenses = Array.isArray(saved.expenses)
    ? saved.expenses.map(normalizeTransaction).filter((item) => item.amount > 0)
    : [];
  const normalizedBudgets = saved.budgets && typeof saved.budgets === "object"
    ? Object.fromEntries(
      Object.entries(saved.budgets)
        .filter(([key, value]) => /^\d{4}-\d{2}$/.test(key) && Number.isFinite(Number(value)))
        .map(([key, value]) => [key, Math.max(0, Number(value))])
    )
    : {};

  if (!(monthKey(new Date()) in normalizedBudgets) && Number.isFinite(Number(saved.budget))) {
    normalizedBudgets[monthKey(new Date())] = Math.max(0, Number(saved.budget));
  }

  return {
    ...defaultState,
    ...saved,
    budget: Number.isFinite(Number(saved.budget)) ? Math.max(0, Number(saved.budget)) : defaultState.budget,
    budgets: normalizedBudgets,
    expenses: normalizedExpenses,
    goals: Array.isArray(saved.goals) ? saved.goals : cloneDefaultState().goals,
    enabled: {
      ...defaultState.enabled,
      ...(saved.enabled || {})
    },
    order: normalizeOrder(saved.order),
    morph: {
      ...defaultAppearance,
      ...(saved.morph || {}),
      labels: {
        ...defaultAppearance.labels,
        ...(saved.morph?.labels || {})
      }
    }
  };
}

function load() {
  try {
    const raw = localStorage.getItem(storeKey);
    return raw ? normalizeState(JSON.parse(raw)) : cloneDefaultState();
  } catch {
    return cloneDefaultState();
  }
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

function showToast(message) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  $("toast").classList.add("is-visible");
  toastTimer = setTimeout(() => $("toast").classList.remove("is-visible"), 2400);
}

function openDialog(dialog) {
  if (!dialog.open) dialog.showModal();
}

function getMonthTransactions(month = selectedMonth) {
  return state.expenses.filter((item) => item.date.startsWith(month));
}

function getMonthBudget(month = selectedMonth) {
  const value = state.budgets[month];
  return Number.isFinite(Number(value)) ? Number(value) : state.budget;
}

function setMonthBudget(month, value) {
  const next = Math.max(0, Number(value) || 0);
  state.budgets[month] = next;
  state.budget = next;
}

function render() {
  applySavedAppearance();
  $("monthPicker").value = selectedMonth;
  renderStack();
  renderFeatureControls();
  renderCategoryOptions();
  renderSummary();
  renderChart();
  renderExpenses();
  renderGoals();
}

function applySavedAppearance() {
  const appearance = state.morph || defaultAppearance;
  $("appShell").dataset.theme = appearance.theme || defaultAppearance.theme;
  $("appTitle").textContent = appearance.title || defaultAppearance.title;
  $("appEyebrow").textContent = appearance.eyebrow || defaultAppearance.eyebrow;
  $("summaryBudgetLabel").textContent = appearance.labels?.budget || defaultAppearance.labels.budget;
  $("summarySpentLabel").textContent = appearance.labels?.spent || defaultAppearance.labels.spent;
  $("summaryLeftLabel").textContent = appearance.labels?.left || defaultAppearance.labels.left;
  $("themeSelect").value = appearance.theme || defaultAppearance.theme;

  document.querySelectorAll("[data-feature-title]").forEach((node) => {
    const id = node.dataset.featureTitle;
    node.textContent = appearance.labels?.[id] || defaultAppearance.labels[id];
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

function renderFeatureControls() {
  $("featureToggles").innerHTML = state.order.map((id, index) => {
    const label = state.morph?.labels?.[id] || features.find(([featureId]) => featureId === id)?.[1] || id;
    return `
      <div class="feature-control">
        <label class="switch">
          <input type="checkbox" data-feature-toggle="${id}" ${state.enabled[id] ? "checked" : ""}>
          <span>${escapeHtml(label)}</span>
        </label>
        <div class="feature-order-buttons">
          <button class="mini" type="button" data-move-feature="${id}" data-direction="-1" aria-label="${escapeHtml(label)}を上へ" ${index === 0 ? "disabled" : ""}>↑</button>
          <button class="mini" type="button" data-move-feature="${id}" data-direction="1" aria-label="${escapeHtml(label)}を下へ" ${index === state.order.length - 1 ? "disabled" : ""}>↓</button>
        </div>
      </div>
    `;
  }).join("");
}

function fillCategorySelect(select, type, selectedValue = "") {
  const options = [...categories[type]];
  if (selectedValue && !options.includes(selectedValue)) options.push(selectedValue);
  select.innerHTML = options.map((category) => `
    <option value="${escapeHtml(category)}" ${category === selectedValue ? "selected" : ""}>${escapeHtml(category)}</option>
  `).join("");
}

function renderCategoryOptions() {
  const type = $("transactionType").value || "expense";
  const current = $("expenseCategory").value;
  fillCategorySelect($("expenseCategory"), type, categories[type].includes(current) ? current : categories[type][0]);

  const categoryValues = [...new Set([
    ...categories.expense,
    ...categories.income,
    ...state.expenses.map((item) => item.category)
  ])].sort((a, b) => a.localeCompare(b, "ja"));

  const selectedFilter = $("recordCategoryFilter").value;
  $("recordCategoryFilter").innerHTML = [
    '<option value="all">すべてのカテゴリ</option>',
    ...categoryValues.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
  ].join("");
  $("recordCategoryFilter").value = categoryValues.includes(selectedFilter) ? selectedFilter : "all";
}

function renderSummary() {
  const transactions = getMonthTransactions();
  const spent = transactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);
  const income = transactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);
  const budget = getMonthBudget();

  $("monthlyBudget").value = budget;
  $("budgetTotal").textContent = yen.format(budget);
  $("incomeTotal").textContent = yen.format(income);
  $("budgetSpent").textContent = yen.format(spent);
  $("budgetLeft").textContent = yen.format(budget - spent);
  $("budgetLeft").style.color = budget - spent < 0 ? "#ffc1ad" : "#fff";
}

function filteredTransactions() {
  const search = $("recordSearch").value.trim().toLocaleLowerCase("ja");
  const type = $("recordTypeFilter").value;
  const category = $("recordCategoryFilter").value;

  return getMonthTransactions()
    .filter((item) => type === "all" || item.type === type)
    .filter((item) => category === "all" || item.category === category)
    .filter((item) => {
      if (!search) return true;
      return `${item.memo} ${item.category}`.toLocaleLowerCase("ja").includes(search);
    })
    .sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
}

function renderExpenses() {
  const items = filteredTransactions();
  $("recordCount").textContent = `${items.length}件`;

  $("expenseList").innerHTML = items.length
    ? items.map((item) => {
      const isIncome = item.type === "income";
      return `
        <div class="row">
          <div class="record-main">
            <strong>${escapeHtml(item.memo || item.category)}</strong>
            <small>
              <span class="transaction-badge ${item.type}">${isIncome ? "収入" : "支出"}</span>
              ${escapeHtml(item.category)}・${formatDate(item.date)}
            </small>
          </div>
          <div class="row-actions">
            <span class="amount ${item.type}">${isIncome ? "+" : "−"}${yen.format(item.amount)}</span>
            <button class="mini" type="button" data-edit-transaction="${item.id}" aria-label="編集">✎</button>
            <button class="mini" type="button" data-delete-transaction="${item.id}" aria-label="削除">×</button>
          </div>
        </div>
      `;
    }).join("")
    : '<p class="muted">条件に合う記録はありません。</p>';
}

function formatDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("ja-JP", {
    month: "short",
    day: "numeric",
    weekday: "short"
  }).format(new Date(year, month - 1, day));
}

function renderGoals() {
  $("goalList").innerHTML = state.goals.map((goal) => `
    <label class="switch">
      <input type="checkbox" data-goal="${escapeHtml(goal.id)}" ${goal.done ? "checked" : ""}>
      <span>${escapeHtml(goal.label)}</span>
    </label>
  `).join("");
}

function renderChart() {
  const canvas = $("chart");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const monthDate = monthFromKey(selectedMonth);
  $("chartMonthLabel").textContent = `${monthDate.getFullYear()}年${monthDate.getMonth() + 1}月`;

  const totals = getMonthTransactions()
    .filter((item) => item.type === "expense")
    .reduce((map, item) => {
      map[item.category] = (map[item.category] || 0) + item.amount;
      return map;
    }, {});

  const rows = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = Math.max(...rows.map(([, amount]) => amount), 1);
  const colors = ["#2d7d75", "#c85f40", "#3f5f9b", "#d0a029", "#7b609e", "#4b7a43"];
  ctx.font = "14px system-ui";

  if (!rows.length) {
    ctx.fillStyle = "#64707d";
    ctx.fillText("この月の支出を記録するとグラフが出ます。", 18, 125);
    return;
  }

  rows.forEach(([category, amount], index) => {
    const y = 22 + index * 36;
    const width = Math.max(18, (amount / max) * 170);
    ctx.fillStyle = colors[index % colors.length];
    roundRect(ctx, 112, y, width, 18, 9);
    ctx.fillStyle = "#1f2933";
    ctx.fillText(category.slice(0, 7), 10, y + 14);
    ctx.fillText(yen.format(amount), Math.min(112 + width + 8, 292), y + 14);
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

function changeSelectedMonth(nextMonth) {
  if (!/^\d{4}-\d{2}$/.test(nextMonth)) return;
  selectedMonth = nextMonth;
  $("monthPicker").value = selectedMonth;
  renderSummary();
  renderChart();
  renderExpenses();
}

function openEditDialog(id) {
  const item = state.expenses.find((transaction) => transaction.id === id);
  if (!item) return;

  $("editTransactionId").value = item.id;
  $("editTransactionType").value = item.type;
  $("editAmount").value = item.amount;
  $("editDate").value = item.date;
  $("editMemo").value = item.memo;
  fillCategorySelect($("editCategory"), item.type, item.category);
  openDialog($("editDialog"));
}

function deleteTransaction(id) {
  const item = state.expenses.find((transaction) => transaction.id === id);
  if (!item) return;
  if (!confirm(`${item.memo || item.category}（${yen.format(item.amount)}）を削除しますか？`)) return;
  state.expenses = state.expenses.filter((transaction) => transaction.id !== id);
  save();
  renderSummary();
  renderChart();
  renderExpenses();
  renderCategoryOptions();
  showToast("記録を削除しました");
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function exportCsv() {
  const rows = [...state.expenses]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => [
      item.date,
      item.type === "income" ? "収入" : "支出",
      item.category,
      item.amount,
      item.memo,
      item.createdAt
    ]);

  const csv = [
    ["日付", "種類", "カテゴリ", "金額", "メモ", "登録日時"],
    ...rows
  ].map((row) => row.map(csvEscape).join(",")).join("\r\n");

  downloadText(`かけいぼ_${todayKey()}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8");
  showToast("CSVを書き出しました");
}

function exportBackup() {
  const backup = {
    version: backupVersion,
    exportedAt: new Date().toISOString(),
    state
  };
  downloadText(
    `かけいぼ_バックアップ_${todayKey()}.json`,
    JSON.stringify(backup, null, 2),
    "application/json;charset=utf-8"
  );
  showToast("バックアップを保存しました");
}

async function importBackup(file) {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const source = parsed?.state || parsed;
    const restored = normalizeState(source);
    if (!confirm("現在のデータをバックアップ内容で置き換えますか？")) return;
    state = restored;
    save();
    render();
    showToast("バックアップを復元しました");
  } catch {
    alert("バックアップファイルを読み込めませんでした。");
  } finally {
    $("backupFileInput").value = "";
  }
}

$("budgetForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = Number($("expenseAmount").value);
  const date = $("expenseDate").value;
  if (!Number.isFinite(amount) || amount <= 0 || !date) {
    showToast("金額と日付を確認してください");
    return;
  }

  setMonthBudget(selectedMonth, $("monthlyBudget").value);
  state.expenses.push({
    id: createId(),
    type: $("transactionType").value === "income" ? "income" : "expense",
    amount,
    category: $("expenseCategory").value,
    memo: $("expenseMemo").value.trim(),
    date,
    createdAt: new Date().toISOString()
  });

  $("expenseAmount").value = "";
  $("expenseMemo").value = "";
  save();
  renderSummary();
  renderChart();
  renderExpenses();
  renderCategoryOptions();
  showToast("記録しました");
});

$("monthlyBudget").addEventListener("change", () => {
  setMonthBudget(selectedMonth, $("monthlyBudget").value);
  save();
  renderSummary();
});

$("transactionType").addEventListener("change", renderCategoryOptions);

$("previousMonthButton").addEventListener("click", () => changeSelectedMonth(shiftMonth(selectedMonth, -1)));
$("nextMonthButton").addEventListener("click", () => changeSelectedMonth(shiftMonth(selectedMonth, 1)));
$("currentMonthButton").addEventListener("click", () => changeSelectedMonth(monthKey(new Date())));
$("monthPicker").addEventListener("change", (event) => changeSelectedMonth(event.target.value));

$("recordSearch").addEventListener("input", renderExpenses);
$("recordTypeFilter").addEventListener("change", renderExpenses);
$("recordCategoryFilter").addEventListener("change", renderExpenses);

$("clearMonthButton").addEventListener("click", () => {
  const count = getMonthTransactions().length;
  if (!count) {
    showToast("この月に記録はありません");
    return;
  }
  if (!confirm(`${selectedMonth}の記録${count}件をすべて削除しますか？`)) return;
  state.expenses = state.expenses.filter((item) => !item.date.startsWith(selectedMonth));
  save();
  renderSummary();
  renderChart();
  renderExpenses();
  renderCategoryOptions();
  showToast("選んだ月の記録を削除しました");
});

$("settingsButton").addEventListener("click", () => openDialog($("settingsDialog")));
$("emptySettingsButton").addEventListener("click", () => openDialog($("settingsDialog")));

$("themeSelect").addEventListener("change", (event) => {
  state.morph.theme = event.target.value;
  save();
  applySavedAppearance();
});

$("featureToggles").addEventListener("change", (event) => {
  const id = event.target.dataset.featureToggle;
  if (!id) return;
  state.enabled[id] = event.target.checked;
  save();
  renderStack();
});

$("featureToggles").addEventListener("click", (event) => {
  const id = event.target.dataset.moveFeature;
  if (!id) return;
  const direction = Number(event.target.dataset.direction);
  const currentIndex = state.order.indexOf(id);
  const nextIndex = currentIndex + direction;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= state.order.length) return;
  [state.order[currentIndex], state.order[nextIndex]] = [state.order[nextIndex], state.order[currentIndex]];
  save();
  renderStack();
  renderFeatureControls();
});

document.addEventListener("click", (event) => {
  const helpId = event.target.dataset.help;
  if (helpId) showHelp(helpId);
});

function showHelp(id) {
  const item = helpContent[id];
  if (!item) return;
  const [title, text, color] = item;
  $("helpTitle").textContent = title;
  $("helpText").textContent = text;
  $("helpImage").src = createHelpImage(title, color);
  $("helpImage").alt = `${title}の説明画像`;
  openDialog($("helpDialog"));
}

function createHelpImage(title, color) {
  const safeTitle = String(title).replace(/[&<>"']/g, "");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
      <rect width="640" height="360" rx="28" fill="#fffdf8"/>
      <rect x="44" y="44" width="552" height="272" rx="22" fill="#f4f6ef" stroke="#d7dccd" stroke-width="4"/>
      <circle cx="150" cy="168" r="62" fill="${color}"/>
      <path d="M126 168h48M150 144v48" stroke="#fff" stroke-width="18" stroke-linecap="round"/>
      <rect x="252" y="106" width="242" height="28" rx="14" fill="#1f2933"/>
      <rect x="252" y="158" width="300" height="24" rx="12" fill="${color}" opacity=".82"/>
      <rect x="252" y="206" width="214" height="24" rx="12" fill="#d7dccd"/>
      <text x="320" y="292" text-anchor="middle" font-family="system-ui, sans-serif" font-size="28" font-weight="800" fill="#1f2933">${safeTitle}</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

$("expenseList").addEventListener("click", (event) => {
  const editId = event.target.dataset.editTransaction;
  const deleteId = event.target.dataset.deleteTransaction;
  if (editId) openEditDialog(editId);
  if (deleteId) deleteTransaction(deleteId);
});

$("editTransactionType").addEventListener("change", (event) => {
  fillCategorySelect($("editCategory"), event.target.value, "");
});

$("closeEditButton").addEventListener("click", () => $("editDialog").close());

$("editForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const item = state.expenses.find((transaction) => transaction.id === $("editTransactionId").value);
  const amount = Number($("editAmount").value);
  if (!item || !Number.isFinite(amount) || amount <= 0 || !$("editDate").value) return;

  item.type = $("editTransactionType").value === "income" ? "income" : "expense";
  item.amount = amount;
  item.date = $("editDate").value;
  item.category = $("editCategory").value;
  item.memo = $("editMemo").value.trim();
  save();
  $("editDialog").close();
  renderSummary();
  renderChart();
  renderExpenses();
  renderCategoryOptions();
  showToast("変更を保存しました");
});

$("goalList").addEventListener("change", (event) => {
  const goal = state.goals.find((item) => item.id === event.target.dataset.goal);
  if (!goal) return;
  goal.done = event.target.checked;
  save();
});

$("exportCsvButton").addEventListener("click", exportCsv);
$("exportBackupButton").addEventListener("click", exportBackup);
$("importBackupButton").addEventListener("click", () => $("backupFileInput").click());
$("backupFileInput").addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) importBackup(file);
});

$("clearAllButton").addEventListener("click", () => {
  if (!confirm("予算・記録・設定を含むすべてのデータを削除しますか？")) return;
  localStorage.removeItem(storeKey);
  state = cloneDefaultState();
  selectedMonth = monthKey(new Date());
  save();
  render();
  showToast("すべてのデータを削除しました");
});

$("expenseDate").value = todayKey();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

render();
