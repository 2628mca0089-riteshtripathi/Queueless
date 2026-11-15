const API_BASE_URL = window.location.origin.startsWith("file")
  ? "http://localhost:5000/api"
  : `${window.location.origin}/api`;

document.getElementById("shopRegisterForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const errorBox = document.getElementById("registerError");
  const btn = document.getElementById("registerBtn");
  errorBox.style.display = "none";

  const payload = {
    name: document.getElementById("regShopName").value.trim(),
    ownerName: document.getElementById("regOwnerName").value.trim(),
    phone: document.getElementById("regPhone").value.trim(),
    email: document.getElementById("regEmail").value.trim(),
    address: document.getElementById("regAddress").value.trim(),
    description: document.getElementById("regDescription").value.trim(),
    password: document.getElementById("regPassword").value,
  };

  if (payload.password !== document.getElementById("regConfirm").value) {
    errorBox.textContent = "Password aur confirm password match nahi karte";
    errorBox.style.display = "block";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Registering…";
  try {
    const response = await fetch(`${API_BASE_URL}/shops/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Registration failed");

    document.getElementById("shopRegisterForm").style.display = "none";
    const ok = document.getElementById("registerSuccess");
    ok.textContent = data.message;
    ok.style.display = "block";
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.style.display = "block";
    btn.disabled = false;
    btn.textContent = "Register Shop";
  }
});

document.getElementById("showRegPass").addEventListener("change", (e) => {
  const type = e.target.checked ? "text" : "password";
  document.getElementById("regPassword").type = type;
  document.getElementById("regConfirm").type = type;
});
