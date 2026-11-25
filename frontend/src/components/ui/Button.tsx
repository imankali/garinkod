// frontend/src/components/ui/Button.tsx

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Loader2, type LucideIcon } from 'lucide-react';

import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';
type Size = 'sm' | 'md' | 'lg';

/**
 * The three surfaces a control can sit on, and nothing else.
 *
 * `primary` is the one green action on a screen. `secondary` is a hairline
 * outline for the second option. `quiet` is text-only for tertiary actions
 * (a "see all" link, a cancel). `danger` exists only inside destructive
 * confirmations.
 *
 * No gradient, no shadow-on-hover, no scale-up on hover: Emil's gate says a
 * control pressed dozens of times a day gets *feedback* (a colour shift and a
 * 0.98 press), not choreography. The hover colour is darker, never lighter —
 * a lighter green under white text loses contrast exactly when the pointer is
 * on it.
 */
const VARIANT: Record<Variant, string> = {
  primary:
    'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 disabled:bg-brand-200 disabled:text-brand-700',
  secondary:
    'border border-line bg-paper text-ink hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50 dark:border-night-line dark:bg-night-soft dark:text-white dark:hover:border-brand-700 dark:hover:bg-night',
  quiet:
    'text-brand-700 hover:bg-brand-50 active:bg-brand-100 dark:text-brand-300 dark:hover:bg-night-soft disabled:opacity-50',
  danger:
    'bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-700 disabled:opacity-50',
};

/** 44px at md and up; sm is 36px but always pairs with `.tap`. */
const SIZE: Record<Size, string> = {
  sm: 'min-h-9 gap-1.5 rounded-sm px-3 text-2xs',
  md: 'min-h-11 gap-2 rounded-md px-4 text-sm',
  lg: 'min-h-12 gap-2 rounded-md px-6 text-base',
};

interface Props {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconEnd?: LucideIcon;
  loading?: boolean;
  full?: boolean;
  children?: ReactNode;
  className?: string;
  /** Renders a router link wearing the button's surface. */
  to?: string;
}

type NativeProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'>;

export type ButtonProps = Props & NativeProps;

const BASE = cn(
  'inline-flex select-none items-center justify-center font-bold',
  'transition-[background-color,border-color,color,box-shadow] duration-[var(--dur-state)] ease-[var(--ease-out)]',
  'active:scale-[0.98] disabled:active:scale-100 motion-reduce:active:scale-100',
  'disabled:cursor-not-allowed',
);

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon: Icon, iconEnd: IconEnd, loading, full, children, className, to, type = 'button', disabled, ...rest },
  ref,
) {
  const classes = cn(BASE, VARIANT[variant], SIZE[size], full && 'w-full', className);
  const glyph = size === 'lg' ? 18 : 15;
  const body = (
    <>
      {loading ? (
        <Loader2 size={glyph} aria-hidden="true" className="animate-spin" />
      ) : (
        Icon && <Icon size={glyph} aria-hidden="true" />
      )}
      {children}
      {IconEnd && !loading && <IconEnd size={glyph} aria-hidden="true" />}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} aria-busy={loading || undefined}>
        {body}
      </Link>
    );
  }

  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={classes} aria-busy={loading || undefined} {...rest}>
      {body}
    </button>
  );
});

export default Button;
