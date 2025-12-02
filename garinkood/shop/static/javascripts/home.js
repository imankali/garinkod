// ======================
// متغیرهای سراسری
// ======================
let cart = [];
let currentSlide = 0;
let sliderInterval;

// ======================
// اسلایدر هیرو
// ======================

function showSlide(index) {
  const slides = document.querySelectorAll(".hero-slide");
  const dots = document.querySelectorAll(".dot");

  if (slides.length === 0) return;

  slides.forEach(slide => slide.classList.remove("active"));
  dots.forEach(dot => dot.classList.remove("active"));

  currentSlide = ((index % slides.length) + slides.length) % slides.length;
  slides[currentSlide]?.classList.add("active");
  dots[currentSlide]?.classList.add("active");
}

function nextSlide() {
  showSlide(currentSlide + 1);
}

function prevSlide() {
  showSlide(currentSlide - 1);
}

function goToSlide(index) {
  showSlide(index);
  resetSliderInterval();
}

function startHeroSlider() {
  const slides = document.querySelectorAll(".hero-slide");
  if (slides.length <= 1) return;

  clearInterval(sliderInterval);
  sliderInterval = setInterval(nextSlide, 6000);
}

function resetSliderInterval() {
  clearInterval(sliderInterval);
  startHeroSlider();
}

// ======================
// سبد خرید
// ======================

function loadCart() {
  const saved = localStorage.getItem("garinkod_cart");
  if (saved) {
    cart = JSON.parse(saved);
    updateCartUI();
  }
}

function saveCart() {
  localStorage.setItem("garinkod_cart", JSON.stringify(cart));
  updateCartUI();
}

function formatPrice(price) {
  return new Intl.NumberFormat("fa-IR").format(price) + " تومان";
}

function addToCart(product) {
  const { id, name, price, image } = product;

  const existingItem = cart.find(item => item.id === id);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ id, name, price, image, quantity: 1 });
  }

  saveCart();
  toggleCart(true);
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  saveCart();
}

function updateQuantity(productId, delta) {
  const item = cart.find(item => item.id === productId);
  if (item) {
    item.quantity = Math.max(1, item.quantity + delta);
    saveCart();
  }
}

function updateCartUI() {
  const cartItems = document.getElementById("cart-items");
  const cartFooter = document.getElementById("cart-footer");
  const cartBadge = document.getElementById("cart-badge");
  const cartTotalPrice = document.getElementById("cart-total-price");

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (totalItems > 0) {
    cartBadge.textContent = new Intl.NumberFormat("fa-IR").format(totalItems);
    cartBadge.style.display = "flex";
  } else {
    cartBadge.style.display = "none";
  }

  if (cart.length === 0) {
    cartItems.innerHTML = `
      <div class="empty-cart">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="8" cy="21" r="1"></circle>
          <circle cx="19" cy="21" r="1"></circle>
          <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
        </svg>
        <p>سبد خرید شما خالی است</p>
      </div>
    `;
    cartFooter.style.display = "none";
  } else {
    cartItems.innerHTML = cart
      .map(item => `
        <div class="cart-item">
          <img src="${item.image}" alt="${item.name}" class="cart-item-image">
          <div class="cart-item-info">
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-price">${formatPrice(item.price)}</div>
            <div class="cart-item-controls">
              <button class="quantity-btn" onclick="updateQuantity(${item.id}, -1)">-</button>
              <span class="quantity-display">${new Intl.NumberFormat("fa-IR").format(item.quantity)}</span>
              <button class="quantity-btn" onclick="updateQuantity(${item.id}, 1)">+</button>
              <button class="remove-btn" onclick="removeFromCart(${item.id})">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `)
      .join("");

    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    cartTotalPrice.textContent = formatPrice(total);
    cartFooter.style.display = "block";
  }
}

function toggleCart(forceOpen = false) {
  const overlay = document.getElementById("cart-overlay");
  const sidebar = document.getElementById("cart-sidebar");

  if (forceOpen) {
    overlay.classList.add("active");
    sidebar.classList.add("active");
  } else {
    overlay.classList.toggle("active");
    sidebar.classList.toggle("active");
  }
}

// ======================
// منو و جستجو (در صورت استفاده)
// ======================

function toggleMobileMenu() {
  const menu = document.getElementById("mobile-menu");
  const menuIcon = document.querySelector(".menu-icon");
  const closeIcon = document.querySelector(".close-icon");

  if (!menu) return;

  if (menu.style.display === "none" || menu.style.display === "") {
    menu.style.display = "block";
    menuIcon.style.display = "none";
    closeIcon.style.display = "block";
  } else {
    menu.style.display = "none";
    menuIcon.style.display = "block";
    closeIcon.style.display = "none";
  }
}

function toggleMobileSearch() {
  const search = document.getElementById("mobile-search");
  if (search) {
    search.style.display = search.style.display === "none" ? "block" : "none";
  }
}

// ======================
// راه‌اندازی
// ======================

document.addEventListener("DOMContentLoaded", () => {
  loadCart();
  startHeroSlider(); // ✅ اسلایدر بدون وابستگی شروع می‌شود
});