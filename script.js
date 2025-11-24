// FINAL script.js — guaranteed: no modals on page load unless user clicks Checkout
// Replace entire frontend/script.js with this file and save.

const API_BASE = ""; // keep empty when serving frontend from backend (http://localhost:5000)

const productsGrid = document.getElementById("productsGrid");
const viewCartBtn = document.getElementById("viewCartBtn");
const cartPanel = document.getElementById("cartPanel");
const cartItemsDiv = document.getElementById("cartItems");
const cartCountSpan = document.getElementById("cartCount");
const clearCartBtn = document.getElementById("clearCart");
const searchInput = document.getElementById("searchInput");
const categorySelect = document.getElementById("categorySelect");

const authArea = document.getElementById("authArea");
const btnShowLogin = document.getElementById("btnShowLogin");
const authModal = document.getElementById("authModal");
const closeAuth = document.getElementById("closeAuth");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const showRegister = document.getElementById("showRegister");
const showLogin = document.getElementById("showLogin");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const checkoutBtn = document.getElementById("checkoutBtn");
const checkoutModal = document.getElementById("checkoutModal");
const closeCheckout = document.getElementById("closeCheckout");
const payNowBtn = document.getElementById("payNowBtn");

let products = [];
let cart = [];
let user = JSON.parse(localStorage.getItem("myntra_user") || "null");

// ---------- Helpers for guest cart and pending flags ----------
const GUEST_KEY = "guest_cart_v2"; // changed key name to avoid collisions
const PENDING_KEY = "pending_checkout_v2"; // changed key name to avoid collisions

function getGuestCart() {
  try {
    return JSON.parse(sessionStorage.getItem(GUEST_KEY) || "[]");
  } catch {
    return [];
  }
}
function setGuestCart(arr) {
  sessionStorage.setItem(GUEST_KEY, JSON.stringify(arr || []));
}
function clearGuestCart() {
  sessionStorage.removeItem(GUEST_KEY);
}
function setPendingCheckout(flag = true) {
  sessionStorage.setItem(PENDING_KEY, flag ? "1" : "0");
}
function getPendingCheckout() {
  return sessionStorage.getItem(PENDING_KEY) === "1";
}
function clearPendingCheckout() {
  sessionStorage.removeItem(PENDING_KEY);
}

// ---------- Strict modal safety: never show modals on load ----------
function hideModalsImmediately() {
  try {
    if (authModal) {
      authModal.classList.add("hidden");
      authModal.setAttribute("aria-hidden", "true");
      // Explicitly set style to hide, overriding any default browser behavior
      authModal.style.display = "none";
    }
    if (checkoutModal) {
      checkoutModal.classList.add("hidden");
      checkoutModal.setAttribute("aria-hidden", "true");
      // Explicitly set style to hide, overriding any default browser behavior
      checkoutModal.style.display = "none";
    }
  } catch (e) {
    /* ignore */
  }
}
// Remove any old pending data on init to avoid accidental popups
function clearAnyOldState() {
  try {
    sessionStorage.removeItem("pending_checkout");
    sessionStorage.removeItem("guest_cart");
    // also remove older keys to be safe
    sessionStorage.removeItem("pending_checkout_v1");
    sessionStorage.removeItem("guest_cart_v1");
    // keep new keys fresh
    clearPendingCheckout();
  } catch (e) {}
}

