// frontend/src/components/ConsultationButton.tsx

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, MessageCircle, Phone, Sparkles, Upload, X } from "lucide-react";
import toast from "react-hot-toast";

// ========================================
// Constants
// ========================================
const PHONE_NUMBER = import.meta.env.VITE_PHONE_NUMBER || "02112345678";
const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || "989123456789";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const SUPPORTED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

// ========================================
// ConsultationButton Component
// ========================================
export default function ConsultationButton() {
  const [open, setOpen] = useState(false);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // ========================================
  // Handle File Selection
  // ========================================
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation: نوع فایل
    if (!SUPPORTED_FILE_TYPES.includes(file.type)) {
      toast.error("لطفاً فقط فایل تصویری (JPG, PNG, WebP) انتخاب کنید");
      return;
    }

    // Validation: حجم فایل
    if (file.size > MAX_FILE_SIZE) {
      toast.error("حجم فایل باید کمتر از 5 مگابایت باشد");
      return;
    }

    setUploadedName(file.name);
    setUploading(true);
    setUploadProgress(0);

    try {
      // TODO: در آینده به API متصل شود
      // const formData = new FormData();
      // formData.append('image', file);
      // await consultationApi.uploadImage(formData);

      // موقتاً شبیه‌سازی آپلود با progress
      await simulateUpload();

      toast.success("عکس دریافت شد، کارشناس با شما تماس می‌گیرد ✅");
    } catch (error) {
      toast.error("خطا در ارسال عکس");
      setUploadedName(null);
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  }

  // ========================================
  // Simulate Upload Progress
  // ========================================
  async function simulateUpload() {
    return new Promise<void>((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        setUploadProgress(progress);
        if (progress >= 100) {
          clearInterval(interval);
          setTimeout(resolve, 300);
        }
      }, 150);
    });
  }

  // ========================================
  // Handle Close Modal
  // ========================================
  function handleCloseModal() {
    setOpen(false);
    // Reset state بعد از بستن
    setTimeout(() => {
      setUploadedName(null);
      setUploadProgress(0);
    }, 300);
  }

  return (
    <>
      {/* ======================================== */}
      {/* Floating Button */}
      {/* ======================================== */}
      <motion.button
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8, type: "spring" }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-24 left-4 z-40 flex items-center gap-2 rounded-full bg-brand-gradient px-4 py-3 text-white shadow-xl shadow-emerald-900/30 lg:bottom-6 lg:left-6 dark:shadow-none"
        aria-label="باز کردن مشاوره رایگان"
      >
        <motion.span
          animate={{ rotate: [0, -12, 12, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.5 }}
        >
          <MessageCircle size={20} />
        </motion.span>
        <span className="hidden text-sm font-bold sm:inline">مشاوره رایگان</span>

        {/* Pulse Indicator */}
        <span className="absolute -left-1 -top-1 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-300 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-lime-400" />
        </span>
      </motion.button>

      {/* ======================================== */}
      {/* Modal */}
      {/* ======================================== */}
      <AnimatePresence>
        {open && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="fixed inset-0 z-[85] bg-slate-900/55 backdrop-blur-sm"
              aria-hidden="true"
            />

            {/* Modal Panel */}
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              className="fixed inset-x-4 bottom-4 z-[90] mx-auto max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl sm:inset-x-auto sm:bottom-1/2 sm:right-1/2 sm:translate-x-1/2 sm:translate-y-1/2 dark:bg-emerald-950"
              role="dialog"
              aria-modal="true"
              aria-label="مشاوره تخصصی کشاورزی"
            >
              {/* ======================================== */}
              {/* Modal Header */}
              {/* ======================================== */}
              <div className="relative bg-brand-gradient px-5 py-5 text-white">
                <button
                  onClick={handleCloseModal}
                  className="absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
                  aria-label="بستن"
                >
                  <X size={16} />
                </button>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
                    <Sparkles size={20} />
                  </span>
                  <div>
                    <p className="font-bold">مشاوره تخصصی کشاورزی</p>
                    <p className="text-xs text-white/80">پاسخگویی کارشناسان تا ۲۲ شب</p>
                  </div>
                </div>
              </div>

              {/* ======================================== */}
              {/* Modal Content */}
              {/* ======================================== */}
              <div className="space-y-3 p-5">
                {/* Phone Call */}
                <a
                  href={`tel:${PHONE_NUMBER}`}
                  className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3.5 transition-colors hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/50 dark:hover:bg-emerald-900"
                  aria-label={`تماس تلفنی با شماره ${PHONE_NUMBER}`}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#0F8A5F] shadow-sm dark:bg-emerald-950 dark:text-lime-300">
                    <Phone size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-slate-700 dark:text-emerald-50">
                      تماس تلفنی مستقیم
                    </span>
                    <span className="block text-xs text-slate-400 dark:text-emerald-300" dir="ltr">
                      {PHONE_NUMBER}
                    </span>
                  </span>
                </a>

                {/* WhatsApp */}
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3.5 transition-colors hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/50 dark:hover:bg-emerald-900"
                  aria-label="گفتگو در واتس‌اپ"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#0F8A5F] shadow-sm dark:bg-emerald-950 dark:text-lime-300">
                    <MessageCircle size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-slate-700 dark:text-emerald-50">
                      گفتگو در واتس‌اپ
                    </span>
                    <span className="block text-xs text-slate-400 dark:text-emerald-300">
                      پاسخ در کمتر از ۵ دقیقه
                    </span>
                  </span>
                </a>

                {/* Photo Diagnosis */}
                <div className="rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 p-4 text-center dark:border-emerald-700 dark:bg-emerald-900/30">
                  <Camera size={26} className="mx-auto mb-2 text-[#0F8A5F] dark:text-lime-300" />
                  <p className="mb-1 text-sm font-bold text-slate-700 dark:text-emerald-50">
                    تشخیص آفت با عکس
                  </p>
                  <p className="mb-3 text-xs text-slate-500 dark:text-emerald-300">
                    عکس آفت یا بیماری گیاه خود را ارسال کنید تا کارشناسان ما سریع راهنمایی‌تان کنند
                  </p>

                  {/* Hidden File Input */}
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    aria-label="انتخاب عکس برای تشخیص آفت"
                  />

                  {/* Upload Button */}
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="mx-auto flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-emerald-700 shadow-sm ring-1 ring-emerald-200 transition-colors hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-emerald-950 dark:text-lime-300 dark:ring-emerald-700"
                    aria-busy={uploading}
                  >
                    {uploading ? (
                      <>
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent"></div>
                        در حال ارسال... {uploadProgress}%
                      </>
                    ) : (
                      <>
                        <Upload size={14} />
                        {uploadedName ? uploadedName : "انتخاب عکس از گالری"}
                      </>
                    )}
                  </button>

                  {/* Upload Progress Bar */}
                  {uploading && (
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-emerald-200 dark:bg-emerald-800">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        transition={{ duration: 0.3 }}
                        className="h-full bg-gradient-to-r from-emerald-500 to-lime-400"
                      />
                    </div>
                  )}

                  {/* Success Message */}
                  {uploadedName && !uploading && (
                    <motion.p
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 text-[11px] font-semibold text-emerald-600 dark:text-lime-300"
                    >
                      عکس دریافت شد، کارشناس با شما تماس می‌گیرد ✅
                    </motion.p>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}