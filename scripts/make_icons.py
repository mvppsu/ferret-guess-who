"""Draws the app icon (a cartoon ferret face) with Pillow. Run: python3 scripts/make_icons.py"""
from PIL import Image, ImageDraw
import os

S = 2048  # draw big, downsample for smooth edges
out = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')


def draw():
    im = Image.new('RGB', (S, S), '#ffb703')
    d = ImageDraw.Draw(im)
    # soft radial-ish background band
    d.ellipse((-S * .2, S * .55, S * 1.2, S * 1.6), fill='#ffc933')
    cx, cy = S * .5, S * .56
    brown, dark, cream, pink = '#9a7352', '#3d2b21', '#f1dfc2', '#e8a39a'
    # ears
    for sx in (-1, 1):
        ex = cx + sx * S * .27
        d.ellipse((ex - S * .09, S * .17, ex + S * .09, S * .35), fill=brown, outline=dark, width=int(S * .014))
        d.ellipse((ex - S * .05, S * .21, ex + S * .05, S * .32), fill=pink)
    # head
    d.ellipse((cx - S * .38, cy - S * .3, cx + S * .38, cy + S * .3), fill=brown, outline=dark, width=int(S * .016))
    # bandit mask
    for sx in (-1, 1):
        d.ellipse((cx + sx * S * .15 - S * .13, cy - S * .1, cx + sx * S * .15 + S * .13, cy + S * .09), fill=dark)
    d.rectangle((cx - S * .15, cy - S * .07, cx + S * .15, cy + S * .04), fill=dark)
    # muzzle
    d.ellipse((cx - S * .19, cy + S * .03, cx + S * .19, cy + S * .27), fill=cream)
    # eyes
    for sx in (-1, 1):
        ex, ey, r = cx + sx * S * .15, cy - S * .01, S * .06
        d.ellipse((ex - r, ey - r, ex + r, ey + r), fill='#120c09')
        d.ellipse((ex - r * .1, ey - r * .65, ex + r * .5, ey - r * .05), fill='white')
    # nose + mouth
    d.ellipse((cx - S * .045, cy + S * .05, cx + S * .045, cy + S * .105), fill=pink, outline=dark, width=int(S * .008))
    w = int(S * .01)
    d.line((cx, cy + S * .105, cx, cy + S * .15), fill=dark, width=w)
    d.arc((cx - S * .09, cy + S * .09, cx, cy + S * .2), 20, 160, fill=dark, width=w)
    d.arc((cx, cy + S * .09, cx + S * .09, cy + S * .2), 20, 160, fill=dark, width=w)
    # question mark badge (guess who)
    bx, by, br = S * .8, S * .82, S * .13
    d.ellipse((bx - br, by - br, bx + br, by + br), fill='#d64550', outline='white', width=int(S * .018))
    d.text((bx, by), '?', fill='white', anchor='mm', font=font(int(S * .2)))
    return im


def font(size):
    from PIL import ImageFont
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'):
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default(size)


base = draw()
for name, px in (('apple-touch-icon.png', 180), ('icon-192.png', 192), ('icon-512.png', 512)):
    base.resize((px, px), Image.LANCZOS).save(os.path.join(out, name), optimize=True)
print('icons written to', os.path.abspath(out))
