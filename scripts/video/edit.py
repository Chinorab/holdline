"""Assemble the Holdline demo from the master clips. Times are clip seconds (from marks.json)."""
import json, os, subprocess
from pathlib import Path
R = Path(os.environ.get("VIDEO_OUT", "video-out"))
C = R / "clips"; P = R / "build/png"; V = R / "voice"; T = R / "build/seg"; T.mkdir(exist_ok=True)
M = {c: {m["n"]: m["s"] for m in json.loads((C / c / "marks.json").read_text())} for c in ("c1", "c2")}
c1, c2 = M["c1"], M["c2"]
DUR = json.loads((V / "durations.json").read_text())

# (clip, start, end, speed, voice key or None, voice offset)
SEGS = [
    ("c2", c2["backburn"] + 8.6, c2["water"] + 0.6, 1, "hook", 0.8),
    ("c1", 1.5, c1["placed"] + 1.6, 1, "place", 0.5),
    ("c1", c1["placed"] + 1.6, c1["linePrompt"] + 0.5, 5, "day0", 0.6),
    ("c1", c1["linePrompt"] + 0.5, c1["lineDrawn"] + 1.0, 1, "line", 3.0),
    ("c1", c1["lineDrawn"] + 1.0, c1["contained"] + 2.5, 8, None, 0),
    ("c2", 0.0, c2["plan"], 2, "daily", 0.4),
    ("c2", c2["plan"] + 1.7, c2["start"] + 2.0, 1, None, 0),
    ("c2", c2["start"] + 2.0, c2["backburn"], 3, None, 0),
    ("c2", c2["backburn"], c2["backburn"] + 8.6, 1, "tools", 0.6),
    ("c2", c2["water"], c2["water"] + 8.0, 1, None, 0),
    ("c2", c2["water"] + 8.0, c2["outcome"], 16, None, 0),
    ("c2", c2["outcome"], c2["replay"], 1, "result", 0.3),
    ("c2", c2["replay"], c2["journal"], 1, None, 0),
    ("c2", c2["journal"], c2["journal"] + 6.0, 1, "journal", 0.8),
    ("c3", 0.5, 24.0, 2, "access", 0.5),
    ("end", 0, 7.0, 1, "close", 0.6),
]

def atempo(k):
    parts = []
    while k > 2.0: parts.append("atempo=2.0"); k /= 2.0
    parts.append(f"atempo={k:.4f}")
    return ",".join(parts)

def run(cmd): subprocess.run(cmd, check=True)

files, timeline, t = [], [], 0.0
for i, (clip, a, b, k, voice, voff) in enumerate(SEGS):
    out = T / f"s{i:02d}.mp4"
    if clip == "end":
        run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-t", f"{b}", "-i", str(P / "endcard.png"), "-f", "lavfi", "-t", f"{b}", "-i", "anullsrc=r=48000:cl=stereo",
             "-vf", "fps=30,format=yuv420p,fade=in:st=0:d=0.6", "-c:v", "libx264", "-crf", "17", "-c:a", "aac", "-b:a", "192k", "-shortest", str(out)])
        d = b
    else:
        d = (b - a) / k
        vf = f"setpts=(PTS-STARTPTS)/{k}"
        inputs = ["-ss", f"{a:.3f}", "-to", f"{b:.3f}", "-i", str(C / f"{clip}.mp4")]
        if k != 1:
            badge = P / f"speed_{int(k)}x.png"
            assert badge.exists(), badge
            inputs += ["-i", str(badge)]
        fc = f"[0:v]{vf},fps=30[v0]"
        if len(inputs) > 6: fc += ";[v0][1:v]overlay=0:0[v1]"; vout = "[v1]"
        else: vout = "[v0]"
        gain = 0.55 if k == 1 else 0.3
        fc += f";[0:a]asetpts=PTS-STARTPTS,{atempo(k) if k != 1 else 'anull'},volume={gain}[a]"
        if i == 0: fc = fc.replace("fps=30[v0]", "fps=30,fade=in:st=0:d=0.8[v0]")
        run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", fc, "-map", vout, "-map", "[a]", "-t", f"{d:.3f}",
             "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", str(out)])
    files.append(out)
    if voice: timeline.append((voice, t + voff))
    print(f"s{i:02d} {clip} {a:.1f}-{b:.1f} x{k} -> {d:.1f}s at {t:.1f}")
    t += d

lst = T / "list.txt"
lst.write_text("".join(f"file '{f.as_posix()}'\n" for f in files))
run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(T / "body.mp4")])

# Voice track, captions (same words), ducking of the game sound under the voice.
inputs = ["-i", str(T / "body.mp4")]
fc, vlabels, ov = [], [], "[0:v]"
for j, (key, at) in enumerate(timeline):
    inputs += ["-i", str(V / f"{key}.wav")]
    fc.append(f"[{j + 1}:a]adelay={int(at * 1000)}|{int(at * 1000)},aresample=48000,aformat=channel_layouts=stereo[v{j}]")
    vlabels.append(f"[v{j}]")
n = len(timeline)
for j, (key, at) in enumerate(timeline):
    inputs += ["-i", str(P / f"cap_{key}.png")]
    end = at + DUR[key] + 0.35
    fc.append(f"{ov}[{n + 1 + j}:v]overlay=0:0:enable='between(t,{at:.2f},{end:.2f})'[o{j}]")
    ov = f"[o{j}]"
fc.append(f"{''.join(vlabels)}amix=inputs={n}:normalize=0,volume=1.6[voice]")
fc.append("[voice]asplit=2[vo1][vo2]")
fc.append("[0:a][vo1]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[duck]")
fc.append("[duck][vo2]amix=inputs=2:normalize=0,alimiter=limit=0.95[aout]")
fc.append(f"{ov}fade=out:st={t - 0.8:.2f}:d=0.8[vout]")
run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(fc), "-map", "[vout]", "-map", "[aout]",
     "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(R / "holdline_demo.mp4")])
print("total", round(t, 1))
