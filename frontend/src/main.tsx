// frontend/src/main.tsx
// ✅ نقطه ورود اصلی اپلیکیشن React

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import App from "./App";
import "./index.css";

// ========================================
// React Query Client Configuration
// ✅ تنظیمات بهینه برای cache و retry
// ========================================
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      //  غیرفعال کردن refetch هنگام focus (برای جلوگیری از درخواست‌های تکراری)
      refetchOnWindowFocus: false,

      // ✅ فقط یک بار retry در صورت خطا (برای UX بهتر)
      retry: 1,

      // ✅ داده‌ها برای ۵ دقیقه fresh هستند (بعد از آن stale می‌شوند)
      staleTime: 5 * 60 * 1000,

      // ✅ داده‌های cache شده برای ۱۰ دقیقه در حافظه می‌مانند
      gcTime: 10 * 60 * 1000,

      // ✅ retry با تأخیر exponential (1s, 2s, 4s, ...)
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // ✅ refetch هنگام reconnect به اینترنت
      refetchOnReconnect: true,
    },

    mutations: {
      // ✅ mutationها فقط یک بار retry می‌شوند
      retry: 1,
    },
  },
});

// ========================================
// Error Boundary برای جلوگیری از crash کامل اپ
// ========================================
class ErrorBoundary extends (await import("react")).Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("React Error Boundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-lime-50 p-4" dir="rtl">
          <div className="max-w-md text-center bg-white rounded-3xl p-8 shadow-2xl">
            <div className="text-6xl mb-4">️</div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">خطای غیرمنتظره</h1>
            <p className="text-sm text-slate-500 mb-6">
              متأسفانه خطایی در برنامه رخ داد. لطفاً صفحه را refresh کنید.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-gradient-to-r from-emerald-600 to-lime-500 px-6 py-3 text-sm font-bold text-white shadow-lg"
            >
              refresh صفحه
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ========================================
// Render App
// ========================================
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found. Please check your index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
        {/* React Query DevTools - فقط در حالت development */}
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);