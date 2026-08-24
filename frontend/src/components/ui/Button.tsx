// frontend/src/components/ui/Button.tsx

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, type LucideIcon } from 'lucide-react';

import { cn } from '../../utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-emerald-900 dark:disabled:text-emerald-600',
  secondary:
    'border border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50 active:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:text-lime-200 dark:hover:bg-emerald-900',
  ghost:
    'text-slate-600 hover:bg-slate-100 active:bg-slate-200 dark:text-emerald-100 dark:hover:bg-emerald-900',
  danger:
    'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 disabled:bg-slate-300',
  subtle:
    'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-emerald-900 dark:text-emerald-100 dark:hover:bg-emerald-800',
};

/**
 * Sizes keep a minimum height of 44px at `md` and above, which is the smallest
 * comfortable touch target in the Apple, Material and WCAG 2.5.5 guidance.
 * `sm` is intentionally still 36px tall but pairs with `.tap-target`, which
 * expands the *hit* area without enlarging the visual control.
 */
const SIZES: Record<Size, string> = {
  sm: 'min-h-9 gap-1.5 rounded-lg px-3 text-fluid-xs',
  md: 'min-h-11 gap-2 rounded-xl px-4 text-fluid-sm',
  lg: 'min-h-12 gap-2 rounded-xl px-6 text-fluid-base',
};

interface BaseProps {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconPosition?: 'start' | 'end';
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
  className?: string;
}

export interface ButtonProps
  extends BaseProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> {
  /** Render as a router link while keeping the button's appearance. */
  to?: string;
}

/**
 * The single button used across the app.
 *
 * It guarantees three things that were previously inconsistent: a large enough
 * touch target, a visible focus ring, and a loading state that keeps the
 * control's width stable so the layout does not jump.
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconPosition = 'start',
    loading = false,
    fullWidth = false,
    children,
    className,
    disabled,
    to,
    type = 'button',
    ...rest
  },
  ref,
) {
  const classes = cn(
    'inline-flex items-center justify-center font-bold transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-70',
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
    className,
  );

  const iconSize = size === 'lg' ? 18 : 15;
  const content = (
    <>
      {loading ? (
        <Loader2 size={iconSize} className="animate-spin" aria-hidden="true" />
      ) : (
        Icon && iconPosition === 'start' && <Icon size={iconSize} aria-hidden="true" />
      )}
      {children}
      {!loading && Icon && iconPosition === 'end' && <Icon size={iconSize} aria-hidden="true" />}
    </>
  );

  if (to && !disabled && !loading) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      // Screen readers should hear that work is in progress, not just see a spinner.
      aria-busy={loading || undefined}
      className={classes}
      {...rest}
    >
      {content}
    </button>
  );
});

export default Button;

export interface IconButtonProps
  extends Omit<ButtonProps, 'children' | 'icon' | 'iconPosition'> {
  icon: LucideIcon;
  /** Required: an icon alone conveys nothing to a screen reader. */
  label: string;
}

/**
 * An icon-only control. The visible box may be small, but `.tap-target`
 * guarantees the touch area is at least 44x44.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, variant = 'ghost', size = 'md', className, ...rest },
  ref,
) {
  const box = size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-12 w-12' : 'h-11 w-11';
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'tap-target inline-flex shrink-0 items-center justify-center rounded-xl transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        box,
        className,
      )}
      {...rest}
    >
      <Icon size={size === 'sm' ? 16 : 18} aria-hidden="true" />
    </button>
  );
});
