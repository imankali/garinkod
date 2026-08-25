// frontend/src/components/direct/VoiceRecorder.tsx
//
// Press-to-record voice notes via MediaRecorder.
//
// Recording is explicitly start/stop rather than hold-to-talk: a press-and-hold
// gesture is easy to lose on a touch screen (a scroll or an incoming call ends
// it), and it is unusable with a keyboard.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Send, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { cn } from '../../utils/cn';
import { formatDuration } from './MessageAttachment';

/** The first MIME type the browser actually supports. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export default function VoiceRecorder({
  onRecorded,
  disabled,
}: {
  onRecorded: (blob: Blob, durationSeconds: number, filename: string) => void;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  // Set when the user hits the bin, so `onstop` knows to discard the audio.
  const cancelledRef = useRef(false);

  const cleanup = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    setSeconds(0);
  }, []);

  // Releasing the microphone on unmount matters: otherwise the browser keeps
  // showing the "recording" indicator after the user navigates away.
  useEffect(() => cleanup, [cleanup]);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error('مرورگر شما ضبط صدا را پشتیبانی نمی‌کند.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      cancelledRef.current = false;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const chunks = chunksRef.current;
        const wasCancelled = cancelledRef.current;
        // Read the elapsed time before cleanup resets it.
        const elapsed = seconds;
        if (!wasCancelled && chunks.length > 0) {
          const type = recorder.mimeType || 'audio/webm';
          const blob = new Blob(chunks, { type });
          const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
          onRecorded(blob, elapsed, `voice-${Date.now()}.${extension}`);
        }
        cleanup();
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => {
        setSeconds((current) => {
          // Hard cap at five minutes so a forgotten recording cannot grow
          // past the server's upload ceiling.
          if (current >= 300) {
            recorderRef.current?.stop();
            return current;
          }
          return current + 1;
        });
      }, 1000);
    } catch {
      toast.error('دسترسی به میکروفون داده نشد.');
      cleanup();
    }
  }

  function stopAndSend() {
    cancelledRef.current = false;
    recorderRef.current?.stop();
  }

  function cancel() {
    cancelledRef.current = true;
    recorderRef.current?.stop();
  }

  if (!recording) {
    return (
      <button
        type="button"
        onClick={() => void start()}
        disabled={disabled}
        aria-label="ضبط پیام صوتی"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-900"
      >
        <Mic size={19} />
      </button>
    );
  }

  return (
    <div
      className="flex h-11 flex-1 items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 dark:border-rose-800 dark:bg-rose-950/40"
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-70" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
      </span>
      <span className="flex-1 text-fluid-xs font-bold tabular-nums text-rose-700 dark:text-rose-200">
        در حال ضبط… {formatDuration(seconds)}
      </span>
      <button
        type="button"
        onClick={cancel}
        aria-label="لغو ضبط"
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-xl text-rose-600',
          'transition hover:bg-rose-100 dark:hover:bg-rose-900',
        )}
      >
        <Trash2 size={16} />
      </button>
      <button
        type="button"
        onClick={stopAndSend}
        aria-label="ارسال پیام صوتی"
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-700"
      >
        <Send size={15} className="-translate-x-px -scale-x-100" />
      </button>
    </div>
  );
}
