
const CONFIG = {
  // Put a real OpenWeatherMap API key here to enable live weather.
  // Get one free at https://openweathermap.org/api — never commit a real
  // key to a public repo. Leave blank to keep the "Weather unavailable" state.
  WEATHER_API_KEY: "815e2c4f654ae30c98bf698be2e5b9ae",
  QUOTE_API_URL: "https://api.quotable.io/random",
  POMODORO_DURATIONS: { work: 25 * 60, short: 5 * 60, long: 15 * 60 },
  PLANNER_HOURS: [
    6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
  ],
};

const FALLBACK_QUOTES = [
  { content: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { content: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { content: "Small daily improvements are the key to staggering long-term results.", author: "Unknown" },
  { content: "Code is like humor. When you have to explain it, it's bad.", author: "Cory House" },
  { content: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { content: "The expert in anything was once a beginner.", author: "Helen Hayes" },
  { content: "Done is better than perfect.", author: "Sheryl Sandberg" },
];

/* ==========================================================================
   2. DOM SELECTORS
   ========================================================================== */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const el = {
  sidebar: $("#sidebar"),
  sidebarToggle: $("#sidebar-toggle"),
  navItems: $$(".nav-item"),
  bnItems: $$(".bn-item"),
  views: $$(".view"),

  greeting: $("#greeting-text"),
  headerDate: $("#header-date"),
  headerTime: $("#header-time"),
  weatherChip: $("#weather-chip"),
  weatherText: $("#weather-text"),

  statTodayTasks: $("#stat-today-tasks"),
  statCompletedTasks: $("#stat-completed-tasks"),
  statPomodoros: $("#stat-pomodoros"),
  statProductivity: $("#stat-productivity"),
  statStreak: $("#stat-streak"),
  sidebarStreak: $("#sidebar-streak"),

  quoteText: $("#quote-text"),
  quoteAuthor: $("#quote-author"),
  refreshQuote: $("#refresh-quote"),

  plannerPreview: $("#planner-preview"),

  toastContainer: $("#toast-container"),
  confirmModal: $("#confirm-modal"),
  confirmTitle: $("#confirm-title"),
  confirmBody: $("#confirm-body"),
  confirmOk: $("#confirm-ok"),
  confirmCancel: $("#confirm-cancel"),
};

/* ==========================================================================
   3. LOCALSTORAGE HELPERS
   ========================================================================== */
const STORE_KEYS = {
  TASKS: "nexus_tasks",
  PLANNER: "nexus_planner",       // { "YYYY-MM-DD": { "09:00": {activity, completed} } }
  WORKING: "nexus_working",       // { "YYYY-MM-DD": [ {id,name,priority,progress} ] }
  POMO_STATS: "nexus_pomo_stats", // { "YYYY-MM-DD": count }
  QUOTE_CACHE: "nexus_quote_cache",
  PRODUCTIVITY_HISTORY: "nexus_productivity_history", // { "YYYY-MM-DD": {tasks, pomodoros, score} }
  ACTIVITY_HISTORY: "nexus_activity_history",         // { "YYYY-MM-DD": level(0-4) }
  WEATHER_CITY: "nexus_weather_city",
  PREFS: "nexus_prefs",
};

function saveData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error("saveData failed:", e);
    showToast("Couldn't save data locally.", "error");
    return false;
  }
}

function loadData(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error("loadData failed:", e);
    return fallback;
  }
}

function deleteData(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.error("deleteData failed:", e);
    return false;
  }
}

function updateData(key, updaterFn, fallback) {
  const current = loadData(key, fallback);
  const updated = updaterFn(current);
  saveData(key, updated);
  return updated;
}

