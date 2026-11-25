// frontend/src/components/ui/Field.tsx

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

/**
 * Form controls.
 *
 * The label is always visible and always attached with `htmlFor`; a
 * placeholder is not a label and never substitutes for one. Errors are
 * announced (`role="alert"`, wired with `aria-describedby`) and state the
 * problem *and* the fix — "شماره را با ۰۹ شروع کنید", not "نامعتبر".
 *
 * 16px text on mobile is deliberate: anything smaller makes iOS zoom the
 * whole page the moment the field is focused.
 */

const CONTROL = cn(
  'w-full rounded-md border border-line bg-paper px-3.5 py-2.5 text-[16px] text-ink sm:text-sm',
  'placeholder:text-ink-mute/70',
  'transition-[border-color,box-shadow] duration-[var(--dur-state)] ease-[var(--ease-out)]',
  'hover:border-brand-300',
  'focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/15',
  'disabled:cursor-not-allowed disabled:bg-cream disabled:text-ink-mute',
  'dark:border-night-line dark:bg-night-soft dark:text-white dark:placeholder:text-white/40',
  'dark:hover:border-brand-700 dark:focus:border-brand-300 dark:focus:ring-brand-300/20',
);

function Wrapper({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-2xs font-bold text-ink-soft dark:text-white/80">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-2xs font-medium text-danger-700 dark:text-danger-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-2xs text-ink-mute dark:text-white/50">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type Common = { label: string; hint?: string; error?: string; className?: string };

export const TextField = forwardRef<HTMLInputElement, Common & InputHTMLAttributes<HTMLInputElement>>(
  function TextField({ label, hint, error, className, id, ...rest }, ref) {
    const auto = useId();
    const fieldId = id ?? auto;
    return (
      <Wrapper id={fieldId} label={label} hint={hint} error={error}>
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={cn(CONTROL, error && 'border-danger-600 focus:border-danger-600 focus:ring-danger-600/15', className)}
          {...rest}
        />
      </Wrapper>
    );
  },
);

export const TextArea = forwardRef<HTMLTextAreaElement, Common & TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ label, hint, error, className, id, ...rest }, ref) {
    const auto = useId();
    const fieldId = id ?? auto;
    return (
      <Wrapper id={fieldId} label={label} hint={hint} error={error}>
        <textarea
          ref={ref}
          id={fieldId}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={cn(CONTROL, 'min-h-28 resize-y leading-7', error && 'border-danger-600', className)}
          {...rest}
        />
      </Wrapper>
    );
  },
);

export const SelectField = forwardRef<HTMLSelectElement, Common & SelectHTMLAttributes<HTMLSelectElement>>(
  function SelectField({ label, hint, error, className, id, children, ...rest }, ref) {
    const auto = useId();
    const fieldId = id ?? auto;
    return (
      <Wrapper id={fieldId} label={label} hint={hint} error={error}>
        <select
          ref={ref}
          id={fieldId}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={cn(CONTROL, 'appearance-none bg-[length:12px] bg-[left_0.9rem_center] bg-no-repeat pl-9', className)}
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none' stroke='%2364776b' stroke-width='1.8' stroke-linecap='round'%3E%3Cpath d='M1 1.5 6 6.5l5-5'/%3E%3C/svg%3E\")",
          }}
          {...rest}
        >
          {children}
        </select>
      </Wrapper>
    );
  },
);
