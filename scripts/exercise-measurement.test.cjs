const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadModule(filename) {
  const cache = new Map();

  function load(currentFilename) {
    const resolved = path.resolve(currentFilename);
    if (cache.has(resolved)) return cache.get(resolved).exports;

    if (resolved.endsWith('.json')) {
      return JSON.parse(fs.readFileSync(resolved, 'utf8'));
    }

    const module = { exports: {} };
    cache.set(resolved, module);

    const js = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
        resolveJsonModule: true,
      },
    }).outputText;

    const localRequire = (id) => {
      if (id.endsWith('.json')) {
        return load(path.resolve(path.dirname(resolved), id));
      }

      if (id.startsWith('.')) {
        const base = path.resolve(path.dirname(resolved), id);
        for (const extension of ['.ts', '.tsx', '.json']) {
          if (fs.existsSync(base + extension)) return load(base + extension);
        }
        return load(base);
      }

      return require(id);
    };

    vm.runInThisContext('(function(require,module,exports){' + js + '\n})')(
      localRequire,
      module,
      module.exports
    );

    return module.exports;
  }

  return load(filename);
}

test('exercise measurements infer weighted, bodyweight, and duration inputs from metadata', () => {
  const { getExerciseMeasurement } = loadModule('components/workout/exerciseMeasurement.ts');

  const weighted = getExerciseMeasurement('barbell bench press');
  assert.equal(weighted.kind, 'weighted');
  assert.equal(weighted.primaryLabel, 'WEIGHT');
  assert.equal(weighted.secondaryLabel, 'REPS');

  const bodyweight = getExerciseMeasurement('archer push up');
  assert.equal(bodyweight.kind, 'bodyweight');
  assert.equal(bodyweight.primaryLabel, 'REPS');
  assert.equal(bodyweight.secondaryLabel, null);

  const duration = getExerciseMeasurement('front plank with twist');
  assert.equal(duration.kind, 'duration');
  assert.equal(duration.primaryLabel, 'TIME');
  assert.equal(duration.secondaryLabel, null);
});