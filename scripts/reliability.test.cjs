// Run with: node --test scripts/reliability.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise real services against delayed storage to expose overlapping writes.
function harness() {
  const data = new Map();
  const cache = new Map();
  let failNextWrite = false;
  const storage = {
    async getItem(key) { await new Promise(resolve => setTimeout(resolve, 1)); return data.get(key) ?? null; },
    async setItem(key, value) {
      await new Promise(resolve => setTimeout(resolve, 1));
      if (failNextWrite) { failNextWrite = false; throw new Error('disk unavailable'); }
      data.set(key, value);
    },
  };
  function load(relative) {
    const filename = path.resolve(relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    const localRequire = (id) => id === '@react-native-async-storage/async-storage'
      ? storage : load(path.resolve(path.dirname(filename), id + '.ts'));
    vm.runInThisContext('(function(require,module,exports){' + js + '\n})', { filename })(localRequire, module, module.exports);
    return module.exports;
  }
  return { data, load, failWrite() { failNextWrite = true; } };
}

test('concurrent food saves retain every entry and profile', async () => {
  const h = harness();
  const food = h.load('services/food-log-storage.ts');
  await Promise.all(Array.from({ length: 25 }, (_, i) => food.addFoodLog({
    id: String(i), profileId: i % 2 ? 'a' : 'b', calories: i,
  })));
  assert.equal((await food.loadFoodLogs('a')).length, 12);
  assert.equal((await food.loadFoodLogs('b')).length, 13);
  await food.addFoodLog({ id: 'shared', profileId: 'a' });
  await food.addFoodLog({ id: 'shared', profileId: 'b' });
  await food.removeFoodLog('a', 'shared');
  assert.ok((await food.loadFoodLogs('b')).some(entry => entry.id === 'shared'));
});

test('failed write does not block later saves', async () => {
  const h = harness();
  const food = h.load('services/food-log-storage.ts');
  h.failWrite();
  const first = food.addFoodLog({ id: 'bad', profileId: 'a' });
  const second = food.addFoodLog({ id: 'good', profileId: 'a' });
  await assert.rejects(first, /disk unavailable/);
  await second;
  assert.equal((await food.loadFoodLogs('a'))[0].id, 'good');
});

test('corrupted collections are not overwritten by saves', async () => {
  for (const raw of ['broken JSON', '{}']) {
    const h = harness();
    h.data.set('fittrack_vitamins', raw);
    const vitamins = h.load('services/vitamin-storage.ts');
    await assert.rejects(vitamins.saveVitamin({ id: 'new', profileId: 'a' }));
    assert.equal(h.data.get('fittrack_vitamins'), raw);
  }
});

test('parallel favorites deduplicate and vitamins stay profile scoped', async () => {
  const h = harness();
  const favorites = h.load('services/food-favorites-storage.ts');
  await Promise.all(Array.from({ length: 8 }, () => favorites.addFoodFavorite('a', { id: 'egg' })));
  assert.equal((await favorites.loadFoodFavorites('a')).length, 1);
  const vitamins = h.load('services/vitamin-storage.ts');
  await Promise.all(['a','b'].map(profileId => vitamins.saveVitamin({ id: 'shared', profileId, takenDates: [] })));
  await vitamins.removeVitamin('a', 'shared');
  assert.equal((await vitamins.loadVitamins('b')).length, 1);
});

test('simultaneous profile initialization uses one ID and preserves legacy fields', async () => {
  const h = harness();
  const profiles = h.load('services/profile-storage.ts');
  const ids = await Promise.all(Array.from({ length: 10 }, () => profiles.getOrCreateProfileId()));
  assert.equal(new Set(ids).size, 1);
  h.data.set('fittrack_user_profile', JSON.stringify({ name: 'Eric', weight: '251' }));
  const migrated = await profiles.loadProfile();
  assert.equal(migrated.id, ids[0]);
  assert.equal(migrated.weight, '251');
});

test('workout history migration preserves other profiles', async () => {
  const h = harness();
  h.data.set('fittrack_workout_history', JSON.stringify([{ id: 'old' }, { id: 'other', profileId: 'b' }]));
  const workouts = h.load('services/workout-history-storage.ts');
  const history = await workouts.loadWorkoutHistory('a');
  assert.equal(history[0].profileId, 'a');
  await workouts.saveWorkoutHistory('a', [...history, { id: 'new', profileId: 'a' }]);
  assert.equal((await workouts.loadWorkoutHistory('b'))[0].id, 'other');
});



test('legacy vitamin records load with new tracking defaults', async () => {
  const h = harness();
  h.data.set('fittrack_vitamins', JSON.stringify([{ id: 'old', profileId: 'a', name: 'Vitamin D', dose: '1000 IU', time: '08:00', foodTiming: 'with-food', guidance: 'legacy', reminderEnabled: true, takenDates: ['2026-09-18'], createdAt: '2026-09-01T00:00:00.000Z' }]));
  const vitamins = h.load('services/vitamin-storage.ts');
  const loaded = await vitamins.loadVitamins('a');
  assert.equal(loaded[0].name, 'Vitamin D');
  assert.equal(loaded[0].dose, '1000 IU');
  assert.equal(loaded[0].servings, '1');
  assert.equal(loaded[0].frequency, 'Daily');
  assert.equal(loaded[0].notes, '');
  assert.deepEqual(loaded[0].takenDates, ['2026-09-18']);
});
