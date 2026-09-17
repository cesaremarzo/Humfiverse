"""App icon: the nine-bar brand mark in white on the brand gradient.

Writes favicon.ico (16/32/48), apple-touch-icon.png (180) and icon-512.png.
Run with the output directory as the only argument.
"""
import sys
import numpy as np
from PIL import Image, ImageDraw

OUT = sys.argv[1] if len(sys.argv) > 1 else '.'

# The mark, in the 120-unit box the SVG logo uses: tall at the edges.
BARS = [(16, 32, 1.0), (27, 29.9, 0.95), (38, 24.1, 0.8), (49, 15.3, 0.6), (60, 5, 0.4),
        (71, 15.3, 0.6), (82, 24.1, 0.8), (93, 29.9, 0.95), (104, 32, 1.0)]
AUBERGINE = (91, 52, 145)
TEAL = (15, 148, 136)


# At 16-32px nine bars turn into a blur, so the small icon keeps every other one.
SMALL_BARS = [(14, 32, 1.0), (37, 24.1, 0.85), (60, 6, 0.5), (83, 24.1, 0.85), (106, 32, 1.0)]


def render(size, radius_ratio=0.22, pad=0.1, bars=None, stroke=6.5):
    K = 8
    n = size * K
    y, x = np.mgrid[0:n, 0:n].astype(float)
    # brand gradient, aubergine to teal along the diagonal
    t = np.clip((x / n) * 0.55 + (y / n) * 0.45, 0, 1)[..., None]
    bg = np.array(AUBERGINE) * (1 - t) + np.array(TEAL) * t
    # a soft light from the top left keeps it from looking flat at large sizes
    bg = bg * (1.12 - 0.3 * ((x + y) / (2 * n)))[..., None]
    img = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')

    mark = Image.new('L', (n, n), 0)
    dr = ImageDraw.Draw(mark)
    scale = n * (1 - 2 * pad) / 120
    off = n * pad
    w = stroke * scale
    for bx, bh, op in (bars or BARS):
        cx = off + bx * scale
        y1 = off + (60 - bh) * scale
        y2 = off + (60 + bh) * scale
        dr.line([(cx, y1), (cx, y2)], fill=int(255 * op), width=int(round(w)))
        for yy in (y1, y2):                     # round caps
            dr.ellipse([cx - w / 2, yy - w / 2, cx + w / 2, yy + w / 2], fill=int(255 * op))
    img.paste(Image.new('RGBA', (n, n), (255, 255, 255, 255)), (0, 0), mark)

    corner = Image.new('L', (n, n), 0)
    ImageDraw.Draw(corner).rounded_rectangle([0, 0, n - 1, n - 1], radius=int(n * radius_ratio), fill=255)
    img.putalpha(corner)
    return img.resize((size, size), Image.LANCZOS)


big = render(512)
big.save(f'{OUT}/icon-512.png')
render(180).save(f'{OUT}/apple-touch-icon.png')
# .ico: square icons look better with less padding at 16px, so re-render per size
ico = [render(48),
       render(32, pad=0.06, bars=SMALL_BARS, stroke=11),
       render(16, pad=0.04, bars=SMALL_BARS, stroke=13)]
ico[0].save(f'{OUT}/favicon.ico', sizes=[(48, 48), (32, 32), (16, 16)], append_images=ico[1:])
print('done favicon')