// ---------- UI small helper ----------
function showToast(msg) {
  const t = document.createElement("div");
  t.textContent = msg;
  Object.assign(t.style, {
    position: "fixed",
    right: "18px",
    bottom: "18px",
    background: "#222",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: "6px",
    zIndex: 9999,
  });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

// ---------- Auth area UI ----------
function setAuthUI() {
  authArea.innerHTML = "";
  if (user) {
    const span = document.createElement("span");
    span.textContent = `Hi, ${user.name}`;
    const logout = document.createElement("button");
    logout.textContent = "Logout";
    logout.addEventListener("click", () => {
      localStorage.removeItem("myntra_user");
      user = null;
      setAuthUI();
      loadCart();
    });
    authArea.appendChild(span);
    authArea.appendChild(logout);
  } else {
    const login = document.createElement("button");
    login.textContent = "Login";
    login.addEventListener("click", () => {
      authModal.classList.remove("hidden");
      authModal.setAttribute("aria-hidden", "false");
      authModal.style.display = "flex"; // show the modal
      showLoginForm();
    });
    authArea.appendChild(login);
  }
}

// ---------- Products & categories ----------
async function loadProducts() {
  try {
    const res = await fetch(`${API_BASE}/products`);
    products = await res.json();
    renderProducts(products);
    loadCategories();
  } catch (err) {
    console.error(err);
    productsGrid.innerHTML = "<p>Failed to load products. Backend running?</p>";
  }
}
async function loadCategories() {
  try {
    const res = await fetch(`${API_BASE}/categories`);
    const cats = await res.json();
    categorySelect.innerHTML =
      '<option value="">All Categories</option>' +
      cats.map((c) => `<option value="${c}">${c}</option>`).join("");
  } catch (err) {
    console.error(err);
  }
}

function renderProducts(list) {
  productsGrid.innerHTML = "";
  if (!list.length) {
    productsGrid.innerHTML = "<p>No products found.</p>";
    return;
  }
  list.forEach((p) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
   <img src="${p.image}" alt="${p.name}" />
   <h3>${p.name}</h3>
   <p class="desc">${p.description || ""}</p>
   <div class="price">₹${p.price}</div>
   <div style="display:flex;gap:8px;width:100%;">
    <button data-id="${p.id}" class="addBtn" style="flex:1">Add to cart</button>
    <button data-id="${
      p.id
    }" class="buyNowBtn" style="flex:1;background:#0a84ff;color:#fff;border:none;border-radius:6px;">Buy Now</button>
   </div>
  `;
    const addBtn = card.querySelector(".addBtn");
    const buyNowBtn = card.querySelector(".buyNowBtn");
    addBtn.addEventListener("click", () => addItemToCartLocal(p.id, 1));
    buyNowBtn.addEventListener("click", () => {
      addItemToCartLocal(p.id, 1);
      cartPanel.classList.remove("hidden");
    });
    productsGrid.appendChild(card);
  });
}

// ---------- Add to cart (user -> backend, guest -> session) ----------
async function addItemToCartLocal(productId, quantity = 1) {
  if (user) {
    try {
      const res = await fetch(`${API_BASE}/cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, productId, quantity }),
      });
      cart = await res.json();
      updateCartUI();
      showToast("Added to your cart");
    } catch (err) {
      console.error(err);
      showToast("Failed to add to cart");
    }
  } else {
    const guest = getGuestCart();
    const existing = guest.find((i) => i.productId === productId);
    if (existing) existing.quantity += quantity;
    else guest.push({ productId, quantity });
    setGuestCart(guest);
    buildCartFromGuest();
    showToast("Added to cart (guest). Login at checkout to save it.");
  }
}

function buildCartFromGuest() {
  const g = getGuestCart();
  cart = g.map((item) => {
    const product = products.find((p) => p.id === item.productId) || {
      name: "Unknown",
      price: 0,
      image: "",
    };
    return { product, quantity: item.quantity };
  });
  updateCartUI();
}

// ---------- Load cart ----------
async function loadCart() {
  if (user) {
    try {
      const res = await fetch(`${API_BASE}/cart?userId=${user.id}`);
      cart = await res.json();
      updateCartUI();
    } catch (err) {
      console.error(err);
      cart = [];
      updateCartUI();
    }
  } else {
    buildCartFromGuest();
  }
}

// ---------- Update UI ----------
function updateCartUI() {
  const total = cart.reduce((s, it) => s + (it.quantity || 0), 0);
  cartCountSpan.textContent = total;
  renderCartPanel();
}
function renderCartPanel() {
  cartItemsDiv.innerHTML = "";
  if (!cart.length) {
    cartItemsDiv.innerHTML = "<p>Cart is empty</p>";
    checkoutBtn.disabled = true;
    return;
  }
  checkoutBtn.disabled = false;
  cart.forEach((it) => {
    const node = document.createElement("div");
    node.className = "cart-item";
    node.innerHTML = `
   <img src="${it.product.image}" />
   <div style="flex:1">
    <div><strong>${it.product.name}</strong></div>
    <div>₹${it.product.price} × ${it.quantity}</div>
   </div>
  `;
    cartItemsDiv.appendChild(node);
  });
}

// ---------- Clear cart ----------
clearCartBtn.addEventListener("click", async () => {
  if (user) {
    if (!confirm("Clear cart?")) return;
    try {
      await fetch(`${API_BASE}/cart/clear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      cart = [];
      updateCartUI();
    } catch (err) {
      console.error(err);
    }
  } else {
    if (!confirm("Clear guest cart?")) return;
    clearGuestCart();
    cart = [];
    updateCartUI();
  }
});

// ---------- Checkout: ONLY explicit click sets pending ----------
checkoutBtn.addEventListener("click", async () => {
  if (!cart.length) return alert("Your cart is empty. Add items first.");
  // If user logged in, open checkout modal directly
  if (user) {
    checkoutModal.classList.remove("hidden");
    checkoutModal.setAttribute("aria-hidden", "false");
    checkoutModal.style.display = "flex"; // show the modal
    return;
  }
  // Guest clicked Checkout explicitly -> set pending and show auth modal
  setPendingCheckout(true);
  authModal.classList.remove("hidden");
  authModal.setAttribute("aria-hidden", "false");
  authModal.style.display = "flex"; // show the modal
  showLoginForm();
});

// ---------- Auth UI handlers ----------
btnShowLogin?.addEventListener("click", () => {
  authModal.classList.remove("hidden");
  authModal.setAttribute("aria-hidden", "false");
  authModal.style.display = "flex"; // show the modal
  showLoginForm();
});
closeAuth.addEventListener("click", () => {
  authModal.classList.add("hidden");
  authModal.setAttribute("aria-hidden", "true");
  authModal.style.display = "none"; // hide the modal
});
showRegister.addEventListener("click", (e) => {
  e.preventDefault();
  showRegisterForm();
});
showLogin.addEventListener("click", (e) => {
  e.preventDefault();
  showLoginForm();
});
function showLoginForm() {
  loginForm.classList.remove("hidden");
  registerForm.classList.add("hidden");
}
function showRegisterForm() {
  loginForm.classList.add("hidden");
  registerForm.classList.remove("hidden");
}

// ---------- Transfer guest cart after login ----------
async function transferGuestCartToUserIfNeeded() {
  const guest = getGuestCart();
  if (!guest.length) return;
  if (!user) return;
  for (const it of guest) {
    try {
      await fetch(`${API_BASE}/cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          productId: it.productId,
          quantity: it.quantity,
        }),
      });
    } catch (err) {
      console.error("transfer error", err);
    }
  }
  clearGuestCart();
}

