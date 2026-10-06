"""Create all app icon sizes from the supplied transparent master artwork."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "monture-minute-source.png"
ANDROID = ROOT.parent / "android" / "app" / "src" / "main" / "res"
def contain(image: Image.Image, size: int, padding: float = 0.05) -> Image.Image:
    """Fit artwork in a transparent square, retaining its ratio and alpha."""
    image = image.convert("RGBA")
    bounds = image.getchannel("A").getbbox()
    if bounds:
        image = image.crop(bounds)
    inner = max(1, int(size * (1 - 2 * padding)))
    ratio = min(inner / image.width, inner / image.height)
    scaled = image.resize((round(image.width * ratio), round(image.height * ratio)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(scaled, ((size - scaled.width) // 2, (size - scaled.height) // 2))
    return canvas


def padded_logo(image: Image.Image, long_edge: int = 1200) -> Image.Image:
    image = image.convert("RGBA")
    bounds = image.getchannel("A").getbbox()
    if bounds:
        image = image.crop(bounds)
    scale = long_edge / max(image.size)
    image = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    pad = round(long_edge * 0.04)
    canvas = Image.new("RGBA", (image.width + pad * 2, image.height + pad * 2), (0, 0, 0, 0))
    canvas.alpha_composite(image, (pad, pad))
    return canvas


def main() -> None:
    master = Image.open(SOURCE).convert("RGBA")

    # Transparent logo: high-resolution, tightly framed version of the supplied image.
    padded_logo(master).save(ROOT / "monture-minute-logo.png", optimize=True)

    # Square artwork used by Windows, the tray, and the compact app header.
    icon = contain(master, 512, padding=0.035)
    icon.save(ROOT / "monture-minute.png", optimize=True)
    icon.resize((256, 256), Image.Resampling.LANCZOS).save(ROOT / "monture-minute-256.png", optimize=True)
    icon.resize((64, 64), Image.Resampling.LANCZOS).save(ROOT / "monture-minute-64.png", optimize=True)

    # Multi-resolution Windows icon.
    icon.resize((1024, 1024), Image.Resampling.LANCZOS).save(
        ROOT / "monture-minute.ico",
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    # Android launcher icons. The adaptive foreground stays within the mask-safe area.
    density_sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    for density, pixels in density_sizes.items():
        folder = ANDROID / f"mipmap-{density}"
        folder.mkdir(parents=True, exist_ok=True)
        contain(master, pixels, padding=0.035).save(folder / "ic_launcher.png", optimize=True)
        contain(master, pixels, padding=0.035).save(folder / "ic_launcher_round.png", optimize=True)
        contain(master, pixels, padding=0.19).save(folder / "ic_launcher_foreground.png", optimize=True)


if __name__ == "__main__":
    main()
