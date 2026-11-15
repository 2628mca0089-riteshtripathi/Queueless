// ============================================
// CONFIG
// ============================================
const API_BASE_URL = window.location.origin.startsWith("file")
  ? "http://localhost:5000/api"
  : `${window.location.origin}/api`;

// ============================================
// STATE
// ============================================
let token = localStorage.getItem("salon_admin_token");
let allServices = [];
let allStylists = [];
let editingServiceId = null;
let editingStylistId = null;
let selectedWeeklyOff = [];
let lastAppts = [];
let holidays = [];

// ============================================
// HELPERS
// ============================================
function showToast(message, type = "") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = "toast show " + type;
  setTimeout(() => (toast.className = "toast " + type), 3200);
}

function setMsg(id, text, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text || "";
  el.className = "form-msg" + (text ? " show " + (type || "") : "");
  if (text && type === "success") setTimeout(() => { if (el.textContent === text) setMsg(id, ""); }, 6000);
}
function formatMoney(n) {
  return "₹" + Number(n).toLocaleString("en-IN");
}
function formatTime12h(t) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}
function formatDatePretty(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function localDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function apiCall(path, options = {}) {
  const adminInfo = JSON.parse(localStorage.getItem("salon_admin_info") || "{}");
  if ((path.startsWith("/services") || path.startsWith("/stylists")) && adminInfo.shopId) {
    const separator = path.includes("?") ? "&" : "?";
    path += `${separator}shopId=${encodeURIComponent(adminInfo.shopId)}`;
  }
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    logout();
    throw new Error("Session expired. Kripya dobara login karein.");
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Something went wrong");
  return data;
}

// ============================================
// AUTH
// ============================================
function showDashboard() {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("adminShell").classList.add("active");
  loadOverview();
  loadProfile();
}
function showLogin() {
  document.getElementById("loginScreen").style.display = "grid";
  document.getElementById("adminShell").classList.remove("active");
}
function logout() {
  localStorage.removeItem("salon_admin_token");
  localStorage.removeItem("salon_admin_info");
  token = null;
  showLogin();
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById("loginError");
  errorBox.style.display = "none";

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Login failed");

    if (data.admin && data.admin.role === "superadmin") {
      localStorage.setItem("salon_super_token", data.token);
      window.location.href = "super.html";
      return;
    }
    token = data.token;
    localStorage.setItem("salon_admin_token", token);
    localStorage.setItem("salon_admin_info", JSON.stringify(data.admin));
    showDashboard();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.style.display = "block";
  }
});

document.getElementById("logoutBtn").addEventListener("click", logout);

if (token) showDashboard();
else showLogin();

// ============================================
// NAV SWITCHING
// ============================================
document.getElementById("adminNav").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-view]");
  if (!btn) return;
  document.querySelectorAll(".admin-nav button").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  document.querySelectorAll(".admin-view").forEach((v) => v.classList.remove("active"));
  document.querySelector(`.admin-view[data-view="${btn.dataset.view}"]`).classList.add("active");

  if (btn.dataset.view === "overview") loadOverview();
  if (btn.dataset.view === "appointments") loadAppointments();
  if (btn.dataset.view === "services") loadServicesAdmin();
  if (btn.dataset.view === "stylists") loadStylistsAdmin();
  if (btn.dataset.view === "profile") loadProfile();
});

