const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('workout context saves profile and settings without a device photo path', async () => {
  const module = { exports: {} };
  const filename = path.resolve('services/user-context-snapshot.ts');
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const localRequire = (id) => {
    if (id === './profile-storage') return { loadProfile: async () => ({ id: 'a', name: 'Eric', weight: '251', avatarUri: 'file://private.jpg' }) };
    if (id === './health-connection-storage') return { loadPhonePedometerEnabled: async () => true };
    if (id === './run-notification-settings') return { loadRunNotificationDistance: async () => 0.5 };
    throw new Error('Unexpected import: ' + id);
  };
  vm.runInThisContext('(function(require,module,exports){' + js + '\n})')(localRequire, module, module.exports);
  const snapshot = await module.exports.createUserContextSnapshot('a');
  assert.equal(snapshot.profile.weight, '251');
  assert.equal(snapshot.profile.avatarUri, undefined);
  assert.deepEqual(snapshot.settings, { phonePedometerEnabled: true, runNotificationMiles: 0.5 });
  assert.ok(!Number.isNaN(new Date(snapshot.capturedAt).getTime()));
});
