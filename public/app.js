'use strict';

const $ = (id) => document.getElementById(id);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

const COAT_COLORS = { sable: '#8b6a4b', albino: '#c9b8a8', silver: '#8c909c', cinnamon: '#b97a4a', black: '#4a3f43', panda: '#7b6a62' };
const CARD_GAP = 7;
const NAME_H = 24;

let roster = null; // {ferrets, coats, poses, accessories}
let byId = new Map();
let state = null; // latest server snapshot
let session = null; // {code, token}
let ws = null;
let connected = false;
let retry = 0;
let muted = store.get('fgw-mute') === '1';

// local-only UI state
let sel = null; // ferret chosen while picking, before locking
let guessMode = false;
let modal = null; // {kind:'confirm'|'peek', id}
let boardBuilt = false;

// ---------- sound (synthesised, no files) ----------

let actx = null;
function audio() {
  if (!actx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (C) actx = new C();
  }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(freq, at, dur, { type = 'sine', vol = 0.18, to = null } = {}) {
  const ctx = audio();
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}
const sfx = {
  select: () => tone(660, 0, 0.07, { type: 'triangle' }),
  flip: () => tone(540, 0, 0.1, { type: 'triangle', to: 280 }),
  unflip: () => tone(280, 0, 0.1, { type: 'triangle', to: 540 }),
  dook: () => { tone(300, 0, 0.1, { type: 'square', vol: 0.07, to: 220 }); tone(300, 0.15, 0.1, { type: 'square', vol: 0.07, to: 220 }); tone(330, 0.3, 0.14, { type: 'square', vol: 0.07, to: 240 }); },
  turn: () => { tone(660, 0, 0.12); tone(880, 0.12, 0.2); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.25, { type: 'triangle', vol: 0.22 })),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, i * 0.2, 0.3, { type: 'sawtooth', vol: 0.09 })),
};
document.addEventListener('pointerdown', audio, { once: true });

// ---------- networking ----------

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function connect() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.onopen = () => {
    connected = true;
    retry = 0;
    if (session) send({ type: 'rejoin', code: session.code, token: session.token });
    render();
  };
  ws.onmessage = (e) => {
    let m;
    try { m = JSON.parse(e.data); } catch { return; }
    onMessage(m);
  };
  ws.onclose = () => {
    connected = false;
    render();
    setTimeout(connect, Math.min(3000, 400 * ++retry));
  };
  ws.onerror = () => ws.close();
}

function onMessage(m) {
  switch (m.type) {
    case 'joined':
      session = { code: m.code, token: m.token };
      store.set('fgw-session', JSON.stringify(session));
      break;
    case 'state':
      onState(state, m);
      break;
    case 'error':
      toast(m.message);
      break;
    case 'notice':
      toast(m.message);
      break;
    case 'rejoinFailed':
      if (session) toast('That game has ended.');
      clearSession();
      render();
      break;
  }
}

function clearSession() {
  session = null;
  state = null;
  sel = null;
  guessMode = false;
  modal = null;
  store.del('fgw-session');
}

function onState(prev, next) {
  state = next;
  if (next.phase !== 'playing') guessMode = false;
  if (!next.myTurn) guessMode = false;
  if (next.phase !== 'picking' || next.you.locked) sel = next.phase === 'picking' ? next.you.secret : null;
  if (next.phase === 'over' || next.phase === 'waiting') modal = null;

  const was = prev ? prev.phase : null;
  if (was === 'waiting' && next.phase === 'picking') sfx.dook();
  else if (was === 'picking' && next.phase === 'playing') sfx.dook();
  else if (was === 'playing' && next.phase === 'over') (next.result && next.result.youWon ? sfx.win : sfx.lose)();
  else if (was === 'playing' && next.phase === 'playing' && !prev.myTurn && next.myTurn) sfx.turn();
  render();
}

// ---------- roster / cards ----------

async function loadRoster() {
  try {
    const r = await fetch('/api/ferrets', { cache: 'no-store' });
    if (!r.ok) throw new Error(await r.text());
    roster = await r.json();
    byId = new Map(roster.ferrets.map((f) => [f.id, f]));
    roster.ferrets.forEach((f) => { if (f.image) new Image().src = f.image; });
    boardBuilt = false;
    render();
  } catch (e) {
    toast('Could not load the ferrets. Retrying…');
    setTimeout(loadRoster, 3000);
  }
}

