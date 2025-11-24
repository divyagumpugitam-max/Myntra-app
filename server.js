// backend/server.js
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, "db.json");

function readDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
}
function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// serve frontend files
app.use(express.static(path.join(__dirname, "..", "frontend")));

// PRODUCTS
app.get("/products", (req, res) => {
  try {
    const db = readDB();
    res.json(db.products);
  } catch (err) {
    res.status(500).json({ error: "Failed to read products" });
  }
});
app.get("/products/:id", (req, res) => {
  try {
    const db = readDB();
    const p = db.products.find((x) => x.id === Number(req.params.id));
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});
app.get("/categories", (req, res) => {
  try {
    const db = readDB();
    const cats = Array.from(new Set(db.products.map((p) => p.category))).sort();
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: "Failed to get categories" });
  }
});

// AUTH
app.post("/auth/register", (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "email & password required" });
    const db = readDB();
    if (db.users.find((u) => u.email === email.toLowerCase()))
      return res.status(400).json({ error: "Email in use" });
    const nextId = db.users.reduce((m, u) => Math.max(m, u.id), 0) + 1;
    const newUser = {
      id: nextId,
      name: name || "User",
      email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      cart: [],
    };
    db.users.push(newUser);
    writeDB(db);
    const { passwordHash, ...safe } = newUser;
    res.status(201).json(safe);
  } catch (err) {
    res.status(500).json({ error: "Failed to register" });
  }
});

app.post("/auth/login", (req, res) => {
  try {
    const { email, password } = req.body;
    const db = readDB();
    const user = db.users.find((u) => u.email === (email || "").toLowerCase());
    if (!user) return res.status(400).json({ error: "Invalid credentials" });
    if (user.passwordHash !== hashPassword(password))
      return res.status(400).json({ error: "Invalid credentials" });
    const { passwordHash, ...safe } = user;
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: "Failed to login" });
  }
});

// CART (per user)
app.get("/cart", (req, res) => {
  try {
    const userId = Number(req.query.userId);
    if (!userId) return res.json([]);
    const db = readDB();
    const user = db.users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user.cart || []);
  } catch (err) {
    res.status(500).json({ error: "Failed to get cart" });
  }
});

app.post("/cart", (req, res) => {
  try {
    const { userId, productId, quantity } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
    const db = readDB();
    const user = db.users.find((u) => u.id === Number(userId));
    if (!user) return res.status(404).json({ error: "User not found" });
    const product = db.products.find((p) => p.id === Number(productId));
    if (!product) return res.status(400).json({ error: "Invalid product" });
    const qty = Number(quantity) || 1;
    const existing = user.cart.find((i) => i.product.id === product.id);
    if (existing) existing.quantity += qty;
    else user.cart.push({ product, quantity: qty });
    writeDB(db);
    res.json(user.cart);
  } catch (err) {
    res.status(500).json({ error: "Failed to add to cart" });
  }
});

app.post("/cart/clear", (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
    const db = readDB();
    const user = db.users.find((u) => u.id === Number(userId));
    if (!user) return res.status(404).json({ error: "User not found" });
    user.cart = [];
    writeDB(db);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to clear cart" });
  }
});

// CHECKOUT (mock)
app.post("/checkout", (req, res) => {
  try {
    const { userId, payment, shipping } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
    const db = readDB();
    const user = db.users.find((u) => u.id === Number(userId));
    if (!user) return res.status(404).json({ error: "User not found" });
    const cart = user.cart || [];
    if (!cart.length) return res.status(400).json({ error: "Cart is empty" });
    if (!payment || !payment.cardNumber)
      return res.status(400).json({ error: "Invalid payment" });
    const orderId = db.orders.reduce((m, o) => Math.max(m, o.id || 0), 0) + 1;
    const order = {
      id: orderId,
      userId: user.id,
      items: cart,
      total: cart.reduce(
        (s, it) => s + Number(it.product.price) * Number(it.quantity),
        0
      ),
      shipping: shipping || {},
      createdAt: new Date().toISOString(),
      status: "paid",
    };
    db.orders.push(order);
    user.cart = [];
    writeDB(db);
    res.json({ ok: true, orderId, order });
  } catch (err) {
    res.status(500).json({ error: "Checkout failed" });
  }
});

// Add product (admin-ish)
app.post("/products", (req, res) => {
  try {
    const db = readDB();
    const { name, price, image, category, rating, description } = req.body;
    const nextId = db.products.reduce((m, p) => Math.max(m, p.id), 0) + 1;
    const newProduct = {
      id: nextId,
      name: name || "New Product",
      price: Number(price) || 0,
      image: image || "https://via.placeholder.com/400x400?text=Product",
      category: category || "Others",
      rating: rating || 0,
      description: description || "",
    };
    db.products.push(newProduct);
    writeDB(db);
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(500).json({ error: "Failed to add product" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
