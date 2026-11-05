#!/usr/bin/env python3
"""
Generates the decorative textures in public/images/ (frame, light leak,
map tile, phone feed) in Eniola's palette, plus quote cards that stand in
for the seven photos from her Lovable site until `npm run fetch-images`
downloads them (it runs automatically before `npm run dev` / `build`).

Usage:  python3 scripts/make_placeholders.py      (needs Pillow)
"""
import os
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), "..", "public", "images")
ENI = os.path.join(ROOT, "eniola")
os.makedirs(ENI, exist_ok=True)

CREAM = (253, 247, 239)
BLUSH = (248, 230, 215)
INK = (40, 28, 24)
CLAY = (175, 132, 113)
BORDER = (232, 219, 209)
GOLD = (212, 168, 75)
random.seed(7)


def font(size):
    for p in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
    ]:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def save(img, path, quality=84):
    if path.endswith(".webp"):
        img.save(path, "WEBP", quality=quality, method=6)
    elif path.endswith(".jpg"):
        img.convert("RGB").save(path, "JPEG", quality=quality)
    else:
        img.save(path, "PNG", optimize=True)
    print("wrote", os.path.relpath(path, ROOT))


def frame(w=512, h=640):
    """thin gallery frame, transparent centre (stretches fine to landscape)"""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w - 1, h - 1], outline=GOLD + (220,), width=6)
    d.rectangle([14, 14, w - 15, h - 15], outline=CREAM + (150,), width=2)
    save(img, os.path.join(ROOT, "frame.png"))


