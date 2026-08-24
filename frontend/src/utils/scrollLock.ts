// frontend/src/utils/scrollLock.ts
//
// A stacking-safe body scroll lock. Several overlays (cart drawer, mobile
// menu, modals) can be open at once; each acquires a lock and each release
// decrements a counter. The body only scrolls again when the LAST overlay
// releases — a naive save/restore would let the first overlay to close unlock
// the page behind the others, or leave it stuck when restores run out of
// order.

let lockCount = 0;
let originalOverflow = '';
let originalPadding = '';

export function acquireScrollLock(): () => void {
  lockCount += 1;
  if (lockCount === 1) {
    // Compensate for the scrollbar so the page does not shift sideways.
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    originalOverflow = document.body.style.overflow;
    originalPadding = document.body.style.paddingInlineEnd;
    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingInlineEnd = `${scrollbar}px`;
  }
  return releaseScrollLock;
}

export function releaseScrollLock(): void {
  lockCount = Math.max(lockCount - 1, 0);
  if (lockCount === 0) {
    document.body.style.overflow = originalOverflow;
    document.body.style.paddingInlineEnd = originalPadding;
  }
}
