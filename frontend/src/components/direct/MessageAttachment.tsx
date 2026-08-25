// frontend/src/components/direct/MessageAttachment.tsx
//
// Renders whatever media a message carries. The kind comes from the server
// (`attachment_type`) rather than being guessed from the file extension, so
// the right player is mounted on the first render.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, Volume2 } from 'lucide-react';

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

const SPEEDS = [1, 1.5, 2] as const;

/**
 * A modern, interactive voice-note player with waveform simulation,
 * scrubbing, duration tracking, and playback speed toggle.
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
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(duration ?? 0);
  const [speedIndex, setSpeedIndex] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const onTime = () => setProgress(audio.currentTime);
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setTotal(audio.duration);
      }
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

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play();
      setPlaying(true);
    }
  }, [playing]);

  const cycleSpeed = useCallback(() => {
    const nextIndex = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(nextIndex);
    const nextSpeed: number = SPEEDS[nextIndex] ?? 1;
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  }, [speedIndex]);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const audio = audioRef.current;
      const bar = progressBarRef.current;
      if (!audio || !bar || total <= 0) return;

      const rect = bar.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clampedPercent = Math.max(0, Math.min(1, clickX / rect.width));
      const newTime = clampedPercent * total;
      audio.currentTime = newTime;
      setProgress(newTime);
    },
    [total],
  );

  const percent = total > 0 ? Math.min((progress / total) * 100, 100) : 0;
  const currentSpeed = SPEEDS[speedIndex];

  // Pseudo-waveform bar heights (20 bars)
  const WAVE_BARS = [35, 60, 45, 80, 55, 90, 70, 100, 65, 85, 40, 75, 90, 60, 45, 80, 50, 70, 40, 30];

  return (
    <div
      className={cn(
        'mt-2 flex min-w-56 max-w-xs flex-col rounded-2xl p-2.5 shadow-sm transition-all sm:min-w-64',
        isMine
          ? 'bg-emerald-700/80 text-white'
          : 'bg-slate-50 text-slate-800 dark:bg-emerald-950/80 dark:text-emerald-100',
      )}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="flex items-center gap-2.5">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? 'توقف پیام صوتی' : 'پخش پیام صوتی'}
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm transition transform hover:scale-105 active:scale-95',
            isMine
              ? 'bg-white text-emerald-800 hover:bg-emerald-50'
              : 'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400',
          )}
        >
          {playing ? <Pause size={17} /> : <Play size={17} className="translate-x-px" />}
        </button>

        {/* Waveform scrubber */}
        <div
          ref={progressBarRef}
          onClick={handleSeek}
          className="relative flex h-8 flex-1 cursor-pointer items-center gap-[2px] px-1"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {WAVE_BARS.map((heightPercent, idx) => {
            const barPercent = (idx / WAVE_BARS.length) * 100;
            const isFilled = barPercent <= percent;

            return (
              <span
                key={idx}
                style={{ height: `${heightPercent}%` }}
                className={cn(
                  'w-1 rounded-full transition-all duration-150',
                  isMine
                    ? isFilled
                      ? 'bg-white'
                      : 'bg-white/35'
                    : isFilled
                      ? 'bg-emerald-600 dark:bg-lime-400'
                      : 'bg-slate-200 dark:bg-emerald-800',
                  playing && isFilled && 'animate-pulse',
                )}
              />
            );
          })}
        </div>

        {/* Speed toggle */}
        <button
          type="button"
          onClick={cycleSpeed}
          title="سرعت پخش"
          className={cn(
            'flex h-7 px-1.5 items-center justify-center rounded-lg text-fluid-2xs font-bold transition',
            isMine
              ? 'bg-white/20 text-white hover:bg-white/30'
              : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-emerald-900 dark:text-emerald-200',
          )}
        >
          {currentSpeed}x
        </button>
      </div>

      {/* Time display footer */}
      <div className="mt-1.5 flex items-center justify-between px-1 text-fluid-2xs tabular-nums">
        <span className={cn('font-semibold', isMine ? 'text-white/90' : 'text-slate-600 dark:text-emerald-300')}>
          {formatDuration(progress)} / {formatDuration(total)}
        </span>
        <span className={cn('flex items-center gap-1', isMine ? 'text-white/70' : 'text-slate-400 dark:text-emerald-400/70')}>
          <Volume2 size={11} aria-hidden="true" />
          صدا
        </span>
      </div>
    </div>
  );
}
