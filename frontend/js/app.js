/* Hash router: #/ , #/tasks , #/tasks/new , #/tasks/:id , #/tasks/:id/edit */
function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, qs = ""] = raw.split("?");
  return { parts: path.split("/").filter(Boolean), query: Object.fromEntries(new URLSearchParams(qs)) };
}

function setActiveNav(route) {
  document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("active", a.dataset.route === route));
}

function router() {
  const { parts, query } = parseHash();
  document.getElementById("nav").classList.remove("open");
  window.scrollTo(0, 0);

  if (parts.length === 0) { setActiveNav("dashboard"); return renderDashboard(); }
  if (parts[0] === "tasks") {
    if (parts.length === 1) { setActiveNav("tasks"); return renderTaskList(query); }
    if (parts[1] === "new") { setActiveNav("new"); return renderTaskForm(); }
    const id = Number(parts[1]);
    if (Number.isInteger(id) && id > 0) {
      setActiveNav("tasks");
      return parts[2] === "edit" ? renderTaskForm(id) : renderTaskDetails(id);
    }
  }
  setActiveNav("");
  app.innerHTML = emptyView("Page not found", "The page you are looking for does not exist.", `<a class="btn" href="#/">Go to dashboard</a>`);
}

window.addEventListener("hashchange", router);
document.getElementById("menuBtn").addEventListener("click", (e) => {
  const open = document.getElementById("nav").classList.toggle("open");
  e.currentTarget.setAttribute("aria-expanded", open);
});
router();
