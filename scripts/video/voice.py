"""Holdline demo narration, Piper en_US-ryan-high, local. Writes voice/<scene>.wav + durations.json."""
import json, os, subprocess, sys
from pathlib import Path
VOICE = Path(os.environ.get("PIPER_VOICE", "en_US-ryan-high.onnx"))
OUT = Path(os.environ.get("VIDEO_OUT", "video-out")) / "voice"
SCENES = {
    "hook": "One wildfire a day. On your real table.",
    "place": "Open the page in the Quest browser, look at a table, and pinch. The board lands on it, and stays there.",
    "day0": "A first visit teaches by doing. Wind leans the fire. Slope makes it race uphill. Roads stop it.",
    "line": "Then your first line, drawn with your hand. The crews dig it, and the fire is contained.",
    "daily": "Every day brings a new fire, the same for everyone. Read the wind, draw a line, near or far, and the crews dig it while the fire runs.",
    "tools": "Later fires add a backburn and a water drop. Pinch and hold on a dug line, or drag a strip for the aircraft.",
    "result": "At the end, you see your fire next to the same fire with no one acting. Same wind, same luck. Here, six houses stand instead of three.",
    "journal": "A journal keeps your streak, and a burn scar for every day.",
    "access": "Every action works with either hand, with gaze, or with dwell alone. High contrast, captions and a slower fire are in settings.",
    "close": "Holdline. A simplified model, not a forecast. Play it today, in the Quest browser.",
}
def dur(p):
    o = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(p)], capture_output=True, text=True).stdout
    return round(float(o), 2)
OUT.mkdir(parents=True, exist_ok=True)
d = {}
for k, text in SCENES.items():
    p = OUT / f"{k}.wav"
    subprocess.run([sys.executable, "-m", "piper", "-m", str(VOICE), "--length-scale", "1.04", "--sentence-silence", "0.3", "-f", str(p)], input=text.encode(), check=True, capture_output=True)
    d[k] = dur(p)
(OUT / "durations.json").write_text(json.dumps(d, indent=1))
(OUT / "text.json").write_text(json.dumps(SCENES, indent=1))
print(d, "total", round(sum(d.values()), 1))
