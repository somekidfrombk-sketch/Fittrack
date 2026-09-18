const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadLibrary() {
  const filename = path.resolve('data/nutrient-library.ts');
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const localRequire = () => ({});
  vm.runInThisContext('(function(require,module,exports){' + js + '\n})', { filename })(localRequire, module, module.exports);
  return module.exports;
}

test('nutrient library includes required categories and core entries', () => {
  const { NUTRIENT_LIBRARY } = loadLibrary();
  const names = new Set(NUTRIENT_LIBRARY.map((item) => item.name));
  [
    'Vitamin A', 'Vitamin B1 (Thiamin)', 'Vitamin B2 (Riboflavin)', 'Vitamin B3 (Niacin)',
    'Vitamin B5 (Pantothenic Acid)', 'Vitamin B6', 'Vitamin B7 (Biotin)', 'Vitamin B9 (Folate)',
    'Vitamin B12', 'Vitamin C', 'Vitamin D', 'Vitamin E', 'Vitamin K', 'Calcium', 'Magnesium',
    'Zinc', 'Iron', 'Potassium', 'Sodium', 'Selenium', 'Iodine', 'Copper', 'Creatine monohydrate',
    'Protein / whey protein', 'Omega-3 fatty acids', 'Electrolytes',
  ].forEach((name) => assert.ok(names.has(name), `missing ${name}`));
  const sports = NUTRIENT_LIBRARY.filter((item) => ['Creatine monohydrate', 'Protein / whey protein', 'Omega-3 fatty acids', 'Electrolytes'].includes(item.name));
  assert.equal(sports.length, 4);
  assert.ok(sports.every((item) => item.category === 'Sports Nutrition'));
  assert.ok(NUTRIENT_LIBRARY.every((item) => item.trainingAndRecovery && item.evidenceSources.length > 0));
});
