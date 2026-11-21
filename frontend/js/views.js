/* Screen renderers: Dashboard, Task List, Create/Edit form, Task Details. */
const app = document.getElementById("app");

async function confirmAndDelete(id, onDone) {
  if (!confirm("Delete this task? This cannot be undone.")) return;
  try {
    await api.remove(id);
    toast("Task deleted.");
    onDone();
  } catch (e) {
    toast(e.message, "error");
  }
}

// Shared by dashboard + list: status dropdown and delete buttons on cards.
function wireCardActions(container, reload) {
  container.querySelectorAll(".status-select").forEach((sel) =>
    sel.addEventListener("change", async () => {
      sel.disabled = true;
      try {
        await api.patch(sel.dataset.id, { status: sel.value });
        toast(`Status changed to "${sel.value}".`);
        reload();
      } catch (e) {
        toast(e.message, "error");
        sel.disabled = false;
        reload();
      }
    })
  );
  container.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => confirmAndDelete(btn.dataset.delete, reload))
  );
}

/* ---------------- Dashboard ---------------- */
async function renderDashboard() {
  app.innerHTML = loadingView("Loading dashboard…");
  try {
    const [stats, recent] = await Promise.all([api.stats(), api.list({ sort: "newest", limit: 5 })]);
    const card = (label, value, cls, href) =>
      `<a class="stat ${cls}" href="${href}"><span class="stat-value">${value}</span><span class="stat-label">${label}</span></a>`;
    app.innerHTML = `
      <div class="page-head"><h1>Dashboard</h1>
        <a class="btn btn-primary" href="#/tasks/new">+ New Task</a></div>
      <section class="stats">
        ${card("Total", stats.total, "stat-total", "#/tasks")}
        ${card("Pending", stats.pending, "stat-pending", "#/tasks?status=Pending")}
        ${card("In Progress", stats.in_progress, "stat-progress", "#/tasks?status=In Progress")}
        ${card("Completed", stats.completed, "stat-done", "#/tasks?status=Completed")}
      </section>
      ${stats.overdue ? `<p class="notice">&#9888; You have <strong>${stats.overdue}</strong> overdue task${stats.overdue > 1 ? "s" : ""}.</p>` : ""}
      <div class="page-head"><h2>Recent tasks</h2><a href="#/tasks">View all &rarr;</a></div>
      <section id="recent">
        ${recent.items.length
          ? recent.items.map((t) => taskCard(t)).join("")
          : emptyView("No tasks yet", "Create your first task to get started.", `<a class="btn btn-primary" href="#/tasks/new">+ New Task</a>`)}
      </section>`;
    wireCardActions(app, renderDashboard);
  } catch (e) {
    app.innerHTML = errorView(e.message);
    document.getElementById("retryBtn").onclick = renderDashboard;
  }
}

/* ---------------- Task List ---------------- */
const listState = { search: "", status: "", priority: "", sort: "newest" };

async function renderTaskList(query = {}) {
  // Allow dashboard links like #/tasks?status=Pending
  if (query.status !== undefined) { Object.assign(listState, { search: "", priority: "", status: query.status }); }

  app.innerHTML = `
    <div class="page-head"><h1>Tasks</h1><a class="btn btn-primary" href="#/tasks/new">+ New Task</a></div>
    <form class="filters" id="filters" onsubmit="return false">
      <input type="search" id="fSearch" placeholder="Search title or description…" value="${esc(listState.search)}" aria-label="Search tasks" />
      <select id="fStatus" aria-label="Filter by status"><option value="">All statuses</option>${options(STATUSES, listState.status)}</select>
      <select id="fPriority" aria-label="Filter by priority"><option value="">All priorities</option>${options(PRIORITIES, listState.priority)}</select>
      <select id="fSort" aria-label="Sort tasks">
        ${[["newest", "Newest first"], ["oldest", "Oldest first"], ["due_date", "Due date"], ["title", "Title A–Z"]]
          .map(([v, l]) => `<option value="${v}" ${listState.sort === v ? "selected" : ""}>${l}</option>`).join("")}
      </select>
      <button type="button" class="btn" id="fClear">Clear</button>
    </form>
    <p id="count" class="muted"></p>
    <section id="list"></section>`;

  const listEl = document.getElementById("list");
  const countEl = document.getElementById("count");

  async function load() {
    listEl.innerHTML = loadingView("Loading tasks…");
    try {
      const { items, total } = await api.list(listState);
      const filtered = listState.search || listState.status || listState.priority;
      countEl.textContent = `${total} task${total === 1 ? "" : "s"}${filtered ? " found" : ""}`;
      listEl.innerHTML = items.length
        ? items.map((t) => taskCard(t)).join("")
        : filtered
          ? emptyView("No matching tasks", "Try changing or clearing your filters.")
          : emptyView("No tasks yet", "Create your first task to get started.", `<a class="btn btn-primary" href="#/tasks/new">+ New Task</a>`);
      wireCardActions(listEl, load);
    } catch (e) {
      countEl.textContent = "";
      listEl.innerHTML = errorView(e.message);
      document.getElementById("retryBtn").onclick = load;
    }
  }

  const bind = (id, key, evt = "change") =>
    document.getElementById(id).addEventListener(evt, (ev) => { listState[key] = ev.target.value; load(); });
  bind("fStatus", "status");
  bind("fPriority", "priority");
  bind("fSort", "sort");
  document.getElementById("fSearch").addEventListener("input", debounce((ev) => { listState.search = ev.target.value; load(); }));
  document.getElementById("fClear").addEventListener("click", () => {
    Object.assign(listState, { search: "", status: "", priority: "", sort: "newest" });
    renderTaskList();
  });
  load();
}

/* ---------------- Create / Edit form ---------------- */
function validateTaskForm(v) {
  const errors = {};
  if (!v.title.trim()) errors.title = "Title is required.";
  else if (v.title.length > 150) errors.title = "Title must be 150 characters or fewer.";
  if (v.description.length > 2000) errors.description = "Description must be 2000 characters or fewer.";
  if (v.due_date && isNaN(new Date(v.due_date))) errors.due_date = "Enter a valid date.";
  return errors;
}

async function renderTaskForm(id = null) {
  const editing = id !== null;
  let task = { title: "", description: "", status: "Pending", priority: "Medium", due_date: "" };

  if (editing) {
    app.innerHTML = loadingView("Loading task…");
    try { task = await api.get(id); }
    catch (e) {
      app.innerHTML = e.status === 404 ? emptyView("Task not found", "It may have been deleted.", `<a class="btn" href="#/tasks">Back to tasks</a>`) : errorView(e.message);
      const r = document.getElementById("retryBtn"); if (r) r.onclick = () => renderTaskForm(id);
      return;
    }
  }

  app.innerHTML = `
    <div class="page-head"><h1>${editing ? "Edit task" : "New task"}</h1></div>
    <form id="taskForm" class="form card" novalidate>
      <div class="field"><label for="title">Title <span class="req">*</span></label>
        <input id="title" name="title" maxlength="150" value="${esc(task.title)}" required />
        <small class="err" data-err="title"></small></div>
      <div class="field"><label for="description">Description</label>
        <textarea id="description" name="description" rows="5" maxlength="2000">${esc(task.description)}</textarea>
        <small class="err" data-err="description"></small></div>
      <div class="row">
        <div class="field"><label for="status">Status</label><select id="status" name="status">${options(STATUSES, task.status)}</select></div>
        <div class="field"><label for="priority">Priority</label><select id="priority" name="priority">${options(PRIORITIES, task.priority)}</select></div>
        <div class="field"><label for="due_date">Due date</label><input type="date" id="due_date" name="due_date" value="${esc(task.due_date || "")}" />
          <small class="err" data-err="due_date"></small></div>
      </div>
      <small class="err form-err" id="formErr"></small>
      <div class="form-actions">
        <button class="btn btn-primary" type="submit" id="saveBtn">${editing ? "Save changes" : "Create task"}</button>
        <a class="btn" href="${editing ? "#/tasks/" + id : "#/tasks"}">Cancel</a>
      </div>
    </form>`;

  const form = document.getElementById("taskForm");
  const showErrors = (errs, general = "") => {
    form.querySelectorAll("[data-err]").forEach((el) => (el.textContent = errs[el.dataset.err] || ""));
    document.getElementById("formErr").textContent = general;
  };

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const errs = validateTaskForm(data);
    if (Object.keys(errs).length) return showErrors(errs);
    showErrors({});

    const payload = { ...data, title: data.title.trim(), description: data.description.trim() || null, due_date: data.due_date || null };
    const btn = document.getElementById("saveBtn");
    btn.disabled = true; btn.textContent = "Saving…";
    try {
      const saved = editing ? await api.update(id, payload) : await api.create(payload);
      toast(editing ? "Task updated." : "Task created.");
      location.hash = `#/tasks/${saved.id}`;
    } catch (e) {
      const fieldErrs = {};
      (e.errors || []).forEach((x) => (fieldErrs[x.field] = x.message));
      showErrors(fieldErrs, Object.keys(fieldErrs).length ? "" : e.message);
      toast(e.message, "error");
      btn.disabled = false; btn.textContent = editing ? "Save changes" : "Create task";
    }
  });
}