// ============================================
// OVERVIEW
// ============================================
async function loadOverview() {
  try {
    loadStats();
    const [appts, services, stylists] = await Promise.all([
      apiCall("/appointments"),
      apiCall("/services?all=true"),
      apiCall("/stylists?all=true"),
    ]);

    const todayStr = localDateStr();
    const todayAppts = appts.filter((a) => a.date === todayStr && a.status !== "cancelled");
    const pending = appts.filter((a) => a.status === "pending");

    document.getElementById("statToday").textContent = todayAppts.length;
    document.getElementById("statPending").textContent = pending.length;
    document.getElementById("statTotalServices").textContent = services.filter((s) => s.isActive).length;
    document.getElementById("statTotalStylists").textContent = stylists.filter((s) => s.isActive).length;

    const wrap = document.getElementById("todayTableWrap");
    if (todayAppts.length === 0) {
      wrap.innerHTML = `<p class="empty-note">Aaj koi appointment schedule nahi hai.</p>`;
      return;
    }
    wrap.innerHTML = buildApptTable(todayAppts.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot)));
    attachApptTableEvents(wrap);
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ============================================
// APPOINTMENTS
// ============================================
async function loadAppointments() {
  const wrap = document.getElementById("apptTableWrap");
  wrap.innerHTML = `<p class="empty-note">Loading…</p>`;

  const date = document.getElementById("filterDate").value;
  const status = document.getElementById("filterStatus").value;
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (status) params.set("status", status);
  const q = document.getElementById("searchBox").value.trim();
  if (q) params.set("q", q);

  try {
    const appts = await apiCall(`/appointments?${params.toString()}`);
    lastAppts = appts;
    if (appts.length === 0) {
      wrap.innerHTML = `<p class="empty-note">Koi appointment nahi mila.</p>`;
      return;
    }
    wrap.innerHTML = buildApptTable(appts);
    attachApptTableEvents(wrap);
  } catch (err) {
    wrap.innerHTML = `<p class="empty-note">Load nahi ho paya.</p>`;
    showToast(err.message, "error");
  }
}

function buildApptTable(appts) {
  return `
  <table class="data-table">
    <thead>
      <tr><th>Customer</th><th>Service</th><th>Stylist</th><th>Date &amp; Time</th><th>Status</th><th></th></tr>
    </thead>
    <tbody>
      ${appts
        .map(
          (a) => `
        <tr>
          <td>${esc(a.customerName)}<br /><span class="muted">${esc(a.customerPhone)}</span></td>
          <td>${a.service ? a.service.name : "—"}<br /><span class="muted">${a.service ? formatMoney(a.service.price) : ""}</span></td>
          <td>${a.stylist ? a.stylist.name : "—"}</td>
          <td>${formatDatePretty(a.date)}<br /><span class="muted">${formatTime12h(a.timeSlot)}</span></td>
          <td>
            <select class="status-select status-${a.status}" data-id="${a._id}">
              <option value="pending" ${a.status === "pending" ? "selected" : ""}>Pending</option>
              <option value="confirmed" ${a.status === "confirmed" ? "selected" : ""}>Confirmed</option>
              <option value="completed" ${a.status === "completed" ? "selected" : ""}>Completed</option>
              <option value="cancelled" ${a.status === "cancelled" ? "selected" : ""}>Cancelled</option>
            </select>
          </td>
          <td><button class="icon-btn" data-delete="${a._id}">Delete</button></td>
        </tr>`
        )
        .join("")}
    </tbody>
  </table>`;
}

function attachApptTableEvents(wrap) {
  wrap.querySelectorAll(".status-select").forEach((sel) => {
    sel.addEventListener("change", async () => {
      const prevClass = sel.className;
      try {
        await apiCall(`/appointments/${sel.dataset.id}/status`, {
          method: "PUT",
          body: JSON.stringify({ status: sel.value }),
        });
        sel.className = `status-select status-${sel.value}`;
        showToast("Status update ho gaya", "success");
      } catch (err) {
        sel.className = prevClass;
        showToast(err.message, "error");
      }
    });
  });

  wrap.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Ye appointment permanently delete karein?")) return;
      try {
        await apiCall(`/appointments/${btn.dataset.delete}`, { method: "DELETE" });
        showToast("Appointment delete ho gaya", "success");
        btn.closest("tr").remove();
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  });
}

document.getElementById("filterDate").addEventListener("change", loadAppointments);
document.getElementById("filterStatus").addEventListener("change", loadAppointments);
document.getElementById("clearFilters").addEventListener("click", () => {
  document.getElementById("filterDate").value = "";
  document.getElementById("filterStatus").value = "";
  document.getElementById("searchBox").value = "";
  loadAppointments();
});

