# Productivity Dashboard

A dark, glassmorphic productivity dashboard built with plain **HTML, CSS, and vanilla JavaScript** — no frameworks, no build step. Open `index.html` in a browser and it works.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure: sidebar nav, header, all 7 views, and modal markup |
| `style.css` | Design tokens (CSS variables) and all styling, including responsive breakpoints |
| `script.js` | All application logic, organized into 17 numbered sections |
| `README.md` | This file |

Everything runs client-side. There is no backend, no server, no build tools — just open `index.html`.

---

## How data persists (localStorage)

The app stores everything in the browser's `localStorage` under these keys (see `STORE_KEYS` in `script.js`):

- `tasks` — the full todo list (array of task objects)
- `planner` — day-planner entries, keyed by date then time slot
- `working` — today's working-list items, keyed by date
- `pomo_stats` — completed Pomodoro count per day
- `quote_cache` — today's cached motivational quote
- `productivity_history` — a daily snapshot of tasks/pomodoros/score, used for the 7-day chart
- `activity_history` — a 0–4 "activity level" per day, used for the heatmap and streaks
- `weather_city` / `nexus_prefs` — your saved city and other preferences

Three helper functions wrap all of this so the rest of the code never touches `localStorage` directly:

```js
saveData(key, value)              // JSON.stringify + localStorage.setItem, wrapped in try/catch
loadData(key, fallback)           // JSON.parse + localStorage.getItem, returns fallback on any error
deleteData(key)                   // localStorage.removeItem
updateData(key, updaterFn, fallback) // load -> transform -> save, in one call
```

Because everything lives only in your browser, clearing your browser data (or using a different browser/device) resets the dashboard. **Settings → Clear All Data** wipes it manually, with a confirmation step first.

---

## How each feature works

### Header: greeting, clock, weather
`tickClock()` runs every second. It renders `HH:MM:SS`, the full date, and calls `updateGreeting()`, which picks "Good morning / afternoon / evening / night" purely from `Date().getHours()` — no localStorage needed since it's always computed live.

Weather calls OpenWeatherMap's REST API using `fetch()`. **No key ships in this code.** Open `script.js` and look for:

```js
const CONFIG = {
  WEATHER_API_KEY: "", // <- put your own free key here
  ...
};
```

Get a free key at openweathermap.org, paste it in, and set a city under **Settings**. Until then the chip simply reads "Weather unavailable" — this is intentional, not a bug.

### Todo list
Tasks are plain objects:
```js
{ id, title, category, priority, completed, important, createdAt, dueTime }
```
Add/Edit uses one shared modal (`#task-modal`); the form's hidden `#task-id` field tells the submit handler whether to push a new task or `Object.assign` an existing one. The task list itself uses **event delegation** — a single click listener on `#task-list` reads `data-action` off whichever button was clicked (toggle complete, star/important, edit, delete), so no per-row listeners are ever attached. Search and the three filter dropdowns just re-run `renderTasks()`, which filters `state.tasks` in memory and re-paints the DOM.

### Day Planner
A grid of fixed hourly slots (06:00–22:00, configurable via `CONFIG.PLANNER_HOURS`). Each day's entries live under `nexus_planner[today][slot] = { activity, completed }`. The current hour's row gets a `.current-slot` highlight, recalculated every second by the same clock tick. A short "Up Next" preview of the rest of today's schedule also appears on the main Dashboard view.

### Pomodoro Timer
A small state machine (`pomo.mode`, `pomo.secondsLeft`, `pomo.running`) driven by `setInterval`. The circular countdown is an SVG `<circle>` whose `stroke-dashoffset` is animated as time elapses — no images, no canvas. Every 4th completed **work** session automatically routes to a long break instead of a short one; completed work sessions are tallied per day in `nexus_pomo_stats` and feed directly into today's productivity score and the activity heatmap.

### Today's Working List
Simpler than the todo list: each item just has a name, priority, and a progress percentage you set in fixed steps (0/25/50/75/100%) via quick buttons. The card at the top averages every item's progress into one overall bar. Reaching 100% on an item counts as a productive action for the streak/heatmap.

### Daily Motivation
On load, `loadDailyQuote()` checks `nexus_quote_cache` for today's date. If a quote is already cached for today, it's reused — you'll see the same quote all day, even after refreshing, unless you click the refresh icon. Otherwise it calls `https://api.quotable.io/random`; if that request fails (offline, API down, CORS, etc.) it falls back to a small local array (`FALLBACK_QUOTES`) so the card never breaks.

### Productivity chart & Activity heatmap
Every time stats are recalculated, `refreshAllStats()` writes a snapshot for *today* into `nexus_productivity_history` (`{ tasks, pomodoros, score }`). The 7-day bar chart (Chart.js, loaded from CDN) simply reads the last 7 days of that history.

The heatmap is a hand-rolled CSS grid (no chart library) with 12 weeks × 7 days of `<div>` cells, colored by an activity level 0–4 stored in `nexus_activity_history`. Any productive action — completing a task, finishing a Pomodoro, or hitting 100% on a working-list item — calls `recordActivity()`, which bumps that day's level (capped at 4).

### Streaks
`computeStreak()` walks backward from today counting consecutive days with activity level > 0 for the **current streak**, and scans the full sorted history for the **longest streak** and **total productive days**. This runs on every stat refresh, so the sidebar streak pill, the stat card, and both heatmap headers always agree.

---

## Code organization

`script.js` is deliberately laid out in the same 17 sections regardless of feature, so anything is easy to find:

```
1. Config              7. Day Planner            13. Streak calculation
2. DOM selectors        8. Today's Work           14. Charts
3. LocalStorage         9. Pomodoro               15. UI utilities
4. Clock               10. Motivation API         16. Event listeners
5. Greeting            11. Weather API            17. Initialization
6. Todo                12. Productivity stats
```

## Design system

Colors, spacing, radii, and easing curves are defined once as CSS custom properties at the top of `style.css` (`:root { --violet: ...; --teal: ...; --sp-4: ...; }`), so the whole look can be re-themed by editing a handful of variables.

## Responsive behavior

- **Desktop (>900px):** fixed sidebar + multi-column card grid.
- **Tablet/mobile (≤900px):** the sidebar becomes an off-canvas panel (☰ button toggles it) and a bottom tab bar takes over primary navigation.
- **Small phones (≤560px):** stat cards drop to a 2-column grid, the Pomodoro ring shrinks, and toolbars stack vertically.

No horizontal scrolling occurs at any breakpoint except the intentionally horizontally-scrollable heatmap strip.

## Known limitations

- Weather requires you to supply your own API key (see above) — none is bundled.
- Data is per-browser/per-device; there's no sync or backend.
- The Quotable API call requires internet access; offline usage falls back to local quotes automatically.