/* ---------------- Task Details ---------------- */
async function renderTaskDetails(id) {
  app.innerHTML = loadingView("Loading task…");
  try {
    const t = await api.get(id);
    app.innerHTML = `
      <a class="back" href="#/tasks">&larr; Back to tasks</a>
      <article class="card detail ${isOverdue(t) ? "overdue" : ""}">
        <h1>${esc(t.title)}</h1>
        <div class="task-meta">${badge("status", t.status)}${badge("priority", t.priority)}</div>
        <h3>Description</h3>
        <p class="detail-desc">${t.description ? esc(t.description) : '<span class="muted">No description provided.</span>'}</p>
        <dl class="info">
          <div><dt>Due date</dt><dd class="${isOverdue(t) ? "due-overdue" : ""}">${esc(formatDate(t.due_date))}${isOverdue(t) ? " (overdue)" : ""}</dd></div>
          <div><dt>Created</dt><dd>${esc(formatDateTime(t.created_at))}</dd></div>
          <div><dt>Last updated</dt><dd>${esc(formatDateTime(t.updated_at))}</dd></div>
          <div><dt>Task ID</dt><dd>#${t.id}</dd></div>
        </dl>
        <div class="form-actions">
          <a class="btn btn-primary" href="#/tasks/${t.id}/edit">Edit</a>
          <button class="btn btn-danger" id="delBtn">Delete</button>
        </div>
      </article>`;
    document.getElementById("delBtn").onclick = () => confirmAndDelete(id, () => (location.hash = "#/tasks"));
  } catch (e) {
    if (e.status === 404) {
      app.innerHTML = emptyView("Task not found", "It may have been deleted.", `<a class="btn" href="#/tasks">Back to tasks</a>`);
    } else {
      app.innerHTML = errorView(e.message);
      document.getElementById("retryBtn").onclick = () => renderTaskDetails(id);
    }
  }
}
