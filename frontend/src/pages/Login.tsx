// frontend/src/pages/Login.tsx

import { useState } from "react";
import { motion } from "framer-motion";
import { LogIn, UserPlus, Eye, EyeOff, Mail, Lock, User } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

// ========================================
// Types
// ========================================
interface FormData {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  password2: string;
}

// ========================================
// Login Component
// ========================================
export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    password2: '',
  });

  const { login, register, isLoading } = useAuthStore();
  const navigate = useNavigate();

  // ========================================
  // Handlers
  // ========================================
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation for Register
    if (isRegister) {
      if (formData.password !== formData.password2) {
        toast.error('رمزهای عبور مطابقت ندارند');
        return;
      }
      if (formData.password.length < 8) {
        toast.error('رمز عبور باید حداقل ۸ کاراکتر باشد');
        return;
      }

      try {
        await register({
          username: formData.username,
          email: formData.email,
          first_name: formData.first_name,
          last_name: formData.last_name,
          password: formData.password,
          password2: formData.password2,
        });
        toast.success('ثبت‌نام با موفقیت انجام شد');
        navigate('/');
      } catch {
        // خطا در store مدیریت و نمایش داده می‌شود
      }
    }
    // Validation for Login
    else {
      try {
        await login(formData.username, formData.password);
        toast.success('ورود با موفقیت انجام شد');
        navigate('/');
      } catch {
        // خطا در store مدیریت و نمایش داده می‌شود
      }
    }
  }

  // ========================================
  // Render
  // ========================================
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-lime-50 py-12 px-4 dark:from-emerald-950 dark:to-emerald-900">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-md"
      >
        <div className="rounded-3xl bg-white p-8 shadow-2xl shadow-emerald-100 dark:bg-emerald-900/50 dark:shadow-none">

          {/* ======================================== */}
          {/* Header */}
          {/* ======================================== */}
          <div className="mb-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-lime-500 text-white shadow-lg"
            >
              {isRegister ? <UserPlus size={28} /> : <LogIn size={28} />}
            </motion.div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
              {isRegister ? 'ثبت‌نام در گرین کود' : 'ورود به گرین کود'}
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-emerald-300">
              {isRegister ? 'حساب کاربری جدید بسازید' : 'به حساب خود وارد شوید'}
            </p>
          </div>

          {/* ======================================== */}
          {/* Form */}
          {/* ======================================== */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Username */}
            <div>
              <label htmlFor="login-username" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-emerald-200">
                نام کاربری
              </label>
              <div className="relative">
                <span className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <User size={18} />
                </span>
                <input
                  type="text"
                  name="username"
                  id="login-username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl border-2 border-slate-200 bg-white ps-10 pe-4 py-3 text-sm transition-colors focus:border-emerald-500 focus:outline-none dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
                  placeholder="نام کاربری خود را وارد کنید"
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Register Fields */}
            {isRegister && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="login-first_name" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-emerald-200">
                نام
              </label>
                    <input
                      type="text"
                      name="first_name"
                  id="login-first_name"
                      value={formData.first_name}
                      onChange={handleChange}
                      className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm transition-colors focus:border-emerald-500 focus:outline-none dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
                      placeholder="نام"
                      autoComplete="given-name"
                    />
                  </div>
                  <div>
                    <label htmlFor="login-last_name" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-emerald-200">
                نام خانوادگی
              </label>
                    <input
                      type="text"
                      name="last_name"
                  id="login-last_name"
                      value={formData.last_name}
                      onChange={handleChange}
                      className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm transition-colors focus:border-emerald-500 focus:outline-none dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
                      placeholder="نام خانوادگی"
                      autoComplete="family-name"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-emerald-200">
                ایمیل
              </label>
                  <div className="relative">
                    <span className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Mail size={18} />
                    </span>
                    <input
                      type="email"
                      name="email"
                  id="login-email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full rounded-xl border-2 border-slate-200 bg-white ps-10 pe-4 py-3 text-sm transition-colors focus:border-emerald-500 focus:outline-none dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
                      placeholder="example@email.com"
                      dir="ltr"
                      autoComplete="email"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Password */}
            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-emerald-200">
                رمز عبور
              </label>
              <div className="relative">
                <span className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock size={18} />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  id="login-password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl border-2 border-slate-200 bg-white ps-10 pe-12 py-3 text-sm transition-colors focus:border-emerald-500 focus:outline-none dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
                  placeholder="رمز عبور"
                  dir="ltr"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-emerald-300"
                  aria-label={showPassword ? "مخفی کردن رمز عبور" : "نمایش رمز عبور"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Password Confirmation (Register only) */}
            {isRegister && (
              <div>
                <label htmlFor="login-password2" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-emerald-200">
                تکرار رمز عبور
              </label>
                <div className="relative">
                  <span className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock size={18} />
                  </span>
                  <input
                    type={showPassword2 ? "text" : "password"}
                    name="password2"
                  id="login-password2"
                    value={formData.password2}
                    onChange={handleChange}
                    required
                    className="w-full rounded-xl border-2 border-slate-200 bg-white ps-10 pe-12 py-3 text-sm transition-colors focus:border-emerald-500 focus:outline-none dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
                    placeholder="تکرار رمز عبور"
                    dir="ltr"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword2(!showPassword2)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-emerald-300"
                    aria-label={showPassword2 ? "مخفی کردن رمز عبور" : "نمایش رمز عبور"}
                  >
                    {showPassword2 ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: isLoading ? 1 : 1.02 }}
              whileTap={{ scale: isLoading ? 1 : 0.98 }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-lime-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-200 transition-shadow hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed dark:shadow-none"
            >
              {isLoading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  {isRegister ? <UserPlus size={18} /> : <LogIn size={18} />}
                  {isRegister ? 'ثبت‌نام' : 'ورود'}
                </>
              )}
            </motion.button>
          </form>

          {/* ======================================== */}
          {/* Toggle Login/Register */}
          {/* ======================================== */}
          <div className="mt-6 text-center text-sm text-slate-500 dark:text-emerald-300">
            {isRegister ? 'قبلاً ثبت‌نام کرده‌اید؟' : 'حساب کاربری ندارید؟'}{' '}
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setFormData({
                  username: '',
                  email: '',
                  first_name: '',
                  last_name: '',
                  password: '',
                  password2: '',
                });
              }}
              className="font-bold text-emerald-600 hover:text-emerald-700 dark:text-lime-400 dark:hover:text-lime-300"
            >
              {isRegister ? 'ورود' : 'ثبت‌نام'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}