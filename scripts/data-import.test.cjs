const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, storage) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  vm.runInThisContext('(function(require,module,exports){' + code + '\n})')((id) => {
    if (id === '@react-native-async-storage/async-storage') return storage;
    throw new Error('Unexpected import: ' + id);
  }, module, module.exports);
  return module.exports;
}

test('FitTrack export import writes existing storage keys and replaces profile steps', async () => {
  const data = new Map([
    ['fittrack_daily_steps:p1:2026-09-01', '100'],
    ['fittrack_daily_steps:other:2026-09-01', '200'],
  ]);
  const storage = {
    async getAllKeys() { return [...data.keys()]; },
    async multiRemove(keys) { keys.forEach((key) => data.delete(key)); },
    async multiSet(pairs) { pairs.forEach(([key, value]) => data.set(key, value)); },
  };
  const api = load('services/data-import.ts', storage);
  const result = await api.importFitTrackExport(JSON.stringify({
    format: 'FitTrack user data export',
    schemaVersion: 1,
    profile: { id: 'p1', name: 'Eric' },
    nutrition: { foodLogs: [{ id: 'food' }], favorites: [{ id: 'fav' }], customBarcodeFoods: [{ id: 'custom' }] },
    exercise: { strengthWorkouts: [{ id: 'workout' }], runningAndCycling: [{ id: 'run' }] },
    vitamins: [{ id: 'vitamin' }],
    steps: [{ date: '2026-09-02', steps: 1234 }],
    settings: { phonePedometerEnabled: true, runNotificationMiles: 1 },
  }));

  assert.equal(result.profileId, 'p1');
  assert.equal(result.importedSteps, 1);
  assert.equal(data.get('fittrack_user_profile'), JSON.stringify({ id: 'p1', name: 'Eric' }));
  assert.equal(data.get('fittrack_active_profile_id'), 'p1');
  assert.equal(data.get('fittrack_workout_history'), JSON.stringify([{ id: 'workout' }]));
  assert.equal(data.get('fittrack_food_logs'), JSON.stringify([{ id: 'food' }]));
  assert.equal(data.get('fittrack_daily_steps:p1:2026-09-01'), undefined);
  assert.equal(data.get('fittrack_daily_steps:p1:2026-09-02'), '1234');
  assert.equal(data.get('fittrack_daily_steps:other:2026-09-01'), '200');
});