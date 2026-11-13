"""Remove the leading hiss Kokoro adds before some words ("s-queen", "s-grey").
Rule by first sound: voiced start (vowel, b d g l m n r v w y j) -> start at the first voiced frame;
k/p/t start -> keep at most 50 ms of burst before voicing; real hiss starts (s, sh, f, h, th, ch, z)
-> keep up to 200 ms. Usage: python fix_onset.py dir word ... (or 'all')"""
import subprocess
import sys
from pathlib import Path

import numpy as np

import hiss

KEEP_MS = {"voiced": 10, "stop": 50, "fric": 200}


def onset_class(word):
    w = word.lower()
    if w.startswith(("s", "sh", "f", "h", "th", "ch", "z")):
        return "fric"
    if w.startswith(("k", "p", "t", "qu", "c")):
        return "stop"
    return "voiced"


def fix(path):
    a = hiss.load(path)
    fa, fv, n = hiss.analyse(a)
    keep = KEEP_MS[onset_class(path.stem)] // 10
    start_frame = max(fa, fv - keep)
    removed = (start_frame - fa) * 10
    if removed < 20:
        return 0
    lead = int(0.04 * hiss.RATE)  # keep 40 ms of silence before the word
    start = start_frame * hiss.FRAME
    out = np.concatenate([np.zeros(lead, np.float32), a[start:].copy()])
    fade = int(0.008 * hiss.RATE)
    out[lead:lead + fade] *= np.linspace(0, 1, fade)
    wav = path.with_suffix(".wav")
    import soundfile as sf
    sf.write(wav, out, hiss.RATE)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-ar", str(hiss.RATE), "-ac", "1",
                    "-b:a", "64k", str(path)], check=True)
    wav.unlink()
    return removed


if __name__ == "__main__":
    d = Path(sys.argv[1])
    names = sys.argv[2:]
    paths = sorted(d.glob("*.mp3")) if names == ["all"] else [d / f"{n}.mp3" for n in names]
    for p in paths:
        r = fix(p)
        if r:
            print(f"{p.stem:10} {onset_class(p.stem):6} removed {r} ms")
