import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp } from "lucide-react";

import { useDirectStore } from "../store/directStore";

const VISIBILITY_THRESHOLD = 300;

export default function BackToTopButton({ cartDrawerOpen = false }: { cartDrawerOpen?: boolean }) {
  const [isVisible, setIsVisible] = useState(false);
  // A drawer that covers the page (cart, messages) makes a jump-to-top
  // button both unreachable and, at z-80, a floating stray on top of the
  // sheet — so it steps aside while one is open. The cart drawer is
  // state-lifted in App (its `isOpen` store slice is write-only), so it
  // arrives as a prop; the messages drawer is genuinely store-driven.
  const messagesOpen = useDirectStore((state) => state.open);
  const suppressed = cartDrawerOpen || messagesOpen;

  useEffect(() => {
    const updateVisibility = () => setIsVisible(window.scrollY > VISIBILITY_THRESHOLD);

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  };

  // Suppressed drawers unmount the whole thing instantly — a button fading
  // out while the sheet slides over it reads as lag. The scroll show/hide
  // keeps its animation.
  if (suppressed) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          type="button"
          aria-label="بازگشت به بالای صفحه"
          title="بازگشت به بالا"
          onClick={scrollToTop}
          initial={{ opacity: 0, y: 16, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.85 }}
          whileHover={{ y: -2, scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed start-4 z-[80] flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-950/25 transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 dark:bg-lime-400 dark:text-emerald-950 dark:hover:bg-lime-300 sm:start-6"
          style={{ bottom: "calc(var(--mobile-nav-clearance, 0px) + 1rem)" }}
        >
          <ArrowUp size={22} aria-hidden="true" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
