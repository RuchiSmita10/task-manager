/* Small reusable UI helpers. */
const STATUSES = ["Pending", "In Progress", "Completed"];
const PRIORITIES = ["Low", "Medium", "High"];

// Escape user text before inserting into innerHTML (prevents XSS).
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const slug = (s) => String(s).toLowerCase().replace(/\s+/g, "-");

function formatDate(iso) {
  if (!iso) return "No due date";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(iso) {
  // Server timestamps are naive; treat them as local-server time and display as-is.
  const d = new Date(iso);
  return isNaN(d) ? "—" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const isOverdue = (task) => task.due_date && task.status !== "Completed" && task.due_date < todayISO();

const badge = (kind, value) => `<span class="badge badge-${kind}-${slug(value)}">${esc(value)}</span>`;

function options(list, selected) {
  return list.map((v) => `<option value="${esc(v)}" ${v === selected ? "selected" : ""}>${esc(v)}</option>`).join("");
}

function toast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = message;
  document.getElementById("toasts").appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

const loadingView = (text = "Loading…") =>
  `<div class="state"><div class="spinner" aria-hidden="true"></div><p>${esc(text)}</p></div>`;

const errorView = (message, retryId = "retryBtn") =>
  `<div class="state state-error"><p>&#9888; ${esc(message)}</p><button class="btn" id="${retryId}">Try again</button></div>`;

const emptyView = (title, text, action = "") =>
  `<div class="state"><div class="empty-icon" aria-hidden="true">&#128203;</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;

function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// Reusable task card used by dashboard and list.
function taskCard(task, { showActions = true } = {}) {
  return `
  <article class="task-card ${isOverdue(task) ? "overdue" : ""}" data-id="${task.id}">
    <div class="task-main">
      <a class="task-title" href="#/tasks/${task.id}">${esc(task.title)}</a>
      ${task.description ? `<p class="task-desc">${esc(task.description)}</p>` : ""}
      <div class="task-meta">
        ${badge("status", task.status)}
        ${badge("priority", task.priority)}
        <span class="due ${isOverdue(task) ? "due-overdue" : ""}">&#128197; ${esc(formatDate(task.due_date))}${isOverdue(task) ? " (overdue)" : ""}</span>
      </div>
    </div>
    ${showActions ? `
    <div class="task-actions">
      <select class="status-select" data-id="${task.id}" aria-label="Change status for ${esc(task.title)}">${options(STATUSES, task.status)}</select>
      <a class="btn btn-sm" href="#/tasks/${task.id}/edit">Edit</a>
      <button class="btn btn-sm btn-danger" data-delete="${task.id}">Delete</button>
    </div>` : ""}
  </article>`;
}
