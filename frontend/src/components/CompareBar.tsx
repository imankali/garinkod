// frontend/src/components/CompareBar.tsx

import { AnimatePresence, motion } from "framer-motion";
import { GitCompare, X } from "lucide-react";
import type { MockProduct } from "../types";

// ========================================
// Types
// ========================================
interface CompareBarProps {
  items: MockProduct[];
  onRemove: (id: number) => void;
  onOpenCompare: () => void;
  onClear: () => void;
}

// ========================================
// Constants
// ========================================
const DEFAULT_IMAGE = "/images/products/default.jpg";
const MAX_COMPARE_ITEMS = 3;

// ========================================
// CompareBar Component
// ✅ نوار مقایسه محصولات در پایین صفحه
// ========================================
export default function CompareBar({
  items,
  onRemove,
  onOpenCompare,
  onClear,
}: CompareBarProps) {
  // تعداد جای خالی برای نمایش
  const emptySlots = Math.max(0, MAX_COMPARE_ITEMS - items.length);

  return (
    <AnimatePresence>
      {items.length > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 24, stiffness: 260 }}
          className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-2xl rounded-2xl border border-emerald-100 bg-white/95 p-3 shadow-2xl shadow-emerald-900/15 backdrop-blur-xl lg:bottom-6 dark:border-emerald-800 dark:bg-emerald-950/95 dark:shadow-none"
          role="region"
          aria-label="نوار مقایسه محصولات"
        >
          <div className="flex items-center gap-3">
            {/* ======================================== */}
            {/* Products Thumbnails */}
            {/* ======================================== */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <AnimatePresence initial={false}>
                {items.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-100 shadow-sm dark:border-emerald-700"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = DEFAULT_IMAGE;
                      }}
                    />
                    {/* Remove Button */}
                    <button
                      onClick={() => onRemove(item.id)}
                      className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white shadow-md transition-transform hover:scale-110"
                      aria-label={`حذف ${item.name} از مقایسه`}
                    >
                      <X size={11} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Empty Slots */}
              {Array.from({ length: emptySlots }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-[10px] text-slate-300 dark:border-emerald-700 dark:text-emerald-600"
                  aria-hidden="true"
                >
                  خالی
                </div>
              ))}
            </div>

            {/* ======================================== */}
            {/* Actions */}
            {/* ======================================== */}
            <div className="mr-auto flex shrink-0 items-center gap-2">
              {/* Clear Button */}
              <button
                onClick={onClear}
                className="text-xs text-slate-400 hover:text-rose-500 dark:text-emerald-400 dark:hover:text-rose-400"
                aria-label="پاک کردن همه از مقایسه"
              >
                پاک کردن
              </button>

              {/* Compare Button */}
              <motion.button
                whileHover={{ scale: items.length >= 2 ? 1.04 : 1 }}
                whileTap={{ scale: items.length >= 2 ? 0.96 : 1 }}
                disabled={items.length < 2}
                onClick={onOpenCompare}
                className="flex items-center gap-1.5 rounded-xl bg-brand-gradient px-4 py-2.5 text-xs font-bold text-white shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label={
                  items.length < 2
                    ? "حداقل ۲ محصول برای مقایسه انتخاب کنید"
                    : "باز کردن مقایسه محصولات"
                }
              >
                <GitCompare size={14} />
                مقایسه ({items.length.toLocaleString("fa-IR")})
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}