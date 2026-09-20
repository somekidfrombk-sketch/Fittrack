const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  vm.runInThisContext('(function(require,module,exports){' + code + '\n})')((id) => {
    assert.ok(id in mocks, 'Unexpected native dependency: ' + id);
    return mocks[id];
  }, module, module.exports);
  return module.exports;
}

test('HealthKit requests only steps, heart rate and sleep reads; handles empty data and overlapping sleep', async () => {
  let sum;
  let requested;
  let saved = false;
  const sample = (id, start, end, value) => ({ uuid: id, startDate: new Date(start), endDate: new Date(end), value });
  const api = load('services/apple-health.ios.ts', {
    '@kingstinct/react-native-healthkit': {
      AuthorizationRequestStatus: { shouldRequest: 1 },
      CategoryValueSleepAnalysis: { inBed: 0, asleep: 1, awake: 2, asleepCore: 3, asleepDeep: 4, asleepREM: 5 },
      isHealthDataAvailableAsync: async () => true,
      getRequestStatusForAuthorization: async () => saved ? 2 : 1,
      requestAuthorization: async (options) => { requested = options; return true; },
      queryStatisticsForQuantity: async (type, options, filter) => {
        assert.equal(type, 'HKQuantityTypeIdentifierStepCount');
        assert.deepEqual(options, ['cumulativeSum']);
        assert.equal(filter.unit, 'count');
        return { sumQuantity: sum };
      },
      getMostRecentQuantitySample: async (type, unit) => {
        assert.equal(type, 'HKQuantityTypeIdentifierHeartRate');
        assert.equal(unit, 'count/min');
        return { quantity: 72.2, endDate: new Date('2026-09-17T15:00:00Z') };
      },
      queryCategorySamples: async () => [
        sample('a', '2026-09-16T22:00Z', '2026-09-17T06:00Z', 1),
        sample('b', '2026-09-16T23:00Z', '2026-09-17T01:00Z', 4),
        sample('c', '2026-09-16T21:00Z', '2026-09-17T07:00Z', 0),
        sample('d', '2026-09-16T12:00Z', '2026-09-16T13:00Z', 1),
      ],
    },
    './health-connection-storage': { loadAppleHealthRequested: async () => saved, saveAppleHealthRequested: async (value) => { saved = value; } },
  });
  assert.equal((await api.initializeHealthKit()).status, 'not-requested');
  assert.equal((await api.requestHealthPermissions()).status, 'connected');
  assert.deepEqual(requested, { toRead: ['HKQuantityTypeIdentifierHeartRate', 'HKQuantityTypeIdentifierStepCount', 'HKCategoryTypeIdentifierSleepAnalysis'] });
  assert.equal(await api.getTodaySteps(), null);
  sum = { quantity: 1234 };
  assert.equal(await api.getTodaySteps(), 1234);
  assert.deepEqual(await api.getRecentHeartRate(), { beatsPerMinute: 72, timestamp: '2026-09-17T15:00:00.000Z' });
  assert.equal((await api.getSleepData()).latestSleepDurationMinutes, 480);
});

test('Apple Health settings keeps Connect actionable when the native module is unavailable', () => {
  const settings = fs.readFileSync('app/settings.tsx', 'utf8');
  assert.match(settings, /disabled=\{appleHealthLoading\}/);
  assert.match(settings, /Apple Health permission requires an iPhone standalone build/);
  assert.match(settings, /const authorization = await connectAppleHealth\(\)/);
});

