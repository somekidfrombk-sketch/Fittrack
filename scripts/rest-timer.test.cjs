const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('rest timer catches up after suspension, restarts, resets, and rejects invalid durations', () => {
  const state = [];
  const refs = [];
  let stateIndex = 0;
  let refIndex = 0;
  let now = 1000;
  let tick;
  let resume;
  let vibrates = 0;
  let effect;
  let dependencies;
  let cleanup;
  const react = {
    useState(initial) {
      const i = stateIndex++;
      if (!(i in state)) state[i] = initial;
      return [state[i], (value) => { state[i] = value; }];
    },
    useRef(initial) {
      const i = refIndex++;
      if (!(i in refs)) refs[i] = { current: initial };
      return refs[i];
    },
    useCallback(fn) { return fn; },
    useEffect(fn, next) {
      if (!dependencies || next.some((value, i) => value !== dependencies[i])) {
        effect = fn;
        dependencies = next;
      }
    },
  };
  const native = {
    Vibration: { vibrate() { vibrates++; } },
    AppState: { addEventListener(_, callback) { resume = callback; return { remove() {} }; } },
  };
  const module = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync('hooks/use-rest-timer.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(js, {
    exports: module.exports,
    require: (id) => id === 'react' ? react : native,
    Date: { now: () => now },
    setInterval: (callback) => { tick = callback; return 1; },
    clearInterval() {},
  });
  function render() {
    stateIndex = 0;
    refIndex = 0;
    const timer = module.exports.useRestTimer();
    if (effect) {
      cleanup?.();
      cleanup = effect();
      effect = undefined;
    }
    return timer;
  }
  let timer = render();
  timer.start(60);
  timer = render();
  now += 45000; // JS timer did not run while the app was suspended.
  resume('active');
  timer = render();
  assert.equal(timer.secondsLeft, 15);
  timer.start(30); // Restart while already active.
  now += 29000;
  tick();
  timer = render();
  assert.equal(timer.secondsLeft, 1);
  now += 1000;
  tick();
  tick();
  timer = render();
  assert.equal(timer.complete, true);
  assert.equal(vibrates, 1);
  timer.reset();
  timer = render();
  assert.equal(timer.complete, false);
  assert.equal(timer.secondsLeft, 0);
  timer.start(NaN);
  timer = render();
  assert.equal(timer.active, false);
  assert.equal(timer.secondsLeft, 0);
});