/* Small date helpers */
function todayKey(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
function pad(n) { return String(n).padStart(2, "0"); }

/* ==========================================================================
   STATE (in-memory, hydrated from localStorage)
   ========================================================================== */
let state = {
  tasks: loadData(STORE_KEYS.TASKS, seedTasks()),
  planner: loadData(STORE_KEYS.PLANNER, {}),
  working: loadData(STORE_KEYS.WORKING, {}),
  pomoStats: loadData(STORE_KEYS.POMO_STATS, {}),
  productivityHistory: loadData(STORE_KEYS.PRODUCTIVITY_HISTORY, {}),
  activityHistory: loadData(STORE_KEYS.ACTIVITY_HISTORY, {}),
  prefs: loadData(STORE_KEYS.PREFS, { city: loadData(STORE_KEYS.WEATHER_CITY, "") }),
};

function seedTasks() {
  const today = todayKey();
  return [
    { id: 1, title: "Review pull requests", category: "Coding", priority: "High", completed: false, important: true, createdAt: today, dueTime: "11:00" },
    { id: 2, title: "Read chapter on data structures", category: "Study", priority: "Medium", completed: false, important: false, createdAt: today, dueTime: "15:00" },
    { id: 3, title: "Stand-up meeting", category: "Work", priority: "Low", completed: true, important: false, createdAt: today, dueTime: "09:30" },
  ];
}

/* ==========================================================================
   4. CLOCK
   ========================================================================== */
function tickClock() {
  const now = new Date();
  el.headerTime.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  el.headerDate.textContent = now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  updateGreeting(now);
  highlightCurrentPlannerSlot();
}
setInterval(tickClock, 1000);

/* ==========================================================================
   5. GREETING
   ========================================================================== */
function updateGreeting(now) {
  const h = now.getHours();
  let msg;
  if (h >= 5 && h < 12) msg = "Good morning";
  else if (h >= 12 && h < 17) msg = "Good afternoon";
  else if (h >= 17 && h < 21) msg = "Good evening";
  else msg = "Good night";
  el.greeting.textContent = `${msg}, Developer`;
}

/* ==========================================================================
   6. TODO
   ========================================================================== */
let taskFilters = { search: "", category: "all", priority: "all", status: "all" };

function renderTasks() {
  const list = $("#task-list");
  const empty = $("#task-empty");
  let items = state.tasks.filter((t) => {
    if (taskFilters.category !== "all" && t.category !== taskFilters.category) return false;
    if (taskFilters.priority !== "all" && t.priority !== taskFilters.priority) return false;
    if (taskFilters.status === "active" && t.completed) return false;
    if (taskFilters.status === "completed" && !t.completed) return false;
    if (taskFilters.status === "important" && !t.important) return false;
    if (taskFilters.search && !t.title.toLowerCase().includes(taskFilters.search.toLowerCase())) return false;
    return true;
  });

  list.innerHTML = "";
  empty.classList.toggle("hidden", items.length > 0);

  items.forEach((t) => {
    const row = document.createElement("div");
    row.className = "task-item" + (t.completed ? " completed" : "");
    row.dataset.id = t.id;
    row.innerHTML = `
      <button class="task-check ${t.completed ? "checked" : ""}" data-action="toggle" aria-label="Toggle complete">
        <i class="fa-solid fa-check"></i>
      </button>
      <div class="task-body">
        <div class="task-title-row">
          <span class="task-title">${escapeHtml(t.title)}</span>
          <button class="task-star ${t.important ? "active" : ""}" data-action="star" aria-label="Mark important"><i class="fa-solid fa-star"></i></button>
        </div>
        <div class="task-meta">
          <span class="badge badge-cat"><i class="fa-solid fa-tag"></i> ${t.category}</span>
          <span class="badge badge-${t.priority}">${t.priority}</span>
          ${t.dueTime ? `<span class="badge badge-time"><i class="fa-solid fa-clock"></i> ${t.dueTime}</span>` : ""}
        </div>
      </div>
      <div class="task-actions">
        <button class="icon-btn" data-action="edit" aria-label="Edit"><i class="fa-solid fa-pen"></i></button>
        <button class="icon-btn" data-action="delete" aria-label="Delete"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
    list.appendChild(row);
  });
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

// Event delegation for the task list
$("#task-list").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const row = e.target.closest(".task-item");
  const id = Number(row.dataset.id);
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;

  const action = btn.dataset.action;
  if (action === "toggle") {
    task.completed = !task.completed;
    if (task.completed) recordActivity("task");
    persistTasks();
    renderTasks();
    refreshAllStats();
    showToast(task.completed ? "Task completed. Nice work." : "Task marked active.", "success");
  } else if (action === "star") {
    task.important = !task.important;
    persistTasks();
    renderTasks();
  } else if (action === "edit") {
    openTaskModal(task);
  } else if (action === "delete") {
    confirmAction(`Delete "${task.title}"?`, "This task will be permanently removed.", () => {
      state.tasks = state.tasks.filter((t) => t.id !== id);
      persistTasks();
      renderTasks();
      refreshAllStats();
      showToast("Task deleted.", "info");
    });
  }
});

function persistTasks() { saveData(STORE_KEYS.TASKS, state.tasks); }

// Search & filters
$("#task-search").addEventListener("input", (e) => { taskFilters.search = e.target.value; renderTasks(); });
$("#filter-category").addEventListener("change", (e) => { taskFilters.category = e.target.value; renderTasks(); });
$("#filter-priority").addEventListener("change", (e) => { taskFilters.priority = e.target.value; renderTasks(); });
$("#filter-status").addEventListener("change", (e) => { taskFilters.status = e.target.value; renderTasks(); });

// Add/Edit modal
const taskModal = $("#task-modal");
function openTaskModal(task = null) {
  $("#task-modal-title").textContent = task ? "Edit Task" : "Add Task";
  $("#task-id").value = task ? task.id : "";
  $("#task-title").value = task ? task.title : "";
  $("#task-category").value = task ? task.category : "Work";
  $("#task-priority").value = task ? task.priority : "Medium";
  $("#task-due").value = task ? (task.dueTime || "") : "";
  taskModal.classList.remove("hidden");
  $("#task-title").focus();
}
function closeTaskModal() { taskModal.classList.add("hidden"); }
$("#open-add-task").addEventListener("click", () => openTaskModal());
$("#task-cancel").addEventListener("click", closeTaskModal);
taskModal.addEventListener("click", (e) => { if (e.target === taskModal) closeTaskModal(); });

$("#task-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = $("#task-id").value;
  const title = $("#task-title").value.trim();
  if (!title) return;
  const payload = {
    title,
    category: $("#task-category").value,
    priority: $("#task-priority").value,
    dueTime: $("#task-due").value,
  };
  if (id) {
    const task = state.tasks.find((t) => t.id === Number(id));
    Object.assign(task, payload);
    showToast("Task updated.", "success");
  } else {
    state.tasks.push({
      id: Date.now(),
      completed: false,
      important: false,
      createdAt: todayKey(),
      ...payload,
    });
    showToast("Task added.", "success");
  }
  persistTasks();
  renderTasks();
  refreshAllStats();
  closeTaskModal();
});

/* ==========================================================================
   7. DAY PLANNER
   ========================================================================== */
function getPlannerForToday() {
  const key = todayKey();
  if (!state.planner[key]) state.planner[key] = {};
  return state.planner[key];
}

function renderPlanner() {
  const container = $("#planner-list");
  const dayData = getPlannerForToday();
  $("#planner-date-label").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  container.innerHTML = "";

  const now = new Date();
  const currentHour = now.getHours();

  CONFIG.PLANNER_HOURS.forEach((hour) => {
    const slot = `${pad(hour)}:00`;
    const entry = dayData[slot];
    const row = document.createElement("div");
    row.className = "planner-row" + (entry ? " has-activity" : "") + (entry?.completed ? " completed" : "") + (hour === currentHour ? " current-slot" : "");
    row.dataset.slot = slot;
    row.innerHTML = `
      <span class="planner-time">${slot}</span>
      <div class="planner-activity">
        ${entry
          ? `<button class="task-check ${entry.completed ? "checked" : ""}" data-action="toggle-complete" style="width:20px;height:20px;"><i class="fa-solid fa-check" style="font-size:10px;"></i></button>
             <span class="planner-activity-text">${escapeHtml(entry.activity)}</span>`
          : `<span class="planner-placeholder">No activity planned</span>`
        }
      </div>
      <div class="planner-actions">
        <button class="mini-btn" data-action="edit"><i class="fa-solid fa-pen"></i></button>
        ${entry ? `<button class="mini-btn" data-action="delete"><i class="fa-solid fa-trash"></i></button>` : ""}
      </div>
    `;
    container.appendChild(row);
  });

  renderPlannerPreview(dayData, currentHour);
}

function renderPlannerPreview(dayData, currentHour) {
  const upcoming = CONFIG.PLANNER_HOURS
    .filter((h) => h >= currentHour && dayData[`${pad(h)}:00`])
    .slice(0, 4);
  el.plannerPreview.innerHTML = upcoming.length
    ? upcoming.map((h) => `<div class="pp-item"><span class="pp-time">${pad(h)}:00</span><span>${escapeHtml(dayData[`${pad(h)}:00`].activity)}</span></div>`).join("")
    : `<p class="pp-empty">Nothing scheduled for the rest of today.</p>`;
}

function highlightCurrentPlannerSlot() {
  if (!$("#view-planner").classList.contains("active") && !$("#view-dashboard").classList.contains("active")) return;
  renderPlanner();
}

$("#planner-list").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const row = e.target.closest(".planner-row");
  const slot = row.dataset.slot;
  const dayData = getPlannerForToday();
  const action = btn.dataset.action;

  if (action === "edit") {
    openPlannerModal(slot, dayData[slot]);
  } else if (action === "delete") {
    confirmAction("Remove this activity?", "It will be cleared from today's planner.", () => {
      delete dayData[slot];
      saveData(STORE_KEYS.PLANNER, state.planner);
      renderPlanner();
      showToast("Activity removed.", "info");
    });
  } else if (action === "toggle-complete") {
    dayData[slot].completed = !dayData[slot].completed;
    if (dayData[slot].completed) recordActivity("planner");
    saveData(STORE_KEYS.PLANNER, state.planner);
    renderPlanner();
    refreshAllStats();
  }
});

const plannerModal = $("#planner-modal");
function openPlannerModal(slot, entry) {
  $("#planner-modal-title").textContent = entry ? `Edit ${slot}` : `Add activity — ${slot}`;
  $("#planner-slot").value = slot;
  $("#planner-activity").value = entry ? entry.activity : "";
  plannerModal.classList.remove("hidden");
  $("#planner-activity").focus();
}
$("#planner-cancel").addEventListener("click", () => plannerModal.classList.add("hidden"));
plannerModal.addEventListener("click", (e) => { if (e.target === plannerModal) plannerModal.classList.add("hidden"); });

$("#planner-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const slot = $("#planner-slot").value;
  const activity = $("#planner-activity").value.trim();
  if (!activity) return;
  const dayData = getPlannerForToday();
  dayData[slot] = { activity, completed: dayData[slot]?.completed || false };
  saveData(STORE_KEYS.PLANNER, state.planner);
  renderPlanner();
  plannerModal.classList.add("hidden");
  showToast("Planner updated.", "success");
});

/* ==========================================================================
   8. TODAY'S WORK (Working List)
   ========================================================================== */
function getWorkForToday() {
  const key = todayKey();
  if (!state.working[key]) state.working[key] = [];
  return state.working[key];
}

function renderWorkingList() {
  const items = getWorkForToday();
  const container = $("#working-list");
  const empty = $("#working-empty");
  container.innerHTML = "";
  empty.classList.toggle("hidden", items.length > 0);

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "work-item glass";
    card.dataset.id = item.id;
    card.innerHTML = `
      <div class="work-top">
        <span class="work-name">${escapeHtml(item.name)}</span>
        <span class="badge badge-${item.priority}">${item.priority}</span>
      </div>
      <div class="work-progress-track"><div class="work-progress-fill" style="width:${item.progress}%"></div></div>
      <div class="work-controls">
        <div class="progress-buttons">
          ${[0, 25, 50, 75, 100].map((p) => `<button class="pct-btn ${item.progress === p ? "active" : ""}" data-pct="${p}">${p}%</button>`).join("")}
        </div>
        <button class="icon-btn" data-action="delete"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
    container.appendChild(card);
  });

  const total = items.length;
  const avg = total ? Math.round(items.reduce((s, i) => s + i.progress, 0) / total) : 0;
  $("#work-overall-pct").textContent = `${avg}%`;
  $("#work-overall-fill").style.width = `${avg}%`;
}

$("#working-list").addEventListener("click", (e) => {
  const card = e.target.closest(".work-item");
  if (!card) return;
  const id = Number(card.dataset.id);
  const items = getWorkForToday();
  const item = items.find((i) => i.id === id);
  if (!item) return;

  const pctBtn = e.target.closest("button[data-pct]");
  const delBtn = e.target.closest("button[data-action='delete']");

  if (pctBtn) {
    const wasComplete = item.progress === 100;
    item.progress = Number(pctBtn.dataset.pct);
    if (item.progress === 100 && !wasComplete) recordActivity("work");
    saveData(STORE_KEYS.WORKING, state.working);
    renderWorkingList();
    refreshAllStats();
  } else if (delBtn) {
    confirmAction(`Remove "${item.name}"?`, "This working item will be deleted.", () => {
      state.working[todayKey()] = items.filter((i) => i.id !== id);
      saveData(STORE_KEYS.WORKING, state.working);
      renderWorkingList();
      showToast("Item removed.", "info");
    });
  }
});

const workModal = $("#work-modal");
$("#open-add-work").addEventListener("click", () => { workModal.classList.remove("hidden"); $("#work-name").focus(); });
$("#work-cancel").addEventListener("click", () => workModal.classList.add("hidden"));
workModal.addEventListener("click", (e) => { if (e.target === workModal) workModal.classList.add("hidden"); });

$("#work-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("#work-name").value.trim();
  if (!name) return;
  const items = getWorkForToday();
  items.push({ id: Date.now(), name, priority: $("#work-priority").value, progress: 0 });
  saveData(STORE_KEYS.WORKING, state.working);
  renderWorkingList();
  $("#work-form").reset();
  workModal.classList.add("hidden");
  showToast("Added to today's working list.", "success");
});

