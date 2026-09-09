#!/usr/bin/env python3
"""Chroma-key sprite backgrounds.

Handles classic #FF00FF plus the darker pinks Imagine actually paints
(≈ RGB 180,20,130). Flood-fills from the border so interior pinks (petals,
auroras, gems) survive. Planets can be circular-masked after keying.
"""
from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


def _border_strip(h: int, w: int, depth: int = 6) -> np.ndarray:
    mask = np.zeros((h, w), dtype=bool)
    d = min(depth, h // 3, w // 3)
    mask[:d, :] = True
    mask[-d:, :] = True
    mask[:, :d] = True
    mask[:, -d:] = True
    return mask


def sample_bg_color(arr: np.ndarray) -> np.ndarray | None:
    """Median RGB of opaque pixels along the image border.

    If borders are already transparent, sample remaining magenta/pink
    pixels instead of walking inward into the subject.
    """
    h, w = arr.shape[:2]
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    strip = _border_strip(h, w, 8)
    opaque = strip & (a > 180)
    if int(opaque.sum()) >= 12:
        return np.median(arr[opaque][:, :3], axis=0)

    mag = is_magenta_like(r, g, b) & (a > 180)
    if int(mag.sum()) >= 12:
        return np.median(arr[mag][:, :3], axis=0)

    # Already mostly keyed — don't treat the subject as background.
    if float((a < 12).mean()) > 0.20:
        return None

    samples: list[np.ndarray] = []
    for x in range(0, w, 2):
        for y in range(h):
            if a[y, x] > 180:
                samples.append(arr[y, x, :3])
                break
        for y in range(h - 1, -1, -1):
            if a[y, x] > 180:
                samples.append(arr[y, x, :3])
                break
    for y in range(0, h, 2):
        for x in range(w):
            if a[y, x] > 180:
                samples.append(arr[y, x, :3])
                break
        for x in range(w - 1, -1, -1):
            if a[y, x] > 180:
                samples.append(arr[y, x, :3])
                break
    if len(samples) < 12:
        return None
    return np.median(np.stack(samples, axis=0), axis=0)


def is_magenta_like(r: np.ndarray, g: np.ndarray, b: np.ndarray) -> np.ndarray:
    mag_dist = np.sqrt((r - 255.0) ** 2 + (g - 0.0) ** 2 + (b - 255.0) ** 2)
    mag_score = np.minimum(r, b) - g
    dark_pink = (
        (r > 145)
        & (b > 95)
        & (g < 95)
        & ((r.astype(np.float32) + b.astype(np.float32)) > g.astype(np.float32) * 3.2)
        & (np.abs(r.astype(np.float32) - b.astype(np.float32)) < 95)
    )
    hot_magenta = (mag_dist < 88) | ((mag_score > 55) & (g < 95) & (r > 150) & (b > 140))
    return dark_pink | hot_magenta


def flood_from_seed(seed: np.ndarray) -> np.ndarray:
    """Keep only True pixels connected to the image border."""
    h, w = seed.shape
    visited = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()

    def push(y: int, x: int) -> None:
        if 0 <= y < h and 0 <= x < w and seed[y, x] and not visited[y, x]:
            visited[y, x] = True
            q.append((y, x))

    for x in range(w):
        push(0, x)
        push(h - 1, x)
    for y in range(h):
        push(y, 0)
        push(y, w - 1)

    while q:
        y, x = q.popleft()
        if y > 0:
            push(y - 1, x)
        if y + 1 < h:
            push(y + 1, x)
        if x > 0:
            push(y, x - 1)
        if x + 1 < w:
            push(y, x + 1)
    return visited


def dilate(mask: np.ndarray, radius: int = 1) -> np.ndarray:
    if radius <= 0:
        return mask
    out = mask.copy()
    h, w = mask.shape
    ys, xs = np.where(mask)
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            if dx * dx + dy * dy > radius * radius:
                continue
            yy = ys + dy
            xx = xs + dx
            ok = (yy >= 0) & (yy < h) & (xx >= 0) & (xx < w)
            out[yy[ok], xx[ok]] = True
    return out


def chroma_key(
    src: Path,
    dst: Path,
    thresh: float = 52.0,
    crop: bool = True,
    pad: int = 6,
    size: int | None = None,
    circular: bool = False,
    dilate_px: int = 2,
) -> None:
    im = Image.open(src).convert("RGBA")
    arr = np.array(im).astype(np.float32)
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]

    bg_color = sample_bg_color(arr)
    dist = np.full(r.shape, 999.0)
    if bg_color is not None:
        dist = np.sqrt(
            (r - bg_color[0]) ** 2 + (g - bg_color[1]) ** 2 + (b - bg_color[2]) ** 2
        )

    near_bg = dist < thresh
    magenta = is_magenta_like(r, g, b)
    near_white = (r > 242) & (g > 242) & (b > 242) & (a > 20)
    already_clear = a < 12

    seed = (near_bg | magenta | near_white | already_clear) & (a > 0) | already_clear
    bg = flood_from_seed(seed)
    if dilate_px:
        bg = dilate(bg, dilate_px)
        # Never punch a hole through a solid opaque core
        core = a > 220
        # Keep dilation only where the pixel is still bg-like
        bg = bg & (near_bg | magenta | near_white | already_clear | ~core)

    alpha = np.where(bg, 0.0, a)

    # Despill remaining magenta fringe on kept pixels
    magenta_score = np.minimum(r, b) - g
    spill = (~bg) & (magenta_score > 28) & (g < 140) & (alpha > 20)
    if np.any(spill):
        avg = (r + b) * 0.5
        r = np.where(spill, r * 0.45 + avg * 0.35 + g * 0.20, r)
        b = np.where(spill, b * 0.45 + avg * 0.35 + g * 0.20, b)
        g = np.where(spill, np.minimum(255.0, g + magenta_score * 0.18), g)

    arr[:, :, 0] = np.clip(r, 0, 255)
    arr[:, :, 1] = np.clip(g, 0, 255)
    arr[:, :, 2] = np.clip(b, 0, 255)
    arr[:, :, 3] = np.clip(alpha, 0, 255)

    if circular:
        a2 = arr[:, :, 3]
        ys, xs = np.where(a2 > 24)
        if len(xs) > 24:
            # Prefer the dense inner body, not leftover square corners
            cy = float(np.median(ys))
            cx = float(np.median(xs))
            d = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
            rad = float(np.quantile(d, 0.88))
            # Don't let leftover frame inflate the radius past ~half the short side
            rad = min(rad, 0.48 * min(arr.shape[0], arr.shape[1]))
            yy, xx = np.ogrid[: arr.shape[0], : arr.shape[1]]
            dd = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
            feather = max(3.0, rad * 0.03)
            circ = np.clip((rad + feather - dd) / feather, 0.0, 1.0)
            arr[:, :, 3] *= circ

    out = Image.fromarray(arr.astype(np.uint8), "RGBA")

    if crop:
        a3 = np.array(out)[:, :, 3]
        ys, xs = np.where(a3 > 12)
        if len(xs) > 0:
            x0, x1 = int(xs.min()), int(xs.max()) + 1
            y0, y1 = int(ys.min()), int(ys.max()) + 1
            x0 = max(0, x0 - pad)
            y0 = max(0, y0 - pad)
            x1 = min(out.width, x1 + pad)
            y1 = min(out.height, y1 + pad)
            w, h = x1 - x0, y1 - y0
            side = max(w, h, 8)
            cx = (x0 + x1) / 2
            cy = (y0 + y1) / 2
            x0 = int(max(0, cx - side / 2))
            y0 = int(max(0, cy - side / 2))
            x1 = int(min(out.width, x0 + side))
            y1 = int(min(out.height, y0 + side))
            out = out.crop((x0, y0, x1, y1))

    if size:
        out = out.resize((size, size), Image.Resampling.LANCZOS)

    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst, "PNG")
    print(f"wrote {dst} ({out.size[0]}x{out.size[1]})")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--thresh", type=float, default=52.0)
    p.add_argument("--size", type=int, default=0)
    p.add_argument("--no-crop", action="store_true")
    p.add_argument("--circular", action="store_true")
    p.add_argument("--dilate", type=int, default=2)
    args = p.parse_args()
    chroma_key(
        Path(args.input),
        Path(args.output),
        thresh=args.thresh,
        crop=not args.no_crop,
        size=args.size or None,
        circular=args.circular,
        dilate_px=args.dilate,
    )


if __name__ == "__main__":
    main()
