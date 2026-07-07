// frontend/src/App.tsx
// ✅ فایل اصلی اپلیکیشن - نقطه اتصال همه کامپوننت‌ها

import { useEffect, useState, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

// ========================================
// Components
// ========================================
import Header from "./components/Header";
import MobileBottomNav from "./components/MobileBottomNav";
import CartDrawer from "./components/CartDrawer";
import ProductCard from "./components/ProductCard";
import ProductDetailModal from "./components/ProductDetailModal";
import WishlistModal from "./components/WishlistModal";
import CompareBar from "./components/CompareBar";
import CompareModal from "./components/CompareModal";
import FilterSortBar from "./components/FilterSortBar";
import WeatherWidget from "./components/WeatherWidget";
import InstallmentBanner from "./components/InstallmentBanner";
import ScrollProgressBar from "./components/ScrollProgressBar";
import FlyToCart, { type FlyingItem } from "./components/FlyToCart";
import ConsultationButton from "./components/ConsultationButton";
import CropSelector from "./components/CropSelector";
import AgriCalculator from "./components/AgriCalculator";

// ========================================
// Pages (Lazy Loaded)
// ========================================
const Login = lazy(() => import("./pages/Login"));
const Profile = lazy(() => import("./pages/Profile"));

// ========================================
// Stores
// ========================================
import { useCartStore } from "./store/cartStore";
import { useAuthStore } from "./store/authStore";

// ========================================
// API Services
// ========================================
import { productsApi } from "./api/services";

// ========================================
// Hooks
// ========================================
import { useDarkMode } from "./hooks/useDarkMode";

// ========================================
// Types
// ========================================
import type { MockProduct, ProductList } from "./types";

// ========================================
// Helper: تبدیل ProductList به MockProduct
// ========================================
function convertToMockProduct(apiProduct: ProductList): MockProduct {
  return {
    id: apiProduct.id,
    name: apiProduct.title,
    category: typeof apiProduct.category === 'string' ? apiProduct.category : 'کود کشاورزی',
    categoryId: 'fertilizer',
    subCategoryId: '',
    brand: 'گرین کود',
    price: apiProduct.price,
    rating: 4.5,
    reviews: 0,
    image: apiProduct.image_url || '/images/products/default.jpg',
    inStock: apiProduct.is_in_stock,
    description: '',
    features: [],
    cropTags: [],
    pestTags: [],
    usage: {
      dosage: '',
      method: '',
      timing: '',
    },
    warnings: [],
    compatibleWith: [],
    brochureAvailable: false,
  };
}

// ========================================
// Loading Spinner Component
// ========================================
function LoadingSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center py-12">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
    </div>
  );
}

