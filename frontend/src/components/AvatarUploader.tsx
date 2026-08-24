// frontend/src/components/AvatarUploader.tsx

import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';

import { useAuthStore } from '../store/authStore';

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface AvatarUploaderProps {
  /** Initials shown when no picture has been uploaded. */
  fallback: string;
  size?: 'sm' | 'lg';
}

/**
 * Circular avatar with upload and delete.
 *
 * The same size/type rules the serializer enforces are checked here first, so
 * an obviously invalid file is rejected instantly instead of after a round
 * trip. The server remains the authority — this is only fast feedback.
 */
export default function AvatarUploader({ fallback, size = 'lg' }: AvatarUploaderProps) {
  const { account, uploadAvatar, removeAvatar } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const dimension = size === 'lg' ? 'h-20 w-20' : 'h-12 w-12';

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('فرمت تصویر باید JPEG، PNG یا WebP باشد.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('حجم تصویر باید کمتر از ۲ مگابایت باشد.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await uploadAvatar(file);
    } catch {
      // The store surfaced the server's message already.
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleRemove() {
    setBusy(true);
    try {
      await removeAvatar();
    } catch {
      // Handled in the store.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="relative">
        <div
          className={`${dimension} overflow-hidden rounded-full bg-white/20 backdrop-blur`}
          aria-live="polite"
        >
          {account?.avatar_url ? (
            <img
              src={account.avatar_url}
              alt="تصویر پروفایل شما"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-2xl font-extrabold">
              {fallback}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label={account?.avatar_url ? 'تغییر تصویر پروفایل' : 'افزودن تصویر پروفایل'}
          className="absolute -bottom-1 -end-1 rounded-full bg-white p-1.5 text-emerald-700 shadow disabled:opacity-60"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
        </button>

        {account?.avatar_url && !busy && (
          <button
            type="button"
            onClick={handleRemove}
            aria-label="حذف تصویر پروفایل"
            className="absolute -bottom-1 -start-1 rounded-full bg-white p-1.5 text-rose-600 shadow"
          >
            <Trash2 size={13} />
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
        aria-label="انتخاب تصویر پروفایل"
          accept={ALLOWED_TYPES.join(',')}
          onChange={(event) => handleFile(event.target.files?.[0])}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {error && (
        <p role="alert" className="mt-1 max-w-[9rem] text-fluid-2xs font-semibold text-rose-200">
          {error}
        </p>
      )}
    </div>
  );
}
