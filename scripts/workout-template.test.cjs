const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const source = fs.readFileSync('components/workout/workoutTemplate.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = { exports: {} };
new Function('module', 'exports', compiled)(loaded, loaded.exports);
const { exercisesFromHistoryTemplate } = loaded.exports;
const { planFromHistoryTemplate } = loaded.exports;

test('workout history becomes an uncompleted template without changing the original', () => {
  const history = {
    exercises: [{
      id: 'original-exercise', name: 'My row', exerciseLibraryId: 'custom-row', comment: 'Hard set today',
      muscleGroup: 'Back', trackingMethod: 'weight_reps', sets: [
        { id: 'original-set-1', weight: '100', reps: '8', completed: true },
        { id: 'original-set-2', weight: '110', reps: '6', completed: false },
      ],
    }],
  };
  let nextId = 0;
  const copied = exercisesFromHistoryTemplate(history, () => `new-${++nextId}`);
  assert.deepEqual(copied, [{
    id: 'new-1', name: 'My row', exerciseLibraryId: 'custom-row',
    muscleGroup: 'Back', trackingMethod: 'weight_reps', sets: [
      { id: 'new-2', weight: '100', reps: '8', completed: false },
      { id: 'new-3', weight: '110', reps: '6', completed: false },
    ],
  }]);
  assert.equal(history.exercises[0].sets[0].completed, true);
});

test('history can be named and saved in the regular workout-plan format', () => {
  const entry = { exercises: [{
    id: 'old', name: 'My row', exerciseLibraryId: 'custom-row', muscleGroup: 'Back',
    trackingMethod: 'weight_reps', sets: [{ id: 'set', weight: '100', reps: '8', completed: true }],
  }] };
  let nextId = 0;
  const plan = planFromHistoryTemplate(entry, ' Back day ', () => `plan-${++nextId}`);
  assert.deepEqual(plan, {
    id: 'plan-1', name: 'Back day', days: [], exercises: [{
      id: 'plan-2', name: 'My row', exerciseLibraryId: 'custom-row', muscleGroup: 'Back',
      trackingMethod: 'weight_reps', targetSets: '1', targetReps: '8', restSeconds: 60,
    }],
  });
});
