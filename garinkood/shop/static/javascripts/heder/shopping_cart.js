// Shopping Cart AJAX - نسخه نهایی
document.addEventListener('DOMContentLoaded', function() {
    const csrftoken = window.CSRF_TOKEN;

    // تابع toggleCart را تعریف کنید
    function toggleCart(forceOpen = false) {
        const overlay = document.getElementById("cart-overlay");
        const sidebar = document.getElementById("cart-sidebar");

        if (!overlay || !sidebar) return;

        if (forceOpen) {
            overlay.classList.add("active");
            sidebar.classList.add("active");
            document.body.style.overflow = 'hidden';
        } else {
            overlay.classList.toggle("active");
            sidebar.classList.toggle("active");
            document.body.style.overflow = overlay.classList.contains("active") ? 'hidden' : '';
        }
    }

    // تابع updateCartUI را تعریف کنید
    async function updateCartUI() {
        const cartItems = document.getElementById("cart-items");
        const cartFooter = document.getElementById("cart-footer");
        const cartTotalPrice = document.getElementById("cart-total-price");

        if (!cartItems) return;

        try {
            const response = await fetch('/cart/data/');
            const data = await response.json();

            // آپدیت بج
            const cartBadge = document.getElementById('cart-badge');
            if (cartBadge) {
                if (data.total_items > 0) {
                    cartBadge.textContent = new Intl.NumberFormat("fa-IR").format(data.total_items);
                    cartBadge.style.display = 'flex';
                } else {
                    cartBadge.style.display = 'none';
                }
            }

            if (data.items.length === 0) {
                cartItems.innerHTML = `<div class="empty-cart"><p>سبد خرید شما خالی است</p></div>`;
                if (cartFooter) cartFooter.style.display = "none";
            } else {
                cartItems.innerHTML = data.items.map(item => `
                    <div class="cart-item">
                        <img src="${item.image_url || '/static/images/placeholder.jpg'}" 
                             alt="${item.name}" class="cart-item-image">
                        <div class="cart-item-info">
                            <div class="cart-item-name">${item.name}</div>
                            <div class="cart-item-price">${new Intl.NumberFormat("fa-IR").format(item.price)} تومان</div>
                        </div>
                    </div>
                `).join("");
                if (cartTotalPrice) cartTotalPrice.textContent = new Intl.NumberFormat("fa-IR").format(data.total_price) + ' تومان';
                if (cartFooter) cartFooter.style.display = "block";
            }
        } catch (error) {
            console.error('Failed to update cart UI:', error);
        }
    }

    // Event listeners
    document.body.addEventListener('click', (e) => {
        // باز کردن سبد خرید
        if (e.target.closest('.cart-icon-btn')) {
            toggleCart();
            return;
        }

        // بستن سبد خرید
        if (e.target.id === 'cart-overlay' || e.target.closest('.cart-close-btn')) {
            toggleCart(false);
            return;
        }
    });

    // لود اولیه سبد خرید
    updateCartUI();
});