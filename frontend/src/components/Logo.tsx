// frontend/src/components/Logo.tsx

import { motion } from "framer-motion";
import { Sprout } from "lucide-react";

// ========================================
// Types
// ========================================
interface LogoProps {
  compact?: boolean;
}

// ========================================
// Logo Component
// ========================================
export default function Logo({ compact = false }: LogoProps) {
  return (
    <motion.a
      href="/"
      className="group flex items-center gap-2.5 select-none"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.98 }}
      aria-label="گرین کود - صفحه اصلی"
    >
      {/* ======================================== */}
      {/* Logo Icon with 3D Effect */}
      {/* ======================================== */}
      <div className="perspective-1000">
        <motion.div
          className="preserve-3d relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-lime-500 shadow-lg shadow-emerald-300/50 md:h-12 md:w-12"
          whileHover={{ rotateY: 180, scale: 1.1 }}
          initial={{ rotateY: 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        >
          {/* Glow Effect */}
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 0.8, 0.5],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-emerald-400/50 to-lime-400/50 blur-md"
          />

          {/* Shine Overlay */}
          <span className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/30 to-transparent backface-hidden" />

          {/* Sprout Icon */}
          <Sprout
            size={compact ? 20 : 24}
            className="relative z-10 text-white drop-shadow backface-hidden"
          />

          {/* Pulsing Dot */}
          <motion.span
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -end-1 -top-1 h-3 w-3 rounded-full bg-lime-400 shadow-lg shadow-lime-400/50"
          />
        </motion.div>
      </div>

      {/* ======================================== */}
      {/* Logo Text */}
      {/* ======================================== */}
      {!compact && (
        <div className="leading-tight">
          <p className="text-lg font-extrabold tracking-tight text-slate-800 md:text-xl">
            <span className="text-gradient-green">گرین</span>
            <span>کود</span>
          </p>
          <p className="hidden text-fluid-2xs font-medium text-slate-400 md:block">
            فروشگاه تخصصی نهاده‌های کشاورزی
          </p>
        </div>
      )}

      {/* Compact Mode Text */}
      {compact && (
        <motion.p
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-base font-extrabold text-slate-800 dark:text-white"
        >
          گرین کود
        </motion.p>
      )}
    </motion.a>
  );
}