function backupHarness() {
  const storage = new Map();
  const bytes = new Map();
  const directories = new Set();
  const cloud = new Map();
  const cloudDirectories = new Set();
  let failUpload = false;
  let failStorage = false;
  let placeholder = false;
  const uri = (...parts) => parts.map((part) => typeof part === 'string' ? part : part.uri).join('/').replace(/\/$/, '');
  class File {
    constructor(...parts) { this.uri = uri(...parts); this.name = this.uri.split('/').pop(); }
    get exists() { return bytes.has(this.uri); }
    copy(destination) {
      assert.ok(this.exists, 'Source missing: ' + this.uri);
      assert.ok(!destination.exists, 'Destination exists: ' + destination.uri);
      bytes.set(destination.uri, bytes.get(this.uri));
    }
    delete() { bytes.delete(this.uri); }
  }
  class Directory {
    constructor(...parts) { this.uri = uri(...parts); this.name = this.uri.split('/').pop(); }
    get exists() { return directories.has(this.uri); }
    create() { directories.add(this.uri); }
    delete() {
      for (const key of bytes.keys()) if (key.startsWith(this.uri + '/')) bytes.delete(key);
      for (const key of directories) if (key === this.uri || key.startsWith(this.uri + '/')) directories.delete(key);
    }
    list() {
      return [...directories, ...bytes.keys()].filter((key) => key.startsWith(this.uri + '/') && !key.slice(this.uri.length + 1).includes('/'))
        .map((key) => directories.has(key) ? new Directory(key) : new File(key));
    }
  }
  const Paths = { document: 'file:///new/Documents', cache: 'file:///new/Cache' };
  const api = load('services/icloud-backup.ios.ts', {
    '@react-native-async-storage/async-storage': {
      getAllKeys: async () => [...storage.keys()],
      getItem: async (key) => storage.get(key) ?? null,
      multiGet: async (keys) => keys.map((key) => [key, storage.get(key) ?? null]),
      multiSet: async (pairs) => {
        for (const [key, value] of pairs) {
          storage.set(key, value);
          if (failStorage) { failStorage = false; throw new Error('Storage full'); }
        }
      },
      multiRemove: async (keys) => keys.forEach((key) => storage.delete(key)),
    },
    'expo-file-system': { Directory, File, Paths },
    'react-native-cloud-storage': {
      CloudStorageScope: { AppData: 'appData' },
      CloudStorage: {
        isCloudAvailable: async () => true,
        mkdir: async (key) => cloudDirectories.add(key),
        exists: async (key) => cloud.has(key),
        readFile: async (key) => {
          if (placeholder) throw new Error('Not downloaded');
          return cloud.get(key);
        },
        triggerSync: async (key) => {
          if (!cloud.has(key)) throw new Error('No cloud file');
          placeholder = false;
        },
        writeFile: async (key, value) => {
          assert.ok(cloudDirectories.has('/FitTrack'), 'Backup parent directory missing');
          cloud.set(key, value);
        },
        uploadFile: async (remote, local) => {
          if (failUpload) throw new Error('Upload failed');
          assert.ok(bytes.has('file://' + local));
          cloud.set(remote, bytes.get('file://' + local));
        },
        downloadFile: async (remote, local) => {
          if (!cloud.has(remote)) throw new Error('Download failed');
          bytes.set('file://' + local, cloud.get(remote));
        },
      },
    },
  });
  function photo(relative, content) {
    directories.add(Paths.document + '/' + relative.slice(0, relative.lastIndexOf('/')));
    bytes.set(Paths.document + '/' + relative, content);
  }
  return { api, storage, bytes, cloud, photo, evict: () => { placeholder = true; }, failUpload: () => { failUpload = true; }, failStorage: () => { failStorage = true; } };
}

test('iCloud first backup without photos succeeds', async () => {
  const h = backupHarness();
  h.storage.set('fittrack_user_profile', '{"id":"a"}');
  assert.equal((await h.api.createICloudBackup()).fileCount, 0);
  assert.equal((await h.api.getICloudBackupStatus()).exists, true);
});

