// frontend/src/components/RequireLevel.tsx

import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

import { useAuthStore, useUserLevel } from '../store/authStore';
import { USER_LEVEL, type UserLevel } from '../types';

interface RequireLevelProps {
  level: UserLevel;
  children: ReactNode;
  /** Where a signed-in but under-privileged user is sent. */
  redirectTo?: string;
}

/**
 * Gate a route behind a minimum access level.
 *
 * The three outcomes are deliberately different:
 * - session still loading → a placeholder, never a premature redirect;
 * - signed out → the login page, remembering where the user was going;
 * - signed in but too low a level → sent home with an explanation, because
 *   silently rendering an empty console is more confusing than saying no.
 *
 * This mirrors the server-side permission classes; it is a usability layer,
 * not the security boundary. The API refuses the request regardless.
 */
export default function RequireLevel({ level, children, redirectTo = '/' }: RequireLevelProps) {
  const { isAuthenticated, isSessionChecked } = useAuthStore();
  const userLevel = useUserLevel();
  const location = useLocation();

  if (!isSessionChecked) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
        <span className="text-sm font-semibold text-slate-500 dark:text-emerald-200">
          در حال بررسی دسترسی…
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (userLevel < level) {
    return <Navigate to={redirectTo} replace state={{ deniedFrom: location.pathname, requiredLevel: level }} />;
  }

  return <>{children}</>;
}

/** An inline "you do not have access" panel for sections inside a page. */
export function LevelGate({
  level,
  children,
  message,
}: {
  level: UserLevel;
  children: ReactNode;
  message?: string;
}) {
  const userLevel = useUserLevel();

  if (userLevel < level) {
    const defaultMessage =
      level >= USER_LEVEL.MODERATOR
        ? 'این بخش تنها برای مدیران و ناظران در دسترس است.'
        : 'برای دیدن این بخش باید غرفه فعال داشته باشید.';
    return (
      <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
        <ShieldAlert size={18} className="mt-0.5 shrink-0" />
        <span>{message ?? defaultMessage}</span>
      </div>
    );
  }

  return <>{children}</>;
}
