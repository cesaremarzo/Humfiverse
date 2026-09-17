"""Analogue VU meter: brushed bezel, backlit face, red zone, needle, glass."""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from render import blur, grid, shade, save, rng


def run_vu(W=900, Hh=640):
    K = 3
    w, h = W * K, Hh * K
    x, y = grid(h, w)

    # brushed dark bezel
    brush = np.cumsum(rng.standard_normal((h, w)), axis=1)
    brush = brush - blur(brush, 40)
    brush = brush / (np.abs(brush).max() + 1e-6)
    bez = 0.12 + 0.05 * brush + 0.06 * (1 - y / h)
    img = bez[..., None] * np.array([1.0, 0.97, 0.93])
    e = 14 * K
    img = img + (np.clip(1 - y / e, 0, 1) * 0.3 + np.clip(1 - x / e, 0, 1) * 0.1)[..., None]
    img = img - (np.clip(1 - (h - y) / e, 0, 1) * 0.08)[..., None]
    am = Image.new('L', (w, h), 0)
    ImageDraw.Draw(am).rounded_rectangle([0, 0, w - 1, h - 1], radius=42 * K, fill=255)
    alpha = np.asarray(am) / 255.0

    # backlit face
    fx0, fy0, fx1, fy1 = 70 * K, 64 * K, w - 70 * K, h - 150 * K
    fm = Image.new('L', (w, h), 0)
    ImageDraw.Draw(fm).rounded_rectangle([fx0, fy0, fx1, fy1], radius=18 * K, fill=255)
    face_m = np.asarray(fm) / 255.0
    cx, cy = w / 2, fy1 + 40 * K
    d = np.hypot((x - cx) / (w * 0.5), (y - (fy0 + fy1) * 0.6) / (h * 0.45))
    face = np.array([1.0, 0.9, 0.66]) * (1 - 0.4 * np.clip(d, 0, 1.4)[..., None] ** 2)
    face = face + blur(rng.standard_normal((h, w)), 1.5)[..., None] * 0.012
    img = img * (1 - face_m[..., None]) + face * face_m[..., None]

    # scale
    ink = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    dr = ImageDraw.Draw(ink)
    R = 300 * K
    a0, a1, azero = np.radians(-50), np.radians(50), np.radians(22)

    def pt(ang, rad):
        return (cx + rad * np.sin(ang), cy - rad * np.cos(ang))

    red, dark = (178, 36, 30, 240), (34, 25, 18, 255)
    for i in range(80):
        t0 = azero + (a1 - azero) * i / 80
        t1 = azero + (a1 - azero) * (i + 1) / 80
        dr.polygon([pt(t0, R), pt(t1, R), pt(t1, R + 14 * K), pt(t0, R + 14 * K)], fill=red)
    for i in range(200):
        t0 = a0 + (azero - a0) * i / 200
        t1 = a0 + (azero - a0) * (i + 1) / 200
        dr.line([pt(t0, R), pt(t1, R)], fill=dark, width=3 * K)
    for i in range(41):
        t = a0 + (a1 - a0) * i / 40
        major = i % 5 == 0
        col = red if t > azero else dark
        dr.line([pt(t, R), pt(t, R + (32 if major else 17) * K)], fill=col, width=(4 if major else 2) * K)
        if major:
            px, py = pt(t, R + 54 * K)
            rr = 5 * K
            dr.ellipse([px - rr, py - rr, px + rr, py + rr], fill=col)
    for i in range(21):
        t = a0 + (a1 - a0) * i / 20
        dr.line([pt(t, R - 26 * K), pt(t, R - 38 * K)], fill=(70, 52, 34, 190), width=2 * K)
    ink = ink.filter(ImageFilter.GaussianBlur(0.6 * K))
    ia = np.asarray(ink).astype(float) / 255
    m = ia[..., 3:4] * face_m[..., None]
    img = img * (1 - m) + ia[..., :3] * m

    # needle and its shadow
    tip = pt(np.radians(14), R + 26 * K)
    sh = Image.new('L', (w, h), 0)
    ImageDraw.Draw(sh).line([(cx + 16 * K, cy + 12 * K), (tip[0] + 16 * K, tip[1] + 12 * K)], fill=200, width=5 * K)
    sh = np.asarray(sh.filter(ImageFilter.GaussianBlur(8 * K))) / 255.0
    img = img * (1 - 0.4 * sh * face_m)[..., None]
    nd = Image.new('L', (w, h), 0)
    ImageDraw.Draw(nd).line([(cx, cy), tip], fill=255, width=4 * K)
    nd = np.asarray(nd.filter(ImageFilter.GaussianBlur(0.5 * K))) / 255.0 * face_m
    img = img * (1 - nd[..., None]) + np.array([0.07, 0.05, 0.05]) * nd[..., None]

    # pivot housing
    hm = Image.new('L', (w, h), 0)
    ImageDraw.Draw(hm).pieslice([cx - 130 * K, fy1 - 90 * K, cx + 130 * K, fy1 + 170 * K], 180, 360, fill=255)
    hm = np.asarray(hm.filter(ImageFilter.GaussianBlur(0.8 * K))) / 255.0 * face_m
    hy = np.clip((y - (fy1 - 90 * K)) / (90 * K), 0, 1)
    hcol = (0.16 - 0.1 * hy)[..., None] * np.array([1, 0.97, 1.03])
    img = img * (1 - hm[..., None]) + hcol * hm[..., None]

    # inner shadow at the top of the face, glass gloss
    inner = np.clip(1 - (y - fy0) / (46 * K), 0, 1) ** 2 * face_m
    img = img * (1 - 0.5 * inner)[..., None]
    gloss = np.clip(1 - ((x - fx0) + (y - fy0) * 2.4) / (w * 0.5), 0, 1) ** 1.6 * face_m
    img = img + (gloss * 0.2)[..., None]
    streak = np.exp(-(((x - fx0) + (y - fy0) * 1.4 - w * 0.62) / (26 * K)) ** 2) * face_m
    img = img + (streak * 0.06)[..., None]

    # screws
    for sx, sy in ((34, 34), (W - 34, 34), (34, Hh - 34), (W - 34, Hh - 34)):
        sxk, syk = sx * K, sy * K
        rr = 13 * K
        nx, ny = (x - sxk) / rr, (y - syk) / rr
        dd = np.hypot(nx, ny)
        mm = np.clip((1 - dd) * rr / K, 0, 1)
        n = np.stack([nx * 0.6, ny * 0.6, np.sqrt(np.clip(1 - 0.36 * dd ** 2, 0, 1))], -1)
        sc = shade(n, [0.75, 0.72, 0.68], True, 1.0, spec_pow=30)
        slot = (np.abs((nx + ny) * 0.707) < 0.14) & (dd < 0.8)
        sc = np.where(slot[..., None], sc * 0.25, sc)
        img = img * (1 - mm[..., None]) + sc * mm[..., None]

    # engraved dots and a teal status LED on the lower plate
    for i in range(7):
        dd = np.hypot(x - (W / 2 - 150 + i * 30) * K, y - (Hh - 78) * K)
        img = img * (1 - 0.55 * np.clip((5 * K - dd) / K, 0, 1))[..., None]
    dd = np.hypot(x - (W / 2 + 130) * K, y - (Hh - 78) * K)
    img = img + np.exp(-(dd / (8 * K)) ** 2)[..., None] * np.array([0.3, 0.95, 0.85]) \
        + np.exp(-(dd / (34 * K)) ** 2)[..., None] * np.array([0.05, 0.3, 0.26])

    save(img, alpha, 'vu-meter', (W, Hh))


if __name__ == '__main__':
    run_vu()
    print('done vu')
