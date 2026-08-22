// frontend/src/components/ProfileMenu.tsx

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gift, Landmark, LogIn, LogOut, Package, Store, User } from "lucide-react";
import { useAuthStore } from "../store/authStore";

// ========================================
// Types
// ========================================
interface MenuItem {
  icon: typeof User;
  label: string;
  desc: string;
  href: string;
}

interface ProfileMenuProps {
  // در آینده می‌توان props اضافه کرد
}

// ========================================
// Menu Items Configuration
// ========================================
const menuItems: MenuItem[] = [
  { icon: User, label: "مرکز حساب", desc: "خریدها، اطلاعات و نشانی", href: "/profile" },
  { icon: Package, label: "سفارش‌های من", desc: "پیگیری سفارش و تحویل", href: "/orders" },
  { icon: Store, label: "غرفه و فروش", desc: "ساخت غرفه و ثبت آگهی", href: "/profile?tab=seller" },
  { icon: Gift, label: "پاداش و تخفیف", desc: "کیف پول و کد خرید بعدی", href: "/rewards" },
  { icon: Landmark, label: "دفتر مالی", desc: "کمیسیون و وضعیت تسویه", href: "/finance" },
  { icon: Store, label: "استودیو غرفه", desc: "پست و استوری محصولات", href: "/studio" },
];

// ========================================
// Helper: ساخت آواتار از نام کاربر
// ========================================
function getInitials(name: string): string {
  if (!name) return "?";
  const [firstName, lastName] = name.trim().split(/\s+/);
  if (firstName && lastName) {
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ========================================
// ProfileMenu Component
// ========================================
export default function ProfileMenu({}: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // دریافت اطلاعات کاربر از auth store
  const { user, isAuthenticated, logout } = useAuthStore();

  // ========================================
  // بستن منو هنگام کلیک بیرون
  // ========================================
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ========================================
  // محاسبات
  // ========================================
  const fullName = user
    ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username
    : '';

  const initials = getInitials(fullName || 'کاربر');

  // ========================================
  // Handlers
  // ========================================
  async function handleLogout() {
    await logout();
    setOpen(false);
    window.location.href = '/';
  }

  // ========================================
  // Not Authenticated State - دکمه ورود
  // ========================================
  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <a
          href="/login"
          className="flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-[#0F8A5F] transition-all hover:bg-emerald-50 hover:shadow-md dark:border-emerald-800 dark:bg-emerald-950 dark:text-lime-300 dark:hover:bg-emerald-900"
          aria-label="ورود یا ثبت‌نام"
        >
          <LogIn size={16} />
          <span className="hidden sm:inline">ورود / ثبت‌نام</span>
        </a>
      </div>
    );
  }

  // ========================================
  // Authenticated State - منوی کاربر
  // ========================================
  return (
    <div ref={ref} className="relative">
      {/* ======================================== */}
      {/* Toggle Button - آواتار کاربر */}
      {/* ======================================== */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="group flex items-center gap-2 rounded-full border border-transparent p-1 pl-1 pr-1 transition-all hover:border-emerald-200 hover:bg-emerald-50 dark:hover:border-emerald-800 dark:hover:bg-emerald-950"
        aria-label="منوی پروفایل"
        aria-expanded={open}
      >
        {/* Avatar */}
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-lime-500 text-sm font-bold text-white shadow-md shadow-emerald-200 transition-transform duration-300 group-hover:scale-105 md:h-10 md:w-10">
          {initials}
          {/* Online Indicator */}
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-lime-400" />
        </span>

        {/* User Info (Desktop) */}
        <span className="hidden text-right lg:block">
          <span className="block text-xs text-slate-400">خوش آمدید</span>
          <span className="block text-sm font-semibold text-slate-700 dark:text-emerald-50">
            {user?.first_name || user?.username || 'کاربر'}
          </span>
        </span>
      </button>

      {/* ======================================== */}
      {/* Dropdown Menu */}
      {/* ======================================== */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute left-0 top-[calc(100%+12px)] z-50 w-72 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xl shadow-emerald-900/10 dark:border-emerald-800 dark:bg-emerald-950"
          >
            {/* ======================================== */}
            {/* Header - اطلاعات کاربر */}
            {/* ======================================== */}
            <div className="bg-gradient-to-l from-emerald-600 to-lime-500 p-4 text-white">
              <p className="font-bold">{fullName || user?.username || 'کاربر'}</p>
              <p className="text-xs text-white/80">{user?.email || ''}</p>
            </div>

            {/* ======================================== */}
            {/* Menu Items */}
            {/* ======================================== */}
            <ul className="p-2">
              {menuItems.map((item, idx) => (
                <motion.li
                  key={item.label}
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  <a
                    href={item.href}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900 dark:text-lime-300">
                      <item.icon size={16} />
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-slate-700 dark:text-emerald-50">
                        {item.label}
                      </span>
                      <span className="block text-xs text-slate-400 dark:text-emerald-400">
                        {item.desc}
                      </span>
                    </span>
                  </a>
                </motion.li>
              ))}
            </ul>

            {/* ======================================== */}
            {/* Logout Button */}
            {/* ======================================== */}
            <div className="border-t border-slate-100 p-2 dark:border-emerald-800">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right text-rose-500 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/40"
                aria-label="خروج از حساب"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950/40">
                  <LogOut size={16} />
                </span>
                <span className="text-sm font-medium">خروج از حساب</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}