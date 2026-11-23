type SoundOutcome = 'correct' | 'incorrect' | 'complete' | 'badge' | 'pop' | 'growl' | 'step';

/** Minimal part of HTMLAudioElement the growl needs (injectable for tests). */
type GrowlAudio = {
  src: string;
  preload: string;
  currentTime: number;
  play(): Promise<void> | void;
  pause(): void;
};

export function growlUrl(): string {
  return `${import.meta.env.BASE_URL}audio/bear-growl.mp3`;
}

/** Original procedural tones. Context activation is only requested by user gestures. */
export class FeedbackAudio {
  private context: AudioContext | null = null;
  private enabled = false;
  private revision = 0;
  private active = new Set<{ oscillator: OscillatorNode; gain: GainNode }>();
  private growlElement: GrowlAudio | null = null;
  constructor(
    private readonly factory: () => AudioContext = () => new window.AudioContext(),
    private readonly growlFactory: () => GrowlAudio = () => new Audio(),
  ) {}

  async setEnabled(value: boolean): Promise<boolean> {
    const revision = ++this.revision;
    this.enabled = false;
    this.stop();
    this.stopGrowl();
    if (!value) return false;
    try {
      const context = this.context ?? (this.context = this.factory());
      if (context.state === 'suspended') await context.resume();
      if (revision !== this.revision || this.context !== context || context.state !== 'running')
        return false;
      this.enabled = true;
      return true;
    } catch {
      return false;
    }
  }

  play(outcome: SoundOutcome): boolean {
    const context = this.context;
    if (!this.enabled || !context || context.state !== 'running') return false;
    try {
      if (outcome === 'growl') return this.growl();
      // Cancel older feedback so fast retries cannot pile up loud overlapping sounds.
      this.stop();
      const anchor = context.currentTime;
      if (outcome === 'pop' || outcome === 'step') {
        // SCRUM-156: a short soft pop when a picture moves (a quick falling blip, quieter
        // than the answer sounds). SCRUM-262: the bear's step is a lower, softer pop.
        const step = outcome === 'step';
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const note = { oscillator, gain };
        this.active.add(note);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(step ? 330 : 720, anchor);
        oscillator.frequency.exponentialRampToValueAtTime(step ? 190 : 320, anchor + 0.09);
        gain.gain.setValueAtTime(0, anchor);
        gain.gain.linearRampToValueAtTime(step ? 0.25 : 0.35, anchor + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, anchor + 0.12);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.onended = () => {
          this.active.delete(note);
          oscillator.disconnect();
          gain.disconnect();
        };
        oscillator.start(anchor);
        oscillator.stop(anchor + 0.13);
        return true;
      }
      // A new bear badge (SCRUM-117) rings like a correct answer, a little higher.
      const badge = outcome === 'badge';
      if (badge) outcome = 'correct';
      const notes = badge
        ? [783.99, 987.77, 1318.51]
        : outcome === 'complete'
          ? [523.25, 659.25, 783.99, 1046.5]
          : outcome === 'correct'
            ? [523.25, 659.25, 783.99]
            : [329.63, 261.63];
      for (const [index, frequency] of notes.entries()) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const note = { oscillator, gain };
        this.active.add(note);
        // Non-overlapping sine notes bound the absolute aggregate envelope
        // to 0.6, independent of phase, leaving headroom below full scale.
        const start =
          anchor + index * (outcome === 'complete' ? 0.24 : outcome === 'correct' ? 0.22 : 0.26);
        const end =
          outcome === 'complete'
            ? index === 3
              ? anchor + 2
              : start + 0.22
            : anchor + (outcome === 'correct' ? [0.2, 0.42, 1] : [0.24, 0.9])[index];
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.6, start + 0.015);
        gain.gain.linearRampToValueAtTime(0.48, end - 0.12);
        gain.gain.linearRampToValueAtTime(0, end);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.onended = () => {
          this.active.delete(note);
          oscillator.disconnect();
          gain.disconnect();
        };
        oscillator.start(start);
        oscillator.stop(end);
      }
      return true;
    } catch {
      this.enabled = false;
      this.stop();
      return false;
    }
  }

  /**
   * SCRUM-172: the bear's growl when it is tapped: a recorded roar (Peter's pick, ~0.9 s,
   * public/audio/bear-growl.mp3). One shared element, restarted on every tap; it does not cut
   * other sounds (the bear plays one growl at a time). Mute and dispose pause it.
   */
  private growl(): boolean {
    const element = this.growlElement ?? (this.growlElement = this.growlFactory());
    if (!element.src) {
      element.preload = 'auto';
      element.src = growlUrl();
    }
    element.currentTime = 0;
    void Promise.resolve(element.play()).catch(() => {
      /* Blocked or missing file: the bubble and hop still show. */
    });
    return true;
  }

  private stopGrowl(): void {
    try {
      this.growlElement?.pause();
    } catch {
      /* Nothing playing. */
    }
  }

  private stop(): void {
    for (const { oscillator, gain } of this.active) {
      try {
        oscillator.stop();
      } catch {
        /* Already ended. */
      }
      try {
        oscillator.disconnect();
        gain.disconnect();
      } catch {
        /* Browser already disconnected nodes. */
      }
    }
    this.active.clear();
  }

  dispose(): void {
    ++this.revision;
    this.enabled = false;
    this.stop();
    this.stopGrowl();
    const context = this.context;
    this.context = null;
    if (context) void context.close().catch(() => {});
  }
}
