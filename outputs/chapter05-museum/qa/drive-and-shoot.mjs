// MINIATURE GALLERY — real-browser QA driver.
//
// Boots the standalone Chapter 5 entry in headless Chrome (CDP, no extra npm
// packages), plays the slice with real keyboard events, and captures the six
// handoff screenshots plus the render_game_to_text() state at every beat.
//
// Usage (from repo root):  node outputs/chapter05-museum/qa/drive-and-shoot.mjs
// The script starts its own vite dev server and Chrome, and kills both
// before exiting. Nothing is left running.

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const SHOTS = join(HERE, '..', 'shots');
const STATES = join(HERE, '..', 'qa', 'text-states.jsonl');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PAGE = 'http://localhost:5185/museum.html';
const CDP_PORT = 9223;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(SHOTS, { recursive: true });

// ------------------------------------------------------------------- CDP --

class Cdp {
  constructor(wsUrl) {
    this.id = 0;
    this.pending = new Map();
    this.ws = new WebSocket(wsUrl);
    this.ws.addEventListener('message', (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (!msg.id && this.onEvent) {
        this.onEvent(msg.method, msg.params);
      }
    });
  }
  open() {
    return new Promise((res, rej) => {
      this.ws.addEventListener('open', res, { once: true });
      this.ws.addEventListener('error', rej, { once: true });
    });
  }
  send(method, params = {}) {
    const id = (this.id += 1);
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
}

const KEYS = {
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', vk: 39 },
  ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', vk: 37 },
  KeyE: { key: 'e', code: 'KeyE', vk: 69 },
  KeyQ: { key: 'q', code: 'KeyQ', vk: 81 },
  KeyR: { key: 'r', code: 'KeyR', vk: 82 },
};

async function keyEvent(cdp, name, type) {
  const k = KEYS[name];
  await cdp.send('Input.dispatchKeyEvent', {
    type,
    key: k.key,
    code: k.code,
    windowsVirtualKeyCode: k.vk,
    nativeVirtualKeyCode: k.vk,
  });
}
async function tap(cdp, name, ms = 80) {
  await keyEvent(cdp, name, 'rawKeyDown');
  await sleep(ms);
  await keyEvent(cdp, name, 'keyUp');
}
async function hold(cdp, name, ms) {
  await keyEvent(cdp, name, 'rawKeyDown');
  await sleep(ms);
  await keyEvent(cdp, name, 'keyUp');
}

async function textState(cdp) {
  const r = await cdp.send('Runtime.evaluate', {
    expression: 'window.render_game_to_text ? window.render_game_to_text() : "no-hook"',
    returnByValue: true,
  });
  const v = r.result && r.result.value;
  if (typeof v !== 'string' || v === 'no-hook') return { booting: true };
  try {
    return JSON.parse(v);
  } catch {
    return { booting: true };
  }
}

async function waitState(cdp, pred, label, timeoutMs = 15000) {
  const t0 = Date.now();
  for (;;) {
    const s = await textState(cdp);
    if (pred(s)) return s;
    if (Date.now() - t0 > timeoutMs) {
      throw new Error(`waitState timeout: ${label} — last state ${JSON.stringify(s)}`);
    }
    await sleep(200);
  }
}

async function shoot(cdp, file) {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(SHOTS, file), Buffer.from(r.data, 'base64'));
  console.log(`[shot] ${file}`);
}

async function record(cdp, lines, beat, state) {
  lines.push(JSON.stringify({ beat, ...state }));
  console.log(`[state] ${beat}: phase=${state.phase} room=${state.room} ticket=${state.ticket.where} ` +
    `A=${state.caseA.buildState} B=${state.caseB.buildState} open=${state.route.open} sealed=${state.route.sealed} complete=${state.complete}`);
}

// ------------------------------------------------------------------ main --

let vite;
let chrome;
const lines = [];

