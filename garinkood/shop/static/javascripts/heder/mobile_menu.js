// Mobile Menu Toggle
document.addEventListener('DOMContentLoaded', function() {
    const menuOpenBtn = document.getElementById('mobile-menu-open');
    const menuCloseBtn = document.getElementById('mobile-menu-close');
    const mobileMenu = document.getElementById('mobile-menu');
    const menuOverlay = document.getElementById('mobile-menu-overlay');

    if (!menuOpenBtn || !mobileMenu || !menuOverlay) return;

    function closeMobileMenu() {
        mobileMenu.classList.remove('open');
        menuOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    function openMobileMenu() {
        // بستن مودال جستجو اگر باز است
        const searchModal = document.getElementById('search-modal');
        if (searchModal) searchModal.classList.remove('active');

        mobileMenu.classList.add('open');
        menuOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    if (menuOpenBtn) menuOpenBtn.addEventListener('click', openMobileMenu);
    if (menuCloseBtn) menuCloseBtn.addEventListener('click', closeMobileMenu);
    if (menuOverlay) menuOverlay.addEventListener('click', closeMobileMenu);

    // بستن با کلید Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
            closeMobileMenu();
        }
    });
});