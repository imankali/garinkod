// frontend/src/components/CropSelector.tsx

import { motion } from "framer-motion";
import {
  Cherry,
  Citrus,
  LayoutGrid,
  Leaf,
  Nut,
  Sprout,
  Wheat,
  type LucideIcon,
} from "lucide-react";

// ========================================
// Types
// ========================================
interface Crop {
  id: string;
  label: string;
  /** A crisp vector glyph; emoji looked different on every OS and read aloud. */
  icon: LucideIcon;
}

interface CropSelectorProps {
  activeCrop: string | null;
  onSelectCrop: (id: string | null) => void;
}

// ========================================
// Constants
// ========================================
const CROPS: Crop[] = [
  { id: "wheat", label: "گندم", icon: Wheat },
  { id: "pistachio", label: "پسته", icon: Nut },
  { id: "rice", label: "برنج", icon: Sprout },
  { id: "tomato", label: "گوجه‌فرنگی", icon: Cherry },
  { id: "cucumber", label: "خیار گلخانه‌ای", icon: Leaf },
  { id: "citrus", label: "باغ مرکبات", icon: Citrus },
];

// ========================================
// CropSelector Component
// انتخاب محصول کشاورزی برای فیلتر محصولات
// ========================================
export default function CropSelector({ activeCrop, onSelectCrop }: CropSelectorProps) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      {/* ======================================== */}
      {/* Header */}
      {/* ======================================== */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mb-6 text-center"
      >
        <p className="mb-1 text-xs font-bold text-green-700 dark:text-lime-300">
          پیشنهاد هوشمند
        </p>
        <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white md:text-3xl">
          برای چه محصولی خرید می‌کنید؟
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-emerald-200">
          محصول کشاورزی خود را انتخاب کنید تا بهترین پیشنهادها را ببینید
        </p>
      </motion.div>

      {/* ======================================== */}
      {/* Crop Buttons */}
      {/* ======================================== */}
      <div className="flex flex-wrap justify-center gap-3">
        {/* All Crops Button */}
        <motion.button
          type="button"
          initial={{ opacity: 0, scale: 0.85 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          whileHover={{ y: -4, scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => onSelectCrop(null)}
          className={`flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-bold transition-colors ${
            activeCrop === null
              ? "border-transparent bg-brand-gradient text-white shadow-lg"
              : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          }`}
          aria-pressed={activeCrop === null}
          aria-label="نمایش همه محصولات"
        >
          <LayoutGrid size={18} aria-hidden="true" />
          همه محصولات
        </motion.button>

        {/* Individual Crop Buttons */}
        {CROPS.map((crop, idx) => (
          <motion.button
            type="button"
            key={crop.id}
            initial={{ opacity: 0, scale: 0.85 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.05 }}
            whileHover={{ y: -4, scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onSelectCrop(crop.id)}
            className={`flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-bold transition-colors ${
              activeCrop === crop.id
                ? "border-transparent bg-brand-gradient text-white shadow-lg"
                : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
            }`}
            aria-pressed={activeCrop === crop.id}
            aria-label={`فیلتر محصولات ${crop.label}`}
          >
            <crop.icon size={18} aria-hidden="true" />
            {crop.label}
          </motion.button>
        ))}
      </div>
    </section>
  );
}