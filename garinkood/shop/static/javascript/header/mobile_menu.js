// ========================================
// Mobile Menu Toggle - نسخه نهایی
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    const menuOpenBtn = document.getElementById('mobile-menu-open');
    const menuCloseBtn = document.getElementById('mobile-menu-close');
    const mobileMenu = document.getElementById('mobile-menu');
    const menuOverlay = document.getElementById('mobile-menu-overlay');

    if (!menuOpenBtn || !mobileMenu) {
        console.warn('⚠️ Mobile menu elements not found!');
        return;
    }

    function openMobileMenu() {
        // بستن سبد خرید اگر باز است
        const cartSidebar = document.getElementById('cart-sidebar');
        if (cartSidebar && cartSidebar.classList.contains('active')) {
            cartSidebar.classList.remove('active');
            const cartOverlay = document.getElementById('cart-overlay');
            if (cartOverlay) cartOverlay.classList.remove('active');
        }

        mobileMenu.classList.add('open');
        if (menuOverlay) menuOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        console.log('✅ Mobile menu opened');
    }

    function closeMobileMenu() {
        mobileMenu.classList.remove('open');
        if (menuOverlay) menuOverlay.classList.remove('active');
        document.body.style.overflow = '';
        console.log('✅ Mobile menu closed');
    }

    // Event Listeners
    menuOpenBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        openMobileMenu();
    });

    if (menuCloseBtn) {
        menuCloseBtn.addEventListener('click', function(e) {
            e.preventDefault();
            closeMobileMenu();
        });
    }

    if (menuOverlay) {
        menuOverlay.addEventListener('click', closeMobileMenu);
    }

    // بستن با Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
            closeMobileMenu();
        }
    });

    console.log('✅ Mobile Menu JS loaded successfully!');
});