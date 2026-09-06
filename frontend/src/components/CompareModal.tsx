// frontend/src/components/CompareModal.tsx

import { AnimatePresence, motion } from "framer-motion";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { CheckCircle2, ShoppingCart, Star, X, XCircle } from "lucide-react";
import { formatPrice } from "../utils/formatPrice";
import type { MockProduct } from "../types";

// ========================================
// Types
// ========================================
interface CompareModalProps {
  isOpen: boolean;
  items: MockProduct[];
  onClose: () => void;
  onAddToCart: (product: MockProduct) => void;
}

interface CompareRow {
  label: string;
  render: (p: MockProduct) => React.ReactNode;
}

// ========================================
// Constants
// ========================================
const DEFAULT_IMAGE = "/images/hero-farm.jpg";

// ========================================
// CompareModal Component
// ✅ مودال مقایسه محصولات
// ========================================
export default function CompareModal({ isOpen, items, onClose, onAddToCart }: CompareModalProps) {
  const panelRef = useFocusTrap<HTMLDivElement>(isOpen, { onEscape: onClose });
  // ========================================
  // Comparison Rows Configuration
  // ========================================
  const rows: CompareRow[] = [
    {
      label: "برند",
      render: (p) => <span>{p.brand}</span>,
    },
    {
      label: "قیمت",
      render: (p) => (
        <span className="font-bold text-[#0F8A5F] dark:text-lime-300">
          {formatPrice(p.price)}
        </span>
      ),
    },
    {
      label: "امتیاز",
      render: (p) => p.reviews > 0 ? (
        <span className="flex items-center justify-center gap-1">
          <Star size={13} className="text-amber-400" fill="currentColor" />
          <span>{p.rating.toLocaleString("fa-IR")}</span>
        </span>
      ) : <span className="text-slate-400">—</span>,
    },
    {
      label: "تعداد نظرات",
      render: (p) => <span>{p.reviews > 0 ? p.reviews.toLocaleString("fa-IR") : "—"}</span>,
    },
    {
      label: "موجودی",
      render: (p) =>
        p.inStock ? (
          <span className="flex items-center justify-center gap-1 text-emerald-600 dark:text-lime-300">
            <CheckCircle2 size={14} /> موجود
          </span>
        ) : (
          <span className="flex items-center justify-center gap-1 text-rose-500">
            <XCircle size={14} /> ناموجود
          </span>
        ),
    },
    {
      label: "دسته‌بندی",
      render: (p) => <span>{p.category}</span>,
    },
    {
      label: "ویژگی‌ها",
      render: (p) =>
        p.features && p.features.length > 0 ? (
          <ul className="space-y-1 text-start text-fluid-2xs">
            {p.features.slice(0, 3).map((feature, idx) => (
              <li key={idx} className="flex items-start gap-1">
                <CheckCircle2 size={10} className="mt-0.5 shrink-0 text-emerald-500" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-slate-400">-</span>
        ),
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && items.length > 0 && (
        <>
          {/* ======================================== */}
          {/* Overlay */}
          {/* ======================================== */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[85] bg-slate-900/60 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* ======================================== */}
          {/* Modal Panel */}
          {/* ======================================== */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
            className="fixed inset-x-4 top-1/2 z-[90] mx-auto max-h-[85dvh] max-w-4xl -translate-y-1/2 overflow-y-auto rounded-3xl bg-white shadow-2xl dark:bg-emerald-950"
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="مقایسه محصولات"
          >
            {/* ======================================== */}
            {/* Header */}
            {/* ======================================== */}
            <div className="sticky top-0 z-10 flex items-center justify-between bg-brand-gradient px-5 py-4 text-white">
              <div>
                <p className="text-lg font-extrabold">مقایسه محصولات</p>
                <p className="text-xs text-white/80">
                  {items.length.toLocaleString("fa-IR")} محصول در حال مقایسه
                </p>
              </div>
              <button
                onClick={onClose}
                className="tap-target flex h-9 w-9 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
                aria-label="بستن"
              >
                <X size={18} />
              </button>
            </div>

            {/* ======================================== */}
            {/* Comparison Table */}
            {/* ======================================== */}
            <div className="overflow-x-auto p-4">
              <table className="w-full min-w-[560px] border-separate border-spacing-y-2 text-center text-sm">
                {/* ======================================== */}
                {/* Table Header - Product Images & Names */}
                {/* ======================================== */}
                <thead>
                  <tr>
                    <th className="w-32 text-start text-xs text-slate-400 dark:text-emerald-400"></th>
                    {items.map((p) => (
                      <th key={p.id} className="p-2">
                        <div className="mx-auto mb-2 h-20 w-20 overflow-hidden rounded-xl bg-emerald-50 dark:bg-emerald-900">
                          <img
                            src={p.image}
                            alt={p.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = DEFAULT_IMAGE;
                            }}
                          />
                        </div>
                        <p className="line-clamp-2 text-xs font-bold text-slate-700 dark:text-emerald-50">
                          {p.name}
                        </p>
                      </th>
                    ))}
                  </tr>
                </thead>

                {/* ======================================== */}
                {/* Table Body - Comparison Rows */}
                {/* ======================================== */}
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.label}
                      className="rounded-xl bg-slate-50 dark:bg-emerald-900/50"
                    >
                      <td className="rounded-e-xl p-3 text-start text-xs font-bold text-slate-500 dark:text-emerald-300">
                        {row.label}
                      </td>
                      {items.map((p) => (
                        <td
                          key={p.id}
                          className="p-3 text-xs font-semibold text-slate-700 last:rounded-s-xl dark:text-emerald-50"
                        >
                          {row.render(p)}
                        </td>
                      ))}
                    </tr>
                  ))}

                  {/* ======================================== */}
                  {/* Action Row - Add to Cart Buttons */}
                  {/* ======================================== */}
                  <tr>
                    <td className="p-2 text-start text-xs font-bold text-slate-500 dark:text-emerald-300">
                      خرید
                    </td>
                    {items.map((p) => (
                      <td key={p.id} className="p-2">
                        <motion.button
                          whileHover={{ scale: p.inStock ? 1.05 : 1 }}
                          whileTap={{ scale: p.inStock ? 0.95 : 1 }}
                          onClick={() => onAddToCart(p)}
                          disabled={!p.inStock}
                          className="mx-auto flex items-center gap-1.5 rounded-xl bg-brand-gradient px-3 py-2 text-fluid-xs font-bold text-white shadow disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`افزودن ${p.name} به سبد خرید`}
                        >
                          <ShoppingCart size={13} />
                          {p.inStock ? "افزودن" : "ناموجود"}
                        </motion.button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ======================================== */}
            {/* Footer - Close Button */}
            {/* ======================================== */}
            <div className="border-t border-slate-100 bg-slate-50 p-4 text-center dark:border-emerald-800 dark:bg-emerald-900/30">
              <button
                onClick={onClose}
                className="rounded-xl bg-slate-200 px-6 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-300 dark:bg-emerald-800 dark:text-emerald-100 dark:hover:bg-emerald-700"
              >
                بستن مقایسه
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}