/* ==========================================================================
   9. POMODORO
   ========================================================================== */
const pomo = {
  mode: "work",
  secondsLeft: CONFIG.POMODORO_DURATIONS.work,
  running: false,
  timerId: null,
  sessionsCompletedInCycle: 0,
};

const RING_CIRCUMFERENCE = 2 * Math.PI * 115;
$("#pomo-ring-fg").style.strokeDasharray = RING_CIRCUMFERENCE;

function renderPomo() {
  const total = CONFIG.POMODORO_DURATIONS[pomo.mode];
  const mins = Math.floor(pomo.secondsLeft / 60);
  const secs = pomo.secondsLeft % 60;
  $("#pomo-time").textContent = `${pad(mins)}:${pad(secs)}`;
  $("#pomo-mode-label").textContent = pomo.mode === "work" ? "Focus Time" : pomo.mode === "short" ? "Short Break" : "Long Break";

  const fraction = pomo.secondsLeft / total;
  $("#pomo-ring-fg").style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - fraction);
  $("#pomo-ring-fg").classList.toggle("running", pomo.running);

  const todayCount = state.pomoStats[todayKey()] || 0;
  $("#pomo-today-count").textContent = todayCount;
  $("#pomo-until-long").textContent = 4 - (pomo.sessionsCompletedInCycle % 4);

  const startBtn = $("#pomo-start");
  startBtn.innerHTML = pomo.running ? `<i class="fa-solid fa-pause"></i> Pause` : `<i class="fa-solid fa-play"></i> Start`;
}

