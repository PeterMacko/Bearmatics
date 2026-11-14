"""Find a leading hiss ("s" before the word) in word MP3s: high-frequency, unvoiced frames before the
first voiced frame. Prints words where it lasts > 30 ms. Usage: python hiss.py dir [--fix out_dir]"""
import subprocess
import sys
from pathlib import Path

import numpy as np

RATE = 24000
FRAME = 240  # 10 ms
SIBILANT_START = ("s", "z", "c", "sh")  # words that really start with a hiss sound


def load(path):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(path), "-f", "f32le", "-ac", "1",
                          "-ar", str(RATE), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def frames(a):
    n = len(a) // FRAME
    return a[: n * FRAME].reshape(n, FRAME)


def analyse(a):
    f = frames(a)
    rms = np.sqrt((f ** 2).mean(1)) + 1e-9
    spec = np.abs(np.fft.rfft(f * np.hanning(FRAME), axis=1)) ** 2
    freqs = np.fft.rfftfreq(FRAME, 1 / RATE)
    high = spec[:, freqs >= 4000].sum(1) / (spec.sum(1) + 1e-12)
    low = spec[:, (freqs >= 80) & (freqs < 1000)].sum(1) / (spec.sum(1) + 1e-12)
    db = 20 * np.log10(rms / rms.max())
    audible = db > -40
    voiced = audible & (low > 0.35)
    first_audible = int(np.argmax(audible))
    first_voiced = int(np.argmax(voiced))
    hissy = [i for i in range(first_audible, first_voiced) if high[i] > 0.45]
    return first_audible, first_voiced, len(hissy)


def main():
    src = Path(sys.argv[1])
    fix = Path(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[2] == "--fix" else None
    for path in sorted(src.glob("*.mp3")):
        word = path.stem
        a = load(path)
        fa, fv, hiss = analyse(a)
        sibilant = word.startswith(SIBILANT_START) and not word.startswith(("ch", "cl", "co", "cu", "ca", "cr", "ce"))
        if hiss >= 3:
            print(f"{word:10} hiss {hiss * 10} ms before voice at {fv * 10} ms{'  (starts with s)' if sibilant else ''}")


if __name__ == "__main__":
    main()
