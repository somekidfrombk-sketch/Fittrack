const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const source = fs.readFileSync('components/exercise-library/exerciseMuscleFilter.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleRef = { exports: {} };
new Function('module', 'exports', compiled)(moduleRef, moduleRef.exports);
const { exerciseMatchesMuscle } = moduleRef.exports;
const exercises = require('../assets/exercises/exercises.en.json');

test('muscle focus uses the primary target instead of supporting muscles', () => {
  const byName = (name) => exercises.find((exercise) => exercise.name === name);
  for (const name of ['archer push up', 'arm slingers hanging bent knee legs', 'arm slingers hanging straight legs']) {
    assert.equal(exerciseMatchesMuscle(byName(name), 'Shoulders'), false, name);
  }
  assert.equal(exerciseMatchesMuscle(byName('archer push up'), 'Chest'), true);
  assert.equal(exerciseMatchesMuscle(byName('arm slingers hanging bent knee legs'), 'Core'), true);
  assert.equal(exerciseMatchesMuscle({ name: 'My raise', muscle_group: 'Shoulders', category: 'Strength', isCustom: true }, 'Shoulders'), true);
  const custom = { id: 'custom-1', name: 'Press and row', isCustom: true,
    muscle_group: 'Chest', muscleGroups: ['Chest', 'Back'] };
  assert.equal(exerciseMatchesMuscle(custom, 'Chest'), true);
  assert.equal(exerciseMatchesMuscle(custom, 'Back'), true);
  assert.equal(exerciseMatchesMuscle(custom, 'Shoulders'), false);
});
