const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('workout photos persist, stay scoped, and clean up failed saves', async () => {
  const data = new Map();
  const files = new Set();
  let fail = false;
  const storage = {
    async getItem(key) { return data.get(key) ?? null; },
    async setItem(key, value) {
      if (fail) { fail = false; throw new Error('Storage full'); }
      data.set(key, value);
    },
  };
  const photoFiles = {
    async persistWorkoutPhoto(_asset, id) { files.add(id); return id; },
    async deleteWorkoutPhotoFile(id) { files.delete(id); },
  };
  const cache = new Map();
  function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    const localRequire = (id) => {
      if (id === '@react-native-async-storage/async-storage') return storage;
      if (id === './workout-photo-files') return photoFiles;
      return load(path.resolve(path.dirname(filename), id + '.ts'));
    };
    vm.runInThisContext('(function(require,module,exports){' + js + '\n})')(localRequire, module, module.exports);
    return module.exports;
  }
  const photos = load('services/workout-photo-storage.ts');
  await Promise.all([
    photos.addWorkoutPhoto('a', 'first', { uri: 'one' }),
    photos.addWorkoutPhoto('a', 'first', { uri: 'two' }),
    photos.addWorkoutPhoto('a', 'second', { uri: 'three' }),
    photos.addWorkoutPhoto('b', 'first', { uri: 'four' }),
  ]);
  const first = await photos.loadWorkoutPhotos('a', 'first');
  assert.equal(first.length, 2);
  assert.equal((await photos.loadWorkoutPhotos('a', 'second')).length, 1);
  assert.equal((await photos.loadWorkoutPhotos('b', 'first')).length, 1);
  await photos.removeWorkoutPhoto('a', 'first', first[0].id);
  assert.equal((await photos.loadWorkoutPhotos('a', 'first')).length, 1);
  assert.equal(files.size, 3);
  fail = true;
  await assert.rejects(photos.addWorkoutPhoto('a', 'first', { uri: 'five' }));
  assert.equal(files.size, 3);
  cache.clear();
  const reopened = load('services/workout-photo-storage.ts');
  assert.equal((await reopened.loadWorkoutPhotos('a', 'first')).length, 1);
});
