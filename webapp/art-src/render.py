"""Procedural, photo-like illustrations for the Humfiverse backdrop and landing.

Everything is computed (heightmaps -> normals -> metal/lacquer shading), so the
art is ours, needs no fonts or third-party images, and can be re-rendered.
"""
import sys
import numpy as np
from PIL import Image

OUT = sys.argv[1]
SS = 2
rng = np.random.default_rng(7)


def norm(v):
    return v / np.linalg.norm(v)


def blur(a, sigma):
    if sigma <= 0:
        return a
    h, w = a.shape
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    g = np.exp(-2 * (np.pi * sigma) ** 2 * (fx ** 2 + fy ** 2))
    return np.real(np.fft.ifft2(np.fft.fft2(a) * g))


def normals_from_height(h, strength):
    gy, gx = np.gradient(h)
    n = np.stack([-gx * strength, -gy * strength, np.ones_like(h)], -1)
    return n / np.linalg.norm(n, axis=-1, keepdims=True)


L = norm(np.array([-0.45, -0.65, 0.62]))
H = norm(L + np.array([0, 0, 1.0]))


def studio_env(R):
    """A studio: two tall softboxes, a bright ceiling, a dark floor."""
    rx, ry = R[..., 0], R[..., 1]
    ceiling = np.clip(-ry, 0, 1) ** 1.5 * 0.9
    floor = np.clip(ry, 0, 1) * 0.05
    box1 = np.exp(-((rx + 0.5) / 0.13) ** 2) * np.exp(-((ry + 0.15) / 0.6) ** 2) * 1.2
    box2 = np.exp(-((rx - 0.55) / 0.08) ** 2) * np.exp(-((ry + 0.1) / 0.5) ** 2) * 0.7
    front = np.exp(-((rx + 0.12) ** 2 + (ry + 0.18) ** 2) / 0.05) * 0.75
    return 0.04 + ceiling + floor + box1 + box2 + front


def shade(n, albedo, metal, gloss, spec_pow=80, spec_amt=0.9):
    """metal: reflections tinted by albedo; otherwise a clear coat over albedo."""
    diff = np.clip(n @ L, 0, 1)[..., None]
    R = 2 * n[..., 2:3] * n - np.array([0, 0, 1.0])
    env = studio_env(R)[..., None]
    spec = (np.clip(n @ H, 0, 1) ** spec_pow)[..., None] * spec_amt
    albedo = np.asarray(albedo, dtype=float)
    if metal:
        c = albedo * (0.06 + 0.3 * diff) + albedo * env ** 1.2 * 0.95 * gloss + spec * np.array([1, 0.95, 0.82])
    else:
        fres = (1 - np.clip(n[..., 2:3], 0, 1)) ** 3
        c = albedo * (0.2 + 0.8 * diff) + env * (0.05 + 0.5 * fres) * gloss + spec
    return c


def save(rgb, alpha, name, size=None):
    img = np.concatenate([np.clip(rgb, 0, 1), np.clip(alpha, 0, 1)[..., None]], -1)
    im = Image.fromarray((img * 255 + 0.5).astype(np.uint8), 'RGBA')
    if size:
        im = im.resize(size, Image.LANCZOS)
    im.save(f'{OUT}/{name}.png')
    return im


def grid(h, w):
    y, x = np.mgrid[0:h, 0:w].astype(float)
    return x, y


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- coin
GOLD = [1.0, 0.76, 0.34]


