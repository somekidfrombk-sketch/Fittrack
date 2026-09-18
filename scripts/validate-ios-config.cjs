const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const cli = require.resolve('expo/bin/cli');
const config = JSON.parse(execFileSync(process.execPath, [cli, 'config', '--type', 'introspect', '--json'], {
  encoding: 'utf8', maxBuffer: 10 * 1024 * 1024,
}));
const ios = config._internal.modResults.ios;
const entitlements = ios.entitlements;
assert.equal(config.ios.bundleIdentifier, 'com.somekidfrombk.FitTrack');
assert.equal(entitlements['com.apple.developer.healthkit'], true);
assert.equal(entitlements['com.apple.developer.healthkit.background-delivery'], undefined);
assert.ok(ios.infoPlist.NSHealthShareUsageDescription);
assert.equal(ios.infoPlist.NSHealthUpdateUsageDescription, undefined);
assert.deepEqual(entitlements['com.apple.developer.icloud-services'], ['CloudDocuments']);
for (const key of ['com.apple.developer.icloud-container-identifiers', 'com.apple.developer.ubiquity-container-identifiers']) {
  assert.deepEqual(entitlements[key], ['iCloud.com.somekidfrombk.FitTrack']);
}
assert.equal(entitlements['com.apple.developer.icloud-container-environment'], 'Development');
console.log('Expo introspection passed: com.somekidfrombk.FitTrack, read-only HealthKit, iCloud Documents. No native project or build generated.');
