const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadCalculator() {
  const module = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync('utils/progress-calories.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInThisContext('(function(module,exports){' + js + '\n})')(module, module.exports);
  return module.exports.calculateProgressCalorieAverages;
}

test('calculates current calendar week and month calories per workout', () => {
  const calculate = loadCalculator();
  const entry = (date, caloriesBurned) => ({ date, caloriesBurned });
  const result = calculate([
    entry('2026-09-14T10:00:00', 200),
    entry('2026-09-16T10:00:00', 400),
    entry('2026-09-05T10:00:00', 100),
    entry('2026-08-30T10:00:00', 900),
    entry('2026-09-17T12:00:00', undefined),
    entry('2026-09-18T10:00:00', 800),
  ], new Date('2026-09-17T18:00:00'));
  assert.deepEqual(result.week, { average: 300, workoutCount: 2 });
  assert.deepEqual(result.month, { average: 233, workoutCount: 3 });
});

test('returns an empty average when no calorie estimates exist', () => {
  const calculate = loadCalculator();
  const result = calculate([], new Date('2026-09-17T18:00:00'));
  assert.deepEqual(result.week, { average: null, workoutCount: 0 });
  assert.deepEqual(result.month, { average: null, workoutCount: 0 });
});