def coin_face(D):
    N = D * SS
    x, y = grid(N, N)
    u = (x - N / 2) / (N / 2)
    v = (y - N / 2) / (N / 2)
    r = np.hypot(u, v)
    a = np.arctan2(v, u)
    px = 1 / (N / 2)

    h = np.full((N, N), 0.5)
    h += 0.04 * (1 - r ** 2)                       # a slightly domed field
    rim = smoothstep(0.84, 0.87, r) * (1 - smoothstep(0.975, 1.0, r))
    h += rim * 0.45
    # beaded circle
    dots = np.cos(a * 64) > 0.55
    h += 0.10 * (np.abs(r - 0.79) < 0.018) * dots
    # beamed eighth notes, with a stave line behind them
    em = np.zeros((N, N))

    def ellipse(cx, cy, rx, ry, ang):
        ca, sa = np.cos(ang), np.sin(ang)
        xx, yy = u - cx, v - cy
        return ((xx * ca + yy * sa) / rx) ** 2 + ((-xx * sa + yy * ca) / ry) ** 2 < 1

    em = np.maximum(em, ellipse(-0.24, 0.30, 0.15, 0.105, -0.4))
    em = np.maximum(em, ellipse(0.22, 0.18, 0.15, 0.105, -0.4))
    em = np.maximum(em, (np.abs(u - (-0.105)) < 0.028) & (v < 0.28) & (v > -0.36))
    em = np.maximum(em, (np.abs(u - 0.355) < 0.028) & (v < 0.16) & (v > -0.48))
    beam_c = -0.36 + (u + 0.105) / 0.46 * -0.12
    em = np.maximum(em, (u > -0.133) & (u < 0.383) & (v > beam_c - 0.02) & (v < beam_c + 0.085))
    beam2 = beam_c + 0.16
    em = np.maximum(em, (u > -0.133) & (u < 0.383) & (v > beam2 - 0.0) & (v < beam2 + 0.06))
    em = em.astype(float)
    h += blur(em, 2.2 * SS) * 0.38
    # stave lines, engraved
    for k in range(5):
        h -= 0.018 * (np.abs(v - (-0.40 + k * 0.2)) < 0.006) * (r < 0.7) * (1 - em)
    # wear and micro-texture
    h += blur(rng.standard_normal((N, N)), 1.0) * 0.0007
    h = blur(h, 0.9 * SS)

    n = normals_from_height(h, 60 * SS / 2)
    alb = np.ones((N, N, 3)) * np.array(GOLD)
    alb *= (1 - 0.12 * em[..., None])             # emblem slightly toned
    c = shade(n, alb, True, 1.0, spec_pow=60)
    # darker, patinated recesses
    cavity = np.clip(blur(h, 6 * SS) - h, 0, 1)
    c *= (1 - np.clip(cavity * 6, 0, 0.5))[..., None]
    alpha = np.clip((1 - r) / px / SS * 1.5 + 0.5, 0, 1)
    return c, alpha


