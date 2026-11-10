export type SoundOutcome = 'correct' | 'incorrect' | 'complete';

/** Original procedural tones. Context activation is only requested by user gestures. */
export class FeedbackAudio {
  private context: AudioContext | null = null;
  private enabled = false;
  private revision = 0;
  private active = new Set<{ oscillator: OscillatorNode; gain: GainNode }>();
  constructor(private readonly factory: () => AudioContext = () => new window.AudioContext()) {}

  async setEnabled(value: boolean): Promise<boolean> {
    const revision = ++this.revision;
    this.enabled = false;
    this.stop();
    if (!value) return false;
    try {
      const context = this.context ?? (this.context = this.factory());
      if (context.state === 'suspended') await context.resume();
      if (revision !== this.revision || this.context !== context || context.state !== 'running') return false;
      this.enabled = true;
      return true;
    } catch { return false; }
  }

  play(outcome: SoundOutcome): boolean {
    const context = this.context;
    if (!this.enabled || !context || context.state !== 'running') return false;
    try {
      // Cancel older feedback so fast retries cannot pile up loud overlapping sounds.
      this.stop();
      const anchor = context.currentTime;
      const notes = outcome === 'complete' ? [523.25, 659.25, 783.99, 1046.5] : outcome === 'correct' ? [523.25, 659.25, 783.99] : [329.63, 261.63];
      for (const [index, frequency] of notes.entries()) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const note = { oscillator, gain };
        this.active.add(note);
        // Non-overlapping sine notes bound the absolute aggregate envelope
        // to 0.6, independent of phase, leaving headroom below full scale.
        const start = anchor + index * (outcome === 'complete' ? 0.24 : outcome === 'correct' ? 0.22 : 0.26);
        const end = outcome === 'complete'
          ? (index === 3 ? anchor + 2 : start + 0.22)
          : anchor + (outcome === 'correct' ? [0.2, 0.42, 1] : [0.24, 0.9])[index];
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.6, start + 0.015);
        gain.gain.linearRampToValueAtTime(0.48, end - 0.12);
        gain.gain.linearRampToValueAtTime(0, end);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.onended = () => { this.active.delete(note); oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(start); oscillator.stop(end);
      }
      return true;
    } catch {
      this.enabled = false;
      this.stop();
      return false;
    }
  }

  private stop(): void {
    for (const { oscillator, gain } of this.active) {
      try { oscillator.stop(); } catch { /* Already ended. */ }
      try { oscillator.disconnect(); gain.disconnect(); } catch { /* Browser already disconnected nodes. */ }
    }
    this.active.clear();
  }

  dispose(): void {
    ++this.revision; this.enabled = false; this.stop();
    const context = this.context; this.context = null;
    if (context) void context.close().catch(() => {});
  }
}
