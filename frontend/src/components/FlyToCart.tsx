// frontend/src/components/FlyToCart.tsx

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

// ========================================
// Types
// ========================================
export interface FlyingItem {
  key: number;
  image: string;
  startX: number;
  startY: number;
}

interface FlyToCartProps {
  items: FlyingItem[];
  onComplete: (key: number) => void;
}

// ========================================
// Constants
// ========================================
const DEFAULT_IMAGE = "/images/hero-farm.jpg";
const ITEM_SIZE = 48;
const ANIMATION_DURATION = 0.7;

// ========================================
// FlyToCart Component
// ✅ انیمیشن پرواز محصول به سبد خرید
// ========================================
export default function FlyToCart({ items, onComplete }: FlyToCartProps) {
  // ذخیره target element (آیکون سبد خرید) برای جلوگیری از query مکرر
  const targetRef = useRef<HTMLElement | null>(null);

  // ========================================
  // پیدا کردن target element فقط یک بار
  // ========================================
  useEffect(() => {
    targetRef.current = document.getElementById("cart-icon-target");
  }, []);

  // ========================================
  // محاسبه مختصات هدف
  // ========================================
  function getTargetPosition() {
    const target = targetRef.current;
    const rect = target?.getBoundingClientRect();

    if (rect) {
      return {
        x: rect.left + rect.width / 2 - ITEM_SIZE / 2,
        y: rect.top + rect.height / 2 - ITEM_SIZE / 2,
      };
    }

    // Fallback: گوشه بالا سمت چپ
    return {
      x: window.innerWidth - 60,
      y: 20,
    };
  }

  return (
    <AnimatePresence>
      {items.map((item) => {
        const targetPos = getTargetPosition();

        return (
          <motion.img
            key={item.key}
            src={item.image}
            initial={{
              position: "fixed",
              left: item.startX - ITEM_SIZE / 2,
              top: item.startY - ITEM_SIZE / 2,
              width: ITEM_SIZE,
              height: ITEM_SIZE,
              opacity: 1,
              scale: 1,
              zIndex: 200,
              borderRadius: "12px",
              objectFit: "cover",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
            }}
            animate={{
              left: targetPos.x,
              top: targetPos.y,
              scale: 0.3,
              opacity: 0.6,
              rotate: 15,
            }}
            exit={{
              scale: 0,
              opacity: 0,
            }}
            transition={{
              duration: ANIMATION_DURATION,
              ease: [0.2, 0.8, 0.2, 1], // easeOutCubic
            }}
            onAnimationComplete={() => onComplete(item.key)}
            className="pointer-events-none fixed"
            alt=""
            aria-hidden="true"
            onError={(e) => {
              // Fallback برای تصویر
              (e.target as HTMLImageElement).src = DEFAULT_IMAGE;
            }}
          />
        );
      })}
    </AnimatePresence>
  );
}