// ---------- Login & Register ----------
loginBtn.addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      return alert("Login failed: " + (err.error || ""));
    }
    user = await res.json();
    localStorage.setItem("myntra_user", JSON.stringify(user));
    authModal.classList.add("hidden");
    authModal.setAttribute("aria-hidden", "true");
    authModal.style.display = "none"; // hide modal
    setAuthUI();
    await transferGuestCartToUserIfNeeded();
    await loadCart();
    if (getPendingCheckout()) {
      clearPendingCheckout();
      checkoutModal.classList.remove("hidden");
      checkoutModal.setAttribute("aria-hidden", "false");
      checkoutModal.style.display = "flex"; // show checkout modal
    }
    showToast("Logged in");
  } catch (err) {
    console.error(err);
    alert("Login failed");
  }
});

registerBtn.addEventListener("click", async () => {
  const name = document.getElementById("regName").value;
  const email = document.getElementById("regEmail").value;
  const password = document.getElementById("regPassword").value;
  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      return alert("Register failed: " + (err.error || ""));
    }
    user = await res.json();
    localStorage.setItem("myntra_user", JSON.stringify(user));
    authModal.classList.add("hidden");
    authModal.setAttribute("aria-hidden", "true");
    authModal.style.display = "none"; // hide modal
    setAuthUI();
    await transferGuestCartToUserIfNeeded();
    await loadCart();
    if (getPendingCheckout()) {
      clearPendingCheckout();
      checkoutModal.classList.remove("hidden");
      checkoutModal.setAttribute("aria-hidden", "false");
      checkoutModal.style.display = "flex"; // show checkout modal
    }
    showToast("Registered and logged in");
  } catch (err) {
    console.error(err);
    alert("Register failed");
  }
});

// ---------- Checkout pay handlers ----------
closeCheckout.addEventListener("click", () => {
  checkoutModal.classList.add("hidden");
  checkoutModal.setAttribute("aria-hidden", "true");
  checkoutModal.style.display = "none"; // hide modal
});
payNowBtn.addEventListener("click", async () => {
  if (!user) return alert("Please login before paying.");
  const cardNumber = document.getElementById("cardNumber").value;
  const shipAddress = document.getElementById("shipAddress").value;
  if (!cardNumber || !shipAddress)
    return alert("Please complete payment and shipping info.");
  try {
    const res = await fetch(`${API_BASE}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        payment: {
          cardNumber,
          cardName: document.getElementById("cardName").value,
          cardExpiry: document.getElementById("cardExpiry").value,
        },
        shipping: {
          address: shipAddress,
          city: document.getElementById("shipCity").value,
          zip: document.getElementById("shipZip").value,
        },
      }),
    });
    const body = await res.json();
    if (!res.ok) return alert("Payment failed: " + (body.error || ""));
    showToast("Payment successful. Order id: " + body.orderId);
    checkoutModal.classList.add("hidden");
    checkoutModal.setAttribute("aria-hidden", "true");
    checkoutModal.style.display = "none"; // hide modal
    await loadCart();
  } catch (err) {
    console.error(err);
    alert("Checkout error");
  }
});

// ---------- View cart toggle & search ----------
viewCartBtn.addEventListener("click", () =>
  cartPanel.classList.toggle("hidden")
);
searchInput.addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q)
  );
  renderProducts(filtered);
});
categorySelect.addEventListener("change", (e) => {
  const v = e.target.value;
  const filtered = v ? products.filter((p) => p.category === v) : products;
  renderProducts(filtered);
});

// ---------- Init: CLEAR old flags & force modals hidden (guaranteed) ----------
(async function init() {
  clearAnyOldState(); // remove old keys
  clearPendingCheckout(); // ensure new key is cleared
  hideModalsImmediately(); // forcibly hide modals on load
  setAuthUI();
  await loadProducts();
  await loadCart();
})();
