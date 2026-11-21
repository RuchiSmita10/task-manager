/* Thin wrapper around fetch() for the REST API. */
class ApiError extends Error {
  constructor(message, status, errors = []) {
    super(message);
    this.status = status;
    this.errors = errors; // [{field, message}]
  }
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(window.APP_CONFIG.API_BASE + path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch (_) {
    throw new ApiError("Cannot reach the server. Check that the backend is running.", 0);
  }

  if (response.status === 204) return null;

  let body = null;
  try { body = await response.json(); } catch (_) { /* non-JSON body */ }

  if (!response.ok) {
    throw new ApiError(body?.detail || `Request failed (${response.status}).`, response.status, body?.errors || []);
  }
  return body;
}

const api = {
  list: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
    const q = qs.toString();
    return request(`/tasks${q ? "?" + q : ""}`);
  },
  stats: () => request("/tasks/stats"),
  get: (id) => request(`/tasks/${id}`),
  create: (data) => request("/tasks", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => request(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  patch: (id, data) => request(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id) => request(`/tasks/${id}`, { method: "DELETE" }),
};
