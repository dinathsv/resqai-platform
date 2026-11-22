const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const flush = () => new Promise(resolve => setImmediate(resolve));

function harness(connect) {
  let focusEffect;
  let cleanup;
  let appListener;
  let interval;
  let timeoutId = 0;
  const timeouts = new Map();
  let disconnects = 0;
  const listeners = new Map();
  const socket = {
    on(event, callback) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(callback);
    },
    off(event, callback) { listeners.get(event)?.delete(callback); },
    disconnect() { disconnects++; },
  };
  const appState = {
    currentState: 'active',
    addEventListener(event, callback) {
      assert.equal(event, 'change');
      appListener = callback;
      return { remove() { appListener = undefined; } };
    },
  };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../hooks/useAlertFeedRefresh.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    AbortController,
    console: { warn() {} },
    setInterval(callback, ms) { assert.equal(ms, 15000); interval = callback; return 1; },
    clearInterval() { interval = undefined; },
    setTimeout(callback, ms) {
      assert.equal(ms, 10000);
      const id = ++timeoutId;
      timeouts.set(id, callback);
      return id;
    },
    clearTimeout(id) { timeouts.delete(id); },
    require(name) {
      if (name === 'react') return { useCallback: callback => callback, useRef: current => ({ current }) };
      if (name === 'react-native') return { AppState: appState };
      if (name === 'expo-router') return { useFocusEffect: callback => { focusEffect = callback; } };
      if (name === '../config/socket') return { connectSocket: () => connect ? connect(socket) : Promise.resolve(socket) };
      throw new Error(name);
    },
  });
  return {
    use: exports.useAlertFeedRefresh,
    focus() { cleanup = focusEffect(); },
    blur() { cleanup(); },
    tick() { interval?.(); },
    emit(event, payload) { for (const callback of listeners.get(event) || []) callback(payload); },
    state(value) { appState.currentState = value; appListener?.(value); },
    listenerCount: () => [...listeners.values()].reduce((count, handlers) => count + handlers.size, 0),
    disconnects: () => disconnects,
    hasInterval: () => !!interval,
    timeOut() { for (const callback of [...timeouts.values()]) callback(); },
    timeoutCount: () => timeouts.size,
  };
}

test('verification updates, reconnects and fallback polling reload the authoritative feed', async () => {
  const h = harness();
  const updates = [];
  h.use(async (isCurrent, fromSocket) => updates.push({ current: isCurrent(), fromSocket }));
  h.focus(); await flush();
  assert.equal(updates.length, 1);
  h.emit('community_requests_updated', { message: 'Do not display this payload' }); await flush();
  assert.equal(updates.at(-1).fromSocket, true);
  h.emit('connect'); await flush();
  assert.equal(updates.at(-1).fromSocket, false);
  h.tick(); await flush();
  assert.equal(updates.length, 4);
  h.emit('new_request', { message: 'Private unverified report' }); await flush();
  assert.equal(updates.length, 4);
  h.blur();
});

test('polling continues without a socket and pauses while the app is in the background', async () => {
  const h = harness(async () => { throw new Error('Socket server unavailable'); });
  let calls = 0;
  h.use(async () => { calls++; });
  h.focus(); await flush();
  h.tick(); await flush(); assert.equal(calls, 2);
  h.state('background'); h.tick(); await flush(); assert.equal(calls, 2);
  h.state('active'); await flush(); assert.equal(calls, 3);
  h.blur();
});

test('blur removes screen listeners and timers without disconnecting the shared socket', async () => {
  const h = harness();
  let calls = 0;
  let isCurrent;
  h.use(async current => { calls++; isCurrent = current; });
  h.focus(); await flush(); assert.equal(h.listenerCount(), 5);
  h.blur();
  assert.equal(h.listenerCount(), 0);
  assert.equal(h.hasInterval(), false);
  assert.equal(isCurrent(), false);
  h.emit('community_requests_updated'); h.tick(); h.state('active'); await flush();
  assert.equal(calls, 1);
  assert.equal(h.disconnects(), 0);
  h.focus(); await flush();
  assert.equal(h.listenerCount(), 5);
  h.blur();
});

test('a review arriving during an in-flight fetch gets a follow-up fetch without overlap', async () => {
  const h = harness();
  let release;
  let calls = 0;
  const reasons = [];
  h.use(async (isCurrent, fromSocket) => {
    calls++; reasons.push(fromSocket);
    if (calls === 1) await new Promise(resolve => { release = resolve; });
  });
  h.focus(); await flush();
  h.emit('community_requests_updated'); h.emit('emergency_alert');
  assert.equal(calls, 1);
  release(); await flush();
  assert.equal(calls, 2);
  assert.deepEqual(reasons, [false, true]);
  h.blur();
});

test('a socket resolving after blur does not install orphan listeners', async () => {
  let resolveSocket;
  let pendingSocket;
  const h = harness(socket => {
    pendingSocket = socket;
    return new Promise(resolve => { resolveSocket = resolve; });
  });
  h.use(async () => {}); h.focus(); h.blur();
  resolveSocket(pendingSocket); await flush();
  assert.equal(h.listenerCount(), 0);
  assert.equal(h.disconnects(), 0);
});

test('a stalled feed request is aborted so later polling can retry', async () => {
  const h = harness();
  let calls = 0;
  let firstSignal;
  h.use(async (isCurrent, fromSocket, signal) => {
    calls++;
    if (calls === 1) {
      firstSignal = signal;
      await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
    }
  });
  h.focus(); await flush();
  assert.equal(calls, 1);
  assert.equal(firstSignal.aborted, false);
  h.timeOut(); await flush();
  assert.equal(firstSignal.aborted, true);
  assert.equal(h.timeoutCount(), 0);
  h.tick(); await flush();
  assert.equal(calls, 2);
  h.blur();
});

test('manual refresh shares serialization and blur aborts the active request', async () => {
  const h = harness();
  let calls = 0;
  let signal;
  let isCurrent;
  const refreshNow = h.use(async (current, fromSocket, requestSignal) => {
    calls++; signal = requestSignal; isCurrent = current;
    await new Promise(resolve => requestSignal.addEventListener('abort', resolve, { once: true }));
  });
  h.focus(); await flush();
  void refreshNow(); await flush();
  assert.equal(calls, 1);
  h.blur(); await flush();
  assert.equal(signal.aborted, true);
  assert.equal(isCurrent(), false);
  assert.equal(calls, 1);
  assert.equal(h.timeoutCount(), 0);
});
