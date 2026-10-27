/* VELOCE | Vanilla JavaScript: fetch API, filter, detail, favorites, cart */
"use strict";

const API_URL = "https://api-web.dnccudinus.org/api/mobil";
const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=900&q=80"
];

const state = {
  cars: [],
  category: "all",
  query: "",
  sort: "default",
  favorites: new Set(),
  cart: new Map()
};

const carGrid = document.getElementById("carGrid");
const apiStatus = document.getElementById("apiStatus");
const emptyState = document.getElementById("emptyState");
const resultCount = document.getElementById("resultCount");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const carDialog = document.getElementById("carDialog");
const dialogContent = document.getElementById("dialogContent");
const cartDialog = document.getElementById("cartDialog");
const cartItems = document.getElementById("cartItems");
const cartSummary = document.getElementById("cartSummary");
const toast = document.getElementById("toast");
let toastTimer;

document.getElementById("year").textContent = new Date().getFullYear();

function firstValue(object, keys, fallback = "") {
  for (const key of keys) {
    const value = object?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return fallback;
}

function extractCars(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  for (const key of ["data", "mobil", "cars", "results", "items", "result"]) {
    if (Array.isArray(payload[key])) return payload[key];
    if (payload[key] && typeof payload[key] === "object") {
      for (const nestedKey of ["data", "mobil", "cars", "results", "items"]) {
        if (Array.isArray(payload[key][nestedKey])) return payload[key][nestedKey];
      }
    }
  }
  return [];
}

function normalizeCar(raw, index) {
  const brand = firstValue(raw, ["merek", "brand", "merk", "manufacturer", "nama_merek"], "");
  const model = firstValue(raw, ["model", "nama_mobil", "nama", "name", "tipe"], "");
  const name = [brand, model].filter(Boolean).join(" ").trim() || `Mobil ${index + 1}`;
  const rawPrice = firstValue(raw, ["harga", "price", "harga_mobil", "price_value", "harga_jual"], null);
  const price = Number(String(rawPrice ?? "").replace(/[^\d]/g, ""));
  const categoryRaw = String(firstValue(raw, ["kategori", "category", "jenis", "tipe_mobil", "body_type"], "")).toLowerCase();
  const image = firstValue(raw, ["gambar", "image", "foto", "foto_mobil", "image_url", "url_gambar", "thumbnail"], "");
  let category = "other";

  if (/suv|sport utility|jeep/.test(categoryRaw)) category = "suv";
  else if (/sedan/.test(categoryRaw)) category = "sedan";
  else if (/sport|coupe|supercar/.test(categoryRaw)) category = "sport";
  else if (/electric|elektrik|listrik|\bev\b/.test(categoryRaw)) category = "electric";
  else {
    const searchable = name.toLowerCase();
    if (/tesla|ioniq|byd|electric/.test(searchable)) category = "electric";
    else if (/suv|fortuner|pajero|cr-v|hr-v|rush|terios|xtrail/.test(searchable)) category = "suv";
    else if (/sedan|civic|camry|accord/.test(searchable)) category = "sedan";
    else if (/sport|supra|mustang|ferrari|lamborghini|porsche/.test(searchable)) category = "sport";
  }

  return {
    id: String(firstValue(raw, ["id", "mobil_id", "uuid"], index + 1)),
    name,
    brand: String(brand || "Mobil pilihan"),
    year: String(firstValue(raw, ["tahun", "year", "tahun_produksi"], "Tahun tidak tersedia")),
    transmission: String(firstValue(raw, ["transmisi", "transmission"], "Tidak tersedia")),
    fuel: String(firstValue(raw, ["bahan_bakar", "fuel", "jenis_bahan_bakar"], "Tidak tersedia")),
    price: Number.isFinite(price) && price > 0 ? price : null,
    priceText: rawPrice ? String(rawPrice) : "",
    image: typeof image === "string" && /^https?:\/\//i.test(image) ? image : "",
    category,
    description: String(firstValue(raw, ["deskripsi", "description", "keterangan"], "Hubungi penjual untuk mendapatkan informasi lebih lanjut.")),
    index
  };
}

function safeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function categoryLabel(category) {
  return ({ suv: "SUV", sedan: "Sedan", sport: "Sport", electric: "Elektrik", other: "Lainnya" })[category] || "Mobil";
}

function imageFor(car) {
  return car.image || FALLBACK_IMAGES[car.index % FALLBACK_IMAGES.length];
}

function formatPrice(car) {
  if (car.price) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency", currency: "IDR", maximumFractionDigits: 0
    }).format(car.price);
  }
  return car.priceText || "Hubungi penjual";
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function renderCars() {
  const query = state.query.toLowerCase().trim();
  let cars = state.cars.filter(car => {
    const matchesQuery = `${car.name} ${car.brand} ${car.year}`.toLowerCase().includes(query);
    const matchesCategory = state.category === "all" || car.category === state.category;
    return matchesQuery && matchesCategory;
  });

  if (state.sort === "name-asc") cars.sort((a, b) => a.name.localeCompare(b.name, "id"));
  if (state.sort === "price-asc") cars.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  if (state.sort === "price-desc") cars.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));

  carGrid.innerHTML = "";
  const fragment = document.createDocumentFragment();

  cars.forEach(car => {
    const saved = state.favorites.has(car.id);
    const card = document.createElement("article");
    card.className = "product-card";
    card.innerHTML = `
      <div class="product-image-wrap">
        <img class="product-image" src="${safeText(imageFor(car))}" alt="${safeText(car.name)}" loading="lazy">
        <span class="product-category">${safeText(categoryLabel(car.category))}</span>
        <button class="favorite-button ${saved ? "saved" : ""}" data-favorite="${safeText(car.id)}" aria-label="Toggle favorit" aria-pressed="${saved}">${saved ? "♥" : "♡"}</button>
      </div>
      <div class="product-info">
        <div class="product-meta"><span>${safeText(car.brand)}</span><span>${safeText(car.year)}</span></div>
        <h3 class="product-title">${safeText(car.name)}</h3>
        <p class="product-description">${safeText([car.transmission, car.fuel].filter(value => value !== "Tidak tersedia").join(" · ") || "Informasi kendaraan")}</p>
        <hr class="product-separator">
        <div class="product-bottom"><div><div class="product-price">${safeText(formatPrice(car))}</div><div class="price-caption">Harga kendaraan</div></div><button class="detail-button" data-detail="${safeText(car.id)}">Detail ↗</button></div>
        <button class="add-button" data-add="${safeText(car.id)}">+ Tambahkan ke keranjang</button>
      </div>`;

    const image = card.querySelector(".product-image");
    image.addEventListener("error", () => {
      const fallback = document.createElement("div");
      fallback.className = "image-fallback";
      fallback.textContent = "VELOCE";
      image.replaceWith(fallback);
    }, { once: true });
    fragment.appendChild(card);
  });

  carGrid.appendChild(fragment);
  carGrid.hidden = cars.length === 0;
  emptyState.hidden = cars.length !== 0;
  resultCount.textContent = `${cars.length} mobil ditemukan`;
}