test('iCloud round-trip preserves profile, settings, workouts, progress, food and local photo bytes', async () => {
  const h = backupHarness();
  const records = {
    fittrack_user_profile: JSON.stringify({ id: 'a', weight: 80, avatarUri: 'file:///old/Documents/fittrack-avatars/a.jpg' }),
    fittrack_active_profile_id: 'a',
    fittrack_phone_pedometer_enabled: 'true',
    fittrack_run_notification_settings: '{"a":1}',
    fittrack_workout_history: '[{"weight":50,"reps":8}]',
    'fittrack_daily_steps:a:2026-09-17': '5000',
    'fittrack_workout_photos:a:w': '[{"location":"p.jpg"}]',
    fittrack_food_logs: '[{"calories":400}]',
    fittrack_food_favorites: '[{"name":"Oats"}]',
    fittrack_saved_barcode_products: '[{"barcode":"123"}]',
    fittrack_run_history: '[{"distanceMeters":5000}]',
    fittrack_vitamins: '[{"name":"D"}]',
  };
  for (const entry of Object.entries(records)) h.storage.set(...entry);
  h.storage.set('unrelated-token', 'private');
  h.photo('fittrack-workout-photos/p.jpg', 'progress-photo-bytes');
  h.photo('fittrack-avatars/a.jpg', 'avatar-bytes');
  h.photo('fittrack-products/product.jpg', 'product-bytes');
  const backup = await h.api.createICloudBackup();
  assert.equal(backup.fileCount, 3);
  const manifest = JSON.parse(h.cloud.get('/FitTrack/backup.json'));
  assert.equal(manifest.storage['unrelated-token'], undefined);
  h.storage.clear(); h.bytes.clear();
  await h.api.restoreICloudBackup();
  for (const [key, value] of Object.entries(records)) {
    assert.equal(h.storage.get(key), value.replace('file:///old/Documents', 'file:///new/Documents'));
  }
  assert.equal(h.bytes.get('file:///new/Documents/fittrack-workout-photos/p.jpg'), 'progress-photo-bytes');
  assert.equal(h.bytes.get('file:///new/Documents/fittrack-avatars/a.jpg'), 'avatar-bytes');
  assert.equal(h.bytes.get('file:///new/Documents/fittrack-products/product.jpg'), 'product-bytes');
  assert.equal(await h.api.createAutomaticICloudBackup(), null);
});

test('failed upload preserves the previous manifest and photo generation', async () => {
  const h = backupHarness();
  h.photo('fittrack-workout-photos/p.jpg', 'old');
  await h.api.createICloudBackup();
  const previous = new Map(h.cloud);
  h.photo('fittrack-workout-photos/p.jpg', 'new');
  h.failUpload();
  await assert.rejects(h.api.createICloudBackup(), /Upload failed/);
  assert.deepEqual(h.cloud, previous);
});

test('failed download changes no local data; failed storage commit rolls back data and photos', async () => {
  for (const failure of ['download', 'storage']) {
    const h = backupHarness();
    h.storage.set('fittrack_user_profile', '{"id":"backup"}');
    h.photo('fittrack-workout-photos/p.jpg', 'backup');
    await h.api.createICloudBackup();
    h.storage.set('fittrack_user_profile', '{"id":"current"}');
    h.photo('fittrack-workout-photos/p.jpg', 'current');
    if (failure === 'download') {
      for (const key of h.cloud.keys()) if (key.includes('/files/')) h.cloud.delete(key);
    } else h.failStorage();
    await assert.rejects(h.api.restoreICloudBackup());
    assert.equal(h.storage.get('fittrack_user_profile'), '{"id":"current"}');
    assert.equal(h.bytes.get('file:///new/Documents/fittrack-workout-photos/p.jpg'), 'current');
  }
});

test('malformed restore paths are rejected before changing data', async () => {
  for (const relativePath of ['fittrack-workout-photos/../evil', 'fittrack-workout-photos/%2e%2e/evil', 'fittrack-workout-photos', 'fittrack-workout-photos/\\evil']) {
    const h = backupHarness();
    h.cloud.set('/FitTrack/backup.json', JSON.stringify({ format: 'FitTrack iCloud backup', schemaVersion: 1,
      createdAt: new Date().toISOString(), storage: {}, files: [{ relativePath, mimeType: 'image/jpeg' }] }));
    await assert.rejects(h.api.restoreICloudBackup(), /invalid photo path/);
  }
});

