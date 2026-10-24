#!/usr/bin/env python3
"""Batch-generate the 30 ferret photos with Google's Gemini image models ("Nano Banana").

Setup (once):
  1. Get an API key at https://aistudio.google.com/apikey. Image output is not on the free tier,
     so the Google Cloud project behind the key needs billing enabled.
  2. Put it in your shell:   export GEMINI_API_KEY=...      (or a line GEMINI_API_KEY=... in ./.env)

Usage:
  python3 scripts/generate_images.py --dry-run          # show what would run and the estimated cost
  python3 scripts/generate_images.py --only 01          # make just the first ferret and check the look
  python3 scripts/generate_images.py                    # make all missing ferrets
  python3 scripts/generate_images.py --only 03,07,12-15 --force    # redo specific ones (ids, names or ranges)

How it works:
  * Prompts come from art/ferrets.json (the same ones as art/PROMPTS.md).
  * Ferret 01 is generated first and becomes the "style anchor": every later request attaches it as a
    reference so lighting, backdrop and framing stay consistent. You are asked to approve it before the
    other 29 run (skip with --yes). Use --anchor FILE to use your own image, or --no-anchor to turn it off.
  * Originals are saved to art/originals/, and 800 px square WebP copies to art/images/ (what the game uses).
  * Finished ferrets are skipped, so you can stop and re-run any time; failed ones are listed at the end.
"""
import argparse
import base64
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ROSTER = ROOT / 'art' / 'ferrets.json'
ORIGINALS = ROOT / 'art' / 'originals'
IMAGES = ROOT / 'art' / 'images'

DEFAULT_MODEL = 'gemini-nano-banana-2.1'
API_REVISION = '2026-05-20'
BASE_URL = 'https://generativelanguage.googleapis.com'
# List prices per 1K image from https://ai.google.dev/gemini-api/docs/pricing (Oct 2026). Estimate only.
PRICES = {
    'gemini-nano-banana-2.1': 0.0336,
    'gemini-3.1-flash-lite-image': 0.0336,
    'gemini-3.1-flash-image': 0.067,
    'gemini-3-pro-image': 0.134,
    'gemini-2.5-flash-image': 0.039,
}

REFERENCE_PREFIX = (
    'The attached image is a STYLE REFERENCE ONLY. Match its photographic style, backdrop color, lighting, '
    'camera distance and framing exactly. Do NOT copy its animal: this is a different ferret with a different '
    'coat color, pose and accessory, as described below. Create this new photo: '
)


class Fatal(Exception):
    """Stops the whole run (bad key, unknown model...)."""


class Failed(Exception):
    """This one ferret failed; the run carries on."""


# ---------- setup helpers ----------

def load_key():
    for name in ('GEMINI_API_KEY', 'GOOGLE_API_KEY'):
        if os.environ.get(name):
            return os.environ[name].strip()
    env = ROOT / '.env'
    if env.exists():
        for line in env.read_text().splitlines():
            m = re.match(r'\s*(?:export\s+)?(GEMINI_API_KEY|GOOGLE_API_KEY)\s*=\s*(.*?)\s*$', line)
            if m:
                return m.group(2).strip('\'"')
    return None


def stem(f):
    return os.path.splitext(f['file'])[0]


def parse_only(spec, roster):
    ids = {f['id'] for f in roster}
    names = {f['name'].lower(): f['id'] for f in roster}
    chosen = set()
    for tok in (t.strip().lower() for t in spec.split(',') if t.strip()):
        m = re.fullmatch(r'(\d+)-(\d+)', tok)
        if m:
            chosen.update(f'{n:02d}' for n in range(int(m.group(1)), int(m.group(2)) + 1))
        elif tok.isdigit():
            chosen.add(f'{int(tok):02d}')
        elif tok in names:
            chosen.add(names[tok])
        else:
            sys.exit(f'--only: "{tok}" is not a ferret id, name or range')
    unknown = chosen - ids
    if unknown:
        sys.exit(f'--only: no such ferret id(s): {", ".join(sorted(unknown))}')
    return [f for f in roster if f['id'] in chosen]


def find_existing_anchor(first):
    for d, exts in ((ORIGINALS, ('jpg', 'png', 'webp')), (IMAGES, ('webp', 'png', 'jpg'))):
        for ext in exts:
            p = d / f'{stem(first)}.{ext}'
            if p.exists():
                return p
    return None


def is_done(f):
    return (IMAGES / f'{stem(f)}.webp').exists()


# ---------- API ----------

