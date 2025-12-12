
/* (اسکریپت‌ها بدون تغییر — همان اسکریپت قبلی) */
document.addEventListener('DOMContentLoaded', function () {
  function setLoading(btn, isLoading) {
    if (isLoading) {
      btn.disabled = true;
      btn.textContent = 'در حال جستجو...';
    } else {
      btn.disabled = false;
      btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>';
    }
  }

  // Desktop Filters
  const toggleBtn = document.getElementById('toggle-desktop-filters');
  const filtersPanel = document.getElementById('desktop-filters-panel');
  const desktopForm = document.getElementById('desktop-search-form');
  const applyDesktop = document.getElementById('desktop-apply-filters');
  const resetDesktop = document.getElementById('desktop-reset-filters');
  const submitDesktop = document.getElementById('desktop-search-submit');

  let isDesktopOpen = false;

  function updateDesktopToggle() {
    const svg = toggleBtn.querySelector('svg');
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
        setLoading(submitDesktop, true);
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
    modal.classList.remove('active');
    document.body.style.overflow = '';
    document.querySelector('.mobile-search-btn').focus();
  }

  function openModal() {
    closeMobileMenu();
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    trapFocus(document.getElementById('filters-content'));
  }

  if (mobileOpen) mobileOpen.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (modal) modal.addEventListener('click', e => e.target === modal && closeModal());
  document.addEventListener('keydown', e => e.key === 'Escape' && modal.classList.contains('active') && closeModal());

  const mobileInputs = modal.querySelectorAll('.filter-input, .filter-select');
  mobileInputs.forEach(input => input.addEventListener('keypress', e => e.key === 'Enter' && (e.preventDefault(), mobileForm.submit())));

  if (mobileSubmit) {
    mobileForm.addEventListener('submit', e => {
      e.preventDefault();
      mobileSubmit.disabled = true;
      mobileSubmit.textContent = 'در حال جستجو...';
      setTimeout(() => mobileForm.submit(), 300);
    });
  }

  if (document.getElementById('mobile-reset-filters')) {
    document.getElementById('mobile-reset-filters').addEventListener('click', () => {
      mobileForm.querySelectorAll('input, select').forEach(el => el.value = '');
    });
  }

  // Mobile Menu
  const menuOpenBtn = document.getElementById('mobile-menu-open');
  const menuCloseBtn = document.getElementById('mobile-menu-close');
  const mobileMenu = document.getElementById('mobile-menu');
  const menuOverlay = document.getElementById('mobile-menu-overlay');

  function closeMobileMenu() {
    mobileMenu.classList.remove('open');
    menuOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  function openMobileMenu() {
    closeModal();
    mobileMenu.classList.add('open');
    menuOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  if (menuOpenBtn) menuOpenBtn.addEventListener('click', openMobileMenu);
  if (menuCloseBtn) menuCloseBtn.addEventListener('click', closeMobileMenu);
  if (menuOverlay) menuOverlay.addEventListener('click', closeMobileMenu);
  document.addEventListener('keydown', e => e.key === 'Escape' && mobileMenu.classList.contains('open') && closeMobileMenu());
});
// ======================
// متغیرهای سراسری
// ======================
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
// سبد خرید (متصل به بک‌اند)
// ======================

// تابع کمکی برای گرفتن توکن CSRF
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

const csrftoken = getCookie('csrftoken');

async function addToCart(productId, quantity = 1) {
    const url = `/cart/add/${productId}/`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken,
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ 'quantity': quantity })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        if (data.success) {
            updateCartBadge(data.total_items);
            await updateCartUI();
            setTimeout(() => {
                toggleCart(true);
            }, 100);
        }
    } catch (error) {
        console.error('There has been a problem with your fetch operation:', error);
    }
}

function updateCartBadge(totalItems) {
    const cartBadge = document.getElementById('cart-badge');
    if (cartBadge) {
        if (totalItems > 0) {
            cartBadge.textContent = new Intl.NumberFormat("fa-IR").format(totalItems);
            cartBadge.style.display = 'flex';
        } else {
            cartBadge.style.display = 'none';
        }
    }
}

async function updateCartUI() {
    const cartItems = document.getElementById("cart-items");
    const cartFooter = document.getElementById("cart-footer");
    const cartTotalPrice = document.getElementById("cart-total-price");

    try {
        const response = await fetch('/cart/data/');
        const data = await response.json();

        updateCartBadge(data.total_items);

        if (data.items.length === 0) {
            cartItems.innerHTML = `<div class="empty-cart"><p>سبد خرید شما خالی است</p></div>`;
            cartFooter.style.display = "none";
        } else {
            cartItems.innerHTML = data.items.map(item => `
                <div class="cart-item">
                    <img src="${item.image_url}" alt="${item.name}" class="cart-item-image">
                    <div class="cart-item-info">
                        <div class="cart-item-name">${item.name}</div>
                        <div class="cart-item-price">${new Intl.NumberFormat("fa-IR").format(item.price)} تومان</div>
                    </div>
                </div>
            `).join("");
            cartTotalPrice.textContent = new Intl.NumberFormat("fa-IR").format(data.total_price);
            cartFooter.style.display = "block";
        }
    } catch (error) {
        console.error('Failed to update cart UI:', error);
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
// راه‌اندازی
// ======================

document.addEventListener("DOMContentLoaded", () => {
    startHeroSlider();
    updateCartUI(); // لود اولیه سبد خرید

    document.body.addEventListener('click', (e) => {
        const button = e.target.closest('.add-to-cart-btn');
        if (button) {
            e.preventDefault();
            const productId = button.dataset.productId;
            if (productId) {
                addToCart(productId);
            }
        }

        if (e.target.closest('.cart-icon-btn')) {
            toggleCart();
        }
        if (e.target.id === 'cart-overlay' || e.target.closest('.cart-close-btn')) {
            toggleCart(false);
        }
    });
});