function traitText(f) {
  return `${roster.coats[f.coat] || f.coat}<br>${roster.poses[f.pose] || f.pose}<br>${roster.accessories[f.accessory] || f.accessory}`;
}

function artHtml(f) {
  const img = f.image ? `<img src="${f.image}" alt="" draggable="false">` : '';
  return `<div class="art" style="background:${COAT_COLORS[f.coat] || '#888'}"><div class="ph">${traitText(f)}</div>${img}</div>`;
}

function cardEl(f, tag = 'button') {
  const el = document.createElement(tag);
  el.className = 'card';
  el.dataset.id = f.id;
  el.setAttribute('aria-label', f.name);
  el.innerHTML = `${artHtml(f)}<div class="nm"></div>`;
  el.querySelector('.nm').textContent = f.name;
  const img = el.querySelector('img');
  if (img) img.onerror = () => img.remove();
  return el;
}

function buildBoard() {
  const board = $('board');
  board.replaceChildren(...roster.ferrets.map((f) => cardEl(f)));
  boardBuilt = true;
}

function layoutBoard() {
  if (!roster) return;
  const wrap = $('board-wrap');
  const W = wrap.clientWidth, H = wrap.clientHeight;
  if (!W || !H) return;
  const n = roster.ferrets.length;
  const cols = window.innerHeight > window.innerWidth ? 5 : 6;
  const rows = Math.ceil(n / cols);
  const cw = Math.max(40, Math.floor(Math.min((W - (cols - 1) * CARD_GAP) / cols, (H - (rows - 1) * CARD_GAP) / rows - NAME_H)));
  const board = $('board');
  board.style.setProperty('--cols', cols);
  board.style.setProperty('--cw', cw + 'px');
  board.style.setProperty('--ch', cw + NAME_H + 'px');
}

// ---------- helpers ----------

let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

function show(which) {
  for (const n of ['home', 'wait', 'game']) $('screen-' + n).hidden = n !== which;
}

const nameOf = (id) => (byId.get(id) ? byId.get(id).name : '?');

function readName() {
  const n = $('name').value.trim().slice(0, 14);
  store.set('fgw-name', n);
  return n;
}

// ---------- rendering ----------

function render() {
  if (!state) {
    show('home');
    $('screen-result').hidden = true;
    $('modal').hidden = true;
    const rejoining = !!session;
    $('btn-new').disabled = $('btn-join').disabled = !connected || rejoining;
    $('conn-note').textContent = rejoining ? 'Rejoining your game…' : connected ? '' : 'Connecting to the server…';
    return;
  }
  if (state.phase === 'waiting') {
    show('wait');
    $('screen-result').hidden = true;
    $('modal').hidden = true;
    $('wait-code').innerHTML = state.code.split('').map((c) => `<span>${c}</span>`).join('');
    $('wait-me').textContent = `${state.you.name} (you) ✔`;
    return;
  }
  if (!roster) return; // roster arrives shortly and re-renders
  show('game');
  renderGame();
  renderResult();
  renderModal();
}

