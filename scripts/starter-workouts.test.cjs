const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(filename) {
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const moduleRef = { exports: {} };
  new Function('module', 'exports', compiled)(moduleRef, moduleRef.exports);
  return moduleRef.exports;
}

test('rowing and cable starter workouts use valid, nonduplicate exercises', () => {
  const existing = require('../assets/exercises/exercises.en.json');
  const { curatedExercises } = load('components/exercise-library/curatedExercises.ts');
  const { starterWorkoutPlans } = load('components/workout/starterWorkoutPlans.ts');
  const row = curatedExercises.find((exercise) => exercise.id === 'fittrack-rowing-machine');
  assert.equal(row.trackingMethod, 'distance_time');
  assert.equal(row.equipment, 'rowing machine');
  assert.equal(existing.some((exercise) => exercise.name.toLowerCase() === row.name.toLowerCase()), false);

  const byId = new Map([...existing, ...curatedExercises].map((exercise) => [exercise.id, exercise]));
  assert.equal(starterWorkoutPlans.length, 3);
  for (const plan of starterWorkoutPlans) {
    assert.ok(plan.exercises.length > 0, plan.name);
    for (const planned of plan.exercises) {
      const exercise = byId.get(planned.exerciseLibraryId);
      assert.ok(exercise, planned.name);
      assert.equal(planned.name, exercise.name);
      if (plan.name.startsWith('Cable')) assert.equal(exercise.equipment, 'cable');
    }
  }
});