def call_api(base_url, key, revision, body, retries=5):
    url = f'{base_url}/v1beta/interactions'
    headers = {'x-goog-api-key': key, 'Content-Type': 'application/json'}
    if revision:
        headers['Api-Revision'] = revision
    data = json.dumps(body).encode()
    for attempt in range(1, retries + 1):
        req = urllib.request.Request(url, data=data, headers=headers, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=240) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            detail = e.read().decode('utf-8', 'replace')[:700]
            if e.code in (401, 403):
                raise Fatal(f'HTTP {e.code}: the API key was rejected or lacks access (billing enabled? image models need it).\n{detail}')
            if e.code == 404:
                raise Fatal(f'HTTP 404: model or endpoint not found. Try --model with a current id from https://ai.google.dev/gemini-api/docs/models\n{detail}')
            if e.code in (429, 500, 502, 503, 504) and attempt < retries:
                wait = min(60, 4 * 2 ** (attempt - 1))
                print(f'    HTTP {e.code}, retrying in {wait}s (attempt {attempt}/{retries})')
                time.sleep(wait)
                continue
            raise Failed(f'HTTP {e.code}: {detail}')
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if attempt < retries:
                wait = min(60, 4 * 2 ** (attempt - 1))
                print(f'    network error ({e}), retrying in {wait}s (attempt {attempt}/{retries})')
                time.sleep(wait)
                continue
            raise Failed(f'network error: {e}')
    raise Failed('gave up after retries')


def find_images(node):
    """Yield (base64 data, mime) for every image block in a response fragment."""
    if isinstance(node, dict):
        if node.get('type') == 'image' and isinstance(node.get('data'), str):
            yield node['data'], node.get('mime_type')
        for k in ('inlineData', 'inline_data'):  # older generateContent-style shape, just in case
            blob = node.get(k)
            if isinstance(blob, dict) and isinstance(blob.get('data'), str):
                yield blob['data'], blob.get('mimeType') or blob.get('mime_type')
        for v in node.values():
            yield from find_images(v)
    elif isinstance(node, list):
        for v in node:
            yield from find_images(v)


def find_text(node):
    if isinstance(node, dict):
        if node.get('type') == 'text' and isinstance(node.get('text'), str):
            yield node['text']
        for v in node.values():
            yield from find_text(v)
    elif isinstance(node, list):
        for v in node:
            yield from find_text(v)


def extract_image(resp):
    # Only look at what the model produced, never at an echo of our own reference image.
    outputs = [s for s in resp.get('steps', []) if isinstance(s, dict) and s.get('type') == 'model_output']
    scope = outputs if outputs else {k: v for k, v in resp.items() if k not in ('input', 'steps')}
    imgs = list(find_images(scope))
    if imgs:
        return base64.b64decode(imgs[-1][0])
    status = resp.get('status')
    errors = resp.get('errors')
    said = ' '.join(find_text(scope)).strip()
    why = f'status={status}' + (f', errors={errors}' if errors else '') + (f', model said: "{said[:300]}"' if said else '')
    raise Failed(f'no image came back ({why}). It may have been blocked; re-run to try again.')


def generate(args, key, f, anchor):
    prompt = f['prompt']
    if anchor:
        data, mime = anchor
        body_input = [
            {'type': 'text', 'text': REFERENCE_PREFIX + prompt},
            {'type': 'image', 'data': base64.b64encode(data).decode(), 'mime_type': mime},
        ]
    else:
        body_input = prompt
    body = {
        'model': args.model,
        'input': body_input,
        'response_format': {'type': 'image', 'aspect_ratio': '1:1', 'image_size': args.size},
    }
    resp = call_api(args.base_url, key, args.api_revision, body)
    return extract_image(resp)


# ---------- saving ----------

MIME_BY_FORMAT = {'JPEG': 'image/jpeg', 'PNG': 'image/png', 'WEBP': 'image/webp'}
EXT_BY_FORMAT = {'JPEG': 'jpg', 'PNG': 'png', 'WEBP': 'webp'}


def save(f, raw):
    im = Image.open(io.BytesIO(raw))
    fmt = im.format if im.format in EXT_BY_FORMAT else 'PNG'
    ORIGINALS.mkdir(parents=True, exist_ok=True)
    IMAGES.mkdir(parents=True, exist_ok=True)
    orig = ORIGINALS / f'{stem(f)}.{EXT_BY_FORMAT.get(im.format, "png")}'
    orig.write_bytes(raw)
    im = im.convert('RGB')
    side = min(im.size)
    left, top = (im.width - side) // 2, (im.height - side) // 2
    im = im.crop((left, top, left + side, top + side)).resize((800, 800), Image.LANCZOS)
    out = IMAGES / f'{stem(f)}.webp'
    im.save(out, 'WEBP', quality=85)
    return orig, out, (MIME_BY_FORMAT.get(fmt, 'image/png'))


# ---------- main ----------