// ========================================
// App Component
// ========================================
export default function App() {
  // ========================================
  // Dark Mode
  // ========================================
  const { isDark, toggle: toggleDark } = useDarkMode();

  // ========================================
  // UI State
  // ========================================
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<MockProduct | null>(null);
  const [activeCrop, setActiveCrop] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [sort, setSort] = useState<"popular" | "cheapest" | "expensive" | "rating">("popular");
  const [priceLimit, setPriceLimit] = useState<number>(10000000);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);

  // ========================================
  // Wishlist & Compare (LocalStorage)
  // ========================================
  const [wishlist, setWishlist] = useState<MockProduct[]>(() => {
    try {
      const stored = localStorage.getItem('wishlist');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [compareItems, setCompareItems] = useState<MockProduct[]>([]);

  // ========================================
  // FlyToCart Animation
  // ========================================
  const [flyingItems, setFlyingItems] = useState<FlyingItem[]>([]);

  // ========================================
  // Stores
  // ========================================
  const { cart, fetchCart, addToCart: addToCartStore } = useCartStore();
  const { isAuthenticated, fetchProfile } = useAuthStore();

  // ========================================
  // Fetch Cart on Mount
  // ========================================
  useEffect(() => {
    fetchCart();
    if (isAuthenticated) {
      fetchProfile();
    }
  }, [fetchCart, isAuthenticated, fetchProfile]);

  // ========================================
  // Fetch Products from API
  // ========================================
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products', activeCategory, sort, inStockOnly, priceLimit],
    queryFn: async () => {
      const params: any = { page: 1 };

      if (activeCategory !== 'all') {
        params.category = activeCategory;
      }

      if (inStockOnly) {
        params.available = true;
      }

      if (priceLimit < 10000000) {
        params.max_price = priceLimit;
      }

      // Sort mapping
      const sortMapping: Record<string, string> = {
        'popular': '-publish',
        'cheapest': 'price',
        'expensive': '-price',
        'rating': '-rating',
      };

      if (sort !== 'popular') {
        params.ordering = sortMapping[sort];
      }

      const response = await productsApi.getAll(params);
      return response.data.results || [];
    },
    staleTime: 30000, // 30 ثانیه cache
  });

  // تبدیل محصولات API به MockProduct
  const products: MockProduct[] = (productsData || []).map(convertToMockProduct);

  // ========================================
  // Filter by Crop
  // ========================================
  const filteredProducts = activeCrop
    ? products.filter((p) => p.cropTags.includes(activeCrop))
    : products;

  // ========================================
  // Save Wishlist to LocalStorage
  // ========================================
  useEffect(() => {
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  // ========================================
  // Handlers
  // ========================================
  function handleToggleWishlist(product: MockProduct) {
    setWishlist((prev) => {
      const exists = prev.find((p) => p.id === product.id);
      if (exists) {
        return prev.filter((p) => p.id !== product.id);
      }
      return [...prev, product];
    });
  }

  function handleToggleCompare(product: MockProduct) {
    setCompareItems((prev) => {
      const exists = prev.find((p) => p.id === product.id);
      if (exists) {
        return prev.filter((p) => p.id !== product.id);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, product];
    });
  }

  async function handleAddToCart(product: MockProduct, qty: number = 1, e?: React.MouseEvent) {
    // FlyToCart Animation
    if (e) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const newFlyingItem: FlyingItem = {
        key: Date.now(),
        image: product.image,
        startX: rect.left + rect.width / 2,
        startY: rect.top + rect.height / 2,
      };
      setFlyingItems((prev) => [...prev, newFlyingItem]);
    }

    // Add to cart store
    try {
      await addToCartStore(product.id, qty);
    } catch (error) {
      console.error('Failed to add to cart:', error);
    }
  }

  function handleRemoveFromCompare(id: number) {
    setCompareItems((prev) => prev.filter((p) => p.id !== id));
  }

  function handleClearCompare() {
    setCompareItems([]);
  }

  function handleFlyingComplete(key: number) {
    setFlyingItems((prev) => prev.filter((item) => item.key !== key));
  }

  // ========================================
  // Max Price for Filter
  // ========================================
  const maxPrice = products.length > 0
    ? Math.max(...products.map((p) => p.price))
    : 10000000;

  // ========================================
  // Render
  // ========================================
  return (
    <BrowserRouter>
      {/* ✅ div اصلی با min-h-screen و w-full */}
      <div
        className={`min-h-screen w-full overflow-x-hidden ${isDark ? 'dark' : ''}`}
        dir="rtl"
      >
        {/* ======================================== */}
        {/* Scroll Progress Bar */}
        {/* ======================================== */}
        <ScrollProgressBar />

        {/* ======================================== */}
        {/* Toast Notifications */}
        {/* ======================================== */}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: isDark ? '#052e22' : '#fff',
              color: isDark ? '#fff' : '#1f2937',
              borderRadius: '12px',
              padding: '12px 16px',
              fontSize: '14px',
            },
          }}
        />

        {/* ======================================== */}
        {/* FlyToCart Animation */}
        {/* ======================================== */}
        <FlyToCart items={flyingItems} onComplete={handleFlyingComplete} />

        {/* ======================================== */}
        {/* Header */}
        {/* ======================================== */}
        <Header
          cartOpen={cartOpen}
          onCartOpenChange={setCartOpen}
          mobileOpen={mobileOpen}
          onMobileOpenChange={setMobileOpen}
          isDark={isDark}
          onToggleDark={toggleDark}
          wishlistCount={wishlist.length}
          onOpenWishlist={() => setWishlistOpen(true)}
        />

        {/* ======================================== */}
        {/* Main Content */}
        {/* ✅ pb-24 برای MobileBottomNav در موبایل */}
        {/* ✅ lg:pb-8 برای دسکتاپ */}
        {/* ======================================== */}
        <main className="pb-24 lg:pb-8">
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              {/* ======================================== */}
              {/* Home Page */}
              {/* ======================================== */}
              <Route
                path="/"
                element={
                  <>
                    {/* Weather Widget */}
                    <WeatherWidget />

                    {/* Crop Selector */}
                    <CropSelector activeCrop={activeCrop} onSelectCrop={setActiveCrop} />

                    {/* Installment Banner */}
                    <InstallmentBanner />

                    {/* Filter & Sort Bar */}
                    <div className="mx-auto max-w-7xl px-4">
                      <FilterSortBar
                        activeCategory={activeCategory}
                        onCategoryChange={setActiveCategory}
                        sort={sort}
                        onSortChange={setSort}
                        maxPrice={maxPrice}
                        priceLimit={priceLimit}
                        onPriceLimitChange={setPriceLimit}
                        resultsCount={filteredProducts.length}
                        selectedBrand={selectedBrand}
                        onBrandChange={setSelectedBrand}
                        inStockOnly={inStockOnly}
                        onInStockChange={setInStockOnly}
                      />
                    </div>

                    {/* Products Grid */}
                    <section className="mx-auto max-w-7xl px-4 py-8">
                      {productsLoading ? (
                        <LoadingSpinner />
                      ) : filteredProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <div className="text-6xl mb-4">🔍</div>
                          <p className="text-lg font-bold text-slate-700 dark:text-white">
                            محصولی یافت نشد
                          </p>
                          <p className="mt-2 text-sm text-slate-500 dark:text-emerald-300">
                            فیلترها را تغییر دهید یا عبارت دیگری جستجو کنید
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4">
                          {filteredProducts.map((product, idx) => (
                            <ProductCard
                              key={product.id}
                              product={product}
                              index={idx}
                              isWishlisted={wishlist.some((p) => p.id === product.id)}
                              isComparing={compareItems.some((p) => p.id === product.id)}
                              compareDisabled={compareItems.length >= 3}
                              onToggleWishlist={handleToggleWishlist}
                              onAddToCart={handleAddToCart}
                              onQuickView={setSelectedProduct}
                              onToggleCompare={handleToggleCompare}
                            />
                          ))}
                        </div>
                      )}
                    </section>

                    {/* AgriCalculator */}
                    <AgriCalculator onAddToCart={handleAddToCart} />
                  </>
                }
              />

              {/* ======================================== */}
              {/* Login Page */}
              {/* ======================================== */}
              <Route path="/login" element={<Login />} />

              {/* ======================================== */}
              {/* Profile Page */}
              {/* ======================================== */}
              <Route path="/profile" element={<Profile />} />

              {/* ======================================== */}
              {/* 404 Page */}
              {/* ======================================== */}
              <Route
                path="*"
                element={
                  <div className="flex min-h-[70vh] items-center justify-center px-4">
                    <div className="text-center">
                      <div className="text-6xl mb-4">404</div>
                      <p className="text-lg font-bold text-slate-700 dark:text-white">
                        صفحه مورد نظر یافت نشد
                      </p>
                      <a
                        href="/"
                        className="mt-4 inline-block rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 transition-colors"
                      >
                        بازگشت به صفحه اصلی
                      </a>
                    </div>
                  </div>
                }
              />
            </Routes>
          </Suspense>
        </main>

        {/* ======================================== */}
        {/* Mobile Bottom Nav */}
        {/* ======================================== */}
        <MobileBottomNav
          cartCount={cart?.total_items || 0}
          wishlistCount={wishlist.length}
          onOpenCart={() => setCartOpen(true)}
          onOpenMenu={() => setMobileOpen(true)}
          onOpenWishlist={() => setWishlistOpen(true)}
        />

        {/* ======================================== */}
        {/* Cart Drawer */}
        {/* ======================================== */}
        <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />

        {/* ======================================== */}
        {/* Product Detail Modal */}
        {/* ======================================== */}
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
          isWishlisted={selectedProduct ? wishlist.some((p) => p.id === selectedProduct.id) : false}
          onToggleWishlist={handleToggleWishlist}
        />

        {/* ======================================== */}
        {/* Wishlist Modal */}
        {/* ✅ فقط وقتی wishlistOpen true است render می‌شود */}
        {/* ======================================== */}
        {wishlistOpen && (
          <WishlistModal
            wishlist={wishlist}
            onClose={() => setWishlistOpen(false)}
            onRemove={(id) => setWishlist((prev) => prev.filter((p) => p.id !== id))}
            onAddToCart={handleAddToCart}
          />
        )}

        {/* ======================================== */}
        {/* Compare Bar */}
        {/* ======================================== */}
        <CompareBar
          items={compareItems}
          onRemove={handleRemoveFromCompare}
          onOpenCompare={() => setCompareOpen(true)}
          onClear={handleClearCompare}
        />

        {/* ======================================== */}
        {/* Compare Modal */}
        {/* ======================================== */}
        <CompareModal
          items={compareItems}
          onClose={() => setCompareOpen(false)}
          onAddToCart={(product) => handleAddToCart(product, 1)}
        />

        {/* ======================================== */}
        {/* Consultation Button */}
        {/* ======================================== */}
        <ConsultationButton />
      </div>
    </BrowserRouter>
  );
}