// ========================================
// Shopping Cart AJAX - نسخه نهایی و کامل
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    const csrftoken = window.CSRF_TOKEN;

    // ========================================
    // توابع اصلی سبد خرید
    // ========================================

    function openCart() {
        const overlay = document.getElementById("cart-overlay");
        const sidebar = document.getElementById("cart-sidebar");
        if (!overlay || !sidebar) return;

        overlay.classList.add("active");
        sidebar.classList.add("active");
        document.body.style.overflow = 'hidden';

        // لود مجدد داده‌ها هنگام باز شدن
        updateCartUI();
    }

    function closeCart() {
        const overlay = document.getElementById("cart-overlay");
        const sidebar = document.getElementById("cart-sidebar");
        if (!overlay || !sidebar) return;

        overlay.classList.remove("active");
        sidebar.classList.remove("active");
        document.body.style.overflow = '';
    }

    function toggleCart() {
        const sidebar = document.getElementById("cart-sidebar");
        if (!sidebar) return;

        if (sidebar.classList.contains("active")) {
            closeCart();
        } else {
            openCart();
        }
    }

    // ========================================
    // آپدیت UI سبد خرید
    // ========================================
    async function updateCartUI() {
        const cartItems = document.getElementById("cart-items");
        const cartFooter = document.getElementById("cart-footer");
        const cartTotalPrice = document.getElementById("cart-total-price");

        if (!cartItems) return;

        try {
            const response = await fetch('/cart/data/');
            if (!response.ok) throw new Error('Network response was not ok');

            const data = await response.json();

            // ✅ آپدیت بج هدر
            const cartBadge = document.getElementById('cart-badge');
            if (cartBadge) {
                if (data.total_items > 0) {
                    cartBadge.textContent = new Intl.NumberFormat("fa-IR").format(data.total_items);
                    cartBadge.style.display = 'flex';
                } else {
                    cartBadge.style.display = 'none';
                }
            }

            // ✅ آپدیت بج موبایل (سینک با هدر)
            const mobileBadge = document.getElementById('cart-badge-mobile');
            if (mobileBadge) {
                if (data.total_items > 0) {
                    mobileBadge.textContent = new Intl.NumberFormat("fa-IR").format(data.total_items);
                    mobileBadge.style.display = 'flex';
                } else {
                    mobileBadge.style.display = 'none';
                }
            }

            // ✅ نمایش آیتم‌ها
            if (data.items.length === 0) {
                cartItems.innerHTML = `
                    <div class="empty-cart">
                        <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <circle cx="8" cy="21" r="1"></circle>
                            <circle cx="19" cy="21" r="1"></circle>
                            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
                        </svg>
                        <p>سبد خرید شما خالی است</p>
                    </div>
                `;
                if (cartFooter) cartFooter.style.display = "none";
            } else {
                cartItems.innerHTML = data.items.map(item => `
                    <div class="cart-item" data-product-id="${item.id}">
                        <img src="${item.image_url || '/static/images/placeholder.jpg'}" 
                             alt="${item.name}" 
                             class="cart-item-image"
                             onerror="this.src='/static/images/placeholder.jpg'">
                        <div class="cart-item-info">
                            <div class="cart-item-name">${item.name}</div>
                            <div class="cart-item-price">${new Intl.NumberFormat("fa-IR").format(item.price)} تومان</div>
                            <div class="cart-item-controls">
                                <span class="quantity-display">${new Intl.NumberFormat("fa-IR").format(item.quantity)}×</span>
                            </div>
                        </div>
                    </div>
                `).join("");

                if (cartTotalPrice) {
                    cartTotalPrice.textContent = new Intl.NumberFormat("fa-IR").format(data.total_price) + ' تومان';
                }
                if (cartFooter) cartFooter.style.display = "block";
            }
        } catch (error) {
            console.error('❌ Failed to update cart UI:', error);
        }
    }

    // ========================================
    // Event Listeners
    // ========================================

    // ۱. باز کردن سبد با کلیک روی آیکون
    document.body.addEventListener('click', function(e) {
        if (e.target.closest('.cart-icon-btn')) {
            e.preventDefault();
            e.stopPropagation();
            openCart();
            return;
        }
    });

    // ۲. بستن سبد با کلیک روی overlay
    const cartOverlay = document.getElementById('cart-overlay');
    if (cartOverlay) {
        cartOverlay.addEventListener('click', closeCart);
    }

    // ۳. بستن سبد با دکمه close
    const cartCloseBtn = document.querySelector('.cart-close-btn');
    if (cartCloseBtn) {
        cartCloseBtn.addEventListener('click', closeCart);
    }

    // ۴. بستن با کلید Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const sidebar = document.getElementById('cart-sidebar');
            if (sidebar && sidebar.classList.contains('active')) {
                closeCart();
            }
        }
    });

    // ========================================
    // لود اولیه
    // ========================================
    updateCartUI();

    // آپدیت هر ۳۰ ثانیه (اختیاری)
    // setInterval(updateCartUI, 30000);

    console.log('✅ Shopping Cart JS loaded successfully!');
});