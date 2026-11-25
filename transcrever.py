import sys, wave, numpy as np
from faster_whisper import WhisperModel
wav, out = sys.argv[1], sys.argv[2]
m = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=4)
with wave.open(wav) as w: audio = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
segs, _ = m.transcribe(audio, language="pt", beam_size=1, vad_filter=True)
with open(out, "w") as f:
    for s in segs: f.write(f"[{int(s.start//60):02d}:{int(s.start%60):02d}] {s.text.strip()}\n")
