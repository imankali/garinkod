// frontend/src/components/direct/MessageAttachment.tsx
//
// Renders whatever media a message carries. The kind comes from the server
// (`attachment_type`) rather than being guessed from the file extension, so
// the right player is mounted on the first render.

import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

import type { StorefrontMessage } from '../../types';
import { cn } from '../../utils/cn';

/** mm:ss — a duration is far easier to read than a raw second count. */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function MessageAttachment({
  message,
  onOpenImage,
}: {
  message: StorefrontMessage;
  onOpenImage?: (url: string) => void;
}) {
  if (!message.attachment_url) return null;

  if (message.attachment_type === 'image') {
    return (
      <button
        type="button"
        onClick={() => onOpenImage?.(message.attachment_url)}
        className="mt-1.5 block overflow-hidden rounded-xl"
        aria-label="بزرگ‌نمایی تصویر"
      >
        <img
          src={message.attachment_url}
          alt={message.body || 'تصویر پیوست‌شده'}
          loading="lazy"
          className="max-h-64 w-full max-w-xs object-cover"
        />
      </button>
    );
  }

  if (message.attachment_type === 'video') {
    return (
      <video
        src={message.attachment_url}
        controls
        preload="metadata"
        className="mt-1.5 max-h-64 w-full max-w-xs rounded-xl bg-black"
      >
        <track kind="captions" />
      </video>
    );
  }

  if (message.attachment_type === 'audio') {
    return <VoiceNote src={message.attachment_url} duration={message.attachment_duration} isMine={message.is_mine} />;
  }

  return null;
}

/**
 * A compact voice-note player.
 *
 * The native <audio> control is inconsistent across browsers and far too wide
 * for a chat bubble, so this is a play/pause button plus a progress bar — and
 * it shows the recorded length immediately, from the duration the sender
 * supplied, instead of waiting for metadata to download.
 */
function VoiceNote({
  src,
  duration,
  isMine,
}: {
  src: string;
  duration: number | null;
  isMine: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(duration ?? 0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const onTime = () => setProgress(audio.currentTime);
    const onMeta = () => {
      if (Number.isFinite(audio.duration)) setTotal(audio.duration);
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnd);
    };
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play();
      setPlaying(true);
    }
  }

  const percent = total > 0 ? Math.min((progress / total) * 100, 100) : 0;

  return (
    <div className="mt-1.5 flex min-w-48 items-center gap-2.5">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'توقف پیام صوتی' : 'پخش پیام صوتی'}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition',
          isMine ? 'bg-white/25 text-white hover:bg-white/35' : 'bg-emerald-600 text-white hover:bg-emerald-700',
        )}
      >
        {playing ? <Pause size={15} /> : <Play size={15} className="translate-x-px" />}
      </button>

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'h-1.5 w-full overflow-hidden rounded-full',
            isMine ? 'bg-white/30' : 'bg-emerald-200 dark:bg-emerald-800',
          )}
        >
          <div
            className={cn('h-full rounded-full transition-[width]', isMine ? 'bg-white' : 'bg-emerald-600')}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span
          className={cn(
            'mt-1 block text-fluid-2xs tabular-nums',
            isMine ? 'text-white/80' : 'text-slate-500 dark:text-emerald-300',
          )}
        >
          {formatDuration(playing || progress > 0 ? progress : total)}
        </span>
      </div>
    </div>
  );
}
