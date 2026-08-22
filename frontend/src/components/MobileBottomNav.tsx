// frontend/src/components/MobileBottomNav.tsx

import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Heart, Home, LayoutGrid, ShoppingCart, User } from "lucide-react";

// ========================================
// Types
// ========================================
interface MobileBottomNavProps {
  cartCount: number;
  wishlistCount: number;
  onOpenCart: () => void;
  onOpenMenu: () => void;
  onOpenWishlist?: () => void;
}

interface NavButtonProps {
  icon: typeof Home;
  label: string;
  badge?: number;
  onClick?: () => void;
}

// ========================================
// NavButton Helper Component
// ========================================
function NavButton({ icon: Icon, label, badge, onClick }: NavButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      className="relative flex flex-col items-center gap-1 px-2 py-1 text-slate-500 focus:outline-none dark:text-emerald-300"
      aria-label={label}
    >
      <Icon size={20} />
      {!!badge && (
        <span className="absolute -right-1 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
          {badge}
        </span>
      )}
      <span className="text-[10px] font-medium">{label}</span>
    </motion.button>
  );
}

// ========================================
// MobileBottomNav Component
// ========================================
export default function MobileBottomNav({
  cartCount,
  wishlistCount,
  onOpenCart,
  onOpenMenu,
  onOpenWishlist,
}: MobileBottomNavProps) {
  const navigate = useNavigate();
  return (
    <motion.nav
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3, type: "spring", damping: 20 }}
      className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-3 lg:hidden"
      style={{
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
      }}
      aria-label="منوی پایین موبایل"
    >
      {/* ======================================== */}
      {/* Nav Container */}
      {/* ======================================== */}
      <div className="relative mx-auto max-w-md overflow-visible rounded-2xl border border-emerald-100 bg-white/95 px-2 py-3 shadow-2xl shadow-emerald-900/10 backdrop-blur-xl dark:border-emerald-800 dark:bg-emerald-950/95">
        <div className="flex items-end justify-around">

          {/* ======================================== */}
          {/* دکمه خانه */}
          {/* ======================================== */}
          <NavButton
            icon={Home}
            label="خانه"
            onClick={() => navigate('/')}
          />

          {/* ======================================== */}
          {/* دکمه دسته‌ها */}
          {/* ======================================== */}
          <NavButton
            icon={LayoutGrid}
            label="دسته‌ها"
            onClick={onOpenMenu}
          />

          {/* ======================================== */}
          {/* دکمه مرکزی سبد خرید (برجسته) */}
          {/* ======================================== */}
          <div className="relative flex flex-col items-center">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onOpenCart}
              className="relative -mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-lime-500 text-white shadow-lg shadow-emerald-300/50 ring-4 ring-white dark:ring-emerald-950"
              aria-label="سبد خرید"
            >
              <ShoppingCart size={20} />

              {/* Cart Count Badge */}
              <AnimatePresence>
                {cartCount > 0 && (
                  <motion.span
                    key={cartCount}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-orange text-[10px] font-bold text-white shadow-md"
                  >
                    {cartCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
            <span className="mt-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-200">
              سبد خرید
            </span>
          </div>

          {/* ======================================== */}
          {/* دکمه علاقه‌مندی */}
          {/* ======================================== */}
          <NavButton
            icon={Heart}
            label="علاقه‌مندی"
            badge={wishlistCount}
            onClick={onOpenWishlist}
          />

          {/* ======================================== */}
          {/* دکمه حساب من */}
          {/* ======================================== */}
          <NavButton
            icon={User}
            label="حساب من"
            onClick={() => navigate('/profile')}
          />
        </div>
      </div>
    </motion.nav>
  );
}