function renderGame() {
  const s = state;
  if (!boardBuilt) buildBoard();
  layoutBoard();

  const picking = s.phase === 'picking', playing = s.phase === 'playing', over = s.phase === 'over';
  const down = new Set(s.you.down);
  const opp = s.opp ? s.opp.name : 'your friend';
  const canPick = picking && !s.you.locked;
  const canFlip = playing;

  $('room-pill').textContent = `Room ${s.code}`;
  $('count-pill').textContent = playing || over ? `${roster.ferrets.length - down.size} left` : '';
  $('count-pill').hidden = !(playing || over);
  $('btn-mute').textContent = muted ? '🔇' : '🔊';

  // banner
  const b = $('banner');
  let cls = 'banner', html = '';
  if (picking && !s.you.locked) { cls += ' me'; html = `Pick your secret ferret!<small>${s.opp && s.opp.locked ? opp + ' is ready' : opp + ' is choosing…'}</small>`; }
  else if (picking) html = `Locked in!<small>Waiting for ${opp}…</small>`;
  else if (playing && s.myTurn && guessMode) { cls += ' guess'; html = `Tap the ferret you think ${opp} picked`; }
  else if (playing && s.myTurn) { cls += ' me'; html = `Your turn, ${s.you.name}!<small>Ask ${opp} a question out loud.</small>`; }
  else if (playing) html = `${opp} is asking…<small>Answer out loud, then tap cards to cross ferrets off.</small>`;
  else html = 'Game over';
  b.className = cls;
  b.innerHTML = html;

  // warnings
  const warn = $('opp-warn');
  if (!connected) { warn.hidden = false; warn.textContent = 'Reconnecting…'; }
  else if (s.opp && !s.opp.connected && !over) { warn.hidden = false; warn.textContent = `${opp} lost connection. Waiting for them to come back…`; }
  else warn.hidden = true;

  // buttons
  $('btn-lock').hidden = !canPick;
  $('btn-lock').disabled = !sel;
  const inGuess = playing && s.myTurn && guessMode;
  $('btn-guess').hidden = !playing || inGuess;
  $('btn-end').hidden = !playing || inGuess;
  $('btn-guess').disabled = $('btn-end').disabled = !s.myTurn;
  $('btn-guess-cancel').hidden = !inGuess;

  // secret chip
  const chip = $('secret-chip');
  const secretId = canPick ? sel : s.you.secret;
  if (secretId && byId.has(secretId)) {
    const f = byId.get(secretId);
    chip.hidden = false;
    chip.innerHTML = `<span class="thumb">${artHtml(f)}</span><span><b></b><small>${canPick ? 'Your pick' : 'Tap to peek'}</small></span>`;
    chip.querySelector('b').textContent = f.name;
    const img = chip.querySelector('img');
    if (img) img.onerror = () => img.remove();
  } else chip.hidden = true;

  $('score').textContent = s.scores.you || s.scores.opp || over ? `${s.you.name} ${s.scores.you} – ${s.scores.opp} ${opp}` : '';

  // cards
  const board = $('board');
  board.classList.toggle('guessing', inGuess);
  for (const el of board.children) {
    const id = el.dataset.id;
    el.classList.toggle('down', down.has(id));
    el.classList.toggle('sel', (picking && id === sel) || false);
    el.classList.toggle('cand', modal && modal.kind === 'confirm' && modal.id === id);
    el.classList.toggle('off', !(canPick || canFlip));
  }
}

function renderModal() {
  const m = $('modal');
  if (!modal || !byId.has(modal.id)) { m.hidden = true; return; }
  const f = byId.get(modal.id);
  const body = $('modal-body');
  const opp = state.opp ? state.opp.name : 'your friend';
  body.innerHTML = '';
  const c = cardEl(f, 'div');
  c.classList.add('big-card');
  body.append(c);
  const h = document.createElement('h3');
  const p = document.createElement('p');
  if (modal.kind === 'confirm') {
    h.textContent = `Is it ${f.name}?`;
    p.textContent = 'You only get one guess. A wrong guess loses!';
    body.append(h, p, mkBtn(`Yes, guess ${f.name}`, 'btn red', () => { send({ type: 'guess', id: f.id }); modal = null; guessMode = false; render(); }), mkBtn('Not yet', 'btn alt', () => { modal = null; render(); }));
  } else {
    h.textContent = f.name;
    p.textContent = `Your secret ferret. Don't let ${opp} see!`;
    body.append(h, p, mkBtn('Close', 'btn', () => { modal = null; render(); }));
  }
  m.hidden = false;
}

function mkBtn(label, cls, fn) {
  const b = document.createElement('button');
  b.className = cls;
  b.textContent = label;
  b.onclick = fn;
  return b;
}

let confettiFor = null;
function renderResult() {
  const el = $('screen-result');
  const s = state;
  if (s.phase !== 'over' || !s.result) { el.hidden = true; confettiFor = null; return; }
  const r = s.result, opp = s.opp.name;
  let title, sub, showId;
  if (r.youWon && r.youGuessed) { title = 'You win!'; sub = `${opp}'s secret ferret was ${nameOf(r.oppSecret)}`; showId = r.oppSecret; }
  else if (r.youWon) { title = 'You win!'; sub = `${opp} guessed ${nameOf(r.guessId)}, but your ferret was ${nameOf(r.yourSecret)}`; showId = r.yourSecret; }
  else if (r.youGuessed) { title = 'Not quite!'; sub = `You guessed ${nameOf(r.guessId)}. ${opp}'s ferret was ${nameOf(r.oppSecret)}.`; showId = r.oppSecret; }
  else { title = `${opp} guessed your ferret!`; sub = `${nameOf(r.yourSecret)} was found out`; showId = r.yourSecret; }

  el.className = 'overlay result' + (r.youWon ? '' : ' lose');
  const body = $('result-body');
  body.innerHTML = '';
  const t = document.createElement('p');
  t.className = 'title ' + (r.youWon ? 'win' : 'lose');
  t.textContent = title;
  const st = document.createElement('p');
  st.className = 'sub';
  st.textContent = sub;
  body.append(t, st);
  if (byId.has(showId)) {
    const c = cardEl(byId.get(showId), 'div');
    c.classList.add('big-card');
    body.append(c);
  }
  const again = mkBtn(s.you.again ? `Waiting for ${opp}…` : 'Play again', 'btn big', () => { send({ type: 'again' }); });
  again.disabled = s.you.again;
  body.append(again, mkBtn('Leave', 'btn alt', leaveGame));
  const score = document.createElement('p');
  score.className = 'sub';
  score.textContent = `${s.you.name} ${s.scores.you} – ${s.scores.opp} ${opp}`;
  body.append(score);
  el.hidden = false;

  const key = s.code + ':' + s.scores.you + ':' + s.scores.opp;
  if (r.youWon && confettiFor !== key) { confettiFor = key; confetti(); }
}