function switchPomoMode(mode, resetRunning = true) {
  pomo.mode = mode;
  pomo.secondsLeft = CONFIG.POMODORO_DURATIONS[mode];
  if (resetRunning) { pomo.running = false; clearInterval(pomo.timerId); }
  $$(".pomo-mode").forEach((btn) => btn.classList.toggle("active", btn.dataset.mode === mode));
  renderPomo();
}

$$(".pomo-mode").forEach((btn) => btn.addEventListener("click", () => switchPomoMode(btn.dataset.mode)));

$("#pomo-start").addEventListener("click", () => {
  pomo.running = !pomo.running;
  if (pomo.running) {
    pomo.timerId = setInterval(pomoTick, 1000);
  } else {
    clearInterval(pomo.timerId);
  }
  renderPomo();
});

$("#pomo-reset").addEventListener("click", () => switchPomoMode(pomo.mode));

$("#pomo-skip").addEventListener("click", () => { handlePomoComplete(true); });

function pomoTick() {
  pomo.secondsLeft--;
  if (pomo.secondsLeft <= 0) {
    handlePomoComplete(false);
  } else {
    renderPomo();
  }
}

function handlePomoComplete(skipped) {
  clearInterval(pomo.timerId);
  pomo.running = false;

  if (pomo.mode === "work" && !skipped) {
    const key = todayKey();
    state.pomoStats[key] = (state.pomoStats[key] || 0) + 1;
    saveData(STORE_KEYS.POMO_STATS, state.pomoStats);
    pomo.sessionsCompletedInCycle++;
    recordActivity("pomodoro");
    showToast("Pomodoro complete. Take a breath.", "success");
    refreshAllStats();
    const nextMode = pomo.sessionsCompletedInCycle % 4 === 0 ? "long" : "short";
    switchPomoMode(nextMode);
  } else if (pomo.mode === "work" && skipped) {
    switchPomoMode(pomo.sessionsCompletedInCycle % 4 === 3 ? "long" : "short");
  } else {
    switchPomoMode("work");
  }
}