async function loadCars() {
  apiStatus.className = "api-status";
  apiStatus.textContent = "Mengambil data mobil dari API resmi panitia...";
  try {
    const response = await fetch(API_URL, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Server memberikan status ${response.status}.`);
    const payload = await response.json();
    const data = extractCars(payload);
    if (!data.length) throw new Error("Format data mobil tidak ditemukan pada respons API.");
    state.cars = data.map(normalizeCar);
    apiStatus.textContent = `Data berhasil dimuat dari API. Total ${state.cars.length} mobil.`;
    renderCars();
  } catch (error) {
    console.error("API mobil gagal dimuat:", error);
    apiStatus.className = "api-status error";
    apiStatus.textContent = `Data mobil belum berhasil dimuat. ${error.message} Pastikan internet aktif dan jalankan melalui Live Server. Jika tetap gagal, periksa akses API atau CORS.`;
    resultCount.textContent = "Katalog belum tersedia";
    carGrid.innerHTML = "";
    carGrid.hidden = true;
    emptyState.hidden = false;
    emptyState.querySelector("h3").textContent = "Katalog belum dapat dimuat";
    emptyState.querySelector("p").textContent = "Coba muat ulang halaman setelah memeriksa koneksi internet.";
    const oldButton = emptyState.querySelector("button");
    if (oldButton) oldButton.textContent = "Muat ulang";
    else {
      const retry = document.createElement("button");
      retry.className = "button button-primary";
      retry.textContent = "Muat ulang";
      retry.id = "retryLoad";
      emptyState.appendChild(retry);
    }
  }
}

function openDetails(id) {
  const car = state.cars.find(item => item.id === String(id));
  if (!car) return;
  dialogContent.innerHTML = `
    <img class="dialog-image" src="${safeText(imageFor(car))}" alt="${safeText(car.name)}">
    <div class="dialog-body">
      <p class="small-label">${safeText(categoryLabel(car.category))} · ${safeText(car.brand)}</p>
      <h2 id="dialogTitle">${safeText(car.name)}</h2>
      <div class="dialog-price">${safeText(formatPrice(car))}</div>
      <p>${safeText(car.description)}</p>
      <div class="dialog-specs">
        <div class="spec"><span>Tahun</span><strong>${safeText(car.year)}</strong></div>
        <div class="spec"><span>Transmisi</span><strong>${safeText(car.transmission)}</strong></div>
        <div class="spec"><span>Bahan bakar</span><strong>${safeText(car.fuel)}</strong></div>
        <div class="spec"><span>ID mobil</span><strong>${safeText(car.id)}</strong></div>
      </div>
      <button class="button button-primary" data-dialog-add="${safeText(car.id)}">Tambahkan ke keranjang</button>
    </div>`;
  const image = dialogContent.querySelector(".dialog-image");
  image.addEventListener("error", () => {
    image.alt = "Gambar mobil tidak tersedia";
    image.style.display = "none";
  }, { once: true });
  carDialog.showModal();
}

function addToCart(id) {
  const car = state.cars.find(item => item.id === String(id));
  if (!car) return;
  state.cart.set(car.id, (state.cart.get(car.id) || 0) + 1);
  updateCartCount();
  showToast(`${car.name} ditambahkan ke keranjang.`);
}

function updateCartCount() {
  const count = [...state.cart.values()].reduce((total, quantity) => total + quantity, 0);
  document.getElementById("cartCount").textContent = count;
}

function renderCart() {
  const items = [...state.cart.entries()].map(([id, quantity]) => ({
    car: state.cars.find(item => item.id === id), quantity
  })).filter(item => item.car);

  if (!items.length) {
    cartItems.innerHTML = '<p class="cart-empty">Keranjang masih kosong. Tambahkan mobil dari katalog.</p>';
    cartSummary.innerHTML = "";
    return;
  }

  cartItems.innerHTML = items.map(({ car, quantity }) => `
    <div class="cart-item">
      <img src="${safeText(imageFor(car))}" alt="${safeText(car.name)}">
      <div><h3>${safeText(car.name)}</h3><p>${safeText(formatPrice(car))} · Jumlah ${quantity}</p></div>
      <button class="remove-button" data-remove="${safeText(car.id)}">Hapus</button>
    </div>`).join("");

  const total = items.reduce((sum, item) => sum + (item.car.price || 0) * item.quantity, 0);
  const unknownPrice = items.some(item => !item.car.price);
  const totalText = unknownPrice ? "Konfirmasi harga" : new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", maximumFractionDigits: 0
  }).format(total);
  cartSummary.innerHTML = `<div class="cart-total"><span>Estimasi total</span><span>${safeText(totalText)}</span></div><button class="button button-primary" id="checkoutButton">Lanjutkan konsultasi</button>`;
  document.getElementById("checkoutButton").addEventListener("click", () => {
    showToast("Ini masih keranjang demo. Konfirmasi transaksi belum tersedia.");
  });
}

document.getElementById("filterChips").addEventListener("click", event => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  state.category = button.dataset.filter;
  document.querySelectorAll(".filter").forEach(item => item.classList.toggle("active", item === button));
  renderCars();
});
searchInput.addEventListener("input", event => { state.query = event.target.value; renderCars(); });
sortSelect.addEventListener("change", event => { state.sort = event.target.value; renderCars(); });

carGrid.addEventListener("click", event => {
  const addButton = event.target.closest("[data-add]");
  if (addButton) { addToCart(addButton.dataset.add); return; }
  const favoriteButton = event.target.closest("[data-favorite]");
  if (favoriteButton) {
    const id = favoriteButton.dataset.favorite;
    state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
    renderCars();
    return;
  }
  const detailButton = event.target.closest("[data-detail]");
  if (detailButton) openDetails(detailButton.dataset.detail);
});

dialogContent.addEventListener("click", event => {
  const button = event.target.closest("[data-dialog-add]");
  if (!button) return;
  addToCart(button.dataset.dialogAdd);
  carDialog.close();
});
document.getElementById("dialogClose").addEventListener("click", () => carDialog.close());
carDialog.addEventListener("click", event => { if (event.target === carDialog) carDialog.close(); });

document.getElementById("cartButton").addEventListener("click", () => {
  renderCart();
  cartDialog.showModal();
});
document.getElementById("cartClose").addEventListener("click", () => cartDialog.close());
cartItems.addEventListener("click", event => {
  const button = event.target.closest("[data-remove]");
  if (!button) return;
  state.cart.delete(button.dataset.remove);
  updateCartCount();
  renderCart();
});

document.getElementById("resetFilters").addEventListener("click", () => {
  state.category = "all";
  state.query = "";
  state.sort = "default";
  searchInput.value = "";
  sortSelect.value = "default";
  document.querySelectorAll(".filter").forEach(button => button.classList.toggle("active", button.dataset.filter === "all"));
  renderCars();
});
document.getElementById("showAllBtn").addEventListener("click", () => {
  state.category = "all";
  state.query = "";
  state.sort = "default";
  searchInput.value = "";
  sortSelect.value = "default";
  document.querySelectorAll(".filter").forEach(button => button.classList.toggle("active", button.dataset.filter === "all"));
  renderCars();
});

const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");
menuToggle.addEventListener("click", () => {
  const open = mainNav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(open));
});
mainNav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
  mainNav.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
}));
emptyState.addEventListener("click", event => {
  if (event.target.id === "retryLoad" || event.target.id === "resetFilters") loadCars();
});

loadCars();