function confetti() {
  const box = $('confetti');
  box.innerHTML = '';
  const bits = ['🎉', '⭐', '🎊', '✨'];
  for (let i = 0; i < 28; i++) {
    const e = document.createElement('i');
    e.textContent = bits[i % bits.length];
    e.style.left = Math.random() * 100 + '%';
    e.style.fontSize = 18 + Math.random() * 22 + 'px';
    e.style.animationDuration = 2.5 + Math.random() * 2.5 + 's';
    e.style.animationDelay = Math.random() * 1.5 + 's';
    box.append(e);
  }
}

function leaveGame() {
  if (state && state.phase !== 'over' && state.phase !== 'waiting' && !confirm('Leave this game?')) return;
  send({ type: 'leave' });
  clearSession();
  render();
}

// ---------- events ----------

$('btn-new').onclick = () => {
  const name = readName();
  if (!name) { $('name').focus(); return toast('Type your name first.'); }
  send({ type: 'create', name });
};
function join() {
  const name = readName();
  const code = $('code').value.trim().toUpperCase();
  if (!name) { $('name').focus(); return toast('Type your name first.'); }
  if (code.length !== 4) { $('code').focus(); return toast('Codes have 4 letters.'); }
  send({ type: 'join', code, name });
}
$('btn-join').onclick = join;
$('code').addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
$('code').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase(); });
$('name').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
$('btn-cancel').onclick = leaveGame;
$('btn-quit').onclick = leaveGame;
$('btn-mute').onclick = () => {
  muted = !muted;
  store.set('fgw-mute', muted ? '1' : '0');
  render();
  sfx.select();
};

$('btn-lock').onclick = () => {
  if (!sel) return;
  send({ type: 'secret', id: sel });
  sfx.select();
};
$('btn-guess').onclick = () => { guessMode = true; render(); };
$('btn-guess-cancel').onclick = () => { guessMode = false; render(); };
$('btn-end').onclick = () => { send({ type: 'endTurn' }); };
$('secret-chip').onclick = () => {
  if (state && state.you.secret) { modal = { kind: 'peek', id: state.you.secret }; render(); }
};
$('modal').addEventListener('click', (e) => { if (e.target === $('modal')) { modal = null; render(); } });

$('board').addEventListener('click', (e) => {
  const el = e.target.closest('.card');
  if (!el || !state) return;
  const id = el.dataset.id;
  const s = state;
  if (s.phase === 'picking' && !s.you.locked) {
    sel = id;
    sfx.select();
    return render();
  }
  if (s.phase !== 'playing') return;
  const isDown = s.you.down.includes(id);
  if (guessMode && s.myTurn) {
    if (isDown) return;
    modal = { kind: 'confirm', id };
    return render();
  }
  send({ type: 'flip', id, down: !isDown });
  s.you.down = isDown ? s.you.down.filter((x) => x !== id) : [...s.you.down, id];
  (isDown ? sfx.unflip : sfx.flip)();
  render();
});

new ResizeObserver(() => layoutBoard()).observe($('board-wrap'));
window.addEventListener('orientationchange', () => setTimeout(layoutBoard, 150));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) connect();
  else send({ type: 'sync' });
});
// iOS can hold a dead socket after sleep; a failed ping closes it and the retry loop reconnects.
setInterval(() => send({ type: 'sync' }), 20000);

// ---------- boot ----------

(function boot() {
  $('name').value = store.get('fgw-name') || '';
  try { session = JSON.parse(store.get('fgw-session') || 'null'); } catch { session = null; }
  render();
  loadRoster();
  connect();
})();
