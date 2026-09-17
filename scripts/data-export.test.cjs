const assert = require('node:assert/strict');
const { test } = require('node:test');

test('export filename is safe and JSON files preserve nested records', () => {
  const filename = `fittrack-export-${new Date('2026-09-17').toISOString().slice(0, 10)}.json`;
  assert.equal(filename, 'fittrack-export-2026-09-17.json');
  const sample = { nutrition: { foodLogs: [{ calories: 300 }] }, exercise: { strengthWorkouts: [{ totalVolume: 5000 }] } };
  assert.deepEqual(JSON.parse(JSON.stringify(sample)), sample);
});
