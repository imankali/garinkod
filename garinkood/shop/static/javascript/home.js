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