try {
  vite = spawn('npx', ['vite', '--config', 'vite.chapter05.config.js'], {
    cwd: REPO,
    stdio: 'ignore',
  });
  for (let i = 0; ; i += 1) {
    try {
      const r = await fetch(PAGE);
      if (r.ok) break;
    } catch {}
    if (i > 60) throw new Error('vite dev server did not come up');
    await sleep(500);
  }
  console.log('[ok] vite dev server up on :5185');

  const profile = `/tmp/ch05-chrome-${Date.now()}`;
  chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--window-size=1000,700',
    'about:blank',
  ], { stdio: 'ignore' });

  let wsUrl;
  for (let i = 0; ; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) {
        wsUrl = page.webSocketDebuggerUrl;
        break;
      }
    } catch {}
    if (i > 40) throw new Error('chrome CDP did not come up');
    await sleep(500);
  }
  const cdp = new Cdp(wsUrl);
  await cdp.open();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  cdp.onEvent = (method, params) => {
    if (method === 'Runtime.exceptionThrown') {
      console.error(`[page:error] ${JSON.stringify(params.exceptionDetails).slice(0, 500)}`);
    } else if (method === 'Runtime.consoleAPICalled' && params.type === 'error') {
      console.error(`[page:console.error] ${params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300)}`);
    }
  };
  await cdp.send('Page.navigate', { url: PAGE });

  // 1 — entry.
  let s = await waitState(cdp, (x) => x.chapter === 'chapter05-museum' && !x.booting, 'boot', 60000);
  await sleep(800);
  await shoot(cdp, '01-entry.png');
  await record(cdp, lines, '01-entry', s);

  // 2 — inspect + rotate + hidden mark.
  await hold(cdp, 'ArrowRight', 450);
  await tap(cdp, 'KeyE');
  s = await waitState(cdp, (x) => x.phase === 'inspect', 'inspect');
  await hold(cdp, 'ArrowRight', 750);
  s = await waitState(cdp, (x) => x.ticket.markRevealed === true, 'mark');
  await sleep(400);
  await shoot(cdp, '02-inspect.png');
  await record(cdp, lines, '02-inspect-mark-revealed', s);
  await tap(cdp, 'KeyE'); // pocket the ticket
  await waitState(cdp, (x) => x.ticket.where === 'held', 'held');

  // 3 — correct placement: CASE A rebuilds, the route opens.
  await hold(cdp, 'ArrowRight', 1300);
  await tap(cdp, 'KeyE');
  s = await waitState(cdp, (x) => x.caseA.buildState === 'active' && x.route.open, 'caseA+door', 20000);
  await sleep(500);
  await shoot(cdp, '03-correct-placement.png');
  await record(cdp, lines, '03-correct-placement-route-open', s);

  // (withdraw A, then place into B for the wrong interpretation)
  await tap(cdp, 'KeyE');
  await waitState(cdp, (x) => x.caseA.buildState === 'empty' && x.ticket.where === 'held', 'withdrawA');

  // 4 — wrong placement: CASE B walls the platform, the route seals.
  await hold(cdp, 'ArrowRight', 1100);
  await tap(cdp, 'KeyE');
  s = await waitState(cdp, (x) => x.caseB.buildState === 'active' && x.route.sealed, 'caseB+seal', 20000);
  await sleep(500);
  await shoot(cdp, '04-wrong-placement.png');
  await record(cdp, lines, '04-wrong-placement-sealed', s);

  // 5 — in-place withdrawal: the seal lifts, no reset.
  await tap(cdp, 'KeyE');
  s = await waitState(
    cdp,
    (x) => x.caseB.buildState === 'empty' && x.route.sealed === false && x.ticket.where === 'held',
    'withdrawB',
  );
  await sleep(400);
  await shoot(cdp, '05-withdraw.png');
  await record(cdp, lines, '05-withdraw-unsealed', s);

  // 6 — place into A again and walk the route to the witness mark.
  await hold(cdp, 'ArrowLeft', 1100);
  await tap(cdp, 'KeyE');
  await waitState(cdp, (x) => x.route.open, 'reopen', 20000);
  await hold(cdp, 'ArrowRight', 1900);
  s = await waitState(cdp, (x) => x.room === 'reconstruction', 'recon');
  await record(cdp, lines, '06a-entered-reconstruction', s);
  await hold(cdp, 'ArrowRight', 2600);
  s = await waitState(cdp, (x) => x.complete === true, 'complete');
  await sleep(500);
  await shoot(cdp, '06-complete.png');
  await record(cdp, lines, '06b-complete', s);

  // R — live reset from the real entry.
  await tap(cdp, 'KeyR');
  s = await waitState(cdp, (x) => x.resets === 1 && x.phase === 'explore' && x.ticket.where === 'pedestal', 'reset');
  await record(cdp, lines, '07-reset-R', s);

  writeFileSync(STATES, `${lines.join('\n')}\n`);
  console.log(`[ok] states written: ${STATES}`);
  console.log('QA-DRIVER-RESULT: PASS');
} catch (err) {
  writeFileSync(STATES, `${lines.join('\n')}\n`);
  console.error('QA-DRIVER-RESULT: FAIL');
  console.error(err);
  process.exitCode = 1;
} finally {
  if (chrome) chrome.kill('SIGKILL');
  if (vite) vite.kill('SIGKILL');
  await sleep(300);
  process.exit(process.exitCode || 0);
}
