// frontend/src/components/ScrollProgressBar.tsx

import { motion, useScroll, useSpring } from "framer-motion";

// ========================================
// ScrollProgressBar Component
// ✅ نمایش نوار پیشرفت اسکرول در بالای صفحه
// ========================================
export default function ScrollProgressBar() {
  // دریافت مقدار اسکرول صفحه (0 تا 1)
  const { scrollYProgress } = useScroll();
  
  // اعمال spring animation برای حرکت نرم‌تر
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      className="fixed left-0 right-0 top-0 z-[100] h-1 origin-right bg-gradient-to-l from-emerald-500 via-lime-400 to-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.6)]"
      style={{ scaleX }}
      role="progressbar"
      aria-label="نوار پیشرفت اسکرول صفحه"
      aria-valuemin={0}
      aria-valuemax={100}
    />
  );
}