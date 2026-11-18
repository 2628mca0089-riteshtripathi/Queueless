const API_BASE_URL = window.location.origin.startsWith("file")
  ? "http://localhost:5000/api"
  : `${window.location.origin}/api`;
const token = new URLSearchParams(window.location.search).get("token");
const errBox = document.getElementById("resetError");
const okBox = document.getElementById("resetSuccess");

function show(box, msg) {
  errBox.style.display = "none";
  okBox.style.display = "none";
  box.textContent = msg;
  box.style.display = "block";
}
async function post(path, body) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Something went wrong");
  return data;
}

if (token) {
  document.getElementById("forgotForm").style.display = "none";
  document.getElementById("resetForm").style.display = "block";
  document.getElementById("resetTitle").textContent = "Set new password";
  document.getElementById("resetSub").textContent = "Enter your new password.";
}

document.getElementById("forgotForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const data = await post("/auth/forgot", { email: document.getElementById("forgotEmail").value.trim() });
    show(okBox, data.message);
  } catch (err) { show(errBox, err.message); }
});

document.getElementById("resetForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const newPassword = document.getElementById("resetPass").value;
  if (newPassword !== document.getElementById("resetConfirm").value) return show(errBox, "Passwords do not match");
  try {
    const data = await post("/auth/reset", { token, newPassword });
    document.getElementById("resetForm").style.display = "none";
    show(okBox, data.message + " Redirecting…");
    setTimeout(() => (window.location.href = "admin.html"), 1800);
  } catch (err) { show(errBox, err.message); }
});