def leak(w=512, h=640):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([-w * 0.3, -h * 0.2, w * 0.6, h * 0.55], fill=(255, 214, 170, 120))
    d.ellipse([w * 0.6, h * 0.6, w * 1.3, h * 1.2], fill=(248, 200, 180, 90))
    save(img.filter(ImageFilter.GaussianBlur(w // 8)), os.path.join(ROOT, "leak.png"))


def tile(w=512, h=512):
    img = Image.new("RGB", (w, h), BLUSH)
    d = ImageDraw.Draw(img, "RGBA")
    for i in range(0, w, 32):
        d.line([(i, 0), (i, h)], fill=CLAY + (60,), width=1)
        d.line([(0, i), (w, i)], fill=CLAY + (60,), width=1)
    for _ in range(18):
        x, y = random.randint(20, w - 20), random.randint(20, h - 20)
        d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=GOLD + (230,))
    d.rectangle([0, 0, w - 1, h - 1], outline=CLAY + (200,), width=6)
    save(img, os.path.join(ROOT, "work-tile.webp"))


def phone_feed(w=256, h=1024):
    img = Image.new("RGB", (w, h), CREAM)
    d = ImageDraw.Draw(img)
    y = 0
    palette = [BLUSH, CLAY, BORDER, GOLD, (210, 180, 160), (190, 150, 140)]
    while y < h:
        ph = random.randint(110, 220)
        d.rounded_rectangle([10, y + 8, w - 10, y + ph], radius=14, fill=random.choice(palette))
        d.rounded_rectangle([10, y + ph + 10, w * 0.7, y + ph + 20], radius=5, fill=(200, 180, 168))
        d.rounded_rectangle([10, y + ph + 26, w * 0.45, y + ph + 35], radius=5, fill=(220, 204, 192))
        y += ph + 44
    save(img, os.path.join(ROOT, "phone-feed.webp"))


# ── quote cards ─────────────────────────────────────────────────────────
# Shown wherever one of her site photos hasn't been downloaded yet.
# Landscape cards stand in for the full photos; portrait cards stand in for
# the cropped frames in People and the Fun carousel.
FONTS = os.path.join(os.path.dirname(__file__), "fonts")

PHOTOS = {
    # name: (section label, quote)
    "relationships": ("The people", "Small circle. Deep roots."),
    "faith": ("Faith", "Faith is a road I choose to walk, not a room I was born in."),
    "career": ("The work", "Soon-global starts with what I do today."),
    "help": ("How I can help", "A sharper story opens the right doors."),
    "love-doing": ("For fun", "A quiet showing, a good story, nowhere else to be."),
    "style": ("Personal style", "Less, but chosen with care."),
    "gold": ("One thing you should know", "If it isn't real, it isn't for me."),
}
PORTRAITS = {
    "people-1": ("The people", "Loyal to a few, and proud of it."),
    "people-2": ("The people", "If you're in, you're really in."),
    "people-3": ("The people", "Being present is a choice I keep making."),
    "people-4": ("The people", "Shared values make the best tables."),
    "people-5": ("The people", "My circle didn't happen by accident."),
    "fun-1": ("K-dramas", "One more episode. Always."),
    "fun-2": ("Cinema", "Solo cinema dates are underrated."),
    "fun-3": ("My people", "Real conversations are my favorite kind."),
    "fun-4": ("Teaching", "Teach what you wish someone had told you."),
    "fun-5": ("Naps", "A good nap fixes almost everything."),
    "fun-6": ("Novels", "Every good novel is a way back to myself."),
}


def _font(name, size, wght=None, opsz=None):
    f = ImageFont.truetype(os.path.join(FONTS, name), size)
    try:
        axes = {a["name"] if isinstance(a.get("name"), str) else a["name"].decode(): a for a in f.get_variation_axes()}
        vals = []
        for a in f.get_variation_axes():
            n = a["name"] if isinstance(a["name"], str) else a["name"].decode()
            if n.lower().startswith("weight") and wght is not None:
                vals.append(wght)
            elif n.lower().startswith("optical") and opsz is not None:
                vals.append(opsz)
            else:
                vals.append(a["default"])
        f.set_variation_by_axes(vals)
    except Exception:
        pass
    return f


def _wrap(draw, text, font, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=font) <= max_w:
            cur = t
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    return lines


def quote_card(path, label, quote, w, h):
    s = 2  # supersample for crisp type
    W, H = w * s, h * s
    img = Image.new("RGB", (W, H), CREAM)
    # soft blush glow
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse([W * 0.15, H * 0.05, W * 0.95, H * 0.95], fill=255)
    glow = glow.filter(ImageFilter.GaussianBlur(W // 6))
    img = Image.composite(Image.new("RGB", (W, H), BLUSH), img, glow)
    d = ImageDraw.Draw(img)
    m = int(min(W, H) * 0.06)
    d.rectangle([m, m, W - m, H - m], outline=CLAY, width=2 * s)

    quote = quote.replace("'", "\u2019")
    qsize = int(min(W, H) * (0.075 if w > h else 0.095))
    qf = _font("Fraunces-Italic.ttf", qsize, wght=360, opsz=96)
    lf = _font("Inter.ttf", int(min(W, H) * 0.028), wght=500)
    mf = _font("Fraunces.ttf", int(qsize * 3.0), wght=300, opsz=144)

    lines = _wrap(d, quote, qf, W * (0.5 if w > h else 0.7))
    lh = int(qsize * 1.22)
    block = len(lines) * lh
    top = (H - block) / 2 + qsize * 0.25

    # opening mark
    mark = "\u201c"
    mw = d.textlength(mark, font=mf)
    d.text(((W - mw) / 2, top - qsize * 2.75), mark, font=mf, fill=CLAY)
    for i, line in enumerate(lines):
        lw = d.textlength(line, font=qf)
        d.text(((W - lw) / 2, top + i * lh), line, font=qf, fill=INK)

    # section label, letter-spaced, under a short rule
    label = label.upper()
    spacing = int(lf.size * 0.24)
    total = sum(d.textlength(c, font=lf) for c in label) + spacing * (len(label) - 1)
    y = top + block + qsize * 0.9
    d.line([(W / 2 - 18 * s, y - lf.size * 1.2), (W / 2 + 18 * s, y - lf.size * 1.2)], fill=CLAY, width=s)
    x = (W - total) / 2
    for c in label:
        d.text((x, y), c, font=lf, fill=CLAY)
        x += d.textlength(c, font=lf) + spacing

    img = img.resize((w, h), Image.LANCZOS)
    save(img, path, quality=88)


def photo_standins():
    """quote cards for every site photo that isn't downloaded yet"""
    marker = os.path.join(ENI, "placeholders.txt")
    pending = _pending()
    for name, (label, quote) in PHOTOS.items():
        path = os.path.join(ENI, f"{name}.jpg")
        if os.path.exists(path) and name not in pending:
            continue  # the real photo is already here
        quote_card(path, label, quote, 1050, 750)
        if name not in pending:
            pending.append(name)
    qdir = os.path.join(ENI, "quotes")
    os.makedirs(qdir, exist_ok=True)
    for name, (label, quote) in PORTRAITS.items():
        quote_card(os.path.join(qdir, f"{name}.jpg"), label, quote, 640, 800)
    with open(marker, "w") as f:
        f.write("\n".join(sorted(set(pending))) + "\n")


def _pending():
    marker = os.path.join(ENI, "placeholders.txt")
    if not os.path.exists(marker):
        return []
    return [l.strip() for l in open(marker) if l.strip()]


def og_image():
    src = os.path.join(ENI, "eniola-plate.webp")
    cut = os.path.join(ENI, "eniola-cutout.png")
    og = Image.new("RGB", (1200, 630), CREAM)
    if os.path.exists(src) and os.path.exists(cut):
        p = Image.open(cut).convert("RGBA").resize((480, 600))
        bg = Image.open(src).convert("RGB").resize((480, 600))
        bg.paste(p, (0, 0), p)
        og.paste(bg, (680, 15))
    d = ImageDraw.Draw(og)
    d.text((70, 200), "A WARM HELLO", font=_font("Inter.ttf", 22, wght=500), fill=CLAY)
    big = _font("Fraunces.ttf", 104, wght=400, opsz=144)
    d.text((66, 236), "I’m ", font=big, fill=INK)
    d.text((66 + d.textlength("I’m ", font=big), 236), "Eniola.", font=big, fill=CLAY)
    d.text((70, 380), "The real one, minus the small talk.", font=_font("Fraunces-Italic.ttf", 32, wght=360), fill=(100, 80, 72))
    save(og, os.path.join(ROOT, "og-image.jpg"))


if __name__ == "__main__":
    frame()
    leak()
    tile()
    phone_feed()
    photo_standins()
    og_image()
