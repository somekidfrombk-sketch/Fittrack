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

test('muscle recency uses the latest completed workout for the same muscle group', () => {
  const { getMuscleRecencyForExercise } = loadModule('components/workout/muscleRecency.ts');
  const now = new Date('2026-09-18T12:00:00.000Z');
  const history = [
    {
      id: 'newer-back',
      profileId: 'profile',
      date: '2026-09-17T12:00:00.000Z',
      durationSeconds: 1800,
      totalVolume: 0,
      completedSets: 1,
      exercises: [
        {
          id: 'row',
          name: 'Seated Row',
          sets: [{ id: 'set-1', weight: '100', reps: '10', completed: true }],
        },
      ],
    },
    {
      id: 'older-chest',
      profileId: 'profile',
      date: '2026-09-12T12:00:00.000Z',
      durationSeconds: 1800,
      totalVolume: 0,
      completedSets: 1,
      exercises: [
        {
          id: 'fly',
          name: 'barbell incline bench press',
          sets: [{ id: 'set-2', weight: '80', reps: '12', completed: true }],
        },
      ],
    },
    {
      id: 'newer-chest-skipped',
      profileId: 'profile',
      date: '2026-09-16T12:00:00.000Z',
      durationSeconds: 1800,
      totalVolume: 0,
      completedSets: 0,
      exercises: [
        {
          id: 'press-skipped',
          name: 'barbell bench press',
          sets: [{ id: 'set-3', weight: '90', reps: '8', completed: false }],
        },
      ],
    },
    {
      id: 'newest-chest',
      profileId: 'profile',
      date: '2026-09-15T12:00:00.000Z',
      durationSeconds: 1800,
      totalVolume: 0,
      completedSets: 1,
      exercises: [
        {
          id: 'chest-press',
          name: 'barbell bench press',
          sets: [{ id: 'set-4', weight: '95', reps: '8', completed: true }],
        },
      ],
    },
  ];

  const recency = getMuscleRecencyForExercise('barbell incline bench press', history, now);

  assert.equal(recency.muscle, 'Chest');
  assert.equal(recency.daysSince, 3);
  assert.equal(recency.label, '3 days since Chest');
  assert.equal(recency.lastWorkedAt, '2026-09-15T12:00:00.000Z');
});
