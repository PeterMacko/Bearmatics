import { useEffect, useState } from 'react';

/** Opt-in idle gesture: never used by practice or expression feedback. */
export function useMenuWink(enabled: boolean) {
  const [winking, setWinking] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  useEffect(() => {
    if (!enabled || typeof matchMedia === 'undefined') return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let timer: ReturnType<typeof setTimeout>;
    const allowed = () => !document.hidden && !motion.matches;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!allowed()) return;
        setWinking(true);
        timer = setTimeout(() => { setWinking(false); schedule(); }, 240);
      }, 30000);
    };
    const restart = () => {
      clearTimeout(timer);
      setWinking(false);
      setMotionAllowed(allowed());
      if (allowed()) schedule();
    };
    restart();
    document.addEventListener('visibilitychange', restart);
    motion.addEventListener('change', restart);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', restart);
      motion.removeEventListener('change', restart);
    };
  }, [enabled]);
  return { winking: enabled && winking, idleMotion: enabled ? (motionAllowed ? 'running' : 'paused') : undefined };
}
