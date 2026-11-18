"""Generate Shophelper root/PWA + Android launcher icons from icon_pack master."""
from __future__ import annotations

import os
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PACK = os.path.join(ROOT, "icons", "icon_pack")
OUT = os.path.join(ROOT, "icons")
MASTER_PATH = os.path.join(PACK, "shopping_tools_icon_master_1254.png")
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")


def corner_colors(img: Image.Image):
    w, h = img.size
    tl = img.getpixel((8, 8))[:3]
    br = img.getpixel((w - 9, h - 9))[:3]
    mid = img.getpixel((w // 2, h // 2))[:3]
    return tl, br, mid


def sample_corner_gradient(size: int, tl, br) -> Image.Image:
    """Fast diagonal gradient via two oversized lines + resize."""
    # Build a 2x2 then resize with bicubic for a smooth diagonal-ish blend.
    base = Image.new("RGB", (2, 2))
    base.putpixel((0, 0), tl)
    base.putpixel((1, 0), tuple((tl[i] + br[i]) // 2 for i in range(3)))
    base.putpixel((0, 1), tuple((tl[i] + br[i]) // 2 for i in range(3)))
    base.putpixel((1, 1), br)
    return base.resize((size, size), Image.Resampling.BICUBIC).convert("RGBA")


def make_any(master: Image.Image, size: int) -> Image.Image:
    return master.resize((size, size), Image.Resampling.LANCZOS)


def make_maskable(master: Image.Image, size: int, tl, br, content_ratio: float = 0.8) -> Image.Image:
    bg = sample_corner_gradient(size, tl, br)
    content_size = max(1, int(round(size * content_ratio)))
    content = master.resize((content_size, content_size), Image.Resampling.LANCZOS)
    x = (size - content.width) // 2
    y = (size - content.height) // 2
    bg.paste(content, (x, y), content)
    return bg


def make_adaptive_fg(
    master: Image.Image,
    size: int,
    tl,
    br,
    content_ratio: float = 0.62,
) -> Image.Image:
    """Fully opaque adaptive foreground.

    Transparent padding gets zoomed away by some OEM launchers (incl. Samsung
    One UI), which re-clips the bag. Fill the 108dp canvas with the brand
    gradient, then paste a smaller master so the bag stays inside the circle.
    """
    canvas = sample_corner_gradient(size, tl, br)
    content_size = max(1, int(round(size * content_ratio)))
    content = master.resize((content_size, content_size), Image.Resampling.LANCZOS)
    x = (size - content.width) // 2
    y = (size - content.height) // 2
    canvas.paste(content, (x, y), content)
    return canvas


def main() -> None:
    master = Image.open(MASTER_PATH).convert("RGBA")
    tl, br, mid = corner_colors(master)
    print(f"TL=#{tl[0]:02X}{tl[1]:02X}{tl[2]:02X} BR=#{br[0]:02X}{br[1]:02X}{br[2]:02X} MID=#{mid[0]:02X}{mid[1]:02X}{mid[2]:02X}")

    # Maskable / circular launchers need extra outer padding so the bag
    # survives OEM circle crops (Samsung One UI clipped full-bleed art).
    root_assets = {
        "icon-192.png": make_any(master, 192),
        "icon-512.png": make_any(master, 512),
        "icon-maskable-192.png": make_maskable(master, 192, tl, br, 0.84),
        "icon-maskable-512.png": make_maskable(master, 512, tl, br, 0.84),
        "favicon.png": make_any(master, 48),
        "favicon-32.png": make_any(master, 32),
        "apple-touch-icon.png": make_any(master, 180),
    }
    for name, img in root_assets.items():
        path = os.path.join(OUT, name)
        img.save(path, "PNG", optimize=True)
        print("wrote", os.path.relpath(path, ROOT), img.size)

    # Keep app.svg as a tiny fallback mark, but point HTML at PNGs.
    # Android legacy launchers
    legacy = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }
    # Samsung One UI was re-zooming adaptive layers and clipping the bag.
    # Ship padded legacy PNGs only (no mipmap-anydpi-v26 adaptive XML).
    # Samsung's rounded mask clips the corners. 0.58 left a tiny bag;
    # 0.84 fills the mask with a thin ring of gradient still visible.
    legacy_ratio = 0.84
    for folder, size in legacy.items():
        img = make_maskable(master, size, tl, br, legacy_ratio)
        d = os.path.join(RES, folder)
        for name in ("ic_launcher.png", "ic_launcher_round.png"):
            path = os.path.join(d, name)
            img.save(path, "PNG", optimize=True)
            print("wrote", os.path.relpath(path, ROOT), f"ratio={legacy_ratio}")

    # Keep foreground assets for possible future adaptive use, but do not
    # reference them from anydpi-v26 (those XML files are intentionally absent).
    fg_sizes = {
        "mipmap-mdpi": 108,
        "mipmap-hdpi": 162,
        "mipmap-xhdpi": 216,
        "mipmap-xxhdpi": 324,
        "mipmap-xxxhdpi": 432,
    }
    for folder, size in fg_sizes.items():
        img = make_adaptive_fg(master, size, tl, br, 0.84)
        path = os.path.join(RES, folder, "ic_launcher_foreground.png")
        img.save(path, "PNG", optimize=True)
        print("wrote", os.path.relpath(path, ROOT), img.size)

    bg = tuple((tl[i] + br[i]) // 2 for i in range(3))
    bg_hex = f"#{bg[0]:02X}{bg[1]:02X}{bg[2]:02X}"
    values = os.path.join(RES, "values", "ic_launcher_background.xml")
    with open(values, "w", encoding="utf-8", newline="\n") as f:
        f.write(
            '<?xml version="1.0" encoding="utf-8"?>\n'
            "<resources>\n"
            f'    <color name="ic_launcher_background">{bg_hex}</color>\n'
            "</resources>\n"
        )
    print("wrote", os.path.relpath(values, ROOT), bg_hex)

    # Ensure adaptive overrides stay deleted
    anydpi = os.path.join(RES, "mipmap-anydpi-v26")
    for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        path = os.path.join(anydpi, name)
        if os.path.exists(path):
            os.remove(path)
            print("removed", os.path.relpath(path, ROOT))



if __name__ == "__main__":
    main()
