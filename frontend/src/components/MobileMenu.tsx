// frontend/src/components/MobileMenu.tsx

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Heart, LogIn, LogOut, Package, Phone, User, X } from "lucide-react";
import { categories } from "../data/shopData";
import { useAuthStore } from "../store/authStore";
import SearchBar from "./SearchBar";
import Logo from "./Logo";

// ========================================
// Types
// ========================================
interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenWishlist?: () => void;
}

// ========================================
// Quick Links Configuration
// ========================================
const quickLinks = [
  { label: "خانه", href: "/" },
  { label: "محصولات", href: "/products" },
  { label: "خدمات کشاورزی", href: "/services" },
  { label: "بازار کشاورزان", href: "/marketplace" },
  { label: "فروش محصول به گرین کود", href: "/farmer-sell" },
  { label: "تخفیف‌های ویژه", href: "/products?featured=true" },
];

// ========================================
// MobileMenu Component
// ========================================
export default function MobileMenu({ isOpen, onClose, onOpenWishlist }: MobileMenuProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  // دریافت اطلاعات کاربر از auth store
  const { user, isAuthenticated, logout } = useAuthStore();

  // ========================================
  // Handlers
  // ========================================
  async function handleLogout() {
    await logout();
    onClose();
    window.location.href = '/';
  }

  function handleCategoryClick(categorySlug: string) {
    onClose();
    window.location.href = `/products?category=${categorySlug}`;
  }

  function handleLinkClick(href: string) {
    onClose();
    window.location.href = href;
  }

  function handleWishlistClick() {
    onClose();
    if (onOpenWishlist) {
      onOpenWishlist();
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ======================================== */}
          {/* Overlay */}
          {/* ======================================== */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm lg:hidden"
          />

          {/* ======================================== */}
          {/* Menu Panel */}
          {/* ======================================== */}
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 260 }}
            className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-sm flex-col bg-white shadow-2xl lg:hidden dark:bg-emerald-950"
          >
            {/* ======================================== */}
            {/* Header */}
            {/* ======================================== */}
            <div className="flex items-center justify-between border-b border-emerald-100 bg-gradient-to-l from-emerald-50 to-lime-50 px-4 py-4 dark:border-emerald-800 dark:from-emerald-950 dark:to-emerald-900/50">
              <Logo compact />
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow transition-transform hover:rotate-90 dark:bg-emerald-900 dark:text-emerald-200"
                aria-label="بستن منو"
              >
                <X size={18} />
              </button>
            </div>

            {/* ======================================== */}
            {/* User Info (اگر لاگین کرده) */}
            {/* ======================================== */}
            {isAuthenticated && user && (
              <div className="border-b border-emerald-100 bg-gradient-to-l from-emerald-600 to-lime-500 p-4 text-white dark:border-emerald-800">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-lg font-bold backdrop-blur">
                    {user.first_name?.charAt(0) || user.username.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="font-bold">
                      {user.first_name || user.username}
                    </p>
                    <p className="text-xs text-white/80">{user.email}</p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleLinkClick('/profile')}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/15 py-2 text-xs font-medium backdrop-blur hover:bg-white/25"
                  >
                    <User size={14} /> پروفایل
                  </button>
                  <button
                    onClick={() => handleLinkClick('/orders')}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/15 py-2 text-xs font-medium backdrop-blur hover:bg-white/25"
                  >
                    <Package size={14} /> سفارش‌ها
                  </button>
                  <button
                    onClick={handleWishlistClick}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/15 py-2 text-xs font-medium backdrop-blur hover:bg-white/25"
                  >
                    <Heart size={14} /> علاقه‌مندی
                  </button>
                </div>
              </div>
            )}

            {/* ======================================== */}
            {/* Search Bar */}
            {/* ======================================== */}
            <div className="border-b border-slate-100 p-4 dark:border-emerald-800">
              <SearchBar variant="mobile" />
            </div>

            {/* ======================================== */}
            {/* Scrollable Content */}
            {/* ======================================== */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* ======================================== */}
              {/* Categories */}
              {/* ======================================== */}
              <p className="mb-2 px-1 text-xs font-semibold text-slate-400 dark:text-emerald-300">
                دسته‌بندی محصولات
              </p>
              <ul className="space-y-1.5">
                {categories.map((cat) => (
                  <li key={cat.id} className="overflow-hidden rounded-xl border border-slate-100 dark:border-emerald-800">
                    {/* Category Header */}
                    <button
                      onClick={() => setExpanded(expanded === cat.id ? null : cat.id)}
                      className="flex w-full items-center justify-between gap-2 bg-slate-50/60 px-3 py-3 text-right dark:bg-emerald-900/40"
                      aria-expanded={expanded === cat.id}
                    >
                      <span className="flex items-center gap-2.5">
                        <span
                          className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${cat.color} text-white`}
                        >
                          <cat.icon size={16} />
                        </span>
                        <span className="text-sm font-medium text-slate-700 dark:text-emerald-50">
                          {cat.label}
                        </span>
                      </span>
                      <ChevronDown
                        size={16}
                        className={`text-slate-400 transition-transform duration-300 dark:text-emerald-400 ${
                          expanded === cat.id ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {/* Subcategories */}
                    <AnimatePresence>
                      {expanded === cat.id && (
                        <motion.ul
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="bg-white dark:bg-emerald-950"
                        >
                          {cat.items.map((sub) => (
                            <li key={sub.id}>
                              <button
                                onClick={() => handleCategoryClick(sub.id)}
                                className="block w-full border-t border-dashed border-slate-100 py-2.5 pr-11 text-right text-sm text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900"
                              >
                                {sub.label}
                              </button>
                            </li>
                          ))}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </li>
                ))}
              </ul>

              {/* ======================================== */}
              {/* Quick Links */}
              {/* ======================================== */}
              <p className="mb-2 mt-5 px-1 text-xs font-semibold text-slate-400 dark:text-emerald-300">
                دسترسی سریع
              </p>
              <ul className="space-y-1">
                {quickLinks.map((link) => (
                  <li key={link.label}>
                    <button
                      onClick={() => handleLinkClick(link.href)}
                      className="block w-full rounded-lg px-3 py-2.5 text-right text-sm text-slate-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-100 dark:hover:bg-emerald-900"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* ======================================== */}
            {/* Footer Actions */}
            {/* ======================================== */}
            <div className="space-y-2 border-t border-slate-100 p-4 dark:border-emerald-800">
              {/* Contact Support */}
              <a
                href="tel:02112345678"
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 py-3 text-sm font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/50 dark:text-lime-300"
              >
                <Phone size={16} /> تماس با پشتیبانی
              </a>

              {/* Auth Button */}
              {isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-50 py-3 text-sm font-medium text-rose-500 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  <LogOut size={16} /> خروج از حساب
                </button>
              ) : (
                <button
                  onClick={() => handleLinkClick('/login')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-lime-500 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl"
                >
                  <LogIn size={16} /> ورود / ثبت‌نام
                </button>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}