"""Resize and convert Gemini downloads into game-ready WebP files.

Usage:  python3 scripts/prepare_images.py <folder-with-downloads> [output-folder]

Each input file must already be named like its ferret (e.g. 01-bandit.png or just 01.jpg).
Images are centre-cropped to a square, scaled to 800 px, and saved as <name>.webp.
Output defaults to art/images/ in this project. Prints which of the 30 ferrets are still missing.
"""
import json
import os
import sys

from PIL import Image

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
src = sys.argv[1] if len(sys.argv) > 1 else None
dst = sys.argv[2] if len(sys.argv) > 2 else os.path.join(root, 'art', 'images')
if not src or not os.path.isdir(src):
    sys.exit(__doc__)
os.makedirs(dst, exist_ok=True)

for name in sorted(os.listdir(src)):
    stem, ext = os.path.splitext(name)
    if ext.lower() not in ('.png', '.jpg', '.jpeg', '.webp'):
        continue
    im = Image.open(os.path.join(src, name)).convert('RGB')
    side = min(im.size)
    left, top = (im.width - side) // 2, (im.height - side) // 2
    im = im.crop((left, top, left + side, top + side)).resize((800, 800), Image.LANCZOS)
    im.save(os.path.join(dst, stem.lower() + '.webp'), 'WEBP', quality=85)
    print('converted', name)

roster = json.load(open(os.path.join(root, 'art', 'ferrets.json')))['ferrets']
have = {os.path.splitext(f)[0].lower() for f in os.listdir(dst)}
missing = [f['file'] for f in roster if os.path.splitext(f['file'])[0] not in have and f['id'] not in have]
print(f'\n{len(roster) - len(missing)}/{len(roster)} ferrets have images.')
if missing:
    print('Still missing:', ', '.join(missing))
