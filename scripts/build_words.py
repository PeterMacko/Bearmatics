"""SCRUM-83: generate the English word audio for Bearmatics (Kokoro-82M, British voice bf_emma).

Each file must contain ONLY its word. Kokoro often adds a short vowel before a lone word
(heard as "a seven", "the sister"), so every candidate is checked with Whisper speech
recognition; a leading extra syllable is cut at the start of the real word (Whisper word
timestamp refined to the quietest 10 ms frame nearby) and the result is re-checked.
Candidates are tried at several speeds and text forms until one passes.

Usage: python build_words.py <words.txt> <out_dir> [voice]
Output: <out_dir>/<word>.mp3 (mono, 24 kHz, 64 kbps, silence-trimmed, loudness -16 LUFS)
        <out_dir>/report.json (word, chosen variant, heard text, duration, cut seconds)
Model: Kokoro-82M (Apache-2.0) via kokoro-onnx (MIT); checker: faster-whisper small.en (MIT).
Runs offline once the model files are present. Nothing is called at app runtime.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

try:  # macs4 has no system ffmpeg
    import static_ffmpeg

    static_ffmpeg.add_paths()
except ImportError:
    pass
from faster_whisper import WhisperModel
from kokoro_onnx import Kokoro

HERE = Path(__file__).parent
RATE = 24000
kokoro = Kokoro(str(HERE / "kokoro-v1.0.onnx"), str(HERE / "voices-v1.0.bin"))
whisper = WhisperModel("small.en", device="cpu", compute_type="int8", cpu_threads=2)

ALIASES = {
    "suzy": {"suzy", "susie", "suzie", "susy"},
    "grey": {"grey", "gray"},
    "seven": {"seven", "7"},
    "ten": {"ten", "10"},
    "eleven": {"eleven", "11"},
    "seventeen": {"seventeen", "17"},
    "sixteen": {"sixteen", "16"},
    "thirteen": {"thirteen", "13"},
    "seventy": {"seventy", "70"},
    "sixty": {"sixty", "60"},
    "stair": {"stair", "stare"},
}
FILLERS = {"a", "the", "uh", "ah", "oh", "and", "an", "is", "of", "or", "he's", "ya", "i"}


def norm(token: str) -> str:
    return token.lower().strip(" .,!?…-'\"")


def is_word(token: str, word: str) -> bool:
    return norm(token) in ALIASES.get(word.lower(), {word.lower()})


def to16k(audio: np.ndarray) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-f", "f32le", "-ar", str(RATE), "-ac", "1", "-i", "-",
         "-f", "f32le", "-ar", "16000", "-ac", "1", "-"],
        input=audio.astype(np.float32).tobytes(), capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, np.float32)


def hear(audio: np.ndarray):
    pad = 0.5
    a16 = np.concatenate([np.zeros(8000, np.float32), to16k(audio), np.zeros(8000, np.float32)])
    segments, _ = whisper.transcribe(a16, word_timestamps=True, beam_size=5, language="en",
                                     condition_on_previous_text=False)
    return [(w.word.strip(), w.start - pad, w.end - pad) for s in segments for w in s.words]


def trim_silence(audio: np.ndarray, threshold_db=-45.0, keep=0.06) -> np.ndarray:
    frame = RATE // 100
    rms = np.array([np.sqrt(np.mean(audio[i:i + frame] ** 2) + 1e-12) for i in range(0, len(audio), frame)])
    loud = np.where(20 * np.log10(rms) > threshold_db)[0]
    if not len(loud):
        return audio
    start = max(0, loud[0] * frame - int(keep * RATE))
    end = min(len(audio), (loud[-1] + 1) * frame + int(keep * RATE))
    return audio[start:end]


def quietest_near(audio: np.ndarray, t: float, window=0.06) -> int:
    frame = RATE // 100
    lo, hi = max(0, int((t - window) * RATE)), min(len(audio) - frame, int((t + window) * RATE))
    best, best_rms = int(t * RATE), 1e9
    for i in range(lo, hi, frame // 2):
        rms = float(np.sqrt(np.mean(audio[i:i + frame] ** 2)))
        if rms < best_rms:
            best, best_rms = i, rms
    return best


def fade_in(audio: np.ndarray, seconds=0.012) -> np.ndarray:
    n = min(len(audio), int(seconds * RATE))
    out = audio.copy()
    out[:n] *= np.linspace(0, 1, n)
    return out


def attempt(word: str, voice: str, speed: float, text: str):
    samples, rate = kokoro.create(text, voice=voice, speed=speed, lang="en-gb")
    assert rate == RATE
    audio = trim_silence(np.asarray(samples, np.float32))
    words = hear(audio)
    tokens = [norm(w) for w, _, _ in words if norm(w)]
    if len(tokens) == 1 and is_word(tokens[0], word):
        return audio, words, 0.0
    # Leading extra syllable(s) followed by the word: cut at the word's start and re-check.
    hits = [i for i, (w, _, _) in enumerate(words) if is_word(w, word)]
    if hits and hits[-1] == len(words) - 1 and all(norm(w) in FILLERS or len(norm(w)) <= 2
                                                     for w, _, _ in words[: hits[-1]]):
        cut = quietest_near(audio, max(0.0, words[hits[-1]][1]))
        cut_audio = fade_in(trim_silence(audio[cut:]))
        again = hear(cut_audio)
        tokens = [norm(w) for w, _, _ in again if norm(w)]
        if len(tokens) == 1 and is_word(tokens[0], word):
            return cut_audio, again, cut / RATE
    return None, words, 0.0


def encode(audio: np.ndarray, out: Path) -> float:
    wav = out.with_suffix(".wav")
    pad = np.zeros(int(0.04 * RATE), np.float32)
    sf.write(wav, np.concatenate([pad, audio, pad]), RATE)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                    "-ar", str(RATE), "-ac", "1", "-b:a", "64k", str(out)], check=True)
    wav.unlink()
    probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                            str(out)], capture_output=True, text=True, check=True)
    return float(probe.stdout)


def carrier(word: str, voice: str, speed: float, text: str):
    """Say the word at the end of a short sentence (natural pronunciation), keep only the word."""
    samples, _ = kokoro.create(text, voice=voice, speed=speed, lang="en-gb")
    audio = trim_silence(np.asarray(samples, np.float32))
    words = hear(audio)
    if not words or not is_word(words[-1][0], word):
        return None, words, 0.0
    cut = quietest_near(audio, max(0.0, words[-1][1]), window=0.04)
    cut_audio = fade_in(trim_silence(audio[cut:]))
    again = hear(cut_audio)
    tokens = [norm(w) for w, _, _ in again if norm(w)]
    if len(tokens) == 1 and is_word(tokens[0], word):
        return cut_audio, again, cut / RATE
    return None, again, 0.0


def build(word: str, out_dir: Path, voice: str) -> dict:
    tries = []
    plans = [(attempt, speed, text) for speed in (0.9, 0.85, 0.95, 1.0, 0.8)
             for text in (word, f"{word}!", f"{word}.")]
    plans += [(carrier, speed, text) for speed in (0.9, 0.85, 1.0)
              for text in (f"Now say: {word}.", f"The next word is {word}.", f"Listen. {word}.")]
    for method, speed, text in plans:
        audio, heard, cut = method(word, voice, speed, text)
        tries.append({"speed": speed, "text": text, "heard": " ".join(w for w, _, _ in heard)})
        if audio is not None:
            duration = encode(audio, out_dir / f"{word.lower()}.mp3")
            return {"word": word, "ok": True, "speed": speed, "text": text, "cut": round(cut, 3),
                    "heard": " ".join(w for w, _, _ in heard), "duration": round(duration, 3),
                    "tries": len(tries)}
    return {"word": word, "ok": False, "tries": tries}


if __name__ == "__main__":
    words_file, out_dir = sys.argv[1], Path(sys.argv[2])
    voice = sys.argv[3] if len(sys.argv) > 3 else "bf_emma"
    out_dir.mkdir(parents=True, exist_ok=True)
    words = [w.strip() for w in Path(words_file).read_text().splitlines() if w.strip()]
    report = [build(w, out_dir, voice) for w in words]
    for r in report:
        print(r["word"], "OK" if r["ok"] else "FAILED", r.get("heard", ""), r.get("cut", ""), r.get("duration", ""))
    (out_dir / f"report-{Path(words_file).stem}.json").write_text(json.dumps(report, indent=1))
