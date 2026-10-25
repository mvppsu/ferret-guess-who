"""Reorder art/ferrets.json so neighbouring cards look different.

The board shows ferrets in file order: 6 columns in landscape, 5 in portrait. This searches for an order where
cards that touch (side by side, above/below, and diagonally) rarely share a pose, coat or accessory in EITHER layout.

Usage:  python3 scripts/arrange_ferrets.py            # preview the best order found
        python3 scripts/arrange_ferrets.py --write    # save it back to art/ferrets.json
Ids, names and photos are unchanged; only the order moves.
"""
import json
import math
import random
import sys
from pathlib import Path

PATH = Path(__file__).resolve().parent.parent / 'art' / 'ferrets.json'
LAYOUTS = (6, 5)  # landscape columns, portrait columns
WEIGHTS = {'pose': 10, 'coat': 8, 'accessory': 5}


def neighbours(n, cols):
    for i in range(n):
        r, c = divmod(i, cols)
        for dr, dc, w in ((0, 1, 1.0), (1, 0, 1.0), (1, 1, 0.2), (1, -1, 0.2)):
            rr, cc = r + dr, c + dc
            j = rr * cols + cc
            if 0 <= cc < cols and j < n:
                yield i, j, w


def cost(order, pairs):
    total = 0.0
    for i, j, w in pairs:
        a, b = order[i], order[j]
        for k, weight in WEIGHTS.items():
            if a[k] == b[k]:
                total += weight * w
    return total


def search(ferrets, seed=7, rounds=40, steps=20000):
    n = len(ferrets)
    pairs = [p for cols in LAYOUTS for p in neighbours(n, cols)]
    rng = random.Random(seed)
    best, best_cost = None, math.inf
    for _ in range(rounds):
        cur = ferrets[:]
        rng.shuffle(cur)
        c = cost(cur, pairs)
        temp = 8.0
        for s in range(steps):
            temp = max(0.05, 8.0 * (1 - s / steps))
            i, j = rng.randrange(n), rng.randrange(n)
            if i == j:
                continue
            cur[i], cur[j] = cur[j], cur[i]
            nc = cost(cur, pairs)
            if nc <= c or rng.random() < math.exp((c - nc) / temp):
                c = nc
            else:
                cur[i], cur[j] = cur[j], cur[i]
            if c == 0:
                break
        if c < best_cost:
            best, best_cost = cur[:], c
        if best_cost == 0:
            break
    return best, best_cost


def show(order, cols):
    print(f'\n{cols} columns:')
    for r in range(0, len(order), cols):
        print('  ' + '  '.join(f'{f["id"]}' for f in order[r:r + cols]))


def orth_clashes(order):
    out = []
    for cols in LAYOUTS:
        for i, j, w in neighbours(len(order), cols):
            if w == 1.0:
                same = [k for k in WEIGHTS if order[i][k] == order[j][k]]
                if same:
                    out.append((cols, order[i]['id'], order[j]['id'], same))
    return out


if __name__ == '__main__':
    data = json.loads(PATH.read_text())
    ferrets = sorted(data['ferrets'], key=lambda f: f['id'])
    # Several seeds: keep the cheapest arrangement with no side-by-side/stacked clashes in either layout.
    best = None
    for seed in range(1, 40):
        cand, cc = search(ferrets, seed=seed, rounds=8)
        key = (len(orth_clashes(cand)), cc)
        if best is None or key < best[0]:
            best = (key, cand, cc)
        if key[0] == 0 and cc < 40:
            break
    _, order, c = best
    print(f'penalty {c:g} (lower is better; diagonal touches count a little)')
    for cols in LAYOUTS:
        show(order, cols)
    clashes = orth_clashes(order)
    print(f'\nside-by-side or stacked clashes: {len(clashes)}', clashes[:6])
    if '--write' in sys.argv:
        data['ferrets'] = order
        PATH.write_text(json.dumps(data, indent=1) + '\n')
        print('written to', PATH)
