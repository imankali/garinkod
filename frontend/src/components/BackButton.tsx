import { ArrowRight } from "lucide-react";
import { useLocation, useNavigate } from "react-router";

/** A route-aware RTL back control, hidden only on the home page. */
export default function BackButton() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (pathname === "/") return null;

  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      aria-label="بازگشت به صفحه قبل"
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 dark:border-emerald-700 dark:bg-emerald-950 dark:text-lime-300 dark:hover:bg-emerald-900"
    >
      <ArrowRight size={18} aria-hidden="true" />
      <span>بازگشت</span>
    </button>
  );
}