/* ==========================================================================
   10. MOTIVATION API
   ========================================================================== */
async function loadDailyQuote(forceRefresh = false) {
  const key = todayKey();
  const cache = loadData(STORE_KEYS.QUOTE_CACHE, null);

  if (!forceRefresh && cache && cache.date === key) {
    displayQuote(cache.quote);
    return;
  }

  el.quoteText.textContent = "Loading today's quote…";
  el.quoteAuthor.textContent = "";

  try {
    const res = await fetch(CONFIG.QUOTE_API_URL);
    if (!res.ok) throw new Error("Bad response");
    const data = await res.json();
    const quote = { content: data.content, author: data.author };
    displayQuote(quote);
    saveData(STORE_KEYS.QUOTE_CACHE, { date: key, quote });
  } catch (err) {
    console.warn("Quote API failed, using fallback:", err);
    const quote = FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
    displayQuote(quote);
    saveData(STORE_KEYS.QUOTE_CACHE, { date: key, quote });
  }
}

function displayQuote(quote) {
  el.quoteText.textContent = `"${quote.content}"`;
  el.quoteAuthor.textContent = `— ${quote.author}`;
}

el.refreshQuote.addEventListener("click", () => loadDailyQuote(true));

/* ==========================================================================
   11. WEATHER API
   ========================================================================== */
