const API_BASE_URL = window.location.origin.startsWith("file")
  ? "http://localhost:5000/api"
  : `${window.location.origin}/api`;
const KEY = "salon_super_token";
let token = localStorage.getItem(KEY);

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function toast(msg, type = "") {
  const t = document.getElementById("toast");
  t.textContent = msg; t.className = "toast show " + type;
  setTimeout(() => (t.className = "toast " + type), 3200);
}
async function api(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (res.status === 401) { logout(); throw new Error("Session expired. Please sign in again."); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Something went wrong");
  return data;
}
function logout() {
  localStorage.removeItem(KEY); token = null;
  document.getElementById("superMain").style.display = "none";
  document.getElementById("superLogin").style.display = "grid";
}
async function loadShops() {
  const wrap = document.getElementById("superTable");
  try {
    const shops = await api("/super/shops");
    if (!shops.length) { wrap.innerHTML = '<p class="empty-note">No salons are registered yet.</p>'; return; }
    wrap.innerHTML = `<table class="data-table"><thead><tr><th>Shop</th><th>Owner</th><th>Contact</th><th>Registered</th><th>Status</th></tr></thead><tbody>${shops.map((s) => `
      <tr>
        <td>${esc(s.name)}<br /><span class="muted">${esc(s.address)}</span></td>
        <td>${esc(s.ownerName)}</td>
        <td>${esc(s.phone)}<br /><span class="muted">${esc(s.email)}</span></td>
        <td class="muted">${new Date(s.createdAt).toLocaleDateString("en-IN")}</td>
        <td><select class="status-select status-${s.status === "approved" ? "confirmed" : s.status === "blocked" ? "cancelled" : "pending"}" data-id="${esc(s._id)}">
          ${["pending", "approved", "blocked"].map((x) => `<option value="${x}" ${s.status === x ? "selected" : ""}>${x}</option>`).join("")}
        </select></td>
      </tr>`).join("")}</tbody></table>`;
    wrap.querySelectorAll(".status-select").forEach((sel) => sel.addEventListener("change", async () => {
      try {
        await api(`/super/shops/${sel.dataset.id}/status`, { method: "PUT", body: JSON.stringify({ status: sel.value }) });
        toast("Status updated", "success");
        loadShops();
      } catch (err) { toast(err.message, "error"); loadShops(); }
    }));
  } catch (err) { wrap.innerHTML = '<p class="empty-note">Could not load data.</p>'; toast(err.message, "error"); }
}
function showMain() {
  document.getElementById("superLogin").style.display = "none";
  document.getElementById("superMain").style.display = "block";
  loadShops();
}
document.getElementById("superLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const box = document.getElementById("superError");
  box.style.display = "none";
  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: document.getElementById("superEmail").value.trim(), password: document.getElementById("superPass").value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Login failed");
    if (!data.admin || data.admin.role !== "superadmin") throw new Error("This account is not a super admin");
    token = data.token; localStorage.setItem(KEY, token);
    showMain();
  } catch (err) { box.textContent = err.message; box.style.display = "block"; }
});
document.getElementById("superLogout").addEventListener("click", logout);
if (token) showMain();
