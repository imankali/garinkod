// Desktop and Mobile Search Filters
document.addEventListener('DOMContentLoaded', function() {
    // Desktop Filters
    const toggleBtn = document.getElementById('toggle-desktop-filters');
    const filtersPanel = document.getElementById('desktop-filters-panel');
    const desktopForm = document.getElementById('desktop-search-form');
    const applyDesktop = document.getElementById('desktop-apply-filters');
    const resetDesktop = document.getElementById('desktop-reset-filters');
    const submitDesktop = document.getElementById('desktop-search-submit');

    let isDesktopOpen = false;

    function updateDesktopToggle() {
        if (!toggleBtn) return;
        const svg = toggleBtn.querySelector('svg');
        if (!svg) return;
        
        if (isDesktopOpen) {
            svg.innerHTML = '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>';
            toggleBtn.setAttribute('aria-label', 'بستن فیلترها');
            toggleBtn.setAttribute('aria-expanded', 'true');
        } else {
            svg.innerHTML = '<line x1="4" y1="8" x2="20" y2="8"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="16" x2="20" y2="16"></line>';
            toggleBtn.setAttribute('aria-label', 'فیلترها');
            toggleBtn.setAttribute('aria-expanded', 'false');
        }
    }

    if (toggleBtn && filtersPanel) {
        toggleBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            isDesktopOpen = !isDesktopOpen;
            filtersPanel.style.display = isDesktopOpen ? 'block' : 'none';
            updateDesktopToggle();
        });

        document.addEventListener('click', function(e) {
            if (isDesktopOpen && !filtersPanel.contains(e.target) && e.target !== toggleBtn) {
                filtersPanel.style.display = 'none';
                isDesktopOpen = false;
                updateDesktopToggle();
            }
        });

        if (applyDesktop) applyDesktop.addEventListener('click', () => desktopForm.submit());
        if (resetDesktop) resetDesktop.addEventListener('click', () => {
            filtersPanel.querySelectorAll('input, select').forEach(el => el.value = '');
        });
        if (submitDesktop) {
            desktopForm.addEventListener('submit', e => {
                e.preventDefault();
                submitDesktop.disabled = true;
                submitDesktop.textContent = 'در حال جستجو...';
                setTimeout(() => desktopForm.submit(), 300);
            });
        }
    }

    // Mobile Search Modal
    const mobileOpen = document.getElementById('mobile-search-open');
    const modal = document.getElementById('search-modal');
    const closeBtn = document.getElementById('search-modal-close');
    const mobileForm = document.getElementById('mobile-search-form');
    const mobileSubmit = document.getElementById('mobile-search-submit');

    function trapFocus(el) {
        if (!el) return;
        const focusable = el.querySelectorAll('button, [href], input, select, [tabindex]:not([tabindex="-1"])');
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        el.addEventListener('keydown', e => {
            if (e.key === 'Tab') {
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault(); last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault(); first.focus();
                }
            }
        });
        first.focus();
    }

    function closeModal() {
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            const btn = document.querySelector('.mobile-search-btn');
            if (btn) btn.focus();
        }
    }

    function openModal() {
        if (modal) {
            // بستن منوی موبایل اگر باز است
            const mobileMenu = document.getElementById('mobile-menu');
            if (mobileMenu && mobileMenu.classList.contains('open')) {
                mobileMenu.classList.remove('open');
                document.getElementById('mobile-menu-overlay')?.classList.remove('active');
            }
            
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            trapFocus(document.getElementById('filters-content'));
        }
    }

    if (mobileOpen) mobileOpen.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (modal) modal.addEventListener('click', e => e.target === modal && closeModal());
    document.addEventListener('keydown', e => e.key === 'Escape' && modal && modal.classList.contains('active') && closeModal());

    // Submit on Enter in mobile inputs
    if (modal) {
        const mobileInputs = modal.querySelectorAll('.filter-input, .filter-select');
        mobileInputs.forEach(input => {
            input.addEventListener('keypress', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (mobileForm) mobileForm.submit();
                }
            });
        });
    }

    if (mobileSubmit && mobileForm) {
        mobileForm.addEventListener('submit', e => {
            e.preventDefault();
            mobileSubmit.disabled = true;
            mobileSubmit.textContent = 'در حال جستجو...';
            setTimeout(() => mobileForm.submit(), 300);
        });
    }

    if (document.getElementById('mobile-reset-filters') && mobileForm) {
        document.getElementById('mobile-reset-filters').addEventListener('click', () => {
            mobileForm.querySelectorAll('input, select').forEach(el => el.value = '');
        });
    }
});