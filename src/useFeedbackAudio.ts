import { useEffect, useRef, useState } from 'react';
import { FeedbackAudio } from './audio';
import type { Feedback } from './session';

/**
 * Feedback sounds for a practice session. Sound is wanted by default but only activated by
 * `activateSound`, which must be called synchronously from a click/tap/submit handler (never
 * from an effect) so browsers accept it as a user gesture. Each reaction plays once per
 * attempt, and the completion fanfare once per session, even when muted or blocked.
 */
export function useFeedbackAudio(
  feedback: Feedback | undefined,
  attempts: number | undefined,
  done: boolean | undefined,
) {
  const [audio] = useState(() => new FeedbackAudio());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundReady, setSoundReady] = useState(false);
  const desiredSound = useRef(true);
  const readySound = useRef(false);
  const activation = useRef(0);
  const pendingSound = useRef(false);
  const [soundBusy, setSoundBusy] = useState(false);
  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const lastReaction = useRef('');
  const completionConsumed = useRef(false);
  useEffect(
    () => () => {
      ++activation.current;
      pendingSound.current = false;
      readySound.current = false;
      audio.dispose();
    },
    [audio],
  );
  useEffect(() => {
    if (feedback !== 'correct' && feedback !== 'incorrect') {
      lastReaction.current = '';
      return;
    }
    const key = `${feedback}:${attempts}`;
    if (lastReaction.current === key) return;
    lastReaction.current = key;
    if (desiredSound.current && readySound.current && !audio.play(feedback)) {
      readySound.current = false;
      setSoundReady(false);
      setAudioUnavailable(true);
    }
  }, [feedback, attempts, soundEnabled, audio]);
  useEffect(() => {
    if (!done || completionConsumed.current) return;
    // Consume even when muted/blocked/pending: activation must not replay history.
    completionConsumed.current = true;
    if (desiredSound.current && readySound.current && !audio.play('complete')) {
      readySound.current = false;
      setSoundReady(false);
      setAudioUnavailable(true);
    }
  }, [done, audio]);
  // Only invoke synchronously from interaction handlers, never from effects.
  const activateSound = async () => {
    if (!desiredSound.current || readySound.current || pendingSound.current) return;
    const revision = ++activation.current;
    pendingSound.current = true;
    setSoundBusy(true);
    const enabled = await audio.setEnabled(true);
    if (revision !== activation.current) return;
    pendingSound.current = false;
    readySound.current = enabled;
    setSoundReady(enabled);
    setAudioUnavailable(!enabled);
    setSoundBusy(false);
  };
  const toggleSound = () => {
    const target = !desiredSound.current;
    desiredSound.current = target;
    setSoundEnabled(target);
    if (target) void activateSound();
    else {
      ++activation.current;
      pendingSound.current = false;
      readySound.current = false;
      void audio.setEnabled(false);
      setSoundReady(false);
      setSoundBusy(false);
      setAudioUnavailable(false);
    }
  };
  /** Call when a new session starts so its reactions and fanfare can play. */
  const resetForNewSession = () => {
    completionConsumed.current = false;
    lastReaction.current = '';
  };
  return {
    soundEnabled,
    soundReady,
    soundBusy,
    audioUnavailable,
    activateSound,
    toggleSound,
    resetForNewSession,
  };
}