async function loadWeather() {
  const city = state.prefs.city;
  if (!CONFIG.WEATHER_API_KEY || !city) {
    el.weatherText.textContent = "Weather unavailable";
    return;
  }
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${CONFIG.WEATHER_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Weather fetch failed");
    const data = await res.json();
    const temp = Math.round(data.main.temp);
    const condition = data.weather[0].main;
    const humidity = data.main.humidity;
    const wind = data.wind.speed;
    el.weatherText.textContent = `${temp}°C · ${condition} · ${humidity}% hum · ${wind} m/s`;
  } catch (err) {
    console.warn("Weather API failed:", err);
    el.weatherText.textContent = "Weather unavailable";
  }
}

$("#save-city").addEventListener("click", () => {
  const city = $("#settings-city").value.trim();
  state.prefs.city = city;
  saveData(STORE_KEYS.PREFS, state.prefs);
  saveData(STORE_KEYS.WEATHER_CITY, city);
  showToast(city ? `City set to ${city}.` : "City cleared.", "success");
  loadWeather();
});

/* ==========================================================================
   12. PRODUCTIVITY STATISTICS
   ========================================================================== */
function computeTodayStats() {
  const todayTasks = state.tasks.filter((t) => t.createdAt === todayKey());
  const completedTasks = todayTasks.filter((t) => t.completed).length;
  const pomodoros = state.pomoStats[todayKey()] || 0;
  const total = todayTasks.length || 1;
  const productivity = Math.round(((completedTasks / total) * 0.7 + Math.min(pomodoros / 8, 1) * 0.3) * 100);
  return { todayTasksCount: todayTasks.length, completedTasks, pomodoros, productivity };
}

