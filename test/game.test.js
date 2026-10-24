'use strict';
// Spins up the server on a temp port/data dir and plays full games with two fake clients.
const { spawn } = require('child_process');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const WebSocket = require('ws');

const PORT = 18000 + Math.floor(Math.random() * 1000);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fgw-'));
const base = `http://127.0.0.1:${PORT}`;

class Client {
  constructor() {
    this.state = null;
    this.msgs = [];
    this.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    this.ws.on('message', (d) => {
      const m = JSON.parse(d);
      this.msgs.push(m);
      if (m.type === 'state') this.state = m;
      if (m.type === 'joined') this.joined = m;
    });
    this.opened = new Promise((r) => this.ws.on('open', r));
  }
  send(m) { this.ws.send(JSON.stringify(m)); }
  async until(fn, label) {
    for (let i = 0; i < 100; i++) {
      if (fn(this)) return;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error('timeout waiting for ' + label + ' ' + JSON.stringify(this.state));
  }
}

async function main() {
  const srv = spawn('node', ['server.js'], { env: { ...process.env, PORT, DATA_DIR: dataDir }, stdio: 'inherit' });
  try {
    for (let i = 0; i < 50; i++) {
      try { if ((await fetch(base + '/healthz')).ok) break; } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }

    // roster + seeding + static
    const roster = await (await fetch(base + '/api/ferrets')).json();
    assert.strictEqual(roster.ferrets.length, 30);
    assert.ok(roster.ferrets[0].image.startsWith('/images/01-bandit.webp?v='), 'bundled photo is used');
    assert.strictEqual((await fetch(base + roster.ferrets[0].image)).status, 200);
    fs.writeFileSync(path.join(dataDir, 'images', '02.png'), 'x');
    const r2 = await (await fetch(base + '/api/ferrets')).json();
    assert.ok(r2.ferrets[1].image.startsWith('/images/02.png?v='), 'data-folder image overrides the bundled one');
    assert.strictEqual((await fetch(base + '/images/02.png')).status, 200);
    assert.strictEqual((await fetch(base + '/images/02-noodle.webp')).status, 200, 'bundled file still reachable');
    assert.strictEqual((await fetch(base + '/')).status, 200);
    assert.notStrictEqual((await fetch(base + '/images/..%2f..%2fserver.js')).status, 200);
    assert.notStrictEqual((await fetch(base + '/..%2fserver.js')).status, 200);

    // lobby
    const a = new Client(), b = new Client();
    await Promise.all([a.opened, b.opened]);
    b.send({ type: 'join', code: 'ZZZZ', name: 'x' });
    await b.until((c) => c.msgs.some((m) => m.type === 'error'), 'bad-code error');
    a.send({ type: 'create', name: 'Alex' });
    await a.until((c) => c.state && c.state.phase === 'waiting', 'waiting');
    const code = a.joined.code;
    assert.match(code, /^[A-HJ-NP-Z]{4}$/);
    b.send({ type: 'join', code: code.toLowerCase(), name: 'Sam' });
    await a.until((c) => c.state.phase === 'picking', 'picking');
    await b.until((c) => c.state && c.state.phase === 'picking', 'picking b');
    const c3 = new Client(); await c3.opened;
    c3.send({ type: 'join', code, name: 'Eve' });
    await c3.until((c) => c.msgs.some((m) => m.type === 'error'), 'full error');

    // picking: invalid id ignored, then lock
    a.send({ type: 'secret', id: '99' });
    a.send({ type: 'secret', id: '05' });
    await a.until((c) => c.state.you.locked, 'a locked');
    assert.strictEqual(a.state.phase, 'picking');
    assert.strictEqual(b.state.opp.locked, true);
    assert.strictEqual(b.state.opp.secret, undefined, 'secret must not leak');
    b.send({ type: 'secret', id: '07' });
    await a.until((c) => c.state.phase === 'playing', 'playing');
    await b.until((c) => c.state.phase === 'playing', 'playing b');
    assert.strictEqual(a.state.myTurn !== b.state.myTurn, true);

    const [first, second] = a.state.myTurn ? [a, b] : [b, a];
    const [firstSecret, secondSecret] = a.state.myTurn ? ['05', '07'] : ['07', '05'];

    // flips are private and persistent; allowed for either player
    second.send({ type: 'flip', id: '01', down: true });
    await second.until((c) => c.state.you.down.includes('01'), 'flip');
    assert.deepStrictEqual(first.state.you.down, []);
    second.send({ type: 'endTurn' }); // not their turn: ignored
    first.send({ type: 'endTurn' });
    await second.until((c) => c.state.myTurn, 'turn passes');

    // reconnect with token
    const oldTok = second.joined.token;
    second.ws.close();
    await first.until((c) => c.state.opp.connected === false, 'opp disconnected');
    const b2 = new Client(); await b2.opened;
    b2.send({ type: 'rejoin', code, token: oldTok });
    await b2.until((c) => c.state && c.state.phase === 'playing', 'rejoin');
    assert.deepStrictEqual(b2.state.you.down, ['01']);
    assert.strictEqual(b2.state.myTurn, true);
    const bad = new Client(); await bad.opened;
    bad.send({ type: 'rejoin', code, token: 'nope' });
    await bad.until((c) => c.msgs.some((m) => m.type === 'rejoinFailed'), 'rejoinFailed');

    // wrong guess loses
    b2.send({ type: 'guess', id: '20' });
    await b2.until((c) => c.state.phase === 'over', 'over');
    assert.strictEqual(b2.state.result.youWon, false);
    assert.strictEqual(first.state.result.youWon, true);
    assert.strictEqual(first.state.result.oppSecret, secondSecret);
    assert.strictEqual(first.state.scores.you, 1);

    // rematch needs both, swaps starter
    first.send({ type: 'again' });
    await b2.until((c) => c.state.opp.again, 'opp again');
    assert.strictEqual(first.state.phase, 'over');
    b2.send({ type: 'again' });
    await first.until((c) => c.state.phase === 'picking', 'rematch');
    assert.strictEqual(first.state.you.secret, null);
    assert.deepStrictEqual(b2.state.you.down, []);
    assert.strictEqual(first.state.scores.you, 1);
    first.send({ type: 'secret', id: '01' }); b2.send({ type: 'secret', id: '02' });
    await first.until((c) => c.state.phase === 'playing', 'round 2');
    assert.strictEqual(first.state.myTurn, false, 'rematch starter alternates (first started round 1)');

    // right guess wins
    const guesser = first.state.myTurn ? first : b2;
    const target = guesser === first ? '02' : '01';
    guesser.send({ type: 'guess', id: target });
    await guesser.until((c) => c.state.phase === 'over', 'over 2');
    assert.strictEqual(guesser.state.result.youWon, true);

    // leaving returns the other player to the waiting room
    guesser.send({ type: 'leave' });
    const other = guesser === first ? b2 : first;
    await other.until((c) => c.state.phase === 'waiting' && c.state.opp === null, 'waiting after leave');
    assert.ok(other.msgs.some((m) => m.type === 'notice'));

    console.log('all game tests passed');
  } finally {
    srv.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  process.exit(0);
}
main().catch((e) => { console.error('FAIL', e); process.exit(1); });
