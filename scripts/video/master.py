"""Turn a captured clip (VFR jpeg frames + times.json + audio.webm) into a CFR 30 fps master mp4."""
import json, subprocess, sys
from pathlib import Path
clip = Path(sys.argv[1]).resolve()
t = json.loads((clip / "times.json").read_text())
times = t["times"]
frames = sorted((clip / "frames").glob("*.jpg"))
assert len(frames) == len(times)
lst = clip / "concat.txt"
with lst.open("w") as f:
    for i, fr in enumerate(frames):
        dur = (times[i + 1] - times[i]) if i + 1 < len(times) else 1 / 30
        f.write(f"file '{fr.as_posix()}'\nduration {dur:.5f}\n")
    f.write(f"file '{frames[-1].as_posix()}'\n")
cmd = ["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst)]
audio = clip / "audio.webm"
if audio.exists() and t.get("audioT0"):
    skip = times[0] - t["audioT0"]
    if skip >= 0:
        cmd += ["-ss", f"{skip:.3f}", "-i", str(audio)]
    else:
        cmd += ["-itsoffset", f"{-skip:.3f}", "-i", str(audio)]
    cmd += ["-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "192k"]
cmd += ["-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-shortest", str(clip.parent / f"{clip.name}.mp4")]
print(" ".join(cmd[:8]), "...")
subprocess.run(cmd, check=True)
print("skip", times[0] - (t.get("audioT0") or times[0]), "span", times[-1] - times[0])
