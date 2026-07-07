// frontend/src/pages/Profile.tsx

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { motion } from "framer-motion";
import {
  User, Mail, Phone, MapPin, LogOut, ArrowRight, Edit2,
  Save, X, Package, Heart, Settings, Loader2
} from "lucide-react";
import toast from "react-hot-toast";

// ========================================
// Types
// ========================================
interface EditData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
}

// ========================================
// Profile Component
// ========================================
export default function Profile() {
  const {
    user,
    account,
    isAuthenticated,
    isLoading,
    logout,
    fetchProfile,
    updateProfile
  } = useAuthStore();

  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [editData, setEditData] = useState<EditData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
  });

  // ========================================
  // Check Authentication & Fetch Profile
  // ========================================
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    } else {
      fetchProfile();
    }
  }, [isAuthenticated, navigate, fetchProfile]);

  // ========================================
  // Sync editData with user/account data
  // ========================================
  useEffect(() => {
    if (user) {
      setEditData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        phone: account?.phone || '',
        address: account?.address || '',
      });
    }
  }, [user, account]);

  // ========================================
  // Loading State
  // ========================================
  if (!isAuthenticated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-lime-50 dark:from-emerald-950 dark:to-emerald-900">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-500 dark:text-emerald-300">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  // ========================================
  // Handlers
  // ========================================
  async function handleLogout() {
    await logout();
    navigate('/');
  }

  function handleEdit() {
    setIsEditing(true);
  }

  function handleCancel() {
    setIsEditing(false);
    // Reset to original values
    if (user) {
      setEditData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        phone: account?.phone || '',
        address: account?.address || '',
      });
    }
  }

  async function handleSave() {
    // Validation
    if (!editData.first_name.trim()) {
      toast.error('نام الزامی است');
      return;
    }
    if (!editData.last_name.trim()) {
      toast.error('نام خانوادگی الزامی است');
      return;
    }
    if (!editData.email.trim()) {
      toast.error('ایمیل الزامی است');
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({
        first_name: editData.first_name,
        last_name: editData.last_name,
        email: editData.email,
        phone: editData.phone,
        address: editData.address,
      });
      setIsEditing(false);
    } catch (error) {
      // Error is handled in store
    } finally {
      setIsSaving(false);
    }
  }

  function handleGoBack() {
    navigate(-1);
  }

  // ========================================
  // Render
  // ========================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-lime-50 py-8 px-4 dark:from-emerald-950 dark:to-emerald-900" dir="rtl">
      <div className="mx-auto max-w-3xl">

        {/* ======================================== */}
        {/* Header with Back Button */}
        {/* ======================================== */}
        <div className="mb-6 flex items-center justify-between">
          <motion.button
            onClick={handleGoBack}
            whileHover={{ scale: 1.05, x: 5 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-md hover:shadow-lg transition-shadow dark:bg-emerald-900 dark:text-emerald-100"
          >
            <ArrowRight size={18} />
            بازگشت
          </motion.button>

          {!isEditing ? (
            <motion.button
              onClick={handleEdit}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 transition-colors"
            >
              <Edit2 size={16} />
              ویرایش اطلاعات
            </motion.button>
          ) : (
            <div className="flex gap-2">
              <motion.button
                onClick={handleCancel}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300 transition-colors dark:bg-emerald-800 dark:text-emerald-100 dark:hover:bg-emerald-700"
              >
                <X size={16} />
                انصراف
              </motion.button>
              <motion.button
                onClick={handleSave}
                disabled={isSaving}
                whileHover={{ scale: isSaving ? 1 : 1.05 }}
                whileTap={{ scale: isSaving ? 1 : 0.95 }}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    در حال ذخیره...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    ذخیره تغییرات
                  </>
                )}
              </motion.button>
            </div>
          )}
        </div>

        {/* ======================================== */}
        {/* Profile Card */}
        {/* ======================================== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-white p-8 shadow-2xl shadow-emerald-100 dark:bg-emerald-900/50 dark:shadow-none"
        >

          {/* ======================================== */}
          {/* Avatar and Name */}
          {/* ======================================== */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-lime-500 text-3xl font-bold text-white shadow-lg">
              {user?.first_name?.[0] || user?.username?.[0]?.toUpperCase() || '?'}
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
              {user?.first_name || user?.username} {user?.last_name}
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-emerald-300">
              {user?.email}
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-emerald-400">
              نام کاربری: {user?.username}
            </p>
          </div>

          {/* ======================================== */}
          {/* Info Fields */}
          {/* ======================================== */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* First Name */}
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/50">
                <User className="text-emerald-600 shrink-0 dark:text-lime-400" size={20} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 dark:text-emerald-300">نام</p>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.first_name}
                      onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                      className="w-full mt-1 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-emerald-700 dark:bg-emerald-900 dark:text-white"
                      placeholder="نام خود را وارد کنید"
                    />
                  ) : (
                    <p className="font-semibold text-slate-700 truncate dark:text-emerald-50">
                      {user?.first_name || 'تنظیم نشده'}
                    </p>
                  )}
                </div>
              </div>

              {/* Last Name */}
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/50">
                <User className="text-emerald-600 shrink-0 dark:text-lime-400" size={20} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 dark:text-emerald-300">نام خانوادگی</p>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.last_name}
                      onChange={(e) => setEditData({ ...editData, last_name: e.target.value })}
                      className="w-full mt-1 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-emerald-700 dark:bg-emerald-900 dark:text-white"
                      placeholder="نام خانوادگی خود را وارد کنید"
                    />
                  ) : (
                    <p className="font-semibold text-slate-700 truncate dark:text-emerald-50">
                      {user?.last_name || 'تنظیم نشده'}
                    </p>
                  )}
                </div>
              </div>

              {/* Username (Read-only) */}
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/50">
                <User className="text-emerald-600 shrink-0 dark:text-lime-400" size={20} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 dark:text-emerald-300">نام کاربری</p>
                  <p className="font-semibold text-slate-700 truncate dark:text-emerald-50">
                    {user?.username}
                  </p>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/50">
                <Mail className="text-emerald-600 shrink-0 dark:text-lime-400" size={20} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 dark:text-emerald-300">ایمیل</p>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editData.email}
                      onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                      className="w-full mt-1 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-emerald-700 dark:bg-emerald-900 dark:text-white"
                      dir="ltr"
                      placeholder="example@email.com"
                    />
                  ) : (
                    <p className="font-semibold text-slate-700 truncate dark:text-emerald-50">
                      {user?.email || 'تنظیم نشده'}
                    </p>
                  )}
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/50">
                <Phone className="text-emerald-600 shrink-0 dark:text-lime-400" size={20} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 dark:text-emerald-300">تلفن</p>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editData.phone}
                      onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                      className="w-full mt-1 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-emerald-700 dark:bg-emerald-900 dark:text-white"
                      dir="ltr"
                      placeholder="09123456789"
                    />
                  ) : (
                    <p className="font-semibold text-slate-700 truncate dark:text-emerald-50">
                      {account?.phone || 'تنظیم نشده'}
                    </p>
                  )}
                </div>
              </div>

              {/* Address */}
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 md:col-span-2 dark:bg-emerald-950/50">
                <MapPin className="text-emerald-600 shrink-0 dark:text-lime-400" size={20} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 dark:text-emerald-300">آدرس</p>
                  {isEditing ? (
                    <textarea
                      value={editData.address}
                      onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                      rows={2}
                      className="w-full mt-1 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none resize-none dark:border-emerald-700 dark:bg-emerald-900 dark:text-white"
                      placeholder="آدرس خود را وارد کنید"
                    />
                  ) : (
                    <p className="font-semibold text-slate-700 dark:text-emerald-50">
                      {account?.address || 'تنظیم نشده'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ======================================== */}
          {/* Quick Actions */}
          {/* ======================================== */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={() => navigate('/orders')}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors dark:bg-emerald-950 dark:text-emerald-100 dark:hover:bg-emerald-800"
            >
              <Package size={18} />
              سفارش‌های من
            </button>
            <button
              onClick={() => navigate('/wishlist')}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors dark:bg-emerald-950 dark:text-emerald-100 dark:hover:bg-emerald-800"
            >
              <Heart size={18} />
              علاقه‌مندی‌ها
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors dark:bg-emerald-950 dark:text-emerald-100 dark:hover:bg-emerald-800"
            >
              <Settings size={18} />
              تنظیمات
            </button>
          </div>

          {/* ======================================== */}
          {/* Logout Button */}
          {/* ======================================== */}
          <button
            onClick={handleLogout}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-50 py-3 text-sm font-medium text-rose-500 hover:bg-rose-100 transition-colors dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60"
          >
            <LogOut size={16} />
            خروج از حساب
          </button>
        </motion.div>
      </div>
    </div>
  );
}