def coin_tilted(D, k, thick):
    """Face compressed to k, with a reeded edge `thick` px (output px) deep."""
    c, a = coin_face(D)
    face = Image.fromarray((np.concatenate([np.clip(c, 0, 1), a[..., None]], -1) * 255).astype(np.uint8), 'RGBA')
    N = D * SS
    fh = int(N * k)
    face = face.resize((N, fh), Image.LANCZOS)
    T = int(thick * SS)
    H_ = fh + T
    x, y = grid(H_, N)
    u = (x - N / 2) / (N / 2)
    uu = np.clip(u, -0.9999, 0.9999)
    ry = fh / 2
    # swept ellipse: inside ellipse centred at any depth between 0 and T
    yc = y - ry
    half = ry * np.sqrt(np.clip(1 - u ** 2, 0, 1))
    inside = (np.abs(u) < 1) & (yc > -half) & (yc < half + T)
    nx = uu
    nz = np.sqrt(1 - uu ** 2)
    n = np.stack([nx, np.full_like(nx, 0.25), nz], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    reed = 0.75 + 0.25 * np.cos(np.arcsin(uu) * 90)
    edge = shade(n, np.array(GOLD) * 0.8, True, 0.9, spec_pow=30) * reed[..., None]
    # soft shading toward the underside
    edge *= (0.9 - 0.3 * np.clip((yc - half) / max(T, 1), 0, 1))[..., None]
    alpha = inside.astype(float)
    alpha = blur(alpha, 0.6)
    base = Image.fromarray((np.concatenate([np.clip(edge, 0, 1), np.clip(alpha, 0, 1)[..., None]], -1) * 255).astype(np.uint8), 'RGBA')
    canvas = Image.new('RGBA', (N, H_), (0, 0, 0, 0))
    canvas.alpha_composite(base)
    canvas.alpha_composite(face, (0, 0))
    return canvas


def run_coins():
    c, a = coin_face(420)
    save(c, a, 'coin', (420, 420))
    t = coin_tilted(420, 0.46, 34)
    t.resize((t.width // SS, t.height // SS), Image.LANCZOS).save(f'{OUT}/coin-tilt.png')

    # a stack of coins with a contact shadow
    W, Hh = 760, 760
    canvas = Image.new('RGBA', (W * SS, Hh * SS), (0, 0, 0, 0))
    sh = np.zeros((Hh * SS, W * SS))
    xs, ys = grid(Hh * SS, W * SS)
    base_y = 600 * SS
    sh = np.exp(-(((xs - 380 * SS) / (300 * SS)) ** 2 + ((ys - base_y - 40 * SS) / (60 * SS)) ** 2) * 2.2) * 0.55
    shadow = np.zeros((Hh * SS, W * SS, 4))
    shadow[..., 3] = sh
    canvas.alpha_composite(Image.fromarray((shadow * 255).astype(np.uint8), 'RGBA'))
    coin_img = coin_tilted(380, 0.46, 30)
    step = 30 * SS
    for s, count, cx in [(0, 7, 250), (1, 4, 520)]:
        for i in range(count):
            jx = int(rng.normal(0, 5) * SS)
            px = cx * SS - coin_img.width // 2 + jx
            py = base_y - coin_img.height + 30 * SS - i * step + (30 * SS if s else 0)
            canvas.alpha_composite(coin_img, (px, py))
    # one coin lying in front
    front = coin_tilted(300, 0.46, 26)
    canvas.alpha_composite(front, (380 * SS, base_y - front.height // 2 + 70 * SS))
    canvas = canvas.resize((W, Hh), Image.LANCZOS)
    bbox = canvas.getbbox()
    canvas.crop(bbox).save(f'{OUT}/coin-stack.png')


# ---------------------------------------------------------------- vinyl
def run_vinyl(D=1100):
    N = D * SS
    x, y = grid(N, N)
    u = (x - N / 2) / (N / 2)
    v = (y - N / 2) / (N / 2)
    r = np.hypot(u, v)
    a = np.arctan2(v, u)
    px = 1 / (N / 2)

    rings = 1400
    ring_vals = rng.random(rings + 1)
    ring_vals = np.convolve(ring_vals, np.ones(3) / 3, mode='same')
    idx = np.clip((r * rings).astype(int), 0, rings)
    ringnoise = ring_vals[idx]
    fine = 0.5 + 0.5 * np.sin(r * N * 1.3)

    grooved = (r > 0.37) & (r < 0.965)
    gaps = np.zeros_like(r)
    for g in (0.49, 0.61, 0.72, 0.84):
        gaps = np.maximum(gaps, np.abs(r - g) < 0.0045)
    runout = (r > 0.335) & (r <= 0.37)

    ang0 = -2.2   # light from the upper left
    def lobe(width):
        d = np.angle(np.exp(1j * (a - ang0)))
        d2 = np.angle(np.exp(1j * (a - ang0 - np.pi)))
        return np.exp(-(d / width) ** 2) + np.exp(-(d2 / width) ** 2) * 0.8

    sharp = lobe(0.16) * (0.35 + 0.65 * r)
    wide = lobe(0.7)

    lum = np.full_like(r, 0.028)
    tex = np.where(grooved & ~gaps.astype(bool), 0.25 + 0.55 * ringnoise * (0.7 + 0.3 * fine), 0.9)
    lum += np.where(grooved | runout, sharp * tex * 0.55 + wide * 0.045, 0)
    lum += np.where(runout, sharp * 0.2, 0)
    # raised rim with a bevel catching the light
    rim = (r >= 0.965) & (r < 1)
    bevel = np.clip((r - 0.975) / 0.025, 0, 1)
    lum += np.where(rim, 0.05 + 0.25 * np.clip(-np.cos(a - ang0), 0, 1) * np.sin(bevel * np.pi) + sharp * 0.2, 0)
    col = lum[..., None] * np.array([0.93, 0.95, 1.0])
    # a faint iridescent sheen along the highlight
    hue = r * 9
    irid = np.stack([np.sin(hue), np.sin(hue + 2.1), np.sin(hue + 4.2)], -1) * 0.5 + 0.5
    col += (sharp * (grooved) * 0.05)[..., None] * irid

    alpha = np.clip((1 - r) / px / SS + 0.5, 0, 1) * (r > 0.33)
    save(col, alpha, 'vinyl', (D, D))

    # label: its own layer so it can turn while the highlight stays put
    lab_r = 0.34
    t = r / lab_r
    lab = np.array([0.23, 0.12, 0.36]) * (1 - 0.45 * t[..., None]) + np.array([0.36, 0.2, 0.57]) * 0.45 * (1 - t[..., None]) ** 2
    lab = lab + blur(rng.standard_normal((N, N)), 1.2)[..., None] * 0.012
    for rr, c_, w in ((0.93, [0.85, 0.68, 0.38], 0.012), (0.87, [0.25, 0.82, 0.74], 0.005)):
        m = np.abs(t - rr) < w
        lab = np.where(m[..., None], np.array(c_), lab)
    # nine-bar brand mark, cream
    heights = [64, 59.9, 48.2, 30.6, 10, 30.6, 48.2, 59.9, 64]
    ops = [1, 0.95, 0.8, 0.6, 0.4, 0.6, 0.8, 0.95, 1]
    lu, lv = u / lab_r, v / lab_r
    for i, (hh, o) in enumerate(zip(heights, ops)):
        bx = -0.36 + i * 0.09
        bh = hh / 64 * 0.26
        cy = -0.42
        m = (np.abs(lu - bx) < 0.026) & (np.abs(lv - cy) < bh / 2 + 0.026 - np.clip(np.abs(lu - bx) - 0.0, 0, 1) * 0)
        # rounded caps
        cap = np.hypot(lu - bx, np.clip(np.abs(lv - cy) - bh / 2, 0, None)) < 0.026
        lab = np.where(cap[..., None], lab * (1 - o) + np.array([0.96, 0.92, 0.85]) * o, lab)
    # a small ring of dashes along the lower edge, like printed small type
    ang = np.arctan2(lv, lu)
    dash = (np.abs(t - 0.74) < 0.018) & (ang > 0.5) & (ang < 2.64) & (np.sin(ang * 70) > 0.1)
    lab = np.where(dash[..., None], lab * 0.4 + np.array([0.9, 0.86, 0.8]) * 0.6, lab)
    dash2 = (np.abs(t - 0.64) < 0.012) & (ang > 0.9) & (ang < 2.24) & (np.sin(ang * 95 + 1) > 0.3)
    lab = np.where(dash2[..., None], lab * 0.6 + np.array([0.9, 0.86, 0.8]) * 0.4, lab)
    # matte paper, slightly domed shading
    lab *= (1.0 - 0.18 * t ** 2)[..., None]
    hole = r < 0.018
    la = np.clip((lab_r - r) / px / SS + 0.5, 0, 1) * np.clip((r - 0.018) / px / SS + 0.5, 0, 1)
    save(lab, la, 'vinyl-label', (D, D))


# ---------------------------------------------------------------- microphone
def run_mic(W=560, Hh=1180):
    Wn, Hn = W * SS, Hh * SS
    x, y = grid(Hn, Wn)
    cx = Wn / 2
    col = np.zeros((Hn, Wn, 3))
    alpha = np.zeros((Hn, Wn))

    def capsule(x0, y1, y2, rad):
        yy = np.clip(y, y1, y2)
        dx, dy = (x - x0) / rad, (y - yy) / rad
        d2 = dx ** 2 + dy ** 2
        inside = d2 < 1
        nz = np.sqrt(np.clip(1 - d2, 0, 1))
        n = np.stack([dx, dy, nz], -1)
        edge = np.clip((1 - np.sqrt(d2)) * rad / SS * 1.2, 0, 1)
        return inside, n, edge

    def paint(mask_a, rgb):
        nonlocal col, alpha
        m = mask_a[..., None]
        col = col * (1 - m) + rgb * m
        alpha = np.maximum(alpha, mask_a)

    # stand stem and shock-mount yoke behind the body
    stem = (np.abs(x - cx) < 20 * SS) & (y > 1060 * SS)
    sn = np.stack([(x - cx) / (20 * SS), np.zeros_like(x), np.sqrt(np.clip(1 - ((x - cx) / (20 * SS)) ** 2, 0, 1))], -1)
    paint(stem.astype(float), shade(sn, [0.55, 0.55, 0.58], True, 0.8))

    # body: black lacquer, gently tapered
    body_top, body_bot = 560 * SS, 1070 * SS
    t = np.clip((y - body_top) / (body_bot - body_top), 0, 1)
    brad = (128 - 22 * t) * SS
    bdx = (x - cx) / brad
    body = (np.abs(bdx) < 1) & (y > body_top) & (y < body_bot)
    bn = np.stack([bdx, np.full_like(bdx, -0.05), np.sqrt(np.clip(1 - bdx ** 2, 0, 1))], -1)
    bn /= np.linalg.norm(bn, axis=-1, keepdims=True)
    body_c = shade(bn, [0.035, 0.03, 0.045], False, 1.0, spec_pow=120, spec_amt=0.6)
    bedge = np.clip((1 - np.abs(bdx)) * brad / SS * 1.2, 0, 1)
    paint(body * bedge, body_c)

    # gold badge
    bd = np.hypot(x - cx, y - 680 * SS)
    badge = bd < 22 * SS
    bh = np.clip(1 - bd / (22 * SS), 0, 1)
    bgn = normals_from_height(blur(bh.astype(float) * 8 * SS, 2), 1)
    badge_c = shade(bgn, GOLD, True, 1.0)
    ring = np.abs(bd - 15 * SS) < 2.2 * SS
    badge_c = np.where(ring[..., None], badge_c * 0.6, badge_c)
    paint(np.clip((22 * SS - bd) / SS, 0, 1), badge_c)

    # chrome bands on the body
    for yb, hb in ((560, 34), (1040, 30)):
        band = (np.abs(y - (yb + hb / 2) * SS) < hb / 2 * SS)
        rad = (134 - 22 * np.clip((yb - 560) / 510, 0, 1)) * SS
        dx = (x - cx) / rad
        vy = (y - (yb + hb / 2) * SS) / (hb / 2 * SS)
        n = np.stack([dx, vy * 0.5, np.sqrt(np.clip(1 - dx ** 2, 0, 1))], -1)
        n /= np.linalg.norm(n, axis=-1, keepdims=True)
        m = band & (np.abs(dx) < 1)
        paint(m * np.clip((1 - np.abs(dx)) * rad / SS, 0, 1), shade(n, [0.8, 0.8, 0.83], True, 1.1, spec_pow=40))

    # head grille: capsule with a woven mesh
    inside, n, edge = capsule(cx, 250 * SS, 360 * SS, 210 * SS)
    # mesh in surface-ish coordinates
    su = np.arcsin(np.clip(n[..., 0], -1, 1)) * 210 * SS
    sv = y
    p = 6.5 * SS
    wu = np.abs(np.sin(np.pi * su / p))
    wv = np.abs(np.sin(np.pi * sv / p))
    wire = np.clip(1.6 - np.minimum(wu, wv) * 0 - (wu * wv) * 2.2, 0, 1)   # holes where both are high
    hole = 1 - wire
    mesh_n = n.copy()
    mesh_n[..., 0] += np.cos(np.pi * su / p) * 0.25 * wire
    mesh_n[..., 1] += np.cos(np.pi * sv / p) * 0.25 * wire
    mesh_n /= np.linalg.norm(mesh_n, axis=-1, keepdims=True)
    grille = shade(mesh_n, [0.86, 0.76, 0.58], True, 1.0, spec_pow=25, spec_amt=0.5)
    # visible capsule inside: dark with a hint of the gold diaphragm at the centre
    inner = np.array([0.03, 0.025, 0.03]) + np.array([0.35, 0.26, 0.1]) * np.exp(-(((x - cx) / (90 * SS)) ** 2 + ((y - 300 * SS) / (110 * SS)) ** 2))[..., None] * 0.35
    head = grille * wire[..., None] + inner * hole[..., None] * (0.6 + 0.4 * n[..., 2:3])
    # two grille layers give the moire depth
    paint(inside * edge, head)

    # equator band of the head
    band = np.abs(y - 305 * SS) < 16 * SS
    dx = (x - cx) / (216 * SS)
    vy = (y - 305 * SS) / (16 * SS)
    bn2 = np.stack([dx, vy * 0.6, np.sqrt(np.clip(1 - dx ** 2, 0, 1))], -1)
    bn2 /= np.linalg.norm(bn2, axis=-1, keepdims=True)
    m = band & (np.abs(dx) < 1)
    paint(m * np.clip((1 - np.abs(dx)) * 216, 0, 1), shade(bn2, [0.82, 0.82, 0.86], True, 1.1, spec_pow=40))

    # ambient occlusion where the head meets the body
    ao = np.exp(-((y - 572 * SS) / (18 * SS)) ** 2) * 0.5
    col *= (1 - ao)[..., None] * (y > 560 * SS)[..., None] + (y <= 560 * SS)[..., None]

    alpha = blur(alpha, 0.5)
    save(col, alpha, 'mic', (W, Hh))


# ---------------------------------------------------------------- film grain
def run_grain(S=256):
    n = rng.standard_normal((S, S))
    n = blur(n, 0.6)
    n = (n - n.min()) / (n.max() - n.min())
    g = np.stack([n, n, n], -1)
    save(g, np.ones((S, S)), 'grain')


if __name__ == '__main__':
    what = sys.argv[2:] or ['coins', 'vinyl', 'mic', 'grain']
    for w in what:
        globals()['run_' + w]()
        print('done', w)