function refreshAllStats() {
  const stats = computeTodayStats();
  el.statTodayTasks.textContent = stats.todayTasksCount;
  el.statCompletedTasks.textContent = stats.completedTasks;
  el.statPomodoros.textContent = stats.pomodoros;
  el.statProductivity.textContent = `${stats.productivity}%`;

  // persist today's snapshot into productivity history
  state.productivityHistory[todayKey()] = {
    tasks: stats.completedTasks,
    pomodoros: stats.pomodoros,
    score: stats.productivity,
  };
  saveData(STORE_KEYS.PRODUCTIVITY_HISTORY, state.productivityHistory);

  const streak = computeStreak();
  el.statStreak.textContent = streak.current;
  el.sidebarStreak.textContent = streak.current;
  $("#heat-current").textContent = streak.current;
  $("#heat-longest").textContent = streak.longest;
  $("#heat-total").textContent = streak.total;
  $("#heat-current-2").textContent = streak.current;
  $("#heat-longest-2").textContent = streak.longest;
  $("#heat-total-2").textContent = streak.total;

  renderProductivityChart();
  renderHeatmap();
  renderWorkingList();
}

/* ==========================================================================
   13. STREAK CALCULATION
   ========================================================================== */
function recordActivity(source) {
  const key = todayKey();
  const current = state.activityHistory[key] || 0;
  // bump activity level, capped at 4
  state.activityHistory[key] = Math.min(4, current + 1);
  saveData(STORE_KEYS.ACTIVITY_HISTORY, state.activityHistory);
}

function computeStreak() {
  const days = Object.keys(state.activityHistory).filter((d) => state.activityHistory[d] > 0).sort();
  const daySet = new Set(days);

  let current = 0;
  for (let i = 0; ; i++) {
    const key = todayKey(-i);
    if (daySet.has(key)) current++;
    else break;
  }

  let longest = 0, run = 0;
  const sorted = [...daySet].sort();
  let prevDate = null;
  sorted.forEach((d) => {
    const dateObj = new Date(d);
    if (prevDate && (dateObj - prevDate) / 86400000 === 1) run++;
    else run = 1;
    longest = Math.max(longest, run);
    prevDate = dateObj;
  });

  return { current, longest, total: daySet.size };
}

/* ==========================================================================
   14. CHARTS
   ========================================================================== */
let productivityChartInstance = null;
let progressChartInstance = null;

function last7DaysLabelsAndData() {
  const labels = [];
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const key = todayKey(-i);
    const d = new Date(key);
    labels.push(d.toLocaleDateString(undefined, { weekday: "short" }));
    const entry = state.productivityHistory[key];
    data.push(entry ? entry.score : 0);
  }
  return { labels, data };
}

