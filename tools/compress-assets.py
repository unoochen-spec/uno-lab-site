#!/usr/bin/env python3
"""Resize large PNGs + oxipng; re-encode MP4 for web. Skip assets/.backup."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Need Pillow: pip install Pillow", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
MAX_PNG_SIDE = 1920


def process_png(path: Path) -> tuple[int, int]:
    before = path.stat().st_size
    try:
        im = Image.open(path)
        im.load()
    except OSError as e:
        print(f"skip {path.name}: {e}", file=sys.stderr)
        return before, before

    w, h = im.size
    if max(w, h) > MAX_PNG_SIDE:
        ratio = MAX_PNG_SIDE / max(w, h)
        nw, nh = max(1, int(w * ratio)), max(1, int(h * ratio))
        im = im.resize((nw, nh), Image.Resampling.LANCZOS)

    if im.mode not in ("RGBA", "RGB", "L"):
        im = im.convert("RGBA")

    im.save(path, format="PNG", optimize=True, compress_level=9)
    after = path.stat().st_size
    return before, after


def oxipng_one(path: Path) -> None:
    subprocess.run(
        ["oxipng", "-o3", "--strip", "safe", "-q", str(path)],
        capture_output=True,
    )


def compress_mp4(path: Path) -> None:
    tmp = path.with_suffix(".tmp-compress.mp4")
    # FFmpeg filter comma must be escaped or the graph splits at ",".
    vf = r"scale=min(1280\,iw):-2"
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(path),
        "-c:v",
        "libx264",
        "-crf",
        "28",
        "-preset",
        "medium",
        "-vf",
        vf,
        "-c:a",
        "aac",
        "-b:a",
        "72k",
        "-movflags",
        "+faststart",
        str(tmp),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"ffmpeg fail {path.name}: {r.stderr[-400:]}", file=sys.stderr)
        tmp.unlink(missing_ok=True)
        return
    tmp.replace(path)


def main() -> None:
    if not ASSETS.is_dir():
        print(f"Missing {ASSETS}", file=sys.stderr)
        sys.exit(1)

    png_before = png_after = 0
    for path in sorted(ASSETS.rglob("*.png")):
        if ".backup" in path.parts:
            continue
        b, a = process_png(path)
        oxipng_one(path)
        a = path.stat().st_size
        png_before += b
        png_after += a

    print(
        f"PNG total: {png_before / 1e6:.2f} MB -> {png_after / 1e6:.2f} MB ({100 * png_after / png_before:.1f}%)"
    )

    for path in sorted(ASSETS.glob("*.mp4")):
        print(f"MP4 {path.name} …")
        compress_mp4(path)
        print(f"  -> {path.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
