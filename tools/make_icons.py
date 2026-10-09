#!/usr/bin/env python3
"""Генератор PNG-иконок для PWA без внешних зависимостей.

Рисует градиентный квадрат с белой звездой и сохраняет набор иконок
нужного размера. Запуск:  python3 tools/make_icons.py
"""
import math
import os
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")

# Цвета (R, G, B) градиента по диагонали.
TOP = (123, 92, 255)     # фиолетовый
BOTTOM = (255, 95, 162)  # розовый


def lerp(a, b, t):
    return a + (b - a) * t


def star_points(cx, cy, r_out, r_in, points=5, rotation=-math.pi / 2):
    pts = []
    for i in range(points * 2):
        r = r_out if i % 2 == 0 else r_in
        a = rotation + i * math.pi / points
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    return pts


def polygon_mask(w, h, pts):
    """Растеризация полигона методом scanline -> массив 0/1."""
    mask = [[0] * w for _ in range(h)]
    n = len(pts)
    for y in range(h):
        yc = y + 0.5
        xs = []
        for i in range(n):
            x1, y1 = pts[i]
            x2, y2 = pts[(i + 1) % n]
            if (y1 <= yc < y2) or (y2 <= yc < y1):
                xs.append((x2 - x1) * (yc - y1) / (y2 - y1) + x1)
        xs.sort()
        for k in range(0, len(xs) - 1, 2):
            x_start = int(math.ceil(xs[k] - 0.5))
            x_end = int(math.floor(xs[k + 1] - 0.5))
            for x in range(x_start, x_end + 1):
                if 0 <= x < w:
                    mask[y][x] = 1
    return mask


def blur(mask, passes=1):
    h = len(mask)
    w = len(mask[0])
    cur = [[float(v) for v in row] for row in mask]
    for _ in range(passes):
        nxt = [[0.0] * w for _ in range(h)]
        for y in range(h):
            for x in range(w):
                s = 0.0
                c = 0
                for dy in (-1, 0, 1):
                    yy = y + dy
                    if 0 <= yy < h:
                        for dx in (-1, 0, 1):
                            xx = x + dx
                            if 0 <= xx < w:
                                s += cur[yy][xx]
                                c += 1
                nxt[y][x] = s / c
        cur = nxt
    return cur


def render(size):
    w = h = size
    # Градиентный фон со мягким радиальным светом в левом верхнем углу.
    bg = []
    for y in range(h):
        row = []
        for x in range(w):
            t = (x + y) / (2 * (w - 1))
            r = lerp(TOP[0], BOTTOM[0], t)
            g = lerp(TOP[1], BOTTOM[1], t)
            b = lerp(TOP[2], BOTTOM[2], t)
            # мягкий блик сверху.
            d = math.hypot(x - w * 0.28, y - h * 0.24) / (w * 0.9)
            light = max(0.0, 1.0 - d) ** 2 * 46
            row.append((min(255, r + light), min(255, g + light), min(255, b + light)))
        bg.append(row)

    # Звезда в центре, ~62% диаметра (безопасная зона maskable).
    cx = cy = size / 2.0
    r_out = size * 0.31
    r_in = r_out * 0.42
    pts = star_points(cx, cy + size * 0.012, r_out, r_in)
    m = blur(polygon_mask(w, h, pts), passes=2)

    rows = []
    for y in range(h):
        row = bytearray()
        for x in range(w):
            a = m[y][x]
            r0, g0, b0 = bg[y][x]
            r = int(r0 * (1 - a) + 255 * a)
            g = int(g0 * (1 - a) + 255 * a)
            b = int(b0 * (1 - a) + 255 * a)
            row += bytes((r, g, b, 255))
        rows.append(row)
    return rows


def write_png(path, size, rows):
    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data +
                struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))

    raw = bytearray()
    for row in rows:
        raw.append(0)  # filter: none
        raw += row
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    targets = {
        "icon-192.png": 192,
        "icon-512.png": 512,
        "icon-maskable-512.png": 512,
        "apple-touch-icon.png": 180,
        "favicon-32.png": 32,
    }
    for name, size in targets.items():
        rows = render(size)
        write_png(os.path.join(OUT_DIR, name), size, rows)
        print("ok ->", name, size)


if __name__ == "__main__":
    main()