// ============================================
// SERVICES (admin CRUD)
// ============================================
async function loadServicesAdmin() {
  const wrap = document.getElementById("serviceTableWrap");
  wrap.innerHTML = `<p class="empty-note">Loading…</p>`;
  try {
    allServices = await apiCall("/services?all=true");
    if (allServices.length === 0) {
      wrap.innerHTML = `<p class="empty-note">Abhi koi service nahi hai. Form se add karein.</p>`;
      return;
    }
    wrap.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Duration</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${allServices
          .map(
            (s) => `
          <tr>
            <td>${esc(s.name)}</td>
            <td class="muted">${esc(s.category)}</td>
            <td>${formatMoney(s.price)}</td>
            <td class="muted">${s.durationMinutes} mins</td>
            <td class="muted">${s.isActive ? "Active" : "Hidden"}</td>
            <td style="white-space:nowrap;">
              <button class="icon-btn" data-edit="${s._id}">Edit</button>
              <button class="icon-btn" data-delete="${s._id}">Delete</button>
            </td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;

    wrap.querySelectorAll("[data-edit]").forEach((btn) =>
      btn.addEventListener("click", () => editService(btn.dataset.edit))
    );
    wrap.querySelectorAll("[data-delete]").forEach((btn) =>
      btn.addEventListener("click", () => deleteService(btn.dataset.delete))
    );
  } catch (err) {
    wrap.innerHTML = `<p class="empty-note">Load nahi ho paya.</p>`;
    showToast(err.message, "error");
  }
}

function editService(id) {
  const s = allServices.find((x) => x._id === id);
  if (!s) return;
  editingServiceId = id;
  document.getElementById("serviceFormTitle").textContent = "Edit service";
  document.getElementById("serviceId").value = id;
  document.getElementById("serviceName").value = s.name;
  document.getElementById("serviceCategory").value = s.category;
  document.getElementById("serviceDuration").value = s.durationMinutes;
  document.getElementById("servicePrice").value = s.price;
  document.getElementById("serviceDescription").value = s.description || "";
  document.getElementById("serviceActive").checked = s.isActive;
  document.getElementById("serviceCancelEdit").style.display = "inline-flex";
  document.querySelector('.panel h3#serviceFormTitle').scrollIntoView({ behavior: "smooth", block: "center" });
}

async function deleteService(id) {
  if (!confirm("Ye service delete karein?")) return;
  try {
    await apiCall(`/services/${id}`, { method: "DELETE" });
    showToast("Service delete ho gayi", "success");
    loadServicesAdmin();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function resetServiceForm() {
  editingServiceId = null;
  document.getElementById("serviceForm").reset();
  document.getElementById("serviceId").value = "";
  document.getElementById("serviceFormTitle").textContent = "Add a service";
  document.getElementById("serviceCancelEdit").style.display = "none";
}
document.getElementById("serviceCancelEdit").addEventListener("click", resetServiceForm);

document.getElementById("serviceForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    name: document.getElementById("serviceName").value.trim(),
    category: document.getElementById("serviceCategory").value,
    durationMinutes: Number(document.getElementById("serviceDuration").value),
    price: Number(document.getElementById("servicePrice").value),
    description: document.getElementById("serviceDescription").value.trim(),
    isActive: document.getElementById("serviceActive").checked,
  };
  try {
    if (editingServiceId) {
      await apiCall(`/services/${editingServiceId}`, { method: "PUT", body: JSON.stringify(payload) });
      showToast("Service update ho gayi", "success");
    } else {
      await apiCall("/services", { method: "POST", body: JSON.stringify(payload) });
      showToast("Service add ho gayi", "success");
    }
    resetServiceForm();
    loadServicesAdmin();
  } catch (err) {
    showToast(err.message, "error");
  }
});

// ============================================
// STYLISTS (admin CRUD)
// ============================================
async function loadStylistsAdmin() {
  const wrap = document.getElementById("stylistTableWrap");
  wrap.innerHTML = `<p class="empty-note">Loading…</p>`;
  try {
    allStylists = await apiCall("/stylists?all=true");
    if (allStylists.length === 0) {
      wrap.innerHTML = `<p class="empty-note">Abhi koi stylist nahi hai. Form se add karein.</p>`;
      return;
    }
    wrap.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Name</th><th>Specialty</th><th>Hours</th><th>Off day</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${allStylists
          .map(
            (s) => `
          <tr>
            <td>${esc(s.name)}</td>
            <td class="muted">${esc(s.specialty)}</td>
            <td class="muted">${formatTime12h(s.workStart)} – ${formatTime12h(s.workEnd)}</td>
            <td class="muted">${s.weeklyOff.map((d) => DAY_NAMES[d]).join(", ") || "None"}</td>
            <td class="muted">${s.isActive ? "Active" : "Hidden"}</td>
            <td style="white-space:nowrap;">
              <button class="icon-btn" data-edit="${s._id}">Edit</button>
              <button class="icon-btn" data-delete="${s._id}">Delete</button>
            </td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;

    wrap.querySelectorAll("[data-edit]").forEach((btn) =>
      btn.addEventListener("click", () => editStylist(btn.dataset.edit))
    );
    wrap.querySelectorAll("[data-delete]").forEach((btn) =>
      btn.addEventListener("click", () => deleteStylist(btn.dataset.delete))
    );
  } catch (err) {
    wrap.innerHTML = `<p class="empty-note">Load nahi ho paya.</p>`;
    showToast(err.message, "error");
  }
}

function setWeeklyOffChips(days) {
  selectedWeeklyOff = [...days];
  document.querySelectorAll(".day-chip").forEach((chip) => {
    chip.classList.toggle("selected", selectedWeeklyOff.includes(Number(chip.dataset.day)));
  });
}

document.getElementById("weeklyOffChips").addEventListener("click", (e) => {
  const chip = e.target.closest(".day-chip");
  if (!chip) return;
  const day = Number(chip.dataset.day);
  if (selectedWeeklyOff.includes(day)) {
    selectedWeeklyOff = selectedWeeklyOff.filter((d) => d !== day);
  } else {
    selectedWeeklyOff.push(day);
  }
  chip.classList.toggle("selected");
});

function editStylist(id) {
  const s = allStylists.find((x) => x._id === id);
  if (!s) return;
  editingStylistId = id;
  document.getElementById("stylistFormTitle").textContent = "Edit stylist";
  document.getElementById("stylistId").value = id;
  document.getElementById("stylistName").value = s.name;
  document.getElementById("stylistSpecialty").value = s.specialty;
  document.getElementById("stylistExperience").value = s.experienceYears;
  document.getElementById("stylistStart").value = s.workStart;
  document.getElementById("stylistEnd").value = s.workEnd;
  document.getElementById("stylistActive").checked = s.isActive;
  setWeeklyOffChips(s.weeklyOff || []);
  document.getElementById("stylistCancelEdit").style.display = "inline-flex";
  document.querySelector('.panel h3#stylistFormTitle').scrollIntoView({ behavior: "smooth", block: "center" });
}

async function deleteStylist(id) {
  if (!confirm("Ye stylist delete karein?")) return;
  try {
    await apiCall(`/stylists/${id}`, { method: "DELETE" });
    showToast("Stylist delete ho gaya", "success");
    loadStylistsAdmin();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function resetStylistForm() {
  editingStylistId = null;
  document.getElementById("stylistForm").reset();
  document.getElementById("stylistId").value = "";
  document.getElementById("stylistStart").value = "10:00";
  document.getElementById("stylistEnd").value = "19:00";
  document.getElementById("stylistFormTitle").textContent = "Add a stylist";
  document.getElementById("stylistCancelEdit").style.display = "none";
  setWeeklyOffChips([]);
}
document.getElementById("stylistCancelEdit").addEventListener("click", resetStylistForm);

document.getElementById("stylistForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    name: document.getElementById("stylistName").value.trim(),
    specialty: document.getElementById("stylistSpecialty").value.trim() || "Hair Stylist",
    experienceYears: Number(document.getElementById("stylistExperience").value) || 0,
    workStart: document.getElementById("stylistStart").value,
    workEnd: document.getElementById("stylistEnd").value,
    weeklyOff: selectedWeeklyOff,
    isActive: document.getElementById("stylistActive").checked,
  };
  try {
    if (editingStylistId) {
      await apiCall(`/stylists/${editingStylistId}`, { method: "PUT", body: JSON.stringify(payload) });
      showToast("Stylist update ho gaya", "success");
    } else {
      await apiCall("/stylists", { method: "POST", body: JSON.stringify(payload) });
      showToast("Stylist add ho gaya", "success");
    }
    resetStylistForm();
    loadStylistsAdmin();
  } catch (err) {
    showToast(err.message, "error");
  }
});

// ============================================
// PROFILE (shop details + password)
// ============================================
function applyShopToHeader(shop) {
  document.getElementById("dashboardShopName").textContent = shop.name;
  document.getElementById("dashboardShopAddress").textContent = shop.address;
  document.querySelector(".admin-sidebar .brand").lastChild.textContent = " " + shop.name;
}

async function loadProfile() {
  try {
    const shop = await apiCall("/shops/mine");
    applyShopToHeader(shop);
    document.getElementById("profShopName").value = shop.name || "";
    document.getElementById("profOwnerName").value = shop.ownerName || "";
    document.getElementById("profPhone").value = shop.phone || "";
    document.getElementById("profEmail").value = shop.email || "";
    document.getElementById("profAddress").value = shop.address || "";
    document.getElementById("profDescription").value = shop.description || "";
    document.getElementById("profOpen").value = shop.openTime || "";
    document.getElementById("profClose").value = shop.closeTime || "";
    holidays = [...(shop.holidays || [])];
    renderHolidays();
  } catch (err) {
    showToast(err.message, "error");
  }
}

document.getElementById("profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("profileMsg", "");
  const payload = {
    name: document.getElementById("profShopName").value.trim(),
    ownerName: document.getElementById("profOwnerName").value.trim(),
    phone: document.getElementById("profPhone").value.trim(),
    address: document.getElementById("profAddress").value.trim(),
    description: document.getElementById("profDescription").value.trim(),
    openTime: document.getElementById("profOpen").value,
    closeTime: document.getElementById("profClose").value,
    holidays,
  };
  try {
    const shop = await apiCall("/shops/mine", { method: "PUT", body: JSON.stringify(payload) });
    applyShopToHeader(shop);
    showToast("Profile update ho gaya", "success");
    setMsg("profileMsg", "Profile update ho gaya ✓", "success");
  } catch (err) {
    showToast(err.message, "error");
    setMsg("profileMsg", err.message, "error");
  }
});

document.getElementById("passwordForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("passwordMsg", "");
  const newPassword = document.getElementById("newPassword").value;
  if (newPassword !== document.getElementById("confirmPassword").value) {
    showToast("New password aur confirm password match nahi karte", "error");
    setMsg("passwordMsg", "New password aur confirm password match nahi karte", "error");
    return;
  }
  try {
    await apiCall("/auth/password", {
      method: "PUT",
      body: JSON.stringify({
        currentPassword: document.getElementById("curPassword").value,
        newPassword,
      }),
    });
    document.getElementById("passwordForm").reset();
    showToast("Password change ho gaya", "success");
    setMsg("passwordMsg", "Password change ho gaya ✓", "success");
  } catch (err) {
    showToast(err.message, "error");
    setMsg("passwordMsg", err.message, "error");
  }
});

