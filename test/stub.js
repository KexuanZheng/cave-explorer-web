// 最小 DOM 桩：在 Node 里加载 game.js，模拟键盘与时间流逝，供测试使用。
const fs = require('fs');
const vm = require('vm');

class El {
  constructor(id) {
    this.id = id;
    this.style = {};
    this.children = [];
    this._text = '';
    this.classList = new Set();
    this.className = '';
    this._listeners = {};
  }
  set innerHTML(v) { if (v === '') this.children.length = 0; }
  get innerHTML() { return ''; }
  appendChild(c) { this.children.push(c); }
  set innerText(v) { this._text = String(v); }
  get innerText() { return this._text; }
  set textContent(v) { this._text = String(v); }
  get textContent() { return this._text; }
  addEventListener(type, fn) { this._listeners[type] = fn; }
  click() { if (this._listeners.click) this._listeners.click(); }
}

function makeEnv(gamePath) {
  const els = new Map();
  const getEl = (id) => { if (!els.has(id)) els.set(id, new El(id)); return els.get(id); };
  const document = { getElementById: getEl, createElement: () => new El() };
  const listeners = {};
  const window = { addEventListener: (t, f) => { listeners[t] = f; } };

  let now = 0;
  const performance = { now: () => now };
  const timers = new Map();
  let tid = 1;

  const ctx = vm.createContext({
    document, window, performance,
    setInterval: (fn) => { const id = tid++; timers.set(id, fn); return id; },
    clearInterval: (id) => { timers.delete(id); },
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
    console, Math, Date, alert: () => {},
  });

  vm.runInContext(fs.readFileSync(gamePath, 'utf8'), ctx);

  return {
    ctx,
    run: (code) => vm.runInContext(code, ctx),
    press: (k) => listeners.keydown({ key: k }),
    el: getEl,
    timerText: () => getEl('timer').textContent,
    overlayShown: () => getEl('overlay').style.display === 'flex',
    overlayTitle: () => getEl('overlay-title').textContent,
    overlayMsg: () => getEl('overlay-msg').textContent,
    advance: (ms) => { now += ms; for (const fn of timers.values()) fn(); },
    now: () => now,
  };
}

module.exports = { makeEnv };