test('automatic backup does not overwrite a different profile', async () => {
  const h = backupHarness();
  h.storage.set('fittrack_user_profile', '{"id":"original"}');
  await h.api.createICloudBackup();
  const old = h.cloud.get('/FitTrack/backup.json');
  h.storage.set('fittrack_user_profile', '{"id":"different"}');
  assert.equal(await h.api.createAutomaticICloudBackup(), null);
  assert.equal(h.cloud.get('/FitTrack/backup.json'), old);
});

test('legacy backups without snapshot IDs still restore photo bytes', async () => {
  const h = backupHarness();
  h.cloud.set('/FitTrack/backup.json', JSON.stringify({ format: 'FitTrack iCloud backup', schemaVersion: 1,
    createdAt: new Date().toISOString(), storage: { fittrack_user_profile: '{"id":"legacy"}' },
    files: [{ relativePath: 'fittrack-workout-photos/old.jpg', mimeType: 'image/jpeg' }] }));
  h.cloud.set('/FitTrack/files/fittrack-workout-photos/old.jpg', 'legacy-photo');
  await h.api.restoreICloudBackup();
  assert.equal(h.bytes.get('file:///new/Documents/fittrack-workout-photos/old.jpg'), 'legacy-photo');
});

test('concurrent backups coalesce and restore cannot overlap backup', async () => {
  const h = backupHarness();
  const first = h.api.createICloudBackup();
  assert.equal(h.api.createICloudBackup(), first);
  await assert.rejects(h.api.restoreICloudBackup(), /in progress/);
  await first;
});


test('iCloud downloads an evicted manifest before reading backup status', async () => {
  const h = backupHarness();
  await h.api.createICloudBackup();
  h.evict();
  assert.equal((await h.api.getICloudBackupStatus()).exists, true);
});


test('iCloud backup read errors do not report the account as disconnected and can recover', async () => {
  const h = backupHarness();
  h.cloud.set('/FitTrack/backup.json', 'invalid json');
  const failed = await h.api.getICloudBackupStatus();
  assert.equal(failed.available, true);
  assert.equal(failed.exists, false);
  assert.match(failed.error, /Could not read/);
  h.cloud.delete('/FitTrack/backup.json');
  const recovered = await h.api.getICloudBackupStatus();
  assert.equal(recovered.available, true);
  assert.equal(recovered.error, undefined);
});


test('HealthKit requests directly without relying on status or local storage', async () => {
  let requested = 0;
  const api = load('services/apple-health.ios.ts', {
    '@kingstinct/react-native-healthkit': {
      isHealthDataAvailableAsync: async () => true,
      getRequestStatusForAuthorization: async () => { throw new Error('Status unavailable'); },
      requestAuthorization: async () => { requested++; return true; },
    },
    './health-connection-storage': {
      loadAppleHealthRequested: async () => { throw new Error('Storage unavailable'); },
      saveAppleHealthRequested: async () => { throw new Error('Storage unavailable'); },
    },
  });
  assert.equal((await api.requestHealthPermissions()).status, 'connected');
  assert.equal(requested, 1);
});

test('HealthKit preserves native failures and identifies missing signing entitlements', async () => {
  for (const message of ['Missing com.apple.developer.healthkit entitlement', 'Device is locked']) {
    const api = load('services/apple-health.ios.ts', {
      '@kingstinct/react-native-healthkit': {
        isHealthDataAvailableAsync: async () => true,
        requestAuthorization: async () => { throw { message }; },
      },
      './health-connection-storage': {},
    });
    const result = await api.requestHealthPermissions();
    assert.equal(result.status, 'error');
    assert.equal(result.hasRequested, false);
    assert.ok(result.errorMessage.includes(message));
    assert.equal(result.errorMessage.includes('provisioning profile'), message.includes('entitlement'));
  }
});
