export type SoundOutcome = 'correct' | 'incorrect';

/** Original procedural tones. No media downloads, tracking, or audio until user opt-in. */
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
      const notes = outcome === 'correct' ? [523.25, 659.25, 783.99] : [329.63, 261.63];
      for (const [index, frequency] of notes.entries()) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const note = { oscillator, gain };
        this.active.add(note);
        const start = context.currentTime + index * 0.1;
        const end = start + 0.14;
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.045, start + 0.015);
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
