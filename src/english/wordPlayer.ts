import { useEffect, useRef, useState } from 'react';
import { audioFile } from './words';

/** Minimal part of HTMLAudioElement the player needs (injectable for tests). */
export type AudioLike = {
  src: string;
  currentTime: number;
  preload: string;
  play(): Promise<void> | void;
  pause(): void;
  addEventListener(type: 'ended' | 'error' | 'pause', listener: () => void): void;
  removeEventListener(type: 'ended' | 'error' | 'pause', listener: () => void): void;
};

export function wordUrl(word: string): string {
  return `${import.meta.env.BASE_URL}audio/words/${audioFile(word)}.mp3`;
}

/**
 * Plays recorded English words. One shared element: a new word stops the one playing, so
 * words never overlap. Words ignore the feedback-sound mute (they are the exercise itself).
 */
export class WordPlayer {
  private audio: AudioLike | null = null;
  private revision = 0;
  private listeners = new Set<(state: { playing: string | null; failed: boolean }) => void>();

  constructor(private readonly factory: () => AudioLike = () => new Audio()) {}

  subscribe(listener: (state: { playing: string | null; failed: boolean }) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(playing: string | null, failed: boolean) {
    for (const listener of this.listeners) listener({ playing, failed });
  }

  private element(): AudioLike {
    if (this.audio) return this.audio;
    const audio = this.factory();
    audio.preload = 'auto';
    this.audio = audio;
    return audio;
  }

  /** Must run from a tap/click or after the Start tap so the browser allows playback. */
  async play(word: string): Promise<boolean> {
    const revision = ++this.revision;
    const audio = this.element();
    audio.pause();
    audio.src = wordUrl(word);
    audio.currentTime = 0;
    this.emit(word, false);
    const finished = () => {
      cleanup();
      if (revision === this.revision) this.emit(null, false);
    };
    const failed = () => {
      cleanup();
      if (revision === this.revision) this.emit(null, true);
    };
    const cleanup = () => {
      audio.removeEventListener('ended', finished);
      audio.removeEventListener('pause', finished);
      audio.removeEventListener('error', failed);
    };
    audio.addEventListener('ended', finished);
    audio.addEventListener('error', failed);
    try {
      await audio.play();
      // Only listen for pause once playing, so the pause() above cannot end this play.
      if (revision !== this.revision) {
        // A newer word started meanwhile: drop this play's listeners.
        cleanup();
        return false;
      }
      audio.addEventListener('pause', finished);
      return true;
    } catch {
      if (revision === this.revision) failed();
      else cleanup();
      return false;
    }
  }

  stop(): void {
    ++this.revision;
    this.audio?.pause();
    this.emit(null, false);
  }

  /** Warm the browser cache for the next words without playing them. */
  preload(words: readonly string[]): void {
    if (typeof document === 'undefined') return;
    for (const word of words) {
      const href = wordUrl(word);
      if (document.head.querySelector(`link[data-word-preload="${href}"]`)) continue;
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'audio';
      link.href = href;
      link.dataset.wordPreload = href;
      document.head.append(link);
    }
  }

  dispose(): void {
    this.stop();
    this.listeners.clear();
    this.audio = null;
  }
}

/** React state for the shared word player: which word is playing and whether playback failed. */
export function useWordPlayer(factory?: () => AudioLike) {
  const [player] = useState(() => new WordPlayer(factory));
  const [state, setState] = useState<{ playing: string | null; failed: boolean }>({
    playing: null,
    failed: false,
  });
  const lastWord = useRef<string | null>(null);
  useEffect(() => {
    const unsubscribe = player.subscribe(setState);
    return () => {
      unsubscribe();
      player.dispose();
    };
  }, [player]);
  const play = (word: string) => {
    lastWord.current = word;
    return player.play(word);
  };
  return {
    playing: state.playing,
    failed: state.failed,
    play,
    retry: () => (lastWord.current ? player.play(lastWord.current) : Promise.resolve(false)),
    stop: () => player.stop(),
    preload: (words: readonly string[]) => player.preload(words),
  };
}