function renderProductivityChart() {
  const { labels, data } = last7DaysLabelsAndData();
  const ctx1 = $("#productivity-chart");
  const ctx2 = $("#progress-chart");

  const config = (ctx) => ({
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Productivity %",
        data,
        backgroundColor: "rgba(124,92,255,0.55)",
        hoverBackgroundColor: "#7c5cff",
        borderRadius: 6,
        maxBarThickness: 34,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#8b899d" } },
        y: { beginAtZero: true, max: 100, grid: { color: "rgba(255,255,255,0.06)" }, ticks: { color: "#8b899d" } },
      },
    },
  });

  if (ctx1) {
    if (productivityChartInstance) productivityChartInstance.destroy();
    productivityChartInstance = new Chart(ctx1, config(ctx1));
  }
  if (ctx2) {
    if (progressChartInstance) progressChartInstance.destroy();
    progressChartInstance = new Chart(ctx2, config(ctx2));
  }
}

/* Heatmap (GitHub-style, last ~12 weeks) */
function renderHeatmap() {
  const containers = [$("#heatmap"), $("#heatmap-2")];
  const weeks = 12;
  const totalDays = weeks * 7;

  containers.forEach((container) => {
    if (!container) return;
    container.innerHTML = "";
    for (let i = totalDays - 1; i >= 0; i--) {
      const key = todayKey(-i);
      const level = state.activityHistory[key] || 0;
      const cell = document.createElement("div");
      cell.className = `heat-cell heat-${level}`;
      cell.title = `${key}: level ${level}`;
      container.appendChild(cell);
    }
  });
}

/* ==========================================================================
   15. UI UTILITIES (toasts, confirm modal, view switching)
   ========================================================================== */
function showToast(message, type = "info") {
  const icons = { success: "fa-circle-check", error: "fa-circle-exclamation", info: "fa-circle-info" };
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${escapeHtml(message)}</span>`;
  el.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("removing");
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

let pendingConfirmAction = null;
function confirmAction(title, body, onConfirm) {
  el.confirmTitle.textContent = title;
  el.confirmBody.textContent = body;
  pendingConfirmAction = onConfirm;
  el.confirmModal.classList.remove("hidden");
}
el.confirmOk.addEventListener("click", () => {
  if (pendingConfirmAction) pendingConfirmAction();
  el.confirmModal.classList.add("hidden");
  pendingConfirmAction = null;
});
el.confirmCancel.addEventListener("click", () => {
  el.confirmModal.classList.add("hidden");
  pendingConfirmAction = null;
});
el.confirmModal.addEventListener("click", (e) => { if (e.target === el.confirmModal) el.confirmCancel.click(); });

function switchView(viewName) {
  el.views.forEach((v) => v.classList.toggle("active", v.id === `view-${viewName}`));
  el.navItems.forEach((n) => n.classList.toggle("active", n.dataset.view === viewName));
  el.bnItems.forEach((n) => n.classList.toggle("active", n.dataset.view === viewName));
  el.sidebar.classList.remove("open");
  if (viewName === "planner") renderPlanner();
  if (viewName === "progress" || viewName === "dashboard") { renderProductivityChart(); renderHeatmap(); }
}

/* ==========================================================================
   16. EVENT LISTENERS
   ========================================================================== */
[...el.navItems, ...el.bnItems].forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

el.sidebarToggle.addEventListener("click", () => el.sidebar.classList.toggle("open"));

$("#clear-all-data").addEventListener("click", () => {
  confirmAction("Clear all data?", "Every task, planner entry, and stat will be permanently deleted from this browser.", () => {
    Object.values(STORE_KEYS).forEach((k) => deleteData(k));
    showToast("All data cleared. Reloading…", "info");
    setTimeout(() => window.location.reload(), 900);
  });
});

/* ==========================================================================
   17. INITIALIZATION
   ========================================================================== */
function init() {
  $("#settings-city").value = state.prefs.city || "";
  tickClock();
  renderTasks();
  renderPlanner();
  renderWorkingList();
  renderPomo();
  loadDailyQuote();
  loadWeather();
  refreshAllStats();
}

document.addEventListener("DOMContentLoaded", init);
