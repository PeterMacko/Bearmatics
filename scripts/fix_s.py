"""For words starting with s/sh/z: remove a voiced lead-in ("a-seven") before the real hiss.
Finds the first run of >= 4 high-frequency frames; if voiced frames come before it, the word starts
at that run. Usage: python fix_s.py dir word ... ('all' = every s/sh/z word)"""
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

import hiss


def classes(a):
    f = hiss.frames(a)
    rms = np.sqrt((f ** 2).mean(1)) + 1e-9
    spec = np.abs(np.fft.rfft(f * np.hanning(hiss.FRAME), axis=1)) ** 2
    fr = np.fft.rfftfreq(hiss.FRAME, 1 / hiss.RATE)
    hi = spec[:, fr >= 4000].sum(1) / (spec.sum(1) + 1e-12)
    lo = spec[:, (fr >= 80) & (fr < 1000)].sum(1) / (spec.sum(1) + 1e-12)
    db = 20 * np.log10(rms / rms.max())
    return db, hi, lo


def fix(path):
    a = hiss.load(path)
    db, hi, lo = classes(a)
    n = len(db)
    run = next((i for i in range(n - 4) if all(hi[i + k] > 0.5 and db[i + k] > -30 for k in range(4))), None)
    if run is None:
        return 0
    voiced_before = sum(1 for i in range(run) if lo[i] > 0.5 and db[i] > -35)
    if voiced_before < 2:
        return 0
    start = max(0, run - 1) * hiss.FRAME
    lead = int(0.04 * hiss.RATE)
    out = np.concatenate([np.zeros(lead, np.float32), a[start:].copy()])
    fade = int(0.006 * hiss.RATE)
    out[lead:lead + fade] *= np.linspace(0, 1, fade)
    wav = path.with_suffix(".wav")
    sf.write(wav, out, hiss.RATE)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-ar", str(hiss.RATE), "-ac", "1",
                    "-b:a", "64k", str(path)], check=True)
    wav.unlink()
    return start * 1000 // hiss.RATE


if __name__ == "__main__":
    d = Path(sys.argv[1])
    names = sys.argv[2:]
    if names == ["all"]:
        paths = [p for p in sorted(d.glob("*.mp3")) if p.stem.startswith(("s", "z"))]
    else:
        paths = [d / f"{n}.mp3" for n in names]
    for p in paths:
        cut = fix(p)
        print(f"{p.stem:10} {'cut ' + str(cut) + ' ms' if cut else 'ok'}")