def main():
    ap = argparse.ArgumentParser(description='Batch-generate the ferret photos with Gemini.', formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__)
    ap.add_argument('--only', help='ferrets to make: ids, names or ranges, e.g. 01,bandit,05-09')
    ap.add_argument('--force', action='store_true', help='regenerate even if the image already exists')
    ap.add_argument('--dry-run', action='store_true', help='list what would be generated and the estimated cost; call nothing')
    ap.add_argument('--model', default=DEFAULT_MODEL, help=f'image model id (default {DEFAULT_MODEL})')
    ap.add_argument('--size', default='1K', choices=['512', '1K', '2K', '4K'], help='generation size (default 1K; the game only needs 800 px)')
    ap.add_argument('--anchor', help='use this image as the style reference for every ferret instead of generating 01 first')
    ap.add_argument('--no-anchor', action='store_true', help='do not send a style reference image')
    ap.add_argument('--delay', type=float, default=1.0, help='seconds to wait between requests (default 1)')
    ap.add_argument('--yes', action='store_true', help='do not pause for approval after the anchor image')
    ap.add_argument('--api-revision', default=API_REVISION, help='Api-Revision header value ("" to omit)')
    ap.add_argument('--base-url', default=BASE_URL, help=argparse.SUPPRESS)
    args = ap.parse_args()

    roster = json.loads(ROSTER.read_text())['ferrets']
    selected = parse_only(args.only, roster) if args.only else roster
    todo = [f for f in selected if args.force or not is_done(f)]
    skipped = len(selected) - len(todo)

    price = PRICES.get(args.model)
    cost = f'about ${price * len(todo):.2f} at list price (${price}/image)' if price else 'unknown (model not in price table)'
    print(f'{len(selected)} selected, {skipped} already done, {len(todo)} to generate with {args.model}: {cost}')
    if args.dry_run:
        for f in todo:
            print(f'\n[{f["id"]}] {f["name"]} -> art/images/{stem(f)}.webp\n    {f["prompt"]}')
        return 0
    if not todo:
        print('Nothing to do. (Use --force to regenerate.)')
        return 0

    key = load_key()
    if not key:
        sys.exit('No API key. Set GEMINI_API_KEY (get one at https://aistudio.google.com/apikey) or put it in ./.env')

    # Style anchor: either a file you give, or ferret 01 (generated first, then reused as the reference).
    anchor = None
    first = roster[0]
    ordered = list(todo)
    pause_after = None
    if not args.no_anchor:
        if args.anchor:
            p = Path(args.anchor)
            if not p.exists():
                sys.exit(f'--anchor: {p} not found')
            im = Image.open(p)
            anchor = (p.read_bytes(), MIME_BY_FORMAT.get(im.format, 'image/png'))
        else:
            p = find_existing_anchor(first)
            if p and first not in todo:
                im = Image.open(p)
                anchor = (p.read_bytes(), MIME_BY_FORMAT.get(im.format, 'image/png'))
                print(f'Using {p.relative_to(ROOT)} as the style reference.')
            elif first in todo:
                ordered.remove(first)
                ordered.insert(0, first)
                pause_after = first
            else:
                sys.exit(f'No style reference yet. Generate ferret {first["id"]} first (--only {first["id"]}), or pass --anchor FILE / --no-anchor.')

    ok, failed = [], []
    try:
        for i, f in enumerate(ordered, 1):
            print(f'[{i}/{len(ordered)}] {f["id"]} {f["name"]} ...', flush=True)
            is_anchor_run = (f is pause_after) and anchor is None
            try:
                raw = generate(args, key, f, None if is_anchor_run else anchor)
                orig, out, mime = save(f, raw)
            except Failed as e:
                print(f'    FAILED: {e}')
                failed.append(f)
                if is_anchor_run:
                    print('The style anchor failed, so the rest would have no reference. Fix the problem and re-run.')
                    break
                continue
            print(f'    saved {out.relative_to(ROOT)}')
            ok.append(f)
            if is_anchor_run:
                anchor = (raw, mime)
                if not args.yes and len(ordered) > 1:
                    print(f'\nThis image sets the look for the other {len(ordered) - 1} ferrets. Open it and check it:\n  {orig}')
                    if not sys.stdin.isatty():
                        print('(not an interactive terminal: stopping here; re-run with --yes to continue)')
                        break
                    if input('Looks good, continue with the rest? [y/N] ').strip().lower() not in ('y', 'yes'):
                        print('Stopped. Re-generate it with: --only 01 --force')
                        break
            if i < len(ordered):
                time.sleep(args.delay)
    except Fatal as e:
        print(f'\nSTOPPED: {e}')
        return 2
    except KeyboardInterrupt:
        print('\nInterrupted. Finished images are kept; re-run to continue.')

    print(f'\nDone: {len(ok)} generated, {len(failed)} failed, {skipped} skipped.')
    if failed:
        print('Failed: ' + ', '.join(f'{f["id"]} {f["name"]}' for f in failed) + '\nRe-run the same command to retry them.')
    remaining = [f for f in roster if not is_done(f)]
    print(f'{len(roster) - len(remaining)}/{len(roster)} ferrets have images in art/images/.')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