document.getElementById("showLoginPass").addEventListener("change", (e) => {
  document.getElementById("loginPassword").type = e.target.checked ? "text" : "password";
});

// ============================================
// EARNINGS CHART + POPULAR SERVICES
// ============================================
async function loadStats() {
  const range = document.getElementById("statsRange").value;
  try {
    const st = await apiCall(`/appointments/stats?range=${range}`);
    document.getElementById("earnTotal").textContent = formatMoney(st.totalRevenue);
    document.getElementById("earnCount").textContent = st.completedCount;
    document.getElementById("earnExpected").textContent = formatMoney(st.expectedRevenue);

    const max = Math.max(...st.days.map((d) => d.revenue), 1);
    const step = st.days.length > 10 ? 5 : 1;
    document.getElementById("earnChart").innerHTML = st.days
      .map((d, i) => {
        const h = d.revenue > 0 ? Math.max((d.revenue / max) * 100, 3) : 0;
        const label = new Date(d.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
        return `<div class="bar-col" title="${esc(label)}: ${esc(formatMoney(d.revenue))} (${d.count} done)">
          <div class="bar-track"><div class="bar" style="height:${h}%"></div></div>
          <div class="bar-label">${i % step === 0 || i === st.days.length - 1 ? esc(label) : "&nbsp;"}</div>
        </div>`;
      })
      .join("");

    const list = document.getElementById("popularList");
    if (!st.topServices.length) {
      list.innerHTML = `<p class="empty-note">Is period me abhi koi booking nahi hai.</p>`;
      return;
    }
    const top = st.topServices[0].count;
    list.innerHTML = st.topServices
      .map(
        (s, i) => `<div class="pop-row">
          <div class="pop-top"><span>${i + 1}. ${esc(s.name)}</span><span class="muted">${s.count} booking${s.count > 1 ? "s" : ""}</span></div>
          <div class="pop-track"><div class="pop-fill" style="width:${(s.count / top) * 100}%"></div></div>
        </div>`
      )
      .join("");
  } catch (err) {
    showToast(err.message, "error");
  }
}
document.getElementById("statsRange").addEventListener("change", loadStats);

// ============================================
// HOLIDAYS, SEARCH, CSV EXPORT
// ============================================
function renderHolidays() {
  const wrap = document.getElementById("holidayChips");
  wrap.innerHTML = holidays.length
    ? holidays.map((d) => `<span class="holiday-chip">${esc(formatDatePretty(d))}<button type="button" data-rm="${esc(d)}" aria-label="Remove holiday">×</button></span>`).join("")
    : '<span class="muted-note">Koi holiday set nahi hai</span>';
}
document.getElementById("addHoliday").addEventListener("click", () => {
  const input = document.getElementById("holidayDate");
  if (!input.value) return showToast("Pehle date chunein", "error");
  if (!holidays.includes(input.value)) holidays = [...holidays, input.value].sort();
  input.value = "";
  renderHolidays();
});
document.getElementById("holidayChips").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-rm]");
  if (!btn) return;
  holidays = holidays.filter((d) => d !== btn.dataset.rm);
  renderHolidays();
});

let searchTimer;
document.getElementById("searchBox").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadAppointments, 350);
});

function csvCell(v) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // Excel formula injection se bachav
  return `"${s.replace(/"/g, '""')}"`;
}
document.getElementById("exportCsv").addEventListener("click", () => {
  if (!lastAppts.length) return showToast("Export karne ke liye koi appointment nahi hai", "error");
  const rows = [["Date", "Time", "Customer", "Phone", "Email", "Service", "Price", "Stylist", "Status", "Notes"]];
  lastAppts.forEach((a) => rows.push([a.date, a.timeSlot, a.customerName, a.customerPhone, a.customerEmail || "", a.service ? a.service.name : "", a.service ? a.service.price : "", a.stylist ? a.stylist.name : "", a.status, a.notes || ""]));
  const csv = "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = `appointments-${localDateStr()}.csv`;
  document.body.appendChild(link); link.click(); link.remove();
  URL.revokeObjectURL(link.href);
});
