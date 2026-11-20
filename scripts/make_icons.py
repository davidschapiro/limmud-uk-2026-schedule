#!/usr/bin/env python3
"""Generate the app icons (Magen David on the app's accent blue). Run once; output goes to public/icons/."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
BG, GOLD = (47, 63, 168), (242, 193, 78)


def icon(size: int, maskable: bool, rounded: bool) -> Image.Image:
    S = size * 4  # draw large, downsample for smooth edges
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded and not maskable:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=BG)
    else:
        d.rectangle([0, 0, S, S], fill=BG)
    glyph = 0.50 if maskable else 0.66          # maskable icons keep content inside the central safe zone
    r = S * glyph / 2
    cx, cy = S / 2, S / 2
    h = r * 1.5
    w = r * 3 ** 0.5
    up = [(cx, cy - r), (cx + w / 2, cy - r + h), (cx - w / 2, cy - r + h)]
    down = [(cx, cy + r), (cx + w / 2, cy + r - h), (cx - w / 2, cy + r - h)]
    stroke = max(2, int(S * 0.045))
    for tri in (up, down):
        d.line(tri + [tri[0], tri[1]], fill=GOLD, width=stroke, joint="curve")
    return img.resize((size, size), Image.LANCZOS)


OUT.mkdir(parents=True, exist_ok=True)
icon(192, False, True).save(OUT / "icon-192.png")
icon(512, False, True).save(OUT / "icon-512.png")
icon(512, True, False).save(OUT / "icon-maskable-512.png")
icon(180, False, False).convert("RGB").save(OUT / "apple-touch-icon.png")   # iOS rounds the corners itself
icon(48, False, True).save(OUT / "favicon-48.png")
print("icons written to", OUT)
